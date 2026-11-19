import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {randomUUID} from 'node:crypto';
import {net} from 'electron';
import {OmniEduStore} from '../../src/main/db';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';
import type {TerminalJobView} from '../../src/shared/xiaozhi-terminal-jobs';

const [activeRoot, output, mode, identityFile] = process.argv.slice(2);
const coldMode = mode === 'cold' || mode === 'cold_recheck';
const dataRoot = path.join(activeRoot, 'data'), workspace = path.join(activeRoot, 'workspace');
fs.mkdirSync(workspace, {recursive: true}); fs.mkdirSync(output, {recursive: true});
process.env.DEEPSEEK_API_KEY = 'synthetic-job-recovery-loopback';
process.env.DEEPSEEK_MODEL = 'deepseek-flash';
const report: Record<string, any> = {success: false, activeRoot, output, mode, paidCalls: 0, modelCalls: 0,
  checks: [], requests: [], processes: [], terminalUpdates: [],
  ackLossBoundary: 'Instrumented mode drops the real helper ACK at the main port before jobs.acknowledge. Normal modes use unchanged source.'};
const save = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
const processFunctions: Record<string, any> = {};
for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
  const methods = childProcess as unknown as Record<string, any>, original = methods[name]; processFunctions[name] = original;
  methods[name] = (...args: unknown[]) => {
    const record: Record<string, unknown> = {kind: name, file: String(args[0]), args: Array.isArray(args[1]) ? args[1].map(String) : []};
    report.processes.push(record); const child = Reflect.apply(original, childProcess, args); record.pid = child?.pid;
    if (child?.once) child.once('close', (code: number, signal: string) => {record.code = code; record.signal = signal;});
    return child;
  };
}
syncBuiltinESMExports();
let store: OmniEduStore | undefined, host: ReturnType<typeof createXiaozhiProductionHost> | undefined;
let sessionId = '', job: TerminalJobView;
let scenario: {name: string; input: Record<string, unknown>}[] = [];
const originalFetch = net.fetch;
const server = http.createServer(async (request, response) => {
  try {
    if (['/models', '/v1/models'].includes(request.url || '')) {
      report.requests.push({kind: 'catalogue', path: request.url});
      response.writeHead(200, {'content-type': 'application/json'});
      response.end(JSON.stringify({object: 'list', data: [{id: 'deepseek-flash', context_window: 1048576, max_output_tokens: 32768,
        input_modalities: ['text'], effort: {supported_levels: ['low', 'high', 'max'], default_level: 'low'}}]})); return;
    }
    assert(['/chat/completions', '/v1/chat/completions'].includes(request.url || ''));
    let body = ''; for await (const bytes of request) {body += bytes.toString(); assert(body.length <= 8 * 1048576);}
    report.requests.push({kind: 'model', path: request.url, body: JSON.parse(body)}); report.modelCalls++;
    const tool = scenario.shift();
    const delta = tool ? {role: 'assistant', tool_calls: [{index: 0, id: 'call_' + randomUUID().replaceAll('-', ''),
      type: 'function', function: {name: tool.name, arguments: JSON.stringify(tool.input)}}]}
      : {role: 'assistant', content: '持久终端已准备好供教师直接操作，请核对本轮结果。'};
    const base = {id: 'synthetic-job-recovery', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash'};
    response.writeHead(200, {'content-type': 'text/event-stream'});
    response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta, finish_reason: null}]}) + '\n\n');
    response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta: {}, finish_reason: tool ? 'tool_calls' : 'stop'}],
      usage: {prompt_tokens: 100, completion_tokens: 20, total_tokens: 120}}) + '\n\n');
    response.end('data: [DONE]\n\n');
  } catch (error) {report.serverError = String(error); save(); response.writeHead(500); response.end();}
});
const ref = (commandId = 'xicmd_' + randomUUID()) => ({sessionId, jobId: job.jobId, expectedRevision: job.revision,
  expectedControllerRevision: job.controllerRevision, expectedLeaseRevision: job.leaseRevision, commandId});
