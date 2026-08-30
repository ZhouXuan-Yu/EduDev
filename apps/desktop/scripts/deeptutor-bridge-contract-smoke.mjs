import { spawnSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = resolve(fileURLToPath(new URL('../../..', import.meta.url)));
const pythonRoot = join(repoRoot, 'python');
const requests = [
  { type: 'request', id: 'h1', method: 'handshake', params: {} },
  { type: 'request', id: 'bad1', method: 'start_turn', params: { turnId: 't_bad', capability: 'exec', prompt: 'x' } },
  {
    type: 'request',
    id: 'hold1',
    method: 'start_turn',
    params: {
      turnId: 't_hold',
      capability: 'chat',
      prompt: '测试暂停',
      context: { hold: true },
      budgets: { maxEvents: 8, maxWallMs: 1000 },
    },
  },
  {
    type: 'request',
    id: 'dup1',
    method: 'start_turn',
    params: {
      turnId: 't_hold',
      capability: 'chat',
      prompt: '重复启动',
      context: { hold: true },
      budgets: { maxEvents: 8, maxWallMs: 1000 },
    },
  },
  { type: 'request', id: 'cancel1', method: 'cancel_turn', params: { turnId: 't_hold' } },
  { type: 'request', id: 'cancel2', method: 'cancel_turn', params: { turnId: 't_hold' } },
  {
    type: 'request',
    id: 'normal1',
    method: 'start_turn',
    params: { turnId: 't_normal', capability: 'chat', prompt: '测试正常终态', context: {}, budgets: { maxEvents: 8, maxWallMs: 1000 } },
  },
  {
    type: 'request',
    id: 'solve1',
    method: 'start_turn',
    params: { turnId: 't_solve', capability: 'deep_solve', prompt: '解方程 x+1=2', context: { language: 'zh' }, budgets: { maxEvents: 16, maxWallMs: 120000 } },
  },
  {
    type: 'request',
    id: 'budget1',
    method: 'start_turn',
    params: { turnId: 't_budget', capability: 'chat', prompt: 'budget hard stop', context: {}, budgets: { maxEvents: 1, maxWallMs: 120000 } },
  },
  { type: 'request', id: 'unknown1', method: 'unknown', params: {} },
  { type: 'request', id: 'shutdown1', method: 'shutdown', params: {} },
];

const hugeFrame = JSON.stringify({ type: 'request', id: 'huge', method: 'handshake', params: { padding: 'x'.repeat(1_000_100) } });
const input = [JSON.stringify(requests[0]), '{not-json', hugeFrame, ...requests.slice(1).map((request) => JSON.stringify(request))].join('\n') + '\n';
const configuredPython = process.env.OMNI_EDU_PYTHON;
const detectedWindowsPython = process.platform === 'win32'
  ? ['C:\\Python314\\python.exe', 'D:\\Anaconda\\python.exe', 'C:\\Windows\\py.exe'].find((candidate) => existsSync(candidate))
  : undefined;
const pythonCommand = configuredPython ?? detectedWindowsPython ?? (process.platform === 'win32' ? 'py' : 'python3');
const isWindowsLauncher = process.platform === 'win32' && /(?:^|[\\/])py(?:\.exe)?$/i.test(pythonCommand);
const pythonArgs = configuredPython || !isWindowsLauncher ? ['-m', 'omni_edu_deeptutor_bridge'] : ['-3', '-m', 'omni_edu_deeptutor_bridge'];
const result = spawnSync(pythonCommand, pythonArgs, {
  cwd: repoRoot,
  env: { ...process.env, PYTHONPATH: pythonRoot },
  input,
  encoding: 'utf8',
  maxBuffer: 8 * 1024 * 1024,
  windowsHide: true,
});

if (result.error) throw result.error;
if (result.status !== 0) throw new Error(`sidecar exited with ${result.status}: ${result.stderr}`);
const lines = result.stdout.trim().split(/\r?\n/).filter(Boolean).map((line) => JSON.parse(line));
const responses = new Map(lines.filter((line) => line.type === 'response').map((line) => [line.id, line]));
const errors = lines.filter((line) => line.type === 'error');
const events = lines.filter((line) => line.type === 'event').map((line) => line.event);

const assert = (condition, message) => {
  if (!condition) throw new Error(message);
};
const responseErrorCode = (id) => responses.get(id)?.error?.code;

const manifest = responses.get('h1')?.result?.manifest;
assert(manifest?.schemaVersion === 'xiazhi.capability.manifest.v1', 'manifest schema mismatch');
assert(manifest?.bridgeProtocol === 'xiazhi.bridge.v1', 'bridge protocol mismatch');
assert(manifest?.runtime === 'DeepTutor.AgentLoop', 'DeepTutor runtime was not selected');
assert(manifest?.upstreamCommit === '456f9c24226e008f1ff07a7e3455d7b4d39f6221', 'upstream commit mismatch');
assert(Array.isArray(manifest?.capabilities) && manifest.capabilities.some((item) => item.name === 'chat'), 'chat capability missing');
assert(responseErrorCode('bad1') === 'INVALID_TURN', 'unauthorized capability was not rejected');
assert(responses.get('hold1')?.result?.accepted === true, 'hold turn was not accepted');
assert(responseErrorCode('dup1') === 'TURN_ALREADY_RUNNING', 'duplicate running turn was accepted');
assert(responses.get('cancel1')?.result?.cancelled === true, 'cancel did not report cancellation');
assert(responses.get('cancel2')?.result?.alreadyTerminal === true, 'repeat cancel was not idempotent');
assert(responses.get('normal1')?.result?.accepted === true, 'normal turn was not accepted');
assert(responses.get('budget1')?.result?.accepted === true, 'budget turn was not accepted');
assert(responseErrorCode('unknown1') === 'METHOD_NOT_FOUND', 'unknown method was not rejected');
assert(responses.get('shutdown1')?.result?.stopping === true, 'shutdown did not acknowledge');
assert(errors.some((line) => line.error?.code === 'INVALID_JSON'), 'invalid JSON was not rejected');
assert(errors.some((line) => line.error?.code === 'FRAME_TOO_LARGE'), 'oversized frame was not rejected');

for (const turnId of ['t_hold', 't_normal', 't_solve', 't_budget']) {
  const turnEvents = events.filter((event) => event.turnId === turnId);
  assert(turnEvents.length >= 2, `${turnId} did not emit enough events`);
  assert(turnEvents.every((event, index) => event.sequence === index + 1), `${turnId} event sequence is not contiguous`);
  assert(turnEvents.at(-1).phase === 'done', `${turnId} did not end with done`);
  assert(turnEvents.every((event) => !/<\/?think(?:ing)?\b/i.test(String(event.detail ?? ''))), `${turnId} leaked hidden reasoning markup`);
}
assert(events.find((event) => event.turnId === 't_hold' && event.status === 'cancelled'), 'cancelled done event missing');
assert(events.find((event) => event.turnId === 't_normal' && event.status === 'succeeded'), 'successful done event missing');
assert(events.find((event) => event.turnId === 't_normal' && event.publicSummary?.engine === 'deeptutor-agent-loop'), 'real AgentLoop result event missing');
assert(events.find((event) => event.turnId === 't_solve' && event.publicSummary?.engine === 'deeptutor-agent-loop'), 'real DeepSolve AgentLoop result event missing');
assert(events.find((event) => event.turnId === 't_budget' && event.publicSummary?.terminationReason === 'budget_exhausted' && event.publicSummary?.hardStop === true), 'sidecar budget hard-stop event missing');
const reasoningEvents = events.filter((event) => event.phase === 'reasoning');
assert(reasoningEvents.every((event) => event.publicSummary?.traceOnly === true), 'reasoning event was not marked traceOnly');
assert(reasoningEvents.every((event) => !String(event.detail ?? '').includes('测试正常终态')), 'reasoning event leaked prompt content');

console.log(JSON.stringify({ ok: true, responseCount: responses.size, errorCount: errors.length, eventCount: events.length, adversarial: { contiguousSequences: true, hiddenReasoningRedacted: true } }));
