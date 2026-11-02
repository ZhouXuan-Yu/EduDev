import assert from 'node:assert/strict';
import {paperRendererEnvironment} from './acceptance/paper-instance-renderer-env.mjs';
import {instanceFixture, ownerA, basketId} from './acceptance/paper-instance-renderer-fixture.mjs';
import {deferred} from './acceptance/paper-basket-renderer-fixture.mjs';

// Actual mounted workspace + official controls; controlled API timing, not desktop acceptance.
const env = await paperRendererEnvironment();
const {React, root, run, load, find, press, fill} = env;
const previousFocusEvent = Object.getOwnPropertyDescriptor(globalThis, 'FocusEvent');
Object.defineProperty(globalThis, 'FocusEvent', {value: env.dom.window.FocusEvent, configurable: true});
const windowErrors = [];
env.dom.window.addEventListener('error', event => windowErrors.push(String(event.error || event.message)));
let passed = 0, nav, native;
const check = (name, work) => {work(); passed++; console.log('PASS ' + name);};
try {
  const {defaultPaperBlueprint} = await load('shared/paper-blueprint.ts');
  const {extractReferenceStructure} = await load('main/education/paper-reference-extract.ts');
  const {DesktopFrame, useDesktopNavigation} = await load('renderer/components/desktop/DesktopFrame.tsx');
  const {PaperBasketWorkspace} = await load('renderer/components/paper-ui/PaperBasketWorkspace.tsx');
  const f = instanceFixture(defaultPaperBlueprint());
  for (const basket of f.data.values()) basket.uiState.stage = 'select';
  const saved = JSON.stringify(f.data.get(ownerA));
  const source = {resourceId: 'resource_99999999-9999-4999-8999-999999999999', version: 'a'.repeat(64), title: 'Unit reference', filename: 'owned.txt', chunkCount: 1, parseStatus: 'ready'};
  const candidate = extractReferenceStructure({units: [{resourceId: source.resourceId, version: source.version, offset: 0,
    chunk: {id: 'chunk_88888888-8888-4888-8888-888888888888', chunkIndex: 0, contentMd: '标题：原始提取名称\n总分：6分\n一、选择题（共2题，每题3分）', containsPersonalData: false}}],
    complete: true, totalChunks: 1, parseEngine: 'unit-only', bodyDigest: 'b'.repeat(64)});
  const lists = [], extracts = [], cancels = [];
  let listReply = async () => ({ok: true, value: {items: [source], offset: 0, hasMore: true}});
  let extractReply = async () => ({ok: true, value: structuredClone(candidate)});
  window.omniEdu = {...f.api, onDesktopCommand: fn => {native = fn; return () => {};},
    listPaperReferenceSources: input => {lists.push(input); return listReply(input);},
    extractPaperReference: input => {extracts.push(input); return extractReply(input);},
    cancelPaperReferenceExtraction: async input => {cancels.push(input); return {ok: true, value: true};}};
  function Consumer() {nav = useDesktopNavigation(); return React.createElement(PaperBasketWorkspace, {initialSessionId: ownerA});}
  let mounts = 0;
  async function mount() {
    await run(() => root.render(React.createElement(DesktopFrame, {key: ++mounts}, React.createElement(Consumer))));
    await run(); await run(() => nav.navigate({view: 'paper', sessionId: ownerA, paper: {mode: 'basket', basketId, stage: 'select'}})); await run();
  }
  const extractButton = () => find('paper-reference-extract-' + source.resourceId);
  await mount();
  await press(find('paper-basket-reference'));
  check('real workspace entry reads typed bounded source list for the current basket', () => {
    assert(find('paper-reference-panel')); assert.equal(lists[0].basketId, basketId); assert.equal(lists[0].sessionId, ownerA);
    assert.equal(lists[0].offset, 0); assert.equal(find('paper-reference-source').dataset.resourceId, source.resourceId);
    assert(find('paper-basket-owner').closest('[hidden]'));
    assert(find('paper-reference-sources')); assert(find('paper-reference-panel').querySelector('.card'));
  });
  await press(find('paper-reference-next'));
  check('next-page action requests the actual source page rather than slicing a fake local library', () => assert.equal(lists.at(-1).offset, 50));
  await fill(find('paper-reference-search'), 'real query'); await press(find('paper-reference-search-submit'));
  check('explicit search resets offset and forwards real query', () => {assert.equal(lists.at(-1).query, 'real query'); assert.equal(lists.at(-1).offset, 0);});
  await press(extractButton());
  check('actual candidate controls display unknown values and original evidence without a fake save/apply action', () => {
    assert.equal(find('paper-reference-input-title').value, '原始提取名称');
    assert.equal(find('paper-reference-input-subject').value, ''); assert.match(find('paper-reference-input-layout.paper').textContent, /待选择/);
    assert(find('paper-reference-evidence-title')); assert.match(find('paper-reference-coverage').textContent, /1\/1/);
    assert(![...find('paper-reference-panel').querySelectorAll('button')].some(b => /保存模板|应用结构|应用版式/.test(b.textContent)));
    assert.equal(document.querySelectorAll('details,summary').length, 0);
  });
  await fill(find('paper-reference-input-title'), '教师修订保留');
  check('teacher input does not overwrite original extracted value or its evidence', () => {
    assert.equal(find('paper-reference-input-title').value, '教师修订保留');
    assert.match(find('paper-reference-field-title').textContent, /原文提取：原始提取名称/);
    assert.match(find('paper-reference-field-title').textContent, /教师修订/);
  });
  await run(() => assert.equal(nav.navigate({view: 'teaching'}), false));
  await run(() => native('back'));
  check('dirty candidate blocks actual DesktopFrame navigation/back and keeps same basket', () => {
    assert.equal(nav.target.view, 'paper'); assert.equal(find('paper-basket-workspace').dataset.basketId, basketId);
    assert.equal(find('paper-reference-input-title').value, '教师修订保留');
    const unload = new window.Event('beforeunload', {cancelable: true}); window.dispatchEvent(unload); assert(unload.defaultPrevented);
  });
  await press(find('paper-reference-change-source'));
  check('changing source cannot silently replace edited input', () => {assert(find('paper-reference-discard-prompt')); assert.equal(extracts.length, 1);});
  await press([...find('paper-reference-discard-prompt').querySelectorAll('button')].find(b => b.textContent === '继续核对'));
  const recheck = deferred(); extractReply = () => recheck.promise;
  await press(find('paper-reference-recheck'));
  check('source recheck retains and locks editable input while actual read is pending', () => {
    assert(find('paper-reference-input-title').disabled); assert.equal(find('paper-reference-input-title').value, '教师修订保留');
  });
  await run(() => recheck.resolve({ok: false, error: 'source_changed'}));
  check('source rejection is visible and preserves teacher input plus original source evidence', () => {
    assert.match(find('paper-reference-error').textContent, /已变化/); assert.equal(find('paper-reference-input-title').value, '教师修订保留');
    assert.match(find('paper-reference-field-title').textContent, /原始提取名称/);
  });
  await press(find('paper-reference-cancel'));
  check('cancel of edited input requires explicit discard', () => assert(find('paper-reference-discard-prompt')));
  await press(find('paper-reference-discard'));
  check('explicit discard closes and releases guard without changing host basket or members', () => {
    assert(!find('paper-reference-panel')); assert.equal(JSON.stringify(f.data.get(ownerA)), saved);
    assert.equal(f.calls.v2.filter(([kind]) => ['mutate', 'snapshot', 'create'].includes(kind)).length, 0);
    const unload = new window.Event('beforeunload', {cancelable: true}); window.dispatchEvent(unload); assert(!unload.defaultPrevented);
    assert.equal(document.activeElement, find('paper-basket-reference'));
  });
  const late = deferred(); extractReply = () => late.promise;
  await press(find('paper-basket-reference')); await press(extractButton());
  const cancelled = extracts.at(-1); await press(find('paper-reference-cancel'));
  check('cancelling pending extraction uses its exact request and basket', () => {
    assert.equal(cancels.at(-1).requestId, cancelled.requestId); assert.equal(cancels.at(-1).basketId, basketId); assert(!find('paper-reference-panel'));
  });
  extractReply = async () => ({ok: true, value: {...structuredClone(candidate), title: {...candidate.title, value: '新的有效候选'}}});
  await press(find('paper-basket-reference')); await press(extractButton());
  await run(() => late.resolve({ok: true, value: structuredClone(candidate)}));
  check('cancelled late reply cannot replace a newer mounted candidate', () => assert.equal(find('paper-reference-input-title').value, '新的有效候选'));
  await press(find('paper-reference-add-section'));
  check('teacher-added unknown section contains no invented type/count/points', () => {
    for (const key of ['label', 'questionType', 'count', 'points']) assert.equal(find('paper-reference-input-sections.1.' + key).value, '');
  });
  await press(find('paper-reference-cancel')); await press(find('paper-reference-discard'));
  const staleList = deferred(); listReply = () => staleList.promise;
  await press(find('paper-basket-reference')); await press(find('paper-reference-cancel'));
  listReply = async () => ({ok: true, value: {items: [source], offset: 0, hasMore: false}});
  await press(find('paper-basket-reference'));
  await run(() => staleList.resolve({ok: true, value: {items: [], offset: 50, hasMore: true}}));
  check('late list results cannot replace a reopened current picker', () => assert(find('paper-reference-source')));
  const unmounted = deferred(); extractReply = () => unmounted.promise;
  await press(extractButton()); await mount();
  await run(() => unmounted.resolve({ok: true, value: structuredClone(candidate)}));
  check('unmounted request is cancelled and cannot reopen or publish into another workspace lifetime', () => {
    assert(!find('paper-reference-panel')); assert.equal(cancels.at(-1).requestId, extracts.at(-1).requestId);
  });
  await press(find('paper-basket-reference')); await press(find('paper-reference-import')); await run();
  check('existing materials navigation retains exact paper return binding and never creates a session', () => {
    assert.equal(nav.target.view, 'knowledge'); assert.equal(nav.target.paperReturn.basketId, basketId); assert.equal(nav.target.paperReturn.sessionId, ownerA);
    assert.equal(JSON.stringify(f.data.get(ownerA)), saved);
  });
  check('mounted official controls complete without window errors', () => assert.deepEqual(windowErrors, []));
  console.log(`paper-reference mounted consumers: ${passed} passed; controlled timing, no desktop/model`);
} finally {
  await env.close();
  if (previousFocusEvent) Object.defineProperty(globalThis, 'FocusEvent', previousFocusEvent); else delete globalThis.FocusEvent;
}
