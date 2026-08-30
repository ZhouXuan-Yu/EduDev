import { _electron as electron } from 'playwright';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import assert from 'node:assert/strict';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-deeptutor-review-performance-electron-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-review-performance-electron-'));
let app;

async function prepare() {
  const outfile = join(bundleRoot, 'prepare.mjs');
  await build({ stdin: { contents: `
    import { OmniEduStore } from './src/main/db';
    const DAY = 86400; const NOW = 2100000000;
    export async function prepareReviewData(dataRoot) {
      const store = new OmniEduStore(dataRoot); const boot = await store.init(); const students = [boot.students[0]];
      for (let i = 1; i < 8; i += 1) {
        const created = await store.createStudent({ displayName: 'IPC性能学生' + i, grade: '初二', subjects: ['数学'], goals: '', currentIssues: '', parentConcerns: '', teacherNotes: '', tags: [] });
        students.push(created.find((student) => student.displayName === 'IPC性能学生' + i));
      }
      for (const student of students) for (let i = 0; i < 200; i += 1) {
        const point = 'IPC知识点_' + (i % 12); const structured = i % 11 !== 0;
        await store.createRecord({ studentId: student.id, recordType: structured ? 'mastery_attempt' : 'note', subject: '数学', title: point + '_' + i, content: structured ? JSON.stringify({ knowledgePoint: point, knowledgeType: 'procedure', isCorrect: i % 3 !== 0 }) : 'PRIVATE_RAW_SHOULD_NOT_LEAK_' + i, tags: structured ? ['mastery_attempt'] : [], occurredAt: new Date((NOW - ((i % 21) + 1) * DAY) * 1000).toISOString() });
      }
      await store.close(); return students.map((student) => student.id);
    }
  `, resolveDir: appRoot, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, external: ['sqlite3'], logLevel: 'silent' });
  const { prepareReviewData } = await import(pathToFileURL(outfile).href);
  return prepareReviewData(dataRoot);
}

async function launch() {
  app = await electron.launch({ args: [join(appRoot, 'out/main/index.js')], env: { ...process.env, OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: dirname(dirname(appRoot)) } });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => Boolean(window.omniEdu));
  return page;
}

async function benchmark(page, studentIds) {
  const started = performance.now();
  const reminders = await Promise.all(Array.from({ length: 16 }, (_, index) => page.evaluate((studentId) => window.omniEdu.getReviewReminder(studentId), studentIds[index % studentIds.length])));
  const elapsedMs = performance.now() - started;
  assert.ok(elapsedMs <= 2000, 'IPC p95/max batch exceeded 2 seconds: ' + elapsedMs);
  assert.ok(reminders.every((item) => item.schemaVersion === 'omni.review.reminder.v1' && item.rawRecordsIncluded === false));
  assert.equal(JSON.stringify(reminders).includes('PRIVATE_RAW_SHOULD_NOT_LEAK'), false);
  return { elapsedMs, fingerprints: reminders.map((item) => JSON.stringify({ status: item.status, dueCount: item.dueCount, upcomingCount: item.upcomingCount, ids: item.items.map((entry) => entry.knowledgePointId) })).sort() };
}

try {
  const studentIds = await prepare();
  const page = await launch();
  const boot = await page.evaluate(() => window.omniEdu.bootstrap());
  assert.ok(boot.students.length >= 8);
  const first = await benchmark(page, studentIds);
  await app.close(); app = null;
  const restarted = await launch();
  const second = await benchmark(restarted, studentIds);
  assert.deepEqual(second.fingerprints, first.fingerprints);
  await restarted.evaluate(async (studentId) => {
    try { await window.omniEdu.getReviewReminder(studentId); } catch { throw new Error('valid student IPC unexpectedly failed'); }
  }, studentIds[0]);
  await app.close(); app = null;
  console.log(JSON.stringify({ ok: true, rounds: 2, concurrency: 16, students: 8, recordsPerStudent: 200, firstMs: Math.round(first.elapsedMs * 100) / 100, restartMs: Math.round(second.elapsedMs * 100) / 100, sqliteRestart: true, rawRecordsExcluded: true, sloMs: 2000 }));
} finally {
  if (app) await app.close().catch(() => undefined);
  await new Promise((resolve) => setTimeout(resolve, 250));
  for (const target of [bundleRoot, dataRoot]) {
    try { rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* best effort */ }
  }
}
