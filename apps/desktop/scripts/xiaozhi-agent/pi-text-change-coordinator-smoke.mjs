import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { createAssistantMessageEventStream } from '@earendil-works/pi-ai';
const {createTextChangeState,changeSummary}=await import('../../src/main/xiaozhi-agent/text-change-state.ts');
const {createTextChangeService}=await import('../../src/main/xiaozhi-agent/text-change-service.ts');
const {createTextChangeCoordinator}=await import('../../src/main/xiaozhi-agent/text-change-coordinator.ts');
const {registerTextChangeIpc}=await import('../../src/main/xiaozhi-agent/text-change-api.ts');
const {createPiXiaozhiSession}=await import('../../src/main/xiaozhi-agent/pi-session.ts');
const {getPiProtectedContext}=await import('../../src/main/xiaozhi-agent/compaction-context.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-text-coordinator-'));
const workspace=path.join(output,'workspace'),dataRoot=path.join(output,'data'),stateRoot=path.join(output,'sdk');
for(const root of[workspace,dataRoot,stateRoot])fs.mkdirSync(root);
const db=new DatabaseSync(path.join(dataRoot,'ledger.db')),sessionId=`aisession_${randomUUID()}`,other=`aisession_${randomUUID()}`;
db.exec('CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY)');for(const id of[sessionId,other])db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(id);
const state=createTextChangeState({all:async(s,v=[])=>db.prepare(s).all(...v),run:async(s,v=[])=>db.prepare(s).run(...v),change:async(s,v=[])=>Number(db.prepare(s).run(...v).changes)});await state.migrate();
let current=true,grant=workspace;const events=[];
const service=createTextChangeService({state,dataRoot,workspace:async()=>grant,isCurrent:()=>current});
const coordinator=createTextChangeCoordinator({state,service,isCurrent:()=>current,emit:(_s,_r,e)=>events.push(e),sanitize:async v=>v.replaceAll('原文秘密','[已脱敏]')});
const runId='owned-production-run',tools=coordinator.tools(sessionId,runId,action=>action());
const decide=(row,action,extra={})=>coordinator.decide({schemaVersion:'xiaozhi.change.v1',sessionId,changeId:row.id,revision:row.revision,action,...extra});
const until=async test=>{const end=Date.now()+5000;while(Date.now()<end){const value=await test();if(value)return value;await new Promise(r=>setTimeout(r,5));}throw new Error('Coordinator timeout');};
const pending=()=>until(async()=>{const rows=await state.list(sessionId);return rows.find(r=>r.state==='pending');});
const checks=[],report={success:false,checks,boundary:'Real SDK/SQLite/FS/IPC handlers with injected model protocol. No provider or UI claim.'};
const check=async(name,fn)=>{await fn();checks.push({name,pass:true});console.log('PASS '+name);};let agent;
globalThis.fetch=async()=>{throw new Error('Network disabled in coordinator suite');};
try{
 await check('Waiter is installed before actionable event; local review, reject and safe receipt do not write',async()=>{
   const work=tools[0].execute('reject',{path:'原文秘密.md',content:'正文秘密'},new AbortController().signal);const row=await pending();
   assert(!fs.existsSync(path.join(workspace,row.path)));assert.equal((await coordinator.review({sessionId,changeId:row.id})).value.after,'正文秘密');
   assert((await decide(row,'reject')).ok);const result=await work;assert(result.isError);assert(!JSON.stringify(result).includes('原文秘密'));assert(!JSON.stringify(result).includes('正文秘密'));assert(!fs.existsSync(path.join(workspace,row.path)));
   for(const e of events){assert.deepEqual(Object.keys(e.change).sort(),['schemaVersion','id','runId','callId','path','operation','state','revision','beforeSha256','afterSha256'].sort());}
   assert(!JSON.stringify(changeSummary(await state.get(row.id))).includes('正文秘密'));
 });
 await check('Concurrent decisions, stale revision, cross-session and forged extra data cannot grant another write',async()=>{
   const work=tools[0].execute('approve',{path:'课件.md',content:'第一段\n保留行\n'},new AbortController().signal),row=await pending();
   assert(!(await decide(row,'approve',{sessionId:other})).ok);assert(!(await decide(row,'approve',{path:'注入.md'})).ok);assert(!(await decide(row,'approve',{revision:8})).ok);
   assert(!(await coordinator.review({sessionId:other,changeId:row.id})).ok);assert(!(await coordinator.review({sessionId,changeId:row.id,path:'伪造'})).ok);
   const responses=await Promise.all([decide(row,'approve'),decide(row,'reject')]);assert.equal(responses.filter(r=>r.ok).length,1);assert.equal((await work).isError,false);assert.equal(fs.readFileSync(path.join(workspace,'课件.md'),'utf8'),'第一段\n保留行\n');
 });
 await check('Edit goes through original Pi, post-approval apply, actual undo and conflict preservation',async()=>{
   const work=tools[1].execute('edit',{path:'课件.md',edits:[{oldText:'第一段',newText:'修订段'}]},new AbortController().signal),row=await pending();
   const review=await coordinator.review({sessionId,changeId:row.id});assert.match(review.value.patch,/修订段/);assert((await decide(row,'approve')).ok);assert(!(await work).isError);
   const applied=await state.get(row.id);assert.equal(applied.state,'applied');assert((await decide(applied,'undo')).ok);assert.equal(fs.readFileSync(path.join(workspace,'课件.md'),'utf8'),'第一段\n保留行\n');
   const create=(await state.list(sessionId)).find(r=>r.callId==='approve');fs.writeFileSync(path.join(workspace,'课件.md'),'教师手改');const conflict=await decide(create,'undo');assert(conflict.ok);assert.equal(conflict.value.state,'undo_conflict');assert.equal(fs.readFileSync(path.join(workspace,'课件.md'),'utf8'),'教师手改');
 });
 await check('Native signal stop invalidates pending review, releases waiter and cannot replay after recovery',async()=>{
   const controller=new AbortController(),work=tools[0].execute('stop',{path:'停止.txt',content:'不能提交'},controller.signal),row=await pending();current=false;controller.abort();await assert.rejects(work,/cancelled/);await state.recover();
   assert.equal((await state.get(row.id)).state,'interrupted');assert(!(await decide(row,'approve')).ok);assert(!fs.existsSync(path.join(workspace,row.path)));current=true;
 });
 await check('Revoked directory and invalid tool parameters fail without raw content/root in model errors',async()=>{
   const work=tools[0].execute('revoked',{path:'撤权.txt',content:'秘密'},new AbortController().signal),row=await pending();grant=null;assert(!(await decide(row,'approve')).ok);await coordinator.cancel(runId);await work;grant=workspace;
   for(const input of[{path:'../越权.txt',content:'秘密'},{path:'坏.txt',content:'秘密',operation:'create'},{path:'坏.txt',content:'秘密',extra:true}]){const result=await tools[0].execute(randomUUID(),input,new AbortController().signal);assert(result.isError);assert(!JSON.stringify(result).includes(workspace));assert(!JSON.stringify(result).includes('秘密'));}
 });
 await check('Only main frame IPC reaches review/decisions; denied calls make no service invocation',async()=>{
   const handlers=new Map();let calls=0;registerTextChangeIpc({ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},allowed:event=>event.main===true,host:{reviewTextChange:async()=>{calls++;return{ok:true};},decideTextChange:async()=>{calls++;return{ok:true};}}});
   for(const fn of handlers.values()){assert.equal((await fn({main:false},{})).error,'permission_denied');assert.equal(calls,0);}
   assert((await handlers.get('xiaozhi:change-review')({main:true},{})).ok);assert.equal(calls,1);
 });
 await check('Compaction preserves only safe current outcome indexes, exclusion prevents old changes revival',async()=>{
   const fake={xiaozhiState:{controls:async()=>[],approvals:async()=>[],changes:state},getAiConversationSession:async()=>({messages:[]}),sanitizeProblemText:async text=>({sanitizedText:text})};
   const context=await getPiProtectedContext(fake,sessionId);assert.match(context,/文件修改/);assert(!context.includes('before'));assert(!context.includes('正文秘密'));assert(!context.includes('@@'));assert.equal(await getPiProtectedContext(fake,sessionId,[runId]),'');
 });
 await check('Old native creation fingerprint remains unchanged when adding registered office capability and execution-once',async()=>{
   agent=await createPiXiaozhiSession({stateRoot,workspace,apiKey:'synthetic-no-provider',model:'deepseek-chat',approveCopy:async()=>false});
   const inject=queue=>{agent.session.agent.streamFn=model=>{const next=queue.shift();assert(next);const stream=createAssistantMessageEventStream(),message={role:'assistant',api:model.api,provider:model.provider,model:model.id,content:[],timestamp:Date.now(),usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},...next};stream.push({type:'done',reason:message.stopReason,message});stream.end();return stream;};};
   const end={stopReason:'stop',content:[{type:'text',text:'实际回执。'}]};inject([end]);assert((await agent.prompt('旧会话保存')).ok);const file=agent.sessionFile,before=fs.readFileSync(file),snapshot=agent.session.sessionManager.getBranch().find(e=>e.type==='custom'&&e.customType==='xiaozhi.education.snapshot.v1');await agent.dispose();
   let count=0;agent=await createPiXiaozhiSession({stateRoot,workspace,sessionFile:file,apiKey:'synthetic-no-provider',model:'deepseek-chat',approveCopy:async()=>false,officeTextTools:()=>['office_create_text','office_edit_text'].map(name=>({name,label:name,description:name,parameters:{type:'object',properties:{},additionalProperties:false},execute:async()=>{count++;return{content:[{type:'text',text:'已核验'}],details:{success:true}};}}))});
   assert.deepEqual(agent.session.sessionManager.getBranch().find(e=>e.type==='custom'&&e.customType==='xiaozhi.education.snapshot.v1'),snapshot);assert(fs.readFileSync(file).subarray(0,before.length).equals(before));
   assert(agent.session.getActiveToolNames().includes('office_edit_text'));const call={type:'toolCall',id:'same-call',name:'office_create_text',arguments:{}};inject([{stopReason:'toolUse',content:[call,call]},end]);assert((await agent.prompt('原循环重复调用')).ok);assert.equal(count,1);assert.equal(agent.diagnostics().executing,0);
   await agent.dispose();agent=undefined;await assert.rejects(createPiXiaozhiSession({stateRoot,workspace,sessionFile:file,apiKey:'synthetic-no-provider',model:'deepseek-chat',approveCopy:async()=>false}),/configuration/);
 });
 report.success=true;
}catch(error){report.error=String(error.stack).slice(0,2500);process.exitCode=1;}
finally{await agent?.dispose();db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,error:report.error,report:path.relative(process.cwd(),path.join(output,'report.json'))}));}
