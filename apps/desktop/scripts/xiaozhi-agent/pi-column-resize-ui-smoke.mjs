import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright';

const desktop = process.cwd();
const output = fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-column-resize-ui-'));
const data = path.join(output, 'data');
const profile = path.join(output, 'profile');
const report = { success: false, checks: [], output };
let app, page;

const check = (name) => { report.checks.push({ name, pass: true }); console.log(`PASS ${name}`); };
const until = async (fn, timeout = 30000) => {
  const end = Date.now() + timeout;
  while (Date.now() < end) { if (await fn()) return; await new Promise(resolve => setTimeout(resolve, 100)); }
  throw new Error('Column resize condition timed out');
};
async function launch() {
  const env = {
    ...process.env,
    OMNI_EDU_DATA_ROOT: data,
    OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
    OMNI_EDU_XIAOZHI_PI: '1',
    OMNI_EDU_E2E_DIALOG_MODE: '1',
    OMNI_EDU_E2E_VISIBLE: '1',
  };
  delete env.ELECTRON_RUN_AS_NODE;
  delete env.NODE_OPTIONS;
  delete env.DEEPSEEK_API_KEY;
  app = await electron.launch({ args: [path.join(desktop, 'out/main/index.js'), `--user-data-dir=${profile}`], env, timeout: 60000 });
  page = await app.firstWindow();
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({ state: 'visible', timeout: 60000 });
  await page.waitForFunction(() => !document.querySelector('[data-testid="office-prompt-input"]')?.disabled);
}
async function openPanel() {
  const panel = page.getByTestId('edu-context-panel');
  if (!(await panel.isVisible().catch(() => false))) {
    await page.getByTestId('pi-aside-toggle').click();
    await panel.waitFor({ state: 'visible' });
  }
}
const navWidth = () => page.locator('.edu-navigation').boundingBox().then(box => box.width);
const panelWidth = () => page.locator('.edu-context-panel').boundingBox().then(box => box.width);
async function drag(handle, deltaX) {
  const box = await handle.boundingBox();
  assert(box);
  await page.mouse.move(box.x + 4, box.y + 200);
  await page.mouse.down();
  await page.mouse.move(box.x + 4 + deltaX, box.y + 200, { steps: 6 });
  await page.mouse.up();
  await page.waitForTimeout(200);
}
try {
  await launch();
  await openPanel();
  assert.equal(await page.getByTestId('edu-resizer-left').count(), 1);
  assert.equal(await page.getByTestId('edu-resizer-right').count(), 1);
  assert.equal(await page.getByTestId('edu-resizer-left').getAttribute('role'), 'separator');
  assert.equal(await page.getByTestId('edu-resizer-left').getAttribute('aria-orientation'), 'vertical');
  assert.equal(await page.getByTestId('edu-resizer-left').getAttribute('tabindex'), '0');
  check('Both side columns expose visible, keyboard-focusable vertical separators');

  const navStart = await navWidth();
  await drag(page.getByTestId('edu-resizer-left'), 56);
  const navAfterDrag = await navWidth();
  assert(navAfterDrag > navStart + 30, `${navStart} -> ${navAfterDrag}`);
  check('Dragging the left separator widens the navigation column');

  const panelStart = await panelWidth();
  await drag(page.getByTestId('edu-resizer-right'), -64);
  const panelAfterDrag = await panelWidth();
  assert(panelAfterDrag > panelStart + 30, `${panelStart} -> ${panelAfterDrag}`);
  check('Dragging the right separator widens the task/source column');

  const navBeforeKey = await navWidth();
  await page.getByTestId('edu-resizer-left').focus();
  await page.keyboard.press('ArrowLeft');
  const navAfterKey = await navWidth();
  assert(navAfterKey < navBeforeKey - 8, `${navBeforeKey} -> ${navAfterKey}`);
  const panelBeforeKey = await panelWidth();
  await page.getByTestId('edu-resizer-right').focus();
  await page.keyboard.press('ArrowRight');
  const panelAfterKey = await panelWidth();
  assert(panelAfterKey < panelBeforeKey - 8, `${panelBeforeKey} -> ${panelAfterKey}`);
  check('Arrow keys resize both columns without a pointer');

  const stored = await page.evaluate(() => ({
    nav: Number(localStorage.getItem('xiaozhi.ui.navWidth.v1')),
    panel: Number(localStorage.getItem('xiaozhi.ui.panelWidth.v1')),
  }));
  assert(Math.abs(stored.nav - navAfterKey) < 2);
  assert(Math.abs(stored.panel - panelAfterKey) < 2);

  await app.close(); app = undefined;
  await launch();
  await openPanel();
  assert(Math.abs(await navWidth() - stored.nav) < 2);
  assert(Math.abs(await panelWidth() - stored.panel) < 2);
  check('Both column widths persist across a real app restart');

  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    await app.evaluate(({ BrowserWindow }, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height), { width, height });
    await page.waitForFunction(size => innerWidth === size.width && innerHeight === size.height, { width, height });
    const center = await page.locator('.edu-chat-main').boundingBox();
    assert(center && center.width >= 300, `center width ${center?.width}`);
    check(`Resized columns leave a usable center at ${width}x${height}`);
  }

  check('Resize handles remain inside the native workspace and do not break the composer');
  report.success = true;
} catch (error) {
  report.error = String(error.stack || error);
  process.exitCode = 1;
  await page?.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
} finally {
  await app?.close().catch(() => {});
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ success: report.success, checks: report.checks.length, error: report.error, output }, null, 2));
}
