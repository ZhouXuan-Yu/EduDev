import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-ai-tool-calling-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-tool-calling-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'tool-calling-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';
          import { routeAiPrompt } from './src/main/ai-harness/router';
          import {
            createAiToolExecutionState,
            executeAiToolCall,
            getModelToolDefinitions,
            reviewModelToolCall,
          } from './src/main/ai-harness/tool-registry';

          export async function runToolCallingSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            await store.init();
            const students = await store.listStudents('');
            const student = students.find((item) => item.displayName === '小A') ?? students[0];
            assert.ok(student, 'seed should provide at least one student');

            for (let index = 0; index < 12; index += 1) {
              await store.createRecord({
                studentId: student.id,
                recordType: '错题订正',
                subject: '数学',
                title: '长文本记录 ' + index,
                content: '方程计算与审题问题。'.repeat(120),
                tags: ['方程', '审题'],
              });
            }

            const prompt = '请根据小A最近的学习记录设计数学三元题组';
            const router = routeAiPrompt(prompt, { hasStudent: false });
            const tools = getModelToolDefinitions(router);
            assert.ok(tools.some((tool) => tool.function.name === 'resolve_student_reference'), 'allowed route should expose student resolver tool');
            assert.ok(tools.every((tool) => tool.function.parameters.additionalProperties === false), 'tool schemas should reject additional properties');

            const state = createAiToolExecutionState(router);
            const resolveResult = await executeAiToolCall({
              store,
              prompt,
              router,
              state,
              call: { name: 'resolve_student_reference', arguments: { studentName: '小A' } },
            });
            assert.equal(resolveResult.review.ok, true);
            assert.equal(resolveResult.toolRun.status, 'used');
            assert.ok(state.resolvedStudentId, 'student id should be resolved');

            const longRecordResult = await executeAiToolCall({
              store,
              prompt,
              router,
              state,
              call: { name: 'search_learning_records', arguments: { limit: 8 } },
            });
            assert.equal(longRecordResult.review.ok, true);
            assert.equal(longRecordResult.toolRun.status, 'used');
            assert.equal(longRecordResult.modelResult.truncated, true, 'long tool output should be bounded and marked truncated');

            const generalRouter = routeAiPrompt('你好', { hasStudent: false });
            const forbiddenReview = reviewModelToolCall({ name: 'get_student_profile', arguments: {} }, generalRouter);
            assert.equal(forbiddenReview.ok, false);
            assert.ok(forbiddenReview.errors.includes('route_allowlist_blocked'));

            const badParamReview = reviewModelToolCall({ name: 'search_learning_records', arguments: { limit: 999 } }, router);
            assert.equal(badParamReview.ok, false);
            assert.ok(badParamReview.errors.some((error) => error.includes('超过最大值')));

            // 组卷候选题目工具：practice_design 暴露、真实试卷提交进入确认队列、缺参/不存在试卷 blocked。
            assert.ok(tools.some((tool) => tool.function.name === 'generate_paper_question_candidates'), 'practice_design should expose paper candidate tool');
            const blueprint = await store.createPaperBlueprint({
              title: '工具调用测试蓝图',
              subject: '数学',
              grade: '初二',
              textbookVersion: '人教版',
              scope: '一次函数',
              knowledgePoints: ['一次函数'],
              typeSpecs: [{ questionType: '解答题', count: 2, pointsPerQuestion: 10 }],
              difficultyMix: { easy: 0, medium: 100, hard: 0 },
              durationMinutes: 45,
              sourcePreference: 'any',
            });
            const paper = await store.createPaperFromBlueprint({ blueprintId: blueprint.id });
            const candidateResult = await executeAiToolCall({
              store,
              prompt,
              router,
              state,
              call: {
                name: 'generate_paper_question_candidates',
                arguments: {
                  paperId: paper.id,
                  candidates: [
                    {
                      stem: '已知一次函数 y = 2x - 1，求 x = 3 时的函数值。',
                      answer: 'y = 5',
                      analysis: '代入 x = 3 得 y = 6 - 1 = 5。',
                      questionType: '解答题',
                      difficulty: 'easy',
                      knowledgePoint: '一次函数',
                      points: 10,
                    },
                  ],
                },
              },
            });
            assert.equal(candidateResult.review.ok, true, 'candidate tool call must pass review');
            assert.equal(candidateResult.toolRun.status, 'used', 'candidate tool must be used');
            assert.equal(candidateResult.modelResult.ok, true, 'candidate tool model result must be ok');
            assert.equal(candidateResult.modelResult.actionType, 'save_paper_candidates', 'tool must report the confirmation action');
            const pending = await store.listAiConfirmations('pending');
            const proposal = pending.find((item) => item.actionType === 'save_paper_candidates');
            assert.ok(proposal, 'tool must leave a pending confirmation item');
            assert.equal(proposal.payload.paperCandidates.paperId, paper.id, 'confirmation must reference the paper');

            const missingPaperId = await executeAiToolCall({
              store,
              prompt,
              router,
              state,
              call: { name: 'generate_paper_question_candidates', arguments: { candidates: [] } },
            });
            assert.equal(missingPaperId.review.ok, false, 'missing paperId must fail schema review');
            assert.equal(missingPaperId.toolRun.status, 'blocked', 'missing paperId must be blocked');
            assert.ok(missingPaperId.review.errors.some((error) => error.includes('缺少必填参数')), 'schema must report the missing required param');

            const missingPaper = await executeAiToolCall({
              store,
              prompt,
              router,
              state,
              call: { name: 'generate_paper_question_candidates', arguments: { paperId: 'paper_missing', candidates: [] } },
            });
            assert.equal(missingPaper.toolRun.status, 'blocked', 'missing paper must be blocked');
            assert.equal(missingPaper.modelResult.reason, 'paper_not_found');

            await store.close();
            return {
              ok: true,
              exportedTools: tools.map((tool) => tool.function.name),
              allowedToolStatus: resolveResult.toolRun.status,
              forbiddenReason: forbiddenReview.reason,
              badParamErrors: badParamReview.errors,
              boundedOutput: {
                truncated: longRecordResult.modelResult.truncated,
                previewLength: String(longRecordResult.modelResult.preview ?? '').length,
              },
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

    const { runToolCallingSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runToolCallingSmoke(dataRoot);
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
