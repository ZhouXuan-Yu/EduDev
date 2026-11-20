import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';

// Reuse the existing trial library. Copy only the local evidence required for archived reads.
const seed = fs.realpathSync(process.argv[2]);
const destination = fs.mkdtempSync(path.join(os.tmpdir(), 'edudev-choice-subtypes-'));
const data = path.join(destination, 'data');
fs.mkdirSync(data);
for (const name of ['teacher_resources', 'material-ai-images', 'question-ai-assets', 'question-assets', 'word-assets']) {
  const original = path.join(seed, name);
  if (fs.existsSync(original)) fs.cpSync(original, path.join(data, name), {recursive: true});
}
const sqlPath = path.join(data, 'app.db');
const seedDb = new DatabaseSync(path.join(seed, 'app.db'), {readOnly: true});
try { seedDb.exec("VACUUM INTO '" + sqlPath.replaceAll("'", "''") + "'"); }
finally { seedDb.close(); }
const {relocateBackupDatabase} = await import('../../src/main/backup/restore-database.ts');
await relocateBackupDatabase(sqlPath, seed, data, path.join(path.dirname(seed),'XiaozhiOutputs'), path.join(destination,'XiaozhiOutputs'));

function read(sql, args = []) {
  const db = new DatabaseSync(sqlPath, {readOnly: true});
  try { return db.prepare(sql).all(...args); }
  finally { db.close(); }
}
const questions = read(`SELECT * FROM question_bank_items
  WHERE subject='物理' AND grade='高中' AND question_type='单项选择题' AND json_extract(archive_json,'$.state')='ai_final'
  ORDER BY id`);
assert(questions.length > 1 && questions.length <= 20, 'Require the already archived trial cohort');
assert.equal(new Set(questions.map(q => q.knowledge_point)).size, questions.length);
const evidence = () => read(`SELECT u.batch_id,u.ordinal,u.first_json,u.final_json,u.image_sha,b.calls
  FROM material_ai_units u JOIN material_ai_members m USING(batch_id,ordinal) JOIN material_ai_batches b ON b.id=u.batch_id
  WHERE m.question_id IN (${questions.map(() => '?').join(',')}) ORDER BY m.question_id`, questions.map(q => q.id));
const beforeEvidence = evidence();
assert.equal(beforeEvidence.length, questions.length);
const callCount = () => read('SELECT SUM(calls) n FROM material_ai_batches')[0].n;
const beforeCalls = callCount();
const env = {...process.env, OMNI_EDU_DATA_ROOT:data, OMNI_EDU_REPO_ROOT:path.resolve('../..'),
  OMNI_EDU_E2E_DIALOG_MODE:'1', OMNI_EDU_E2E_VISIBLE:'0', OMNI_EDU_SKIP_DOTENV:'1'};
for (const key of ['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS','DEEPSEEK_API_KEY']) delete env[key];
const entry = path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT || 'out', 'main/index.js');
const report = {destination, buildSha256:createHash('sha256').update(fs.readFileSync(entry)).digest('hex'),
  rendererErrors:[], retrieval:[], checks:[]};
