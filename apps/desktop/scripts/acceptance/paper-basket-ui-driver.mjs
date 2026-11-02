import assert from 'node:assert/strict';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sha256} from './evidence.mjs';
import {settleWorkspaceTransitions, measureTextContrast} from '../xiaozhi-agent/capture-workspace-metrics.mjs';
import {productEntry} from '../product-navigation.mjs';
import {entryCard, visibleUnique} from './paper-basket-ui-locators.mjs';

export const schemaVersion = 'xiaozhi.paper-basket.v1';
export function disclosureTrigger(root, name) {
  return root.getByRole('button', {name, exact: true}).and(root.locator('[data-slot="disclosure-trigger"]'));
}
export async function choose(page, trigger, id) {
  await visibleUnique(trigger, 'Select trigger');
  await trigger.and(page.locator(':enabled:not([aria-disabled="true"])')).waitFor();
  await trigger.focus(); await trigger.press('Enter');
  const option = page.getByRole('option').and(page.locator(`[data-option-id="${id}"]`));
  await visibleUnique(option, 'Exact Select option'); await option.click();
  await page.getByRole('listbox').waitFor({state: 'hidden'});
}

/** Keyword tokens use the existing host OR contract; select a real type before finding an exact fixture question. */
export async function findCandidate(page, report, sessionId, basketId, question) {
  const query = question.stem.slice(0, 36);
  await choose(page, page.getByTestId('paper-basket-type'), question.questionType);
  await page.getByTestId('paper-basket-search').fill(query);
  await page.waitForFunction(async input => {
    const root = document.querySelector('[data-testid="paper-basket-workspace"]');
    const refresh = document.querySelector('[data-testid="paper-basket-refresh-candidates"]');
    if (root?.dataset.basketId !== input.basketId || !refresh || refresh.disabled ||
      document.querySelector('[data-testid="paper-basket-ui-pending"]')) return false;
    const result = await window.omniEdu.readPaperBasket({schemaVersion: input.schemaVersion,
      sessionId: input.sessionId, basketId: input.basketId});
    const ui = result.ok && result.value.uiState;
    return ui && ui.offset === 0 && ui.filters.query === input.query && ui.filters.questionType === input.questionType;
  }, {schemaVersion, sessionId, basketId, query, questionType: question.questionType});
  const filters = {query, questionType: question.questionType, subject: question.subject,
    grade: question.grade, offset: 0, limit: 12};
  // Read-only evidence for the same public query. Membership is changed only by the row's actual Add button.
  const result = await page.evaluate(filters => window.omniEdu.listQuestionNotebook(filters), filters);
  const itemIds = result.items.map(item => item.id);
  (report.candidateQueries ||= []).push({filters, total: result.total, itemIds, targetId: question.id});
  assert(itemIds.includes(question.id), 'Actual typed fixture query must contain this exact question on its first page');
  const row = page.locator(`[data-testid="paper-basket-candidate"][data-question-id="${question.id}"]`);
  return visibleUnique(row, 'Exact filtered candidate');
}

export async function enterPaper(page) {
  await (await visibleUnique(productEntry(page, 'teaching'), 'Teaching navigation')).click();
  const hub = await visibleUnique(page.getByTestId('workbench-hub-teaching'), 'Actual teaching hub');
  await (await visibleUnique(hub.getByTestId('teaching-page-navigation').getByTestId('hub-entry-paper'), 'Teaching hub paper entry')).click();
  if (await page.getByTestId('paper-entry-basket').isVisible()) await page.getByTestId('paper-entry-basket').click();
  await visibleUnique(page.getByTestId('paper-basket-workspace'), 'Paper workspace');
}

export async function readBasket(page, sessionId, basketId) {
  const result = await page.evaluate(input => window.omniEdu.readPaperBasket(input), {schemaVersion, sessionId, basketId});
  assert.equal(result.ok, true, 'Read-only host verification must succeed');
  return result.value;
}

