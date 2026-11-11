/** Pure snapshot controls from reviewed manifest SQL. No DB, migrations or GUI. */
import assert from 'node:assert/strict';
import manifest from './material-metadata-startup-20261106.json' with {type:'json'};
import {sha256} from './evidence.mjs';
import {assertCurrentStartupMigration,assertCurrentStartupNoop} from './material-metadata-startup-current.mjs';
import {assertStartupMigration} from '../ui-final-material-metadata-recovery-helper.mjs';

const hash=value=>sha256(JSON.stringify(value));
const order=(a,b)=>a<b?-1:a>b?1:0;
const schemaOrder=(a,b)=>order(a.type+'\0'+a.name,b.type+'\0'+b.name);
const cell=value=>typeof value==='bigint'?['integer',String(value)]:[typeof value,value];
const projection=(table,rows)=>({table,count:rows.length,sha256:hash(rows.map(row=>hash(row.map(cell))).sort())});
const schema=[...manifest.added,...manifest.changed.map(change=>change.after)].map(row=>({...row}));
const fillerCount=manifest.afterTables-schema.filter(row=>row.type==='table').length;
for(let i=0;i<fillerCount;i++)schema.push({type:'table',name:'qa_noop_'+i,tbl_name:'qa_noop_'+i,sql:'CREATE TABLE qa_noop_'+i+'(id INTEGER)'});
schema.sort(schemaOrder);
const derivedCounts={resources:[1,2,3].map(i=>({resource_id:'qa-resource-'+i,total:1,private:0})),cursor:3,indexed:3};
const control='material_book_answer_control_v1';
const tables=schema.filter(row=>row.type==='table').map(row=>projection(row.name,[]));
const setProjection=(name,rows)=>Object.assign(tables.find(table=>table.table===name),projection(name,rows));
setProjection(control,[[1n,0n,4n]]);
setProjection('material_search_count_control_v1',[[1n,3n,3n,1n]]);
setProjection('material_search_resource_counts_v1',derivedCounts.resources.map(row=>[row.resource_id,1n,0n,1n]));
const logical={schemaSha256:hash(schema),tables,userVersion:0,applicationId:0};
logical.sha256=hash(logical);
const ready={logical,schema,control:[{id:1,cursor:0,section_policy:4}],
  facts:{ledger:[{table:'qa-ledger',count:0,sha256:hash([])}],native:[],sourceTables:tables.slice(0,manifest.afterSources),
    resources:derivedCounts.resources.map(row=>({id:row.resource_id})),metadata:[{resource_id:'qa-resource-1',revision:2}],
    tags:[{resource_id:'qa-resource-1',tag_key:'qa',label:'QA'}]},derivedCounts};
