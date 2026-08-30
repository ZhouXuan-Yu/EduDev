import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-book-planner-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-book-planner-data-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'book-planner-smoke.mjs');
    await build({ stdin: { contents: `
      import assert from 'node:assert/strict';
      import { writeFileSync } from 'node:fs';
      import { join } from 'node:path';
      import { OmniEduStore } from './src/main/db';
      import { routeAiPrompt } from './src/main/ai-harness/router';
      import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';

      export async function runSmoke(dataRoot) {
        const sourcePath = join(dataRoot, '一次函数资料.md'); writeFileSync(sourcePath, '# 一次函数\\n\\n斜率表示变化率。\\n\\n常见错误是混淆截距和斜率。');
        const store = new OmniEduStore(dataRoot); await store.init(); await store.importKnowledgeResources([sourcePath]);
        const book = await store.createTeachingBook({ title: '一次函数专题讲义', description: '面向初二的章节规划' });
        const router = routeAiPrompt('规划一次函数专题讲义的章节骨架', { hasStudent: false });
        assert.equal(router.route, 'lesson_design'); assert.equal(router.subIntent, 'book_workspace'); assert.deepEqual(router.contextPolicy.include, ['teaching_book', 'teacher_knowledge']); assert.ok(router.allowedTools.includes('plan_teaching_book')); assert.ok(router.allowedTools.includes('search_teacher_knowledge')); assert.equal(router.allowedTools.includes('get_student_profile'), false);
        const state = createAiToolExecutionState(router); const execution = await executeAiToolCall({ store, prompt: '规划一次函数专题讲义的章节骨架', router, state, call: { name: 'plan_teaching_book', arguments: { bookId: book.id, query: '一次函数', limit: 6 } } });
        assert.equal(execution.toolRun.status, 'used'); assert.equal(execution.modelResult.analysis.schemaVersion, 'omni.teaching.book.plan.v1'); assert.ok(execution.modelResult.analysis.coverage.sourceChunks >= 1); assert.ok(execution.modelResult.analysis.chapters.length >= 1); assert.equal(execution.modelResult.writesBook, false); assert.equal(execution.modelResult.requiresTeacherReview, true); assert.ok(JSON.stringify(execution.modelResult).length <= 5_000); assert.ok(state.sources.some((source) => source.id === book.id));
        const before = await store.getTeachingBook(book.id); const missing = await executeAiToolCall({ store, prompt: '规划讲义', router, state, call: { name: 'plan_teaching_book', arguments: { bookId: 'teaching_book_missing' } } }); assert.equal(missing.toolRun.status, 'blocked'); assert.equal(missing.modelResult.reason, 'book_not_found'); const after = await store.getTeachingBook(book.id); assert.equal(after.book.version, before.book.version); assert.equal(after.chapters.length, 0); assert.equal(after.pages.length, 0);
        const noHits = await executeAiToolCall({ store, prompt: '规划讲义章节骨架', router, state, call: { name: 'plan_teaching_book', arguments: { bookId: book.id, query: '不存在的主题' } } }); assert.equal(noHits.toolRun.status, 'used'); assert.equal(noHits.modelResult.analysis.coverage.sourceChunks, 0); assert.ok(noHits.modelResult.analysis.unknowns.length > 0);
        await store.close(); return { ok: true, cases: 20, sourceExplore: true, spineFallback: true, bounded: true, teacherReviewBoundary: true, failClosed: true, noWrite: true, noStudentContext: true };
      }
    `, resolveDir: appRoot, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, external: ['sqlite3'], logLevel: 'silent' });
    const { runSmoke } = await import(pathToFileURL(outfile).href); console.log(JSON.stringify(await runSmoke(dataRoot)));
  } finally { rmSync(bundleRoot, { recursive: true, force: true }); try { rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch {} }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
