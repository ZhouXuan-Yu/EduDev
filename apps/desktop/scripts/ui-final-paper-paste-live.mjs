/** A25 formal Electron. Real pasted TXT/import/parser/teacher review/basket, zero models. */
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
import {enterPaper, ledger} from './acceptance/paper-basket-ui-driver.mjs';
import {readInstanceBasket} from './acceptance/paper-instance-ui-driver.mjs';
import {productEntry} from './product-navigation.mjs';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
assert(args.length === 2 && args.includes('--run-ui') && args.some(value => value.startsWith('--pins=')));
const pinsFile = path.resolve(desktop, args.find(value => value.startsWith('--pins=')).slice(7));
assert(pinsFile.startsWith(path.join(desktop, 'test-results') + path.sep));
const pins = JSON.parse(fs.readFileSync(pinsFile));
const main = path.join(pins.buildRoot, 'main/index.js');
const output = fs.mkdtempSync(path.join(desktop, 'test-results/ui-final-paper-paste-'));
const data = path.join(output, 'data'), profile = path.join(output, 'profile');
const text = '学科：数学\n年级：初二\n知识点：有理数加法\n题型：选择题\n难度：easy\n'
  + '2. 粘贴资料甲：计算 $2+3$。\nA. 4\nB. 5\n答案：B\n解析：2+3=5。\n'
  + '12. 粘贴资料乙：计算 $3+4$。\nA. 6\nB. 7\n答案：B\n解析：3+4=7。';
const digest = sha256(Buffer.from(text));
const damaged = path.join(output, '实际损坏的教学资料.docx');
fs.writeFileSync(damaged, 'This file is deliberately not a ZIP/Office package.');
const report = {success: false, output, pins, checks: [], launches: [], guards: [], errors: [], screens: [],
  budget: {launches: 2, modelCalls: 0, retries: 0},
  scope: 'Teacher-authored mathematical fixtures; actual local parser and source files. No OCR/provider result simulation or natural pedagogy claim.'};
