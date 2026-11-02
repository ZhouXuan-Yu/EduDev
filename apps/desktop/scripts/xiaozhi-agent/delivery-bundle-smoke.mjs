import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {presentationFixture} from './presentation-fixture.mjs';
const {createXiaozhiSessionState}=await import('../../src/main/xiaozhi-agent/session-state.ts');
const {createTextChangeService}=await import('../../src/main/xiaozhi-agent/text-change-service.ts');
const {createOfficeArtifactService}=await import('../../src/main/xiaozhi-agent/office-artifact-service.ts');
const {createOfficeArtifactCoordinator}=await import('../../src/main/xiaozhi-agent/office-artifact-coordinator.ts');
const {createDeliveryCoordinator}=await import('../../src/main/xiaozhi-agent/delivery-coordinator.ts');
const {createDeliveryReadback}=await import('../../src/main/xiaozhi-agent/verification/delivery-readback.ts');
const {createRunResultReadback}=await import('../../src/main/xiaozhi-agent/verification/result-readback.ts');
const {createDeliveryCatalog}=await import('../../src/main/xiaozhi-agent/delivery-catalog.ts');
const {DELIVERY_CATALOG_SCHEMA}=await import('../../src/shared/xiaozhi-delivery.ts');
const {validXiaozhiStart}=await import('../../src/shared/xiaozhi-start.ts');
const {legacyVerification}=await import('../../src/shared/xiaozhi-verification.ts');
const {readPresentationNotes}=await import('./presentation-readback.ts');
const {fileVersion}=await import('../../src/main/xiaozhi-agent/workspace-files.ts');

