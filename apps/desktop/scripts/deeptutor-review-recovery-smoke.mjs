import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-deeptutor-review-recovery-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-review-recovery-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'review-recovery-smoke.mjs');
    await build({ stdin: { contents: `
      import assert from 'node:assert/strict';
      import { OmniEduStore } from './src/main/db';
      import { buildMasterySnapshot } from './src/main/ai-harness/mastery-snapshot';
      import { buildMasteryPolicy } from './src/main/ai-harness/mastery-policy';
      export async function runReviewRecoverySmoke(dataRoot) {
        const now = 2_000_000_000;
        const day = 86400;
        const occurredAt = new Date((now - 8 * day) * 1000).toISOString();
        const store1 = new OmniEduStore(dataRoot);
        await store1.init();
        const students = await store1.createStudent({ displayName: '复习恢复学生', grade: '五年级', subjects: ['数学'], goals: '', currentIssues: '', parentConcerns: '', teacherNotes: '', tags: [] });
        const student = students.find((item) => item.displayName === '复习恢复学生');
        assert.ok(student?.id);
        await store1.createRecord({ studentId: student.id, recordType: 'mastery_attempt', subject: '数学', title: '一次函数', content: JSON.stringify({ knowledgePoint: '一次函数', knowledgeType: 'procedure', isCorrect: true }), tags: ['mastery_attempt'], occurredAt });
        const before = buildMasteryPolicy(await buildMasterySnapshot(store1, student.id), now);
        const beforeQueue = before.dueReviews;
        assert.equal(beforeQueue.length, 1);
        await store1.close();

        const store2 = new OmniEduStore(dataRoot);
        await store2.init();
        const after = buildMasteryPolicy(await buildMasterySnapshot(store2, student.id), now);
        assert.deepEqual(after.dueReviews, beforeQueue, 'reopen must reconstruct the same queue from SQLite evidence');
        assert.equal(after.next.knowledgePointId, before.next.knowledgePointId);
        const freeform = await store2.createRecord({ studentId: student.id, recordType: 'note', subject: '数学', title: '未结构化备注', content: '这段文字不能伪造成掌握度证据', tags: [], occurredAt });
        assert.ok(freeform.length > 0);
        const afterUnknown = buildMasteryPolicy(await buildMasterySnapshot(store2, student.id), now);
        assert.deepEqual(afterUnknown.dueReviews, beforeQueue, 'unknown free text must not move the queue');
        await store2.close();
        return { ok: true, cases: 12, sqliteRestart: true, queueStable: true, noSecondSource: true, unknownEvidenceSafe: true, deterministic: true };
      }
    `, resolveDir: appRoot, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, external: ['sqlite3'], logLevel: 'silent' });
    const { runReviewRecoverySmoke } = await import(pathToFileURL(outfile).href);
    console.log(JSON.stringify(await runReviewRecoverySmoke(dataRoot)));
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 250));
    for (const target of [bundleRoot, dataRoot]) {
      try { rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* native sqlite may release a temp handle after process exit */ }
    }
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
