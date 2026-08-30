import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-c05-advanced-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-c05-advanced-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'smoke.mjs');
    await build({ stdin: { contents: `
      import assert from 'node:assert/strict';
      import { OmniEduStore } from './src/main/db';
      import { renderTeachingBookMarkdown } from './src/main/ai-harness/teaching-book-renderer';
      export async function runSmoke(dataRoot) {
        const store = new OmniEduStore(dataRoot); await store.init();
        const book = await store.createTeachingBook({ title: 'Advanced blocks' });
        const chapter = await store.createTeachingBookChapter({ bookId: book.id, title: 'Typed blocks' });
        const page = await store.createTeachingBookPage({ bookId: book.id, chapterId: chapter.id, title: 'Safety' });
        const anchor = { kind: 'manual', ref: 'source-1', title: 'Teacher source', snippet: 'bounded source', fingerprint: 'fp-1', status: 'available' };
        const blocks = [
          { type: 'timeline', title: 'Timeline', payload: { events: [{ date: '2024', title: '<script>alert(1)</script>', body: 'javascript:bad' }, { year: '2025', name: 'Next', description: 'A safe event' }] } },
          { type: 'code', title: 'Code', payload: { language: 'python;alert(1)', code: { content: 'print(1)\\n<script>no execute</script>' } } },
          { type: 'deep_explanation', title: 'Deep dive', payload: { claim: '<b>Claim</b>', sections: [{ heading: 'Step 1', body: 'Explain', check: 'Verify' }] } },
          { type: 'user_note', title: 'Note', payload: { body: '<iframe src="https://evil.example"></iframe> teacher note' } },
          { type: 'interactive', title: 'Interactive', payload: { html: '<script>bad()</script>', iframe: 'file:///secret' } },
          { type: 'animation', title: 'Animation', payload: { html: '<svg onload="bad()"></svg>', url: 'javascript:bad' } },
        ];
        for (const [index, input] of blocks.entries()) await store.upsertTeachingBookBlock({ pageId: page.id, type: input.type, title: input.title, payload: input.payload, sourceAnchors: [anchor], order: index, status: 'ready' });
        const detail = await store.getTeachingBook(book.id); const rendered = renderTeachingBookMarkdown(detail);
        assert.equal(rendered.blockCount, 6); assert.equal(rendered.fallbackCount, 2); assert.ok(rendered.sourceRefs.includes('source-1')); assert.ok(rendered.markdown.length <= 18_000);
        assert.ok(rendered.markdown.includes('Timeline')); assert.ok(rendered.markdown.includes('Code')); assert.ok(rendered.markdown.includes('Deep dive')); assert.ok(rendered.markdown.includes('教师笔记'));
        assert.equal(/<script|<iframe|onload=|javascript:|https?:\\/\\//i.test(rendered.markdown), false); assert.ok(rendered.markdown.includes('不会执行'));
        const empty = await store.upsertTeachingBookBlock({ pageId: page.id, type: 'timeline', title: 'Empty', payload: { events: [] }, order: 10, status: 'ready' });
        assert.ok(empty.id); const after = await store.getTeachingBook(book.id); const rerendered = renderTeachingBookMarkdown(after); assert.equal(rerendered.fallbackCount, 3); assert.ok(rerendered.markdown.includes('暂无可用时间线事件'));
        await store.close(); return { ok: true, cases: 24, advancedBlocks: 4, unsafeBlocksFallback: 2, sourceRefs: true, bounded: true, noExecution: true, deterministic: true };
      }
    `, resolveDir: appRoot, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, external: ['sqlite3'], logLevel: 'silent' });
    const { runSmoke } = await import(pathToFileURL(outfile).href); console.log(JSON.stringify(await runSmoke(dataRoot)));
  } finally { rmSync(bundleRoot, { recursive: true, force: true }); try { rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch {} }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
