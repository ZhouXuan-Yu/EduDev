import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-book-renderer-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-book-renderer-data-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'book-renderer-smoke.mjs');
    await build({ stdin: { contents: `
      import assert from 'node:assert/strict';
      import { OmniEduStore } from './src/main/db';
      import { renderTeachingBookMarkdown } from './src/main/ai-harness/teaching-book-renderer';
      import { routeAiPrompt } from './src/main/ai-harness/router';
      import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';

      export async function runSmoke(dataRoot) {
        const store = new OmniEduStore(dataRoot); await store.init();
        const book = await store.createTeachingBook({ title: '块渲染验收讲义' });
        const chapter = await store.createTeachingBookChapter({ bookId: book.id, title: '渲染组件' });
        const page = await store.createTeachingBookPage({ bookId: book.id, chapterId: chapter.id, title: '预览页' });
        const blocks = [
          { type: 'text', title: '正文', payload: { body: '这是正文。' } },
          { type: 'chapter', title: '章节', payload: { markdown: '章节 Markdown。' } },
          { type: 'quiz', title: '小测', payload: { questions: [{ question: '1+1=?', options: { A: '1', B: '2' }, correct_answer: 'B', explanation: '加法。' }] } },
          { type: 'card', title: '闪卡', payload: { cards: [{ front: '斜率', back: '变化率', hint: '两个点' }] } },
          { type: 'figure', title: '图形', payload: { description: '一个图', code: { language: 'mermaid', content: 'graph TD\\n A-->B' } } },
          { type: 'concept_graph', title: '概念图', payload: { graph: { nodes: [{ id: 'a' }], edges: [] }, code: { content: 'graph TD\\n A[概念]' } } },
          { type: 'prompt', title: '追问', payload: { prompt: '你还想了解什么？' } },
          { type: 'unknown_type', title: '未知', payload: {} },
        ];
        for (const [index, input] of blocks.entries()) await store.upsertTeachingBookBlock({ pageId: page.id, type: input.type as any, title: input.title, payload: input.payload, order: index, status: 'ready' });
        const detail = await store.getTeachingBook(book.id);
        const rendered = renderTeachingBookMarkdown(detail);
        assert.equal(rendered.schemaVersion, 'omni.teaching.book.markdown.v1'); assert.equal(rendered.blockCount, 8); assert.equal(rendered.fallbackCount, 1); assert.ok(rendered.markdown.includes('1+1=?')); assert.ok(rendered.markdown.includes(String.fromCharCode(96).repeat(3) + 'mermaid')); assert.ok(rendered.markdown.includes('未支持的内容块类型')); assert.ok(rendered.markdown.length <= 18_000);
        const artifact = await store.exportDocumentArtifact({ artifactId: 'book-renderer-export', title: book.title, type: 'markdown', fileName: 'book-renderer.md', contentMd: rendered.markdown, description: 'teacher-confirmed book preview' });
        assert.equal(artifact.status, 'exported'); assert.ok(artifact.filePath); assert.ok(artifact.contentHash); assert.ok(artifact.fileSize > 0); assert.equal((await store.getDocumentArtifact(artifact.id))?.status, 'exported');
        const router = routeAiPrompt('把这个专题讲义生成 Markdown 预览', { hasStudent: false }); assert.equal(router.subIntent, 'book_workspace'); assert.ok(router.allowedTools.includes('draft_teaching_book_markdown')); assert.deepEqual(router.contextPolicy.include, ['teaching_book']);
        const state = createAiToolExecutionState(router); const execution = await executeAiToolCall({ store, prompt: '把这个专题讲义生成 Markdown 预览', router, state, call: { name: 'draft_teaching_book_markdown', arguments: { bookId: book.id } } });
        assert.equal(execution.toolRun.status, 'used'); assert.equal(execution.modelResult.analysis.schemaVersion, 'omni.teaching.book.markdown.v1'); assert.equal(execution.modelResult.writesFile, false); assert.equal(execution.modelResult.requiresTeacherReview, true); assert.ok(JSON.stringify(execution.modelResult).length <= 5_000);
        const missing = await executeAiToolCall({ store, prompt: '预览讲义', router, state, call: { name: 'draft_teaching_book_markdown', arguments: { bookId: 'teaching_book_missing' } } }); assert.equal(missing.toolRun.status, 'blocked'); assert.equal(missing.modelResult.reason, 'book_not_found');
        const after = await store.getTeachingBook(book.id); assert.equal(after.blocks.length, 8); await store.close();
        return { ok: true, cases: 28, allSupportedBlocks: true, safeFallback: true, bounded: true, previewOnly: true, teacherReviewBoundary: true, failClosed: true, artifactExport: true, noWriteBeforeExport: true };
      }
    `, resolveDir: appRoot, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, external: ['sqlite3'], logLevel: 'silent' });
    const { runSmoke } = await import(pathToFileURL(outfile).href); console.log(JSON.stringify(await runSmoke(dataRoot)));
  } finally { rmSync(bundleRoot, { recursive: true, force: true }); try { rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch {} }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
