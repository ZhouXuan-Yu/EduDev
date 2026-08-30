import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-notebook-analysis-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-notebook-analysis-data-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'notebook-analysis-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';
          import { routeAiPrompt } from './src/main/ai-harness/router';
          import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';
          import { executeHostToolRequest } from './src/main/ai-harness/host-tool-proxy';

          export async function runSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            await store.init();
            const first = await store.createTeacherNotebook({ name: '初二数学备课本', description: '一次函数课堂资料' });
            const second = await store.createTeacherNotebook({ name: '英语备课本', description: '阅读课草稿' });
            const secret = '13800138000';
            const firstRecord = await store.addTeacherNotebookRecord({ notebookId: first.id, recordType: 'guided_learning', title: '一次函数课堂草稿', userQuery: '如何讲斜率', output: '先用两个点比较变化率。教师联系方式 ' + secret, summary: '斜率概念与课堂引导' });
            await store.addTeacherNotebookRecord({ notebookId: first.id, recordType: 'chat', title: '概率统计草稿', userQuery: '随机事件', output: '频率与概率的区别。' });
            await store.addTeacherNotebookRecord({ notebookId: second.id, recordType: 'guided_learning', title: '英语阅读导入', userQuery: '课堂导入', output: '先看标题再预测。' });

            const router = routeAiPrompt('总结备课本中的一次函数笔记', { hasStudent: false });
            assert.equal(router.route, 'knowledge_retrieval');
            assert.ok(router.contextPolicy.include.includes('teacher_notebook'));
            assert.ok(router.allowedTools.includes('analyze_notebook_context'));
            assert.equal(router.allowedTools.includes('get_student_profile'), false);

            const state = createAiToolExecutionState(router);
            const before = (await store.listTeacherNotebookRecords(first.id)).map((item) => [item.id, item.version]);
            const execution = await executeAiToolCall({ store, prompt: '总结备课本中的一次函数笔记', router, state, call: { name: 'analyze_notebook_context', arguments: { query: '一次函数', mode: 'context' } } });
            assert.equal(execution.toolRun.status, 'used');
            assert.equal(execution.modelResult.analysis.schemaVersion, 'omni.notebook.analysis.v1');
            assert.ok(execution.modelResult.analysis.coverage.detailCount <= 5);
            assert.ok(execution.modelResult.analysis.coverage.omittedCount >= 0);
            assert.equal(JSON.stringify(execution.modelResult).includes(secret), false);
            assert.equal(JSON.stringify(execution.modelResult).includes('[手机号]'), true);
            assert.ok(JSON.stringify(execution.modelResult).length <= 5_000);
            assert.ok(state.sources.some((source) => source.id === 'teacher_notebook'));
            assert.deepEqual((await store.listTeacherNotebookRecords(first.id)).map((item) => [item.id, item.version]), before);

            const summary = await executeAiToolCall({ store, prompt: '总结这条备课本记录', router, state, call: { name: 'analyze_notebook_context', arguments: { mode: 'record_summary', notebookId: first.id, recordId: firstRecord.id } } });
            assert.equal(summary.toolRun.status, 'used');
            assert.equal(summary.modelResult.analysis.summaryDraft.requiresTeacherReview, true);
            assert.ok(['stored_summary', 'bounded_output_excerpt'].includes(summary.modelResult.analysis.summaryDraft.basis));

            const crossNotebook = await executeAiToolCall({ store, prompt: '总结备课本', router, state, call: { name: 'analyze_notebook_context', arguments: { notebookId: 'notebook_missing' } } });
            assert.equal(crossNotebook.toolRun.status, 'blocked');
            assert.equal(crossNotebook.modelResult.reason, 'notebook_not_found');
            const missingRecord = await executeAiToolCall({ store, prompt: '总结备课本', router, state, call: { name: 'analyze_notebook_context', arguments: { mode: 'record_summary', notebookId: first.id, recordId: 'record_missing' } } });
            assert.equal(missingRecord.toolRun.status, 'blocked');
            assert.equal(missingRecord.modelResult.reason, 'record_not_found');

            const oversized = await executeAiToolCall({ store, prompt: '总结笔记 ' + 'x'.repeat(2_000), router, state, call: { name: 'analyze_notebook_context', arguments: { query: 'x'.repeat(1_001) } } });
            assert.equal(oversized.review.ok, false);
            assert.ok(oversized.review.errors.some((item) => item.includes('query')));

            const host = await executeHostToolRequest({
              store,
              prompt: '总结备课本中的一次函数笔记',
              router,
              request: { schemaVersion: 'xiazhi.host_tool.request.v1', requestId: 'notebook-host', turnId: 'notebook-turn', capability: 'chat', prompt: '总结备课本中的一次函数笔记', toolName: 'analyze_notebook_context', arguments: { query: '一次函数' } },
            });
            assert.equal(host.result.status, 'used');
            assert.equal(host.result.review.ok, true);
            await store.close();
            return { ok: true, cases: 14, routeAware: true, sanitized: true, bounded: true, noWrite: true, crossNotebookBlocked: true, hostRoundTrip: true };
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
    const { runSmoke } = await import(pathToFileURL(outfile).href);
    console.log(JSON.stringify(await runSmoke(dataRoot)));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
    try { rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* SQLite may still release its temp handle after a failed assertion. */ }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