/** Serializable read-only gate: a mounted shell is not a restored basket or a completed UI save. */
export async function basketUiReady({reference, expected}) {
  const currentRoot = () => {
    const roots = document.querySelectorAll('[data-testid="paper-basket-workspace"]');
    if (roots.length !== 1) return;
    const root = roots[0], stage = root.querySelector(`[data-testid="paper-basket-stage-${expected.stage}"]`);
    // This gate covers an active basket. Its stage action is disabled while the hook is loading,
    // mutating or awaiting an uncertain response, even when an older basket is still rendered.
    if (!root.isConnected || root.dataset.basketId !== reference.basketId || root.dataset.stage !== expected.stage ||
      !stage || stage.disabled || root.querySelector('[data-testid="paper-basket-ui-pending"]')) return;
    return root;
  };
  const root = currentRoot();
  if (!root) return false;
  const result = await window.omniEdu.readPaperBasket(reference);
  // A successful host read says nothing about DOM changes during IPC. A remounted node with the
  // same reference also starts a new restore lifecycle, so it cannot validate this earlier sample.
  if (currentRoot() !== root) return false;
  if (!result.ok || result.value.id !== reference.basketId || result.value.sessionId !== reference.sessionId) return false;
  const ui = result.value.uiState;
  return !!ui && ui.stage === expected.stage &&
    (expected.query === undefined || (ui.filters.query || '') === expected.query);
}

export async function waitForBasketUi(page, sessionId, basketId, expected) {
  await page.waitForFunction(basketUiReady, {reference: {schemaVersion, sessionId, basketId}, expected});
  await visibleUnique(page.getByTestId('paper-basket-workspace'), 'Restored exact basket workspace');
}

/** Exercise the actual titlebar history; preferences must finish saving before leaving. */
export async function historyStage(page, report, sessionId, basketId, stage, direction) {
  assert(['back', 'forward'].includes(direction));
  await page.getByTestId('paper-basket-ui-pending').waitFor({state: 'hidden'});
  const before = await readBasket(page, sessionId, basketId);
  const button = page.getByTestId(`desktop-${direction}`);
  await visibleUnique(button, 'Actual history button');
  assert.equal(await button.isEnabled(), true, `Actual ${direction} button must be available`);
  await button.click();
  await page.waitForFunction(async input => {
    const workspace = document.querySelector('[data-testid="paper-basket-workspace"]');
    if (workspace?.dataset.basketId !== input.basketId || workspace.dataset.stage !== input.stage ||
      document.querySelector('[data-testid="paper-basket-ui-pending"]')) return false;
    const {stage: _stage, ...reference} = input;
    const result = await window.omniEdu.readPaperBasket(reference);
    return result.ok && result.value.uiState?.stage === input.stage;
  }, {schemaVersion, sessionId, basketId, stage});
  const after = await readBasket(page, sessionId, basketId);
  assert.equal(after.revision, before.revision, 'History changes browsing preference only');
  assert.deepEqual(after.entries, before.entries, 'History retains exact pinned members');
  (report.history ||= []).push({direction, basketId, stage, revision: after.revision});
}

