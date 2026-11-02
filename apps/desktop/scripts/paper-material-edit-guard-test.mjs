import assert from 'node:assert/strict';
import {paperRendererEnvironment} from './acceptance/paper-instance-renderer-env.mjs';
import {bankQuestion, replacementQuestion, ownerA, basketId, version} from './acceptance/paper-instance-renderer-fixture.mjs';
import {deferred} from './acceptance/paper-basket-renderer-fixture.mjs';

const env = await paperRendererEnvironment();
const {React, root, run, load, find, press, fill} = env;
let passed = 0, nav, native, mounts = 0, reads = 0;
const check = (name, fn) => {fn(); passed++; console.log('PASS ' + name);};
const clickText = (root, text) => {
  const buttons = [...root.querySelectorAll('button')].filter(button => button.textContent === text);
  assert.equal(buttons.length, 1, 'Unique real action ' + text); return press(buttons[0]);
};
try {
  const {DesktopFrame, useDesktopNavigation} = await load('renderer/components/desktop/DesktopFrame.tsx');
  const {paperMaterialActions} = await load('renderer/components/paper-ui/paper-material-handoff.ts');
  const {QuestionNotebookWorkspace} = await load('renderer/components/QuestionNotebookWorkspace.tsx');
  const archive = {schemaVersion: 'xiaozhi.question-archive.v1', extractor: 'numbered-text.v1', number: '1',
    state: 'rule_extracted', sources: [{schemaVersion: 'xiaozhi.material-source.v1',
      resourceId: 'resource_00000000-0000-4000-8000-000000000001', version, offset: 0,
      chunkId: 'chunk_00000000-0000-4000-8000-000000000002', bodyVersion: version}],
    issues: [], sourceRisks: [], sourceChecked: false, answerOrigin: 'teacher', analysisOrigin: 'teacher'};
  const archived = {...bankQuestion, sourceKind: 'teacher_resource', archive};
  const contextQuestion = {...replacementQuestion, answer: '', analysis: '', document: {
    schemaVersion: 'xiaozhi.question-document.v1',
    source: {resourceId: 'resource_00000000-0000-4000-8000-000000000001', resourceVersion: version, parserVersion: 'unit.v1', ocrVersion: ''},
    blocks: [{id: 'statement', kind: 'text', text: replacementQuestion.stem, anchors: [{page: 1, box: [0, 0, 1, 1]}]}],
    answer: {origin: 'missing', text: '', anchors: []}, analysis: {origin: 'missing', text: '', anchors: []},
  }};
  const rows = [archived, contextQuestion].map(question => ({...question, version, categories: [], usageCount: 0, bookmarked: false}));
  let archiveSave = async () => archived, contextSave = async () => ({ok: true, value: {}}), createSave = async () => bankQuestion;
  const archiveWrites = []; let creations = 0, contextWrites = 0;
  const normalRead = async () => ({items: structuredClone(rows), total: 40});
  let listRead = normalRead;
  window.omniEdu = {
    getDesktopChrome: async () => ({enabled: false}), onDesktopCommand: fn => {native = fn; return () => {};},
    listQuestionNotebookCategories: async () => [],
    listQuestionNotebook: async () => {reads++; return listRead();},
    getArchivedQuestionVersion: async () => ({question: structuredClone(archived), version}),
    editArchivedQuestion: input => {archiveWrites.push(structuredClone(input)); return archiveSave(input);},
    completeOriginalQuestionContext: input => {contextWrites++; return contextSave(input);},
    createQuestionBankItem: input => {creations++; return createSave(input);},
  };
  function Consumer() {
    nav = useDesktopNavigation(); const a = paperMaterialActions(nav);
    return nav.target.view === 'question_notebook' ? React.createElement(QuestionNotebookWorkspace, {setStatus: () => {},
      paperReturn: a.paperReturn, onReturnToPaper: a.returnToPaper, onOpenMaterials: () => a.openSourcePage('knowledge')}) : React.createElement('p', null, nav.target.view);
  }
  async function mount(withContext = true) {
    await run(() => root.render(React.createElement(DesktopFrame, {key: ++mounts}, React.createElement(Consumer))));
    await run(() => nav.navigate({view: 'question_notebook', ...(withContext ? {paperReturn: {sessionId: ownerA, basketId, stage: 'organize'}} : {})})); await run();
  }
  const expectBlocked = async name => {
    await press(find('question-notebook-return-paper'));
    await run(() => native('back'));
    check(name, () => assert.equal(nav.target.view, 'question_notebook'));
  };
  await mount();
  await press(find('question-archive-edit-' + archived.id));
  await fill(find('question-archive-stem'), 'UNIT retained archive input');
  await press(find('question-archive-source-checked'));
  await expectBlocked('archive input blocks real return and native back');
  const beforeReads = reads;
  await press(find('question-notebook-next'));
  await fill(find('question-notebook-search'), 'must not replace editor');
  await press(find('question-context-open'));
  check('actual paging/filter/other-editor actions cannot discard the active archive editor', () => {
    assert.equal(reads, beforeReads); assert.equal(find('question-notebook-search').value, '');
    assert.equal(find('question-context-cancel'), null); assert.equal(find('question-archive-stem').value, 'UNIT retained archive input');
  });
  const outside = find('question-notebook-return-paper'); await run(() => outside.focus());
  const tab = new window.KeyboardEvent('keydown', {key: 'Tab', bubbles: true, cancelable: true});
  await run(() => outside.dispatchEvent(tab));
  const shiftTab = new window.KeyboardEvent('keydown', {key: 'Tab', shiftKey: true, bubbles: true, cancelable: true});
  await run(() => outside.dispatchEvent(shiftTab));
  await run(() => find('question-archive-stem').focus());
  check('Tab and Shift+Tab outside editor are never captured, and editor remains focusable', () => {
    assert.equal(tab.defaultPrevented, false); assert.equal(shiftTab.defaultPrevented, false);
    assert.equal(document.activeElement, find('question-archive-stem'));
  });
  const unload = new window.Event('beforeunload', {cancelable: true}); window.dispatchEvent(unload);
  check('unsaved editor also guards window unload', () => assert(unload.defaultPrevented));
  const pending = deferred(); archiveSave = () => pending.promise;
  await press(find('question-archive-save'));
  await expectBlocked('archive save in flight cannot leave or cancel');
  check('archive fields cannot change while the captured version is saving', () => assert(find('question-archive-stem').disabled));
  await run(() => pending.reject(new Error('source_changed')));
  await expectBlocked('failed archive save retains its input and navigation guard');
  check('failed archive save displays failure and keeps exact text', () => {
    assert(find('question-archive-' + archived.id).textContent.includes('保存失败'));
    assert.equal(find('question-archive-stem').value, 'UNIT retained archive input');
  });
  archiveSave = async () => archived;
  await press(find('question-archive-save'));
  check('rule-extracted correction retries the same questionID/version/sourceChecked and never calls new-question creation', () => {
    assert.equal(archiveWrites.length, 2);
    for (const input of archiveWrites) {
      assert.equal(input.questionId, archived.id); assert.equal(input.version, version); assert.equal(input.sourceChecked, true);
      assert.equal(input.fields.stem, 'UNIT retained archive input');
    }
    assert.equal(creations, 0);
  });
  await press(find('question-notebook-return-paper'));
  check('successful archive save releases the actual return path', () => assert.equal(nav.target.view, 'paper'));
  await mount(); await press(find('question-archive-edit-' + archived.id));
  await clickText(find('question-archive-' + archived.id), '取消编辑');
  await press(find('question-notebook-return-paper'));
  check('explicit archive cancel releases return without saving', () => assert.equal(nav.target.view, 'paper'));

  await mount(); await press(find('question-context-open'));
  await fill(find('projection-statement-text'), 'UNIT retained complete statement');
  const select = (id, value) => run(() => {find(id).value = value; find(id).dispatchEvent(new window.Event('change', {bubbles: true}));});
  await select('projection-statement-state', 'provided');
  for (const key of ['formulas', 'tables', 'figures', 'choices', 'subquestions']) await select('projection-' + key + '-state', 'not_applicable');
  await press(find('question-context-complete').querySelector('input'));
  await expectBlocked('complete-context editor participates in the real notebook guard');
  const contextPending = deferred(); contextSave = () => contextPending.promise;
  await press(find('question-context-save'));
  await expectBlocked('context save in flight keeps return guarded');
  await run(() => contextPending.resolve({ok: false, error: 'conflict'}));
  await expectBlocked('context conflict keeps form and guard for retry or cancel');
  check('context failure preserves teacher projection and visible error', () => {
    assert.equal(find('projection-statement-text').value, 'UNIT retained complete statement'); assert(find('question-context-error'));
  });
  contextSave = async () => ({ok: true, value: {}});
  await press(find('question-context-save'));
  await press(find('question-notebook-return-paper'));
  check('successful context save releases return', () => assert.equal(nav.target.view, 'paper'));
  await mount(); await press(find('question-context-open')); await press(find('question-context-cancel'));
  await press(find('question-notebook-return-paper'));
  check('explicit context cancel releases return', () => assert.equal(nav.target.view, 'paper'));

  // Exercise the actual Notebook -> editor -> host-write -> Notebook-readback chain.
  // A committed write must never be repeated just because its readback failed.
  for (const kind of ['archive', 'context']) for (const release of ['reread', 'cancel']) {
    await mount();
    const text = `UNIT ${kind} committed input for ${release}`;
    if (kind === 'archive') {
      await press(find('question-archive-edit-' + archived.id));
      await fill(find('question-archive-stem'), text);
      await press(find('question-archive-source-checked'));
    } else {
      await press(find('question-context-open'));
      await fill(find('projection-statement-text'), text);
      await select('projection-statement-state', 'provided');
      for (const key of ['formulas', 'tables', 'figures', 'choices', 'subquestions'])
        await select('projection-' + key + '-state', 'not_applicable');
      await press(find('question-context-complete').querySelector('input'));
    }
    const inputId = kind === 'archive' ? 'question-archive-stem' : 'projection-statement-text';
    const saveId = `question-${kind}-save`, originalInput = find(inputId);
    const writeCount = () => kind === 'archive' ? archiveWrites.length : contextWrites;
    const beforeWrites = writeCount(), beforeCreates = creations, readback = deferred();
    listRead = () => readback.promise;
    await press(find(saveId));
    check(`${kind}/${release}: committed write keeps the same editor mounted during deferred readback`, () => {
      assert.equal(writeCount(), beforeWrites + 1);
      assert(originalInput.isConnected); assert.equal(find(inputId), originalInput);
      assert(find('question-notebook-loading')); assert.equal(originalInput.value, text);
      const cancel = kind === 'archive'
        ? [...find('question-archive-' + archived.id).querySelectorAll('button')].find(button => button.textContent === '取消编辑')
        : find('question-context-cancel');
      assert(cancel.disabled, 'A pending readback cannot be cancelled before its outcome');
    });
    await expectBlocked(`${kind}/${release}: deferred post-write readback blocks return and native Back`);
    const message = `${kind}_${release}_readback_failed`;
    await run(() => readback.reject(new Error(message)));
    check(`${kind}/${release}: readback failure retains input, error and no success notice`, () => {
      assert(originalInput.isConnected); assert.equal(find(inputId), originalInput);
      assert.equal(originalInput.value, text);
      assert(find('question-notebook-error').textContent.includes(message));
      assert.equal(find('question-notebook-success'), null);
      assert(find(saveId).textContent.includes('重新读取'));
      assert(originalInput.disabled, 'Committed source input is held for comparison, not silently rewritten');
    });
    await expectBlocked(`${kind}/${release}: failed readback retains the real editor guard`);
    listRead = normalRead;
    if (release === 'reread') {
      await press(find(saveId));
      assert.equal(find('question-notebook-error'), null);
    } else if (kind === 'archive') await clickText(find('question-archive-' + archived.id), '取消编辑');
    else await press(find('question-context-cancel'));
    await press(find('question-notebook-return-paper'));
    check(`${kind}/${release}: explicit release never rewrites a committed source or creates a new question`, () => {
      assert.equal(nav.target.view, 'paper'); assert.equal(writeCount(), beforeWrites + 1);
      assert.equal(creations, beforeCreates);
    });
  }

  await mount(); await fill(find('question-notebook-new-stem'), 'UNIT unsaved new question');
  await expectBlocked('new-question draft blocks return and history');
  const newReads = reads; await press(find('question-notebook-next'));
  check('new-question draft prevents page switching', () => assert.equal(reads, newReads));
  const createPending = deferred(); createSave = () => createPending.promise;
  await press(find('question-notebook-create-question'));
  await expectBlocked('new-question creation in flight cannot leave');
  await run(() => createPending.reject(new Error('disk_full')));
  await expectBlocked('new-question save failure retains input and guard');
  check('failed new question is not cleared or called saved', () => {
    assert.equal(find('question-notebook-new-stem').value, 'UNIT unsaved new question'); assert(find('question-notebook-error'));
  });
  await press(find('question-notebook-cancel-new')); await press(find('question-notebook-return-paper'));
  check('explicit new-input discard releases return without domain write', () => assert.equal(nav.target.view, 'paper'));
  await mount(); await fill(find('question-notebook-new-stem'), 'UNIT saved new question');
  createSave = async () => bankQuestion; await press(find('question-notebook-create-question'));
  await press(find('question-notebook-return-paper'));
  check('successful new question creation releases return', () => assert.equal(nav.target.view, 'paper'));
  await mount(false); await press(find('question-archive-edit-' + archived.id));
  let ordinary;
  await run(() => {ordinary = nav.navigate({view: 'knowledge'});});
  check('ordinary notebook consumer keeps its pre-C1 behavior and has no handoff controls', () => assert.equal(ordinary, true));

  const pendingListFailures = [];
  for (const kind of ['archive', 'context']) for (const resultKind of ['empty', 'different']) {
    await mount();
    const question = kind === 'archive' ? archived : contextQuestion;
    const entryId = kind === 'archive' ? 'question-archive-edit-' + question.id : 'question-context-open';
    const inputId = kind === 'archive' ? 'question-archive-stem' : 'projection-statement-text';
    const oldRow = find('question-notebook-card-' + question.id), pendingList = deferred();
    const writesBefore = archiveWrites.length + contextWrites, createsBefore = creations;
    listRead = () => pendingList.promise;
    await fill(find('question-notebook-search'), `UNIT pending ${kind}/${resultKind}`);
    assert(find('question-notebook-loading')); assert(oldRow.isConnected, 'C1 retains previous rows while filtering');
    const entry = find(entryId), disabledWhileLoading = entry.disabled;
    await press(entry);
    const openedInput = find(inputId);
    // Record the pre-fix loss using the real form, rather than stopping before the late result.
    if (openedInput) await fill(openedInput, 'UNIT draft that a late filter must never discard');
    const resultRows = resultKind === 'empty' ? [] : rows.filter(item => item.id !== question.id);
    await run(() => pendingList.resolve({items: structuredClone(resultRows), total: resultRows.length}));
    listRead = normalRead;
    const observation = {kind, resultKind, disabledWhileLoading, openedDraft: !!openedInput,
      openedInputStillConnected: openedInput?.isConnected ?? null};
    console.log('PENDING_LIST_OBSERVATION ' + JSON.stringify(observation));
    try {
      check(`${kind}/${resultKind}: pending filter disables old-row editing before late replacement can discard input`, () => {
        assert.equal(disabledWhileLoading, true);
        assert.equal(openedInput, null, 'No old-row draft may be accepted during a pending list read');
        assert.equal(find('question-notebook-loading'), null);
        assert.equal(find('question-notebook-card-' + question.id), null);
        assert.equal(archiveWrites.length + contextWrites, writesBefore); assert.equal(creations, createsBefore);
        if (resultKind === 'empty') assert(find('question-notebook-no-results'));
        else {
          const nextEntry = find(kind === 'archive' ? 'question-context-open' : 'question-archive-edit-' + archived.id);
          assert(nextEntry); assert.equal(nextEntry.disabled, false, 'Fresh result can be edited after read completion');
        }
      });
    } catch (error) {
      pendingListFailures.push({...observation, error: error.message});
    }
  }
  assert.deepEqual(pendingListFailures, [], 'Both real editors must reject new drafts from pending old rows');
  console.log(JSON.stringify({success: true, passed, scope: 'Mounted production Notebook/ArchiveEditor/ContextEditor with real React/HeroUI events; unit DTOs, no Electron/native Tab traversal/host write acceptance'}));
} finally {await env.close();}
