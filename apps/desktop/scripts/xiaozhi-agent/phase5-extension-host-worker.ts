import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {net} from 'electron';
import {OmniEduStore} from '../../src/main/db';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';
import {extensionCapabilityId,extensionDeclaration} from '../../src/main/xiaozhi-agent/extensions/registry';
import {permissionHash} from '../../src/main/xiaozhi-agent/permissions/validation';
import {MANAGED_READ_CAPABILITY} from '../../src/main/xiaozhi-agent/capabilities/acquisition/managed-mcp';

const output = process.argv[2];
const resume = undefined;
if (resume) assert(path.dirname(path.resolve(resume)) === path.resolve(os.tmpdir()) && /^xiaozhi-phase5-extension-host-[a-zA-Z0-9]+$/u.test(path.basename(resume)));
const root = resume ? path.resolve(resume) : fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase5-extension-host-'));
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
function packageDirectory(version: string) {
  const directory = path.join(root, 'extension-' + version); fs.mkdirSync(directory);
  fs.writeFileSync(path.join(directory, 'edudev.extension.json'), JSON.stringify({schemaVersion: 1, extensionId: 'synthetic.context', version,
    entry: 'entry.cjs', hooks: ['context.transform', 'event.observe'], license: 'MIT'}));
  fs.writeFileSync(path.join(directory, 'LICENSE'), 'MIT synthetic local acceptance license');
  const observe = version === '2.0.0' ? "throw Error('synthetic hook conformance failure');" : 'return null;';
  fs.writeFileSync(path.join(directory, 'entry.cjs'), `exports.contextTransform=async({text})=>({text:${JSON.stringify('extension-' + version + ':')}+text});exports.observeEvent=async()=>{${observe}};`);
  return directory;
}
let taskId = '';
const run = async (prompt: string) => {
  const result = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt,
    ...(taskId ? {continueTask: {taskId, requirementsVersion: 1}} : {})});
  assert(result.ok, JSON.stringify(result)); testedRuns.add(result.runId);
  await host!.waitForRun(sessionId, result.runId);
  const receipt = (await store.xiaozhiState.sql.all('SELECT contract_json FROM xiaozhi_tool_receipts WHERE run_id=? AND admitted=1 AND contract_json IS NOT NULL LIMIT 1', [result.runId]))[0];
  if (receipt) taskId = JSON.parse(String(receipt.contract_json)).taskId;
  return result.runId;
};
try {
  await new Promise<void>(resolve => fixture.listen(0, '127.0.0.1', resolve));
  const address = fixture.address(); assert(address && typeof address !== 'string');
  net.fetch = async (input, init) => {
    const url = new URL(typeof input === 'string' ? input : input.url);
    if (url.origin === 'https://api.deepseek.com') return fetch(`http://127.0.0.1:${address.port}${url.pathname}`, init);
    assert.equal(url.origin, 'https://raw.githubusercontent.com'); assert.equal(init?.method, 'GET'); assert.equal(init?.credentials, 'omit');
    const response = await originalFetch(url.href, init); const bytes = await response.arrayBuffer();
    sourceRequests.push({url: url.href, bytes: bytes.byteLength, durationMs: 0});
    return new Response(bytes, {status: response.status, headers: response.headers});
  };
  await store.init();
  const makeHost = () => createXiaozhiProductionHost({store, dataRoot, emit() {}, enabled: true});
  host = makeHost();
  sessionId = (await store.createAiConversationSession({title: 'Phase5真实扩展Task', folderId: null})).session.id;
  await store.xiaozhiState.setWorkspace(sessionId, workspace, '合成教师资料目录'); await host.permissions.view(sessionId);
  let firstArtifact = '';
  await check('Main picker import quarantines exact local provenance without running entry or fetching dependencies', async () => {
    const view = await host!.extensionImport(sessionId, packageDirectory('1.0.0'));
    const extension = view.extensions![0]; firstArtifact = extension.artifactId;
    assert.equal(extension.trust, 'unknown'); assert.equal(extension.sourceKind, 'local_import'); assert.equal(extension.phase, 'quarantined');
    assert.match(extension.sourceHash, /^[a-f0-9]{64}$/u); assert.equal(sourceRequests.length, 0);
    assert.equal(view.context, null); assert.equal(host!.permissions.engine.activeCount(), 0);
  });
  await check('Actual Pi active Task prepares local package through original approvals and invokes both real isolated hooks', async () => {
    let stage = 0, attempts = 0;
    nextTool = async () => {
      if (stage === 0) {stage++; return {name: 'extension_inspect', input: {}};}
      if (stage === 1) {
        const extension = (await host!.acquisitionView(sessionId)).extensions!.find(row => row.artifactId === firstArtifact)!;
        if (extension.enabled && extension.active) stage++;
        else {assert(attempts++ < 10, JSON.stringify(extension)); await approvePending();
          return {name: 'extension_prepare', input: {artifactId: firstArtifact, revision: extension.revision}};}
      }
      if (stage === 2) {stage++; return {name: 'extension_invoke', input: {extensionId: 'synthetic.context', hook: 'context.transform', text: 'public generic text'}};}
      if (stage === 3) {stage++; return {name: 'extension_invoke', input: {extensionId: 'synthetic.context', hook: 'event.observe', text: 'public task notice'}};}
      return undefined;
    };
    const runId = await run('准备教师刚导入的公开上下文扩展并验证两个钩子，只传公开通用文本。');
    const texts = bodies.flatMap(body => toolTexts(body as Parameters<typeof toolTexts>[0]));
    assert(texts.some(text => text.includes('extension-1.0.0:public generic text')), texts.join('\n').slice(-12000));
    assert(texts.some(text => text.includes('event.observe') && text.includes('xiaozhi.provider-result.v1')));
    assert(approvals.length >= 2); assert.equal(host!.permissions.engine.activeCount(), 0);
    const contracts = await store.xiaozhiState.sql.all('SELECT tool,contract_json FROM xiaozhi_tool_receipts WHERE run_id=? AND admitted=1', [runId]);
    const invocations = contracts.filter(row => row.tool === 'extension_invoke'); assert.equal(invocations.length, 2);
    for (const row of invocations) {const value = JSON.parse(String(row.contract_json)); assert.equal(value.effect, 'external_effect');
      assert(value.grantRefs.length); assert(value.authorityRefs.length); assert.equal(value.taskId, taskId);}
    const catalog = await store.xiaozhiState.capabilities.snapshot(); assert(catalog.providers.some(row => row.type === 'extension' && row.runtime === 'isolated'));
    const first = catalog.providers.find(row => row.source.packageHash === firstArtifact)!;
    for (const hook of ['context.transform','event.observe'] as const) {
      const binding = await store.xiaozhiState.capabilities.verifyBinding(extensionCapabilityId(hook), first.id);
      assert.equal('verified' in binding && binding.verified, true);
    }
  });
  await check('Teacher-private original tool result is rejected before external extension dispatch', async () => {
    const scenario: ToolCall[] = [{name: 'office_read_text', input: {path: 'private.txt'}},
      {name: 'extension_invoke', input: {extensionId: 'synthetic.context', hook: 'context.transform', text: excerpt}}];
    nextTool = async () => scenario.shift(); const before = bodies.length;
    await run('继续检查合成资料的隐私来源，教师原文必须保密。');
    const texts = bodies.slice(before).flatMap(body => toolTexts(body as Parameters<typeof toolTexts>[0]));
    assert(texts.some(text => text.includes(privateText)));
    const binding = await store.xiaozhiState.getBinding(sessionId); assert(binding);
    const entries = fs.readFileSync(path.join(dataRoot, 'xiaozhi-pi', binding.sessionFile), 'utf8').trim().split('\n').map(line => JSON.parse(line));
    const last = entries.findLast(entry => entry.message?.role === 'toolResult' && entry.message.toolName === 'extension_invoke');
    assert.equal(last?.message.details.error.code, 'permission_denied'); assert.equal(last?.message.isError, true);
    assert(!texts.some(text => text.includes('extension-1.0.0:' + excerpt)));
  });
  await check('Actual version update and rollback use persisted selection CAS and fresh isolated health', async () => {
    const imported = await host!.extensionImport(sessionId, packageDirectory('2.0.0'));
    const secondArtifact = imported.extensions!.find(row => row.version === '2.0.0')!.artifactId;
    let stage = 0, attempts = 0;
    nextTool = async () => {
      const view = await host!.acquisitionView(sessionId);
      if (stage === 0) {
        const second = view.extensions!.find(row => row.artifactId === secondArtifact)!;
        if (second.active && second.enabled) stage++;
        else {assert(attempts++ < 10); await approvePending(); return {name: 'extension_prepare', input: {artifactId: secondArtifact, revision: second.revision}};}
      }
      if (stage === 1) {stage++; return {name: 'extension_invoke', input: {extensionId: 'synthetic.context', hook: 'context.transform', text: 'updated public text'}};}
      if (stage === 2) {
        await approvePending();
        const first = view.extensions!.find(row => row.artifactId === firstArtifact)!;
        try {await host!.acquisitionMutate({action: 'extension_select', sessionId, extensionId: first.extensionId, version: first.version, revision: first.selectionRevision}); stage++;}
        catch (error) {assert.equal((error as Error).message, 'permission_pending'); return {name: 'extension_inspect', input: {}};}
      }
      if (stage === 3) {stage++; return {name: 'extension_invoke', input: {extensionId: 'synthetic.context', hook: 'context.transform', text: 'rollback public text'}};}
      return undefined;
    };
    const before = bodies.length; await run('继续验证公开扩展的新版本，再回到原版本核对结果。');
    const texts = bodies.slice(before).flatMap(body => toolTexts(body as Parameters<typeof toolTexts>[0]));
    assert(texts.some(text => text.includes('extension-2.0.0:updated public text')), texts.join('\n').slice(-8000));
    assert(texts.some(text => text.includes('extension-1.0.0:rollback public text')));
    assert.equal((await host!.acquisitionView(sessionId)).extensions!.find(row => row.active)!.version, '1.0.0');
    const updated = (await store.xiaozhiState.capabilities.snapshot()).providers.find(row => row.source.packageHash === secondArtifact)!;
    const accepted = await store.xiaozhiState.capabilities.verifyBinding(extensionCapabilityId('context.transform'), updated.id);
    assert.equal('verified' in accepted && accepted.verified, true);
    const rejected = await store.xiaozhiState.capabilities.verifyBinding(extensionCapabilityId('event.observe'), updated.id);
    assert.equal('verified' in rejected && rejected.verified, false);
    assert.equal(rejected.state, 'disabled');
  });
  await check('Idle revocation survives cold main and takes priority over archived provider snapshots', async () => {
    const first = (await host!.acquisitionView(sessionId)).extensions!.find(row => row.artifactId === firstArtifact)!;
    await host!.acquisitionMutate({action: 'extension_revoke', sessionId, extensionId: first.extensionId, version: first.version, revision: first.selectionRevision});
    const snapshots = await store.xiaozhiState.sql.all('SELECT snapshot_json FROM xiaozhi_capability_snapshots_v1 WHERE capability_id=?', [extensionCapabilityId('context.transform')]);
    assert(snapshots.length >= 2);
    const selected = JSON.parse(String(snapshots[0].snapshot_json));
    assert.equal((await store.xiaozhiState.capabilities.providerVersion(selected.selection.providerId, selected.selection.providerVersion, selected.capabilityId))!.revoked, true);
    // Recreate the exact persisted post-rename/prepared intent shape from the separate real parent-kill suite.
    const interruptedKey = (await store.xiaozhiState.sql.all("SELECT key,value_json FROM app_settings WHERE key LIKE 'xiaozhi.extension.package.v1.%'"))
      .find(row => JSON.parse(String(row.value_json)).document.manifest.version === '2.0.0')!;
    const interrupted = JSON.parse(String(interruptedKey.value_json));
    const lastRun = (await store.xiaozhiState.sql.all('SELECT run_id,generation FROM xiaozhi_tool_receipts ORDER BY rowid DESC LIMIT 1'))[0];
    interrupted.document.phase = 'preparing';
    interrupted.document.attempt = {id: randomUUID(), owner: {sessionId, taskId, runId: lastRun.run_id, generation: lastRun.generation}, expiresAt: new Date(Date.now() + 3600000).toISOString()};
    interrupted.hash = permissionHash(interrupted.document);
    await store.xiaozhiState.sql.run('UPDATE app_settings SET value_json=? WHERE key=?', [JSON.stringify(interrupted), interruptedKey.key as string]);
    await host!.close(); host = undefined; await store.close(); store = new OmniEduStore(dataRoot); await store.init(); host = makeHost();
    const coldView = await host.acquisitionView(sessionId);
    const firstCold = coldView.extensions!.find(row => row.artifactId === firstArtifact)!;
    assert.equal(firstCold.revoked, true); assert.equal(firstCold.enabled, false);
    const stopped = coldView.extensions!.find(row => row.version === '2.0.0')!;
    assert.equal(stopped.phase, 'failed'); assert.equal(stopped.error, 'interrupted'); assert.equal(stopped.revision, interrupted.document.revision);
    const intent = JSON.parse(String((await store.xiaozhiState.sql.all('SELECT value_json FROM app_settings WHERE key=?', [interruptedKey.key as string]))[0].value_json));
    assert.equal(intent.document.phase, 'preparing'); assert.equal(intent.hash, interrupted.hash);
    nextTool = async () => undefined;
  });
  await check('Actual native terminal receipts preserve all cleanup invariants with no remaining leases or modified teacher files', async () => {
    const rows = await store.xiaozhiState.sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE kind='mcp_service_terminal'");
    assert(rows.length >= 8);
    for (const row of rows) {const value = JSON.parse(String(row.metadata_json));
      assert.deepEqual(value.result.cleanup, {jobActiveProcesses: 0, profileRemoved: true, remainingOwnedAces: 0});}
    assert.equal(host!.permissions.engine.activeCount(), 0); assert.equal(fs.readFileSync(path.join(workspace, 'private.txt'), 'utf8'), privateText);
    fs.writeFileSync(path.join(output, 'native-tool-bodies.json'), JSON.stringify(bodies, null, 2));
  });
  report.success = true;
} catch (error) {report.error = error instanceof Error ? error.stack : String(error); process.exitCode = 1; console.error(error);}
finally {
  fs.writeFileSync(path.join(output, 'native-tool-bodies.json'), JSON.stringify(bodies, null, 2));
  await host?.close(); await store.close(); net.fetch = originalFetch;
  await new Promise<void>(resolve => fixture.close(() => resolve()));
  report.modelCalls = calls; fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: checks.length, output, root, error: report.error}));
}
