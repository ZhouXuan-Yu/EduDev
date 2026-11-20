import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {verifiedQuestionBeforeNativeSection, verifiedQuestionInPdfConflict} from '../../src/main/assets/material-pdf-question-conflict.ts';
import {alignPdfChoiceAnswers, pdfChoiceHeadings, pdfPrintedAnswers} from '../../src/main/assets/material-pdf-printed-answers.ts';
import {DOCUMENT_STRUCTURE_ENGINE} from '../../src/shared/material-document-structure.ts';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';

const root=fs.realpathSync(process.argv[2]);
assert(path.basename(root).startsWith('kb-structure-batch-'));
const source=path.join(root,'data');
const old='eecbd011-9f94-4909-994a-ede3f64db93b';
const reader=data=>(sql,...args)=>{
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true,timeout:5000});
  try{return db.prepare(sql).all(...args);}finally{db.close();}
};
const read=reader(source);
const pages=(db,generation)=>db('SELECT * FROM material_structure_pages WHERE generation=? ORDER BY page',generation);
const questions=(db,generation)=>db('SELECT * FROM material_structure_questions WHERE generation=? ORDER BY rowid',generation);
const bodies=rows=>rows.map(row=>JSON.parse(row.body_json));
const originalPages=pages(read,old), originalQuestions=questions(read,old);
const firstPage=JSON.parse(originalPages[0].body_json), originalId=firstPage.resourceId;
const question=bodies(originalQuestions).find(q=>q.number==='6'&&q.pageRange[0]===1);
assert(question.issues.includes('pdf_text_conflict'));
const [pdf]=read('SELECT generation FROM material_pdf_jobs WHERE resource_id=?',originalId);
const receipt=JSON.parse(read('SELECT result_json FROM material_pdf_pages WHERE generation=? AND page=1',pdf.generation)[0].result_json);
const ready={...question,status:'candidate',issues:question.issues.filter(issue=>issue!=='pdf_text_conflict')};
assert.deepEqual(ready.issues,[]);
assert(!verifiedQuestionInPdfConflict(receipt.nativeText,ready,1));
assert(verifiedQuestionBeforeNativeSection(receipt,ready,firstPage));
assert.deepEqual(ready.options.map(option=>option.label),['A','B','C','D']);
const neighbors=bodies(originalQuestions).filter(q=>q.issues.includes('pdf_text_conflict')&&q.pageRange[0]===1&&q.id!==ready.id);
assert(neighbors.length>=4&&neighbors.every(q=>!verifiedQuestionBeforeNativeSection(receipt,
  {...q,status:'candidate',issues:q.issues.filter(issue=>issue!=='pdf_text_conflict')},firstPage)));
const answerPage=JSON.parse(originalPages.find(row=>row.page===7).body_json);
const answerReceipt=JSON.parse(read('SELECT result_json FROM material_pdf_pages WHERE generation=? AND page=7',pdf.generation)[0].result_json);
const printed=pdfPrintedAnswers(answerPage,answerReceipt);
assert.equal(printed.sections[0].cells.find(cell=>cell.number==='6').letters,'C');
assert.equal(printed.sections[0].cells.find(cell=>cell.number==='6').anchor.page,7);
const choiceHeading=pdfChoiceHeadings(firstPage,firstPage.paragraphs.length)[0];
const choiceQuestions=bodies(originalQuestions).filter(q=>q.section===choiceHeading.text&&q.pageRange[0]===1)
  .map(q=>q.id===ready.id?ready:q);
assert.equal(alignPdfChoiceAnswers(choiceHeading,printed.sections[0],choiceQuestions).get(ready.id)?.text,'C');
if(!process.argv.includes('--desktop')){console.log(JSON.stringify({ok:true,sectionDraft:ready.id,unchangedConflicts:neighbors.length,printedAnswer:'C'}));process.exit(0);}

const work=fs.mkdtempSync(path.join(os.tmpdir(),'kb-section-replay-')), data=path.join(work,'data');
const query=reader(data), sha=value=>createHash('sha256').update(value).digest('hex');
const [original]=read('SELECT local_path,content_hash FROM teacher_resources WHERE id=?',originalId);
const originalSha=sha(fs.readFileSync(original.local_path));
assert.equal(originalSha,original.content_hash);
const incoming=path.join(work,'2022年上海中考数学.pdf');
fs.copyFileSync(original.local_path,incoming,fs.constants.COPYFILE_EXCL);
const protectedFacts=()=>query(`SELECT * FROM question_bank_items WHERE json_valid(archive_json)
 AND (json_extract(archive_json,'$.state')='teacher_edited' OR json_extract(archive_json,'$.sourceChecked')=1) ORDER BY id`);
