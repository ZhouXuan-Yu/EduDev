import assert from 'node:assert/strict';
import {disclosureTrigger} from './paper-basket-ui-driver.mjs';
import {entryCard, visibleUnique} from './paper-basket-ui-locators.mjs';

/** Serializable snapshot of actual natural form fields, not a renderer mutation or a JSON editor. */
export function questionInputBlocks(role) {
  return [...role.querySelectorAll(':scope > fieldset')].map((block, index) => {
    const legend = block.querySelector(':scope > legend')?.textContent;
    const name = legend?.match(/^第 (\d+) 块 · (.+)$/);
    if (!name || Number(name[1]) !== index + 1) throw Error('Unexpected ordered input block');
    if (name[2] === '文字') return {type: 'text', text: block.querySelector('[data-testid="paper-instance-text"]').value};
    if (name[2] === '公式') return {type: 'formula', latex: block.querySelector('[data-testid="paper-instance-formula"]').value};
    if (name[2] === '选项' || name[2] === '小问') {
      const labels = [...block.querySelectorAll('[data-testid="paper-instance-item-label"]')];
      const texts = [...block.querySelectorAll('[data-testid="paper-instance-item-text"]')];
      if (!labels.length || labels.length !== texts.length) throw Error('Incomplete item form');
      return {type: name[2] === '选项' ? 'options' : 'subquestions', items: labels.map((label, i) => ({label: label.value, text: texts[i].value}))};
    }
    if (name[2] === '表格') return {type: 'table', rows: [...block.querySelectorAll('tbody > tr')]
      .map(row => [...row.querySelectorAll('input')].map(input => input.value))};
    throw Error('This text-fixture UI scenario must not flatten or discard a source-image dependency');
  });
}

export async function ensureQuestionInput(page, entryId) {
  const card = await visibleUnique(entryCard(page, entryId), 'Exact editable entry');
  if (!await card.getByTestId('paper-instance-form').isVisible()) await card.getByTestId('paper-instance-open').click();
  const source = card.getByTestId('paper-instance-edit-question');
  if (await source.isVisible()) await source.click();
  const role = await visibleUnique(card.getByTestId('paper-instance-role-question'), 'Question natural form');
  const text = await visibleUnique(role.getByTestId('paper-instance-text'), 'Single text-only fixture statement');
  return {card, role, text};
}

export async function editQuestionStatement(page, entryId, suffix) {
  const {role, text} = await ensureQuestionInput(page, entryId);
  const statement = (await text.inputValue()) + '\n' + suffix;
  await text.fill(statement);
  return {statement, content: {mode: 'edited', blocks: await role.evaluate(questionInputBlocks)}};
}

export async function editInstanceForm(ctx, question, entryId) {
  const {page, marker} = ctx;
  const {card, role, text} = await ensureQuestionInput(page, entryId);
  // Use the actual split statement. Re-inserting source.stem here would duplicate its A-D options.
  await text.fill((await text.inputValue()) + '\n本卷复核：' + marker);
  const optionBlock = role.getByRole('group', {name: /^第 \d+ 块 · 选项$/});
  assert(await optionBlock.count() <= 1, 'Controlled fixture has at most one seeded option group');
  if (!await optionBlock.count()) await role.getByTestId('paper-instance-add-options').click();
  await visibleUnique(optionBlock, 'One seeded or explicitly created options block');
  const optionFields = optionBlock.getByTestId('paper-instance-item-text');
  const optionLabels = await optionBlock.getByTestId('paper-instance-item-label').evaluateAll(nodes => nodes.map(node => node.value));
  assert(optionLabels.length >= 2 && new Set(optionLabels).size === optionLabels.length);
  assert.deepEqual(optionLabels.slice(0, 2), ['A', 'B']);
  assert.equal(await optionFields.count(), optionLabels.length);
  await optionFields.nth(0).fill('本卷选项甲 ' + marker); await optionFields.nth(1).fill('本卷选项乙 ' + marker);
  await role.getByTestId('paper-instance-add-subquestions').click();
  const subBlock = role.getByRole('group', {name: /^第 \d+ 块 · 小问$/});
  await visibleUnique(subBlock, 'One explicit subquestion group');
  await (await visibleUnique(subBlock.getByTestId('paper-instance-item-text'), 'Single explicit subquestion')).fill('说明本题判断依据 ' + marker);
  const content = {question: {mode: 'edited', blocks: await role.evaluate(questionInputBlocks)}};
  for (const [name, label] of [['answer', '参考答案'], ['analysis', '解析']]) {
    const trigger = await visibleUnique(disclosureTrigger(card.getByTestId('paper-instance-edit-fold-' + name), label), 'Role official trigger');
    if (await trigger.getAttribute('aria-expanded') !== 'true') await trigger.click();
    await card.getByTestId('paper-instance-edit-' + name).click();
    const input = await visibleUnique(card.getByTestId('paper-instance-role-' + name).getByTestId('paper-instance-text'), 'One source-role text seed');
    const value = question[name] + '\n' + (name === 'answer' ? '教师补答 ' : '教师解析 ') + marker;
    await input.fill(value); content[name] = {mode: 'edited', blocks: [{type: 'text', text: value}]};
  }
  return content;
}
