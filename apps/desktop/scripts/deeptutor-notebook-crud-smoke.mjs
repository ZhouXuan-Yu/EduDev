import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-notebook-crud-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-notebook-crud-data-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'notebook-crud-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';

          export async function runSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            await store.init();
            const notebook = await store.createTeacherNotebook({ name: '初二数学备课本', description: '函数与错题复盘' });
            assert.equal(notebook.status, 'active');
            assert.equal(notebook.version, 1);
            const record = await store.addTeacherNotebookRecord({ notebookId: notebook.id, recordType: 'guided_learning', title: '一次函数课堂草稿', userQuery: '如何讲斜率', output: '先用两个点比较变化率。', summary: '斜率概念与课堂引导', metadata: { sourceQuestionId: 'q_1' } });
            assert.equal(record.version, 1);
            assert.equal((await store.listTeacherNotebookRecords(notebook.id)).length, 1);
            const updated = await store.updateTeacherNotebookRecord(record.id, { version: 1, summary: '教师修正后的摘要' });
            assert.equal(updated.version, 2);
            await assert.rejects(() => store.updateTeacherNotebookRecord(record.id, { version: 1, summary: '过期写入' }), /版本冲突/);
            const updatedNotebook = await store.updateTeacherNotebook(notebook.id, { version: 2, description: '教师修正描述' });
            assert.equal(updatedNotebook.version, 3);
            await assert.rejects(() => store.updateTeacherNotebook(notebook.id, { version: 1, description: '过期写入' }), /版本冲突/);
            const deleted = await store.deleteTeacherNotebook(notebook.id);
            assert.equal(deleted.status, 'deleted');
            assert.equal((await store.listTeacherNotebooks()).some((item) => item.id === notebook.id), false);
            assert.equal((await store.listTeacherNotebooks(true)).find((item) => item.id === notebook.id)?.status, 'deleted');
            await assert.rejects(() => store.addTeacherNotebookRecord({ notebookId: notebook.id, recordType: 'chat', title: '不应写入', output: 'x' }), /已删除/);
            const restored = await store.restoreTeacherNotebook(notebook.id);
            assert.equal(restored.status, 'active');
            const recordAfterRestore = await store.addTeacherNotebookRecord({ notebookId: notebook.id, recordType: 'chat', title: '恢复后记录', output: '继续备课。' });
            assert.equal(recordAfterRestore.notebookId, notebook.id);
            const deletedRecord = await store.deleteTeacherNotebookRecord(record.id);
            assert.ok(deletedRecord.deletedAt);
            assert.equal((await store.listTeacherNotebookRecords(notebook.id)).length, 1);
            assert.equal((await store.listTeacherNotebookRecords(notebook.id, true)).length, 2);
            await store.close();
            return { ok: true, cases: 14, softDeleteRestore: true, versionConflicts: 2, recordCountAfterRestore: 1 };
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
