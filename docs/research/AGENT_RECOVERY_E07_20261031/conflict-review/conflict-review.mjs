import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const {createTextChangeState,changeHash}=await import('../../src/main/xiaozhi-agent/text-change-state.ts');
const {createTextChangeService}=await import('../../src/main/xiaozhi-agent/text-change-service.ts');
const {createTextChangeCoordinator}=await import('../../src/main/xiaozhi-agent/text-change-coordinator.ts');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'omni-edu-conflict-review-')),workspace=path.join(root,'workspace'),dataRoot=path.join(root,'data');
fs.mkdirSync(workspace);fs.mkdirSync(dataRoot);
const db=new DatabaseSync(path.join(dataRoot,'ledger.db')),sessionId=`aisession_${randomUUID()}`,other=`aisession_${randomUUID()}`;
db.exec('CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY)');db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(sessionId);
const sql={run:async(s,v=[])=>db.prepare(s).run(...v),change:async(s,v=[])=>Number(db.prepare(s).run(...v).changes),all:async(s,v=[])=>db.prepare(s).all(...v)};
const state=createTextChangeState(sql);await state.migrate();let grant=workspace;
const service=createTextChangeService({state,dataRoot,workspace:async()=>grant,isCurrent:()=>true});
const report={ok:false,checks:[],boundary:'Original Pi text edit algorithm, actual SQLite/files/authority, on-demand local conflict review. No model requests or UI; formal UI recorded separately.'};
const check=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS '+name);};
const target=path.join(workspace,'课堂.md'),original='导入2分钟\n探究5分钟\n检查3分钟\n';
const propose=(oldText='探究5分钟',newText='探究6分钟')=>service.propose(sessionId,'owned-run',randomUUID(),{operation:'edit',path:'课堂.md',edits:[{oldText,newText}]});
const decision=(row,action)=>service.decision({schemaVersion:'xiaozhi.change.v1',sessionId,changeId:row.id,revision:row.revision,action});
try{
 await check('Approval-time and installation-time conflicts retain original/proposed/current contents; refresh is read-only and old approvals never apply',async()=>{
  for(const when of ['before','after']){
   fs.writeFileSync(target,original);let row=await propose();assert.equal((await service.review(sessionId,row.id)).currentFile,undefined);
   if(when==='after')row=await decision(row,'approve');fs.writeFileSync(target,'教师手改');
   const conflict=when==='before'?await decision(row,'approve'):await service.apply(sessionId,row.id);assert.equal(conflict.state,'conflict');
   const ledger=await state.get(row.id),stat=fs.statSync(target),r=await service.review(sessionId,row.id);
   assert.equal(r.before,original);assert.equal(r.after,original.replace('探究5分钟','探究6分钟'));assert.equal(r.currentFile.content,'教师手改');assert.equal(r.currentFile.sha256,changeHash('教师手改'));assert(Number.isFinite(Date.parse(r.currentFile.readAt)));
   assert.equal(fs.statSync(target).mtimeMs,stat.mtimeMs);assert.deepEqual(await state.get(row.id),ledger);
   fs.writeFileSync(target,'教师再次修改');const next=await service.review(sessionId,row.id);assert.equal(next.currentFile.content,'教师再次修改');assert.equal(r.currentFile.content,'教师手改');assert.deepEqual(await state.get(row.id),ledger);
   await assert.rejects(service.apply(sessionId,row.id),/conflict/);const fresh=await propose('教师再次修改','新要求');assert.equal(fresh.state,'pending');assert.notEqual(fresh.id,row.id);assert.equal((await service.review(sessionId,fresh.id)).before,'教师再次修改');
   assert.equal(fs.readFileSync(target,'utf8'),'教师再次修改');
  }
 });
 await check('Missing/non-file/oversized/invalid UTF8 current targets retain historical sides, without truncation or false readable content',async()=>{
  fs.writeFileSync(target,original);const row=await propose();fs.writeFileSync(target,'教师手改');await decision(row,'approve');
  for(const [status,reason,setup] of [
   ['missing',undefined,()=>fs.unlinkSync(target)],['unavailable','permission_denied',()=>fs.mkdirSync(target)],
   ['unavailable','too_large',()=>{fs.rmdirSync(target);fs.writeFileSync(target,Buffer.alloc(65537,65));}],
   ['unavailable','unsupported',()=>fs.writeFileSync(target,Buffer.from([0xff,0xfe]))],
  ]){setup();const r=await service.review(sessionId,row.id);assert.equal(r.currentFile.state,status);assert.equal(r.currentFile.reason,reason);assert(!('content' in r.currentFile));assert.equal(r.before,original);assert.match(r.after,/探究6分钟/);}
 });
 await check('Moved parent directory does not hide original diff or proposal',async()=>{
  const dir=path.join(workspace,'子目录');fs.mkdirSync(dir);fs.writeFileSync(path.join(dir,'源.md'),'旧稿');
  const row=await service.propose(sessionId,'owned-run','nested',{operation:'edit',path:'子目录/源.md',edits:[{oldText:'旧稿',newText:'新稿'}]});
  fs.writeFileSync(path.join(dir,'源.md'),'教师改稿');await decision(row,'approve');fs.renameSync(dir,path.join(workspace,'移走的目录'));
  const r=await service.review(sessionId,row.id);assert.equal(r.currentFile.state,'missing');assert.equal(r.before,'旧稿');assert.equal(r.after,'新稿');assert.match(r.diff,/新稿/);
 });
 await check('Undo conflict exposes current file and never undoes teacher changes',async()=>{
  fs.writeFileSync(target,original);const row=await propose();await decision(row,'approve');const applied=await service.apply(sessionId,row.id);fs.writeFileSync(target,'撤销前教师保留稿');
  const conflict=await decision(applied,'undo');assert.equal(conflict.state,'undo_conflict');const r=await service.review(sessionId,row.id);assert.equal(r.currentFile.content,'撤销前教师保留稿');assert.equal(r.before,original);
 });
 await check('Authority/session/hard-link guards remain; unauthorized current text cannot leak through review',async()=>{
  fs.writeFileSync(target,original);const row=await propose();fs.writeFileSync(target,'教师修改');await decision(row,'approve');
  await assert.rejects(service.review(other,row.id),/permission_denied/);
  const outside=path.join(root,'private.md');fs.writeFileSync(outside,'不可读哨兵');fs.unlinkSync(target);fs.linkSync(outside,target);
  const r=await service.review(sessionId,row.id);assert.equal(r.currentFile.state,'unavailable');assert.equal(r.currentFile.reason,'permission_denied');assert(!JSON.stringify(r).includes('不可读哨兵'));
  grant=path.join(root,'other');fs.mkdirSync(grant);await assert.rejects(service.review(sessionId,row.id),/permission_denied/);grant=workspace;
 });
 await check('Original coordinator conflict receipt asks for latest read; local current/before/proposed contents are not model payloads',async()=>{
  fs.unlinkSync(target);fs.writeFileSync(target,original);
  const coordinator=createTextChangeCoordinator({state,service,isCurrent:()=>true,sanitize:async v=>v,emit:()=>{}});
  const tool=coordinator.tools(sessionId,'owned-run',async action=>action()).find(t=>t.name==='office_edit_text');
  const pending=tool.execute('owned-model-call',{path:'课堂.md',edits:[{oldText:'探究5分钟',newText:'探究6分钟'}]},new AbortController().signal);
  let row;for(let n=0;n<100;n++){row=await state.call(sessionId,'owned-run','owned-model-call');if(row)break;await new Promise(r=>setTimeout(r,5));}
  assert(row);await new Promise(r=>setTimeout(r,10));fs.writeFileSync(target,'教师冲突隐私文本');const result=await coordinator.decide({schemaVersion:'xiaozhi.change.v1',sessionId,changeId:row.id,revision:row.revision,action:'approve'});assert(result.ok);assert.equal(result.value.state,'conflict');
  const receipt=await pending,text=JSON.stringify(receipt);assert(receipt.isError);assert.match(text,/先读取当前文件/);assert(!text.includes('教师冲突隐私文本'));assert(!text.includes(original));assert(!text.includes('currentFile'));assert.equal(fs.readFileSync(target,'utf8'),'教师冲突隐私文本');
 });
 report.ok=true;
}catch(error){report.error=error.stack;process.exitCode=1;console.error(report.error);}finally{db.close();fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,error:report.error,root}));}
