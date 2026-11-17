import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {net} from 'electron';
import {OmniEduStore} from '../../src/main/db';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';
import type {TerminalJobView} from '../../src/shared/xiaozhi-terminal-jobs';

const output = process.argv[2];
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-terminal-host-'));
const dataRoot = path.join(root, 'data');
const workspace = path.join(root, 'workspace');
fs.mkdirSync(workspace);
process.env.DEEPSEEK_API_KEY = 'synthetic-phase6-loopback';
process.env.DEEPSEEK_MODEL = 'deepseek-flash';
const checks: {name: string; pass: boolean; durationMs: number}[] = [];
const bodies: unknown[] = [];
const updates: unknown[] = [];
const report = {success: false, root, output, checks, paidCalls: 0, modelCalls: 0, error: undefined as string | undefined};
let scenario: {name: string; input: Record<string, unknown>}[] = [];
let modelGate: Promise<void> | undefined;
const fixture = http.createServer(async (request, response) => {
  try {
    if (request.url === '/v1/models') {
      response.writeHead(200, {'content-type': 'application/json'});
      response.end(JSON.stringify({object: 'list', data: [{id: 'deepseek-flash', context_window: 1048576,
        max_output_tokens: 32768, input_modalities: ['text'], effort: {supported_levels: ['low', 'high', 'max'], default_level: 'low'}}]}));
      return;
    }
    assert.equal(request.url, '/v1/chat/completions');
    let text = '';
    for await (const bytes of request) text += bytes.toString('utf8');
    bodies.push(JSON.parse(text));
    report.modelCalls++;
    if (!scenario.length && modelGate) await modelGate;
    const tool = scenario.shift();
    response.writeHead(200, {'content-type': 'text/event-stream'});
    const base = {id: 'synthetic-phase6', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash'};
    const delta = tool ? {role: 'assistant', tool_calls: [{index: 0, id: 'call_' + randomUUID().replaceAll('-', ''), type: 'function',
      function: {name: tool.name, arguments: JSON.stringify(tool.input)}}]} : {role: 'assistant', content: '终端作业已交给教师直接交互，后续沿原任务续接。'};
    response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta, finish_reason: null}]}) + '\n\n');
    response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta: {}, finish_reason: tool ? 'tool_calls' : 'stop'}],
      usage: {prompt_tokens: 100, completion_tokens: 30, total_tokens: 130}}) + '\n\n');
    response.end('data: [DONE]\n\n');
  } catch (error) {console.error(error); response.writeHead(500); response.end();}
});
const originalFetch = net.fetch;
let store = new OmniEduStore(dataRoot);
let host: ReturnType<typeof createXiaozhiProductionHost> | undefined;
let sessionId = '';
let job!: TerminalJobView;
const ref = () => ({sessionId, jobId: job.jobId, expectedRevision: job.revision,
  expectedControllerRevision: job.controllerRevision, expectedLeaseRevision: job.leaseRevision, commandId: 'xicmd_' + randomUUID()});
