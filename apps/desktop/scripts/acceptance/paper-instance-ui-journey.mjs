import assert from 'node:assert/strict';
import {enterPaper, capturePaper, enabledContrast} from './paper-basket-ui-driver.mjs';
import {entryCard, visibleUnique} from './paper-basket-ui-locators.mjs';
import {createInstanceBasket, findInstanceCandidate, instanceStage, readInstanceBasket,
  waitInstanceUi, captureInstance, instanceAnswerKeyboard, instanceSchema} from './paper-instance-ui-driver.mjs';
import {storedPaperDigest} from './paper-instance-ui-evidence.mjs';
import {editInstanceForm, editQuestionStatement} from './paper-instance-ui-form.mjs';
import {waitInstanceCondition} from './paper-instance-ui-wait.mjs';

const sourceContent = {question: {mode: 'source'}, answer: {mode: 'source'}, analysis: {mode: 'source'}};

async function saveInput(ctx, entryId, content) {
  const {page, owner, basketId} = ctx;
  const before = await readInstanceBasket(page, owner, basketId);
  const card = entryCard(page, entryId);
  await card.getByTestId('paper-instance-save').click();
  await waitInstanceUi(page, owner, basketId, {stage: 'organize', revision: before.revision + 1});
  const saved = await readInstanceBasket(page, owner, basketId), entry = saved.entries[0];
  assert.deepEqual(entry.instance.content, content); assert.equal(entry.reviewCurrent, false);
  assert.equal(entry.instance.instanceRevision, before.entries[0].instance.instanceRevision + 1);
  assert.equal(await card.getByTestId('paper-instance-discard').isDisabled(), true);
  return saved;
}

export async function prepareInstanceUi(ctx) {
  const {page, owner, witnessOwner, questionIds, report, check} = ctx;
  const questions = await page.evaluate(ids => Promise.all(ids.map(id => window.omniEdu.getQuestionNotebookEntry(id))), questionIds);
  for (const q of questions) assert(q?.stem && q.answer && q.analysis, 'Real complete fixture questions');
  for (const field of ['subject', 'grade', 'questionType']) assert.equal(questions[0][field], questions[1][field]);
  ctx.questions = questions;
  const sidebar = await visibleUnique(page.locator('[data-testid="edu-navigation"]:visible'), 'Actual navigation');
  if (await sidebar.getAttribute('data-collapsed') === 'true') await sidebar.getByTestId('workbench-sidebar-toggle').click();
  const session = await visibleUnique(sidebar.getByTestId('workbench-session-' + witnessOwner), 'Real witness session');
  await session.click();
  await visibleUnique(session.and(page.locator(':enabled[aria-current="page"]')), 'Session callback completed before module navigation');
  await enterPaper(page);
  const witness = await createInstanceBasket(ctx, witnessOwner, questions[0], 'B 对照题篮 ' + ctx.marker);
  ctx.witness = witness;
  const basket = await createInstanceBasket(ctx, owner, questions[0], 'B 本卷独立编辑 ' + ctx.marker);
  ctx.basketId = basket.id; ctx.entryId = basket.entries[0].entryId; ctx.originalEntry = basket.entries[0];
  assert.notEqual(basket.id, witness.id); assert.equal(basket.entries[0].questionId, witness.entries[0].questionId);
  assert.equal(basket.complete, false); assert.equal(basket.entries[0].reviewCurrent, false);
  report.references = {owner, witnessOwner, basketId: basket.id, witnessBasketId: witness.id, entryId: ctx.entryId, questionIds};
  check('Real V2 UI creates two independent owner baskets with the same pinned real source question');
  await instanceStage(ctx, owner, basket.id, 'organize');
}

