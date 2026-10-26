import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const {createPiControlState}=await import('../../src/main/xiaozhi-agent/control-state.ts');
const {createPiControlCoordinator}=await import('../../src/main/xiaozhi-agent/control-tools.ts');
const {createEventJournal}=await import('../../src/main/xiaozhi-agent/events/journal.ts');
const {createEventPublisher}=await import('../../src/main/xiaozhi-agent/events/publisher.ts');
const {createToolExecutionBoundary}=await import('../../src/main/xiaozhi-agent/tools/execution-bound.ts');
const {SessionExecutionRegistry}=await import('../../src/main/xiaozhi-agent/vendor/hana/lib/session-execution-registry.ts');
const {nativePlanId}=await import('../../src/main/xiaozhi-agent/plan-service.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-task-before-'));
const report={success:false,checks:[],boundary:'Before-B2 counterexamples on actual plan CAS/journal and tool execution boundary. Underlying tool is an owned synthetic marker write, NOT a domain authorization bypass or provider/UI acceptance.'};
const db=new DatabaseSync(path.join(output,'app.db'));
db.exec('CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY);CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY)');
const sql={all:async(q,v=[])=>db.prepare(q).all(...v),run:async(q,v=[])=>db.prepare(q).run(...v),change:async(q,v=[])=>Number(db.prepare(q).run(...v).changes),transaction:async fn=>{db.exec('BEGIN IMMEDIATE');try{const value=await fn(sql);db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}}};
const sessionId='aisession_'+randomUUID(),runId='run_task_before';
db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(sessionId);
db.prepare('INSERT INTO ai_agent_runs VALUES(?)').run(runId);
const state=createPiControlState(sql);await state.migrateControls();
const journal=createEventJournal(sql);await journal.migrate();
const owner=await journal.begin(sessionId,runId,{id:runId,status:'running',items:[]});
const publisher=createEventPublisher({journal,owner,committed:()=>{},emit:()=>{},failed:()=>{},beforeTerminalEmit:()=>{}});
const coordinator=createPiControlCoordinator({store:{xiaozhiState:{...state,sql},sanitizeProblemText:async text=>({sanitizedText:text})},isCurrent:()=>true,emit:(_s,_r,e)=>publisher.enqueue(e),flush:()=>publisher.flush(),resume:async()=>({ok:false,error:'configuration'})});
async function check(id,name,fn){try{await fn();report.checks.push({id,name,pass:true});}catch(e){report.checks.push({id,name,pass:false,error:String(e.stack||e)});}}
try{
 const proposed={schemaVersion:'xiaozhi.plan.v2',expectedRevision:0,reason:'模型报告已经读完资料，继续生成讲义',basisCallIds:[],steps:[{id:'read',text:'读取并核对资料',status:'completed',dependsOn:[]},{id:'write',text:'生成教师讲义',status:'in_progress',dependsOn:['read']}]};
 const result=JSON.parse((await coordinator.tools(sessionId,runId)[0].execute('call_before_plan',proposed,new AbortController().signal)).content[0].text);
 report.plan=result;
 await check('TASK-03','A model completion report must have independent criterion evidence before a step can satisfy dependencies',async()=>{
  assert.equal(result.stepVerification,'verified','v2 explicitly reports not_checked; completed cannot serve as independent acceptance');
 });
 let invoked=0;
 const marker=path.join(output,'synthetic-effect.txt');
 const boundary=createToolExecutionBoundary({sessionId,workspaceKey:output,registry:new SessionExecutionRegistry(),epoch:()=>runId,current:()=>true,waiting:()=>false,onWaiting:()=>()=>{},attempt:async()=>{},beforeDelivery:async()=>{}});
 const def={name:'office_create_text',label:'Owned marker',description:'Synthetic dispatch witness, not the domain save tool',parameters:{type:'object',properties:{},additionalProperties:false},execute:async()=>{invoked++;fs.writeFileSync(marker,'Actual synthetic tool dispatch');return {content:[{type:'text',text:'saved marker'}],details:{success:true}};}};
 const dispatched=await boundary.execute(def,'call_before_write',{},new AbortController().signal,undefined,undefined);
 report.dispatch={invoked,markerWritten:fs.existsSync(marker),success:dispatched.details?.success};
 await check('TASK-04','Actual dispatcher must refuse an effect whose prerequisite has no independent result verification',async()=>{
  assert.equal(invoked,0,'No task dependency check currently exists at the production execution boundary');
 });
 await check('TASK-07','The production native plan identity must survive a run change (identity-level counterexample, no cold UI claim)',async()=>{
  assert.equal(nativePlanId(runId),nativePlanId('run_task_resumed'),'v2 identity is derived from runId rather than a persistent task');
 });
 report.success=report.checks.every(c=>c.pass);
 if(!report.success)process.exitCode=1;
}catch(e){report.error=String(e.stack||e);process.exitCode=1;}
finally{db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.map(({id,pass})=>({id,pass})),output,error:report.error}));}
