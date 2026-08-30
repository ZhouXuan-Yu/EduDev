import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-question-notebook-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-question-notebook-data-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'question-notebook-smoke.mjs');
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
            const phone = '13912345678';
            const q1 = await store.createQuestionBankItem({ subject: '数学', grade: '初二', knowledgePoint: '一次函数', questionType: '解答题', difficulty: 'medium', stem: '已知一次函数经过两点，求斜率。教师电话 ' + phone, answer: '先求斜率。', analysis: '使用两点式。', sourceTitle: '老师题库', tags: ['一次函数', '待讲解'] });
            const q2 = await store.createQuestionBankItem({ subject: '数学', grade: '初二', knowledgePoint: '一次函数', questionType: '变式题', difficulty: 'hard', stem: '判断函数图像的增减性。', answer: '看斜率符号。', analysis: '斜率为正则递增。', sourceTitle: '老师题库', tags: ['一次函数'] });
            await store.createQuestionBankItem({ subject: '英语', grade: '初二', knowledgePoint: '阅读理解', questionType: '选择题', difficulty: 'easy', stem: '根据短文选择答案。', answer: 'A', sourceTitle: '英语题库' });
            const category = await store.createQuestionNotebookCategory({ name: '待讲解' });
            assert.equal(category.status, 'active');
            const bookmarked = await store.setQuestionNotebookBookmark({ questionId: q1.id, bookmarked: true });
            assert.equal(bookmarked.bookmarked, true);
            assert.equal(bookmarked.version, 1);
            const categorised = await store.addQuestionNotebookCategory(q1.id, category.id);
            assert.equal(categorised.categories.length, 1);
            assert.equal(categorised.categories[0].name, '待讲解');
            const q1Usage = await store.recordQuestionBankUsage({ questionId: q1.id, usageType: 'manual', usageId: 'teacher-review-1', metadata: { purpose: '讲解' } });
            assert.equal(q1Usage.usageType, 'manual');
            await assert.rejects(() => store.setQuestionNotebookBookmark({ questionId: q1.id, bookmarked: false, version: 0 }), /版本冲突/);
            const student = (await store.listStudents(''))[0];
            const set = await store.saveExerciseSetFromDraft(student.id, { title: '一次函数复习题组', subject: '数学', knowledgePoint: '一次函数', contentMd: '题组', sourceQuestionIds: [q1.id, q2.id], items: [] });
            assert.ok(set.id.startsWith('exercise_set_'));
            assert.equal((await store.listQuestionNotebookUsage(q1.id)).length, 2);
            const listed = await store.listQuestionNotebook({ bookmarked: true, categoryId: category.id, query: '一次函数' });
            assert.equal(listed.total, 1);
            assert.equal(listed.items[0].id, q1.id);
            assert.equal(listed.items[0].usageCount, 2);
            const renamed = await store.updateQuestionNotebookCategory(category.id, { name: '本周待讲解', version: category.version });
            assert.equal(renamed.name, '本周待讲解');
            await assert.rejects(() => store.updateQuestionNotebookCategory(category.id, { name: '过期分类', version: category.version }), /版本冲突/);
            const deleted = await store.deleteQuestionNotebookCategory(category.id);
            assert.equal(deleted.status, 'deleted');
            assert.equal((await store.listQuestionNotebook({ categoryId: category.id })).total, 0);
            const restored = await store.restoreQuestionNotebookCategory(category.id);
            assert.equal(restored.status, 'active');
            await assert.rejects(() => store.addQuestionNotebookCategory('question_missing', category.id), /题目不存在/);
            await assert.rejects(() => store.recordQuestionBankUsage({ questionId: 'question_missing', usageType: 'manual' }), /题目不存在/);

            const router = routeAiPrompt('列出我收藏的一次函数题目', { hasStudent: false });
            assert.equal(router.route, 'practice_design');
            assert.equal(router.subIntent, 'question_notebook');
            assert.ok(router.contextPolicy.include.includes('question_notebook'));
            assert.ok(router.allowedTools.includes('search_question_notebook'));
            assert.equal(router.contextPolicy.include.includes('teacher_notebook'), false);
            const state = createAiToolExecutionState(router);
            const execution = await executeAiToolCall({ store, prompt: '列出我收藏的一次函数题目', router, state, call: { name: 'search_question_notebook', arguments: { query: '一次函数', bookmarked: true } } });
            assert.equal(execution.toolRun.status, 'used');
            assert.equal(execution.modelResult.analysis.schemaVersion, 'omni.question.notebook.v1');
            assert.equal(JSON.stringify(execution.modelResult).includes(phone), false);
            assert.equal(JSON.stringify(execution.modelResult).includes('[手机号]'), true);
            assert.ok(JSON.stringify(execution.modelResult).length <= 5_000);
            assert.ok(state.sources.some((source) => source.id === 'question_notebook'));
            const beforeVersion = (await store.getQuestionNotebookEntry(q1.id)).version;
            const oversized = await executeAiToolCall({ store, prompt: '列出收藏题目', router, state, call: { name: 'search_question_notebook', arguments: { query: 'x'.repeat(241) } } });
            assert.equal(oversized.review.ok, false);
            assert.ok(oversized.review.errors.some((item) => item.includes('query')));
            const blockedRoute = await executeAiToolCall({ store, prompt: '你好', router: routeAiPrompt('你好', { hasStudent: false }), state: createAiToolExecutionState(routeAiPrompt('你好', { hasStudent: false })), call: { name: 'search_question_notebook', arguments: {} } });
            assert.equal(blockedRoute.toolRun.status, 'blocked');
            assert.equal((await store.getQuestionNotebookEntry(q1.id)).version, beforeVersion);
            const host = await executeHostToolRequest({
              store,
              prompt: '列出我收藏的一次函数题目',
              router,
              request: { schemaVersion: 'xiazhi.host_tool.request.v1', requestId: 'question-notebook-host', turnId: 'question-notebook-turn', capability: 'deep_question', prompt: '列出我收藏的一次函数题目', toolName: 'search_question_notebook', arguments: { bookmarked: true, query: '一次函数' } },
            });
            assert.equal(host.result.status, 'used');
            assert.equal(host.result.review.ok, true);
            await store.close();
            return { ok: true, cases: 22, canonicalQuestionSource: true, bookmarks: true, categories: true, usageHistory: true, versionConflicts: 2, sanitised: true, bounded: true, hostRoundTrip: true, noDuplicateCorpus: true };
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
