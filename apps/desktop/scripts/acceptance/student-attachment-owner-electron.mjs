import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';
import { assertIsolatedPiMain, testMain } from './build-root.mjs';
import { fingerprint } from './evidence.mjs';
import { zeroNetworkBootstrap } from './zero-network-bootstrap.mjs';

const desktop = path.resolve(import.meta.dirname, '../..');
const buildDesktop = path.resolve(process.env.OMNI_EDU_BASELINE_DESKTOP ?? desktop);
const output = fs.mkdtempSync(path.join(path.resolve(process.env.OMNI_EDU_TEST_EVIDENCE), 'student-attachments-'));
const data = path.join(output, 'data');
const profile = path.join(output, 'profile');
for (const directory of [data, profile]) fs.mkdirSync(directory);
const sources = Object.fromEntries(['switch', 'refresh', 'archive', 'mismatch', 'partial', 'filter'].map(name => {
  const file = path.join(output, name + '-fixture.txt');
  fs.writeFileSync(file, 'Synthetic attachment ' + name);
  return [name, file];
}));
const main = testMain(buildDesktop);
const executablePath = path.join(buildDesktop, 'node_modules/electron/dist/electron.exe');
const bootstrap = zeroNetworkBootstrap({ output, main, profile, counter: '__qualityHttp' });
const env = { ...process.env };
for (const name of Object.keys(env)) {
  if (/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(name) || name.startsWith('OMNI_EDU_') ||
      ['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL', 'NODE_OPTIONS'].includes(name)) delete env[name];
}
Object.assign(env, {
  OMNI_EDU_DATA_ROOT: data, OMNI_EDU_REPO_ROOT: path.resolve(buildDesktop, '../..'),
  OMNI_EDU_SKIP_DOTENV: '1', OMNI_EDU_E2E_DIALOG_MODE: '1',
  OMNI_EDU_E2E_ATTACHMENT_DIALOG_QUEUE: JSON.stringify([
    [sources.switch], [sources.refresh], [sources.archive], [sources.mismatch],
    [sources.partial, path.join(output, 'missing-fixture.txt')], [], [sources.filter],
  ]),
});
const report = { main, executablePath, build: fingerprint(path.dirname(path.dirname(main))).sha256, output, results: [] };
let app, page;

async function launch() {
  app = await electron.launch({ executablePath, args: [bootstrap, '--user-data-dir=' + profile], cwd: buildDesktop, env, timeout: 60000 });
  page = await app.firstWindow();
  page.setDefaultTimeout(12000);
  await page.emulateMedia({ reducedMotion: 'reduce' });
  await page.getByTestId('office-prompt-input').waitFor({ timeout: 60000 });
  await assertIsolatedPiMain(app, main, profile);
  await app.evaluate(({ BrowserWindow }) => BrowserWindow.getAllWindows()[0].setContentSize(1366, 768));
}
async function test(name, check) {
  try { await check(); report.results.push({ name, status: 'PASS' }); }
  catch (error) { report.results.push({ name, status: 'FAIL', error: String(error.stack || error) }); }
  console.log(JSON.stringify(report.results.at(-1)));
}
const nav = id => page.locator('[data-testid=edu-navigation]:visible').getByTestId(id).click();
const row = id => page.getByTestId('timeline-record-' + id);
const attachmentButton = id => row(id).getByRole('button', { name: '导入附件', exact: true });
function readRows() {
  const db = new DatabaseSync(path.join(data, 'app.db'), { readOnly: true });
  try { return db.prepare('SELECT student_id, record_id, file_name, file_path, content_hash FROM attachments ORDER BY created_at').all(); }
  finally { db.close(); }
}

