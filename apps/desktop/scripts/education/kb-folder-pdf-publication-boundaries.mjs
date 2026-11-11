import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
const {MaterialFolderAiRepository}=await import('../../src/main/assets/material-folder-ai.ts');
const {WORD_UPGRADE_INDEX_SQL}=await import('../../src/main/assets/word-upgrade-compatible.ts');
const version=createHash('sha256').update('original-pdf').digest('hex');
const schema='xiaozhi.material-folder-ai.v1';
function fixture(){
 const db=new DatabaseSync(':memory:'),id='batch_'+randomUUID(),created=[],state={failure:'',attempts:0,beforeWrite:undefined};let repo;
 db.exec(`CREATE TABLE material_word_documents(resource_id TEXT PRIMARY KEY,version TEXT,parser TEXT,digest TEXT,document_json TEXT);CREATE TABLE material_import_batches(id TEXT PRIMARY KEY,status TEXT);CREATE TABLE material_import_entries(seq INTEGER PRIMARY KEY,batch_id TEXT,kind TEXT,status TEXT,resource_id TEXT);
 CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT,original_file_name TEXT,parse_status TEXT,parse_engine TEXT,title TEXT);
 CREATE TABLE resource_chunks(id TEXT,resource_id TEXT,page_number INTEGER);
 CREATE TABLE material_pdf_jobs(resource_id TEXT,version TEXT,total INTEGER,generation TEXT,state TEXT);
 CREATE TABLE material_pdf_pages(generation TEXT,page INTEGER,status TEXT,result_json TEXT NOT NULL DEFAULT '{}',error TEXT NOT NULL DEFAULT '');
 CREATE TABLE material_ai_batches(id TEXT PRIMARY KEY,status TEXT,calls INTEGER,config_json TEXT,pause_reason TEXT NOT NULL DEFAULT '');
 CREATE TABLE material_ai_units(batch_id TEXT,ordinal INTEGER,status TEXT,error TEXT);
 CREATE TABLE material_ai_task_keys(task_key TEXT PRIMARY KEY,input_sha TEXT,batch_id TEXT,folder_id TEXT,folder_revision INTEGER);
 CREATE TABLE material_ai_members(batch_id TEXT,question_id TEXT);CREATE TABLE question_bank_items(id TEXT,archive_json TEXT);`);
 db.exec(WORD_UPGRADE_INDEX_SQL);
 db.prepare("INSERT INTO material_import_batches VALUES(?,'completed')").run(id);
 const ai={settings:async()=>({revision:9,model:'deepseek-flash',configured:true,secureStorage:true}),create:async(input,task)=>{
  const prior=db.prepare('SELECT batch_id FROM material_ai_task_keys WHERE task_key=?').get(task.key);if(prior)return prior.batch_id;
  state.attempts++;if(db.prepare('SELECT status FROM material_folder_ai WHERE batch_id=?').get(task.folderId).status!=='running')throw Error('paused');if(state.failure)throw Error(state.failure);
  const r=db.prepare('SELECT * FROM teacher_resources WHERE id=?').get(input.resourceId);
  if(!['ready','partial'].includes(r.parse_status))throw Error('unavailable');
  if(r.original_file_name.endsWith('.pdf')&&!db.prepare('SELECT 1 FROM resource_chunks WHERE resource_id=? AND page_number=?').get(input.resourceId,input.start)&&db.prepare('SELECT p.status FROM material_pdf_pages p JOIN material_pdf_jobs j ON j.generation=p.generation WHERE j.resource_id=? AND p.page=?').get(input.resourceId,input.start)?.status==='complete')throw Error('source_incomplete');
  const batch='aibatch_'+randomUUID();created.push(input);
  db.prepare("INSERT INTO material_ai_batches(id,status,calls,config_json) VALUES(?,'running',0,?)").run(batch,JSON.stringify(input));
  db.prepare("INSERT INTO material_ai_units VALUES(?,1,'pending','')").run(batch);db.prepare('INSERT INTO material_ai_task_keys VALUES(?,?,?,?,?)').run(task.key,'fixture',batch,task.folderId,task.revision);return batch;
 },action:async()=>{}};
 const host={all:async(q,p=[])=>db.prepare(q).all(...p),run:async(q,p=[])=>{db.prepare(q).run(...p);},ai:()=>ai,word:()=>({questions:async()=>({total:3})}),writer:async action=>{const hook=state.beforeWrite;state.beforeWrite=undefined;hook?.();db.exec('BEGIN IMMEDIATE');try{const result=await action(repo);db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};
 repo=new MaterialFolderAiRepository(host);
 function resource(name='长书.pdf',status='needs_parser',page='processing',job='processing'){
  const rid='resource_'+randomUUID(),generation=randomUUID(),seq=Number(db.prepare('SELECT COALESCE(MAX(seq),0)+1 n FROM material_import_entries').get().n);
  db.prepare('INSERT INTO teacher_resources VALUES(?,?,?,?,?,?)').run(rid,version,name,status,'local:pending',name);
  db.prepare("INSERT INTO material_import_entries VALUES(?,?,'file','saved',?)").run(seq,id,rid);
  if(name.endsWith('.pdf')){db.prepare('INSERT INTO material_pdf_jobs VALUES(?,?,1,?,?)').run(rid,version,generation,job);db.prepare('INSERT INTO material_pdf_pages(generation,page,status) VALUES(?,1,?)').run(generation,page);}
  else if(status==='ready')db.prepare('INSERT INTO resource_chunks VALUES(?,?,NULL)').run('chunk_'+randomUUID(),rid);
  return{rid,generation};
 }
 return{db,id,created,state,resource,get repo(){return repo;},reopen:async()=>{repo=new MaterialFolderAiRepository(host);await repo.migrate();},start:async()=>{await repo.migrate();await repo.authorize({schemaVersion:schema,batchId:id,settingsRevision:9,maxCalls:40,cloudConsent:true,publicMaterial:true});},publish:r=>{db.prepare("UPDATE teacher_resources SET parse_status='ready' WHERE id=?").run(r.rid);db.prepare("UPDATE material_pdf_jobs SET state='complete' WHERE resource_id=?").run(r.rid);db.prepare("UPDATE material_pdf_pages SET status='complete' WHERE generation=?").run(r.generation);db.prepare('INSERT INTO resource_chunks VALUES(?,?,1)').run('chunk_'+randomUUID(),r.rid);}};
}
const cover='物理 九年级全一册\n主编曲一线\n首都师范大学出版社';
const receipt=(text=cover)=>({status:'complete',error:'',method:'ocr',text,nativeText:'',ocrText:text,width:1200,height:1800,imageArea:1,nativeBoxes:[]});
const results=[];let failures=0;
async function check(name,fn){try{await fn();results.push({name,ok:true});console.log('PASS '+name);}catch(e){failures++;results.push({name,ok:false,error:String(e.stack)});console.error('FAIL '+name+'\n'+e.stack);}}
await check('PDF processing page remains waiting, never local_page_failed',async()=>{const f=fixture();try{f.resource();await f.start();await f.repo.tick();assert.equal(f.created.length,0);assert.equal((await f.repo.view(f.id)).review,0);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_folder_ai_units').get().n,0);}finally{f.db.close();}});
await check('Complete staged page waits for canonical publication; published page starts exactly once after restart',async()=>{const f=fixture();try{const r=f.resource('长书.pdf','needs_parser','complete');await f.start();await f.repo.tick();assert.equal((await f.repo.view(f.id)).review,0);assert.equal(f.created.length,0);f.publish(r);await f.reopen();await f.repo.tick();await f.repo.tick();assert.equal(f.created.length,1);assert.equal(f.created[0].start,1);}finally{f.db.close();}});
await check('Eight waiting books do not starve later ready text; resource discovery stays bounded',async()=>{const f=fixture();try{for(let i=0;i<8;i++)f.resource('等待.pdf','needs_parser','pending');const ready=f.resource('已完成.md','ready');await f.start();for(let i=0;i<4&&!f.created.length;i++)await f.repo.tick();assert.equal(f.created.length,1);assert.equal(f.created[0].resourceId,ready.rid);}finally{f.db.close();}});
await check('Terminal failed and blank pages are queued for original-image verification and never counted complete before the AI executor',async()=>{const f=fixture();try{f.resource('坏页.pdf','partial','failed','partial');f.resource('空页.pdf','ready','blank','complete');await f.start();await f.repo.tick();assert.equal(f.created.length,1);assert.equal(f.created[0].images,true);assert.equal((await f.repo.view(f.id)).complete,0);assert.equal((await f.repo.view(f.id)).waiting,1);}finally{f.db.close();}});
await check('A successfully read explicit cover completes locally without a paid task; a mixed or unclear cover is retained',async()=>{
 for(const kind of ['cover','mixed','unclear']){const f=fixture();try{const r=f.resource('封面.pdf','ready',kind==='unclear'?'needs_review':'complete','complete');f.publish(r);const text='物理 九年级全一册\n主编曲一线\n首都师范大学出版社'+(kind==='mixed'?'\n第1题 已知温度，计算温差。':'');f.db.prepare('UPDATE material_pdf_pages SET result_json=?,status=?').run(JSON.stringify(receipt(text)),kind==='unclear'?'needs_review':'complete');await f.start();await f.repo.tick();if(kind==='cover'){assert.equal(f.created.length,0);assert.equal((await f.repo.view(f.id)).complete,1);assert.equal((await f.repo.view(f.id)).skippedCover,1);assert.equal((await f.repo.view(f.id)).calls,0);assert.equal((await f.repo.view(f.id)).reserved,0);assert.equal(f.db.prepare('SELECT error FROM material_folder_ai_units').get().error,'non_question_cover');await f.reopen();await f.repo.tick();assert.equal(f.created.length,0);}else assert.equal(f.created.length,1);}finally{f.db.close();}}
});
await check('All OCR channels and complete valid receipts are required before discarding a cover',async()=>{
 for(const mode of ['native_question','ocr_question','partial_shape','malformed','status_mismatch','error_mismatch','unknown_field','chinese_number','circled_number']){const f=fixture();try{
  const r=f.resource('混合封面.pdf','ready','complete','complete');f.publish(r);let body=receipt();
  if(mode==='native_question')body.nativeText='1. 温度反映冷热程度。';if(mode==='ocr_question')body.ocrText='1. 温度反映冷热程度。';
  if(mode==='partial_shape')body={text:cover};if(mode==='status_mismatch')body.status='needs_review';if(mode==='unknown_field')body.extra=true;
  if(mode==='chinese_number')body.ocrText+='\n第十二题 温度反映冷热程度。';if(mode==='circled_number')body.ocrText+='\n① 温度反映冷热程度。';
  f.db.prepare('UPDATE material_pdf_pages SET result_json=?,error=?').run(mode==='malformed'?'{':JSON.stringify(body),mode==='error_mismatch'?'ocr_failed':'');
  await f.start();await f.repo.tick();const view=await f.repo.view(f.id);assert.equal(view.skippedCover,0,mode);assert.equal(view.complete,0,mode);assert.equal(f.created.length,1,mode+' retains original guarded AI path');
 }finally{f.db.close();}}
});
await check('Writer rechecks source receipt, folder pause and source version before skipping; cursor and outcome rollback together',async()=>{
 for(const mode of ['receipt','pause','version','rollback']){const f=fixture();try{
  const r=f.resource('封面.pdf','ready','complete','complete');f.publish(r);f.db.prepare('UPDATE material_pdf_pages SET result_json=?').run(JSON.stringify(receipt()));await f.start();
  f.state.beforeWrite=()=>{if(mode==='receipt')f.db.prepare('UPDATE material_pdf_pages SET result_json=?').run(JSON.stringify(receipt(cover+'\n1. 温度反映冷热程度。')));if(mode==='pause')f.db.prepare("UPDATE material_folder_ai SET status='paused' WHERE batch_id=?").run(f.id);if(mode==='version')f.db.prepare('UPDATE teacher_resources SET content_hash=? WHERE id=?').run('b'.repeat(64),r.rid);if(mode==='rollback')f.db.exec("CREATE TRIGGER reject_cover BEFORE UPDATE OF cursor ON material_folder_ai_resources BEGIN SELECT RAISE(ABORT,'forced_cursor_failure'); END");};
  await f.repo.tick();const view=await f.repo.view(f.id);assert.equal(view.skippedCover,0,mode);assert.equal(view.complete,0,mode);if(mode==='pause')assert.equal(f.created.length,0);if(mode==='rollback'){assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_folder_ai_units').get().n,0);assert.equal(f.db.prepare('SELECT cursor FROM material_folder_ai_resources').get().cursor,0);}
 }finally{f.db.close();}}
});
await check('A previously reserved or orphaned page task cannot be relabelled as an unbilled local cover skip',async()=>{
 for(const mode of ['reserved','orphan','malformed']){const f=fixture();try{
  const r=f.resource('封面.pdf','ready','complete','complete');f.publish(r);f.db.prepare('UPDATE material_pdf_pages SET result_json=?').run(JSON.stringify(receipt()));await f.start();const batch='aibatch_'+randomUUID();
  if(mode!=='orphan')f.db.prepare("INSERT INTO material_ai_batches(id,status,calls,config_json) VALUES(?,'attention',1,?)").run(batch,mode==='malformed'?'{':JSON.stringify({resourceId:r.rid,start:1,maxCalls:2}));
  const key=createHash('sha256').update(JSON.stringify([schema,f.id,1,r.rid,version,1])).digest('hex');f.db.prepare('INSERT INTO material_ai_task_keys VALUES(?,?,?,?,?)').run(key,'fixture',batch,f.id,1);await f.repo.tick();if(mode==='malformed')await assert.rejects(f.repo.view(f.id),/^Error: unavailable$/);else{assert.equal((await f.repo.view(f.id)).skippedCover,0);assert.equal((await f.repo.view(f.id)).complete,0);}assert.equal(f.db.prepare("SELECT COUNT(*) n FROM material_folder_ai_units WHERE error='non_question_cover'").get().n,0);
 }finally{f.db.close();}}
});
function legacy(f,r,code='local_page_failed',child=''){
 f.db.prepare("INSERT INTO material_folder_ai_resources(batch_id,resource_id,version,cursor,total,status) VALUES(?,?,?,1,1,'complete')").run(f.id,r.rid,version);
 f.db.prepare("INSERT INTO material_folder_ai_units VALUES(?,?,?,1,'review',?,?)").run(f.id,r.rid,version,child,code);
 f.db.prepare("UPDATE material_folder_ai SET status='attention' WHERE batch_id=?").run(f.id);
}
await check('Previously misclassified same-version unbilled page recovers after publication; paused folder stays paused',async()=>{const f=fixture();try{const r=f.resource();await f.start();legacy(f,r);f.db.prepare("UPDATE material_folder_ai SET status='paused' WHERE batch_id=?").run(f.id);f.publish(r);await f.repo.tick();assert.equal(f.created.length,0);assert.equal((await f.repo.view(f.id)).status,'paused');f.db.prepare("UPDATE material_folder_ai SET status='attention' WHERE batch_id=?").run(f.id);await f.reopen();for(let i=0;i<4&&!f.created.length;i++)await f.repo.tick();assert.equal(f.created.length,1);assert.equal((await f.repo.view(f.id)).review,0);await f.repo.tick();assert.equal(f.created.length,1);}finally{f.db.close();}});
await check('Local unavailable recovers same-version complete or failed pages for guarded AI; changed originals and linked unknown requests stay held',async()=>{
 for(const mode of ['unpublished','source_changed','failed_page','linked_unknown','orphan_key','valid']){const f=fixture();try{
  const r=f.resource();await f.start();legacy(f,r,'unavailable',mode==='linked_unknown'?'aibatch_'+randomUUID():'');if(mode!=='unpublished')f.publish(r);
  if(mode==='source_changed')f.db.prepare("UPDATE teacher_resources SET content_hash=? WHERE id=?").run('a'.repeat(64),r.rid);
  if(mode==='failed_page')f.db.prepare("UPDATE material_pdf_pages SET status='failed' WHERE generation=?").run(r.generation);
  if(mode==='orphan_key'){const b='aibatch_'+randomUUID();f.db.prepare("INSERT INTO material_ai_batches(id,status,calls,config_json) VALUES(?,'attention',1,?)").run(b,JSON.stringify({resourceId:r.rid,start:1,maxCalls:2}));f.db.prepare('INSERT INTO material_ai_task_keys VALUES(?,?,?,?,?)').run('orphan','fixture',b,f.id,1);}
  await f.repo.tick();assert.equal(f.created.length,['valid','failed_page'].includes(mode)?1:0,mode);if(mode==='failed_page')assert.equal((await f.repo.view(f.id)).complete,0);
 }finally{f.db.close();}}
});
await check('Planner migration is idempotent and persists the indexed bounded cursor across restart',async()=>{const f=fixture();try{
 for(let i=0;i<8;i++)f.resource('等待.pdf','needs_parser','pending');const ready=f.resource('后续.md','ready');await f.start();await f.repo.tick();const cursor=f.db.prepare('SELECT plan_cursor FROM material_folder_ai').get().plan_cursor;assert(cursor>0);await f.reopen();assert.equal(f.db.prepare('SELECT plan_cursor FROM material_folder_ai').get().plan_cursor,cursor);await f.repo.tick();assert.equal(f.created[0].resourceId,ready.rid);
 const plan=f.db.prepare("EXPLAIN QUERY PLAN SELECT rowid,* FROM material_folder_ai_resources WHERE batch_id=? AND status IN ('waiting','running') AND rowid>? ORDER BY rowid LIMIT 8").all(f.id,0);assert(plan.some(r=>r.detail.includes('idx_folder_ai_plan')));assert(!plan.some(r=>r.detail.includes('TEMP B-TREE')),JSON.stringify(plan));
}finally{f.db.close();}});
await check('Budget exhaustion stops this planning window without being overwritten by another paused child attempt',async()=>{const f=fixture();try{f.resource('第一题.md','ready');f.resource('第二题.md','ready');await f.start();f.state.failure='budget_exhausted';await f.repo.tick();assert.equal((await f.repo.view(f.id)).status,'budget_exhausted');assert.equal(f.state.attempts,1);assert.equal(f.created.length,0);}finally{f.db.close();}});
await check('A repaired same-version local parse automatically resumes after restart and schedules only once',async()=>{
 const f=fixture();try{
  const r=f.resource('修复.md','failed');await f.start();await f.repo.tick();
  assert.equal((await f.repo.view(f.id)).status,'attention');assert.equal(f.created.length,0);
  assert.equal(f.db.prepare('SELECT error FROM material_folder_ai_units').get().error,'local_parse_failed');
  f.publish(r);await f.reopen();for(let i=0;i<4;i++)await f.repo.tick();
  assert.equal(f.created.length,1);assert.equal(f.created[0].resourceId,r.rid);assert.equal((await f.repo.view(f.id)).review,0);
 }finally{f.db.close();}
});
await check('A repaired multi-question Word recomputes its real total rather than keeping the failed total of one',async()=>{
 const f=fixture();try{
  const r=f.resource('三道题.docx','failed');await f.start();await f.repo.tick();
  assert.equal(f.db.prepare('SELECT total FROM material_folder_ai_resources').get().total,1);f.publish(r);
  for(let i=0;i<10;i++){await f.repo.tick();f.db.exec("UPDATE material_ai_units SET status='no_questions';UPDATE material_ai_batches SET status='complete'");}
  assert.deepEqual(f.created.map(r=>r.start),[1,2,3]);assert.equal(f.db.prepare('SELECT total FROM material_folder_ai_resources').get().total,3);
  assert.equal((await f.repo.view(f.id)).status,'complete');
 }finally{f.db.close();}
});
await check('A PDF parse failure waits for same-version canonical publication, then re-enters the existing page planner',async()=>{
 const f=fixture();try{
  const r=f.resource('修复.pdf','failed','failed','failed');await f.start();await f.repo.tick();assert.equal(f.created.length,0);
  f.db.prepare("UPDATE teacher_resources SET parse_status='ready'").run();await f.repo.tick();assert.equal(f.created.length,0);
  f.publish(r);await f.repo.tick();await f.repo.tick();assert.equal(f.created.length,1);assert.equal(f.created[0].start,1);
 }finally{f.db.close();}
});
await check('Local parse recovery honors pause, changed scope, version, configuration and processing-mode races',async()=>{
 for(const mode of ['pause','scope','version','revision','settings','policy']){const f=fixture();try{
  const r=f.resource('修复.md','failed');await f.start();await f.repo.tick();f.publish(r);
  f.state.beforeWrite=()=>{
   if(mode==='pause')f.db.exec("UPDATE material_folder_ai SET status='paused'");
   if(mode==='scope')f.db.exec("UPDATE material_folder_ai SET error='scope_changed'");
   if(mode==='version')f.db.prepare('UPDATE teacher_resources SET content_hash=?').run('b'.repeat(64));
   if(mode==='revision')f.db.exec('UPDATE material_folder_ai SET revision=revision+1');
   if(mode==='settings')f.db.exec('UPDATE material_folder_ai SET settings_revision=10');
   if(mode==='policy')f.db.exec("UPDATE material_folder_ai SET processing_mode='quality'");
  };
  await f.repo.tick();assert.equal(f.created.length,0,mode);assert.equal(f.db.prepare('SELECT state FROM material_folder_ai_units').get().state,'review',mode);
 }finally{f.db.close();}}
});
await check('Changed scope stays held for both existing page recovery and new local parse recovery until reauthorization',async()=>{
 for(const priorError of ['local_parse_failed','local_page_failed']){const f=fixture();try{
  const r=f.resource('范围.pdf','failed','failed','failed');await f.start();await f.repo.tick();f.publish(r);
  f.db.prepare("UPDATE material_folder_ai_units SET error=?").run(priorError);f.db.exec("UPDATE material_folder_ai SET error='scope_changed'");
  await f.repo.tick();assert.equal(f.created.length,0);await assert.rejects(f.repo.action({schemaVersion:schema,batchId:f.id,action:'resume'}),/consent_required/);
  await f.repo.authorize({schemaVersion:schema,batchId:f.id,settingsRevision:9,maxCalls:40,cloudConsent:true,publicMaterial:true});
  await f.repo.tick();assert.equal(f.created.length,1);
 }finally{f.db.close();}}
});
await check('Reserved, linked unknown, orphaned and damaged task ledgers never become a fresh local retry',async()=>{
 for(const mode of ['reserved','linked_unknown','orphan','bad_json','missing_identity']){const f=fixture();try{
  const r=f.resource('修复.md','failed');await f.start();await f.repo.tick();f.publish(r);
  const bid='aibatch_'+randomUUID();
  if(mode!=='orphan')f.db.prepare("INSERT INTO material_ai_batches(id,status,calls,config_json) VALUES(?,'paused',1,?)").run(bid,mode==='bad_json'?'{':mode==='missing_identity'?'{}':JSON.stringify({resourceId:r.rid,start:1,maxCalls:2}));
  f.db.prepare('INSERT INTO material_ai_task_keys VALUES(?,?,?,?,?)').run(randomUUID(),'fixture',bid,f.id,1);
  if(mode==='linked_unknown')f.db.prepare("UPDATE material_folder_ai_units SET ai_batch_id=?,error='outcome_unknown'").run(bid);
  for(let i=0;i<3;i++)await f.repo.tick();assert.equal(f.created.length,0,mode);
 }finally{f.db.close();}}
});
await check('An existing earlier paid unit is kept while a later unbilled parse failure resumes at its own position',async()=>{
 const f=fixture();try{
  const r=f.resource('后续.docx','failed');await f.start();await f.repo.tick();f.publish(r);
  f.db.exec("UPDATE material_folder_ai_units SET unit=2;UPDATE material_folder_ai_resources SET cursor=2,total=2");
  const old='aibatch_'+randomUUID();f.db.prepare("INSERT INTO material_ai_batches(id,status,calls,config_json) VALUES(?,'complete',2,?)").run(old,JSON.stringify({resourceId:r.rid,start:1,maxCalls:2}));f.db.prepare('INSERT INTO material_ai_task_keys VALUES(?,?,?,?,?)').run('old-key','fixture',old,f.id,1);
  await f.repo.tick();assert.equal(f.created.length,1);assert.equal(f.created[0].start,2);assert.equal(f.db.prepare('SELECT calls FROM material_ai_batches WHERE id=?').get(old).calls,2);
 }finally{f.db.close();}
});
await check('A recovered position absent from the new parser result is held for review rather than remaining pending forever',async()=>{
 const f=fixture();try{
  const r=f.resource('只有一段.md','failed');await f.start();await f.repo.tick();f.publish(r);
  f.db.exec("UPDATE material_folder_ai_units SET unit=2;UPDATE material_folder_ai_resources SET cursor=2,total=2");await f.repo.tick();
  assert.equal(f.created.length,0);const view=await f.repo.view(f.id);assert.equal(view.waiting,0);assert.equal(view.review,1);assert.equal(view.status,'attention');
  assert.equal(f.db.prepare('SELECT error FROM material_folder_ai_units').get().error,'no_structured_content');
 }finally{f.db.close();}
});
await check('The new retry index is idempotent and available to the bounded local recovery scan',async()=>{
 const f=fixture();try{
  await f.start();await f.reopen();assert.equal(f.db.prepare("SELECT COUNT(*) n FROM sqlite_master WHERE name='idx_folder_ai_local_parse_retry'").get().n,1);
  const plan=f.db.prepare("EXPLAIN QUERY PLAN SELECT resource_id FROM material_folder_ai_units INDEXED BY idx_folder_ai_local_parse_retry WHERE batch_id=? AND state='review' AND ai_batch_id='' AND error='local_parse_failed'").all(f.id);
  assert(plan.some(r=>r.detail.includes('idx_folder_ai_local_parse_retry')),JSON.stringify(plan));
 }finally{f.db.close();}
});
await check('A repaired parse keeps its place when the existing authorization budget is exhausted',async()=>{
 const f=fixture();try{
  const r=f.resource('额度.docx','failed');await f.start();await f.repo.tick();f.publish(r);f.state.failure='budget_exhausted';await f.repo.tick();
  assert.equal((await f.repo.view(f.id)).status,'budget_exhausted');assert.equal(f.created.length,0);assert.equal(f.db.prepare('SELECT state FROM material_folder_ai_units').get().state,'pending_local');
  f.state.failure='';await f.repo.authorize({schemaVersion:schema,batchId:f.id,settingsRevision:9,maxCalls:80,cloudConsent:true,publicMaterial:true});await f.repo.tick();
  assert.equal(f.created.length,1);assert.equal(f.created[0].start,1);
 }finally{f.db.close();}
});
await check('A failed local recovery transaction rolls back the unit and resource cursor together',async()=>{
 const f=fixture();try{
  const r=f.resource('事务.md','failed');await f.start();await f.repo.tick();f.publish(r);
  f.db.exec("CREATE TRIGGER reject_recovery BEFORE UPDATE OF total ON material_folder_ai_resources WHEN NEW.total=-1 BEGIN SELECT RAISE(ABORT,'controlled recovery failure'); END");await f.repo.tick();
  assert.equal(f.created.length,0);assert.equal(f.db.prepare('SELECT state FROM material_folder_ai_units').get().state,'review');const resource=f.db.prepare('SELECT total,cursor FROM material_folder_ai_resources').get();assert.equal(resource.total,1);assert.equal(resource.cursor,1);
  f.db.exec('DROP TRIGGER reject_recovery');await f.repo.tick();assert.equal(f.created.length,1);
 }finally{f.db.close();}
});
console.log(JSON.stringify({success:!failures,checks:results.length,results,scope:'Real SQLite/production folder scheduler with a controlled child executor; not provider quality, full UI or scale acceptance'}));if(failures)process.exitCode=1;
