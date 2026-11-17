import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {net} from 'electron';
import {OmniEduStore} from '../../src/main/db';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';
import {createAcquisitionState} from '../../src/main/xiaozhi-agent/capabilities/acquisition/state';
import {MANAGED_READ_CAPABILITY} from '../../src/main/xiaozhi-agent/capabilities/acquisition/managed-mcp';

const output = process.argv[2];
const resume = process.env.PHASE5_RESUME_ROOT;
if (resume) assert(path.dirname(path.resolve(resume)) === path.resolve(os.tmpdir()) && /^xiaozhi-phase5-production-[a-zA-Z0-9]+$/u.test(path.basename(resume)));
const root = resume ? path.resolve(resume) : fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase5-production-'));
const dataRoot = path.join(root, 'data');
const workspace = path.join(root, 'workspace'); fs.mkdirSync(workspace, {recursive: true});
const privateText = '合成教师私有资料 ' + Array.from({length: 12}, (_, index) => createHash('sha256').update('private-phase5-' + index).digest('hex')).join('');
const excerpt = privateText.slice(180, 260); fs.writeFileSync(path.join(workspace, 'private.txt'), privateText);
fs.mkdirSync(path.join(workspace, 'nested'), {recursive: true}); fs.writeFileSync(path.join(workspace, 'nested/private.txt'), privateText);
process.env.DEEPSEEK_API_KEY = 'synthetic-phase5-loopback';
process.env.DEEPSEEK_MODEL = 'deepseek-flash';
type ToolCall = {name: string; input: Record<string, unknown>};
let nextTool: (body: {messages: {role: string; content: unknown}[]}) => Promise<ToolCall | undefined> = async () => undefined;
let store = new OmniEduStore(dataRoot);
let host: ReturnType<typeof createXiaozhiProductionHost> | undefined;
let sessionId = '';
let calls = 0;
const bodies: unknown[] = [];
const approvals: {action: string; scopes: unknown; runId: string}[] = [];
const sourceRequests: {url: string; bytes: number; durationMs: number}[] = [];
const checks: {name: string; pass: boolean; durationMs: number}[] = [];
const testedRuns = new Set<string>();
const report = {success: false, root, output, checks, paidCalls: 0, modelCalls: 0, approvals, sourceRequests, error: undefined as string | undefined};
const requirement = {capabilityId: MANAGED_READ_CAPABILITY.id, contractVersion: '1.0.0', required: ['read_text'], optional: [], conditions: []};
async function check(name: string, action: () => Promise<void>) {
  const started = performance.now(); await action(); checks.push({name, pass: true, durationMs: performance.now() - started});
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log('PASS ' + name);
}
const fixture = http.createServer(async (request, response) => {
  try {
    if (request.url === '/v1/models') {
      response.writeHead(200, {'content-type': 'application/json'});
      response.end(JSON.stringify({object: 'list', data: [{id: 'deepseek-flash', context_window: 1048576,
        max_output_tokens: 32768, input_modalities: ['text'], effort: {supported_levels: ['low', 'high', 'max'], default_level: 'low'}}]})); return;
    }
    if (request.url !== '/v1/chat/completions') {response.writeHead(404); response.end(); return;}
    let text = ''; for await (const bytes of request) text += bytes.toString('utf8');
    const body = JSON.parse(text); bodies.push(body); calls++;
    const tool = await nextTool(body);
    response.writeHead(200, {'content-type': 'text/event-stream'});
    const base = {id: 'synthetic-phase5', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash'};
    const delta = tool ? {role: 'assistant', tool_calls: [{index: 0, id: 'call_' + randomUUID().replaceAll('-', ''), type: 'function',
      function: {name: tool.name, arguments: JSON.stringify(tool.input)}}]} : {role: 'assistant', content: '已按实际工具回执完成合成资料核对。'};
    response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta, finish_reason: null}]}) + '\n\n');
    response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta: {}, finish_reason: tool ? 'tool_calls' : 'stop'}],
      usage: {prompt_tokens: 100, completion_tokens: 30, total_tokens: 130}}) + '\n\n');
    response.end('data: [DONE]\n\n');
  } catch (error) {console.error(error); response.writeHead(500); response.end('fixture failed');}
});
const originalFetch = net.fetch;
async function approvePending() {
  for (const approval of (await host!.permissions.view(sessionId)).approvals.filter(row => row.state === 'pending')) {
    assert(!approval.request.scopes.some(scope => scope.kind === 'egress'));
    approvals.push({action: approval.request.action, scopes: approval.request.scopes, runId: approval.request.owner.runId});
    await host!.permissions.decide({sessionId, approvalId: approval.id, revision: approval.revision, decision: 'approve', scope: 'task'});
  }
}
const toolTexts = (body: {messages: {role: string; content: unknown}[]}) => body.messages.filter(message => message.role === 'tool')
  .map(message => String(message.content));