const budget=()=>query('SELECT id,calls FROM material_ai_batches ORDER BY id');
const main=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','main/index.js');
const env={...process.env};
for(const name of Object.keys(env)) if(/KEY|TOKEN|SECRET|CREDENTIAL/i.test(name)||name.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(name)) delete env[name];
Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0'});
let app;
const errors=[];
async function launch(){
  app=await electron.launch({args:[main,'--user-data-dir='+path.join(work,'profile'),'--host-resolver-rules=MAP * ~NOTFOUND'],cwd:work,env,timeout:90000});
  await app.evaluate(({net})=>{
    globalThis.externalRequests=0;
    globalThis.fetch=net.fetch=async()=>{globalThis.externalRequests++;throw Error('Offline printed section test');};
  });
  const renderer=await app.firstWindow();
  renderer.on('pageerror',error=>errors.push(error.message));
  return renderer;
}
const until=async predicate=>{
  const deadline=Date.now()+240000;
  while(Date.now()<deadline){const value=await predicate();if(value)return value;await new Promise(resolve=>setTimeout(resolve,500));}
  throw Error('Timed out waiting for the printed section draft');
};
const keyword='自身重合';
async function showQuestion(renderer,id){
  await productEntry(renderer,'teaching').click();
  await renderer.getByRole('button',{name:'题本',exact:true}).filter({visible:true}).click();
  await renderer.getByTestId('question-notebook-search').fill(keyword);
  const card=renderer.getByTestId('question-notebook-card-'+id);
  await card.waitFor();
  assert((await card.innerText()).includes(keyword));
  await card.getByTestId('question-original-open').click();
  await card.getByTestId('question-original-image').first().evaluate(img=>img.decode());
  const answerImage=card.locator('figure').filter({hasText:'第 7 页 · 答案出处'}).getByTestId('question-original-image');
  await answerImage.evaluate(img=>img.decode());
  return card;
}
async function protectTeacherCorrection(renderer,resource,archive,current,card){
  await card.getByTestId('question-archive-edit-'+archive.id).click();
  const form=card.getByTestId('question-archive-form');
  await form.getByTestId('question-archive-difficulty').selectOption('medium');
  const changed=archive.stem.replace('90°','60°');
  assert.notEqual(changed,archive.stem);
  await form.getByTestId('question-archive-stem').fill(changed);
  await form.getByTestId('question-archive-save').click();
  await card.getByRole('alert').filter({hasText:'题面已改变'}).waitFor();
  const read=()=>query('SELECT stem,answer,analysis,archive_json,document_json FROM question_bank_items WHERE id=?',archive.id)[0];
  assert.equal(read().stem,archive.stem);
  await form.getByTestId('question-archive-stem').fill(archive.stem);
  const analysis='旋转90°相当于前进 n/4 个顶点，n 必须是 4 的倍数，选项中只有 12 符合。';
  await form.getByTestId('question-archive-analysis').fill(analysis);
  await form.getByTestId('question-archive-source-checked').check();
  await form.getByTestId('question-archive-save').click();
  await form.waitFor({state:'hidden'});
  const saved=read();
  assert.equal(saved.analysis,analysis);
  assert.equal(JSON.parse(saved.archive_json).analysisOrigin,'teacher');
  assert.equal(JSON.parse(saved.archive_json).answerOrigin,'source');
  assert.equal(JSON.parse(saved.archive_json).sourceChecked,true);

  await productEntry(renderer,'materials').click();
  await renderer.getByTestId('materials-refresh').click();
  await renderer.getByTestId('material-'+resource.id).getByRole('button').click();
  await renderer.getByRole('button',{name:'题目与校正',exact:true}).click();
  const panel=renderer.getByTestId('material-structure-panel');
  await openMaterialDisclosure(panel);
  await panel.getByTestId('structure-rebuild').click();
  await until(()=>{
    const [job]=query('SELECT generation,status,error FROM material_structure_jobs WHERE resource_id=?',resource.id);
    if(job?.status==='failed')throw Error('Rebuild failed: '+job.error);
    const [bank]=query('SELECT status,parse_token FROM material_question_jobs WHERE resource_id=?',resource.id);
    return job?.generation!==current.generation&&['partial','complete'].includes(job?.status)&&
      bank?.status==='complete'&&bank.parse_token.includes(job.generation);
  });
  assert.deepEqual(read(),saved);
}
try{
  const renderer=await launch();
  const before=[protectedFacts(),budget()];
  await productEntry(renderer,'materials').click();
  await app.evaluate(({dialog},file)=>{
    const old=dialog.showOpenDialog;
    dialog.showOpenDialog=async()=>{dialog.showOpenDialog=old;return {canceled:false,filePaths:[file]};};
  },incoming);
  const start=performance.now();
  await renderer.getByTestId('materials-import').click();
  const resource=await until(()=>query('SELECT id,local_path FROM teacher_resources WHERE content_hash=?',originalSha)[0]);
  assert.notEqual(resource.id,originalId);
  assert.equal(sha(fs.readFileSync(resource.local_path)),originalSha);
  assert.equal(query('SELECT * FROM material_word_page_sources WHERE pdf_resource_id=?',resource.id).length,0);
  const job=()=>query('SELECT * FROM material_structure_jobs WHERE resource_id=?',resource.id)[0];
  const current=await until(()=>{
    const latest=job();
    if(latest?.status==='failed')throw Error(`Printed section processing failed: ${latest.error??'unknown'}`);
    return ['partial','complete'].includes(latest?.status)?latest:false;
  });
  const publishMs=Math.round(performance.now()-start);
  assert.equal(current.engine,DOCUMENT_STRUCTURE_ENGINE);
  const rebuilt=bodies(questions(query,current.generation));
  const selected=rebuilt.find(q=>q.number==='6'&&q.pageRange[0]===1);
  assert.equal(selected.status,'candidate');
  assert.equal(selected.stem,ready.stem);
  assert.deepEqual(selected.options,ready.options);
  assert(neighbors.every(q=>rebuilt.some(value=>value.number===q.number&&value.pageRange[0]===1&&value.issues.includes('pdf_text_conflict'))));
  const archive=await until(()=>query(`SELECT id,stem,answer,analysis,archive_json,document_json FROM question_bank_items
    WHERE json_valid(archive_json) AND json_extract(archive_json,'$.structure.generation')=? AND
    json_extract(archive_json,'$.structure.candidateId')=?`,current.generation,selected.id)[0]);
  const state=JSON.parse(archive.archive_json);
  assert(state.state==='rule_extracted'&&!state.sourceChecked);
  assert.equal(archive.stem,ready.stem);
  assert.equal(archive.answer,'C');
  assert.equal(archive.analysis,'');
  assert.equal(state.answerOrigin,'source');
  assert.equal(state.analysisOrigin,'missing');
  assert(!state.issues.includes('missing_answer')&&state.issues.includes('missing_analysis'));
  const savedDocument=JSON.parse(archive.document_json);
  assert.deepEqual(savedDocument.answer,{origin:'source',text:'C',anchors:[printed.sections[0].cells.find(cell=>cell.number==='6').anchor]});
  assert(savedDocument.blocks.flatMap(block=>block.anchors).every(anchor=>anchor.page===1));
  const printedGroups=rebuilt.filter(q=>q.pageRange[0]===7);
  assert(printedGroups.length>0&&printedGroups.every(q=>q.kind==='answer'));
  await showQuestion(renderer,archive.id);
  const results=await renderer.evaluate(query=>window.omniEdu.searchQuestionBank({query,limit:30}),keyword);
  assert(!results.some(q=>q.id===archive.id));
  assert.deepEqual(pages(read,old),originalPages);
  assert.deepEqual(questions(read,old),originalQuestions);
  assert.equal(sha(fs.readFileSync(original.local_path)),originalSha);
  assert.deepEqual([protectedFacts(),budget()],before);
  assert.equal(await app.evaluate(()=>globalThis.externalRequests),0);
  await app.close();app=undefined;
  const reopened=await launch();
  const card=await showQuestion(reopened,archive.id);
  await protectTeacherCorrection(reopened,resource,archive,current,card);
  assert.equal(await app.evaluate(()=>globalThis.externalRequests),0);
  assert.deepEqual(errors,[]);
  console.log(JSON.stringify({ok:true,work,buildSha:sha(fs.readFileSync(main)),generation:current.generation,
    structuredQuestions:current.questions,held:current.held,publishMs,sourceDraft:archive.id,options:ready.options.length,
    unchangedConflicts:neighbors.length,printedAnswer:archive.answer,answerPage:7,analysisMissing:true,
    restarted:true,teacherEditProtected:true,formalMatches:0,externalRequests:0}));
}catch(error){console.error(JSON.stringify({work,error:String(error.stack)}));throw error;}
finally{await app?.close();}
