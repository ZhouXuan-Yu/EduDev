import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {net} from 'electron';
import {OmniEduStore} from '../../src/main/db';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';

const output = process.argv[2];
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase4-production-'));
const dataRoot = path.join(root, 'data');
const workspace = path.join(root, 'workspace'); fs.mkdirSync(workspace);
const privateText = '合成教师私有原文：' + Array.from({length: 256}, (_, index) => createHash('sha256').update(`production-private-${index}`).digest('hex')
  .replace(/[0-9a-f]/g, digit => String.fromCharCode(97 + Number.parseInt(digit, 16)))).join('');
const privateExcerpt = privateText.slice(9300, 9364);
fs.writeFileSync(path.join(workspace, 'private.txt'), privateText);
process.env.DEEPSEEK_API_KEY = 'synthetic-phase4-loopback';
process.env.DEEPSEEK_MODEL = 'deepseek-flash';
type Scenario = {name: string; input: Record<string, unknown> | ((body: Record<string, unknown>) => Record<string, unknown>)};
let scenario: Scenario[] = [];
let step = 0;
let modelCalls = 0;
let holdFinal = false;
const held = new Set<http.ServerResponse>();
const readResults: string[] = [];
const fixture = http.createServer(async (request, response) => {
  if (request.url === '/v1/models') {
    response.writeHead(200, {'content-type': 'application/json'});
    response.end(JSON.stringify({object: 'list', data: [{id: 'deepseek-flash', context_window: 1048576,
      max_output_tokens: 32768, input_modalities: ['text'], effort: {supported_levels: ['low', 'high', 'max'], default_level: 'low'}}]})); return;
  }
  if (request.url !== '/v1/chat/completions') {response.writeHead(404); response.end(); return;}
  let text = ''; for await (const bytes of request) text += bytes.toString('utf8');
  const body = JSON.parse(text); modelCalls++;
  for (const message of body.messages || []) {
    if (message.role === 'tool' && String(message.content).includes('第一版技能标记')) readResults.push(String(message.content));
  }
  const tool = scenario[step++];
  response.writeHead(200, {'content-type': 'text/event-stream'});
  if (!tool && holdFinal) {held.add(response); return;}
  const base = {id: 'synthetic-phase4', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash'};
  const delta = tool ? {role: 'assistant', tool_calls: [{index: 0, id: 'call_' + randomUUID().replaceAll('-', ''), type: 'function',
    function: {name: tool.name, arguments: JSON.stringify(typeof tool.input === 'function' ? tool.input(body) : tool.input)}}]}
    : {role: 'assistant', content: '合成工作方法已按工具实际状态处理。'};
  response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta, finish_reason: null}]}) + '\n\n');
  response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta: {}, finish_reason: tool ? 'tool_calls' : 'stop'}],
    usage: {prompt_tokens: 100, completion_tokens: 30, total_tokens: 130}}) + '\n\n');
  response.end('data: [DONE]\n\n');
});
let store = new OmniEduStore(dataRoot);
let host: ReturnType<typeof createXiaozhiProductionHost> | undefined;
const originalFetch = net.fetch;
const checks: {name: string; pass: boolean; durationMs: number}[] = [];
const report = {success: false, root, checks, paidCalls: 0, modelCalls: 0, error: undefined as string | undefined};
async function check(name: string, action: () => Promise<void>) {
  const started = performance.now(); await action(); checks.push({name, pass: true, durationMs: performance.now() - started});
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log('PASS ' + name);
}
async function until(test: () => Promise<boolean>) {
  const deadline = Date.now() + 45000;
  while (!await test()) {if (Date.now() >= deadline) throw Error('fixture_timeout'); await new Promise(resolve => setTimeout(resolve, 25));}
}
const draft = (version = '1.0.0', document = '# 第一版技能标记\n先核对目标，按实际证据列出步骤，再核对交付。') =>
  ({name: 'phase4-workflow', description: '合成可复用教学方法', document, version, dependencies: [], permissionRequirements: ['filesystem.read']});
