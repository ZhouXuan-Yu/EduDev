import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
import {randomUUID} from 'node:crypto';
import {fileURLToPath,pathToFileURL} from 'node:url';

const desktop='D:/WorkProject/EduProject-harness/apps/desktop';
await import(pathToFileURL(desktop+'/scripts/office-agent/register-source.mjs'));
const {createProviderSnapshotStore}=await import(pathToFileURL(desktop+'/src/main/xiaozhi-agent/capabilities/provider-snapshots.ts'));
const {protocolHash}=await import(pathToFileURL(desktop+'/src/main/xiaozhi-agent/capabilities/validation.ts'));
const root=path.join(path.dirname(fileURLToPath(import.meta.url)),'snapshot-readback-owned');
fs.mkdirSync(root,{recursive:true});
const external=JSON.parse(fs.readFileSync(process.argv[2],'utf8')).externalRoot;
const original=new DatabaseSync(path.join(external,'data/app.db'),{readOnly:true});
const clone=path.join(root,'cloned-app.db');
original.exec("VACUUM INTO '"+clone.replaceAll("'","''")+"'");original.close();
const db=new DatabaseSync(clone);
const sql={all:async(query,values=[])=>db.prepare(query).all(...values),run:async(query,values=[])=>{db.prepare(query).run(...values);}};
const store=createProviderSnapshotStore(sql);
const row=db.prepare('SELECT * FROM xiaozhi_capability_snapshots_v1 ORDER BY rowid LIMIT 1').get();
assert(row);const pristine=JSON.parse(row.snapshot_json);
const initial=await store.history(row.task_id);assert(initial.length>0);
const mutations={
  snapshotId:'xicap_'+randomUUID(),
  taskId:'xitask_'+'f'.repeat(64),
  sessionId:'aisession_'+randomUUID(),
  runId:pristine.runId+'_foreign',
  generation:pristine.generation+1,
  capabilityId:'edu.fixture.foreign.stat',
  createdAt:'2020-01-01T00:00:00.000Z'
};
const checks=[];
try{
  for(const [field,value] of Object.entries(mutations)){
    const changed={...structuredClone(pristine),[field]:value};
    if(field==='capabilityId')changed.requirement.capabilityId=value;
    db.prepare('UPDATE xiaozhi_capability_snapshots_v1 SET snapshot_json=?,snapshot_hash=? WHERE snapshot_id=?').run(JSON.stringify(changed),protocolHash(changed),row.snapshot_id);
    await assert.rejects(store.history(row.task_id),/snapshot_corrupt/);
    db.prepare('UPDATE xiaozhi_capability_snapshots_v1 SET snapshot_json=?,snapshot_hash=? WHERE snapshot_id=?').run(row.snapshot_json,row.snapshot_hash,row.snapshot_id);
    checks.push('Matching JSON hash cannot hide misplaced '+field);
  }
  assert.deepEqual(await store.history(row.task_id),initial);
  checks.push('Restored real production Snapshot history is unchanged');
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify({success:true,checks,sourceDatabase:path.join(external,'data/app.db'),clone,scope:'Independent mutations only in SQLite VACUUM copy of completed real Electron fixture. Original DB opened read-only.'},null,2));
  console.log(JSON.stringify({success:true,passed:checks.length,output:root}));
}finally{db.close();}
