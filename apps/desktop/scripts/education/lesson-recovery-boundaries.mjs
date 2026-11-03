import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
import {scienceLessonFixture} from './science-lesson-fixture.mjs';import {buildBuoyancyDemo} from './buoyancy-demo-bundle.mjs';
const {validScienceLesson}=await import('../../src/shared/science-lesson.ts');
const {compileScienceLesson,validLessonSnapshot}=await import('../../src/main/xiaozhi-agent/science-lesson.ts');
const {createXiaozhiSessionState}=await import('../../src/main/xiaozhi-agent/session-state.ts');
const {createTextChangeService}=await import('../../src/main/xiaozhi-agent/text-change-service.ts');
const {createOfficeArtifactService}=await import('../../src/main/xiaozhi-agent/office-artifact-service.ts');
const {createOfficeArtifactCoordinator}=await import('../../src/main/xiaozhi-agent/office-artifact-coordinator.ts');
const {createDeliveryCoordinator}=await import('../../src/main/xiaozhi-agent/delivery-coordinator.ts');
const {createDeliveryReadback}=await import('../../src/main/xiaozhi-agent/verification/delivery-readback.ts');
const {readWordPackage}=await import('../../src/main/assets/word-package.ts');
const {readPresentationNotes}=await import('../xiaozhi-agent/presentation-readback.ts');
const asset=await buildBuoyancyDemo(),originalRead=fs.readFileSync;fs.readFileSync=function(file,...args){if(file instanceof URL&&file.pathname.endsWith('/buoyancy-demo.json'))return JSON.stringify(asset);return originalRead.call(this,file,...args);};
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-lesson-recovery-')),dataRoot=path.join(root,'data'),workspace=path.join(root,'files');fs.mkdirSync(dataRoot);fs.mkdirSync(workspace);
const db=new DatabaseSync(path.join(dataRoot,'app.db'));db.exec(`CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,title TEXT,archived_at TEXT);CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,session_id TEXT,run_id TEXT,payload_json TEXT,action_type TEXT,status TEXT,updated_at TEXT);CREATE TABLE document_artifacts(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,message_id TEXT NOT NULL,title TEXT NOT NULL,artifact_type TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,description TEXT NOT NULL,content_md TEXT NOT NULL,file_path TEXT NOT NULL,file_size INTEGER NOT NULL,content_hash TEXT NOT NULL,status TEXT NOT NULL,error_message TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
const sql={all:async(s,v=[])=>db.prepare(s).all(...v),run:async(s,v=[])=>db.prepare(s).run(...v),change:async(s,v=[])=>Number(db.prepare(s).run(...v).changes),transaction:async work=>{db.exec('BEGIN IMMEDIATE');try{const v=await work(sql);db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}};
const id='aisession_'+randomUUID();db.prepare('INSERT INTO ai_conversation_sessions(id) VALUES(?)').run(id);const state=createXiaozhiSessionState(sql);let runId='initial',current=true,sourceValid=true;
const active=(s,r)=>s===id&&r===runId&&current,text=createTextChangeService({state:state.changes,dataRoot,workspace:async()=>workspace,isCurrent:active}),office=createOfficeArtifactService({state:state.officeArtifacts,dataRoot,workspace:async()=>workspace,isCurrent:active});
const read=()=>createDeliveryReadback({sessionId:id,runId,current:()=>current,state:state.deliveries,workspace:async()=>workspace,fileLabel:async(_,s)=>s,changes:state.changes,artifacts:state.officeArtifacts});
const {createCheckPreflight}=await import('../../src/main/xiaozhi-agent/checks/preflight.ts');
const {lessonDemoRepair,lessonChecks}=await import('../../src/main/xiaozhi-agent/lesson-recovery.ts');
const {validFileCheckRules}=await import('../../src/shared/xiaozhi-delivery-checks.ts');
let mode='html',reportKind='local';const inspected=[];
const candidate=async(_id,ref)=>{const c=await(ref.kind==='text'?state.changes.get(ref.id):state.officeArtifacts.get(ref.id));return{path:c.path,version:ref.kind==='text'?c.afterSha256:c.draftHash,bytes:ref.kind==='text'?c.after:Buffer.from(JSON.stringify(c.draft)),candidate:{kind:ref.kind,id:c.id,revision:c.revision}};};
const preflight=createCheckPreflight({candidate,defaults:async()=>undefined,owner:()=>({signal:new AbortController().signal,scope:'test',current:()=>current}),sanitize:async()=>async x=>x,service:{inspect:async(input,_signal,_owner,candidates)=>{
 inspected.push({runId,input:structuredClone(input),candidates:candidates.map(c=>c.candidate)});
 const files=input.files.map(f=>{const c=candidates.find(c=>c.path===f.path),html=f.path.endsWith('.html'),failed=mode==='html'&&html||mode==='office'&&!html,checks=[{kind:reportKind==='cross'?'consistency':'interaction',state:failed?'failed':'passed',code:'controlled_fault',message:'Isolated control-flow fixture; real DOM checked by Electron journey.'}];return{path:f.path,format:html?'html':'docx',fileVersion:c?.version||'a'.repeat(64),sha256:'a'.repeat(64),candidate:c?.candidate,state:failed?'failed':'partial',checks,numbers:[],renderedPages:[]};});
 return{ok:true,report:{id:'xicheck_'+ 'a'.repeat(64),state:files.some(f=>f.state==='failed')?'failed':'partial',files,repairAttempts:{},contextCurrent:true,...(reportKind==='exhausted'?{repairExhausted:['interaction']}:{})}};
 }}});
const events=[],coordinator=createDeliveryCoordinator({state:state.deliveries,changes:state.changes,artifacts:state.officeArtifacts,text,office,current:active,taskVersion:async()=> 'task:1',emit:(_s,_r,e)=>events.push(e),sanitize:async(_k,p)=>p,verify:(_s,ref)=>read().child(ref),checkLessonSource:async()=>{if(!sourceValid)throw Error('source_changed');},preflight});
const parameters=createOfficeArtifactCoordinator({state:state.officeArtifacts,service:office,isCurrent:active,sanitize:async x=>x,emit:()=>{}}).tools(id,runId,async f=>f())[0].parameters;
const source=s=>({kind:'self_authored',stem:s.origin.stem,answer:s.origin.answer,analysis:s.origin.analysis,title:'本任务自拟'});
const report={ok:false,root,checks:[],files:[],paidRequests:0,boundary:'Original SQLite/file services and preflight control flow; inspector findings are explicitly controlled faults here. Actual Chromium mixed inspection runs in the formal Electron test; no real provider or full AT.'};
const check=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS '+name);};
const until=async fn=>{for(let n=0;n<800;n++){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,10));}throw Error('pending timeout');};
const start=(raw,call=randomUUID(),resolve)=>coordinator.tools(id,runId,async f=>f(),parameters,undefined,resolve)[0].execute(call,raw,new AbortController().signal);
const pending=()=>until(async()=> (await coordinator.list(id)).find(v=>v.runId===runId&&v.state==='pending'));
const decision=v=>({schemaVersion:'xiaozhi.delivery.v1',sessionId:id,bundleId:v.id,revision:v.revision,fingerprint:v.fingerprint,action:'approve'}),payload=r=>JSON.parse(r.content[0].text);
const xml=async file=>[...(await readWordPackage(fs.readFileSync(file)))].filter(([n])=>n.endsWith('.xml')).map(([n,b])=>[n,b.toString('utf8')]);
try{await state.init();let first,oldFiles;
 await check('Only one explicit local HTML failure may be deferred; cross-file, Office, exhausted and ordinary calls remain blocked',async()=>{
  const fixture=compileScienceLesson(scienceLessonFixture(),source(scienceLessonFixture()),'rules');assert(validFileCheckRules(lessonChecks(fixture.snapshot,fixture.files)[0].rules));
  assert.deepEqual(lessonChecks(fixture.snapshot,fixture.files,lessonChecks(fixture.snapshot,fixture.files)),lessonChecks(fixture.snapshot,fixture.files));
  for(const [m,k,expect]of[['html','local',true],['html','cross',false],['office','local',false],['html','exhausted',false]]){mode=m;reportKind=k;runId='eligibility-'+m+k;const work=start({scienceLesson:scienceLessonFixture(),prefix:runId});if(expect){const v=await pending();assert(v.files.find(f=>f.fileId==='demo').deferred);await coordinator.decide({...decision(v),action:'reject'});await work;}else{const r=payload(await work);assert.equal(r.success,false);assert.equal(fs.readdirSync(workspace).length,0);}}
  mode='html';reportKind='local';runId='ordinary';const result=payload(await start({files:[{fileId:'one',kind:'text',path:'ordinary.html',content:'<!doctype html><html><p>test</p></html>'},{fileId:'two',kind:'text',path:'ordinary.md',content:'test'}]}));assert(!result.success);assert.equal(fs.readdirSync(workspace).length,0);
 });
 await check('Original single confirmation saves four actual files and retains interrupted HTML draft with failed inspection',async()=>{
  runId='four';const work=start({scienceLesson:scienceLessonFixture(),prefix:'原包'}),v=await pending();assert.equal(v.files.filter(f=>f.deferred).length,1);assert.equal(v.files.find(f=>f.fileId==='demo').error,'delivery_check_failed');assert((await coordinator.decide(decision(v))).ok);first=payload(await work);assert.equal(first.outcome,'partial');assert.equal(first.files.filter(f=>f.outcome==='saved').length,4);assert(first.repairDraft.content.includes('buoyancy-data'));assert.equal((await state.changes.get(v.files.find(f=>f.fileId==='demo').draftId)).state,'interrupted');
  oldFiles=fs.readdirSync(workspace).map(name=>{const p=path.join(workspace,name);return{path:p,sha256:createHash('sha256').update(fs.readFileSync(p)).digest('hex'),mtime:fs.statSync(p).mtimeMs};});assert.equal(oldFiles.length,4);assert.equal((await state.deliveries.get(first.bundleId)).checks.length,1);
 });
 await check('A repair changing the source/model is rejected before any new draft, file or approval',async()=>{
  runId='wrong';const before=(await state.changes.list(id)).length;
  for(const content of [first.repairDraft.content.replace('id="buoyancy-data"','id="other-data"'),first.repairDraft.content.replace('id="lesson-provenance"','id="other-source"')]){const r=payload(await start({resumeBundleId:first.bundleId,demoRepair:content}));assert.equal(r.error,'lesson_repair_mismatch');}
  assert.equal((await state.changes.list(id)).length,before);assert.equal(fs.readdirSync(workspace).length,4);
 });
 await check('HTML still failing on resume does not request another confirmation or rewrite the four saved files',async()=>{
  runId='still-failed';const count=events.filter(e=>e.kind==='delivery_bundle'&&e.delivery.state==='pending').length;
  const r=payload(await start({resumeBundleId:first.bundleId,demoRepair:first.repairDraft.content}));assert.equal(r.outcome,'partial');assert.equal(events.filter(e=>e.kind==='delivery_bundle'&&e.delivery.state==='pending').length,count);assert.equal(fs.readdirSync(workspace).length,4);first=r;
 });
 await check('Successful repair inspects saved counterparts, writes only one HTML and preserves original file hashes and mtimes',async()=>{
  runId='fixed';mode='pass';const repaired=first.repairDraft.content.replace('</head>','<!-- fixed interaction implementation --></head>');const work=start({resumeBundleId:first.bundleId,demoRepair:repaired}),v=await pending();assert.equal(v.files.filter(f=>f.carried).length,4);assert.equal(v.lesson.consistency,'edited');assert((await coordinator.decide(decision(v))).ok);const result=payload(await work);assert(result.success);assert.equal(fs.readdirSync(workspace).length,5);for(const f of oldFiles){assert.equal(createHash('sha256').update(fs.readFileSync(f.path)).digest('hex'),f.sha256);assert.equal(fs.statSync(f.path).mtimeMs,f.mtime);}const actual=inspected.filter(i=>i.runId===runId);assert(actual.length>=2);assert(actual.every(i=>i.input.files.length===5&&i.candidates.length===1));assert(actual.every(i=>i.input.files.find(f=>f.path.endsWith('.html')).rules.numbers.some(n=>n.id==='lesson_weight')));report.files=oldFiles;
  await state.recover();const row=await state.deliveries.get(result.bundleId);assert.equal(row.state,'saved');assert.equal(row.lesson.spec.demo.model.downwardLoad.value,'4');assert.equal((await state.deliveries.get(first.bundleId)).state,'partial');
 });
 await check('Changed check outcome refreshes the review scope instead of trapping the old deferred fingerprint',async()=>{
  runId='scope-refresh';mode='html';const work=start({scienceLesson:scienceLessonFixture(),prefix:'核对范围'}),v=await pending();mode='pass';assert.equal((await coordinator.decide(decision(v))).error,'conflict');const latest=await coordinator.read(id,v.id);assert(!latest.files.some(f=>f.deferred));assert(latest.revision>v.revision);assert((await coordinator.decide({...decision(latest),action:'reject'})).ok);await work;assert.equal(fs.readdirSync(workspace).length,5);
 });
 await check('Stop and old fingerprints retain original deferred history without applying the failed draft',async()=>{
  runId='stop';mode='html';const work=start({scienceLesson:scienceLessonFixture(),prefix:'停止'}),v=await pending();await coordinator.cancel(runId);assert.equal(payload(await work).outcome,'interrupted');assert(!(await coordinator.decide(decision(v))).ok);assert(!fs.existsSync(path.join(workspace,'停止-离线探究.html')));assert.equal(fs.readdirSync(workspace).length,5);
 });
 report.inspections=inspected;report.ok=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{fs.readFileSync=originalRead;db.close();fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,root,error:report.error}));}
