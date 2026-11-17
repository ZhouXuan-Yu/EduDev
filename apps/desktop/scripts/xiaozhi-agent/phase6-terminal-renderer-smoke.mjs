import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

const output = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-terminal-renderer-'));
const desktop = path.resolve(import.meta.dirname, '../..');
const report = {success: false, output, checks: [],
  boundary: 'Actual React/HeroUI renderer in JSDOM with a typed synthetic bridge and explicit xterm adapter fixture. No Electron/native terminal/provider/real credentials or Goal budget.'};
const channels = new Set(), nativeChannel = globalThis.MessageChannel;
let React, act, createRoot, TerminalConsole, TerminalJobs, splitInput, mergeJob, root, dom;
const listeners = new Set();
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};};
const terminal = {version: 1, shell: 'powershell', command: 'synthetic terminal', cwd: 'owned-workspace', output: '', state: 'running', truncated: false};
const job = {schemaVersion: 1, jobId: 'term_fixture', sessionId: 'session_A', taskId: 'task_fixture', revision: 1, controllerRevision: 5, leaseRevision: 7,
  controller: 'teacher', terminal, tty: true, background: true, createdAt: '2026-11-17T00:00:00Z', outputSequence: 0,
  inputSequence: 0, acknowledgedInputSequence: 0, cleanup: 'pending', controls: {write: true, eof: true, resize: true, closeInput: true, close: true, takeControl: true}, inputMaxBytes: 8};
