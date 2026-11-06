/** Actual retained source readers and original crop dialog. Zero provider requests.
 * Clones only existing real teacher-approved/real pending records; no new OCR or
 * model results. Resource transport paths in the clone are rebased with byte proof.
 * Historical successes/failures remain historical, never relabelled by this suite.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {continuationBootstrap,continuationGuardRead} from './acceptance/paper-adaptation-continuation.mjs';
import {productEntry} from './product-navigation.mjs';
import {disclosureTrigger} from './acceptance/paper-basket-ui-driver.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const {materialBodyVersion,validMaterialSource}=await loadMaterialSourceContract();
if(process.argv.slice(2).join(' ')==='--self-test'){
  await retainedStartupSelfTest();process.exit(0);
}
const pinsFile=process.argv.find(x=>x.startsWith('--pins='))?.slice(7);
assert(pinsFile,'--pins=<current frozen build> is required');
const pins=JSON.parse(fs.readFileSync(path.resolve(desktop,pinsFile)));
assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);
assert.equal(fingerprint(pins.buildRoot).sha256,pins.build);
process.env.OMNI_EDU_TEST_BUILD_ROOT=pins.buildRoot;
const main=testMain(desktop),output=fs.mkdtempSync(path.join(desktop,'test-results/ui-final-retained-sources-'));
const referenceArg=process.argv.find(x=>x.startsWith('--reference-root='))?.slice(17);
const reference=referenceArg?fs.realpathSync(path.resolve(desktop,referenceArg)):'D:/WorkProject/EduProject/apps/desktop/test-results';
if(referenceArg){
  const owned=fs.realpathSync(path.join(desktop,'test-results'));
  assert(reference.startsWith(owned+path.sep),'Replacement baseline stays in owned test-results');
  const previous=JSON.parse(fs.readFileSync(path.join(reference,'report.json')));
  assert.equal(previous.success,true,'Replacement is a completed genuine retained-source run');
  for(const name of ['education-journey-YlBdIe','education-journey-0T0vdK','education-journey-mnXCtZ'])
    assert(previous.cases.some(item=>item.name===name),'All original case identities are retained');
}
const report={success:false,suite:'UI-FINAL retained real source readers and crop layout',output,pins,
  checks:[],cases:[],screens:[],errors:[],modelRequests:0,launches:0,
  boundaries:['Existing genuine teacher-reviewed single/multi-image and real pending proposal records only; no new OCR/model output.',
    'Clone resource transport-path rebase is QA setup, not a migration feature. Original roots must remain byte-identical.',
    'Crop edits are cancelled; no candidate approval, source mutation or new question is permitted.',
    'Zero HTTP guard composed with original frame policy before formal main import. Private reasoning is never captured.']};
const deadline=Date.now()+220000;
const flush=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
const remaining=()=>{assert(Date.now()<deadline,'220s suite work budget');return deadline-Date.now();};
async function until(fn,label,max=12000){const end=Date.now()+Math.min(max,remaining());while(Date.now()<end){if(await fn())return;await delay(100);}throw Error('Timed out: '+label);}
const hashFile=file=>sha256(fs.readFileSync(file));
function sql(data,query,args=[]){assert(/^SELECT\b/.test(query));const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(query).all(...args);}finally{db.close();}}
function facts(data){return Object.fromEntries(['question_bank_items','ai_confirmation_items','xiaozhi_pi_usage','xiaozhi_pi_commands','ai_agent_runs']
  .map(table=>[table,sql(data,`SELECT * FROM ${table} ORDER BY rowid`)]));}
function assertFactsUnchanged(data,before){
  const after=facts(data);
  for(const row of after.question_bank_items){const old=before.question_bank_items.find(r=>r.id===row.id);
    if(old&&!Object.hasOwn(old,'archive_json')&&Object.hasOwn(row,'archive_json')){assert.equal(row.archive_json,'','Only formal empty archive column migration');delete row.archive_json;}}
  assert.deepEqual(after,before,'All original question/approval/run/command/usage fields unchanged');return after;
}
async function loadMaterialSourceContract(){
  const {build}=await import('esbuild');
  const result=await build({stdin:{contents:
    "export {materialBodyVersion} from './src/main/assets/material-source.ts';\n"+
    "export {validMaterialSource} from './src/shared/materials.ts';",
    resolveDir:desktop,loader:'ts'},bundle:true,platform:'node',format:'esm',write:false,logLevel:'silent'});
  return import('data:text/javascript;base64,'+Buffer.from(result.outputFiles[0].text).toString('base64'));
}
function freezeMaterialSources(data){
  // This clone has no app/writer yet. SQLite supplies the production BINARY id
  // tiebreaker: never substitute insertion order or chunk_index for body offset.
  const snapshot={resources:sql(data,'SELECT * FROM teacher_resources ORDER BY id'),
    chunks:sql(data,'SELECT * FROM resource_chunks ORDER BY resource_id,chunk_index ASC,id ASC')};
  for(const rows of Object.values(snapshot)){for(const row of rows)Object.freeze(row);Object.freeze(rows);}
  return Object.freeze(snapshot);
}
function sourceChunk(row){
  // Same input conversions as OmniEduStore.mapResourceChunk; hashing itself is
  // the actual materialBodyVersion export, bundled in memory without file writes.
  return {id:String(row.id),chunkIndex:Number(row.chunk_index??0),contentMd:String(row.content_md??''),
    containsPersonalData:Number(row.contains_personal_data??0)===1,
    pageNumber:row.page_number==null?null:Number(row.page_number)};
}
function assertMaterialSourcesUnchanged(data,before){
  assert.deepEqual(freezeMaterialSources(data),before,'Pre-launch material resources and chunks unchanged');
}
function assertStartupMigration(data,before,after,sourceBefore){
  assert(sourceBefore&&Object.isFrozen(sourceBefore),'Pre-launch source snapshot required');
  assertMaterialSourcesUnchanged(data,sourceBefore);
  for(const table of Object.keys(before).filter(t=>t!=='question_bank_items'))assert.deepEqual(after[table],before[table],'No new run/approval/command/usage during startup');
  const previous=new Map(before.question_bank_items.map(row=>[row.id,row]));
  const current=new Map(after.question_bank_items.map(row=>[row.id,row]));assert.equal(current.size,after.question_bank_items.length);
  for(const [id,row] of previous){const actual={...current.get(id)};assert(current.has(id),'No approved question disappeared');
    if(!Object.hasOwn(row,'archive_json')&&Object.hasOwn(actual,'archive_json')){assert.equal(actual.archive_json,'','Formal empty archive column only');delete actual.archive_json;}
    assert.deepEqual(actual,{...row},'All historical teacher question fields retained');}
  const resources=new Map(sourceBefore.resources.map(row=>[row.id,row]));
  const chunks=new Map(sourceBefore.chunks.map(row=>[row.id,row]));
  assert.equal(resources.size,sourceBefore.resources.length);assert.equal(chunks.size,sourceBefore.chunks.length);
  const ordered=new Map();
  for(const chunk of sourceBefore.chunks){const rows=ordered.get(chunk.resource_id)||[];
    rows.push(chunk);ordered.set(chunk.resource_id,rows);}
  const added=after.question_bank_items.filter(row=>!previous.has(row.id));
  for(const row of added){const archive=JSON.parse(row.archive_json);assert.equal(row.source_kind,'teacher_resource');assert.equal(row.document_json,'');
    assert.equal(archive.schemaVersion,'xiaozhi.question-archive.v1');assert.equal(archive.extractor,'numbered-text.v1');assert.equal(archive.state,'rule_extracted');assert.equal(archive.sourceChecked,false);
    assert(Array.isArray(archive.sources)&&archive.sources.length>0);
    for(const source of archive.sources){
      assert(validMaterialSource(source),'Formal material source shape required');
      const resource=resources.get(source.resourceId),chunk=chunks.get(source.chunkId);
      assert(resource,'Anchor resource must exist before launch');assert(chunk,'Anchor chunk must exist before launch');
      assert.equal(source.version,resource.content_hash,'Pre-launch original version');
      assert.equal(chunk.resource_id,source.resourceId,'Pre-launch resource/chunk membership');
      assert.equal(ordered.get(source.resourceId)?.[source.offset]?.id,source.chunkId,'Formal ordered body offset');
      assert.equal(source.bodyVersion,materialBodyVersion(sourceChunk(chunk)),'Pre-launch formal body version');
    }
  }
  return {oldQuestions:previous.size,newRuleCandidates:added.map(row=>row.id),oldTeacherFieldsUnchanged:true,newApprovals:0,newModelRuns:0,
    note:'Formal startup rule extraction of already parsed real material; not teacher confirmation, OCR rerun or model generation.'};
}
async function retainedStartupSelfTest(){
  const output=fs.mkdtempSync(path.join(desktop,'test-results/ui-final-retained-startup-selftest-'));
  const result={suite:'Retained startup pre-launch anchor QA contract',success:false,checks:[],output,
    electronLaunches:0,modelRequests:0,boundary:'Synthetic owned native SQLite fixtures only; not actual product acceptance.',
    scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),
    formalSourceSha256:sha256(fs.readFileSync(path.join(desktop,'src/main/assets/material-source.ts')))};
  const rid='resource_00000000-0000-0000-0000-000000000001';
  const other='resource_00000000-0000-0000-0000-000000000002';
  const cid=n=>'chunk_00000000-0000-0000-0000-'+String(n).padStart(12,'0');
  const write=(data,action)=>{const db=new DatabaseSync(path.join(data,'app.db'));try{return action(db);}finally{db.close();}};
  function fixture(){
    const data=fs.mkdtempSync(path.join(output,'case-'));
    write(data,db=>{
      db.exec(`CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT,parse_status TEXT,title TEXT);
        CREATE TABLE resource_chunks(id TEXT PRIMARY KEY,resource_id TEXT,chunk_index INTEGER,content_md TEXT,contains_personal_data INTEGER,page_number INTEGER);
        CREATE TABLE question_bank_items(id TEXT PRIMARY KEY,source_kind TEXT,document_json TEXT,archive_json TEXT,answer TEXT);
        INSERT INTO question_bank_items VALUES('old','teacher','approved','','retained answer');`);
      for(const table of ['ai_confirmation_items','xiaozhi_pi_usage','xiaozhi_pi_commands','ai_agent_runs']){
        db.exec(`CREATE TABLE ${table}(id TEXT PRIMARY KEY,value TEXT);INSERT INTO ${table} VALUES('old','retained');`);
      }
      const resource=db.prepare('INSERT INTO teacher_resources VALUES(?,?,?,?)');
      resource.run(rid,'a'.repeat(64),'ready','Synthetic pre-launch source');
      resource.run(other,'b'.repeat(64),'ready','Synthetic other source');
      const chunk=db.prepare('INSERT INTO resource_chunks VALUES(?,?,?,?,?,?)');
      chunk.run(cid(2),rid,4,'Second ordered source chunk',0,3);
      chunk.run(cid(1),rid,4,'First ordered source chunk',0,2);
      chunk.run(cid(3),rid,17,'Unknown-page source chunk',0,null);
    });
    const before=facts(data),sourceBefore=freezeMaterialSources(data);
    const anchor={schemaVersion:'xiaozhi.material-source.v1',resourceId:rid,version:'a'.repeat(64),
      chunkId:cid(2),offset:1,bodyVersion:materialBodyVersion(sourceChunk(sourceBefore.chunks[1]))};
    const archive={schemaVersion:'xiaozhi.question-archive.v1',extractor:'numbered-text.v1',
      state:'rule_extracted',sourceChecked:false,sources:[anchor]};
    write(data,db=>db.prepare('INSERT INTO question_bank_items VALUES(?,?,?,?,?)')
      .run('added','teacher_resource','',JSON.stringify(archive),''));
    return {data,before,sourceBefore,anchor,archive};
  }
  const saveArchive=f=>write(f.data,db=>db.prepare('UPDATE question_bank_items SET archive_json=? WHERE id=?')
    .run(JSON.stringify(f.archive),'added'));
  const validate=f=>assertStartupMigration(f.data,f.before,facts(f.data),f.sourceBefore);
  const denied=(mutate)=>{const f=fixture();mutate(f);assert.throws(()=>validate(f),assert.AssertionError);};
  const check=(code,action)=>{try{action();result.checks.push({code,status:'PASS'});}
    catch(error){result.checks.push({code,status:'FAIL',stackHash:sha256(error.stack||String(error))});throw error;}};
  try{
    check('VALID_NATIVE_SQLITE_PRELAUNCH_ANCHOR',()=>{
      const f=fixture(),value=validate(f);assert.deepEqual(value.newRuleCandidates,['added']);
      assert.equal(value.oldQuestions,1);
    });
    check('SQLITE_FORMAL_OFFSET_USES_INDEX_THEN_ID_NOT_ROWID_OR_INDEX_VALUE',()=>{
      const f=fixture();assert.deepEqual(f.sourceBefore.chunks.map(c=>c.id),[cid(1),cid(2),cid(3)]);
      assert.deepEqual(sql(f.data,'SELECT id FROM resource_chunks ORDER BY rowid').map(c=>c.id),[cid(2),cid(1),cid(3)]);
      validate(f);
    });
    check('PRELAUNCH_ROWS_AND_COLLECTIONS_CANNOT_BE_REBOUND',()=>{
      const f=fixture();assert.throws(()=>{f.sourceBefore.chunks[0].content_md='changed';},TypeError);
      assert.throws(()=>f.sourceBefore.resources.push({}),TypeError);
    });
    check('MISSING_PRELAUNCH_RESOURCE_REJECTED',()=>denied(f=>{
      f.anchor.resourceId='resource_00000000-0000-0000-0000-000000000099';saveArchive(f);
    }));
    check('MISSING_PRELAUNCH_CHUNK_REJECTED',()=>denied(f=>{f.anchor.chunkId=cid(99);saveArchive(f);}));
    check('CROSS_RESOURCE_CHUNK_MEMBERSHIP_REJECTED',()=>denied(f=>{
      f.anchor.resourceId=other;f.anchor.version='b'.repeat(64);saveArchive(f);
    }));
    check('REGEX_VALID_BUT_FORGED_BODY_HASH_REJECTED',()=>denied(f=>{
      f.anchor.bodyVersion='c'.repeat(64);saveArchive(f);
    }));
    check('FORMAL_HASH_BINDS_TEXT_INDEX_PRIVACY_AND_PAGE',()=>{
      for(const patch of [{contentMd:'forged text'},{chunkIndex:99},{containsPersonalData:true},{pageNumber:77}]){
        denied(f=>{f.anchor.bodyVersion=materialBodyVersion({...sourceChunk(f.sourceBefore.chunks[1]),...patch});saveArchive(f);});
      }
    });
    check('INVALID_OR_DIFFERENT_ORDERED_OFFSETS_REJECTED',()=>{
      for(const offset of [-1,0,4,1.5,99])denied(f=>{f.anchor.offset=offset;saveArchive(f);});
    });
    check('STARTUP_REWRITTEN_SOURCE_AND_MATCHING_POSTSTART_ANCHOR_REJECTED',()=>denied(f=>{
      write(f.data,db=>{
        db.prepare('UPDATE teacher_resources SET content_hash=? WHERE id=?').run('d'.repeat(64),rid);
        db.prepare('UPDATE resource_chunks SET content_md=? WHERE id=?').run('post-start rewrite',cid(2));
      });
      f.anchor.version='d'.repeat(64);
      f.anchor.bodyVersion=materialBodyVersion({...sourceChunk(f.sourceBefore.chunks[1]),contentMd:'post-start rewrite'});
      saveArchive(f);
    }));
    check('NEW_STARTUP_RESOURCE_AND_CHUNK_CANNOT_AUTHORIZE_NEW_CANDIDATE',()=>denied(f=>{
      const id='resource_00000000-0000-0000-0000-000000000099';
      write(f.data,db=>{
        db.prepare('INSERT INTO teacher_resources VALUES(?,?,?,?)').run(id,'e'.repeat(64),'ready','late source');
        db.prepare('INSERT INTO resource_chunks VALUES(?,?,?,?,?,?)').run(cid(99),id,0,'late body',0,1);
      });
      Object.assign(f.anchor,{resourceId:id,version:'e'.repeat(64),chunkId:cid(99),offset:0,
        bodyVersion:materialBodyVersion({id:cid(99),chunkIndex:0,contentMd:'late body',containsPersonalData:false,pageNumber:1})});
      saveArchive(f);
    }));
    check('DELETED_PRELAUNCH_CHUNK_REJECTED',()=>denied(f=>{
      write(f.data,db=>db.prepare('DELETE FROM resource_chunks WHERE id=?').run(cid(2)));
    }));
    check('HISTORICAL_TEACHER_FIELD_CHANGE_REJECTED',()=>denied(f=>{
      write(f.data,db=>db.prepare('UPDATE question_bank_items SET answer=? WHERE id=?').run('changed','old'));
    }));
    check('ONLY_EMPTY_FORMAL_OLD_ARCHIVE_COLUMN_ALLOWED',()=>{
      const f=fixture();delete f.before.question_bank_items[0].archive_json;validate(f);
      write(f.data,db=>db.prepare('UPDATE question_bank_items SET archive_json=? WHERE id=?').run('{}','old'));
      assert.throws(()=>validate(f),assert.AssertionError);
    });
    check('ALL_FOUR_EXISTING_LEDGER_BASELINES_RETAINED',()=>{
      for(const table of ['ai_confirmation_items','xiaozhi_pi_usage','xiaozhi_pi_commands','ai_agent_runs']){
        denied(f=>write(f.data,db=>db.prepare(`UPDATE ${table} SET value=? WHERE id=?`).run('changed','old')));
      }
    });
    check('POSTSTART_FULL_BASELINE_PROTECTS_NEW_CANDIDATE_TOO',()=>{
      const f=fixture();validate(f);const full=facts(f.data);assertFactsUnchanged(f.data,full);
      write(f.data,db=>db.prepare('UPDATE question_bank_items SET answer=? WHERE id=?').run('changed','added'));
      assert.throws(()=>assertFactsUnchanged(f.data,full),assert.AssertionError);
    });
    check('UNKNOWN_PAGE_FORMAL_HASH_REMAINS_SUPPORTED',()=>{
      const f=fixture();Object.assign(f.anchor,{chunkId:cid(3),offset:2,
        bodyVersion:materialBodyVersion(sourceChunk(f.sourceBefore.chunks[2]))});saveArchive(f);validate(f);
    });
    result.success=true;
  }finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(result,null,2)+'\n');}
  console.log(JSON.stringify({code:'RETAINED_STARTUP_SELFTEST_PASS',checks:result.checks.length,output}));
}
let app,page,child,activeCase;
async function capture(label){const file=label+'.png';await page.screenshot({path:path.join(output,file),animations:'disabled'});report.screens.push({file,sha256:hashFile(path.join(output,file))});flush();}
async function size(width,height=768){await app.evaluate(({BrowserWindow},s)=>BrowserWindow.getAllWindows()[0].setContentSize(s.width,s.height),{width,height});await until(()=>page.evaluate(s=>innerWidth===s.width&&innerHeight===s.height,{width,height}),'content size');}
async function noOverflow(){assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page horizontal overflow');}
async function close(){if(!app)return;const owned=app;app=undefined;await owned.close();await until(()=>child.exitCode!==null||child.signalCode!==null,'owned Electron exited');}
async function prepare(name){
  const original=fs.realpathSync(path.join(reference,name));assert(original.startsWith(fs.realpathSync(reference)+path.sep));
  const originBefore=fingerprint(original).sha256,root=path.join(output,name),data=path.join(root,'data'),profile=path.join(root,'profile');
  assert(fs.statSync(path.join(original,'data/app.db')).size>0,'Existing real baseline database required');
  fs.mkdirSync(root);fs.cpSync(path.join(original,'data'),data,{recursive:true});fs.cpSync(path.join(original,referenceArg?'profile':'electron-profile'),profile,{recursive:true});
  const rebased=[],db=new DatabaseSync(path.join(data,'app.db'));
  try{for(const r of db.prepare('SELECT id,local_path,content_hash FROM teacher_resources').all()){
    const relative=path.relative(path.join(original,'data'),r.local_path);assert(!relative.startsWith('..')&&!path.isAbsolute(relative));
    const file=path.join(data,relative);assert.equal(hashFile(file),r.content_hash);assert.equal(hashFile(r.local_path),r.content_hash);
    db.prepare('UPDATE teacher_resources SET local_path=? WHERE id=?').run(file,r.id);rebased.push({resourceId:r.id,sha256:r.content_hash});
  }}finally{db.close();}
  assert.equal(fingerprint(original).sha256,originBefore);
  const before=facts(data),sourceFiles=sql(data,'SELECT id,local_path,content_hash FROM teacher_resources');
  const sourceBefore=freezeMaterialSources(data);
  const record={name,original,originBefore,clone:root,rebased,sourceFiles:sourceFiles.map(r=>({id:r.id,sha256:r.content_hash})),
    beforeHash:sha256(JSON.stringify(before)),preLaunchSourceHash:sha256(JSON.stringify(sourceBefore)),
    preLaunchSources:{resources:sourceBefore.resources.length,chunks:sourceBefore.chunks.length}};
  report.cases.push(record);activeCase={record,data,profile,before,sourceFiles,sourceBefore};
  const env={...process.env};for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
  Object.assign(env,{NODE_ENV:'development',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1'});
  const bootstrap=path.join(root,'bootstrap.cjs');fs.writeFileSync(bootstrap,continuationBootstrap({main,profile,diagnosticFile:path.join(root,'bootstrap-state.json')}));
  app=await electron.launch({args:[bootstrap,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:Math.min(30000,remaining())});child=app.process();report.launches++;
  page=await app.firstWindow({timeout:Math.min(25000,remaining())});page.setDefaultTimeout(10000);page.on('pageerror',e=>report.errors.push({case:name,code:'PAGE_ERROR',hash:sha256(e.stack||e.message)}));
  page.on('console',m=>{if(m.type()==='error')report.errors.push({case:name,code:'CONSOLE_ERROR',hash:sha256(m.text())});});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:25000});
  record.main=await assertIsolatedPiMain(app,main,profile);assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),path.resolve(data));
  record.guardBefore=await app.evaluate(continuationGuardRead,true);await page.emulateMedia({colorScheme:'light'});
  // Current formal main indexes old parsed resources into unreviewed candidates.
  // Validate that migration separately, then freeze facts for the read/cancel flow.
  const parsedResources=sql(data,'SELECT COUNT(DISTINCT resource_id) AS n FROM resource_chunks')[0].n;
  await until(async()=>{const state=await page.evaluate(()=>window.omniEdu.getMaterialQuestionStatus());record.startupArchiveStatus=state;return state.pending===0&&!state.associating&&state.failed===0&&state.documents>=parsedResources;},'formal archive completes old parsed resources',20000);
  let snapshot=facts(data),stable=0;
  await until(async()=>{await delay(120);const next=facts(data);stable=sha256(JSON.stringify(snapshot))===sha256(JSON.stringify(next))?stable+1:0;snapshot=next;return stable>=3;},'formal startup facts settle');
  record.startupMigration=assertStartupMigration(data,before,snapshot,sourceBefore);activeCase.before=snapshot;
  record.interactionBaselineHash=sha256(JSON.stringify(snapshot));flush();
}
async function finish(){
  const {record,data,before,sourceFiles,sourceBefore}=activeCase;record.guardAfter=await app.evaluate(continuationGuardRead,true);
  assert.equal(record.guardAfter.networkAttempts,0);assert.equal(record.guardAfter.modelAttempts,0);assert.equal(record.guardAfter.rendererErrors,0);
  await close();assertFactsUnchanged(data,before);assertMaterialSourcesUnchanged(data,sourceBefore);
  for(const r of sourceFiles)assert.equal(hashFile(r.local_path),r.content_hash);
  record.originAfter=fingerprint(record.original).sha256;assert.equal(record.originAfter,record.originBefore);record.afterHash=sha256(JSON.stringify(assertFactsUnchanged(data,before)));record.success=true;flush();
}
async function notebook(){await productEntry(page,'teaching').click();await page.getByTestId('teaching-page-navigation').getByTestId('hub-entry-question_notebook').click();}
async function reader(name,questionId,count){
  await prepare(name);await notebook();const card=page.getByTestId('question-notebook-card-'+questionId),open=card.getByTestId('question-original-open');
  await open.click();await until(()=>card.getByTestId('question-original-image').evaluateAll(images=>images.length>0&&images.every(i=>i.complete&&i.naturalWidth>0)),'real original PNG decode',25000);
  assert.equal(await card.getByTestId('question-original-image').count(),count);assert.equal(await card.locator('[data-testid="question-original-picture"] [role="alert"]').count(),0);
  for(const width of [800,1366,1920]){
    await size(width,width===1920?1080:768);const papers=card.locator('.pi-original-paper');assert.equal(await papers.count(),count);
    for(let i=0;i<count;i++){const paper=papers.nth(i);await paper.scrollIntoViewIfNeeded();await paper.focus();assert(await paper.evaluate(n=>document.activeElement===n));
      const extent=await paper.evaluate(n=>({x:n.scrollWidth-n.clientWidth,y:n.scrollHeight-n.clientHeight}));
      if(extent.y>1){await paper.press('End');await until(()=>paper.evaluate(n=>n.scrollTop>0),'keyboard source vertical scroll');await paper.press('Home');}
      if(extent.x>1){await paper.press('ArrowRight');await until(()=>paper.evaluate(n=>n.scrollLeft>0),'keyboard source horizontal scroll');}
      await noOverflow();
    }
    await papers.first().scrollIntoViewIfNeeded();await capture(name+'-'+width);
  }
  report.checks.push({id:count===1?'SINGLE_SOURCE':'MULTI_SOURCE',status:'pass',images:count,sizes:[800,1366,1920],providerRequests:0});await finish();
}
try{
  flush();await reader('education-journey-YlBdIe','question_78d96406-9590-4678-99f7-64c829651a1a',1);
  await reader('education-journey-0T0vdK','question_10934996-88dc-4e32-87df-10a71b9f07e0',3);
  await prepare('education-journey-mnXCtZ');
  const row=sql(activeCase.data,"SELECT id,session_id FROM ai_confirmation_items WHERE action_type='pi_original_question_multi_candidate' AND status='pending'");assert.equal(row.length,1);
  const sid=row[0].session_id;if(await page.locator('.office-composer-container:visible').getAttribute('data-session-id')!==sid){await page.getByTestId('workbench-session-'+sid).click();await until(()=>page.locator('.office-composer-container:visible').getAttribute('data-session-id').then(id=>id===sid),'original session');}
  const card=page.locator(`[data-testid="pi-original-review"][data-review-id="${row[0].id}"]`);await card.waitFor();
  if(!await card.getByTestId('original-multi-images').isVisible())await card.locator('[data-slot="chat-tool-trigger"]').click();
  await card.getByTestId('original-multi-images').waitFor({timeout:25000});const ranges=card.getByTestId('original-multi-ranges');await disclosureTrigger(ranges,'调整取题范围与答案出处').click();
  const pick=card.getByTestId('original-range-0').getByTestId('original-range-pick');
  for(const width of [800,1366,1920]){
    await size(width,width===1920?1080:768);await pick.click();const dialog=page.getByTestId('original-region-picker');await dialog.waitFor();
    await until(()=>dialog.getByTestId('original-region-page').evaluate(img=>img.complete&&img.naturalWidth>0),'actual local full-page crop raster',25000);
    const crop=dialog.getByRole('group',{name:'题目选框，可用方向键移动',exact:true});await crop.focus();await crop.press('ArrowRight');
    const cancel=dialog.getByTestId('original-region-cancel'),apply=dialog.getByTestId('original-region-apply');
    for(const button of [cancel,apply]){await button.focus();const box=await button.boundingBox();assert(box&&box.y>=0&&box.y+box.height<=(width===1920?1080:768),'Modal footer reachable');}
    await noOverflow();await capture('crop-dialog-'+width);await cancel.click();await dialog.waitFor({state:'hidden'});assert(await pick.evaluate(n=>document.activeElement===n),'Focus returns to actual picker trigger');
  }
  report.checks.push({id:'CROP_REAL_PAGE_CANCEL',status:'pass',sizes:[800,1366,1920],providerRequests:0});await finish();
  assert.equal(report.errors.length,0);assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);assert.equal(fingerprint(pins.buildRoot).sha256,pins.build);report.success=true;
}catch(error){report.failure={name:error.name,message:String(error.message).replace(/sk-[\w-]+/g,'[credential]').slice(0,1000),stackHash:sha256(error.stack||String(error))};if(page&&!page.isClosed())try{await capture('failure');}catch{}}
finally{try{await close();}catch(error){report.errors.push({code:'CLOSE',hash:sha256(error.stack||String(error))});report.success=false;}
  if(activeCase)try{const{record,data,before,sourceFiles,sourceBefore}=activeCase;assertFactsUnchanged(data,before);assertMaterialSourcesUnchanged(data,sourceBefore);for(const r of sourceFiles)assert.equal(hashFile(r.local_path),r.content_hash);assert.equal(fingerprint(record.original).sha256,record.originBefore);report.exitIntegrity=true;}
  catch(error){report.exitIntegrity=false;report.success=false;report.errors.push({code:'EXIT_INTEGRITY',hash:sha256(error.stack||String(error))});}flush();}
console.log(JSON.stringify({output,success:report.success,checks:report.checks,launches:report.launches,failure:report.failure}));if(!report.success)process.exitCode=1;
