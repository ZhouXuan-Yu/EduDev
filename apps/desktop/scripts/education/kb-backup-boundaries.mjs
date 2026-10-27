import '../office-agent/register-source.mjs';
import fs from 'node:fs/promises';import path from 'node:path';import {tmpdir} from 'node:os';import assert from 'node:assert/strict';import sqlite3 from 'sqlite3';import {DatabaseSync} from 'node:sqlite';
const {copyDataBackupFiles,collectDataBackupEntries,snapshotDataBackupSqlite}=await import('../../src/main/backup/data-root-files.ts');
const {acquireWriterLock}=await import('../../src/main/retrieval/writer-lock.ts');
const root=await fs.mkdtemp(path.join(tmpdir(),'omni-edu-backup-merge-')),source=path.join(root,'source'),backup=path.join(root,'backup');
await fs.mkdir(path.join(source,'cache/semantic-v1'),{recursive:true});await fs.mkdir(path.join(source,'originals'));await fs.mkdir(path.join(source,'cache/other'));await fs.mkdir(backup);
await fs.writeFile(path.join(source,'originals/teacher.txt'),'原始资料与教师确认事实必须保留。');await fs.writeFile(path.join(source,'cache/other/retained.txt'),'other cache retained');
const db=await new Promise((resolve,reject)=>{const db=new sqlite3.Database(path.join(source,'app.db'),error=>error?reject(error):resolve(db));});
const exec=sql=>new Promise((resolve,reject)=>db.exec(sql,error=>error?reject(error):resolve()));
let lock,proofLock;const checks=[];const note=s=>{checks.push(s);console.log('PASS '+s);};
try{
 await exec("PRAGMA journal_mode=WAL; CREATE TABLE teacher_fact(id INTEGER PRIMARY KEY,note TEXT); INSERT INTO teacher_fact VALUES(1,'教师确认的题目');");
 await exec("CREATE TABLE retrieval_control(id INTEGER PRIMARY KEY,active TEXT,building TEXT,paused INTEGER,error TEXT); INSERT INTO retrieval_control VALUES(1,'live_generation','',0,''); CREATE TABLE retrieval_generations(id TEXT); INSERT INTO retrieval_generations VALUES('live_generation'); CREATE TABLE retrieval_current(seq INTEGER); INSERT INTO retrieval_current VALUES(47);");
 lock=await acquireWriterLock(path.join(source,'cache/semantic-v1'));
 await fs.mkdir(path.join(source,'cache/word-question-pages/v1'),{recursive:true});
 await fs.writeFile(path.join(source,'cache/word-question-pages/v1','a'.repeat(64)+'.png'),'derived');
 await fs.mkdir(path.join(source,'word-assets'));await fs.writeFile(path.join(source,'word-assets/source.png'),'source retained');
 await exec("CREATE TABLE material_word_proofs(cache_key TEXT); INSERT INTO material_word_proofs VALUES('proof'); CREATE TABLE material_word_proof_files(proof_id TEXT); INSERT INTO material_word_proof_files VALUES('proof');");
 proofLock=await acquireWriterLock(path.join(source,'cache/word-question-pages/v1'));
 await snapshotDataBackupSqlite(db,path.join(backup,'app.db'));await exec("INSERT INTO teacher_fact VALUES(2,'快照后的新事实');");
 const count=await copyDataBackupFiles(source,backup);assert.equal(count,3);assert.equal(await fs.readFile(path.join(backup,'originals/teacher.txt'),'utf8'),'原始资料与教师确认事实必须保留。');
 await assert.rejects(fs.stat(path.join(backup,'cache/word-question-pages')),e=>e.code==='ENOENT');
 assert.equal(await fs.readFile(path.join(backup,'word-assets/source.png'),'utf8'),'source retained');
 const proofSnapshot=new DatabaseSync(path.join(backup,'app.db'),{readOnly:true});try{for(const table of ['material_word_proofs','material_word_proof_files'])assert.equal(proofSnapshot.prepare('SELECT COUNT(*) n FROM '+table).get().n,0);}finally{proofSnapshot.close();}
 const live=await new Promise((resolve,reject)=>db.get('SELECT COUNT(*) n FROM material_word_proofs',(error,row)=>error?reject(error):resolve(row.n)));assert.equal(live,1);note('Locked disposable Word proof cache is omitted and only its exported-copy manifests are reset; source assets and live cache facts survive');
 await assert.rejects(fs.stat(path.join(backup,'cache/semantic-v1')),e=>e.code==='ENOENT');await assert.rejects(fs.stat(path.join(backup,'app.db-wal')),e=>e.code==='ENOENT');note('Online backup with a real exclusive Windows vector lock preserves originals and other files while omitting only the derived index and live SQLite logs');
 const cold=new DatabaseSync(path.join(backup,'app.db'),{readOnly:true});try{assert.equal(cold.prepare('PRAGMA integrity_check').get().integrity_check,'ok');assert.deepEqual(cold.prepare('SELECT * FROM teacher_fact').all().map(r=>r.note),['教师确认的题目']);assert.equal(cold.prepare('SELECT active FROM retrieval_control').get().active,'');assert.equal(cold.prepare('SELECT COUNT(*) n FROM retrieval_generations').get().n,0);assert.equal(cold.prepare('SELECT seq FROM retrieval_current').get().seq,47);}finally{cold.close();}note('Cold SQLite snapshot is integral, preserves committed WAL facts and source clocks, and resets only omitted vector-cache completion claims');
 const entries=await collectDataBackupEntries(backup);assert.equal(entries.length,4);assert(entries.every(e=>/^[a-f0-9]{64}$/.test(e.sha256)));await fs.appendFile(path.join(backup,'originals/teacher.txt'),'changed');const after=await collectDataBackupEntries(backup);assert.notEqual(entries.find(e=>e.path==='originals/teacher.txt').sha256,after.find(e=>e.path==='originals/teacher.txt').sha256);note('Bounded streaming manifest includes the database and detects changed original bytes');
}finally{await proofLock?.close();await lock?.close();await new Promise((resolve,reject)=>db.close(error=>error?reject(error):resolve()));}
const report={root,checks,passed:checks.length,scope:'Actual sqlite3 online backup, cold SQLite, filesystem and Windows exclusive lock; bounded synthetic data, no full-library backup duration claim'};await fs.writeFile('test-results/goal/kb-main-backup-boundaries.json',JSON.stringify(report,null,2));console.log(JSON.stringify(report));
