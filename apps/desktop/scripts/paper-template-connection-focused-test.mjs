/** Real sqlite3 queue regression only. No app, product fixture, provider or build.
 * --check: load native driver, create no database.
 * --run-sqlite: exactly one two-connection attempt in a NEW OS temp directory.
 * This proves the driver dependency behind transaction-scoped materials; it also
 * executes production PaperTemplateService with real scoped MaterialRepository.
 * No formal UI acceptance is claimed.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const argv=process.argv.slice(2);
assert(argv.length<=1&&argv.every(a=>['--check','--run-sqlite'].includes(a)),'Use --check or --run-sqlite only');
const {default:sqlite3}=await import('sqlite3');
if(!argv.includes('--run-sqlite')){
  console.log(JSON.stringify({ready:true,driver:'sqlite3 native asynchronous callbacks',sqliteVersion:sqlite3.VERSION,execution:false,databasesCreated:0,electronLaunches:0,providerCalls:0,command:'node scripts/paper-template-connection-focused-test.mjs --run-sqlite'}));
}else{
  const root=fs.realpathSync(os.tmpdir()),output=fs.mkdtempSync(path.join(root,'edu-template-connection-'));
  assert.equal(path.dirname(fs.realpathSync(output)),root);
  const database=path.join(output,'connection-probe.sqlite'),reportPath=path.join(output,'report.json');
  const report={success:false,scope:'real sqlite3 queue plus production template service scoped-materials regression; NOT Electron/UI acceptance',attempts:1,connections:2,automaticRetries:0,electronLaunches:0,providerCalls:0,output,events:[]};
  const start=performance.now(),event=name=>report.events.push({name,elapsedMs:Math.round(performance.now()-start)});
  const persist=()=>fs.writeFileSync(reportPath,JSON.stringify(report,null,2));
  const watchdog=setTimeout(()=>{report.error='Hard 30s deadline; no automatic retry';persist();console.error(JSON.stringify(report));process.exit(1);},30000);
  const open=()=>new Promise((resolve,reject)=>{const db=new sqlite3.Database(database,error=>{if(error)reject(error);else{db.serialize();db.configure('busyTimeout',3000);resolve(db);}});});
  const run=(db,sql,params=[])=>new Promise((resolve,reject)=>db.run(sql,params,error=>error?reject(error):resolve()));
  const all=(db,sql,params=[])=>new Promise((resolve,reject)=>db.all(sql,params,(error,rows)=>error?reject(error):resolve(rows)));
  const close=db=>new Promise((resolve,reject)=>db.close(error=>error?reject(error):resolve()));
  const bounded=async(promise,ms,label)=>{let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(label)),ms);})]);}finally{clearTimeout(timer);}};
  let main,work,held=false,mainWrite,mainRead;
  try{
    main=await open();await run(main,'PRAGMA journal_mode=WAL');
    await run(main,'CREATE TABLE connection_probe(id INTEGER PRIMARY KEY,value TEXT NOT NULL)');
    await run(main,"INSERT INTO connection_probe VALUES(1,'initial')");
    work=await open();report.sqliteVersion=(await all(work,'SELECT sqlite_version() version'))[0].version;
    await run(work,'BEGIN IMMEDIATE');held=true;await run(work,"UPDATE connection_probe SET value='work-uncommitted' WHERE id=1");event('work-write-lock-held');
    let writeSettled=false,readSettled=false;
    // Real competing write on the serialized MAIN connection, followed by read.
    // Both promises convert errors into outcomes immediately: no unhandled reject.
    mainWrite=run(main,"UPDATE connection_probe SET value='main-after-release' WHERE id=1").then(()=>{writeSettled=true;event('main-write-finished');return {ok:true};},error=>{writeSettled=true;return {ok:false,error};});
    event('main-write-enqueued');
    mainRead=all(main,'SELECT value FROM connection_probe WHERE id=1').then(rows=>{readSettled=true;event('main-read-finished');return {ok:true,rows};},error=>{readSettled=true;return {ok:false,error};});
    event('parent-material-read-enqueued-behind-main-write');
    // Same callback shape as proposed SQL + scoped-materials transaction contract.
    // All returned values below come from native sqlite3, never a mocked reply.
    const scopedMaterials={read:()=>all(work,'SELECT value FROM connection_probe WHERE id=1')};
    const scoped=await bounded((async(sql,materials)=>{
      assert.equal((await sql.all('SELECT value FROM connection_probe WHERE id=1'))[0].value,'work-uncommitted');
      return materials.read();
    })({all:(sql,params)=>all(work,sql,params)},scopedMaterials),1200,'Scoped work read waited on main connection');
    assert.equal(scoped[0].value,'work-uncommitted');event('scoped-material-read-finished-while-lock-held');
    assert(held&&!writeSettled&&!readSettled,'Scoped read must complete before either parent operation or lock release');
    const legacyCompleted=await Promise.race([mainRead.then(()=>true),new Promise(resolve=>setTimeout(()=>resolve(false),150))]);
    assert.equal(legacyCompleted,false,'Parent read must remain queued behind its blocked write');event('parent-read-still-blocked-negative-control');
    // Only the test releases the work lock; awaiting parent materials first would
    // prevent reaching this release until busy timeout / cancellation breaks it.
    await run(work,'ROLLBACK');held=false;event('work-lock-released');
    const written=await bounded(mainWrite,1500,'Parent writer did not settle after rollback');assert(written.ok,written.error?.message);
    const read=await bounded(mainRead,1500,'Parent read did not settle after rollback');assert(read.ok,read.error?.message);assert.equal(read.rows[0].value,'main-after-release');
    const index=name=>report.events.findIndex(e=>e.name===name);
    assert(index('scoped-material-read-finished-while-lock-held')<index('work-lock-released'));
    assert(index('work-lock-released')<index('main-write-finished'));
    assert(index('main-write-finished')<index('main-read-finished'));
    report.checks=['Parent serialized read blocked behind competing write','Scoped SQL/material read sees same uncommitted transaction before release','Parent write then read settle after explicit work rollback'];
    report.service=await serviceScoping({main,work,run,all,bounded,output,event});
    report.success=true;
  }catch(error){report.error=String(error.stack??error);process.exitCode=1;}
  finally{
    if(held&&work)try{await run(work,'ROLLBACK');}catch(error){report.rollbackError=String(error);report.success=false;process.exitCode=1;}
    await Promise.allSettled([mainWrite,mainRead].filter(Boolean));
    for(const db of [work,main])if(db)try{await close(db);}catch(error){report.closeError=String(error);report.success=false;process.exitCode=1;}
    clearTimeout(watchdog);persist();console.log(JSON.stringify({success:report.success,scope:report.scope,output,sqliteVersion:report.sqliteVersion,attempts:report.attempts,automaticRetries:0,electronLaunches:0,providerCalls:0,service:report.service?{success:report.service.success,forbiddenParentTouches:report.service.forbiddenParentTouches,phases:report.service.transactions.map(t=>t.phase),versions:report.service.versions,receipts:report.service.receipts}:undefined,error:report.error}));
  }
}

async function serviceScoping({main,work,run,all,bounded,output,event}){
  // Reuse the host-focused fixture's real source/migrations/repositories, replacing
  // DatabaseSync with the SAME TWO native sqlite3 connections used above.
  // Source-only fixture bundling stays in this new temp directory, never out/.
  const {build}=await import('esbuild'),desktop=fileURLToPath(new URL('..',import.meta.url));
  const entry=[['paper-template-service','createPaperTemplateService'],['paper-template-schema','migratePaperTemplates'],['paper-basket-state','migratePaperBaskets'],['paper-basket-repository','PaperBasketRepository'],['paper-template-source','extractTemplateSource']];
  const built=await build({stdin:{contents:entry.map(([f,n])=>`export {${n}} from './src/main/education/${f}';`).join('\n')+"\nexport {MaterialRepository} from './src/main/assets/material-repository';",resolveDir:desktop},write:false,bundle:true,packages:'external',platform:'node',format:'esm',plugins:[{name:'source-host-only',setup(b){
    b.onResolve({filter:/^electron$/},()=>({path:'forbidden-electron',namespace:'denied'}));
    b.onLoad({filter:/.*/,namespace:'denied'},()=>({contents:"export const app=new Proxy({}, {get(){throw Error('Electron forbidden in scoped connection test')}}); export const utilityProcess=app;"}));
    b.onResolve({filter:/^[A-Za-z@]/},args=>({path:import.meta.resolve(args.path),external:true}));
  }}]});
  const bundle=path.join(output,'service-source.mjs');fs.writeFileSync(bundle,built.outputFiles[0].text,{flag:'wx'});
  const m=await import(pathToFileURL(bundle).href),signal=()=>new AbortController().signal;
  let phase='fixture',afterBasketWrite=false,parentTouches=0;
  const calls=[],transactions=[];
  const unused=()=>{throw Error('Unused fixture capability invoked');};
  const sql={all:(q,p=[])=>all(work,q,p),run:async(q,p=[])=>{await run(work,q,p);if(/^UPDATE paper_baskets SET schema_version/.test(q))afterBasketWrite=true;},read:unused,validate:unused,page:unused};
  await run(work,'PRAGMA foreign_keys=ON');
  for(const q of [
    'CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,student_id TEXT,archived_at TEXT)',
    'CREATE TABLE students(id TEXT PRIMARY KEY,status TEXT)',
    'CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT,title TEXT,original_file_name TEXT,local_path TEXT,parse_status TEXT,parse_engine TEXT)',
    'CREATE TABLE resource_chunks(id TEXT PRIMARY KEY,resource_id TEXT,chunk_index INTEGER,content_md TEXT,contains_personal_data INTEGER)'])await run(work,q);
  await m.migratePaperBaskets(sql);await m.migratePaperTemplates(sql);
  const sourceRoot=path.join(output,'materials');fs.mkdirSync(sourceRoot);
  const actualMaterials=new m.MaterialRepository({root:sourceRoot,all:sql.all,change:unused,
    mapResource:r=>({id:r.id,contentHash:r.content_hash,title:r.title,originalFileName:r.original_file_name,localPath:r.local_path,parseStatus:r.parse_status,parseEngine:r.parse_engine,chunkCount:Number(r.chunk_count)}),
    mapChunk:r=>({id:r.id,resourceId:r.resource_id,chunkIndex:r.chunk_index,contentMd:r.content_md,containsPersonalData:!!r.contains_personal_data}),commit:unused,reuse:unused,failure:unused});
  const scoped=new Proxy(actualMaterials,{get(target,key){const value=Reflect.get(target,key);return typeof value==='function'?(...args)=>{calls.push({phase,method:String(key),afterBasketWrite});return value.apply(target,args);}:value;}});
  const forbiddenParent=new Proxy({},{get(_target,key){parentTouches++;throw Error('WRONG_PARENT_MATERIALS:'+String(key));}});
  const transaction=async action=>{
    await run(work,'BEGIN IMMEDIATE');afterBasketWrite=false;let lock=true,writeDone=false,readDone=false;
    const parentWrite=run(main,"UPDATE connection_probe SET value='service-parent-write' WHERE id=1").then(()=>{writeDone=true;return {ok:true};},error=>{writeDone=true;return {error};});
    const parentRead=all(main,'SELECT value FROM connection_probe WHERE id=1').then(rows=>{readDone=true;return {rows};},error=>{readDone=true;return {error};});
    try{
      const result=await bounded(action(sql,scoped),2000,'Production '+phase+' did not finish on scoped connection');
      assert(!writeDone&&!readDone,'Production '+phase+' must finish while MAIN remains blocked');
      transactions.push({phase,completedBeforeParent:true});event('service-'+phase+'-finished-before-parent');
      await run(work,'COMMIT');lock=false;return result;
    }catch(error){if(lock){await run(work,'ROLLBACK');lock=false;}throw error;}
    finally{
      const w=await parentWrite,r=await parentRead;assert(!w.error,w.error?.message);assert(!r.error,r.error?.message);assert.equal(r.rows[0].value,'service-parent-write');
    }
  };
  const session='aisession_'+randomUUID(),rid='resource_'+randomUUID(),file=path.join(sourceRoot,'scoped-reference.txt');
  await run(work,'INSERT INTO ai_conversation_sessions VALUES (?,?,NULL)',[session,'']);
  const blueprint={title:'Connection fixture',subject:'数学',grade:'初二',durationMinutes:30,totalPoints:5,mode:'source_only',sections:[{id:'original',label:'原选择',questionType:'选择题',count:1,points:5}]};
  const baskets=new m.PaperBasketRepository({...sql,transaction,readTransaction:transaction});
  const b=await baskets.create({schemaVersion:'xiaozhi.paper-basket.v1',sessionId:session,requestId:randomUUID(),blueprint});
  const text='试卷名称：真实连接回归参考卷\n学科：数学\n年级：初二\n时长：30分钟\n总分：10分\n一、选择题 共1题 每题10分';fs.writeFileSync(file,text,{flag:'wx'});
  const version=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  await run(work,'INSERT INTO teacher_resources VALUES (?,?,?,?,?,?,?)',[rid,version,'真实参考','scoped-reference.txt',file,'ready','text.v1']);
  await run(work,'INSERT INTO resource_chunks VALUES (?,?,?,?,0)',['chunk_'+randomUUID(),rid,0,text]);
  const raw=await transaction((q,materials)=>m.extractTemplateSource(q,materials,rid,version,signal()));
  const patches=['title','subject','grade','durationMinutes','totalPoints'].map(key=>({path:key,teacherValue:raw[key].value,confirmed:true}));
  for(const key of ['label','questionType','count','points'])patches.push({path:'sections.0.'+key,teacherValue:raw.sections[0][key].value,confirmed:true});
  const service=m.createPaperTemplateService({materials:forbiddenParent,transaction});
  const input={schemaVersion:'xiaozhi.paper-reference.v1',sessionId:session,basketId:b.id,basketRevision:b.revision,resourceId:rid,version,expectedCandidateDigest:raw.digest,expectedHeadVersion:0,name:'Scoped structure',kind:'structure',patches};
  phase='save';const saved=await service.save({...input,requestId:'save_'+randomUUID()},signal());assert.equal(saved.template.version,1);
  phase='save-derived-check';const copy=await service.save({...input,requestId:'copy_'+randomUUID(),name:'Scoped copy',derivedFrom:saved.template},signal());assert.notEqual(copy.template.templateId,saved.template.templateId);
  const layout={paper:'A4',orientation:'portrait',columns:'2',top:'1134',right:'1134',bottom:'1134',left:'1134',columnGap:'567'};
  phase='save-layout';const layoutSaved=await service.save({...input,requestId:'layout_'+randomUUID(),name:'Scoped layout',kind:'layout',patches:Object.entries(layout).map(([key,teacherValue])=>({path:'layout.'+key,teacherValue,confirmed:true}))},signal());
  const target={sessionId:session,basketId:b.id};
  phase='list';const listed=await service.list(target,signal());assert.equal(listed.versions.length,3);assert.deepEqual(listed.unavailable,[]);
  phase='read';const read=await service.read({...target,...copy.template},signal());assert.deepEqual(read.derivedFrom,saved.template);
  phase='apply-both-writeBasket';const applied=await service.apply({...target,expectedRevision:b.revision,requestId:'apply_'+randomUUID(),kind:'both',structure:saved.template,layout:layoutSaved.template,mapping:[{templateSectionId:'template_0',target:{kind:'new',sectionId:'scoped_new'}}]},signal());assert.equal(applied.basketRevision,b.revision+1);
  phase='arrange-writeBasket';const arranged=await service.arrange({...target,expectedRevision:applied.basketRevision,requestId:'arrange_'+randomUUID(),operation:{kind:'release-empty',sectionId:'original'}},signal());assert.equal(arranged.basketRevision,applied.basketRevision+1);
  assert.equal(parentTouches,0);
  for(const name of ['save','save-derived-check','save-layout','list','read','apply-both-writeBasket','arrange-writeBasket']){
    assert(calls.some(c=>c.phase===name&&c.method==='originalStamp'),'No real source verification in '+name);
    assert(transactions.some(t=>t.phase===name&&t.completedBeforeParent));
  }
  for(const name of ['apply-both-writeBasket','arrange-writeBasket'])assert(calls.filter(c=>c.phase===name&&c.method==='verify'&&c.afterBasketWrite).length>=2,'Post-UPDATE writeBasket must verify BOTH actual sources via scoped materials');
  assert(calls.filter(c=>c.phase==='save-derived-check'&&c.method==='verify').length>=3,'Derived check and precommit verification must both execute');
  assert.equal((await all(work,'SELECT count(*) n FROM paper_template_receipts'))[0].n,5);
  const persisted=JSON.parse((await all(work,'SELECT data_json FROM paper_baskets WHERE id=?',[b.id]))[0].data_json);assert.equal(persisted.c2.retainedSections.find(r=>r.section.id==='original').released,true);
  return {success:true,productionService:true,realMaterialRepository:true,sourceBundleSha256:createHash('sha256').update(fs.readFileSync(bundle)).digest('hex'),driver:'sqlite3',forbiddenParentTouches:parentTouches,transactions,calls,versions:listed.versions.length,receipts:5,scope:'isolated service scoping only; does not execute OmniEduStore callback wiring or Electron matrix'};
}
