import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { _electron as electron } from 'playwright';
import { createServer } from 'vite';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { DatabaseSync } from 'node:sqlite';
import { testMain, assertIsolatedPiMain } from './acceptance/build-root.mjs';
import { fingerprint } from './acceptance/evidence.mjs';

const desktop = path.resolve(import.meta.dirname, '..');
fs.mkdirSync(path.join(desktop, 'test-results'), { recursive: true });
const output = fs.mkdtempSync(path.join(desktop, 'test-results/sidebar-navigation-'));
const temp = fs.mkdtempSync(path.join(os.tmpdir(), 'xiaozhi-sidebar-'));
const profile = path.join(temp, 'profile'), data = path.join(temp, 'data');
const report = { success: false, checks: [], errors: [], styles: {}, viewports: [], output, temp, modelTasksSubmitted: 0 };
const check = (name) => { report.checks.push(name); console.log('PASS ' + name); };
const key = 'xiaozhi.ui.navigation.v1';
const groupIds = ['ask', 'materials', 'teaching', 'students'];
const viewGroups = { ai: 'ask', knowledge: 'materials', artifacts: 'teaching', notebook: 'teaching', book: 'teaching', question_notebook: 'teaching', paper: 'teaching', students: 'students', search: 'students', intake: 'students', mistakes: 'students', mastery: 'students', review: 'students', analytics: 'students' };
let app, page;
const shell = () => page.locator('.edu-shell:visible');
const group = (id) => shell().getByTestId('nav-group-' + id);
async function openGroup(id, open = true) {
  if (await group(id).getAttribute('aria-expanded') !== String(open)) await group(id).click();
  await page.waitForTimeout(210);
}
async function navigate(view) {
  if (viewGroups[view]) await openGroup(viewGroups[view]);
  await shell().getByTestId(view === 'ai' ? 'nav-ai-workspace' : 'nav-' + view).click();
  await page.locator(`.edu-shell[data-view="${view}"]:visible`).waitFor();
}
async function shot(name) { await page.screenshot({ path: path.join(output, name + '.png') }); }
async function launch() {
  const env = { ...process.env, OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'), OMNI_EDU_XIAOZHI_PI: '1', DEEPSEEK_API_KEY: '', DEEPSEEK_MODEL: '', NODE_ENV: 'development' };
  for (const name of Object.keys(env)) if (name.startsWith('OMNI_EDU_E2E_') || ['ELECTRON_RUN_AS_NODE', 'NODE_OPTIONS', 'ELECTRON_RENDERER_URL'].includes(name)) delete env[name];
  app = await electron.launch({ args: [testMain(desktop), '--force-device-scale-factor=1', '--user-data-dir=' + profile], env, cwd: desktop, timeout: 60000 });
  report.runtime = await assertIsolatedPiMain(app, testMain(desktop), profile);
  page = await app.firstWindow();
  page.on('pageerror', (error) => report.errors.push(String(error)));
  await page.getByTestId('edu-navigation').waitFor({ timeout: 90000 });
  report.source = await page.url();
}
async function size(width, height) {
  await app.evaluate(({ BrowserWindow }, size) => {
    const win = BrowserWindow.getAllWindows()[0];
    if (win.isMaximized()) win.unmaximize();
    win.webContents.setZoomFactor(1);
    win.setContentSize(size.width, size.height);
  }, { width, height });
  await page.waitForFunction((s) => innerWidth === s.width && innerHeight === s.height, { width, height });
}
const style = (locator) => locator.evaluate((el) => {
  const s = getComputedStyle(el);
  return { background: s.backgroundColor, color: s.color, outline: s.outlineStyle, outlineWidth: s.outlineWidth, transition: s.transitionDuration };
});
try {
  // Exercise parsing independently of a working Chromium storage backend.
  const server = await createServer({ root: desktop, configFile: false, appType: 'custom', server: { middlewareMode: true, hmr: false }, optimizeDeps: { noDiscovery: true } });
  try {
    const { readNavigationGroups } = await server.ssrLoadModule('/src/renderer/ui-system/navigation-preferences.ts');
    const { EduNavigation } = await server.ssrLoadModule('/src/renderer/ui-system/EduNavigation.tsx');
    const disabled = renderToStaticMarkup(React.createElement(EduNavigation, { view: 'ai', disabled: true }));
    assert.equal((disabled.match(/<button\b/g) || []).length, 19);
    assert.equal((disabled.match(/ disabled=""/g) || []).length, 19);
    check('existing disabled guard applies to every group, destination and footer settings');
    const saved = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
    for (const text of ['{bad', 'null', '{"schema":2}', '{"schema":1,"expanded":null}']) {
      Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => text } });
      assert.deepEqual(readNavigationGroups(), { ask: true, materials: true, teaching: true, students: true });
    }
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, value: { getItem: () => '{"schema":1,"expanded":{"ask":false,"materials":"false","students":false,"unknown":false}}' } });
    assert.deepEqual(readNavigationGroups(), { ask: false, materials: true, teaching: true, students: false });
    Object.defineProperty(globalThis, 'localStorage', { configurable: true, get: () => { throw new Error('blocked storage'); } });
    assert.equal(readNavigationGroups().ask, true);
    if (saved) Object.defineProperty(globalThis, 'localStorage', saved); else delete globalThis.localStorage;
    check('corrupt, unknown-version, partially valid and blocked preferences recover safely');
  } finally { await server.close(); }
  await launch();
  await size(1366, 768);
  assert.equal(await shell().locator('.edu-nav-group-title').count(), 4);
  assert.deepEqual(await shell().locator('.edu-nav-group-title').allTextContents(), ['工作', '资料', '教学', '学生']);
  for (const id of groupIds) assert.equal(await group(id).getAttribute('aria-expanded'), 'true');
  assert.equal(await shell().getByTestId('product-rail').getByTestId('nav-settings').count(), 0);
  assert.equal(await shell().getByTestId('edu-navigation-footer').getByRole('button', { name: '设置', exact: true }).count(), 1);
  assert(!await shell().getByTestId('edu-navigation').innerText().then((t) => t.includes('资料保存在本机') || t.includes('系统')));
  check('four multi-expand groups, unchanged labels, settings outside scroll area and removed note');
  await shot('expanded-1366');
  await group('teaching').click();
  const duration = await group('teaching').locator('svg').evaluate((el) => parseFloat(getComputedStyle(el).transitionDuration));
  assert(duration >= 0.15 && duration <= 0.2);
  assert.equal(await shell().getAttribute('data-view'), 'ai');
  await page.waitForTimeout(210);
  const panelId = await group('teaching').getAttribute('aria-controls');
  assert.equal(await page.locator(`[id="${panelId}"]`).evaluate((el) => el.getBoundingClientRect().height), 0);
  assert(await page.locator(`[id="${panelId}"]`).evaluate((el) => el.inert));
  await group('teaching').focus();
  await page.keyboard.press('Tab');
  assert.equal(await group('students').evaluate((el) => el === document.activeElement), true);
  await group('teaching').focus();
  await page.keyboard.press('Enter');
  assert.equal(await group('teaching').getAttribute('aria-expanded'), 'true');
  await page.keyboard.press('Space');
  assert.equal(await group('teaching').getAttribute('aria-expanded'), 'false');
  assert.equal(await group('students').getAttribute('aria-expanded'), 'true');
  check('heading toggles without navigation; zero-height collapse, inert descendants, Enter/Space and multi-expand');

  await navigate('knowledge');
  assert.equal(await group('teaching').getAttribute('aria-expanded'), 'false');
  await navigate('settings');
  assert.equal(await shell().getByTestId('nav-settings').getAttribute('aria-current'), 'page');
  await page.getByTestId('desktop-back').click();
  await page.locator('.edu-shell[data-view="knowledge"]:visible').waitFor();
  await openGroup('materials', false);
  await navigate('settings');
  await page.getByTestId('desktop-back').click();
  await page.locator('.edu-shell[data-view="knowledge"]:visible').waitFor();
  assert.equal(await group('materials').getAttribute('aria-expanded'), 'true');
  assert.equal(await group('teaching').getAttribute('aria-expanded'), 'false');
  check('page changes and history auto-reveal destination while preserving other collapsed groups');

  for (const view of [...Object.keys(viewGroups), 'settings']) {
    await navigate(view);
    const current = shell().getByTestId('edu-navigation').locator('[aria-current="page"]');
    assert.equal(await current.count(), 1);
    assert(!await current.evaluate((el) => !!el.closest('[inert]')));
  }
  check('all 15 existing page routes are reachable with one visible active item');

  // Actual teacher import, original IPC, SQLite readback and cold restart.
  await navigate('knowledge');
  const fixture = path.join(temp, '侧栏验收资料.txt');
  fs.writeFileSync(fixture, '等式的性质：等式两边同时加上同一个数，等式仍成立。');
  await app.evaluate(({ dialog }, file) => { dialog.showOpenDialog = async () => ({ canceled: false, filePaths: [file] }); }, fixture);
  await page.getByTestId('materials-import').click();
  await page.getByText('侧栏验收资料', { exact: false }).first().waitFor({ timeout: 60000 });
  const db = new DatabaseSync(path.join(data, 'app.db'), { readOnly: true });
  const count = db.prepare('SELECT COUNT(*) n FROM teacher_resources WHERE original_file_name LIKE ?').get('%侧栏验收资料%').n;
  db.close(); assert(count > 0);
  await openGroup('teaching', false); await openGroup('students', false);
  await app.close(); app = null; await launch();
  assert.equal(await group('teaching').getAttribute('aria-expanded'), 'false');
  assert.equal(await group('students').getAttribute('aria-expanded'), 'false');
  await navigate('knowledge');
  await page.getByText('侧栏验收资料', { exact: false }).first().waitFor({ timeout: 60000 });
  check('local import persists in original SQLite and UI across restart; collapsed preferences survive');

  await navigate('ai');
  for (const [width, height] of [[1366, 768], [1920, 1080]]) {
    await size(width, height);
    for (const id of groupIds) await openGroup(id);
    const rail = shell().getByTestId('product-rail'), footer = shell().getByTestId('edu-navigation-footer');
    const before = await footer.boundingBox();
    const geometry = await rail.evaluate((el) => ({ width: innerWidth, height: innerHeight, client: el.clientHeight, scroll: el.scrollHeight, overflow: getComputedStyle(el).overflowY, asideOverflow: getComputedStyle(el.parentElement).overflowY, documentOverflow: document.documentElement.scrollHeight > innerHeight || document.documentElement.scrollWidth > innerWidth }));
    assert.equal(geometry.documentOverflow, false); assert.equal(geometry.asideOverflow, 'hidden'); assert.equal(geometry.overflow, 'auto');
    if (height === 768) assert(geometry.scroll > geometry.client);
    await rail.evaluate((el) => { el.scrollTop = el.scrollHeight; });
    assert.deepEqual(await footer.boundingBox(), before);
    assert(before.y + before.height <= height - 16);
    report.viewports.push(geometry);
    await rail.evaluate((el) => { el.scrollTop = 0; });
    await shot('expanded-' + width);
    for (const id of ['materials', 'teaching', 'students']) await openGroup(id, false);
    await shot('collapsed-' + width);
  }
  check('1366×768 and 1920×1080: one navigation scroller, fixed footer, safe spacing, no viewport overflow');

  const settings = shell().getByTestId('nav-settings');
  await page.mouse.move(600, 300);
  report.styles.default = await style(settings);
  await settings.hover(); report.styles.hover = await style(settings); await shot('settings-hover');
  assert.notEqual(report.styles.default.background, report.styles.hover.background);
  await page.mouse.down(); report.styles.pressed = await style(settings); await page.mouse.move(600, 300); await page.mouse.up();
  assert.notEqual(report.styles.pressed.background, report.styles.hover.background);
  await settings.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');
  report.styles.focus = await style(settings); await shot('settings-focus');
  assert.equal(report.styles.focus.outline, 'solid'); assert.equal(report.styles.focus.outlineWidth, '2px');
  await navigate('settings'); report.styles.selected = await style(shell().getByTestId('nav-settings')); await shot('settings-active');
  assert.notEqual(report.styles.selected.background, report.styles.default.background);
  assert.notEqual(report.styles.selected.background, report.styles.hover.background);
  check('settings Hover, pressed, focus-visible and active-page styles are distinct');

  await page.emulateMedia({ reducedMotion: 'reduce' });
  await openGroup('teaching');
  assert.equal(await group('teaching').locator('svg').evaluate((el) => getComputedStyle(el).transitionDuration), '0s');
  assert.equal(await group('teaching').locator('svg').evaluate((el) => getComputedStyle(el).transform), 'matrix(0, 1, -1, 0, 0, 0)');
  await openGroup('teaching', false);
  check('reduced-motion disables transitions; chevron rotates 90 degrees');
  await size(1366, 768);
  await navigate('analytics');
  await navigate('students');
  await openGroup('students', false);
  await page.getByTestId('desktop-back').click();
  await page.locator('.edu-shell[data-view="analytics"]:visible').waitFor();
  assert.equal(await group('students').getAttribute('aria-expanded'), 'true');
  assert(await shell().getByTestId('nav-analytics').evaluate((el) => {
    const rect = el.getBoundingClientRect(), rail = el.closest('nav').getBoundingClientRect();
    return rect.top >= rail.top && rect.bottom <= rail.bottom;
  }));
  check('reduced-motion history navigation reveals the active destination inside the scroll viewport');

  await page.evaluate(() => { Storage.prototype.setItem = () => { throw new Error('quota'); }; Storage.prototype.getItem = () => { throw new Error('blocked'); }; });
  await group('teaching').click();
  assert.equal(await group('teaching').getAttribute('aria-expanded'), 'true');
  await navigate('knowledge');
  await group('teaching').click();
  check('unavailable storage does not block toggling or page navigation');
  assert.deepEqual(report.errors, []);
  check('zero renderer exceptions');
  report.success = true;
  report.bundleSha256 = createHash('sha256').update(fs.readFileSync(testMain(desktop))).digest('hex');
  report.build = fingerprint(path.join(desktop, 'out'));
} catch (error) {
  report.failure = String(error.stack || error);
  if (page) await shot('failure').catch(() => {});
  throw error;
} finally {
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log('REPORT ' + path.join(output, 'report.json'));
  if (app) await app.close();
}
