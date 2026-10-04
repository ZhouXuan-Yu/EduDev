import './register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolveCodexRuntime } from './codex-runtime.mjs';
const { OfficeAppServerConnection } = await import('../../src/main/office-agent/app-server-connection.ts');
const { validateOfficeStartTurn, validateOfficeInterrupt, validateOfficeResolveApproval } = await import('../../src/main/office-agent/host-command-validation.ts');
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = fs.mkdtempSync(path.join(appRoot, 'test-results/office-plan/host-connection-'));
const cwd = path.join(output, 'workspace'), home = path.join(output, 'runtime'); fs.mkdirSync(cwd); fs.mkdirSync(home);
const childEnv = Object.fromEntries(Object.entries(process.env).filter(([key]) => /^(PATH|PATHEXT|SYSTEMROOT|WINDIR|TEMP|TMP|APPDATA|LOCALAPPDATA|USERPROFILE|HOMEDRIVE|HOMEPATH|COMSPEC|PROCESSOR_ARCHITECTURE)$/i.test(key)));
Object.assign(childEnv, { CODEX_HOME: home, UNRELATED_SECRET: 'PRIVATE-ENV-SENTINEL' });
const clients = [], checks = [], notifications = [];
const report = { suite: 'office-host-connection', success: false, checks,
  boundaries: ['Actual owned native app-server, no provider call', 'Explicit private transport fault injection for timeout/late-frame/malformed-line/tool wait', 'No SQLite/IPC/UI or OS sandbox claim'] };
