import assert from 'node:assert/strict';

export async function visibleUnique(locator, description) {
  await locator.waitFor({state: 'visible'});
  assert.equal(await locator.count(), 1, description + ': exactly one target');
  assert.equal(await locator.isVisible(), true, description + ': target must be visible');
  return locator;
}

export function selectTrigger(root, label) {
  // React Aria includes the selected value in the button's accessible name as well as its label.
  return root.getByRole('button', {name: label}).and(root.locator('[data-slot="select-trigger"]'));
}

export function entryCard(page, entryId, preview = false) {
  assert(/^xibasketentry_[\da-f-]{36}$/i.test(entryId), 'Use the exact host entry identity');
  return page.getByTestId(preview ? 'paper-basket-preview-entry' : 'paper-basket-entry')
    .and(page.locator(`[data-entry-id="${entryId}"]`));
}

export async function entryAnchors(page, entryId, preview = false) {
  const card = await visibleUnique(entryCard(page, entryId, preview), 'Exact pinned question card');
  const level = preview ? 4 : 3;
  const name = preview ? /^第 \d+ 题$/ : /^第 \d+ 题 · /;
  // The direct card heading excludes projection headings and nested Disclosure headings.
  const heading = card.getByRole('heading', {level, name}).and(card.locator(`:scope > h${level}`));
  const body = card.getByTestId('paper-basket-question-stem');
  await visibleUnique(heading, 'Question number heading');
  await visibleUnique(body, 'Full question body');
  return {heading, body};
}

export async function candidateBody(page, questionId) {
  assert(/^[\w.-]+$/.test(questionId));
  const card = page.getByTestId('paper-basket-candidate').and(page.locator(`[data-question-id="${questionId}"]`));
  await visibleUnique(card, 'Exact candidate question');
  return visibleUnique(card.getByTestId('paper-basket-question-stem'), 'Full candidate body');
}
