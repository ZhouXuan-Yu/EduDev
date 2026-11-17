import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {_electron as electron} from 'playwright';
import {fingerprint, sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {continuationBootstrap, continuationGuardRead} from './acceptance/paper-adaptation-continuation.mjs';
import {productEntry} from './product-navigation.mjs';

const desktop = path.resolve(import.meta.dirname, '..');
assert.equal(process.argv.length, 4);
const owned = fs.realpathSync(path.join(desktop, 'test-results'));
const pinFile = fs.realpathSync(path.resolve(desktop, process.argv[2]));
assert(pinFile.startsWith(owned + path.sep));
const pins = JSON.parse(fs.readFileSync(pinFile));
assert(fs.realpathSync(pins.buildRoot).startsWith(owned + path.sep));
const mode = process.argv[3];
assert(['before', 'after', 'integrated'].includes(mode));
const output = fs.mkdtempSync(path.join(owned, 'paper-basket-panel-' + mode + '-'));
const data = path.join(output, 'data'), profile = path.join(output, 'profile');
fs.mkdirSync(data); fs.mkdirSync(profile);
const bootstrap = path.join(output, 'bootstrap.cjs');
fs.writeFileSync(bootstrap, continuationBootstrap({main: path.join(pins.buildRoot, 'main/index.js'), profile}));
const report = {success: false, output, mode, pins, scriptSha256: sha256(fs.readFileSync(import.meta.filename)),
  checks: [], states: [], errors: [], launches: [],
  scope: 'Formal Electron, manual teacher fixtures, original typed host/SQLite and source-version/unknown-reply gates. Before mode records baseline only. No model requests or simulated successful writes.'};
const save = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
const check = name => {report.checks.push(name); save();};
const verify = () => {
  assert.equal(fingerprint(path.join(desktop, 'src')).sha256, pins.source);
  assert.equal(fingerprint(pins.buildRoot).sha256, pins.build);
};
const env = {...process.env};
for (const key of Object.keys(env)) if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) || key.startsWith('OMNI_EDU_') ||
  ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(key)) delete env[key];
Object.assign(env, {OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
  OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_VISIBLE: '1', NODE_ENV: 'development'});
