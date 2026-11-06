/** A21/A23. Actual TXT import, native extraction, teacher edits and saved paper filters. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint, sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {continuationBootstrap, continuationGuardRead, waitContinuationBootstrap,
  readContinuationBootstrapFile} from './acceptance/paper-adaptation-continuation.mjs';
import {choose, enterPaper, ledger, disclosureTrigger} from './acceptance/paper-basket-ui-driver.mjs';
import {readInstanceBasket} from './acceptance/paper-instance-ui-driver.mjs';
import {waitInstanceCondition} from './acceptance/paper-instance-ui-wait.mjs';
import {productEntry} from './product-navigation.mjs';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
assert(args.length === 2 && args.includes('--run-ui'), 'Use --run-ui --pins=<owned freeze JSON>');
const pinsFile = path.resolve(desktop, args.find(a => a.startsWith('--pins='))?.slice(7) || '');
const owned = fs.realpathSync(path.join(desktop, 'test-results'));
assert(fs.realpathSync(pinsFile).startsWith(owned + path.sep));
const pins = JSON.parse(fs.readFileSync(pinsFile));
assert(fs.realpathSync(pins.buildRoot).startsWith(owned + path.sep));
const main = path.join(pins.buildRoot, 'main/index.js');
const output = fs.mkdtempSync(path.join(owned, 'ui-final-paper-number-'));
const data = path.join(output, 'data'), profile = path.join(output, 'profile');
const input = path.join(output, 'teacher-numbered-questions.txt');
const text = '题号与筛选验收资料\n\n2. 计算 $2 + 5$ 的值，并选择正确答案。\nA. $5$\nB. $6$\nC. $7$\nD. $8$\n\n12. 计算 $12 + 5$ 的值，并选择正确答案。\nA. $15$\nB. $16$\nC. $17$\nD. $18$\n';
fs.writeFileSync(input, text);
const inputHash = sha256(fs.readFileSync(input));
const report = {success: false, output, pins, source: inputHash, checks: [], errors: [], launches: [], guards: [], screens: [],
  budget: {launches: 3, modelCalls: 0, retries: 0},
  runnerSha256: sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
  boundaries: ['Owned teacher-authored test TXT goes through actual import/parser; classifications and answers use visible teacher-edit UI.',
    'Native chooser return is limited to the one owned file. No SQL writes, OCR/provider mocks, artificial result cards or model sends.',
    'Simple text/formula/options and exact original numbering only; no natural pedagogical-quality claim.']};
let app, page, owner, basketId, resource, questions, modelBaseline;
const persist = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
const check = name => {report.checks.push({name, pass: true}); persist(); console.log('PASS ' + name);};
const verify = () => {
  assert.equal(fingerprint(path.join(desktop, 'src')).sha256, pins.source);
  assert.equal(fingerprint(pins.buildRoot).sha256, pins.build);
  assert.equal(sha256(fs.readFileSync(input)), inputHash);
};
const read = (sql, params = []) => {
  const db = new DatabaseSync(path.join(data, 'app.db'), {readOnly: true});
  try {return JSON.parse(JSON.stringify(db.prepare(sql).all(...params)));} finally {db.close();}
};
async function until(readValue, predicate, label) {
  const deadline = Date.now() + 30000;
  while (Date.now() < deadline) {
    const value = await readValue();
    if (predicate(value)) return value;
    await new Promise(resolve => setTimeout(resolve, 50));
  }
  throw Error('READINESS_DEADLINE ' + label);
}
async function launch() {
  verify(); assert(report.launches.length < report.budget.launches);
  const number = report.launches.length + 1;
  const bootstrap = path.join(output, `bootstrap-${number}.cjs`);
  const stateFile = path.join(output, `bootstrap-state-${number}.json`);
  fs.writeFileSync(bootstrap, continuationBootstrap({main, profile, diagnosticFile: stateFile}), {flag: 'wx'});
  const env = {...process.env};
  for (const key of Object.keys(env)) if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) || key.startsWith('OMNI_EDU_') ||
    ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(key)) delete env[key];
  Object.assign(env, {OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
    OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_DIALOG_MODE: '1'});
  app = await electron.launch({args: [bootstrap, '--user-data-dir=' + profile, '--force-device-scale-factor=1'], cwd: output, env, timeout: 30000});
  const ready = app.firstWindow({timeout: 30000}).then(window => {page = window;});
  await Promise.all([ready, waitContinuationBootstrap(app, {timeout: 30000,
    readState: () => readContinuationBootstrapFile(stateFile, app.process())})]);
  page.setDefaultTimeout(30000);
  page.on('pageerror', () => report.errors.push('PAGE_ERROR'));
  page.on('console', message => {if (message.type() === 'error') report.errors.push('CONSOLE_ERROR');});
  report.launches.push(await assertIsolatedPiMain(app, main, profile));
  const guard = await app.evaluate(continuationGuardRead, true);
  assert.equal(guard.policyProbe, 'FORMAL_FRAME_AND_ZERO_HTTP_VERIFIED');
  await page.getByTestId('xiaozhi-pi-workspace').waitFor();
  assert.equal(path.resolve(await page.evaluate(() => window.omniEdu.getDataRoot())), data);
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].setTitle('小智 · 题号模块隔离验收'));
  persist();
}
async function close() {
  if (!app) return;
  const handle = app; app = undefined;
  try {
    const guard = await handle.evaluate(continuationGuardRead);
    report.guards.push(guard);
    assert.equal(guard.networkAttempts, 0); assert.equal(guard.modelAttempts, 0); assert.equal(guard.rendererErrors, 0);
  } finally {await handle.close();}
}
async function candidates(filters, expectedIds) {
  await waitInstanceCondition(page, async ({owner, basketId, filters, expectedIds}) => {
    const root = document.querySelector('[data-testid="paper-basket-workspace"]');
    const refresh = root?.querySelector('[data-testid="paper-basket-refresh-candidates"]');
    if (!root || root.dataset.basketId !== basketId || !refresh || refresh.disabled ||
      root.querySelector('[data-testid="paper-basket-ui-pending"]') || root.querySelector('[role="status"]')) return false;
    const r = await window.omniEdu.readPaperBasketV2({schemaVersion: 'xiaozhi.paper-basket.v2', sessionId: owner, basketId});
    if (!r.ok || Object.keys(r.value.uiState.filters).some(key => r.value.uiState.filters[key] !== filters[key]) ||
      Object.keys(filters).some(key => r.value.uiState.filters[key] !== filters[key])) return false;
    const ids = [...root.querySelectorAll('[data-testid="paper-basket-candidate"]')].map(el => el.dataset.questionId).sort();
    return JSON.stringify(ids) === JSON.stringify([...expectedIds].sort());
  }, {owner, basketId, filters, expectedIds}, {description: 'Exact persisted filters and their rendered candidate identities'});
  const basket = await readInstanceBasket(page, owner, basketId);
  assert.deepEqual(basket.entries, [], 'Filtering never adds or substitutes questions');
}
async function shot(name) {
  for (const [width, height] of [[1366, 768], [1920, 1080], [800, 768]]) {
    const win = await app.browserWindow(page);
    try {await win.evaluate((w, size) => w.setContentSize(...size), [width, height]);} finally {await win.dispose();}
    await page.waitForFunction(([w, h]) => innerWidth === w && innerHeight === h, [width, height]);
    await page.getByTestId('paper-basket-question-number').scrollIntoViewIfNeeded();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const file = `${name}-${width}.png`;
    await page.screenshot({path: path.join(output, file), animations: 'disabled'}); report.screens.push(file);
  }
}
async function sizeForScroll() {
  const win = await app.browserWindow(page);
  try {await win.evaluate(w => w.setContentSize(1366, 768));} finally {await win.dispose();}
  await page.waitForFunction(() => innerWidth === 1366 && innerHeight === 768);
}
try {
  await launch();
  modelBaseline = ledger(data);
  await productEntry(page, 'materials').click(); await page.getByTestId('materials-workspace').waitFor();
  await app.evaluate(({dialog, BrowserWindow}, file) => {
    const fs = process.getBuiltinModule('fs');
    if (fs.realpathSync(file) !== file || !file.endsWith('.txt')) throw Error('OWNED_CHOOSER_FILE');
    const original = dialog.showOpenDialog, owner = BrowserWindow.getAllWindows()[0];
    dialog.showOpenDialog = async (window, options) => {
      dialog.showOpenDialog = original;
      if (window !== owner || options?.title !== '选择教学资料') throw Error('CHOOSER_SCOPE');
      return {canceled: false, filePaths: [file]};
    };
  }, input);
  await page.getByTestId('materials-import').click();
  await until(() => read('SELECT id,local_path,content_hash FROM teacher_resources'), rows => rows.length === 1, 'real import');
  resource = read('SELECT id,local_path,content_hash FROM teacher_resources')[0];
  assert.equal(resource.content_hash, inputHash); assert.equal(sha256(fs.readFileSync(resource.local_path)), inputHash);
  await until(() => read("SELECT id,archive_json FROM question_bank_items WHERE json_valid(archive_json)"), rows => rows.length === 2, 'real numbered extraction');
  questions = read("SELECT id,archive_json FROM question_bank_items WHERE json_valid(archive_json)").map(row => ({id: row.id, number: JSON.parse(row.archive_json).number}));
  assert.deepEqual(questions.map(q => q.number).sort(), ['12', '2']);
  report.questions = questions;
  check('Actual import and native parser retain original numbers 2 and 12 with exact source bytes');
  await productEntry(page, 'teaching').click();
  await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-question_notebook').click();
  await page.getByTestId('question-notebook-source-candidates').check();
  for (const q of questions) {
    const root = page.getByTestId('question-notebook-card-' + q.id);
    await root.getByTestId('question-archive-edit-' + q.id).click();
    const form = root.getByTestId('question-archive-form');
    for (const [field, value] of Object.entries({subject: '数学', grade: '初二', knowledgePoint: '有理数加法', questionType: '选择题',
      answer: q.number === '2' ? 'C，7' : 'C，17', analysis: q.number === '2' ? '教师核对：2 + 5 = 7。' : '教师核对：12 + 5 = 17。'})) {
      await form.getByTestId('question-archive-' + field).fill(value);
    }
    const difficulty = form.getByRole('combobox');
    assert.equal(await difficulty.count(), 1, 'The exact teacher correction form has one difficulty Select');
    await difficulty.selectOption('medium');
    await form.getByTestId('question-archive-source-checked').check();
    await form.getByTestId('question-archive-save').click(); await form.waitFor({state: 'hidden'});
    const archived = JSON.parse(read('SELECT archive_json FROM question_bank_items WHERE id=?', [q.id])[0].archive_json);
    assert.equal(archived.number, q.number); assert.equal(archived.state, 'teacher_edited'); assert.equal(archived.sourceChecked, true);
  }
  check('Visible teacher corrections classify the two parsed questions without rewriting original numbers or source files');
  const originalQuestionFacts = sha256(JSON.stringify(read('SELECT * FROM question_bank_items ORDER BY id')));
  const chapterName = '有理数加法 · 第一章';
  await page.getByTestId('question-notebook-category-name').fill(chapterName);
  await page.getByTestId('question-notebook-create-category').click();
  const categories = await until(() => read('SELECT id,name FROM question_notebook_categories WHERE name=?', [chapterName]), rows => rows.length === 1, 'UI-created chapter category');
  const chapter = categories[0], two = questions.find(q => q.number === '2'), twelve = questions.find(q => q.number === '12');
  await page.getByTestId(`question-notebook-category-${two.id}-${chapter.id}`).click();
  await until(() => page.evaluate(id => window.omniEdu.getQuestionNotebookEntry(id), two.id), q => q.categories.some(c => c.id === chapter.id), 'Visible category assignment');
  report.chapter = chapter;
  await enterPaper(page);
  await page.getByTestId('paper-practice-title').fill('原题号组合筛选验收');
  await page.getByTestId('paper-practice-subject').fill('数学'); await page.getByTestId('paper-practice-grade').fill('初二');
  await page.getByTestId('paper-basket-create').click();
  await until(() => page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id'), Boolean, 'UI-created basket');
  basketId = await page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id');
  owner = read('SELECT session_id FROM paper_baskets WHERE id=?', [basketId])[0].session_id;
  await page.getByTestId('paper-basket-question-number').fill('2'); await candidates({questionNumber: '2'}, [two.id]);
  await choose(page, page.getByTestId('paper-basket-type'), '选择题');
  await choose(page, page.getByTestId('paper-basket-difficulty'), 'medium');
  await choose(page, page.getByTestId('paper-basket-source-kind'), 'teacher_resource');
  await page.getByTestId('paper-basket-kp').fill('有理数加法');
  await page.getByTestId('paper-basket-search').fill('计算');
  const filters = {questionNumber: '2', questionType: '选择题', difficulty: 'medium', sourceKind: 'teacher_resource', knowledgePoint: '有理数加法', query: '计算'};
  await candidates(filters, [two.id]); check('Original number 2 excludes 12 while all existing filters remain ANDed and the basket stays unchanged');
  await choose(page, page.getByTestId('paper-basket-category'), chapter.id);
  await candidates({...filters, categoryId: chapter.id}, [two.id]);
  await page.getByTestId('paper-basket-question-number').fill('12');
  await candidates({...filters, questionNumber: '12', categoryId: chapter.id}, []);
  await choose(page, page.getByTestId('paper-basket-category'), '');
  await page.getByTestId('paper-basket-question-number').fill('2');
  await choose(page, page.getByTestId('paper-basket-source-kind'), 'local_bank');
  await candidates({...filters, sourceKind: 'local_bank'}, []);
  await choose(page, page.getByTestId('paper-basket-source-kind'), 'teacher_resource');
  await candidates(filters, [two.id]);
  check('Actual chapter category and source-kind exclusions compose with exact original numbering');
  await choose(page, page.getByTestId('paper-basket-difficulty'), 'hard');
  await candidates({...filters, difficulty: 'hard'}, []);
  await choose(page, page.getByTestId('paper-basket-difficulty'), 'medium');
  await page.getByTestId('paper-basket-question-number').fill('12');
  await candidates({...filters, questionNumber: '12'}, [twelve.id]);
  await page.getByTestId('paper-basket-question-number').fill('999');
  await candidates({...filters, questionNumber: '999'}, []);
  await page.getByRole('button', {name: '重置筛选', exact: true}).click();
  await candidates({}, questions.map(q => q.id));
  check('Negative difficulty and missing original number produce empty results; resetting restores both exact sources');
  await page.getByTestId('paper-basket-question-number').fill('2'); await candidates({questionNumber: '2'}, [two.id]);
  const card = page.getByTestId('paper-basket-candidate').and(page.locator(`[data-question-id="${two.id}"]`));
  assert.equal(await card.count(), 1);
  const body = card.getByTestId('paper-basket-question-stem');
  assert.equal(await body.locator('math').count(), 5, 'Original expression and all four options render local MathML');
  const bodyText = await body.innerText();
  for (const choice of ['A.', 'B.', 'C.', 'D.']) assert(bodyText.includes(choice));
  const sourceCard = card.getByTestId('paper-basket-source');
  const sourceTrigger = disclosureTrigger(sourceCard, '题目来源与保存版本');
  await sourceTrigger.click();
  assert.equal(await sourceTrigger.getAttribute('aria-expanded'), 'true');
  assert.equal(await sourceCard.getByTestId('paper-basket-original-number').innerText(), '原题号 2');
  await shot('original-number-filter');
  const before = await readInstanceBasket(page, owner, basketId);
  await page.getByTestId('paper-basket-stage-organize').click();
  await page.getByTestId('paper-basket-stage-select').click();
  await candidates({questionNumber: '2'}, [two.id]);
  assert.equal((await readInstanceBasket(page, owner, basketId)).revision, before.revision);
  check('Stage navigation retains exact original-number filter without changing basket content revision');
  await close(); await launch(); await enterPaper(page);
  await candidates({questionNumber: '2'}, [two.id]);
  assert.equal(await page.getByTestId('paper-basket-question-number').inputValue(), '2');
  assert.equal((await readInstanceBasket(page, owner, basketId)).revision, before.revision);
  await shot('cold-original-number');
  check('Second actual launch restores the same basket and original-number preference without model replay');
  await sizeForScroll();
  await page.getByRole('button', {name: '重置筛选', exact: true}).click();
  await candidates({}, questions.map(q => q.id));
  const list = page.getByTestId('paper-candidate-scroll');
  await list.scrollIntoViewIfNeeded();
  const maximum = await list.evaluate(el => el.scrollHeight - el.clientHeight);
  assert(maximum >= 40, 'Actual two full question cards provide a meaningful scrolling interval');
  await list.hover(); await page.mouse.wheel(0, Math.min(120, Math.floor(maximum / 2)));
  const scrolled = await until(() => readInstanceBasket(page, owner, basketId), b => b.uiState.scrollTop >= 20, 'Actual wheel saves nonzero candidate position');
  report.scroll = {maximum, saved: scrolled.uiState.scrollTop};
  await page.getByTestId('paper-basket-stage-organize').click();
  await page.getByTestId('paper-basket-stage-select').click();
  await candidates({}, questions.map(q => q.id));
  await until(() => list.evaluate(el => el.scrollTop), value => Math.abs(value - report.scroll.saved) <= 1, 'Stage return restores exact nonzero scroll');
  assert.equal((await readInstanceBasket(page, owner, basketId)).revision, before.revision);
  check('Actual wheel position survives organize-to-select navigation without content changes');
  await close(); await launch(); await sizeForScroll(); await enterPaper(page);
  await candidates({}, questions.map(q => q.id));
  const coldList = page.getByTestId('paper-candidate-scroll');
  report.scroll.cold = await until(() => coldList.evaluate(el => el.scrollTop), value => Math.abs(value - report.scroll.saved) <= 1, 'Third cold launch restores nonzero scroll at the same viewport');
  assert.equal((await readInstanceBasket(page, owner, basketId)).revision, before.revision);
  check('Third actual launch preserves saved nonzero scroll and exact empty basket without replay');
  assert.equal(sha256(fs.readFileSync(resource.local_path)), inputHash);
  assert.equal(sha256(JSON.stringify(read('SELECT * FROM question_bank_items ORDER BY id'))), originalQuestionFacts);
  assert.deepEqual(ledger(data), modelBaseline, 'Original model ledgers remain unchanged');
  for (const table of ['ai_conversation_messages', 'learning_records']) {
    assert.equal(read('SELECT COUNT(*) n FROM ' + table)[0].n, 0, 'No generated task, message, model usage or student fact');
  }
  await close(); verify(); assert.deepEqual(report.errors, []);
  report.success = true; check('Actual source files, zero-model ledgers, clean console and source/build identity remain intact');
} catch (error) {
  report.error = String(error.stack || error).replace(/sk-[\w-]+/g, '[credential]').slice(0, 5000);
  if (page && !page.isClosed()) await page.screenshot({path: path.join(output, 'failure.png')}).catch(() => {});
} finally {
  await close().catch(() => {report.success = false; report.errors.push('CLOSE_OR_GUARD_FAILED');});
  persist(); console.log(JSON.stringify({success: report.success, output, checks: report.checks.length}));
  if (!report.success) process.exitCode = 1;
}
