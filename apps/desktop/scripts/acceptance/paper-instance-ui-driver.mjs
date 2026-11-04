import assert from 'node:assert/strict';
import {choose, disclosureTrigger, capturePaper, settle} from './paper-basket-ui-driver.mjs';
import {entryCard, visibleUnique, selectTrigger} from './paper-basket-ui-locators.mjs';
import {waitInstanceCondition} from './paper-instance-ui-wait.mjs';

export const instanceSchema = 'xiaozhi.paper-basket.v2';

export async function readInstanceBasket(page, sessionId, basketId) {
  const result = await page.evaluate(reference => window.omniEdu.readPaperBasketV2(reference),
    {schemaVersion: instanceSchema, sessionId, basketId});
  assert.equal(result.ok, true, 'Authorized V2 basket read');
  assert.equal(result.value.schemaVersion, instanceSchema);
  assert.equal(result.value.id, basketId); assert.equal(result.value.sessionId, sessionId);
  return result.value;
}

/** Runs inside the renderer. Requery after IPC; a previous matching DOM sample cannot certify a new mount. */
export async function instanceUiReady({reference, expected}) {
  const sample = () => {
    const roots = document.querySelectorAll('[data-testid="paper-basket-workspace"]');
    if (roots.length !== 1) return;
    const root = roots[0], stage = root.querySelector(`[data-testid="paper-basket-stage-${expected.stage}"]`);
    const refresh = root.querySelector('[data-testid="paper-basket-refresh-candidates"]');
    const discard = expected.unsavedEntryId && root.querySelector(`[data-testid="paper-instance-editor"][data-entry-id="${expected.unsavedEntryId}"] [data-testid="paper-instance-discard"]`);
    const recoveredInput = !!discard && !discard.disabled;
    if (!root.isConnected || root.dataset.basketId !== reference.basketId || root.dataset.stage !== expected.stage ||
      !stage || (stage.disabled && !recoveredInput) || root.querySelector('[data-testid="paper-basket-ui-pending"]') ||
      (expected.unsavedEntryId && !recoveredInput) ||
      (expected.stage === 'select' && (!refresh || refresh.disabled)) ||
      (expected.revision !== undefined && Number(root.dataset.basketRevision) !== expected.revision)) return;
    return root;
  };
  const root = sample();
  if (!root) return false;
  const result = await window.omniEdu.readPaperBasketV2(reference);
  if (sample() !== root || !result.ok || result.value.schemaVersion !== reference.schemaVersion ||
    result.value.id !== reference.basketId || result.value.sessionId !== reference.sessionId) return false;
  // Domain writes do not create a preference receipt. Match the renderer's emptyBasketUi
  // only when the optional host field is absent; never replace explicit saved preferences.
  const ui = result.value.uiState === undefined
    ? {stage: 'select', filters: {}, offset: 0, scrollTop: 0} : result.value.uiState;
  return !!ui && ui.stage === expected.stage &&
    (expected.revision === undefined || result.value.revision === expected.revision) &&
    (expected.query === undefined || (ui.filters.query || '') === expected.query) &&
    (expected.questionType === undefined || ui.filters.questionType === expected.questionType) &&
    (expected.offset === undefined || ui.offset === expected.offset) &&
    (expected.scrollTop === undefined || ui.scrollTop === expected.scrollTop);
}

export async function waitInstanceUi(page, sessionId, basketId, expected) {
  await waitInstanceCondition(page, instanceUiReady, {reference: {schemaVersion: instanceSchema, sessionId, basketId}, expected},
    {description: 'Exact V2 basket and saved UI readiness'});
  const root = await visibleUnique(page.getByTestId('paper-basket-workspace'), 'Current V2 workspace');
  assert.equal(await root.getAttribute('data-basket-id'), basketId, 'Immediate identity assertion after readiness');
  assert.equal(await root.getAttribute('data-stage'), expected.stage);
}

