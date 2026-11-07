/** Genuine retained DB snapshots, read-only. No migrations or product writes. */
import assert from 'node:assert/strict';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {startupState,assertStartupMigration,assertPostStartupState,tree} from '../ui-final-material-metadata-recovery-helper.mjs';

const desktop=fileURLToPath(new URL('../..',import.meta.url));
const beforeRoot=path.join(desktop,'test-results/ui-final-material-catalog-live-K61IFq');
const afterRoot=path.join(desktop,'test-results/ui-final-material-metadata-recovery-live-vTFxHB');
const original=[tree(beforeRoot).sha256,tree(afterRoot).sha256];
const before=startupState(path.join(beforeRoot,'data')),after=startupState(path.join(afterRoot,'data'));
const receipt=assertStartupMigration(before,after),checks=['GENUINE_173_TO_179_ALL_ROWS_AND_DDL'];
const clonedBefore=structuredClone(before),clonedAfter=structuredClone(after);
assertStartupMigration(clonedBefore,clonedAfter);checks.push('NEGATIVE_TEST_CONTROL_CLONES_ACCEPTED');
function reject(name,mutate){const bad=structuredClone(after);mutate(bad);assert.throws(()=>assertStartupMigration(clonedBefore,bad));checks.push(name);}
reject('EXTRA_SCHEMA_REJECTED',s=>s.schema.push({type:'index',name:'unexpected',tbl_name:'teacher_resources',sql:'CREATE INDEX unexpected ON teacher_resources(id)'}));
reject('CHANGED_NEW_TRIGGER_REJECTED',s=>{s.schema.find(r=>r.name==='question_origins_question_insert_v1').sql+=' ';});
reject('CHANGED_OLD_BUSINESS_ROWS_REJECTED',s=>{s.logical.tables.find(r=>r.table==='question_bank_items').sha256='0'.repeat(64);});
reject('CONTROL_CURSOR_REJECTED',s=>{s.control[0].cursor++;});
reject('CONTROL_POLICY_REJECTED',s=>{s.control[0].section_policy=3;});
reject('NEW_BUSINESS_DATA_REJECTED',s=>{s.logical.tables.find(r=>r.table==='material_ai_bound_answers').count++;});
reject('WRONG_DERIVED_COUNTS_REJECTED',s=>{s.logical.tables.find(r=>r.table==='material_search_resource_counts_v1').sha256='0'.repeat(64);});
reject('CHANGED_DERIVED_SOURCE_REJECTED',s=>{s.derivedCounts.resources[0].total++;});
reject('WRONG_DERIVED_CONTROL_REJECTED',s=>{s.logical.tables.find(r=>r.table==='material_search_count_control_v1').sha256='0'.repeat(64);});
reject('SOURCE_METADATA_REJECTED',s=>{s.facts.metadata[0].revision++;});
reject('SOURCE_TAGS_REJECTED',s=>{s.facts.tags.push({resource_id:'wrong',tag:'wrong'});});
reject('NATIVE_SESSION_REJECTED',s=>{s.facts.native.push({file:'unexpected',sha256:'0'.repeat(64)});});
reject('PRAGMA_CHANGE_REJECTED',s=>{s.logical.applicationId++;});
assertPostStartupState(after,after);checks.push('ALL_94_POSTSTARTUP_PROJECTIONS_PROTECTED');
for(const table of ['material_search_resource_counts_v1','material_ai_response_receipts','material_book_answer_control_v1']){
  const bad=structuredClone(after);bad.facts.sourceTables.find(r=>r.table===table).sha256='0'.repeat(64);
  assert.throws(()=>assertPostStartupState(bad,after));checks.push('POSTSTARTUP_'+table+'_CHANGE_REJECTED');
}
assert.deepEqual([tree(beforeRoot).sha256,tree(afterRoot).sha256],original);checks.push('BOTH_RETAINED_INPUTS_UNCHANGED');
console.log(JSON.stringify({status:'PASS',checks,receipt,launches:0,http:0,models:0,productAcceptance:false}));
