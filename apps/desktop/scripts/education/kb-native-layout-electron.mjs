import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';

const seed=fs.realpathSync(process.argv[2]);
const destination=fs.mkdtempSync(path.join(os.tmpdir(),'edudev-native-layout-'));
const data=path.join(destination,'data');
fs.mkdirSync(data);
for(const name of ['teacher_resources','question-ai-assets','question-assets','material-ai-images','word-assets']){
 const source=path.join(seed,name);if(fs.existsSync(source))fs.cpSync(source,path.join(data,name),{recursive:true});
}
const file=path.join(data,'app.db');
const original=new DatabaseSync(path.join(seed,'app.db'),{readOnly:true});
try{original.exec("VACUUM INTO '"+file.replaceAll("'","''")+"'");}finally{original.close();}
const {relocateBackupDatabase}=await import('../../src/main/backup/restore-database.ts');
await relocateBackupDatabase(file,seed,data,path.join(path.dirname(seed),'XiaozhiOutputs'),path.join(destination,'XiaozhiOutputs'));
const {indexWordQuestions}=await import('../../src/main/assets/word-question-source.ts');
const {nativeLayoutProof}=await import('../../src/main/assets/material-ai-native-layout-proof.ts');
const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');
const {compilePaperOffice}=await import('../../src/main/education/paper-export.ts');
function read(sql,params=[]){
 const db=new DatabaseSync(file,{readOnly:true,timeout:3000});
 try{return db.prepare(sql).all(...params);}finally{db.close();}
}
const selected=read(`SELECT q.id,b.resource_id,b.id batch_id,u.ordinal,i.source_json,u.first_json,u.final_json,
 d.document_json,r.title FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id
 JOIN material_ai_units u USING(batch_id,ordinal) JOIN material_ai_native_inputs i USING(batch_id,ordinal)
 JOIN material_ai_batches b ON b.id=m.batch_id JOIN material_word_documents d ON d.resource_id=b.resource_id AND d.version=b.version
 JOIN teacher_resources r ON r.id=b.resource_id WHERE u.status='review'
 AND json_extract(q.archive_json,'$.state')='ai_needs_review' AND json_extract(q.archive_json,'$.issues')='["incomplete_question"]'
 ORDER BY b.id,u.ordinal`).flatMap(row=>{
 const source=JSON.parse(row.source_json),document=JSON.parse(row.document_json);
 if(document.questionPolicy!=='word-question-preamble.v5'||!source.issues.includes('shared_context'))return [];
 let current;try{current=indexWordQuestions(document).read(source.ordinal);}catch{return [];}
 if(current.issues.length)return [];
 const proof=nativeLayoutProof(source,current,JSON.parse(row.first_json).questions[0],JSON.parse(row.final_json).questions[0]);
 return [{id:row.id,resourceId:row.resource_id,batchId:row.batch_id,ordinal:row.ordinal,title:row.title,proof}];
});
assert.equal(selected.length,7);
const safe=selected.filter(row=>row.proof),held=selected.filter(row=>!row.proof);
assert.equal(safe.length,2);
const canonical=()=>selected.map(row=>read('SELECT * FROM question_bank_items WHERE id=?',[row.id])[0]);
const model=()=>selected.map(row=>read('SELECT input_json,first_json,final_json,image_sha FROM material_ai_units WHERE batch_id=? AND ordinal=?',[row.batchId,row.ordinal])[0]);
const before=canonical(),modelBefore=model(),calls=()=>read('SELECT sum(calls) n FROM material_ai_batches')[0].n;
const callsBefore=calls();
const entry=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','main/index.js');
const report={destination,buildSha256:createHash('sha256').update(fs.readFileSync(entry)).digest('hex'),
 recovered:0,held:0,sourceReads:0,searchHits:0,selectedInPapers:0,newRequests:0,rendererErrors:[]};
let app,page;
async function launch(){
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve('../..'),OMNI_EDU_E2E_VISIBLE:'0',OMNI_EDU_SKIP_DOTENV:'1'};
 for(const name of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY'])delete env[name];
 app=await _electron.launch({args:[entry,'--user-data-dir='+path.join(destination,'profile')],env,cwd:destination,timeout:90000});
 await app.evaluate(({net})=>{globalThis.layoutProviderAttempts=0;net.fetch=globalThis.fetch=async()=>{
   globalThis.layoutProviderAttempts++;throw Error('Saved layout recovery has no cloud access');
 };});
 page=await app.firstWindow();
 page.setDefaultTimeout(30000);
 page.on('pageerror',e=>report.rendererErrors.push(e.message));
}
async function close(){
 if(!app)return;
 report.newRequests+=await app.evaluate(()=>globalThis.layoutProviderAttempts);
 await app.close();app=undefined;
}
const action=batchId=>page.evaluate(batchId=>window.omniEdu.controlMaterialAiBatch({schemaVersion:'xiaozhi.material-ai.v1',batchId,action:'recheck_source_layout'}),batchId);
const archiveFor=id=>JSON.parse(read('SELECT archive_json FROM question_bank_items WHERE id=?',[id])[0].archive_json);
const getQuestion=id=>page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),id);
const sourceFor=q=>({schemaVersion:'xiaozhi.education.question-context.v1',questionId:q.id,version:questionVersion(q)});
async function readSource(q){return page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),sourceFor(q));}