export async function findInstanceCandidate(page, report, sessionId, basketId, question) {
  // A search input is single-line; do not wait for a newline it cannot retain.
  const query = question.stem.split(/\r?\n/).map(line => line.trim()).find(Boolean).slice(0, 36);
  await page.getByRole('button', {name: '重置筛选', exact: true}).click();
  await choose(page, page.getByTestId('paper-basket-type'), question.questionType);
  await page.getByTestId('paper-basket-search').fill(query);
  let offset = 0;
  for (;;) {
    await waitInstanceUi(page, sessionId, basketId, {stage: 'select', query, questionType: question.questionType, offset});
    const filters = {query, questionType: question.questionType, subject: question.subject,
      grade: question.grade, offset, limit: 12};
    const result = await page.evaluate(input => window.omniEdu.listQuestionNotebook(input), filters);
    const ids = result.items.map(item => item.id);
    (report.candidateQueries ||= []).push({filters, total: result.total, itemIds: ids, targetId: question.id});
    if (ids.includes(question.id)) return visibleUnique(page.getByTestId('paper-basket-candidate')
      .and(page.locator(`[data-question-id="${question.id}"]`)), 'Exact real V2 candidate');
    assert(offset + 12 < result.total, 'Exact question must exist in its real filtered query; no substitute or API add');
    await (await visibleUnique(page.getByTestId('paper-basket-next'), 'Actual next candidate page')).click();
    offset += 12;
  }
}

export async function createInstanceBasket(ctx, owner, question, title) {
  const {page} = ctx;
  await page.getByTestId('paper-basket-owner-search').fill(owner);
  await choose(page, page.getByTestId('paper-basket-owner'), owner);
  await page.getByTestId('paper-basket-new').and(page.locator(':enabled')).waitFor();
  const previous = await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id');
  await page.getByTestId('paper-basket-new').click();
  if (await page.getByTestId('paper-basket-new-choice').isVisible()) await page.getByTestId('paper-basket-keep-new').click();
  await waitInstanceCondition(page, old => {
    const id = document.querySelector('[data-testid="paper-basket-workspace"]')?.dataset.basketId;
    return !!id && id !== old;
  }, previous, {description: 'New real basket identity'});
  const basketId = await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id');
  await waitInstanceUi(page, owner, basketId, {stage: 'select'});
  // Optional parent-specific visible UI setup; legacy callers keep their original path.
  if (ctx.prepareCreatedBasketUi) await ctx.prepareCreatedBasketUi({page,owner,basketId});
  const fold = disclosureTrigger(page.getByTestId('paper-basket-blueprint-fold'), '蓝图与来源策略');
  await visibleUnique(fold, 'Blueprint official disclosure');
  if (await fold.getAttribute('aria-expanded') !== 'true') await fold.click();
  const editor = await visibleUnique(page.getByTestId('paper-basket-blueprint-fold')
    .getByTestId('paper-basket-blueprint'), 'Saved basket blueprint editor, separate from fulfillment draft');
  await editor.getByTestId('paper-basket-title').fill(title);
  await editor.getByTestId('paper-basket-subject').fill(question.subject);
  await editor.getByTestId('paper-basket-grade').fill(question.grade);
  await choose(page, editor.getByTestId('paper-basket-mode'), 'source_only');
  const sections = editor.getByTestId('paper-basket-section-editor');
  while (await sections.count() > 1) {
    const count = await sections.count(), last = sections.nth(count - 1);
    assert.equal(await last.locator(':scope > legend').innerText(), `第 ${count} 部分`);
    await last.getByRole('button', {name: '移除此分节', exact: true}).click();
  }
  assert.equal(await sections.count(), 1);
  await editor.getByTestId('paper-basket-section-type').fill(question.questionType);
  await editor.getByTestId('paper-basket-section-count').fill('1');
  await editor.getByTestId('paper-basket-section-points').fill('100');
  await editor.getByTestId('paper-basket-total').fill('100');
  const inputs = Object.fromEntries(await editor.locator('input[data-testid]').evaluateAll(nodes => nodes.map(n => [n.dataset.testid, n.value])));
  (ctx.report.instanceBlueprintInputs ||= []).push(inputs);
  assert.equal(inputs['paper-basket-title'], title);
  assert.equal(inputs['paper-basket-section-type'], question.questionType);
  assert.equal(inputs['paper-basket-section-count'], '1');
  assert.equal(inputs['paper-basket-section-points'], '100');
  const before = await readInstanceBasket(page, owner, basketId);
  // A resumed owned fixture may create from an already matching saved template.
  // In that case the UI correctly disables a no-op Save. Require exact persisted
  // blueprint equality instead of manufacturing an edit just to enable it.
  const {generatedCount: _generated, ...section} = before.blueprint.sections[0];
  const expected = {...before.blueprint, title, subject: question.subject, grade: question.grade,
    mode: 'source_only', totalPoints: 100,
    sections: [{...section, questionType: question.questionType, count: 1, points: 100}]};
  const alreadySaved = JSON.stringify(before.blueprint) === JSON.stringify(expected);
  (ctx.report.instanceBlueprintAlreadySaved ||= []).push(alreadySaved);
  if (!alreadySaved) await editor.getByTestId('paper-basket-save-blueprint').click();
  await waitInstanceUi(page, owner, basketId, {stage: 'select', revision: before.revision + (alreadySaved ? 0 : 1)});
  const row = await findInstanceCandidate(page, ctx.report, owner, basketId, question);
  const candidate = await page.evaluate(input => window.omniEdu.readPaperBasketCandidateV2(input),
    {schemaVersion: instanceSchema, sessionId: owner, basketId, questionId: question.id});
  assert.equal(candidate.ok, true); assert.equal(candidate.value.eligibility.available, true);
  await choose(page, selectTrigger(row, '加入分节'), before.blueprint.sections[0].id);
  const baseline = await readInstanceBasket(page, owner, basketId);
  await row.getByTestId('paper-basket-add').click();
  await waitInstanceUi(page, owner, basketId, {stage: 'select', revision: baseline.revision + 1});
  const saved = await readInstanceBasket(page, owner, basketId);
  assert.equal(saved.entries.length, 1); assert.equal(saved.entries[0].questionId, question.id);
  assert.equal(saved.entries[0].contentVersion, candidate.value.contentVersion);
  assert.deepEqual(saved.entries[0].question, candidate.value.question); assert(saved.entries[0].instance);
  return saved;
}