async function snapshot() {
  const task = await host!.taskSnapshot({sessionId});
  const record = await store!.xiaozhiState.terminalJobs.get(job.jobId);
  return {task, record, effects: await store!.xiaozhiState.effects.forTask(sessionId, job.taskId),
    grants: await store!.xiaozhiState.permissions.grants(sessionId),
    audit: await store!.xiaozhiState.sql.all('SELECT kind,reference,metadata_json FROM xiaozhi_permission_audit_v1 WHERE session_id=? ORDER BY rowid', [sessionId])};
}
async function refreshJob(commandId?: string) {
  const read = await host!.terminal.readXiaozhiTerminal({sessionId, jobId: job.jobId, sinceSequence: 0, ...(commandId ? {commandId} : {})});
  assert(read.ok, JSON.stringify(read)); job = read.data.job; return read.data;
}
async function readUntil(marker: string) {
  const deadline = Date.now() + 20000;
  do {await refreshJob(); if (job.terminal.output.includes(marker)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < deadline);
  throw Error('missing_output:' + marker + ':' + job.terminal.output.slice(-5000));
}
async function check(id: string, action: () => Promise<void>) {
  const start = performance.now();
  try {await action(); report.checks.push({id, pass: true, durationMs: performance.now() - start}); console.log('PASS ' + id);}
  catch (error) {report.checks.push({id, pass: false, durationMs: performance.now() - start, error: String(error instanceof Error ? error.stack : error)}); throw error;}
  finally {save();}
}
async function launch() {
  sessionId = (await store!.createAiConversationSession({title: '真实Job恢复合成任务', folderId: null})).session.id;
  await store!.xiaozhiState.setWorkspace(sessionId, workspace, 'Owned Job fixture');
  const permission = await host!.permissions.view(sessionId);
  await host!.permissions.setMode({sessionId, revision: permission.profile.revision, mode: 'fullAccess'});
  scenario = [{name: 'exec_command', input: {cmd: "$global:jobRecoveryValue=41; Write-Output 'JOB_RECOVERY_READY'",
    tty: true, background: true, yield_time_ms: 1000, lease_ms: 180000}}];
  const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '请在本任务准备持久终端，供教师亲自核对和输入；准备好后简短答复。'});
  assert(started.ok, JSON.stringify(started)); await host!.waitForRun(sessionId, started.runId);
  const list = await host!.terminal.listXiaozhiTerminals(sessionId); assert(list.ok, JSON.stringify(list));
  assert.equal(list.data.jobs.length, 1); job = list.data.jobs[0]; await readUntil('JOB_RECOVERY_READY');
  assert.equal(job.controller, 'teacher'); assert.equal(job.controls.write, true); assert.equal(job.terminal.state, 'running');
  const value = await snapshot(); assert(value.record.document.pid && value.record.document.helperPid);
  const identity = {activeRoot, dataRoot, workspace, database: path.join(dataRoot, 'app.db'), sessionId,
    taskId: job.taskId, jobId: job.jobId, runId: started.runId, record: value.record};
  report.launched = value; fs.writeFileSync(identityFile, JSON.stringify(identity, null, 2)); save(); return identity;
}
try {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = server.address(); assert(address && typeof address !== 'string');
  net.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    assert.equal(url.origin, 'https://api.deepseek.com');
    return fetch(`http://127.0.0.1:${address.port}${url.pathname}${url.search}`, init);
  };
  store = new OmniEduStore(dataRoot); await store.init();
  if (coldMode) {
    const identity = JSON.parse(fs.readFileSync(identityFile, 'utf8'));
    report.beforeColdHost = await store.xiaozhiState.terminalJobs.get(identity.jobId);
    assert.equal(report.beforeColdHost.document.state, 'interrupted');
    assert.equal(report.beforeColdHost.document.cleanup, mode === 'cold' ? 'needs_check' : 'complete');
  }
  host = createXiaozhiProductionHost({store, dataRoot, enabled: true, emit() {}, emitTerminal: event => report.terminalUpdates.push(event)});
  if (coldMode) {
    const identity = JSON.parse(fs.readFileSync(identityFile, 'utf8')); sessionId = identity.sessionId;
    const list = await host.terminal.listXiaozhiTerminals(sessionId); assert(list.ok, JSON.stringify(list));
    job = list.data.jobs.find(row => row.jobId === identity.jobId)!; assert(job);
    const until = Date.now() + 20000;
    do {report.cold = await snapshot(); if (report.cold.record.document.cleanup === 'complete') break;
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (Date.now() < until);
    report.read = await refreshJob();
    assert.equal(report.cold.record.document.state, 'interrupted'); assert.equal(job.cleanup, 'complete');
    assert.equal(report.cold.record.document.projectionState, 'needs_check');
    assert.equal(job.controls.write, false); assert.equal(job.controls.close, false); assert.equal(job.notice, 'needs_check');
    assert(report.cold.task.ok && report.cold.task.value.task?.id === identity.taskId);
    assert.equal(job.inputSequence, identity.record.inputSequence); assert.equal(job.acknowledgedInputSequence, identity.record.acknowledgedInputSequence);
    const effect = report.cold.effects.find((row: any) => row.id === identity.record.document.effectId); assert(effect);
    assert.equal(effect.state, 'unknown'); assert.equal(report.modelCalls, 0);
    assert.equal(report.processes.length, mode === 'cold' ? 1 : 0, JSON.stringify(report.processes));
    if (mode === 'cold') {
      const maintenance = report.processes[0]; assert.equal(maintenance.kind, 'spawn');
      assert.equal(path.resolve(maintenance.file), path.resolve(identity.record.document.runtime.directory, 'xiaozhi-sandbox.exe'));
      assert.deepEqual(maintenance.args, ['--cleanup-owned']);
    }
    const recovered = report.cold.audit.filter((row: any) => row.kind === 'terminal_job_recovered' && row.reference === job.jobId).at(-1);
    assert(recovered); report.maintenance = JSON.parse(recovered.metadata_json);
    assert.equal(report.maintenance.guestDispatched, false); assert.equal(report.maintenance.projectionRetained, true);
    assert.equal(report.maintenance.cleanup.jobActiveProcesses, 0); assert.equal(report.maintenance.cleanup.profileRemoved, true);
    assert.equal(report.maintenance.cleanup.remainingOwnedAces, 0); report.success = true;
  } else if (mode === 'cut') {
    const identity = await launch();
    fs.writeFileSync(path.join(output, 'cut-ready.json'), JSON.stringify({identity, modelCalls: report.modelCalls}, null, 2));
    await new Promise(() => {});
  } else {
    await launch();
    if (mode === 'ack_loss') {
      await check('J02_PHYSICAL_ACK_LOSS', async () => {
        const calls = report.modelCalls, processes = report.processes.length;
        const before = await snapshot(); report.beforeAckLoss = before;
        const command = {...ref(), chars: "$global:jobRecoveryValue++; Write-Output ('ACK_DROP_MARKER='+$global:jobRecoveryValue)\r"};
        report.inputCommand = command;
        const written = await host!.terminal.writeXiaozhiTerminal(command); assert(written.ok, JSON.stringify(written));
        job = written.data.job; report.written = written; assert.equal(written.data.ack.state, 'unknown');
        await readUntil('ACK_DROP_MARKER=42');
        const after = await snapshot(); report.afterAckLoss = after;
        const effect = after.effects.find(effect => effect.commandId === command.commandId)!; assert(effect);
        assert.equal(effect.state, 'unknown'); assert.equal(after.record.inputSequence, before.record.inputSequence + 1);
        assert.equal(after.record.acknowledgedInputSequence, before.record.acknowledgedInputSequence);
        assert.equal(job.controls.write, false); assert.equal(job.notice, 'unknown_ack');
        const exact = await refreshJob(command.commandId); report.exactAck = exact.ack; assert.deepEqual(exact.ack, written.data.ack);
        const duplicate = await host!.terminal.writeXiaozhiTerminal({...command, ...ref(command.commandId)});
        assert(duplicate.ok, JSON.stringify(duplicate)); report.duplicate = duplicate; job = duplicate.data.job;
        assert.deepEqual(duplicate.data.ack, written.data.ack); assert.equal(job.inputSequence, after.record.inputSequence);
        const blocked = await host!.terminal.writeXiaozhiTerminal({...ref(), chars: "Write-Output 'FORBIDDEN_AFTER_UNKNOWN'\r"});
        report.blocked = blocked; assert(!blocked.ok && blocked.error === 'unknown_ack', JSON.stringify(blocked));
        assert(!job.terminal.output.includes('FORBIDDEN_AFTER_UNKNOWN'));
        const instrumentation = (globalThis as unknown as {__jobAckFixture?: {writes: unknown[]; drops: {actualAck: number}[]}}).__jobAckFixture;
        assert(instrumentation); report.physicalAckInstrumentation = structuredClone(instrumentation);
        assert.equal(instrumentation.writes.length, 1); assert.equal(instrumentation.drops.length, 1);
        assert.equal(instrumentation.drops[0].actualAck, effect.execution?.inputSequence);
        assert.equal(job.terminal.output.split('ACK_DROP_MARKER=42').length - 1, 1);
        assert.equal(report.modelCalls, calls); assert.equal(report.processes.length, processes);
        const closed = await host!.terminal.closeXiaozhiTerminal(ref()); report.closed = closed; assert(closed.ok, JSON.stringify(closed));
        job = closed.data; assert.equal(job.controls.write, false); assert.equal(host!.permissions.engine.activeCount(), 0);
        const final = await snapshot(); report.afterUnknownClose = final;
        const physical = final.audit.filter((row: any) => row.kind === 'terminal_job_terminal' && row.reference === job.jobId).at(-1);
        assert(physical); report.cleanup = JSON.parse(physical.metadata_json).result.cleanup;
        assert.deepEqual(report.cleanup, {jobActiveProcesses: 0, profileRemoved: true, remainingOwnedAces: 0, ptyClosed: true});
        assert(final.task.ok, JSON.stringify(final.task));
        const {task, candidate, canAccept} = final.task.value;
        assert(task && candidate && canAccept, 'original reviewable Task candidate required');
        const reviewed = await host!.reviewTask({schema: task.schema, sessionId, taskId: task.id,
          revision: task.revision, requirementsVersion: task.requirementsVersion, requestId: 'xitact_' + randomUUID(),
          candidate, checked: task.criteria.filter(criterion => criterion.kind === 'human')
            .map(criterion => ({criterionId: criterion.id, version: criterion.version, accepted: true}))});
        report.unknownInputReview = reviewed;
        assert.deepEqual(reviewed, {ok: false, error: 'not_ready'});
        const protectedState = await snapshot();
        assert.deepEqual(protectedState.effects.find(row => row.id === effect.id),
          final.effects.find(row => row.id === effect.id));
        assert(protectedState.task.ok);
        assert.equal(protectedState.task.value.task?.state, task.state);
        assert.equal(instrumentation.writes.length, 1); assert.equal(report.modelCalls, calls);
      });
    } else {
    if (mode !== 'review_only') await check('J02_ACK_COMMIT_FAILURE', async () => {
      const calls = report.modelCalls, processes = report.processes.length;
      const before = await snapshot(); report.beforeInput = before;
      await store!.xiaozhiState.sql.run("CREATE TRIGGER owned_job_input_commit_failure BEFORE UPDATE OF state ON xiaozhi_effects_v1 WHEN json_extract(NEW.document_json,'$.operation')='job_input' AND NEW.state='committed' BEGIN SELECT RAISE(ABORT,'owned_job_input_commit_failure'); END");
      const command = {...ref(), chars: "$global:jobRecoveryValue++; Write-Output ('ACK_VALUE='+$global:jobRecoveryValue)\r"};
      report.inputCommand = command;
      const written = await host!.terminal.writeXiaozhiTerminal(command); assert(written.ok, JSON.stringify(written));
      job = written.data.job; report.written = written; assert.equal(written.data.ack.state, 'acknowledged');
      await readUntil('ACK_VALUE=42');
      const after = await snapshot(); report.afterInputFailure = after;
      const effect = after.effects.find(effect => effect.commandId === command.commandId)!; assert(effect);
      assert.equal(effect.operation, 'job_input'); assert.equal(effect.state, 'unknown');
      assert.equal(after.record.acknowledgedInputSequence, effect.execution?.inputSequence);
      assert.equal(after.record.inputSequence, before.record.inputSequence + 1);
      const exact = await refreshJob(command.commandId); report.exactAck = exact.ack;
      assert.deepEqual(exact.ack, written.data.ack); assert.equal(job.controls.write, true);
      const duplicate = await host!.terminal.writeXiaozhiTerminal({...command, ...ref(command.commandId)});
      assert(duplicate.ok, JSON.stringify(duplicate)); report.duplicate = duplicate; job = duplicate.data.job;
      assert.deepEqual(duplicate.data.ack, written.data.ack); assert.equal(job.inputSequence, after.record.inputSequence);
      await refreshJob(); assert.equal(job.terminal.state, 'running'); assert.equal(job.controls.write, true);
      await store!.xiaozhiState.sql.run('DROP TRIGGER owned_job_input_commit_failure');
      const continuation = await host!.terminal.writeXiaozhiTerminal({...ref(), chars: "Write-Output ('AFTER_DUP='+$global:jobRecoveryValue)\r"});
      assert(continuation.ok, JSON.stringify(continuation)); job = continuation.data.job;
      await readUntil('AFTER_DUP=42'); assert(!job.terminal.output.includes('AFTER_DUP=43'));
      assert.equal(job.terminal.output.split('ACK_VALUE=42').length - 1, 1);
      assert.equal(report.modelCalls, calls); assert.equal(report.processes.length, processes);
      const current = await snapshot(); report.afterInputRecovery = current;
      report.effectBeforeTeacherReview = current.effects.find(row => row.id === effect.id);
      assert.deepEqual(current.record.document.decision.grantRefs, before.record.document.decision.grantRefs);
    });
    await check('J03_TEACHER_REVIEW_CLOSES_JOB', async () => {
      const calls = report.modelCalls;
      const before = await snapshot(); report.beforeReview = before;
      assert(before.task.ok, JSON.stringify(before.task)); const value = before.task.value;
      assert(value.task && value.candidate, 'original Task candidate required'); assert.equal(value.canAccept, true, JSON.stringify(value));
      const reviewed = await host!.reviewTask({schema: 'xiaozhi.task.v1', sessionId, taskId: value.task.id,
        revision: value.task.revision, requirementsVersion: value.task.requirementsVersion, requestId: 'xitact_' + randomUUID(),
        candidate: value.candidate, checked: value.task.criteria.map(criterion => ({criterionId: criterion.id, version: criterion.version, accepted: true}))});
      report.review = reviewed; assert(reviewed.ok, JSON.stringify(reviewed)); assert.equal(reviewed.value.task?.state, 'completed');
      await refreshJob(); report.afterReview = await snapshot(); assert.equal(job.cleanup, 'complete'); assert.equal(job.controls.write, false);
      if (mode !== 'review_only') {
        const input = report.afterReview.effects.find((effect: any) => effect.commandId === report.inputCommand.commandId);
        report.productInputReconciliation = input; assert(input);
        assert.equal(input.state, 'reconciled'); assert(input.proofs.some((proof: any) => proof.kind === 'job_input'));
      }
      assert.equal(host!.permissions.engine.activeCount(), 0); assert.equal(report.modelCalls, calls);
      const physical = report.afterReview.audit.filter((row: any) => row.kind === 'terminal_job_terminal' && row.reference === job.jobId).at(-1);
      assert(physical); report.cleanup = JSON.parse(physical.metadata_json).result.cleanup;
      assert.deepEqual(report.cleanup, {jobActiveProcesses: 0, profileRemoved: true, remainingOwnedAces: 0, ptyClosed: true});
    });
    }
    report.success = true;
  }
} catch (error) {report.error = String(error instanceof Error ? error.stack : error); process.exitCode = 1; console.error(report.error);}
finally {
  save(); await host?.close(); await store?.close(); net.fetch = originalFetch;
  for (const [name, original] of Object.entries(processFunctions)) (childProcess as unknown as Record<string, unknown>)[name] = original;
  syncBuiltinESMExports(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); save();
  console.log(JSON.stringify({success: report.success, mode, output, checks: report.checks, error: report.error}));
}
