import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {setTimeout as delay} from 'node:timers/promises';
import {_electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';

async function runStructureBookJourney({page,report,output,sql,secondStem,known,until,coldRestart}){
  const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');
  const row=await until(()=>sql("SELECT * FROM question_bank_items WHERE json_extract(archive_json,'$.structure.candidateId') IS NOT NULL AND json_extract(archive_json,'$.number')='2' LIMIT 1")[0]);
  const existing=JSON.parse(row.archive_json).answerOrigin==='book_extracted';
  const notebook=async()=>{
    await productEntry(page,'teaching').click();
    await page.getByRole('button',{name:'题本',exact:true}).filter({visible:true}).click();
    await page.getByTestId('question-notebook-search').fill(secondStem.slice(0,18));
    const card=page.getByTestId('question-notebook-card-'+row.id);
    await card.waitFor();
    return card;
  };
  const facts=()=>sql('SELECT * FROM question_bank_items WHERE id=?',[row.id])[0];
  const ledger=()=>sql('SELECT id,calls FROM material_ai_batches ORDER BY id');
  const calls=ledger();
  let card=await notebook();
  if(!existing){
    await card.getByTestId('question-original-open').click();
    await card.getByTestId('question-original-image').first().evaluate(img=>img.decode());
    await card.getByTestId('question-archive-edit-'+row.id).click();
    for(const [key,value] of Object.entries({subject:'物理',grade:'八年级',knowledgePoint:'凝固点',questionType:'填空题'})){
      await card.getByTestId('question-archive-'+key).fill(value);
    }
    await card.getByTestId('question-archive-difficulty').selectOption('easy');
    await card.getByTestId('question-archive-source-checked').check();
    await card.getByTestId('question-archive-save').click();
    await card.getByTestId('question-archive-save').waitFor({state:'hidden'});
    assert.equal(JSON.parse(facts().archive_json).sourceChecked,true);

    await card.getByTestId('question-context-open').click();
    await card.getByTestId('projection-statement-text').fill(facts().stem);
    await card.getByTestId('projection-statement-state').selectOption('provided');
    for(const role of ['formulas','tables','figures','choices','subquestions']){
      await card.getByTestId('projection-'+role+'-state').selectOption('not_applicable');
    }
    const checkbox=card.getByTestId('question-context-complete');
    await checkbox.locator('[data-slot=checkbox-content]').click();
    assert(await checkbox.getByRole('checkbox').isChecked());
    await card.getByTestId('question-context-save').click();
    await card.getByTestId('question-context-save').waitFor({state:'hidden'});
  }
  const before=facts();
  assert.equal(JSON.parse(before.document_json).schemaVersion,existing?'xiaozhi.question-document.v3':'xiaozhi.question-document.v2');
  await card.getByTestId('question-notebook-answer-fold-'+row.id).getByRole('button').first().click();
  const match=card.getByTestId('structure-book-matches');
  const started=performance.now();
  await match.getByTestId('structure-book-match').click();
  const applied=match.locator('[data-testid="material-book-match-row"][data-state="applied"]');
  await applied.waitFor();
  const matchMs=Math.round(performance.now()-started);
  const after=facts(),archive=JSON.parse(after.archive_json),document=JSON.parse(after.document_json);
  assert.equal(after.answer,'0℃');
  assert.equal(archive.answerOrigin,'book_extracted');
  assert.equal(archive.analysisOrigin,'book_extracted');
  assert.equal(document.answer.book.source.resourceId,known.id);
  assert.deepEqual(document.blocks,JSON.parse(before.document_json).blocks);
  assert.deepEqual(document.context,JSON.parse(before.document_json).context);
  if(existing)assert.deepEqual(after,before);
  await applied.getByTestId('material-book-source-open').click();
  await applied.getByTestId('material-ai-page-text').waitFor();
  await card.getByTestId('question-answer-origin').filter({hasText:'答案册原文'}).waitFor();
  const saved=sql('SELECT evidence_json FROM material_book_answer_journal_v1 WHERE question_id=?',[row.id]);
  assert.equal(saved.length,1);
  const evidence=JSON.parse(saved[0].evidence_json);
  assert.equal(evidence.structure.page,2);
  assert.equal(evidence.structure.headingPage,1);
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await page.setViewportSize({width,height});
    await applied.scrollIntoViewIfNeeded();
    assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
    await page.screenshot({path:path.join(output,'structure-book-'+width+'.png')});
  }
  report.checks.push(existing?'Existing structure answer-match is idempotent and opens the separate original answer page':'Teacher completes a local structure question and applies the printed answer-book entry, inheriting the frozen title from page 1 and reopening the separate original answer page');

  page=await coldRestart();
  card=await notebook();
  await card.getByTestId('question-notebook-answer-fold-'+row.id).getByRole('button').first().click();
  await card.getByTestId('question-answer-origin').filter({hasText:'答案册原文'}).waitFor();
  const question=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),row.id);
  const result=await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),{
    schemaVersion:'xiaozhi.education.question-context.v1',questionId:row.id,version:questionVersion(question),
  });
  assert(result.ok,JSON.stringify(result));
  assert.equal(result.value.question.answer,'0℃');
  assert.equal(JSON.parse(facts().document_json).answer.book.candidateId,document.answer.book.candidateId);
  assert.deepEqual(ledger(),calls);
  assert.equal(sql('PRAGMA integrity_check')[0].integrity_check,'ok');
  report.checks.push('Restart validates both source chains through the typed evidence path used by Pi without additional provider calls');
  report.structureBook={questionPage:2,headingPage:1,answerPage:document.answer.book.source.page,matchMs,viewports:[1366,1920]};
}

