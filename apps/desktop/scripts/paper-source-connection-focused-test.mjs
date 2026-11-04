/** Real OmniEduStore wiring + async sqlite3 contention. Fresh owned fixtures only.
 * No init(), Electron process, model, old database, rewritten source stamp or SQL reply stub.
 * Runtime access to TS-private hosts is deliberate: exercise the actual registered closures.
 * A test-bundle factory wrapper captures the adaptation host without replacing its callbacks.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {performance} from 'node:perf_hooks';
import {build} from 'esbuild';
import {fingerprint} from './acceptance/evidence.mjs';

assert.deepEqual(process.argv.slice(2),['--run-sqlite']);
const desktop=fileURLToPath(new URL('..',import.meta.url));
const output=fs.mkdtempSync(path.join(fs.realpathSync(os.tmpdir()),'edu-paper-source-connection-'));
const data=path.join(output,'data');fs.mkdirSync(data);fs.mkdirSync(path.join(data,'teacher_resources'));
const report={success:false,output,scope:'source-bundled real OmniEduStore transaction/callback wiring; NOT UI or full paper delivery acceptance',electronLaunches:0,modelCalls:0,checks:[],events:[],sourceBefore:fingerprint(path.join(desktop,'src')).sha256,limits:['Fresh minimal SQLite fixture schema; production basket/template migrations and original source extraction.','Only Electron exports stubbed; every accessed stub throws.','Actual registered repository host callbacks and public basket read, not replacement callback implementations.']};
const start=performance.now(),event=(name,extra={})=>report.events.push({name,ms:Math.round(performance.now()-start),...extra});
const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const watchdog=setTimeout(()=>{report.fatal='Hard 45s deadline';persist();process.exit(1);},45000);
const bounded=async(p,ms,label)=>{let t;try{return await Promise.race([p,new Promise((_,reject)=>{t=setTimeout(()=>reject(Error(label)),ms);})]);}finally{clearTimeout(t);}};
const outcome=p=>p.then(value=>({ok:true,value}),error=>({ok:false,error}));
const signal=()=>new AbortController().signal;
const run=(db,q,p=[])=>new Promise((resolve,reject)=>db.run(q,p,e=>e?reject(e):resolve()));
let store,m,phase='setup',parentTouches=[],active=false,opened=0,liveConnections=0,maxConnections=0;
const physicalReads=[];
const check=async(name,fn)=>{phase=name;try{await fn();report.checks.push({name,status:'PASS'});console.log('PASS '+name);}catch(e){report.checks.push({name,status:'FAIL',error:String(e.stack)});console.log('FAIL '+name+' '+e.message);}persist();};
try{
  const exports=[['paper-template-schema','migratePaperTemplates'],['paper-basket-state','migratePaperBaskets'],['paper-basket-state','readStoredBasket'],['paper-template-service','createPaperTemplateService'],['paper-template-source','extractTemplateSource'],['paper-template-snapshot','currentC2Snapshot'],['paper-template-snapshot','captureTemplateSources'],['paper-template-currentness','verifyBasketTemplates']];
  const built=await build({stdin:{contents:"export {OmniEduStore} from './src/main/db';\nexport {adaptationHostForTest} from 'test:adaptation-host';\n"+exports.map(([f,n])=>`export {${n}} from './src/main/education/${f}';`).join('\n'),resolveDir:desktop},bundle:true,write:false,packages:'external',platform:'node',format:'esm',plugins:[{name:'capture-adaptation-host',setup(b){
    // Both imports resolve to one wrapper; the original factory, service and db callback stay intact.
    b.onResolve({filter:/^(test:adaptation-host|\.\/education\/paper-basket-adaptation-service)$/},()=>({path:'adaptation-host',namespace:'test-adaptation-host'}));
    b.onLoad({filter:/.*/,namespace:'test-adaptation-host'},()=>({resolveDir:desktop,contents:`
      import {createPaperBasketAdaptationService as originalFactory} from './src/main/education/paper-basket-adaptation-service.ts';
      const hosts=new WeakMap();
      export function createPaperBasketAdaptationService(...args){const service=originalFactory(...args);hosts.set(service,args[0]);return service;}
      export function adaptationHostForTest(service){const host=hosts.get(service);if(!host)throw Error('Adaptation factory host was not captured');return host;}
    `}));
  }},{name:'deny-electron-only',setup(b){
    b.onResolve({filter:/^electron$/},()=>({path:'electron',namespace:'deny-electron'}));
    b.onLoad({filter:/.*/,namespace:'deny-electron'},()=>({contents:"const denied=new Proxy(function(){throw Error('Electron API forbidden')},{get(){throw Error('Electron API forbidden')}});export const app=denied,utilityProcess=denied,nativeImage=denied,safeStorage=denied,dialog=denied,BrowserWindow=denied,ipcMain=denied,shell=denied,screen=denied;"}));
    b.onResolve({filter:/^[A-Za-z@]/},a=>({path:import.meta.resolve(a.path),external:true}));
  }}]});
  const bundle=path.join(output,'store-source.mjs');fs.writeFileSync(bundle,built.outputFiles[0].text,{flag:'wx'});
  report.bundleSha256=createHash('sha256').update(built.outputFiles[0].text).digest('hex');
  m=await import(pathToFileURL(bundle).href);store=new m.OmniEduStore(data);
  const originalOpen=store.openDatabase.bind(store);
  store.openDatabase=async file=>{
    const id=++opened,db=await originalOpen(file);liveConnections++;maxConnections=Math.max(maxConnections,liveConnections);event('connection-open',{connection:id});
    const nativeAll=db.all,nativeClose=db.close;
    db.all=function(q,...args){if(active)physicalReads.push({phase,connection:id,sql:q});return nativeAll.call(this,q,...args);};
    db.close=function(callback){return nativeClose.call(this,error=>{if(!error)liveConnections--;callback?.(error);});};
    return db;
  };
  store.db=await store.openDatabase(path.join(data,'app.db'));
  await store.exec('PRAGMA journal_mode=WAL; PRAGMA foreign_keys=ON; PRAGMA busy_timeout=5000;');
  await store.exec(`CREATE TABLE connection_probe(id INTEGER PRIMARY KEY,value TEXT);
    INSERT INTO connection_probe VALUES(1,'initial');
    CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,student_id TEXT,archived_at TEXT);
    CREATE TABLE students(id TEXT PRIMARY KEY,status TEXT);
    CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT,title TEXT,original_file_name TEXT,local_path TEXT,parse_status TEXT,parse_engine TEXT);
    CREATE TABLE resource_chunks(id TEXT PRIMARY KEY,resource_id TEXT,chunk_index INTEGER,content_md TEXT,contains_personal_data INTEGER);`);
  await m.migratePaperBaskets(store.paperSql());await m.migratePaperTemplates(store.paperSql());
  const parentAll=store.all.bind(store);
  store.all=(q,p)=>{if(active)parentTouches.push({phase,sql:q});return parentAll(q,p);};
  const session='aisession_'+randomUUID(),rid='resource_'+randomUUID();
  await store.run('INSERT INTO ai_conversation_sessions VALUES (?,?,NULL)',[session,'']);
  const blueprint={title:'真实连接参考',subject:'数学',grade:'初二',durationMinutes:30,totalPoints:5,mode:'source_only',sections:[{id:'original',label:'选择题',questionType:'选择题',count:1,points:5}]};
  const V2='xiaozhi.paper-basket.v2';
  const basket=await store.paperBasketsV2.create({schemaVersion:V2,sessionId:session,requestId:randomUUID(),blueprint});
  const file=path.join(data,'teacher_resources','reference.txt');
  const text='试卷名称：真实连接参考卷\n学科：数学\n年级：初二\n时长：30分钟\n总分：10分\n一、选择题 共1题 每题10分';
  fs.writeFileSync(file,text,{flag:'wx'});const version=createHash('sha256').update(fs.readFileSync(file)).digest('hex');
  await store.run('INSERT INTO teacher_resources VALUES (?,?,?,?,?,?,?)',[rid,version,'真实参考','reference.txt',file,'ready','text.v1']);
  await store.run('INSERT INTO resource_chunks VALUES (?,?,?,?,0)',['chunk_'+randomUUID(),rid,0,text]);
  const service=m.createPaperTemplateService({materials:store.materials,transaction:a=>store.paperTemplateTransaction(a)});
  const raw=await store.paperTemplateTransaction((sql,materials)=>m.extractTemplateSource(sql,materials,rid,version,signal()));
  const layout={paper:'A4',orientation:'portrait',columns:'2',top:'1134',right:'1134',bottom:'1134',left:'1134',columnGap:'567'};
  const saved=await service.save({schemaVersion:'xiaozhi.paper-reference.v1',sessionId:session,basketId:basket.id,basketRevision:basket.revision,requestId:'save_'+randomUUID(),resourceId:rid,version,expectedCandidateDigest:raw.digest,expectedHeadVersion:0,name:'连接版式',kind:'layout',patches:Object.entries(layout).map(([key,teacherValue])=>({path:'layout.'+key,teacherValue,confirmed:true}))},signal());
  await service.apply({sessionId:session,basketId:basket.id,expectedRevision:basket.revision,requestId:'apply_'+randomUUID(),kind:'layout',layout:saved.template},signal());
  const stored=await m.readStoredBasket(store.paperSql(),session,basket.id,true);
  const extension={c2:stored.data.c2,templateSources:await m.captureTemplateSources(store.paperSql(),stored.data.c2,'')};
  const binding={basketId:basket.id}; // Actual currentC2 callback consumes basketId; full snapshot contract is outside this regression.
  const adaptationHost=m.adaptationHostForTest(store.paperAdaptations);
  assert.equal(typeof adaptationHost.verifyTemplates,'function','Actual adaptation factory must receive its verifier');
  const callbacks={currentC2:sql=>store.papers.host.currentC2(sql,session,'',binding,extension),verifyTemplates:sql=>store.paperBasketsV2.host.verifyTemplates(sql,stored),adaptationVerifyTemplates:sql=>adaptationHost.verifyTemplates(sql,stored)};
  report.fixture={session,basketId:basket.id,resourceId:rid,sourceFile:file,sourceSha256:version,template:saved.template};
  await check('real public basket read consumes registered verifier',async()=>{
    const view=await store.paperBasketsV2.read({schemaVersion:V2,sessionId:session,basketId:basket.id});assert.equal(view.templateSourceCurrent,true);
  });
  for(const [name,invoke]of Object.entries(callbacks))await check(name+' scoped context completes before competing main writer',async()=>{
    const touchesBefore=parentTouches.length;let writer,operation,writerDone=false,lockHeld=false,contextReads=0;const methods=[];
    try{await store.paperTemplateTransaction(async(sql,materials)=>{
      lockHeld=true;assert.equal(sql.templateMaterials,materials);assert.notEqual(materials,store.materials);
      const context=sql.templateMaterials;Object.defineProperty(sql,'templateMaterials',{get(){contextReads++;return context;},configurable:true});
      for(const key of ['resource','readingWindow','originalStamp','verify']){const original=context[key].bind(context);context[key]=(...args)=>{methods.push(key);return original(...args);};}
      await sql.run("UPDATE connection_probe SET value='work-uncommitted' WHERE id=1");event(name+' work-writer-lock-held');
      writer=outcome(run(store.db,"UPDATE connection_probe SET value='main-after-release' WHERE id=1").finally(()=>{writerDone=true;event(name+' main-writer-settled');}));event(name+' main-writer-enqueued');
      active=true;operation=outcome(Promise.resolve().then(()=>invoke(sql)));
      const result=await bounded(operation,1500,name+' queued behind parent connection');assert(result.ok,result.error?.stack);if(name==='currentC2')assert.equal(result.value,true);
      assert(contextReads>0,'Registered callback must consume sql.templateMaterials');assert(methods.includes('verify')&&methods.includes('originalStamp')&&methods.includes('readingWindow'),'Must execute real source verification, not short circuit');
      assert(lockHeld&&!writerDone,'Source validation must finish while writer lock is held and main writer pending');
      assert.equal((await sql.all('SELECT value FROM connection_probe WHERE id=1'))[0].value,'work-uncommitted');assert.equal(parentTouches.length,touchesBefore,'No parent material/SQL reads permitted');
      const reads=physicalReads.filter(r=>r.phase===phase);assert(reads.length>0);assert(reads.every(r=>r.connection===opened),'Every physical SQL read must use the work connection, not main');
      event(name+' validation-completed-before-commit',{contextReads,sourceMethods:methods,physicalReadConnection:opened});
    });}finally{active=false;lockHeld=false;event(name+' transaction-returned');if(writer){const w=await writer;assert(w.ok,w.error?.stack);}if(operation)await operation;}
    assert.equal((await store.all('SELECT value FROM connection_probe WHERE id=1'))[0].value,'main-after-release');
  });
  await check('legacy outer-material path is genuinely blocked until transaction releases',async()=>{
    let writer,legacy,done=false;const before=parentTouches.length;
    try{await store.paperTemplateTransaction(async sql=>{
      await sql.run("UPDATE connection_probe SET value='legacy-lock' WHERE id=1");
      writer=outcome(run(store.db,"UPDATE connection_probe SET value='legacy-released' WHERE id=1"));
      active=true;legacy=outcome(m.currentC2Snapshot(sql,store.materials,session,'',binding,extension,signal())).then(v=>{done=true;return v;});
      await new Promise(resolve=>setTimeout(resolve,150));assert(!done,'Negative legacy source read must queue behind blocked parent write');assert(parentTouches.length>before,'Negative control must actually touch outer material SQL');event('legacy-parent-read-blocked');
    });}finally{active=false;if(writer){const w=await writer;assert(w.ok,w.error?.stack);}if(legacy){const result=await bounded(legacy,1500,'Legacy did not drain after release');assert(!result.ok||result.value===true);event('legacy-drained-after-release',{ok:result.ok,error:result.error?.message});}}
  });
  for(const [name,invoke]of Object.entries(callbacks))await check(name+' missing context fails closed before parent read',async()=>{
    const before=parentTouches.length;await store.paperTemplateTransaction(async sql=>{const missing={...sql};delete missing.templateMaterials;active=true;try{await assert.rejects(Promise.resolve().then(()=>invoke(missing)),/^Error: configuration$/);}finally{active=false;}assert.equal(parentTouches.length,before);});
  });
  const dbFacts=JSON.stringify(await store.all('SELECT * FROM teacher_resources'));
  fs.writeFileSync(file,text.replace('30分钟','31分钟'));assert.notEqual(createHash('sha256').update(fs.readFileSync(file)).digest('hex'),version);
  for(const [name,invoke]of Object.entries(callbacks))await check(name+' rejects actual changed source bytes without row/stamp repair',async()=>{
    const before=parentTouches.length;await store.paperTemplateTransaction(async sql=>{active=true;try{await assert.rejects(Promise.resolve().then(()=>invoke(sql)),/source_changed/);}finally{active=false;}});assert.equal(parentTouches.length,before);assert.equal(JSON.stringify(await store.all('SELECT * FROM teacher_resources')),dbFacts);
  });
  await check('public basket read marks changed template source unavailable',async()=>{const view=await store.paperBasketsV2.read({schemaVersion:V2,sessionId:session,basketId:basket.id});assert.equal(view.templateSourceCurrent,false);});
  report.parentTouches=parentTouches;report.physicalReads=physicalReads;report.connectionsOpened=opened;report.maxConcurrentConnections=maxConnections;assert.equal(maxConnections,2);report.sqliteVersion=(await store.all('SELECT sqlite_version() AS version'))[0].version;
  assert.equal((await store.all('PRAGMA integrity_check'))[0].integrity_check,'ok');report.success=report.checks.every(c=>c.status==='PASS');
}catch(e){report.fatal=String(e.stack);report.success=false;}
finally{
  active=false;await store?.close().catch(e=>{report.closeError=String(e.stack);report.success=false;});
  report.connectionsStillOpen=liveConnections;if(liveConnections!==0)report.success=false;
  report.sourceAfter=fingerprint(path.join(desktop,'src')).sha256;if(report.sourceAfter!==report.sourceBefore){report.sourceChangedDuringRun=true;report.success=false;}
  clearTimeout(watchdog);persist();console.log(JSON.stringify({success:report.success,output,checks:report.checks.map(({name,status})=>({name,status})),fatal:report.fatal,electronLaunches:0,modelCalls:0}));
}
if(!report.success)process.exitCode=1;
