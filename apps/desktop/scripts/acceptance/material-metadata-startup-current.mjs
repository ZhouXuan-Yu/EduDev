/** Read-only QA verifier for the reviewed 2026-11-06 startup migration.
 * The allowlist is frozen source, never learned from the database under test.
 */
import assert from 'node:assert/strict';
import manifest from './material-metadata-startup-20261106.json' with {type:'json'};
import {sha256} from './evidence.mjs';

const hash=v=>sha256(JSON.stringify(v));
const need=(v,code)=>{if(!v)throw Error(code);};
const order=(a,b)=>a<b?-1:a>b?1:0;
const schemaOrder=(a,b)=>order(a.type+'\0'+a.name,b.type+'\0'+b.name);
const cell=v=>v===null?['null']:typeof v==='bigint'?['integer',String(v)]:[typeof v,v];
const projection=(table,rows)=>({table,count:rows.length,sha256:hash(rows.map(row=>hash(row.map(cell))).sort())});

/** Recompute strictly from original business rows, including empty resources. */
export function readStartupDerivedCounts(db){
  const tables=new Set(db.prepare("SELECT name FROM sqlite_schema WHERE type='table'").all().map(r=>r.name));
  if(!['teacher_resources','resource_chunks','material_body_fts_v1'].every(t=>tables.has(t)))return null;
  const resources=db.prepare(`SELECT r.id AS resource_id,COUNT(c.id) AS total,
    COALESCE(SUM(c.contains_personal_data<>0),0) AS private FROM teacher_resources r
    LEFT JOIN resource_chunks c ON c.resource_id=r.id GROUP BY r.id ORDER BY r.id`).all();
  const cursor=db.prepare('SELECT COALESCE(MAX(rowid),0) AS value FROM teacher_resources').get().value;
  const indexed=db.prepare('SELECT COUNT(*) AS value FROM material_body_fts_v1').get().value;
  return {resources,cursor,indexed};
}

export function assertCurrentStartupMigration(before,after){
  need(before.logical.tables.length===manifest.beforeTables&&after.logical.tables.length===manifest.afterTables&&
    before.facts.sourceTables.length===manifest.beforeSources&&after.facts.sourceTables.length===manifest.afterSources,'MIGRATION_TABLE_COUNT');
  const expected=before.schema.map(r=>({...r}));
  for(const row of manifest.removed){
    const i=expected.findIndex(r=>r.type===row.type&&r.name===row.name);
    need(i>=0&&hash(expected[i])===hash(row),'MIGRATION_LEGACY_TRIGGER');expected.splice(i,1);
  }
  for(const change of manifest.changed){
    const i=expected.findIndex(r=>r.type===change.before.type&&r.name===change.before.name);
    need(i>=0&&hash(expected[i])===hash(change.before),'MIGRATION_LEGACY_DDL');expected[i]={...change.after};
  }
  for(const row of manifest.added){
    need(!expected.some(r=>r.type===row.type&&r.name===row.name),'MIGRATION_UNEXPECTED_DDL');expected.push({...row});
  }
  expected.sort(schemaOrder);
  need(hash(expected)===hash(after.schema)&&hash(after.schema)===after.logical.schemaSha256,'MIGRATION_UNEXPECTED_DDL');
  need(before.logical.userVersion===after.logical.userVersion&&before.logical.applicationId===after.logical.applicationId,'MIGRATION_PRAGMA_CHANGED');
  need(hash(before.control)===hash([{id:1,cursor:0}]),'MIGRATION_LEGACY_CONTROL');
  need(hash(after.control)===hash([{id:1,cursor:0,section_policy:manifest.sectionPolicy}]),'MIGRATION_CONTROL_PROJECTION');
  for(const name of ['material_book_answer_dirty_v1','material_book_answer_index_v1'])
    need(before.logical.tables.find(t=>t.table===name)?.count===0,'MIGRATION_NONEMPTY_INDEX');
  need(before.derivedCounts&&before.derivedCounts.resources.length===3,'MIGRATION_DERIVED_BASELINE_REQUIRED');
  assert.deepEqual(after.derivedCounts,before.derivedCounts,'MIGRATION_DERIVED_SOURCE_CHANGED');
  const derived=before.derivedCounts,control='material_book_answer_control_v1';
  const additions=manifest.added.filter(r=>r.type==='table').map(({name})=>{
    if(name==='material_search_count_control_v1')return projection(name,[[1n,BigInt(derived.cursor),BigInt(derived.indexed),1n]]);
    if(name==='material_search_resource_counts_v1')return projection(name,derived.resources.map(r=>[r.resource_id,BigInt(r.total),BigInt(r.private),1n]));
    return projection(name,[]); // Four new business tables MUST be empty.
  });
  const currentControl=projection(control,[[1n,0n,BigInt(manifest.sectionPolicy)]]);
  const expectedTables=[...before.logical.tables.map(t=>t.table===control?currentControl:t),...additions].sort((a,b)=>order(a.table,b.table));
  assert.deepEqual(after.logical.tables,expectedTables,'MIGRATION_UNEXPECTED_ROWS');
  const expectedSources=[...before.facts.sourceTables.map(t=>t.table===control?currentControl:t),...additions].sort((a,b)=>order(a.table,b.table));
  assert.deepEqual(after.facts,{...before.facts,sourceTables:expectedSources},'MIGRATION_UNEXPECTED_FACTS');
  return {code:'EXACT_CURRENT_STARTUP_MIGRATION_VERIFIED',version:manifest.version,tables:manifest.afterTables,
    sourceTables:manifest.afterSources,addedObjects:manifest.added.length,removedObjects:manifest.removed.length,
    changedObjects:manifest.changed.length,sectionPolicy:manifest.sectionPolicy,
    beforeSchemaSha256:before.logical.schemaSha256,afterSchemaSha256:after.logical.schemaSha256,
    beforeLogicalSha256:before.logical.sha256,afterLogicalSha256:after.logical.sha256,
    derivedCountsSha256:hash(derived),emptyNewBusinessTables:4};
}

