import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {registerHooks} from 'node:module';
// Admission only: never launch the extraction utility or a renderer.
registerHooks({resolve(specifier,context,next){if(specifier==='electron')return {url:'data:text/javascript,export%20const%20utilityProcess%3D%7B%7D%3Bexport%20const%20app%3D%7BisPackaged%3Afalse%7D%3Bexport%20const%20BrowserWindow%3Dclass%7Bconstructor()%7Bthrow%20Error(%22NoWindow%22)%7D%7D%3Bexport%20const%20session%3D%7B%7D%3B',shortCircuit:true};return next(specifier,context);},
 load(url,context,next){if(url.endsWith('/xiaozhi-agent/ocr-runtime-manifest.json'))return {format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8')+';',shortCircuit:true};return next(url,context);}});
const {createXiaozhiProductionHost}=await import('../../src/main/xiaozhi-agent/production-host.ts');
const {createXiaozhiSessionState}=await import('../../src/main/xiaozhi-agent/session-state.ts');
const {createTaskCoordinator}=await import('../../src/main/xiaozhi-agent/tasks/coordinator.ts');
const {createTaskState}=await import('../../src/main/xiaozhi-agent/tasks/task-state.ts');
const {createEventPublisher}=await import('../../src/main/xiaozhi-agent/events/publisher.ts');
const {PAPER_EXPORT_INTENT_SCHEMA}=await import('../../src/shared/paper-export.ts');
const {XIAOZHI_ERRORS}=await import('../../src/shared/xiaozhi-projection.ts');
const output=fs.mkdtempSync(path.resolve('test-results/u4d1-host-admission-'));
const db=new DatabaseSync(path.join(output,'unit.db'));
db.exec(`CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);
 CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,student_id TEXT,archived_at TEXT);
 CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,status TEXT);
 CREATE TABLE ai_conversation_messages(id TEXT PRIMARY KEY,session_id TEXT,role TEXT,content TEXT,metadata_json TEXT);
 CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,student_id TEXT,action_type TEXT,status TEXT,title TEXT,payload_json TEXT,result_json TEXT,created_at TEXT,updated_at TEXT,confirmed_at TEXT,rejected_at TEXT);`);
const sql={run:async(q,p=[])=>db.prepare(q).run(...p),all:async(q,p=[])=>db.prepare(q).all(...p),change:async(q,p=[])=>Number(db.prepare(q).run(...p).changes)};
sql.transaction=async action=>{db.exec('BEGIN IMMEDIATE');try{const value=await action(sql);db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}};
const state=createXiaozhiSessionState(sql),sessionId='aisession_'+randomUUID();
db.prepare('INSERT INTO ai_conversation_sessions(id) VALUES(?)').run(sessionId);
let passed=0,reviewed=[],archived=false,reviewFailure,afterReview,reviewPatch;
const binding={schemaVersion:PAPER_EXPORT_INTENT_SCHEMA,paperId:'xipaper_'+randomUUID(),digest:'a'.repeat(64),audience:'student',format:'docx',template:'paper'};
const prompt='只导出老师点选的确认卷';
const commandHash=intent=>createHash('sha256').update(JSON.stringify({sessionId,prompt,...(intent?{paperExportIntent:intent}:{})})).digest('hex');
const store={xiaozhiState:state,questionReviews:{collections:{list:async()=>[]}},
 getDeepSeekRuntimeSettings:async()=>({provider:'deepseek',apiKey:'unit-no-network',model:'deepseek-flash'}),
 getAiConversationSession:async id=>({session:{id,archivedAt:archived?'archived':undefined},messages:db.prepare('SELECT * FROM ai_conversation_messages WHERE session_id=? ORDER BY rowid').all(id).map(m=>({id:m.id,role:m.role,content:m.content,metadata:JSON.parse(m.metadata_json)}))}),
 sanitizeProblemText:async text=>({sanitizedText:text}),
 papers:{review:async(s,id)=>{reviewed.push({sessionId:s,id});if(reviewFailure)throw Error(reviewFailure);const value={sessionId:s,id,digest:binding.digest,state:'confirmed',complete:true,sourceCurrent:true,exportCurrent:true,...reviewPatch};afterReview?.();return value;},latest:async()=>assert.fail('Bound host must not read latest')}};
const host=createXiaozhiProductionHost({store,dataRoot:output,emit:()=>assert.fail('No run/model should start in admission tests')});
const fetchBefore=globalThis.fetch;globalThis.fetch=async()=>assert.fail('No provider/network is allowed');
const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
const actor=createTaskCoordinator({store,closing:()=>false,busy:()=>false,running:()=>false,emit:()=>{}});
const changes=()=>db.prepare('SELECT total_changes() AS n').get().n;
async function interruptedTask(intent,settled=true){
 const id='aisession_'+randomUUID(),runId='run_'+randomUUID(),commandId='xicmd_'+randomUUID(),messageId='aimsg_'+randomUUID();
 db.prepare('INSERT INTO ai_conversation_sessions(id) VALUES(?)').run(id);
 db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?)').run(runId,id,'running');
 db.prepare('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?)').run(messageId,id,'user','导出选定试卷',JSON.stringify({agentRunId:runId,piVersion:'xiaozhi.pi.education.v1',...(intent?{paperExportIntent:intent}:{})}));
 await state.claimCommand(commandId,id,'test-origin');await state.bindCommand(commandId,runId);
 const journal=state.eventJournal,owner=await journal.begin(id,runId,{id:runId,status:'running',items:[]});
 const publisher=createEventPublisher({journal,owner,committed:()=>{},emit:()=>{},failed:error=>{throw error;},beforeTerminalEmit:()=>{}});
 publisher.enqueue({kind:'status',status:'running'});await publisher.flush();
 let task=await actor.start(id,runId,commandId,publisher);
 task=await publisher.checkpointTask(work=>createTaskState({...work,transaction:fn=>fn(work)},{sanitize:async t=>t}).propose(owner,task.id,task.revision,{expectedRevision:0,reason:'核对选定试卷',steps:[{id:'export',text:'读取确认卷并导出',dependsOn:[],criterionIds:['teacher_request'],reported:'in_progress'}]}));
 if(settled)task=await actor.finish(task,publisher,true);
 publisher.enqueue({kind:'status',status:'interrupted',error:'cancelled'});await publisher.flush();
 db.prepare("UPDATE ai_agent_runs SET status='failed' WHERE id=?").run(runId);
 db.prepare("UPDATE xiaozhi_pi_commands SET status='finished' WHERE command_id=?").run(commandId);
 return {id,task,owner,resume:{schema:'xiaozhi.task.v1',sessionId:id,taskId:task.id,revision:task.revision,requirementsVersion:task.requirementsVersion,commandId:'xicmd_'+randomUUID()},continuation:{taskId:task.id,requirementsVersion:task.requirementsVersion}};
}
try{
 await state.init();await host.skillCatalog();
 const commandId='xicmd_'+randomUUID(),runId='unit-existing-run';
 await state.claimCommand(commandId,sessionId,commandHash(binding));await state.bindCommand(commandId,runId);
 await check('actual host reuses the original command/run for the same canonical binding',async()=>{
  assert.deepEqual(await host.start({sessionId,prompt,commandId,paperExportIntent:binding}),{ok:true,runId});assert.equal(reviewed.length,0);
 });
 await check('actual host rejects same command with changed identity/digest/specification or removed binding',async()=>{
  for(const patch of [{paperId:'xipaper_'+randomUUID()},{digest:'b'.repeat(64)},{audience:'teacher'},{format:'pdf'},{template:'answer_sheet'}])
   assert.equal((await host.start({sessionId,prompt,commandId,paperExportIntent:{...binding,...patch}})).error,'command_conflict');
  assert.equal((await host.start({sessionId,prompt,commandId})).error,'command_conflict');assert.equal(reviewed.length,0);
 });
 await check('actual host retains the historical unbound request hash byte-for-byte',async()=>{
  const commandId='xicmd_'+randomUUID();await state.claimCommand(commandId,sessionId,commandHash());await state.bindCommand(commandId,runId);
  assert.deepEqual(await host.start({sessionId,prompt,commandId}),{ok:true,runId});
 });
 await check('actual host refuses bound compact/goal/continuation/attachment combinations before admission',async()=>{
  const input={sessionId,prompt,commandId:'xicmd_'+randomUUID(),paperExportIntent:binding};
  assert.equal((await host.start(input,'compact')).error,'invalid_input');
  assert.equal((await host.start(input,'prompt','goal')).error,'invalid_input');
  assert.equal((await host.start({...input,prompt:'继续'})).error,'paper_export_restart_required');
  for(const patch of [{continueTask:{taskId:'xitask_'+'1'.repeat(64),requirementsVersion:1}},{attachments:[]}])assert.equal((await host.start({...input,...patch})).error,'invalid_input');
 });
 await check('actual host rejects archived and unauthorized/wrong-session snapshots with no new command/run',async()=>{
  archived=true;const commandId='xicmd_'+randomUUID();assert(!(await host.start({sessionId,prompt,commandId,paperExportIntent:binding})).ok);assert.equal(await state.command(commandId),undefined);archived=false;
  for(const failure of ['permission_denied','not_found','source_changed','conflict']){
   reviewFailure=failure;const commandId='xicmd_'+randomUUID();assert(!(await host.start({sessionId,prompt,commandId,paperExportIntent:binding})).ok);assert.equal(await state.command(commandId),undefined);
  }
  reviewFailure=undefined;assert.equal(reviewed.length,4);assert(reviewed.every(r=>r.id===binding.paperId&&r.sessionId===sessionId));
 });
 await check('bound stale-source preflight has a dedicated recovery message, distinct from same-command hash conflict, and no writes/run/model',async()=>{
  const before=changes();
  for(const patch of [{exportCurrent:false},{digest:'b'.repeat(64)},{sourceCurrent:false},{state:'rejected'},{complete:false}]){
   reviewPatch=patch;const commandId='xicmd_'+randomUUID();
   assert.deepEqual(await host.start({sessionId,prompt,commandId,paperExportIntent:binding}),{ok:false,error:'paper_export_source_changed'});
   assert.equal(await state.command(commandId),undefined);
  }
  reviewPatch=undefined;
  reviewPatch={exportCurrent:false};const priorReads=reviewed.length;
  assert.equal((await host.start({sessionId,prompt:prompt+'（改动文本）',commandId,paperExportIntent:binding})).error,'command_conflict');
  assert.equal(reviewed.length,priorReads,'Known command hash conflict is not recategorized by current paper state');
  reviewPatch=undefined;
  for(const failure of ['source_changed','not_confirmed','not_found','conflict']){
   reviewFailure=failure;const commandId='xicmd_'+randomUUID();
   assert.equal((await host.start({sessionId,prompt,commandId,paperExportIntent:binding})).error,'paper_export_source_changed');
   assert.equal(await state.command(commandId),undefined);
  }
  reviewFailure='permission_denied';
  assert.equal((await host.start({sessionId,prompt,commandId:'xicmd_'+randomUUID(),paperExportIntent:binding})).error,'permission_denied');
  reviewFailure=undefined;
  assert.equal(changes(),before);
  assert.equal(XIAOZHI_ERRORS.paper_export_source_changed,'这份确认卷已被替代或来源已变化，尚未发起导出。请回到组卷重新核对并准备请求；原输入和文件保留。');
  assert.equal(XIAOZHI_ERRORS.command_conflict,'这条发送记录与消息内容不一致，请重新发送。');
 });
 const bound=await interruptedTask(binding);
 await check('actual host refuses explicit continueTask, plain continue and resumeTask from original bound metadata before any command/run/tool/write',async()=>{
  const before=changes(),reads=reviewed.length;
  const inputs=[{sessionId:bound.id,commandId:'xicmd_'+randomUUID(),prompt:'接着完成导出',continueTask:bound.continuation},{sessionId:bound.id,commandId:'xicmd_'+randomUUID(),prompt:'继续'}];
  for(const input of inputs){assert.deepEqual(await host.start(input),{ok:false,error:'paper_export_restart_required'});assert.equal(await state.command(input.commandId),undefined);}
  assert.deepEqual(await host.resumeTask(bound.resume),{ok:false,error:'paper_export_restart_required'});assert.equal(await state.command(bound.resume.commandId),undefined);
  assert.equal(changes(),before);assert.equal(reviewed.length,reads,'Continuation never reads A or a newer B as a fresh export');
 });
 await check('actual coordinator independently refuses all three continuations without a checkpoint or task/event mutation',async()=>{
  const runId='run_'+randomUUID();db.prepare('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?)').run('aimsg_'+randomUUID(),bound.id,'user','继续',JSON.stringify({agentRunId:runId,piVersion:'xiaozhi.pi.education.v1'}));
  const publisher={checkpointTask:()=>assert.fail('Rejected task cannot checkpoint'),owner:bound.owner},before=changes();
  for(const work of [()=>actor.start(bound.id,runId,'xicmd_'+randomUUID(),publisher,bound.continuation),()=>actor.start(bound.id,runId,'xicmd_'+randomUUID(),publisher),()=>actor.prepareResume(bound.resume),()=>actor.resume(bound.resume,publisher)])await assert.rejects(work,/^Error: paper_export_restart_required$/);
  assert.equal(changes(),before);assert.deepEqual(await actor.committed(bound.id),bound.task);
  const snapshot=await actor.snapshot({sessionId:bound.id});assert(snapshot.ok);assert.equal(snapshot.value.canResume,false);
 });
 await check('bound interrupted journal with an unrecovered active task is rejected before even a recovery event is written',async()=>{
  const f=await interruptedTask(binding,false),before=changes();
  for(const input of [{sessionId:f.id,commandId:'xicmd_'+randomUUID(),prompt:'继续'},{sessionId:f.id,commandId:'xicmd_'+randomUUID(),prompt:'完成任务',continueTask:f.continuation}])
   assert.deepEqual(await host.start(input),{ok:false,error:'paper_export_restart_required'});
  assert.deepEqual(await host.resumeTask(f.resume),{ok:false,error:'paper_export_restart_required'});
  assert.equal(changes(),before);assert.equal((await actor.committed(f.id)).state,'active');
 });
 await check('ordinary unbound task retains all three preflight continuations without creating state',async()=>{
  const plain=await interruptedTask(),before=changes();
  await actor.assertContinuationAllowed(plain.id,'继续');await actor.assertContinuationAllowed(plain.id,'接着完成',plain.continuation);
  assert.deepEqual(await actor.prepareResume(plain.resume),plain.task);assert.equal(changes(),before);
  assert.equal((await actor.snapshot({sessionId:plain.id})).value.canResume,true);
 });
 console.log(JSON.stringify({success:true,passed,output,scope:'Actual production-host admission and existing command SQLite state; disposable synthetic schema, no run/model/Office execution'}));
}finally{globalThis.fetch=fetchBefore;await host.close();db.close();}
