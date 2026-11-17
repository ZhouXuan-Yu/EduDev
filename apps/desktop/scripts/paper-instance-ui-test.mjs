import assert from 'node:assert/strict';
import {paperRendererEnvironment} from './acceptance/paper-instance-renderer-env.mjs';
import {instanceFixture, ownerA, ownerB, entryId, replacementQuestion, bankQuestion} from './acceptance/paper-instance-renderer-fixture.mjs';

const env = await paperRendererEnvironment();
const {React, root, run, load, find, press, fill} = env;
let passed = 0;
const check = (name, fn) => {fn(); passed++; console.log('PASS ' + name);};
const trigger = id => find(id)?.querySelector('[data-slot="disclosure-trigger"]');
try {
  const {defaultPaperBlueprint} = await load('shared/paper-blueprint.ts');
  const {DesktopFrame} = await load('renderer/components/desktop/DesktopFrame.tsx');
  const {PaperBlueprintWorkspace} = await load('renderer/components/PaperBlueprintWorkspace.tsx');
  const {seedInstanceRole} = await load('renderer/components/paper-ui/paper-instance-content.ts');
  const f = instanceFixture(defaultPaperBlueprint());
  const bankBefore = JSON.stringify(bankQuestion), otherBefore = JSON.stringify(f.data.get(ownerB));
  window.omniEdu = f.api;
  const mount = () => run(() => root.render(React.createElement(DesktopFrame, null, React.createElement(PaperBlueprintWorkspace, {initialSessionId: ownerA}))));
  await mount(); await run();
  await press(find('paper-instance-open'));
  await press(find('paper-instance-edit-question'));
  await fill(find('paper-instance-role-question').querySelector('[data-testid="paper-instance-text"]'), 'UNIT new full stem');
  await press(find('paper-instance-role-question').querySelector('[data-testid="paper-instance-add-options"]'));
  const optionFields = find('paper-instance-role-question').querySelectorAll('[data-testid="paper-instance-item-text"]');
  await fill(optionFields[0], 'UNIT option alpha'); await fill(optionFields[1], 'UNIT option beta');
  await press(find('paper-instance-role-question').querySelector('[data-testid="paper-instance-add-subquestions"]'));
  const itemFields = find('paper-instance-role-question').querySelectorAll('[data-testid="paper-instance-item-text"]');
  assert.equal(itemFields.length, 3, 'Two options and one explicit subquestion are the only item fields');
  await fill(itemFields[2], 'UNIT subquestion');
  await press(trigger('paper-instance-edit-fold-answer')); await press(find('paper-instance-edit-answer'));
  await fill(find('paper-instance-role-answer').querySelector('textarea'), 'UNIT new private answer');
  await press(trigger('paper-instance-edit-fold-analysis')); await press(find('paper-instance-edit-analysis'));
  await fill(find('paper-instance-role-analysis').querySelector('textarea'), 'UNIT new private analysis');
  check('actual grouped controls preserve ordered options/subquestions and keep edits separate from saved source', () => {
    assert.equal(find('paper-instance-save').disabled, false); assert.equal(f.data.get(ownerA).entries[0].instance.content.question.mode, 'source');
    assert.equal(find('paper-basket-stage-preview').disabled, true); assert.equal(find('paper-basket-owner').disabled, true);
    assert.equal(document.querySelector('details,summary'), null);
  });
  await press(find('paper-instance-save')); await run();
  check('actual Save commits structured roles through exact V2 instance operation and invalidates review', () => {
    const e = f.data.get(ownerA).entries[0]; assert.equal(e.instance.content.question.blocks[1].type, 'options');
    assert.equal(e.instance.content.question.blocks[2].type, 'subquestions');
    assert.equal(e.instance.content.answer.blocks[0].text, 'UNIT new private answer');
    assert.equal(e.instance.content.analysis.blocks[0].text, 'UNIT new private analysis');
    assert.equal(e.reviewCurrent, false); assert.equal(find('paper-basket-stage-preview').disabled, false);
    assert(find('paper-basket-question-stem').textContent.includes('UNIT option beta'));
  });
  await press(find('paper-instance-dialog-close')); await press(find('paper-basket-stage-preview'));
  check('unreviewed content is previewable but cannot create a formal snapshot; student DOM excludes both answers', () => {
    assert.equal(find('paper-basket-snapshot').disabled, true);
    assert(!document.body.textContent.includes('UNIT new private answer')); assert(!document.body.textContent.includes('UNIT_REFERENCE_ANSWER'));
    assert(find('paper-basket-question-stem').textContent.includes('UNIT subquestion'));
  });
  await press(find('paper-basket-stage-organize')); await press(find('paper-instance-open')); await press(find('paper-instance-confirm'));
  check('review button binds exact saved revision/digest and clears current review blocker', () => {
    const request = f.calls.v2.filter(([kind, input]) => kind === 'mutate' && input.operation.type === 'reviewEntry').at(-1)[1];
    const e = f.data.get(ownerA).entries[0]; assert.equal(request.operation.expectedContentDigest, e.instance.contentDigest);
    assert.equal(request.operation.expectedInstanceRevision, e.instance.instanceRevision); assert.equal(e.reviewCurrent, true);
  });
  await press(find('paper-instance-dialog-close')); await press(find('paper-basket-stage-preview'));
  check('reviewed current basket enables exact snapshot action', () => assert.equal(find('paper-basket-snapshot').disabled, false));
  await press(find('paper-basket-teacher')); await press(trigger('paper-basket-answer'));
  check('teacher preview shows saved edited answer and analysis in an accessible official disclosure', () => {
    assert(find('paper-instance-answer-view').textContent.includes('UNIT new private answer'));
    assert(find('paper-instance-analysis-view').textContent.includes('UNIT new private analysis'));
    assert.equal(trigger('paper-basket-answer').getAttribute('aria-expanded'), 'true');
  });
  await press(find('paper-basket-student'));
  check('switching teacher back to student unmounts answer role content', () => {
    assert.equal(find('paper-instance-answer-view'), null); assert.equal(find('paper-basket-answer'), null);
  });
  await press(find('paper-basket-stage-organize')); await press(find('paper-instance-open')); await press(find('paper-instance-restore')); await press(find('paper-instance-restore-confirm'));
  check('explicit restore returns all roles to bound source and requires fresh review', () => {
    const e = f.data.get(ownerA).entries[0]; assert.equal(e.instance.content.question.mode, 'source'); assert.equal(e.reviewCurrent, false);
    assert.equal(e.entryId, entryId); assert(find('paper-basket-question-stem').textContent.includes(bankQuestion.stem));
    assert.equal(find('paper-basket-entry').querySelectorAll(':scope > [data-testid="paper-instance-content"] [data-testid="paper-basket-question-stem"]').length, 1);
  });
  await press(find('paper-instance-dialog-close')); await press(find('paper-instance-replace')); await run(() => {}, 250); await run();
  await press(find('paper-instance-replace-candidate')); await run();
  check('real full candidate replacement sends host source version while retaining stable entry and position', () => {
    const request = f.calls.v2.filter(([kind, input]) => kind === 'mutate' && input.operation.type === 'replaceEntry').at(-1)[1];
    const e = f.data.get(ownerA).entries[0]; assert.equal(request.operation.questionId, replacementQuestion.id);
    assert.equal(request.operation.expectedSourceVersion, 'a'.repeat(64)); assert.equal(e.entryId, entryId); assert.equal(e.position, 0);
    assert.equal(e.questionId, replacementQuestion.id); assert.equal(e.reviewCurrent, false); assert(find('paper-basket-organizer'));
    assert.equal(JSON.stringify(bankQuestion), bankBefore); assert.equal(JSON.stringify(f.data.get(ownerB)), otherBefore);
  });
  const withFigure = {...f.data.get(ownerA).entries[0], question: {...bankQuestion, document: {schemaVersion: 'xiaozhi.question-document.v2',
    context: {projection: {formulas: {text: ''}, tables: {text: ''}, choices: {text: ''}, subquestions: {text: ''}}},
    blocks: [{id: 'unit-source-figure', kind: 'image'}]}}};
  check('editing source role explicitly retains figure dependency instead of flattening it away', () => {
    assert(seedInstanceRole(withFigure, 'question').some(block => block.type === 'sourceImage' && block.blockId === 'unit-source-figure'));
  });
  await press(find('paper-instance-open')); await press(find('paper-instance-edit-question'));
  await fill(find('paper-instance-role-question').querySelector('[data-testid="paper-instance-text"]'), 'NAMESPACE_LOCAL_INPUT');
  await run(() => window.dispatchEvent(new window.Event('beforeunload')));
  check('window close flushes pending input before the normal cache timer', () => {
    const keys = Object.keys(localStorage).filter(key => key.startsWith('xiaozhi.ui.paper-instance-input.v1:'));
    assert(keys.some(key => localStorage.getItem(key).includes('NAMESPACE_LOCAL_INPUT')));
  });
  const namespaceMutations = f.calls.v2.filter(([name]) => name === 'mutate').length;
  f.api.getDataRoot = async () => {throw Error('unit root unavailable');};
  await press(find('paper-instance-reload')); await run();
  check('real workspace exposes namespace recovery after failed revalidation without releasing unsaved guard', () => {
    assert(find('paper-instance-retry-namespace')); assert.equal(find('paper-instance-retry-namespace').disabled, false);
    assert.equal(find('paper-basket-owner').disabled, true); assert.equal(find('paper-basket-back-teaching').disabled, true);
    assert.equal(find('paper-instance-save').disabled, true);
  });
  f.api.getDataRoot = async () => 'unit-owned-data-root-A';
  await press(find('paper-instance-dialog-retry-namespace')); await run();
  check('real recovery button restores retained input after root API recovery with no domain write', () => {
    assert.equal(find('paper-instance-retry-namespace'), null);
    assert.equal(find('paper-instance-role-question').querySelector('[data-testid="paper-instance-text"]').value, 'NAMESPACE_LOCAL_INPUT');
    assert.equal(find('paper-instance-save').disabled, false);
    assert.equal(f.calls.v2.filter(([name]) => name === 'mutate').length, namespaceMutations);
  });
  await press(find('paper-instance-discard'));
  f.data.get(ownerA).state = 'archived'; f.data.get(ownerA).complete = false;
  await run(() => root.render(null)); await mount(); await run();
  check('archived view has one read-only preview, no duplicate organizer or misleading shortage explanation', () => {
    assert.equal(find('paper-basket-organizer'), null); assert(find('paper-basket-preview-page'));
    assert.equal(find('paper-basket-snapshot').disabled, true);
    assert(!document.body.textContent.includes('题篮尚有缺额'));
  });
  await run(() => root.render(null));
  const {instanceDraftKey, writeInstanceDrafts} = await load('renderer/components/paper-ui/paper-instance-draft-storage.ts');
  const archived = f.data.get(ownerA), archivedEntry = archived.entries[0];
  const archivedBefore = JSON.stringify(archived), mutationsBefore = f.calls.v2.filter(([name]) => name === 'mutate').length;
  writeInstanceDrafts(instanceDraftKey('unit-owned-data-root-A', ownerA, archived.id), {[entryId]: {
    entryId, baseRevision: archivedEntry.instance.instanceRevision, baseDigest: archivedEntry.instance.contentDigest,
    content: {...archivedEntry.instance.content, question: {mode: 'edited', blocks: [{type: 'text', text: 'LOCAL_ARCHIVED_INPUT'}]}},
  }});
  await mount(); await run();
  check('archived existing-entry input has a separate read-only local viewer and explicit discard despite no editor/orphan', () => {
    assert.equal(find('paper-instance-editor'), null); assert(find('paper-instance-retained-input'));
    const input = find('paper-instance-retained-input').querySelector('textarea');
    assert.equal(input.value, 'LOCAL_ARCHIVED_INPUT'); assert.equal(input.disabled, true);
    assert.equal(find('paper-basket-owner').disabled, true); assert.equal(find('paper-basket-new').disabled, true);
    assert.equal(find('paper-instance-discard-retained-input').disabled, false);
  });
  await press(find('paper-instance-discard-retained-input'));
  check('discarding archived local input releases owner/new/leave guards without writing or unlocking archived domain content', () => {
    assert.equal(find('paper-instance-retained-input'), null); assert.equal(find('paper-basket-owner').disabled, false);
    assert.equal(find('paper-basket-new').disabled, false); assert.equal(find('paper-basket-back-teaching').disabled, false);
    assert.equal(find('paper-basket-snapshot').disabled, true); assert.equal(find('paper-basket-save-blueprint').disabled, true);
    assert.equal(JSON.stringify(f.data.get(ownerA)), archivedBefore);
    assert.equal(f.calls.v2.filter(([name]) => name === 'mutate').length, mutationsBefore);
  });
  console.log(JSON.stringify({success: true, passed, scope: 'Real HeroUI and paper wrapper components in JSDOM with unit-only V2 callbacks; no actual SQLite/Electron/export claim'}));
} finally {await env.close();}
