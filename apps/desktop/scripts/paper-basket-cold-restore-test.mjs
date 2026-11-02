import assert from 'node:assert/strict';
import React from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {fixture, deferred, ownerA, ownerB, otherBasketId} from './acceptance/paper-basket-renderer-fixture.mjs';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {url: 'http://localhost', pretendToBeVisual: true});
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement',
  'HTMLButtonElement', 'HTMLSelectElement', 'Document', 'NodeFilter', 'Element', 'Node', 'Event', 'MouseEvent',
  'PointerEvent', 'KeyboardEvent', 'SVGElement', 'getComputedStyle', 'localStorage', 'MutationObserver']) {
  Object.defineProperty(globalThis, key, {value: dom.window[key], configurable: true});
}
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame = fn => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame = clearTimeout;
globalThis.ResizeObserver = class {observe() {} unobserve() {} disconnect() {}};
globalThis.matchMedia = dom.window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
dom.window.Element.prototype.getAnimations = () => [];
const {createRoot} = await import('react-dom/client');
const server = await createServer({configFile: false, appType: 'custom', optimizeDeps: {noDiscovery: true},
  server: {middlewareMode: true, hmr: false, ws: false, watch: null}});
const run = async (fn = () => {}) => React.act(async () => {await fn(); await new Promise(resolve => setTimeout(resolve, 10));});
let root;
try {
  const load = path => server.ssrLoadModule('/src/' + path);
  const {defaultPaperBlueprint} = await load('shared/paper-blueprint.ts');
  const {PaperBasketWorkspace} = await load('renderer/components/paper-ui/PaperBasketWorkspace.tsx');
  const {DesktopFrame, useDesktopNavigation} = await load('renderer/components/desktop/DesktopFrame.tsx');
  const f = fixture(defaultPaperBlueprint());
  f.data.get(ownerB).uiState = {stage: 'organize', filters: {query: 'unit saved query'}, offset: 0, scrollTop: 0};
  const read = f.api.readPaperBasket;
  const pending = deferred();
  let reads = 0;
  f.api.readPaperBasket = input => {reads++; return reads === 1 ? pending.promise : read(input);};
  window.omniEdu = f.api;
  localStorage.setItem('xiaozhi.ui.paper-basket-reference.v1', JSON.stringify({schema: 1, sessionId: ownerB, basketId: otherBasketId}));
  let nav;
  function Page() {
    nav = useDesktopNavigation();
    return React.createElement(PaperBasketWorkspace, {initialSessionId: ownerA});
  }
  root = createRoot(document.getElementById('root'));
  await run(() => root.render(React.createElement(DesktopFrame, null, React.createElement(Page))));
  await run(() => nav.navigate({view: 'paper', paper: {mode: 'basket'}}));
  await run(() => pending.resolve({ok: true, value: structuredClone(f.data.get(ownerB))}));
  await run();
  const workspace = document.querySelector('[data-testid="paper-basket-workspace"]');
  assert.equal(workspace.dataset.basketId, otherBasketId);
  assert.equal(workspace.dataset.stage, 'organize');
  assert.equal(nav.target.sessionId, ownerB);
  assert.equal(nav.target.paper.basketId, otherBasketId);
  assert.equal(f.calls.list.length, 1, 'Cold restoration must not re-list the same owner after publishing the basket');
  assert.equal(reads, 1, 'Cold restoration must not re-read its own published route');
  console.log(JSON.stringify({success: true, passed: 2,
    scope: 'Mounted real PaperBasketWorkspace/Select with deferred host read, active chat A and cached B; normal cold-route echo does not reproduce Actual6 reset. No app/model/build.'}));
} finally {
  if (root) await run(() => root.unmount());
  await server.close(); dom.window.close();
}
