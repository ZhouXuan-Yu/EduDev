import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import childProcess from 'node:child_process';
import {syncBuiltinESMExports} from 'node:module';
import {createHash, randomUUID} from 'node:crypto';
import {net} from 'electron';
import {OmniEduStore} from '../../src/main/db';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';
import {inspectTaskRecovery} from '../../src/main/xiaozhi-agent/tasks/recovery-inspection';
import {createTaskState} from '../../src/main/xiaozhi-agent/tasks/task-state';

const [activeRoot, output, mode, identityFile] = process.argv.slice(2);
const dataRoot = path.join(activeRoot, 'data'), workspace = path.join(activeRoot, 'workspace');
fs.mkdirSync(workspace, {recursive: true}); fs.mkdirSync(output, {recursive: true});
process.env.DEEPSEEK_API_KEY = 'synthetic-phase6-recovery-loopback';
process.env.DEEPSEEK_MODEL = 'deepseek-flash';
const digest = (bytes: string | Buffer) => createHash('sha256').update(bytes).digest('hex');
const artifact = path.join(workspace, 'recovery-result.txt');
const content = 'Owned actual exec recovery artifact ' + path.basename(path.dirname(activeRoot));
const report: Record<string, any> = {success: false, activeRoot, dataRoot, workspace, output, mode, paidCalls: 0,
  modelCalls: 0, requests: [], processes: [], attempts: [], error: undefined};
