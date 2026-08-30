import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-book-workspace-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-book-workspace-data-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'book-workspace-smoke.mjs');
    await build({ stdin: { contents: `
      import assert from 'node:assert/strict';
      import { OmniEduStore } from './src/main/db';
      import { routeAiPrompt } from './src/main/ai-harness/router';
      import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';
      import { executeHostToolRequest } from './src/main/ai-harness/host-tool-proxy';

      export async function runSmoke(dataRoot) {
        const store = new OmniEduStore(dataRoot); await store.init();
        const notebook = await store.createTeacherNotebook({ name: '讲义来源本' });
        const record = await store.addTeacherNotebookRecord({ notebookId: notebook.id, recordType: 'guided_learning', title: '一次函数核心概念', output: '变化率与斜率。' });
        const book = await store.createTeachingBook({ title: '一次函数专题讲义', description: '单元备课包', targetLevel: '初二' });
        const chapter = await store.createTeachingBookChapter({ bookId: book.id, title: '核心概念', learningObjectives: ['理解斜率'] });
        const page = await store.createTeachingBookPage({ bookId: book.id, chapterId: chapter.id, title: '斜率与变化率' });
        const source = await store.addTeachingBookSource({ bookId: book.id, kind: 'teacher_notebook', ref: record.id, title: record.title, snippet: record.output, fingerprint: record.updatedAt, status: 'available' });
        const block = await store.upsertTeachingBookBlock({ pageId: page.id, type: 'text', title: '概念解释', payload: { markdown: '斜率表示变化率。' }, sourceAnchors: [source], status: 'ready' });
        const healthy = await store.getTeachingBookHealth(book.id); assert.equal(healthy.status, 'healthy'); assert.deepEqual(healthy.staleBlockIds, []);
        const resetBlock = await store.regenerateTeachingBookBlock(block.id, block.version); assert.equal(resetBlock.status, 'pending'); assert.equal(resetBlock.version, 2);
        const resetPage = await store.regenerateTeachingBookPage(page.id, page.version); assert.equal(resetPage.status, 'pending'); assert.equal(resetPage.version, 2);
        await assert.rejects(() => store.regenerateTeachingBookBlock(block.id, 1), /版本冲突/);
        const readyBlock = await store.upsertTeachingBookBlock({ pageId: page.id, type: 'text', title: '概念解释', payload: { markdown: '更新后的解释。' }, sourceAnchors: [source], status: 'ready' }, block.id, resetBlock.version);
        const changedRecord = await store.updateTeacherNotebookRecord(record.id, { output: '变化率、斜率以及图像意义。', version: record.version });
        assert.ok(changedRecord.updatedAt !== record.updatedAt);
        const stale = await store.getTeachingBookHealth(book.id); assert.equal(stale.status, 'stale'); assert.ok(stale.staleBlockIds.includes(readyBlock.id)); assert.ok(stale.stalePageIds.includes(page.id));
        await store.deleteTeacherNotebookRecord(record.id);
        const missing = await store.getTeachingBookHealth(book.id); assert.equal(missing.status, 'missing_sources'); assert.ok(missing.missingSourceRefs.includes(record.id));

        const router = routeAiPrompt('检查一次函数专题讲义的来源健康', { hasStudent: false });
        assert.equal(router.route, 'lesson_design'); assert.equal(router.subIntent, 'book_workspace'); assert.deepEqual(router.contextPolicy.include, ['teaching_book']); assert.ok(router.allowedTools.includes('inspect_teaching_book'));
        const state = createAiToolExecutionState(router);
        const execution = await executeAiToolCall({ store, prompt: '检查一次函数专题讲义的来源健康', router, state, call: { name: 'inspect_teaching_book', arguments: { bookId: book.id } } });
        assert.equal(execution.toolRun.status, 'used'); assert.equal(execution.modelResult.schemaVersion, 'omni.teaching.book.v1'); assert.equal(execution.modelResult.health.status, 'missing_sources'); assert.ok(execution.modelResult.health.stalePageIds.includes(page.id)); assert.ok(JSON.stringify(execution.modelResult).length <= 6_000); assert.equal(state.sources.some((source) => source.id === book.id), true);
        const missingExecution = await executeAiToolCall({ store, prompt: '检查专题讲义', router, state, call: { name: 'inspect_teaching_book', arguments: { bookId: 'teaching_book_missing' } } });
        assert.equal(missingExecution.toolRun.status, 'blocked'); assert.equal(missingExecution.modelResult.reason, 'book_not_found');
        const blocked = await executeAiToolCall({ store, prompt: '你好', router: routeAiPrompt('你好', { hasStudent: false }), state: createAiToolExecutionState(routeAiPrompt('你好', { hasStudent: false })), call: { name: 'inspect_teaching_book', arguments: {} } });
        assert.equal(blocked.toolRun.status, 'blocked');
        const host = await executeHostToolRequest({ store, prompt: '检查一次函数专题讲义的来源健康', router, request: { schemaVersion: 'xiazhi.host_tool.request.v1', requestId: 'book-host', turnId: 'book-turn', capability: 'deep_research', prompt: '检查一次函数专题讲义的来源健康', toolName: 'inspect_teaching_book', arguments: { bookId: book.id } } });
        assert.equal(host.result.status, 'used'); assert.equal(host.result.review.ok, true);
        const detail = await store.getTeachingBook(book.id); assert.equal(detail.blocks.length, 1); assert.equal(detail.pages.length, 1); assert.equal(detail.chapters.length, 1);
        await store.close();
        return { ok: true, cases: 26, structuredBook: true, sourceHealth: true, staleGranularity: true, regeneration: true, versionConflicts: true, bounded: true, routeAware: true, hostRoundTrip: true, noStudentContext: true };
      }
    `, resolveDir: appRoot, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, external: ['sqlite3'], logLevel: 'silent' });
    const { runSmoke } = await import(pathToFileURL(outfile).href); console.log(JSON.stringify(await runSmoke(dataRoot)));
  } finally { rmSync(bundleRoot, { recursive: true, force: true }); try { rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch {} }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
