import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
const {createEffectReadback}=await import('../../src/main/xiaozhi-agent/verification/effect-readback.ts');
const {createRunResultReadback}=await import('../../src/main/xiaozhi-agent/verification/result-readback.ts');
const {createTextChangeState}=await import('../../src/main/xiaozhi-agent/text-change-state.ts');
const {createTextChangeService}=await import('../../src/main/xiaozhi-agent/text-change-service.ts');
const {createOfficeArtifactState}=await import('../../src/main/xiaozhi-agent/office-artifact-state.ts');
const {createOfficeArtifactService}=await import('../../src/main/xiaozhi-agent/office-artifact-service.ts');
const {authorizedWorkspace}=await import('../../src/main/xiaozhi-agent/workspace-authority.ts');
const {legacyVerification,validTaskVerification}=await import('../../src/shared/xiaozhi-verification.ts');
globalThis.fetch=async()=>{throw Error('No network in isolated local boundary fixtures');};
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-effect-readback-')),opened=[],checks=[];
const report={success:false,checks,boundary:'Actual domain services, teacher decisions, local files and SQLite fixtures; not formal Pi/provider or daily acceptance'};
const sessionId=`aisession_${randomUUID()}`,runId='owned-run',base={...legacyVerification(runId),reason:'no_criteria',operations:{succeeded:1,failed:0}};
const draft=text=>({schemaVersion:'xiaozhi.office-draft.v1',title:'本地确认计划',sections:[{heading:'课时',paragraphs:[text]}]});
async function fixture(kind='text',approve=true){
 const dir=fs.mkdtempSync(path.join(output,'owned-')),dataRoot=path.join(dir,'data'),workspace=path.join(dir,'workspace');fs.mkdirSync(dataRoot);fs.mkdirSync(workspace);
 const db=new DatabaseSync(path.join(dir,'ledger.db'));opened.push(db);
 db.exec(`PRAGMA foreign_keys=ON;CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY);
 CREATE TABLE document_artifacts(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,message_id TEXT NOT NULL,title TEXT NOT NULL,artifact_type TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,description TEXT NOT NULL,content_md TEXT NOT NULL,file_path TEXT NOT NULL,file_size INTEGER NOT NULL,content_hash TEXT NOT NULL,status TEXT NOT NULL,error_message TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
 db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(sessionId);
 const sql={all:async(s,v=[])=>db.prepare(s).all(...v),run:async(s,v=[])=>db.prepare(s).run(...v),change:async(s,v=[])=>Number(db.prepare(s).run(...v).changes)};
 const changes=createTextChangeState(sql),artifacts=createOfficeArtifactState(sql);await changes.migrate();await artifacts.migrate();
 let active=true,grant=workspace;const callId=randomUUID(),tool=kind==='office'?'office_create_document':'office_create_text';
 const textService=createTextChangeService({state:changes,dataRoot,workspace:async()=>grant,isCurrent:()=>active});
 const officeService=createOfficeArtifactService({state:artifacts,dataRoot,workspace:async()=>grant,isCurrent:()=>active});
 let row;if(kind==='office'){
  row=await officeService.propose(sessionId,runId,callId,{path:'计划.xlsx',format:'xlsx',draft:draft('AI原候选'),sources:[]});
  row=await officeService.revise(sessionId,row.id,row.revision,draft('教师确认的最终版本'));
  if(approve){await officeService.decide({schemaVersion:'xiaozhi.office-artifact.v1',sessionId,draftId:row.id,revision:row.revision,action:'approve'});await officeService.apply(sessionId,row.id);row=await artifacts.get(row.id);}
 }else{
  row=await textService.propose(sessionId,runId,callId,{operation:'create',path:'计划.txt',content:'教师本地内容，不得泄露到核验卡'});
  if(approve){await textService.decision({schemaVersion:'xiaozhi.change.v1',sessionId,changeId:row.id,revision:row.revision,action:'approve'});await textService.apply(sessionId,row.id);row=await changes.get(row.id);}
 }
 const payload=kind==='office'?{success:true,file:row.path,format:row.format,outcome:'saved',artifactId:row.artifactId,sourceCount:0}:{success:true,file:row.path,operation:'create',outcome:'applied'};
 const content=[{type:'text',text:JSON.stringify(payload)}];
 const bind=createEffectReadback({sessionId,runId,current:()=>active,workspace:async()=>{if(!grant)throw Error('permission_denied');return authorizedWorkspace(grant,dataRoot);},fileLabel:async(_tool,relative)=>relative,changes,artifacts});
 return{db,row,workspace,bind,callId,tool,payload,content,textService,setActive:v=>active=v,setGrant:v=>grant=v};
}
const native=e=>async()=>[{toolCallId:e.callId,toolName:e.tool,content:e.content}];
const reader=(e,extra={})=>createRunResultReadback({runId,bindEffect:e.bind,readLocal:async()=>[],verifyImage:async()=>false,...extra});
const check=async(name,action)=>{await action();checks.push({name,pass:true});console.log('PASS '+name);};
async function boundReader(e){const effect=await e.bind(e.callId,e.tool,e.payload);const r=reader(e,{bindEffect:async()=>effect});r.capture(e.callId,e.tool,{content:e.content},false);return r;}
try{
 for(const kind of['text','office'])await check(kind+' exact confirmed ledger/disk and native pass only scoped integrity',async()=>{
  const e=await fixture(kind),r=reader(e);r.capture(e.callId,e.tool,{content:e.content},false);const v=await r.finish(base,native(e));
  assert.equal(v.checks[0].state,'passed');assert.equal(v.state,'needs_human');assert(validTaskVerification(v,runId));assert.equal(v.checks.at(-1).state,'needs_human');
  assert(!JSON.stringify(v).includes('教师本地内容'));assert(!JSON.stringify(v).includes(e.workspace));
  if(kind==='office')assert.equal(e.row.draft.sections[0].paragraphs[0],'教师确认的最终版本');
 });
 for(const kind of['text','office'])for(const cut of['changed','missing','hardlink','revoked','stopped','revision','foreign-call'])await check(kind+' '+cut+' after binding cannot pass',async()=>{
  const e=await fixture(kind),r=await boundReader(e),file=path.join(e.workspace,e.row.path);
  if(cut==='changed')fs.writeFileSync(file,'changed after confirmed');
  if(cut==='missing')fs.unlinkSync(file);
  if(cut==='hardlink')fs.linkSync(file,path.join(e.workspace,'other-link'));
  if(cut==='revoked')e.setGrant(null);
  if(cut==='stopped')e.setActive(false);
  const table=kind==='text'?'xiaozhi_pi_text_changes':'xiaozhi_pi_office_drafts';
  if(cut==='revision')e.db.prepare(`UPDATE ${table} SET revision=revision+1 WHERE id=?`).run(e.row.id);
  if(cut==='foreign-call')e.db.prepare(`UPDATE ${table} SET call_id='other-call' WHERE id=?`).run(e.row.id);
  const v=await r.finish(base,native(e));assert.equal(v.checks[0].state,'unknown');assert.equal(v.state,'partial');
 });
 for(const column of['session_id','file_path','content_hash','file_size','status','title','content_md','artifact_type','mime_type','file_name'])await check('Office published '+column+' mismatch cannot pass private saved ledger',async()=>{
  const e=await fixture('office'),r=await boundReader(e);e.db.prepare(`UPDATE document_artifacts SET ${column}=? WHERE id=?`).run(column==='file_size'?1:'wrong',e.row.artifactId);
  assert.equal((await r.finish(base,native(e))).checks[0].state,'unknown');
 });
 await check('Explicit undo after binding invalidates current saved text criterion',async()=>{
  const e=await fixture(),r=await boundReader(e);await e.textService.decision({schemaVersion:'xiaozhi.change.v1',sessionId,changeId:e.row.id,revision:e.row.revision,action:'undo'});
  assert.equal((await r.finish(base,native(e))).checks[0].state,'unknown');
 });
 for(const kind of['text','office'])await check(kind+' pending teacher decision never becomes a success from forged receipt',async()=>{
  const e=await fixture(kind,false),r=reader(e);r.capture(e.callId,e.tool,{content:e.content},false);assert.equal((await r.finish(base,native(e))).checks[0].state,'unknown');
 });
 await check('Missing binder, failed binder, foreign native and duplicate callbacks cannot silently certify saved effects',async()=>{
  const e=await fixture();for(const bindEffect of[undefined,async()=>{throw Error('disk');}]){const r=reader(e,{bindEffect});r.capture(e.callId,e.tool,{content:e.content},false);assert.equal((await r.finish(base,native(e))).checks[0].state,'unknown');}
  const r=await boundReader(e);assert.equal((await r.finish(base,async()=>[{toolCallId:'other',toolName:e.tool,content:e.content}])).checks[0].state,'unknown');
  const dup=await boundReader(e);dup.capture(e.callId,e.tool,{content:e.content},false);const v=await dup.finish(base,native(e));assert.equal(v.state,'partial');assert(v.checks.some(c=>c.id==='coverage:unknown'));
 });
 await check('Receipt path must match main sanitized ledger label',async()=>{const e=await fixture();await assert.rejects(e.bind(e.callId,e.tool,{...e.payload,file:'other.txt'}),/evidence_missing/);});
 await check('Existing tool failure cannot be upgraded by valid output readback',async()=>{const e=await fixture(),r=await boundReader(e);const v=await r.finish({...base,state:'blocked',reason:'execution_failed',operations:{succeeded:1,failed:1}},native(e));assert.equal(v.state,'blocked');assert.equal(v.operations.failed,1);});
 await check('Hung private binding and hung final read end within bounded time as unknown',async()=>{
  const e=await fixture(),never=()=>new Promise(()=>{});
  const r=reader(e,{bindEffect:never}),start=Date.now();r.capture(e.callId,e.tool,{content:e.content},false);assert.equal((await r.finish(base,native(e))).checks[0].state,'unknown');assert(Date.now()-start<15000);
  const effect=await e.bind(e.callId,e.tool,e.payload),other=reader(e,{bindEffect:async()=>({...effect,read:never})});other.capture(e.callId,e.tool,{content:e.content},false);const readStart=Date.now();assert.equal((await other.finish(base,native(e))).checks[0].state,'unknown');assert(Date.now()-readStart<15000);
 });
 await check('Completed reader ignores later callbacks and final expectation cannot reset',async()=>{const e=await fixture(),r=await boundReader(e);const first=await r.finish(base,native(e));r.capture('late',e.tool,{content:e.content},false);assert.deepEqual((await r.finish(base,native(e))).checks,first.checks);});
 report.success=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}finally{for(const db of opened)db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,output,error:report.error}));}
