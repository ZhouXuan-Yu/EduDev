import '../office-agent/register-source.mjs';
import {DatabaseSync} from 'node:sqlite';
import assert from 'node:assert/strict';
const {migrateBookAnswerConflicts}=await import('../../src/main/assets/material-book-answer-conflict.ts');
const db=new DatabaseSync(':memory:');
try{
 db.exec(`CREATE TABLE material_book_answer_journal_v1(batch_id TEXT,ordinal INTEGER,question_id TEXT,payload_json TEXT,after_json TEXT);
 CREATE INDEX material_book_answer_journal_question_v1 ON material_book_answer_journal_v1(batch_id,ordinal,question_id);
 CREATE TABLE material_book_answer_work_v1(batch_id TEXT,ordinal INTEGER,revision INTEGER,error TEXT,PRIMARY KEY(batch_id,ordinal));
 CREATE TABLE material_ai_batches(id TEXT PRIMARY KEY,resource_id TEXT,version TEXT);
 CREATE TABLE material_book_pairs(question_id TEXT PRIMARY KEY,question_version TEXT,revision INTEGER,active INTEGER);
 CREATE TABLE question_bank_items(id TEXT PRIMARY KEY,archive_json TEXT);
 INSERT INTO material_ai_batches VALUES('batch','book','v');INSERT INTO material_book_pairs VALUES('book','v',1,1);`);
 const insert=db.prepare('INSERT INTO material_book_answer_journal_v1 VALUES(?,?,?,?,?)'),question=db.prepare('INSERT INTO question_bank_items VALUES(?,?)');
 db.exec('BEGIN');for(let i=0;i<100000;i++)insert.run('batch',1,'other-'+i,'{"reason":"answer_not_found"}','');
 for(let i=0;i<100;i++){insert.run('batch',i+1,'conflict-'+i,'{"reason":"existing_answer_conflict"}','');question.run('conflict-'+i,'{"issues":[]}');}db.exec('COMMIT');
 const host={run:async(s,p=[])=>{db.prepare(s).run(...p);}},start=performance.now();await migrateBookAnswerConflicts(host);const firstMs=performance.now()-start;assert.equal(db.prepare('SELECT COUNT(*) n FROM material_book_answer_work_v1').get().n,100);
 const samples=[];for(let i=0;i<50;i++){const at=performance.now();await migrateBookAnswerConflicts(host);samples.push(performance.now()-at);}samples.sort((a,b)=>a-b);
 const plan=db.prepare(`EXPLAIN QUERY PLAN SELECT j.rowid FROM material_book_answer_journal_v1 j WHERE CASE WHEN json_valid(j.payload_json) THEN json_extract(j.payload_json,'$.reason')='existing_answer_conflict' ELSE 0 END AND j.after_json=''`).all().map(r=>r.detail);assert(plan.some(s=>s.includes('material_book_answer_journal_conflicts_v1')));
 console.log(JSON.stringify({success:true,observations:100100,conflicts:100,firstMigrationIncludingIndexesMs:firstMs,repeatedStartup:{iterations:50,medianMs:samples[25],p95Ms:samples[47]},plan,scope:'Warm in-memory synthetic journal metadata and exact production migration SQL only. No old implementation existed for this safety backfill; not source validation, file I/O, retrieval latency, 40GiB or cold Windows startup acceptance.'}));
}finally{db.close();}