/** Already-migrated qualified source only. No DDL or row changes are allowed. */
export function assertCurrentStartupNoop(before,after){
  need(manifest.afterTables===179&&manifest.afterSources===94&&manifest.sectionPolicy===4,'NOOP_MANIFEST_UNREVIEWED');
  need(before.logical.tables.length===manifest.afterTables&&after.logical.tables.length===manifest.afterTables&&
    before.facts.sourceTables.length===manifest.afterSources&&after.facts.sourceTables.length===manifest.afterSources,'MIGRATION_TABLE_COUNT');
  // Authenticate the current objects against the reviewed SQL, never the after DB.
  for(const expected of [...manifest.added,...manifest.changed.map(change=>change.after)]){
    const rows=before.schema.filter(row=>row.type===expected.type&&row.name===expected.name);
    need(rows.length===1&&hash(rows[0])===hash(expected),'NOOP_CURRENT_DDL_REQUIRED');
  }
  for(const removed of manifest.removed)
    need(!before.schema.some(row=>row.type===removed.type&&row.name===removed.name),'NOOP_LEGACY_DDL_REJECTED');
  assert.deepEqual(after.schema,before.schema,'NOOP_DDL_CHANGED');
  need(hash(before.schema)===before.logical.schemaSha256&&hash(after.schema)===after.logical.schemaSha256,'NOOP_SCHEMA_HASH_MISMATCH');
  need(hash(before.control)===hash([{id:1,cursor:0,section_policy:manifest.sectionPolicy}]),'NOOP_CONTROL_REQUIRED');
  assert.deepEqual(after.control,before.control,'NOOP_CONTROL_CHANGED');
  assert.deepEqual(after.logical,before.logical,'NOOP_LOGICAL_OR_PRAGMA_CHANGED');
  assert.deepEqual(after.facts,before.facts,'NOOP_FACTS_CHANGED');
  need(before.derivedCounts&&after.derivedCounts,'NOOP_DERIVED_REQUIRED');
  assert.deepEqual(after.derivedCounts,before.derivedCounts,'NOOP_DERIVED_CHANGED');
  assert.deepEqual(after,before,'NOOP_STATE_CHANGED');
  return {code:'EXACT_CURRENT_STARTUP_NOOP_VERIFIED',version:manifest.version,tables:manifest.afterTables,
    sourceTables:manifest.afterSources,sectionPolicy:manifest.sectionPolicy,
    beforeSchemaSha256:before.logical.schemaSha256,afterSchemaSha256:after.logical.schemaSha256,
    beforeLogicalSha256:before.logical.sha256,afterLogicalSha256:after.logical.sha256,
    derivedCountsSha256:hash(before.derivedCounts)};
}
