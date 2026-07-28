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
    rmSync(bundleRoot, { recursive: true, force: true });
    rmSync(dataRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
