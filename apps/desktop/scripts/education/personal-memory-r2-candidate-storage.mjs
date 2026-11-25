import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const { preparePersonalMemoryExtraction, bindPersonalMemoryProposals } = await import('../../src/main/education/personal-memory/candidate-admission.ts');
const { createPersonalMemoryCandidateState, personalMemoryCandidateSchema } = await import('../../src/main/education/personal-memory/candidate-state.ts');
const database = join(mkdtempSync(join(tmpdir(),'edudev-r2-candidate-')), 'app.db');
let db = new DatabaseSync(database);
db.exec(personalMemoryCandidateSchema);
db.exec('CREATE TABLE source_witness(id TEXT PRIMARY KEY, version TEXT, generation INTEGER, enabled INTEGER)');

const sql = {
  all:async (q,v=[])=>db.prepare(q).all(...v),
  run:async (q,v=[])=>db.prepare(q).run(...v),
  change:async (q,v=[])=>Number(db.prepare(q).run(...v).changes),
  transaction:async operation=>{
    db.exec('BEGIN IMMEDIATE');
    try { const output=await operation(sql); db.exec('COMMIT'); return output; }
    catch(error){ db.exec('ROLLBACK'); throw error; }
  },
};
const state=createPersonalMemoryCandidateState(sql,async (tx,draft)=>{
  const [row]=await tx.all('SELECT * FROM source_witness WHERE id=?',[draft.witness.sourceId]);
  return !!row && row.version===draft.witness.sourceVersion && row.generation===draft.witness.generation && row.enabled===1;
});
assert.deepEqual(await state.processing(),{enabled:false,policyRevision:0,cancelGeneration:0});
const policy=await state.setEnabled(true,0);
await assert.rejects(state.setEnabled(false,0),/revision_conflict/);

function makeDraft(id, frozen = policy) {
  const version=createHash('sha256').update(id).digest('hex');
  const text='我教四年级科学。';
  const source={id,sourceVersion:version,generation:1,policyRevision:frozen.policyRevision,role:'teacher',purpose:['extract'],
    sanitizedText:text, scope:{kind:'course',id:'science'},term:'unknown'};
  const manifest=preparePersonalMemoryExtraction([source],frozen);
  const proposal={kind:'teaching_context',source_id:id,source_version:1,scope_id:'science',valid_term:'unknown',
    supporting_quote:text,value:text,supersedes:null};
  const draft=bindPersonalMemoryProposals([proposal],manifest,[source],frozen).candidates[0];
  db.prepare('INSERT INTO source_witness VALUES (?, ?, 1, 1) ON CONFLICT(id) DO NOTHING').run(id,version);
  return draft;
}
const first=makeDraft('root1'), second=makeDraft('root2');
const committed=await state.savePending([first,second],policy);
assert.deepEqual(committed.saved,[first.key,second.key]);
assert.equal((await state.savePending([first],policy)).repeated,1);
assert.equal((await state.reject(first.key,1)).state,'rejected');
await assert.rejects(state.reject(first.key,1),/revision_conflict/);
assert.equal((await state.savePending([first],policy)).repeated,1);
console.log('PASS atomic saves, repeated jobs and teacher rejection');

await sql.transaction(async tx=>{
  await tx.run('UPDATE source_witness SET enabled=0,generation=2 WHERE id=?',['root2']);
  assert.equal(await state.invalidateSource(tx,'root2',1),1);
});
assert.deepEqual((await state.savePending([second],policy)).stale,[second.key]);
console.log('PASS revoked source and stale worker cannot create or reactivate a draft');

const third=makeDraft('root3');
const cancelled=await state.setEnabled(false,policy.policyRevision);
await assert.rejects(state.savePending([third],policy),/cancelled/);
const resumed=await state.setEnabled(true,cancelled.policyRevision);
await assert.rejects(state.savePending([third],policy),/cancelled/);
assert.deepEqual((await state.savePending([third],resumed)).stale,[third.key]);
const newDraft=makeDraft('root3',resumed);
assert.deepEqual((await state.savePending([newDraft],resumed)).saved,[third.key]);
console.log('PASS stop and re-enable preserve a durable fence against earlier responses');

const fourth=makeDraft('root4',resumed);
await state.savePending([fourth],resumed);
assert.deepEqual((await state.savePending([{...fourth,proposedValue:'教五年级科学'}],resumed)).conflicted,[fourth.key]);
console.log('PASS contradictory values across runs become a durable conflict');

db.close();
db=new DatabaseSync(database);
assert.deepEqual(await state.processing(),resumed);
const rows=Object.fromEntries((await state.list(10)).map(row=>[row.draft.key,row]));
assert.equal(rows[first.key].state,'rejected');
assert.equal(rows[second.key].state,'stale');
assert.equal(rows[third.key].state,'pending');
assert.equal(rows[fourth.key].state,'conflict');
assert.equal(rows[first.key].revision,2);
db.close();
console.log('PASS SQLite restart retains policy and teacher decisions');
console.log(JSON.stringify({passed:5,database}));
