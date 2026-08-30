import { spawn } from 'node:child_process';
import { createInterface } from 'node:readline';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const python = process.env.OMNI_EDU_PYTHON ?? (existsSync('C:\\Python314\\python.exe') ? 'C:\\Python314\\python.exe' : 'py');
const args = python.toLowerCase().endsWith('py.exe') ? ['-3', '-m', 'omni_edu_deeptutor_bridge'] : ['-m', 'omni_edu_deeptutor_bridge'];
const child = spawn(python, args, {
  cwd: repoRoot,
  env: { ...process.env, PYTHONPATH: join(repoRoot, 'python') },
  stdio: ['pipe', 'pipe', 'pipe'],
  windowsHide: true,
});
const output = [];
const send = (payload) => child.stdin.write(`${JSON.stringify(payload)}\n`);
send({ type: 'request', id: 'start', method: 'start_turn', params: {
  turnId: 'model-proxy-smoke',
  capability: 'chat',
  prompt: '请用一句话确认宿主模型边界。',
  context: { language: 'zh', modelProxy: 'deepseek' },
  budgets: { maxEvents: 24, maxWallMs: 120000 },
} });

const lines = createInterface({ input: child.stdout });
for await (const line of lines) {
  const payload = JSON.parse(line);
  output.push(payload);
  if (payload.type === 'model_request') {
    const serialized = JSON.stringify(payload);
    if (/apiKey|DEEPSEEK_API_KEY|sk-[A-Za-z0-9]/i.test(serialized)) throw new Error('model request leaked a provider credential');
    if (payload.request.schemaVersion !== 'xiazhi.model.request.v1') throw new Error('model request schema mismatch');
    send({ type: 'model_result', result: {
      schemaVersion: 'xiazhi.model.result.v1',
      requestId: payload.request.requestId,
      turnId: payload.request.turnId,
      status: 'succeeded',
      response: {
        choices: [{ message: { content: '宿主模型已返回安全 completion。', tool_calls: [] }, finish_reason: 'stop' }],
        usage: { prompt_tokens: 12, completion_tokens: 8, total_tokens: 20 },
      },
    } });
  }
  if (payload.type === 'event' && payload.event?.phase === 'done') {
    send({ type: 'request', id: 'shutdown', method: 'shutdown', params: {} });
    child.stdin.end();
    break;
  }
}
await new Promise((resolveExit) => child.once('exit', resolveExit));
const events = output.filter((item) => item.type === 'event').map((item) => item.event);
const assert = (condition, message) => { if (!condition) throw new Error(message); };
assert(output.some((item) => item.type === 'model_request'), 'host model request missing');
assert(events.some((event) => event.phase === 'stage' && event.publicSummary?.provider === 'host_model' && event.status === 'awaiting_host'), 'model waiting stage missing');
assert(events.some((event) => event.phase === 'stage' && event.publicSummary?.provider === 'host_model' && event.status === 'running'), 'model result stage missing');
assert(events.some((event) => event.phase === 'result' && event.detail.includes('宿主模型已返回安全 completion')), 'host model result was not consumed by AgentLoop');
assert(events.at(-1)?.phase === 'done' && events.at(-1)?.status === 'succeeded', 'model proxy turn did not succeed');
assert(events.every((event, index) => event.sequence === index + 1), 'model proxy event sequence is not contiguous');
console.log(JSON.stringify({ ok: true, eventCount: events.length, modelProxyRoundTrip: true, credentialRedacted: true }));
