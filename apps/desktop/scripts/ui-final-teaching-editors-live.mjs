/** A14 editor subset. Parent alone launches against new frozen pins.
 * Existing approved question + visible-UI manual QA notes/book. No AI/OCR results are invented.
 * Only owned-clone teacher_resources.local_path transport can use a direct SQL UPDATE.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {ownedExact,continuationBootstrap,continuationGuardRead,waitContinuationBootstrap,
 readContinuationBootstrapFile,closeContinuationRuntime} from './acceptance/paper-adaptation-continuation.mjs';
import {productEntry} from './product-navigation.mjs';

const desktop=fileURLToPath(new URL('..',import.meta.url));
const owned=fs.realpathSync(path.join(desktop,'test-results'));
const reference=fs.realpathSync('D:/WorkProject/EduProject/apps/desktop/test-results');
const args=process.argv.slice(2),value=name=>args.find(x=>x.startsWith('--'+name+'='))?.slice(name.length+3);
const inspect=args.includes('--inspect-only');
assert(args.every(x=>['--inspect-only','--run-ui'].includes(x)||
 ['pins','fixture','record','block','question','reading-report','reading-producer-commit'].some(k=>x.startsWith('--'+k+'='))),'Unknown argument');
assert(inspect!==args.includes('--run-ui'),'Choose --inspect-only or --run-ui');
const candidate=path.resolve(desktop,value('fixture')||path.join(reference,'education-journey-0T0vdK'));
const fixtureOwner=[owned,reference].find(root=>{
 const relative=path.relative(root,candidate);return relative&&!relative.startsWith('..')&&!path.isAbsolute(relative);
});
const fixture=fixtureOwner?ownedExact(candidate,fixtureOwner):undefined;
assert(fixture,'Fixture must be an existing owned test-results directory');
const sourceData=ownedExact(path.join(fixture,'data'),fixture);
const output=fs.mkdtempSync(path.join(owned,'ui-final-teaching-editors-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
const deadlineAt=Date.now()+180000,marker='【仅本地验收：编辑保存标记】';
const codes=['FORMAL_STARTUP_MIGRATION','VISIBLE_MANUAL_QA_SETUP',
 'NOTEBOOK_CANCEL_SAVE_RETURN','BOOK_CANCEL_SAVE_PREVIEW_RETURN','QUESTION_CANCEL_SAVE_RETURN',
 'LAYOUT_1366','LAYOUT_800','LAYOUT_1920','COLD_SAVED_OBJECTS','ZERO_MODEL_SOURCE_LEDGER_INTEGRITY'];
const report={success:false,status:'PREFLIGHT',output,fixture,phase:'PREFLIGHT',launches:[],errors:[],screens:[],
 layoutSamples:[],
 checks:codes.map(code=>({code,status:'NOT_RUN'})),budget:{launches:2,totalSeconds:180,http:0,models:0},
 boundaries:['All content mutations through visible original UI; no SQL business seeding or merging.',
  'Only clone local_path is transported with exact original/copied bytes and unchanged source version.',
  'Missing notebook/book objects are explicitly manual QA entries using a real saved reading note.',
  'Formal startup candidates are checked against frozen pre-launch source anchors, never teacher approval.',
  'No receipt/version rebinding, delete, regeneration, export or model action.',
  'Question edit changes only trailing newline of an already complete teacher-approved projection.',
  'Empty owned profile; source data copied byte-for-byte. No original data/profile is opened by Electron.']};
const originalBefore=fingerprint(fixture).sha256;
const preparationSource=fingerprint(path.join(desktop,'src')).sha256;
report.preparationSource=preparationSource;
report.runnerSha256=sha256(fs.readFileSync(fileURLToPath(import.meta.url)));
report.bootstrapHelperSha256=sha256(fs.readFileSync(path.join(desktop,'scripts/acceptance/paper-adaptation-continuation.mjs')));
const flush=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const sql=(root,query,params=[])=>{
 assert(/^SELECT\b/.test(query));const db=new DatabaseSync(path.join(root,'app.db'),{readOnly:true});
 try{return db.prepare(query).all(...params).map(row=>({...row}));}finally{db.close();}
};
const rows=(root,table)=>sql(root,`SELECT * FROM ${table}`).sort((a,b)=>
 String(a.id??JSON.stringify(a)).localeCompare(String(b.id??JSON.stringify(b))));
const one=(root,table,id)=>{const found=sql(root,`SELECT * FROM ${table} WHERE id=?`,[id]);
 assert.equal(found.length,1);return found[0];};
const tables=['teacher_notebooks','teacher_notebook_records','teaching_books','teaching_book_chapters',
 'teaching_book_pages','teaching_book_blocks','teaching_book_sources','question_bank_items',
 'ai_confirmation_items','ai_agent_runs','xiaozhi_pi_commands','xiaozhi_pi_usage'];
const snapshot=root=>Object.fromEntries(tables.map(t=>[t,rows(root,t)]));
let initial=snapshot(sourceData);
const missing=[];
const selectExisting=(table,id,predicate,code)=>{
 const candidates=initial[table].filter(predicate).filter(row=>!id||row.id===id);
 if(!candidates.length&&!id&&['teacher_notebook_records','teaching_book_blocks'].includes(table))return;
 if(candidates.length!==1){missing.push({code,count:candidates.length});return;}
 return candidates[0];
};
let record=selectExisting('teacher_notebook_records',value('record'),row=>!row.deleted_at&&
 initial.teacher_notebooks.some(n=>n.id===row.notebook_id&&n.status==='active'),'MISSING_UNIQUE_EXISTING_RECORD');
let block=selectExisting('teaching_book_blocks',value('block'),row=>{
 const page=initial.teaching_book_pages.find(p=>p.id===row.page_id);
 const book=page&&initial.teaching_books.find(b=>b.id===page.book_id);
 const payload=JSON.parse(row.payload_json||'{}'),anchors=JSON.parse(row.source_anchors_json||'[]');
 return book&&book.status!=='archived'&&!row.error&&typeof payload.text==='string'&&
  Object.keys(payload).join()==='text'&&row.params_json==='{}'&&row.metadata_json==='{}'&&anchors.length<=1;
},'MISSING_UNIQUE_EXISTING_SIMPLE_BOOK_BLOCK');
let question=selectExisting('question_bank_items',value('question')||
 'question_10934996-88dc-4e32-87df-10a71b9f07e0',row=>{
 const document=JSON.parse(row.document_json||'null');
 return document?.schemaVersion==='xiaozhi.question-document.v2'&&!!document.context&&
  initial.ai_confirmation_items.some(r=>r.status==='confirmed'&&
   ['pi_original_question_candidate','pi_original_question_multi_candidate'].includes(r.action_type)&&
   JSON.parse(r.result_json||'null')?.saved?.questionId===row.id);
},'MISSING_UNIQUE_COMPLETE_TEACHER_APPROVED_QUESTION');
let resourceRows=rows(sourceData,'teacher_resources'),chunkRows=rows(sourceData,'resource_chunks');
const sources=resourceRows.map(r=>{
 const file=path.isAbsolute(r.local_path)?r.local_path:path.resolve(sourceData,r.local_path);
 const actual=fs.existsSync(file)?sha256(fs.readFileSync(file)):undefined;
 if(actual!==r.content_hash)missing.push({code:'SOURCE_BYTES_UNAVAILABLE',resourceId:r.id});
 const relative=path.relative(sourceData,file);
 if(relative.startsWith('..')||path.isAbsolute(relative)||path.dirname(relative)!=='teacher_resources')
  missing.push({code:'CLONE_SOURCE_OUTSIDE_MANAGED_ROOT',resourceId:r.id});
 return {resourceId:r.id,path:file,relative,sha256:actual};
});
// Explicitly named real source only; do not discover or borrow arbitrary teacher databases.
const noteReportFile=ownedExact(value('reading-report')?path.resolve(desktop,value('reading-report')):
 path.join(owned,'ui-goal-20261101/materials-live/run-rEHMi2/report.json'),owned);
const noteReport=JSON.parse(fs.readFileSync(noteReportFile,'utf8'));assert.equal(noteReport.success,true);
const noteData=fs.realpathSync(noteReport.isolated.data);
if(value('reading-report')){
 const {readOwnedReadingReport}=await import('./acceptance/reading-source-evidence.mjs');
 const producerCommit=value('reading-producer-commit');
 const provenance=producerCommit?{producerCommit,consumerPinsFile:ownedExact(path.resolve(desktop,value('pins')),owned)}:undefined;
 await readOwnedReadingReport(noteReportFile,desktop,provenance);
 assert.equal(fixture,path.dirname(noteReportFile),'Owned reading source is the explicit full question fixture');
 assert(value('question'),'Owned reading source requires an explicit genuine question');
 assert(noteReport.input.cases.some(item=>item.role!=='pending'&&item.questionId===value('question')));
}else{
 ownedExact(noteData,fs.realpathSync(os.tmpdir()));
 assert.equal(noteData,path.join(fs.realpathSync(path.dirname(noteData)),'data'));
 assert.match(path.basename(path.dirname(noteData)),/^edudev-materials-live-[A-Za-z0-9]+$/);
}
const actualNote=one(noteData,'material_reading_entries',noteReport.savedReading.id);
assert.deepEqual(actualNote,noteReport.savedReading,'Exact real UI saved note, not a reconstructed note');
const noteResource=one(noteData,'teacher_resources',actualNote.resource_id);
const noteSourceFile=ownedExact(path.resolve(noteData,noteResource.local_path),noteData);
assert.equal(sha256(fs.readFileSync(noteSourceFile)),noteResource.content_hash);
const noteBefore=fingerprint(noteData).sha256,noteReportBefore=sha256(fs.readFileSync(noteReportFile));
const manualText='明确的人工 QA 备课内容，不是新 AI/OCR 结果。\n'+actualNote.note;
report.reusedReading={report:noteReportFile,reportSha256:noteReportBefore,dataSha256:noteBefore,
 ...(value('reading-producer-commit')?{producerCommit:value('reading-producer-commit')}:{}),
 noteId:actualNote.id,noteSha256:sha256(actualNote.note),sourceVersion:noteResource.content_hash};
const originalAssets=path.join(sourceData,'question-assets');
const assetFingerprint=fs.existsSync(originalAssets)?fingerprint(originalAssets).sha256:undefined;
report.preflight={ready:missing.length===0,missing,objects:{record:record?.id,block:block?.id,
 question:question?.id},counts:{notebooks:initial.teacher_notebooks.length,
 records:initial.teacher_notebook_records.length,books:initial.teaching_books.length,
 blocks:initial.teaching_book_blocks.length},originalBefore,
 visibleUiCreation:{notebook:!record,book:!block}};
report.sourceFiles=sources.map(({resourceId,sha256})=>({resourceId,sha256}));flush();
let sourceBefore,materialBodyVersion,validMaterialSource;
if(missing.length){
 assert.equal(fingerprint(fixture).sha256,originalBefore);
 report.status='NOT_RUN';
 report.originalUnchanged=true;flush();
 console.log(JSON.stringify({status:report.status,ready:report.preflight.ready,output,
  missing:missing.map(x=>x.code)}));process.exitCode=2;
}else{
 await prepareClone();
 if(inspect){
  preparationChecks();assert.equal(fingerprint(fixture).sha256,originalBefore);
  report.originalUnchanged=true;report.status='PREFLIGHT_READY';flush();
  console.log(JSON.stringify({status:report.status,ready:true,output,launches:0,
   checks:report.preparationChecks.length}));
 }else await run();
}

async function prepareClone(){
 fs.cpSync(sourceData,data,{recursive:true,errorOnExist:true,force:false});fs.mkdirSync(profile);
 assert.equal(fingerprint(data).sha256,fingerprint(sourceData).sha256);
 const before=snapshot(data),oldResources=rows(data,'teacher_resources');
 const db=new DatabaseSync(path.join(data,'app.db'));
 try{for(const source of sources){const file=path.join(data,source.relative);
  assert.equal(sha256(fs.readFileSync(source.path)),source.sha256);
  assert.equal(sha256(fs.readFileSync(file)),source.sha256);
  const changed=db.prepare('UPDATE teacher_resources SET local_path=? WHERE id=? AND content_hash=?')
   .run(file,source.resourceId,source.sha256);assert.equal(changed.changes,1);
 }}finally{db.close();}
 resourceRows=rows(data,'teacher_resources');assert.equal(resourceRows.length,oldResources.length);
 for(const old of oldResources){const current=resourceRows.find(r=>r.id===old.id);
  assert.deepEqual({...current,local_path:old.local_path},old,'Only owned clone transport path changed');}
 assert.deepEqual(snapshot(data),before,'Transport cannot alter business/approval/model facts');
 initial=before;chunkRows=rows(data,'resource_chunks');
 const resources=sql(data,'SELECT * FROM teacher_resources ORDER BY id');
 const chunks=sql(data,'SELECT * FROM resource_chunks ORDER BY resource_id,chunk_index ASC,id ASC');
 for(const row of [...resources,...chunks])Object.freeze(row);
 sourceBefore=Object.freeze({resources:Object.freeze(resources),chunks:Object.freeze(chunks)});
 const {build}=await import('esbuild');
 const compiled=await build({stdin:{contents:
  "export {materialBodyVersion} from './src/main/assets/material-source.ts';\n"+
  "export {validMaterialSource} from './src/shared/materials.ts';",
  resolveDir:desktop,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false});
 ({materialBodyVersion,validMaterialSource}=await import('data:text/javascript;base64,'+
  Buffer.from(compiled.outputFiles[0].text).toString('base64')));
 const source=JSON.parse(actualNote.source_json);
 const noteChunks=sql(noteData,'SELECT * FROM resource_chunks WHERE resource_id=? ORDER BY chunk_index ASC,id ASC',
  [actualNote.resource_id]);
 assert(validMaterialSource(source));assert.equal(source.resourceId,noteResource.id);
 assert.equal(source.version,noteResource.content_hash);
 const anchor=noteChunks[source.offset];assert(anchor);assert.equal(anchor.id,source.chunkId);
 assert.equal(source.bodyVersion,materialBodyVersion(sourceChunk(anchor)));
 report.transport={resources:sources.length,onlyField:'teacher_resources.local_path',
  sourceSnapshotSha256:sha256(JSON.stringify(sourceBefore)),businessSnapshotUnchanged:true};
}

function sourceChunk(row){return {id:String(row.id),chunkIndex:Number(row.chunk_index??0),
 contentMd:String(row.content_md??''),containsPersonalData:Number(row.contains_personal_data??0)===1,
 pageNumber:row.page_number==null?null:Number(row.page_number)};}
function startup(before,after,frozen=sourceBefore){
 assert(Object.isFrozen(frozen));
 assert.deepEqual(sql(data,'SELECT * FROM teacher_resources ORDER BY id'),frozen.resources);
 assert.deepEqual(sql(data,'SELECT * FROM resource_chunks ORDER BY resource_id,chunk_index ASC,id ASC'),frozen.chunks);
 for(const table of tables.filter(t=>t!=='question_bank_items'))assert.deepEqual(after[table],before[table],table);
 const old=new Map(before.question_bank_items.map(r=>[r.id,r]));
 const current=new Map(after.question_bank_items.map(r=>[r.id,r]));assert.equal(current.size,after.question_bank_items.length);
 for(const [id,row] of old){assert(current.has(id));const actual={...current.get(id)};
  if(!Object.hasOwn(row,'archive_json')&&Object.hasOwn(actual,'archive_json')){
   assert.equal(actual.archive_json,'');delete actual.archive_json;
  }assert.deepEqual(actual,row,'Every old teacher field preserved');
 }
 const added=after.question_bank_items.filter(r=>!old.has(r.id));
 for(const row of added){const archive=JSON.parse(row.archive_json);
  assert.equal(row.source_kind,'teacher_resource');assert.equal(row.document_json,'');
  assert.equal(archive.schemaVersion,'xiaozhi.question-archive.v1');assert.equal(archive.extractor,'numbered-text.v1');
  assert.equal(archive.state,'rule_extracted');assert.equal(archive.sourceChecked,false);
  assert(Array.isArray(archive.sources)&&archive.sources.length>0);
  for(const source of archive.sources){assert(validMaterialSource(source));
   const resource=frozen.resources.find(r=>r.id===source.resourceId),chunk=frozen.chunks.find(r=>r.id===source.chunkId);
   assert(resource&&chunk);assert.equal(source.version,resource.content_hash);
   assert.equal(chunk.resource_id,source.resourceId);
   assert.equal(frozen.chunks.filter(r=>r.resource_id===source.resourceId)[source.offset]?.id,source.chunkId);
   assert.equal(source.bodyVersion,materialBodyVersion(sourceChunk(chunk)));
  }
 }
 return {oldQuestions:old.size,newRuleCandidates:added.map(r=>r.id),oldFactsAndLedgersIntact:true};
}

function preparationChecks(){
 const checks=[];const check=(name,work)=>{work();checks.push({name,status:'PASS'});};
 check('Real owned clone only rebases local_path, preserving source bytes and all original ledgers',()=>{
  assert.deepEqual(snapshot(data),initial);assert(report.transport.businessSnapshotUnchanged);
 });
 check('Migration validator accepts unchanged real snapshot',()=>startup(initial,snapshot(data)));
 const chunk=sourceBefore.chunks.find(r=>!!String(r.content_md||''));assert(chunk);
 const resource=sourceBefore.resources.find(r=>r.id===chunk.resource_id);assert(resource);
 const source={schemaVersion:'xiaozhi.material-source.v1',resourceId:resource.id,version:resource.content_hash,
  offset:sourceBefore.chunks.filter(r=>r.resource_id===resource.id).findIndex(r=>r.id===chunk.id),
  chunkId:chunk.id,bodyVersion:materialBodyVersion(sourceChunk(chunk))};
 const candidate={id:'preparation-validator-only',source_kind:'teacher_resource',document_json:'',
  archive_json:JSON.stringify({schemaVersion:'xiaozhi.question-archive.v1',extractor:'numbered-text.v1',
   state:'rule_extracted',sourceChecked:false,sources:[source]})};
 const synthetic=()=>({...initial,question_bank_items:[...initial.question_bank_items,candidate]});
 check('Pure validator accepts exact pre-launch source anchor; candidate never enters SQLite',()=>startup(initial,synthetic()));
 check('Forged hash and ordered offset rejected despite valid shape',()=>{
  for(const changed of [{...source,bodyVersion:'0'.repeat(64)},{...source,offset:source.offset+1000},
   {...source,version:'0'.repeat(64)},{...source,chunkId:'missing-prelaunch-chunk'},
   {...source,resourceId:'missing-prelaunch-resource'}]){
   const after=synthetic();after.question_bank_items=[...initial.question_bank_items,{...candidate,
    archive_json:JSON.stringify({...JSON.parse(candidate.archive_json),sources:[changed]})}];
   assert.throws(()=>startup(initial,after));
  }
 });
 check('Old teacher field and model-ledger changes rejected',()=>{
  const after=structuredClone(initial);after.question_bank_items[0].stem+='x';assert.throws(()=>startup(initial,after));
  const ledger=structuredClone(initial);ledger.ai_agent_runs.push({id:'forbidden'});assert.throws(()=>startup(initial,ledger));
 });
 check('Real prior UI saved reading note/source remain exact',()=>{
  assert.equal(fingerprint(noteData).sha256,noteBefore);assert.equal(sha256(fs.readFileSync(noteReportFile)),noteReportBefore);
  assert.equal(sha256(fs.readFileSync(noteSourceFile)),noteResource.content_hash);
 });
 check('Manual setup delta rejects old facts changed, extra rows or ledger activity',()=>{
  const after=structuredClone(initial);after.teacher_notebooks.push({id:'validator-only'});
  assertSetupDelta(initial,after,{teacher_notebooks:1});
  assert.throws(()=>assertSetupDelta(initial,after,{}));
  after.ai_agent_runs.push({id:'forbidden'});
  assert.throws(()=>assertSetupDelta(initial,after,{teacher_notebooks:1}));
  const changed=structuredClone(initial);changed.question_bank_items[0].stem+='changed';
  assert.throws(()=>assertSetupDelta(initial,changed,{}));
 });
 report.preparationChecks=checks;flush();
}

function assertSetupDelta(before,after,expected){
 const added={};
 for(const table of tables){
  if(!expected[table]){assert.deepEqual(after[table],before[table],table+' no setup writes');continue;}
  const old=new Map(before[table].map(row=>[row.id,row]));
  const current=new Map(after[table].map(row=>[row.id,row]));
  assert.equal(current.size,after[table].length);
  for(const [id,row] of old)assert.deepEqual(current.get(id),row,table+' old facts preserved');
  added[table]=after[table].filter(row=>!old.has(row.id));
  assert.equal(added[table].length,expected[table],table+' exact UI-created membership');
 }
 return added;
}

async function run(){
 assert(value('pins'),'--pins=<new frozen pins> required');
 const pinsFile=ownedExact(path.resolve(desktop,value('pins')),owned);
 const pins=JSON.parse(fs.readFileSync(pinsFile,'utf8'));
 const build=ownedExact(pins.buildRoot,owned),main=ownedExact(path.join(build,'main/index.js'),build);
 report.pins={file:pinsFile,...pins};
 const verify=()=>{assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);
  assert.equal(preparationSource,pins.source,'Formal source contract belongs to the frozen source');
  assert.equal(fingerprint(build).sha256,pins.build);};
 verify();
 let app,page,child,phase='CLONE',activeCheck='FORMAL_STARTUP_MIGRATION',post;
 const time=cap=>{const left=deadlineAt-Date.now();assert(left>0,'180 second suite deadline');
  return Math.min(cap,left);};
 const watchdog=setTimeout(()=>{report.status='FAIL';report.failure={code:'TOTAL_DEADLINE',phase};flush();
  report.checks.find(c=>c.code===activeCheck).status='FAIL';flush();
  if(child?.pid)spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  process.exit(1);},time(180000));
 const wait=async(fn,label)=>{const end=Date.now()+time(12000);
  while(Date.now()<end){if(await fn())return;await new Promise(resolve=>setTimeout(resolve,80));}
  throw Error('WAIT_'+label);};
 const tid=id=>page.getByTestId(id);
 const unique=async locator=>{await locator.waitFor({state:'visible',timeout:time(12000)});
  assert.equal(await locator.count(),1);assert(await locator.isVisible());return locator;};
 const ready=async locator=>{await unique(locator);await wait(()=>locator.isEnabled(),'CONTROL_ENABLED');return locator;};
 const click=async locator=>{await ready(locator);await locator.click();};
 const field=async(id,text)=>{const locator=await ready(tid(id));await locator.fill(text);};
 const pass=code=>{report.checks.find(c=>c.code===code).status='PASS';flush();};
 const start=code=>{assert(codes.includes(code));activeCheck=code;report.phase=code;flush();};
 const guard=async()=>{const g=await app.evaluate(continuationGuardRead,true);
  assert.equal(g.policyProbe,'FORMAL_FRAME_AND_ZERO_HTTP_VERIFIED');
  for(const key of ['networkAttempts','modelAttempts','rendererErrors'])assert.equal(g[key],0);
  report.launches.at(-1).guard=g;};
 const kill=()=>new Promise(resolve=>{
  if(!child||child.exitCode!==null)return resolve();
  const process=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
  process.once('close',resolve);process.once('error',resolve);
 });
 async function close(){
  if(!app)return;const result=await closeContinuationRuntime({observeGuard:guard,close:()=>app.close(),
   forceClose:kill,deadlineAt,cap:4000});report.launches.at(-1).cleanup=result;
  if(result.closed){app=undefined;child=undefined;}assert(result.closed&&!result.guardError&&!result.closeError);
 }
 async function launch(){
  verify();assert(report.launches.length<2);phase='BOOTSTRAP';
  const number=report.launches.length+1,state=path.join(output,`bootstrap-state-${number}.json`);
  const bootstrap=path.join(output,`bootstrap-${number}.cjs`);
  fs.writeFileSync(bootstrap,continuationBootstrap({main,profile,diagnosticFile:state}),{flag:'wx'});
  const env={...process.env};for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||
   key.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
  Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1'});
  report.launches.push({number});flush();
  app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile,'--force-device-scale-factor=1'],
   cwd:data,env,timeout:time(30000)});child=app.process();report.launches.at(-1).pid=child.pid;
  for(const stream of [child.stdout,child.stderr])stream?.on('data',bytes=>{
   if(/uncaught|unhandled rejection|unhandledrejection/i.test(String(bytes)))
    report.errors.push({code:'MAIN_RUNTIME_FATAL',phase,hash:sha256(bytes)});
  });
  await waitContinuationBootstrap(app,{timeout:time(20000),observeWindow:true,
   readState:()=>readContinuationBootstrapFile(state,child),onWindow:window=>{
    page=window;page.setDefaultTimeout(12000);
    page.on('pageerror',error=>report.errors.push({code:'PAGE_ERROR',phase,hash:sha256(error.stack||error.message)}));
    page.on('console',message=>{if(message.type()==='error')
     report.errors.push({code:'CONSOLE_ERROR',phase,hash:sha256(message.text())});});
   }});
  report.launches.at(-1).identity=await assertIsolatedPiMain(app,main,profile);
  assert.equal(await app.evaluate(({session})=>session.defaultSession.storagePath),profile);
  await guard();await tid('xiaozhi-pi-workspace').waitFor({timeout:time(20000)});
  assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
  await page.emulateMedia({colorScheme:'light'});
 }
 async function route(view){
  await click(productEntry(page,'teaching'));
  await click(tid('teaching-page-navigation').getByTestId('hub-entry-'+view));
 }
 const approved=initial.ai_confirmation_items.find(r=>r.status==='confirmed'&&
  JSON.parse(r.result_json||'null')?.saved?.questionId===question.id);
 const document=JSON.parse(question.document_json),statement=document.context.projection.statement.text;
 const newQuestionText=statement+'\n';
 let newRecordText,oldPayload,newBlockText,pageRow;
 const imageHashes=document.blocks.filter(b=>b.kind==='image').map(b=>({assetId:b.assetId,sha256:b.sha256}));
 const equalExcept=(before,after,allowed)=>assert.deepEqual(
  Object.fromEntries(Object.entries(after).filter(([key])=>!allowed.includes(key))),
  Object.fromEntries(Object.entries(before).filter(([key])=>!allowed.includes(key))));
 const noUnexpectedChanges=()=>{
  const now=snapshot(data);
  for(const table of tables){
   if(initial[table].every(row=>typeof row.id==='string'))
    assert.deepEqual(now[table].map(row=>row.id),initial[table].map(row=>row.id),table+' membership');
   if(!['teacher_notebook_records','teaching_book_blocks','question_bank_items','ai_confirmation_items'].includes(table))
    assert.deepEqual(now[table],initial[table],table+' immutable');
   else for(const old of initial[table]){
    const current=now[table].find(row=>row.id===old.id);assert(current);
    const target=table==='teacher_notebook_records'?record.id:table==='teaching_book_blocks'?block.id:
     table==='question_bank_items'?question.id:approved.id;
    if(old.id!==target)assert.deepEqual(current,old);
   }
  }
  assert.deepEqual(rows(data,'teacher_resources'),resourceRows);
  assert.deepEqual(rows(data,'resource_chunks'),chunkRows);
  for(const source of sources){
   assert.equal(sha256(fs.readFileSync(source.path)),source.sha256);
   const row=resourceRows.find(r=>r.id===source.resourceId);
   assert.equal(sha256(fs.readFileSync(path.resolve(data,row.local_path))),source.sha256);
  }
  if(assetFingerprint)assert.equal(fingerprint(path.join(data,'question-assets')).sha256,assetFingerprint);
  assert.equal(fingerprint(noteData).sha256,noteBefore);
  assert.equal(sha256(fs.readFileSync(noteReportFile)),noteReportBefore);
  assert.equal(sha256(fs.readFileSync(noteSourceFile)),noteResource.content_hash);
 };
 async function settledStartup(){
  const resources=sql(data,'SELECT COUNT(DISTINCT resource_id) AS n FROM resource_chunks')[0].n;
  await wait(async()=>{const state=await page.evaluate(()=>window.omniEdu.getMaterialQuestionStatus());
   report.startupArchiveStatus={pending:state.pending,associating:state.associating,
    failed:state.failed,documents:state.documents};
   return state.pending===0&&!state.associating&&state.failed===0&&state.documents>=resources;
  },'FORMAL_ARCHIVE_IDLE');
  let before=snapshot(data),stable=0;
  await wait(async()=>{await new Promise(resolve=>setTimeout(resolve,120));const after=snapshot(data);
   stable=sha256(JSON.stringify(before))===sha256(JSON.stringify(after))?stable+1:0;
   before=after;return stable>=3;
  },'STARTUP_FACTS_STABLE');return before;
 }
 async function manualSetup(){
  phase='VISIBLE_MANUAL_QA_SETUP';start(phase);const before=snapshot(data),expected={};
  const prefix='人工 QA '+path.basename(output);
  const findNew=async(table,predicate)=>{
   const old=new Set(before[table].map(row=>row.id));let found;
   await wait(()=>{const matches=rows(data,table).filter(row=>!old.has(row.id)&&predicate(row));
    assert(matches.length<=1,table+' unique new UI object');found=matches[0];return !!found;
   },'CREATE_'+table);return found;
  };
  if(!record){
   await route('notebook');await click(tid('teacher-notebook-new'));
   await field('teacher-notebook-name',prefix+'备课本');
   await field('teacher-notebook-description','人工 QA；复用已保存阅读笔记；不请求模型。');
   await click(tid('teacher-notebook-create'));
   const notebook=await findNew('teacher_notebooks',row=>row.name===prefix+'备课本');
   assert.equal(notebook.status,'active');
   await click(tid('teacher-notebook-item-'+notebook.id));
   await field('teacher-notebook-record-title',prefix+'笔记');
   await field('teacher-notebook-record-output',manualText);
   await click(tid('teacher-notebook-record-save'));
   record=await findNew('teacher_notebook_records',row=>row.notebook_id===notebook.id&&row.title===prefix+'笔记');
   assert.equal(record.output,manualText);assert.equal(record.version,1);
   await unique(tid('teacher-notebook-record-edit-'+record.id));
   Object.assign(expected,{teacher_notebooks:1,teacher_notebook_records:1});
  }
  if(!block){
   await route('book');await click(tid('teaching-book-new'));
   await field('teaching-book-title',prefix+'讲义');
   await field('teaching-book-description','人工 QA 内容；不是模型生成讲义。');
   await click(tid('teaching-book-create'));
   const book=await findNew('teaching_books',row=>row.title===prefix+'讲义');
   await unique(tid('teaching-book-item-'+book.id));
   await field('teaching-book-chapter-title',prefix+'章节');await click(tid('teaching-book-chapter-create'));
   const chapter=await findNew('teaching_book_chapters',row=>row.book_id===book.id&&row.title===prefix+'章节');
   await (await ready(tid('teaching-book-page-chapter'))).selectOption(chapter.id);
   await field('teaching-book-page-title',prefix+'页面');await click(tid('teaching-book-page-create'));
   const bookPage=await findNew('teaching_book_pages',row=>row.book_id===book.id&&row.chapter_id===chapter.id);
   await (await ready(tid('teaching-book-block-page'))).selectOption(bookPage.id);
   await field('teaching-book-block-title',prefix+'内容块');await field('teaching-book-block-text',manualText);
   await click(tid('teaching-book-block-save'));
   block=await findNew('teaching_book_blocks',row=>row.page_id===bookPage.id&&row.title===prefix+'内容块');
   assert.deepEqual(JSON.parse(block.payload_json),{text:manualText});assert.equal(block.version,1);
   assert.deepEqual(JSON.parse(block.source_anchors_json),[]);
   assert.equal(block.params_json,'{}');assert.equal(block.metadata_json,'{}');assert.equal(block.error,'');
   await unique(tid('teaching-book-block-edit-'+block.id));
   Object.assign(expected,{teaching_books:1,teaching_book_chapters:1,teaching_book_pages:1,teaching_book_blocks:1});
  }
  const after=snapshot(data),added=assertSetupDelta(before,after,expected);
  initial=after;pageRow=initial.teaching_book_pages.find(row=>row.id===block.page_id);assert(pageRow);
  oldPayload=JSON.parse(block.payload_json);newBlockText=oldPayload.text+'\n\n'+marker;
  newRecordText=record.output+'\n\n'+marker;
  report.manualSetup={added:Object.fromEntries(Object.entries(added).map(([table,rs])=>[table,rs.map(r=>r.id)])),
   recordId:record.id,blockId:block.id,manualBodySha256:sha256(manualText),oldFactsAndLedgersIntact:true};
  noUnexpectedChanges();pass('VISIBLE_MANUAL_QA_SETUP');
 }
 async function openRecord(){await route('notebook');await click(tid('teacher-notebook-item-'+record.notebook_id));
  await click(tid('teacher-notebook-record-edit-'+record.id));}
 async function openBlock(){await route('book');await click(tid('teaching-book-item-'+pageRow.book_id));
  await click(tid('teaching-book-block-edit-'+block.id));}
 async function openQuestion(){await route('question_notebook');
  const card=tid('question-notebook-card-'+question.id);await card.waitFor();
  await click(card.getByTestId('question-context-open'));return card.getByTestId('question-context-editor');}
 async function layout(){for(const width of [1366,800,1920]){
  phase='LAYOUT_'+width;start(phase);
  await app.evaluate(({BrowserWindow},s)=>{const windows=BrowserWindow.getAllWindows();
   if(windows.length!==1)throw Error('OWNED_WINDOW_NOT_UNIQUE');windows[0].setContentSize(s.width,s.height);},
   {width,height:width===1920?1080:768});
  await wait(()=>page.evaluate(w=>innerWidth===w,width),'VIEWPORT');
  for(const open of [openRecord,openBlock,openQuestion]){
   await open();const ids=open===openRecord?['teacher-notebook-record-save','teacher-notebook-record-cancel']:
    open===openBlock?['teaching-book-block-save','teaching-book-block-cancel']:
     ['question-context-save','question-context-cancel'];
   const controls=[];
   for(const id of ids){const control=await unique(tid(id));await control.scrollIntoViewIfNeeded();
    if(await control.isEnabled()){
     await control.focus();assert(await control.evaluate(el=>el===document.activeElement));
    }else assert.equal(id,'question-context-save','Only unchecked question confirmation starts disabled');
    const bounds=await control.boundingBox();assert(bounds&&bounds.x>=0&&bounds.y>=0&&
     bounds.x+bounds.width<=width+1&&bounds.y+bounds.height<=(width===1920?1080:768)+1);
    controls.push({id,bounds,enabled:await control.isEnabled(),
     focused:await control.evaluate(el=>el===document.activeElement)});
   }
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
   const name=open===openRecord?'notebook':open===openBlock?'book':'question';
   report.layoutSamples.push({consumer:name,width,controls,geometry:await page.evaluate(()=>({
    width:innerWidth,height:innerHeight,pageScrollWidth:document.documentElement.scrollWidth}))});
   const file=`${name}-${width}.png`;await page.screenshot({path:path.join(output,file),animations:'disabled'});
   report.screens.push({file,sha256:sha256(fs.readFileSync(path.join(output,file)))});
   await click(tid(ids.at(-1)));
  }pass('LAYOUT_'+width);
 }}
 try{
  start('FORMAL_STARTUP_MIGRATION');await launch();phase='STARTUP_BASELINE';
  const migrated=await settledStartup();report.startupMigration=startup(initial,migrated);
  initial=migrated;question=one(data,'question_bank_items',question.id);pass('FORMAL_STARTUP_MIGRATION');
  await manualSetup();
  await layout();phase='NOTEBOOK';start('NOTEBOOK_CANCEL_SAVE_RETURN');
  await openRecord();await field('teacher-notebook-record-output',newRecordText);
  await click(tid('teacher-notebook-record-cancel'));
  assert.deepEqual(one(data,'teacher_notebook_records',record.id),record);
  await openRecord();assert.equal(await tid('teacher-notebook-record-output').inputValue(),record.output);
  await field('teacher-notebook-record-output',newRecordText);await click(tid('teacher-notebook-record-save'));
  await wait(()=>one(data,'teacher_notebook_records',record.id).version===record.version+1,'RECORD_SAVE');
  const savedRecord=one(data,'teacher_notebook_records',record.id);
  equalExcept(record,savedRecord,['output','version','updated_at']);assert.equal(savedRecord.output,newRecordText);
  await openRecord();assert.equal(await tid('teacher-notebook-record-output').inputValue(),newRecordText);
  await click(tid('teacher-notebook-record-cancel'));pass('NOTEBOOK_CANCEL_SAVE_RETURN');
  phase='BOOK';start('BOOK_CANCEL_SAVE_PREVIEW_RETURN');
  await openBlock();await field('teaching-book-block-text',newBlockText);
  await click(tid('teaching-book-block-cancel'));assert.deepEqual(one(data,'teaching_book_blocks',block.id),block);
  await openBlock();assert.equal(await tid('teaching-book-block-text').inputValue(),oldPayload.text);
  await field('teaching-book-block-text',newBlockText);await click(tid('teaching-book-block-save'));
  await wait(()=>one(data,'teaching_book_blocks',block.id).version===block.version+1,'BLOCK_SAVE');
  const savedBlock=one(data,'teaching_book_blocks',block.id);
  equalExcept(block,savedBlock,['payload_json','version','updated_at']);
  assert.deepEqual(JSON.parse(savedBlock.payload_json),{text:newBlockText});
  await openBlock();assert.equal(await tid('teaching-book-block-text').inputValue(),newBlockText);
  await click(tid('teaching-book-block-cancel'));await click(tid('teaching-book-preview-refresh'));
  await wait(async()=>(await tid('teaching-book-preview').innerText()).includes(marker),'REAL_BOOK_PREVIEW');
  pass('BOOK_CANCEL_SAVE_PREVIEW_RETURN');
  phase='QUESTION';start('QUESTION_CANCEL_SAVE_RETURN');let editor=await openQuestion();
  await editor.getByTestId('projection-statement-text').fill(newQuestionText);
  await click(editor.getByTestId('question-context-cancel'));assert.deepEqual(one(data,'question_bank_items',question.id),question);
  editor=await openQuestion();assert.equal(await editor.getByTestId('projection-statement-text').inputValue(),statement);
  await editor.getByTestId('projection-statement-text').fill(newQuestionText);
  await editor.getByTestId('projection-statement-state').selectOption('provided');
  const checkboxRoot=await unique(editor.getByTestId('question-context-complete'));
  const checkbox=checkboxRoot.locator('input[type="checkbox"]');assert.equal(await checkbox.count(),1);
  assert(await checkbox.isEnabled());await checkbox.focus();await checkbox.press('Space');assert(await checkbox.isChecked());
  await click(editor.getByTestId('question-context-save'));
  await wait(()=>one(data,'question_bank_items',question.id).stem===newQuestionText,'QUESTION_SAVE');
  const savedQuestion=one(data,'question_bank_items',question.id),savedDocument=JSON.parse(savedQuestion.document_json);
  equalExcept(question,savedQuestion,['stem','document_json','updated_at']);
  assert.deepEqual(savedDocument.source,document.source);assert.deepEqual(savedDocument.answer,document.answer);
  assert.deepEqual(savedDocument.analysis,document.analysis);assert.deepEqual(savedDocument.blocks.filter(b=>b.kind==='image')
   .map(b=>({assetId:b.assetId,sha256:b.sha256})),imageHashes);
  const savedApproval=one(data,'ai_confirmation_items',approved.id);
  equalExcept(approved,savedApproval,['result_json','updated_at']);
  const oldEffect=JSON.parse(approved.result_json),effect=JSON.parse(savedApproval.result_json);
  assert.equal(effect.contextRevisions.length,(oldEffect.contextRevisions||[]).length+1);
  equalExcept(oldEffect,effect,['contextRevisions']);
  assert.deepEqual(effect.contextRevisions.slice(0,-1),oldEffect.contextRevisions||[]);
  const revision=effect.contextRevisions.at(-1);
  assert.equal(revision.schemaVersion,'xiaozhi.question-context-edit.v1');
  assert.deepEqual(revision.projection,savedDocument.context.projection);
  assert.equal(revision.previousDigest,oldEffect.contextRevisions?.at(-1)?.digest||oldEffect.digest);
  editor=await openQuestion();assert.equal(await editor.getByTestId('projection-statement-text').inputValue(),newQuestionText);
  await click(editor.getByTestId('question-context-cancel'));pass('QUESTION_CANCEL_SAVE_RETURN');
  noUnexpectedChanges();post=snapshot(data);start('COLD_SAVED_OBJECTS');
  await close();await launch();phase='COLD';
  assert.deepEqual(await settledStartup(),post);
  await openRecord();assert.equal(await tid('teacher-notebook-record-output').inputValue(),newRecordText);
  await click(tid('teacher-notebook-record-cancel'));await openBlock();
  assert.equal(await tid('teaching-book-block-text').inputValue(),newBlockText);await click(tid('teaching-book-block-cancel'));
  editor=await openQuestion();assert.equal(await editor.getByTestId('projection-statement-text').inputValue(),newQuestionText);
  await click(editor.getByTestId('question-context-cancel'));pass('COLD_SAVED_OBJECTS');
  start('ZERO_MODEL_SOURCE_LEDGER_INTEGRITY');
  await guard();assert.equal(report.errors.length,0);noUnexpectedChanges();await close();
  assert.deepEqual(snapshot(data),post);verify();assert.equal(fingerprint(fixture).sha256,originalBefore);
  pass('ZERO_MODEL_SOURCE_LEDGER_INTEGRITY');assert(report.checks.every(c=>c.status==='PASS'));
  report.success=true;report.status='PASS';
 }catch(error){report.status='FAIL';report.failure={code:'EDITOR_ASSERTION_FAILED',phase,
  qaFrames:[...String(error.stack||'').replaceAll('\\','/').matchAll(
   /\/scripts\/ui-final-teaching-editors-live\.mjs:(\d+):(\d+)/g)]
   .slice(0,6).map(match=>({file:'scripts/ui-final-teaching-editors-live.mjs',line:Number(match[1]),column:Number(match[2])})),
  hash:sha256(error.stack||String(error))};
  report.checks.find(c=>c.code===activeCheck).status='FAIL';
  if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});
 }finally{
  try{await close();}catch(error){report.errors.push({code:'OWNED_CLEANUP_FAILED',phase,hash:sha256(String(error))});
   await kill();report.success=false;report.status='FAIL';
   report.checks.find(c=>c.code===activeCheck).status='FAIL';}
  clearTimeout(watchdog);report.originalUnchanged=fingerprint(fixture).sha256===originalBefore;
  try{verify();assert(report.originalUnchanged);noUnexpectedChanges();}
  catch(error){report.success=false;report.status='FAIL';
   report.checks.find(c=>c.code==='ZERO_MODEL_SOURCE_LEDGER_INTEGRITY').status='FAIL';
   report.errors.push({code:'EXIT_INTEGRITY',phase,hash:sha256(String(error))});}
  flush();console.log(JSON.stringify({success:report.success,status:report.status,output}));
  process.exitCode=report.success?0:1;
 }
}