try{
 await launch();
 const example=safe[0];
 await productEntry(page,'materials').click();
 await page.getByTestId('materials-search').fill(example.title);
 await page.getByTestId('material-'+example.resourceId).getByRole('button').click();
 await page.getByTestId('materials-section-questions').click();
 const panel=page.getByTestId('material-ai-panel');
 await openMaterialDisclosure(panel);
 const batch=panel.locator(`[data-batch-id="${example.batchId}"]`);
 for(let pageIndex=0;pageIndex<15&&!await batch.isVisible();pageIndex++){
  const next=panel.getByRole('button',{name:'后10个批次',exact:true});
  if(!await next.isVisible()||await next.isDisabled())break;
  await next.click();
  await page.waitForTimeout(350);
 }
 const started=performance.now();
 await batch.getByTestId('material-ai-recheck-source-layout').click();
 await batch.getByText('已本地复核1道题的来源版式。').waitFor();
 report.firstRecoveryMs=Math.round(performance.now()-started);
 for(const batchId of new Set(selected.map(row=>row.batchId)))await action(batchId);
 const audit=()=>read('SELECT * FROM material_ai_native_layout_rechecks ORDER BY question_id');
 const applied=audit();
 assert.deepEqual(applied.map(row=>row.question_id),safe.map(row=>row.id).sort());
 for(const [index,row] of canonical().entries()){
  const old=before[index];
  assert.deepEqual({...row,archive_json:old.archive_json},{...old});
  if(held.some(candidate=>candidate.id===row.id))assert.deepEqual(row,old);
 }
 report.recovered=applied.length;report.held=held.length;
 for(const batchId of new Set(safe.map(row=>row.batchId)))await action(batchId);
 assert.deepEqual(audit(),applied);

 const session=(await page.evaluate(()=>window.omniEdu.createAiConversationSession({title:'旧 Word 原题来源复核验证'}))).session.id;
 for(const row of safe){
  const q=await getQuestion(row.id);
  const archive=archiveFor(row.id);
  assert.equal(archive.state,'ai_final');
  assert(archive.nativeLayout);
  const evidence=await readSource(q);assert(evidence.ok,JSON.stringify(evidence));report.sourceReads++;
  const matches=await page.evaluate(filters=>window.omniEdu.searchQuestionBank(filters),
   {query:q.knowledgePoint,subject:q.subject,grade:q.grade,knowledgePoint:q.knowledgePoint,questionType:'选择题',limit:10});
  assert(matches.some(item=>item.id===q.id));report.searchHits++;
  const query={schemaVersion:'xiaozhi.native-question-image.v1',questionId:q.id,version:questionVersion(q)};
  const image=await page.evaluate(input=>window.omniEdu.getNativeQuestionImage({...input,role:'question',index:0}),query);
  assert.equal(createHash('sha256').update(Buffer.from(image.dataUrl.split(',')[1],'base64')).digest('hex'),archive.native.roles.question.figures[0].sha256);
  const input={schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:session,requestId:randomUUID(),blueprint:{
   title:'原题恢复练习 '+q.knowledgePoint,subject:q.subject,grade:q.grade,durationMinutes:10,totalPoints:5,mode:'source_only',
   sections:[{id:'choice',label:'选择题',questionType:'选择题',count:1,points:5,knowledgePoint:q.knowledgePoint,difficulty:q.difficulty}],
  }};
  const paper=await page.evaluate(input=>window.omniEdu.createPaper(input),input);
  assert(paper.ok,JSON.stringify(paper));assert.equal(paper.value.selection.items[0]?.question.id,q.id);
  const confirmed=await page.evaluate(({id,sessionId,revision})=>window.omniEdu.decidePaper({
   schemaVersion:'xiaozhi.paper-blueprint.v1',id,sessionId,revision,action:'confirm',
  }),paper.value);
  assert(confirmed.ok,JSON.stringify(confirmed));
  const student=compilePaperOffice(confirmed.value,'student');
  const expectedStem=q.stem.split('\n')[0].replace(new RegExp('^'+archive.number+'[.．、)）]\\s*'),'');
  assert(student.sections.some(section=>section.paragraphs.some(text=>text.startsWith(expectedStem))));
  assert(!student.sections.some(section=>section.figures?.length));
  assert(!student.sections.some(section=>section.paragraphs.some(text=>text.includes('参考答案：'))));
  report.selectedInPapers++;
 }
 await close();await launch();
 for(const row of safe)assert((await readSource(await getQuestion(row.id))).ok);
 assert.deepEqual(audit(),applied);
 assert.deepEqual(model(),modelBefore);assert.equal(calls(),callsBefore);
 const db=new DatabaseSync(file,{timeout:3000});
 try{
  const sample=applied[0];
  db.prepare('UPDATE material_ai_native_layout_rechecks SET source_sha=? WHERE question_id=?').run('0'.repeat(64),sample.question_id);
  try{assert.equal((await readSource(await getQuestion(sample.question_id))).ok,false);}
  finally{db.prepare('UPDATE material_ai_native_layout_rechecks SET source_sha=? WHERE question_id=?').run(sample.source_sha,sample.question_id);}
 }finally{db.close();}
 assert.deepEqual(audit(),applied);
 await close();assert.equal(report.newRequests,0);assert.deepEqual(report.rendererErrors,[]);
 report.ok=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{
 await close();
 fs.writeFileSync(path.join(destination,'report.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
