import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {wordFixture} from './word-fixtures.mjs';
import {productEntry} from '../product-navigation.mjs';
const {extractMaterialQuestionWindow} = await import('../../src/main/assets/material-question-extract.ts');
const {materialQuestionExtractionKey} = await import('../../src/main/assets/material-rule-duplicates.ts');
const {materialBodyVersion} = await import('../../src/main/assets/material-source.ts');
const runtimeFile = process.env.KB_RULE_RUNTIME || 'D:/WorkProject/EduProject-kb-run/flow-1gb-20261111/rule-duplicates-runtime.json';
const runtime = JSON.parse(fs.readFileSync(runtimeFile));
const root = fs.mkdtempSync(path.join(tmpdir(), 'xiaozhi-rule-duplicates-'));
const input = path.join(root, 'input'), data = path.join(root, 'data'), profile = path.join(root, 'profile');
fs.mkdirSync(input); fs.writeFileSync(path.join(input, '合成图文.docx'), await wordFixture());
const report = {root, runtime, checks: [], rendererErrors: [], scope: 'Synthetic Word imported through original UI, controlled legacy duplicate seed, actual teacher bookmark/edit, restart and SQLite. No natural-quality or provider claim.'};
let app, page, original, duplicate;
function database(action, readOnly = true) {
  const db = new DatabaseSync(path.join(data, 'app.db'), {readOnly});
  try {return action(db);} finally {db.close();}
}
async function until(action) {
  const deadline = Date.now() + 90000;
  while (Date.now() < deadline) {const value = await action(); if (value) return value; await new Promise(resolve => setTimeout(resolve, 200));}
  throw Error('Timed out');
}
async function launch() {
  const env = {...process.env, OMNI_EDU_DATA_ROOT: data, OMNI_EDU_E2E_VISIBLE: '0', OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_XIAOZHI_PI: '1'};
  for (const key of ['ELECTRON_RUN_AS_NODE', 'ELECTRON_RENDERER_URL', 'NODE_OPTIONS', 'OMNI_EDU_RULE_DUPLICATES']) delete env[key];
  app = await _electron.launch({args: [runtime.entry, '--user-data-dir=' + profile], cwd: process.cwd(), env, timeout: 90000});
  page = await app.firstWindow(); page.setDefaultTimeout(45000); page.on('pageerror', error => report.rendererErrors.push(error.message));
  await page.setViewportSize({width: 1366, height: 768});
}
async function notebook(raw = false) {
  await productEntry(page, 'teaching').click(); await page.getByRole('button', {name: '题本', exact: true}).click();
  if (!await page.getByTestId('question-notebook-filter-grade').isVisible()) await page.getByTestId('question-notebook-filter-toggle').click();
  await page.getByTestId('question-notebook-filter-grade').fill(''); await page.getByTestId('question-notebook-filter-subject').fill('');
  await page.getByTestId('question-notebook-source-candidates').setChecked(raw);
}
try {
  await launch(); await productEntry(page, 'materials').click();
  await app.evaluate(({dialog}, input) => {dialog.showOpenDialog = async () => ({canceled: false, filePaths: [input]});}, input);
  await page.getByTestId('materials-import-folder').click();
  await until(() => database(db => db.prepare('SELECT COUNT(*) n FROM question_bank_items').get().n === 2));
  await app.close(); app = undefined;
  database(db => {
    const resource = db.prepare('SELECT * FROM teacher_resources LIMIT 1').get();
    const units = db.prepare('SELECT * FROM resource_chunks ORDER BY chunk_index,id').all().map((row, i) => ({resourceId: resource.id, version: resource.content_hash, title: resource.original_file_name, offset: i,
      chunk: {id: row.id, resourceId: resource.id, chunkIndex: row.chunk_index, contentMd: row.content_md, containsPersonalData: !!row.contains_personal_data, pageNumber: row.page_number}}));
    const row = db.prepare('SELECT q.*,m.extraction_key FROM question_bank_items q JOIN material_question_members m ON m.question_id=q.id ORDER BY q.rowid LIMIT 1').get();
    const archive = JSON.parse(row.archive_json);
    const candidate = extractMaterialQuestionWindow(units, resource.parse_engine, false, 0).find(q => materialQuestionExtractionKey(resource.id, resource.content_hash, archive.sources, q.key) === row.extraction_key);
    assert(candidate); original = row.id; duplicate = 'question_' + randomUUID();
    const sources = archive.sources.map(source => {
      const chunk = units[source.offset].chunk, id = 'chunk_' + randomUUID();
      return {...source, chunkId: id, bodyVersion: materialBodyVersion({...chunk, id})};
    });
    const copy = {...row, id: duplicate, archive_json: JSON.stringify({...archive, sources})}; delete copy.extraction_key;
    copy.created_at = copy.updated_at = new Date(Date.parse(row.created_at) + 1000).toISOString();
    const columns = Object.keys(copy);
    db.prepare(`INSERT INTO question_bank_items(${columns.map(name => '"' + name + '"').join(',')}) VALUES(${columns.map(() => '?').join(',')})`).run(...columns.map(name => copy[name]));
    db.prepare('INSERT INTO material_question_members(extraction_key,resource_id,question_id,needs_attention) VALUES(?,?,?,1)').run(materialQuestionExtractionKey(resource.id, resource.content_hash, sources, candidate.key), resource.id, duplicate);
  }, false);
  await launch(); await until(async () => (await page.evaluate(() => window.omniEdu.getMaterialQuestionStatus())).foldedDuplicates === 1);
  await notebook(); await page.getByTestId('question-notebook-card-' + original).waitFor();
  assert.equal(await page.getByTestId('question-notebook-card-' + duplicate).count(), 0);
  await page.getByTestId('question-notebook-source-candidates').check();
  const extra = page.getByTestId('question-notebook-card-' + duplicate); await extra.waitFor();
  await extra.getByTestId('question-notebook-bookmark-' + duplicate).click();
  await page.getByTestId('question-notebook-source-candidates').uncheck();
  await extra.waitFor(); await until(async () => (await page.evaluate(() => window.omniEdu.getMaterialQuestionStatus())).foldedDuplicates === 0);
  assert.equal(database(db => db.prepare('SELECT bookmarked FROM question_notebook_bookmarks WHERE question_id=?').get(duplicate).bookmarked), 1);
  report.checks.push('Original folder import creates the baseline; a controlled legacy duplicate folds by default, is reachable in raw view and is immediately protected by the real bookmark button');
  const first = page.getByTestId('question-notebook-card-' + original);
  await first.getByTestId('question-archive-edit-' + original).click();
  await first.getByTestId('question-archive-answer').fill('教师更正的三分之一');
  if (await first.getByTestId('question-archive-difficulty').count()) await first.getByTestId('question-archive-difficulty').selectOption('easy');
  await first.getByTestId('question-archive-save').click();
  await until(() => database(db => JSON.parse(db.prepare('SELECT archive_json FROM question_bank_items WHERE id=?').get(original).archive_json).state === 'teacher_edited'));
  report.checks.push('Teacher answer correction uses the original editor and remains a separate protected question');
  await app.close(); app = undefined; await launch(); await notebook();
  await page.getByTestId('question-notebook-card-' + original).waitFor(); await page.getByTestId('question-notebook-card-' + duplicate).waitFor();
  assert.equal(database(db => db.prepare('SELECT answer FROM question_bank_items WHERE id=?').get(original).answer), '教师更正的三分之一');
  assert.equal(await page.getByTestId('question-notebook-bookmark-' + duplicate).getAttribute('aria-label'), '取消收藏');
  await page.setViewportSize({width: 1920, height: 1080});
  assert.equal(Number(database(db => db.prepare('SELECT SUM(calls) n FROM material_ai_batches').get().n) || 0), 0);
  assert.deepEqual(report.rendererErrors, []); report.success = true;
  report.checks.push('Cold restart retains both the bookmark and teacher correction without any provider call');
} catch (error) {report.success = false; report.error = String(error.stack || error); process.exitCode = 1;}
finally {if (app) await app.close(); report.closed = true; fs.writeFileSync(path.join(root, 'report.json'), JSON.stringify(report, null, 2)); console.log(JSON.stringify(report));}
