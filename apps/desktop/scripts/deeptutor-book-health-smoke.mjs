import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-book-health-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-book-health-data-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'book-health-smoke.mjs');
    await build({ stdin: { contents: `
      import assert from 'node:assert/strict';
      import { OmniEduStore } from './src/main/db';
      import { routeAiPrompt } from './src/main/ai-harness/router';
      import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';

      export async function runSmoke(dataRoot) {
        const store = new OmniEduStore(dataRoot); await store.init();
        const notebook = await store.createTeacherNotebook({ name: '来源健康测试' });
        const record = await store.addTeacherNotebookRecord({ notebookId: notebook.id, recordType: 'chat', title: '函数来源', output: '初始内容' });
        const book = await store.createTeachingBook({ title: '函数专题讲义' });
        await store.addTeachingBookSource({ bookId: book.id, kind: 'teacher_notebook', ref: record.id, title: record.title, snippet: record.output, fingerprint: record.updatedAt, status: 'available' });
        const chapter = await store.createTeachingBookChapter({ bookId: book.id, title: '函数基础' });
        const page = await store.createTeachingBookPage({ bookId: book.id, chapterId: chapter.id, title: '定义' });
        const block = await store.upsertTeachingBookBlock({ pageId: page.id, type: 'text', title: '定义', payload: { text: '函数' }, sourceAnchors: [{ kind: 'teacher_notebook', ref: record.id, title: record.title, snippet: record.output, fingerprint: record.updatedAt, status: 'available' }] });
        assert.equal((await store.getTeachingBookHealth(book.id)).status, 'healthy');
        await store.updateTeachingBook(book.id, { version: book.version, status: 'ready' });
        const updated = await store.updateTeacherNotebookRecord(record.id, { version: record.version, output: '更新后的内容' });
        const stale = await store.refreshTeachingBookHealth(book.id);
        assert.equal(stale.status, 'stale'); assert.deepEqual(stale.stalePageIds, [page.id]); assert.deepEqual(stale.staleBlockIds, [block.id]);
        const staleDetail = await store.getTeachingBook(book.id); assert.equal(staleDetail.sources[0].status, 'stale'); assert.equal(staleDetail.book.status, 'partial');
        const open = await store.listTeachingBookInvalidations(book.id); assert.equal(open.length, 1); assert.deepEqual(open[0].staleBlockIds, [block.id]);
        await store.addTeachingBookSource({ bookId: book.id, kind: 'teacher_notebook', ref: record.id, title: record.title, snippet: updated.output, fingerprint: updated.updatedAt, status: 'available' });
        const healthy = await store.refreshTeachingBookHealth(book.id); assert.equal(healthy.status, 'healthy');
        const finalDetail = await store.getTeachingBook(book.id); assert.equal(finalDetail.sources[0].status, 'available'); assert.equal(finalDetail.book.status, 'ready');
        const history = await store.listTeachingBookInvalidations(book.id, true); assert.equal(history.length, 1); assert.equal(history[0].status, 'resolved');
        const router = routeAiPrompt('刷新专题讲义的来源指纹健康并定位失效块', { hasStudent: false });
        assert.equal(router.route, 'lesson_design'); assert.equal(router.subIntent, 'book_workspace'); assert.ok(router.allowedTools.includes('refresh_teaching_book_health')); assert.equal(router.allowedTools.includes('get_student_profile'), false);
        const state = createAiToolExecutionState(router);
        const execution = await executeAiToolCall({ store, prompt: '刷新专题讲义的来源指纹健康并定位失效块', router, state, call: { name: 'refresh_teaching_book_health', arguments: { bookId: book.id } } });
        assert.equal(execution.toolRun.status, 'used'); assert.equal(execution.modelResult.ok, true); assert.equal(execution.modelResult.health.status, 'healthy'); assert.equal(execution.modelResult.health.staleBlockIds.length, 0); assert.equal(execution.modelResult.writesContent, false);
        const missing = await executeAiToolCall({ store, prompt: '刷新讲义健康', router, state, call: { name: 'refresh_teaching_book_health', arguments: { bookId: 'missing-book' } } }); assert.equal(missing.toolRun.status, 'blocked');
        await store.close(); return { ok: true, cases: 24, fingerprint: true, localizedInvalidation: true, queuePersistence: true, resolvedHistory: true, statusPersistence: true, toolBoundary: true, failClosed: true };
      }
    ` , resolveDir: appRoot, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, external: ['sqlite3'], logLevel: 'silent' });
    const { runSmoke } = await import(pathToFileURL(outfile).href); console.log(JSON.stringify(await runSmoke(dataRoot)));
  } finally { rmSync(bundleRoot, { recursive: true, force: true }); try { rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch {} }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
