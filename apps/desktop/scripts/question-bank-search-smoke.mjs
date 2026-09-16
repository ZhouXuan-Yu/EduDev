import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-question-bank-search-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-question-bank-search-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'question-bank-search-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import sqlite3 from 'sqlite3';
          import { join } from 'node:path';
          import { OmniEduStore } from './src/main/db';

          export async function runQuestionBankSearchSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            await store.init();
            const student = (await store.listStudents(''))[0];
            assert.ok(student, 'seed should provide a student');

            // 1. 创建题目自动进 FTS，多 token 检索命中。
            const slope = await store.createQuestionBankItem({ subject: '数学', grade: '八年级', knowledgePoint: '一次函数', questionType: '解答题', difficulty: 'medium', stem: '求一次函数 y = 2x + 3 的斜率。', answer: '斜率为 2。', analysis: 'k 的几何意义。', sourceTitle: '本地题库', sourceKind: 'local_bank', tags: ['斜率'] });
            const graph = await store.createQuestionBankItem({ subject: '数学', grade: '八年级', knowledgePoint: '一次函数', questionType: '选择题', difficulty: 'easy', stem: '一次函数图像经过原点需要满足什么条件？', answer: 'b = 0。', analysis: '截距为零。', sourceTitle: '小智生成', sourceKind: 'generated', tags: ['图像'] });
            const equation = await store.createQuestionBankItem({ subject: '数学', grade: '七年级', knowledgePoint: '方程', questionType: '解答题', difficulty: 'hard', stem: '解方程 3x - 6 = 0。', answer: 'x = 2。', analysis: '移项求解。', sourceTitle: '本地题库', sourceKind: 'local_bank', tags: ['方程'] });
            const slopeHits = await store.searchQuestionBank({ query: '斜率' });
            assert.ok(slopeHits.some((item) => item.id === slope.id), 'FTS must match the slope question');
            assert.equal(slopeHits.length, 1, 'single-token FTS search must be precise');
            const functionHits = await store.searchQuestionBank({ query: '一次函数 条件' });
            assert.ok(functionHits.some((item) => item.id === graph.id), 'multi-token search must match via OR');
            const metadataFiltered = await store.searchQuestionBank({ query: '方程', subject: '数学', difficulty: 'hard' });
            assert.equal(metadataFiltered.length, 1, 'metadata filters must combine with text match');
            assert.equal(metadataFiltered[0].id, equation.id, 'filtered search must return the exact item');

            // 2. FTS 空表时降级 LIKE（结果等价、链路可用）。
            await rawSql(dataRoot, "DELETE FROM question_bank_fts");
            const likeFallback = await store.searchQuestionBank({ query: '斜率' });
            assert.ok(likeFallback.some((item) => item.id === slope.id), 'LIKE fallback must still find questions when FTS is empty');

            // 3. 重启自动重建 FTS（rebuild-if-empty）。
            await store.close();
            await store.init();
            const itemTotal = Number((await rawQuery(dataRoot, 'SELECT COUNT(*) AS count FROM question_bank_items'))[0].count);
            const ftsCountAfterRestart = Number((await rawQuery(dataRoot, 'SELECT COUNT(*) AS count FROM question_bank_fts'))[0].count);
            assert.equal(ftsCountAfterRestart, itemTotal, 'restart must rebuild the question bank FTS index to match canonical rows');
            const rebuiltHits = await store.searchQuestionBank({ query: '斜率' });
            assert.ok(rebuiltHits.some((item) => item.id === slope.id), 'rebuilt FTS must serve searches');

            // 4. FTS 表损坏（被删除）时检索继续降级 LIKE，不抛错。
            await rawSql(dataRoot, 'DROP TABLE question_bank_fts');
            const degraded = await store.searchQuestionBank({ query: '斜率' });
            assert.ok(degraded.some((item) => item.id === slope.id), 'search must degrade to LIKE when the FTS table is missing');

            // 5. 教师从题库召回组题：草稿只进确认队列，来源不可伪造。
            const beforeSets = await store.listExerciseSets(student.id);
            const draft = await store.proposeExerciseSetFromQuestions({
              studentId: student.id,
              title: '小A 针对性练习',
              subject: '数学',
              knowledgePoint: '一次函数',
              originalStem: '错题原题：求 y = 5x - 1 的斜率。',
              sourceQuestionIds: [slope.id, graph.id],
            });
            assert.equal(draft.status, 'pending', 'proposed set must be a pending confirmation');
            assert.equal(draft.actionType, 'save_exercise_set', 'proposed set must target exercise-set save');
            assert.equal(draft.payload.exerciseSet.items.length, 3, 'proposed set must contain original + selected questions');
            assert.equal(draft.payload.exerciseSet.items[0].role, 'original', 'first item must be the teacher original');
            assert.equal(draft.payload.exerciseSet.items[0].sourceKind, 'teacher_resource', 'teacher original must keep truthful provenance');
            assert.equal(draft.payload.exerciseSet.items[1].sourceKind, 'local_bank', 'local question must keep its source kind');
            assert.equal(draft.payload.exerciseSet.items[2].sourceKind, 'generated', 'generated question must keep its source kind');
            assert.equal((await store.listExerciseSets(student.id)).length, beforeSets.length, 'proposal must not write exercise sets');

            // 6. 非法输入拒绝且零写入。
            const extraQuestions = [];
            for (let index = 0; index < 4; index += 1) {
              extraQuestions.push(await store.createQuestionBankItem({ subject: '数学', grade: '八年级', knowledgePoint: '一次函数', questionType: '填空题', difficulty: 'easy', stem: '批量相似题 ' + (index + 1) + '：一次函数 y = x + ' + index + ' 的斜率是？', answer: '1。', analysis: '斜率是 1。', sourceTitle: '本地题库', sourceKind: 'local_bank', tags: ['批量'] }));
            }
            await assert.rejects(() => store.proposeExerciseSetFromQuestions({ studentId: 'missing_student', originalStem: 'x', sourceQuestionIds: [slope.id] }), /学生不存在/);
            await assert.rejects(() => store.proposeExerciseSetFromQuestions({ studentId: student.id, originalStem: 'x', sourceQuestionIds: ['question_missing'] }), /题目不存在/);
            await assert.rejects(() => store.proposeExerciseSetFromQuestions({ studentId: student.id, originalStem: 'x', sourceQuestionIds: [] }), /至少选择一道/);
            const sevenDistinct = [slope.id, graph.id, equation.id, extraQuestions[0].id, extraQuestions[1].id, extraQuestions[2].id, extraQuestions[3].id];
            await assert.rejects(() => store.proposeExerciseSetFromQuestions({ studentId: student.id, originalStem: 'x', sourceQuestionIds: sevenDistinct }), /最多选择 6 道/);
            await assert.rejects(() => store.proposeExerciseSetFromQuestions({ studentId: student.id, originalStem: '  ', sourceQuestionIds: [slope.id] }), /原题题干不能为空/);

            // 7. 确认后落库：来源标签与题目正文一致。
            const confirmed = await store.confirmAiConfirmation({ id: draft.id });
            assert.equal(confirmed.item.status, 'confirmed');
            assert.ok(confirmed.readback?.exerciseSet, 'confirmed propose must read back the exercise set');
            assert.equal(confirmed.readback.exerciseSet.items.length, 3);
            assert.equal(confirmed.readback.exerciseSet.items[0].stem, '错题原题：求 y = 5x - 1 的斜率。', 'original stem must persist');
            assert.equal(confirmed.readback.exerciseSet.items[1].stem, slope.stem, 'recalled question stem must come from the canonical bank row');
            assert.equal(confirmed.readback.exerciseSet.items[2].sourceKind, 'generated', 'generated label must survive confirmation');

            await store.close();
            return { ok: true, ftsHits: slopeHits.length, rebuiltFtsCount: ftsCountAfterRestart, degradedSearchWorks: true, proposalConfirmed: true };
          }

          function openRaw(dataRoot) {
            return new Promise((resolveOpen, reject) => {
              const db = new sqlite3.Database(join(dataRoot, 'app.db'), (error) => (error ? reject(error) : resolveOpen(db)));
            });
          }

          async function rawSql(dataRoot, sql) {
            const db = await openRaw(dataRoot);
            try {
              await new Promise((resolveRun, reject) => db.run(sql, (error) => (error ? reject(error) : resolveRun())));
            } finally {
              await new Promise((resolveClose, reject) => db.close((error) => (error ? reject(error) : resolveClose())));
            }
          }

          async function rawQuery(dataRoot, sql) {
            const db = await openRaw(dataRoot);
            try {
              return await new Promise((resolveQuery, reject) => db.all(sql, (error, rows) => (error ? reject(error) : resolveQuery(rows))));
            } finally {
              await new Promise((resolveClose, reject) => db.close((error) => (error ? reject(error) : resolveClose())));
            }
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

    const { runQuestionBankSearchSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runQuestionBankSearchSmoke(dataRoot);
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
