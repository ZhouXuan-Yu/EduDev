import fs from 'node:fs';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {randomUUID, createHash} from 'node:crypto';
import {net} from 'electron';
import {OmniEduStore} from '../../src/main/db';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';

const output = process.argv[2];
const dataRoot = path.join(output, 'data');
const workspace = path.join(output, 'workspace');
fs.mkdirSync(workspace);
process.env.DEEPSEEK_API_KEY = 'synthetic-loopback';
process.env.DEEPSEEK_MODEL = 'deepseek-flash';
const sha = (bytes: Buffer) => createHash('sha256').update(bytes).digest('hex');
const command = "$ErrorActionPreference='Stop'; [IO.File]::AppendAllText((Join-Path (Get-Location).ProviderPath 'owned-execution-count.txt'), 'ONCE'); Write-Output 'OWNED_TERMINAL_ONCE'";
const input = {cmd: command, timeout: 10};
const target = path.join(workspace, 'owned-execution-count.txt');
let store = new OmniEduStore(dataRoot);
let host: ReturnType<typeof createXiaozhiProductionHost> | undefined;
let sessionId = '', phase = 'pending', index = 0;
let holdFinish = false, finishReached = false, releaseFinish = () => {};
const requests: unknown[] = [], events: unknown[] = [], checks: unknown[] = [];
const report: any = {success: false, output, checks, paidCalls: 0, input};
const makeHost = () => {
  const permissionStore = store.xiaozhiState.permissions, originalAudit = permissionStore.audit;
  // Timing-only delegate: the real native completion audit is committed first.
  // No fact, output or acknowledgement is synthesized by this fixture.
  permissionStore.audit = async (...args) => {
    await originalAudit(...args);
    if (args[1] === 'sandbox_execution_finished' && holdFinish) {
      report.pausedNativeFinish = args[3]; finishReached = true;
      await new Promise<void>(resolve => {releaseFinish = resolve;});
    }
  };
  return createXiaozhiProductionHost({store, dataRoot, enabled: true, emit(event) {events.push(event);}});
};
async function until(condition: () => boolean) {
  const end = Date.now() + 30000;
  while (Date.now() < end) {if (condition()) return; await new Promise(resolve => setTimeout(resolve, 20));}
  throw Error('owned_fixture_timeout');
}
const model = http.createServer(async (request, response) => {
  try {
    if (request.url === '/v1/models') {
      response.end(JSON.stringify({object: 'list', data: [{id: 'deepseek-flash', context_window: 1048576, max_output_tokens: 32768, input_modalities: ['text']}]}));
      return;
    }
    assert.equal(request.url, '/v1/chat/completions');
    let raw = ''; for await (const chunk of request) raw += chunk;
    const body = JSON.parse(raw); requests.push({phase, body});
    const n = index++;
    const tool = n === 0 ? {name: 'exec_command', arguments: input} : null;
    const base = {id: 'owned-terminal-grant', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash'};
    const chunk = (delta: unknown, finish_reason: string | null = null) => 'data: ' + JSON.stringify({...base, choices: [{index: 0, delta, finish_reason}]}) + '\n\n';
    response.writeHead(200, {'content-type': 'text/event-stream'});
    response.end(chunk(tool ? {role: 'assistant', tool_calls: [{index: 0, id: 'grant_' + phase, type: 'function', function: {name: tool.name, arguments: JSON.stringify(tool.arguments)}}]} : {role: 'assistant', content: '请核对本机合成终端的真实回执。'}) + chunk({}, tool ? 'tool_calls' : 'stop') + 'data: [DONE]\n\n');
  } catch (error) {report.fixtureError = String((error as Error).stack); response.writeHead(500).end();}
});
const originalFetch = net.fetch;
const receipts = (runId: string) => store.xiaozhiState.sql.all("SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? AND tool='exec_command'", [runId]);
async function effect(runId: string) {
  const row = (await store.xiaozhiState.sql.all("SELECT document_json FROM xiaozhi_effects_v1 WHERE run_id=? AND operation='tool' AND json_extract(document_json,'$.tool')='exec_command'", [runId]))[0];
  return row ? JSON.parse(String(row.document_json)) : null;
}
const prepared = () => store.xiaozhiState.sql.all("SELECT * FROM xiaozhi_permission_audit_v1 WHERE kind='sandbox_execution_prepared' ORDER BY created_at");
async function run(continueTask?: {taskId: string; requirementsVersion: number}) {
  index = 0;
  const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '请运行这个安全的合成终端命令，保存本机执行计数并核对真实回执。', ...(continueTask ? {continueTask} : {})});
  assert(started.ok, JSON.stringify(started));
  await host!.waitForRun(sessionId, started.runId);
  assert(!report.fixtureError, report.fixtureError);
  return started.runId;
}
try {
  await new Promise<void>(resolve => model.listen(0, '127.0.0.1', resolve));
  const address = model.address() as any;
  net.fetch = async (raw, init) => {
    const url = new URL(typeof raw === 'string' ? raw : raw instanceof URL ? raw.href : raw.url);
    assert.equal(url.origin, 'https://api.deepseek.com');
    return fetch('http://127.0.0.1:' + address.port + url.pathname, init);
  };
  await store.init(); host = makeHost(); await host.skillCatalog();
  sessionId = (await store.createAiConversationSession({title: '合成终端授权续跑', folderId: null})).session.id;
  await store.xiaozhiState.setWorkspace(sessionId, workspace, 'Owned terminal source');
  await host.permissions.view(sessionId);
  const firstRun = await run();
  const firstRows = await receipts(firstRun), firstEffect = await effect(firstRun);
  report.first = {runId: firstRun, receipts: firstRows, effect: firstEffect, prepared: await prepared()};
  assert.equal(firstRows.length, 1); assert.equal(firstRows[0].phase, 'settled'); assert.equal(firstRows[0].success, 0);
  assert.equal((await prepared()).length, 0); assert(!fs.existsSync(target));
  assert.equal(firstEffect?.state, 'failed'); assert.equal(firstEffect.execution, null); assert.equal(firstEffect.outcome.error, 'not_delivered');
  const approval = (await host.permissions.view(sessionId)).approvals.find(row => row.state === 'pending' && row.request.action === 'exec_command');
  assert(approval); report.approvalBefore = approval;
  const task = (await host.snapshot(sessionId)).task!; assert(task);
  assert.equal(approval.request.owner.taskId, task.id);
  checks.push({name: 'Original unauthorized exact command settles without any controlled process or published file', pass: true});
  await host.permissions.decide({sessionId, approvalId: approval.id, revision: approval.revision, decision: 'approve', scope: 'task'});
  const decision = await host.permissions.view(sessionId);
  const grants = decision.grants.filter(row => row.taskId === task.id && row.provenance.reference === approval.id && !row.revokedAt);
  assert.equal(grants.length, 3); report.taskGrants = grants; report.approvalAfter = decision.approvals.find(row => row.id === approval.id);
  const binding = JSON.parse(String((await store.xiaozhiState.sql.all('SELECT binding_json FROM xiaozhi_native_run_bindings WHERE run_id=?', [firstRun]))[0].binding_json));
  const native = path.join(dataRoot, 'xiaozhi-pi', binding.file), prefix = fs.readFileSync(native);
  report.originalNative = {path: native, bytes: prefix.length, sha256: sha(prefix)};
  await host.close(); await store.close(); store = new OmniEduStore(dataRoot); await store.init(); host = makeHost(); await host.skillCatalog();
  report.coldBefore = await host.snapshot(sessionId); assert.equal(report.coldBefore.task?.id, task.id);
  phase = 'authorized'; const nextRun = await run({taskId: task.id, requirementsVersion: task.requirementsVersion});
  const nextRows = await receipts(nextRun), nextEffect = await effect(nextRun), launches = await prepared();
  report.next = {runId: nextRun, receipts: nextRows, effect: nextEffect, prepared: launches};
  assert.equal(launches.length, 1, 'Current Task Grant must authorize exactly one real controlled execution');
  assert.equal(nextRows.length, 1); assert.equal(nextRows[0].success, 1, JSON.stringify(nextRows));
  assert.equal(fs.readFileSync(target, 'utf8'), 'ONCE');
  assert.equal(nextRows[0].generation, Number(firstRows[0].generation) + 1);
  const contract = JSON.parse(String(nextRows[0].contract_json));
  assert.equal(contract.inputDigest, JSON.parse(String(firstRows[0].contract_json)).inputDigest);
  assert(grants.every(grant => contract.grantRefs.some((ref: any) => ref.grantId === grant.grantId && ref.revision === grant.revision)));
  assert.deepEqual(await effect(firstRun), firstEffect);
  assert(fs.readFileSync(native).subarray(0, prefix.length).equals(prefix));
  report.file = {path: target, bytes: fs.statSync(target).size, sha256: sha(fs.readFileSync(target))};
  report.finished = await store.xiaozhiState.sql.all("SELECT * FROM xiaozhi_permission_audit_v1 WHERE kind IN ('sandbox_execution_finished','sandbox_projection_committed') ORDER BY created_at");
  assert.equal(report.finished.filter((row: any) => row.kind === 'sandbox_execution_finished').length, 1);
  checks.push({name: 'Cold same Task new generation consumes valid Task Grants and executes/publishes once with exact current authority', pass: true});
  const sessionA = sessionId;
  const otherSession = (await store.createAiConversationSession({title: '合成另Task终端', folderId: null})).session.id;
  await store.xiaozhiState.setWorkspace(otherSession, workspace, 'Same owned physical source');
  await host.permissions.view(otherSession); sessionId = otherSession; phase = 'other_task';
  const otherRun = await run(), otherTask = (await host.snapshot(sessionId)).task!;
  const otherRows = await receipts(otherRun);
  assert.notEqual(otherTask.id, task.id); assert.equal(otherRows.length, 1); assert.equal(otherRows[0].success, 0);
  assert.equal((await prepared()).length, 1); assert.equal(fs.readFileSync(target, 'utf8'), 'ONCE');
  const otherApproval = (await host.permissions.view(sessionId)).approvals.find(row => row.state === 'pending' && row.request.action === 'exec_command');
  assert(otherApproval); assert.equal(otherApproval.request.owner.taskId, otherTask.id);
  report.other = {sessionId, task: otherTask, runId: otherRun, receipts: otherRows, approval: otherApproval};
  checks.push({name: 'Another Task on the identical physical root cannot inherit the first Task Grants', pass: true});
  sessionId = sessionA;
  const filesystemGrant = grants.find(row => row.scope.kind === 'filesystem')!;
  await host.permissions.revoke({sessionId, grantId: filesystemGrant.grantId, revision: filesystemGrant.revision});
  phase = 'revoked'; const revokedRun = await run({taskId: task.id, requirementsVersion: task.requirementsVersion});
  const revokedRows = await receipts(revokedRun); assert.equal(revokedRows.length, 1); assert.equal(revokedRows[0].success, 0);
  assert.equal((await prepared()).length, 1); assert.equal(fs.readFileSync(target, 'utf8'), 'ONCE');
  report.revoked = {runId: revokedRun, receipts: revokedRows, view: await host.permissions.view(sessionId)};
  assert(report.revoked.view.grants.some((row: any) => row.grantId === filesystemGrant.grantId && row.revokedAt));
  checks.push({name: 'Revoking the exact Task filesystem Grant prevents another controlled execution and preserves the committed file', pass: true});
  // The second Task is separately approved through the original application API.
  // Its real native command completes, then teacher Stop prevents publication.
  sessionId = otherSession;
  await host.permissions.decide({sessionId, approvalId: otherApproval.id, revision: otherApproval.revision, decision: 'approve', scope: 'task'});
  phase = 'sent'; index = 0; holdFinish = true; finishReached = false;
  const dispatched = await host.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '继续核对已获授权的本任务终端命令。', continueTask: {taskId: otherTask.id, requirementsVersion: otherTask.requirementsVersion}});
  assert(dispatched.ok, JSON.stringify(dispatched)); await until(() => finishReached);
  const stopping = host.stop(sessionId); holdFinish = false; releaseFinish(); await stopping; await host.waitForRun(sessionId, dispatched.runId);
  assert.equal((await prepared()).length, 2); assert.equal(fs.readFileSync(target, 'utf8'), 'ONCE');
  const sentEffect = await effect(dispatched.runId); assert.equal(sentEffect.state, 'unknown'); assert(sentEffect.execution?.id);
  report.sent = {runId: dispatched.runId, receipts: await receipts(dispatched.runId), effect: sentEffect};
  await host.close(); await store.close(); store = new OmniEduStore(dataRoot); await store.init(); host = makeHost(); await host.skillCatalog();
  phase = 'sent_retry'; const guardedRun = await run({taskId: otherTask.id, requirementsVersion: otherTask.requirementsVersion});
  const guardedRows = await receipts(guardedRun); assert.equal(guardedRows.length, 1); assert.equal(guardedRows[0].success, 0); assert.equal(guardedRows[0].admitted, 0);
  assert.equal((await prepared()).length, 2); assert.equal(fs.readFileSync(target, 'utf8'), 'ONCE');
  assert.equal((await effect(dispatched.runId)).state, 'unknown');
  report.guarded = {runId: guardedRun, receipts: guardedRows, prepared: await prepared()};
  checks.push({name: 'Actually executed but unpublished uncertain work survives cold read and blocks same-command replay before a new sandbox', pass: true});
  report.success = true;
} catch (error) {report.error = String((error as Error).stack); process.exitCode = 1;}
finally {
  releaseFinish();
  await host?.close(); await store.close(); net.fetch = originalFetch;
  model.closeAllConnections(); await new Promise<void>(resolve => model.close(() => resolve()));
  Object.assign(report, {requests, events, sessionId});
  fs.writeFileSync(path.join(output, 'REPORT.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, checks: checks.length, output, error: report.error}));
}
