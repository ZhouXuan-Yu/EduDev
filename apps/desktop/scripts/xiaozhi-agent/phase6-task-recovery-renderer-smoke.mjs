import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {createHash} from 'node:crypto';
import {build} from 'esbuild';
import {JSDOM} from 'jsdom';

const output = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-phase6-task-recovery-renderer-'));
const desktop = path.resolve(import.meta.dirname, '../..');
const sources = ['src/renderer/components/office/PiTaskReview.tsx', 'src/renderer/components/office/PiTaskSteps.tsx',
  'src/renderer/components/office/PiTaskRecovery.tsx', 'scripts/xiaozhi-agent/phase6-task-recovery-renderer-smoke.mjs'];
const hash = file => createHash('sha256').update(fs.readFileSync(path.join(desktop, file))).digest('hex');
const report = {success: false, output, checks: [], bridgeCalls: [],
  boundary: 'Actual React/HeroUI task review/steps components in JSDOM with synthetic typed bridge results. No production Task/SQL, Electron, build output, native helper, model/provider, key, budget or layout acceptance.'};
let root, dom, React, act, createRoot, PiTaskReview, PiTaskSteps, OfficeSynchronization, validTaskView;
const channels = new Set(), NativeMessageChannel = globalThis.MessageChannel;
const delay = milliseconds => new Promise(resolve => setTimeout(resolve, milliseconds));
const deferred = () => {let resolve; const promise = new Promise(done => {resolve = done;}); return {promise, resolve};};
const facets = ['capabilities', 'dependencies', 'permissions', 'risk', 'artifacts', 'recovery'];
const facetLabels = ['可用能力', '运行依赖', '执行权限', '操作风险', '预期产物', '恢复方式'];
const task = (letter = 'a', patch = {}) => ({schema: 'xiaozhi.task.v1', id: 'xitask_' + letter.repeat(64),
  sessionId: letter === 'a' ? 'aisession_11111111-1111-4111-8111-111111111111' : 'aisession_22222222-2222-4222-8222-222222222222',
  revision: 3, requirementsVersion: 1, planRevision: 1, planReason: '合成任务分步核对', state: 'interrupted',
  origin: {messageId: 'aimsg_fixture_' + letter, commandId: 'xicmd_fixture_' + letter, runId: 'run_fixture_' + letter},
  sources: [{messageId: 'aimsg_fixture_' + letter, runId: 'run_fixture_' + letter, version: 'a'.repeat(64)}],
  criteria: [{id: 'teacher_request', version: 1, sourceId: 'aimsg_fixture_' + letter, sourceVersion: 'a'.repeat(64), text: '合成教学要求 ' + letter, kind: 'human'}],
  steps: [{id: 'owned_step', text: '核对合成课堂成果', dependsOn: [], criterionIds: ['teacher_request'], reported: 'pending'}],
  checks: [], binding: null, createdAt: '2026-11-18T00:00:00.000Z', updatedAt: '2026-11-18T00:00:00.000Z', ...patch});
const planning = (level, patch = {}) => {
  const states = patch.states || {}, checks = Object.fromEntries(facets.map(facet => [facet, {state: states[facet] || 'ready', references: []}]));
  const blockers = level === 3 ? facets.filter(facet => checks[facet].state !== 'ready') : [];
  return {schemaVersion: 1, level, reasons: [level === 1 ? 'simple_task' : level === 2 ? 'multiple_steps' : 'long_running'],
    observedTools: [], capabilityRequirements: [], preflight: {state: blockers.length ? 'blocked' : 'ready', checks, blockers},
    requirementsVersion: 1, planRevision: 1, checkedAt: '2026-11-18T00:00:00.000Z'};
};
const recovery = (value, state = 'available', patch = {}) => ({schemaVersion: 1, sessionId: value.sessionId, taskId: value.id,
  taskRevision: value.revision, requirementsVersion: value.requirementsVersion, checkpointId: 'xitcp_' + 'c'.repeat(64),
  native: {state, digest: state === 'missing' || state === 'unbound' ? null : 'd'.repeat(64)},
  canRebuildSession: ['missing', 'changed', 'invalid', 'unavailable'].includes(state), unknownEffects: [], approvals: [], providerSnapshots: [], automaticReplay: false, ...patch});