export async function instanceStage(ctx, owner, basketId, stage) {
  await ctx.page.getByTestId(`paper-basket-stage-${stage}`).click();
  await waitInstanceUi(ctx.page, owner, basketId, {stage});
}

export async function captureInstance(ctx, name, entryId, preview = false) {
  const card = await visibleUnique(entryCard(ctx.page, entryId, preview), 'Exact instance card');
  const level = preview ? 4 : 3, namePattern = preview ? /^第 \d+ 题$/ : /^第 \d+ 题 · /;
  const heading = card.getByRole('heading', {level, name: namePattern}).and(card.locator(`:scope > h${level}`));
  // Source comparisons may be open too; anchor only the primary saved instance body.
  const content = card.locator(':scope > [data-testid="paper-instance-content"]');
  const body = content.getByTestId('paper-basket-question-stem');
  await capturePaper(ctx.app, ctx.page, ctx.output, ctx.report, name, heading, body);
}

export async function instanceAnswerKeyboard(ctx, entryId) {
  const {page, app} = ctx, card = entryCard(page, entryId, true);
  const answer = card.locator(':scope > [data-testid="paper-instance-content"]').getByTestId('paper-basket-answer');
  const trigger = await visibleUnique(disclosureTrigger(answer, '本卷参考答案与解析'), 'Instance answer official trigger');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  await page.getByTestId('paper-basket-teacher').focus();
  let tabs = 0;
  for (; tabs < 32; tabs++) {
    await page.keyboard.press('Tab');
    if (await trigger.evaluate(node => node === document.activeElement)) break;
  }
  assert(tabs < 32, 'Answer is reachable by actual Tab');
  await page.keyboard.press('Enter'); await trigger.and(page.locator('[aria-expanded="true"]')).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await trigger.evaluate(node => node === document.activeElement), true);
  const afterEscape = await trigger.getAttribute('aria-expanded');
  assert(['true', 'false'].includes(afterEscape));
  if (afterEscape !== 'true') await trigger.press('Enter');
  await trigger.and(page.locator('[aria-expanded="true"]')).waitFor(); await settle(app, page);
  assert.equal(await page.getByTestId('paper-basket-workspace').locator('details,summary').count(), 0);
  ctx.report.answerKeyboard = {tabs: tabs + 1, enterExpanded: true, expandedAfterEscape: afterEscape, screenshotExpanded: true, nativeDetails: 0};
  return card.locator(':scope > [data-testid="paper-instance-content"]');
}
