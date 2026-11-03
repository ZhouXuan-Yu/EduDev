/** A26 real plan controls and strict scarcity, after the A24 cold-restored fixture. */
import assert from 'node:assert/strict';
import {readPort, until, jsonEqual} from './paper-export-intent-evidence.mjs';
import {readInstanceBasket, instanceStage} from './paper-instance-ui-driver.mjs';

export async function exerciseStrictFulfillment({page, app, data, output, report, check, owner, basketId}) {
  const get = () => readInstanceBasket(page, owner, basketId);
  const read = readPort(data + '/app.db');
  const stored = () => JSON.parse(read('SELECT data_json FROM paper_baskets WHERE id=?', [basketId])[0].data_json);
  await instanceStage({page, app, data, output, report}, owner, basketId, 'select');
  const plan = page.getByTestId('paper-fulfillment-plan');
  const trigger = plan.locator('[data-slot="disclosure-trigger"]');
  if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
  const sections = plan.getByTestId('paper-basket-section-editor');
  while (await sections.count() > 1) await sections.last().getByRole('button', {name: '移除此分节', exact: true}).click();
  assert.equal(await sections.getByTestId('paper-basket-section-type').inputValue(), '选择题');
  const original = stored().entries;
  const preserve = () => {
    const current = stored().entries;
    for (const entry of original) jsonEqual(current.find(next => next.entryId === entry.entryId), entry, 'Plan preserves exact chosen instance, order, review and source');
  };
  async function execute(count, scarcity) {
    await sections.getByTestId('paper-basket-section-count').fill(String(count));
    const before = await get();
    await plan.getByTestId('paper-plan-save').click();
    await until(async () => {const b = await get(); return b.revision === before.revision + 1 && b.fulfillment?.status === 'draft';}, 'Editable plan persisted');
    preserve(); let basket = await get();
    assert.equal(basket.entries.length, before.entries.length, 'Planning does not select questions');
    assert.equal(basket.fulfillment.issues.length, 0);
    const savedPlan = structuredClone(basket.fulfillment), planId = savedPlan.planId;
    await plan.getByTestId('paper-plan-confirm').click();
    await until(async () => {const b = await get(); return b.fulfillment?.status === 'confirmed';}, 'Teacher explicitly confirms exact plan');
    preserve(); basket = await get(); assert.equal(basket.entries.length, before.entries.length);
    assert.equal(basket.fulfillment.planId, planId);
    jsonEqual(basket.fulfillment.blueprint, savedPlan.blueprint, 'Confirmation preserves the exact teacher plan');
    jsonEqual(basket.blueprint, savedPlan.blueprint, 'Confirmed plan becomes the exact basket blueprint');
    assert.match(basket.fulfillment.membersDigest, /^[a-f0-9]{64}$/);
    assert.equal(basket.fulfillment.revision, basket.revision, 'Confirmation binds the new basket revision');
    assert.notEqual(basket.fulfillment.digest, savedPlan.digest, 'Revision change requires a new proof digest');
    await plan.getByTestId('paper-plan-fulfill').click();
    await until(async () => (await get()).fulfillment?.status === 'fulfilled', 'Only confirmed gaps filled');
    basket = await get(); preserve();
    assert.equal(basket.fulfillment.planId, planId);
    const result = basket.fulfillment.report;
    assert.equal(result.addedEntryIds.length, basket.entries.length - before.entries.length);
    assert.equal(new Set(basket.entries.map(e => e.questionId)).size, basket.entries.length);
    if (scarcity) {
      assert(result.shortages.length && result.shortages.every(gap => gap.missing > 0));
      assert(basket.entries.length < count, 'Insufficient real bank must remain short');
      assert.equal(basket.blueprint.sections[0].count, count, 'Cannot relax the requested quota');
    } else {
      assert.equal(basket.entries.length, count); assert.equal(result.shortages.length, 0);
    }
    check(scarcity ? 'Actual strict scarcity is reported without relaxing quota or replacing chosen members' : 'Editable plan → explicit confirmation → one remaining slot; selected reviews unchanged');
  }
  await execute(4, false);
  await execute(100, true);
  await plan.screenshot({path: output + '/strict-fulfillment-scarcity.png'});
}
