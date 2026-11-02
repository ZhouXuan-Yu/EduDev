import assert from 'node:assert/strict';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {sha256} from './evidence.mjs';

const withDb = (data, fn) => {
  const db = new DatabaseSync(path.join(data, 'app.db'), {readOnly: true});
  try {return fn(db);} finally {db.close();}
};
/** Local hashes only. No model request records or question bodies are put into the report. */
export function instanceDomainEvidence(data) {
  return withDb(data, db => ({
    bank: {count: Number(db.prepare('SELECT COUNT(*) AS count FROM question_bank_items').get().count),
      sha256: sha256(JSON.stringify(db.prepare('SELECT * FROM question_bank_items ORDER BY id').all()))},
    papers: Object.fromEntries(db.prepare("SELECT * FROM ai_confirmation_items WHERE action_type='pi_paper_candidate' ORDER BY id")
      .all().map(row => [row.id, sha256(JSON.stringify(row))])),
  }));
}

export function assertInstanceDomainUnchanged(before, after) {
  assert.deepEqual(after.bank, before.bank, 'Editing an instance must not change the question bank');
  for (const [id, digest] of Object.entries(before.papers)) {
    assert.equal(after.papers[id], digest, 'Every pre-existing paper receipt/snapshot remains byte-identical');
  }
}

export function storedPaperDigest(data, id) {
  return withDb(data, db => {
    const row = db.prepare("SELECT * FROM ai_confirmation_items WHERE id=? AND action_type='pi_paper_candidate'").get(id);
    assert(row, 'Actual UI-created paper must exist in SQLite');
    return sha256(JSON.stringify(row));
  });
}
