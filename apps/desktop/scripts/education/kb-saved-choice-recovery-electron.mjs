import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';

const seed=fs.realpathSync(process.argv[2]),batchId=process.argv[3];
assert.match(batchId,/^aibatch_[a-f0-9-]{36}$/);
const destination=fs.mkdtempSync(path.join(os.tmpdir(),'edudev-saved-choice-'));
const data=path.join(destination,'data');
fs.mkdirSync(data);
for(const name of ['teacher_resources','question-ai-assets','question-assets','material-ai-images','word-assets']){
 const original=path.join(seed,name);
 if(fs.existsSync(original))fs.cpSync(original,path.join(data,name),{recursive:true});
}
const filename=path.join(data,'app.db'),seedDb=new DatabaseSync(path.join(seed,'app.db'),{readOnly:true});
try{seedDb.exec("VACUUM INTO '"+filename.replaceAll("'","''")+"'");}finally{seedDb.close();}
const {relocateBackupDatabase}=await import('../../src/main/backup/restore-database.ts');
await relocateBackupDatabase(filename,seed,data,path.join(path.dirname(seed),'XiaozhiOutputs'),path.join(destination,'XiaozhiOutputs'));
const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');
const {archiveEligible}=await import('../../src/shared/question-archive.ts');
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const read=(sql,args=[])=>{
 const db=new DatabaseSync(filename,{readOnly:true,timeout:3000});
 try{return db.prepare(sql).all(...args);}finally{db.close();}
};
const facts=()=>read('SELECT q.*,m.number FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id WHERE m.batch_id=? ORDER BY m.number',[batchId]);
const receipts=()=>read('SELECT input_json,first_json,final_json,image_sha FROM material_ai_units WHERE batch_id=?',[batchId]);
const audits=()=>read('SELECT * FROM material_ai_choice_rechecks WHERE batch_id=? ORDER BY number',[batchId]);
const calls=()=>read('SELECT SUM(calls) n FROM material_ai_batches')[0].n;
const nativeAudits=()=>read('SELECT * FROM material_ai_native_layout_rechecks ORDER BY question_id');
const original=facts(),frozen=receipts(),previousCalls=calls(),previousNative=nativeAudits();
assert.equal(original.length,5);
assert.equal(audits().length,0);
const [source]=read('SELECT b.resource_id,r.title,r.local_path FROM material_ai_batches b JOIN teacher_resources r ON r.id=b.resource_id WHERE b.id=?',[batchId]);
const entry=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','main/index.js');
const report={destination,buildSha256:sha(fs.readFileSync(entry)),checks:[],requests:0,rendererErrors:[]};
let app,page;
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_SKIP_DOTENV:'1'};
 for(const name of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[name];
 app=await _electron.launch({args:[entry,'--user-data-dir='+path.join(destination,'profile')],env,cwd:destination,timeout:90000});
 await app.evaluate(({net})=>{globalThis.choiceProviderAttempts=0;net.fetch=globalThis.fetch=async()=>{
  globalThis.choiceProviderAttempts++;throw Error('This local recovery must never use the cloud.');
 };});
 page=await app.firstWindow();
 page.setDefaultTimeout(30000);
 page.on('pageerror',error=>report.rendererErrors.push(error.message));
}
async function close(){
 if(!app)return;
 report.requests+=await app.evaluate(()=>globalThis.choiceProviderAttempts);
 await app.close();app=undefined;
}
const pageQuery={schemaVersion:'xiaozhi.material-ai-page.v1',batchId,ordinal:1,includeImage:true};
const pageRead=()=>page.evaluate(input=>window.omniEdu.getMaterialAiPage(input),pageQuery);
const act=()=>page.evaluate(batchId=>window.omniEdu.controlMaterialAiBatch({schemaVersion:'xiaozhi.material-ai.v1',batchId,action:'recheck_answers'}),batchId);
const question=id=>page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),id);
const readSource=q=>page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),{schemaVersion:'xiaozhi.education.question-context.v1',questionId:q.id,version:questionVersion(q)});
async function createPaper(){
 return page.evaluate(async()=>{
  const owner=await window.omniEdu.createAiConversationSession({title:'归档原题复核选卷'});
  return window.omniEdu.createPaper({schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:owner.session.id,requestId:crypto.randomUUID(),blueprint:{
   title:'物理 · 已存原题复核练习',subject:'物理',grade:'初三',durationMinutes:15,totalPoints:15,mode:'source_only',
   sections:[{id:'choices',label:'选择题',questionType:'选择题',count:3,points:5}],
  }});
 });
}
try{
 await launch();
 const before=await createPaper();
 assert(before.ok,JSON.stringify(before));
 assert.equal(before.value.count,0);
 report.before=before.value.count;
 await productEntry(page,'materials').click();
 await page.getByTestId('materials-search').fill(source.title);
 await page.getByTestId('material-'+source.resource_id).getByRole('button').click();
 await page.getByTestId('materials-section-questions').click();
 const panel=page.getByTestId('material-ai-panel');await openMaterialDisclosure(panel);
 const batch=panel.locator(`[data-batch-id="${batchId}"]`);
 await batch.getByTestId('material-ai-recheck-answers').click();
 const recheckStarted=performance.now();
 const result=await Promise.race([
  batch.getByText('已本地复核3道选择题答案表示。复核使用原选项与已存响应。').waitFor().then(()=>null),
  panel.getByRole('alert').filter({hasText:'原件或正文已变化'}).waitFor().then(()=>panel.getByRole('alert').filter({hasText:'原件或正文已变化'}).innerText()),
 ]);
 assert.equal(result,null,'合法重定位后应可使用已存原件和回执复核');
 report.recheckMs=Math.round(performance.now()-recheckStarted);
 const applied=audits();
 assert.deepEqual(applied.map(row=>row.number),['1','2','3']);
 const after=facts();
 for(const [index,row] of after.entries()){
  assert.deepEqual({...row,archive_json:original[index].archive_json},{...original[index]});
  if(index>=3)assert.deepEqual(row,original[index]);
 }
 await act();assert.deepEqual(audits(),applied);
 report.recovered=applied.length;report.held=after.length-applied.length;
 report.checks.push('Real material UI safely republishes three archived choices, leaves two held, and repeats without extra journals');
 const view=await pageRead();
 assert(view.inputImage);
 assert.equal(sha(Buffer.from(view.inputImage.dataUrl.split(',')[1],'base64')),frozen[0].image_sha);
 for(const saved of applied){
  const q=await question(saved.question_id);
  assert(archiveEligible(q));
  assert((await readSource(q)).ok);
  const hits=await page.evaluate(filter=>window.omniEdu.searchQuestionBank(filter),
   {query:q.knowledgePoint,subject:q.subject,grade:'初三',questionType:'选择题',knowledgePoint:q.knowledgePoint,limit:10});
  assert(hits.some(item=>item.id===q.id));
 }
 const paper=await createPaper();
 assert(paper.ok,JSON.stringify(paper));
 assert.deepEqual(paper.value.selection.items.map(item=>item.question.id).sort(),applied.map(row=>row.question_id).sort());
 const {id,sessionId,revision}=paper.value;
 const confirmed=await page.evaluate(input=>window.omniEdu.decidePaper(input),{schemaVersion:'xiaozhi.paper-blueprint.v1',id,sessionId,revision,action:'confirm'});
 assert(confirmed.ok,JSON.stringify(confirmed));report.after=paper.value.count;
 report.checks.push('Three new usable originals appear in the teacher search, pass source reauthentication and enter a confirmed source-only draft');
 await close();await launch();
 assert((await pageRead()).inputImage);
 const cold=await page.evaluate(input=>window.omniEdu.reviewPaper(input),{schemaVersion:'xiaozhi.paper-blueprint.v1',id,sessionId});
 assert(cold.ok&&cold.value.sourceCurrent&&cold.value.state==='confirmed');
 for(const row of applied)assert((await readSource(await question(row.question_id))).ok);
 assert.deepEqual(audits(),applied);assert.deepEqual(receipts(),frozen);assert.equal(calls(),previousCalls);
 assert.deepEqual(nativeAudits(),previousNative);
 report.checks.push('Cold file/source/paper reads retain model receipts, earlier Word audits and provider counts');
 const owned=fs.realpathSync(source.local_path),relative=path.relative(data,owned);
 assert(relative&&!path.isAbsolute(relative)&&!relative.split(path.sep).includes('..'));
 const bytes=fs.readFileSync(owned),altered=Buffer.from(bytes);
 assert(bytes.length>0);altered[altered.length-1]^=1;
 const auditQuestion=await question(applied[0].question_id);
 try{
  fs.writeFileSync(owned,altered);
  await assert.rejects(pageRead,/source_changed/);
  assert.deepEqual(await readSource(auditQuestion),{ok:false,error:'source_changed'});
  await assert.rejects(act,/source_changed/);
  assert.deepEqual(audits(),applied);assert.deepEqual(receipts(),frozen);
 }finally{fs.writeFileSync(owned,bytes);}
 assert((await pageRead()).inputImage);
 assert((await readSource(auditQuestion)).ok);
 report.checks.push('Same-size original-byte change blocks page, source and recheck; restoring exact bytes safely restores reads');
 await close();
 assert.equal(report.requests,0);assert.deepEqual(report.rendererErrors,[]);
 report.ok=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{
 await close();fs.writeFileSync(path.join(destination,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
