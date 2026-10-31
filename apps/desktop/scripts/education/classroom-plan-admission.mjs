import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {createClassroomOutlineWait} from '../acceptance/classroom-outline-wait.mjs';

const {createClassroomPlanState}=await import('../../src/main/education/classroom-plan-state.ts');
const {createClassroomState}=await import('../../src/main/education/classroom-state.ts');
const {createClassroomPlanTools}=await import('../../src/main/education/classroom-plan-tools.ts');
const {admitClassroomOrTaskTool}=await import('../../src/main/education/classroom-plan-admission.ts');
const {materialBodyVersion}=await import('../../src/main/assets/material-source.ts');
const {createTaskCoordinator}=await import('../../src/main/xiaozhi-agent/tasks/coordinator.ts');
const {createTaskPlanRuntime}=await import('../../src/main/xiaozhi-agent/tasks/plan-runtime.ts');
const {createTaskResources}=await import('../../src/main/xiaozhi-agent/tasks/resources.ts');
const {taskEnvelope}=await import('../../src/main/xiaozhi-agent/tasks/tool-envelope.ts');
const {createEventJournal}=await import('../../src/main/xiaozhi-agent/events/journal.ts');
const {createEventPublisher}=await import('../../src/main/xiaozhi-agent/events/publisher.ts');
const {createToolExecutionBoundary}=await import('../../src/main/xiaozhi-agent/tools/execution-bound.ts');
const {SessionExecutionRegistry}=await import('../../src/main/xiaozhi-agent/vendor/hana/lib/session-execution-registry.ts');