const ok = data => ({ok: true, data});
function bridge(patch = {}) {
  listeners.clear();
  window.omniEdu = {listXiaozhiTerminals: async sessionId => ok({sessionId, jobs: []}),
    readXiaozhiTerminal: async input => ok({sessionId: input.sessionId, job: {...job, sessionId: input.sessionId, jobId: input.jobId}, sequence: 0, reset: false, output: '', hasMore: false}),
    resizeXiaozhiTerminal: async input => ok({...job, sessionId: input.sessionId, jobId: input.jobId}),
    onXiaozhiTerminal: callback => {listeners.add(callback); return () => listeners.delete(callback);}, ...patch};
}
async function settle(action = async () => {}) {await act(async () => {await action(); await delay(8);});}
async function mount(component, props) {
  await settle(async () => {root?.unmount(); document.body.innerHTML = '<div id="root"></div>'; root = createRoot(document.getElementById('root')); root.render(React.createElement(component, props));});
}
const element = id => document.querySelector(`[data-testid="${id}"]`);
async function click(id) {assert(element(id), 'missing control ' + id); await settle(async () => element(id).click());}
async function type(value) {
  await settle(async () => {const target = element('terminal-input'); Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(target, value);
    target.dispatchEvent(new window.Event('input', {bubbles: true}));});
}
async function check(name, work) {
  try {await work(); report.checks.push({name, pass: true});}
  catch (error) {report.checks.push({name, pass: false, error: error.stack});}
  console.log(JSON.stringify(report.checks.at(-1)));
}
try {
  const entry = path.join(output, 'entry.tsx');
  fs.writeFileSync(entry, `export {default as React,act} from 'react';export {createRoot} from 'react-dom/client';
export {TerminalConsole} from ${JSON.stringify(path.join(desktop, 'src/renderer/components/office/terminal/TerminalConsole.tsx'))};
export {TerminalJobs} from ${JSON.stringify(path.join(desktop, 'src/renderer/components/office/terminal/TerminalJobs.tsx'))};
export {splitInput,mergeJob} from ${JSON.stringify(path.join(desktop, 'src/renderer/components/office/terminal/terminalState.ts'))};`);
  const bundle = path.join(output, 'components.cjs');
  await build({entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'cjs', target: 'node24', jsx: 'automatic',
    nodePaths: [path.join(desktop, 'node_modules')], loader: {'.css': 'empty'}, logLevel: 'silent', plugins: [{name: 'explicit-xterm-fixture', setup(builder) {
      builder.onResolve({filter: /^@xterm\/(xterm|addon-fit)$/}, args => ({path: args.path, namespace: 'terminal-fixture'}));
      builder.onLoad({filter: /.*/, namespace: 'terminal-fixture'}, args => ({loader: 'js', contents: args.path.endsWith('addon-fit')
        ? 'export class FitAddon {fit(){}}'
        : `export class Terminal {constructor(options){this.options=options;this.cols=80;this.rows=12;this.text='';(globalThis.terminalFixtureViews??=[]).push(this)}
loadAddon(){}open(host){this.host=host}onData(callback){this.input=callback;return{dispose(){}}}write(text,done){this.text+=text;queueMicrotask(()=>done?.())}
reset(){this.text=''}dispose(){this.disposed=true}emitData(text){this.input?.(text)}}` }));
    }}]});
  dom = new JSDOM('<html><body></body></html>', {url: 'http://localhost/', pretendToBeVisual: true});
  for (const name of ['window', 'document', 'Element', 'Node', 'Document', 'DocumentFragment', 'ShadowRoot', 'NodeFilter', 'MutationObserver',
    'Event', 'MouseEvent', 'KeyboardEvent', 'CustomEvent', 'PointerEvent', ...Object.getOwnPropertyNames(dom.window).filter(name => /^(HTML|SVG).*Element$/.test(name))]) {
    if (dom.window[name]) globalThis[name] = dom.window[name];
  }
  Object.defineProperty(globalThis, 'navigator', {configurable: true, value: dom.window.navigator});
  Object.defineProperty(window.HTMLElement.prototype, 'offsetWidth', {configurable: true, get: () => 640});
  if (nativeChannel) globalThis.MessageChannel = class extends nativeChannel {constructor() {super(); channels.add(this);}};
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 1); globalThis.cancelAnimationFrame = clearTimeout;
  globalThis.CSS = window.CSS || {escape: value => value};
  window.HTMLElement.prototype.scrollIntoView = function() {};
  window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}});
  globalThis.ResizeObserver = class {constructor(callback) {this.callback = callback;} observe() {this.callback([]);} disconnect() {} unobserve() {}};
  globalThis.IntersectionObserver = class {constructor(callback) {this.callback = callback;} observe(target) {this.callback([{target, isIntersecting: true, intersectionRatio: 1}]);} disconnect() {}};
  Object.defineProperty(document, 'visibilityState', {configurable: true, value: 'visible'});
  ({React, act, createRoot, TerminalConsole, TerminalJobs, splitInput, mergeJob} = createRequire(import.meta.url)(bundle));

  await check('List has loading empty mapped-error retry and selected-session fencing', async () => {
    const old = deferred(); bridge({listXiaozhiTerminals: sessionId => sessionId === 'session_A' ? old.promise : Promise.resolve(ok({sessionId, jobs: []}))});
    await mount(TerminalJobs, {sessionId: 'session_A'}); assert(document.body.textContent.includes('正在读取'));
    await settle(async () => root.render(React.createElement(TerminalJobs, {sessionId: 'session_B'})));
    await settle(async () => old.resolve(ok({sessionId: 'session_A', jobs: [job]})));
    await click('terminal-jobs-toggle'); assert(document.body.textContent.includes('暂无终端')); assert(!document.body.textContent.includes('synthetic terminal'));
    window.omniEdu.listXiaozhiTerminals = async () => ({ok: false, error: 'revoked'}); await click('terminal-jobs-refresh');
    assert(document.body.textContent.includes('授权已撤销'));
  });
  await check('Legacy output stays readonly and an exact main jobId unlocks only main-projected idle controls', async () => {
    let reads = 0; bridge({readXiaozhiTerminal: async input => {reads++; return ok({sessionId: input.sessionId, job, sequence: 0, reset: false, output: '', hasMore: false});}});
    await mount(TerminalConsole, {sessionId: 'session_A', initial: {...terminal, output: 'legacy result'}});
    assert(document.body.textContent.includes('legacy result')); assert.equal(reads, 0); assert(!element('terminal-input'));
    await mount(TerminalConsole, {sessionId: 'session_A', initial: {...terminal, jobId: job.jobId}});
    assert(reads > 0); assert(element('terminal-input')); assert(!element('terminal-close').disabled); assert(!element('terminal-eof').disabled);
  });
  await check('Output cursor reset and Unicode ANSI append never become input business CAS revisions', async () => {
    const inputs = []; let revision = 0;
    bridge({readXiaozhiTerminal: async input => {inputs.push(input); return ok({sessionId: 'session_A', job: {...job, outputSequence: ++revision * 20},
      sequence: revision * 20, reset: revision === 1, output: revision === 1 ? 'first\r\n' : '\u001b[32m中文🙂\u001b[0m', hasMore: false});},
      writeXiaozhiTerminal: async input => {inputs.push(input); return ok({job, ack: {jobId: job.jobId, commandId: input.commandId, sequence: 1, state: 'acknowledged'}});}});
    await mount(TerminalConsole, {sessionId: 'session_A', job}); assert.equal(inputs.length, 1);
    assert(globalThis.terminalFixtureViews.at(-1).text.includes('first')); await click('terminal-refresh');
    await type('x'); await click('terminal-send'); await settle(async () => delay(70));
    const write = inputs.find(item => item.chars); assert.equal(write.expectedRevision, 1); assert.equal(write.expectedControllerRevision, 5); assert.equal(write.expectedLeaseRevision, 7);
    assert(inputs.some(item => item.sinceSequence === 20));
    const view = globalThis.terminalFixtureViews.at(-1); assert(view.text.includes('中文🙂')); assert(view.text.includes('\u001b[32m'));
    const closed = {...job, revision: 4, outputSequence: 40, terminal: {...terminal, state: 'completed', exitCode: 0}};
    const merged = mergeJob(closed, {...job, outputSequence: 41, terminal: {...terminal, output: 'late output'}});
    assert.equal(merged.terminal.state, 'completed'); assert.equal(merged.terminal.output, 'late output'); assert.equal(merged.revision, 4);
  });
  await check('UTF8 chunks serialize actual ACKs with bounded pending input and exact fresh command refs', async () => {
    assert.deepEqual(splitInput('中🙂ab', 4), ['中', '🙂', 'ab']);
    const first = deferred(), calls = []; let active = 0, maximum = 0;
    bridge({writeXiaozhiTerminal: async input => {calls.push(input); maximum = Math.max(maximum, ++active);
      if (calls.length === 1) await first.promise; active--;
      return ok({job: {...job, revision: calls.length + 1, inputSequence: calls.length, acknowledgedInputSequence: calls.length},
        ack: {jobId: job.jobId, commandId: input.commandId, sequence: calls.length, state: 'acknowledged'}});}});
    await mount(TerminalConsole, {sessionId: 'session_A', job}); await type('中文🙂abc'); await click('terminal-send'); await settle(async () => delay(70));
    assert.equal(calls.length, 1); await settle(async () => first.resolve()); await settle(async () => delay(80));
    assert.equal(maximum, 1); assert.equal(calls.map(input => input.chars).join(''), '中文🙂abc\r');
    assert(calls.every(input => new TextEncoder().encode(input.chars).length <= 8)); assert.equal(new Set(calls.map(input => input.commandId)).size, calls.length);
    assert(calls.every(input => /^xicmd_[a-f0-9-]{36}$/i.test(input.commandId)));
  });
  await check('Unknown ACK pauses input and exact command readback confirms without retransmitting that command', async () => {
    const calls = [], reads = []; let mode = 'initial', unknownCommand;
    bridge({readXiaozhiTerminal: async input => {reads.push(input); return ok({sessionId: 'session_A', job, sequence: 0, reset: false, output: '', hasMore: false,
      ...(mode === 'initial' ? {} : {ack: {jobId: job.jobId, commandId: mode === 'wrong' ? 'xicmd_wrong' : unknownCommand, sequence: 1, state: 'acknowledged'}})});},
      writeXiaozhiTerminal: async input => {calls.push(input); unknownCommand ??= input.commandId;
        return ok({job, ack: {jobId: job.jobId, commandId: input.commandId, sequence: calls.length, state: calls.length === 1 ? 'unknown' : 'acknowledged'}});}});
    await mount(TerminalConsole, {sessionId: 'session_A', job}); await type('123456789'); await click('terminal-send'); await settle(async () => delay(70));
    assert.equal(calls.length, 1); assert(document.body.textContent.includes('请勿重复发送'));
    mode = 'wrong'; await click('terminal-refresh'); assert.equal(calls.length, 1);
    mode = 'confirmed'; await click('terminal-refresh'); await settle(async () => delay(70));
    assert(reads.some(input => input.commandId === unknownCommand)); assert.equal(calls.length, 2);
    assert.notEqual(calls[0].commandId, calls[1].commandId); assert.equal(calls[0].chars, '12345678'); assert.equal(calls[1].chars, '9\r');
    const late = deferred(), noSequenceCalls = []; let commandAck;
    bridge({writeXiaozhiTerminal: input => {noSequenceCalls.push(input); return late.promise;}, readXiaozhiTerminal: async input => ok({sessionId: 'session_A', job,
      sequence: 0, reset: false, output: '', hasMore: false, ...(commandAck ? {ack: {jobId: job.jobId, commandId: commandAck, sequence: 1, state: 'acknowledged'}} : {})})});
    const nativeTimeout = globalThis.setTimeout;
    globalThis.setTimeout = (callback, milliseconds, ...args) => nativeTimeout(callback, milliseconds === 10000 ? 25 : milliseconds, ...args);
    try {
      await mount(TerminalConsole, {sessionId: 'session_A', job}); await type('x'); await click('terminal-send'); await settle(async () => delay(100));
      assert(element('terminal-unknown-input')); assert.equal(noSequenceCalls.length, 1); commandAck = noSequenceCalls[0].commandId;
      await click('terminal-refresh'); assert(!element('terminal-unknown-input'));
      await settle(async () => late.resolve(ok({job: {...job, notice: 'expired'}, ack: {jobId: job.jobId, commandId: commandAck, sequence: 1, state: 'acknowledged'}})));
      assert(!document.body.textContent.includes('期限已结束')); assert.equal(noSequenceCalls.length, 1);
    } finally {globalThis.setTimeout = nativeTimeout;}
  });
  await check('Late old-session input and output cannot replace the new job or flush queued old input after unmount', async () => {
    const writing = deferred(), calls = [];
    bridge({writeXiaozhiTerminal: input => {calls.push(input); return writing.promise;}});
    await mount(TerminalConsole, {sessionId: 'session_A', job}); await type('123456789'); await click('terminal-send'); await settle(async () => delay(70));
    await mount(TerminalConsole, {sessionId: 'session_B', initial: {...terminal, output: 'B readonly'}});
    await settle(async () => writing.resolve(ok({job, ack: {jobId: job.jobId, commandId: calls[0].commandId, sequence: 1, state: 'acknowledged'}})));
    await settle(async () => delay(70)); assert.equal(calls.length, 1); assert(document.body.textContent.includes('B readonly')); assert(!element('terminal-input'));
    const takeover = deferred(), ownedCalls = []; let truth = job;
    bridge({readXiaozhiTerminal: async () => ok({sessionId: 'session_A', job: truth, sequence: 0, reset: false, output: '', hasMore: false}),
      writeXiaozhiTerminal: input => {ownedCalls.push(input); return takeover.promise;}});
    await mount(TerminalConsole, {sessionId: 'session_A', job}); await type('123456789'); await click('terminal-send'); await settle(async () => delay(70));
    truth = {...job, controllerRevision: 6, leaseRevision: 8, controls: {...job.controls, write: false}};
    await settle(async () => {for (const listener of listeners) listener({sessionId: 'session_A', job: truth});});
    await settle(async () => takeover.resolve(ok({job, ack: {jobId: job.jobId, commandId: ownedCalls[0].commandId, sequence: 1, state: 'acknowledged'}})));
    await settle(async () => delay(80)); assert.equal(ownedCalls.length, 1); assert(element('terminal-input').disabled);
    assert(document.body.textContent.includes('尚未发送的输入已停止'));
  });
  await check('Ctrl C EOF resize take-control and stop use their exact typed actions with main revisions', async () => {
    const calls = [], eofs = [];
    const control = async input => {calls.push(input); return ok(job);};
    bridge({writeXiaozhiTerminal: async input => {calls.push(input); return ok({job, ack: {jobId: job.jobId, commandId: input.commandId, sequence: 1, state: 'acknowledged'}});},
      sendEofXiaozhiTerminal: async input => {eofs.push(input); return ok({job, ack: {jobId: job.jobId, commandId: input.commandId, sequence: 2, state: 'acknowledged'}});},
      resizeXiaozhiTerminal: control, closeInputXiaozhiTerminal: control, takeControlXiaozhiTerminal: control, closeXiaozhiTerminal: control});
    await mount(TerminalConsole, {sessionId: 'session_A', job}); await click('terminal-interrupt'); await settle(async () => delay(70));
    await click('terminal-eof'); await settle(async () => delay(70)); await click('terminal-input-close'); await click('terminal-take-control'); await click('terminal-close'); await settle(async () => delay(130));
    assert.equal(eofs.length, 1); assert(!Object.hasOwn(eofs[0], 'chars'));
    assert(calls.some(input => input.chars === '\u0003')); assert(calls.some(input => input.cols === 80 && input.rows === 12));
    assert(calls.every(input => input.expectedRevision === 1 && input.expectedControllerRevision === 5 && input.expectedLeaseRevision === 7));
  });
  await check('Expiry revocation and reset failures remain visible and mutation controls obey the returned view', async () => {
    const closed = {...job, controls: {write: false, eof: false, resize: false, closeInput: false, close: false, takeControl: false}, notice: 'expired', cleanup: 'needs_check'};
    bridge({readXiaozhiTerminal: async () => ok({sessionId: 'session_A', job: closed, sequence: 4, reset: true, output: 'retained output', hasMore: false})});
    await mount(TerminalConsole, {sessionId: 'session_A', job: closed}); assert(document.body.textContent.includes('期限已结束'));
    assert(element('terminal-send').disabled); assert(element('terminal-close').disabled); assert(document.body.textContent.includes('清理'));
    window.omniEdu.readXiaozhiTerminal = async () => ({ok: false, error: 'source_changed'}); await click('terminal-refresh');
    assert(document.body.textContent.includes('工作目录已变化'));
  });
  await check('A later failed close remains visible after the earlier pending input receives its exact ACK', async () => {
    const writing = deferred(), calls = []; let reads = 0;
    bridge({writeXiaozhiTerminal: input => {calls.push(input); return writing.promise;},
      readXiaozhiTerminal: async () => {reads++; return ok({sessionId: 'session_A', job, sequence: 0, reset: false, output: '', hasMore: false});},
      closeXiaozhiTerminal: async () => ({ok: false, error: 'permission_denied'})});
    await mount(TerminalConsole, {sessionId: 'session_A', job});
    await type('x'); await click('terminal-send'); await settle(async () => delay(70));
    assert.equal(calls.length, 1); assert.equal(element('terminal-close').disabled, false);
    await click('terminal-close');
    report.errorOrderingProbe = {beforeAck: element('terminal-error')?.textContent || '', writeCalls: calls.length};
    assert(report.errorOrderingProbe.beforeAck.includes('没有此终端操作的授权'));
    await settle(async () => writing.resolve(ok({job, ack: {jobId: job.jobId, commandId: calls[0].commandId, sequence: 1, state: 'acknowledged'}})));
    report.errorOrderingProbe.afterAck = element('terminal-error')?.textContent || '';
    assert(report.errorOrderingProbe.afterAck.includes('没有此终端操作的授权'), 'Earlier input ACK erased the later close failure');
    const beforePoll = reads; await settle(async () => delay(1300));
    report.errorOrderingProbe.afterPoll = element('terminal-error')?.textContent || '';
    assert(reads > beforePoll); assert(report.errorOrderingProbe.afterPoll.includes('没有此终端操作的授权'));
    window.omniEdu.closeXiaozhiTerminal = async () => ok(job); await click('terminal-close');
    report.errorOrderingProbe.afterExplicitRetry = element('terminal-error')?.textContent || '';
    assert.equal(report.errorOrderingProbe.afterExplicitRetry, ''); assert.equal(calls.length, 1);
  });
  report.success = report.checks.length === 9 && report.checks.every(item => item.pass);
} catch (error) {report.error = error.stack;}
finally {
  if (root && act) await settle(async () => root.unmount());
  dom?.window.close(); for (const channel of channels) {channel.port1.close(); channel.port2.close();}
  globalThis.MessageChannel = nativeChannel;
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: report.checks.filter(item => item.pass).length, total: report.checks.length, output, error: report.error}));
  if (!report.success) process.exitCode = 1;
}
