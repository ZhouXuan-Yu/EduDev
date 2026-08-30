import assert from 'node:assert/strict';
import { createInterface } from 'node:readline';
import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const pythonRoot = join(repoRoot, 'python');

function pythonCommand() {
  if (process.env.OMNI_EDU_PYTHON) return { command: process.env.OMNI_EDU_PYTHON, args: [] };
  if (process.platform !== 'win32') return { command: 'python3', args: [] };
  const candidate = ['C:\\Python314\\python.exe', 'D:\\Anaconda\\python.exe', 'C:\\Windows\\py.exe'].find((path) => existsSync(path));
  const command = candidate ?? 'py';
  return { command, args: /(?:^|[\\/])py(?:\.exe)?$/i.test(command) ? ['-3'] : [] };
}

async function run() {
  const python = pythonCommand();
  const child = spawn(python.command, [...python.args, '-m', 'omni_edu_deeptutor_bridge'], {
    cwd: repoRoot,
    env: { ...process.env, PYTHONPATH: pythonRoot },
    stdio: ['pipe', 'pipe', 'pipe'],
    windowsHide: true,
  });
  const lines = createInterface({ input: child.stdout });
  const pending = new Map();
  const events = [];
  let modelRequests = 0;
  const modelMaxTokens = [];
  let hostRequests = 0;
  let modelStep = 0;
  const send = (payload) => child.stdin.write(`${JSON.stringify(payload)}\n`);
  const request = (method, params) => new Promise((resolveRequest, rejectRequest) => {
    const id = `req_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    pending.set(id, { resolve: resolveRequest, reject: rejectRequest });
    send({ type: 'request', id, method, params });
  });

  lines.on('line', (line) => {
    let payload;
    try { payload = JSON.parse(line); } catch { return; }
    if (payload.type === 'response' && pending.has(payload.id)) {
      const waiter = pending.get(payload.id); pending.delete(payload.id);
      if (payload.error) waiter.reject(new Error(payload.error.message || payload.error.code));
      else waiter.resolve(payload);
      return;
    }
    if (payload.type === 'event' && payload.event) {
      events.push(payload.event);
      return;
    }
    if (payload.type === 'model_request') {
      modelRequests += 1;
      const requestPayload = payload.request;
      modelMaxTokens.push(requestPayload.maxTokens);
      assert.equal(requestPayload.maxTokens, 8_000, 'AgentLoop model budget must fit a complete xiazhi.reply.v2 response');
      const names = (requestPayload.tools || []).map((tool) => tool?.function?.name).filter(Boolean);
      if (modelStep === 0) {
        assert.ok(names.includes('load_tools'), 'first sidecar model request must expose load_tools');
        assert.equal(names.includes('search_learning_records'), false, 'first sidecar model request leaked delayed tool');
        send({ type: 'model_result', result: {
          schemaVersion: 'xiazhi.model.result.v1', requestId: requestPayload.requestId, turnId: requestPayload.turnId, status: 'succeeded',
          response: { choices: [{ message: { content: null, tool_calls: [{ id: 'load_1', type: 'function', function: { name: 'load_tools', arguments: JSON.stringify({ groups: ['learning'] }) } }] } }] },
        } });
        modelStep += 1;
      } else if (modelStep === 1) {
        assert.ok(names.includes('search_learning_records'), 'loaded schema must reach the next sidecar model request');
        send({ type: 'model_result', result: {
          schemaVersion: 'xiazhi.model.result.v1', requestId: requestPayload.requestId, turnId: requestPayload.turnId, status: 'succeeded',
          response: { choices: [{ message: { content: null, tool_calls: [{ id: 'search_1', type: 'function', function: { name: 'search_learning_records', arguments: JSON.stringify({ limit: 4 }) } }] } }] },
        } });
        modelStep += 1;
      } else {
        send({ type: 'model_result', result: {
          schemaVersion: 'xiazhi.model.result.v1', requestId: requestPayload.requestId, turnId: requestPayload.turnId, status: 'succeeded',
          response: { choices: [{ message: { content: JSON.stringify({
            schemaVersion: 'xiazhi.reply.v2', route: 'practice_design', subIntent: 'homework_plan', answerMarkdown: `## 已完成\\n${'中文长回复回归。'.repeat(3_000)}`, facts: [], evidence: [], inferences: [], unknowns: ['这是 sidecar progressive smoke。'], risks: [{ level: 'normal', category: 'none', mitigation: '只读取 bounded 工具结果。' }], teacherConfirmations: [], nextActions: [], artifacts: [], routeCheck: { kind: 'practice_design', passed: true, notes: [] }, processSummary: ['先加载工具 schema，再执行学习记录读取。'],
          }), tool_calls: [] }, finish_reason: 'stop' }] },
        } });
      }
      return;
    }
    if (payload.type === 'host_tool_request') {
      hostRequests += 1;
      const requestPayload = payload.request;
      if (requestPayload.toolName === 'load_tools') {
        send({ type: 'host_tool_result', result: {
          schemaVersion: 'xiazhi.host_tool.result.v1', requestId: requestPayload.requestId, turnId: requestPayload.turnId, status: 'used',
          review: { ok: true, reason: 'test host review', errors: [] },
          modelResult: { ok: true, schemaVersion: 'omni.tool.catalog.v1', loadedToolNames: ['search_learning_records'], toolsExecuted: false, toolDefinitions: [{ type: 'function', function: { name: 'search_learning_records', description: 'bounded local records', parameters: { type: 'object', properties: { limit: { type: 'number' } }, additionalProperties: false } } }] },
        } });
      } else {
        assert.equal(requestPayload.toolName, 'search_learning_records');
        send({ type: 'host_tool_result', result: {
          schemaVersion: 'xiazhi.host_tool.result.v1', requestId: requestPayload.requestId, turnId: requestPayload.turnId, status: 'used',
          review: { ok: true, reason: 'test host review', errors: [] }, modelResult: { ok: true, records: [], bounded: true },
        } });
      }
    }
  });

  try {
    const handshake = await request('handshake', {});
    assert.equal(handshake.result?.manifest?.runtime, 'DeepTutor.AgentLoop');
    const started = await request('start_turn', {
      turnId: 'progressive-sidecar-turn', capability: 'deep_question', prompt: '请根据学习记录设计练习。',
      context: {
        language: 'zh', modelProxy: 'deepseek', executionProfile: 'omni_console', systemPrompt: '当前 route：practice_design，subIntent：homework_plan。',
        progressiveToolNames: ['load_tools'],
        hostTools: [
          { type: 'function', function: { name: 'load_tools', description: 'load', parameters: { type: 'object', properties: { groups: { type: 'array', items: { type: 'string' } } }, additionalProperties: false } } },
          { type: 'function', function: { name: 'search_learning_records', description: 'records', parameters: { type: 'object', properties: { limit: { type: 'number' } }, additionalProperties: false } } },
        ],
      }, budgets: { maxEvents: 64, maxWallMs: 120000 },
    });
    assert.equal(started.result?.accepted, true);
    const deadline = Date.now() + 20_000;
    while (!events.some((event) => event.turnId === 'progressive-sidecar-turn' && event.phase === 'done') && Date.now() < deadline) {
      await new Promise((resolveWait) => setTimeout(resolveWait, 50));
    }
    const turnEvents = events.filter((event) => event.turnId === 'progressive-sidecar-turn');
    const done = turnEvents.at(-1);
    assert.equal(done?.phase, 'done');
    assert.equal(done?.status, 'succeeded');
    assert.ok(turnEvents.some((event) => event.publicSummary?.executionProfile === 'omni_console' && event.publicSummary?.capability === 'deep_question'), 'console execution profile must retain the selected capability while using the shared AgentLoop');
    assert.equal(modelRequests, 3);
    assert.deepEqual(modelMaxTokens, [8_000, 8_000, 8_000]);
    assert.equal(hostRequests, 2);
    assert.ok(turnEvents.some((event) => event.phase === 'tool_request' && event.publicSummary?.toolName === 'load_tools'));
    assert.ok(turnEvents.some((event) => event.phase === 'tool_request' && event.publicSummary?.toolName === 'search_learning_records'));
    assert.ok(turnEvents.some((event) => event.label === '宿主模型 JSON 状态'
      && event.publicSummary?.finishReason === 'stop'
      && event.publicSummary?.contentPresent === true), 'final provider JSON diagnostics missing');
    const resultEvent = turnEvents.find((event) => event.phase === 'result');
    assert.ok(resultEvent?.detail.length > 20_000, 'long structured reply must cross the former 20k truncation boundary');
    assert.equal(JSON.parse(resultEvent.detail).schemaVersion, 'xiazhi.reply.v2', 'persisted sidecar result must remain valid JSON');
    console.log(JSON.stringify({ ok: true, cases: 18, initialSchemaBound: true, dynamicSchemaRoundTrip: true, modelMaxTokens, longResultChars: resultEvent.detail.length, longResultJsonValid: true, hostReviewCount: hostRequests, modelRoundCount: modelRequests, terminal: done.status }));
  } finally {
    try { await request('shutdown', {}); } catch { /* process may already be terminal */ }
    child.kill();
    lines.close();
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
