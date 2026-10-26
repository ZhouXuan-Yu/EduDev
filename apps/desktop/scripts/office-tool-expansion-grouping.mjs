import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import { createElement as h, act } from 'react';
import { createRoot } from 'react-dom/client';
import { createServer } from 'vite';
import { JSDOM } from 'jsdom';

// H09-A first slice: the teacher's manual expand/collapse on a tool step / tool
// group must survive attention and status updates. The counterexample is the
// attention-derived React key (`${item.id}:${attention}`), which remounts the
// HeroUI/React Aria Disclosure and silently resets its internal expansion state.
// This is a real component interaction test: jsdom + react-dom/client, real
// pointer/mouse events through the React Aria trigger, never prop-only assertions.
const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const evidenceRoot = path.join(appRoot, 'test-results/goal/harness-h09a-20261020');
fs.mkdirSync(evidenceRoot, { recursive: true });
const output = fs.mkdtempSync(path.join(evidenceRoot, 'run-'));
const checks = [];
const digest=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const scriptSha256=digest(new URL(import.meta.url));
const source=['OfficeToolProcess.tsx','OfficeConversation.tsx','OfficeToolExpansion.tsx'].map(name=>{const file=path.join(appRoot,'src/renderer/components/office',name);return{file,sha256:digest(file)};});

// ─── jsdom environment (before any react-dom usage) ─────────────────────────
const dom = new JSDOM('<!doctype html><html lang="zh-CN"><body><div id="root"></div></body></html>', {
  url: 'http://localhost/', pretendToBeVisual: true,
});
const { window } = dom;
globalThis.window = window;
globalThis.document = window.document;
Object.defineProperty(globalThis, 'navigator', { value: window.navigator, configurable: true, writable: true });
// React Aria chooses its press implementation when the module is evaluated:
// with jsdom's PointerEvent exposed it takes the real pointer-event path that
// browsers run, instead of silently degrading to the touch branch.
globalThis.PointerEvent = window.PointerEvent;
globalThis.MouseEvent = window.MouseEvent;
globalThis.KeyboardEvent = window.KeyboardEvent;
globalThis.Event = window.Event;
globalThis.HTMLElement = window.HTMLElement;
globalThis.SVGElement = window.SVGElement;
globalThis.Element = window.Element;
globalThis.Node = window.Node;
globalThis.getComputedStyle = window.getComputedStyle;
globalThis.requestAnimationFrame = callback => setTimeout(() => callback(Date.now()), 0);
globalThis.cancelAnimationFrame = id => clearTimeout(id);
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
if (!window.matchMedia) window.matchMedia = query => ({ matches: false, media: query, onchange: null, addListener() {}, removeListener() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; } });
if (!window.ResizeObserver) window.ResizeObserver = class { observe() {} unobserve() {} disconnect() {} };
if (!window.scrollTo) window.scrollTo = () => {};

globalThis.ResizeObserver=window.ResizeObserver;globalThis.MutationObserver=window.MutationObserver;
window.HTMLElement.prototype.scrollTo=function(){};

const server = await createServer({ appType: 'custom', optimizeDeps: { noDiscovery: true }, server: { middlewareMode: true, hmr: false, watch: null } });

