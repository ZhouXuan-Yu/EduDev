import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {net} from 'electron';
import {OmniEduStore} from '../../src/main/db';
import {createXiaozhiProductionHost} from '../../src/main/xiaozhi-agent/production-host';
import {createTaskState} from '../../src/main/xiaozhi-agent/tasks/task-state';

const output = process.argv[2], root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-workflow-host-'));
const dataRoot = path.join(root, 'data'), workspace = path.join(root, 'workspace'); fs.mkdirSync(workspace);
fs.writeFileSync(path.join(workspace, 'reference.txt'), 'OWNED_WORKFLOW_REFERENCE The teacher can inspect the existing outline.');
process.env.DEEPSEEK_API_KEY = 'synthetic-phase6-loopback'; process.env.DEEPSEEK_MODEL = 'deepseek-flash';
type Tool = {name: string; input: Record<string, unknown>};
let scenario: Tool[] = [], requests: Record<string, unknown>[] = [];
const report = {success: false, root, output, paidCalls: 0, modelCalls: 0, checks: [] as {name: string; pass: boolean; durationMs: number}[], error: undefined as string | undefined};
const server = http.createServer(async (request, response) => {
  try {
    if (request.url === '/v1/models') {response.writeHead(200, {'content-type': 'application/json'}); response.end(JSON.stringify({object: 'list', data: [{id: 'deepseek-flash', context_window: 1048576, max_output_tokens: 32768, input_modalities: ['text']}]})); return;}
    assert.equal(request.url, '/v1/chat/completions'); let body = '';
    for await (const bytes of request) body += bytes.toString('utf8');
    requests.push(JSON.parse(body)); report.modelCalls++;
    const tool = scenario.shift(), base = {id: 'phase6-workflow', object: 'chat.completion.chunk', created: 1, model: 'deepseek-flash'};
    const delta = tool ? {role: 'assistant', tool_calls: [{index: 0, id: 'call_' + randomUUID().replaceAll('-', ''), type: 'function', function: {name: tool.name, arguments: JSON.stringify(tool.input)}}]}
      : {role: 'assistant', content: '已保留实际任务状态，按现有授权完成可核对的步骤。'};
    response.writeHead(200, {'content-type': 'text/event-stream'});
    response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta, finish_reason: null}]}) + '\n\n');
    response.write('data: ' + JSON.stringify({...base, choices: [{index: 0, delta: {}, finish_reason: tool ? 'tool_calls' : 'stop'}], usage: {prompt_tokens: 100, completion_tokens: 30, total_tokens: 130}}) + '\n\n');
    response.end('data: [DONE]\n\n');
  } catch (error) {console.error(error); response.writeHead(500); response.end();}
});
const originalFetch = net.fetch;
const store = new OmniEduStore(dataRoot);
let host: ReturnType<typeof createXiaozhiProductionHost> | undefined;
const events: unknown[] = [];
const makeHost = () => createXiaozhiProductionHost({store, dataRoot, enabled: true, emit: event => events.push(event)});
async function check(name: string, action: () => Promise<void>) {const started = performance.now(); await action(); report.checks.push({name, pass: true, durationMs: performance.now() - started}); fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2)); console.log('PASS ' + name);}
async function session(fullAccess: boolean) {
  const id = (await store.createAiConversationSession({title: 'Phase6实际规划与审批', folderId: null})).session.id;
  await store.xiaozhiState.setWorkspace(id, workspace, '合成教学目录');
  const view = await host!.permissions.view(id);
  if (fullAccess) await host!.permissions.setMode({sessionId: id, revision: view.profile.revision, mode: 'fullAccess'});
  return id;
}
async function snapshot(sessionId: string) {const result = await host!.taskSnapshot({sessionId}); assert(result.ok, JSON.stringify(result)); assert(result.value.task); return result.value;}
async function run(sessionId: string, tools: Tool[], resume = false) {
  scenario = tools; const current = resume ? (await snapshot(sessionId)).task! : undefined;
  const started = current ? await host!.start({sessionId, continueTask: {taskId: current.id, requirementsVersion: current.requirementsVersion},
      prompt: '继续刚才的任务，尊重教师拒绝并选择仍可完成的替代步骤。', commandId: 'xicmd_' + randomUUID()})
    : await host!.start({sessionId, commandId: 'xicmd_' + randomUUID(), prompt: '这是独立新任务。核对合成教学目录中的任务和授权事实。'});
  assert(started.ok, JSON.stringify(started)); await host!.waitForRun(sessionId, started.runId);
  return {runId: started.runId, snapshot: await snapshot(sessionId)};
}
const plan = (planningLevel: number, capabilityRequirements: unknown[] = []) => ({name: 'update_task_plan', input: {schemaVersion: 'xiaozhi.task-plan.v3', expectedRevision: 0, requirementsVersion: 1,
  reason: 'Persist the actual task complexity and dependencies', planningLevel, capabilityRequirements,
  steps: [{id: 'teaching_output', text: 'Prepare the synthetic teaching note', dependsOn: [], reported: 'pending', kind: 'saved_text', target: 'planned-output.txt'},
    {id: 'teacher_check', text: 'Teacher checks the result', dependsOn: ['teaching_output'], reported: 'pending', kind: 'human'}]}});
