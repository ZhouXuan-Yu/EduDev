import '../office-agent/register-source.mjs';import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import {createHash,randomUUID} from 'node:crypto';
const {MaterialFolderAiRepository}=await import('../../src/main/assets/material-folder-ai.ts');
const {WORD_UPGRADE_INDEX_SQL}=await import('../../src/main/assets/word-upgrade-compatible.ts');
const {MATERIAL_FOLDER_AI_SCHEMA:schema,validFolderAiGrant}=await import('../../src/shared/material-folder-ai.ts');
const db=new DatabaseSync(':memory:'),id='batch_'+randomUUID(),resource='resource_'+randomUUID(),version=createHash('sha256').update('original').digest('hex');let repo,creates=0;
db.exec(`CREATE TABLE material_word_documents(resource_id TEXT PRIMARY KEY,version TEXT,parser TEXT,digest TEXT,document_json TEXT);CREATE TABLE material_import_batches(id TEXT PRIMARY KEY,status TEXT,name TEXT);CREATE TABLE material_import_entries(seq INTEGER PRIMARY KEY,batch_id TEXT,kind TEXT,status TEXT,resource_id TEXT);CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT,original_file_name TEXT,parse_status TEXT,parse_engine TEXT,title TEXT);CREATE TABLE resource_chunks(id TEXT,resource_id TEXT,page_number INTEGER);CREATE TABLE material_pdf_jobs(resource_id TEXT,version TEXT,total INTEGER,generation TEXT,state TEXT);CREATE TABLE material_pdf_pages(generation TEXT,page INTEGER,status TEXT,result_json TEXT NOT NULL DEFAULT '{}',error TEXT NOT NULL DEFAULT '');CREATE TABLE material_book_pairs(question_id TEXT PRIMARY KEY,question_version TEXT,answer_id TEXT,answer_version TEXT,revision INTEGER,active INTEGER);CREATE TABLE material_ai_batches(id TEXT PRIMARY KEY,status TEXT,calls INTEGER,config_json TEXT,pause_reason TEXT NOT NULL DEFAULT '');CREATE TABLE material_ai_units(batch_id TEXT,ordinal INTEGER,status TEXT,error TEXT);CREATE TABLE material_ai_task_keys(task_key TEXT PRIMARY KEY,input_sha TEXT,batch_id TEXT,folder_id TEXT,folder_revision INTEGER);CREATE TABLE material_ai_members(batch_id TEXT,question_id TEXT);CREATE TABLE question_bank_items(id TEXT,archive_json TEXT);`);
db.exec(WORD_UPGRADE_INDEX_SQL);
 db.prepare("INSERT INTO material_import_batches VALUES(?,'running','合成目录')").run(id);db.prepare("INSERT INTO teacher_resources VALUES(?,?,'习题.png','ready','local-ocr','合成原图')").run(resource,version);db.prepare("INSERT INTO resource_chunks(id,resource_id) VALUES('c',?)").run(resource);db.prepare("INSERT INTO material_import_entries VALUES(1,?,'file','pending','')").run(id);