const snapshot = (value, inspection) => ({task: value, canAccept: false, canResume: true, ...(inspection ? {recovery: inspection} : {})});
const ok = value => ({ok: true, value});
async function settle(action = async () => {}) {await act(async () => {await action(); await delay(5);});}
function element(id) {return document.querySelector(`[data-testid="${id}"]`);}
async function click(id) {
  const target = element(id); assert(target, 'missing control ' + id);
  await settle(async () => {target.click();});
}
async function mount(value, {result = snapshot(value), blocked = false, running = false, bridge = {}} = {}) {
  assert(validTaskView(value), 'invalid synthetic TaskView');
  window.omniEdu = {
    getXiaozhiTask: async input => {report.bridgeCalls.push({action: 'get', input}); return ok(result);},
    resumeXiaozhiTask: async input => {report.bridgeCalls.push({action: 'resume', input}); return {ok: true};},
    ...bridge,
  };
  await settle(async () => {
    root?.unmount(); document.body.innerHTML = '<div id="root"></div>'; root = createRoot(document.getElementById('root'));
    root.render(React.createElement(OfficeSynchronization, {blocked}, React.createElement(PiTaskReview,
      {sessionId: value.sessionId, task: value, running, onRefresh: async () => {}})));
  });
}
async function check(id, name, action) {
  try {await action(); report.checks.push({id, name, pass: true}); console.log('PASS ' + id + ' ' + name);}
  catch (error) {report.checks.push({id, name, pass: false, error: String(error.stack || error)}); console.error('FAIL ' + id + ' ' + String(error));}
}

