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
  turnId: 'agent-tool-call-smoke',
  capability: 'chat',
  prompt: '请查询不存在学生的错题概况，并说明工具结果。',
  context: {
    language: 'zh',
    dryRun: true,
    hostToolAuto: { toolName: 'resolve_student_reference', arguments: { studentName: '不存在的学生' } },
  },
  budgets: { maxEvents: 32, maxWallMs: 120000 },
} });

const lines = createInterface({ input: child.stdout });
for await (const line of lines) {
  const payload = JSON.parse(line);
  output.push(payload);
  if (payload.type === 'host_tool_request') {
    send({ type: 'host_tool_result', result: {
      schemaVersion: 'xiazhi.host_tool.result.v1',
      requestId: payload.request.requestId,
      turnId: payload.request.turnId,
      status: 'blocked',
      review: { ok: false, reason: 'adversarial policy denial', errors: ['student_not_found'] },
      modelResult: { ok: false, reason: 'student_not_found' },
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
assert(events.some((event) => event.phase === 'tool' && event.publicSummary?.argsPresent === true), 'AgentLoop native tool_call was not emitted');
assert(events.some((event) => event.phase === 'tool_request' && event.publicSummary?.source === 'agent_loop'), 'agent_loop host request boundary missing');
assert(events.some((event) => event.phase === 'tool_result' && event.publicSummary?.source === 'agent_loop' && event.publicSummary?.status === 'blocked'), `blocked agent_loop tool result missing: ${JSON.stringify(events)}`);
assert(events.at(-1)?.phase === 'done', 'agent tool-call turn did not end');
assert(events.every((event, index) => event.sequence === index + 1), 'agent tool-call sequence is not contiguous');
console.log(JSON.stringify({ ok: true, eventCount: events.length, nativeToolCall: true, blockedByHost: true }));
