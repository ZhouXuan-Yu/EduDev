import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-book-cowriter-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-book-cowriter-data-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'book-cowriter-smoke.mjs');
    await build({ stdin: { contents: `
      import assert from 'node:assert/strict';
      import { OmniEduStore } from './src/main/db';
      import { routeAiPrompt } from './src/main/ai-harness/router';
      import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';

      export async function runSmoke(dataRoot) {
        const store = new OmniEduStore(dataRoot); await store.init();
        const book = await store.createTeachingBook({ title: '协作编辑测试' });
        const chapter = await store.createTeachingBookChapter({ bookId: book.id, title: '第一章' });
        const page = await store.createTeachingBookPage({ bookId: book.id, chapterId: chapter.id, title: '定义' });
        const block = await store.upsertTeachingBookBlock({ pageId: page.id, type: 'text', title: '旧标题', payload: { text: '旧内容' } });
        const router = routeAiPrompt('编辑讲义内容块并生成 patch', { hasStudent: false });
        assert.equal(router.route, 'lesson_design'); assert.equal(router.subIntent, 'book_workspace'); assert.ok(router.allowedTools.includes('draft_teaching_book_patch')); assert.equal(router.allowedTools.includes('get_student_profile'), false);
        const state = createAiToolExecutionState(router);
        const draft = await executeAiToolCall({ store, prompt: '编辑讲义内容块并生成 patch', router, state, call: { name: 'draft_teaching_book_patch', arguments: { bookId: book.id, blockId: block.id, baseVersion: block.version, title: '新标题', payload: { text: '新内容' }, reason: '教师请求精简表述' } } });
        assert.equal(draft.toolRun.status, 'used'); assert.equal(draft.modelResult.writesContent, false); assert.equal(draft.modelResult.requiresTeacherReview, true);
        const before = await store.getTeachingBook(book.id); assert.equal(before.blocks[0].title, '旧标题'); assert.equal(before.blocks[0].version, 1);
        const patch = draft.modelResult.patch; assert.equal(patch.status, 'draft'); assert.equal(patch.baseVersion, 1);
        const applied = await store.applyTeachingBookPatch(patch.id); assert.equal(applied.status, 'applied'); assert.equal(applied.resultVersion, 2);
        const afterApply = await store.getTeachingBook(book.id); assert.equal(afterApply.blocks[0].title, '新标题'); assert.equal(afterApply.blocks[0].payload.text, '新内容'); assert.equal(afterApply.blocks[0].version, 2);
        const history = await store.listTeachingBookPatches(book.id); assert.equal(history.length, 1);
        const undone = await store.undoTeachingBookPatch(patch.id); assert.equal(undone.status, 'undone');
        const afterUndo = await store.getTeachingBook(book.id); assert.equal(afterUndo.blocks[0].title, '旧标题'); assert.equal(afterUndo.blocks[0].payload.text, '旧内容'); assert.equal(afterUndo.blocks[0].version, 3);
        const staleDraft = await store.proposeTeachingBookBlockPatch({ bookId: book.id, blockId: block.id, baseVersion: 3, payload: { text: '候选' }, reason: '冲突测试' });
        await store.upsertTeachingBookBlock({ pageId: page.id, type: 'text', title: '老师新标题', payload: { text: '老师新内容' } }, block.id, 3);
        await assert.rejects(() => store.applyTeachingBookPatch(staleDraft.id), /版本冲突/);
        const rejectedHistory = await store.listTeachingBookPatches(book.id); assert.equal(rejectedHistory.find((item) => item.id === staleDraft.id)?.status, 'rejected');
        const missing = await executeAiToolCall({ store, prompt: '编辑讲义', router, state, call: { name: 'draft_teaching_book_patch', arguments: { bookId: 'missing-book', blockId: block.id, baseVersion: 1 } } }); assert.equal(missing.toolRun.status, 'blocked');
        await store.close(); return { ok: true, cases: 24, patchDraft: true, noWriteBeforeConfirm: true, applyReadback: true, undo: true, conflict: true, history: true, routeAware: true, failClosed: true };
      }
    `, resolveDir: appRoot, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, external: ['sqlite3'], logLevel: 'silent' });
    const { runSmoke } = await import(pathToFileURL(outfile).href); console.log(JSON.stringify(await runSmoke(dataRoot)));
  } finally { rmSync(bundleRoot, { recursive: true, force: true }); try { rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch {} }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