async function check(name: string, action: () => Promise<void>) {
  const started = performance.now();
  await action();
  checks.push({name, pass: true, durationMs: performance.now() - started});
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log('PASS ' + name);
}
async function readUntil(text: string) {
  const until = Date.now() + 15000;
  do {
    const value = await host!.terminal.readXiaozhiTerminal({sessionId, jobId: job.jobId, sinceSequence: 0});
    assert(value.ok, JSON.stringify(value));
    job = value.data.job;
    if (job.terminal.output.includes(text)) return;
    await new Promise(resolve => setTimeout(resolve, 100));
  } while (Date.now() < until);
  throw Error('missing_output:' + text + ':' + job.terminal.output.slice(-6000));
}
try {
  await new Promise<void>(resolve => fixture.listen(0, '127.0.0.1', resolve));
  const address = fixture.address();
  assert(address && typeof address !== 'string');
  net.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    assert.equal(url.origin, 'https://api.deepseek.com');
    return fetch(`http://127.0.0.1:${address.port}${url.pathname}`, init);
  };
  await store.init();
  const makeHost = () => createXiaozhiProductionHost({store, dataRoot, emit() {}, emitTerminal: event => updates.push(event), enabled: true});
  host = makeHost();
  sessionId = (await store.createAiConversationSession({title: 'Phase6真实终端Task', folderId: null})).session.id;
  await store.xiaozhiState.setWorkspace(sessionId, workspace, '合成终端目录');
  const permissions = await host.permissions.view(sessionId);
  await host.permissions.setMode({sessionId, revision: permissions.profile.revision, mode: 'fullAccess'});
  await check('Original Pi Task starts a persistent PTY and transfers idle teacher control after its answer', async () => {
    scenario = [{name: 'exec_command', input: {cmd: "$global:phase6Value=41; Write-Output 'PHASE6_READY'", tty: true, background: true, yield_time_ms: 1000}}];
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '在本任务打开持久终端，保留变量以便教师直接输入。'});
    assert(started.ok, JSON.stringify(started));
    await host!.waitForRun(sessionId, started.runId);
    const listed = await host!.terminal.listXiaozhiTerminals(sessionId);
    assert(listed.ok, JSON.stringify(listed));
    assert.equal(listed.data.jobs.length, 1, JSON.stringify(bodies));
    job = listed.data.jobs[0];
    assert.equal(job.controller, 'teacher');
    assert.equal(job.controls.write, true);
    assert.equal(job.terminal.state, 'running');
    await readUntil('PHASE6_READY');
  });
  await check('Idle teacher writes exact ACK input and resizes without any new model request', async () => {
    const calls = report.modelCalls;
    const command = {...ref(), chars: "$global:phase6Value++; Write-Output ('TEACHER_VALUE='+$global:phase6Value)\r"};
    const written = await host!.terminal.writeXiaozhiTerminal(command);
    assert(written.ok, JSON.stringify(written));
    job = written.data.job;
    assert.equal(written.data.ack.state, 'acknowledged');
    await readUntil('TEACHER_VALUE=42');
    const duplicate = await host!.terminal.writeXiaozhiTerminal({...command, ...ref(), commandId: command.commandId});
    assert(duplicate.ok, JSON.stringify(duplicate));
    assert.equal(duplicate.data.ack.sequence, written.data.ack.sequence);
    const resized = await host!.terminal.resizeXiaozhiTerminal({...ref(), cols: 96, rows: 32});
    assert(resized.ok, JSON.stringify(resized));
    job = resized.data;
    assert.equal(report.modelCalls, calls);
  });
  await check('A new Run explicitly continues the original Task and writes to the same shell', async () => {
    const taskId = job.taskId;
    scenario = [{name: 'list_terminals', input: {}}, {name: 'write_stdin', input: {
      job_id: job.jobId, chars: "Write-Output ('AGENT_VALUE='+$global:phase6Value)\r"}}];
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '向刚才终端输入读取现有变量的命令。'});
    assert(started.ok, JSON.stringify(started));
    await host!.waitForRun(sessionId, started.runId);
    await readUntil('AGENT_VALUE=42');
    assert.equal(job.taskId, taskId);
    assert.equal(job.controller, 'teacher');
    const current = await store.xiaozhiState.sql.all('SELECT contract_json FROM xiaozhi_tool_receipts WHERE run_id=? AND tool=?', [started.runId, 'write_stdin']);
    assert.equal(JSON.parse(String(current[0].contract_json)).taskId, taskId);
  });
  await check('Teacher takeover fences stale references and prevents the same Agent Run from reclaiming input', async () => {
    const stale = ref();
    let release!: () => void;
    modelGate = new Promise<void>(resolve => {release = resolve;});
    scenario = [{name: 'write_stdin', input: {job_id: job.jobId, chars: "Write-Output 'CONTROL_HELD'\r"}}];
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '向刚才终端输入控制测试标记。'});
    assert(started.ok, JSON.stringify(started));
    try {
      await readUntil('CONTROL_HELD');
      assert.equal(job.controller, 'agent');
      const denied = await host!.terminal.writeXiaozhiTerminal({...stale, chars: "Write-Output 'STALE_INPUT'\r"});
      assert(!denied.ok && denied.error === 'changed', JSON.stringify(denied));
      const teacher = await host!.terminal.takeControlXiaozhiTerminal(ref());
      assert(teacher.ok, JSON.stringify(teacher));
      job = teacher.data;
      scenario = [{name: 'write_stdin', input: {job_id: job.jobId, chars: "Write-Output 'FORBIDDEN_RECLAIM'\r"}}];
      modelGate = undefined;
      release();
      await host!.waitForRun(sessionId, started.runId);
      const read = await host!.terminal.readXiaozhiTerminal({sessionId, jobId: job.jobId, sinceSequence: 0});
      assert(read.ok, JSON.stringify(read));
      job = read.data.job;
      assert.equal(job.controller, 'teacher');
      assert(!job.terminal.output.includes('FORBIDDEN_RECLAIM'));
      const value = await host!.terminal.writeXiaozhiTerminal({...ref(), chars: "Write-Output 'TEACHER_CONTROLLED'\r"});
      assert(value.ok && value.data.ack.state === 'acknowledged', JSON.stringify(value));
      job = value.data.job;
      await readUntil('TEACHER_CONTROLLED');
    } finally {modelGate = undefined; release();}
  });
  await check('Foreign session and a different Task cannot read or send to the original Job', async () => {
    const foreign = (await store.createAiConversationSession({title: '另一个合成会话', folderId: null})).session.id;
    const denied = await host!.terminal.readXiaozhiTerminal({sessionId: foreign, jobId: job.jobId, sinceSequence: 0});
    assert(!denied.ok && denied.error === 'permission_denied', JSON.stringify(denied));
    const before = job.inputSequence;
    scenario = [{name: 'write_stdin', input: {job_id: job.jobId, chars: "Write-Output 'FOREIGN_TASK'\r"}}];
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '这是一个独立新任务，测试不能操作其他任务作业。'});
    assert(started.ok, JSON.stringify(started));
    await host!.waitForRun(sessionId, started.runId);
    const read = await host!.terminal.readXiaozhiTerminal({sessionId, jobId: job.jobId, sinceSequence: 0});
    assert(read.ok, JSON.stringify(read));
    job = read.data.job;
    assert.equal(job.inputSequence, before);
    assert(!job.terminal.output.includes('FOREIGN_TASK'));
  });
  await check('Explicit close joins actual cleanup and cold main preserves read-only terminal history', async () => {
    const command = ref();
    const closed = await host!.terminal.closeXiaozhiTerminal(command);
    assert(closed.ok, JSON.stringify(closed));
    job = closed.data;
    assert.equal(job.cleanup, 'complete', JSON.stringify(job));
    assert.equal(job.controls.write, false);
    assert.equal(host!.permissions.engine.activeCount(), 0);
    const repeated = await host!.terminal.closeXiaozhiTerminal(command);
    assert(repeated.ok && repeated.data.cleanup === 'complete', JSON.stringify(repeated));
    await host!.close();
    host = undefined;
    await store.close();
    store = new OmniEduStore(dataRoot);
    await store.init();
    host = makeHost();
    const cold = await host.terminal.readXiaozhiTerminal({sessionId, jobId: job.jobId, sinceSequence: 0});
    assert(cold.ok, JSON.stringify(cold));
    assert.equal(cold.data.job.cleanup, 'complete');
    assert.equal(cold.data.job.controls.write, false);
  });
  async function launch(command: string, tty: boolean) {
    scenario = [{name: 'exec_command', input: {cmd: command, tty, background: true, yield_time_ms: 100}}];
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '启动一个新的合成后台作业并记录实际状态。'});
    assert(started.ok, JSON.stringify(started));
    await host!.waitForRun(sessionId, started.runId);
    const list = await host!.terminal.listXiaozhiTerminals(sessionId);
    assert(list.ok, JSON.stringify(list));
    const selected = list.data.jobs.at(-1);
    assert(selected);
    job = selected;
  }
  async function terminal() {
    const until = Date.now() + 15000;
    do {
      const read = await host!.terminal.readXiaozhiTerminal({sessionId, jobId: job.jobId, sinceSequence: 0});
      assert(read.ok, JSON.stringify(read));
      job = read.data.job;
      if (job.terminal.state !== 'running') return;
      await new Promise(resolve => setTimeout(resolve, 100));
    } while (Date.now() < until);
    throw Error('terminal_timeout:' + JSON.stringify(job));
  }
  await check('Noninteractive background command preserves a real nonzero exit and joins cleanup', async () => {
    await launch("Write-Output 'EXIT7'; exit 7", false);
    await terminal();
    assert.equal(job.terminal.exitCode, 7, JSON.stringify(job));
    assert.equal(job.terminal.state, 'failed');
    assert.equal(job.cleanup, 'complete');
    assert.equal(host!.permissions.engine.activeCount(), 0);
  });
  let processScope: Extract<import('../../src/shared/xiaozhi-permissions').PermissionScope, {kind: 'process'}>;
  await check('Actual idle Grant revocation stops the live Job with native cleanup and preserves uncertain effects', async () => {
    await launch("Write-Output 'REVOKE_READY'", true);
    await readUntil('REVOKE_READY');
    const grant = (await store.xiaozhiState.permissions.grants(sessionId)).find(grant => grant.scope.kind === 'process' && !grant.revokedAt);
    assert(grant && grant.scope.kind === 'process');
    processScope = grant.scope;
    await host!.permissions.revoke({sessionId, grantId: grant.grantId, revision: grant.revision});
    await terminal();
    assert.equal(job.controls.write, false);
    assert.equal(host!.permissions.engine.activeCount(), 0);
    const audit = (await store.xiaozhiState.sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind='terminal_job_terminal' AND reference=?", [job.jobId]))[0];
    assert(audit);
    const physical = JSON.parse(String(audit.metadata_json));
    assert.deepEqual(physical.result.cleanup, {jobActiveProcesses: 0, profileRemoved: true, remainingOwnedAces: 0, ptyClosed: true});
    const effect = (await store.xiaozhiState.sql.all("SELECT state FROM xiaozhi_effects_v1 WHERE effect_id=(SELECT effect_id FROM xiaozhi_jobs_v1 WHERE job_id=?)", [job.jobId]))[0];
    assert.equal(effect.state, 'unknown');
  });
  await check('Actual process Grant expiry retains its own lifetime and closes an idle Job', async () => {
    const expiresAt = new Date(Date.now() + 10000).toISOString();
    await host!.permissions.issue({sessionId, scopes: [processScope!], taskId: null, expiresAt});
    await launch("Write-Output 'EXPIRY_READY'", true);
    await readUntil('EXPIRY_READY');
    await terminal();
    assert(Date.now() >= Date.parse(expiresAt));
    assert.equal(job.controls.write, false);
    assert.equal(host!.permissions.engine.activeCount(), 0);
    const audit = (await store.xiaozhiState.sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind='terminal_job_terminal' AND reference=?", [job.jobId]))[0];
    assert(audit);
    assert.equal(JSON.parse(String(audit.metadata_json)).result.cleanup.ptyClosed, true);
  });
  report.success = true;
} catch (error) {report.error = error instanceof Error ? error.stack : String(error); process.exitCode = 1; console.error(error);}
finally {
  fs.writeFileSync(path.join(output, 'native-tool-bodies.json'), JSON.stringify(bodies, null, 2));
  fs.writeFileSync(path.join(output, 'terminal-updates.json'), JSON.stringify(updates, null, 2));
  modelGate = undefined;
  await host?.close();
  await store.close();
  net.fetch = originalFetch;
  await new Promise<void>(resolve => fixture.close(() => resolve()));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: checks.length, root, output, error: report.error}));
}
