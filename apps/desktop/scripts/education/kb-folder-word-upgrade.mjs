import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {DatabaseSync} from 'node:sqlite';
import {createHash,randomUUID} from 'node:crypto';
import {wordFixture} from './word-fixtures.mjs';
const {parseWord}=await import('../../src/main/assets/word-parser.ts');
const {MaterialWordRepository}=await import('../../src/main/assets/material-word-repository.ts');
const {MaterialFolderAiRepository}=await import('../../src/main/assets/material-folder-ai.ts');
const {MATERIAL_FOLDER_AI_SCHEMA:schema}=await import('../../src/shared/material-folder-ai.ts');
const {WORD_PARSER,WORD_LEGACY_PARSER}=await import('../../src/shared/material-word.ts');
const {WORD_UPGRADE_INDEX,WORD_UPGRADE_PREDICATE}=await import('../../src/main/assets/word-upgrade-compatible.ts');
const payload=await parseWord(await wordFixture()),version='a'.repeat(64),checks=[];
const digest=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
async function check(name,action){await action();checks.push(name);console.log('PASS '+name);}
function legacyDocument(){
 const doc=structuredClone(payload.document);doc.parser=WORD_LEGACY_PARSER;delete doc.unscopedWarnings;delete doc.questionPolicy;delete doc.imagePolicy;
 function strip(blocks){for(const b of blocks){delete b.warnings;if(b.kind==='table')for(const row of b.rows)for(const cell of row.cells)strip(cell.blocks);}}
 strip(doc.blocks);return doc;
}
async function fixture(){
 const root=await fs.mkdtemp(path.join(tmpdir(),'omni-folder-word-upgrade-')),db=new DatabaseSync(':memory:'),id='batch_'+randomUUID();
 db.exec(`CREATE TABLE material_import_batches(id TEXT PRIMARY KEY,status TEXT,name TEXT);
 CREATE TABLE material_import_entries(seq INTEGER PRIMARY KEY,batch_id TEXT,kind TEXT,status TEXT,resource_id TEXT);
 CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT,original_file_name TEXT,parse_status TEXT,parse_engine TEXT,title TEXT);
 CREATE TABLE resource_chunks(id TEXT,resource_id TEXT,page_number INTEGER);
 CREATE TABLE material_pdf_jobs(resource_id TEXT,version TEXT,total INTEGER,generation TEXT,state TEXT);
 CREATE TABLE material_pdf_pages(generation TEXT,page INTEGER,status TEXT,result_json TEXT NOT NULL DEFAULT '{}',error TEXT NOT NULL DEFAULT '');
 CREATE TABLE material_book_pairs(question_id TEXT PRIMARY KEY,question_version TEXT,answer_id TEXT,answer_version TEXT,revision INTEGER,active INTEGER);
 CREATE TABLE material_ai_batches(id TEXT PRIMARY KEY,status TEXT,calls INTEGER,config_json TEXT,pause_reason TEXT NOT NULL DEFAULT '');
 CREATE TABLE material_ai_units(batch_id TEXT,ordinal INTEGER,status TEXT,error TEXT,input_json TEXT);
 CREATE TABLE material_ai_task_keys(task_key TEXT PRIMARY KEY,input_sha TEXT,batch_id TEXT,folder_id TEXT,folder_revision INTEGER);
 CREATE TABLE material_ai_members(batch_id TEXT,question_id TEXT);
 CREATE TABLE question_bank_items(id TEXT,archive_json TEXT);`);
 db.prepare("INSERT INTO material_import_batches VALUES(?,'running','Word目录')").run(id);
 const resources=[1,2].map(n=>'resource_'+randomUUID()),state={parses:[],onParse:undefined};let folder,word;
 const all=async(q,p=[])=>db.prepare(q).all(...p),run=async(q,p=[])=>{db.prepare(q).run(...p);};
 const wordHost={root:()=>root,all,run,resource:async rid=>{const r=db.prepare('SELECT * FROM teacher_resources WHERE id=?').get(rid);return{id:rid,contentHash:r.content_hash,parseStatus:r.parse_status};},
  verify:async(_rid,_v,signal)=>signal.throwIfAborted(),stamp:async()=> 'fixed-original',
  parse:async(rid,_v,signal)=>{state.parses.push(rid);const custom=await state.onParse?.(rid,signal);signal.throwIfAborted();return structuredClone(custom||payload);},
  writer:async(action,beforeCommit)=>{db.exec('BEGIN IMMEDIATE');try{const result=await action(word);beforeCommit?.();db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
 word=new MaterialWordRepository(wordHost);await word.migrate();
 for(const [index,rid]of resources.entries()){
  db.prepare("INSERT INTO teacher_resources VALUES(?,?,'合成.docx','ready',?,'合成Word')").run(rid,version,WORD_LEGACY_PARSER);
  db.prepare("INSERT INTO resource_chunks VALUES(?,?,NULL)").run('chunk-'+index,rid);
  db.prepare("INSERT INTO material_import_entries VALUES(?,?,'file','saved',?)").run(index+1,id,rid);
  await word.commit(rid,version,legacyDocument());
 }
 await word.prepare(payload,new AbortController().signal);
 const created=[];
 const ai={settings:async()=>({revision:9,model:'deepseek-flash',configured:true,secureStorage:true}),create:async(input,task)=>{
  const old=db.prepare('SELECT batch_id FROM material_ai_task_keys WHERE task_key=?').get(task.key);if(old)return old.batch_id;
  const grant=db.prepare('SELECT status FROM material_folder_ai WHERE batch_id=?').get(id);if(grant.status!=='running')throw Error('paused');
  const source=(await word.questions({schemaVersion:'xiaozhi.word-question-source.v1',resourceId:input.resourceId,version,offset:input.start-1,ordinal:input.start})).source;
  const bid='aibatch_'+randomUUID();created.push({bid,input:structuredClone(input),documentSha:source.documentSha});
  db.prepare("INSERT INTO material_ai_batches(id,status,calls,config_json) VALUES(?,'running',0,?)").run(bid,JSON.stringify(input));
  db.prepare("INSERT INTO material_ai_units VALUES(?,1,'pending','',?)").run(bid,JSON.stringify({documentSha:source.documentSha,sourceDigest:digest(source)}));
  db.prepare('INSERT INTO material_ai_task_keys VALUES(?,?,?,?,?)').run(task.key,digest(source),bid,id,1);return bid;
 },action:async(input,reason='teacher')=>{db.prepare('UPDATE material_ai_batches SET status=?,pause_reason=? WHERE id=?').run(input.action==='pause'?'paused':'running',input.action==='pause'?reason:'',input.batchId);}};
 const host={all,run,word:()=>word,ai:()=>ai,writer:async action=>{db.exec('BEGIN IMMEDIATE');try{const result=await action(folder);db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}}};
 folder=new MaterialFolderAiRepository(host);await folder.migrate();await folder.authorize({schemaVersion:schema,batchId:id,settingsRevision:9,maxCalls:12,cloudConsent:true,publicMaterial:true});
 return {root,db,id,resources,state,word,ai,created,get folder(){return folder;},async reopen(){folder=new MaterialFolderAiRepository(host);await folder.migrate();return folder;},close(){db.close();}};
}
await check('One local upgrade per tick proceeds during a frozen old AI unit without changing or resending it',async()=>{
 const f=await fixture();try{
  await f.folder.tick();assert.equal(f.state.parses.length,1);assert.equal(f.created.length,1);
  const unit=f.db.prepare('SELECT * FROM material_ai_units').get(),before=JSON.stringify(unit);
  await f.folder.tick();assert.equal(f.state.parses.length,2);assert.equal(f.created.length,1);
  assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM material_ai_units').get()),before);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_word_documents WHERE parser=?').get(WORD_PARSER).n,2);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_word_document_versions').get().n,2);
  await f.folder.tick();assert.equal(f.state.parses.length,2);
 }finally{f.close();}
});
await check('The persistent pending index becomes empty and tracks old-version commits without scanning completed document JSON',async()=>{
 const f=await fixture();try{
  const query=`SELECT resource_id FROM material_word_documents INDEXED BY ${WORD_UPGRADE_INDEX} WHERE ${WORD_UPGRADE_PREDICATE}`;
  assert.equal(f.db.prepare(query).all().length,2);
  await f.folder.tick();await f.folder.tick();assert.equal(f.db.prepare(query).all().length,0);
  assert(f.db.prepare('EXPLAIN QUERY PLAN '+query).all().some(row=>row.detail.includes(WORD_UPGRADE_INDEX)));
  const previous=structuredClone(payload.document);delete previous.questionPolicy;
  await f.word.commit(f.resources[0],version,previous);assert.equal(f.db.prepare(query).all().length,1);
  await f.word.upgrade(f.resources[0],version,new AbortController().signal);assert.equal(f.db.prepare(query).all().length,0);
 }finally{f.close();}
});
await check('Existing v2 documents receive the new frozen booklet policy before a future directory input is planned',async()=>{
 const f=await fixture();try{
  const previous=structuredClone(payload.document);delete previous.questionPolicy;
  for(const id of f.resources)await f.word.commit(id,version,previous);
  await f.folder.tick();assert.equal(f.created.length,1);
  const input=f.created[0],current=await f.word.document(input.input.resourceId,version);
  assert.equal(current.questionPolicy,payload.document.questionPolicy);assert.equal(input.documentSha,digest(current));
  assert.deepEqual(await f.word.document(input.input.resourceId,version,digest(previous)),previous);
 }finally{f.close();}
});
await check('Legacy paid input retains its exact selected representation while other Word preparation continues',async()=>{
 const f=await fixture();try{
  // Discovering the grant is local; seed the same durable state produced by the earlier executor.
  for(const rid of f.resources)f.db.prepare('INSERT INTO material_folder_ai_resources(batch_id,resource_id,version) VALUES(?,?,?)').run(f.id,rid,version);
  const rid=f.resources[0],query={schemaVersion:'xiaozhi.word-question-source.v1',resourceId:rid,version,offset:0,ordinal:1},oldSource=(await f.word.questions(query)).source;
  const key=createHash('sha256').update(JSON.stringify([schema,f.id,1,rid,version,1])).digest('hex');
  const bid=await f.ai.create({resourceId:rid,version,start:1,count:1,maxCalls:2},{key});
  f.db.prepare("INSERT INTO material_folder_ai_units VALUES(?,?,?,1,'running',?,'')").run(f.id,rid,version,bid);
  f.db.prepare("UPDATE material_folder_ai_resources SET cursor=1,total=2,status='running' WHERE resource_id=?").run(rid);
  const frozen=JSON.stringify(f.db.prepare('SELECT * FROM material_ai_units WHERE batch_id=?').get(bid));
  await f.folder.tick();await f.folder.tick();
  assert.deepEqual((await f.word.questions(query,oldSource.documentSha)).source,oldSource);
  assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM material_ai_units WHERE batch_id=?').get(bid)),frozen);assert.equal(f.created.length,1);
 }finally{f.close();}
});
await check('Teacher pause cancels local preparation and leaves both the old representation and cloud queue untouched',async()=>{
 const f=await fixture();try{
  f.state.onParse=async()=>{await f.folder.action({schemaVersion:schema,batchId:f.id,action:'pause'});};
  await f.folder.tick();assert.equal((await f.folder.view(f.id)).status,'paused');assert.equal(f.created.length,0);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_word_documents WHERE parser=?').get(WORD_LEGACY_PARSER).n,2);
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_word_document_versions').get().n,0);
 }finally{f.close();}
});
await check('Preparation failure is isolated and original resume retries only the same unbilled legacy work',async()=>{
 const f=await fixture();try{
  const bad=f.resources[0];let fail=true;f.state.onParse=rid=>{if(rid===bad&&fail)throw Error('local-read-failure');};
  await f.folder.tick();const failed=f.db.prepare('SELECT * FROM material_folder_ai_resources WHERE resource_id=?').get(bad);assert.equal(failed.error,'word_upgrade_failed');assert.equal(f.created.length,0);
  await f.folder.tick();assert.equal(f.created.length,1);const other=f.created[0].bid;
  const saved=f.db.prepare('SELECT input_json FROM material_ai_units WHERE batch_id=?').get(other).input_json;
  await f.folder.action({schemaVersion:schema,batchId:f.id,action:'pause'});fail=false;
  await f.folder.action({schemaVersion:schema,batchId:f.id,action:'resume'});await f.folder.tick();
  assert.equal(f.db.prepare('SELECT parser FROM material_word_documents WHERE resource_id=?').get(bad).parser,WORD_PARSER);
  assert.equal(f.db.prepare('SELECT error FROM material_folder_ai_resources WHERE resource_id=?').get(bad).error,'');
  assert.equal(f.db.prepare('SELECT input_json FROM material_ai_units WHERE batch_id=?').get(other).input_json,saved);assert.equal(f.created.length,1);
 }finally{f.close();}
});
await check('Changed question plans retain the old representation and an explicit review result',async()=>{
 const f=await fixture();try{
  f.state.onParse=()=>{const changed=structuredClone(payload);changed.document.blocks[0].inlines[0].text+='不同内容';return changed;};
  await f.folder.tick();assert.equal(f.created.length,0);
  assert.equal(f.db.prepare('SELECT error FROM material_folder_ai_units').get().error,'word_plan_changed');
  assert.equal(f.db.prepare('SELECT COUNT(*) n FROM material_word_documents WHERE parser=?').get(WORD_LEGACY_PARSER).n,2);
  await f.folder.action({schemaVersion:schema,batchId:f.id,action:'pause'});await f.folder.action({schemaVersion:schema,batchId:f.id,action:'resume'});
  assert.equal(f.db.prepare('SELECT error FROM material_folder_ai_resources WHERE resource_id=?').get(f.resources[0]).error,'word_plan_changed');
 }finally{f.close();}
});
console.log(JSON.stringify({passed:checks.length,checks,scope:'Production Word/Folder repositories, real SQLite/OOXML and managed PNGs, controlled AI scheduler receipts. No model quality or real UI claim.'}));
