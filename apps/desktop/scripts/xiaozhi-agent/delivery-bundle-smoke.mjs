import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {presentationFixture} from './presentation-fixture.mjs';
import {createXiaozhiSessionState} from '../../src/main/xiaozhi-agent/session-state.ts';
import {createTextChangeService} from '../../src/main/xiaozhi-agent/text-change-service.ts';
import {createOfficeArtifactService} from '../../src/main/xiaozhi-agent/office-artifact-service.ts';
import {createOfficeArtifactCoordinator} from '../../src/main/xiaozhi-agent/office-artifact-coordinator.ts';
import {createDeliveryCoordinator} from '../../src/main/xiaozhi-agent/delivery-coordinator.ts';
import {createDeliveryReadback} from '../../src/main/xiaozhi-agent/verification/delivery-readback.ts';
import {createRunResultReadback} from '../../src/main/xiaozhi-agent/verification/result-readback.ts';
import {legacyVerification} from '../../src/shared/xiaozhi-verification.ts';
import {readPresentationNotes} from './presentation-readback.ts';

const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-bundle-')),dataRoot=path.join(output,'data'),workspace=path.join(output,'files');fs.mkdirSync(dataRoot);fs.mkdirSync(workspace);
const db=new DatabaseSync(path.join(dataRoot,'app.db'));
db.exec(`CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY);
CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,session_id TEXT,run_id TEXT,payload_json TEXT,action_type TEXT,status TEXT,updated_at TEXT);
CREATE TABLE document_artifacts(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,message_id TEXT NOT NULL,title TEXT NOT NULL,artifact_type TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,description TEXT NOT NULL,content_md TEXT NOT NULL,file_path TEXT NOT NULL,file_size INTEGER NOT NULL,content_hash TEXT NOT NULL,status TEXT NOT NULL,error_message TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
const id=`aisession_${randomUUID()}`;db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(id);
const state=createXiaozhiSessionState({all:async(s,v=[])=>db.prepare(s).all(...v),run:async(s,v=[])=>db.prepare(s).run(...v),change:async(s,v=[])=>Number(db.prepare(s).run(...v).changes)});
const report={ok:false,checks:[],boundary:'Synthetic fixtures, actual original file/Office services, SQLite, disk, independent aggregate readback. No paid model, natural quality or full AT acceptance.'};
const check=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS '+name);};
const until=async(fn)=>{for(let i=0;i<500;i++){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,10));}throw Error('timeout');};
let runId='one',current=true,taskVersion='task:1',fault=false,afterFileFault=false;
const active=(sid,rid)=>sid===id&&rid===runId&&current;
const text=createTextChangeService({state:state.changes,dataRoot,workspace:async()=>workspace,isCurrent:active});
const office=createOfficeArtifactService({state:state.officeArtifacts,dataRoot,workspace:async()=>workspace,isCurrent:active,afterStage:async stage=>{if(fault&&stage==='prepared')throw Error('permission_denied');if(afterFileFault&&stage==='file')throw Error('configuration');}});
const read=(rid=runId)=>createDeliveryReadback({sessionId:id,runId:rid,current:()=>current,state:state.deliveries,workspace:async()=>workspace,fileLabel:async(_,s)=>s,changes:state.changes,artifacts:state.officeArtifacts});
const events=[];
const coordinator=createDeliveryCoordinator({state:state.deliveries,changes:state.changes,artifacts:state.officeArtifacts,text,office,current:active,taskVersion:async()=>taskVersion,emit:(_s,_r,e)=>events.push(e),sanitize:async(_k,p)=>p,verify:(_s,ref)=>read().child(ref)});
const officeParameters=createOfficeArtifactCoordinator({state:state.officeArtifacts,service:office,isCurrent:active,sanitize:async x=>x,emit:()=>{}}).tools(id,runId,async f=>f())[0].parameters;
const files=prefix=>[{fileId:'html',kind:'text',path:prefix+'.html',content:'<!doctype html><html><title>浮力</title><body>合成演示</body></html>'},{fileId:'ppt',kind:'office',path:prefix+'.pptx',format:'pptx',sources:[],draft:structuredClone(presentationFixture)}];
const start=(raw,call='bundle')=>coordinator.tools(id,runId,async f=>f(),officeParameters)[0].execute(call,raw,new AbortController().signal);
const pending=()=>until(async()=>{const values=await coordinator.list(id);return values.find(v=>v.runId===runId&&v.state==='pending');});
const decision=(v,action='approve')=>({schemaVersion:'xiaozhi.delivery.v1',sessionId:id,bundleId:v.id,revision:v.revision,fingerprint:v.fingerprint,action});
const payload=result=>JSON.parse(result.content[0].text);
try{
 await state.init();await state.init();let good,proof,partial;
 await check('One review covers both files; teacher PPT edit invalidates old approval and saves exact revised notes',async()=>{
  const work=start({files:files('first')});let view=await pending();const stale=decision(view);assert.equal(fs.readdirSync(workspace).length,0);
  const ppt=view.files.find(f=>f.kind==='office').artifact,draft=structuredClone(presentationFixture);draft.sections[3].heading='教师修订标题';draft.sections[3].speakerNotes[0].text='教师修订备注';
  assert((await coordinator.revise({schemaVersion:'xiaozhi.office-artifact.v1',sessionId:id,draftId:ppt.id,revision:ppt.revision,draft})).ok);
  assert.equal((await coordinator.decide(stale)).error,'conflict');assert.equal(fs.readdirSync(workspace).length,0);
  view=await pending();assert((await coordinator.decide(decision(view))).ok);good=payload(await work);assert(good.success);assert.equal(good.files.length,2);
  assert((await readPresentationNotes(fs.readFileSync(path.join(workspace,'first.pptx'))))[3].text.includes('教师修订备注'));
  assert(!JSON.stringify(good).includes('教师修订备注'));assert.equal((await coordinator.decide(decision(view))).ok,false);
 });
 await check('Aggregate independent verification binds every disk file; corruption invalidates the whole bundle',async()=>{
  proof=await read().bind('bundle',good);assert.deepEqual(await proof.read(),{version:proof.version,digest:proof.digest});
  const result={content:[{type:'text',text:JSON.stringify(good)}]};const results=createRunResultReadback({runId,readLocal:async()=>[],verifyImage:async()=>false,bindEffect:(call,_tool,p)=>read().bind(call,p)});
  results.capture('bundle','office_deliver_files',result,false);const v=await results.finish(legacyVerification(runId),async()=>[{toolCallId:'bundle',toolName:'office_deliver_files',...result}]);assert(v.checks.some(c=>c.id==='saved_bundle:bundle'&&c.state==='passed'));
  const original=fs.readFileSync(path.join(workspace,'first.html'));fs.appendFileSync(path.join(workspace,'first.html'),'changed');await assert.rejects(proof.read(),/evidence_missing/);fs.writeFileSync(path.join(workspace,'first.html'),original);
 });
 await check('Rejecting the whole bundle creates neither file',async()=>{
  runId='reject';const work=start({files:files('reject')});const view=await pending();assert((await coordinator.decide(decision(view,'reject'))).ok);assert.equal(payload(await work).outcome,'rejected');assert(!fs.existsSync(path.join(workspace,'reject.html')));assert(!fs.existsSync(path.join(workspace,'reject.pptx')));
 });
 await check('PPT failure preserves HTML; new-run resume carries HTML without rewriting and reconfirms only the unfinished file',async()=>{
  runId='partial';fault=true;const work=start({files:files('partial')});const view=await pending();assert((await coordinator.decide(decision(view))).ok);partial=payload(await work);assert.equal(partial.outcome,'partial');assert.equal(partial.files[0].outcome,'applied');assert(!fs.existsSync(path.join(workspace,'partial.pptx')));
  const html=path.join(workspace,'partial.html'),before=fs.statSync(html),bytes=fs.readFileSync(html);const changes=(await state.changes.list(id)).length;
  fault=false;runId='resume';const resume=start({resumeBundleId:partial.bundleId});const renewed=await pending();assert(renewed.files[0].carried);assert((await coordinator.decide(decision(renewed))).ok);const result=payload(await resume);assert(result.success,JSON.stringify(result));assert.equal((await state.changes.list(id)).length,changes);assert.equal(fs.statSync(html).mtimeMs,before.mtimeMs);assert(fs.readFileSync(html).equals(bytes));await (await read().bind('bundle',result)).read();
 });
 await check('Task requirement change invalidates bundle; cancellation and cold restart never revive approvals',async()=>{
  runId='version';const work=start({files:files('version')});const view=await pending();taskVersion='task:2';assert.equal((await coordinator.decide(decision(view))).error,'conflict');current=false;await coordinator.cancel(runId);await work.catch(()=>{});assert(!fs.existsSync(path.join(workspace,'version.html')));current=true;
  runId='cold';const cold=start({files:files('cold')});await pending();await state.recover();const row=(await coordinator.list(id)).find(v=>v.runId==='cold');assert.equal(row.state,'interrupted');assert.equal((await coordinator.decide(decision(row))).ok,false);await coordinator.cancel(runId);await cold;assert(!fs.existsSync(path.join(workspace,'cold.html')));
 });
 await check('A post-write uncertain PPT is verified and carried after restart; neither saved file is written twice',async()=>{
  runId='uncertain';afterFileFault=true;const work=start({files:files('uncertain')});const view=await pending();assert((await coordinator.decide(decision(view))).ok);const first=payload(await work);assert.equal(first.outcome,'partial');assert.equal(first.files[1].outcome,'uncertain');
  const html=fs.statSync(path.join(workspace,'uncertain.html')),ppt=fs.statSync(path.join(workspace,'uncertain.pptx'));await state.recover();afterFileFault=false;runId='verified-resume';const resume=start({resumeBundleId:first.bundleId});const renewed=await pending();assert(renewed.files.every(f=>f.carried));assert((await coordinator.decide(decision(renewed))).ok);const result=payload(await resume);assert(result.success,JSON.stringify(result));assert.equal(fs.statSync(path.join(workspace,'uncertain.html')).mtimeMs,html.mtimeMs);assert.equal(fs.statSync(path.join(workspace,'uncertain.pptx')).mtimeMs,ppt.mtimeMs);await (await read().bind('bundle',result)).read();
 });
 await check('Compatibility pause blocks new and already-approved automatic writes, while saved drafts and uncertain verification remain readable',async()=>{
  runId='pause-policy';const pendingText=await text.propose(id,runId,'pause-text',{operation:'create',path:'paused.txt',content:'do not write'});await text.decision({schemaVersion:'xiaozhi.change.v1',sessionId:id,changeId:pendingText.id,revision:pendingText.revision,action:'approve'});
  const pendingOffice=await office.propose(id,runId,'pause-office',{path:'paused.pptx',format:'pptx',sources:[],draft:structuredClone(presentationFixture)});await office.decide({schemaVersion:'xiaozhi.office-artifact.v1',sessionId:id,draftId:pendingOffice.id,revision:pendingOffice.revision,action:'approve'});
  const uncertain=await office.propose(id,runId,'pause-uncertain',{path:'pause-verified.pptx',format:'pptx',sources:[],draft:structuredClone(presentationFixture)});await office.decide({schemaVersion:'xiaozhi.office-artifact.v1',sessionId:id,draftId:uncertain.id,revision:uncertain.revision,action:'approve'});afterFileFault=true;await assert.rejects(office.apply(id,uncertain.id),/configuration/);afterFileFault=false;
  const oldEnv=process.env.OMNI_EDU_XIAOZHI_FILE_WRITES;process.env.OMNI_EDU_XIAOZHI_FILE_WRITES='0';
  try{
   await assert.rejects(text.propose(id,runId,'disabled-text',{operation:'create',path:'new.txt',content:'no'}),/file_writes_disabled/);await assert.rejects(office.propose(id,runId,'disabled-office',{path:'new.pptx',format:'pptx',sources:[],draft:structuredClone(presentationFixture)}),/file_writes_disabled/);
   await assert.rejects(text.apply(id,pendingText.id),/file_writes_disabled/);await assert.rejects(office.apply(id,pendingOffice.id),/file_writes_disabled/);assert(!fs.existsSync(path.join(workspace,'paused.txt')));assert(!fs.existsSync(path.join(workspace,'paused.pptx')));
   const row=await state.officeArtifacts.get(uncertain.id);assert.equal((await office.decide({schemaVersion:'xiaozhi.office-artifact.v1',sessionId:id,draftId:row.id,revision:row.revision,action:'verify'})).state,'saved');assert((await office.review(id,row.id)).draft.sections.length===8);assert((await text.review(id,pendingText.id)).after==='do not write');
   const count=(await state.deliveries.list(id)).length;const blocked=payload(await start({files:files('blocked')}));assert.equal(blocked.error,'file_writes_disabled');assert.equal((await state.deliveries.list(id)).length,count);
  }finally{if(oldEnv===undefined)delete process.env.OMNI_EDU_XIAOZHI_FILE_WRITES;else process.env.OMNI_EDU_XIAOZHI_FILE_WRITES=oldEnv;}
 });
 report.ok=true;
}catch(e){report.error=String(e.stack);console.error(report.error);process.exitCode=1;}
finally{db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output}));}
