import assert from 'node:assert/strict';
import React from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {fixture, deferred, ownerA, basketId} from './acceptance/paper-basket-renderer-fixture.mjs';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {url: 'http://localhost', pretendToBeVisual: true});
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement',
  'HTMLButtonElement', 'HTMLSelectElement', 'Document', 'NodeFilter', 'Element', 'Node', 'Event', 'MouseEvent',
  'PointerEvent', 'KeyboardEvent', 'SVGElement', 'getComputedStyle', 'localStorage', 'MutationObserver']) {
  Object.defineProperty(globalThis, key, {value: dom.window[key], configurable: true});
}
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame = fn => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame = clearTimeout;
globalThis.ResizeObserver = class {observe() {} unobserve() {} disconnect() {}};
dom.window.Element.prototype.getAnimations = () => [];
globalThis.matchMedia = dom.window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
const {createRoot} = await import('react-dom/client');
const {act} = React;
const server = await createServer({configFile: false, appType: 'custom', optimizeDeps: {noDiscovery: true},
  server: {middlewareMode: true, hmr: false, ws: false, watch: null}});
const run = async (fn = () => {}) => act(async () => {await fn(); await new Promise(resolve => setTimeout(resolve, 10));});
const find = id => document.querySelector(`[data-testid="${id}"]`);
const press = element => run(() => {
  assert(element, 'missing press target');
  for (const type of ['pointerdown', 'pointerup']) element.dispatchEvent(new window.PointerEvent(type,
    {pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerdown' ? 1 : 0, bubbles: true, cancelable: true}));
  element.dispatchEvent(new window.MouseEvent('click', {button: 0, detail: 1, bubbles: true, cancelable: true}));
});
const edit = (id, value) => run(() => {
  const element = find(id); assert(element);
  Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, 'value').set.call(element, value);
  element.dispatchEvent(new window.Event('input', {bubbles: true}));
});
let root, nav, passed = 0;
const check = (name, fn) => {fn(); passed++; console.log('PASS ' + name);};
const errors = [];
window.addEventListener('error', event => errors.push(String(event.error)));
try {
  const load = name => server.ssrLoadModule('/src/' + name);
  const {DesktopFrame, useDesktopNavigation} = await load('renderer/components/desktop/DesktopFrame.tsx');
  const {PaperBlueprintWorkspace} = await load('renderer/components/PaperBlueprintWorkspace.tsx');
  const {defaultPaperBlueprint} = await load('shared/paper-blueprint.ts');
  const {PAPER_UI_DRAFT_KEY} = await load('renderer/components/paper-ui/paper-draft-storage.ts');
  const initial = defaultPaperBlueprint();
  root = createRoot(document.getElementById('root'));
  function Host() {
    nav = useDesktopNavigation();
    return nav.target.view === 'paper' ? React.createElement(PaperBlueprintWorkspace, {initialSessionId: ownerA})
      : React.createElement('button', {'data-testid': 'enter-paper', onClick: () => nav.navigate({view: 'paper'})}, '进入题篮');
  }
  async function mount(f, draft) {
    await run(() => root.render(null)); localStorage.clear(); window.sessionStorage.clear();
    if (draft) window.sessionStorage.setItem(PAPER_UI_DRAFT_KEY, JSON.stringify(draft));
    f.api.getDesktopChrome = async () => ({enabled: true, height: 44});
    f.api.listPapers = async () => ({ok: true, value: []});
    window.omniEdu = f.api;
    await run(() => root.render(React.createElement(DesktopFrame, null, React.createElement(Host))));
    await press(find('enter-paper')); await run();
  }

  let f = fixture(initial);
  await mount(f, {schemaVersion: 'edudev.paper-ui-draft.v1', blueprint: {...initial, title: '真实暂存蓝图恢复'},
    contextOwner: ownerA, targetSessionId: ownerA});
  check('implicit paper entry actually restores the stored automatic blueprint', () => {
    assert.equal(nav.target.paper, undefined); assert.equal(find('paper-title').value, '真实暂存蓝图恢复');
    assert(find('paper-discard-edits'));
  });
  await press(find('paper-discard-edits')); await press(find('paper-discard-continue'));
  await press(find('paper-entry-basket')); await run();
  check('after explicit discard, manual basket click is not swallowed as the same implicit route', () => {
    assert.equal(find('paper-basket-workspace').dataset.basketId, basketId); assert(!find('paper-mode'));
    assert.equal(nav.target.paper.mode, 'basket'); assert.equal(find('desktop-back').disabled, false);
  });
  await press(find('desktop-back'));
  check('real back button preserves the implicit automatic history entry', () => {assert(find('paper-mode')); assert.equal(nav.target.paper, undefined);});
  await press(find('desktop-forward')); await run();
  check('real forward button restores the exact explicit basket route', () => {
    assert.equal(find('paper-basket-workspace').dataset.basketId, basketId); assert.equal(nav.target.paper.mode, 'basket');
  });

  for (const outcome of ['invalid', 'domain-failure', 'transport-failure']) {
    f = fixture(initial); f.data.delete(ownerA);
    const creates = [];
    const pending = deferred();
    f.api.createPaperBasket = input => {creates.push(input); return pending.promise;};
    await mount(f);
    await edit('paper-basket-title', outcome === 'invalid' ? '' : '创建失败时保留的草稿');
    check(outcome + ': dirty no-basket blueprint exposes an explicit discard action', () => {
      assert.equal(find('paper-basket-discard-blueprint').disabled, false);
      assert.equal(find('paper-basket-back-teaching').disabled, true);
    });
    if (outcome === 'invalid') {
      check('invalid draft cannot submit domain creation', () => {assert.equal(find('paper-basket-create').disabled, true); assert.equal(creates.length, 0);});
    } else {
      await press(find('paper-basket-create'));
      check(outcome + ': in-flight creation cannot be discarded mid-write', () => assert.equal(find('paper-basket-discard-blueprint').disabled, true));
      await run(() => outcome === 'domain-failure' ? pending.resolve({ok: false, error: 'unavailable'}) : pending.reject(Error('lost creation response')));
      check(outcome + ': failed creation retains input and re-enables local discard', () => {
        assert.equal(find('paper-basket-title').value, '创建失败时保留的草稿');
        assert(find('paper-basket-error')); assert.equal(find('paper-basket-discard-blueprint').disabled, false);
      });
    }
    const writesBeforeDiscard = creates.length + f.calls.mutate.length;
    await press(find('paper-basket-discard-blueprint'));
    check(outcome + ': discard resets the initial blueprint and performs no domain writes', () => {
      assert.equal(find('paper-basket-title').value, initial.title);
      assert.equal(find('paper-basket-total').value, String(initial.totalPoints));
      assert.equal(creates.length + f.calls.mutate.length, writesBeforeDiscard);
      assert.equal(find('paper-basket-back-teaching').disabled, false);
      if (outcome === 'transport-failure') assert.match(find('paper-basket-error').textContent, /未撤销任何宿主记录/);
    });
    await press(find('paper-basket-back-teaching'));
    check(outcome + ': discard releases navigation without retrying creation', () => {
      assert.equal(nav.target.view, 'teaching'); assert.equal(creates.length + f.calls.mutate.length, writesBeforeDiscard);
    });
  }
  check('P2 mounted renderer errors remain clean', () => assert.deepEqual(errors, []));
  console.log(JSON.stringify({success: true, passed, scope: 'production components mounted with deferred preload DTOs; no Electron/model/build'}));
} finally {
  if (root) await act(async () => root.unmount());
  await server.close(); dom.window.close();
}
