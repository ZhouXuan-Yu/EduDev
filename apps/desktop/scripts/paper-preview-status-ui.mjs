import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint, sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {continuationBootstrap, continuationGuardRead} from './acceptance/paper-adaptation-continuation.mjs';
import {productEntry} from './product-navigation.mjs';

const desktop = path.resolve(import.meta.dirname, '..');
const owned = fs.realpathSync(path.join(desktop, 'test-results'));
assert.equal(process.argv.length, 4);
const pinsPath = fs.realpathSync(path.resolve(desktop, process.argv[2]));
assert(pinsPath.startsWith(owned + path.sep));
const pins = JSON.parse(fs.readFileSync(pinsPath));
const mode = process.argv[3];
assert(['before', 'after', 'integrated'].includes(mode));
assert(fs.realpathSync(pins.buildRoot).startsWith(owned + path.sep));
const fixture = path.join(owned, 'paper-basket-panel-before-Xqylg8');
const originalData = fingerprint(path.join(fixture, 'data')).sha256;
const output = fs.mkdtempSync(path.join(owned, 'paper-preview-status-' + mode + '-'));
const data = path.join(output, 'data'), profile = path.join(output, 'profile');
fs.cpSync(path.join(fixture, 'data'), data, {recursive: true});
fs.cpSync(path.join(fixture, 'profile'), profile, {recursive: true});
const bootstrap = path.join(output, 'bootstrap.cjs');
fs.writeFileSync(bootstrap, continuationBootstrap({main: path.join(pins.buildRoot, 'main/index.js'), profile}));
const report = {success: false, mode, output, pins, originalData, scriptSha256: sha256(fs.readFileSync(import.meta.filename)),
  scope: 'Copied owned teacher fixtures, canonical Electron/typed host/SQLite, no model or successful-write mocks.', checks: [], states: [], errors: [], launches: []};
const save = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
const check = name => {report.checks.push(name); save();};
const verify = () => {
  assert.equal(fingerprint(path.join(desktop, 'src')).sha256, pins.source);
  assert.equal(fingerprint(pins.buildRoot).sha256, pins.build);
  assert.equal(fingerprint(path.join(fixture, 'data')).sha256, originalData);
};
const env = {...process.env};
for (const key of Object.keys(env)) if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) || key.startsWith('OMNI_EDU_') ||
  ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(key)) delete env[key];
Object.assign(env, {OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
  OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_VISIBLE: '1', NODE_ENV: 'development'});
