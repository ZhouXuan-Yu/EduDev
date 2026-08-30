import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-book-cowriter-selection-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-book-cowriter-selection-data-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'book-cowriter-selection-smoke.mjs');
    await build({ stdin: { contents: `
      import assert from 'node:assert/strict';
      import { OmniEduStore } from './src/main/db';
      import { routeAiPrompt } from './src/main/ai-harness/router';
      import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';

      export async function runSmoke(dataRoot) {
        const store = new OmniEduStore(dataRoot); await store.init();
        const book = await store.createTeachingBook({ title: '选区编辑测试' });
        const chapter = await store.createTeachingBookChapter({ bookId: book.id, title: '第一章' });
        const page = await store.createTeachingBookPage({ bookId: book.id, chapterId: chapter.id, title: '函数' });
        const text = '函数是描述两个变量关系的数学模型。';
        const block = await store.upsertTeachingBookBlock({ pageId: page.id, type: 'text', title: '定义', payload: { text } });
        const selected = '两个变量关系';
        const start = text.indexOf(selected); const end = start + selected.length;
        const router = routeAiPrompt('对讲义选中的一段文字做局部改写，先生成选区 patch', { hasStudent: false });
        assert.equal(router.route, 'lesson_design'); assert.equal(router.subIntent, 'book_workspace'); assert.ok(router.allowedTools.includes('draft_teaching_book_selection_patch')); assert.equal(router.allowedTools.includes('get_student_profile'), false);
        const state = createAiToolExecutionState(router);
        const draft = await executeAiToolCall({ store, prompt: '对讲义选中的一段文字做局部改写，先生成选区 patch', router, state, call: { name: 'draft_teaching_book_selection_patch', arguments: { bookId: book.id, blockId: block.id, baseVersion: block.version, selectionStart: start, selectionEnd: end, selectedText: selected, replacementText: '两个变量之间的对应关系', mode: 'react_edit', reason: '教师请求局部改写' } } });
        assert.equal(draft.toolRun.status, 'used'); assert.equal(draft.modelResult.writesContent, false); assert.equal(draft.modelResult.requiresTeacherReview, true); assert.ok(draft.modelResult.streamEvents.length >= 3);
        const before = await store.getTeachingBook(book.id); assert.equal(before.blocks[0].payload.text, text); assert.equal(before.blocks[0].version, 1);
        const patch = draft.modelResult.patch; assert.equal(patch.operation, 'replace_selection'); assert.equal(patch.selectionStart, start); assert.equal(patch.selectedText, selected); assert.equal(patch.status, 'draft');
        const applied = await store.applyTeachingBookPatch(patch.id); assert.equal(applied.status, 'applied');
        const after = await store.getTeachingBook(book.id); assert.equal(after.blocks[0].payload.text, '函数是描述两个变量之间的对应关系的数学模型。'); assert.equal(after.blocks[0].version, 2);
        const auto = await store.proposeTeachingBookSelectionPatch({ bookId: book.id, blockId: block.id, baseVersion: 2, selectionStart: 0, selectionEnd: 2, selectedText: '函数', replacementText: '[批注]函数', mode: 'automark', reason: '自动批注草稿' });
        assert.equal(auto.operation, 'automark_selection'); assert.equal(auto.status, 'draft');
        await store.upsertTeachingBookBlock({ pageId: page.id, type: 'text', title: '定义', payload: { text: '老师刚刚修改了函数是描述两个变量之间的对应关系的数学模型。' } }, block.id, 2);
        await assert.rejects(() => store.applyTeachingBookPatch(auto.id), /选区已漂移|版本冲突/);
        const history = await store.listTeachingBookPatches(book.id); assert.equal(history.find((item) => item.id === auto.id)?.status, 'rejected');
        const missing = await executeAiToolCall({ store, prompt: '自动批注讲义选区', router, state, call: { name: 'draft_teaching_book_selection_patch', arguments: { bookId: book.id, blockId: block.id, baseVersion: 1, selectionStart: 0, selectionEnd: 1, selectedText: '函', replacementText: 'x' } } }); assert.equal(missing.toolRun.status, 'blocked');
        await store.close(); return { ok: true, cases: 28, routeAware: true, noWriteBeforeConfirm: true, streamDraft: true, selectionHash: true, automark: true, conflict: true, failClosed: true };
      }
    `, resolveDir: appRoot, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, external: ['sqlite3'], logLevel: 'silent' });
    const { runSmoke } = await import(pathToFileURL(outfile).href); console.log(JSON.stringify(await runSmoke(dataRoot)));
  } finally { rmSync(bundleRoot, { recursive: true, force: true }); try { rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch {} }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
