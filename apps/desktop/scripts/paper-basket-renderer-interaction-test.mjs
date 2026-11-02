import assert from 'node:assert/strict';
import React from 'react';
import {JSDOM} from 'jsdom';
import {createServer} from 'vite';
import {fixture, deferred, makeBasket, ownerA, ownerB, inaccessibleOwner, basketId, otherBasketId,
  question, version} from './acceptance/paper-basket-renderer-fixture.mjs';

const dom = new JSDOM('<!doctype html><html><body><div id="root"></div></body></html>', {url: 'http://localhost', pretendToBeVisual: true});
for (const key of ['window', 'document', 'navigator', 'HTMLElement', 'HTMLInputElement', 'HTMLTextAreaElement',
  'HTMLButtonElement', 'HTMLSelectElement', 'Document', 'NodeFilter', 'Element', 'Node', 'Event', 'MouseEvent', 'PointerEvent', 'KeyboardEvent', 'SVGElement', 'getComputedStyle', 'localStorage', 'MutationObserver']) {
  Object.defineProperty(globalThis, key, {value: dom.window[key], configurable: true});
}
globalThis.requestAnimationFrame = dom.window.requestAnimationFrame = fn => setTimeout(fn, 0);
globalThis.cancelAnimationFrame = dom.window.cancelAnimationFrame = clearTimeout;
globalThis.ResizeObserver = class {observe() {} unobserve() {} disconnect() {}};
globalThis.matchMedia = dom.window.matchMedia = () => ({matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {}});
globalThis.IS_REACT_ACT_ENVIRONMENT = true;
// JSDOM has no animation engine. Actual Electron acceptance uses real finite transitions.
dom.window.Element.prototype.getAnimations = () => [];
const {createRoot} = await import('react-dom/client');
const {act} = React;
const server = await createServer({configFile: false, appType: 'custom', optimizeDeps: {noDiscovery: true},
  server: {middlewareMode: true, hmr: false, ws: false, watch: null}});
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
const run = async (fn = () => {}, ms = 5) => act(async () => {await fn(); await wait(ms);});
const check = (name, fn) => {fn(); passed++; console.log('PASS ' + name);};
const find = id => document.querySelector(`[data-testid="${id}"]`);
const press = element => run(() => {
  assert(element, 'missing press target');
  for (const type of ['pointerdown', 'pointerup']) element.dispatchEvent(new window.PointerEvent(type,
    {pointerId: 1, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerdown' ? 1 : 0, bubbles: true, cancelable: true}));
  element.dispatchEvent(new window.MouseEvent('click', {button: 0, detail: 1, bubbles: true, cancelable: true}));
});
let root, state, nav, passed = 0;
const rendererErrors = [];
window.addEventListener('error', event => rendererErrors.push(String(event.error)));
try {
  const load = path => server.ssrLoadModule('/src/' + path);
  const {defaultPaperBlueprint} = await load('shared/paper-blueprint.ts');
  const {usePaperBasketWorkspace} = await load('renderer/components/paper-ui/usePaperBasketWorkspace.ts');
  const {PaperBasketWorkspace} = await load('renderer/components/paper-ui/PaperBasketWorkspace.tsx');
  const {PaperBlueprintWorkspace} = await load('renderer/components/PaperBlueprintWorkspace.tsx');
  const {PaperBasketPreview} = await load('renderer/components/paper-ui/PaperBasketPreview.tsx');
  const {PaperBasketOrganizer} = await load('renderer/components/paper-ui/PaperBasketOrganizer.tsx');
  const {PaperQuestionImages} = await load('renderer/components/paper-ui/PaperQuestionImages.tsx');
  const {DesktopFrame, useDesktopNavigation} = await load('renderer/components/desktop/DesktopFrame.tsx');
  const {readBasketReference} = await load('renderer/components/paper-ui/paper-basket-reference.ts');
  const blueprint = defaultPaperBlueprint();
  root = createRoot(document.getElementById('root'));
  function Consumer({initial = ownerA}) {
    state = usePaperBasketWorkspace(initial); nav = useDesktopNavigation();
    return React.createElement('p', null, state.basket?.id || state.error || 'loading');
  }
  async function mount(f, {clear = true, initial = ownerA, component = Consumer} = {}) {
    await run(() => root.render(null));
    if (clear) localStorage.clear();
    window.omniEdu = f.api;
    await run(() => root.render(React.createElement(DesktopFrame, null, React.createElement(component, {initial, initialSessionId: initial}))));
    await run();
  }
  let f = fixture(blueprint);
  const listOwners = f.api.listAiConversations;
  f.api.listAiConversations = async () => {
    const value = await listOwners();
    value.sessions.push(...Array.from({length: 10000}, (_, index) => ({id: 'unit-unused-owner-' + index, title: '未选会话 ' + index})));
    return value;
  };
  await mount(f);
  check('startup reads exactly current owner page, despite 100000 summaries and inaccessible other owner', () => {
    assert.equal(state.basket.id, basketId); assert.equal(f.calls.list.length, 1); assert.equal(state.owners.length, 10003);
    assert.deepEqual(f.calls.list[0], {schemaVersion: 'xiaozhi.paper-basket.v1', sessionId: ownerA, offset: 0, limit: 50});
  });
  await run(() => state.loadMore());
  check('summary pagination is explicit and bounded', () => {assert.equal(f.calls.list.length, 2); assert.equal(f.calls.list[1].limit, 50);});
  await run(() => state.chooseOwner(inaccessibleOwner));
  check('unreadable selected owner shows failure, no leaked prior basket or fake empty success', () => {
    assert.equal(state.basket, undefined); assert.match(state.error, /会话或学生/); assert.equal(state.ownerId, inaccessibleOwner);
  });
  await run(() => state.chooseOwner(ownerB));
  check('another valid owner remains accessible after permission error', () => {assert.equal(state.basket.id, otherBasketId); assert.equal(state.error, '');});
  await run(() => state.changeUi({...state.ui, filters: {knowledgePoint: '一次函数'}, scrollTop: 260}));
  await run(() => state.saveUi());
  await mount(f, {clear: false, initial: ownerA});
  check('cold remount with active chat A restores latest B by host-validated reference', () => {
    assert.equal(state.ownerId, ownerB); assert.equal(state.basket.id, otherBasketId);
    assert.equal(state.ui.scrollTop, 260); assert.equal(state.ui.filters.knowledgePoint, '一次函数');
    assert.deepEqual(readBasketReference(), {sessionId: ownerB, basketId: otherBasketId});
  });
  await run(() => nav.navigate({view: 'paper', sessionId: ownerA, paper: {mode: 'basket', basketId}}));
  check('explicit route overrides cached B, revalidates with host', () => {assert.equal(state.ownerId, ownerA); assert.equal(state.basket.id, basketId);});

  const late = deferred();
  const read = f.api.readPaperBasket;
  f.api.readPaperBasket = input => input.sessionId === ownerB ? late.promise : read(input);
  let switching;
  await run(() => {switching = state.chooseOwner(ownerB);});
  await run(() => state.chooseOwner(ownerA));
  await run(() => late.resolve({ok: true, value: f.data.get(ownerB)}));
  await switching;
  check('late read from B cannot replace A or clear its owner', () => {assert.equal(state.ownerId, ownerA); assert.equal(state.basket.id, basketId);});
  f.api.readPaperBasket = read;

  const before = f.calls.mutate.length;
  await run(() => state.changeUi(structuredClone(state.ui)), 450);
  check('identical UI content produces no host write', () => assert.equal(f.calls.mutate.length, before));
  await run(() => {
    for (let i = 1; i <= 25; i++) state.changeUi({...state.ui, filters: {query: '合并' + i}, scrollTop: i});
  });
  await run(() => {}, 450); await run();
  check('burst preferences coalesce to one host write without content revision change', () => {
    assert.equal(f.calls.mutate.length, before + 1); assert.equal(state.basket.revision, 1);
    assert.equal(f.calls.mutate.at(-1).operation.uiState.filters.query, '合并25');
  });
  await run(() => state.changeUi({...state.ui, filters: {query: 'same', knowledgePoint: 'same-kp'}}));
  await run(() => state.saveUi());
  const unchangedWrites = f.calls.mutate.length;
  await run(() => state.changeUi({...state.ui, filters: {knowledgePoint: 'same-kp', query: 'same'}}), 450);
  check('equal filter content with different property order is still a no-op', () => assert.equal(f.calls.mutate.length, unchangedWrites));

  const mutate = f.api.mutatePaperBasket;
  await run(() => state.mutate({type: 'add', questionId: question.id, sectionId: blueprint.sections[0].id, expectedSourceVersion: version}));
  let failures = 0;
  f.api.mutatePaperBasket = async input => {if (input.operation.type === 'updateUiState') {failures++; return {ok: false, error: 'unavailable'};} return mutate(input);};
  await run(() => state.changeUi({...state.ui, filters: {query: '未保存输入'}}));
  await run(() => {}, 450); await run(() => {}, 850);
  check('preference capacity failure stops automatic retries and retains input', () => {
    assert.equal(failures, 1); assert.equal(state.uiSaveBlocked, true); assert.equal(state.ui.filters.query, '未保存输入');
  });
  await run(() => state.stage('preview'));
  check('failed explicit flush does not pretend stage navigation succeeded', () => {
    assert.equal(state.ui.stage, 'select'); assert.notEqual(nav.target.paper?.stage, 'preview'); assert.equal(failures, 2);
  });
  const draft = {...state.blueprint, title: '冲突时必须保留的蓝图'};
  await run(() => state.setDraft(draft));
  await run(() => state.reload());
  check('same-basket reload preserves both unsaved blueprint and failed preference input', () => {
    assert.equal(state.blueprint.title, draft.title); assert.equal(state.dirty, true); assert.equal(state.ui.filters.query, '未保存输入');
  });
  const entriesBefore = state.basket.entries;
  await run(() => state.discardUi());
  check('explicit preference discard retains domain inputs, members and honest storage failure', () => {
    assert.equal(state.uiDirty, false); assert.equal(state.uiDiscarded, true); assert.equal(state.blueprint.title, draft.title);
    assert.equal(state.dirty, true); assert.strictEqual(state.basket.entries, entriesBefore); assert.equal(state.basket.entries.length, 1);
    assert.deepEqual(state.basket.entries[0].question, question); assert(state.error);
  });
  await run(() => assert.equal(nav.navigate({view: 'teaching'}), false));
  await run(() => state.discardDraft());
  await run(() => state.stage('organize'));
  await run(() => state.leave('teaching'));
  check('discarded preferences allow local stage and navigation without further failed writes', () => {
    assert.equal(nav.target.view, 'teaching'); assert.equal(failures, 2);
  });

  f = fixture(blueprint); await mount(f);
  const add = {type: 'add', questionId: question.id, sectionId: blueprint.sections[0].id, expectedSourceVersion: version};
  const pending = deferred();
  let operation;
  f.api.mutatePaperBasket = input => {operation = input; return pending.promise;};
  let adding;
  await run(() => {adding = state.mutate(add);});
  check('pending membership mutation never optimistically increments count', () => {assert.equal(state.basket.count, 0); assert.equal(state.busy, true);});
  await run(() => pending.reject(new Error('lost response'))); await adding;
  const first = structuredClone(operation);
  f.api.mutatePaperBasket = input => {operation = input; return Promise.resolve({ok: false, error: 'conflict'});};
  await run(() => state.retry());
  check('transport retry retains exact request identity, revision and source version', () => {
    assert.deepEqual(operation, first); assert.equal(first.expectedRevision, 1); assert.equal(first.operation.expectedSourceVersion, version);
    assert.equal(state.basket.count, 0); assert.match(state.error, /保留/);
  });
  f.api.mutatePaperBasket = async () => ({ok: false, error: 'conflict'});
  await run(() => state.setDraft({...state.blueprint, title: '蓝图冲突保留'}));
  await run(() => state.mutate({type: 'updateBlueprint', blueprint: state.blueprint}));
  check('revision conflict retains unsaved blueprint', () => {assert.equal(state.dirty, true); assert.equal(state.blueprint.title, '蓝图冲突保留');});

  f = fixture(blueprint); await mount(f);
  let failedUiRequests = 0;
  f.api.mutatePaperBasket = async () => {failedUiRequests++; throw Error('preference response lost');};
  await run(() => state.changeUi({...state.ui, filters: {query: '只放弃偏好'}}));
  await run(() => state.saveUi());
  check('transport preference failure explicitly marks uncertain save', () => {assert.equal(state.retryable, true); assert.equal(state.uiDirty, true);});
  await run(() => state.discardUi());
  await run(() => state.leave('teaching'));
  check('preference discard releases only its own uncertain request, no endless retry', () => {
    assert.equal(nav.target.view, 'teaching'); assert.equal(failedUiRequests, 1); assert.equal(state.retryable, false);
  });

  f = fixture(blueprint); await mount(f);
  const savingUi = deferred();
  const originalMutate = f.api.mutatePaperBasket;
  f.api.mutatePaperBasket = async input => {await savingUi.promise; return originalMutate(input);};
  await run(() => state.changeUi({...state.ui, filters: {query: 'first'}}));
  let saving;
  await run(() => {saving = state.saveUi();});
  await run(() => state.changeUi({...state.ui, filters: {query: 'second'}}));
  await run(() => savingUi.resolve()); await saving;
  check('successful older preference save cannot mark newer input saved or replace it', () => {
    assert.equal(state.ui.filters.query, 'second'); assert.equal(state.uiDirty, true); assert.equal(state.basket.uiState.filters.query, 'first');
  });
  f.api.mutatePaperBasket = originalMutate;
  await run(() => state.stage('organize'));
  check('stage navigation explicitly flushes latest input with current revision first', () => {
    assert.equal(state.uiDirty, false); assert.equal(state.ui.stage, 'organize');
    assert.equal(f.calls.mutate.at(-1).operation.uiState.filters.query, 'second');
    assert.equal(f.calls.mutate.at(-1).operation.uiState.stage, 'organize');
  });

  // A pinned reference not in the first summary page must not corrupt the next page's host cursor.
  f = fixture(blueprint);
  const listed = makeBasket(blueprint, {id: 'xibasket_77777777-7777-4777-8777-777777777777'});
  f.api.listPaperBaskets = async input => {f.calls.list.push(input); return {ok: true, value: {items: [listed], total: 70, offset: input.offset, limit: 50}};};
  localStorage.setItem('xiaozhi.ui.paper-basket-reference.v1', JSON.stringify({schema: 1, sessionId: ownerA, basketId}));
  await mount(f, {clear: false});
  await run(() => state.loadMore());
  check('restoring basket outside current summary page keeps exact host pagination offset', () => {assert.equal(f.calls.list[1].offset, 1); assert.equal(state.basket.id, basketId);});

  f = fixture(blueprint);
  f.data.set(ownerA, {...f.data.get(ownerA), complete: true});
  const boundSnapshot = {id: 'xipaper_88888888-8888-4888-8888-888888888888', sessionId: ownerA, revision: 1,
    title: 'bound', state: 'pending', complete: true, count: 0, blueprint, sourceCurrent: true, exportCurrent: true,
    basket: {basketId, basketRevision: 1, entryIds: []}};
  f.api.createPaperFromBasket = async input => {f.calls.snapshot.push(input); return {ok: true, value: boundSnapshot};};
  await mount(f);
  await run(() => state.takeSnapshot());
  await run(() => state.decide('confirm'));
  check('snapshot and decision use exact saved basket/session/revision', () => {
    assert.equal(f.calls.snapshot[0].expectedRevision, 1); assert.equal(f.calls.decide.length, 1);
    assert.equal(f.calls.decide[0].id, boundSnapshot.id);
  });
  await run(() => state.mutate({type: 'add', questionId: question.id, sectionId: blueprint.sections[0].id, expectedSourceVersion: version}));
  await run(() => state.decide('confirm'));
  check('changed basket revision blocks stale snapshot confirmation in callback as well as button', () => assert.equal(f.calls.decide.length, 1));

  const lateFailure = deferred();
  f.api.listPaperBaskets = input => input.sessionId === inaccessibleOwner ? lateFailure.promise : fixture(blueprint).api.listPaperBaskets(input);
  let switchingToInvalid;
  await run(() => {switchingToInvalid = state.chooseOwner(inaccessibleOwner);});
  await run(() => state.chooseOwner(ownerB));
  await run(() => lateFailure.resolve({ok: false, error: 'permission_denied'})); await switchingToInvalid;
  check('late unreadable-owner response cannot leak an error into current valid owner', () => {assert.equal(state.ownerId, ownerB); assert.equal(state.error, '');});

  f = fixture(blueprint);
  const listing = deferred();
  f.api.listAiConversations = () => listing.promise;
  localStorage.setItem('xiaozhi.ui.paper-basket-reference.v1', JSON.stringify({schema: 1, sessionId: ownerB, basketId: otherBasketId}));
  await mount(f, {clear: false});
  await run(() => nav.navigate({view: 'paper', sessionId: ownerA, paper: {mode: 'basket', basketId}}));
  await run(() => listing.resolve({sessions: [{id: ownerA, title: 'A'}, {id: ownerB, title: 'B'}]}));
  check('explicit route arriving during cold initialization wins over cached reference', () => {
    assert.equal(state.ownerId, ownerA); assert.equal(state.basket.id, basketId); assert.equal(f.calls.list.length, 1);
  });
  f = fixture(blueprint);
  localStorage.setItem('xiaozhi.ui.paper-basket-reference.v1', JSON.stringify({schema: 1, sessionId: inaccessibleOwner, basketId}));
  await mount(f, {clear: false});
  check('inaccessible cold hint fails visibly without falling back to fake empty basket or exposing cached facts', () => {
    assert.equal(state.basket, undefined); assert.match(state.error, /会话或学生/); assert.equal(f.calls.read.length, 0);
  });
  await run(() => state.chooseOwner(ownerA));
  check('invalid cold hint can recover by selecting a legal owner', () => assert.equal(state.basket.id, basketId));
  f = fixture(blueprint);
  const goodOwners = f.api.listAiConversations;
  f.api.listAiConversations = async () => {throw Error('owner list failed');};
  await mount(f);
  check('initial owner-list transport failure is an explicit error, not an empty successful workspace', () => {assert(state.error); assert.equal(state.loading, false);});
  f.api.listAiConversations = goodOwners;
  await run(() => state.reload()); await run();
  check('initial owner-list failure has an explicit reload recovery path', () => assert.equal(state.basket.id, basketId));

  await run(() => state.changeUi({...state.ui, filters: {query: 'discard then resume'}}));
  await run(() => state.discardUi());
  const countBeforeResume = f.calls.mutate.length;
  await run(() => state.saveUi());
  check('resuming persistence for unchanged restored preferences needs no quota receipt', () => {
    assert.equal(state.uiDiscarded, false); assert.equal(f.calls.mutate.length, countBeforeResume);
  });

  f = fixture(blueprint);
  let nativeCommand;
  f.api.onDesktopCommand = handler => {nativeCommand = handler; return () => {};};
  await mount(f);
  await run(() => state.stage('organize')); await run(() => state.stage('preview'));
  await run(() => nativeCommand('back'));
  check('native back distinguishes same basket stages without creating another basket', () => {
    assert.equal(nav.target.paper.stage, 'organize'); assert.equal(state.ui.stage, 'organize'); assert.equal(state.basket.id, basketId);
  });
  await run(() => state.saveUi());
  await run(() => state.setDraft({...state.blueprint, title: '前进不可丢失'}));
  await run(() => nativeCommand('forward'));
  check('native forward still respects dirty blueprint guard', () => {assert.equal(nav.target.paper.stage, 'organize'); assert.equal(state.blueprint.title, '前进不可丢失');});
  await run(() => state.discardDraft()); await run(() => nativeCommand('forward'));
  check('native forward restores original same-basket preview reference', () => assert.equal(state.ui.stage, 'preview'));

  // Render actual OSS component compositions, with real pointer events handled by React Aria.
  f = fixture(blueprint); await mount(f, {component: PaperBlueprintWorkspace});
  await run(() => {}, 250); await run();
  check('candidate primary area contains complete question and real knowledge point, not a whole-card disclosure', () => {
    assert(find('paper-basket-candidate').textContent.includes(question.stem));
    assert(find('paper-basket-candidate').textContent.includes('一次函数')); assert.equal(document.querySelector('details,summary'), null);
    assert.equal(find('paper-basket-add').disabled, false);
    assert(find('paper-entry-automatic')); assert(!find('paper-mode'));
  });
  await press(find('paper-basket-add'));
  check('actual add button sends host version and updates only host-backed membership', () => {
    assert.equal(f.calls.mutate[0].operation.expectedSourceVersion, version);
    assert.equal(find('paper-basket-workspace').dataset.basketRevision, '2');
    assert.equal(find('paper-basket-add').disabled, true);
  });
  const withEntry = f.data.get(ownerA);
  await run(() => root.render(React.createElement(PaperBasketPreview, {basket: withEntry, disabled: false, dirty: false, onSnapshot() {}, onDecide() {}})));
  check('student preview contains pinned full body and excludes answer/source disclosure DOM', () => {
    assert(find('paper-basket-preview-entry').textContent.includes(question.stem));
    assert(!document.body.textContent.includes(question.answer)); assert(!document.body.textContent.includes(question.sourceTitle));
  });
  await press(find('paper-basket-teacher'));
  check('teacher preview restores progressive answer/source cards with no native triangle', () => {
    assert(document.body.textContent.includes(question.sourceTitle)); assert.equal(document.querySelector('details,summary'), null);
  });
  await run(() => root.render(React.createElement(PaperBasketPreview, {basket: {...withEntry, blueprint: {...blueprint, sections: []}},
    disabled: false, dirty: false, onSnapshot() {}, onDecide() {}})));
  check('removed section leaves its full pinned question visible in preview, never silently drops it', () => {
    assert(find('paper-basket-preview-entry').textContent.includes(question.stem)); assert(document.body.textContent.includes('原分节已移除'));
  });
  const entry = withEntry.entries[0];
  const secondEntry = {...entry, entryId: 'xibasketentry_99999999-9999-4999-8999-999999999999', position: 1};
  const organizerCalls = [];
  await run(() => root.render(React.createElement(PaperBasketOrganizer, {basket: {...withEntry, entries: [entry, secondEntry]},
    disabled: false, onMutate: async input => {organizerCalls.push(input); return false;}})));
  await press(find('paper-basket-down'));
  check('organizer sends complete stable section permutation, not display indices or question IDs', () => {
    assert.deepEqual(organizerCalls[0], {type: 'reorderSection', sectionId: entry.sectionId, entryIds: [secondEntry.entryId, entry.entryId]});
  });
  await press(find('paper-basket-remove'));
  check('remove addresses stable host entry ID and failed mutation keeps full pinned body', () => {
    assert.deepEqual(organizerCalls[1], {type: 'remove', entryId: entry.entryId});
    assert.equal(document.querySelectorAll('[data-testid="paper-basket-entry"]').length, 2);
  });
  let imageReady;
  window.omniEdu.getOriginalQuestionImage = async () => ({ok: true, value: 'data:image/png;base64,AA=='});
  await run(() => root.render(React.createElement(PaperQuestionImages, {question: {...question, document: {source: {parserVersion: 'v1'}}},
    contentVersion: version, onReady: value => {imageReady = value;}})));
  check('question image bytes alone cannot enable addition before actual image load', () => assert.equal(imageReady, false));
  await run(() => find('paper-basket-question-image').dispatchEvent(new window.Event('load')));
  check('question image load resolves readiness', () => assert.equal(imageReady, true));
  check('renderer uncaught errors are clean', () => assert.deepEqual(rendererErrors, []));
  console.log(JSON.stringify({success: true, passed, scope: 'mounted renderer only; no Electron/model/build'}));
} finally {
  if (root) await act(async () => root.unmount());
  await server.close(); dom.window.close();
}