// Resume the owned integration fixture in place. Its stored PDF receipts bind to the original file identities.
const root=fs.realpathSync(process.argv[2]);
assert.equal(path.dirname(root).toLowerCase(),fs.realpathSync(os.tmpdir()).toLowerCase());
assert.match(path.basename(root),/^omni-folder-books-[a-z0-9]+$/i);
const savedRun=JSON.parse(fs.readFileSync(path.join(root,'report.json'),'utf8'));
assert(savedRun.folderPairs&&savedRun.cloudRequests===0);
const output=fs.mkdtempSync(path.join(root,'structure-book-')),data=path.join(root,'data');
const entry=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','main/index.js');
const report={success:false,checks:[],rendererErrors:[],newProviderRequests:0,buildSha256:createHash('sha256').update(fs.readFileSync(entry)).digest('hex')};
function sql(statement,values=[]){
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{return db.prepare(statement).all(...values);}finally{db.close();}
}
async function until(read){
  const deadline=Date.now()+60000;
  while(Date.now()<deadline){
    const result=await read();
    if(result)return result;
    await delay(250);
  }
  throw Error('No matching local fixture record');
}
const [known]=sql("SELECT * FROM teacher_resources WHERE original_file_name='答案.pdf'");
const [receipt]=sql("SELECT u.status FROM material_ai_units u JOIN material_ai_batches b ON b.id=u.batch_id WHERE b.resource_id=? AND u.final_json<>''",[known.id]);
assert.equal(receipt?.status,'no_questions');
let app,page;
async function close(){if(app){report.newProviderRequests+=await app.evaluate(()=>globalThis.structureBookProviderAttempts||0);await app.close();app=undefined;}}
async function launch(){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0'};
  for(const key of ['DEEPSEEK_API_KEY','NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
  app=await _electron.launch({args:[entry,'--user-data-dir='+path.join(output,'profile')],cwd:process.cwd(),env,timeout:60000});
  await app.evaluate(({net})=>{
    globalThis.structureBookProviderAttempts=0;
    for(const owner of [globalThis,net])owner.fetch=async url=>{
      if(String(url).includes('/chat/completions'))globalThis.structureBookProviderAttempts++;
      throw Error('Structure answer match only uses saved local receipts');
    };
  });
  page=await app.firstWindow();
  page.setDefaultTimeout(30000);
  page.on('pageerror',error=>report.rendererErrors.push(error.message));
  return page;
}
console.log('OUTPUT '+output);
try{
  await launch();
  await runStructureBookJourney({page,report,output,sql,secondStem:'标准大气压下水的凝固点是多少摄氏度？',known,until,
    coldRestart:async()=>{await close();return launch();}});
  await close();
  assert.deepEqual(report.rendererErrors,[]);
  assert.equal(report.newProviderRequests,0);
  report.success=true;
}catch(error){
  report.error=String(error.stack||error);
  process.exitCode=1;
  if(page&&!page.isClosed()){
    try{report.visibleText=(await page.locator('body').innerText()).slice(-2000);await page.screenshot({path:path.join(output,'failure.png')});}catch{}
  }
}finally{
  await close();
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify(report));
}