try {
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve)); const address = server.address(); assert(address && typeof address !== 'string');
  net.fetch = async (input, init) => {const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url); assert.equal(url.origin, 'https://api.deepseek.com'); return fetch(`http://127.0.0.1:${address.port}${url.pathname}`, init);};
  await store.init(); host = makeHost();
  await check('Level1 answer takes one original Pi request without a planning round', async () => {
    const id = await session(true), before = report.modelCalls;
    const completed = await run(id, []); assert.equal(report.modelCalls - before, 1);
    assert.equal(completed.snapshot.task!.planning?.level, 1);
    assert.equal(completed.snapshot.task!.planRevision, 0);
  });
  await check('Level2 adopted plan persists dependencies and reasons in the immutable checkpoint', async () => {
    const id = await session(true), completed = await run(id, [plan(2)]), task = completed.snapshot.task!;
    assert.equal(task.planning?.level, 2); assert(task.planning.reasons.includes('multiple_steps'));
    assert.equal(task.steps.length, 2); assert.deepEqual(task.steps[1].dependsOn, ['teaching_output']);
    const checkpoint = await createTaskState(store.xiaozhiState.sql, {sanitize: async text => text}).checkpoint(task.id);
    assert(checkpoint); assert.equal(checkpoint.task.planning?.level, 2);
  });
  await check('Level3 missing capability blocks execution while original safe reads still work', async () => {
    const id = await session(true), before = requests.length;
    const missing = {capabilityId: 'edu.synthetic.missing', contractVersion: '1.0.0', required: ['invoke'], optional: [], conditions: []};
    const completed = await run(id, [plan(3, [missing]), {name: 'office_read_text', input: {path: 'reference.txt'}},
      {name: 'exec_command', input: {cmd: "Set-Content 'blocked-output.txt' 'MUST_NOT_EXECUTE'"}}]);
    const task = completed.snapshot.task!; assert.equal(task.planning?.level, 3);
    assert.equal(task.planning.preflight.state, 'blocked'); assert(task.planning.preflight.blockers.includes('capabilities'));
    const bodies = JSON.stringify(requests.slice(before)); assert(bodies.includes('OWNED_WORKFLOW_REFERENCE')); assert(bodies.includes('本操作尚未派发'));
    const blockedEffect = (await store.xiaozhiState.effects.forTask(id, task.id)).find(effect => effect.tool === 'exec_command');
    assert(blockedEffect); assert.equal(blockedEffect.state, 'failed'); assert.equal(blockedEffect.outcome?.error, 'not_delivered');
    assert.equal(blockedEffect.execution, null);
    assert.equal(fs.existsSync(path.join(workspace, 'blocked-output.txt')), false);
  });
  let approvalSession = '', approvalId = '', oldTask = '';
  const denied = {name: 'exec_command', input: {cmd: "Set-Content 'denied-output.txt' 'MUST_NOT_EXECUTE'"}};
  await check('Original pending approval survives Host restart with zero automatic model or process dispatch', async () => {
    approvalSession = await session(false); const attempted = await run(approvalSession, [denied]); oldTask = attempted.snapshot.task!.id;
    const pending = (await host!.permissions.view(approvalSession)).approvals.find(item => item.state === 'pending'); assert(pending); approvalId = pending.id;
    const before = report.modelCalls; await host!.close(); host = makeHost();
    const restored = await host.permissions.view(approvalSession); assert(restored.approvals.some(item => item.id === approvalId && item.state === 'pending'));
    assert.equal(report.modelCalls, before); assert.equal(fs.existsSync(path.join(workspace, 'denied-output.txt')), false);
  });
  await check('Teacher rejection suppresses the exact repeated request and permits an alternative read in the same Task', async () => {
    const pending = (await host!.permissions.view(approvalSession)).approvals.find(item => item.id === approvalId)!;
    await host!.permissions.decide({sessionId: approvalSession, approvalId, revision: pending.revision, decision: 'reject', scope: 'operation'});
    const before = requests.length; const continued = await run(approvalSession, [denied, {name: 'office_read_text', input: {path: 'reference.txt'}}], true);
    assert.equal(continued.snapshot.task!.id, oldTask);
    const approvals = (await host!.permissions.view(approvalSession)).approvals;
    assert.equal(approvals.length, 1); assert.equal(approvals[0].state, 'rejected');
    assert.equal(fs.existsSync(path.join(workspace, 'denied-output.txt')), false);
    assert(JSON.stringify(requests.slice(before)).includes('OWNED_WORKFLOW_REFERENCE'));
  });
  report.success = true;
} catch (error) {report.error = error instanceof Error ? error.stack : String(error); console.error(error); process.exitCode = 1;}
finally {
  await host?.close(); await store.close(); net.fetch = originalFetch;
  await new Promise<void>(resolve => server.close(() => resolve()));
  fs.writeFileSync(path.join(output, 'model-requests.json'), JSON.stringify(requests, null, 2));
  fs.writeFileSync(path.join(output, 'events.json'), JSON.stringify(events, null, 2));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, root, output, checks: report.checks.length, error: report.error}));
}
