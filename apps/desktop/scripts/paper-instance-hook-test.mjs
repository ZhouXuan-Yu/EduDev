import assert from 'node:assert/strict';
import {paperRendererEnvironment} from './acceptance/paper-instance-renderer-env.mjs';
import {instanceFixture, ownerA, ownerB, basketId, entryId, sourceContent} from './acceptance/paper-instance-renderer-fixture.mjs';
import {deferred} from './acceptance/paper-basket-renderer-fixture.mjs';

const env = await paperRendererEnvironment();
const {React, root, run, load} = env;
let state, nav, passed = 0;
const check = (name, fn) => {fn(); passed++; console.log('PASS ' + name);};
try {
  const {defaultPaperBlueprint} = await load('shared/paper-blueprint.ts');
  const {DesktopFrame, useDesktopNavigation} = await load('renderer/components/desktop/DesktopFrame.tsx');
  const {usePaperBasketWorkspace} = await load('renderer/components/paper-ui/usePaperBasketWorkspace.ts');
  const {instanceDraftKey, readInstanceDrafts} = await load('renderer/components/paper-ui/paper-instance-draft-storage.ts');
  const blueprint = defaultPaperBlueprint();
  const f = instanceFixture(blueprint);
  const otherBefore = JSON.stringify(f.data.get(ownerB));
  function Consumer() {state = usePaperBasketWorkspace(ownerA); nav = useDesktopNavigation(); return React.createElement('p', null, state.basket?.id || 'loading');}
  async function mount(clear = false) {
    await run(() => root.render(null)); if (clear) localStorage.clear(); window.omniEdu = f.api;
    await run(() => root.render(React.createElement(DesktopFrame, null, React.createElement(Consumer)))); await run();
  }
  await mount(true);
  check('V2 list/read are selected without calling V1 or upgrading on read', () => {
    assert.equal(state.basket.schemaVersion, 'xiaozhi.paper-basket.v2'); assert.equal(state.basket.persistedSchemaVersion, 'xiaozhi.paper-basket.v1');
    assert.equal(f.calls.list.length, 0); assert.equal(f.calls.read.length, 0); assert(state.instanceDrafts.ready);
  });
  const changed = {...sourceContent(), question: {mode: 'edited', blocks: [{type: 'text', text: 'UNIT edited question'}]},
    answer: {mode: 'edited', blocks: [{type: 'text', text: 'UNIT private answer'}]}};
  await run(() => state.instanceDrafts.update(state.basket.entries[0], changed));
  await run(() => assert.equal(nav.navigate({view: 'teaching'}), false));
  check('input is separate from saved host content and creates no domain mutation', () => {
    assert(state.instanceDrafts.dirty); assert.equal(state.basket.entries[0].instance.content.question.mode, 'source');
    assert.equal(f.calls.v2.filter(([name]) => name === 'mutate').length, 0);
  });
  await run(() => state.stage('preview')); await run(() => state.chooseOwner(ownerB));
  check('draft blocks stage and owner changes instead of losing input', () => {
    assert.equal(state.ownerId, ownerA); assert.equal(state.ui.stage, 'organize'); assert.equal(state.instanceDrafts.dirty, true);
  });
  await mount();
  check('cold remount revalidates host then restores only local input with exact base revision/digest', () => {
    const draft = state.instanceDrafts.drafts[entryId]; assert.deepEqual(draft.content, changed);
    assert.equal(draft.baseRevision, state.basket.entries[0].instance.instanceRevision);
    assert.equal(draft.baseDigest, state.basket.entries[0].instance.contentDigest);
  });
  const mutation = f.api.mutatePaperBasketV2;
  f.api.mutatePaperBasketV2 = async () => ({ok: false, error: 'conflict'});
  await run(() => state.instanceDrafts.save(state.basket.entries[0]));
  check('CAS conflict preserves input and visible failure', () => {assert(state.instanceDrafts.dirty); assert(state.error);});
  f.api.mutatePaperBasketV2 = mutation;
  const remote = f.data.get(ownerA); remote.entries[0].instance.instanceRevision++;
  remote.entries[0].instance.contentDigest = 'b'.repeat(64); remote.revision++;
  await run(() => state.reload());
  const requests = f.calls.v2.length;
  await run(() => state.instanceDrafts.save(state.basket.entries[0]));
  check('host revision/digest mismatch prevents submission until explicit rebase, retaining comparison input', () => {
    assert.equal(f.calls.v2.length, requests); assert.equal(state.instanceDrafts.drafts[entryId].baseRevision, 1);
  });
  await run(() => state.instanceDrafts.rebase(state.basket.entries[0]));
  await run(() => state.instanceDrafts.save(state.basket.entries[0])); await run();
  check('explicit save sends exact current basket and instance CAS through V2 and settles input from host reply', () => {
    const input = f.calls.v2.filter(([name, input]) => name === 'mutate' && input.operation.type === 'editEntry').at(-1)[1];
    assert.equal(input.schemaVersion, 'xiaozhi.paper-basket.v2'); assert.equal(input.expectedRevision, 2);
    assert.equal(input.operation.expectedInstanceRevision, 2); assert.equal(state.instanceDrafts.dirty, false);
    assert.deepEqual(state.basket.entries[0].instance.content, changed); assert.equal(state.basket.entries[0].reviewCurrent, false);
    assert.equal(JSON.stringify(f.data.get(ownerB)), otherBefore);
  });
  await run(() => state.instanceDrafts.update(state.basket.entries[0], {...changed, analysis: {mode: 'edited', blocks: [{type: 'text', text: ''}]}}));
  await mount();
  check('invalid empty teacher input survives cold recovery without being submitted', () => {
    assert.equal(state.instanceDrafts.drafts[entryId].content.analysis.blocks[0].text, ''); assert(state.instanceDrafts.dirty);
  });
  await run(() => state.instanceDrafts.discard(entryId));
  await run(() => state.instanceDrafts.update(state.basket.entries[0], {...changed, analysis: {mode: 'edited', blocks: [{type: 'text', text: 'uncertain input'}]}}));
  const dropped = deferred(); let pendingSave;
  let originalRequest;
  f.api.mutatePaperBasketV2 = input => {originalRequest = structuredClone(input); return dropped.promise;};
  await run(() => {pendingSave = state.instanceDrafts.save(state.basket.entries[0]);});
  await run(() => dropped.reject(Error('unit dropped reply'))); await pendingSave;
  const retryInput = state.instanceDrafts.drafts[entryId].content;
  f.api.mutatePaperBasketV2 = mutation;
  await run(() => state.retry()); await run();
  check('uncertain save retry retains content and uses the original captured request', () => {
    assert.equal(state.instanceDrafts.dirty, false); assert.deepEqual(state.basket.entries[0].instance.content, retryInput);
    assert.deepEqual(f.calls.v2.filter(([name]) => name === 'mutate').at(-1)[1], originalRequest);
  });
  await run(() => state.instanceDrafts.update(state.basket.entries[0], changed)); await run(() => {}, 300);
  const key = instanceDraftKey('unit-owned-data-root-A', ownerA, basketId);
  check('recovery cache stores only input/base references, not full source or review facts', () => {
    const raw = localStorage.getItem(key); assert(!raw.includes('sourceBinding')); assert(!raw.includes('reviewedAt'));
    assert.equal(Object.keys(readInstanceDrafts(key).drafts).length, 1);
  });
  let namespaceReads = 0;
  f.api.getDataRoot = async () => {namespaceReads++; throw Error('unit root unavailable');};
  await run(() => state.reload()); await run(() => {}, 350);
  check('failed data-root revalidation hides input but retains guard and never retries automatically', () => {
    assert.equal(namespaceReads, 1); assert.equal(state.instanceDrafts.ready, false);
    assert.equal(Object.keys(state.instanceDrafts.drafts).length, 0); assert(state.instanceDrafts.dirty);
    assert(state.instanceDrafts.cacheError); assert.equal(Object.keys(readInstanceDrafts(key).drafts).length, 1);
  });
  f.api.getDataRoot = async () => {namespaceReads++; return 'unit-owned-data-root-A';};
  const mutationsBeforeNamespace = f.calls.v2.filter(([name]) => name === 'mutate').length;
  await run(() => state.instanceDrafts.retryNamespace());
  check('explicit namespace retry restores exact retained input after API recovery without clearing guard or domain writes', () => {
    assert.equal(namespaceReads, 2); assert(state.instanceDrafts.ready); assert(state.instanceDrafts.dirty);
    assert.deepEqual(state.instanceDrafts.drafts[entryId].content, changed); assert.equal(state.instanceDrafts.cacheError, '');
    assert.equal(f.calls.v2.filter(([name]) => name === 'mutate').length, mutationsBeforeNamespace);
  });
  const rootRead = deferred();
  f.api.getDataRoot = () => rootRead.promise;
  await run(() => state.reload());
  check('a new authorized basket read waits for its data-root namespace before exposing cached input', () => {
    assert.equal(state.instanceDrafts.ready, false);
    assert.equal(Object.keys(state.instanceDrafts.drafts).length, 0);
    assert.equal(state.instanceDrafts.dirty, true, 'Existing unsaved input still protects navigation during validation');
  });
  await run(() => rootRead.resolve('unit-owned-data-root-B'));
  check('a live data-root change with identical IDs never adopts input from the previous root', () => {
    assert.equal(state.instanceDrafts.ready, true); assert.equal(state.instanceDrafts.dirty, false);
    assert.equal(Object.keys(state.instanceDrafts.drafts).length, 0);
    assert.equal(Object.keys(readInstanceDrafts(key).drafts).length, 1);
  });
  f.api.getDataRoot = async () => 'unit-owned-data-root-B';
  await mount();
  check('same owner/basket IDs in another data root never recover the first root input', () => {
    assert.equal(state.instanceDrafts.dirty, false); assert.equal(Object.keys(state.instanceDrafts.drafts).length, 0);
    assert.equal(Object.keys(readInstanceDrafts(key).drafts).length, 1);
  });
  await run(() => state.instanceDrafts.update(state.basket.entries[0], changed));
  const storagePrototype = Object.getPrototypeOf(localStorage), setItem = storagePrototype.setItem;
  let cacheAttempts = 0;
  storagePrototype.setItem = function(key, value) {
    if (key.startsWith('xiaozhi.ui.paper-instance-input.')) {cacheAttempts++; throw Error('unit cache quota');}
    return setItem.call(this, key, value);
  };
  try {
    await run(() => {}, 350); await run(() => {}, 600);
    check('cache quota failure is honest and stops automatic retries without changing saved content', () => {
      assert.equal(cacheAttempts, 1); assert(state.instanceDrafts.cacheError); assert(state.instanceDrafts.dirty);
    });
    await run(() => state.instanceDrafts.discard(entryId));
    check('explicit input discard can remove its cache and release navigation even at quota', () => {
      assert.equal(state.instanceDrafts.dirty, false); assert.equal(state.instanceDrafts.cacheError, '');
    });
  } finally {storagePrototype.setItem = setItem;}
  const keyB = instanceDraftKey('unit-owned-data-root-B', ownerA, basketId);
  await run(() => root.render(null));
  const damaged = '{"schema":99,"private":"unit corrupt record"}'; localStorage.setItem(keyB, damaged);
  await mount(); await run(() => {}, 350);
  check('unknown cache schema remains untouched and is never promoted to host facts or silently erased', () => {
    assert(state.instanceDrafts.cacheError); assert.equal(localStorage.getItem(keyB), damaged); assert.equal(state.instanceDrafts.dirty, false);
  });
  await run(() => state.instanceDrafts.retryCache());
  await run(() => state.instanceDrafts.update(state.basket.entries[0], changed));
  f.data.get(ownerA).entries = []; f.data.get(ownerA).count = 0; f.data.get(ownerA).revision++;
  await run(() => state.reload()); await mount();
  check('host-removed entry leaves a recoverable orphan input, never an invented basket member', () => {
    assert.equal(state.basket.entries.length, 0); assert(state.instanceDrafts.drafts[entryId]); assert(state.instanceDrafts.dirty);
  });
  console.log(JSON.stringify({success: true, passed, scope: 'Real mounted renderer hook and V2 DTO callbacks; unit-only host fixture, no SQLite/Electron/model acceptance'}));
} finally {await env.close();}
