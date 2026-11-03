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

const {createScienceLessonSource,prepareScienceLessonRefresh}=await import('../../src/main/education/science-lesson-source.ts');
const {createQuestionContextProvider,readQuestionContextSource,questionVersion}=await import('../../src/main/education/question-context-provider.ts');

const asset=await buildBuoyancyDemo(),originalRead=fs.readFileSync;fs.readFileSync=function(file,...args){if(file instanceof URL&&file.pathname.endsWith('/buoyancy-demo.json'))return JSON.stringify(asset);return originalRead.call(this,file,...args);};
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-lesson-source-')),dataRoot=path.join(root,'data'),workspace=path.join(root,'files');fs.mkdirSync(dataRoot);fs.mkdirSync(workspace);
const db=new DatabaseSync(path.join(dataRoot,'app.db'));db.exec(`CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,title TEXT,archived_at TEXT);CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,session_id TEXT,run_id TEXT,payload_json TEXT,action_type TEXT,status TEXT,updated_at TEXT);CREATE TABLE document_artifacts(id TEXT PRIMARY KEY,session_id TEXT NOT NULL,message_id TEXT NOT NULL,title TEXT NOT NULL,artifact_type TEXT NOT NULL,file_name TEXT NOT NULL,mime_type TEXT NOT NULL,description TEXT NOT NULL,content_md TEXT NOT NULL,file_path TEXT NOT NULL,file_size INTEGER NOT NULL,content_hash TEXT NOT NULL,status TEXT NOT NULL,error_message TEXT NOT NULL,created_at TEXT NOT NULL,updated_at TEXT NOT NULL);`);
const sql={all:async(s,v=[])=>db.prepare(s).all(...v),run:async(s,v=[])=>db.prepare(s).run(...v),change:async(s,v=[])=>Number(db.prepare(s).run(...v).changes),transaction:async work=>{db.exec('BEGIN IMMEDIATE');try{const v=await work(sql);db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}};
const id='aisession_'+randomUUID();db.prepare('INSERT INTO ai_conversation_sessions(id) VALUES(?)').run(id);const state=createXiaozhiSessionState(sql);let runId='initial',current=true,sourceValid=true;
const active=(s,r)=>s===id&&r===runId&&current,text=createTextChangeService({state:state.changes,dataRoot,workspace:async()=>workspace,isCurrent:active}),office=createOfficeArtifactService({state:state.officeArtifacts,dataRoot,workspace:async()=>workspace,isCurrent:active});
const read=()=>createDeliveryReadback({sessionId:id,runId,current:()=>current,state:state.deliveries,workspace:async()=>workspace,fileLabel:async(_,s)=>s,changes:state.changes,artifacts:state.officeArtifacts});
const events=[],coordinator=createDeliveryCoordinator({state:state.deliveries,changes:state.changes,artifacts:state.officeArtifacts,text,office,current:active,taskVersion:async()=> 'task:1',emit:(_s,_r,e)=>events.push(e),sanitize:async(_k,p)=>p,verify:(_s,ref)=>read().child(ref),checkLessonSource:async(_s,source)=>{if(source.question)await readQuestionContextSource(store,source.question);}});
const parameters=createOfficeArtifactCoordinator({state:state.officeArtifacts,service:office,isCurrent:active,sanitize:async x=>x,emit:()=>{}}).tools(id,runId,async f=>f())[0].parameters;
const source=s=>({kind:'self_authored',stem:s.origin.stem,answer:s.origin.answer,analysis:s.origin.analysis,title:'本任务自拟'});
const report={ok:false,root,checks:[],files:[],paidRequests:0,boundary:'Original SQLite/text/Office/grouping and actual bytes; fixture question store adapts a clearly synthetic JSON table. Actual teacher bank UI runs separately. No real provider, natural review, Office/WPS or full AT.'};
const check=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS '+name);};
const until=async fn=>{for(let n=0;n<800;n++){const v=await fn();if(v)return v;await new Promise(r=>setTimeout(r,10));}throw Error('pending timeout');};
const start=(raw,call=randomUUID(),resolve)=>coordinator.tools(id,runId,async f=>f(),parameters,undefined,resolve)[0].execute(call,raw,new AbortController().signal);
const pending=()=>until(async()=> (await coordinator.list(id)).find(v=>v.runId===runId&&v.state==='pending'));
const decision=v=>({schemaVersion:'xiaozhi.delivery.v1',sessionId:id,bundleId:v.id,revision:v.revision,fingerprint:v.fingerprint,action:'approve'}),payload=r=>JSON.parse(r.content[0].text);
const xml=async file=>[...(await readWordPackage(fs.readFileSync(file)))].filter(([n])=>n.endsWith('.xml')).map(([n,b])=>[n,b.toString('utf8')]);

db.exec('CREATE TABLE lesson_source_fixture(id TEXT PRIMARY KEY,value_json TEXT)');
const question=(id,load='4')=>({id,subject:'物理',grade:'八年级',knowledgePoint:'浮力',questionType:'简答题',difficulty:'medium',stem:`10cm正方体木块密度600kg/m³、水1000kg/m³、g=10N/kg，向下载荷${load}N，忽略载荷体积和空气浮力，容器足够大深，全浸没未触底。`,answer:load==='4'?'临界载荷4N；全浸没合力0N。':'向下合力1N。',analysis:'物重6N，最大浮力10N，比较向下力与浮力；临界不唯一确定悬浮深度。',sourceTitle:'相同题源标题',sourceKind:'local_bank',tags:[],createdAt:'2026-11-03',updatedAt:'2026-11-03'});
const put=q=>db.prepare('INSERT OR REPLACE INTO lesson_source_fixture VALUES(?,?)').run(q.id,JSON.stringify(q)),q1=question('question_'+randomUUID()),q2=question('question_'+randomUUID());put(q1);put(q2);
const get=id=>{const x=db.prepare('SELECT value_json FROM lesson_source_fixture WHERE id=?').get(id);return x?JSON.parse(x.value_json):undefined;};
const store={getQuestionNotebookEntry:async id=>get(id),searchQuestionBank:async()=>[get(q1.id),get(q2.id)].filter(Boolean),listStudents:async()=>[],sanitizeProblemText:async text=>({sanitizedText:text})};
let aliases=new Map(),observed=new Map();const resolve=()=>createScienceLessonSource(store,observed),tools=()=>createQuestionContextProvider(store,()=>current,(ref,source)=>observed.set(ref,source),aliases);
const readAlias=async a=>{const r=payload(await tools().find(t=>t.name==='education_read_question').execute(randomUUID(),{reference:a.reference,version:a.version},new AbortController().signal));assert(r.success,JSON.stringify(r));return r;};
const spec=a=>({...scienceLessonFixture(),origin:{kind:'question',reference:a.reference,version:a.version}});
const bound=(raw,id,call=randomUUID())=>coordinator.tools(id===undefined?'':globalSession,runId,async f=>f(),parameters,id,resolve())[0].execute(call,raw,new AbortController().signal);
const globalSession=id;let first,stale,oldFiles,refreshed;
try{await state.init();
 await check('Exact-original discovery prepares only an alias and cannot replace a successful full read',async()=>{
  const a=await prepareScienceLessonRefresh(store,{kind:'question',question:{schemaVersion:'xiaozhi.education.question-context.v1',questionId:q1.id,version:questionVersion(q1)}},aliases);assert.equal(a.version,questionVersion(q1));assert.equal(aliases.get(a.reference).id,q1.id);assert.equal(observed.size,0);await assert.rejects(resolve()(spec(a).origin),/source_changed/);await readAlias(a);assert.equal((await resolve()(spec(a).origin)).question.questionId,q1.id);
  const work=start({scienceLesson:spec(a),prefix:'原题第一版'},randomUUID(),resolve()),v=await pending();assert((await coordinator.decide(decision(v))).ok);first=payload(await work);assert(first.success);oldFiles=fs.readdirSync(workspace).map(name=>{const f=path.join(workspace,name);return{file:f,sha256:createHash('sha256').update(fs.readFileSync(f)).digest('hex'),mtime:fs.statSync(f).mtimeMs};});assert.equal(oldFiles.length,5);
 });
 await check('Source change ends the original pending wait, interrupts only unsaved drafts and preserves saved history',async()=>{
  runId='stale';const a={reference:[...observed.keys()][0],version:questionVersion(q1)},work=start({scienceLesson:spec(a),prefix:'未保存旧版'},randomUUID(),resolve()),v=await pending();put(question(q1.id,'5'));assert.equal((await coordinator.decide(decision(v))).error,'conflict');const r=payload(await work);assert.equal(r.outcome,'conflict');assert.equal(r.sourceRefreshRequired,true);stale=await coordinator.read(id,v.id);assert(stale.files.every(f=>f.error==='source_changed'));assert(stale.files.every(f=>f.change?.state==='interrupted'||f.artifact?.state==='interrupted'));assert.equal(fs.readdirSync(workspace).length,5);report.staleId=stale.id;
 });
 await check('Stale snapshots, self-authored substitutes and same-title different questions cannot bypass the original binding',async()=>{
  runId='refresh';aliases=new Map();observed=new Map();const ctx=await coordinator.context(id,stale.id,source=>prepareScienceLessonRefresh(store,source,aliases));refreshed=JSON.parse(ctx.slice(ctx.indexOf('[{')))[0].sourceRefresh.currentQuestion;assert.equal(aliases.get(refreshed.reference).id,q1.id);assert.equal(refreshed.version,questionVersion(get(q1.id)));assert.notEqual(refreshed.version,stale.lesson.sourceVersion);
  const count=(await state.deliveries.list(id)).length;
  assert.equal(payload(await bound({resumeBundleId:stale.id},stale.id)).error,'source_changed');
  assert.equal(payload(await bound({scienceLesson:spec(refreshed),prefix:'未实读',previousLessonBundleId:stale.id},stale.id)).error,'source_changed');
  assert.equal(payload(await bound({scienceLesson:scienceLessonFixture(),prefix:'不能自拟',previousLessonBundleId:stale.id},stale.id)).error,'source_changed');
  const other=await prepareScienceLessonRefresh(store,{question:{schemaVersion:'xiaozhi.education.question-context.v1',questionId:q2.id,version:questionVersion(q2)}},aliases);await readAlias(other);assert.equal(payload(await bound({scienceLesson:spec(other),prefix:'同名别题',previousLessonBundleId:stale.id},stale.id)).error,'source_changed');assert.equal((await state.deliveries.list(id)).length,count);assert.equal(fs.readdirSync(workspace).length,5);
 });
 await check('Full reread rebuilds exactly the same source at its current version and links the original bundle',async()=>{
  await readAlias(refreshed);const s=spec(refreshed);s.demo.model.downwardLoad.value='5';const work=bound({scienceLesson:s,prefix:'原题新版',previousLessonBundleId:stale.id},stale.id),v=await pending();assert.equal(v.lesson.sourceVersion,questionVersion(get(q1.id)));assert((await coordinator.decide(decision(v))).ok);const r=payload(await work);assert(r.success);const row=await state.deliveries.get(r.bundleId);assert.equal(row.parentId,stale.id);assert.equal(row.lesson.source.question.questionId,q1.id);assert.equal((await coordinator.read(id,stale.id)).continuation.id,row.id);assert.equal(fs.readdirSync(workspace).length,10);
  const version=questionVersion(get(q1.id));for(const f of r.files){const file=path.join(workspace,f.file),b=fs.readFileSync(file);const text=f.file.endsWith('.html')?b.toString('utf8'):JSON.stringify(await xml(file));assert(text.includes(version));if(f.file.endsWith('.pptx'))assert.equal((await readPresentationNotes(b)).length,8);}for(const old of oldFiles){assert.equal(createHash('sha256').update(fs.readFileSync(old.file)).digest('hex'),old.sha256);assert.equal(fs.statSync(old.file).mtimeMs,old.mtime);}report.rebuiltId=r.bundleId;
 });
 await check('Repeated refresh has one successor, and an unavailable original creates no replacement alias or file',async()=>{
  runId='duplicate';assert.equal(payload(await bound({scienceLesson:spec(refreshed),prefix:'重复',previousLessonBundleId:stale.id},stale.id)).error,'conflict');const before=aliases.size;db.prepare('DELETE FROM lesson_source_fixture WHERE id=?').run(q1.id);assert.equal((await prepareScienceLessonRefresh(store,{question:{questionId:q1.id}},aliases)).state,'unavailable');assert.equal(aliases.size,before);assert.equal(fs.readdirSync(workspace).length,10);put(question(q1.id,'5'));
 });
 await check('Cold metadata recovery retains stale origin, exact continuation and all original file bytes and mtimes',async()=>{
  await state.recover();const row=await coordinator.read(id,stale.id);assert.equal(row.state,'conflict');assert.equal(row.continuation.id,report.rebuiltId);assert.equal(row.lesson.sourceVersion,questionVersion(q1));for(const old of oldFiles){assert.equal(createHash('sha256').update(fs.readFileSync(old.file)).digest('hex'),old.sha256);assert.equal(fs.statSync(old.file).mtimeMs,old.mtime);}report.files=oldFiles;
 });report.ok=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{fs.readFileSync=originalRead;db.close();fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,root,error:report.error}));}
