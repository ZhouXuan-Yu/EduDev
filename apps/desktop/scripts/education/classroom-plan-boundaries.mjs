import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {pathToFileURL} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {build} from 'esbuild';

// Isolated domain bundle only. Does not touch application out or call a provider.
const output=fs.mkdtempSync(path.resolve('test-results/classroom-plan-domain-'));
const entry=path.join(output,'domain.mjs');
await build({stdin:{contents:`export * from './src/shared/classroom-plan';
export {createClassroomPlanState} from './src/main/education/classroom-plan-state';
export {createClassroomState} from './src/main/education/classroom-state';
export {materialBodyVersion} from './src/main/assets/material-source';
export {validXiaozhiStart} from './src/shared/xiaozhi-start';
export {createClassroomPlanTools} from './src/main/education/classroom-plan-tools';
export {registerClassroomIpc} from './src/main/education/classroom-api';`,resolveDir:process.cwd()},bundle:true,platform:'node',format:'esm',external:['@openmaic/generation'],outfile:entry});
const domain=await import(pathToFileURL(entry));
const {createClassroomPlanState,createClassroomState,materialBodyVersion,CLASSROOM_PLAN_SCHEMA,validClassroomPlanDocument,validClassroomPlanStart,validXiaozhiStart}=domain;
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,student_id TEXT,archived_at TEXT);
CREATE TABLE students(id TEXT,status TEXT);
CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,status TEXT);
CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,student_id TEXT,action_type TEXT,status TEXT,title TEXT,payload_json TEXT,result_json TEXT DEFAULT '{}',created_at TEXT,updated_at TEXT,confirmed_at TEXT,rejected_at TEXT);
CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT,parse_status TEXT);
CREATE TABLE resource_chunks(id TEXT PRIMARY KEY,resource_id TEXT,chunk_index INTEGER,content_md TEXT,contains_personal_data INTEGER,page_number INTEGER);
CREATE TABLE learning_records(id TEXT);`);
const session='aisession_11111111-1111-4111-8111-111111111111';
db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,?,NULL)').run(session,'');
for(const run of ['outline','generate','resume'])db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?)').run(run,session,'running');
const resourceId='resource_11111111-1111-4111-8111-111111111111',chunkId='chunk_22222222-2222-4222-8222-222222222222',body='空气中测力计读数3 N，浸没后2 N，浮力为1 N。';
db.prepare('INSERT INTO teacher_resources VALUES(?,?,?)').run(resourceId,'a'.repeat(64),'ready');
db.prepare('INSERT INTO resource_chunks VALUES(?,?,?,?,?,?)').run(chunkId,resourceId,0,body,0,1);
const context={schemaVersion:'xiaozhi.classroom-context.v1',preferenceRevision:0,materials:[{source:{schemaVersion:'xiaozhi.material-source.v1',resourceId,version:'a'.repeat(64),offset:0,chunkId,bodyVersion:materialBodyVersion({id:chunkId,chunkIndex:0,contentMd:body,containsPersonalData:false,pageNumber:1})},title:'合成浮力资料',characters:body.length,truncated:false,recognition:'saved_text'}]};
const sql={all:async(q,v=[])=>db.prepare(q).all(...v),run:async(q,v=[])=>db.prepare(q).run(...v)};
sql.transaction=async action=>{db.exec('BEGIN IMMEDIATE');try{const result=await action(sql);db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}};
const plan=createClassroomPlanState(sql),classrooms=createClassroomState(sql),checks=[];
const check=name=>checks.push({name,pass:true});
const document={schemaVersion:CLASSROOM_PLAN_SCHEMA,title:'浮力课堂',totalMinutes:40,objectives:['根据示数变化计算浮力，区分受到浮力与上浮。'],scenes:[
 {sceneId:'intro',type:'slide',title:'观察示数',activity:'测量空气中3 N与浸没后2 N的示数。',durationMinutes:10},
 {sceneId:'explain',type:'slide',title:'解释浮力',activity:'明确F浮=G-F示，大小为1 N。',durationMinutes:20},
 {sceneId:'check',type:'quiz',title:'理解检查',activity:'选择并解释：受浮力是否必然上浮。',durationMinutes:10}
]};
assert(validClassroomPlanDocument(document));
assert(!validClassroomPlanDocument({...document,scenes:[...document.scenes,{...document.scenes[0]}]}));
assert(!validClassroomPlanDocument({...document,scenes:document.scenes.map(s=>({...s,durationMinutes:0}))}));
assert(!validClassroomPlanStart({mode:'generate',id:'bad',version:'a'.repeat(64)}));
assert(!validClassroomPlanStart({mode:'outline',id:'extra'}));
check('Strict outline schema, stable unique scene ids, positive durations and typed start union');
const draft=await plan.propose(session,'outline','proposal',document,context,()=>true);
assert.equal(draft.status,'draft');
assert.deepEqual(await plan.propose(session,'outline','proposal',document,context,()=>true),draft);
await assert.rejects(()=>plan.propose(session,'outline','proposal',{...document,title:'different'},context,()=>true),/conflict/);
await assert.rejects(()=>plan.propose(session,'outline','empty',document,{...context,materials:[]},()=>true),/source_required/);
const bind=()=>({mode:'generate',id:draft.id,version:draft.version});
await assert.rejects(()=>plan.begin(session,'generate',bind(),()=>true),/not_confirmed/);
check('Host-owned nonempty sources, idempotent proposal and unconfirmed generation blocked');
const confirmed=await plan.decide({id:draft.id,version:draft.version,decision:'confirm'});
assert.equal(confirmed.status,'confirmed');
await plan.begin(session,'generate',bind(),()=>true);
await assert.rejects(()=>plan.edit({id:draft.id,version:draft.version,document:{...document,title:'while running'}}),/conflict/);
const {generateSceneContent,buildCompleteScene}=await import('@openmaic/generation');
async function scene(page){
 const outline={id:page.sceneId,type:page.type,title:page.title,description:page.activity,keyPoints:[],order:document.scenes.indexOf(page)};
 const raw=page.type==='slide'?{elements:[{id:'text',type:'text',left:40,top:50,width:800,height:200,content:'<p>F浮 = 3 N − 2 N = 1 N</p>',defaultFontName:'Microsoft YaHei',defaultColor:'#222',rotate:0}],background:{type:'solid',color:'#fff'}}:[{id:'q',type:'single',question:'物体受到浮力就一定上浮吗？',options:[{value:'A',label:'一定'},{value:'B',label:'不一定'}],answer:['B'],analysis:'是否上浮取决于浮力与重力等力的比较。'}];
 const content=await generateSceneContent(outline,async()=>JSON.stringify(raw));
 return buildCompleteScene(outline,content,[],session,{sceneId:page.sceneId});
}
const scenes=await Promise.all(document.scenes.map(scene));
await plan.checkpoint(session,'generate',bind(),'intro',scenes[0],()=>true);
await plan.checkpoint(session,'generate',bind(),'intro',scenes[0],()=>true);
const changed=structuredClone(scenes[0]);changed.content.canvas.elements[0].content='<p>不同内容</p>';
await assert.rejects(()=>plan.checkpoint(session,'generate',bind(),'intro',changed,()=>true),/conflict/);
await assert.rejects(()=>plan.complete(session,'generate',bind(),()=>true),/incomplete/);
await plan.finishRun('generate');
assert.equal((await plan.read(draft.id)).status,'interrupted');
check('Per-page validated checkpoint, duplicate-safe and incomplete finalization blocked; stop preserves success');
const cold=createClassroomPlanState(sql);await cold.recover();
const before=await cold.read(draft.id);assert.equal(before.checkpoints.length,1);
assert.equal(db.prepare('SELECT count(*) n FROM ai_agent_runs').get().n,3);
await assert.rejects(()=>cold.checkpoint(session,'generate',bind(),'explain',scenes[1],()=>true),/conflict/);
await cold.begin(session,'resume',bind(),()=>true);
await assert.rejects(()=>cold.checkpoint(session,'generate',bind(),'explain',scenes[1],()=>true),/conflict/);
await cold.checkpoint(session,'resume',bind(),'explain',scenes[1],()=>true);
await cold.checkpoint(session,'resume',bind(),'check',scenes[2],()=>true);
const ready=await cold.complete(session,'resume',bind(),()=>true);
assert.equal(ready.status,'ready');assert.equal(ready.checkpoints.length,3);
assert.deepEqual(await cold.complete(session,'resume',bind(),()=>true),ready);
const candidate=await classrooms.read(ready.classroomId);assert.equal(candidate.status,'pending');
assert.equal(candidate.document.scenes.length,3);
check('Cold recovery does not replay; explicit resume fences old run; all pages yield only a pending classroom');
const approved=await classrooms.decide({id:candidate.id,version:candidate.version,decision:'confirm'});
assert.equal((await classrooms.readConfirmed(session,approved.id,approved.version)).status,'confirmed');
db.prepare('UPDATE resource_chunks SET contains_personal_data=1 WHERE id=?').run(chunkId);
await assert.rejects(()=>classrooms.readConfirmed(session,approved.id,approved.version),/source_changed/);
db.prepare('UPDATE resource_chunks SET contains_personal_data=0 WHERE id=?').run(chunkId);
const revised=await cold.edit({id:draft.id,version:draft.version,document:{...document,title:'教师新版本'}});
assert.equal(revised.status,'draft');assert.notEqual(revised.version,draft.version);
assert.deepEqual(revised.document.scenes.map(s=>s.sceneId),document.scenes.map(s=>s.sceneId));
await assert.rejects(()=>cold.begin(session,'resume',bind(),()=>true),/conflict/);
await assert.rejects(()=>classrooms.readConfirmed(session,approved.id,approved.version),/conflict/);
check('Source privacy and outline revision revoke generation, confirmation and export source; scene ids survive editing');
assert.equal(db.prepare('SELECT count(*) n FROM learning_records').get().n,0);
const start={sessionId:session,commandId:'xicmd_11111111-1111-4111-8111-111111111111',prompt:'按资料生成大纲',classroomPlan:{mode:'outline'}};
assert(validXiaozhiStart(start));assert(!validXiaozhiStart({...start,continueTask:{taskId:'xitask_'+'a'.repeat(64),requirementsVersion:1}}));
check('No student fact writes and strict production start admission');
// Exercise the actual Pi adapters, not a second fake generation implementation.
const toolPlan=await cold.propose(session,'outline','tools-proposal',document,context,()=>true);
const toolBinding={mode:'generate',id:toolPlan.id,version:toolPlan.version};
await cold.decide({id:toolPlan.id,version:toolPlan.version,decision:'confirm'});
await cold.begin(session,'generate',toolBinding,()=>true);
let live=true;
const tools=domain.createClassroomPlanTools({sessionId:session,runId:'generate',state:cold,binding:toolBinding,current:()=>live,sanitize:async text=>text,context:()=>context});
const invoke=async(name,input={})=>tools.find(t=>t.name===name).execute('call-'+name,input,new AbortController().signal,undefined,undefined);
let response=await invoke('education_read_classroom_plan');assert(!response.isError);
assert.deepEqual(JSON.parse(response.content[0].text).missingSceneIds,['intro','explain','check']);
response=await invoke('education_prepare_planned_scene',{sceneId:'intro'});assert(!response.isError);assert(JSON.parse(response.content[0].text).system);
const rawSlide=JSON.stringify({elements:scenes[0].content.canvas.elements,background:{type:'solid',color:'#fff'}});
response=await invoke('education_save_classroom_scene',{sceneId:'intro',contentJson:rawSlide});assert(!response.isError,response.content[0].text);
const firstSaved=(await cold.read(toolPlan.id)).checkpoints[0];
response=await invoke('education_save_classroom_scene',{sceneId:'intro',contentJson:rawSlide});assert(!response.isError);assert(JSON.parse(response.content[0].text).alreadySaved);
assert.deepEqual((await cold.read(toolPlan.id)).checkpoints[0],firstSaved);
response=await invoke('education_save_classroom_scene',{sceneId:'missing',contentJson:rawSlide});assert(response.isError);
response=await invoke('education_save_classroom_scene',{sceneId:'explain',contentJson:JSON.stringify({elements:[{...scenes[0].content.canvas.elements[0],content:'<script>alert(1)</script>'}]})});assert(response.isError);
assert.equal((await cold.read(toolPlan.id)).checkpoints.length,1);
live=false;response=await invoke('education_save_classroom_scene',{sceneId:'explain',contentJson:rawSlide});assert(response.isError);live=true;
db.prepare('UPDATE teacher_resources SET content_hash=? WHERE id=?').run('b'.repeat(64),resourceId);
response=await invoke('education_prepare_planned_scene',{sceneId:'explain'});assert(response.isError);
db.prepare('UPDATE teacher_resources SET content_hash=? WHERE id=?').run('a'.repeat(64),resourceId);
await cold.finishRun('generate');
check('Actual Pi tools capture native prompts, normalize/save content, replay identical JSON without new ids, and reject unsafe/late/source-changed requests');
// Teacher edits are intentionally stored verbatim; model delivery must not bypass privacy.
const modelExits=[{name:'education_read_classroom_plan',input:{}},{name:'education_prepare_planned_scene',input:{sceneId:'intro'}}];
async function approvedTools(key,editedDocument,sanitize,current=()=>true){
 const proposed=await cold.propose(session,'outline',key,document,context,()=>true);
 const edited=await cold.edit({id:proposed.id,version:proposed.version,document:editedDocument});
 await cold.decide({id:edited.id,version:edited.version,decision:'confirm'});
 const binding={mode:'generate',id:edited.id,version:edited.version};
 await cold.begin(session,'generate',binding,()=>true);
 const adapters=domain.createClassroomPlanTools({sessionId:session,runId:'generate',state:cold,binding,current,sanitize,context:()=>context});
 return{item:await cold.read(edited.id),invoke:(exit,signal=new AbortController().signal)=>adapters.find(t=>t.name===exit.name).execute('delivery-'+key,exit.input,signal,undefined,undefined)};
}
function rejectedDelivery(response,code){
 assert(response.isError,response.content[0].text);
 const payload=JSON.parse(response.content[0].text);
 if(code)assert.equal(payload.error,code);
 assert(!('document'in payload)&&!('system'in payload)&&!('user'in payload));
 assert(!response.content[0].text.includes('王小明')&&!response.content[0].text.includes('13800138000'));
}
for(const [kind,editedDocument]of[
 ['name',{...document,objectives:['为王小明解释浮力与重力的关系。']}],
 ['phone',{...document,scenes:document.scenes.map(s=>s.sceneId==='intro'?{...s,activity:'联系13800138000后观察测力计示数。'}:s)}],
 ['other-page',{...document,scenes:document.scenes.map(s=>s.sceneId==='check'?{...s,activity:'请王小明回答选择题。'}:s)}]
]){
 const fixture=await approvedTools('private-'+kind,editedDocument,async text=>text.replaceAll('王小明','[学生]').replaceAll('13800138000','[电话]'));
 for(const exit of modelExits){
  const output=await fixture.invoke(exit);rejectedDelivery(output,'sensitive_content');
  assert(JSON.parse(output.content[0].text).message.includes('重新确认'));
  assert.deepEqual(await cold.read(fixture.item.id),fixture.item,'Refusal must not rewrite the approved document/version or save checkpoints');
 }
 await cold.finishRun('generate');
}
check('Both model exits refuse edited names/phones and unsafe non-target pages without silently rewriting the approved version');
let sanitizedDeliveries=0;
const safeDelivery=await approvedTools('safe-delivery',document,async text=>{sanitizedDeliveries++;return text;});
response=await safeDelivery.invoke(modelExits[0]);assert(!response.isError);assert.deepEqual(JSON.parse(response.content[0].text).document,document);
response=await safeDelivery.invoke(modelExits[1]);assert(!response.isError);assert(JSON.parse(response.content[0].text).system&&JSON.parse(response.content[0].text).user);
assert.equal(sanitizedDeliveries,2);assert.deepEqual(await cold.read(safeDelivery.item.id),safeDelivery.item);
await cold.finishRun('generate');
check('Safe teacher-edited approved outline and native scene prompts pass unchanged through the shared sanitizer');
for(const mode of ['stop','abort','source','revision','run-ended']){
 for(const exit of modelExits){
  let active=true,release,entered;
  const waiting=new Promise(resolve=>{release=resolve;}),sanitizing=new Promise(resolve=>{entered=resolve;});
  const fixture=await approvedTools('pending-'+mode+'-'+exit.name,document,async text=>{entered();await waiting;return text;},()=>active);
  const controller=new AbortController(),pending=fixture.invoke(exit,controller.signal);
  await Promise.race([sanitizing,pending.then(()=>assert.fail('Tool returned before the asynchronous delivery privacy check'))]);
  if(mode==='stop'){active=false;await cold.finishRun('generate');}
  if(mode==='abort')controller.abort();
  if(mode==='source')db.prepare('UPDATE teacher_resources SET content_hash=? WHERE id=?').run('b'.repeat(64),resourceId);
  if(mode==='revision'){await cold.finishRun('generate');await cold.edit({id:fixture.item.id,version:fixture.item.version,document:{...document,title:'等待检查时教师修订'}});}
  if(mode==='run-ended')db.prepare('UPDATE ai_agent_runs SET status=? WHERE id=?').run('cancelled','generate');
  release();response=await pending;
  rejectedDelivery(response,mode==='source'?'source_changed':mode==='revision'?'conflict':'cancelled');
  if(mode==='source')db.prepare('UPDATE teacher_resources SET content_hash=? WHERE id=?').run('a'.repeat(64),resourceId);
  if(mode==='run-ended')db.prepare('UPDATE ai_agent_runs SET status=? WHERE id=?').run('running','generate');
  await cold.finishRun('generate');
 }
 check('Both asynchronous model exits reject late delivery after '+mode);
}
const channels=new Map();domain.registerClassroomIpc({ipcMain:{handle:(channel,handler)=>channels.set(channel,handler)},allowed:event=>event.sender==='trusted',state:classrooms,plans:cold});
const ipc=(method,input,event={sender:'trusted'})=>channels.get('classroom:plan-'+method)(event,input);
assert.equal((await ipc('list',undefined,{sender:'untrusted'})).error,'permission_denied');
assert.equal((await ipc('list',{})).error,'invalid_input');
assert.equal((await ipc('read','bad')).error,'invalid_input');
assert.equal((await ipc('edit',{id:toolPlan.id,version:toolPlan.version,document,extra:true})).error,'invalid_input');
assert.equal((await ipc('decide',{id:toolPlan.id,version:toolPlan.version,decision:'confirm',document})).error,'invalid_input');
assert((await ipc('read',toolPlan.id)).ok);
const dbSource=fs.readFileSync('src/main/db.ts','utf8'),genericExclusions=[...dbSource.matchAll(/action_type NOT IN \(([^)]+)\)/g)].filter(m=>m[1].includes("'pi_classroom_candidate'"));
assert(genericExclusions.length>=3&&genericExclusions.every(m=>m[1].includes("'pi_classroom_plan'")));
check('Real registered IPC checks sender and exact DTO; all existing generic-confirmation queries exclude plan actions');
db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({checks,kind:'real SQLite + pinned DSL domain checks, no provider/Electron claims'},null,2));
console.log(JSON.stringify({checks:checks.length,output}));