let app, page, owner, basketId, bankId, bankEntry, source, parsed, baseline;
const persist = () => fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
const check = name => {report.checks.push({name, pass: true}); persist(); console.log('PASS ' + name);};
const read = (sql, params = []) => {
  const db = new DatabaseSync(path.join(data, 'app.db'), {readOnly: true});
  try {return JSON.parse(JSON.stringify(db.prepare(sql).all(...params)));} finally {db.close();}
};
const verify = () => {
  assert.equal(fingerprint(path.join(desktop, 'src')).sha256, pins.source);
  assert.equal(fingerprint(pins.buildRoot).sha256, pins.build);
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
  verify(); assert(report.launches.length < 2);
  const number = report.launches.length + 1;
  const bootstrap = path.join(output, `bootstrap-${number}.cjs`), stateFile = path.join(output, `state-${number}.json`);
  fs.writeFileSync(bootstrap, continuationBootstrap({main, profile, diagnosticFile: stateFile}), {flag: 'wx'});
  const env = {...process.env};
  for (const key of Object.keys(env)) if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key) || key.startsWith('OMNI_EDU_')
    || ['NODE_OPTIONS', 'ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL'].includes(key)) delete env[key];
  Object.assign(env, {OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(desktop, '../..'),
    OMNI_EDU_XIAOZHI_PI: '1', OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_E2E_VISIBLE: '1'});
  app = await electron.launch({args: [bootstrap, '--user-data-dir=' + profile, '--force-device-scale-factor=1'], cwd: output, env, timeout: 30000});
  await Promise.all([app.firstWindow().then(value => {page = value;}), waitContinuationBootstrap(app, {
    timeout: 30000, readState: () => readContinuationBootstrapFile(stateFile, app.process()),
  })]);
  page.setDefaultTimeout(30000);
  page.on('pageerror', () => report.errors.push('PAGE_ERROR'));
  page.on('console', message => {if (message.type() === 'error') report.errors.push('CONSOLE_ERROR');});
  report.launches.push(await assertIsolatedPiMain(app, main, profile));
  assert.equal((await app.evaluate(continuationGuardRead, true)).policyProbe, 'FORMAL_FRAME_AND_ZERO_HTTP_VERIFIED');
  await page.getByTestId('xiaozhi-pi-workspace').waitFor();
  assert.equal(path.resolve(await page.evaluate(() => window.omniEdu.getDataRoot())), data);
  await app.evaluate(({BrowserWindow}) => BrowserWindow.getAllWindows()[0].setTitle('小智 · 粘贴资料隔离验收'));
}
async function close() {
  if (!app) return;
  const handle = app; app = undefined;
  try {
    const guard = await handle.evaluate(continuationGuardRead); report.guards.push(guard);
    assert.equal(guard.networkAttempts, 0); assert.equal(guard.modelAttempts, 0); assert.equal(guard.rendererErrors, 0);
  } finally {await handle.close();}
}
async function sizes(name, anchor) {
  for (const size of [[1366, 768], [1920, 1080], [800, 768]]) {
    await app.evaluate(({BrowserWindow}, size) => BrowserWindow.getAllWindows()[0].setContentSize(...size), size);
    await page.waitForFunction(size => innerWidth === size[0] && innerHeight === size[1], size);
    if (anchor) await page.getByTestId(anchor).scrollIntoViewIfNeeded();
    assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1));
    const file = `${name}-${size[0]}.png`;
    await page.screenshot({path: path.join(output, file)}); report.screens.push(file);
  }
}
async function pasteAndPreview(raw = text) {
  await page.getByTestId('paper-paste-open').click();
  await until(() => page.getByTestId('paper-paste-text').evaluate(node => node === document.activeElement), Boolean, 'focus enters pasted text');
  await page.getByTestId('paper-paste-text').fill(raw);
  await page.getByTestId('paper-paste-preview').click();
  await until(() => page.getByTestId('paper-paste-question').count(), count => count === 2, 'two actual boundaries');
  assert.equal(await page.getByTestId('paper-paste-save').isDisabled(), true);
  assert((await page.getByTestId('paper-paste-preview-list').innerText()).includes('原题号 12'));
  assert.equal(await page.getByTestId('paper-paste-preview-list').locator('img').count(), 0);
}
async function savePaste() {
  const boundaryCheck = page.getByTestId('paper-paste-check').getByRole('checkbox');
  assert.equal(await boundaryCheck.count(), 1, 'One native official boundary checkbox');
  const label = page.getByTestId('paper-paste-check').locator('[data-slot="checkbox-content"]');
  assert.equal(await label.count(), 1, 'Official clickable checkbox content');
  await label.click();
  assert.equal(await boundaryCheck.isChecked(), true);
  await page.getByTestId('paper-paste-save').click();
  await page.getByTestId('paper-paste-saved').waitFor();
}
try {
  await launch(); baseline = ledger(data);
  await productEntry(page, 'teaching').click();
  await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-question_notebook').click();
  for (const [field, value] of Object.entries({subject: '数学', grade: '初二', 'knowledge-point': '有理数加法',
    type: '选择题', stem: '已有题库题：计算 $8+1$。\nA. 8\nB. 9', answer: 'B', analysis: '8+1=9。'})) {
    await page.getByTestId('question-notebook-new-' + field).fill(value);
  }
  await page.getByTestId('question-notebook-create-question').click();
  bankId = (await until(() => read('SELECT id FROM question_bank_items'), rows => rows.length === 1, 'teacher bank creation'))[0].id;
  await enterPaper(page);
  await page.getByTestId('paper-practice-title').fill('粘贴与题库混合练习');
  await page.getByTestId('paper-practice-subject').fill('数学'); await page.getByTestId('paper-practice-grade').fill('初二');
  await page.getByTestId('paper-basket-create').click();
  basketId = await until(() => page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id'), Boolean, 'practice creation');
  owner = read('SELECT session_id FROM paper_baskets WHERE id=?', [basketId])[0].session_id;
  await page.getByTestId('paper-basket-candidate').and(page.locator(`[data-question-id="${bankId}"]`)).getByTestId('paper-basket-add').click();
  bankEntry = (await until(() => readInstanceBasket(page, owner, basketId), basket => basket.entries.length === 1, 'existing bank member')).entries[0];
  const beforeCancel = {revision: (await readInstanceBasket(page, owner, basketId)).revision,
    questions: read('SELECT * FROM question_bank_items'), resources: read('SELECT * FROM teacher_resources')};
  await pasteAndPreview(); await sizes('boundary-review', 'paper-paste-save');
  await page.getByTestId('paper-paste-text').press('Escape');
  await until(() => page.getByTestId('paper-paste-open').evaluate(node => node === document.activeElement), Boolean, 'cancel restores paste trigger focus');
  assert.deepEqual(read('SELECT * FROM question_bank_items'), beforeCancel.questions);
  assert.deepEqual(read('SELECT * FROM teacher_resources'), beforeCancel.resources);
  assert.equal((await readInstanceBasket(page, owner, basketId)).revision, beforeCancel.revision);
  check('Actual multi-question paste preview and cancellation preserve bank, source files and existing basket');
  await pasteAndPreview(); await savePaste();
  source = (await until(() => read('SELECT id,content_hash,local_path FROM teacher_resources'), rows => rows.length === 1, 'pasted source archive'))[0];
  assert.equal(source.content_hash, digest); assert.equal(fs.readFileSync(source.local_path, 'utf8'), text);
  assert.equal((await readInstanceBasket(page, owner, basketId)).entries.length, 1);
  await page.getByTestId('paper-paste-cancel').click(); await pasteAndPreview(); await savePaste();
  assert.equal(read('SELECT id FROM teacher_resources').length, 1);
  assert.equal(read('SELECT id FROM teacher_resources')[0].id, source.id);
  check('Explicit import saves exact immutable TXT and a repeated same-content UI import reuses the same source');
  await page.getByTestId('paper-paste-materials').click();
  await page.getByTestId('materials-paper-notebook').click();
  await until(() => read('SELECT id,archive_json FROM question_bank_items WHERE source_kind=?', ['teacher_resource']), rows => rows.length === 2, 'real local extraction');
  parsed = read('SELECT id,archive_json FROM question_bank_items WHERE source_kind=?', ['teacher_resource']);
  await page.getByTestId('question-notebook-source-candidates').check();
  for (const question of parsed) {
    const card = page.getByTestId('question-notebook-card-' + question.id);
    await card.getByTestId('question-archive-edit-' + question.id).click();
    const form = card.getByTestId('question-archive-form');
    await form.getByTestId('question-archive-source-checked').check();
    await form.getByTestId('question-archive-save').click(); await form.waitFor({state: 'hidden'});
    const archive = JSON.parse(read('SELECT archive_json FROM question_bank_items WHERE id=?', [question.id])[0].archive_json);
    assert.equal(archive.state, 'teacher_edited'); assert.equal(archive.sourceChecked, true);
  }
  await page.getByTestId('question-notebook-return-paper').click();
  await until(() => page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id'),
    id => id === basketId, 'exact original basket readback after navigation');
  for (let index = 0; index < parsed.length; index++) {
    const card = page.getByTestId('paper-basket-candidate').and(page.locator(`[data-question-id="${parsed[index].id}"]`));
    await card.getByTestId('paper-basket-add').click();
    await until(() => readInstanceBasket(page, owner, basketId), basket => basket.entries.length === index + 2, 'explicit mixed add');
  }
  const mixed = await readInstanceBasket(page, owner, basketId);
  assert.deepEqual(mixed.entries[0], bankEntry); assert.equal(mixed.entries.length, 3);
  assert.deepEqual(mixed.entries.map(entry => entry.question.sourceKind).sort(), ['local_bank', 'teacher_resource', 'teacher_resource']);
  await sizes('mixed-basket', 'paper-basket-workspace');
  check('Real text extraction and visible teacher review feed the exact original basket alongside the unchanged bank member');
  const reviewedFacts = read('SELECT * FROM question_bank_items ORDER BY id');
  await pasteAndPreview(); await savePaste(); await page.getByTestId('paper-paste-cancel').click();
  assert.deepEqual(read('SELECT * FROM question_bank_items ORDER BY id'), reviewedFacts);
  assert.deepEqual((await readInstanceBasket(page, owner, basketId)).entries, mixed.entries);
  check('Same-content verification after teacher review preserves source versions, reviews and all mixed basket members');
  const changedText = text.replaceAll('3+4', '3+6').replace('B. 7', 'B. 9').replace('3+6=7', '3+6=9');
  const changedDigest = sha256(Buffer.from(changedText));
  await pasteAndPreview(changedText); await savePaste(); await page.getByTestId('paper-paste-cancel').click();
  const changedSource = read('SELECT id,local_path FROM teacher_resources WHERE content_hash=?', [changedDigest]);
  assert.equal(changedSource.length, 1); assert.notEqual(changedSource[0].id, source.id);
  assert.equal(fs.readFileSync(changedSource[0].local_path, 'utf8'), changedText);
  assert.equal(fs.readFileSync(source.local_path, 'utf8'), text);
  assert.deepEqual((await readInstanceBasket(page, owner, basketId)).entries, mixed.entries);
  check('Different pasted contents with the readable same filename retain separate immutable sources without altering the basket');
  await page.getByTestId('paper-basket-materials').click();
  await app.evaluate(({dialog, BrowserWindow}, file) => {
    const original = dialog.showOpenDialog, owner = BrowserWindow.getAllWindows()[0];
    dialog.showOpenDialog = async (window, options) => {
      dialog.showOpenDialog = original;
      if (window !== owner || options.title !== '选择教学资料') throw Error('CHOOSER_SCOPE');
      return {canceled: false, filePaths: [file]};
    };
  }, damaged);
  await page.getByTestId('materials-import').click();
  const failed = (await until(() => read('SELECT id,parse_status,parse_engine FROM teacher_resources WHERE original_file_name=?', [path.basename(damaged)]),
    rows => rows.length === 1 && rows[0].parse_status === 'failed' && rows[0].parse_engine.endsWith(':parse_failed'), 'real damaged Office parse failure'))[0];
  const failedRow = page.getByTestId('material-' + failed.id);
  await failedRow.waitFor();
  await until(() => failedRow.innerText(), text => text.includes('失败'), 'actual visible file failure feedback');
  await sizes('real-file-error', 'materials-workspace');
  assert.equal(sha256(fs.readFileSync(source.local_path)), digest);
  check('Actual invalid Office file exposes a real parse failure while the pasted original and mixed basket survive');
  await page.getByTestId('materials-return-paper').click();
  const beforeCold = await readInstanceBasket(page, owner, basketId);
  await close(); await launch(); await enterPaper(page);
  await until(() => page.getByTestId('paper-basket-workspace').getAttribute('data-basket-id'), id => id === basketId, 'cold basket');
  const restored = await readInstanceBasket(page, owner, basketId);
  assert.deepEqual(restored.entries, beforeCold.entries); assert.equal(restored.revision, beforeCold.revision);
  assert.equal(fs.readFileSync(source.local_path, 'utf8'), text);
  assert.deepEqual(ledger(data), baseline); assert.equal(report.errors.length, 0);
  await sizes('cold-mixed-basket', 'paper-basket-workspace');
  check('Cold launch restores exact mixed members and source bytes without replaying any model or tool');
  report.references = {owner, basketId, bankId, sourceId: source.id, parsedIds: parsed.map(question => question.id)};
  await close(); verify(); report.success = true;
} catch (error) {
  report.error = String(error.stack || error); process.exitCode = 1;
} finally {
  try {await close();} catch (error) {report.cleanupError = String(error); process.exitCode = 1;}
  persist(); console.log(JSON.stringify({success: report.success, output, checks: report.checks.length, error: report.error}));
}
