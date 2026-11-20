import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {MaterialStructureRecovery} from '../../src/main/assets/material-structure-recovery.ts';
import {MaterialStructureRepository} from '../../src/main/assets/material-structure-repository.ts';
import {MaterialParseQueue} from '../../src/main/assets/material-parse-queue.ts';
import {MATERIAL_IMPORT_SCHEMA,validBatchAction} from '../../src/shared/material-import-batch.ts';
import {DOCUMENT_STRUCTURE_ENGINE} from '../../src/shared/material-document-structure.ts';

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
for(const action of ['structure_start','structure_pause','structure_resume','structure_retry','structure_upgrade']){
 const input={schemaVersion:MATERIAL_IMPORT_SCHEMA,batchId:'batch_'+randomUUID(),action};
 assert(validBatchAction(input));
 assert(!validBatchAction({...input,relativePath:'x.pdf'}));
}
checks++;
// Exercise the additive migration against the pre-upgrade table, including a persisted intent.
const oldDb=new DatabaseSync(':memory:');
oldDb.exec(`CREATE TABLE material_import_batches(id TEXT PRIMARY KEY);
 CREATE TABLE material_structure_recovery_batches(batch_id TEXT PRIMARY KEY,enabled INTEGER NOT NULL);
 CREATE TABLE material_structure_recovery_items(batch_id TEXT NOT NULL,resource_id TEXT NOT NULL,version TEXT NOT NULL,
   state TEXT NOT NULL,generation TEXT NOT NULL DEFAULT '',error TEXT NOT NULL DEFAULT '',PRIMARY KEY(batch_id,resource_id));
 INSERT INTO material_structure_recovery_batches VALUES('old-batch',0);
 INSERT INTO material_structure_recovery_items VALUES('old-batch','old-resource','old-version','pending','old-generation','');`);
const oldRecovery=new MaterialStructureRecovery({...host,
 all:async(sql,params=[])=>oldDb.prepare(sql).all(...params),
 run:async(sql,params=[])=>{oldDb.prepare(sql).run(...params);}});
await oldRecovery.migrate();await oldRecovery.migrate();
assert.equal(oldDb.prepare('SELECT upgrade_legacy FROM material_structure_recovery_items').get().upgrade_legacy,0);
assert.equal(oldDb.prepare('SELECT enabled FROM material_structure_recovery_batches').get().enabled,0);
const upgradeColumn=oldDb.prepare('PRAGMA table_info(material_structure_recovery_items)').all().find(row=>row.name==='upgrade_legacy');
assert.equal(upgradeColumn.notnull,1);assert.equal(String(upgradeColumn.dflt_value),'0');
oldDb.close();checks++;
await structures.migrate();await recovery.migrate();await recovery.migrate();
const a=await addBatch(),b=await addBatch(),pdf=await addItem(a,'old.PDF'),word=await addItem(a,'old.DOCX'),png=await addItem(a,'old.png');
await addItem(a,'old.txt');await addItem(a,'external-not-yet-archived.pdf','pending');await link(a,pdf);await link(b,pdf);
assert.deepEqual(await recovery.coverage(a),{available:3,upgradeable:0});
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

const seedStructure=async(id,engine,status='complete',sourceVersion=version)=>{
 const generation=randomUUID();
 await run(`INSERT INTO material_structure_jobs(resource_id,version,engine,generation,status,pages,processed,paragraphs,questions,held,updated_at)
   VALUES(?,?,?,?,?,1,1,1,1,0,'fixture')`,[id,sourceVersion,engine,generation,status]);
 return generation;
};
const legacyEngine=n=>`layout-paragraph-question.v${n}`;
const selection=await addBatch();
for(let n=1;n<=14;n++){
 const id=await addItem(selection,`legacy-${n}.pdf`);
 await seedStructure(id,legacyEngine(n),n===14?'partial':'complete');
}
for(const engine of [DOCUMENT_STRUCTURE_ENGINE,'unknown-engine',legacyEngine(0),legacyEngine(16),'layout-paragraph-question.v14-extra']){
 await seedStructure(await addItem(selection,'excluded.pdf'),engine);
}
await seedStructure(await addItem(selection,'failed.pdf'),legacyEngine(14),'failed');
await seedStructure(await addItem(selection,'wrong-version.pdf'),legacyEngine(14),'complete',sha('previous-original'));
await seedStructure(await addItem(selection,'unarchived.pdf','pending'),legacyEngine(14));
await seedStructure(await addItem(selection,'unsupported.txt'),legacyEngine(14));
await addItem(selection,'no-structure.pdf');
assert.deepEqual(await recovery.coverage(selection),{available:22,upgradeable:14});
assert.equal(await recovery.view(selection),undefined);
checks++;

// Reuse completed directory intents; upgrading must retain immutable old derivatives and teacher facts.
await settle(shared,'complete');await recovery.tick();
const upgradeBatch=await addBatch(),otherBatch=await addBatch();
const upgradePdf=await addItem(upgradeBatch,'published-v1.pdf'),upgradeWord=await addItem(upgradeBatch,'published-v14.docx');
const oldPdf=await seedStructure(upgradePdf,legacyEngine(1));
const oldWord=await seedStructure(upgradeWord,legacyEngine(14),'partial');
await link(upgradeBatch,upgradePdf);await link(otherBatch,upgradePdf);
await run('INSERT INTO material_structure_pages VALUES(?,1,?,?,?)',[oldPdf,'{"original":"page"}','{"original":"image"}',sha('original-page')]);
await run('INSERT INTO material_structure_questions VALUES(?,?,1,1,?,?,?,?)',
 [oldPdf,'old-candidate','held','{"original":"question"}','{"original":"document"}',sha('original-question')]);
