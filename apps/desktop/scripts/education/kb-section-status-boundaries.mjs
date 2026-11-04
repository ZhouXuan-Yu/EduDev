import assert from 'node:assert/strict';
import {randomUUID,createHash} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {fixture2,add,index} from './kb-answer-section-boundaries.mjs';
import {bookAnswerPage,bookAnswerSectionReviewResolved} from '../../src/main/assets/material-book-answer-content.ts';
import {MaterialFolderAiRepository} from '../../src/main/assets/material-folder-ai.ts';
const sha=x=>createHash('sha256').update(x).digest('hex');
let checks=0;async function check(name,fn){await fn();checks++;console.log('PASS '+name);}
async function fixture(fn){const f=fixture2();try{
 f.host.role=async id=>f.db.prepare('SELECT active FROM material_book_pairs').get().active?{...f.pair,kind:id===f.pair.answerId?'answers':'questions'}:null;
 f.proofs.get(f.answerBatch).status='review';
 f.db.exec("ALTER TABLE material_ai_units ADD COLUMN error TEXT NOT NULL DEFAULT '';ALTER TABLE material_ai_batches ADD COLUMN calls INTEGER DEFAULT 0;ALTER TABLE material_ai_batches ADD COLUMN config_json TEXT DEFAULT '{}';CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT,title TEXT);CREATE TABLE material_import_batches(id TEXT PRIMARY KEY,status TEXT);CREATE TABLE material_import_entries(seq INTEGER PRIMARY KEY,batch_id TEXT,kind TEXT,status TEXT,resource_id TEXT);CREATE TABLE material_ai_task_keys(task_key TEXT PRIMARY KEY,folder_id TEXT,batch_id TEXT);");
 f.db.prepare("UPDATE material_ai_units SET status='review',error='page_content_incomplete' WHERE batch_id=?").run(f.answerBatch);
 for(const [id,version]of [[f.pair.questionId,f.pair.questionVersion],[f.pair.answerId,f.pair.answerVersion]])f.db.prepare('INSERT INTO teacher_resources VALUES(?,?,?)').run(id,version,id);
 add(f,1);await f.repo.migrate();await index(f);
 const folderId='batch_'+randomUUID(),host={...f.host,ai:()=>({bookAnswers:f.repo}),word:()=>({})},folder=new MaterialFolderAiRepository(host);await folder.migrate();
 f.db.prepare("INSERT INTO material_import_batches VALUES(?,'completed')").run(folderId);
 f.db.prepare("INSERT INTO material_folder_ai(batch_id,status,revision,settings_revision,max_calls,cursor) VALUES(?,'attention',1,1,20,1)").run(folderId);
 f.db.prepare("INSERT INTO material_import_entries VALUES(1,?,'file','saved',?)").run(folderId,f.pair.answerId);
 f.db.prepare("UPDATE material_folder_ai_resources SET status='complete',cursor=2,total=2 WHERE batch_id=?").run(folderId);
 f.db.prepare("INSERT INTO material_folder_ai_units(batch_id,resource_id,version,unit,state,ai_batch_id,error) VALUES(?,?,?,2,'review',?,'page_content_incomplete')").run(folderId,f.pair.answerId,f.pair.answerVersion,f.answerBatch);
 await fn({...f,folder,folderId,view:()=>folder.view(folderId),proof:()=>f.proofs.get(f.answerBatch)});
}finally{f.db.close();}}
await check('Only a verified title-only review qualifies; content, omission and forced-review doubts remain',()=>fixture(async f=>{
 const p=f.proof(),derived=bookAnswerPage(p.first,p.final,'基础测试卷');assert(bookAnswerSectionReviewResolved(p.first,p.final,derived));
 for(const mode of ['answer','ocr','review','questions','blank','entry','omission','unknown']){
  const a=structuredClone(p.first),b=structuredClone(p.final),d=structuredClone(derived);
  if(mode==='answer')b.pageText=b.pageText.replace('D','A');
  if(mode==='ocr')b.pageIssues=['uncertain_ocr'];
  if(mode==='review')a.outcome=b.outcome='needs_review';
  if(mode==='questions')b.questions=[{issues:[]}];
  if(mode==='blank')a.pageText=b.pageText='';
  if(mode==='entry')d.entries[0].issues.push('missing_answer');
  if(mode==='omission')d.firstOnly.push({section:'基础测试卷',number:'9'});
  if(mode==='unknown')d.pageUncertain=true;
  assert(!bookAnswerSectionReviewResolved(a,b,d),mode);
 }
}));
await check('Folder and authenticated page resolve without changing raw review, paid receipts or canonical facts',()=>fixture(async f=>{
 const before=JSON.stringify([...f.proofs]),row=f.db.prepare('SELECT * FROM material_ai_units WHERE batch_id=?').get(f.answerBatch);
 const view=await f.view();assert.equal(view.complete,1);assert.equal(view.review,0);assert.equal(view.sectionResolved,1);assert.equal(view.status,'complete');assert.equal(view.issues.length,0);
 const page=await f.repo.pageView(f.proof(),{batchId:f.answerBatch,ordinal:1});assert(page.resolved);assert.equal(page.page.sectionSource.page,1);assert(!page.page.entries[0].issues.includes('missing_section'));
 assert.equal(JSON.stringify([...f.proofs]),before);assert.deepEqual(f.db.prepare('SELECT * FROM material_ai_units WHERE batch_id=?').get(f.answerBatch),row);
}));
await check('Dirty and unindexed pages immediately restore warnings; subsequent derived rebuilding resolves again',()=>fixture(async f=>{
 f.db.prepare('UPDATE material_ai_units SET input_json=input_json WHERE batch_id=?').run(f.answerBatch);
 assert.equal((await f.view()).review,1);assert(!(await f.repo.pageView(f.proof(),{batchId:f.answerBatch,ordinal:1})).resolved);
 await index(f);assert.equal((await f.view()).review,0);add(f,1);assert.equal((await f.view()).review,1);await index(f);assert.equal((await f.view()).review,0);
}));
await check('New invalid or deleted headers revoke cached resolution and never revive an old title',async()=>{
 for(const mode of ['invalid','deleted','different'])await fixture(async f=>{
  const id=add(f,1,mode==='different'?'第十五章 素养基础测试卷\n3. A 解析：回退的边界。':'无标题',{invalid:mode==='invalid'});
  if(mode==='deleted'){await index(f);f.db.prepare('DELETE FROM material_ai_page_units WHERE batch_id=?').run(id);f.proofs.delete(id);}
  await index(f);assert.equal((await f.view()).review,1);assert.equal((await f.view()).status,'attention');assert(!(await f.repo.pageView(f.proof(),{batchId:f.answerBatch,ordinal:1})).resolved);
 });
});
await check('Current resource versions, book unlink/revision and feature-off retain review without touching originals',async()=>{
 for(const mode of ['answer-version','question-version','unlink','revision','flag'])await fixture(async f=>{
  if(mode.endsWith('version'))f.db.prepare('UPDATE teacher_resources SET content_hash=? WHERE id=?').run(sha('changed'),mode==='answer-version'?f.pair.answerId:f.pair.questionId);
  if(mode==='unlink')f.db.exec('UPDATE material_book_pairs SET active=0');
  if(mode==='revision')f.db.exec('UPDATE material_book_pairs SET revision=revision+1');
  try{if(mode==='flag')process.env.OMNI_EDU_BOOK_ANSWER_SECTION_INHERITANCE='0';assert.equal((await f.view()).review,1);assert.equal((await f.view()).sectionResolved,0);}finally{delete process.env.OMNI_EDU_BOOK_ANSWER_SECTION_INHERITANCE;}
 });
});
await check('Paused, budget, configuration and scope statuses cannot be erased by successful title resolution',()=>fixture(async f=>{
 for(const [status,error]of [['paused',''],['budget_exhausted','budget_exhausted'],['configuration_changed','configuration_changed'],['attention','scope_changed'],['attention','disk_full']]){
  f.db.prepare('UPDATE material_folder_ai SET status=?,error=? WHERE batch_id=?').run(status,error,f.folderId);const v=await f.view();assert.equal(v.status,status);assert.equal(v.error,error);
 }
}));
await check('Unfinished discovery, resource planning and partial/failed imports cannot become complete',()=>fixture(async f=>{
 for(const mode of ['discovery','planning','partial','failed']){
  f.db.prepare("UPDATE material_folder_ai SET status='attention',cursor=? WHERE batch_id=?").run(mode==='discovery'?0:1,f.folderId);
  f.db.prepare('UPDATE material_import_batches SET status=?').run(['partial','failed'].includes(mode)?mode:'completed');
  f.db.prepare('UPDATE material_folder_ai_resources SET status=?').run(mode==='planning'?'waiting':'complete');
  assert.equal((await f.view()).status,'attention',mode);
 }
}));
await check('Real content doubts stay visible and resolved rows are excluded before the five-issue limit',()=>fixture(async f=>{
 const insert=f.db.prepare('INSERT INTO material_folder_ai_units(batch_id,resource_id,version,unit,state,error) VALUES(?,?,?,?,?,?)');
 for(let i=0;i<6;i++)insert.run(f.folderId,f.pair.answerId,f.pair.answerVersion,10+i,'review',i===5?'answer_conflict':'requires_image');
 const v=await f.view();assert.equal(v.review,6);assert.equal(v.complete,1);assert.equal(v.status,'attention');assert.equal(v.issues.length,5);assert(v.issues.every(x=>x.unit>=10));
}));
await check('Invalid selected answers clear derived state while keeping a supersession marker',()=>fixture(async f=>{
 f.proofs.delete(f.answerBatch);f.db.prepare('UPDATE material_ai_units SET input_json=input_json WHERE batch_id=?').run(f.answerBatch);await index(f);
 const marker=f.db.prepare('SELECT * FROM material_book_answer_index_v1 WHERE batch_id=? AND start=-1').get(f.answerBatch);assert.equal(marker.proof_sha,'');assert.equal(marker.review_state,'');assert.equal((await f.view()).review,1);
}));
await check('Policy-2 upgrade is incremental and idempotent, preserving receipts with no executor',()=>fixture(async f=>{
 const before=JSON.stringify([...f.proofs]);f.db.exec('ALTER TABLE material_book_answer_index_v1 DROP COLUMN review_state;UPDATE material_book_answer_control_v1 SET section_policy=2');
 await f.repo.migrate();assert(await f.repo.index.pending());await index(f);assert.equal((await f.view()).review,0);const c=f.db.prepare('SELECT * FROM material_book_answer_control_v1').get();assert.equal(c.section_policy,4);await f.repo.migrate();assert.deepEqual(f.db.prepare('SELECT * FROM material_book_answer_control_v1').get(),c);assert.equal(JSON.stringify([...f.proofs]),before);
}));
await check('AI child summary uses the same indexed resolution and returns raw review after invalidation',()=>fixture(async f=>{
 const read=()=>f.db.prepare('SELECT u.status,('+f.repo.index.aiReviewResolvedSql()+') resolved FROM material_ai_units u JOIN material_ai_batches b ON b.id=u.batch_id WHERE u.batch_id=? AND u.ordinal=1').get(f.answerBatch);
 assert.deepEqual({...read()},{status:'review',resolved:1});f.db.prepare('UPDATE material_ai_units SET input_json=input_json WHERE batch_id=?').run(f.answerBatch);assert.deepEqual({...read()},{status:'review',resolved:0});await index(f);assert.equal(read().resolved,1);
}));
await check('Folder polling remains indexed with 100000 unrelated answer entries and no receipt opens',()=>fixture(async f=>{
 const put=f.db.prepare('INSERT INTO material_book_answer_index_v1(batch_id,ordinal,start,resource_id,version,page,seq,section_key,number) VALUES(?,1,?,?,?,?,?,?,?)');
 f.db.exec('BEGIN');for(let i=0;i<100000;i++)put.run('unrelated',i,'other','v',i%5000+1,i,'s',String(i));f.db.exec('COMMIT');
 const times=[];for(let i=0;i<100;i++){const start=performance.now();assert.equal((await f.view()).review,0);times.push(performance.now()-start);}times.sort((a,b)=>a-b);
 const plan=f.db.prepare('EXPLAIN QUERY PLAN SELECT 1 FROM material_folder_ai_units u WHERE u.batch_id=? AND ('+f.repo.index.folderReviewResolvedSql()+')').all(f.folderId);
 console.log(JSON.stringify({scope:'SQLite metadata projection only, warm in-memory database; not 40GiB acceptance',entries:100000,queries:100,p95Ms:times[94],plan}));
 assert(times[94]<100,'Polling should not scan unrelated entries');
}));
console.log(JSON.stringify({success:true,checks,scope:'Strict title-only derived review resolution, real SQLite migration/freshness/status/limit and bounded polling; original AI receipts unchanged; not natural quality acceptance'}));