const title = '现有原题选择题专卷 ' + randomUUID().slice(0, 8);
let app, page;
async function launch() {
  app = await electron.launch({args:[entry,'--user-data-dir='+path.join(destination,'profile')],env,cwd:destination,timeout:90000});
  await app.evaluate(({net}) => {
    globalThis.choiceSubtypeRequests = 0;
    net.fetch = globalThis.fetch = async () => {
      globalThis.choiceSubtypeRequests++;
      throw Error('This test reuses local receipts');
    };
  });
  page = await app.firstWindow();
  page.setDefaultTimeout(30000);
  page.on('pageerror', error => report.rendererErrors.push(error.message));
}
async function close() {
  if (!app) return;
  const requests = await app.evaluate(() => globalThis.choiceSubtypeRequests);
  await app.close();
  app = undefined;
  assert.equal(requests, 0);
}
try {
  await launch();
  for (const q of questions) {
    const filters = {query:q.knowledge_point,subject:q.subject,grade:q.grade,knowledgePoint:q.knowledge_point};
    const hits = await page.evaluate(async ({filters,id}) => {
      const result = [];
      for (const questionType of ['选择题','单选题','多选题']) {
        const notebook = await window.omniEdu.listQuestionNotebook({...filters,questionType});
        result.push(notebook.items.some(item => item.id === id));
      }
      return result;
    }, {filters,id:q.id});
    assert.deepEqual(hits,[true,true,false],q.knowledge_point);
    report.retrieval.push(hits);
  }
  await productEntry(page,'teaching').click();
  await page.getByTestId('hub-entry-paper').click();
  await page.getByTestId('paper-basket-workspace').waitFor();
  const automatic = page.getByTestId('paper-entry-automatic');
  if (!await automatic.isVisible()) {
    await page.getByTestId('paper-basket-new').click();
    const dialog = page.getByTestId('paper-basket-create-dialog');
    await dialog.getByTestId('paper-practice-subject').fill('物理');
    await dialog.getByTestId('paper-practice-grade').fill('高中');
    await dialog.getByTestId('paper-basket-create').click();
    await dialog.waitFor({state:'hidden'});
  }
  if (!await automatic.isVisible()) await page.getByRole('button',{name:'更多筛选',exact:true}).click();
  await automatic.click();
  const rows = page.getByTestId('paper-section');
  while (await rows.count() > 1) await rows.last().getByRole('button',{name:'移除此部分'}).click();
  for (const [key,value] of Object.entries({title,subject:'物理',grade:'高中',duration:'20',total:String(questions.length*5)})) {
    await page.getByTestId('paper-'+key).fill(value);
  }
  for (const [index,q] of questions.entries()) {
    if (index) await page.getByRole('button',{name:'添加部分',exact:true}).click();
    const row = rows.nth(index);
    for (const [key,value] of Object.entries({label:q.knowledge_point,type:'选择题',count:'1',points:'5',kp:q.knowledge_point})) {
      await row.getByTestId('paper-section-'+key).fill(value);
    }
    await row.getByTestId('paper-section-difficulty').selectOption(q.difficulty);
  }
  const started = performance.now();
  await page.getByTestId('paper-generate').click();
  await page.getByTestId('paper-review').waitFor();
  report.paperMs = Math.round(performance.now() - started);
  const record = read('SELECT * FROM ai_confirmation_items WHERE title=? ORDER BY rowid DESC LIMIT 1',[title])[0];
  const selected = JSON.parse(record.payload_json).selection;
  report.selected = selected.items.length;
  report.subtypesInPaper = selected.items.filter(item => item.question.questionType === '单项选择题').length;
  assert.equal(selected.items.length,questions.length);
  assert.deepEqual(selected.shortages,[]);
  const verified = [];
  for (const item of selected.items) {
    const source = await page.evaluate(input => window.omniEdu.getQuestionContextSource(input), item.source);
    assert(source.ok, JSON.stringify(source));
    assert.equal(source.value.question.questionType,item.question.questionType);
    verified.push(item.question.id);
  }
  assert.deepEqual(verified,questions.map(q => q.id));
  await page.getByTestId('paper-confirm').click();
  await page.getByTestId('paper-confirmed').waitFor();
  report.checks.push('Stored original types, collection scope and source authority survive automatic selection and confirmation');
  await close();
  await launch();
  const paper = await page.evaluate(query => window.omniEdu.reviewPaper(query),
    {schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:record.session_id,id:record.id});
  assert(paper.ok, JSON.stringify(paper));
  assert.equal(paper.value.state,'confirmed');
  assert.equal(paper.value.selection.items.length,questions.length);
  assert.deepEqual(evidence(),beforeEvidence);
  assert.equal(callCount(),beforeCalls);
  assert.deepEqual(report.rendererErrors,[]);
  report.checks.push('Confirmed snapshot and historical model receipts survive a fresh app launch without a new request');
  report.ok = true;
} catch (error) {
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  await close();
  fs.writeFileSync(path.join(destination,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
