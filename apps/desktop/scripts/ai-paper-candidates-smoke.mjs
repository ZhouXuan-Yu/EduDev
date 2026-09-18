import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-ai-paper-candidates-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-paper-candidates-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'ai-paper-candidates-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';

          function candidate(overrides = {}) {
            return {
              stem: '已知 x^2 - 4 = 0，求 x 的值。',
              answer: 'x = ±2',
              analysis: '移项得 x^2 = 4，开平方得 x = ±2。',
              questionType: '填空题',
              difficulty: 'easy',
              knowledgePoint: '一元二次方程',
              points: 5,
              ...overrides,
            };
          }

          export async function runAiPaperCandidatesSmoke(dataRoot) {
            const provider = {
              generatePaperCandidates: async (context) => ({
                model: 'fake-model',
                candidates: [
                  candidate(),
                  candidate({ stem: '若 a + b = 3，ab = 2，求 a^2 + b^2。', answer: '5', analysis: 'a^2+b^2=(a+b)^2-2ab=9-4=5。', questionType: '解答题', difficulty: 'hard', points: 10 }),
                  candidate({ stem: '   ', answer: '无题干', difficulty: 'easy' }),
                  candidate({ difficulty: 'impossible', points: 999 }),
                ],
              }),
            };
            const store = new OmniEduStore(dataRoot, undefined, undefined, undefined, provider);
            await store.init();

            // 清空平台种子题库，保证空召回场景可控。
            await store.run('DELETE FROM question_bank_fts');
            await store.run('DELETE FROM question_bank_items');

            // 蓝图 + 空卷（本地题库为空，召回 0 题）。
            const blueprint = await store.createPaperBlueprint({
              title: 'AI 候选测试蓝图',
              subject: '数学',
              grade: '九年级',
              textbookVersion: '人教版',
              scope: '一元二次方程',
              knowledgePoints: ['一元二次方程', '因式分解'],
              typeSpecs: [
                { questionType: '填空题', count: 3, pointsPerQuestion: 5 },
                { questionType: '解答题', count: 2, pointsPerQuestion: 10 },
              ],
              difficultyMix: { easy: 50, medium: 40, hard: 10 },
              durationMinutes: 60,
              sourcePreference: 'any',
            });
            const paper = await store.createPaperFromBlueprint({ blueprintId: blueprint.id });
            assert.equal(paper.items.length, 0, 'empty bank must recall zero items');

            // 1. 生成 → 确认项 pending；归一化：空题干丢弃、非法难度归 medium、分值 clamp。
            const generated = await store.generatePaperCandidates(paper.id);
            assert.equal(generated.model, 'fake-model', 'model must be recorded');
            assert.equal(generated.confirmation.status, 'pending', 'proposal must be pending');
            assert.equal(generated.confirmation.actionType, 'save_paper_candidates', 'actionType must be save_paper_candidates');
            assert.equal(generated.candidates.length, 3, 'empty-stem candidate must be dropped');
            assert.equal(generated.candidates[2].difficulty, 'medium', 'invalid difficulty must coerce to medium');
            assert.equal(generated.candidates[2].points, 200, 'points must clamp to 200');
            assert.equal(generated.confirmation.payload.paperCandidates.paperId, paper.id, 'payload must carry paperId');
            assert.ok(generated.gapSummary.length >= 2, 'gaps must surface type shortages');

            // 2. 无 provider / 空结果 fail-closed。
            const bareStore = new OmniEduStore(dataRoot);
            await bareStore.init();
            await assert.rejects(() => bareStore.generatePaperCandidates(paper.id), /题目生成引擎未初始化/, 'missing provider must fail closed');
            await bareStore.close();
            provider.generatePaperCandidates = async () => ({ model: 'fake-model', candidates: [] });
            await assert.rejects(() => store.generatePaperCandidates(paper.id), /没有返回有效候选题目/, 'empty candidates must fail closed');
            provider.generatePaperCandidates = async (context) => ({ model: 'fake-model', candidates: [
              candidate(),
              candidate({ stem: '变式题二：因式分解 x^2 - 5x + 6。', answer: '(x-2)(x-3)', analysis: '十字相乘。', questionType: '解答题', difficulty: 'medium', points: 10 }),
              candidate({ stem: '变式题三：解方程 2x + 1 = 7。', answer: 'x = 3', analysis: '移项。', questionType: '填空题', difficulty: 'easy', points: 5 }),
            ] });

            // 3. 确认写入：题库 generated 来源 + paper_items 追加 + 试卷版本递增 + readback。
            const confirmInput = { id: generated.confirmation.id };
            const decision = await store.confirmAiConfirmation(confirmInput);
            assert.equal(decision.item.status, 'confirmed', 'confirmation must settle as confirmed');
            assert.equal(decision.readback.paperCandidates.questionIds.length, 3, 'readback must carry all question ids');
            assert.equal(decision.readback.paperCandidates.paperItemIds.length, 3, 'readback must carry all paper item ids');
            const refreshed = await store.getPaper(paper.id);
            assert.equal(refreshed.items.length, 3, 'paper must append the confirmed candidates');
            assert.ok(refreshed.items.every((item) => item.sourceKind === 'generated'), 'paper items must be marked generated');
            assert.equal(refreshed.version, 2, 'paper version must increment on candidate write');
            const qbRows = await store.all('SELECT * FROM question_bank_items WHERE id IN (' + decision.readback.paperCandidates.questionIds.map(() => '?').join(', ') + ')', decision.readback.paperCandidates.questionIds);
            assert.equal(qbRows.length, 3, 'question bank must contain the confirmed candidates');
            assert.ok(qbRows.every((row) => row.source_kind === 'generated'), 'question bank rows must be source_kind=generated');
            assert.ok(qbRows.every((row) => String(row.source_title).includes('fake-model')), 'source_title must record the model');
            assert.ok(qbRows.every((row) => String(row.tags).includes('ai_generated')), 'tags must carry ai_generated');
            const ftsRows = await store.all('SELECT id FROM question_bank_fts WHERE id IN (' + decision.readback.paperCandidates.questionIds.map(() => '?').join(', ') + ')', decision.readback.paperCandidates.questionIds);
            assert.equal(ftsRows.length, 3, 'candidates must be searchable via question_bank_fts');

            // 4. 重复确认拒绝。
            await assert.rejects(() => store.confirmAiConfirmation(confirmInput), /只能确认待确认项/, 'double confirm must be rejected');

            // 5. 拒绝零写入。
            const second = await store.generatePaperCandidates(paper.id);
            const beforeReject = await store.getPaper(paper.id);
            await store.rejectAiConfirmation(second.confirmation.id);
            const afterReject = await store.getPaper(paper.id);
            assert.equal(afterReject.items.length, beforeReject.items.length, 'reject must not write paper items');
            assert.equal(afterReject.version, beforeReject.version, 'reject must not bump paper version');
            const rejectedItem = await store.listAiConfirmations('all').then((rows) => rows.find((row) => row.id === second.confirmation.id));
            assert.equal(rejectedItem?.status, 'rejected', 'rejected confirmation must settle as rejected');

            // 6. 教师编辑覆盖：勾选 1、3 题并修改第 1 题题干。
            const third = await store.generatePaperCandidates(paper.id);
            const thirdCandidates = third.candidates;
            const editedDecision = await store.confirmAiConfirmation({
              id: third.confirmation.id,
              paperCandidatesEdit: {
                candidates: [
                  { ...thirdCandidates[0], stem: '教师改过的题干：x^2 = 9，求 x。', answer: 'x = ±3', index: 0 },
                  { ...thirdCandidates[2], index: 2 },
                ],
              },
            });
            assert.equal(editedDecision.readback.paperCandidates.questionIds.length, 2, 'only selected candidates must be written');
            const afterEdit = await store.getPaper(paper.id);
            assert.equal(afterEdit.items.length, beforeReject.items.length + 2, 'paper must append only the selected two');
            const editedRows = await store.all('SELECT * FROM question_bank_items WHERE id IN (' + editedDecision.readback.paperCandidates.questionIds.map(() => '?').join(', ') + ')', editedDecision.readback.paperCandidates.questionIds);
            assert.ok(editedRows.some((row) => String(row.stem).includes('教师改过的题干')), 'teacher-edited stem must persist');

            // 7. 非法编辑拒绝：空列表、越界序号、重复序号、空题干。
            const fourth = await store.generatePaperCandidates(paper.id);
            await assert.rejects(() => store.confirmAiConfirmation({ id: fourth.confirmation.id, paperCandidatesEdit: { candidates: [] } }), /至少保留一道候选题目/, 'empty edit list must be rejected');
            await assert.rejects(() => store.confirmAiConfirmation({ id: fourth.confirmation.id, paperCandidatesEdit: { candidates: [{ ...fourth.candidates[0], index: 9 }] } }), /非法序号/, 'out-of-range index must be rejected');
            await assert.rejects(() => store.confirmAiConfirmation({ id: fourth.confirmation.id, paperCandidatesEdit: { candidates: [{ ...fourth.candidates[0], index: 0 }, { ...fourth.candidates[0], index: 0 }] } }), /重复序号/, 'duplicate index must be rejected');
            await assert.rejects(() => store.confirmAiConfirmation({ id: fourth.confirmation.id, paperCandidatesEdit: { candidates: [{ ...fourth.candidates[0], stem: '  ', index: 0 }] } }), /题干不能为空/, 'empty stem must be rejected');

            // 8. 归档蓝图后拒绝提交。
            await store.archivePaperBlueprint(blueprint.id, blueprint.version);
            await assert.rejects(() => store.proposePaperCandidates({ paperId: paper.id, model: 'fake-model', candidates: [candidate()] }), /已归档/, 'archived blueprint must refuse proposals');

            // 9. 重启持久化。
            await store.close();
            await store.init();
            const persisted = await store.getPaper(paper.id);
            assert.equal(persisted.items.length, afterEdit.items.length, 'paper items must survive restart');
            assert.ok(persisted.items.every((item) => item.sourceKind === 'generated'), 'generated source must survive restart');
            const confirmations = await store.listAiConfirmations('all');
            const persistedConfirmed = confirmations.filter((row) => row.actionType === 'save_paper_candidates' && row.status === 'confirmed');
            assert.equal(persistedConfirmed.length, 2, 'confirmed paper candidate items must survive restart');

            await store.close();
            return {
              ok: true,
              proposalNormalized: generated.candidates.length,
              missingProviderRejected: true,
              emptyCandidatesRejected: true,
              confirmedWrites: decision.readback.paperCandidates.questionIds.length,
              doubleConfirmRejected: true,
              rejectZeroWrite: true,
              teacherEditMerge: editedDecision.readback.paperCandidates.questionIds.length,
              invalidEditsRejected: 4,
              archivedBlueprintRejected: true,
              restartPersisted: persisted.items.length,
            };
          }
        `,
        resolveDir: appRoot,
        loader: 'ts',
      },
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      external: ['sqlite3'],
      logLevel: 'silent',
    });

    const { runAiPaperCandidatesSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runAiPaperCandidatesSmoke(dataRoot);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await cleanupWithRetry(bundleRoot);
    await cleanupWithRetry(dataRoot);
  }
}

async function cleanupWithRetry(target) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      rmSync(target, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 9) {
        console.error(`cleanup warning (${target}): ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 150));
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
