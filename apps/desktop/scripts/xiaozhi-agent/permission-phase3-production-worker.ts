import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {randomUUID, createHash} from 'node:crypto';
import {net} from 'electron';
import {OmniEduStore} from '../../src/main/db';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';
import {workspaceHash} from '../../src/main/xiaozhi-agent/workspace-authority';
import {canonicalMcp} from '../../src/main/xiaozhi-agent/mcp-schema';
import {startMcpFixture} from './fixtures/mcp-server.mjs';

const output = process.argv[2];
const moduleReadyAt = Date.now();
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase3-production-'));
const dataRoot = path.join(root, 'data');
const workspace = path.join(root, 'workspace');
fs.mkdirSync(workspace);
fs.writeFileSync(path.join(workspace, 'source.txt'), 'synthetic');
process.env.DEEPSEEK_API_KEY = 'synthetic-phase3-loopback';
process.env.DEEPSEEK_MODEL = 'deepseek-flash';
let scenario: {name: string; input: Record<string, unknown>}[] = [];
let step = 0;
let modelCalls = 0;
let catalogCalls = 0;
let startProfile: {name: string; startedAt: number; acceptedMs?: number; firstEventMs?: number; resourcesReadyMs?: number; firstSseMs?: number; finishedMs?: number} | undefined;
let holdFinal = false;
const heldResponses = new Set<http.ServerResponse>();
const restartSteps = new Map<string, number>();
const fixture = http.createServer(async (request, response) => {
  if (request.url === '/v1/models') {
    catalogCalls++;
    response.writeHead(200, {'content-type': 'application/json'});
    response.end(JSON.stringify({object: 'list', data: [{id: 'deepseek-flash', context_window: 1048576,
      max_output_tokens: 32768, input_modalities: ['text'], effort: {supported_levels: ['low', 'high', 'max'], default_level: 'low'}}]}));
    return;
  }
  if (request.url !== '/v1/chat/completions') {response.writeHead(404); response.end(); return;}
  let requestBody = '';
  for await (const bytes of request) requestBody += bytes.toString('utf8');
  modelCalls++;
  if (startProfile && startProfile.firstSseMs === undefined) startProfile.firstSseMs = performance.now() - startProfile.startedAt;
  response.writeHead(200, {'content-type': 'text/event-stream'});
  const base = {id: 'synthetic-phase3', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash'};
  const restart = [...restartSteps.keys()].find(marker => requestBody.includes(marker));
  const restartStep = restart ? restartSteps.get(restart)! : undefined;
  if (restart) restartSteps.set(restart, restartStep! + 1);
  const tool = restart ? restartStep === 0 ? {name: 'exec_command', input: {cmd: "Write-Output 'RESTART_MUST_NOT_EXECUTE'", timeout: 10}} : undefined
    : scenario[step++];
  if (!tool && holdFinal) {heldResponses.add(response); return;}
  const delta = tool ? {role: 'assistant', tool_calls: [{index: 0, id: 'call_' + randomUUID().replaceAll('-', ''), type: 'function',
    function: {name: tool.name, arguments: JSON.stringify(tool.input)}}]} : {role: 'assistant', content: '合成验收完成，请核对工具实际结果。'};
  response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta, finish_reason: null}]}) + '\n\n');
  response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta: {}, finish_reason: tool ? 'tool_calls' : 'stop'}],
    usage: {prompt_tokens: 100, completion_tokens: 30, total_tokens: 130}}) + '\n\n');
  response.end('data: [DONE]\n\n');
});
const originalFetch = net.fetch;
const mcpFixture = await startMcpFixture();
let store = new OmniEduStore(dataRoot);
let host: ReturnType<typeof createXiaozhiProductionHost> | undefined;
const events: unknown[] = [];
const checks: {name: string; pass: boolean; durationMs: number}[] = [];
const report: {success: boolean; root: string; checks: typeof checks; modelCalls?: number; paidCalls: number; error?: string;
  timings: Record<string, unknown>} = {success: false, root, checks, paidCalls: 0, timings: {
    moduleLoadMs: moduleReadyAt - Number((globalThis as {__phase3ImportStarted?: number}).__phase3ImportStarted || moduleReadyAt)}};
