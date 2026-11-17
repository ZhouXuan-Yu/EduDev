import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
const {MaterialFolderAiRepository}=await import('../../src/main/assets/material-folder-ai.ts');
const {folderResourceAuthorized}=await import('../../src/main/assets/material-folder-word-pages.ts');
const {WORD_PAGES_ENGINE}=await import('../../src/shared/material-word-pages.ts');
const {WORD_UPGRADE_INDEX_SQL}=await import('../../src/main/assets/word-upgrade-compatible.ts');
const {wordPageRuleCandidateHidden,isWordPageSource}=await import('../../src/main/assets/material-word-page-source.ts');
const results=[];
async function check(name,action){await action();results.push(name);console.log('PASS '+name);}
async function fixture(){
 const db=new DatabaseSync(':memory:'),folder='batch_'+randomUUID(),original='resource_'+randomUUID(),pdf='resource_'+randomUUID(),version='a'.repeat(64),pdfVersion='b'.repeat(64),state={prepared:0,created:[],fail:false,pause:false};
 db.exec(`CREATE TABLE material_import_batches(id TEXT PRIMARY KEY,status TEXT,name TEXT);
 CREATE TABLE material_import_entries(seq INTEGER PRIMARY KEY,batch_id TEXT,kind TEXT,status TEXT,resource_id TEXT);
 CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT,original_file_name TEXT,parse_status TEXT,parse_engine TEXT,title TEXT);
 CREATE TABLE resource_chunks(id TEXT,resource_id TEXT,page_number INTEGER,contains_personal_data INTEGER DEFAULT 0);
 CREATE TABLE material_word_documents(resource_id TEXT PRIMARY KEY,version TEXT,parser TEXT,digest TEXT,document_json TEXT);
 CREATE TABLE material_pdf_jobs(resource_id TEXT,version TEXT,total INTEGER,generation TEXT,state TEXT);
 CREATE TABLE material_pdf_pages(generation TEXT,page INTEGER,status TEXT,result_json TEXT DEFAULT '{}',error TEXT DEFAULT '');
 CREATE TABLE material_book_pairs(question_id TEXT PRIMARY KEY,question_version TEXT,answer_id TEXT,answer_version TEXT,revision INTEGER,active INTEGER);
 CREATE TABLE material_ai_batches(id TEXT PRIMARY KEY,status TEXT,calls INTEGER,config_json TEXT,pause_reason TEXT DEFAULT '');
 CREATE TABLE material_ai_units(batch_id TEXT,ordinal INTEGER,status TEXT,error TEXT);
 CREATE TABLE material_ai_task_keys(task_key TEXT PRIMARY KEY,input_sha TEXT,batch_id TEXT,folder_id TEXT,folder_revision INTEGER);
 CREATE TABLE material_ai_members(batch_id TEXT,question_id TEXT);
 CREATE TABLE question_bank_items(id TEXT PRIMARY KEY,archive_json TEXT,created_at TEXT,updated_at TEXT);
 CREATE TABLE material_question_members(resource_id TEXT,question_id TEXT);
 CREATE TABLE question_notebook_bookmarks(question_id TEXT,bookmarked INTEGER);
 CREATE TABLE question_notebook_category_links(question_id TEXT);
 CREATE TABLE question_bank_usage(question_id TEXT);`);
 db.exec(WORD_UPGRADE_INDEX_SQL);
 db.prepare("INSERT INTO material_import_batches VALUES(?,'completed','带图Word目录')").run(folder);
 db.prepare("INSERT INTO teacher_resources VALUES(?,?,'原题.docx','ready','word-ooxml.v2','物理原题')").run(original,version);
 db.prepare("INSERT INTO resource_chunks(id,resource_id) VALUES('original',?)").run(original);
 db.prepare("INSERT INTO material_import_entries VALUES(1,?,'file','saved',?)").run(folder,original);
 let repo,gate;
 const ai={settings:async()=>({configured:true,secureStorage:true,model:'deepseek-flash',revision:9}),create:async(input,task)=>{
  assert(await folderResourceAuthorized(host,folder,input.resourceId,input.version));
  const existing=db.prepare('SELECT batch_id FROM material_ai_task_keys WHERE task_key=?').get(task.key);if(existing)return existing.batch_id;
  const id='aibatch_'+randomUUID();state.created.push(input);
  db.prepare("INSERT INTO material_ai_batches(id,status,calls,config_json) VALUES(?,'running',0,?)").run(id,JSON.stringify(input));
  db.prepare("INSERT INTO material_ai_units VALUES(?,1,'pending','')").run(id);
  db.prepare('INSERT INTO material_ai_task_keys VALUES(?,?,?,?,?)').run(task.key,'fixture',id,folder,1);return id;
 },action:async()=>{}};
 const host={all:async(sql,values=[])=>db.prepare(sql).all(...values),run:async(sql,values=[])=>{db.prepare(sql).run(...values);},ai:()=>ai,word:()=>({upgrade:async()=>{throw Error('Native upgrade must not run for page-mode Word');}}),
 wordPages:async(input,signal)=>{
  state.prepared++;if(gate)await gate(signal);signal.throwIfAborted();if(state.fail)throw Error('timeout');
  if(state.pause)db.prepare("UPDATE material_folder_ai SET status='paused' WHERE batch_id=?").run(folder);
  db.prepare("INSERT OR IGNORE INTO teacher_resources VALUES(?,?,'原版.pdf','ready','pdfium','原版物理页')").run(pdf,pdfVersion);
  db.prepare("INSERT OR IGNORE INTO material_word_page_sources(id,resource_id,version,engine,original_name,status,pdf_resource_id,pdf_sha,pdf_bytes,pdf_name,pages,created_at,updated_at) VALUES(?,?,?,?,?,'complete',?,?,10,'原版.pdf',1,'now','now')").run('wpg_'+randomUUID(),original,version,WORD_PAGES_ENGINE,'原题.docx',pdf,pdfVersion);
  if(!db.prepare('SELECT 1 FROM material_pdf_jobs WHERE resource_id=?').get(pdf)){
   db.prepare("INSERT INTO material_pdf_jobs VALUES(?,?,1,'generation','complete')").run(pdf,pdfVersion);
   db.prepare("INSERT INTO material_pdf_pages VALUES('generation',1,'complete','{}','')").run();
   db.prepare("INSERT INTO resource_chunks(id,resource_id,page_number) VALUES('page',?,1)").run(pdf);
  }
  return{schemaVersion:input.schemaVersion,role:'original',status:'complete',error:'',original:{id:original,version,name:'原题.docx'},originalAvailable:true,pdf:{id:pdf,contentHash:pdfVersion,originalFileName:'原版.pdf'},pages:1};
 },writer:async action=>{db.exec('BEGIN IMMEDIATE');try{const result=await action(repo);db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
 repo=new MaterialFolderAiRepository(host);await repo.migrate();await repo.migrate();
 const grant={schemaVersion:'xiaozhi.material-folder-ai.v1',batchId:folder,settingsRevision:9,maxCalls:30,cloudConsent:true,publicMaterial:true,processingMode:'quality'};
 return{db,host,repo,folder,original,pdf,version,pdfVersion,state,grant,gate:fn=>gate=fn,reopen:()=>{repo=new MaterialFolderAiRepository(host);return repo;}};
}
await check('New quality grants freeze page-mode while migrated and standard grants retain native semantics',async()=>{
 const f=await fixture();try{
  const view=await f.repo.authorize(f.grant);assert.equal(view.wordSourcePolicy,'word-pages.v1');
  f.db.prepare("UPDATE material_folder_ai SET word_source_policy='native.v1'").run();
  assert.equal((await f.repo.authorize({...f.grant,maxCalls:40})).wordSourcePolicy,'native.v1');
  assert.equal((await f.reopen().view(f.folder)).wordSourcePolicy,'native.v1');
  const standard='batch_'+randomUUID();f.db.prepare("INSERT INTO material_import_batches VALUES(?,'completed','标准目录')").run(standard);
  assert.equal((await f.repo.authorize({...f.grant,batchId:standard,processingMode:'standard'})).wordSourcePolicy,'native.v1');
 }finally{f.db.close();}
});
await check('A folder prepares Word once, schedules its PDF page and never schedules native Word',async()=>{
 const f=await fixture();try{
  await f.repo.authorize(f.grant);await f.repo.tick();assert.equal(f.state.prepared,1);assert.equal(f.state.created.length,1);
  assert.equal(f.state.created[0].resourceId,f.pdf);assert.equal(f.state.created[0].maxCalls,3);
  const view=await f.repo.view(f.folder);assert.equal(view.resources,1);assert.equal(view.pageSnapshots,1);
  assert.equal(f.db.prepare('SELECT status FROM material_folder_ai_resources WHERE resource_id=?').get(f.original).status,'represented');
  await f.reopen().tick();assert.equal(f.state.prepared,1);assert.equal(f.state.created.length,1);
 }finally{f.db.close();}
});
await check('Derived grants reject a foreign PDF, changed original, missing membership and changed conversion receipt',async()=>{
 const f=await fixture();try{
  await f.repo.authorize(f.grant);await f.repo.tick();assert(await folderResourceAuthorized(f.host,f.folder,f.pdf,f.pdfVersion));
  assert(!await folderResourceAuthorized(f.host,f.folder,'resource_'+randomUUID()));
  for(const [change,restore]of [
   [()=>f.db.prepare("UPDATE teacher_resources SET content_hash='changed' WHERE id=?").run(f.original),()=>f.db.prepare('UPDATE teacher_resources SET content_hash=? WHERE id=?').run(f.version,f.original)],
   [()=>f.db.prepare("UPDATE material_import_entries SET status='failed'").run(),()=>f.db.prepare("UPDATE material_import_entries SET status='saved'").run()],
   [()=>f.db.prepare("UPDATE material_word_page_sources SET pdf_sha='changed'").run(),()=>f.db.prepare('UPDATE material_word_page_sources SET pdf_sha=?').run(f.pdfVersion)],
   [()=>f.db.prepare("UPDATE material_folder_ai_resources SET origin_version='changed' WHERE resource_id=?").run(f.pdf),()=>f.db.prepare('UPDATE material_folder_ai_resources SET origin_version=? WHERE resource_id=?').run(f.version,f.pdf)],
   [()=>f.db.prepare("UPDATE resource_chunks SET contains_personal_data=1 WHERE resource_id=?").run(f.original),()=>f.db.prepare("UPDATE resource_chunks SET contains_personal_data=0 WHERE resource_id=?").run(f.original)],
  ]){change();assert(!await folderResourceAuthorized(f.host,f.folder,f.pdf,f.pdfVersion));restore();assert(await folderResourceAuthorized(f.host,f.folder,f.pdf,f.pdfVersion));}
 }finally{f.db.close();}
});
await check('Failed local conversion is explicit and resumes without rewriting a paid task',async()=>{
 const f=await fixture();try{
  f.state.fail=true;await f.repo.authorize(f.grant);await f.repo.tick();assert.equal(f.state.created.length,0);
  assert.equal((await f.repo.view(f.folder)).review,1);assert.equal((await f.repo.view(f.folder)).issues[0].error,'word_pages_failed');
  f.state.fail=false;await f.repo.action({schemaVersion:f.grant.schemaVersion,batchId:f.folder,action:'resume'});await f.repo.tick();
  assert.equal(f.state.created.length,1);assert.equal(f.state.created[0].resourceId,f.pdf);
 }finally{f.db.close();}
});
await check('A pause during preparation cancels the owner and publishes no child grant',async()=>{
 const f=await fixture();let started;const entered=new Promise(resolve=>started=resolve);
 try{
  f.gate(signal=>new Promise((resolve,reject)=>{started();signal.addEventListener('abort',()=>reject(Error('cancelled')),{once:true});}));
  await f.repo.authorize(f.grant);const work=f.repo.tick();await entered;await f.repo.action({schemaVersion:f.grant.schemaVersion,batchId:f.folder,action:'pause'});await work;
  assert.equal(f.state.created.length,0);assert.equal(f.db.prepare("SELECT COUNT(*) n FROM material_folder_ai_resources WHERE origin_resource_id<>''").get().n,0);
 }finally{f.db.close();}
});
await check('A grant paused immediately after conversion cannot attach or dispatch its PDF',async()=>{
 const f=await fixture();try{
  f.state.pause=true;await f.repo.authorize(f.grant);await f.repo.tick();assert.equal(f.state.created.length,0);
  assert.equal(f.db.prepare("SELECT COUNT(*) n FROM material_folder_ai_resources WHERE origin_resource_id<>''").get().n,0);
 }finally{f.db.close();}
});
await check('Snapshot text candidates stay raw-readable and teacher-owned records stay visible',async()=>{
 const f=await fixture();try{
  await f.repo.authorize(f.grant);await f.repo.tick();
  const archive={schemaVersion:'xiaozhi.question-archive.v1',extractor:'numbered-text.v1',state:'rule_extracted',sourceChecked:false,sources:[{resourceId:f.pdf,version:f.pdfVersion}]};
  f.db.prepare("INSERT INTO question_bank_items VALUES('rule',?,'now','now')").run(JSON.stringify(archive));f.db.prepare("INSERT INTO material_question_members VALUES(?,'rule')").run(f.pdf);
  const hidden=()=>f.db.prepare(`SELECT ${wordPageRuleCandidateHidden} hidden FROM question_bank_items q WHERE q.id='rule'`).get().hidden;
  assert.equal(hidden(),1);assert.equal(f.db.prepare('SELECT COUNT(*) n FROM question_bank_items').get().n,1);
  f.db.prepare("INSERT INTO question_notebook_bookmarks VALUES('rule',1)").run();assert.equal(hidden(),0);f.db.exec('DELETE FROM question_notebook_bookmarks');
  for(const table of ['question_notebook_category_links','question_bank_usage']){
   f.db.prepare(`INSERT INTO ${table} VALUES('rule')`).run();assert.equal(hidden(),0);f.db.exec('DELETE FROM '+table);assert.equal(hidden(),1);
  }
  f.db.prepare("UPDATE question_bank_items SET updated_at='later'").run();assert.equal(hidden(),0);
  f.db.prepare("UPDATE question_bank_items SET updated_at='now'").run();assert.equal(hidden(),1);
  f.db.prepare("UPDATE teacher_resources SET content_hash='changed' WHERE id=?").run(f.original);assert.equal(hidden(),0);
  f.db.prepare('UPDATE teacher_resources SET content_hash=? WHERE id=?').run(f.version,f.original);assert.equal(hidden(),1);
  assert(await isWordPageSource(f.host,{id:f.pdf,contentHash:f.pdfVersion,originalFileName:'原版.pdf'}));
  f.db.prepare("UPDATE material_word_page_sources SET pdf_resource_id=''").run();assert(await isWordPageSource(f.host,{id:f.pdf,contentHash:f.pdfVersion,originalFileName:'原版.pdf'}));
  assert(!await isWordPageSource(f.host,{id:'foreign',contentHash:f.pdfVersion,originalFileName:'另一文件.pdf'}));
 }finally{f.db.close();}
});
console.log(JSON.stringify({passed:results.length,results,scope:'Production folder scheduler, authorization SQL, actual SQLite and controlled local conversion/AI receipts. Real managed Office, OCR, provider and UI are separate checks.'}));