const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-bundle-')),dataRoot=path.join(output,'data'),workspace=path.join(output,'files');fs.mkdirSync(dataRoot);fs.mkdirSync(workspace);
const db=new DatabaseSync(path.join(dataRoot,'app.db'));
db.exec(`CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,title TEXT,archived_at TEXT);
CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,session_id TEXT,run_id TEXT,payload_json TEXT,action_type TEXT,status TEXT,updated_at TEXT);
CREATE TABLE document_artifacts(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,message_id TEXT NOT NULL,title TEXT NOT NULL,artifact_type TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,description TEXT NOT NULL,content_md TEXT NOT NULL,file_path TEXT NOT NULL,file_size INTEGER NOT NULL,content_hash TEXT NOT NULL,status TEXT NOT NULL,error_message TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
const id=`aisession_${randomUUID()}`;db.prepare('INSERT INTO ai_conversation_sessions(id) VALUES(?)').run(id);
const sql={all:async(s,v=[])=>db.prepare(s).all(...v),run:async(s,v=[])=>db.prepare(s).run(...v),change:async(s,v=[])=>Number(db.prepare(s).run(...v).changes),transaction:async work=>{db.exec('BEGIN IMMEDIATE');try{const value=await work(sql);db.exec('COMMIT');return value;}catch(error){db.exec('ROLLBACK');throw error;}}};
const state=createXiaozhiSessionState(sql);
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
 const source=(await coordinator.list(id)).find(v=>v.runId==='one').files.find(f=>f.kind==='office').artifact;
 const sourceFile=path.join(workspace,'first.pptx'),sourceBytes=fs.readFileSync(sourceFile),sourceMtime=fs.statSync(sourceFile).mtimeMs;
 const sourceDraft=(await state.officeArtifacts.get(source.id)).draft;
 const edit=(pages,path='delta.pptx')=>({fileId:'ppt',kind:'office',path,format:'pptx',parentArtifactId:source.artifactId,sources:[],presentationEdit:{schemaVersion:'xiaozhi.presentation-edit.v1',version:fileVersion(fs.statSync(sourceFile)),pages}});
 const companion=path=>({fileId:'html',kind:'text',path,content:'<!doctype html><html><p>总向下力11N，浮力上限10N；未触底向下合力1N</p></html>'});
 await check('Bundle materializes a current-version page delta through the original service and preserves all unselected fields and original file',async()=>{
  runId='delta';const paragraphs=['主线载荷改为5N，总向下力11N，最大浮力10N。','未触底向下合力1N；触底静止需另计支撑力1N。'];
  const request={files:[companion('delta.html'),edit([{page:6,paragraphs}])]};
  const work=start(request);let view=await pending();const row=await state.officeArtifacts.get(view.files.find(f=>f.kind==='office').draftId);
  const expected=structuredClone(sourceDraft);expected.sections[5].paragraphs=paragraphs;assert.deepEqual(row.draft,expected);assert.equal(row.parentArtifactId,source.artifactId);assert.equal(row.sources.find(s=>s.kind==='parent_artifact').path,'first.pptx');
  assert((await coordinator.decide(decision(view))).ok);const result=payload(await work);assert(result.success,JSON.stringify(result));await (await read().bind('bundle',result)).read();
  assert.deepEqual(await readPresentationNotes(fs.readFileSync(path.join(workspace,'delta.pptx'))),await readPresentationNotes(sourceBytes));assert(fs.readFileSync(sourceFile).equals(sourceBytes));assert.equal(fs.statSync(sourceFile).mtimeMs,sourceMtime);
  const before=(await state.officeArtifacts.list(id)).length;assert(payload(await start(request)).success);assert.equal((await state.officeArtifacts.list(id)).length,before);
 });
 await check('Unchanged PPT inside a changed bundle carries the original receipt without draft, target file, new version or repeated file review',async()=>{
  runId='delta-noop';const before=(await state.officeArtifacts.list(id)).length;
  const work=start({files:[companion('delta-noop.html'),edit([{page:4,heading:sourceDraft.sections[3].heading}],'unused-delta.pptx')]});const view=await pending();const old=view.files.find(f=>f.kind==='office');assert(old.carried);assert.equal(old.path,'first.pptx');assert.equal(old.draftId,source.id);assert.equal((await state.officeArtifacts.list(id)).length,before);
  assert((await coordinator.decide(decision(view))).ok);const result=payload(await work);assert(result.success);await (await read().bind('bundle',result)).read();assert(!fs.existsSync(path.join(workspace,'unused-delta.pptx')));assert(fs.readFileSync(sourceFile).equals(sourceBytes));assert.equal(fs.statSync(sourceFile).mtimeMs,sourceMtime);
 });
 await check('Invalid page, stale source and mixed draft/edit are rejected before creating any companion draft or bundle',async()=>{
  for(const bad of [edit([{page:19,heading:'越界'}]),{...edit([{page:4,heading:'changed'}]),presentationEdit:{...edit([]).presentationEdit,version:'0'.repeat(64)}},{...edit([{page:4,heading:'changed'}]),draft:sourceDraft}]){
   runId='invalid-'+randomUUID();const before=(await state.changes.list(id)).length,offices=(await state.officeArtifacts.list(id)).length,bundles=(await coordinator.list(id)).length;
   const result=payload(await start({files:[companion('not-created.html'),bad]}));assert(!result.success);assert.equal((await state.changes.list(id)).length,before);assert.equal((await state.officeArtifacts.list(id)).length,offices);assert.equal((await coordinator.list(id)).length,bundles);
  }
 });
 await check('A source changed after bundle review invalidates the original confirmation before either new file is saved',async()=>{
  runId='delta-stale';const work=start({files:[companion('delta-stale.html'),edit([{page:6,heading:'changed'}],'delta-stale.pptx')]});const view=await pending();fs.appendFileSync(sourceFile,'teacher edit');
  assert.equal((await coordinator.decide(decision(view))).error,'conflict');assert(!fs.existsSync(path.join(workspace,'delta-stale.pptx')));assert(!fs.existsSync(path.join(workspace,'delta-stale.html')));await coordinator.cancel(runId);await work.catch(()=>{});fs.writeFileSync(sourceFile,sourceBytes);
 });
 await check('Rejecting the whole bundle creates neither file',async()=>{
  runId='reject';const work=start({files:files('reject')});const view=await pending();assert((await coordinator.decide(decision(view,'reject'))).ok);assert.equal(payload(await work).outcome,'rejected');assert(!fs.existsSync(path.join(workspace,'reject.html')));assert(!fs.existsSync(path.join(workspace,'reject.pptx')));
 });
 await check('PPT failure preserves HTML; new-run resume carries HTML without rewriting and reconfirms only the unfinished file',async()=>{
  runId='partial';fault=true;const work=start({files:files('partial')});const view=await pending();assert((await coordinator.decide(decision(view))).ok);partial=payload(await work);assert.equal(partial.outcome,'partial');assert.equal(partial.files[0].outcome,'applied');assert(!fs.existsSync(path.join(workspace,'partial.pptx')));
  const html=path.join(workspace,'partial.html'),before=fs.statSync(html),bytes=fs.readFileSync(html);const changes=(await state.changes.list(id)).length;
  fault=false;runId='resume';const resume=start({resumeBundleId:partial.bundleId});const renewed=await pending();assert(renewed.files[0].carried);assert((await coordinator.decide(decision(renewed))).ok);const result=payload(await resume);assert(result.success,JSON.stringify(result));assert.equal((await state.changes.list(id)).length,changes);assert.equal(fs.statSync(html).mtimeMs,before.mtimeMs);assert(fs.readFileSync(html).equals(bytes));await (await read().bind('bundle',result)).read();const repeated=payload(await start({resumeBundleId:partial.bundleId}));assert.equal(repeated.bundleId,result.bundleId);assert(repeated.success);assert.equal((await state.changes.list(id)).length,changes);assert.equal(fs.statSync(html).mtimeMs,before.mtimeMs);
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
 await check('Teaching catalog pages original grouping metadata only; selected facts, ownership, archive and successor remain truthful',async()=>{
  let reads=0;const catalog=createDeliveryCatalog({state:state.deliveries,coordinator:{read:async(...args)=>{++reads;return coordinator.read(...args);}},authorize:async sid=>{if(!db.prepare('SELECT id FROM ai_conversation_sessions WHERE id=? AND archived_at IS NULL').get(sid))throw Error('permission_denied');},running:()=>false});
  const list=offset=>catalog({schemaVersion:DELIVERY_CATALOG_SCHEMA,action:'list',offset});
  const original=(await state.deliveries.list(id))[0];for(let i=0;i<14;i++){const suffix=(i+100).toString(16).padStart(64,'0');await state.deliveries.create({...original,id:'xidelivery_'+suffix,callId:'catalog-'+i,runId:'catalog-'+i});}
  const first=await list(0);assert(first.ok&&first.kind==='list');assert.equal(first.items.length,12);assert.equal(first.nextOffset,12);assert.equal(reads,0);const items=[...first.items];let offset=first.nextOffset;while(offset!==undefined){const next=await list(offset);assert(next.ok&&next.kind==='list');items.push(...next.items);offset=next.nextOffset;}assert.equal(new Set(items.map(v=>v.id)).size,first.total);
  assert(first.items.every(v=>!('files'in v)&&!('content'in v)&&v.paths.length===2));
  const picked=await catalog({schemaVersion:DELIVERY_CATALOG_SCHEMA,action:'get',sessionId:id,bundleId:partial.bundleId});assert(picked.ok&&picked.kind==='get');assert.equal(reads,1);assert.equal(picked.delivery.state,'partial');assert.equal(picked.delivery.continuation.state,'saved');assert.equal(picked.delivery.files.filter(f=>f.change?.state==='applied').length,1);
  const foreign='aisession_'+randomUUID();db.prepare('INSERT INTO ai_conversation_sessions(id) VALUES(?)').run(foreign);assert.equal((await catalog({schemaVersion:DELIVERY_CATALOG_SCHEMA,action:'get',sessionId:foreign,bundleId:partial.bundleId})).error,'permission_denied');assert.equal(reads,1);
  db.prepare('UPDATE ai_conversation_sessions SET archived_at=? WHERE id=?').run('2026-11-01',id);assert.equal((await list(0)).total,0);assert.equal((await catalog({schemaVersion:DELIVERY_CATALOG_SCHEMA,action:'get',sessionId:id,bundleId:partial.bundleId})).error,'permission_denied');db.prepare('UPDATE ai_conversation_sessions SET archived_at=NULL WHERE id=?').run(id);
  assert.equal((await list(-1)).error,'invalid_input');assert.equal((await list(100001)).error,'invalid_input');assert.equal((await catalog({schemaVersion:DELIVERY_CATALOG_SCHEMA,action:'list',sessionId:id})).error,'invalid_input');
  const input={sessionId:id,commandId:'xicmd_'+randomUUID(),prompt:'继续交付未完成文件',resumeDeliveryId:partial.bundleId};assert(validXiaozhiStart(input));assert(!validXiaozhiStart({...input,resumeDeliveryId:'wrong'}));assert(!validXiaozhiStart({...input,continueTask:{taskId:'xitask_'+'a'.repeat(64),requirementsVersion:1}}));
  const bound=coordinator.tools(id,runId,async f=>f(),officeParameters,partial.bundleId)[0];const before=(await state.deliveries.list(id)).length;assert.equal(payload(await bound.execute('wrong',{resumeBundleId:good.bundleId},new AbortController().signal)).error,'invalid_input');assert.equal(payload(await bound.execute('new',{files:files('wrong')},new AbortController().signal)).error,'invalid_input');assert.equal((await state.deliveries.list(id)).length,before);
  assert((await coordinator.context(id,partial.bundleId)).includes(partial.bundleId));assert(!(await coordinator.context(id,partial.bundleId)).includes(good.bundleId));
 });
 report.ok=true;
}catch(e){report.error=String(e.stack);console.error(report.error);process.exitCode=1;}
finally{db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,output}));}
