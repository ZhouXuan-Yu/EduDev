import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-conpty-protocol-'));
await build({stdin: {contents: "export {createControlledTerminalBackend} from './src/main/xiaozhi-agent/terminal/controlled-backend.ts';",
  resolveDir: process.cwd(), loader: 'ts'}, outfile: path.join(root, 'backend.mjs'), bundle: true, platform: 'node', format: 'esm', target: 'node24'});
const {createControlledTerminalBackend} = await import(pathToFileURL(path.join(root, 'backend.mjs')).href);
const report = {success: false, root, evidence: 'injected-launch protocol fixtures, native NOT_RUN', paidCalls: 0, checks: []};
const result = {result: {state: 'completed', exitCode: 0, cleanup: {jobActiveProcesses: 0, profileRemoved: true, remainingOwnedAces: 0}},
  started: true, helperHash: 'a'.repeat(64), outputBytes: 0};
function deferred() {
  let resolve, reject;
  const promise = new Promise((yes, no) => {resolve = yes; reject = no;});
  return {promise, resolve, reject};
}
async function fixture() {
  const lifetime = deferred(), input = [], resize = [], bytes = [];
  let callbacks, launches = 0, closes = 0;
  const controller = new AbortController();
  const handle = createControlledTerminalBackend({controller, onData: chunk => bytes.push(chunk), launch(value) {
    callbacks = value; launches++; return lifetime.promise;
  }});
  await Promise.resolve();
  const port = {writeSequenced(value) {const ack = deferred(); input.push({value, ack}); return ack.promise;},
    resize(value) {const ack = deferred(); resize.push({value, ack}); return ack.promise;}, close() {closes++;}};
  return {handle, callbacks, controller, input, resize, bytes, closes: () => closes, launches: () => launches,
    start() {callbacks.onSession(port); callbacks.onStarted(123, 456);}, finish: () => lifetime.resolve(result), fail: error => lifetime.reject(error)};
}
async function check(name, run) {
  try {await run(); report.checks.push({name, pass: true}); console.log('PASS ' + name);}
  catch (error) {report.checks.push({name, pass: false, error: String(error.stack ?? error)}); throw error;}
}
async function tick() {await new Promise(resolve => setImmediate(resolve));}
try {
  await check('Launch runs once and ready precedes verified child-close completion', async () => {
    const f = await fixture(); let closed = false; void f.handle.closed.then(() => {closed = true;});
    f.start(); assert.deepEqual(await f.handle.ready, {pid: 123, helperPid: 456});
    assert.equal(f.launches(), 1); assert.equal(closed, false); f.finish(); assert.equal(await f.handle.closed, result);
  });
  await check('Raw split Unicode and ANSI bytes are preserved without decoding or retention', async () => {
    const f = await fixture(); f.start(); const bytes = Buffer.from('\x1b[31m中文🙂\x1b[0m');
    for (const chunk of [bytes.subarray(0, 8), bytes.subarray(8, 12), bytes.subarray(12)]) f.callbacks.onBytes('pty', chunk);
    assert.deepEqual(Buffer.concat(f.bytes), bytes); f.finish(); await f.handle.closed;
  });
  await check('Write waits for the exact original port ACK and preserves sequence', async () => {
    const f = await fixture(); f.start(); let acknowledged = false;
    const input = {sequence: 1, bytes: Buffer.from('hello\r')}; const pending = f.handle.write(input).then(value => {acknowledged = true; return value;});
    await tick(); assert.equal(acknowledged, false); assert.equal(f.input[0].value, input);
    f.input[0].ack.resolve({sequence: 1}); assert.deepEqual(await pending, {sequence: 1}); f.finish(); await f.handle.closed;
  });
  await check('Resize awaits the independent control ID acknowledgement', async () => {
    const f = await fixture(); f.start(); const value = {controlId: 'owned-resize-1', cols: 96, rows: 32};
    let resized = false; const pending = f.handle.resize(value).then(() => {resized = true;});
    await tick(); assert.equal(resized, false); assert.equal(f.resize[0].value, value);
    f.resize[0].ack.resolve(); await pending; f.finish(); await f.handle.closed;
  });
  await check('Early EOF is delivered once when the port arrives', async () => {
    const f = await fixture(); f.handle.closeInput(); f.handle.closeInput(); f.start();
    assert.equal(f.closes(), 1); await assert.rejects(f.handle.write({sequence: 1, bytes: Buffer.from('x')}), /input_closed/);
    f.finish(); await f.handle.closed;
  });
  await check('EOF fences a write waiting for startup', async () => {
    const f = await fixture(); const pending = f.handle.write({sequence: 1, bytes: Buffer.from('x')});
    f.handle.closeInput(); f.start(); await assert.rejects(pending, /input_closed/); assert.equal(f.input.length, 0);
    f.finish(); await f.handle.closed;
  });
  await check('Cancellation preserves the exact revoke reason and rejects new controls', async () => {
    const f = await fixture(); f.start(); f.handle.cancel('revoked'); f.handle.cancel('timeout');
    assert.equal(f.controller.signal.reason, 'revoked');
    await assert.rejects(f.handle.write({sequence: 1, bytes: Buffer.from('x')}), error => error === 'revoked');
    f.finish(); await f.handle.closed;
  });
  await check('Verified child close terminates pending write and resize promises', async () => {
    const f = await fixture(); f.start(); const write = f.handle.write({sequence: 1, bytes: Buffer.from('x')});
    const resize = f.handle.resize({controlId: 'owned-resize-2', cols: 80, rows: 24});
    await tick(); const failures = Promise.all([assert.rejects(write, /closed/), assert.rejects(resize, /closed/)]);
    f.finish(); await f.handle.closed; await failures;
  });
  await check('Launch failure reaches closed and settles startup waiters', async () => {
    const f = await fixture(); const failure = Error('source_changed');
    const assertions = Promise.all([assert.rejects(f.handle.closed, error => error === failure), assert.rejects(f.handle.ready, /closed/),
      assert.rejects(f.handle.write({sequence: 1, bytes: Buffer.from('x')}), /closed/)]);
    f.fail(failure); await assertions;
  });
  await check('Duplicate startup and duplicate session callbacks are rejected', async () => {
    const f = await fixture(); f.start(); assert.throws(() => f.callbacks.onStarted(1, 2), /invalid_protocol/);
    assert.throws(() => f.callbacks.onSession({}), /invalid_protocol/); f.finish(); await f.handle.closed;
  });
  await check('Before-start, over-frame and after-close output are rejected', async () => {
    const f = await fixture(); assert.throws(() => f.callbacks.onBytes('pty', Buffer.from('x')), /invalid_protocol/);
    f.start(); assert.throws(() => f.callbacks.onBytes('pty', Buffer.alloc(16385)), /invalid_protocol/);
    f.finish(); await f.handle.closed; assert.throws(() => f.callbacks.onBytes('pty', Buffer.from('x')), /invalid_protocol/);
  });
  await check('Already aborted launch is skipped and all lifecycle promises terminate', async () => {
    const controller = new AbortController(); controller.abort('cancelled'); let launches = 0;
    const handle = createControlledTerminalBackend({controller, onData() {}, async launch() {launches++; return result;}});
    await assert.rejects(handle.closed, error => error === 'cancelled'); await assert.rejects(handle.ready, /closed/); assert.equal(launches, 0);
  });
  report.success = true;
} catch (error) {report.error = String(error.stack ?? error); process.exitCode = 1;}
finally {fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify({root, success: report.success, checks: report.checks.length}));}
