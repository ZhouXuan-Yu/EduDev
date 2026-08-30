import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(tmpdir(), 'omni-edu-review-scheduler-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'review-scheduler.mjs');
    await build({ entryPoints: [join(appRoot, 'src/main/ai-harness/review-scheduler.ts')], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent' });
    const scheduler = await import(pathToFileURL(outfile).href);
    const now = 2_000_000_000;
    const day = 86_400;
    const correct = (timestamp) => ({ isCorrect: true, timestamp });
    const wrong = (timestamp) => ({ isCorrect: false, timestamp });

    const memory = scheduler.scheduleFromOutcomes('memory', [correct(now - 3 * day)], now);
    assert.equal(memory.intervalIndex, 1);
    assert.equal(memory.nextReviewAt, now - 2 * day);
    const twoCorrect = scheduler.scheduleFromOutcomes('memory', [correct(now - 4 * day), correct(now - 3 * day)], now);
    assert.equal(twoCorrect.intervalIndex, 3, 'two consecutive correct answers advance two levels');
    const wrongReset = scheduler.scheduleFromOutcomes('procedure', [correct(now - 10 * day), correct(now - 9 * day), wrong(now - day)], now);
    assert.equal(wrongReset.intervalIndex, 1);
    assert.equal(wrongReset.nextReviewAt, now - day + 7 * day);
    assert.equal(scheduler.normalizeReviewKnowledgeType('unknown'), 'procedure');
    assert.equal(scheduler.clampReviewNow(-10, 1), 0);
    assert.equal(scheduler.scheduleFromOutcomes('memory', [], now), null);

    const outcomes = new Map([
      ['kp-concept', [correct(now - 8 * day)]],
      ['kp-memory', [correct(now - day)]],
      ['kp-design', [correct(now - 30 * day)]],
    ]);
    const points = [
      { id: 'kp-memory', type: 'memory', order: 2 },
      { id: 'kp-concept', type: 'concept', order: 1 },
      { id: 'kp-design', type: 'design', order: 0 },
    ];
    const utc = scheduler.buildReviewQueue(points, outcomes, now, 'UTC', 20);
    const shanghai = scheduler.buildReviewQueue(points, outcomes, now, 'Asia/Shanghai', 20);
    const newYork = scheduler.buildReviewQueue(points, outcomes, now, 'America/New_York', 20);
    assert.deepEqual(utc, shanghai);
    assert.deepEqual(utc, newYork);
    assert.equal(utc.every((item) => item.id.startsWith('review_')), true);
    assert.equal(utc.filter((item) => item.due).length, 3);
    assert.deepEqual(utc.map((item) => item.knowledgePointId), ['kp-memory', 'kp-concept', 'kp-design']);

    const huge = scheduler.scheduleFromOutcomes('memory', Array.from({ length: 10_000 }, (_, index) => ({ isCorrect: index % 2 === 0, timestamp: now - index })), now);
    assert.ok(huge && huge.intervalIndex >= 0 && huge.intervalIndex <= 6);
    const malformed = scheduler.buildReviewQueue([{ id: 'bad', type: '???', order: Number.NaN }], new Map([['bad', [{ isCorrect: 'yes', timestamp: now }]]]), now, 'UTC', 999);
    assert.deepEqual(malformed, []);

    console.log(JSON.stringify({ ok: true, cases: 20, deterministic: true, timezoneInvariant: true, bounded: true, deepTutorIntervals: true }));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
