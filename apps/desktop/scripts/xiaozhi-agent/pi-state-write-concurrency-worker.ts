import fs from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
import sqlite3 from 'sqlite3';
import {OmniEduStore} from '../../src/main/db';

const output=process.argv[2],store=new OmniEduStore(path.join(output,'data'));
const report:{success:boolean;checks:{name:string;pass:boolean}[];elapsedMs?:number;lockRetryElapsedMs?:number;error?:string}={success:false,checks:[]};
const check=(name:string)=>report.checks.push({name,pass:true});
function openBlockingWriter(file:string){const database=new sqlite3.Database(file);return new Promise<sqlite3.Database>((resolve,reject)=>{database.once('open',()=>resolve(database));database.once('error',reject);});}
function execWriter(database:sqlite3.Database,sql:string){return new Promise<void>((resolve,reject)=>database.exec(sql,error=>error?reject(error):resolve()));}
function closeWriter(database:sqlite3.Database){return new Promise<void>((resolve,reject)=>database.close(error=>error?reject(error):resolve()));}
try{
 await store.init();const sql=store.xiaozhiState.sql,start=performance.now();
 // Exercise the production sqlite3 connections/libuv pool, not an in-memory SQL
 // mock. The queued ordinary writes must not compete with eight transactions.
 const jobs:Array<Promise<unknown>>=Array.from({length:8},(_,n)=>sql.transaction!(async work=>{
  await work.run('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',['owned_concurrency_'+n,JSON.stringify({n}),new Date().toISOString()]);
  await fs.writeFile(path.join(output,'owned-'+n+'.txt'),'synthetic');
  assert.equal((await work.all("SELECT COUNT(*) n FROM app_settings WHERE key LIKE 'owned_usage_%'"))[0].n,0);
 }));
 jobs.push(...Array.from({length:8},(_,n)=>sql.run('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',['owned_usage_'+n,JSON.stringify({n}),new Date().toISOString()])));
 const results=await Promise.allSettled(jobs);report.elapsedMs=Math.round(performance.now()-start);
 assert(results.every(r=>r.status==='fulfilled'));
 assert.equal((await sql.all("SELECT COUNT(*) n FROM app_settings WHERE key LIKE 'owned_concurrency_%' OR key LIKE 'owned_usage_%'"))[0].n,16);
 check('Sixteen concurrent production writes commit without lock errors, partial transaction interleaving or lost rows');
 await assert.rejects(sql.transaction!(async work=>{await work.run('INSERT INTO app_settings VALUES(?,?,?)',['owned_rollback','{}',new Date().toISOString()]);throw Error('owned rollback');}),/owned rollback/);
 assert.equal((await sql.all("SELECT COUNT(*) n FROM app_settings WHERE key='owned_rollback'"))[0].n,0);
 await sql.run('INSERT INTO app_settings VALUES(?,?,?)',['owned_after_failure','{}',new Date().toISOString()]);
 check('Transaction failure rolls back and releases the writer for the next ordinary state write');
 await assert.rejects(sql.run('INSERT INTO app_settings VALUES(?,?,?)',['owned_after_failure','{}',new Date().toISOString()]));
 await sql.transaction!(async work=>assert.equal(await work.change!('UPDATE app_settings SET value_json=? WHERE key=? AND value_json=?',['{"v":1}','owned_after_failure','{}']),1));
 check('Ordinary write failure does not poison a later transaction or its same-connection CAS');
 const blocker=await openBlockingWriter(path.join(output,'data','app.db'));
 try{
  await execWriter(blocker,'PRAGMA busy_timeout=0; BEGIN IMMEDIATE;');
  const retryStarted=performance.now();
  const retrying:Array<Promise<unknown>>=Array.from({length:2},(_,n)=>sql.transaction!(async work=>{
   await work.run('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',['owned_lock_retry_'+n,JSON.stringify({n}),new Date().toISOString()]);
   await fs.writeFile(path.join(output,'owned-lock-'+n+'.txt'),'synthetic');
  }));
  await new Promise(resolve=>setTimeout(resolve,6000));
  await execWriter(blocker,'COMMIT;');
  const retried=await Promise.allSettled(retrying);const retryElapsed=Math.round(performance.now()-retryStarted);
  assert(retried.every(result=>result.status==='fulfilled'));
  assert(retryElapsed>=5500&&retryElapsed<12000,`lock retry elapsed ${retryElapsed}ms`);
  assert.equal((await sql.all("SELECT COUNT(*) n FROM app_settings WHERE key LIKE 'owned_lock_retry_%'"))[0].n,2);
  report.lockRetryElapsedMs=retryElapsed;
  check('A real six-second SQLite writer releases two queued production state transactions without blocking workers into timeout or losing rows');
 }finally{await closeWriter(blocker);}
 await store.close();const cold=new OmniEduStore(path.join(output,'data'));
 try{
  await cold.init();
  assert.equal((await cold.xiaozhiState.sql.all("SELECT value_json FROM app_settings WHERE key='owned_after_failure'"))[0].value_json,'{"v":1}');
  assert.equal((await cold.xiaozhiState.sql.all("SELECT COUNT(*) n FROM app_settings WHERE key LIKE 'owned_lock_retry_%'"))[0].n,2);
  check('Cold production Store preserves the exact final committed version and both lock-recovery rows');
 }finally{await cold.close();}
 report.success=true;
}catch{report.error='state_write_acceptance_failed';}
finally{await store.close();await fs.writeFile(path.join(output,'report.json'),JSON.stringify(report,null,2));}