/** Tabs and Disclosure keep their official keyboard behavior, including Escape. */
export async function answerKeyboard(page, report, entryId) {
  const workspace = page.getByTestId('paper-basket-workspace');
  const answer = entryCard(page, entryId, true).getByTestId('paper-basket-answer');
  const trigger = disclosureTrigger(answer, '参考答案与解析');
  await visibleUnique(trigger, 'Official answer disclosure trigger');
  assert.equal(await trigger.getAttribute('aria-expanded'), 'false');
  await page.getByTestId('paper-basket-teacher').focus();
  let tabs = 0;
  for (; tabs < 32; tabs++) {
    await page.keyboard.press('Tab');
    if (await trigger.evaluate(node => node === document.activeElement)) break;
  }
  assert(tabs < 32, 'First answer trigger must be reachable by real Tab navigation');
  await page.keyboard.press('Enter');
  await trigger.and(page.locator('[aria-expanded="true"]')).waitFor();
  await page.keyboard.press('Escape');
  assert.equal(await trigger.evaluate(node => node === document.activeElement), true, 'Escape retains accessible trigger focus');
  const expandedAfterEscape = await trigger.getAttribute('aria-expanded');
  assert(['true', 'false'].includes(expandedAfterEscape));
  // Disclosure need not close on Escape. Use its supported Enter toggle if still open.
  if (expandedAfterEscape === 'true') await page.keyboard.press('Enter');
  await trigger.and(page.locator('[aria-expanded="false"]')).waitFor();
  assert.equal(await workspace.locator('details,summary').count(), 0);
  report.answerKeyboard = {tabs: tabs + 1, enterExpanded: true, expandedAfterEscape, finalExpanded: false, nativeDetails: 0};
}

export function ledger(data) {
  const db = new DatabaseSync(path.join(data, 'app.db'), {readOnly: true});
  try {
    // Hash locally. Never export or retain raw model requests across the renderer boundary.
    return Object.fromEntries(['ai_agent_runs', 'ai_agent_run_requests', 'ai_agent_events', 'xiaozhi_event_journal'].map(table => {
      const rows = db.prepare(`SELECT * FROM ${table} ORDER BY rowid`).all();
      return [table, {count: rows.length, sha256: sha256(JSON.stringify(rows))}];
    }));
  } finally {db.close();}
}

export async function settle(app, page) {
  const window = await app.browserWindow(page);
  try {return await settleWorkspaceTransitions(page, {hiddenSnapshot: !await window.evaluate(w => w.isVisible())});}
  finally {await window.dispose();}
}

export async function capturePaper(app, page, output, report, name, anchor, body = anchor) {
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    const window = await app.browserWindow(page);
    try {await window.evaluate((w, size) => w.setContentSize(...size), [width, height]);}
    finally {await window.dispose();}
    await page.waitForFunction(size => innerWidth === size[0] && innerHeight === size[1], [width, height]);
    await visibleUnique(anchor, name + ' screenshot anchor');
    await visibleUnique(body, name + ' question body');
    await anchor.scrollIntoViewIfNeeded(); await settle(app, page);
    const geometry = await anchor.evaluate(node => {
      const r = node.getBoundingClientRect();
      return {x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom,
        viewport: {width: innerWidth, height: innerHeight}, horizontalOverflow: document.documentElement.scrollWidth - innerWidth};
    });
    assert(geometry.width > 0 && geometry.height > 0 && geometry.x >= 0 && geometry.right <= width + 1);
    assert(geometry.y >= 0 && geometry.y < height && geometry.horizontalOverflow <= 1, 'Real visible anchor and no horizontal page overflow');
    const bodyGeometry = await body.evaluate(node => {
      const r = node.getBoundingClientRect();
      return {x:r.x, y:r.y, width:r.width, height:r.height, right:r.right, bottom:r.bottom};
    });
    assert(bodyGeometry.width > 0 && bodyGeometry.height > 0 && bodyGeometry.x >= 0 && bodyGeometry.right <= width + 1);
    assert(bodyGeometry.bottom > 0 && bodyGeometry.y < height, 'The real question body must intersect the screenshot viewport');
    const file = `${name}-${width}.png`;
    await page.screenshot({path: path.join(output, file)});
    report.screens.push({file, width, height, geometry, bodyGeometry});
  }
}

export async function enabledContrast(page, report, name, locator) {
  await visibleUnique(locator, name);
  await locator.scrollIntoViewIfNeeded();
  assert.equal(await locator.isEnabled(), true);
  const value = await measureTextContrast(locator);
  report.contrast.push({name, ...value});
  assert(value.opacity > 0 && value.ratio >= 4.5, `${name}: enabled text requires 4.5, got ${value.ratio}`);
}
