// Deterministic SDK protocol faults, separate from real-provider evidence.
import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai';
const { createPiXiaozhiSession } = await import('../../src/main/xiaozhi-agent/pi-session.ts');
const { fileVersion } = await import('../../src/main/xiaozhi-agent/workspace-files.ts');
const { guardAssistantMessageStream } = await import('../../src/main/xiaozhi-agent/vendor/hana/lib/pi-sdk/stream-guard.ts');
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
fs.mkdirSync(path.join(appRoot, 'test-results/xiaozhi-agent'), { recursive: true });
const output = fs.mkdtempSync(path.join(appRoot, 'test-results/xiaozhi-agent/pi-boundary-'));
const workspace = path.join(output, 'workspace'), stateRoot = path.join(output, 'state');
fs.mkdirSync(workspace); fs.mkdirSync(stateRoot);
fs.writeFileSync(path.join(workspace, 'a.md'), 'FACT_A'); fs.writeFileSync(path.join(workspace, 'b.md'), 'FACT_B');
const checks = [], events = [];
const report = { suite: 'pi-education-injected-boundaries', success: false, checks,
  boundaries: ['Actual Pi SDK and real host tools with injected model protocol', 'No provider-call or formal UI claim'] };
let agent, approvalCount = 0;
const check = (name, fn) => { fn(); checks.push({ name, pass: true }); };
const call = (name, args, id = 'same-id') => ({ type: 'toolCall', id, name, arguments: args });
function inject(queue) {
  agent.session.agent.streamFn = model => {
    const next = queue.shift(); assert(next, 'Unexpected model continuation');
    const stream = createAssistantMessageEventStream();
    const message = { role: 'assistant', content: [], api: model.api, provider: model.provider, model: model.id,
      usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0,
        cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } }, timestamp: Date.now(), ...next };
    if (message.stopReason === 'error') stream.push({ type: 'error', reason: 'error', error: message });
    else stream.push({ type: 'done', reason: message.stopReason, message });
    stream.end(); return guardAssistantMessageStream(stream);
  };
}
const end = { stopReason: 'stop', content: [{ type: 'text', text: '已核验工具实际结果。' }] };
const lastTool = () => [...agent.session.messages].reverse().find(m => m.role === 'toolResult');
try {
  agent = await createPiXiaozhiSession({ stateRoot, workspace, apiKey: 'synthetic-sdk-test-key', model: 'deepseek-chat',
    onEvent: event => events.push(event), turnTimeoutMs: 1000, approveCopy: async () => { approvalCount++; return true; } });
  inject([{ stopReason: 'toolUse', content: [call('exec_command', { command: 'blocked-default-command' })] }, end]);
  await agent.prompt('协议注入：默认命令工具');
  check('SDK rejects an unregistered built-in tool without executing it', () => {
    assert(lastTool()?.isError); assert(!fs.existsSync(path.join(workspace, 'unauthorized.md')));
    assert(!events.some(e => e.kind === 'tool_start' && e.tool === 'exec_command'));
  });
  inject([{ stopReason: 'toolUse', content: [call('office_read_text', { path: 'a.md' })] }, end]);
  await agent.prompt('第一轮读取'); assert.equal(lastTool().details.data.text, 'FACT_A');
  assert.equal(lastTool().details.data.version, fileVersion(fs.statSync(path.join(workspace,'a.md'))));
  assert.notEqual(lastTool().details.data.version,lastTool().details.data.sha256);
  fs.writeFileSync(path.join(workspace, 'a.md'), 'UPDATED_A');
  inject([{ stopReason: 'toolUse', content: [call('office_read_text', { path: 'a.md' })] }, end]);
  await agent.prompt('新轮使用相同调用编号读取');
  check('Reused call ID in a new run reads current facts, not old cached results', () => assert.equal(lastTool().details.data.text, 'UPDATED_A'));
  check('Actual Pi run tool returns the current file version distinct from body SHA',()=>assert.equal(lastTool().details.data.version,fileVersion(fs.statSync(path.join(workspace,'a.md')))));
  inject([{ stopReason: 'toolUse', content: [call('office_read_text', { path: 'a.md' }, 'collision'), call('office_read_text', { path: 'b.md' }, 'collision')] }, end]);
  await agent.prompt('同一轮调用编号碰撞');
  check('Same call ID with different arguments becomes explicit conflict', () => {
    assert(agent.session.messages.some(m => m.role === 'toolResult' && m.isError && m.details?.error?.code === 'conflict'));
  });
  inject([{ stopReason: 'toolUse', content: [call('office_copy_file', { source: 'a.md', target: 'once.md' }, 'copy-once'), call('office_copy_file', { source: 'a.md', target: 'once.md' }, 'copy-once')] }, end]);
  await agent.prompt('重复调用只执行一次');
  check('Identical duplicate copy calls approve and write only once', () => {
    assert.equal(approvalCount, 1); assert.equal(fs.readFileSync(path.join(workspace, 'once.md'), 'utf8'), 'UPDATED_A');
  });
  inject([{ stopReason: 'error', errorMessage: 'TypeError: fetch failed - injected transport fault' }]);
  const fault = await agent.prompt('网络失败');
  check('Transport failure has one failed terminal event and safe error code', () => {
    assert.equal(fault.error, 'transport'); assert.deepEqual(events.filter(e => e.runId === fault.runId && e.kind === 'status').map(e => e.status), ['running', 'failed']);
  });
  inject([{ stopReason: 'stop', content: [{ type: 'thinking', thinking: 'PRIVATE_REASONING_SENTINEL' }] }]);
  const empty = await agent.prompt('空正文与私有推理');
  check('Empty answer fails, private reasoning stays out of public projection', () => {
    assert.equal(empty.error, 'model_error'); assert.equal(events.at(-1).status, 'failed');
    assert(!JSON.stringify(events).includes('PRIVATE_REASONING_SENTINEL'));
  });
  agent.session.agent.streamFn = (model, _, options) => {
    const stream = createAssistantMessageEventStream();
    options.signal.addEventListener('abort', () => {
      const message = { ...end, role: 'assistant', content: [], stopReason: 'aborted', api: model.api, provider: model.provider, model: model.id,
        timestamp: Date.now(), usage: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, totalTokens: 0, cost: { input: 0, output: 0, cacheRead: 0, cacheWrite: 0, total: 0 } } };
      stream.push({ type: 'error', reason: 'aborted', error: message }); stream.end();
    }, { once: true });
    return stream;
  };
  const timeout = await agent.prompt('持续断流直到超时');
  check('Run budget aborts a stalled stream and releases ownership', () => {
    assert.equal(timeout.error, 'budget_exhausted'); assert.equal(agent.diagnostics().running, false); assert.equal(agent.diagnostics().executing, 0);
  });
  report.success = true;
} catch (error) { report.failure = String(error.stack).slice(0, 3500); process.exitCode = 1; }
finally {
  await agent?.dispose(); const reportPath = path.join(output, 'report.json');
  fs.writeFileSync(reportPath, JSON.stringify(report, null, 2)); console.log(JSON.stringify({ ...report, reportPath: path.relative(appRoot, reportPath) }));
}
