import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {OmniEduStore} from '../../src/main/db';
import {createTaskCoordinator} from '../../src/main/xiaozhi-agent/tasks/coordinator';
import {createEventPublisher} from '../../src/main/xiaozhi-agent/events/publisher';
import {legacyVerification} from '../../src/shared/xiaozhi-verification';
import {TASK_SCHEMA,type TaskReviewInput} from '../../src/shared/xiaozhi-task';

const output=process.argv[2],data=path.join(output,'data');
const report:{success:boolean;checks:{name:string;pass:boolean}[];boundary:string;error?:string;taskId?:string}={success:false,checks:[],boundary:'Actual OmniEduStore/SQLite production transaction adapter, coordinator, journal and cold reopen in Electron. User/assistant content is explicitly synthetic; no model or rendered teacher acceptance.'};
let store=new OmniEduStore(data);const live=new Set<string>();
const actor=()=>createTaskCoordinator({store,closing:()=>false,busy:id=>live.has(id),running:id=>live.has(id),emit:()=>{}});
const check=(name:string)=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
try{
 await store.init();let sql=store.xiaozhiState.sql;
 await sql.transaction!(async work=>{
  assert.equal(typeof work.change,'function');
  assert.equal(await work.change!('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',['h05_owned_cas','{"version":1}',new Date().toISOString()]),1);
  assert.equal(await work.change!('UPDATE app_settings SET value_json=? WHERE key=? AND value_json=?',['{"version":2}','h05_owned_cas','{"version":1}']),1);
  assert.equal(await work.change!('UPDATE app_settings SET value_json=? WHERE key=? AND value_json=?',['{"version":3}','h05_owned_cas','{"version":1}']),0);
  assert.equal((await work.all('SELECT value_json FROM app_settings WHERE key=?',['h05_owned_cas']))[0].value_json,'{"version":2}');
 });check('Actual production transaction callback exposes same-connection CAS with accurate changed-row counts');
 await assert.rejects(sql.transaction!(async work=>{await work.change!('UPDATE app_settings SET value_json=? WHERE key=?',['rollback','h05_owned_cas']);await work.run('INSERT INTO app_settings VALUES(?,?,?)',['h05_owned_rollback','created',new Date().toISOString()]);throw Error('owned rollback');}),/owned rollback/);
 assert.equal((await sql.all('SELECT value_json FROM app_settings WHERE key=?',['h05_owned_cas']))[0].value_json,'{"version":2}');assert.equal((await sql.all('SELECT * FROM app_settings WHERE key=?',['h05_owned_rollback'])).length,0);check('Production callback change and run roll back together without a second connection escape');
 const id=(await store.createAiConversationSession({title:'H05独立事务回归',folderId:null})).session.id;
 const runId=await store.startAiAgentRun({sessionId:id,prompt:'合成课堂任务',route:'knowledge_retrieval',subIntent:'pi_education'}),commandId='xicmd_'+randomUUID();
 assert(await store.xiaozhiState.claimCommand(commandId,id,'1'.repeat(64)));await store.xiaozhiState.bindCommand(commandId,runId);
 await store.appendAiConversationMessage(id,{role:'user',content:'合成课堂任务：请整理观察问题。',metadata:{agentRunId:runId,piVersion:'xiaozhi.pi.education.v1'}});
 const journal=store.xiaozhiState.eventJournal,owner=await journal.begin(id,runId,{id:runId,status:'running',items:[]});live.add(id);
 const publisher=createEventPublisher({journal,owner,committed:()=>{},emit:()=>{},failed:()=>{},beforeTerminalEmit:()=>live.delete(id)});publisher.enqueue({kind:'status',status:'running'});await publisher.flush();
 let coordinator=actor();const task=await coordinator.start(id,runId,commandId,publisher);assert.equal((await coordinator.committed(id))?.id,task.id);assert.equal(task.state,'active');report.taskId=task.id;check('Actual store starts a stable task and commits its private state, journal and outbox atomically');
 const verification={...legacyVerification(runId),state:'needs_human' as const,reason:'human_review' as const,checks:[{id:'answer:human',state:'needs_human' as const,evidenceIds:[]}]};
 await store.appendAiConversationMessage(id,{role:'assistant',content:'这是一条声明的合成回复，不能作为真实模型验收。',metadata:{agentRunId:runId,piVersion:'xiaozhi.pi.education.v1',ok:true,status:'completed',verification}});
 await sql.run("UPDATE ai_agent_runs SET status='succeeded' WHERE id=?",[runId]);await store.xiaozhiState.finishCommand(commandId);const settled=await coordinator.finish(task,publisher,false);publisher.enqueue({kind:'status',status:'completed'});await publisher.flush();
 let snapshot=await coordinator.snapshot({sessionId:id});assert(snapshot.ok&&snapshot.value.candidate);assert(snapshot.value.canAccept);assert.equal(snapshot.value.task?.state,'review_required');check('Actual persisted candidate is review-required and never automatically teaching-verified');
 const input:TaskReviewInput={schema:TASK_SCHEMA,sessionId:id,taskId:task.id,revision:settled.revision,requirementsVersion:settled.requirementsVersion,requestId:'xitact_'+randomUUID(),candidate:snapshot.value.candidate,checked:settled.criteria.map(c=>({criterionId:c.id,version:c.version,accepted:true}))};
 const before=JSON.stringify(await sql.all('SELECT * FROM app_settings ORDER BY key')),count=(await sql.all('SELECT count(*) n FROM xiaozhi_event_journal'))[0].n;
 await sql.run("CREATE TRIGGER owned_h05_event_fail BEFORE INSERT ON xiaozhi_event_journal BEGIN SELECT RAISE(ABORT,'owned event failure'); END");
 const failed=await coordinator.review(input);assert(!failed.ok);assert.equal(JSON.stringify(await sql.all('SELECT * FROM app_settings ORDER BY key')),before);assert.equal((await sql.all('SELECT count(*) n FROM xiaozhi_event_journal'))[0].n,count);await sql.run('DROP TRIGGER owned_h05_event_fail');check('Real SQLite journal insertion failure rolls back teacher receipt, task and immutable history together');
 const accepted=await coordinator.review(input);assert(accepted.ok&&accepted.value.task);assert.equal(accepted.value.task.state,'completed');assert.equal((await sql.all('SELECT status FROM xiaozhi_event_runs WHERE run_id=?',[runId]))[0].status,'completed');const after=JSON.stringify(await sql.all('SELECT * FROM app_settings ORDER BY key')),events=(await sql.all('SELECT count(*) n FROM xiaozhi_event_journal'))[0].n;assert((await coordinator.review(input)).ok);assert.equal(JSON.stringify(await sql.all('SELECT * FROM app_settings ORDER BY key')),after);assert.equal((await sql.all('SELECT count(*) n FROM xiaozhi_event_journal'))[0].n,events);check('Teacher retry on the real store is exactly idempotent and keeps the original run terminal state');
 await store.close();store=new OmniEduStore(data);await store.init();sql=store.xiaozhiState.sql;coordinator=actor();snapshot=await coordinator.snapshot({sessionId:id});assert(snapshot.ok);assert.deepEqual(snapshot.value.task,accepted.value.task);assert.equal((await sql.all('SELECT count(*) n FROM xiaozhi_event_journal'))[0].n,events);check('Cold real-store initialization preserves the exact confirmation with no event replay');
 const current=accepted.value.task;const corrected=await coordinator.correct({schema:TASK_SCHEMA,sessionId:id,taskId:current.id,revision:current.revision,requirementsVersion:current.requirementsVersion,requestId:'xitact_'+randomUUID(),criteria:current.criteria.map(c=>({id:c.id,text:'改为适合初中生的观察问题'}))});assert(corrected.ok&&corrected.value.task);assert.equal(corrected.value.task.requirementsVersion,2);assert.deepEqual(corrected.value.task.checks,[]);assert.equal(corrected.value.task.state,'paused');assert.equal(corrected.value.task.reviewVerification,undefined);assert.equal((await sql.all('SELECT count(*) n FROM ai_agent_runs WHERE session_id=?',[id]))[0].n,1);check('Current teacher correction increments requirements and clears acceptance without another run');
 const revised=corrected.value.task,newRun=await store.startAiAgentRun({sessionId:id,prompt:'继续未完成内容',route:'knowledge_retrieval',subIntent:'pi_education'}),newCommand='xicmd_'+randomUUID();
 assert(await store.xiaozhiState.claimCommand(newCommand,id,'2'.repeat(64)));await store.xiaozhiState.bindCommand(newCommand,newRun);await store.appendAiConversationMessage(id,{role:'user',content:'请继续完成刚才未完成的教学任务，只补缺少部分，不重复已保存成果。',metadata:{agentRunId:newRun,piVersion:'xiaozhi.pi.education.v1'}});
 const nextOwner=await store.xiaozhiState.eventJournal.begin(id,newRun,{id:newRun,status:'running',items:[]}),nextPublisher=createEventPublisher({journal:store.xiaozhiState.eventJournal,owner:nextOwner,committed:()=>{},emit:()=>{},failed:()=>{},beforeTerminalEmit:()=>{}});
 const priorTask=await coordinator.committed(id),beforeBinding=(await sql.all('SELECT count(*) n FROM xiaozhi_event_journal'))[0].n;
 for(const target of[{taskId:'xitask_'+'f'.repeat(64),requirementsVersion:2},{taskId:revised.id,requirementsVersion:1}])await assert.rejects(coordinator.start(id,newRun,newCommand,nextPublisher,target),/task_resume_invalid/);
 assert.deepEqual(await coordinator.committed(id),priorTask);assert.equal((await sql.all('SELECT count(*) n FROM xiaozhi_event_journal'))[0].n,beforeBinding);check('Bound continuation rejects stale requirements or a different task before mutating the current task');
 const continued=await coordinator.start(id,newRun,newCommand,nextPublisher,{taskId:revised.id,requirementsVersion:2});assert.equal(continued.id,revised.id);assert.equal(continued.requirementsVersion,2);assert.deepEqual(continued.criteria,revised.criteria);assert.equal(continued.lastRunId,newRun);assert.notEqual(newRun,runId);assert.equal(continued.sources.length,revised.sources.length+1);assert.equal(continued.sources.at(-1)?.runId,newRun);check('Bound edited-prose continuation retains corrected task criteria/version while recording a new run, command and source');
 const continuedDone=await coordinator.finish(continued,nextPublisher,true);nextPublisher.enqueue({kind:'status',status:'failed',error:'transport'});await nextPublisher.flush();await store.close();store=new OmniEduStore(data);await store.init();coordinator=actor();assert.deepEqual(await coordinator.committed(id),continuedDone);check('Bound continuation lineage and the corrected requirements survive cold real-store initialization without replay');
 report.success=true;
}catch(e){report.error=String(e instanceof Error?e.stack:e);process.exitCode=1;}
finally{await store.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));}