export async function editReviewAndPreview(ctx) {
  const {page, owner, basketId, entryId, check, report} = ctx;
  const content = await editInstanceForm(ctx, ctx.questions[0], entryId);
  const before = await readInstanceBasket(page, owner, basketId);
  assert.deepEqual(before.entries[0].instance.content, sourceContent, 'Typing is not a host save');
  assert.equal(await page.getByTestId('paper-basket-stage-preview').isDisabled(), true);
  assert.equal(await page.getByTestId('paper-basket-owner').isDisabled(), true);
  await enabledContrast(page, report, 'Enabled save-instance action', entryCard(page, entryId).getByTestId('paper-instance-save'));
  ctx.edited = content; await saveInput(ctx, entryId, content);
  check('Real grouped form saves edited stem/options/subquestion/teacher answer/analysis into the host instance');
  await instanceStage(ctx, owner, basketId, 'preview');
  assert.equal(await page.getByTestId('paper-basket-snapshot').isDisabled(), true);
  assert.equal(await page.getByTestId('paper-instance-answer-view').count(), 0);
  assert.equal(await page.getByTestId('paper-basket-answer').count(), 0);
  assert.equal(await page.getByText('教师补答 ' + ctx.marker, {exact: false}).count(), 0);
  await captureInstance(ctx, 'unreviewed-student', entryId, true);
  check('Unreviewed saved instance cannot create a formal snapshot; student DOM contains no answer/source panels');
  await instanceStage(ctx, owner, basketId, 'organize');
  const beforeReview = await readInstanceBasket(page, owner, basketId);
  await entryCard(page, entryId).getByTestId('paper-instance-confirm').click();
  await waitInstanceUi(page, owner, basketId, {stage: 'organize', revision: beforeReview.revision + 1});
  const reviewed = await readInstanceBasket(page, owner, basketId), instance = reviewed.entries[0].instance;
  assert.equal(reviewed.entries[0].reviewCurrent, true); assert.equal(reviewed.complete, true);
  assert.equal(instance.review.instanceRevision, instance.instanceRevision);
  assert.equal(instance.review.contentDigest, instance.contentDigest); assert.deepEqual(instance.review.sourceBinding, instance.sourceBinding);
  await instanceStage(ctx, owner, basketId, 'preview');
  await page.getByTestId('paper-basket-teacher').focus(); await page.getByTestId('paper-basket-teacher').press('Enter');
  const teacher = await instanceAnswerKeyboard(ctx, entryId);
  assert((await teacher.getByTestId('paper-instance-answer-view').innerText()).includes('教师补答 ' + ctx.marker));
  assert((await teacher.getByTestId('paper-instance-analysis-view').innerText()).includes('教师解析 ' + ctx.marker));
  await captureInstance(ctx, 'reviewed-teacher', entryId, true);
  await capturePaper(ctx.app, page, ctx.output, report, 'teacher-answer-expanded', teacher.getByTestId('paper-instance-answer-view'));
  await page.getByTestId('paper-basket-student').click();
  assert.equal(await page.getByTestId('paper-instance-answer-view').count(), 0);
  await captureInstance(ctx, 'reviewed-student', entryId, true);
  check('Exact-revision teacher review enables preview; actual Tab/Enter/Escape work and expanded answer evidence is photographed');
  await enabledContrast(page, report, 'Enabled instance snapshot action', page.getByTestId('paper-basket-snapshot'));
  await page.getByTestId('paper-basket-snapshot').click();
  await page.getByTestId('paper-basket-confirm').click();
  await visibleUnique(page.getByTestId('paper-export-entry'), 'Actual confirmed paper export choices');
  assert.equal(await page.getByTestId('paper-export-entry').locator('.edu-paper-export-buttons button').count(), 6);
  const papers = await page.evaluate(() => window.omniEdu.listPapers());
  assert.equal(papers.ok, true);
  const matches = papers.value.filter(p => p.sessionId === owner && p.title === reviewed.title && p.state === 'confirmed');
  assert.equal(matches.length, 1, 'Exact newly confirmed UI paper');
  ctx.paperId = matches[0].id;
  const paper = await page.evaluate(input => window.omniEdu.reviewPaper(input), {schemaVersion: 'xiaozhi.paper-blueprint.v1', sessionId: owner, id: ctx.paperId});
  assert.equal(paper.ok, true); assert.equal(paper.value.basket.basketId, basketId);
  assert.deepEqual(paper.value.selection.items[0].instance.content, ctx.edited);
  ctx.paperDigest = storedPaperDigest(ctx.data, ctx.paperId);
  report.confirmedPaper = {id: ctx.paperId, digest: ctx.paperDigest, instanceDigest: instance.contentDigest};
  check('Actual teacher confirmation persists the edited instance snapshot and exposes six export choices without requesting an export/model');
}