// Real generic task runtime + execution/journal boundary + U6 domain, no provider/out.
const output=fs.mkdtempSync(path.resolve('test-results/classroom-admission-'));
const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);
CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,student_id TEXT,archived_at TEXT);
CREATE TABLE ai_conversation_messages(id TEXT PRIMARY KEY,session_id TEXT,role TEXT,content TEXT,metadata_json TEXT);
CREATE TABLE students(id TEXT,status TEXT);
CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,status TEXT);
CREATE TABLE xiaozhi_pi_commands(command_id TEXT PRIMARY KEY,conversation_id TEXT,run_id TEXT,status TEXT);
CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,student_id TEXT,action_type TEXT,status TEXT,title TEXT,payload_json TEXT,result_json TEXT DEFAULT '{}',created_at TEXT,updated_at TEXT,confirmed_at TEXT,rejected_at TEXT);
CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT,parse_status TEXT);
CREATE TABLE resource_chunks(id TEXT PRIMARY KEY,resource_id TEXT,chunk_index INTEGER,content_md TEXT,contains_personal_data INTEGER,page_number INTEGER);
CREATE TABLE learning_records(id TEXT);`);
let lane=Promise.resolve();
const sql={all:async(q,v=[])=>db.prepare(q).all(...v),run:async(q,v=[])=>db.prepare(q).run(...v),change:async(q,v=[])=>Number(db.prepare(q).run(...v).changes),transaction:fn=>{const work=lane.then(async()=>{db.exec('BEGIN IMMEDIATE');try{const value=await fn(sql);db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}});lane=work.catch(()=>{});return work;}};
const sessionId='aisession_'+randomUUID(),runId='run_'+randomUUID(),commandId='xicmd_'+randomUUID(),messageId='aimsg_'+randomUUID();
const teacherText='请实读本地资料，先整理40分钟浮力课堂大纲，等待教师确认。';
db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,?,NULL)').run(sessionId,'');
db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?)').run(runId,sessionId,'running');
db.prepare('INSERT INTO xiaozhi_pi_commands VALUES(?,?,?,?)').run(commandId,sessionId,runId,'running');
db.prepare('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?)').run(messageId,sessionId,'user',teacherText,JSON.stringify({piVersion:'xiaozhi.pi.education.v1',agentRunId:runId}));
const resourceId='resource_'+randomUUID(),chunkId='chunk_'+randomUUID(),body='空气中测力计示数3 N，浸没后2 N。受到浮力不一定上浮。';
db.prepare('INSERT INTO teacher_resources VALUES(?,?,?)').run(resourceId,'a'.repeat(64),'ready');
db.prepare('INSERT INTO resource_chunks VALUES(?,?,?,?,?,?)').run(chunkId,resourceId,0,body,0,1);
const context={schemaVersion:'xiaozhi.classroom-context.v1',preferenceRevision:0,materials:[{source:{schemaVersion:'xiaozhi.material-source.v1',resourceId,version:'a'.repeat(64),offset:0,chunkId,bodyVersion:materialBodyVersion({id:chunkId,chunkIndex:0,contentMd:body,containsPersonalData:false,pageNumber:1})},title:'合成浮力资料',characters:body.length,truncated:false,recognition:'saved_text'}]};
const document={schemaVersion:'xiaozhi.classroom-plan.v1',title:'浮力课堂',objectives:['根据3 N与2 N的测量认识浮力，受浮力不一定上浮。'],totalMinutes:40,scenes:[{sceneId:'intro',type:'slide',title:'测量示数',activity:'记录3 N和2 N。',durationMinutes:10},{sceneId:'explain',type:'slide',title:'解释浮力',activity:'比较浮力与重力。',durationMinutes:20},{sceneId:'check',type:'quiz',title:'理解检查',activity:'单选题判断受浮力是否一定上浮。',durationMinutes:10}]};
const journal=createEventJournal(sql);await journal.migrate();
const owner=await journal.begin(sessionId,runId,{id:runId,status:'running',items:[]});
let active=true,critical=0,intent={mode:'outline'},generic=false,hostContext=context;
const publisher=createEventPublisher({journal,owner,committed:()=>{},emit:()=>{},failed:()=>critical++,beforeTerminalEmit:()=>{}});
publisher.enqueue({kind:'status',status:'running'});await publisher.flush();
const store={xiaozhiState:{sql,eventJournal:journal},sanitizeProblemText:async text=>({sanitizedText:text}),getAiConversationSession:async()=>({session:{id:sessionId},messages:[{id:messageId,role:'user',content:teacherText,metadata:{piVersion:'xiaozhi.pi.education.v1',agentRunId:runId}}]})};
const coordinator=createTaskCoordinator({store,closing:()=>false,busy:()=>true,running:()=>true,emit:()=>{}});
const task=await coordinator.start(sessionId,runId,commandId,publisher);
const runtime=createTaskPlanRuntime({sql,taskId:task.id,publisher,current:()=>active,sanitize:async text=>text,resources:createTaskResources({sessionId,workspace:async()=>undefined,studentId:async()=>'',attachment:async()=>false}),proofs:async()=>[]});
const plans=createClassroomPlanState(sql),classrooms=createClassroomState(sql),checks=[];
const check=async(name,fn)=>{await fn();checks.push({name,pass:true});console.log('PASS '+name);};
const boundary=createToolExecutionBoundary({sessionId,workspaceKey:'owned-classroom-admission',registry:new SessionExecutionRegistry(),epoch:()=>runId,current:()=>active,waiting:()=>false,onWaiting:()=>()=>{},criticalFailure:()=>critical++,attempt:async attempt=>{publisher.enqueue({kind:'tool_attempt',attempt});await publisher.flush();},beforeDelivery:async(call,tool,signal,input)=>{
 if(generic)await runtime.admit(call,tool,input);
 else await admitClassroomOrTaskTool({sessionId,runId,intent,plans,current:()=>active,signal,task:runtime},call,tool,input);
 await publisher.persist(o=>journal.admitTool(o,call,tool));
}});
// The SDK emits tool_start before calling the boundary and tool_end afterwards.
// Keep that lifecycle in this fixture: attempts/admission require its receipt.
const executeTool=async(def,call,input)=>{
 publisher.enqueue({kind:'tool_start',tool:def.name,callId:call});await publisher.flush();
 const response=await boundary.execute(def,call,input,new AbortController().signal);
 publisher.enqueue({kind:'tool_end',tool:def.name,callId:call,success:response.isError!==true&&response.details?.success!==false});await publisher.flush();
 return response;
};
const invoke=(name,input={},call='call_'+randomUUID())=>{const def=createClassroomPlanTools({sessionId,runId,state:plans,binding:intent,current:()=>active,sanitize:async text=>text,context:()=>hostContext}).find(t=>t.name===name);assert(def);return executeTool(taskEnvelope(def),call,input);};
const parsed=response=>JSON.parse(response.content.find(c=>c.type==='text'&&c.text.startsWith('{'))?.text||'{}');
const count=()=>db.prepare("SELECT count(*) n FROM ai_confirmation_items WHERE action_type='pi_classroom_plan'").get().n;
let draft,binding;
try{
 await check('Reproduce real blocker: original generic admission refuses valid outline before its effect',async()=>{
  const call='blocked_'+randomUUID();generic=true;const response=await invoke('education_propose_classroom_outline',document,call);generic=false;
  assert(response.isError);assert.equal(response.details.execution.code,'task_blocked');assert.equal(response.details.taskReason,'task_plan_required');assert.equal(count(),0);assert.equal(critical,0);
  const receipt=db.prepare('SELECT phase,admitted,success FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?').get(runId,call);assert.equal(receipt.phase,'settled');assert.equal(receipt.admitted,0);assert.equal(receipt.success,0);
 });
 await check('Host typed outline dispatch uses domain source/confirmation ledger and keeps real journal admission',async()=>{
  const call='outline_'+randomUUID(),response=await invoke('education_propose_classroom_outline',document,call);assert(!response.isError,response.content[0].text);draft=(await plans.list())[0];
  assert.equal(draft.status,'draft');assert.equal(draft.checkpoints.length,0);assert.equal(count(),1);
  const receipt=db.prepare('SELECT phase,admitted,success FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?').get(runId,call);assert.equal(receipt.phase,'settled');assert.equal(receipt.admitted,1);assert.equal(receipt.success,1);
  assert.equal(db.prepare("SELECT count(*) n FROM ai_confirmation_items WHERE action_type='pi_classroom_candidate'").get().n,0);
  binding={mode:'generate',id:draft.id,version:draft.version};
 });
 await check('Wrong mode, missing typed intent and forged raw routing cannot gain classroom authority',async()=>{
  let response=await invoke('education_read_classroom_plan');assert.equal(response.details.taskReason,'task_classroom_mode_mismatch');
  intent=undefined;response=await invoke('education_propose_classroom_outline',document);assert.equal(response.details.taskReason,'task_classroom_intent_required');
  await assert.rejects(()=>admitClassroomOrTaskTool({sessionId,runId,plans,current:()=>true,task:runtime},'forged','education_propose_classroom_outline',{...document,classroomPlan:{mode:'outline'}}),/task_classroom_intent_required/);
  intent={mode:'outline'};assert.equal(count(),1);
 });
 await check('Original strict document schema and required host-read source remain enforced',async()=>{
  let response=await invoke('education_propose_classroom_outline',{...document,totalMinutes:39});assert(response.isError);assert.equal(count(),1);
  hostContext={...context,materials:[]};response=await invoke('education_propose_classroom_outline',document);assert(response.isError);assert.equal(parsed(response).error,'source_required');hostContext=context;assert.equal(count(),1);
 });
 await check('Unrelated writes still require generic task admission and cannot borrow the typed intent',async()=>{
  let effects=0;const tool=taskEnvelope({name:'office_create_text',label:'Effect witness',description:'No actual file write',parameters:{type:'object',additionalProperties:false,required:['path','content'],properties:{path:{type:'string'},content:{type:'string'}}},execute:async()=>{effects++;return{content:[{type:'text',text:'unexpected'}],details:{success:true}};}});
  const response=await executeTool(tool,'foreign_'+randomUUID(),{path:'draft.md',content:'synthetic'});assert.equal(response.details.execution.code,'task_blocked');assert.equal(effects,0);
 });
 await check('Current teacher request and host run ownership are still checked before domain dispatch',async()=>{
  db.prepare('UPDATE ai_conversation_messages SET content=? WHERE id=?').run('教师已撤回原要求',messageId);
  const response=await invoke('education_propose_classroom_outline',document);assert.equal(response.details.taskReason,'task_source_changed');
  db.prepare('UPDATE ai_conversation_messages SET content=? WHERE id=?').run(teacherText,messageId);
  await assert.rejects(()=>admitClassroomOrTaskTool({sessionId,runId:'foreign-run',intent,plans,current:()=>true},'foreign_run','education_propose_classroom_outline',document),/cancelled/);
 });
 await check('No generation dispatch before explicit teacher confirmation or plan run ownership',async()=>{
  intent=binding;let response=await invoke('education_prepare_planned_scene',{sceneId:'intro'});assert.equal(response.details.execution.code,'task_blocked');
  await plans.decide({id:draft.id,version:draft.version,decision:'confirm'});
  response=await invoke('education_read_classroom_plan');assert.equal(response.details.execution.code,'task_blocked');
  await plans.begin(sessionId,runId,binding,()=>active);
  response=await invoke('education_read_classroom_plan');assert(!response.isError,response.content[0].text);assert.deepEqual(parsed(response).missingSceneIds,['intro','explain','check']);
 });
 await check('Changed source is refused before prompt delivery without poisoning the event publisher',async()=>{
  db.prepare('UPDATE teacher_resources SET content_hash=? WHERE id=?').run('b'.repeat(64),resourceId);
  const response=await invoke('education_prepare_planned_scene',{sceneId:'intro'});assert.equal(response.details.taskReason,'task_classroom_source_changed');
  db.prepare('UPDATE teacher_resources SET content_hash=? WHERE id=?').run('a'.repeat(64),resourceId);assert.equal(critical,0);assert(!publisher.failed);
 });
 await check('Real boundary prepares and saves all pages but completion is only a pending classroom',async()=>{
  for(const scene of document.scenes){
   const prepared=await invoke('education_prepare_planned_scene',{sceneId:scene.sceneId});assert(!prepared.isError);assert(parsed(prepared).system);
   const raw=scene.type==='slide'?{elements:[{id:'text',type:'text',left:40,top:50,width:800,height:200,content:'<p>3 N − 2 N = 1 N；受浮力不一定上浮。</p>',defaultFontName:'Microsoft YaHei',defaultColor:'#222',rotate:0}],background:{type:'solid',color:'#fff'}}:[{id:'q',type:'single',question:'受到浮力一定上浮吗？',options:[{value:'A',label:'一定'},{value:'B',label:'不一定'}],answer:['B'],analysis:'比较浮力与重力。'}];
   const response=await invoke('education_save_classroom_scene',{sceneId:scene.sceneId,contentJson:JSON.stringify(raw)});assert(!response.isError,response.content[0].text);
  }
  const completed=await invoke('education_finish_classroom_plan');assert(!completed.isError);assert.equal(parsed(completed).status,'pending');
  const ready=await plans.read(draft.id),classroom=await classrooms.read(ready.classroomId);assert.equal(classroom.status,'pending');
  // The existing final-classroom ledger deliberately uses conflict for pending.
  await assert.rejects(()=>classrooms.readConfirmed(sessionId,classroom.id,classroom.version),/^Error: conflict$/);
  assert.equal(db.prepare('SELECT count(*) n FROM learning_records').get().n,0);assert.equal(critical,0);assert(!publisher.failed);
 });
 await check('Late/cancelled domain dispatch cannot produce a new outline or change approved checkpoints',async()=>{
  const before=count();active=false;await assert.rejects(()=>admitClassroomOrTaskTool({sessionId,runId,intent:{mode:'outline'},plans,current:()=>active,task:runtime},'late','education_propose_classroom_outline',document),/cancelled/);assert.equal(count(),before);active=true;
  const controller=new AbortController();controller.abort();await assert.rejects(()=>admitClassroomOrTaskTool({sessionId,runId,intent,plans,current:()=>true,signal:controller.signal},'aborted','education_read_classroom_plan',{}),/cancelled/);
 });
 await check('QA fails promptly after a terminal run with no outline, while allowing the durable-update grace period',async()=>{
  let now=0;const waiting=createClassroomOutlineWait({now:()=>now});
  assert.equal(waiting(0,'running'),false);assert.equal(waiting(0,'succeeded'),false);
  now=2999;assert.equal(waiting(0,'succeeded'),false);
  now=3000;assert.throws(()=>waiting(0,'succeeded'),error=>error.code==='classroom_outline_missing');
  const settled=createClassroomOutlineWait({now:()=>now});assert.equal(settled(0,'failed'),false);now+=1000;assert.equal(settled(1,'failed'),true);
  assert.throws(()=>settled(2,'succeeded'),/classroom_outline_count_unexpected/);
 });
 console.log(JSON.stringify({passed:checks.length,output,scope:'Actual task runtime, SDK validation, execution/journal boundary and U6 SQLite ledger; no model/Electron/build claims'}));
}finally{await publisher.flush();db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({checks,kind:'source host admission integration, no provider/Electron claims'},null,2));}
