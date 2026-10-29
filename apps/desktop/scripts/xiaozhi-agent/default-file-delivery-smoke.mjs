import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {registerHooks} from 'node:module';
// Source-only host test: extraction utilities are exercised separately in Electron.
registerHooks({resolve(specifier,context,next){if(specifier==='electron')return {url:'data:text/javascript,export%20const%20utilityProcess%3D%7B%7D%3Bexport%20const%20app%3D%7BisPackaged%3Afalse%7D%3B',shortCircuit:true};return next(specifier,context);},load(url,context,next){if(url.endsWith('/xiaozhi-agent/ocr-runtime-manifest.json'))return {format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8')+';',shortCircuit:true};return next(url,context);}});
const {conversationOutput}=await import('../../src/main/xiaozhi-agent/conversation-output.ts');
const {createXiaozhiSessionState}=await import('../../src/main/xiaozhi-agent/session-state.ts');
const {createXiaozhiProductionHost}=await import('../../src/main/xiaozhi-agent/production-host.ts');
const {createTextChangeCoordinator}=await import('../../src/main/xiaozhi-agent/text-change-coordinator.ts');
const {createOfficeArtifactCoordinator}=await import('../../src/main/xiaozhi-agent/office-artifact-coordinator.ts');
const {createTextChangeService}=await import('../../src/main/xiaozhi-agent/text-change-service.ts');
const {createOfficeArtifactService}=await import('../../src/main/xiaozhi-agent/office-artifact-service.ts');
const {createWorkspaceFiles}=await import('../../src/main/xiaozhi-agent/workspace-files.ts');
const {createPiXiaozhiSession}=await import('../../src/main/xiaozhi-agent/pi-session.ts');
const {createEducationToolCatalog}=await import('../../src/main/xiaozhi-agent/education-tool-catalog.ts');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-default-files-'));
const dataRoot=path.join(output,'data');fs.mkdirSync(dataRoot);
const db=new DatabaseSync(path.join(dataRoot,'app.db'));
db.exec(`CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY);
CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,session_id TEXT,run_id TEXT,payload_json TEXT,action_type TEXT,status TEXT,updated_at TEXT);
CREATE TABLE document_artifacts(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,message_id TEXT NOT NULL,title TEXT NOT NULL,artifact_type TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,description TEXT NOT NULL,content_md TEXT NOT NULL,file_path TEXT NOT NULL,file_size INTEGER NOT NULL,content_hash TEXT NOT NULL,status TEXT NOT NULL,error_message TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
const ids=[`aisession_${randomUUID()}`,`aisession_${randomUUID()}`];for(const id of ids)db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(id);
const state=createXiaozhiSessionState({all:async(s,v=[])=>db.prepare(s).all(...v),run:async(s,v=[])=>db.prepare(s).run(...v),change:async(s,v=[])=>Number(db.prepare(s).run(...v).changes)});
const report={ok:false,checks:[],boundary:'Actual production file lease, SQLite/text/Office services, Pi native session and deterministic serialized provider traffic. No paid model, natural quality, teacher or installer acceptance.'};
const check=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS '+name);};
let host,agent,archived=false;const originalFetch=globalThis.fetch;
try{
 await state.init();
 host=createXiaozhiProductionHost({store:{questionReviews:{collections:{}},xiaozhiState:state,sanitizeProblemText:async text=>({sanitizedText:text}),getAiConversationSession:async()=>({session:{archivedAt:archived?'yes':''},messages:[]})},dataRoot,emit:()=>{}});
 await host.skillCatalog();
 const first=await host.resolveFileWorkspace(ids[0]),other=await host.resolveFileWorkspace(ids[1]);
 const files=createWorkspaceFiles(id=>host.resolveFileWorkspace(id));
 const request=(id,relative='.')=>({schemaVersion:'xiaozhi.files.v1',sessionId:id,requestId:`xifile_${randomUUID()}`,path:relative});
 await check('No-grant production lease creates distinct durable directories without creating a teacher grant',async()=>{
  assert.notEqual(first.path,other.path);assert(!first.path.startsWith(dataRoot+path.sep));assert.equal(await state.workspace(ids[0]),null);
  assert.deepEqual(await host.resolveFileWorkspace(ids[0]),first);assert((await files.list(request(ids[0]),new AbortController().signal)).ok);
  assert.throws(()=>conversationOutput(dataRoot,'../../private'),/invalid_input/);
 });
 const service=createTextChangeService({state:state.changes,dataRoot,workspace:async id=>(await host.resolveFileWorkspace(id)).path,isCurrent:()=>true});
 let saved;
 await check('Default text uses the real approval/version ledger and is listed/read only in its conversation',async()=>{
  const row=await service.propose(ids[0],'owned-run','text-1',{operation:'create',path:'课堂讲义.txt',content:'浮力：F浮=ρ液gV排。'});
  assert(!fs.existsSync(path.join(first.path,row.path)));
  await service.decision({schemaVersion:'xiaozhi.change.v1',sessionId:ids[0],changeId:row.id,revision:row.revision,action:'approve'});
  saved=await service.apply(ids[0],row.id);assert.equal(saved.state,'applied');
  const listing=await files.list(request(ids[0]),new AbortController().signal);assert.equal(listing.data.entries.length,1);
  const entry=listing.data.entries[0],preview=await files.preview({...request(ids[0],entry.path),version:entry.version,workspaceVersion:first.version},new AbortController().signal);
  assert.equal(preview.data.text,'浮力：F浮=ρ液gV排。');assert.equal((await files.list(request(ids[1]),new AbortController().signal)).data.entries.length,0);
  assert.equal((await files.preview({...request(ids[1],entry.path),version:entry.version,workspaceVersion:other.version},new AbortController().signal)).error,'not_found');
  await assert.rejects(service.propose(ids[0],'owned-run','text-2',{operation:'create',path:row.path,content:'覆盖'}),/conflict/);
 });
 await check('General HTML is reviewed, saved, previewed and locally edited with the same exact bytes',async()=>{
  const row=await service.propose(ids[0],'owned-run','html-1',{operation:'create',path:'浮力演示.html',content:'<!doctype html><html lang="zh-CN"><title>浮力实验</title><body><label>体积<input type="range" id="v" min="1" max="10"></label><output id="f">10 N</output><script>v.oninput=()=>f.textContent=v.value*10+" N";</script></body></html>'});
  const review=await service.review(ids[0],row.id);assert(review.after.includes('xiaozhi.html-artifact.v1'));assert(!fs.existsSync(path.join(first.path,row.path)));
  await service.decision({schemaVersion:'xiaozhi.change.v1',sessionId:ids[0],changeId:row.id,revision:row.revision,action:'approve'});assert.equal((await service.apply(ids[0],row.id)).state,'applied');
  assert.equal(fs.readFileSync(path.join(first.path,row.path),'utf8'),review.after);
  const listing=await files.list(request(ids[0]),new AbortController().signal),entry=listing.data.entries.find(v=>v.path===row.path);
  const preview=await files.preview({...request(ids[0],row.path),version:entry.version,workspaceVersion:first.version},new AbortController().signal);assert(preview.ok);assert.equal(preview.data.format,'html');assert.equal(preview.data.html,review.after);
  const edit=await service.propose(ids[0],'owned-run','html-edit',{operation:'edit',path:row.path,edits:[{oldText:'浮力实验',newText:'浮力探究'}]});
  await service.decision({schemaVersion:'xiaozhi.change.v1',sessionId:ids[0],changeId:edit.id,revision:edit.revision,action:'approve'});assert.equal((await service.apply(ids[0],edit.id)).state,'applied');
  assert(fs.readFileSync(path.join(first.path,row.path),'utf8').includes('浮力探究'));
  await assert.rejects(service.propose(ids[0],'owned-run','empty',{operation:'create',path:'空.txt',content:'   '}),/invalid_input/);
  await assert.rejects(service.propose(ids[0],'owned-run','huge',{operation:'create',path:'超限.html',content:'<!doctype html><html>'+('文'.repeat(22000))+'</html>'}),/too_large/);
 });
 const office=createOfficeArtifactService({state:state.officeArtifacts,dataRoot,workspace:async id=>(await host.resolveFileWorkspace(id)).path,isCurrent:()=>true});
 await check('Real editable Office bytes save in the default root after exact approval and survive service recreation',async()=>{
  const row=await office.propose(ids[0],'owned-run','office-1',{path:'浮力记录.xlsx',format:'xlsx',sources:[],draft:{schemaVersion:'xiaozhi.office-draft.v1',title:'浮力记录',sections:[{heading:'实验',paragraphs:['合成数据'],table:{columns:['排液体积','浮力'],rows:[[0.001,10]]}}]}});
  await office.decide({schemaVersion:'xiaozhi.office-artifact.v1',sessionId:ids[0],draftId:row.id,revision:row.revision,action:'approve'});
  const result=await office.apply(ids[0],row.id);assert.equal(result.state,'saved');assert(fs.readFileSync(path.join(first.path,row.path)).subarray(0,2).equals(Buffer.from('PK')));
  assert.equal((await state.officeArtifacts.get(row.id)).state,'saved');assert.equal(conversationOutput(dataRoot,ids[0]).path,first.path);
 });
 await check('Explicit teacher workspace still wins and archived conversations cannot resolve the default',async()=>{
  const selected=path.join(output,'teacher');fs.mkdirSync(selected);await state.setWorkspace(ids[1],selected,'教师目录');assert.equal((await host.resolveFileWorkspace(ids[1])).path,selected);
  archived=true;await assert.rejects(host.resolveFileWorkspace(ids[0]),/permission_denied/);archived=false;
 });
 await check('Core file generators remain discoverable with many tools',()=>{
  const defs=Array.from({length:35},(_,i)=>({name:`fixture_${i}`,description:'合成工具',parameters:{type:'object'},execute:async()=>({content:[]})}));
  for(const name of ['office_create_text','office_edit_text','office_create_document'])defs.push({...defs[0],name});
  const catalog=createEducationToolCatalog('',defs);for(const name of ['office_create_text','office_edit_text','office_create_document'])assert(catalog.exposed(name));
 });
 await check('Adding file output preserves existing native cwd/session identity and directs reads to generated files',async()=>{
  const stateRoot=path.join(output,'xiaozhi-pi',ids[0]),privateCwd=path.join(stateRoot,'workspace');fs.mkdirSync(privateCwd,{recursive:true});
  let read=false,warmup=true;const captures=[];
  globalThis.fetch=async(_url,init)=>{
   const body=JSON.parse(init.body);captures.push(body);const call=!warmup&&!read;read=true;
   const delta=call?{tool_calls:[{index:0,id:'read-generated',type:'function',function:{name:'office_read_text',arguments:JSON.stringify({path:'课堂讲义.txt'})}}]}:{content:'已读取本会话成果。'};
   return new Response('data: '+JSON.stringify({id:'local',object:'chat.completion.chunk',created:0,model:body.model,choices:[{index:0,delta:{role:'assistant',...delta},finish_reason:call?'tool_calls':'stop'}]})+'\n\ndata: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  };
  const base={stateRoot,workspace:privateCwd,privateWorkspaceId:ids[0],apiKey:'synthetic',model:'deepseek-flash',capabilities:{id:'deepseek-flash',name:'DeepSeek Flash',contextWindow:1048576,maxOutputTokens:32768,observedAt:new Date().toISOString(),source:'official'},limitsEnforced:false};
  agent=await createPiXiaozhiSession(base);assert((await agent.prompt('你好')).ok);const sessionFile=agent.sessionFile;await agent.dispose();agent=undefined;
  warmup=false;read=false;
  const texts=createTextChangeCoordinator({state:state.changes,service,isCurrent:()=>true,sanitize:async text=>text,emit:()=>{}});
  const artifacts=createOfficeArtifactCoordinator({state:state.officeArtifacts,service:office,isCurrent:()=>true,sanitize:async text=>text,emit:()=>{}});
  const events=[];agent=await createPiXiaozhiSession({...base,sessionFile,fileReadWorkspace:first.path,fileOutputWorkspace:first.path,officeTextTools:wait=>texts.tools(ids[0],'owned-run',wait),officeArtifactTools:wait=>artifacts.tools(ids[0],'owned-run',wait),onEvent:event=>events.push(event)});
  assert.equal(agent.sessionFile,sessionFile);const outcome=await agent.prompt('读取刚才的讲义');assert(outcome.ok,JSON.stringify({outcome,events:events.slice(-8)}));assert(captures.length>=3);for(const name of ['office_create_text','office_create_document'])assert(captures.at(-1).tools.some(t=>t.function.name===name));
  assert(events.some(e=>e.kind==='tool_end'&&e.tool==='office_read_text'&&!e.failed));
  assert(captures.at(-1).messages.some(m=>m.role==='tool'&&String(m.content).includes('浮力')));
  assert(!fs.existsSync(path.join(privateCwd,'课堂讲义.txt')));
 });
 report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;console.error(report.error);}
finally{await agent?.dispose();await host?.close();globalThis.fetch=originalFetch;db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output}));}