const checks=[];
const pass=name=>checks.push(name);
assert.equal(assertCurrentStartupNoop(ready,structuredClone(ready)).code,'EXACT_CURRENT_STARTUP_NOOP_VERIFIED');
pass('CURRENT_179_94_POLICY4_NOOP_ACCEPTED');
assert.equal(assertStartupMigration(ready,structuredClone(ready)).code,'EXACT_CURRENT_STARTUP_NOOP_VERIFIED');
pass('PUBLIC_DISPATCH_EXACT_179_TO_179_ACCEPTED');
function reject(name,change){
  const before=structuredClone(ready),after=structuredClone(ready);change(after,before);
  assert.throws(()=>assertCurrentStartupNoop(before,after),undefined,name);
  assert.throws(()=>assertStartupMigration(before,after),undefined,name+' dispatch');pass(name);
}
reject('AFTER_TABLE_COUNT_REJECTED',after=>after.logical.tables.pop());
reject('BEFORE_TABLE_COUNT_REJECTED',(_after,before)=>before.logical.tables.pop());
reject('AFTER_SOURCE_COUNT_REJECTED',after=>after.facts.sourceTables.pop());
reject('BEFORE_SOURCE_COUNT_REJECTED',(_after,before)=>before.facts.sourceTables.pop());
reject('UNKNOWN_DDL_ADDED_REJECTED',after=>after.schema.push({type:'index',name:'unknown',tbl_name:'qa_noop_0',sql:'CREATE INDEX unknown ON qa_noop_0(id)'}));
reject('DDL_REMOVED_REJECTED',after=>after.schema.pop());
reject('COLUMN_CHANGED_REJECTED',after=>{after.schema.find(row=>row.name==='qa_noop_0').sql='CREATE TABLE qa_noop_0(id INTEGER,extra INTEGER)';});
reject('UNMANIFESTED_OLD_DDL_CHANGED_REJECTED',after=>{after.schema.find(row=>row.name==='qa_noop_0').sql+=' ';});
reject('CURRENT_SQL_CHANGED_ON_BOTH_SIDES_REJECTED',(after,before)=>{
  for(const state of [before,after])state.schema.find(row=>row.name===control).sql+=' ';
});
reject('KNOWN_CURRENT_OBJECT_MISSING_ON_BOTH_SIDES_REJECTED',(after,before)=>{
  for(const state of [before,after])state.schema=state.schema.filter(row=>row.name!==control);
});
reject('DUPLICATE_KNOWN_OBJECT_REJECTED',(after,before)=>{
  for(const state of [before,after])state.schema.push({...state.schema.find(row=>row.name===control)});
});
reject('LEGACY_TRIGGER_REINTRODUCED_REJECTED',(after,before)=>{
  for(const state of [before,after])state.schema.push({...manifest.removed[0]});
});
for(const field of ['count','sha256'])reject('ANY_TABLE_'+field.toUpperCase()+'_CHANGE_REJECTED',after=>{
  const row=after.logical.tables.find(row=>row.table==='qa_noop_0');row[field]=field==='count'?1:'0'.repeat(64);
});
for(const table of ready.logical.tables){
  const after=structuredClone(ready);
  after.logical.tables.find(row=>row.table===table.table).sha256='0'.repeat(64);
  assert.throws(()=>assertStartupMigration(ready,after),undefined,table.table);
}
pass('EACH_OF_ALL_179_TABLE_ROW_PROJECTIONS_REJECTS_CHANGE');
reject('LOGICAL_SCHEMA_DIGEST_CHANGED_REJECTED',after=>{after.logical.schemaSha256='0'.repeat(64);});
reject('LOGICAL_TOTAL_DIGEST_CHANGED_REJECTED',after=>{after.logical.sha256='0'.repeat(64);});
reject('CONTROL_CURSOR_CHANGED_REJECTED',after=>{after.control[0].cursor++;});
reject('CONTROL_POLICY_CHANGED_REJECTED',after=>{after.control[0].section_policy=5;});
reject('UNKNOWN_POLICY_ON_BOTH_SIDES_REJECTED',(after,before)=>{after.control[0].section_policy=before.control[0].section_policy=5;});
reject('OLD_POLICY3_ON_BOTH_SIDES_REJECTED',(after,before)=>{after.control[0].section_policy=before.control[0].section_policy=3;});
reject('EXTRA_CONTROL_RECORD_REJECTED',after=>after.control.push({id:2,cursor:0,section_policy:4}));
for(const field of ['userVersion','applicationId'])reject('PRAGMA_'+field+'_CHANGE_REJECTED',after=>{after.logical[field]++;});
for(const field of ['ledger','native','sourceTables','resources','metadata','tags'])reject('FACTS_'+field+'_CHANGE_REJECTED',after=>{
  after.facts[field].push({qa:'changed'});
});
reject('UNKNOWN_FACTS_FIELD_REJECTED',after=>{after.facts.extra='changed';});
reject('DERIVED_RECORD_CHANGE_REJECTED',after=>{after.derivedCounts.resources[0].total++;});
reject('DERIVED_CURSOR_CHANGE_REJECTED',after=>{after.derivedCounts.cursor++;});
reject('DERIVED_INDEXED_CHANGE_REJECTED',after=>{after.derivedCounts.indexed++;});
reject('DERIVED_MISSING_REJECTED',after=>{after.derivedCounts=null;});
reject('DERIVED_MISSING_ON_BOTH_SIDES_REJECTED',(after,before)=>{after.derivedCounts=before.derivedCounts=null;});
reject('EXTRA_STARTUP_FIELD_REJECTED',after=>{after.extra='changed';});

// Keep the existing 173 -> 179 transformation reachable with its own exact SQL.
const legacy=structuredClone(ready);
legacy.schema=legacy.schema.filter(row=>!manifest.added.some(added=>added.type===row.type&&added.name===row.name));
for(const change of manifest.changed)legacy.schema[legacy.schema.findIndex(row=>row.type===change.after.type&&row.name===change.after.name)]={...change.before};
legacy.schema.push(...manifest.removed.map(row=>({...row})));legacy.schema.sort(schemaOrder);
const additions=manifest.added.filter(row=>row.type==='table').map(row=>row.name);
legacy.logical.tables=legacy.logical.tables.filter(row=>!additions.includes(row.table));
Object.assign(legacy.logical.tables.find(row=>row.table===control),projection(control,[[1n,0n]]));
legacy.logical.schemaSha256=hash(legacy.schema);
const {sha256:ignored,...legacyLogical}=legacy.logical;legacy.logical.sha256=hash(legacyLogical);
legacy.control=[{id:1,cursor:0}];
legacy.facts.sourceTables=legacy.facts.sourceTables.filter(row=>!additions.includes(row.table));
Object.assign(legacy.facts.sourceTables.find(row=>row.table===control),projection(control,[[1n,0n]]));
assert.equal(assertCurrentStartupMigration(legacy,ready).code,'EXACT_CURRENT_STARTUP_MIGRATION_VERIFIED');
assert.equal(assertStartupMigration(legacy,ready).code,'EXACT_CURRENT_STARTUP_MIGRATION_VERIFIED');
pass('ORIGINAL_173_TO_179_MANIFEST_BRANCH_REMAINS_REACHABLE');
console.log(JSON.stringify({status:'PASS',checks,launches:0,http:0,models:0,productAcceptance:false,
  fixture:'Pure object snapshots from reviewed manifest SQL; no SQLite or after-DB allowlist extraction'}));