function readSkill(body: Record<string, unknown>) {
  const messages = (body.messages as {content?: unknown}[]).map(message => typeof message.content === 'string' ? message.content : JSON.stringify(message.content)).join('\n');
  const section = messages.match(/<name>phase4-workflow<\/name>[\s\S]*?<location>([^<]+)<\/location>/);
  if (!section) throw Error('fixture_skill_location_missing');
  return {path: section[1]};
}
try {
  await new Promise<void>(resolve => fixture.listen(0, '127.0.0.1', resolve));
  const address = fixture.address(); assert(address && typeof address !== 'string');
  net.fetch = async (input, init) => {
    const target = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url);
    assert.equal(target.origin, 'https://api.deepseek.com');
    return fetch(`http://127.0.0.1:${address.port}${target.pathname}`, init);
  };
  await store.init();
  const makeHost = () => createXiaozhiProductionHost({store, dataRoot, emit() {}, enabled: true});
  host = makeHost();
  const sessionId = (await store.createAiConversationSession({title: 'Phase4合成工作流', folderId: null})).session.id;
  await store.xiaozhiState.setWorkspace(sessionId, workspace, '合成目录');
  await host.permissions.view(sessionId);
  let skillId = '';
  let originalTaskId = '';
  await check('Real host Pi Creator publishes private Personal version in the original Task Journal while idle-only UI stays blocked', async () => {
    scenario = [{name: 'skill_create', input: draft()}]; step = 0; holdFinal = true;
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '把这个已验证的通用方法保存为个人技能。'});
    assert(started.ok, JSON.stringify(started));
    await until(async () => (await host!.skillGovernanceView()).versions.some(version => version.provenance.runId === started.runId));
    const view = await host!.skillGovernanceView(); const created = view.versions.find(version => version.provenance.runId === started.runId)!;
    skillId = created.skillId; originalTaskId = created.provenance.taskId!;
    assert.equal(created.state, 'published'); assert.match(originalTaskId, /^xitask_/);
    assert.equal(view.skills.find(skill => skill.id === skillId)!.activeVersion, null);
    await assert.rejects(host!.skillGovernanceMutate({action: 'team_create', name: 'busy'}), /busy/);
    holdFinal = false;
    for (const response of held) response.end('data: [DONE]\n\n'); held.clear();
    await host!.waitForRun(sessionId, started.runId);
    const entries = await store.xiaozhiState.sql.all('SELECT payload_json FROM xiaozhi_skill_run_snapshots_v1 WHERE id=?', [started.runId]);
    assert.equal(entries.length, 1); assert.equal(JSON.parse(String(entries[0].payload_json)).owner.taskId, originalTaskId);
    const grants = await store.xiaozhiState.sql.all('SELECT count(*) AS n FROM xiaozhi_permission_grants_v1');
    assert.equal(Number(grants[0].n), 1);
  });
  let runWithV1 = '';
  let privateTaskId = '';
  let privateGeneration = 0;
  await check('Ordinary Skill upgrade during an actual Pi Run preserves V1 read bytes and records exact selected identity', async () => {
    scenario = [{name: 'skill_create', input: draft('2.0.0', '# 第二版技能标记\n先核对证据，逐步检查并保留来源。')},
      {name: 'read', input: readSkill}]; step = 0;
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '继续保存第二版通用流程，并读取本轮已选用的方法。',
      continueTask: {taskId: originalTaskId, requirementsVersion: 1}});
    assert(started.ok, JSON.stringify(started)); runWithV1 = started.runId; await host!.waitForRun(sessionId, started.runId);
    const snapshot = await store.xiaozhiState.skillGovernance.get('snapshots', started.runId);
    assert.equal(snapshot!.owner.taskId, originalTaskId); assert.equal(snapshot!.owner.generation, 2);
    assert.equal(snapshot!.selected.find(selection => selection.skillId === skillId)!.version, '1.0.0');
    assert(readResults.some(text => text.includes('第一版技能标记')));
    const view = await host!.skillGovernanceView(); assert.equal(view.skills.find(skill => skill.id === skillId)!.activeVersion, '1.0.0');
    assert(view.versions.some(version => version.skillId === skillId && version.version === '2.0.0' && version.state === 'published'));
  });
  await check('Next actual Run activates V2 without replaying publication and source snapshots remain immutable', async () => {
    scenario = []; step = 0;
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '继续核对已保存的工作方法。',
      continueTask: {taskId: originalTaskId, requirementsVersion: 1}});
    assert(started.ok, JSON.stringify(started)); await host!.waitForRun(sessionId, started.runId);
    const snapshot = await store.xiaozhiState.skillGovernance.get('snapshots', started.runId);
    assert.equal(snapshot!.owner.taskId, originalTaskId); assert.equal(snapshot!.owner.generation, 3);
    assert.equal(snapshot!.selected.find(selection => selection.skillId === skillId)!.version, '2.0.0');
    assert.equal((await store.xiaozhiState.skillGovernance.get('snapshots', runWithV1))!.selected.find(selection => selection.skillId === skillId)!.version, '1.0.0');
    assert.equal((await host!.skillGovernanceView()).versions.filter(version => version.skillId === skillId).length, 2);
  });
  await check('Actual teacher-file read is captured as private provenance and copied prose is blocked before Skill package publication', async () => {
    scenario = [{name: 'office_read_text', input: {path: 'private.txt'}},
      {name: 'skill_create', input: {...draft(), name: 'private-copy', document: '# 方法\n' + privateExcerpt}}]; step = 0;
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '读取合成资料后保存通用方法，保密正文不能进入技能。'});
    assert(started.ok, JSON.stringify(started)); await host!.waitForRun(sessionId, started.runId);
    const view = await host!.skillGovernanceView(); const skill = view.skills.find(skill => skill.name === 'private-copy'); assert(skill);
    const version = view.versions.find(version => version.skillId === skill.id)!;
    privateTaskId = version.provenance.taskId!;
    privateGeneration = (await store.xiaozhiState.skillGovernance.get('snapshots', started.runId))!.owner.generation;
    assert.equal(version.state, 'draft'); assert(version.validation.checks.some(check => check.reasons.includes('private_source_excerpt')));
    const row = await store.xiaozhiState.skillGovernance.get('versions', `${skill.id}@1.0.0`);
    assert(!fs.readFileSync(path.join(dataRoot, 'xiaozhi-pi', 'skills', row!.package.directory, 'SKILL.md'), 'utf8').includes(privateExcerpt));
    assert(!JSON.stringify(row).includes(privateExcerpt));
  });
  async function assertHistoryPrivacy(name: string, generation: number) {
    scenario = [{name: 'skill_create', input: {...draft(), name, document: '# 方法\n' + privateExcerpt}}]; step = 0;
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '继续从已读资料整理方法，私有原文不能进入技能。',
      continueTask: {taskId: privateTaskId, requirementsVersion: 1}});
    assert(started.ok, JSON.stringify(started)); await host!.waitForRun(sessionId, started.runId);
    const view = await host!.skillGovernanceView();
    const skill = view.skills.find(item => item.name === name); assert(skill);
    const version = view.versions.find(item => item.skillId === skill.id)!;
    assert.equal(version.provenance.taskId, privateTaskId);
    const snapshot = await store.xiaozhiState.skillGovernance.get('snapshots', started.runId);
    assert.equal(snapshot!.owner.generation, generation);
    assert.equal(version.state, 'draft');
    assert(version.validation.checks.some(item => item.reasons.includes('private_source_excerpt')));
    const row = await store.xiaozhiState.skillGovernance.get('versions', `${skill.id}@1.0.0`);
    assert(!JSON.stringify(row).includes(privateExcerpt));
    assert(!fs.readFileSync(path.join(dataRoot, 'xiaozhi-pi', 'skills', row!.package.directory, 'SKILL.md'), 'utf8').includes(privateExcerpt));
  }
  await check('Same Task next Run rebuilds private read evidence from actual native history without another file read', async () => {
    await assertHistoryPrivacy('private-history-next', privateGeneration + 1);
  });
  let reviewId = '';
  await check('Original typed host management persists Team review without publishing or widening Personal scope', async () => {
    await host!.skillGovernanceMutate({action: 'team_create', name: '合成本地组'});
    const view = await host!.skillGovernanceView(); const skill = view.skills.find(skill => skill.id === skillId)!;
    const shared = await host!.skillGovernanceMutate({action: 'share', skillId, version: '2.0.0', revision: skill.revision});
    const review = shared.reviews.find(review => review.scope === 'team' && review.status === 'pending')!;
    assert(review); reviewId = review.id;
    assert.equal(shared.versions.find(version => version.skillId === review.skillId)!.state, 'pending_review');
  });
  await check('Cold main retains exact versions and pending review, rollback and administrator approval use persistent facts', async () => {
    await host!.close(); host = undefined; await store.close(); store = new OmniEduStore(dataRoot); await store.init(); host = makeHost();
    let view = await host.skillGovernanceView(); const review = view.reviews.find(review => review.id === reviewId)!; assert.equal(review.status, 'pending');
    assert.equal(view.versions.filter(version => version.skillId === skillId).length, 2);
    await host.skillGovernanceMutate({action: 'review', reviewId, revision: review.revision, approve: true});
    view = await host.skillGovernanceView(); assert.equal(view.reviews.find(review => review.id === reviewId)!.status, 'approved');
    const skill = view.skills.find(skill => skill.id === skillId)!;
    view = await host.skillGovernanceMutate({action: 'activate', skillId, version: '1.0.0', revision: skill.revision});
    assert.equal(view.skills.find(skill => skill.id === skillId)!.activeVersion, '1.0.0');
    assert.equal(view.officialReviewer, false);
  });
  await check('Cold host continuation rebuilds private read evidence from persisted native history', async () => {
    await assertHistoryPrivacy('private-history-cold', privateGeneration + 2);
  });
  await check('Loaded Skill instructions cannot turn the existing read Grant into actual filesystem or process authority', async () => {
    scenario = [{name: 'read', input: readSkill},
      {name: 'exec_command', input: {cmd: "Set-Content must-not-write.txt 'NEVER'", timeout: 10}}]; step = 0;
    const started = await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '按已选方法尝试未授写入，必须由宿主实际阻断。'});
    assert(started.ok, JSON.stringify(started)); await host!.waitForRun(sessionId, started.runId);
    assert(!fs.existsSync(path.join(workspace, 'must-not-write.txt')));
    const permissions = await host!.permissions.view(sessionId);
    assert(permissions.approvals.some(approval => approval.request.action === 'exec_command' && approval.request.owner.runId === started.runId));
    assert(permissions.grants.every(grant => grant.scope.kind === 'filesystem' && grant.scope.actions.join(',') === 'read'));
    const rows = await store.xiaozhiState.sql.all("SELECT count(*) AS n FROM xiaozhi_permission_audit_v1 WHERE kind='sandbox_execution_prepared'");
    assert.equal(Number(rows[0].n), 0);
  });
  report.success = true;
} catch (error) {report.error = error instanceof Error ? error.stack : String(error); process.exitCode = 1; console.error(error);}
finally {
  holdFinal = false; for (const response of held) response.destroy();
  await host?.close(); await store.close(); net.fetch = originalFetch;
  await new Promise<void>(resolve => fixture.close(() => resolve()));
  report.modelCalls = modelCalls; fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: checks.length, output, root, error: report.error}));
}
