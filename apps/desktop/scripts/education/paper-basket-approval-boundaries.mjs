import assert from 'node:assert/strict';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {basketFixture} from './paper-basket-fixture.mjs';
import {PAPER_BASKET_SCHEMA} from '../../src/shared/paper-basket.ts';
import {QUESTION_REVIEW_SCHEMA} from '../../src/shared/question-review.ts';
import {questionVersion} from '../../src/main/education/question-context-provider.ts';

/** Exercises the basket with actual approval/quality/parent/saved-version ledger consumers. */
export async function basketApprovalBoundaries(check, output) {
  const fixture = await basketFixture(path.join(output, 'actual-approvals'));
  const {db, sid, other, student, baskets, papers, question, put} = fixture;
  const reviews = fixture.useActualReviews();
  const parent = question('actual-parent');
  const schema = {schemaVersion: PAPER_BASKET_SCHEMA, sessionId: sid};
  const blueprint = {
    title: '真实审批合同，非答案质量样本', subject: '数学', grade: '初二', durationMinutes: 40,
    totalPoints: 10, mode: 'hybrid',
    sections: [{id: 'a', label: '混合解答', questionType: '解答题', count: 2, points: 5, generatedCount: 1}],
  };
  const draft = {
    title: '复合合成题', reason: '仅测审批和来源链，不证明答案质量。',
    subject: '数学', grade: '初二', knowledgePoint: '合成合同',
    items: [{questionType: 'written', difficulty: 'medium',
      stem: '将椭圆改为x²/9+y²/4=1，联立含参数直线，分问讨论相交、相切、退化与弦中点范围。',
      answer: '分条件讨论的教学草稿，需人工核对。',
      analysis: '列出定义域、方程与判别式，按参数分类；每步与题干条件对应，完整结论交教师审核。', options: null}],
  };
  let basket;
  let group;
  let generated;
  const ref = () => ({...schema, basketId: basket.id});
  const snapshot = () => ({...ref(), requestId: randomUUID(), expectedRevision: basket.revision});
  async function add(item) {
    const candidate = await baskets.candidate({...ref(), questionId: item.id});
    basket = await baskets.mutate({...ref(), requestId: randomUUID(), expectedRevision: basket.revision,
      operation: {type: 'add', questionId: item.id, sectionId: 'a', expectedSourceVersion: candidate.contentVersion}});
  }
  try {
    await check('Basket generated qualification comes from actual teacher quality confirmation and saved question ledger, not source labels', async () => {
      const run = 'airun_' + randomUUID();
      db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?)').run(run, sid, student);
      group = await reviews.propose(sid, run, randomUUID(), draft,
        [{schemaVersion: 'xiaozhi.education.question-context.v1', questionId: parent.id, version: questionVersion(parent)}], () => true);
      const review = await reviews.review(sid, group.id, draft);
      await reviews.decide({schemaVersion: QUESTION_REVIEW_SCHEMA, sessionId: sid, id: group.id,
        action: 'confirm', draft, qualityConfirmation: {revisionHash: review.quality.revisionHash, reviewed: true}}, () => true);
      const approved = await reviews.approvedForPaper(sid);
      assert.equal(approved.length, 1);
      generated = approved[0].questions[0];
      basket = await baskets.create({...schema, requestId: randomUUID(), blueprint});
      await add(parent);
      await add(generated);
      assert(basket.complete);
      const paper = await baskets.createSnapshot(snapshot());
      assert.equal(paper.selection.items[1].generation.groupId, group.id);
      const foreignBasket = await baskets.create({...schema, sessionId: other, requestId: randomUUID(), blueprint});
      const foreign = await baskets.candidate({...schema, sessionId: other, basketId: foreignBasket.id, questionId: generated.id});
      assert.equal(foreign.eligibility.reason, 'generation_unavailable');
    });
    await check('Actual parent and generated saved-version changes block basket snapshot/confirmation and retain pinned facts', async () => {
      const pending = await baskets.createSnapshot(snapshot());
      put({...parent, answer: '父题换版'});
      const stale = await baskets.read(ref());
      assert.equal(stale.entries[1].availability.reason, 'generation_unavailable');
      assert.equal(stale.entries[1].question.stem, generated.stem);
      await assert.rejects(baskets.createSnapshot(snapshot()), /source_changed/);
      await assert.rejects(papers.decide({schemaVersion: 'xiaozhi.paper-blueprint.v1', sessionId: sid,
        id: pending.id, revision: 1, action: 'confirm'}, () => true), /source_changed/);
      put(parent);
      put({...generated, analysis: '生成题换版'});
      assert.equal((await baskets.read(ref())).entries[1].availability.reason, 'source_changed');
      put(generated);
    });
    await check('Corrupt actual confirmed effect marks generated entry unavailable without erasing or hiding pinned basket; snapshot rolls back', async () => {
      const row = db.prepare('SELECT result_json FROM ai_confirmation_items WHERE id=?').get(group.id);
      const effect = JSON.parse(row.result_json);
      db.prepare('UPDATE ai_confirmation_items SET result_json=? WHERE id=?').run(JSON.stringify({...effect, digest: 'f'.repeat(64)}), group.id);
      const blocked = await baskets.read(ref());
      assert.equal(blocked.entries.length, 2);
      assert.equal(blocked.entries[1].availability.reason, 'generation_unavailable');
      const count = db.prepare('SELECT COUNT(*) n FROM ai_confirmation_items').get().n;
      await assert.rejects(baskets.createSnapshot(snapshot()), /source_changed/);
      assert.equal(db.prepare('SELECT COUNT(*) n FROM ai_confirmation_items').get().n, count);
      db.prepare('UPDATE ai_confirmation_items SET result_json=? WHERE id=?').run(row.result_json, group.id);
    });
  } finally {
    fixture.close();
  }
}