function draft(name: string) {return {name, description: '合成流程隐私核验', document: '# 工作方法\n' + excerpt,
  version: '1.0.0', dependencies: [], permissionRequirements: ['filesystem.read']};}
try {
  await new Promise<void>(resolve => fixture.listen(0, '127.0.0.1', resolve));
  const address = fixture.address(); assert(address && typeof address !== 'string');
  net.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.origin === 'https://api.deepseek.com') return fetch(`http://127.0.0.1:${address.port}${url.pathname}`, init);
    assert(['https://registry.npmjs.org', 'https://raw.githubusercontent.com', 'https://nodejs.org'].includes(url.origin));
    assert.equal(init?.method, 'GET'); assert.equal(init?.credentials, 'omit');
    const started = performance.now(); const response = await originalFetch(url.href, init);
    const bytes = await response.arrayBuffer(); sourceRequests.push({url: url.href, bytes: bytes.byteLength, durationMs: performance.now() - started});
    return new Response(bytes, {status: response.status, headers: response.headers});
  };
  await store.init();
  const makeHost = () => createXiaozhiProductionHost({store, dataRoot, emit() {}, enabled: true,
    onCapabilityProbe: result => {fs.appendFileSync(path.join(output, 'owned-canary-probes.jsonl'), JSON.stringify(result) + '\n');}}); host = makeHost();
  const previousOperation = resume ? (await createAcquisitionState(store.xiaozhiState.sql).operations())[0] : undefined;
  sessionId = previousOperation?.owner.sessionId || (await store.createAiConversationSession({title: 'Phase5合成能力获取', folderId: null})).session.id;
  if (!resume) await store.xiaozhiState.setWorkspace(sessionId, workspace, '合成资料目录'); await host.permissions.view(sessionId);
  let taskId = ''; let firstRun = ''; let selectedSnapshot = '';
  await check('Actual Pi active Task searches public candidate, receives original scoped approvals, installs exact public package, registers and executes its real adapter', async () => {
    let stage = 0; let candidateId = ''; let attempts = 0;
    nextTool = async body => {
      if (stage === 0) {stage++; return {name: 'capability_search', input: {query: 'local filesystem read text', sources: ['reviewed']}};}
      if (stage === 1) {
        const text = toolTexts(body).find(text => text.includes('xicandidate_')); assert(text, JSON.stringify(body.messages));
        candidateId = text.match(/xicandidate_[a-f0-9]{64}/)![0]; stage++;
      }
      if (stage === 2) {
        const state = createAcquisitionState(store.xiaozhiState.sql); const operation = (await state.operations()).find(row => row.candidateId === candidateId);
        if (operation?.phase === 'ready' && attempts > 0) stage++;
        else {
          assert(attempts++ < 8, JSON.stringify(operation));
          if (operation && !(resume && attempts === 1)) assert(['needs_approval', 'resolving', 'ready'].includes(operation.phase), JSON.stringify({phase: operation.phase, error: operation.error}));
          await approvePending(); return {name: 'capability_prepare', input: {candidateId}};
        }
      }
      if (stage === 3) {stage++; return {name: 'capability_resolve', input: {...requirement, refresh: true}};}
      if (stage === 4) {stage++; return {name: 'capability_execute', input: {requirement, input: {path: 'nested/private.txt'}}};}
      if (stage === 5) {stage++; return {name: 'skill_create', input: draft('phase5-immediate-private')};}
      return undefined;
    };
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '准备合成目录的只读文本能力，并在当前任务读取private.txt核对来源。',
      ...(previousOperation ? {continueTask: {taskId: previousOperation.owner.taskId, requirementsVersion: 1}} : {})});
    assert(started.ok, JSON.stringify(started)); firstRun = started.runId; testedRuns.add(firstRun); await host!.waitForRun(sessionId, firstRun);
    const state = createAcquisitionState(store.xiaozhiState.sql); const operation = (await state.operations())[0];
    assert.equal(operation.phase, 'ready', JSON.stringify({phase: operation.phase, error: operation.error})); taskId = operation.owner.taskId;
    assert.equal(operation.owner.runId, firstRun); assert.match(taskId, /^xitask_/);
    const row = (await store.xiaozhiState.sql.all('SELECT snapshot_json FROM xiaozhi_capability_snapshots_v1 WHERE run_id=? AND task_id=? AND capability_id=?',
      [firstRun, taskId, requirement.capabilityId]))[0];
    const snapshot = row ? JSON.parse(String(row.snapshot_json)) : undefined;
    assert(snapshot); selectedSnapshot = snapshot.snapshotId;
    const texts = bodies.flatMap(body => toolTexts(body as Parameters<typeof toolTexts>[0]));
    assert(texts.some(text => text.includes(privateText) && text.includes('xiaozhi.provider-result.v1')), texts.join('\n').slice(-24000));
    const terminals = await store.xiaozhiState.sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind='mcp_service_terminal'");
    assert(terminals.length >= 3); // Discovery probe, function probe and actual Task execution each own a terminal lease.
    if (!resume) assert(approvals.length >= 3); assert.equal(host!.permissions.engine.activeCount(), 0);
    assert.equal(fs.readFileSync(path.join(workspace, 'private.txt'), 'utf8'), privateText);
    const skills = await host!.skillGovernanceView(); const skill = skills.skills.find(row => row.name === 'phase5-immediate-private'); assert(skill);
    const version = skills.versions.find(row => row.skillId === skill.id)!; assert.equal(version.state, 'draft');
    assert(version.validation.checks.some(row => row.reasons.includes('private_source_excerpt')));
    const receipts = await store.xiaozhiState.sql.all('SELECT tool,contract_json FROM xiaozhi_tool_receipts WHERE run_id=? AND admitted=1', [firstRun]);
    assert(receipts.length >= 5);
    for (const row of receipts) {
      assert(row.contract_json, String(row.tool)); const contract = JSON.parse(String(row.contract_json));
      assert.equal(contract.taskId, taskId); assert.match(contract.providerHash, /^[a-f0-9]{64}$/u);
      assert.match(contract.schemaHash, /^[a-f0-9]{64}$/u); assert.match(contract.snapshotId, /^xicap_/u);
      assert(contract.scopePolicy); assert(Number.isSafeInteger(contract.planRevision));
    }
    const binding = await store.xiaozhiState.getBinding(sessionId); assert(binding);
    const entries = fs.readFileSync(path.join(dataRoot, 'xiaozhi-pi', binding.sessionFile), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    const governance = entries.findLast(entry => entry.type === 'custom' && entry.customType === 'xiaozhi.tool-governance.v1')!.data;
    assert.deepEqual([...governance.registeredNames].sort(), governance.tools.map((tool: {name: string}) => tool.name).sort());
    assert(governance.tools.length > 30); assert(governance.tools.every((tool: {providerHash: string; schemaHash: string; scopePolicy: string}) =>
      /^[a-f0-9]{64}$/u.test(tool.providerHash) && /^[a-f0-9]{64}$/u.test(tool.schemaHash) && tool.scopePolicy));
    fs.writeFileSync(path.join(output, 'native-tool-bodies.json'), JSON.stringify(bodies, null, 2));
  });
  await check('Dispatcher private result is rejected from Skill publication on the next original Task Run', async () => {
    let called = false; nextTool = async () => {if (called) return undefined; called = true; return {name: 'skill_create', input: draft('phase5-history-private')};};
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '继续整理通用方法，教师原文必须保密。', continueTask: {taskId, requirementsVersion: 1}});
    assert(started.ok, JSON.stringify(started)); testedRuns.add(started.runId); await host!.waitForRun(sessionId, started.runId);
    const view = await host!.skillGovernanceView(); const skill = view.skills.find(row => row.name === 'phase5-history-private'); assert(skill);
    const version = view.versions.find(row => row.skillId === skill.id)!;
    assert.equal(version.state, 'draft'); assert(version.validation.checks.some(row => row.reasons.includes('private_source_excerpt')));
  });
  await check('Cold main continuation preserves source, original capability snapshot and private-history rejection', async () => {
    await host!.close(); host = undefined; await store.close(); store = new OmniEduStore(dataRoot); await store.init(); host = makeHost();
    const state = createAcquisitionState(store.xiaozhiState.sql); const artifact = (await state.artifacts())[0]; assert.equal(artifact.status, 'ready');
    assert.equal((await store.xiaozhiState.sql.all('SELECT snapshot_id FROM xiaozhi_capability_snapshots_v1 WHERE snapshot_id=?', [selectedSnapshot])).length, 1);
    let called = false; nextTool = async () => {if (called) return undefined; called = true; return {name: 'skill_create', input: draft('phase5-cold-private')};};
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '继续核对工作方法，保密原文不能进入通用技能。', continueTask: {taskId, requirementsVersion: 1}});
    assert(started.ok, JSON.stringify(started)); testedRuns.add(started.runId); await host!.waitForRun(sessionId, started.runId);
    const view = await host!.skillGovernanceView(); const skill = view.skills.find(row => row.name === 'phase5-cold-private'); assert(skill);
    const version = view.versions.find(row => row.skillId === skill.id)!; assert.equal(version.state, 'draft');
    assert(version.validation.checks.some(row => row.reasons.includes('private_source_excerpt')));
  });
  await check('All real helper Job terminal receipts have completed cleanup and original main leases end', async () => {
    const rows = await store.xiaozhiState.sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind='mcp_service_terminal'");
    for (const row of rows) {const value = JSON.parse(String(row.metadata_json)); if (!testedRuns.has(value.owner.runId)) continue;
      assert.equal(value.result.cleanup.jobActiveProcesses, 0);
      assert.equal(value.result.cleanup.profileRemoved, true); assert.equal(value.result.cleanup.remainingOwnedAces, 0);}
    assert.equal(host!.permissions.engine.activeCount(), 0);
  });
  await check('FullAccess with already satisfied original scopes prepares and calls automatically within the same Task without new approvals', async () => {
    const profile = (await host!.permissions.view(sessionId)).profile;
    await host!.permissions.setMode({sessionId, revision: profile.revision, mode: 'fullAccess'});
    const approvalsBefore = (await host!.permissions.view(sessionId)).approvals.length;
    const requestsBefore = sourceRequests.length;
    const operation = (await createAcquisitionState(store.xiaozhiState.sql).operations())[0];
    const scenario: ToolCall[] = [{name: 'capability_prepare', input: {candidateId: operation.candidateId}},
      {name: 'capability_resolve', input: {...requirement, refresh: true}},
      {name: 'capability_execute', input: {requirement, input: {path: 'nested/private.txt'}}}];
    nextTool = async () => scenario.shift();
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '继续用已授权能力核对合成目录中的资料。',
      continueTask: {taskId, requirementsVersion: 1}});
    assert(started.ok, JSON.stringify(started)); testedRuns.add(started.runId); await host!.waitForRun(sessionId, started.runId);
    assert.equal((await host!.permissions.view(sessionId)).approvals.length, approvalsBefore);
    assert.equal(sourceRequests.length, requestsBefore);
    const entries = (await store.xiaozhiState.sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind='capability_function_probe'"))
      .map(row => JSON.parse(String(row.metadata_json))).filter(row => row.owner.runId === started.runId);
    assert(entries.some(row => row.healthMarker && !row.failed)); assert.equal(host!.permissions.engine.activeCount(), 0);
    const rows = await store.xiaozhiState.sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind='mcp_service_terminal'");
    for (const row of rows) {const value = JSON.parse(String(row.metadata_json)); if (!testedRuns.has(value.owner.runId)) continue;
      assert.deepEqual(value.result.cleanup, {jobActiveProcesses: 0, profileRemoved: true, remainingOwnedAces: 0});}
  });
  report.success = true;
} catch (error) {report.error = error instanceof Error ? error.stack : String(error); process.exitCode = 1; console.error(error);}
finally {
  await host?.close(); await store.close(); net.fetch = originalFetch;
  await new Promise<void>(resolve => fixture.close(() => resolve()));
  report.modelCalls = calls; fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: checks.length, output, root, error: report.error}));
}
