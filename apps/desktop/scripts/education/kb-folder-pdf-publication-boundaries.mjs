import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
const {MaterialFolderAiRepository}=await import('../../src/main/assets/material-folder-ai.ts');
const version=createHash('sha256').update('original-pdf').digest('hex');
const schema='xiaozhi.material-folder-ai.v1';
function fixture(){
 const db=new DatabaseSync(':memory:'),id='batch_'+randomUUID(),created=[];let repo;
 db.exec(`CREATE TABLE material_import_batches(id TEXT PRIMARY KEY,status TEXT);CREATE TABLE material_import_entries(seq INTEGER PRIMARY KEY,batch_id TEXT,kind TEXT,status TEXT,resource_id TEXT);
 CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT,original_file_name TEXT,parse_status TEXT,parse_engine TEXT,title TEXT);
 CREATE TABLE resource_chunks(id TEXT,resource_id TEXT,page_number INTEGER);
 CREATE TABLE material_pdf_jobs(resource_id TEXT,version TEXT,total INTEGER,generation TEXT,state TEXT);
 CREATE TABLE material_pdf_pages(generation TEXT,page INTEGER,status TEXT);
 CREATE TABLE material_ai_batches(id TEXT PRIMARY KEY,status TEXT,calls INTEGER,config_json TEXT,pause_reason TEXT NOT NULL DEFAULT '');
 CREATE TABLE material_ai_units(batch_id TEXT,ordinal INTEGER,status TEXT,error TEXT);
 CREATE TABLE material_ai_task_keys(task_key TEXT PRIMARY KEY,input_sha TEXT,batch_id TEXT,folder_id TEXT,folder_revision INTEGER);
 CREATE TABLE material_ai_members(batch_id TEXT,question_id TEXT);CREATE TABLE question_bank_items(id TEXT,archive_json TEXT);`);
 db.prepare("INSERT INTO material_import_batches VALUES(?,'completed')").run(id);
 const ai={settings:async()=>({revision:9,model:'deepseek-flash',configured:true,secureStorage:true}),create:async(input,task)=>{
  const prior=db.prepare('SELECT batch_id FROM material_ai_task_keys WHERE task_key=?').get(task.key);if(prior)return prior.batch_id;
  const r=db.prepare('SELECT * FROM teacher_resources WHERE id=?').get(input.resourceId);
  if(!['ready','partial'].includes(r.parse_status))throw Error('unavailable');
  if(r.original_file_name.endsWith('.pdf')&&!db.prepare('SELECT 1 FROM resource_chunks WHERE resource_id=? AND page_number=?').get(input.resourceId,input.start))throw Error('source_incomplete');
  const batch='aibatch_'+randomUUID();created.push(input);
  db.prepare("INSERT INTO material_ai_batches(id,status,calls,config_json) VALUES(?,'running',0,?)").run(batch,JSON.stringify(input));
  db.prepare("INSERT INTO material_ai_units VALUES(?,1,'pending','')").run(batch);db.prepare('INSERT INTO material_ai_task_keys VALUES(?,?,?,?,?)').run(task.key,'fixture',batch,task.folderId,task.revision);return batch;
 },action:async()=>{}};
 const host={all:async(q,p=[])=>db.prepare(q).all(...p),run:async(q,p=[])=>{db.prepare(q).run(...p);},ai:()=>ai,word:()=>({}),writer:async action=>{db.exec('BEGIN IMMEDIATE');try{const result=await action(repo);db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
 repo=new MaterialFolderAiRepository(host);
 function resource(name='长书.pdf',status='needs_parser',page='processing',job='processing'){
  const rid='resource_'+randomUUID(),generation=randomUUID(),seq=Number(db.prepare('SELECT COALESCE(MAX(seq),0)+1 n FROM material_import_entries').get().n);
  db.prepare('INSERT INTO teacher_resources VALUES(?,?,?,?,?,?)').run(rid,version,name,status,'local:pending',name);
  db.prepare("INSERT INTO material_import_entries VALUES(?,?,'file','saved',?)").run(seq,id,rid);
  if(name.endsWith('.pdf')){db.prepare('INSERT INTO material_pdf_jobs VALUES(?,?,1,?,?)').run(rid,version,generation,job);db.prepare('INSERT INTO material_pdf_pages VALUES(?,1,?)').run(generation,page);}
  else if(status==='ready')db.prepare('INSERT INTO resource_chunks VALUES(?,?,NULL)').run('chunk_'+randomUUID(),rid);
  return{rid,generation};
 }
 return{db,id,created,resource,get repo(){return repo;},reopen:async()=>{repo=new MaterialFolderAiRepository(host);await repo.migrate();},start:async()=>{await repo.migrate();await repo.authorize({schemaVersion:schema,batchId:id,settingsRevision:9,maxCalls:40,cloudConsent:true,publicMaterial:true});},publish:r=>{db.prepare("UPDATE teacher_resources SET parse_status='ready' WHERE id=?").run(r.rid);db.prepare("UPDATE material_pdf_jobs SET state='complete' WHERE resource_id=?").run(r.rid);db.prepare("UPDATE material_pdf_pages SET status='complete' WHERE generation=?").run(r.generation);db.prepare('INSERT INTO resource_chunks VALUES(?,?,1)').run('chunk_'+randomUUID(),r.rid);}};
}
const results=[];let failures=0;
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(e){failures++;results.push({name,ok:false,error:String(e.stack)});console.error('FAIL '+name+'\n'+e.stack);}}
await check('PDF processing page remains waiting, never local_page_failed',async()=>{const f=fixture();try{f.resource();await f.start();await f.repo.tick();assert.equal(f.created.length,0);assert.equal((await f.repo.view(f.id)).review,0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_folder_ai_units').get().n,0);}finally{f.db.close();}});
await check('Complete staged page waits for canonical publication; published page starts exactly once after restart',async()=>{const f=fixture();try{const r=f.resource('长书.pdf','needs_parser','complete');await f.start();await f.repo.tick();assert.equal((await f.repo.view(f.id)).review,0);assert.equal(f.created.length,0);f.publish(r);await f.reopen();await f.repo.tick();await f.repo.tick();assert.equal(f.created.length,1);assert.equal(f.created[0].start,1);}finally{f.db.close();}});
await check('Eight waiting books do not starve later ready text; resource discovery stays bounded',async()=>{const f=fixture();try{for(let i=0;i<8;i++)f.resource('等待.pdf','needs_parser','pending');const ready=f.resource('已完成.md','ready');await f.start();for(let i=0;i<4&&!f.created.length;i++)await f.repo.tick();assert.equal(f.created.length,1);assert.equal(f.created[0].resourceId,ready.rid);}finally{f.db.close();}});
await check('Real terminal failed and blank pages remain explicit review with zero model calls',async()=>{const f=fixture();try{f.resource('坏页.pdf','partial','failed','partial');f.resource('空页.pdf','ready','blank','complete');await f.start();for(let i=0;i<3;i++)await f.repo.tick();assert.equal(f.created.length,0);assert.equal((await f.repo.view(f.id)).review,2);}finally{f.db.close();}});
function legacy(f,r,code='local_page_failed',child=''){
 f.db.prepare("INSERT INTO material_folder_ai_resources(batch_id,resource_id,version,cursor,total,status) VALUES(?,?,?,1,1,'complete')").run(f.id,r.rid,version);
 f.db.prepare("INSERT INTO material_folder_ai_units VALUES(?,?,?,1,'review',?,?)").run(f.id,r.rid,version,child,code);
 f.db.prepare("UPDATE material_folder_ai SET status='attention' WHERE batch_id=?").run(f.id);
}
await check('Previously misclassified same-version unbilled page recovers after publication; paused folder stays paused',async()=>{const f=fixture();try{const r=f.resource();await f.start();legacy(f,r);f.db.prepare("UPDATE material_folder_ai SET status='paused' WHERE batch_id=?").run(f.id);f.publish(r);await f.repo.tick();assert.equal(f.created.length,0);assert.equal((await f.repo.view(f.id)).status,'paused');f.db.prepare("UPDATE material_folder_ai SET status='attention' WHERE batch_id=?").run(f.id);await f.reopen();for(let i=0;i<4&&!f.created.length;i++)await f.repo.tick();assert.equal(f.created.length,1);assert.equal((await f.repo.view(f.id)).review,0);await f.repo.tick();assert.equal(f.created.length,1);}finally{f.db.close();}});
await check('Local unavailable is recovered only after publication; changed originals, true failed pages and linked unknown requests stay held',async()=>{
 for(const mode of ['unpublished','source_changed','failed_page','linked_unknown','orphan_key','valid']){const f=fixture();try{
  const r=f.resource();await f.start();legacy(f,r,'unavailable',mode==='linked_unknown'?'aibatch_'+randomUUID():'');if(mode!=='unpublished')f.publish(r);
  if(mode==='source_changed')f.db.prepare("UPDATE teacher_resources SET content_hash=? WHERE id=?").run('a'.repeat(64),r.rid);
  if(mode==='failed_page')f.db.prepare("UPDATE material_pdf_pages SET status='failed' WHERE generation=?").run(r.generation);
  if(mode==='orphan_key'){const b='aibatch_'+randomUUID();f.db.prepare("INSERT INTO material_ai_batches(id,status,calls,config_json) VALUES(?,'attention',1,?)").run(b,JSON.stringify({resourceId:r.rid,start:1,maxCalls:2}));f.db.prepare('INSERT INTO material_ai_task_keys VALUES(?,?,?,?,?)').run('orphan','fixture',b,f.id,1);}
  await f.repo.tick();assert.equal(f.created.length,mode==='valid'?1:0,mode);
 }finally{f.db.close();}}
});
await check('Planner migration is idempotent and persists the indexed bounded cursor across restart',async()=>{const f=fixture();try{
 for(let i=0;i<8;i++)f.resource('等待.pdf','needs_parser','pending');const ready=f.resource('后续.md','ready');await f.start();await f.repo.tick();const cursor=f.db.prepare('SELECT plan_cursor FROM material_folder_ai').get().plan_cursor;assert(cursor>0);await f.reopen();assert.equal(f.db.prepare('SELECT plan_cursor FROM material_folder_ai').get().plan_cursor,cursor);await f.repo.tick();assert.equal(f.created[0].resourceId,ready.rid);
 const plan=f.db.prepare("EXPLAIN QUERY PLAN SELECT rowid,* FROM material_folder_ai_resources WHERE batch_id=? AND status IN ('waiting','running') AND rowid>? ORDER BY rowid LIMIT 8").all(f.id,0);assert(plan.some(r=>r.detail.includes('idx_folder_ai_plan')));assert(!plan.some(r=>r.detail.includes('TEMP B-TREE')),JSON.stringify(plan));
}finally{f.db.close();}});
console.log(JSON.stringify({success:!failures,checks:results.length,results,scope:'Real SQLite/production folder scheduler with a controlled child executor; not provider quality, full UI or scale acceptance'}));if(failures)process.exitCode=1;