await run('INSERT INTO material_structure_reviews VALUES(?,?,?,?,?,?,?)',
 ['teacher-review',upgradePdf,version,'old-candidate','teacher-question','{"teacher":"confirmed"}',sha('teacher-confirmation')]);
const snapshots=await Promise.all(['material_structure_pages','material_structure_questions','material_structure_reviews','protected_teacher_facts','teacher_resources']
 .map(table=>all(`SELECT * FROM ${table} ORDER BY rowid`)));
await resume(upgradeBatch,'structure_start');await recovery.tick();
assert.equal((await recovery.view(upgradeBatch)).state,'attention');
const taskCount=(await all('SELECT COUNT(*) n FROM ai_tasks'))[0].n;
await resume(upgradeBatch,'structure_upgrade');await resume(upgradeBatch,'structure_pause');
await resume(upgradeBatch,'structure_upgrade');
assert.deepEqual(await recovery.view(upgradeBatch),{state:'paused',total:2,pending:2,running:0,complete:0,partial:0,failed:0});
assert.equal((await all('SELECT COUNT(*) n FROM material_structure_recovery_items WHERE batch_id=? AND upgrade_legacy=1',[upgradeBatch]))[0].n,2);
assert.equal((await job(upgradePdf)).generation,oldPdf);assert.equal((await job(upgradeWord)).generation,oldWord);
checks++;

await resume(otherBatch,'structure_upgrade');await recovery.tick();
const upgradedPdf=(await job(upgradePdf)).generation;
assert.notEqual(upgradedPdf,oldPdf);assert.equal((await job(upgradePdf)).engine,DOCUMENT_STRUCTURE_ENGINE);
assert.equal((await job(upgradeWord)).generation,oldWord);
await resume(upgradeBatch,'structure_resume');await recovery.tick();
const upgradedWord=(await job(upgradeWord)).generation;
assert.notEqual(upgradedWord,oldWord);
assert.equal((await all('SELECT generation FROM material_structure_recovery_items WHERE resource_id=?',[upgradePdf]))
 .filter(row=>row.generation===upgradedPdf).length,2);
assert.equal((await all('SELECT COUNT(*) n FROM ai_tasks'))[0].n,taskCount+2);
await resume(upgradeBatch,'structure_upgrade');await resume(otherBatch,'structure_upgrade');await recovery.tick();
assert.equal((await job(upgradePdf)).generation,upgradedPdf);assert.equal((await job(upgradeWord)).generation,upgradedWord);
assert.equal((await all('SELECT COUNT(*) n FROM ai_tasks'))[0].n,taskCount+2);
checks++;

await settle(upgradePdf,'complete');await settle(upgradeWord,'failed','failed');await recovery.tick();
assert.deepEqual(await recovery.view(upgradeBatch),{state:'attention',total:2,pending:0,running:0,complete:1,partial:0,failed:1});
assert.equal((await recovery.view(otherBatch)).state,'complete');
await resume(upgradeBatch,'structure_retry');
recovery=new MaterialStructureRecovery(host);await recovery.tick();
assert.equal((await job(upgradeWord)).generation,upgradedWord);
assert.equal(await queue.state(upgradeWord,version),'pending');
await settle(upgradeWord,'complete');await recovery.tick();
assert.equal((await recovery.view(upgradeBatch)).state,'complete');
assert.deepEqual(await recovery.coverage(upgradeBatch),{available:2,upgradeable:0});
await resume(upgradeBatch,'structure_upgrade');await recovery.tick();
assert.equal((await job(upgradePdf)).generation,upgradedPdf);assert.equal((await job(upgradeWord)).generation,upgradedWord);
assert.equal((await all('SELECT COUNT(*) n FROM ai_tasks'))[0].n,taskCount+2);
assert.deepEqual(await Promise.all(['material_structure_pages','material_structure_questions','material_structure_reviews','protected_teacher_facts','teacher_resources']
 .map(table=>all(`SELECT * FROM ${table} ORDER BY rowid`))),snapshots);
checks++;

const raceBatch=await addBatch(),raceResource=await addItem(raceBatch,'changed-after-upgrade.pdf');
const raceGeneration=await seedStructure(raceResource,legacyEngine(14));
await resume(raceBatch,'structure_upgrade');
await run('UPDATE teacher_resources SET content_hash=? WHERE id=?',[sha('changed-after-registration'),raceResource]);
await recovery.tick();
assert.equal((await recovery.view(raceBatch)).failed,1);
assert.equal((await job(raceResource)).generation,raceGeneration);
assert.equal((await all('SELECT error FROM material_structure_recovery_items WHERE batch_id=?',[raceBatch]))[0].error,'source_changed');
assert.equal((await all('SELECT COUNT(*) n FROM ai_tasks'))[0].n,taskCount+2);
checks++;

await resume(selection,'structure_upgrade');
const selected=await all(`SELECT j.engine FROM material_structure_recovery_items s
 JOIN material_structure_jobs j ON j.resource_id=s.resource_id WHERE s.batch_id=?`,[selection]);
assert.deepEqual(selected.map(row=>row.engine).sort(),Array.from({length:14},(_,n)=>legacyEngine(n+1)).sort());
assert.equal((await recovery.view(selection)).pending,14);
assert.deepEqual(await recovery.coverage(selection),{available:22,upgradeable:0});
const emptyBatch=await addBatch();await resume(emptyBatch,'structure_upgrade');
assert.deepEqual(await recovery.coverage(emptyBatch),{available:0,upgradeable:0});
assert.equal(await recovery.view(emptyBatch),undefined);
assert.equal((await all('SELECT COUNT(*) n FROM ai_tasks'))[0].n,taskCount+2);
checks++;
db.close();
console.log(JSON.stringify({ok:true,checks}));
