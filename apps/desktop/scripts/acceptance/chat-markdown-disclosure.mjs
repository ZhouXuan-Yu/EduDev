import assert from 'node:assert/strict';

/** Completed public answers only. Exports counts/booleans, never DOM dumps,
 * answer text, body text, attributes, or private runtime snapshots. */
export async function assertChatMarkdownDisclosure(page, {conversation, turn, completedTurn}) {
  assert.equal(completedTurn.status, 'completed', 'Disclosure interaction requires a completed bound run');
  assert.equal(await conversation.count(), 1, 'Disclosure scope must be the actual conversation');
  assert.equal(await turn.getAttribute('data-turn-id'), completedTurn.id, 'Bind interaction to the completed run');
  const turnHandle = await turn.elementHandle();
  assert(turnHandle, 'Completed turn must be mounted');
  try {
    // Snapshot completion can precede the renderer commit. Never interact with
    // a still-streaming Markdown tree or race the upstream mode remount.
    await page.waitForFunction(node => node.isConnected && node.getAttribute('data-state') === 'completed',
      turnHandle, {timeout: 10000});
  } finally {await turnHandle.dispose();}
  assert.equal(await conversation.locator('details,summary').count(), 0, 'Conversation must contain no native details/summary');
  const candidates = completedTurn.answer.filter(item => item.phase === 'final_answer'
    && /<details(?:\s|>)/i.test(item.text));
  assert(candidates.length > 0, 'Actual raw final answer must contain a details opening tag');
  let body, wrappers;
  for (const item of candidates) {
    const candidate = turn.getByTestId('agent-reply-body').and(
      turn.locator(`[data-item-id=${JSON.stringify(item.id)}][data-phase="final_answer"]`));
    assert.equal(await candidate.count(), 1, 'Bind disclosure to the exact public final-answer item');
    const markers = candidate.locator('[data-office-markdown-root] [data-office-markdown-disclosure]');
    if (await markers.count()) {body = candidate; wrappers = markers; break;}
  }
  assert(body && wrappers, 'Raw details must render as an app-owned Markdown disclosure, not merely fenced/literal code');
  const count = await wrappers.count();
  assert(count >= 1, 'At least one actual Markdown disclosure is required');
  // Intentionally exercise the first rendered Markdown disclosure, including
  // when more disclosures are nested inside it. Never target process/tool UI.
  const wrapper = wrappers.first();
  const card = wrapper.locator(':scope > [data-slot="card"]');
  assert.equal(await card.count(), 1, 'App-owned marker must wrap the official Card');
  const trigger = card.locator('[data-slot="disclosure-trigger"]').first();
  const panel = card.locator('[data-slot="disclosure-content"]').first();
  assert.equal(await trigger.count(), 1);assert.equal(await panel.count(), 1);
  assert(await trigger.isVisible(), 'Completed Markdown trigger must be visible and operable');
  const initial = await trigger.getAttribute('aria-expanded');
  assert(['true', 'false'].includes(initial), 'Official trigger must expose expanded state');
  const handle = await trigger.elementHandle();
  assert(handle, 'Actual trigger must be mounted');
  const toggled = initial === 'true' ? 'false' : 'true';
  const assertState = async value => {
    await page.waitForFunction(({node, value}) => node.isConnected && node.getAttribute('aria-expanded') === value,
      {node: handle, value}, {timeout: 10000});
    assert.equal(await panel.getAttribute('aria-hidden'), value === 'true' ? 'false' : 'true');
    if (value === 'true') {
      await panel.waitFor({state: 'visible', timeout: 10000});
      assert(await panel.evaluate(node => Boolean(node.textContent?.trim())), 'Expanded Markdown disclosure must retain actual content');
    }
    assert(await trigger.evaluate(node => node.ownerDocument.activeElement === node), 'Keyboard interaction must retain trigger focus');
  };
  try {
    await trigger.focus();
    assert(await trigger.evaluate(node => node.ownerDocument.activeElement === node), 'Focus must reach the actual Markdown trigger');
    await page.keyboard.press('Enter');await assertState(toggled);
    await page.keyboard.press('Space');await assertState(initial);
    assert.equal(await conversation.locator('details,summary').count(), 0);
    return {rawFinalHasDetails: true, sameFinalConsumer: true, nativeDetailsSummary: 0,
      markdownDisclosureCount: count, officialCard: true, keyboard: ['Enter', 'Space'],
      focusRetained: true, initialExpandedStateRestored: true};
  } finally {await handle.dispose();}
}