try {
  const { OfficeToolProcess } = await server.ssrLoadModule('/src/renderer/components/office/OfficeToolProcess.tsx');

  const {OfficeConversation}=await server.ssrLoadModule('/src/renderer/components/office/OfficeConversation.tsx');
  const root = createRoot(document.getElementById('root'));
  let items = [];
  const render = () => root.render(h(OfficeToolProcess, { items, sessionId: 'session_test' }));
  const setItems = async next => { items = next; await act(async () => { render(); }); };

  // Real mouse press sequence for the React Aria trigger: pointerdown/pointerup
  // drive usePress, the click delivers the press to the Disclosure toggle.
  const press = async trigger => {
    assert(trigger, 'trigger button missing');
    await act(async () => {
      trigger.dispatchEvent(new window.PointerEvent('pointerdown', { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 1, clientX: 8, clientY: 8, width: 2, height: 2, pressure: 0.5, detail: 1, bubbles: true, cancelable: true, view: window }));
      trigger.dispatchEvent(new window.PointerEvent('pointerup', { pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: 0, clientX: 8, clientY: 8, width: 2, height: 2, pressure: 0, detail: 1, bubbles: true, cancelable: true, view: window }));
      trigger.dispatchEvent(new window.MouseEvent('click', { button: 0, detail: 1, clientX: 8, clientY: 8, bubbles: true, cancelable: true, view: window }));
    });
  };
  const stepTrigger = () => document.querySelector('[data-testid="office-tool-step"] [data-slot="chat-tool-trigger"]');
  const groupTrigger = () => document.querySelector('[data-testid="office-tool-group"] [data-slot="chat-tool-group-trigger"]');
  const isExpanded = trigger => trigger && trigger.getAttribute('aria-expanded') === 'true';
  const item = (id, status, extra = {}) => ({ id, kind: 'tool', label: '读取授权资料', status, durationMs: 2300, ...extra });
  const check = async (name, fn) => { console.error('[check]', name); await fn(); checks.push({ name, pass: true }); console.error('[check-ok]', name); };

  // A. Teacher expands a completed row; the attention flip must not remount it.
  await check('Single row: teacher-expanded completed row keeps expansion and its trigger DOM node when attention flips true', async () => {
    await setItems([item('call_a', 'completed')]);
    const trigger = stepTrigger();
    assert.equal(isExpanded(trigger), false, 'completed row starts collapsed');
    await press(trigger);
    assert.equal(isExpanded(trigger), true, 'teacher press expands the row');
    await setItems([item('call_a', 'waiting_approval')]);
    const after = stepTrigger();
    assert.equal(isExpanded(after), true, 'row stays expanded after attention flips true');
    // assert.ok (not assert.equal): on failure node:assert would inspect the
    // jsdom DOM nodes to build the diff, which can exhaust V8 memory.
    assert.ok(after === trigger, 'trigger DOM node must not be replaced (key must be attention-free)');
  });

  // B. Untouched collapsed completed row auto-expands once when attention turns on.
  await check('Single row: collapsed completed row auto-expands on the false→true attention transition without remounting', async () => {
    await setItems([item('call_b', 'completed')]);
    const trigger = stepTrigger();
    assert.equal(isExpanded(trigger), false);
    await setItems([item('call_b', 'waiting_approval')]);
    const after = stepTrigger();
    assert.equal(isExpanded(after), true, 'row auto-expands once on a genuine false→true attention transition');
    assert.ok(after === trigger, 'auto-expand must reuse the mounted row, not remount it');
    await setItems([item('call_b', 'waiting_approval', { durationMs: 5200 })]);
    assert.equal(isExpanded(stepTrigger()), true, 'repeated renders with attention true do not re-run any auto-expand');
  });

  // C. Teacher collapses an attention row; later status updates keep it collapsed.
  await check('Single row: teacher collapse survives status updates while attention stays true', async () => {
    await setItems([item('call_c', 'waiting_approval')]);
    const trigger = stepTrigger();
    assert.equal(isExpanded(trigger), true, 'attention row starts expanded');
    await press(trigger);
    assert.equal(isExpanded(trigger), false, 'teacher press collapses the row');
    await setItems([item('call_c', 'waiting_input')]);
    assert.equal(isExpanded(stepTrigger()), false, 'status update with attention still true keeps the teacher collapse');
    await setItems([item('call_c', 'waiting_input', { durationMs: 8900 })]);
    assert.equal(isExpanded(stepTrigger()), false, 'plain re-render never re-expands a teacher-collapsed row');
  });

  // D. Group: the teacher's collapse wins over attention/status updates and the
  // group trigger node is never replaced. Contract decision (documented in the
  // H09-A contract): the first manual toggle latches the teacher's choice for the
  // mounted group, so a later false→true attention transition does not override it.
  await check('Group: teacher collapse and later re-expand survive attention/status updates without remounting', async () => {
    await setItems([item('call_d1', 'waiting_approval'), item('call_d2', 'waiting_approval')]);
    const trigger = groupTrigger();
    assert.equal(isExpanded(trigger), true, 'group with attention starts expanded');
    await press(trigger);
    assert.equal(isExpanded(trigger), false, 'teacher press collapses the group');
    await setItems([item('call_d1', 'completed'), item('call_d2', 'completed')]);
    let after = groupTrigger();
    assert.equal(isExpanded(after), false, 'attention→false does not force-collapse state the teacher already chose');
    assert.ok(after === trigger, 'group trigger node must survive the attention flip');
    await setItems([item('call_d1', 'failed'), item('call_d2', 'completed')]);
    after = groupTrigger();
    assert.equal(isExpanded(after), false, 'false→true attention transition respects the teacher collapse (manual latch)');
    assert.ok(after === trigger, 'group trigger node must survive every update');
    await press(after);
    assert.equal(isExpanded(after), true, 'teacher re-expands the group');
    await setItems([item('call_d1', 'waiting_input'), item('call_d2', 'completed')]);
    after = groupTrigger();
    assert.equal(isExpanded(after), true, 'teacher expansion survives later status updates');
    assert.ok(after === trigger, 'group trigger node identity holds across the whole scenario');
  });

  const show=async(turnItems,threadId='session_grouping',runId='run_grouping')=>{await act(async()=>root.render(h(OfficeConversation,{projection:{threadId,turns:[{id:runId,status:'running',items:turnItems}]}})));};
  const row=id=>document.querySelector(`[data-item-id="${id}"] [data-slot="chat-tool-trigger"]`);
  await check('Conversation: a manually opened call remains visible when a second call creates a tool group',async()=>{
    await show([item('call_live','completed')]);await press(row('call_live'));assert(isExpanded(row('call_live')));
    await show([item('call_live','completed'),item('call_later','inProgress')]);
    assert(isExpanded(groupTrigger()),'a new group must expose the call the teacher was reading');
    assert(isExpanded(row('call_live')),'the original call retains its explicit expansion through regrouping');
    await show([item('call_live','completed'),{id:'barrier',kind:'message',role:'assistant',text:'公开说明'},item('call_later','completed')]);
    assert(isExpanded(row('call_live')),'splitting a group must retain call state');
    await show([item('call_live','completed'),item('call_later','completed')]);assert(isExpanded(row('call_live')),'merging the group must retain call state');
  });
  await check('Conversation: an explicitly closed group stays closed on failure; reopening retains the child choice',async()=>{
    await press(groupTrigger());assert(!isExpanded(groupTrigger()));
    await show([item('call_live','failed'),item('call_later','completed')]);assert(!isExpanded(groupTrigger()));
    await press(groupTrigger());assert(isExpanded(row('call_live')));
  });
  await check('Conversation: the same call identifier in another run or thread cannot inherit a UI choice',async()=>{
    await show([item('call_live','completed')],'session_grouping','run_other');assert(!isExpanded(row('call_live')));
    await press(row('call_live'));assert(isExpanded(row('call_live')));
    await show([item('call_live','completed')],'session_other','run_other');assert(!isExpanded(row('call_live')));
  });
  await act(async()=>root.unmount());
  assert.equal(digest(new URL(import.meta.url)),scriptSha256,'test script changed during execution');assert(source.every(file=>digest(file.file)===file.sha256),'component source changed during execution');
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({
    success: true, checks, output,scriptSha256,scriptUnchanged:true,source,
    scope: 'H09-A first slice: real jsdom interaction through the React Aria trigger. Proves expansion state and trigger DOM identity survive attention/status updates; auto-expand only on a genuine false→true attention transition until the teacher toggles manually. Includes actual OfficeConversation single/group/split/merge and run/thread isolation. No browser/Electron, screen reader, scroll-layout or long-history claim.',
  }, null, 2));
  console.log(JSON.stringify({ success: true, checks: checks.length, output }));
} catch (error) {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ success: false, checks, output, error: String(error && error.stack || error) }, null, 2));
  throw error;
} finally {
  await server.close();
}