const save = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
const originalProcessFunctions: Record<string, any> = {};
for (const name of ['spawn', 'spawnSync', 'exec', 'execSync', 'execFile', 'execFileSync', 'fork']) {
  const functions = childProcess as unknown as Record<string, any>, original = functions[name]; originalProcessFunctions[name] = original;
  functions[name] = (...args: unknown[]) => {
    const entry: Record<string, unknown> = {kind: name, file: String(args[0]), mode, at: new Date().toISOString()};
    report.processes.push(entry);
    const child = Reflect.apply(original, childProcess, args);
    if (child && typeof child.once === 'function') child.once('close', (code: number, signal: string) => {entry.code = code; entry.signal = signal;});
    return child;
  };
}
syncBuiltinESMExports();
let store: OmniEduStore | undefined, host: ReturnType<typeof createXiaozhiProductionHost> | undefined;
let sessionId = '', phase = mode === 'cut' ? 'warmup' : 'answer', toolCallId = '';
let failCut: (error: unknown) => void = () => {};
const cutLifetime = new Promise<never>((_, reject) => {failCut = reject;}); void cutLifetime.catch(() => {});
const originalFetch = net.fetch;
async function state() {
  assert(store && sessionId);
  const sql = store.xiaozhiState.sql;
  const task = await createTaskState(sql, {sanitize: async text => text}).latest(sessionId);
  assert(task);
  return {task, inspection: await inspectTaskRecovery({sql, nativeRoot: path.join(dataRoot, 'xiaozhi-pi'), sessionId, taskId: task.id}),
    artifact: fs.existsSync(artifact) ? {file: artifact, bytes: fs.statSync(artifact).size, sha256: digest(fs.readFileSync(artifact))} : null,
    effects: await store.xiaozhiState.effects.forTask(sessionId, task.id),
    sessionBinding: (await sql.all('SELECT * FROM xiaozhi_pi_session_bindings WHERE conversation_id=?', [sessionId]))[0],
    modelLedger: (await sql.all('SELECT * FROM xiaozhi_pi_model_state WHERE conversation_id=?', [sessionId]))[0],
    modelTransitions: await sql.all('SELECT * FROM xiaozhi_pi_model_transitions WHERE conversation_id=? ORDER BY rowid', [sessionId]),
    nativeBindings: await sql.all('SELECT * FROM xiaozhi_native_run_bindings ORDER BY rowid'),
    rebuildArchives: await sql.all("SELECT key,value_json,updated_at FROM app_settings WHERE key LIKE 'xiaozhi.native-rebuild.v1:%' ORDER BY key"),
    runs: await sql.all('SELECT run_id,generation,status,sequence,revision FROM xiaozhi_event_runs WHERE session_id=? ORDER BY rowid', [sessionId]),
    receipts: await sql.all('SELECT run_id,call_id,tool,phase,admitted,result_digest,success FROM xiaozhi_tool_receipts ORDER BY rowid')};
}
function send(response: http.ServerResponse, tool?: {name: string; args: Record<string, unknown>}) {
  response.writeHead(200, {'content-type': 'text/event-stream'});
  const base = {id: 'synthetic-recovery', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash'};
  const delta = tool ? {role: 'assistant', tool_calls: [{index: 0, id: toolCallId, type: 'function', function: {name: tool.name, arguments: JSON.stringify(tool.args)}}]}
    : {role: 'assistant', content: '已有保存成果已核对。本轮仅答复，保留原任务供教师确认。'};
  response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta, finish_reason: null}]}) + '\n\n');
  response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta: {}, finish_reason: tool ? 'tool_calls' : 'stop'}],
    usage: {prompt_tokens: 100, completion_tokens: 20, total_tokens: 120}}) + '\n\n');
  response.end('data: [DONE]\n\n');
}
const server = http.createServer(async (request, response) => {
  try {
    if (['/models', '/v1/models'].includes(request.url || '')) {
      report.requests.push({path: request.url, kind: 'catalogue'});
      response.writeHead(200, {'content-type': 'application/json'});
      response.end(JSON.stringify({object: 'list', data: [{id: 'deepseek-flash', context_window: 1048576, max_output_tokens: 32768,
        input_modalities: ['text'], effort: {supported_levels: ['low', 'high', 'max'], default_level: 'low'}}]})); return;
    }
    assert(['/chat/completions', '/v1/chat/completions'].includes(request.url || ''));
    let text = ''; for await (const bytes of request) {text += bytes.toString(); if (text.length > 8 * 1048576) throw Error('fixture_request_bounds');}
    const body = JSON.parse(text); report.requests.push({path: request.url, kind: 'model', phase, body}); report.modelCalls++;
    if (mode === 'cut' && phase === 'tool') {
      phase = 'cut_wait'; toolCallId = 'call_' + randomUUID().replaceAll('-', '');
      const cmd = "[IO.File]::WriteAllText([IO.Path]::Combine([IO.Directory]::GetCurrentDirectory(),'recovery-result.txt'),'"
        + content.replaceAll("'", "''") + "',[Text.UTF8Encoding]::new($false)); [Console]::WriteLine('RECOVERY_ARTIFACT_READY')";
      send(response, {name: 'exec_command', args: {cmd, timeout: 30}}); return;
    }
    if (mode === 'cut' && phase === 'cut_wait') {
      assert(body.messages.some((message: any) => message.role === 'tool' && message.tool_call_id === toolCallId), 'missing actual exec tool response');
      const value = await state();
      assert.equal(value.task.state, 'active'); assert.equal(value.artifact?.sha256, digest(content));
      const effect = value.effects.find(effect => effect.callId === toolCallId && effect.tool === 'exec_command');
      assert.equal(effect?.state, 'committed', JSON.stringify(value.effects));
      assert.equal(host!.permissions.engine.activeCount(), 0);
      const identity = {activeRoot, dataRoot, workspace, database: path.join(dataRoot, 'app.db'), sessionId, taskId: value.task.id,
        runId: value.task.binding!.runId, generation: value.task.binding!.generation, callId: toolCallId, effectId: effect!.id,
        artifact, artifactHash: value.artifact!.sha256, nativeRoot: path.join(dataRoot, 'xiaozhi-pi'), sessionFile: value.sessionBinding.session_file};
      fs.writeFileSync(identityFile, JSON.stringify(identity, null, 2)); report.boundary = value; save();
      fs.writeFileSync(path.join(output, 'cut-ready.json'), JSON.stringify({identity, state: value, modelCalls: report.modelCalls, processes: report.processes}, null, 2));
      return;
    }
    send(response);
  } catch (error) {report.serverError = String(error instanceof Error ? error.stack : error); save(); failCut(error); response.writeHead(500); response.end();}
});
async function resume() {
  const before = await state();
  const start = await host!.resumeTask({schema: 'xiaozhi.task.v1', sessionId, taskId: before.task.id, revision: before.task.revision,
    requirementsVersion: before.task.requirementsVersion, commandId: 'xicmd_' + randomUUID()});
  report.attempts.push({start, taskRevision: before.task.revision});
  assert(start.ok, JSON.stringify(start));
  await host!.waitForRun(sessionId, start.runId);
  const after = await state(); report.attempts.at(-1).after = after; return after;
}
function sameRebuildFacts(left: Awaited<ReturnType<typeof state>>, right: Awaited<ReturnType<typeof state>>) {
  assert.deepEqual(right.sessionBinding, left.sessionBinding); assert.deepEqual(right.modelLedger, left.modelLedger);
  assert.deepEqual(right.modelTransitions, left.modelTransitions); assert.deepEqual(right.nativeBindings, left.nativeBindings);
  assert.deepEqual(right.rebuildArchives, left.rebuildArchives); assert.equal(right.artifact?.sha256, left.artifact?.sha256);
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
  host = createXiaozhiProductionHost({store, dataRoot, emit() {}, enabled: true});
  if (mode === 'cut') {
    sessionId = (await store.createAiConversationSession({title: 'Phase6真实恢复样本', folderId: null})).session.id;
    await store.xiaozhiState.setWorkspace(sessionId, workspace, 'Owned recovery fixture');
    const permission = await host.permissions.view(sessionId);
    await host.permissions.setMode({sessionId, revision: permission.profile.revision, mode: 'fullAccess'});
    const warmup = await host.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '这是一个纯答复请求，请只简短回答已准备好。'});
    assert(warmup.ok, JSON.stringify(warmup)); await host.waitForRun(sessionId, warmup.runId);
    const view = await host.modelSettingsView({sessionId}); assert(view.sessionModel);
    report.modelSelection = await host.selectSessionModel({schemaVersion: 'xiaozhi.settings.v1', sessionId, version: view.sessionModel.version, model: view.sessionModel.model});
    const ledger = await store.xiaozhiState.modelSwitch.current(sessionId); assert(ledger, 'same-model selection must initialize real model ledger');
    phase = 'tool';
    const started = await host.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '这是独立新任务。请用前台exec_command实际写入recovery-result.txt并输出标记，然后等待后续核对。'});
    assert(started.ok, JSON.stringify(started)); report.started = started; save(); await cutLifetime;
  } else {
    const identity = JSON.parse(fs.readFileSync(identityFile, 'utf8')); sessionId = identity.sessionId;
    const snapshot = await host.taskSnapshot({sessionId}); assert(snapshot.ok, JSON.stringify(snapshot));
    const before = await state(); report.before = before; report.taskSnapshot = snapshot;
    assert.equal(before.task.id, identity.taskId);
    if (mode !== 'cold_after') assert.equal(before.task.state, 'interrupted');
    assert.equal(before.artifact?.sha256, identity.artifactHash); assert.equal(report.modelCalls, 0);
    assert.equal(report.processes.length, 0, JSON.stringify(report.processes));
    if (mode === 'cold' || mode === 'cold_after') report.success = true;
    else {
      if (mode === 'rollback') {
        await store.xiaozhiState.sql.run("CREATE TRIGGER owned_native_bind_failure BEFORE INSERT ON xiaozhi_native_run_bindings BEGIN SELECT RAISE(ABORT,'owned_native_bind_failure'); END");
        const failed = await resume(); report.failed = failed; sameRebuildFacts(before, failed);
        assert.equal(report.modelCalls, 0); assert.equal(report.processes.length, 0);
        const failureView = await host.snapshot(sessionId); report.failureView = failureView;
        assert.equal(failureView.running, false); assert.equal(failureView.eventPersistence, 'unavailable');
        const failedTurn = failureView.projection.turns.find(turn => turn.id === report.attempts[0].start.runId);
        assert.equal(failedTurn?.status, 'failed'); assert.equal(failedTurn?.errorCode, 'event_persistence');
        assert.equal(typeof host.refreshRecords, 'function');
        report.refreshRecords = await host.refreshRecords(sessionId); assert.equal(report.refreshRecords.ok, true);
        const repaired = await state(); report.afterRefresh = repaired; sameRebuildFacts(before, repaired);
        assert.equal(repaired.task.state, 'interrupted');
        assert.equal(repaired.runs.find(run => run.run_id === report.attempts[0].start.runId)?.status, 'failed');
        const repairedJournal = await store.xiaozhiState.eventJournal.snapshot(sessionId, report.attempts[0].start.runId);
        report.repairedJournal = repairedJournal;
        assert.equal(repairedJournal?.status, 'failed'); assert.equal(repairedJournal?.turn.errorCode, 'event_recovered');
        assert.equal(report.modelCalls, 0); assert.equal(report.processes.length, 0);
        await store.xiaozhiState.sql.run('DROP TRIGGER owned_native_bind_failure');
      }
      report.after = await resume(); const after = report.after as Awaited<ReturnType<typeof state>>;
      assert.equal(after.task.id, identity.taskId); assert.equal(after.artifact?.sha256, identity.artifactHash);
      assert.equal(report.modelCalls, 1); assert.equal(report.processes.length, 0, JSON.stringify(report.processes));
      assert.equal(report.attempts.length, mode === 'rollback' ? 2 : 1);
      assert.equal(after.inspection.native.state, 'available'); report.success = true;
    }
  }
} catch (error) {report.error = String(error instanceof Error ? error.stack : error); process.exitCode = 1; console.error(report.error);}
finally {
  save(); await host?.close(); await store?.close(); net.fetch = originalFetch;
  for (const [name, original] of Object.entries(originalProcessFunctions)) (childProcess as unknown as Record<string, unknown>)[name] = original;
  syncBuiltinESMExports(); server.closeAllConnections(); await new Promise<void>(resolve => server.close(() => resolve())); save();
  console.log(JSON.stringify({success: report.success, mode, output, modelCalls: report.modelCalls, error: report.error}));
}
