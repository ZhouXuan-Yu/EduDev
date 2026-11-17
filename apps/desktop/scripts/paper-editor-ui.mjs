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
const output = fs.mkdtempSync(path.join(owned, 'paper-editor-' + mode + '-'));
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
  report.guard = guard;
  // Exercise the user window-close lifecycle, not Playwright's process shutdown.
  const closed = app.waitForEvent('close', {timeout: 12000});
  await app.evaluate(({BrowserWindow}) => {setImmediate(() => BrowserWindow.getAllWindows()[0].close());});
  await closed;
  report.normalWindowCloses = (report.normalWindowCloses || 0) + 1;
  app = undefined;
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
const row = id => page.locator(`[data-testid="paper-basket-entry"][data-entry-id="${id}"]`);
const dialog = () => page.getByTestId('paper-instance-dialog');
try {
  await launch(); await stage('organize');
  const original = basket().entries;
  assert.equal(original.length, 3);
  for (const width of [1366, 1920, 800]) {
    const height = width === 1920 ? 1080 : 768;
    await app.evaluate(({BrowserWindow}, size) => BrowserWindow.getAllWindows()[0].setContentSize(size.width, size.height), {width, height});
    if (mode !== 'before') {
      assert.equal(await page.getByTestId('paper-basket-panel').count(), 0);
      assert.equal(await page.getByTestId('paper-editor-count').textContent(), '3');
      const sidebar = await page.getByTestId('paper-editor-settings').boundingBox();
      assert(sidebar.width >= 209 && sidebar.width <= 271);
      const toolbar = await page.getByTestId('paper-editor-toolbar').boundingBox();
      const main = await page.getByTestId('paper-basket-organizer').locator('xpath=ancestor::main[1]').boundingBox();
      assert(toolbar.y + toolbar.height <= main.y + 1);
      const viewport = await page.evaluate(() => ({width: innerWidth, height: innerHeight, dpr: devicePixelRatio}));
      assert.equal(viewport.width, width); assert.equal(viewport.height, height);
      report.states.push({width, height, viewport, sidebar, toolbar, main});
      const documentArea = page.getByTestId('paper-basket-organizer').locator('xpath=ancestor::main[1]');
      await documentArea.evaluate(el => {el.scrollTop = el.scrollHeight;});
      assert.deepEqual(await page.getByTestId('paper-editor-toolbar').boundingBox(), toolbar, 'Document scroll keeps the toolbar anchored');
      await documentArea.evaluate(el => {el.scrollTop = 0;});
      const button = page.getByTestId('paper-basket-stage-preview');
      for (const state of ['normal', 'hover', 'focus', 'pressed']) {
        await page.mouse.move(1, 1); await button.evaluate(el => el.blur());
        if (state === 'hover') await button.hover();
        if (state === 'focus') {await button.focus(); await page.keyboard.press('Tab'); await page.keyboard.press('Shift+Tab');}
        if (state === 'pressed') {await button.hover(); await page.mouse.down();}
        const computed = await button.evaluate(el => {
          const style = getComputedStyle(el);
          return Object.fromEntries(['backgroundColor', 'color', 'padding', 'borderRadius', 'fontFamily', 'fontSize', 'outlineStyle', 'outlineWidth', 'boxShadow', 'opacity'].map(key => [key, style[key]]));
        });
        const {root} = await cdp.send('DOM.getDocument');
        const {nodeId} = await cdp.send('DOM.querySelector', {nodeId: root.nodeId, selector: '[data-testid="paper-basket-stage-preview"]'});
        const matched = await cdp.send('CSS.getMatchedStylesForNode', {nodeId});
        const rules = matched.matchedCSSRules.map(({rule}) => ({selector: rule.selectorList.text, origin: rule.origin,
          source: sheets.get(rule.styleSheetId)?.sourceURL, range: rule.style.range, layers: rule.layers,
          properties: rule.style.cssProperties.filter(property => /background|color|padding|border-radius|font|outline|shadow|ring|opacity/.test(property.name))}));
        const focus = await button.evaluate(el => ({active: document.activeElement === el,
          visible: el.matches(':focus-visible') || el.getAttribute('data-focus-visible') === 'true'}));
        if (state === 'focus') assert(focus.active && focus.visible, 'Real keyboard focus is visible');
        report.states.push({width, height, state, computed, rules, focus});
        await page.screenshot({path: path.join(output, width + '-editor-' + state + '.png')});
        if (state === 'pressed') {await page.mouse.move(1, 1); await page.mouse.up();}
      }
    }
    await page.screenshot({path: path.join(output, width + '-editor.png')});
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
  }
  check('Three-size real editor baseline and full question layout recorded');
  if (mode !== 'before') {
    await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].setContentSize(1366, 768));
    await page.getByTestId('paper-editor-title').fill('真实编辑页验收标题');
    assert(await page.getByTestId('paper-basket-stage-preview').isDisabled());
    assert(await page.getByTestId('paper-basket-purpose').isDisabled());
    assert.notEqual(basket().blueprint.title, '真实编辑页验收标题');
    await app.evaluate(({ipcMain}) => {
      const channel = 'education:paper-basket-v2-mutate', original = ipcMain._invokeHandlers.get(channel);
      if (typeof original !== 'function') throw Error('Missing original handler');
      const fault = {titleLost: false, editLost: false, requests: []}; globalThis.__editorFault = fault;
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, async (...args) => {
        const input = args[1], result = await original(...args);
        if (['updateBlueprint', 'editEntry'].includes(input.operation.type)) {
          fault.requests.push({requestId: input.requestId, operation: input.operation, ok: result.ok});
          const key = input.operation.type === 'updateBlueprint' ? 'titleLost' : 'editLost';
          if (result.ok && !fault[key]) {fault[key] = true; throw Error('QA_ORIGINAL_COMMITTED_REPLY_LOST');}
        }
        return result;
      });
    });
    await page.getByTestId('paper-editor-save').click();
    const retry = page.getByTestId('paper-basket-error').getByRole('button', {name: '重试同一请求', exact: true});
    await retry.waitFor(); assert.equal(basket().blueprint.title, '真实编辑页验收标题');
    await retry.click(); await idle();
    let requests = await app.evaluate(() => globalThis.__editorFault.requests);
    assert.equal(requests.length, 2); assert.deepEqual(requests[0], requests[1]);
    assert.deepEqual(basket().entries, original);
    check('Header title saves through the original blueprint request and recovers one lost committed reply exactly');
    await page.getByTestId('paper-editor-title').fill('应放弃的标题');
    await page.getByTestId('paper-editor-discard').click(); await idle();
    assert.equal(await page.getByTestId('paper-editor-title').inputValue(), '真实编辑页验收标题');
    check('Explicit title discard restores saved input without touching selected members');
    await page.getByTestId('paper-editor-scores').getByRole('button', {name: /分值/}).click();
    const score = page.locator(`[data-testid="paper-editor-score"][data-entry-id="${original[0].entryId}"]`);
    await score.getByTestId('paper-entry-points').fill('2');
    assert(await page.getByTestId('paper-basket-stage-preview').isDisabled());
    await score.getByTestId('paper-entry-points-save').click(); await idle();
    const afterPoints = basket();
    const savedPoints = afterPoints.c2?.entryPoints[original[0].entryId] ?? afterPoints.blueprint.sections.find(s => s.id === afterPoints.entries.find(e => e.entryId === original[0].entryId).sectionId).points;
    assert.equal(savedPoints, 2);
    assert.deepEqual(afterPoints.entries.map(e => [e.entryId, e.questionId, e.contentVersion]), original.map(e => [e.entryId, e.questionId, e.contentVersion]));
    check('Sidebar score editing keeps exact source and member identities and uses original dirty/write guards');
    const entryId = original[1].entryId;
    await row(entryId).getByTestId('paper-instance-open').click(); await dialog().waitFor();
    await page.screenshot({path: path.join(output, 'question-dialog.png')});
    await dialog().getByTestId('paper-instance-edit-question').click();
    const text = dialog().getByTestId('paper-instance-role-question').getByTestId('paper-instance-text').first();
    await text.fill('仅本卷修改：电压12伏，电流2安，计算电阻。');
    await page.keyboard.press('Escape'); assert(await dialog().isVisible());
    assert(await dialog().getByTestId('paper-instance-dialog-close').isDisabled());
    await close(); await launch();
    await page.getByTestId('paper-basket-organizer').waitFor();
    await row(entryId).getByTestId('paper-instance-open').and(page.locator(':enabled')).waitFor();
    await row(entryId).getByTestId('paper-instance-open').click();
    await dialog().waitFor();
    assert.equal(await dialog().getByTestId('paper-instance-role-question').getByTestId('paper-instance-text').first().inputValue(), '仅本卷修改：电压12伏，电流2安，计算电阻。');
    check('Dirty question dialog rejects dismissal and cold restart recovers the same teacher input');
    await app.evaluate(({ipcMain}) => {
      const channel = 'education:paper-basket-v2-mutate', original = ipcMain._invokeHandlers.get(channel);
      const fault = {once: true, requests: []}; globalThis.__editorEditRecovery = fault;
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, async (...args) => {
        const result = await original(...args), input = args[1];
        if (input.operation.type === 'editEntry') {
          fault.requests.push({requestId: input.requestId, operation: input.operation, ok: result.ok});
          if (result.ok && fault.once) {fault.once = false; throw Error('QA_ORIGINAL_EDIT_REPLY_LOST_ONCE');}
        }
        return result;
      });
    });
    await dialog().getByTestId('paper-instance-save').click();
    const editRetry = dialog().getByTestId('paper-instance-dialog-retry');
    await editRetry.waitFor(); assert(await editRetry.isEnabled());
    await editRetry.click();
    await dialog().getByTestId('paper-instance-confirm').and(page.locator(':enabled')).waitFor();
    requests = await app.evaluate(() => globalThis.__editorEditRecovery.requests);
    assert.equal(requests.length, 2); assert.deepEqual(requests[0], requests[1]);
    assert.equal(basket().entries.find(e => e.entryId === entryId).instance.content.question.blocks[0].text, '仅本卷修改：电压12伏，电流2安，计算电阻。');
    await dialog().getByTestId('paper-instance-confirm').click();
    await dialog().getByTestId('paper-instance-dialog-close').and(page.locator(':enabled')).waitFor();
    await dialog().getByTestId('paper-instance-dialog-close').click(); await dialog().waitFor({state: 'hidden'});
    assert(await row(entryId).getByTestId('paper-instance-open').evaluate(el => document.activeElement === el));
    check('Modal retry recovers the original edit request and exact revision review, then restores trigger focus');
    await page.getByTestId('paper-basket-purpose').click();
    await page.getByRole('option', {name: '正式试卷', exact: true}).click(); await idle();
    await page.getByTestId('paper-exam-requirements-missing').and(page.locator(':visible')).waitFor();
    await page.getByTestId('paper-editor-title').fill('尚未明确考试要求');
    assert(await page.getByTestId('paper-editor-save').isDisabled());
    await page.getByTestId('paper-editor-discard').click(); await idle();
    await page.getByTestId('paper-basket-purpose').click();
    await page.getByRole('option', {name: '练习单', exact: true}).click(); await idle();
    assert.equal(basket().purpose, 'practice');
    assert.equal(basket().entries.length, 3);
    check('Purpose round trip preserves selected questions and header save cannot clear missing examination requirements');
    await page.getByTestId('paper-basket-stage-preview').click(); await idle();
    assert.equal(await page.getByTestId('paper-basket-preview-entry').count(), 3);
    assert.equal(await page.getByTestId('paper-basket-preview-entry').getByTestId('paper-basket-answer').count(), 0);
    await page.getByTestId('paper-basket-preview-back').click(); await idle();
    await page.getByTestId('paper-basket-continue-select').click(); await idle();
    assert.equal(await page.getByTestId('paper-basket-count').textContent(), '3');
    check('Editor preview and selection share the same real basket and preserve student answer isolation');
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
