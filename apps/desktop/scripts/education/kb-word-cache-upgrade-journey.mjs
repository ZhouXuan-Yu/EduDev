import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {wordFixture, wordFixtureImage} from './word-fixtures.mjs';
import {productEntry} from '../product-navigation.mjs';

const desktop = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const output = fs.mkdtempSync(path.join(tmpdir(), 'xiaozhi-word-cache-'));
const folder = path.join(output, 'fixtures');
const data = path.join(output, 'data');
const profile = path.join(output, 'profile');
fs.mkdirSync(folder);
fs.writeFileSync(path.join(folder, '分数图文.docx'), await wordFixture());
const report = {
  output,
  mainSha256: createHash('sha256').update(fs.readFileSync(path.join(desktop, 'out/main/index.js'))).digest('hex'),
  checks: [],
  rendererErrors: [],
  scope: 'Isolated synthetic legacy parser-tag fixture, original import/rebuild UI, actual SQLite and cold source/image reads. No provider calls.',
};
let app, page, resource;
const note = value => { report.checks.push(value); console.log('PASS ' + value); };
function database(action, readOnly = true) {
  const db = new DatabaseSync(path.join(data, 'app.db'), {readOnly});
  try { return action(db); } finally { db.close(); }
}
function facts() {
  return database(db => ({
    resource: db.prepare('SELECT * FROM teacher_resources WHERE id=?').get(resource.id),
    chunks: db.prepare('SELECT * FROM resource_chunks WHERE resource_id=? ORDER BY id').all(resource.id),
    questions: db.prepare('SELECT * FROM question_bank_items ORDER BY id').all(),
  }));
}
async function until(action) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {
    const value = await action();
    if (value) return value;
    await delay(200);
  }
  throw Error('Timed out');
}
async function launch() {
  const env = {...process.env, OMNI_EDU_DATA_ROOT: data, OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_E2E_VISIBLE: '0', OMNI_EDU_XIAOZHI_PI: '1'};
  for (const key of ['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL', 'NODE_OPTIONS']) delete env[key];
  app = await _electron.launch({args: [path.join(desktop, 'out/main/index.js'), '--user-data-dir=' + profile], cwd: desktop, env, timeout: 90000});
  page = await app.firstWindow();
  page.on('pageerror', error => report.rendererErrors.push(error.message));
  await page.setViewportSize({width: 1366, height: 768});
  await productEntry(page, 'materials').click();
}
async function select() {
  await page.getByTestId('material-' + resource.id).getByRole('button').click();
  await page.getByRole('button', {name: '题目与校正', exact: true}).click();
  await page.getByTestId('material-word-source').waitFor();
}
async function rebuild() {
  await page.getByTestId('word-source-rebuild').click();
  await until(async () => /已整理|失败/.test(await page.getByTestId('word-source-rebuild-status').innerText()));
  assert.match(await page.getByTestId('word-source-rebuild-status').innerText(), /已整理/);
}
try {
  await launch();
  await app.evaluate(({dialog}, folder) => { dialog.showOpenDialog = async () => ({canceled: false, filePaths: [folder]}); }, folder);
  await page.getByTestId('materials-import-folder').click();
  await until(async () => {
    const catalog = await page.evaluate(() => window.omniEdu.listMaterials({schemaVersion: 'xiaozhi.materials.v1', query: '', offset: 0}));
    resource = catalog.resources.find(value => value.originalFileName === '分数图文.docx');
    return resource?.parseStatus === 'ready';
  });
  await select();
  const structure = await page.evaluate(resource => window.omniEdu.getMaterialWord({schemaVersion: 'xiaozhi.word-source.v1', resourceId: resource.id, version: resource.contentHash, offset: 0}), resource);
  await until(() => database(db => db.prepare('SELECT COUNT(*) n FROM question_bank_items').get().n > 0));
  await app.close(); app = undefined;
  // This private synthetic database reproduces a v1 body tag with an already upgraded Word cache.
  database(db => db.prepare("UPDATE teacher_resources SET parse_engine='word-ooxml.v1' WHERE id=?").run(resource.id), false);
  const baseline = facts();
  await launch(); await select();
  const search = await page.evaluate(() => window.omniEdu.searchMaterialText({schemaVersion: 'xiaozhi.material-search.v1', query: '分数', offset: 0, mode: 'keyword'}));
  const source = search.hits.find(hit => hit.source.resourceId === resource.id).source;
  const sourceBefore = await page.evaluate(source => window.omniEdu.getMaterialSource(source), source);
  await rebuild();
  assert.deepEqual(facts(), baseline);
  assert.deepEqual(await page.evaluate(source => window.omniEdu.getMaterialSource(source), source), sourceBefore);
  note('Legacy v1 parser tag with a current Word cache rebuilds through the original UI without changing any resource, chunk or bank row and keeps the original source readable');
  await app.close(); app = undefined;
  const asset = structure.assets[0];
  fs.writeFileSync(path.join(data, 'word-assets', asset.sha256), Buffer.alloc(asset.bytes));
  await launch(); await select();
  await page.getByTestId('word-picture-open').first().click();
  await page.getByRole('alert').filter({hasText: '图片来源已变化'}).waitFor();
  await rebuild();
  assert.deepEqual(facts(), baseline);
  assert.deepEqual(fs.readFileSync(path.join(data, 'word-assets', asset.sha256)), wordFixtureImage);
  note('Legacy v1 cache-only rebuild repairs a corrupt derived image while preserving all body IDs, timestamps and original bank facts');
  await app.close(); app = undefined;
  await launch(); await select();
  await page.setViewportSize({width: 1920, height: 1080});
  await page.getByTestId('word-picture-open').first().click();
  await page.getByTestId('word-picture-image').first().waitFor();
  assert.deepEqual(facts(), baseline);
  assert.deepEqual(await page.evaluate(source => window.omniEdu.getMaterialSource(source), source), sourceBefore);
  assert.deepEqual(report.rendererErrors, []);
  note('Cold restart retains the repaired image and authenticated old text source at 1920');
  report.success = true;
} catch (error) {
  report.success = false; report.error = String(error.stack || error); process.exitCode = 1;
} finally {
  if (app) await app.close();
  report.closed = true;
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
