import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-deeptutor-review-performance-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-review-performance-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'review-performance-smoke.mjs');
    await build({ stdin: { contents: `
      import assert from 'node:assert/strict';
      import { performance } from 'node:perf_hooks';
      import { OmniEduStore } from './src/main/db';
      import { buildMasterySnapshot } from './src/main/ai-harness/mastery-snapshot';
      import { buildMasteryPolicy } from './src/main/ai-harness/mastery-policy';
      import { buildReviewReminder } from './src/main/ai-harness/review-reminder';

      const DAY = 86400;
      const NOW = 2_100_000_000;

      async function prepare(store) {
        const boot = await store.init();
        const students = [boot.students[0]];
        for (let index = 1; index < 8; index += 1) {
          const created = await store.createStudent({ displayName: '性能学生' + index, grade: '初二', subjects: ['数学'], goals: '', currentIssues: '', parentConcerns: '', teacherNotes: '', tags: [] });
          students.push(created.find((student) => student.displayName === '性能学生' + index));
        }
        for (const student of students) {
          for (let index = 0; index < 200; index += 1) {
            const point = '性能知识点_' + (index % 12);
            const structured = index % 11 !== 0;
            await store.createRecord({
              studentId: student.id,
              recordType: structured ? 'mastery_attempt' : 'note',
              subject: '数学',
              title: point + '_' + index,
              content: structured
                ? JSON.stringify({ knowledgePoint: point, knowledgeType: index % 4 === 0 ? 'concept' : 'procedure', isCorrect: index % 3 !== 0 })
                : 'PRIVATE_RAW_SHOULD_NOT_LEAK_' + index,
              tags: structured ? ['mastery_attempt'] : [],
              occurredAt: new Date((NOW - ((index % 21) + 1) * DAY) * 1000).toISOString(),
            });
          }
        }
        return students;
      }

      async function request(store, studentId) {
        const started = performance.now();
        const snapshot = await buildMasterySnapshot(store, studentId);
        const policy = buildMasteryPolicy(snapshot, NOW);
        const reminder = buildReviewReminder(policy.points.map((point) => ({ id: point.id, name: point.name, moduleId: point.moduleId, moduleName: point.moduleName, type: point.type, dueAt: point.nextReviewAt })), NOW, 'UTC');
        const elapsedMs = performance.now() - started;
        const payload = JSON.stringify({ policy: { next: policy.next.action, due: policy.dueReviews.length }, reminder });
        assert.equal(payload.includes('PRIVATE_RAW_SHOULD_NOT_LEAK'), false);
        assert.equal(payload.includes('learning_records'), true);
        assert.ok(reminder.items.length <= 3);
        return { studentId, elapsedMs, fingerprint: payload };
      }

      async function benchmark(store, students) {
        const results = await Promise.all(Array.from({ length: 16 }, (_, index) => request(store, students[index % students.length].id)));
        const sorted = results.map((result) => result.elapsedMs).sort((a, b) => a - b);
        const p95 = sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * 0.95) - 1)];
        const max = sorted[sorted.length - 1];
        assert.ok(p95 <= 2000, 'p95 exceeded 2 seconds: ' + p95);
        assert.ok(max <= 2000, 'max exceeded 2 seconds: ' + max);
        return { results, p95, max };
      }

      export async function runReviewPerformanceSmoke(dataRoot) {
        const store = new OmniEduStore(dataRoot);
        const students = await prepare(store);
        const rounds = [];
        let baseline = null;
        for (let round = 0; round < 3; round += 1) {
          const result = await benchmark(store, students);
          rounds.push({ p95: Math.round(result.p95 * 100) / 100, max: Math.round(result.max * 100) / 100 });
          const fingerprints = result.results.map((item) => item.fingerprint).sort();
          if (baseline === null) baseline = fingerprints;
          else assert.deepEqual(fingerprints, baseline, 'same SQLite evidence must produce deterministic summaries');
        }
        await store.close();
        const reopened = new OmniEduStore(dataRoot);
        await reopened.init();
        const afterRestart = await benchmark(reopened, students);
        assert.ok(afterRestart.p95 <= 2000);
        await reopened.close();
        return { ok: true, rounds, restart: { p95: Math.round(afterRestart.p95 * 100) / 100, max: Math.round(afterRestart.max * 100) / 100 }, students: students.length, recordsPerStudent: 200, concurrency: 16, pass3: true, rawRecordsExcluded: true, sloMs: 2000 };
      }
    `, resolveDir: appRoot, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, external: ['sqlite3'], logLevel: 'silent' });
    const { runReviewPerformanceSmoke } = await import(pathToFileURL(outfile).href);
    console.log(JSON.stringify(await runReviewPerformanceSmoke(dataRoot)));
  } finally {
    await new Promise((resolve) => setTimeout(resolve, 250));
    for (const target of [bundleRoot, dataRoot]) {
      try { rmSync(target, { recursive: true, force: true, maxRetries: 10, retryDelay: 100 }); } catch { /* native sqlite may release a temp handle after process exit */ }
    }
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
