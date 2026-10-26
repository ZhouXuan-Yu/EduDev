import '../../scripts/office-agent/register-source.mjs';
import fs from 'node:fs';
import assert from 'node:assert/strict';
import {registerHooks,stripTypeScriptTypes} from 'node:module';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';

registerHooks({resolve(name,context,next){
  return name==='electron'?{url:'data:text/javascript,export const utilityProcess={};',shortCircuit:true}:next(name,context);
}});
const {MaterialRepository}=await import('../../src/main/assets/material-repository.ts');
const {ensureMaterialReadingEntries}=await import('../../src/main/assets/material-reading-migration.ts');
const results=[];
const record=(name,evidence)=>{results.push({name,passed:true,evidence});console.log('PASS '+name);};

// Execute current source functions with an in-memory IPC owner; never start Electron or a model.
function loadFunction(relative,name,dependencies={}){
  const source=fs.readFileSync(new URL(relative,import.meta.url),'utf8')
    .replace(/^import .*;\r?\n/gm,'').replaceAll('export function','function');
  return new Function(...Object.keys(dependencies),stripTypeScriptTypes(source)+';return '+name)(...Object.values(dependencies));
}
const handlers=new Map(),raw={handle:(name,fn)=>handlers.set(name,fn)};
const lifetime=loadFunction('../../src/main/desktop-ipc-lifetime.ts','createDesktopIpcLifetime')(raw);
const register=loadFunction('../../src/main/retrieval/ipc.ts','registerRetrievalIpc',{
  electronIpcMain:raw,VectorHost:class {},validRetrievalAction:()=>true,
});
let resume,finished=false,storeClosed=false,readAfterClose=false;
const paused=new Promise(resolve=>{resume=resolve;});
const window={isDestroyed:()=>false,webContents:{mainFrame:{}}};
const event={sender:window.webContents,senderFrame:window.webContents.mainFrame};
const store={getDataRoot:()=>'',retrieval:{configure(){},questions:async()=>{
  await paused;readAfterClose=storeClosed;finished=true;return[];
}}};
register(store,()=>window,lifetime.ipcMain);
const request=handlers.get('retrieval:questions')(event,{});
let drained=false;
const closing=lifetime.close().then(()=>{drained=true;});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(drained,false,'shutdown must wait for an admitted retrieval request');
assert.equal(finished,false);
resume();await request;await closing;
storeClosed=true;
assert.equal(readAfterClose,false);
assert.throws(()=>handlers.get('retrieval:questions')(event,{}),/application_closing/);
record('Injected retrieval IPC drains before Store.close and rejects new admission',{finishedBeforeStoreClose:finished,readAfterClose});

// Only SQLite :memory: is used. No managed original, live database, or teacher directory is read.
const db=new DatabaseSync(':memory:');
try{
  db.exec('CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,title TEXT,original_file_name TEXT,content_hash TEXT,parse_status TEXT);CREATE TABLE resource_chunks(id TEXT PRIMARY KEY,resource_id TEXT,chunk_index INTEGER,content_md TEXT,contains_personal_data INTEGER,page_number INTEGER);');
  await ensureMaterialReadingEntries(async sql=>db.exec(sql));
  const resourceId='resource_'+randomUUID(),chunkId='chunk_'+randomUUID();
  db.prepare("INSERT INTO teacher_resources VALUES(?,?,?,?,'partial')").run(resourceId,'部分教材','教材.pdf','a'.repeat(64));
  db.prepare('INSERT INTO resource_chunks VALUES(?,?,0,?,0,1)').run(chunkId,resourceId,'第一章成功发布的正文');
  const repo=new MaterialRepository({root:'unused',
    all:async(sql,params=[])=>db.prepare(sql).all(...params),
    change:async(sql,params=[])=>Number(db.prepare(sql).run(...params).changes),
    mapResource:r=>({id:r.id,title:r.title,originalFileName:r.original_file_name,contentHash:r.content_hash,parseStatus:r.parse_status,chunkCount:r.chunk_count}),
    mapChunk:r=>({id:r.id,resourceId:r.resource_id,chunkIndex:r.chunk_index,contentMd:r.content_md,containsPersonalData:!!r.contains_personal_data,pageNumber:r.page_number}),
  });
  const page=await repo.readingPage({schemaVersion:'xiaozhi.materials.v1',resourceId,offset:0});
  const input={schemaVersion:'xiaozhi.material-study.v1',source:page.source,expectedRevision:null,note:'教师笔记',completed:false};
  const saved=await repo.saveStudy(input);
  assert.equal(saved.entry.note,input.note);
  record('Published partial PDF paragraph accepts a reading note',{savedNote:saved.entry.note});
  await assert.rejects(()=>repo.saveStudy(input),/revision_conflict/);
  record('Stale reading revision cannot append a second note',{});
  db.prepare("UPDATE resource_chunks SET content_md='新版正文' WHERE id=?").run(chunkId);
  await assert.rejects(()=>repo.saveStudy({...input,expectedRevision:saved.entry.id}),/source_changed/);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM material_reading_entries').get().n,1);
  record('Changed paragraph fails the source fence without writing',{readingEntries:1});
}finally{db.close();}
// Execute the current main shutdown block and AI-startup expression with controlled owners.
const mainSource=fs.readFileSync(new URL('../../src/main/index.ts',import.meta.url),'utf8');
const begin=mainSource.indexOf('let shutdown:Promise<void>|undefined');
assert(begin>=0);
const end=mainSource.indexOf('registerDesktopChromeIpc(',begin);
const startup=mainSource.match(/materialAiStartup=store\.materialAi\.recover\(\).*;/)?.[0];
assert(startup);
let releaseRecovery,quitListener,startCalls=0,sqliteClosed=false,quitCalled=false;
const recovery=new Promise(resolve=>{releaseRecovery=resolve;});
const owner={close:async()=>{}};
const shutdownStore={materialAi:{...owner,recover:()=>recovery,start:()=>{startCalls++;}},
  retrieval:owner,materialImports:owner,materialQueue:owner,materialSearch:owner,materialQuestions:owner,
  close:async()=>{sqliteClosed=true;},
};
const setupSource=stripTypeScriptTypes(mainSource.slice(begin,end)+'\n'+startup)+'\nreturn ()=>shutdown;';
const getShutdown=new Function('store','app','ipcLifetime','BrowserWindow','xiaozhi','mistakeOcr','mistakeSimilar',setupSource)(
  shutdownStore,{on:(_event,fn)=>{quitListener=fn;},quit:()=>{quitCalled=true;}},
  {close:async()=>{}},{getAllWindows:()=>[]},owner,owner,owner,
);
quitListener({preventDefault(){}});
await new Promise(resolve=>setImmediate(resolve));
assert.equal(sqliteClosed,false,'startup recovery must drain before SQLite closes');
releaseRecovery();await getShutdown();
assert.equal(startCalls,0,'late startup recovery cannot reopen a stopped AI owner');
assert.equal(sqliteClosed,true);assert.equal(quitCalled,true);
record('Quit during AI startup waits recovery and suppresses late restart',{startCalls,sqliteClosed,quitCalled});

const report={passed:results.length,failed:0,scope:'Current source with controlled IPC and in-memory SQLite; excludes real Electron, models, installer and shutdown process acceptance',results};
fs.writeFileSync(new URL('../../test-results/goal/kb-main-merge-critic-review.json',import.meta.url),JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({passed:report.passed,failed:report.failed}));