let app, page;
const started = Date.now();
const deadline = setTimeout(() => {
  report.budgetExceeded = true; save();
  if (app) spawn('taskkill.exe', ['/PID', String(app.process().pid), '/T', '/F'], {windowsHide: true, stdio: 'ignore'});
}, 180000);
const read = sql => {
  const db = new DatabaseSync(path.join(data, 'app.db'), {readOnly: true});
  try {return db.prepare(sql).all().map(row => ({...row}));} finally {db.close();}
};
const basket = () => {
  const rows = read('SELECT id, session_id, data_json FROM paper_baskets');
  assert.equal(rows.length, 1);
  return {...JSON.parse(rows[0].data_json), id: rows[0].id, sessionId: rows[0].session_id};
};
const panel = () => page.getByTestId('paper-basket-panel');
async function createQuestion(number, type = '解答题') {
  await page.getByTestId('question-notebook-new').click();
  for (const [key, value] of Object.entries({subject: '物理', grade: '初三', 'knowledge-point': '电学', type,
    stem: `题篮对齐 ${number}：电压10伏，电流2安，计算电阻。`, answer: '5欧', analysis: '欧姆定律计算。合成教师验收文字。'})) {
    await page.getByTestId('question-notebook-new-' + key).fill(value);
  }
  await page.getByTestId('question-notebook-create-question').click();
  await page.getByTestId('question-notebook-stem').filter({hasText: `题篮对齐 ${number}：`}).waitFor();
}
async function launch() {
  assert(report.launches.length < 2);
  verify();
  app = await electron.launch({args: [bootstrap, '--user-data-dir=' + profile, '--force-device-scale-factor=1'], env, cwd: output, timeout: 30000});
  page = await app.firstWindow(); page.setDefaultTimeout(12000);
  page.on('pageerror', error => report.errors.push(String(error)));
  await page.getByTestId('workbench-home').waitFor();
  report.launches.push(await assertIsolatedPiMain(app, path.join(pins.buildRoot, 'main/index.js'), profile));
}
async function paper() {
  await productEntry(page, 'teaching').click();
  await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-paper').click();
  await page.getByTestId('paper-basket-stage-select').and(page.locator(':enabled')).waitFor();
}
async function idle() {
  await page.getByTestId('paper-basket-ui-pending').waitFor({state: 'hidden'});
  await panel().getByTestId('paper-basket-organize').and(page.locator(':enabled')).waitFor();
}
async function count(expected) {
  await page.waitForFunction(value => document.querySelector('[data-testid="paper-basket-count"]')?.textContent.trim() === String(value), expected);
  assert.equal(basket().entries.length, expected);
}
async function close() {
  const guard = await app.evaluate(continuationGuardRead, true);
  for (const name of ['networkAttempts', 'modelAttempts', 'rendererErrors']) assert.equal(guard[name], 0);
  await app.close(); app = undefined;
}
try {
  await launch();
  await productEntry(page, 'teaching').click();
  await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-question_notebook').click();
  for (let number = 1; number <= 3; number++) await createQuestion(number);
  const questions = read('SELECT * FROM question_bank_items ORDER BY id');
  assert.equal(questions.length, 3); report.questionFixtureSha256 = sha256(JSON.stringify(questions));
  await paper(); await page.getByTestId('paper-library-query').fill('题篮对齐');
  const first = page.getByTestId('paper-library-add').first();
  await first.and(page.locator(':enabled')).waitFor(); await first.click();
  await panel().waitFor(); await idle();
  for (const question of questions) {
    const add = page.locator(`[data-testid="paper-basket-candidate"][data-question-id="${question.id}"]`).getByTestId('paper-basket-add');
    await add.waitFor();
    if (await add.isEnabled()) await add.click();
    await idle();
  }
  assert.equal(basket().entries.length, 3);
  check('Three teacher-created questions enter one real practice through visible selection');
  const cdp = await page.context().newCDPSession(page), sheets = new Map();
  cdp.on('CSS.styleSheetAdded', ({header}) => sheets.set(header.styleSheetId, header));
  await cdp.send('DOM.enable'); await cdp.send('CSS.enable');
  const {root} = await cdp.send('DOM.getDocument');
  const {nodeId} = await cdp.send('DOM.querySelector', {nodeId: root.nodeId, selector: '[data-testid="paper-basket-organize"]'});
  for (const [width, height] of [[1366, 768], [1920, 1080], [800, 768]]) {
    await app.evaluate(({BrowserWindow}, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size), [width, height]);
    await page.waitForFunction(size => innerWidth === size[0] && innerHeight === size[1], [width, height]);
    const target = panel().getByTestId('paper-basket-organize');
    for (const state of ['normal', 'hover', 'focus', 'pressed']) {
      if (state === 'normal') {await page.getByTestId('paper-studio-title').focus(); await page.mouse.move(1, 1);}
      if (state === 'hover') await target.hover();
      if (state === 'focus') {await target.focus(); await page.keyboard.press('ArrowRight');}
      if (state === 'pressed') {await target.hover(); await page.mouse.down();}
      await target.evaluate(async element => {await Promise.all(element.getAnimations().map(animation => animation.finished.catch(() => {})));});
      const metrics = await target.evaluate(element => {
        const rectangle = node => {const r = node.getBoundingClientRect(); return {x: r.x, y: r.y, width: r.width, height: r.height};};
        const root = element.closest('[data-testid="paper-basket-panel"]'), footer = element.closest('footer'), css = getComputedStyle(element);
        return {button: rectangle(element), panel: rectangle(root), footer: rectangle(footer), footerButtons: footer.querySelectorAll('button').length,
          className: element.className, focusVisible: element.matches(':focus-visible'), active: element.matches(':active'),
          documentOverflow: document.documentElement.scrollWidth > innerWidth,
          properties: Object.fromEntries(['background-color', 'color', 'border-radius', 'padding', 'outline', 'box-shadow', 'font-size'].map(key => [key, css.getPropertyValue(key)]))};
      });
      const matched = await cdp.send('CSS.getMatchedStylesForNode', {nodeId});
      const rules = (matched.matchedCSSRules || []).map(({rule}) => ({selector: rule.selectorList.text,
        file: sheets.get(rule.styleSheetId)?.sourceURL, layers: rule.layers, declarations: rule.style.cssText}));
      report.states.push({width, height, state, metrics, rules});
      if (mode !== 'before') {
        assert.equal(metrics.footerButtons, 1);
        assert(!metrics.documentOverflow);
        assert(metrics.button.y >= 0 && metrics.button.y + metrics.button.height <= height + 1);
        assert.equal(await target.textContent(), '整理与预览（3）');
      }
      await page.screenshot({path: path.join(output, `${width}-${state}.png`)});
      if (state === 'pressed') {await page.mouse.move(1, 1); await page.mouse.up();}
    }
  }
  check(mode === 'before' ? 'Baseline sidebar CSSOM and twelve screenshots recorded' : 'Three sizes preserve one primary action and official interaction states');
  if (mode !== 'before') {
    await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].setContentSize(1366, 768));
    await count(3);
    assert.equal(await panel().getByTestId('paper-basket-selected-remove').count(), 3);
    assert.equal(await panel().getByTestId('paper-basket-breakdown').textContent(), '解答题3');
    const original = basket(), removed = original.entries[0];
    await app.evaluate(({ipcMain}) => {
      const channel = 'education:paper-basket-v2-mutate', original = ipcMain._invokeHandlers.get(channel);
      if (typeof original !== 'function') throw Error('Original handler unavailable');
      const fault = {requests: [], once: true}; globalThis.__basketPanelFault = fault;
      ipcMain.removeHandler(channel);
      ipcMain.handle(channel, async (...args) => {
        const result = await original(...args), input = args[1];
        if (input.operation.type === 'remove') {
          fault.requests.push({requestId: input.requestId, operation: input.operation, ok: result.ok});
          if (result.ok && fault.once) {fault.once = false; throw Error('QA_ORIGINAL_REMOVE_REPLY_LOST_ONCE');}
        }
        return result;
      });
    });
    await panel().getByTestId('paper-basket-selected-remove').first().click();
    const retry = page.getByTestId('paper-basket-error').getByRole('button', {name: '重试同一请求', exact: true});
    await retry.waitFor(); assert.equal(basket().entries.length, 2);
    for (const button of await panel().getByTestId('paper-basket-selected-remove').all()) assert(await button.isDisabled());
    assert(await panel().getByTestId('paper-basket-organize').isDisabled());
    await retry.click(); await count(2); await idle();
    assert.equal(new Set(original.entries.map(entry => entry.sectionId)).size, 1);
    const retained = original.entries.filter(entry => entry.entryId !== removed.entryId);
    assert.deepEqual(basket().entries, retained.map((entry, position) => ({...entry, position})));
    const requests = await app.evaluate(() => globalThis.__basketPanelFault.requests);
    assert.equal(requests.length, 2); assert(requests.every(row => row.ok)); assert.deepEqual(requests[0], requests[1]);
    report.removeRecovery = requests;
    check('Lost committed remove reply disables actions and recovers the same request without changing retained members');
    assert.equal(await panel().getByTestId('paper-basket-breakdown').textContent(), '解答题2');
    const readd = page.locator(`[data-testid="paper-basket-candidate"][data-question-id="${removed.questionId}"]`).getByTestId('paper-basket-add');
    await readd.and(page.locator(':enabled')).waitFor(); await readd.click(); await count(3); await idle();
    assert(await readd.isDisabled());
    check('Counts and type distribution follow original members, and removing permits exactly one later re-add');
    await page.getByTestId('paper-basket-configuration-toggle').click();
    await page.getByTestId('paper-basket-blueprint-fold').getByRole('button', {name: '蓝图与来源策略', exact: true}).click();
    const blueprint = page.getByTestId('paper-basket-blueprint-fold');
    const title = blueprint.getByTestId('paper-basket-title'); await title.fill('尚未保存的教师标题');
    for (const button of await panel().getByTestId('paper-basket-selected-remove').all()) assert(await button.isDisabled());
    assert(await panel().getByTestId('paper-basket-organize').isDisabled());
    assert.notEqual(basket().title, '尚未保存的教师标题');
    await blueprint.getByTestId('paper-basket-discard-blueprint').click(); await idle();
    await page.getByTestId('paper-basket-configuration-toggle').click();
    check('Unsaved local blueprint disables sidebar writes and stage changes without discarding teacher input');
    await panel().getByTestId('paper-basket-organize').click(); await page.getByTestId('paper-basket-organizer').waitFor();
    await page.getByTestId('paper-basket-stage-preview').click(); await page.getByTestId('paper-basket-preview-page').waitFor();
    assert.equal(await page.getByTestId('paper-basket-preview-entry').count(), 3);
    await page.getByTestId('paper-basket-preview-back').click();
    await page.getByTestId('paper-basket-continue-select').click(); await idle();
    check('Single selection action enters the original editor and preview, then returns to the same three members');
    await close(); await launch(); await paper(); await idle(); await count(3);
    check('Cold restart restores the exact selected basket and sidebar count without model replay');
    while (basket().entries.length) {
      const expected = basket().entries.length - 1;
      const remove = panel().getByTestId('paper-basket-selected-remove').first();
      await remove.focus(); await page.keyboard.press('Enter'); await count(expected);
      if (expected) await idle();
      await page.waitForFunction(() => {
        const root = document.querySelector('[data-testid="paper-basket-panel"]');
        return document.activeElement !== document.body && root?.contains(document.activeElement);
      });
    }
    assert.equal(await panel().getByTestId('paper-basket-selected-remove').count(), 0);
    assert(await panel().getByTestId('paper-basket-organize').isDisabled());
    assert.equal(await panel().getByTestId('paper-basket-breakdown').count(), 0);
    await page.screenshot({path: path.join(output, 'empty-after-keyboard-remove.png')});
    check('Keyboard remove reaches a real empty basket with zero counts and a disabled primary action');
    assert.equal(sha256(JSON.stringify(read('SELECT * FROM question_bank_items ORDER BY id'))), report.questionFixtureSha256);
    check('Original question facts and source content are byte-identical after every sidebar mutation');
    await productEntry(page, 'teaching').click();
    await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-question_notebook').click();
    for (let number = 4; number <= 12; number++) await createQuestion(number, number === 4 ? '填空题' : '解答题');
    const expandedQuestions = read('SELECT * FROM question_bank_items ORDER BY id');
    assert.equal(expandedQuestions.length, 12);
    const originalIds = new Set(questions.map(question => question.id));
    assert.deepEqual(expandedQuestions.filter(question => originalIds.has(question.id)), questions);
    await paper();
    for (const question of expandedQuestions) {
      const add = page.locator(`[data-testid="paper-basket-candidate"][data-question-id="${question.id}"]`).getByTestId('paper-basket-add');
      await add.and(page.locator(':enabled')).waitFor(); await add.click(); await idle();
    }
    await count(12); report.longList = [];
    const breakdown = panel().getByTestId('paper-basket-breakdown');
    assert.equal(await breakdown.locator('div').filter({hasText: '填空题'}).textContent(), '填空题1');
    assert.equal(await breakdown.locator('div').filter({hasText: '解答题'}).textContent(), '解答题11');
    for (const [width, height] of [[1366, 768], [1920, 1080], [800, 768]]) {
      await app.evaluate(({BrowserWindow}, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size), [width, height]);
      await page.waitForFunction(size => innerWidth === size[0] && innerHeight === size[1], [width, height]);
      const last = panel().getByTestId('paper-basket-selected-remove').last();
      await last.scrollIntoViewIfNeeded(); await last.focus();
      const metrics = await last.evaluate(element => {
        const bounds = node => {const r = node.getBoundingClientRect(); return {top: r.top, bottom: r.bottom, left: r.left, right: r.right};};
        let scroll = element.parentElement;
        while (scroll && !(scroll.scrollHeight > scroll.clientHeight && /auto|scroll/.test(getComputedStyle(scroll).overflowY))) scroll = scroll.parentElement;
        return {button: bounds(element), scroll: scroll ? {...bounds(scroll), topOffset: scroll.scrollTop} : null,
          horizontalOverflow: document.documentElement.scrollWidth > innerWidth};
      });
      assert(metrics.scroll && metrics.scroll.topOffset > 0);
      assert(metrics.button.top >= metrics.scroll.top - 1 && metrics.button.bottom <= metrics.scroll.bottom + 1);
      assert(!metrics.horizontalOverflow);
      assert.equal(await panel().getByTestId('paper-basket-selected-entry').count(), 12);
      report.longList.push({width, height, metrics});
      await page.screenshot({path: path.join(output, `long-list-${width}.png`)});
    }
    await page.keyboard.press('Enter'); await count(11); await idle();
    check('Twelve real selected rows scroll independently in three sizes and the last row remains keyboard removable');
    await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].setContentSize(1366, 768));
    const archived = basket();
    await page.getByTestId('paper-basket-new').click();
    await page.getByTestId('paper-basket-archive-new').click();
    await page.waitForFunction(id => {
      const current = document.querySelector('[data-testid="paper-basket-workspace"]')?.getAttribute('data-basket-id');
      return current && current !== id;
    }, archived.id);
    await page.getByTestId('paper-basket-stage-saved').click();
    const saved = page.locator(`[data-testid="paper-library-saved"][data-basket-id="${archived.id}"]`);
    await saved.getByRole('button', {name: '查看归档', exact: true}).click();
    await page.waitForFunction(id => document.querySelector('[data-testid="paper-basket-workspace"]')?.getAttribute('data-basket-id') === id, archived.id);
    await page.getByTestId('paper-basket-preview-page').waitFor();
    assert.equal(await page.getByTestId('paper-basket-preview-entry').count(), 11);
    assert.equal(await panel().count(), 0);
    assert.equal(await page.getByTestId('paper-basket-selected-remove').and(page.locator(':enabled')).count(), 0);
    assert(await page.getByTestId('paper-basket-snapshot').isDisabled());
    assert(await page.getByTestId('paper-basket-stage-organize').isDisabled());
    const archivedRow = read('SELECT id, revision, state, data_json FROM paper_baskets').find(row => row.id === archived.id);
    assert.equal(archivedRow.state, 'archived');
    const persisted = JSON.parse(archivedRow.data_json);
    report.archivedGuard = await page.evaluate(async value => window.omniEdu.mutatePaperBasketV2({
      schemaVersion: 'xiaozhi.paper-basket.v2', sessionId: value.sessionId, basketId: value.id,
      expectedRevision: value.revision, requestId: crypto.randomUUID(), operation: {type: 'remove', entryId: value.entries[0].entryId},
    }), {...persisted, id: archived.id, sessionId: archived.sessionId, revision: archivedRow.revision});
    assert.equal(report.archivedGuard.ok, false);
    assert.equal(report.archivedGuard.error, 'conflict');
    assert.equal(read('SELECT id, data_json FROM paper_baskets').find(row => row.id === archived.id).data_json, archivedRow.data_json);
    await page.screenshot({path: path.join(output, 'archived-readonly.png')});
    check('Original archive and reopen UI keeps all eleven rows read-only, and the real host rejects a typed remove attempt');
  }
  assert.deepEqual(report.errors, []); verify(); await close(); report.success = true;
} catch (error) {
  report.failure = {message: error.message, stack: String(error.stack)}; process.exitCode = 1;
  if (page && !page.isClosed()) report.focusAtFailure = await page.evaluate(() => ({
    tag: document.activeElement?.tagName,
    testId: document.activeElement?.getAttribute('data-testid'),
    label: document.activeElement?.getAttribute('aria-label'),
    withinPanel: !!document.activeElement?.closest('[data-testid="paper-basket-panel"]'),
  })).catch(() => undefined);
  if (page && !page.isClosed()) await page.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});
} finally {
  clearTimeout(deadline);
  try {await app?.close();} catch (error) {report.closeFailure = String(error); process.exitCode = 1; report.success = false;}
  report.elapsedMs = Date.now() - started; save();
  console.log(JSON.stringify({success: report.success, output, checks: report.checks.length, states: report.states.length, failure: report.failure}));
}
