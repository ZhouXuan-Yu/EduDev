import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const {createPaperCoordinator}=await import('../../src/main/education/paper-coordinator.ts');
const {explicitlyRequestsPaper}=await import('../../src/main/education/paper-admission.ts');
const {PaperRepository}=await import('../../src/main/education/paper-repository.ts');
const {PAPER_SCHEMA}=await import('../../src/shared/paper-blueprint.ts');
const {createTaskCoordinator}=await import('../../src/main/xiaozhi-agent/tasks/coordinator.ts');
const {createTaskPlanRuntime}=await import('../../src/main/xiaozhi-agent/tasks/plan-runtime.ts');
const {createTaskResources}=await import('../../src/main/xiaozhi-agent/tasks/resources.ts');
const {taskEnvelope}=await import('../../src/main/xiaozhi-agent/tasks/tool-envelope.ts');
const {createEventJournal}=await import('../../src/main/xiaozhi-agent/events/journal.ts');
const {createEventPublisher}=await import('../../src/main/xiaozhi-agent/events/publisher.ts');
const {createToolExecutionBoundary}=await import('../../src/main/xiaozhi-agent/tools/execution-bound.ts');
const {SessionExecutionRegistry}=await import('../../src/main/xiaozhi-agent/vendor/hana/lib/session-execution-registry.ts');