const ai={settings:async()=>({revision:9,model:'deepseek-flash',configured:true,secureStorage:true}),create:async(input,task)=>{const existing=db.prepare('SELECT batch_id FROM material_ai_task_keys WHERE task_key=?').get(task.key);if(existing)return existing.batch_id;creates++;const bid='aibatch_'+randomUUID();db.prepare("INSERT INTO material_ai_batches(id,status,calls,config_json) VALUES(?,'running',0,?)").run(bid,JSON.stringify(input));db.prepare("INSERT INTO material_ai_units VALUES(?,1,'pending','')").run(bid);db.prepare('INSERT INTO material_ai_task_keys VALUES(?,?,?,?,?)').run(task.key,'fixture',bid,task.folderId,task.revision);return bid;},action:async(input,reason='teacher')=>{db.prepare('UPDATE material_ai_batches SET status=?,pause_reason=? WHERE id=?').run(input.action==='pause'?'paused':'running',input.action==='pause'?reason:'',input.batchId);}};
const host={all:async(sql,p=[])=>db.prepare(sql).all(...p),run:async(sql,p=[])=>{db.prepare(sql).run(...p);},ai:()=>ai,word:()=>({}),writer:async action=>{db.exec('BEGIN IMMEDIATE');try{const result=await action(repo);db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}};repo=new MaterialFolderAiRepository(host);
const input={schemaVersion:schema,batchId:id,settingsRevision:9,maxCalls:4,cloudConsent:true,publicMaterial:true};
try{
 await repo.migrate();assert(!validFolderAiGrant({...input,cloudConsent:false}));assert(!validFolderAiGrant({...input,extra:true}));
 await assert.rejects(repo.authorize({...input,cloudConsent:false}),/invalid_input/);assert.equal(creates,0);
 const grant=await repo.authorize(input);assert.equal(grant.status,'running');
 await repo.tick();db.prepare("UPDATE material_import_entries SET status='saved',resource_id=? WHERE seq=1").run(resource);
 for(let i=0;i<5&&!creates;i++)await repo.tick();assert.equal(creates,1,'A newly archived resource must enter the authorized AI workflow without a per-resource click');
 for(let i=0;i<4;i++)await repo.tick();assert.equal(creates,1);
 await repo.action({schemaVersion:schema,batchId:id,action:'pause'});assert.equal((await repo.view(id)).status,'paused');
 const child=db.prepare('SELECT id FROM material_ai_batches').get();assert.equal(db.prepare('SELECT status FROM material_ai_batches').get().status,'paused');
 const reopened=new MaterialFolderAiRepository(host);await reopened.migrate();repo=reopened;
 await repo.action({schemaVersion:schema,batchId:id,action:'resume'});await repo.tick();assert.equal(creates,1,'Reopen must keep the linked child instead of creating a second batch');
 await ai.action({batchId:child.id,action:'pause'});await repo.tick();assert.equal(db.prepare('SELECT status FROM material_ai_batches WHERE id=?').get(child.id).status,'paused','Directory automation must honor an explicit teacher pause of a child batch');
 const secondResource='resource_'+randomUUID();db.prepare("INSERT INTO teacher_resources VALUES(?,?,'另题.png','ready','local-ocr','另一原图')").run(secondResource,version);db.prepare("INSERT INTO material_import_entries VALUES(2,?,'file','saved',?)").run(id,secondResource);for(let i=0;i<4&&creates<2;i++)await repo.tick();assert.equal(creates,2);
 const secondChild=db.prepare('SELECT ai_batch_id FROM material_folder_ai_units WHERE resource_id=?').get(secondResource);db.prepare("UPDATE material_ai_units SET status='outcome_unknown',error='outcome_unknown' WHERE batch_id=?").run(secondChild.ai_batch_id);
 db.prepare("UPDATE material_import_batches SET status='completed' WHERE id=?").run(id);
 for(let i=0;i<3;i++)await repo.tick();assert.equal(creates,2);const final=await repo.view(id);assert(final.review+final.failed>=2);assert.equal(final.status,'attention');
 // Old attention cards cannot starve later folder grants behind the bounded window.
 for(let i=0;i<16;i++)db.prepare("INSERT INTO material_folder_ai(batch_id,status,revision,settings_revision,max_calls) VALUES(?,'attention',1,9,2)").run('batch_'+randomUUID());
 const later='batch_'+randomUUID(),thirdResource='resource_'+randomUUID();db.prepare("INSERT INTO material_import_batches VALUES(?,'completed','后续目录')").run(later);db.prepare("INSERT INTO teacher_resources VALUES(?,?,'后题.png','ready','local-ocr','后续原图')").run(thirdResource,version);db.prepare("INSERT INTO material_import_entries VALUES(3,?,'file','saved',?)").run(later,thirdResource);
 await repo.authorize({...input,batchId:later,maxCalls:2});for(let i=0;i<4&&creates<3;i++)await repo.tick();assert.equal(creates,3,'Settled attention folders must not starve a newly authorized folder outside the first sixteen rows');
 // Explicit folder policies survive a cold repository and do not follow process feature flags.
 assert.equal((await repo.view(id)).processingMode,'legacy');
 for(const processingMode of ['quality','standard']){
  assert(validFolderAiGrant({...input,processingMode}));
  const batchId='batch_'+randomUUID(),rid='resource_'+randomUUID(),generation=randomUUID();
  db.prepare("INSERT INTO material_import_batches VALUES(?,'completed','模式目录')").run(batchId);
  db.prepare("INSERT INTO teacher_resources VALUES(?,?,'新题.pdf','ready','pdfium','新原页')").run(rid,version);
  db.prepare("INSERT INTO material_import_entries VALUES(?,?,'file','saved',?)").run(db.prepare('SELECT MAX(seq)+1 n FROM material_import_entries').get().n,batchId,rid);
  db.prepare("INSERT INTO material_pdf_jobs VALUES(?,?,1,?,'complete')").run(rid,version,generation);
  db.prepare("INSERT INTO material_pdf_pages VALUES(?,1,'blank','{}','')").run(generation);
  await repo.authorize({...input,batchId,processingMode,maxCalls:30});
  await assert.rejects(repo.authorize({...input,batchId,processingMode:processingMode==='quality'?'standard':'quality',maxCalls:40}),/processing_mode_locked/);
  await repo.authorize({...input,batchId,maxCalls:40});
  repo=new MaterialFolderAiRepository(host);await repo.migrate();
  assert.equal((await repo.view(batchId)).processingMode,processingMode);
  for(let i=0;i<10&&!db.prepare('SELECT 1 FROM material_folder_ai_units WHERE batch_id=?').get(batchId);i++)await repo.tick();
  const child=db.prepare('SELECT b.config_json FROM material_ai_task_keys k JOIN material_ai_batches b ON b.id=k.batch_id WHERE k.folder_id=?').get(batchId);
  assert(child,'Explicit policy must schedule a PDF without developer switches');
  assert.equal(JSON.parse(child.config_json).maxCalls,processingMode==='quality'?3:2);
 }
 for(const processingMode of ['quality','standard']){
  const batchId='batch_'+randomUUID(),rid='resource_'+randomUUID();
  db.prepare("INSERT INTO material_import_batches VALUES(?,'completed','图片模式目录')").run(batchId);
  db.prepare("INSERT INTO teacher_resources VALUES(?,?,'新题.png','ready','local-ocr','图片原件')").run(rid,version);
  db.prepare("INSERT INTO material_import_entries VALUES(?,?,'file','saved',?)").run(db.prepare('SELECT MAX(seq)+1 n FROM material_import_entries').get().n,batchId,rid);
  await repo.authorize({...input,batchId,processingMode,maxCalls:3});
  for(let i=0;i<10&&!db.prepare('SELECT 1 FROM material_folder_ai_units WHERE batch_id=?').get(batchId);i++)await repo.tick();
  const child=db.prepare('SELECT b.config_json FROM material_ai_task_keys k JOIN material_ai_batches b ON b.id=k.batch_id WHERE k.folder_id=?').get(batchId);
  assert(child,'Image quality tasks need the same three-pass reservation as PDF tasks');
  assert.equal(JSON.parse(child.config_json).maxCalls,processingMode==='quality'?3:2);
 }
 for(const missingAnswer of [false,true]){
  const batchId='batch_'+randomUUID(),question='resource_'+randomUUID(),known='resource_'+randomUUID();
  db.prepare("INSERT INTO material_import_batches VALUES(?,'completed','题答依赖目录')").run(batchId);
  for(const [rid,name]of [[question,'试题.pdf'],...(missingAnswer?[]:[[known,'答案.pdf']])]){
   const generation=randomUUID();db.prepare("INSERT INTO teacher_resources VALUES(?,? ,?,'ready','pdfium','原页')").run(rid,version,name);
   db.prepare("INSERT INTO material_import_entries VALUES(?,?,'file','saved',?)").run(db.prepare('SELECT MAX(seq)+1 n FROM material_import_entries').get().n,batchId,rid);
   db.prepare("INSERT INTO material_pdf_jobs VALUES(?,?,1,?,'complete')").run(rid,version,generation);db.prepare("INSERT INTO material_pdf_pages VALUES(?,1,'blank','{}','')").run(generation);
  }
  db.prepare('INSERT INTO material_book_pairs VALUES(?,?,?,?,1,1)').run(question,version,known,version);await repo.authorize({...input,batchId,processingMode:'quality',maxCalls:6});
  for(let i=0;i<10&&!db.prepare('SELECT 1 FROM material_folder_ai_units WHERE batch_id=?').get(batchId);i++)await repo.tick();
  const first=db.prepare('SELECT resource_id,ai_batch_id FROM material_folder_ai_units WHERE batch_id=? ORDER BY rowid LIMIT 1').get(batchId);assert.equal(first.resource_id,missingAnswer?question:known,'Only a present authorized paired answer may run before its question book');
  if(!missingAnswer){
   const count=creates;await repo.action({schemaVersion:schema,batchId,action:'pause'});for(let i=0;i<3;i++)await repo.tick();assert.equal(creates,count);await repo.action({schemaVersion:schema,batchId,action:'resume'});db.prepare("UPDATE material_ai_units SET status='no_questions' WHERE batch_id=?").run(first.ai_batch_id);
   for(let i=0;i<10&&!db.prepare('SELECT 1 FROM material_folder_ai_units WHERE batch_id=? AND resource_id=?').get(batchId,question);i++)await repo.tick();assert(db.prepare('SELECT 1 FROM material_folder_ai_units WHERE batch_id=? AND resource_id=?').get(batchId,question));
  }
 }
 for(const processingMode of ['legacy','unknown',undefined,null,3])assert(!validFolderAiGrant({...input,processingMode}));
 const stale=db.prepare('SELECT ai_batch_id FROM material_folder_ai_units WHERE batch_id=? LIMIT 1').get(id);assert(stale?.ai_batch_id);
 db.prepare("UPDATE material_ai_units SET status='review',error='page_content_incomplete' WHERE batch_id=?").run(stale.ai_batch_id);
 db.prepare("UPDATE material_folder_ai_units SET state='failed',error='source_changed' WHERE batch_id=? AND ai_batch_id=?").run(id,stale.ai_batch_id);
 const paidCalls=db.prepare('SELECT calls FROM material_ai_batches WHERE id=?').get(stale.ai_batch_id).calls;
 await repo.authorize(input);
 for(let i=0;i<100&&db.prepare('SELECT state FROM material_folder_ai_units WHERE batch_id=? AND ai_batch_id=?').get(id,stale.ai_batch_id).state==='failed';i++)await repo.tick();
 const reconciled=db.prepare('SELECT state,error FROM material_folder_ai_units WHERE batch_id=? AND ai_batch_id=?').get(id,stale.ai_batch_id);assert.equal(reconciled.state,'review');assert.equal(reconciled.error,'page_content_incomplete');assert.equal(db.prepare('SELECT calls FROM material_ai_batches WHERE id=?').get(stale.ai_batch_id).calls,paidCalls);
 console.log(JSON.stringify({success:true,checks:18,scope:'Folder scheduling, SQLite persistence, late archive trigger, pause/reopen, fair bounded scheduling and unknown no-replay with a controlled child executor; not AI quality or UI acceptance'}));
}finally{db.close();}