async function check(name: string, action: () => Promise<void>) {
  const start = performance.now(); await action(); checks.push({name, pass: true, durationMs: performance.now() - start});
  if (process.argv[3] !== '--crash-cut') fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log('PASS ' + name);
}
function makeHost() {return createXiaozhiProductionHost({store, dataRoot,
  emit: event => {
    events.push(event);
    if (startProfile && startProfile.firstEventMs === undefined) startProfile.firstEventMs = performance.now() - startProfile.startedAt;
  },
  beforeModelDelivery: async () => {
    if (startProfile && startProfile.resourcesReadyMs === undefined) startProfile.resourcesReadyMs = performance.now() - startProfile.startedAt;
  }, enabled: true});}
try {
  await new Promise<void>(resolve => fixture.listen(0, '127.0.0.1', resolve));
  const address = fixture.address(); assert(address && typeof address !== 'string');
  net.fetch = async (input, init) => {
    const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    assert.equal(target.origin, 'https://api.deepseek.com');
    return globalThis.fetch(`http://127.0.0.1:${address.port}${target.pathname}`, init);
  };
  await store.init(); host = makeHost();
  report.timings.fixtureAndStoreInitMs = Date.now() - moduleReadyAt;
  const sessionId = (await store.createAiConversationSession({title: 'Phase3合成主进程验收', folderId: null})).session.id;
  let terminalRunId = '';
  let terminalTaskId = '';
  await store.xiaozhiState.setWorkspace(sessionId, workspace, '合成目录');
  if (process.argv[3] !== '--crash-cut') {
  await check('Main migrates only proven workspace read and ignores local preference authority', async () => {
    const view = await host!.permissions.view(sessionId);
    assert.equal(view.profile.mode, 'request');
    assert(view.grants.every(grant => grant.scope.kind === 'filesystem' && grant.scope.actions.join(',') === 'read'));
    assert.equal((await host!.environment.inspect(sessionId)).permissionRuntime?.status, 'ready');
  });
  await check('Actual host Pi SSE invokes controlled terminal and commits authorized result through original Task', async () => {
    const view = await host!.permissions.view(sessionId);
    await host!.permissions.setMode({sessionId, revision: view.profile.revision, mode: 'fullAccess'});
    scenario = [{name: 'exec_command', input: {cmd: "[IO.File]::WriteAllText((Join-Path $env:XIAOZHI_WORKSPACE 'main-result.txt'),'owned-main'); Write-Output 'MAIN_READY'", timeout: 15}}];
    step = 0;
    startProfile = {name: 'first_terminal', startedAt: performance.now()};
    const result = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '执行已授权合成脚本并核对结果。'});
    startProfile.acceptedMs = performance.now() - startProfile.startedAt;
    assert(result.ok, JSON.stringify(result)); await host!.waitForRun(sessionId, result.runId);
    startProfile.finishedMs = performance.now() - startProfile.startedAt;
    report.timings.firstTerminal = startProfile; startProfile = undefined;
    assert.equal(fs.readFileSync(path.join(workspace, 'main-result.txt'), 'utf8'), 'owned-main');
    const rows = await store.xiaozhiState.sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind='sandbox_execution_finished' AND session_id=?", [sessionId]);
    assert.equal(rows.length, 1);
    const actual = JSON.parse(String(rows[0].metadata_json));
    assert.equal(actual.state, 'completed'); assert.equal(actual.cleanup.profileRemoved, true);
    assert.match(actual.owner.taskId, /^xitask_/u);
    assert.equal(actual.owner.runId, result.runId);
    terminalRunId = result.runId;
    terminalTaskId = actual.owner.taskId;
  });
  await check('Cold main preserves mode and Grants without replaying shell or teacher outputs', async () => {
    await host!.close(); host = undefined; await store.close();
    store = new OmniEduStore(dataRoot); await store.init(); host = makeHost();
    assert.equal((await host.permissions.view(sessionId)).profile.mode, 'fullAccess');
    assert.equal(fs.readFileSync(path.join(workspace, 'main-result.txt'), 'utf8'), 'owned-main');
    assert.equal((await store.xiaozhiState.sql.all("SELECT count(*) AS n FROM xiaozhi_permission_audit_v1 WHERE kind='sandbox_execution_finished'"))[0].n, 1);
  });
  await check('Valid v1 pending survives cold init, approves without waiter and resumes through new original Task', async () => {
    const legacySession = (await store.createAiConversationSession({title: '历史审批合成', folderId: null})).session.id;
    await store.xiaozhiState.setWorkspace(legacySession, workspace, '合成目录');
    await host!.resolveFileWorkspace(legacySession);
    const sourceHash = createHash('sha256').update(fs.readFileSync(path.join(workspace, 'source.txt'))).digest('hex');
    const row = await store.xiaozhiState.createApproval(legacySession, 'legacy_run_' + randomUUID(), {
      callId: 'legacy_call', source: 'source.txt', target: 'legacy-result.txt', sourceSha256: sourceHash
    } as never, workspaceHash(workspace));
    await host!.close(); host = undefined; await store.close();
    store = new OmniEduStore(dataRoot); await store.init(); host = makeHost();
    assert.equal((await store.xiaozhiState.getApproval(row.id))?.state, 'pending');
    assert(!fs.existsSync(path.join(workspace, 'legacy-result.txt')));
    assert((await host.permissions.view(legacySession)).legacyApprovals?.some(item => item.id === row.id));
    assert((await host.decide({sessionId: legacySession, approvalId: row.id, decision: 'approve'})).ok);
    scenario = [
      {name: 'update_task_plan', input: {schemaVersion: 'xiaozhi.task-plan.v3', expectedRevision: 0, requirementsVersion: 1,
        reason: '执行教师批准的历史复制并核对原文件', steps: [
          {id: 'copy', text: '复制来源到已批准目标', dependsOn: [], reported: 'in_progress', kind: 'saved_text', target: 'legacy-result.txt'},
          {id: 'review', text: '教师核对', dependsOn: ['copy'], reported: 'pending', kind: 'human'}
        ]}},
      {name: 'office_copy_file', input: {source: 'source.txt', target: 'legacy-result.txt'}}
    ]; step = 0;
    const resumed = await host.resumeLegacyApproval({sessionId: legacySession, approvalId: row.id});
    assert(resumed.ok, JSON.stringify(resumed)); await host.waitForRun(legacySession, resumed.runId);
    assert.equal(fs.readFileSync(path.join(workspace, 'legacy-result.txt'), 'utf8'), 'synthetic');
    assert.equal((await store.xiaozhiState.getApproval(row.id))?.state, 'executed');
    assert.equal((await store.xiaozhiState.permissions.approvals(legacySession)).filter(item => item.state === 'executed').length, 1);
  });
  await check('V1 approval with existing Task resumes that exact Task under a new Run and generation', async () => {
    const sourceHash = createHash('sha256').update(fs.readFileSync(path.join(workspace, 'source.txt'))).digest('hex');
    const row = await store.xiaozhiState.createApproval(sessionId, terminalRunId, {
      callId: 'legacy_existing_task', source: 'source.txt', target: 'same-task.txt', sourceSha256: sourceHash
    } as never, workspaceHash(workspace));
    assert((await host!.decide({sessionId, approvalId: row.id, decision: 'approve'})).ok);
    scenario = [
      {name: 'update_task_plan', input: {schemaVersion: 'xiaozhi.task-plan.v3', expectedRevision: 0, requirementsVersion: 1,
        reason: '沿原Task继续已批准文件复制', steps: [
          {id: 'copy', text: '复制合成来源', dependsOn: [], reported: 'in_progress', kind: 'saved_text', target: 'same-task.txt'},
          {id: 'review', text: '教师核对', dependsOn: ['copy'], reported: 'pending', kind: 'human'}
        ]}},
      {name: 'office_copy_file', input: {source: 'source.txt', target: 'same-task.txt', taskStepId: 'copy'}}
    ]; step = 0;
    startProfile = {name: 'same_task_resume', startedAt: performance.now()};
    const resumed = await host!.resumeLegacyApproval({sessionId, approvalId: row.id});
    startProfile.acceptedMs = performance.now() - startProfile.startedAt;
    assert(resumed.ok, JSON.stringify(resumed)); assert.notEqual(resumed.runId, terminalRunId);
    await host!.waitForRun(sessionId, resumed.runId);
    startProfile.finishedMs = performance.now() - startProfile.startedAt;
    report.timings.sameTaskResume = startProfile; startProfile = undefined;
    assert.equal(fs.readFileSync(path.join(workspace, 'same-task.txt'), 'utf8'), 'synthetic');
    const rows = await store.xiaozhiState.sql.all("SELECT event_json FROM xiaozhi_event_journal WHERE run_id=? AND json_extract(event_json,'$.kind')='task'", [resumed.runId]);
    assert(rows.length);
    for (const saved of rows) {
      const event = JSON.parse(String(saved.event_json));
      assert.equal(event.task.id, terminalTaskId); assert.equal(event.generation, 2);
    }
    assert.equal((await store.xiaozhiState.getApproval(row.id))?.state, 'executed');
  });
  let mcpView: Awaited<ReturnType<NonNullable<typeof host>['mcpCatalog']>>;
  let mcpName = '';
  await check('Authorized HTTP MCP with readonly hint writes then errors once and persists unknown effect', async () => {
    mcpView = await host!.mcpAdd({name: '合成MCP', transport: 'http', url: mcpFixture.url});
    const server = mcpView.servers[0];
    const input = () => ({schemaVersion: mcpView.schemaVersion, revision: mcpView.revision, serverId: server.id});
    mcpView = await host!.mcpInspect(input());
    mcpView = await host!.mcpTrust({...input(), schemaHash: mcpView.servers[0].schemaHash!, tools: ['lookup_lesson']});
    const origin = new URL(mcpFixture.url).origin;
    const sourceHash = createHash('sha256').update(canonicalMcp({transport: 'http', url: mcpFixture.url})).digest('hex');
    await host!.permissions.issue({sessionId, taskId: null, expiresAt: null, scopes: [
      {kind: 'network', origin, methods: ['POST'], purpose: 'mcp_call'},
      {kind: 'mcp', serverId: server.id, sourceHash, schemaHash: mcpView.servers[0].schemaHash!, tools: ['lookup_lesson']},
      {kind: 'egress', origin, classifications: ['teacher_private']}
    ]});
    const identity = createHash('sha256').update(canonicalMcp([server.id, 'lookup_lesson'])).digest('hex').slice(0, 24);
    mcpName = `mcp_${identity}_lookup_lesson`;
    mcpFixture.state.toolError = true;
    scenario = [{name: mcpName, input: {topic: '合成课程'}}]; step = 0;
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '调用已授合成课程MCP并按实际结果答复。'});
    assert(started.ok, JSON.stringify(started)); await host!.waitForRun(sessionId, started.runId);
    assert.equal(mcpFixture.state.calls, 1);
    const rows = await store.xiaozhiState.sql.all("SELECT event_json FROM xiaozhi_event_journal WHERE run_id=? AND json_extract(event_json,'$.kind')='tool_attempt'", [started.runId]);
    const attempts = rows.map(row => JSON.parse(String(row.event_json)).attempt).filter(attempt => attempt.tool === mcpName);
    assert.equal(attempts.filter(attempt => attempt.state === 'started').length, 1);
    const failed = attempts.find(attempt => attempt.state === 'failed');
    assert(failed); assert.equal(failed.maxAttempts, 1); assert.equal(failed.effect, 'unknown');
    mcpFixture.state.toolError = false;
  });
  await check('Active main MCP revoke cancels the server operation and blocks subsequent IO', async () => {
    mcpFixture.state.hang = true; scenario = [{name: mcpName, input: {topic: '撤销合成'}}]; step = 0;
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '调用已授合成MCP验证撤销。'});
    assert(started.ok);
    const deadline = Date.now() + 15000;
    while (mcpFixture.state.calls < 2 && Date.now() < deadline) await new Promise(resolve => setTimeout(resolve, 30));
    assert.equal(mcpFixture.state.calls, 2);
    mcpView = await host!.mcpCatalog();
    await host!.mcpRevoke({schemaVersion: mcpView.schemaVersion, revision: mcpView.revision, serverId: mcpView.servers[0].id});
    await host!.waitForRun(sessionId, started.runId);
    assert.equal(mcpFixture.state.calls, 2);
    const grants = await store.xiaozhiState.permissions.grants(sessionId);
    assert(grants.filter(grant => grant.scope.kind === 'mcp').every(grant => grant.revokedAt));
    mcpFixture.state.hang = false;
  });
  }
  await check('App shutdown preserves active v2 pending and approved decisions for the original Task', async () => {
    holdFinal = true;
    const persisted: {sessionId: string; id: string; state: string; digest: string; taskId: string; runId: string}[] = [];
    const approvalWaits: number[] = [];
    for (const desired of ['pending', 'approved'] as const) {
      const marker = 'RESTART_' + desired + '_' + randomUUID(); restartSteps.set(marker, 0);
      const preparing = performance.now();
      const id = (await store.createAiConversationSession({title: '重启审批' + desired, folderId: null})).session.id;
      await store.xiaozhiState.setWorkspace(id, workspace, '合成目录'); await host!.resolveFileWorkspace(id);
      scenario = [{name: 'exec_command', input: {cmd: "Write-Output 'RESTART_MUST_NOT_EXECUTE'", timeout: 10}}]; step = 0;
      const started = await host!.start({sessionId: id, commandId: 'xicmd_' + randomUUID(), prompt: marker + ' 执行合成脚本，超出当前范围先申请。'});
      assert(started.ok);
      let approval: Awaited<ReturnType<typeof store.xiaozhiState.permissions.approvals>>[number] | undefined;
      const deadline = Date.now() + 15000;
      while (!approval && Date.now() < deadline) {
        approval = (await store.xiaozhiState.permissions.approvals(id)).find(item => item.state === 'pending');
        if (!approval) await new Promise(resolve => setTimeout(resolve, 30));
      }
      assert(approval);
      approvalWaits.push(performance.now() - preparing);
      if (desired === 'approved') await host!.permissions.decide({sessionId: id, approvalId: approval.id,
        revision: approval.revision, decision: 'approve', scope: 'operation'});
      persisted.push({sessionId: id, id: approval.id, state: desired, digest: approval.requestDigest, taskId: approval.request.owner.taskId, runId: started.runId});
    }
    const before = (await store.xiaozhiState.sql.all("SELECT count(*) AS n FROM xiaozhi_permission_audit_v1 WHERE kind='sandbox_execution_finished'"))[0].n;
    if (process.argv[3] === '--crash-cut') {
      fs.writeFileSync(path.join(output, 'crash-checkpoint.json'), JSON.stringify({root, dataRoot, persisted, before}));
      process.kill(process.pid, 'SIGKILL');
      throw Error('owned_crash_cut_did_not_exit');
    }
    report.timings.restartApprovalSetupMs = approvalWaits;
    const closingAt = performance.now();
    await host!.close(); host = undefined;
    report.timings.activeHostCloseMs = performance.now() - closingAt;
    for (const saved of persisted) assert.notEqual((await store.getAiAgentRun(saved.runId))?.status, 'running');
    for (const response of heldResponses) response.end(); heldResponses.clear(); holdFinal = false;
    await store.close(); store = new OmniEduStore(dataRoot); await store.init(); host = makeHost();
    for (const saved of persisted) {
      const actual = await store.xiaozhiState.permissions.approval(saved.sessionId, saved.id);
      assert.equal(actual?.state, saved.state); assert.equal(actual?.requestDigest, saved.digest);
      assert.equal(actual?.request.owner.taskId, saved.taskId);
      assert((await host.permissions.view(saved.sessionId)).approvals.some(item => item.id === saved.id && item.state === saved.state));
    }
    assert.equal((await store.xiaozhiState.sql.all("SELECT count(*) AS n FROM xiaozhi_permission_audit_v1 WHERE kind='sandbox_execution_finished'"))[0].n, before);
  });
  report.success = true;
} catch (error) {report.error = error instanceof Error ? error.stack : String(error); console.error(report.error); process.exitCode = 1;}
finally {
  report.modelCalls = modelCalls;
  report.timings.localCatalogueRequests = catalogCalls;
  await host?.close().catch(() => {}); await store.close().catch(() => {});
  net.fetch = originalFetch; fixture.closeAllConnections(); await new Promise<void>(resolve => fixture.close(() => resolve()));
  await mcpFixture.close();
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: checks.length, output, root, error: report.error}));
}
