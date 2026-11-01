import assert from 'node:assert/strict';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sha256} from './evidence.mjs';
import {settleWorkspaceTransitions, measureTextContrast} from '../xiaozhi-agent/capture-workspace-metrics.mjs';
import {productEntry} from '../product-navigation.mjs';

export const schemaVersion = 'xiaozhi.paper-basket.v1';
export async function choose(page, trigger, id) {
  await trigger.focus(); await trigger.press('Enter');
  const option = page.getByRole('option').and(page.locator(`[data-option-id="${id}"]`));
  await option.waitFor(); await option.click();
  await page.getByRole('listbox').waitFor({state: 'hidden'});
}

export async function enterPaper(page) {
  await productEntry(page, 'teaching').click();
  await page.locator('[data-testid="hub-entry-paper"]:visible,[data-testid="nav-paper"]:visible').click();
  if (await page.getByTestId('paper-entry-basket').isVisible()) await page.getByTestId('paper-entry-basket').click();
  await page.getByTestId('paper-basket-workspace').waitFor();
}

export async function readBasket(page, sessionId, basketId) {
  const result = await page.evaluate(input => window.omniEdu.readPaperBasket(input), {schemaVersion, sessionId, basketId});
  assert.equal(result.ok, true, 'Read-only host verification must succeed');
  return result.value;
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

export async function capturePaper(app, page, output, report, name, anchor) {
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    const window = await app.browserWindow(page);
    try {await window.evaluate((w, size) => w.setContentSize(...size), [width, height]);}
    finally {await window.dispose();}
    await page.waitForFunction(size => innerWidth === size[0] && innerHeight === size[1], [width, height]);
    await anchor.scrollIntoViewIfNeeded(); await settle(app, page);
    const geometry = await anchor.evaluate(node => {
      const r = node.getBoundingClientRect();
      return {x: r.x, y: r.y, width: r.width, height: r.height, right: r.right, bottom: r.bottom,
        viewport: {width: innerWidth, height: innerHeight}, horizontalOverflow: document.documentElement.scrollWidth - innerWidth};
    });
    assert(geometry.width > 0 && geometry.height > 0 && geometry.x >= 0 && geometry.right <= width + 1);
    assert(geometry.y >= 0 && geometry.y < height && geometry.horizontalOverflow <= 1, 'Real visible anchor and no horizontal page overflow');
    const file = `${name}-${width}.png`;
    await page.screenshot({path: path.join(output, file)});
    report.screens.push({file, width, height, geometry});
  }
}

export async function enabledContrast(page, report, name, locator) {
  await locator.scrollIntoViewIfNeeded();
  assert.equal(await locator.isEnabled(), true);
  const value = await measureTextContrast(locator);
  report.contrast.push({name, ...value});
  assert(value.opacity > 0 && value.ratio >= 4.5, `${name}: enabled text requires 4.5, got ${value.ratio}`);
}