try {
  const entry = path.join(output, 'entry.tsx');
  fs.writeFileSync(entry, `export {default as React,act} from 'react';export {createRoot} from 'react-dom/client';
export {PiTaskReview} from ${JSON.stringify(path.join(desktop, sources[0]))};
export {PiTaskSteps} from ${JSON.stringify(path.join(desktop, sources[1]))};
export {OfficeSynchronization} from ${JSON.stringify(path.join(desktop, 'src/renderer/components/office/OfficeSynchronization.tsx'))};
export {validTaskView} from ${JSON.stringify(path.join(desktop, 'src/shared/xiaozhi-task.ts'))};`);
  const bundle = path.join(output, 'components.cjs');
  await build({entryPoints: [entry], outfile: bundle, bundle: true, platform: 'node', format: 'cjs', target: 'node24',
    nodePaths: [path.join(desktop, 'node_modules')], loader: {'.css': 'empty'}, jsx: 'automatic', logLevel: 'silent'});
  dom = new JSDOM('<html><body></body></html>', {url: 'http://localhost/', pretendToBeVisual: true});
  for (const name of ['window', 'document', 'Element', 'Node', 'Document', 'DocumentFragment', 'ShadowRoot', 'NodeFilter',
    'MutationObserver', 'Event', 'MouseEvent', 'KeyboardEvent', 'CustomEvent', 'PointerEvent',
    ...Object.getOwnPropertyNames(dom.window).filter(name => /^(HTML|SVG).*Element$/.test(name))]) {
    if (dom.window[name]) globalThis[name] = dom.window[name];
  }
  if (NativeMessageChannel) globalThis.MessageChannel = class extends NativeMessageChannel {constructor() {super(); channels.add(this);}};
  Object.defineProperty(globalThis, 'navigator', {configurable: true, value: dom.window.navigator});
  globalThis.IS_REACT_ACT_ENVIRONMENT = true;
  globalThis.requestAnimationFrame = callback => setTimeout(() => callback(performance.now()), 16);
  globalThis.cancelAnimationFrame = clearTimeout;
  globalThis.CSS = dom.window.CSS || {escape: value => String(value).replace(/[^A-Za-z0-9_-]/g, '\\$&')};
  window.HTMLElement.prototype.scrollIntoView = function() {};
  window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}});
  globalThis.ResizeObserver = class {observe() {} unobserve() {} disconnect() {}};
  ({React, act, createRoot, PiTaskReview, PiTaskSteps, OfficeSynchronization, validTaskView} = createRequire(import.meta.url)(bundle));

  await check('R01', 'Legacy Task keeps its original steps and explicit continue action without automatic calls', async () => {
    const value = task(), before = report.bridgeCalls.length;
    await mount(value); assert.equal(report.bridgeCalls.length, before);
    await click('pi-task-review-toggle');
    assert(element('pi-task-steps')); assert(!element('pi-task-planning')); assert(!element('pi-task-recovery'));
    assert(element('pi-task-resume')); assert(!element('pi-task-resume').disabled);
    assert.equal(report.bridgeCalls.slice(before).filter(item => item.action === 'resume').length, 0);
  });
  await check('R02', 'L1/L2/L3 show their actual reasons and all six original facet states', async () => {
    for (const level of [1, 2, 3]) {
      const value = task('a', {planning: planning(level, {states: {permissions: 'unknown', dependencies: 'blocked'}})});
      await mount(value); await click('pi-task-review-toggle');
      const section = element('pi-task-planning'); assert(section); assert(section.textContent.includes('L' + level));
      for (const label of facetLabels) assert(section.textContent.includes(label), label);
      const reason = level === 1 ? '单一步骤且能力明确' : level === 2 ? '包含多个步骤' : '预计持续运行';
      assert(section.textContent.includes(reason));
      for (const state of ['ready', 'blocked', 'unknown']) assert(section.querySelector(`[data-state="${state}"]`));
    }
  });
  await check('R03', 'Planning remains inspectable before any proposed Task step exists', async () => {
    const value = task('a', {steps: [], planRevision: 0, planning: {...planning(1), planRevision: 0}});
    await mount(value); await click('pi-task-review-toggle');
    assert(element('pi-task-planning')); assert(!element('pi-task-steps'));
  });
  await check('R04', 'Four damaged native states explain reconstruction and use only the original exact resume input', async () => {
    for (const state of ['missing', 'changed', 'invalid', 'unavailable']) {
      const value = task(), before = report.bridgeCalls.length;
      await mount(value, {result: snapshot(value, recovery(value, state))}); await click('pi-task-review-toggle');
      assert(element('pi-task-recovery-rebuild')); assert(element('pi-task-recovery').textContent.includes('重建会话上下文'));
      await click('pi-task-resume');
      const calls = report.bridgeCalls.slice(before).filter(item => item.action === 'resume'); assert.equal(calls.length, 1);
      const {commandId, ...input} = calls[0].input; assert.match(commandId, /^xicmd_[a-f0-9-]{36}$/u);
      assert.deepEqual(input, {schema: 'xiaozhi.task.v1', sessionId: value.sessionId, taskId: value.id,
        revision: value.revision, requirementsVersion: value.requirementsVersion});
    }
  });
  await check('R05', 'Available/unbound recovery is calm and folded with checkpoint and automatic replay disabled', async () => {
    for (const state of ['available', 'unbound']) {
      const value = task(); await mount(value, {result: snapshot(value, recovery(value, state))}); await click('pi-task-review-toggle');
      const section = element('pi-task-recovery'); assert(section); assert(!element('pi-task-recovery-rebuild'));
      assert.equal(section.querySelector('[aria-expanded]').getAttribute('aria-expanded'), 'false');
      assert(!section.querySelector('[role="alert"]')); assert(section.textContent.includes('自动重放已关闭'));
      assert(section.textContent.includes('检查点')); assert(section.textContent.includes('xitcp_'));
    }
  });
  await check('R06', 'Unknown effects and pending/rejected approval facts stay visible while main canResume governs the button', async () => {
    const value = task(), inspection = recovery(value, 'changed', {checkpointId: null,
      unknownEffects: [{id: 'effect_fixture', revision: 2, state: 'unknown'}, {id: 'effect_failed', revision: 1, state: 'failed'}],
      approvals: [{id: 'approval_pending', revision: 1, state: 'pending', action: 'fixture.read'},
        {id: 'approval_rejected', revision: 2, state: 'rejected', action: 'fixture.write'}]});
    await mount(value, {result: {...snapshot(value, inspection), canResume: false}}); await click('pi-task-review-toggle');
    const section = element('pi-task-recovery'); assert(section); assert(section.textContent.includes('结果未知'));
    assert(section.textContent.includes('执行失败')); assert(section.textContent.includes('待审批')); assert(section.textContent.includes('已拒绝'));
    assert(section.textContent.includes('暂无检查点记录')); assert(!element('pi-task-resume'));
    assert(section.textContent.includes('仍需通过当前任务的继续条件'));
  });
  await check('R07', 'Recovery metadata from another Task or older revision is fenced and requests a fresh read', async () => {
    const value = task();
    for (const patch of [{taskId: task('b').id}, {taskRevision: value.revision - 1}, {requirementsVersion: 2}]) {
      await mount(value, {result: snapshot(value, recovery(value, 'missing', patch))}); await click('pi-task-review-toggle');
      assert(!element('pi-task-recovery-rebuild')); assert(element('pi-task-recovery-stale'));
    }
  });
  await check('R08', 'Original running/synchronization/busy guards protect continue while the recovery facts remain readable', async () => {
    const value = task(), result = snapshot(value, recovery(value, 'missing'));
    for (const props of [{running: true}, {blocked: true}]) {
      await mount(value, {result, ...props}); await click('pi-task-review-toggle');
      assert(element('pi-task-recovery-rebuild')); assert(element('pi-task-resume').disabled);
    }
    const pending = deferred(); let calls = 0;
    await mount(value, {result, bridge: {resumeXiaozhiTask: async () => {calls++; return pending.promise;}}});
    await click('pi-task-review-toggle'); await click('pi-task-resume'); assert(element('pi-task-resume').disabled);
    await click('pi-task-resume'); assert.equal(calls, 1);
    await settle(async () => pending.resolve({ok: false, error: 'permission_denied'}));
    assert(element('pi-task-review-notice')); assert(!element('pi-task-resume').disabled);
  });
  await check('R09', 'Original refresh recovers API errors and replaces a damaged diagnostic with available data', async () => {
    const value = task(); let reads = 0;
    await mount(value, {bridge: {getXiaozhiTask: async () => {
      reads++; return reads === 1 ? {ok: false, error: 'unavailable'} : ok(snapshot(value, recovery(value, reads === 2 ? 'invalid' : 'available')));
    }}});
    await click('pi-task-review-toggle'); assert(element('pi-task-review-notice')); assert(!element('pi-task-recovery'));
    await click('pi-task-review-refresh'); assert(element('pi-task-recovery-rebuild'));
    await click('pi-task-review-refresh'); assert(element('pi-task-recovery')); assert(!element('pi-task-recovery-rebuild'));
    assert.equal(reads, 3);
  });
  await check('R10', 'Late session/unmount reads cannot replace the current Task recovery projection', async () => {
    const first = task(), second = task('b'), pending = deferred();
    await mount(first, {bridge: {getXiaozhiTask: async ({sessionId}) => sessionId === first.sessionId
      ? pending.promise : ok(snapshot(second, recovery(second, 'available')))}});
    await click('pi-task-review-toggle');
    await settle(async () => root.render(React.createElement(OfficeSynchronization, {blocked: false},
      React.createElement(PiTaskReview, {sessionId: second.sessionId, task: second, running: false, onRefresh: async () => {}}))));
    await click('pi-task-review-toggle');
    await settle(async () => pending.resolve(ok(snapshot(first, recovery(first, 'missing')))));
    assert.equal(element('pi-task-review').dataset.taskId, second.id); assert(!element('pi-task-recovery-rebuild'));
    const abandoned = deferred();
    await mount(first, {bridge: {getXiaozhiTask: async () => abandoned.promise}}); await click('pi-task-review-toggle');
    await settle(async () => {root.unmount(); root = undefined;});
    await settle(async () => abandoned.resolve(ok(snapshot(first, recovery(first, 'missing')))));
    assert.equal(document.body.textContent, '');
  });
  report.success = report.checks.length === 10 && report.checks.every(item => item.pass);
} catch (error) {report.error = String(error.stack || error);}
finally {
  if (root) await act(async () => root.unmount());
  for (const channel of channels) {channel.port1.close(); channel.port2.close();}
  dom?.window.close();
  report.sources = sources.filter(file => fs.existsSync(path.join(desktop, file))).map(file => ({file, sha256: hash(file)}));
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({success: report.success, passed: report.checks.filter(item => item.pass).length, total: report.checks.length, output, error: report.error}));
  if (!report.success) process.exitCode = 1;
}
