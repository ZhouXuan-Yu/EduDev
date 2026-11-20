import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {MaterialStructureRecovery} from '../../src/main/assets/material-structure-recovery.ts';
import {MaterialStructureRepository} from '../../src/main/assets/material-structure-repository.ts';
import {MaterialParseQueue} from '../../src/main/assets/material-parse-queue.ts';
import {MATERIAL_IMPORT_SCHEMA,validBatchAction} from '../../src/shared/material-import-batch.ts';

const db=new DatabaseSync(':memory:');
db.exec(`CREATE TABLE material_import_batches(id TEXT PRIMARY KEY);
 CREATE TABLE material_import_entries(batch_id TEXT,resource_id TEXT,kind TEXT,status TEXT);
 CREATE TABLE teacher_resources(id TEXT PRIMARY KEY,content_hash TEXT,original_file_name TEXT);
 CREATE TABLE ai_tasks(id TEXT PRIMARY KEY,task_type TEXT,input_hash TEXT,status TEXT,payload_json TEXT,
   error_message TEXT DEFAULT '',result_json TEXT,retry_count INT DEFAULT 0,created_at TEXT DEFAULT '',updated_at TEXT DEFAULT '');
 CREATE TABLE protected_teacher_facts(id TEXT PRIMARY KEY,payload TEXT);
 INSERT INTO protected_teacher_facts VALUES('review','retained');`);
const sha=value=>createHash('sha256').update(value).digest('hex');
const all=async(sql,params=[])=>db.prepare(sql).all(...params);
const run=async(sql,params=[])=>{db.prepare(sql).run(...params);};
const version=sha('owned-version');
const resource=async id=>{
 const [row]=await all('SELECT * FROM teacher_resources WHERE id=?',[id]);
 if(!row)throw Error('material_not_found');
 return {id,contentHash:row.content_hash,originalFileName:row.original_file_name,chunkCount:4,parseStatus:'ready',parseEngine:'legacy'};
};
const transaction=target=>async action=>{
 db.exec('BEGIN IMMEDIATE');
 try{const result=await action(target());db.exec('COMMIT');return result;}
 catch(error){db.exec('ROLLBACK');throw error;}
};
const structures=new MaterialStructureRepository({all,run,resource,writer:transaction(()=>structures)});
const queue=new MaterialParseQueue({all,resource,structureRequired:id=>structures.required(id),
 change:async(sql,params)=>Number(db.prepare(sql).run(...params).changes),
 ensureTask:async r=>run("INSERT INTO ai_tasks (id,task_type,input_hash,status,payload_json) VALUES (?,'resource_parse',?,'pending','{}')",['task_'+randomUUID(),sha(r.id)])});
const host={structures:()=>structures,queue:()=>queue,all,run,writer:transaction(()=>recovery)};
let recovery=new MaterialStructureRecovery(host);
const addBatch=async()=>{const id='batch_'+randomUUID();await run('INSERT INTO material_import_batches VALUES(?)',[id]);return id;};
const addItem=async(batch,name,status='saved')=>{
 const id='resource_'+randomUUID();
 await run('INSERT INTO teacher_resources VALUES(?,?,?)',[id,version,name]);
 await link(batch,id,status);
 return id;
};
const link=(b,r,status='saved')=>run("INSERT INTO material_import_entries VALUES(?,?,'file',?)",[b,r,status]);
const job=async id=>(await all('SELECT * FROM material_structure_jobs WHERE resource_id=?',[id]))[0];
const resume=(batch,action)=>recovery.action(batch,action);
const settle=async(id,structureStatus,taskStatus='succeeded')=>{
 await run("UPDATE material_structure_jobs SET status=?,error=? WHERE resource_id=?",[structureStatus,structureStatus==='failed'?'configuration':'',id]);
 await run('UPDATE ai_tasks SET status=? WHERE input_hash=?',[taskStatus,sha(id)]);
};
let checks=0;
for(const action of ['structure_start','structure_pause','structure_resume','structure_retry']){
 const input={schemaVersion:MATERIAL_IMPORT_SCHEMA,batchId:'batch_'+randomUUID(),action};
 assert(validBatchAction(input));
 assert(!validBatchAction({...input,relativePath:'x.pdf'}));
}
checks++;
await structures.migrate();await recovery.migrate();await recovery.migrate();
const a=await addBatch(),b=await addBatch(),pdf=await addItem(a,'old.PDF'),word=await addItem(a,'old.DOCX'),png=await addItem(a,'old.png');
await addItem(a,'old.txt');await addItem(a,'external-not-yet-archived.pdf','pending');await link(a,pdf);await link(b,pdf);
assert.equal(await recovery.available(a),3);
await resume(a,'structure_start');await resume(b,'structure_start');
assert.equal((await recovery.view(a)).total,3);assert.equal((await recovery.view(b)).total,1);
assert.equal(await job(pdf),undefined);
checks++;

