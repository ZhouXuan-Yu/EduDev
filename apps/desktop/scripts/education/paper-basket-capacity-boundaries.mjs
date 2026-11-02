import assert from 'node:assert/strict';
import path from 'node:path';
import {createHash, randomUUID} from 'node:crypto';
import {basketFixture} from './paper-basket-fixture.mjs';
import {PAPER_BASKET_SCHEMA} from '../../src/shared/paper-basket.ts';
import {canonicalBasketJson} from '../../src/main/education/paper-basket-state.ts';

/** Bulk rows seed real SQLite capacity; all boundary writes/retries use the repository. */
export async function basketCapacityBoundaries(check, output) {
  const fixture = await basketFixture(path.join(output, 'receipt-capacity'));
  const {db, sid, student, baskets, question} = fixture;
  const schema = {schemaVersion: PAPER_BASKET_SCHEMA, sessionId: sid};
  const blueprint = {
    title: '回执容量合同', subject: '数学', grade: '初二', durationMinutes: 40,
    totalPoints: 10, mode: 'source_only',
    sections: [{id: 'a', label: '解答', questionType: '解答题', count: 1, points: 10}],
  };
  const createInput = {...schema, requestId: randomUUID(), blueprint};
  let basket = await baskets.create(createInput);
  const ref = () => ({...schema, basketId: basket.id});
  const mutation = operation => ({...ref(), expectedRevision: basket.revision, requestId: randomUUID(), operation});
  const ui = stage => mutation({type: 'updateUiState', uiState: {stage, filters: {}, offset: 0, scrollTop: 0}});
  function seedReceipts(kind, count, inputForReceipt = () => ui('select')) {
    const insert = db.prepare(`INSERT INTO paper_basket_operations(
      session_id,request_id,student_id,operation_kind,input_hash,basket_id,paper_id,result_revision,created_at
    ) VALUES(?,?,?,?,?,?,NULL,?,?)`);
    let firstInput;
    db.exec('BEGIN IMMEDIATE');
    try {
      for (let index = 0; index < count; index++) {
        const input = inputForReceipt();
        firstInput ??= input;
        const hash = createHash('sha256').update(canonicalBasketJson(input)).digest('hex');
        insert.run(sid, input.requestId, student, kind, hash, input.basketId || basket.id,
          input.expectedRevision || basket.revision, new Date().toISOString());
      }
      db.exec('COMMIT');
      return firstInput;
    } catch (error) {
      db.exec('ROLLBACK');
      throw error;
    }
  }
  const count = kind => db.prepare('SELECT COUNT(*) n FROM paper_basket_operations WHERE session_id=? AND operation_kind=?').get(sid, kind).n;
  let finalUi;
  try {
    await check('9,999 UI receipts allow the last preference write without changing content revision; 10,001st rolls back only that UI intent', async () => {
      seedReceipts('ui:state', 9999);
      const revision = basket.revision;
      finalUi = ui('preview');
      basket = await baskets.mutate(finalUi);
      assert.equal(basket.revision, revision);
      assert.equal(count('ui:state'), 10000);
      const before = db.prepare('SELECT * FROM paper_baskets WHERE id=?').get(basket.id);
      await assert.rejects(baskets.mutate(ui('organize')), /unavailable/);
      assert.deepEqual(db.prepare('SELECT * FROM paper_baskets WHERE id=?').get(basket.id), before);
      assert.equal(count('ui:state'), 10000);
      assert.equal((await baskets.mutate(finalUi)).uiState.stage, 'preview');
      await assert.rejects(baskets.mutate({...finalUi, operation: {type: 'archive'}}), /conflict/);
    });
    await check('At full UI capacity, domain add/exact snapshot/create/archive remain writable and retries never duplicate members or pending papers', async () => {
      const item = question('容量后仍可选题');
      const candidate = await baskets.candidate({...ref(), questionId: item.id});
      const add = mutation({type: 'add', questionId: item.id, sectionId: 'a', expectedSourceVersion: candidate.contentVersion});
      basket = await baskets.mutate(add);
      assert.equal(basket.revision, 2);
      assert.equal((await baskets.mutate(add)).entries.length, 1);
      const snapshot = {...ref(), expectedRevision: basket.revision, requestId: randomUUID()};
      const paper = await baskets.createSnapshot(snapshot);
      assert.deepEqual(paper.selection.items.map(entry => entry.question.id), [item.id]);
      assert.equal((await baskets.createSnapshot(snapshot)).id, paper.id);
      assert.equal(db.prepare("SELECT COUNT(*) n FROM ai_confirmation_items WHERE action_type='pi_paper_candidate'").get().n, 1);
      const nextInput = {...schema, requestId: randomUUID(), blueprint};
      const next = await baskets.create(nextInput);
      assert.equal((await baskets.create(nextInput)).id, next.id);
      const archive = mutation({type: 'archive'});
      basket = await baskets.mutate(archive);
      assert.equal(basket.state, 'archived');
      assert.equal((await baskets.mutate(archive)).revision, basket.revision);
      assert.equal(count('ui:state'), 10000);
      assert.equal((await baskets.mutate(finalUi)).state, 'archived');
    });
    await check('Legacy shared-cap receipts stay byte-identical and retryable while a full old UI allocation cannot block new domain capacity', async () => {
      const oldCreate = db.prepare('SELECT * FROM paper_basket_operations WHERE request_id=?').get(createInput.requestId);
      db.prepare("UPDATE paper_basket_operations SET operation_kind='create' WHERE request_id=?").run(createInput.requestId);
      const legacyUi = seedReceipts('mutate', 9999, () => ({...ui('select'), expectedRevision: 1}));
      const legacy = db.prepare("SELECT * FROM paper_basket_operations WHERE operation_kind IN ('create','mutate','snapshot') ORDER BY request_id").all();
      assert.equal(legacy.length, 10000);
      assert.equal((await baskets.create(createInput)).id, basket.id);
      assert.equal((await baskets.mutate(legacyUi)).state, 'archived');
      await assert.rejects(baskets.mutate({...legacyUi, operation: {type: 'archive'}}), /conflict/);
      assert.equal(db.prepare('SELECT input_hash FROM paper_basket_operations WHERE request_id=?').get(createInput.requestId).input_hash, oldCreate.input_hash);
      const next = await baskets.create({...schema, requestId: randomUUID(), blueprint});
      const item = question('旧回执满额不阻断');
      const candidate = await baskets.candidate({...schema, basketId: next.id, questionId: item.id});
      const add = {...schema, basketId: next.id, expectedRevision: next.revision, requestId: randomUUID(),
        operation: {type: 'add', questionId: item.id, sectionId: 'a', expectedSourceVersion: candidate.contentVersion}};
      const added = await baskets.mutate(add);
      assert.equal((await baskets.mutate(add)).entries.length, 1);
      const snapshot = {...schema, basketId: next.id, expectedRevision: added.revision, requestId: randomUUID()};
      const paper = await baskets.createSnapshot(snapshot);
      assert.equal((await baskets.createSnapshot(snapshot)).id, paper.id);
      assert.deepEqual(db.prepare("SELECT * FROM paper_basket_operations WHERE operation_kind IN ('create','mutate','snapshot') ORDER BY request_id").all(), legacy);
    });
    await check('Full domain allocation rejects only new domain intent; committed domain/UI retries still precede quota and CAS checks', async () => {
      const created = await baskets.create({...schema, requestId: randomUUID(), blueprint});
      const item = question('领域额度回执重试');
      const candidate = await baskets.candidate({...schema, basketId: created.id, questionId: item.id});
      const add = {...schema, basketId: created.id, expectedRevision: created.revision, requestId: randomUUID(),
        operation: {type: 'add', questionId: item.id, sectionId: 'a', expectedSourceVersion: candidate.contentVersion}};
      const added = await baskets.mutate(add);
      const snapshot = {...schema, basketId: added.id, expectedRevision: added.revision, requestId: randomUUID()};
      const paper = await baskets.createSnapshot(snapshot);
      const used = db.prepare("SELECT COUNT(*) n FROM paper_basket_operations WHERE session_id=? AND operation_kind IN ('domain:create','domain:mutate','domain:snapshot')").get(sid).n;
      seedReceipts('domain:mutate', 10000 - used, () => ({
        ...schema, basketId: added.id, expectedRevision: added.revision, requestId: randomUUID(),
        operation: {type: 'updateBlueprint', blueprint},
      }));
      const before = db.prepare('SELECT * FROM paper_baskets WHERE id=?').get(added.id);
      const receipts = db.prepare('SELECT COUNT(*) n FROM paper_basket_operations').get().n;
      await assert.rejects(baskets.mutate({...schema, basketId: added.id, expectedRevision: added.revision,
        requestId: randomUUID(), operation: {type: 'archive'}}), /unavailable/);
      assert.deepEqual(db.prepare('SELECT * FROM paper_baskets WHERE id=?').get(added.id), before);
      assert.equal((await baskets.mutate(add)).entries.length, 1);
      assert.equal((await baskets.createSnapshot(snapshot)).id, paper.id);
      assert.equal((await baskets.mutate(finalUi)).uiState.stage, 'preview');
      assert.equal(db.prepare('SELECT COUNT(*) n FROM paper_basket_operations').get().n, receipts);
    });
  } finally {
    fixture.close();
  }
}