let app, page, cdp;
const sheets = new Map();
function basket() {
  const db = new DatabaseSync(path.join(data, 'app.db'), {readOnly: true});
  try {const row = db.prepare('SELECT data_json FROM paper_baskets').get(); return JSON.parse(row.data_json);}
  finally {db.close();}
}
async function launch() {
  verify();
  app = await electron.launch({args: [bootstrap, '--user-data-dir=' + profile, '--force-device-scale-factor=1'], env, cwd: output, timeout: 30000});
  page = await app.firstWindow(); page.setDefaultTimeout(12000);
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.getByTestId('workbench-home').waitFor();
  report.launches.push(await assertIsolatedPiMain(app, path.join(pins.buildRoot, 'main/index.js'), profile));
  cdp = await page.context().newCDPSession(page);
  cdp.on('CSS.styleSheetAdded', ({header}) => sheets.set(header.styleSheetId, header));
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  await productEntry(page, 'teaching').click();
  await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-paper').click();
}
async function close() {
  const guard = await app.evaluate(continuationGuardRead, true);
  for (const name of ['networkAttempts', 'modelAttempts', 'rendererErrors']) assert.equal(guard[name], 0);
  report.guard = guard; await app.close(); app = undefined;
}
async function idle() {
  await page.getByTestId('paper-basket-ui-pending').waitFor({state: 'hidden'});
  await page.getByTestId('paper-basket-stage-organize').and(page.locator(':enabled')).waitFor();
}
async function stage(id) {
  await idle();
  await page.getByTestId('paper-basket-stage-' + id).click();
  await idle();
}
const contentBox = () => page.getByTestId('paper-candidate-browser').boundingBox();
try {
  await launch(); await stage('select');
  await page.getByTestId('paper-basket-search').fill(''); await idle();
  const original = basket().entries;
  assert.equal(original.length, 3);
  await app.evaluate(({ipcMain}) => {
    const channel = 'education:paper-basket-v2-mutate', original = ipcMain._invokeHandlers.get(channel);
    if (typeof original !== 'function') throw Error('Missing original host');
    globalThis.__previewSaveFault = {lost: false, requests: [], failNext: false};
    ipcMain.removeHandler(channel);
    ipcMain.handle(channel, async (...args) => {
      const input = args[1], fault = globalThis.__previewSaveFault;
      if (input.operation.type === 'updateUiState') {
        await new Promise(resolve => setTimeout(resolve, 700));
        if (fault.failNext) {fault.failNext = false; throw Error('QA_SAVE_BEFORE_HOST_FAILURE');}
        const result = await original(...args);
        fault.requests.push({requestId: input.requestId, operation: input.operation, ok: result.ok});
        if (!fault.lost) {fault.lost = true; throw Error('QA_COMMITTED_UI_REPLY_LOST_ONCE');}
        return result;
      }
      return original(...args);
    });
  });
  for (const width of [1366, 1920, 800]) {
    await app.evaluate(({BrowserWindow}, width) => BrowserWindow.getAllWindows()[0].setContentSize(width, 768), width);
    const before = await contentBox();
    await page.getByTestId('paper-basket-search').fill('题篮对齐');
    await page.getByTestId('paper-basket-ui-pending').waitFor();
    const pending = await contentBox();
    report.states.push({width, state: 'save-pending', before, pending});
    await page.screenshot({path: path.join(output, width + '-save-pending.png')});
    if (mode !== 'before') assert.deepEqual(pending, before);
    if (mode !== 'before') {
      await page.locator('[data-testid="paper-workspace-save-status"][data-saving="true"]').waitFor();
      assert.deepEqual(await contentBox(), before);
    }
    if (width === 1366) {
      const retry = page.getByTestId('paper-basket-error').getByRole('button', {name: '重试同一请求', exact: true});
      await retry.waitFor(); await retry.click();
      await idle();
      const requests = await app.evaluate(() => globalThis.__previewSaveFault.requests);
      assert.equal(requests.length, 2); assert.deepEqual(requests[0], requests[1]);
      report.recovery = requests;
    } else await idle();
    await page.getByTestId('paper-basket-search').fill(''); await idle();
    await stage('organize'); await page.getByTestId('paper-basket-stage-preview').click();
    await page.getByTestId('paper-basket-preview-page').waitFor(); await idle();
    assert.equal(await page.getByTestId('paper-basket-preview-entry').count(), 3);
    if (mode !== 'before') {
      assert.equal(await page.getByTestId('paper-basket-panel').count(), 0);
      const sheet = page.getByTestId('paper-preview-document'); await sheet.waitFor();
      const geometry = await sheet.boundingBox();
      const available = await sheet.evaluate(el => {
        const parent = el.parentElement, style = getComputedStyle(parent);
        return {clientWidth: parent.clientWidth, paddingLeft: style.paddingLeft, paddingRight: style.paddingRight,
          contentWidth: parent.clientWidth - parseFloat(style.paddingLeft) - parseFloat(style.paddingRight)};
      });
      const expectedWidth = Math.min(available.contentWidth - (width <= 850 ? 24 : 48), 960);
      assert(Math.abs(geometry.width - expectedWidth) <= 1, JSON.stringify({geometry, available, expectedWidth}));
      assert.equal(await page.getByTestId('paper-basket-preview-section').count(), 1);
      assert.equal(await page.getByTestId('paper-basket-preview-entry').getByTestId('paper-basket-answer').count(), 0);
      assert.equal(await page.locator('details > summary').count(), 0);
      assert(await page.getByTestId('paper-basket-snapshot').isDisabled());
    }
    await page.screenshot({path: path.join(output, width + '-student-preview.png')});
    await page.getByTestId('paper-basket-teacher').click();
    assert.equal(await page.getByTestId('paper-basket-preview-entry').getByTestId('paper-basket-answer').count(), 3);
    await page.screenshot({path: path.join(output, width + '-teacher-preview.png')});
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    assert.equal(overflow, false);
    await page.getByTestId('paper-basket-preview-back').click();
    await page.getByTestId('paper-basket-continue-select').click(); await idle();
    assert.deepEqual(basket().entries, original);
    if (mode !== 'before') {
      const button = page.getByTestId('paper-basket-save-status-menu');
      for (const state of ['normal', 'hover', 'focus', 'pressed']) {
        await page.mouse.move(1, 1); await button.evaluate(el => el.blur());
        if (state === 'hover') await button.hover();
        if (state === 'focus') {await button.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');}
        if (state === 'pressed') {await button.hover(); await page.mouse.down();}
        const computed = await button.evaluate(el => {
          const s = getComputedStyle(el);
          return Object.fromEntries(['backgroundColor', 'color', 'padding', 'borderRadius', 'fontFamily', 'fontSize', 'outlineStyle', 'outlineWidth', 'opacity'].map(key => [key, s[key]]));
        });
        const {root} = await cdp.send('DOM.getDocument');
        const {nodeId} = await cdp.send('DOM.querySelector', {nodeId: root.nodeId, selector: '[data-testid="paper-basket-save-status-menu"]'});
        const matched = await cdp.send('CSS.getMatchedStylesForNode', {nodeId});
        const rules = matched.matchedCSSRules.map(({rule}) => ({selector: rule.selectorList.text, origin: rule.origin,
          source: sheets.get(rule.styleSheetId)?.sourceURL, range: rule.style.range, layers: rule.layers,
          properties: rule.style.cssProperties.filter(p => /background|color|padding|border-radius|font|outline|opacity/.test(p.name))}));
        report.states.push({width, state, computed, rules});
        await page.screenshot({path: path.join(output, width + '-save-' + state + '.png')});
        if (state === 'pressed') {await page.mouse.move(1, 1); await page.mouse.up();}
      }
    }
  }
  check('Three sizes record pending-save geometry, real student/teacher preview and unchanged three-member round trips');
  check('A committed UI save with a lost reply recovers the exact same request and persisted UI');
  if (mode !== 'before') {
    await page.emulateMedia({reducedMotion: 'reduce'});
    await page.getByTestId('paper-basket-save-status-menu').focus();
    await page.keyboard.press('Enter');
    const dialog = page.getByRole('dialog', {name: '浏览偏好保存'}); await dialog.waitFor();
    await page.keyboard.press('Escape'); await dialog.waitFor({state: 'hidden'});
    assert(await page.getByTestId('paper-basket-save-status-menu').evaluate(el => document.activeElement === el));
    check('Official save-status popover closes with Escape and returns keyboard focus');
    await app.evaluate(() => {globalThis.__previewSaveFault.failNext = true;});
    await page.getByTestId('paper-basket-search').fill('临时未保存搜索');
    await page.getByTestId('paper-basket-error').waitFor();
    await page.getByTestId('paper-basket-save-status-menu').click();
    await page.getByTestId('paper-basket-discard-ui').click();
    await page.getByTestId('paper-basket-ui-local').waitFor();
    assert.deepEqual(basket().entries, original);
    await page.getByTestId('paper-basket-save-status-menu').click();
    await page.getByTestId('paper-basket-restore-ui').click(); await idle();
    check('Explicitly discarding failed browsing preferences preserves original members and supports restoring persistence');
    await stage('organize'); await page.getByTestId('paper-basket-stage-preview').click(); await idle();
    await page.getByTestId('paper-basket-confirm-all').and(page.locator(':enabled')).waitFor();
    await page.getByTestId('paper-basket-confirm-all').click();
    await page.getByTestId('paper-export-entry').waitFor();
    await page.getByTestId('paper-preview-snapshot-card').waitFor();
    const back = await page.getByTestId('paper-basket-preview-back').boundingBox();
    const main = await page.getByTestId('paper-basket-preview-page').locator('xpath=ancestor::main[1]').boundingBox();
    assert(back.y >= main.y && back.y + back.height <= main.y + main.height);
    assert.deepEqual(basket().entries.map(e => e.entryId), original.map(e => e.entryId));
    await page.screenshot({path: path.join(output, 'confirmed-preview.png')});
    check('Original whole-paper confirmation produces a real snapshot and original export entry');
    await close(); await launch(); await idle();
    assert.equal(await page.getByTestId('paper-basket-preview-entry').count(), 3);
    assert.deepEqual(basket().entries.map(e => e.entryId), original.map(e => e.entryId));
    check('Cold restart restores the same real basket and preview stage');
  }
  verify(); assert.deepEqual(report.errors, []); await close(); report.success = true;
} catch (error) {
  report.error = String(error.stack || error);
  if (page && !page.isClosed()) await page.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});
  process.exitCode = 1;
} finally {
  if (app) await close().catch(error => {report.closeError = String(error); process.exitCode = 1;});
  save(); console.log(JSON.stringify({success: report.success, output, checks: report.checks.length, states: report.states.length, error: report.error}));
}