const enqueue=queue.enqueue.bind(queue);
queue.enqueue=async()=>{throw Error('busy');};
await recovery.tick();
assert.equal((await all('SELECT * FROM ai_tasks')).length,0);
assert.equal(await job(pdf),undefined);
assert.equal((await recovery.view(a)).pending,3);
queue.enqueue=enqueue;
recovery=new MaterialStructureRecovery(host);
await recovery.tick();
assert.equal((await all('SELECT * FROM ai_tasks')).length,3);
const frozen=(await job(pdf)).generation;
assert.equal((await all('SELECT generation FROM material_structure_recovery_items WHERE resource_id=?',[pdf])).filter(row=>row.generation===frozen).length,2);
await resume(a,'structure_start');await recovery.tick();
assert.equal((await job(pdf)).generation,frozen);
checks++;

const late=await addItem(a,'late.webp');
await resume(a,'structure_pause');await resume(a,'structure_start');
await settle(pdf,'complete');
await settle(word,'partial');
await settle(png,'failed','failed');
await recovery.tick();
assert.equal(await job(late),undefined);
assert.deepEqual(await recovery.view(a),{state:'paused',total:4,pending:1,running:0,complete:1,partial:1,failed:1});
assert.deepEqual(await recovery.view(b),{state:'complete',total:1,pending:0,running:0,complete:1,partial:0,failed:0});
checks++;

const failedGeneration=(await job(png)).generation;
const recoveredWord=(await job(word)).generation;
await resume(a,'structure_retry');await recovery.tick();
assert.equal((await job(png)).generation,failedGeneration);
assert.equal((await job(word)).generation,recoveredWord);
assert(await job(late));
await settle(png,'complete');await settle(late,'complete');
await recovery.tick();
assert.deepEqual(await recovery.view(a),{state:'attention',total:4,pending:0,running:0,complete:3,partial:1,failed:0});
checks++;

const c=await addBatch(),changed=await addItem(c,'will-change.pdf'),shared=await addItem(c,'historical-gap.docx');
await resume(c,'structure_start');
await run('UPDATE teacher_resources SET content_hash=? WHERE id=?',[sha('changed'),changed]);
await run("UPDATE ai_tasks SET status='succeeded' WHERE input_hash=?",[sha(pdf)]);
await structures.request({resourceId:shared,version,page:1});
const stored=(await job(shared)).generation;
await recovery.tick();
assert.equal(await job(changed),undefined);
assert.equal(await queue.state(shared,version),'pending');
assert.equal((await job(shared)).generation,stored);
assert.equal((await recovery.view(c)).failed,1);
checks++;

assert.deepEqual((await all('SELECT payload FROM protected_teacher_facts')).map(r=>r.payload),['retained']);
assert.equal((await job(pdf)).generation,frozen);
assert.equal((await all('SELECT COUNT(*) n FROM ai_tasks'))[0].n,5);
checks++;
db.close();
console.log(JSON.stringify({ok:true,checks}));
