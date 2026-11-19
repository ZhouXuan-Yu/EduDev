import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash, randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {productEntry} from '../product-navigation.mjs';
import {openMaterialDisclosure} from './material-disclosure-ui.mjs';
const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');

const desktop=process.cwd();
const seed=fs.realpathSync(process.argv[2]);
const seedReport=JSON.parse(fs.readFileSync(path.join(seed,'summary.json')));
assert(seedReport.success&&seedReport.checks.some(x=>x.includes('four labeled original crops')));
const output=fs.mkdtempSync(path.resolve('test-results','reviewed-answer-ui-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
const entry=path.resolve(process.env.OMNI_EDU_TEST_BUILD_ROOT||'out','main/index.js');
const sha=v=>createHash('sha256').update(v).digest('hex');
const report={checks:[],rendererErrors:[],buildSha256:sha(fs.readFileSync(entry)),paidRequests:0};
fs.cpSync(path.join(seed,'data'),data,{recursive:true});
const database=path.join(data,'app.db');
const seedDb=new DatabaseSync(database);
for(const {id,local_path,content_hash} of seedDb.prepare('SELECT id,local_path,content_hash FROM teacher_resources').all()){
 const owned=path.join(data,'teacher_resources',path.basename(local_path));
 assert.equal(sha(fs.readFileSync(owned)),content_hash);
 seedDb.prepare('UPDATE teacher_resources SET local_path=? WHERE id=?').run(owned,id);
}
seedDb.close();
console.log('OUTPUT '+output);
function read(sql,args=[]){
 const db=new DatabaseSync(database,{readOnly:true});
 try{return db.prepare(sql).all(...args);}finally{db.close();}
}
const exam='图形选项跨页练习.pdf',circuit='可核对的物理电路.pdf';
const resource=name=>read('SELECT * FROM teacher_resources WHERE original_file_name=?',[name])[0];
const question=(name,number)=>read("SELECT * FROM question_bank_items WHERE source_title=? AND json_extract(archive_json,'$.number')=?",[name,number])[0];
const candidates=(name,number)=>read("SELECT q.body_json FROM material_structure_jobs j JOIN material_structure_questions q ON q.generation=j.generation WHERE j.resource_id=? AND json_extract(q.body_json,'$.number')=?",[resource(name).id,number]).map(r=>JSON.parse(r.body_json));
const originalHashes=()=>read('SELECT id,local_path FROM teacher_resources ORDER BY id').map(r=>[r.id,sha(fs.readFileSync(r.local_path))]);
const originals=originalHashes();
const textOptions=stem=>stem.split('\n').slice(1).join('\n');
const answer='B',analysis='阴极射线由电子组成，因此选择 B。';
const check=name=>{report.checks.push(name);console.log('PASS '+name);};
let app,page;
async function until(action,timeout=110000){
 const end=Date.now()+timeout;
 while(Date.now()<end){const result=await action();if(result)return result;await new Promise(resolve=>setTimeout(resolve,250));}
 throw Error('Timed out waiting for current teacher or Pi state');
}
async function launch(cold=false){
 const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_DATA_ROOT:data,
  OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'0',
  DEEPSEEK_API_KEY:'synthetic-local-only',DEEPSEEK_MODEL:'deepseek-flash'};
 for(const key of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[key];
 app=await _electron.launch({args:[entry,'--user-data-dir='+profile],cwd:desktop,env,timeout:90000});
 await app.evaluate(({app,session,net},{cold,answer,analysis})=>{
  const state=globalThis.reviewedAnswerTest={requests:[],reads:[],failures:[],mode:'none',step:0,blocked:0,browserHits:0};
  const origin='https://fixture.invalid';
  const configured=new Set();
  app.on('web-contents-created',(_event,wc)=>{
   if(wc.session===session.defaultSession||wc.getLastWebPreferences().preload||configured.has(wc.session))return;
   configured.add(wc.session);
   wc.session.protocol.handle('https',request=>{
    if(new URL(request.url).origin!==origin||cold){state.blocked++;return new Response('Unavailable',{status:403});}
    state.browserHits++;
    const escaped=state.stem.replaceAll('&','&amp;').replaceAll('<','&lt;').replaceAll('>','&gt;');
    return new Response('<!doctype html><meta charset="utf-8"><title>本机受控题解</title><article><h1>题目</h1><p>'+escaped+'</p><p>答案：'+answer+'</p><p>解析：'+analysis+'</p></article>',{headers:{'content-type':'text/html; charset=utf-8'}});
   });
  });
  const transport=async(input,init)=>{
   const url=typeof input==='string'?input:input.url;
   if(url?.includes('/models')&&!cold)return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768,input_modalities:['text']}]}),{headers:{'content-type':'application/json'}});
   if(cold||!url?.includes('/chat/completions')){state.blocked++;throw Error('External or restart-time model call is forbidden');}
   const body=JSON.parse(init.body),n=state.step++;
   const raw=body.messages.filter(m=>m.role==='tool').at(-1)?.content;
   const text=typeof raw==='string'?raw:(raw||[]).filter(p=>p.type==='text').map(p=>p.text).join('\n');
   let receipt;try{receipt=JSON.parse(text.split('\n')[0]);}catch{}
   const must=(value,message)=>{if(!value){const summaries=text.split('\n').flatMap(line=>{try{const data=JSON.parse(line);return [{code:data.code,reason:data.reason,scope:data.scope}];}catch{return []}});state.failures.push({n,message,summaries});throw Error(message);}};
   let action,content;
   const call=(name,args)=>{action={name,arguments:JSON.stringify(args)};};
   if(n===0)call('find_education_tools',{query:'education_search_questions education_read_question education_web_answer office_browser 检索题目 联网补答案'});
   else if(n===1)call('education_search_questions',{query:state.query,limit:1,...(state.mode==='ordinary'?{}:{purpose:'answer_enrichment'})});
   else if(n===2){
    must(receipt?.questions?.length===1,'Actual question discovery required');
    const q=receipt.questions[0];state.binding={reference:q.reference,version:q.version};
    call('education_read_question',{...state.binding,...(state.mode==='ordinary'?{}:{purpose:'answer_enrichment'})});
   }else if(n===3){
    must(receipt?.success&&receipt.teacherConfirmationKnown&&receipt.contextComplete&&receipt.originalImagesIncluded===false,'Authenticated teacher transcription required');
    must(receipt.question.stem===state.stem,'Wrong question source');
    if(state.mode==='ordinary')must(receipt.question.answerOrigin==='web_extracted'&&receipt.question.answer===answer,'Authenticated web answer required');
    else must(receipt.missingRoles?.includes('answer')&&receipt.writebackAuthorized===false,'Protected missing roles required');
    state.reads.push({mode:state.mode,version:receipt.version,number:receipt.question.originalNumber,contextComplete:receipt.contextComplete});
    if(state.mode==='web')call('education_web_answer',{action:'authorize',questions:[state.binding],origins:[origin]});
    else content='已实读教师核对过的原题。';
   }else if(state.mode==='web'&&n===4){
    must(typeof receipt?.grantId==='string','Teacher grant required before visiting');
    state.grantId=receipt.grantId;
    const system=body.messages.filter(m=>m.role==='system').map(m=>m.content).join('\n');
    const line=system.split('\n').findLast(l=>l.startsWith('{"schemaVersion":"xiaozhi.task-plan.v3"'));
    const task=line?JSON.parse(line):{requirementsVersion:Number([...system.matchAll(/"requirementsVersion":(\d+)/g)].at(-1)?.[1]||1),revision:0};
    call('update_task_plan',{schemaVersion:'xiaozhi.task-plan.v3',requirementsVersion:task.requirementsVersion,expectedRevision:task.revision,
     reason:'在教师授权范围内从受控页面核对并补齐缺答',steps:[
      {id:'web',kind:'web',target:origin+'/',text:'读取受控题解页面',reported:'pending',dependsOn:[]},
      {id:'save',kind:'saved_questions',target:'current',text:'保存唯一匹配的缺答内容',reported:'pending',dependsOn:['web']},
      {id:'review',kind:'human',text:'教师最后核对',reported:'pending',dependsOn:['save']},
     ]});
   }else if(state.mode==='web'&&n===5){
    call('office_browser',{action:'navigate',url:origin+'/',newTab:true,taskStepId:'web'});
   }else if(state.mode==='web'&&n===6){
    must(typeof receipt?.tabId==='string','A genuine isolated browser tab is required');
    call('office_browser',{action:'extract',tabId:receipt.tabId,taskStepId:'web'});
   }else if(state.mode==='web'&&n===7){
    must(typeof receipt?.observationId==='string'&&receipt.extraction?.method==='readability','A real browser DOM receipt is required');
    call('education_web_answer',{action:'propose',grantId:state.grantId,observationId:receipt.observationId,...state.binding,
     questionQuote:state.stem,answerQuote:answer,analysisQuote:analysis,taskStepId:'save'});
   }else if(state.mode==='web'&&n===8){
    must(receipt?.state==='applied'&&receipt.readback?.success,'Actual web write and source readback required');
    state.applied=true;
    content='该原题的缺答已按受控页面证据补齐，来源已保存。';
   }else must(false,'Unexpected model request');
   state.requests.push({mode:state.mode,n,tool:action?.name??null});
   const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'reviewed-'+state.mode+'-'+n,object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
   return new Response(chunk({role:'assistant',content:''})+chunk(action?{tool_calls:[{index:0,id:'reviewed-'+state.mode+'-'+n,type:'function',function:action}]}:{content})+chunk({},action?'tool_calls':'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
  net.fetch=transport;
  globalThis.fetch=transport;
 },{cold,answer,analysis});
 page=await app.firstWindow();
 page.setDefaultTimeout(45000);
 page.on('pageerror',error=>report.rendererErrors.push(error.message));
}
async function notebook(row,filter=row.stem.slice(0,20)){
 await productEntry(page,'teaching').click();
 await page.getByRole('button',{name:'题本',exact:true}).filter({visible:true}).click();
 await page.getByTestId('question-notebook-search').fill(filter);
 const card=page.getByTestId('question-notebook-card-'+row.id);
 await card.waitFor();
 return card;
}
async function confirmOriginal(){
 const source=resource(exam),[item]=candidates(exam,'1');
 assert(item.status==='needs_review'&&item.options.length===4&&!item.assets.length);
 await productEntry(page,'materials').click();
 await page.getByTestId('materials-search').fill(exam.replace(/\.pdf$/u,''));
 await page.getByTestId('materials-refresh').click();
 await page.getByTestId('material-'+source.id).getByRole('button').click();
 await page.getByRole('button',{name:'题目与校正',exact:true}).click();
 const panel=page.getByTestId('material-structure-panel');
 await openMaterialDisclosure(panel);
 const review=panel.getByTestId('structure-review-'+item.id);
 await review.getByTestId('structure-review-open').click();
 for(const [key,value] of Object.entries({subject:'物理',grade:'高一',knowledgePoint:'阴极射线',questionType:'单选题'}))
  await review.getByTestId('structure-review-'+key).fill(value);
 await review.getByTestId('structure-review-difficulty').selectOption('easy');
 await review.getByTestId('structure-review-checked').check();
 await review.getByTestId('structure-review-save').click();
 await panel.getByTestId('structure-reviewed-'+item.id).waitFor();
 return question(exam,'1');
}
async function editArchive(q,updates={}){
 const card=await notebook(q);
 await card.getByTestId('question-archive-edit-'+q.id).click();
 for(const [key,value] of Object.entries(updates))await card.getByTestId('question-archive-'+key).fill(value);
 await card.getByTestId('question-archive-difficulty').selectOption('medium');
 await card.getByTestId('question-archive-source-checked').check();
 await card.getByTestId('question-archive-save').click();
 await card.getByTestId('question-archive-form').waitFor({state:'hidden'});
 return read('SELECT * FROM question_bank_items WHERE id=?',[q.id])[0];
}
function projection(stem,formulas=''){
 const result=Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions'].map(k=>[k,{state:'not_applicable',text:''}]));
 for(const [name,text] of Object.entries({statement:stem,choices:textOptions(stem),formulas}))if(text)result[name]={state:'provided',text};
 return result;
}
async function typed(q){
 const full=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),q.id);
 return {schemaVersion:'xiaozhi.education.question-context.v1',questionId:q.id,version:questionVersion(full)};
}
async function complete(q,p){
 const card=await notebook(q);
 await card.getByTestId('question-original-open').click();
 await card.getByTestId('question-original-image').first().evaluate(img=>img.decode());
 await card.getByTestId('question-context-open').click();
 for(const [key,part] of Object.entries(p)){
  if(part.text)await card.getByTestId('projection-'+key+'-text').fill(part.text);
  await card.getByTestId('projection-'+key+'-state').selectOption(part.state);
 }
 const checkbox=card.getByTestId('question-context-complete');
 await checkbox.locator('[data-slot=checkbox-content]').click();
 assert(await checkbox.getByRole('checkbox').isChecked());
 await card.getByTestId('question-context-save').click();
 await until(()=>{
  const current=read('SELECT * FROM question_bank_items WHERE id=?',[q.id])[0];
  if(JSON.parse(current.document_json).schemaVersion==='xiaozhi.question-document.v2')return current;
 },30000);
 await card.getByTestId('question-context-save').waitFor({state:'hidden'});
 const current=read('SELECT * FROM question_bank_items WHERE id=?',[q.id])[0];
 assert.deepEqual(JSON.parse(current.document_json).context.projection,p);
 return current;
}
async function run(mode,query,stem){
 await productEntry(page,'ask').click();
 await page.getByTestId('xiaozhi-pi-workspace').waitFor();
 const prior=await page.locator('.office-composer-container').getAttribute('data-session-id');
 await page.getByTestId('pi-new-session').click();
 const sessionId=await until(async()=>{const now=await page.locator('.office-composer-container').getAttribute('data-session-id');return now&&now!==prior&&now;});
 await app.evaluate((_,values)=>Object.assign(globalThis.reviewedAnswerTest,values),{mode,query,stem,step:0});
 await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled());
 const prev=read('SELECT id FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1')[0]?.id;
 await page.getByTestId('office-prompt-input').fill(mode==='web'?'检索并实读本地缺答题，访问本机受控页面测试题解补全。':'请检索并实读本地题库的已核对原题。');
 await page.getByRole('button',{name:'发送消息',exact:true}).click();
 await until(async()=>{
  const snapshot=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
  const pending=snapshot?.controls?.find(c=>c.kind==='question'&&c.state==='pending');
  if(pending){
   assert(mode==='web'&&pending.text.includes('fixture.invalid'));
   await page.getByText('同意这次操作',{exact:true}).click();
   await page.getByTestId('pi-question-submit').click();
  }
  const current=read('SELECT id,status FROM ai_agent_runs ORDER BY rowid DESC LIMIT 1')[0];
  if(current?.id!==prev&&['succeeded','failed','interrupted','blocked','cancelled','partial'].includes(current?.status)){
   assert.equal(current.status,'succeeded');
   return true;
  }
  return false;
 },90000);
 const wire=await app.evaluate(()=>globalThis.reviewedAnswerTest);
 assert.equal(wire.failures.length,0);
 assert.equal(wire.reads.at(-1)?.mode,mode);
 return wire;
}
try{
 await launch();
 let a=await confirmOriginal();
 let b=question(circuit,'10');
 const graphic=question(exam,'13');
 assert(a&&b&&graphic);
 b=await editArchive(b,{stem:b.stem.replaceAll('α','a')});
 const oldA=await typed(a);
 a=await complete(a,projection(a.stem.replace('（)','（）')));
 b=await complete(b,projection(b.stem,'R1 < R2 < R3 < R4'));
 assert.notEqual((await typed(a)).version,oldA.version);
 const stale=await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),oldA);
 assert.equal(stale.ok,false);
 const oldGraph=await typed(graphic);
 const graphProjection=projection(graphic.stem);
 graphProjection.choices={state:'provided',text:'A. 选项图\nB. 选项图\nC. 选项图\nD. 选项图'};
 const blocked=await page.evaluate(input=>window.omniEdu.completeOriginalQuestionContext(input),{
  schemaVersion:'xiaozhi.question-context-edit.v1',questionId:graphic.id,version:oldGraph.version,
  requestId:'xicontext_'+randomUUID(),projection:graphProjection,complete:true,
 });
 assert.deepEqual(blocked,{ok:false,error:'invalid_input'});
 assert.deepEqual(await typed(graphic),oldGraph);
 check('Teacher completes authentic text on two natural sources; stale references and missing figure coverage are rejected');
 await run('enrichment','串联电路的电流变化范围',b.stem);
 check('Production Pi discovers and reads a previously inaccessible verified source in the missing-answer lane');
 const wire=await run('web','阴极射线',a.stem);
 assert(wire.applied&&wire.browserHits>0);
 a=question(exam,'1');
 assert.equal(a.answer,answer);
 assert.equal(a.analysis,analysis);
 assert.equal(JSON.parse(a.archive_json).structureReview.schemaVersion,'xiaozhi.structure-review.v1');
 assert.equal(JSON.parse(a.document_json).answer.origin,'web_extracted');
 check('Teacher-authorized local DOM fills only the missing roles and retains original proof');
 await run('ordinary','阴极射线',a.stem);
 check('The answered original is found and authenticated in ordinary Pi search');
 const version=await typed(a);
 b=await editArchive(b,{stem:b.stem+'（请重新核对。）'});
 assert.equal(JSON.parse(b.document_json).schemaVersion,'xiaozhi.question-document.v1');
 check('An ordinary statement edit revokes the old complete-transcription authority');
 const frozen=question(exam,'1');
 await app.close();app=undefined;
 await launch(true);
 const restored=await page.evaluate(input=>window.omniEdu.getQuestionContextSource(input),version);
 assert(restored.ok);
 assert.equal(restored.value.question.answer,answer);
 assert.deepEqual(question(exam,'1'),frozen);
 assert.deepEqual(originalHashes(),originals);
 assert.equal(read('PRAGMA integrity_check')[0].integrity_check,'ok');
 assert.deepEqual(report.rendererErrors,[]);
 check('Cold source readback preserves both proof layers and the original file hashes');
 report.success=true;
}catch(error){
 report.success=false;
 report.error=String(error.stack||error);process.exitCode=1;
 if(app)report.diagnostics=await app.evaluate(()=>{const s=globalThis.reviewedAnswerTest;return s&&{requests:s.requests,failures:s.failures,browserHits:s.browserHits,blocked:s.blocked};}).catch(()=>undefined);
 if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
}finally{
 await app?.close();
 fs.writeFileSync(path.join(output,'summary.json'),JSON.stringify(report,null,2));
 console.log(JSON.stringify(report));
}