export async function replaceRestoreAndColdInput(ctx) {
  const {page, owner, basketId, entryId, check} = ctx;
  await instanceStage(ctx, owner, basketId, 'organize');
  await entryCard(page, entryId).getByTestId('paper-instance-replace').click();
  const row = await findInstanceCandidate(page, ctx.report, owner, basketId, ctx.questions[1]);
  const candidate = await page.evaluate(input => window.omniEdu.readPaperBasketCandidateV2(input),
    {schemaVersion: instanceSchema, sessionId: owner, basketId, questionId: ctx.questions[1].id});
  assert.equal(candidate.ok, true);
  const before = await readInstanceBasket(page, owner, basketId);
  await row.getByTestId('paper-instance-replace-candidate').click();
  await waitInstanceUi(page, owner, basketId, {stage: 'organize', revision: before.revision + 1});
  let basket = await readInstanceBasket(page, owner, basketId), entry = basket.entries[0];
  assert.equal(entry.entryId, entryId); assert.equal(entry.position, before.entries[0].position);
  assert.equal(entry.sectionId, before.entries[0].sectionId); assert.equal(entry.questionId, ctx.questions[1].id);
  assert.equal(entry.contentVersion, candidate.value.contentVersion); assert.deepEqual(entry.instance.content, sourceContent);
  assert.equal(entry.reviewCurrent, false);
  // Make a real saved edit to q2 before exercising Restore; otherwise Restore proves no change.
  const card = entryCard(page, entryId);
  const temporary = await editQuestionStatement(page, entryId, '恢复原题前的本卷修改 ' + ctx.marker);
  await saveInput(ctx, entryId, {...sourceContent, question: temporary.content});
  basket = await readInstanceBasket(page, owner, basketId);
  await card.getByTestId('paper-instance-restore').click(); await card.getByTestId('paper-instance-restore-confirm').click();
  await waitInstanceUi(page, owner, basketId, {stage: 'organize', revision: basket.revision + 1});
  basket = await readInstanceBasket(page, owner, basketId); entry = basket.entries[0];
  assert.equal(entry.questionId, ctx.questions[1].id); assert.equal(entry.entryId, entryId);
  assert.deepEqual(entry.instance.content, sourceContent); assert.equal(entry.reviewCurrent, false);
  assert.equal(storedPaperDigest(ctx.data, ctx.paperId), ctx.paperDigest);
  await captureInstance(ctx, 'replaced-restored', entryId);
  check('Real candidate replacement pins its source version; explicit restore reverses a saved edit without changing prior paper history');
  // Persist another explicit edit after Restore, so cold readback proves edited SQLite content,
  // not just a source-only instance or a local cache claiming to be a save.
  const final = await editQuestionStatement(page, entryId, '已保存冷启复核 ' + ctx.marker);
  ctx.finalSavedText = final.statement;
  await saveInput(ctx, entryId, {...sourceContent, question: final.content});
  // Leave a genuine unsaved input to prove local recovery is separate from SQLite saved content.
  ctx.unsavedText = ctx.questions[1].stem + '\n本机未保存恢复复核 ' + ctx.marker;
  await card.getByTestId('paper-instance-role-question').getByTestId('paper-instance-text').fill(ctx.unsavedText);
  const root = await page.evaluate(() => window.omniEdu.getDataRoot());
  const key = `xiaozhi.ui.paper-instance-input.v1:${encodeURIComponent(root)}:${owner}:${basketId}`;
  await waitInstanceCondition(page, ({key, entryId, text}) => {
    try {return JSON.parse(localStorage.getItem(key)).drafts.some(d => d.entryId === entryId && d.content.question.blocks.some(b => b.type === 'text' && b.text === text));}
    catch {return false;}
  }, {key, entryId, text: ctx.unsavedText}, {description: 'Actual local unsaved-input recovery copy'});
  ctx.saved = await readInstanceBasket(page, owner, basketId);
  assert.equal(ctx.saved.entries[0].instance.content.question.blocks[0].text, ctx.finalSavedText);
  ctx.report.saved = {basketId, revision: ctx.saved.revision, entryId, uiState: ctx.saved.uiState,
    instanceRevision: ctx.saved.entries[0].instance.instanceRevision, instanceDigest: ctx.saved.entries[0].instance.contentDigest};
}

export async function verifyColdInstanceUi(ctx) {
  // Every locator here belongs to the new page; nothing from the previous launch is retained.
  const {page, owner, basketId, entryId, check} = ctx;
  await enterPaper(page);
  await waitInstanceUi(page, owner, basketId, {stage: 'organize', revision: ctx.saved.revision, unsavedEntryId: entryId});
  const cold = await readInstanceBasket(page, owner, basketId);
  assert.deepEqual(cold.entries, ctx.saved.entries); assert.deepEqual(cold.uiState, ctx.saved.uiState);
  const card = await visibleUnique(entryCard(page, entryId), 'Cold exact entry');
  const input = await visibleUnique(card.getByTestId('paper-instance-role-question').getByTestId('paper-instance-text'), 'Cold unsaved text input');
  assert.equal(await input.inputValue(), ctx.unsavedText);
  assert((await card.getByTestId('paper-instance-form').innerText()).includes('本机未保存输入'));
  assert.equal(await page.getByTestId('paper-basket-stage-preview').isDisabled(), true);
  assert.equal(cold.entries[0].instance.content.question.blocks[0].text, ctx.finalSavedText, 'Recovered local input is not a saved SQLite edit');
  await card.getByTestId('paper-instance-discard').click();
  await page.getByTestId('paper-basket-stage-preview').and(page.locator(':enabled')).waitFor();
  assert.deepEqual((await readInstanceBasket(page, owner, basketId)).entries, cold.entries);
  assert.equal(storedPaperDigest(ctx.data, ctx.paperId), ctx.paperDigest);
  await captureInstance(ctx, 'cold-saved-edit-with-local-input-discarded', entryId);
  check('Cold restart restores exact saved SQLite instance/preferences plus clearly separate local unsaved input; explicit discard changes no domain facts');
}