try {
  await launch();
  for (const name of ['附件验收甲', '附件验收乙']) {
    await nav('nav-student-workbench');
    await page.getByTestId('student-create').click();
    await page.getByTestId('student-form-display-name').fill(name);
    await page.getByTestId('student-form-save').click();
    await page.getByTestId('student-profile-form').waitFor({ state: 'hidden' });
  }
  const [a, b] = await page.evaluate(async () => {
    const students = await window.omniEdu.listStudents('附件验收');
    return ['甲', '乙'].map(name => students.find(student => student.displayName === '附件验收' + name).id);
  });
  const ids = await page.evaluate(async ([a, b]) => {
    const add = async (studentId, title, subject) => (await window.omniEdu.createRecord({
      studentId, title, subject, recordType: 'mistake', content: '合成记录', tags: [],
    })).find(record => record.title === title).id;
    return { a: await add(a, '甲物理', '物理'), other: await add(a, '甲数学', '数学'), b: await add(b, '乙物理', '物理') };
  }, [a, b]);
  await app.evaluate(({ ipcMain }, entry) => {
    const sqlite = process.getBuiltinModule('module').createRequire(entry)('sqlite3');
    const originalRun = sqlite.Database.prototype.run;
    const originalAll = sqlite.Database.prototype.all;
    const state = globalThis.__attachmentTest = { hold: '', failReads: '', hit: 0, settled: 0 };
    sqlite.Database.prototype.run = function (sql, values, callback) {
      if (sql.trimStart().startsWith('INSERT INTO attachments') && values.includes(state.hold)) {
        state.release = () => {
          delete state.release;
          state.hold = '';
          originalRun.call(this, sql, values, callback);
        };
        return this;
      }
      return originalRun.apply(this, arguments);
    };
    sqlite.Database.prototype.all = function (sql, values, callback) {
      if (state.failReads && sql.startsWith('SELECT * FROM learning_records WHERE student_id') && values[0] === state.failReads) {
        state.hit += 1;
        queueMicrotask(() => callback(new Error('controlled record read failure')));
        return this;
      }
      return originalAll.apply(this, arguments);
    };
    const invoke = ipcMain._invokeHandlers.get('attachments:import');
    ipcMain.removeHandler('attachments:import');
    ipcMain.handle('attachments:import', async (...args) => {
      try { return await invoke(...args); }
      finally { state.settled += 1; }
    });
  }, main);
  const waitHost = async (name, predicate) => {
    const stopAt = Date.now() + 10000;
    while (Date.now() < stopAt) {
      if (await app.evaluate(predicate)) return;
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    throw new Error('Timed out waiting for ' + name);
  };
  const select = id => page.getByTestId('record-student-' + id).click();
  await nav('nav-student-workbench');
  await page.getByTestId('student-row-' + a).click();
  await page.getByTestId('student-context-tab-records').click();
  await page.getByTestId('hub-entry-intake').click();
  await select(a);
  await row(ids.a).waitFor();

  await test('pending receipt stays with original student and preserves navigation', async () => {
    await app.evaluate(() => { globalThis.__attachmentTest.hold = 'switch-fixture.txt'; });
    await attachmentButton(ids.a).click();
    await waitHost('physical insert latch', () => Boolean(globalThis.__attachmentTest.release));
    await select(b);
    await row(ids.b).waitFor();
    const duplicateSelectionBlocked = await attachmentButton(ids.b).isDisabled();
    await app.evaluate(() => globalThis.__attachmentTest.release());
    await waitHost('first IPC completion', () => globalThis.__attachmentTest.settled >= 1);
    // Drain the renderer's receipt and the following list refresh.
    await page.waitForTimeout(700);
    assert.equal(await row(ids.b).isVisible(), true, '乙的时间线被甲的迟到回执覆盖');
    assert.equal(await page.getByText(path.basename(sources.switch), { exact: true }).count(), 0);
    assert.equal(duplicateSelectionBlocked, true);
    await select(a);
    await row(ids.a).getByText('switch-fixture.txt', { exact: true }).waitFor();
  });
  await select(a);
  await row(ids.a).waitFor();
  await test('committed import survives both receipt and timeline read errors', async () => {
    await app.evaluate((_electron, student) => { globalThis.__attachmentTest.failReads = student; }, a);
    try {
      await attachmentButton(ids.a).click();
      await waitHost('second IPC completion', () => globalThis.__attachmentTest.settled >= 2);
      await page.getByText(/附件已复制.*重新读取/).first().waitFor({ timeout: 4500 });
      assert((await app.evaluate(() => globalThis.__attachmentTest.hit)) > 0);
      const saved = readRows().find(item => item.file_name === 'refresh-fixture.txt');
      assert.equal(saved.student_id, a);
      assert.deepEqual(fs.readFileSync(saved.file_path), fs.readFileSync(sources.refresh));
    } finally { await app.evaluate(() => { globalThis.__attachmentTest.failReads = ''; }); }
  });

  await test('archive during copy prevents commit and removes the new copy', async () => {
    await select(b);
    await row(ids.b).waitFor();
    await app.evaluate(() => { globalThis.__attachmentTest.hold = 'archive-fixture.txt'; });
    await attachmentButton(ids.b).click();
    await waitHost('archive insert latch', () => Boolean(globalThis.__attachmentTest.release));
    const db = new DatabaseSync(path.join(data, 'app.db'));
    try { db.prepare("UPDATE students SET status = 'archived' WHERE id = ?").run(b); }
    finally { db.close(); }
    await app.evaluate(() => globalThis.__attachmentTest.release());
    await waitHost('archive race completion', () => globalThis.__attachmentTest.settled >= 3);
    assert(!readRows().some(item => item.file_name === 'archive-fixture.txt'));
    const target = path.join(data, 'students', b, 'records', ids.b, 'attachments');
    assert.deepEqual(fs.readdirSync(target), []);
  });
  await test('mismatched student and record creates neither row nor directory', async () => {
    const result = await page.evaluate(async ([student, record]) => {
      try { return (await window.omniEdu.importAttachments(student, record)).status; }
      catch { return 'rejected'; }
    }, [a, ids.b]);
    assert.equal(result, 'rejected');
    assert(!readRows().some(item => item.file_name === 'mismatch-fixture.txt'));
    assert(!fs.existsSync(path.join(data, 'students', a, 'records', ids.b, 'attachments')));
  });

  await test('partial copies and cancellation have accurate typed receipts', async () => {
    const result = await page.evaluate(([student, record]) => window.omniEdu.importAttachments(student, record), [a, ids.a]);
    assert.equal(result.status, 'partial');
    assert.deepEqual(result.items.map(item => item.ok), [true, false]);
    assert.deepEqual(fs.readFileSync(readRows().find(item => item.file_name === 'partial-fixture.txt').file_path), fs.readFileSync(sources.partial));
    const before = readRows();
    const canceled = await page.evaluate(([student, record]) => window.omniEdu.importAttachments(student, record), [a, ids.a]);
    assert.equal(canceled.status, 'canceled');
    assert.deepEqual(canceled.items, []);
    assert.deepEqual(readRows(), before);
  });

  await test('a successful import preserves the active timeline filter', async () => {
    await nav('nav-student-workbench');
    await page.getByTestId('student-row-' + a).click();
    await page.getByTestId('student-context-tab-records').click();
    await page.getByTestId('student-record-filters-toggle').click();
    await page.getByPlaceholder('科目', { exact: true }).fill('物理');
    await row(ids.a).waitFor();
    await row(ids.other).waitFor({ state: 'hidden' });
    await attachmentButton(ids.a).click();
    await row(ids.a).getByText('filter-fixture.txt', { exact: true }).waitFor();
    assert.equal(await row(ids.other).count(), 0);
    assert.equal(await page.getByPlaceholder('科目', { exact: true }).inputValue(), '物理');
  });

  await test('restart reads owned bytes and hides an inconsistent old attachment link', async () => {
    const db = new DatabaseSync(path.join(data, 'app.db'));
    try {
      db.prepare(`INSERT INTO attachments (id, student_id, record_id, file_name, file_path, file_type, file_size, content_hash, extracted_text, created_at)
        SELECT 'synthetic-old-mismatched-link', ?, record_id, 'old-link-fixture.txt', file_path, file_type, file_size, content_hash,
          extracted_text, created_at FROM attachments WHERE file_name = 'switch-fixture.txt'`).run(b);
    } finally { db.close(); }
    const beforeRestart = await app.evaluate(() => globalThis.__qualityHttp);
    await app.close();
    app = undefined;
    await launch();
    const records = await page.evaluate(student => window.omniEdu.listRecords(student), a);
    const entries = records.find(record => record.id === ids.a).attachments;
    const saved = readRows().find(item => item.file_name === 'switch-fixture.txt');
    assert.equal(saved.student_id, a);
    assert.equal(saved.record_id, ids.a);
    assert.equal(entries.find(item => item.fileName === saved.file_name).contentHash, saved.content_hash);
    assert(!entries.some(item => item.fileName === 'old-link-fixture.txt'));
    assert.deepEqual(fs.readFileSync(saved.file_path), fs.readFileSync(sources.switch));
    report.httpAttempts = { beforeRestart, afterRestart: await app.evaluate(() => globalThis.__qualityHttp) };
    assert.deepEqual(report.httpAttempts, { beforeRestart: [], afterRestart: [] });
    report.persisted = { confirmedCopies: entries.map(item => ({ fileName: item.fileName, sha256: item.contentHash })), originalOwnerMatches: true };
  });
} catch (error) {
  report.failure = String(error.stack || error);
} finally {
  if (app) await app.close();
  report.success = !report.failure && report.results.length === 7 && report.results.every(result => result.status === 'PASS');
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify({ output, success: report.success, failure: report.failure }));
  process.exitCode = report.success ? 0 : 1;
}
