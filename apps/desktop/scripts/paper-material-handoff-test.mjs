import assert from 'node:assert/strict';
import {paperRendererEnvironment} from './acceptance/paper-instance-renderer-env.mjs';
import {instanceFixture, ownerA, ownerB, basketId, otherBasketId} from './acceptance/paper-instance-renderer-fixture.mjs';
import {deferred} from './acceptance/paper-basket-renderer-fixture.mjs';

const env = await paperRendererEnvironment();
const {React, root, run, load, find, press} = env;
let passed = 0, nav, native, state;
const check = (name, fn) => {fn(); passed++; console.log('PASS ' + name);};
try {
  const {defaultPaperBlueprint} = await load('shared/paper-blueprint.ts');
  const {DesktopFrame, useDesktopNavigation} = await load('renderer/components/desktop/DesktopFrame.tsx');
  const {paperMaterialActions, paperReturnTarget, openPaperMaterialSource} = await load('renderer/components/paper-ui/paper-material-handoff.ts');
  const {PaperBlueprintWorkspace} = await load('renderer/components/PaperBlueprintWorkspace.tsx');
  const {usePaperBasketWorkspace} = await load('renderer/components/paper-ui/usePaperBasketWorkspace.ts');
  const {MaterialsWorkspace} = await load('renderer/components/product/MaterialsWorkspace.tsx');
  const {QuestionNotebookWorkspace} = await load('renderer/components/QuestionNotebookWorkspace.tsx');
  const f = instanceFixture(defaultPaperBlueprint());
  let imports = 0, shown = 0;
  Object.assign(f.api, {
    onDesktopCommand: fn => {native = fn; return () => {};},
    listMaterials: async () => ({items: [], total: 0, offset: 0, limit: 20}),
    getMaterialJob: async () => ({active: false}),
    getMaterialQueue: async () => ({tasks: [], pending: 0, running: 0, invalid: 0}),
    getMaterialQuestionStatus: async () => undefined,
    getMaterialIndexStatus: async () => undefined,
    listMaterialBatches: async () => ({batches: [], total: 0, offset: 0}),
    importMaterialsBackground: async () => {imports++; return {status: 'canceled', items: [], resources: []};},
    listQuestionNotebookCategories: async () => [],
  });
  window.omniEdu = f.api;
  const refA = {sessionId: ownerA, basketId, stage: 'organize'};
  const refB = {sessionId: ownerB, basketId: otherBasketId, stage: 'preview'};
  const before = JSON.stringify([...f.data]);
  function Consumer() {
    nav = useDesktopNavigation();
    const a = paperMaterialActions(nav);
    if (nav.target.view === 'paper') return React.createElement(PaperBlueprintWorkspace, {initialSessionId: ownerA});
    if (nav.target.view === 'knowledge') return React.createElement(MaterialsWorkspace, {paperReturn: a.paperReturn,
      onReturnToPaper: a.returnToPaper, onOpenQuestionNotebook: () => a.openSourcePage('question_notebook')});
    if (nav.target.view === 'question_notebook') return React.createElement(QuestionNotebookWorkspace, {setStatus: () => {},
      paperReturn: a.paperReturn, onReturnToPaper: a.returnToPaper, onOpenMaterials: () => a.openSourcePage('knowledge')});
    return React.createElement('p', null, 'ordinary destination');
  }
  await run(() => root.render(React.createElement(DesktopFrame, null, React.createElement(Consumer))));
  await run(() => nav.navigate(paperReturnTarget(refA))); await run();
  await press(find('paper-basket-materials')); await run();
  check('actual basket entry reaches real materials with exact owner/basket/stage and no domain mutation', () => {
    assert(find('materials-workspace')); assert.deepEqual(nav.target.paperReturn, refA);
    assert.equal(JSON.stringify([...f.data]), before);
    assert.equal(f.calls.v2.filter(([name]) => ['create', 'mutate', 'snapshot'].includes(name)).length, 0);
  });
  await press(find('materials-import'));
  check('existing import cancellation leaves material-to-basket context and basket untouched', () => {
    assert.equal(imports, 1); assert(find('materials-notice').textContent.includes('已取消'));
    assert.deepEqual(nav.target.paperReturn, refA); assert.equal(JSON.stringify([...f.data]), before);
  });
  await press(find('materials-paper-notebook')); await run();
  check('actual notebook consumer receives the same return context without selecting or creating an AI session', () => {
    assert(find('question-notebook-paper-handoff')); assert.deepEqual(nav.target.paperReturn, refA);
    assert.equal(nav.target.sessionId, undefined);
  });
  await run(() => native('back'));
  check('native back returns to real materials with original handoff', () => {assert(find('materials-workspace')); assert.deepEqual(nav.target.paperReturn, refA);});
  await run(() => native('forward'));
  await press(find('question-notebook-return-paper')); await run();
  check('real return button reauthorizes and restores the exact basket/stage, without adding or editing', () => {
    assert.equal(find('paper-basket-workspace').dataset.basketId, basketId);
    assert.equal(find('paper-basket-workspace').dataset.stage, 'organize');
    assert.equal(JSON.stringify([...f.data]), before);
    assert(f.calls.v2.filter(([name, input]) => name === 'read' && input.basketId === basketId).length >= 2);
  });
  await run(() => nav.navigate({view: 'knowledge', paperReturn: refA}));
  await run(() => nav.navigate({view: 'knowledge', paperReturn: refB}));
  await run(() => native('back'));
  check('same materials view distinguishes A/B return identities in actual history', () => assert.deepEqual(nav.target.paperReturn, refA));
  await run(() => native('forward'));
  check('forward restores B instead of swallowing the second materials target', () => assert.deepEqual(nav.target.paperReturn, refB));
  const staleActions = paperMaterialActions(nav);
  let staleReturn;
  await run(() => {
    nav.navigate({view: 'knowledge', paperReturn: refA});
    staleReturn = staleActions.returnToPaper();
  });
  check('accepted newer intent rejects stale return even before the React batched commit', () => {
    assert.equal(staleReturn, false); assert.deepEqual(nav.target.paperReturn, refA);
  });
  f.data.get(ownerB).uiState = {stage: 'preview', filters: {query: 'saved B preference'}, offset: 12, scrollTop: 45};
  await run(() => nav.navigate({view: 'knowledge', paperReturn: refB}));
  await press(find('materials-return-paper')); await run();
  await press(find('paper-basket-materials'));
  await run(() => root.render(null));
  await run(() => root.render(React.createElement(DesktopFrame, null, React.createElement(Consumer))));
  await run(() => nav.navigate({view: 'paper', paper: {mode: 'basket'}})); await run();
  check('cold remount after C1 excursion uses existing basket reference and host preferences, despite active hint A', () => {
    assert.equal(find('paper-basket-workspace').dataset.basketId, otherBasketId);
    assert.equal(find('paper-basket-workspace').dataset.stage, 'preview');
    assert.deepEqual(f.data.get(ownerB).uiState, {stage: 'preview', filters: {query: 'saved B preference'}, offset: 12, scrollTop: 45});
    assert.equal(localStorage.getItem('xiaozhi.ui.paper-basket-reference.v1'), JSON.stringify({schema: 1, sessionId: ownerB, basketId: otherBasketId}));
  });
  await run(() => nav.navigate({view: 'knowledge'}));
  check('ordinary materials entry has no handoff controls or inherited basket', () => assert.equal(find('materials-paper-handoff'), null));

  await run(() => nav.navigate({view: 'question_notebook', paperReturn: refA}));
  const pendingSource = deferred(), request = {current: 0};
  f.api.getMaterialSource = () => pendingSource.promise;
  const opening = openPaperMaterialSource(nav, {}, request, () => {shown++;});
  await run(() => nav.navigate({view: 'teaching'}));
  await run(() => pendingSource.resolve({body: {}}));
  check('late authorized source read cannot navigate over a newer destination', () => {assert.equal(shown, 0); assert.equal(nav.target.view, 'teaching');});
  assert.equal(await opening, false);
  for (const sameBatch of [false, true]) {
    await run(() => nav.navigate({view: 'question_notebook', paperReturn: refA}));
    const origin = nav.target, pending = deferred();
    f.api.getMaterialSource = () => pending.promise;
    const oldRead = openPaperMaterialSource(nav, {}, request, () => {shown++;});
    if (sameBatch) await run(() => {native('back'); native('forward');});
    else {await run(() => native('back')); await run(() => native('forward'));}
    assert.equal(nav.target, origin, 'History really reused the original target object');
    await run(() => pending.resolve({body: {}}));
    check(`source read cannot revive after Back/Forward ABA${sameBatch ? ' in one React batch' : ''}`, () => {
      assert.equal(shown, 0); assert.equal(nav.target.view, 'question_notebook');
    });
    assert.equal(await oldRead, false);
  }
  const oldActions = paperMaterialActions(nav), oldIntent = nav.intent, sameEntry = nav.target;
  let acceptedOldReturn;
  await run(() => {native('back'); native('forward'); acceptedOldReturn = oldActions.returnToPaper();});
  check('same-batch ABA also rejects the old real return callback, not only async source reads', () => {
    assert.equal(nav.target, sameEntry); assert.equal(acceptedOldReturn, false);
    assert(nav.intent > oldIntent); assert.equal(nav.isCurrent(oldIntent), false);
  });
  for (const mutation of ['replace', 'consumeDraft', 'reject']) {
    await run(() => nav.navigate({view: 'ai', sessionId: ownerA, draft: 'request'}));
    await run(() => nav.navigate({view: 'question_notebook', paperReturn: refA}));
    const pending = deferred(), priorIntent = nav.intent;
    f.api.getMaterialSource = () => pending.promise;
    const reading = openPaperMaterialSource(nav, {}, request, () => {shown++;});
    await run(() => {
      if (mutation === 'replace') nav.navigate({...nav.target}, {replace: true});
      else nav[mutation](ownerA);
    });
    await run(() => pending.resolve({body: {}}));
    check(`${mutation} commits a new monotonic intent and invalidates the older source read`, () => {
      assert(nav.intent > priorIntent); assert.equal(shown, 0); assert.equal(nav.target.view, 'question_notebook');
    });
    assert.equal(await reading, false);
  }
  await run(() => nav.navigate({view: 'question_notebook', paperReturn: refB}));
  const first = deferred(), second = deferred(); let calls = 0;
  f.api.getMaterialSource = () => (++calls === 1 ? first.promise : second.promise);
  const oldSource = openPaperMaterialSource(nav, {}, request, () => {shown += 10;});
  const newSource = openPaperMaterialSource(nav, {}, request, () => {shown++;});
  await run(() => first.resolve({body: {}}));
  assert.equal(await oldSource, false);
  await run(() => second.resolve({body: {}}));
  assert.equal(await newSource, true);
  check('latest source intent wins and carries B, without storing source/body facts in history', () => {
    assert.equal(shown, 1); assert.deepEqual(nav.target, {view: 'knowledge', paperReturn: refB});
  });

  await run(() => root.render(null)); localStorage.clear();
  function Hook() {state = usePaperBasketWorkspace(ownerA); nav = useDesktopNavigation(); return React.createElement('p', null, state.basket?.id);}
  await run(() => root.render(React.createElement(DesktopFrame, null, React.createElement(Hook)))); await run();
  await run(() => state.setDraft({...state.blueprint, title: 'unsaved'}));
  let left;
  await run(async () => {left = await state.leave('knowledge');});
  check('materials leave rejects a dirty blueprint through the actual basket hook', () => assert.equal(left, false));
  await run(() => state.discardDraft());
  const mutation = f.api.mutatePaperBasketV2;
  f.api.mutatePaperBasketV2 = async () => ({ok: false, error: 'unavailable'});
  await run(() => state.changeUi({...state.ui, filters: {query: 'unsaved preference'}}));
  await run(async () => {left = await state.leave('knowledge');});
  check('failed preference flush stays on origin with explicit storage failure, no false handoff', () => {
    assert.equal(left, false); assert.notEqual(nav.target.view, 'knowledge'); assert(state.uiSaveBlocked); assert(state.error);
  });
  f.api.mutatePaperBasketV2 = mutation;
  await run(() => state.discardUi());
  const p = deferred();
  f.api.readPaperBasketV2 = () => p.promise;
  await run(() => {void state.reload();});
  await run(() => nav.navigate({view: 'teaching'}));
  await run(() => p.resolve({ok: true, value: structuredClone(f.data.get(ownerA))}));
  check('late basket reload cannot resurrect paper after a newer navigation', () => assert.equal(nav.target.view, 'teaching'));
  console.log(JSON.stringify({success: true, passed, scope: 'Mounted production navigation/materials/notebook/basket and shared App actions; DTO fixture only, not Electron/upload/OCR acceptance'}));
} finally {await env.close();}
