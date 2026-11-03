/** A24 actual controls; typed calls observe only. No generated questions or SQL writes. */
import assert from 'node:assert/strict';
import {enterPaper, choose} from './paper-basket-ui-driver.mjs';
import {readPort, until, jsonEqual} from './paper-export-intent-evidence.mjs';
import {readInstanceBasket, instanceStage} from './paper-instance-ui-driver.mjs';
import {entryCard} from './paper-basket-ui-locators.mjs';

export async function exercisePracticePurpose({page, app, data, output, report, check}) {
  const read = readPort(data + '/app.db');
  const ids = new Set(read('SELECT id FROM paper_baskets').map(row => row.id));
  await enterPaper(page);
  await choose(page, page.getByTestId('paper-basket-owner'), '');
  await page.getByTestId('paper-basket-create').waitFor();
  if (!await page.getByTestId('paper-practice-setup').count()) await choose(page, page.getByTestId('paper-basket-purpose'), 'practice');
  await page.getByTestId('paper-practice-setup').waitFor();
  assert.equal(await page.getByTestId('paper-basket-total').count(), 0, 'No exam score field required');
  for (const [field, value] of [['title', '三题练习实际验收'], ['subject', '数学'], ['grade', '初二']])
    await page.getByTestId('paper-practice-' + field).fill(value);
  await page.getByTestId('paper-basket-create').click();
  let created;
  await until(() => {created = read('SELECT id,session_id FROM paper_baskets').find(row => !ids.has(row.id)); return !!created;}, 'Actual UI practice persisted');
  const owner = created.session_id, basketId = created.id;
  const get = () => readInstanceBasket(page, owner, basketId);
  const stored = () => JSON.parse(read('SELECT data_json FROM paper_baskets WHERE id=?', [basketId])[0].data_json);
  let basket = await get();
  assert.equal(basket.purpose, 'practice'); assert.equal(basket.paperRequirements, 'required');
  await choose(page, page.getByTestId('paper-basket-type'), '选择题');
  await until(async () => await page.locator('[data-testid="paper-basket-candidate"] button[data-testid="paper-basket-add"]:enabled').count() >= 3, 'Three real available bank questions');
  for (let index = 0; index < 3; index++) {
    const row = page.locator('[data-testid="paper-basket-candidate"]').filter({has: page.locator('[data-testid="paper-basket-add"]:enabled')}).first();
    const questionId = await row.getAttribute('data-question-id');
    await row.getByTestId('paper-basket-add').click();
    await until(async () => {basket = await get(); return basket.entries.length === index + 1;}, 'Practice member ' + (index + 1));
    assert(basket.entries.some(entry => entry.questionId === questionId || entry.question?.id === questionId));
  }
  check('Three same-type actual bank members added without exam inputs');
  const ctx = {page, app, data, output, report};
  await instanceStage(ctx, owner, basketId, 'organize');
  for (const entry of basket.entries) {
    const card = entryCard(page, entry.entryId);
    if (!await card.getByTestId('paper-instance-form').count()) await card.getByTestId('paper-instance-open').click();
    const revision = (await get()).revision;
    await card.getByTestId('paper-instance-confirm').click();
    await until(async () => (await get()).revision === revision + 1, 'Actual teacher review ' + entry.entryId);
  }
  basket = await get(); assert(basket.complete && basket.entries.every(entry => entry.reviewCurrent));
  const retained = stored();
  for (const purpose of ['paper', 'practice']) {
    const revision = basket.revision;
    await choose(page, page.getByTestId('paper-basket-purpose'), purpose);
    await until(async () => {basket = await get(); return basket.purpose === purpose && basket.revision === revision + 1;}, 'Explicit purpose ' + purpose);
    jsonEqual(stored().entries, retained.entries, 'Purpose keeps all exact persisted members, source and review');
    jsonEqual(stored().c2, retained.c2, 'Purpose keeps instance points and template state');
    if (purpose === 'paper') assert.equal(basket.paperRequirements, 'required');
  }
  await instanceStage(ctx, owner, basketId, 'preview');
  assert.equal(await page.getByTestId('paper-basket-preview-entry').count(), 3);
  await page.screenshot({path: output + '/practice-three-preview.png'});
  check('Three reviewed practice questions preview without completing default examination quotas');
  const beforeNew = stored();
  delete beforeNew.uiState;
  await page.getByTestId('paper-basket-new').click();
  await page.getByTestId('paper-basket-new-choice').waitFor();
  await page.getByTestId('paper-basket-new-choice').getByRole('button', {name: '继续当前题篮', exact: true}).click();
  const afterNew = stored(); delete afterNew.uiState;
  jsonEqual(afterNew, beforeNew, 'Cancel new protects the exact original draft');
  check('New-basket choice protects original three-question practice');
  return {owner, basketId, basket: await get()};
}
