import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-ai-exercise-set-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-exercise-set-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'ai-exercise-set-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';
          import { routeAiPrompt } from './src/main/ai-harness/router';
          import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';

          export async function runAiExerciseSetSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            try {
              await store.init();
              const student = (await store.listStudents('小A'))[0];
              assert.ok(student, 'seed should provide 小A');

            await store.createQuestionBankItem({
              subject: '数学',
              grade: '初二',
              knowledgePoint: '一次函数',
              questionType: '相似题',
              difficulty: 'medium',
              stem: '一次函数 y = 2x - 1 中，x 每增加 1，y 如何变化？',
              answer: 'y 增加 2。',
              analysis: '斜率 k=2，表示 x 每增加 1，函数值增加 2。',
              sourceTitle: 'smoke 本地题库',
              tags: ['一次函数', '斜率'],
            });

            const directMatches = await store.searchQuestionBank({
              subject: '数学',
              knowledgePoint: '一次函数',
              query: '一次函数 斜率',
              limit: 6,
            });
            assert.ok(directMatches.length >= 1, 'question bank should return local matches');
            assert.ok(directMatches.some((item) => item.sourceKind === 'local_bank'), 'matches should keep local_bank source kind');

            const router = routeAiPrompt('按小A错因设计三元题组并保存', { hasStudent: false });
            assert.equal(router.route, 'practice_design');
            assert.equal(router.subIntent, 'triplet_practice');
            assert.ok(router.allowedTools.includes('search_similar_questions'), 'practice route should allow similar-question search');
            assert.ok(router.contextPolicy.include.includes('question_bank'), 'practice route should include question_bank context');

            const state = createAiToolExecutionState(router);
            const execution = await executeAiToolCall({
              store,
              prompt: '围绕一次函数生成相似题',
              router,
              state,
              call: {
                name: 'search_similar_questions',
                arguments: {
                  subject: '数学',
                  knowledgePoint: '一次函数',
                  query: '一次函数 斜率',
                  limit: 6,
                },
              },
            });
            assert.equal(execution.review.ok, true);
            assert.equal(execution.toolRun.status, 'used');
            assert.ok(state.similarQuestions.length >= 1, 'tool should populate similarQuestions');

            const beforeSets = await store.listExerciseSets(student.id);
            const contentMd = '# 小A 一次函数三元题组\\n\\n## 原题\\n观察 k 值和图像增减性。\\n\\n## 相似题\\n使用本地题库命中题巩固斜率含义。\\n\\n## 变式题\\n反向给出图像变化，判断 k 的符号。';
            const confirmation = await store.createAiConfirmation({
              runId: 'run_exercise_smoke',
              sessionId: 'session_exercise_smoke',
              studentId: student.id,
              actionType: 'save_exercise_set',
              title: '小A 一次函数三元题组',
              description: '题组确认保存 smoke',
              previewMd: contentMd,
              payload: {
                studentId: student.id,
                subject: '数学',
                startDate: '',
                endDate: '',
                reportType: 'exercise_set',
                title: '小A 一次函数三元题组',
                contentMd,
                sourceRecordIds: [],
                exerciseSet: {
                  title: '小A 一次函数三元题组',
                  subject: '数学',
                  knowledgePoint: '一次函数',
                  contentMd,
                  sourceQuestionIds: state.similarQuestions.map((item) => item.id),
                  items: [
                    {
                      role: 'similar',
                      questionId: state.similarQuestions[0].id,
                      sourceKind: state.similarQuestions[0].sourceKind,
                      stem: state.similarQuestions[0].stem,
                      answer: state.similarQuestions[0].answer,
                      analysis: state.similarQuestions[0].analysis,
                      knowledgePoint: state.similarQuestions[0].knowledgePoint,
                      difficulty: state.similarQuestions[0].difficulty,
                      teacherObservation: '观察学生是否能说明 k 的意义。',
                    },
                    {
                      role: 'variant',
                      sourceKind: 'generated',
                      stem: '若一次函数图像随 x 增大而下降，请判断 k 的符号并说明理由。',
                      answer: 'k < 0。',
                      analysis: '一次函数斜率为负时，函数值随 x 增大而减小。',
                      knowledgePoint: '一次函数',
                      difficulty: 'medium',
                      teacherObservation: '观察学生是否能从变化趋势反推 k 的符号。',
                    },
                  ],
                },
              },
            });
            assert.equal((await store.listExerciseSets(student.id)).length, beforeSets.length, 'pending confirmation must not write exercise set');
            const confirmed = await store.confirmAiConfirmation(confirmation.id);
            assert.equal(confirmed.item.status, 'confirmed');
            assert.ok(confirmed.readback?.exerciseSet, 'confirmation should return exercise set readback');
            assert.equal(confirmed.readback.exerciseSet.title, '小A 一次函数三元题组');
            assert.equal(confirmed.readback.exerciseSet.items.length, 2);
            assert.equal((await store.listExerciseSets(student.id)).length, beforeSets.length + 1, 'confirming should write exactly one exercise set');
            await assert.rejects(() => store.confirmAiConfirmation(confirmation.id), /只能确认待确认项/);

              return {
                ok: true,
                directMatches: directMatches.length,
                toolStatus: execution.toolRun.status,
                beforeSets: beforeSets.length,
                afterSets: beforeSets.length + 1,
                exerciseSetId: confirmed.readback.exerciseSet.id,
                sourceQuestionCount: confirmed.readback.exerciseSet.sourceQuestionIds.length,
              };
            } finally {
              await store.close();
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

    const { runAiExerciseSetSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runAiExerciseSetSmoke(dataRoot);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