const output=fs.mkdtempSync(path.resolve('test-results/paper-host-admission-')),db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);
CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,student_id TEXT,archived_at TEXT);
CREATE TABLE ai_conversation_messages(id TEXT PRIMARY KEY,session_id TEXT,role TEXT,content TEXT,metadata_json TEXT);
CREATE TABLE students(id TEXT,status TEXT);CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,student_id TEXT,status TEXT);
CREATE TABLE xiaozhi_pi_commands(command_id TEXT PRIMARY KEY,conversation_id TEXT,run_id TEXT,status TEXT);
CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,student_id TEXT,action_type TEXT,status TEXT,title TEXT,payload_json TEXT,result_json TEXT DEFAULT '{}',created_at TEXT,updated_at TEXT,confirmed_at TEXT,rejected_at TEXT);
CREATE TABLE questions(id TEXT PRIMARY KEY,body TEXT);CREATE TABLE learning_records(id TEXT);`);
let lane=Promise.resolve();
const sql={all:async(q,v=[])=>db.prepare(q).all(...v),run:async(q,v=[])=>db.prepare(q).run(...v),change:async(q,v=[])=>Number(db.prepare(q).run(...v).changes),transaction:fn=>{const work=lane.then(async()=>{db.exec('BEGIN IMMEDIATE');try{const value=await fn(sql);db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}});lane=work.catch(()=>{});return work;}};
const sessionId='aisession_'+randomUUID(),runId='run_'+randomUUID(),commandId='xicmd_'+randomUUID(),messageId='aimsg_'+randomUUID(),text='请基于真实本地原题按蓝图组卷，等待我审核后保存整卷。';
db.prepare("INSERT INTO ai_conversation_sessions VALUES(?,'',NULL)").run(sessionId);db.prepare("INSERT INTO ai_agent_runs VALUES(?,?,'','running')").run(runId,sessionId);db.prepare("INSERT INTO xiaozhi_pi_commands VALUES(?,?,?,'running')").run(commandId,sessionId,runId);
db.prepare('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?)').run(messageId,sessionId,'user',text,JSON.stringify({piVersion:'xiaozhi.pi.education.v1',agentRunId:runId}));
const question={id:'question_'+randomUUID(),subject:'数学',grade:'初二',knowledgePoint:'一次方程',questionType:'选择题',difficulty:'easy',sourceKind:'local_bank',sourceTitle:'合成合同原题',stem:'方程 x+1=2 的解是什么？',options:JSON.stringify([{value:'A',label:'1'},{value:'B',label:'2'}]),answer:'A',analysis:'等式两边同时减去1。',tags:[],createdAt:'2026-11-01',updatedAt:'2026-11-01'};
db.prepare('INSERT INTO questions VALUES(?,?)').run(question.id,JSON.stringify(question));let sourceCurrent=true;
const paperSql={...sql,read:async id=>{const row=db.prepare('SELECT body FROM questions WHERE id=?').get(id);return row?JSON.parse(row.body):undefined;},validate:async()=>{if(!sourceCurrent)throw Error('source_changed');},page:async(_blueprint,after)=>db.prepare('SELECT id,body FROM questions WHERE id>? ORDER BY id LIMIT 200').all(after).map(row=>({id:row.id,question:JSON.parse(row.body)}))};
const papers=new PaperRepository({...paperSql,transaction:fn=>sql.transaction(()=>fn(paperSql)),approvedGenerations:async()=>[]});
const journal=createEventJournal(sql);await journal.migrate();const owner=await journal.begin(sessionId,runId,{id:runId,status:'running',items:[]});
let active=true,critical=0,generic=false;const publisher=createEventPublisher({journal,owner,committed:()=>{},emit:()=>{},failed:()=>critical++,beforeTerminalEmit:()=>{}});publisher.enqueue({kind:'status',status:'running'});await publisher.flush();
const store={papers,xiaozhiState:{sql,eventJournal:journal},listStudents:async()=>[],sanitizeProblemText:async value=>({sanitizedText:value}),getAiConversationSession:async()=>({session:{id:sessionId},messages:[{id:messageId,role:'user',content:text,metadata:{piVersion:'xiaozhi.pi.education.v1',agentRunId:runId}}]})};
const taskCoordinator=createTaskCoordinator({store,closing:()=>false,busy:()=>true,running:()=>true,emit:()=>{}}),task=await taskCoordinator.start(sessionId,runId,commandId,publisher);
const runtime=createTaskPlanRuntime({sql,taskId:task.id,publisher,current:()=>active,sanitize:async value=>value,resources:createTaskResources({sessionId,workspace:async()=>undefined,studentId:async()=>'',attachment:async()=>false}),proofs:async()=>[]});
const published=[],coordinator=createPaperCoordinator({store,isCurrent:(session,run)=>active&&session===sessionId&&run===runId,canWrite:(session,run)=>active&&session===sessionId&&run===runId,emit:(_session,_run,value)=>published.push(value)});
const binding=callId=>({sessionId,runId,commandId,generation:owner.generation,callId,taskId:task.id,requirementsVersion:task.requirementsVersion});
const boundary=createToolExecutionBoundary({sessionId,workspaceKey:'owned-paper-admission',registry:new SessionExecutionRegistry(),epoch:()=>runId,current:()=>active,waiting:()=>false,onWaiting:()=>()=>{},criticalFailure:()=>critical++,attempt:async attempt=>{publisher.enqueue({kind:'tool_attempt',attempt});await publisher.flush();},beforeDelivery:async(call,tool,signal,input)=>{
 if(!generic&&tool==='education_propose_paper'){await runtime.refresh();await coordinator.admitProposal(binding(call),input,signal);}else await runtime.admit(call,tool,input);
 await publisher.persist(current=>journal.admitTool(current,call,tool));
}});
const blueprint={title:'合同核对卷',subject:'数学',grade:'初二',durationMinutes:40,totalPoints:10,mode:'source_only',sections:[{id:'choice',label:'单项选择',questionType:'选择题',count:1,points:10}]};
const def=taskEnvelope(coordinator.tools(sessionId,runId)[0]),started=new Set();
const start=async(call,tool=def.name)=>{publisher.enqueue({kind:'tool_start',tool,callId:call});await publisher.flush();started.add(call);};
const execute=async(tool,input,call='call_'+randomUUID())=>{
 if(started.has(call))return boundary.execute(tool,call,input,new AbortController().signal);
 await start(call,tool.name);const response=await boundary.execute(tool,call,input,new AbortController().signal);
 publisher.enqueue({kind:'tool_end',tool:tool.name,callId:call,success:response.isError!==true&&response.details?.success!==false});await publisher.flush();return response;
};
const count=()=>db.prepare("SELECT count(*) n FROM ai_confirmation_items WHERE action_type='pi_paper_candidate'").get().n;
const until=async fn=>{const end=Date.now()+3000;while(!await fn()){assert(Date.now()<end,'Expected real pending review');await new Promise(resolve=>setTimeout(resolve,5));}};
const decision=(paper,action='confirm')=>({schemaVersion:PAPER_SCHEMA,sessionId,id:paper.id,revision:1,action});
const checks=[],check=async(name,fn)=>{await fn();checks.push({name,pass:true});console.log('PASS '+name);};
// Each scope case has a genuine current task and SDK receipt. A source mismatch
// must not accidentally satisfy a test intended to prove teacher operation scope.
async function scopeCase(request,{allowed=false,modelPlan=false,correction,continueRun=false}={}){
 const sid='aisession_'+randomUUID();db.prepare("INSERT INTO ai_conversation_sessions VALUES(?,'',NULL)").run(sid);
 let rid,cmd,pub,currentTask;
 const scopedStore={...store,getAiConversationSession:async()=>({session:{id:sid},messages:db.prepare('SELECT * FROM ai_conversation_messages WHERE session_id=? ORDER BY rowid').all(sid).map(row=>({id:row.id,role:row.role,content:row.content,metadata:JSON.parse(row.metadata_json)}))})};
 const actor=createTaskCoordinator({store:scopedStore,closing:()=>false,busy:()=>false,running:()=>true,emit:()=>{}});
 async function begin(content){
  rid='run_'+randomUUID();cmd='xicmd_'+randomUUID();
  db.prepare("INSERT INTO ai_agent_runs VALUES(?,?,'','running')").run(rid,sid);db.prepare("INSERT INTO xiaozhi_pi_commands VALUES(?,?,?,'running')").run(cmd,sid,rid);
  db.prepare('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?)').run('aimsg_'+randomUUID(),sid,'user',content,JSON.stringify({piVersion:'xiaozhi.pi.education.v1',agentRunId:rid}));
  const own=await journal.begin(sid,rid,{id:rid,status:'running',items:[]});
  pub=createEventPublisher({journal,owner:own,committed:()=>{},emit:()=>{},failed:()=>critical++,beforeTerminalEmit:()=>{}});pub.enqueue({kind:'status',status:'running'});await pub.flush();
  currentTask=await actor.start(sid,rid,cmd,pub);
 }
 const makeRuntime=()=>createTaskPlanRuntime({sql,taskId:currentTask.id,publisher:pub,current:()=>true,sanitize:async value=>value,resources:createTaskResources({sessionId:sid,workspace:async()=>undefined,studentId:async()=>'',attachment:async()=>false}),proofs:async()=>[]});
 await begin(request);
 if(modelPlan){const result=await makeRuntime().tools[0].execute('model_scope_plan',{schemaVersion:'xiaozhi.task-plan.v3',expectedRevision:0,requirementsVersion:1,reason:'模型自行建议组卷',steps:[{id:'review',text:'生成试卷并等待教师确认',kind:'human',reported:'pending',dependsOn:[]}]},new AbortController().signal);assert.equal(JSON.parse(result.content[0].text).adopted,true);currentTask=await actor.committed(sid);}
 if(correction||continueRun){currentTask=await actor.finish(currentTask,pub,true);pub.enqueue({kind:'status',status:'interrupted'},{id:rid,status:'interrupted',items:[]});await pub.flush();db.prepare("UPDATE ai_agent_runs SET status='cancelled' WHERE id=?").run(rid);db.prepare("UPDATE xiaozhi_pi_commands SET status='cancelled' WHERE command_id=?").run(cmd);}
 if(correction){const result=await actor.correct({schema:'xiaozhi.task.v1',sessionId:sid,taskId:currentTask.id,revision:currentTask.revision,requirementsVersion:currentTask.requirementsVersion,requestId:'xitact_'+randomUUID(),criteria:correction.map(text=>({text}))});assert.equal(result.ok,true);currentTask=result.value.task;}
 if(correction||continueRun)await begin('继续');
 const scoped=createPaperCoordinator({store:scopedStore,isCurrent:(s,r)=>s===sid&&r===rid,canWrite:(s,r)=>s===sid&&r===rid,emit:()=>{}});
 try{
  await makeRuntime().refresh();
  const call='scope_'+randomUUID();pub.enqueue({kind:'tool_start',tool:def.name,callId:call});await pub.flush();
  const bound={sessionId:sid,runId:rid,commandId:cmd,generation:pub.owner.generation,callId:call,taskId:currentTask.id,requirementsVersion:currentTask.requirementsVersion},before=count();
  if(allowed)assert.equal((await scoped.admitProposal(bound,blueprint)).kind,'paper_review');
  else await assert.rejects(()=>scoped.admitProposal(bound,blueprint),error=>error.message==='task_paper_request_scope');
  assert.equal(count(),before);
 }finally{scoped.close();await pub.flush();}
}
try{
 await check('Original task gate reproduces task_plan_required before paper creation',async()=>{generic=true;const response=await execute(def,blueprint);generic=false;assert.equal(response.details.taskReason,'task_plan_required');assert.equal(count(),0);assert.equal(critical,0);});
 await check('Bare informational paper queries, unrelated reads and full-request prohibitions never authorize creation',async()=>{
  for(const request of ['组卷是什么？','组卷怎么用？','组卷流程介绍','出卷是什么？','请读取资料并解释组卷流程。','只解释组卷，不要创建试卷。','请生成一份试卷。不要实际组卷，只解释方案。','请按蓝图组卷\n不要生成试卷。','请生成一份试卷；不要出卷，只解释方案。']){assert.equal(explicitlyRequestsPaper(request),false);await scopeCase(request);}
  await scopeCase('请读取资料并解释组卷流程。',{modelPlan:true});
 });
 await check('Explicit teacher creation and the real QA request retain scope; bound continuation cannot expand it',async()=>{
  for(const request of ['组卷','请按蓝图组卷。','请实际调用 education_propose_paper 按下面蓝图做纯题库组卷，等待我逐题核对确认，再调用 education_read_paper 读取保存结果。不要创建文件，不生成新题。蓝图：{}']){assert.equal(explicitlyRequestsPaper(request),true);await scopeCase(request,{allowed:true});}
  await scopeCase('请按蓝图组卷。',{allowed:true,continueRun:true});
  await scopeCase('请读取资料并解释组卷流程。',{continueRun:true});
  await scopeCase('继续');
 });
 await check('Every current teacher correction criterion is authoritative, including later semicolon or newline prohibitions',async()=>{
  for(const later of ['不要实际组卷，只解释方案。','不要生成试卷。\n只解释方案。'])await scopeCase('请按蓝图组卷。',{correction:['请生成一份试卷。',later]});
  await scopeCase('请按蓝图组卷。',{allowed:true,correction:['请按蓝图组卷。','保留真实原题来源。']});
 });
 await check('Read-only admission requires the bound SDK receipt and returns stable domain identity without saving facts',async()=>{
  const call='readonly_'+randomUUID();await start(call);const before=JSON.stringify(db.prepare('SELECT * FROM ai_confirmation_items').all());
  const first=await coordinator.admitProposal(binding(call),blueprint);assert.equal(first.kind,'paper_review');assert.deepEqual(await coordinator.admitProposal(binding(call),blueprint),first);assert.notEqual((await coordinator.admitProposal(binding(call),{...blueprint,title:'另一份卷'})).resource,first.resource);assert.equal(JSON.stringify(db.prepare('SELECT * FROM ai_confirmation_items').all()),before);
 });
 await check('Domain route preserves original pending teacher review, journal admission, and same-call payload deduplication',async()=>{
  const call='paper_'+randomUUID(),offset=published.length,pending=execute(def,blueprint,call);await until(()=>published.length>offset);const paper=published.at(-1);assert.equal(paper.state,'pending');assert.equal(paper.complete,true);assert.equal(await papers.latest(sessionId),undefined);
  const same=execute(def,blueprint,call);const conflict=await execute(def,{...blueprint,title:'冲突正文'},call);assert.equal(conflict.details.execution.code,'conflict');
  assert((await coordinator.decide(decision(paper))).ok);assert(!(await pending).isError);assert(!(await same).isError);assert.equal((await papers.latest(sessionId)).state,'confirmed');
  const receipt=db.prepare('SELECT admitted,phase,success FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?').get(runId,call);assert.equal(receipt.admitted,1);assert.equal(receipt.phase,'settled');assert.equal(receipt.success,1);
  const view=await taskCoordinator.committed(sessionId);assert(!view.checks.some(value=>value.authority==='readback'),'Paper confirmation must not mint saved_questions evidence');
 });
 await check('Cross-session, old run/command/generation, missing or wrong SDK receipt, and invalid blueprint cannot gain authority',async()=>{
  const call='guards_'+randomUUID();await start(call);
  for(const changed of [{sessionId:'aisession_'+randomUUID()},{runId:'run_'+randomUUID()},{commandId:'xicmd_'+randomUUID()},{generation:owner.generation+1},{callId:'missing'}])await assert.rejects(()=>coordinator.admitProposal({...binding(call),...changed},blueprint),error=>error.message===(changed.sessionId||changed.runId?'cancelled':changed.generation?'task_owner_stale':'task_paper_owner_stale'));
  const wrong='wrong_'+randomUUID();await start(wrong,'office_create_text');await assert.rejects(()=>coordinator.admitProposal(binding(wrong),blueprint),/task_paper_owner_stale/);
  await assert.rejects(()=>coordinator.admitProposal(binding(call),{...blueprint,totalPoints:9}),/task_paper_invalid/);assert.equal(count(),1);
 });
 await check('Withdrawn teacher request is denied by original refresh before domain creation',async()=>{
  const before=count();db.prepare('UPDATE ai_conversation_messages SET content=? WHERE id=?').run('教师已撤回组卷要求',messageId);const response=await execute(def,blueprint);assert.equal(response.details.taskReason,'task_source_changed');assert.equal(count(),before);db.prepare('UPDATE ai_conversation_messages SET content=? WHERE id=?').run(text,messageId);
 });
 await check('Unconfirmed generated-source quota remains a shortage and never becomes a confirmed paper',async()=>{
  const response=await execute(def,{...blueprint,mode:'ai_original'});assert(response.isError);assert.equal(JSON.parse(response.content[0].text).code,'shortage');const rows=await papers.list(sessionId);assert(rows.some(row=>!row.complete&&row.state==='pending'));assert.equal(rows.filter(row=>row.state==='confirmed').length,1);
 });
 await check('Original source-current and teacher rejection gates remain effective after domain admission',async()=>{
  const offset=published.length,pending=execute(def,{...blueprint,title:'待核对来源'});await until(()=>published.length>offset);const paper=published.at(-1);sourceCurrent=false;const refused=await coordinator.decide(decision(paper));assert.equal(refused.ok,false);assert.equal(refused.error,'source_changed');sourceCurrent=true;assert((await coordinator.decide(decision(paper,'reject'))).ok);assert((await pending).isError);assert.equal((await papers.review(sessionId,paper.id)).state,'rejected');
 });
 await check('Cancellation during the asynchronous admission read yields no late authority or effect',async()=>{
  const call='cancel_'+randomUUID();await start(call);const controller=new AbortController();controller.abort();await assert.rejects(()=>coordinator.admitProposal(binding(call),blueprint,controller.signal),/cancelled/);
  let release,entered;const enteredPromise=new Promise(resolve=>entered=resolve),wait=new Promise(resolve=>release=resolve),delayed=createPaperCoordinator({store:{...store,xiaozhiState:{sql:{all:async(q,v)=>{entered();await wait;return sql.all(q,v);}}}},isCurrent:()=>active,canWrite:()=>active,emit:()=>{}});
  const before=count(),pending=delayed.admitProposal(binding(call),blueprint);await enteredPromise;active=false;release();await assert.rejects(()=>pending,/cancelled/);active=true;assert.equal(count(),before);delayed.close();
 });
 await check('Other writes retain generic task gating; no grades or artifacts are created',async()=>{
  let effects=0;const other=taskEnvelope({name:'office_create_text',label:'Effect witness',description:'No real write',parameters:{type:'object',additionalProperties:false,required:['path','content'],properties:{path:{type:'string'},content:{type:'string'}}},execute:async()=>{effects++;return{content:[],details:{success:true}};}});
  const response=await execute(other,{path:'unapproved.md',content:'synthetic'});assert.equal(response.details.execution.code,'task_blocked');assert.equal(effects,0);assert.equal(db.prepare('SELECT count(*) n FROM learning_records').get().n,0);assert.equal(critical,0);assert(!publisher.failed);
 });
 const source=fs.readFileSync('src/main/xiaozhi-agent/production-host.ts','utf8');assert.match(source,/if\(delivery\.tool===PAPER_TOOLS\[0\]\)\{[\s\S]*?await taskRuntime\.refresh\(\);[\s\S]*?await paperReviews\.admitProposal[\s\S]*?else await admitClassroomOrTaskTool[\s\S]*?eventJournal\.admitTool/);
 console.log(JSON.stringify({passed:checks.length,output,boundary:'Real task runtime, SDK boundary, journal and paper transaction; synthetic local source, no model/build/Electron'}));
}finally{coordinator.close();await publisher.flush();db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({checks,kind:'real source task/domain admission integration; not provider/product quality'},null,2));}