const create = extra => {
  const client = new OfficeAppServerConnection({ binaryPath: resolveCodexRuntime().binaryPath, cwd, env: childEnv,
    requestTimeoutMs: 5000, maxPending: 2, onNotification: message => notifications.push(message), ...extra });
  clients.push(client); return client;
};
const fails = async (promise, code) => {
  const error = await promise.then(() => null, error => error);
  assert(error && error.code === code, `Expected ${code}; got ${error?.code}`); return error;
};
try {
  const request = { commandId: 'command-1', sessionId: 'session-1', prompt: '整理教研会议纪要', attachmentIds: ['file-1'] };
  const validated = validateOfficeStartTurn(request); assert(validated.ok && Object.isFrozen(validated.value));
  request.prompt = 'CHANGED'; assert.equal(validated.value.prompt, '整理教研会议纪要');
  for (const input of [{ ...request, prompt: '' }, { ...request, prompt: 'x'.repeat(32769) },
    { ...request, model: 'renderer-override' }, { ...request, attachmentIds: ['file-1', 'file-1'] }]) assert.equal(validateOfficeStartTurn(input).ok, false);
  let getter = 0; assert.equal(validateOfficeStartTurn(Object.defineProperty({}, 'prompt', { enumerable: true, get() { getter++; return 'unsafe'; } })).ok, false); assert.equal(getter, 0);
  assert(validateOfficeInterrupt({ commandId: 'c', sessionId: 's', runId: 'r' }).ok);
  assert(!validateOfficeInterrupt({ commandId: 'c', sessionId: 's', runId: '../private' }).ok);
  for (const decision of [true, ['accept'], 'approve']) assert(!validateOfficeResolveApproval({ commandId: 'c', sessionId: 's', runId: 'r', approvalId: 'a', decision }).ok);
  assert(validateOfficeResolveApproval({ commandId: 'c', sessionId: 's', runId: 'r', approvalId: 'a', decision: 'decline' }).ok);
  checks.push({ name: 'command-snapshot-boundaries', pass: true });
  const client = create();
  await fails(client.request('thread/read', { threadId: 'missing', includeTurns: true }), 'closed');
  const initializing = client.connect(); await Promise.all([initializing, client.connect()]);
  assert.equal(client.diagnostics.phase, 'ready'); assert(Number.isSafeInteger(client.diagnostics.ownedPid));
  assert.equal(client.raw.options.env.UNRELATED_SECRET, undefined);
  assert.equal(client.raw.options.env.CODEX_HOME, home);
  checks.push({ name: 'real-native-handshake-single-connection-and-private-env', pass: true });
  const notFound = await fails(client.request('thread/read', { threadId: 'not-a-real-thread', includeTurns: true }), 'protocol');
  assert(!JSON.stringify(notFound).includes('PRIVATE-ENV-SENTINEL')); assert.equal(client.diagnostics.pending, 0);
  checks.push({ name: 'real-rpc-error-no-private-details-and-clean-pending', pass: true });
  // Synthetic transport faults only: suppress read-only outbound frames.
  const rawSend = client.raw.sendMessage.bind(client.raw), rawNext = client.raw.nextId;
  await fails(client.request('thread/read', { threadId: 'invalid-timeout', includeTurns: true }, NaN), 'protocol');
  assert.equal(client.raw.nextId, rawNext); assert.equal(client.diagnostics.pending, 0);
  client.raw.sendMessage = () => {};
  const one = client.request('thread/read', { threadId: 'dropped-one', includeTurns: true }, 30);
  const two = client.request('thread/read', { threadId: 'dropped-two', includeTurns: true }, 30);
  await fails(client.request('thread/read', { threadId: 'over-limit', includeTurns: true }), 'busy');
  assert.equal(client.diagnostics.pending, 2);
  await Promise.all([fails(one, 'timeout'), fails(two, 'timeout')]); assert.equal(client.diagnostics.pending, 0);
  client.raw.handleLine(JSON.stringify({ id: rawNext, result: { private: 'LATE-RESULT-SENTINEL' } }));
  assert.equal(client.diagnostics.pending, 0); assert(!JSON.stringify(notifications).includes('LATE-RESULT-SENTINEL'));
  client.raw.sendMessage = rawSend;
  checks.push({ name: 'bounded-pending-timeout-and-late-response-discard', pass: true });
  client.raw.handleLine(JSON.stringify({ method: 'item/reasoning/textDelta', params: { delta: 'PRIVATE-REASONING-SENTINEL' } }));
  client.raw.handleLine(JSON.stringify({ method: 'item/completed', params: { item: { type: 'reasoning', content: 'PRIVATE-REASONING-SENTINEL' } } }));
  assert(!JSON.stringify(notifications).includes('PRIVATE-REASONING-SENTINEL'));
  checks.push({ name: 'private-reasoning-not-forwarded', pass: true });
  await Promise.all([client.close(), client.close()]); assert.equal(client.diagnostics.phase, 'closed');
  await fails(client.connect(), 'closed'); await fails(client.request('thread/read', { threadId: 'old', includeTurns: true }), 'closed');
  checks.push({ name: 'idempotent-close-no-reconnect-or-old-request', pass: true });
  let resolveTool, reached, toolSignal;
  const readyTool = new Promise(resolve => reached = resolve);
  const tools = create({ onServerRequest: (_request, signal) => {
    toolSignal = signal; reached(); return new Promise(resolve => resolveTool = resolve);
  } });
  await tools.connect();
  tools.raw.handleLine(JSON.stringify({ id: 'synthetic-tool', method: 'item/tool/call', params: { turnId: 'test-turn', tool: 'office_copy_file', arguments: {} } }));
  await readyTool; assert.equal(tools.diagnostics.serverRequests, 1);
  tools.raw.handleLine(JSON.stringify({ method: 'turn/completed', params: { turn: { id: 'test-turn', status: 'interrupted' } } }));
  assert.equal(toolSignal.aborted, true); resolveTool({ result: { success: true, contentItems: [] } });
  await new Promise(resolve => setImmediate(resolve)); assert.equal(tools.diagnostics.serverRequests, 0);
  checks.push({ name: 'terminal-turn-aborts-outstanding-tool-handler', pass: true });
  await tools.close();
  let disconnected = 0;
  const dying = create({ onDisconnect: () => disconnected++ }); await dying.connect();
  const ownedPid = dying.diagnostics.ownedPid;
  spawnSync('taskkill', ['/PID', String(ownedPid), '/T', '/F'], { windowsHide: true, timeout: 5000 });
  await dying.raw.exitPromise; await dying.close();
  assert.equal(disconnected, 1); assert.equal(dying.diagnostics.phase, 'closed');
  await fails(dying.connect(), 'closed');
  checks.push({ name: 'actual-owned-process-death-no-autorestart', pass: true });
  const malformed = create(); await malformed.connect();
  malformed.raw.handleLine('PRIVATE-INVALID-LINE-SENTINEL');
  await malformed.close(); assert.equal(malformed.diagnostics.phase, 'closed');
  assert(!JSON.stringify(notifications).includes('PRIVATE-INVALID-LINE-SENTINEL'));
  checks.push({ name: 'malformed-frame-disconnect-without-content-leak', pass: true });
  report.success = true;
} catch (error) { report.failure = String(error.stack).slice(0, 3500); process.exitCode = 1; }
finally {
  for (const client of clients) await client.close().catch(() => {});
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  if (process.versions.electron) globalThis.officeConnectionHostReport = { ...report, electron: process.versions.electron,
    node: process.versions.node, reportPath: path.join(output, 'report.json') };
  console.log(JSON.stringify({ suite: report.suite, success: report.success, passed: checks.length, report: path.relative(appRoot, path.join(output, 'report.json')), failure: report.failure }));
}
