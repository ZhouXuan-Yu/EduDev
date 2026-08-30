import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(tmpdir(), 'omni-edu-mastery-policy-'));

const evidence = { recordCount: 5, attemptCount: 5, unknownEvidence: 0 };
function snapshot(points, attempts = []) {
  return {
    bookId: 'omni_student_s1',
    modules: [{ id: 'm1', name: '函数', order: 0, knowledge_points: points }],
    attempts,
    evidence,
  };
}
function point(id, type = 'procedure') {
  return { id, name: id, type, module_id: 'm1' };
}
function attempt(id, kp, ok, timestamp, evidenceKind = 'quiz') {
  return { questionId: id, knowledgePointId: kp, moduleId: 'm1', isCorrect: ok, evidenceKind, timestamp };
}

async function run() {
  try {
    const outfile = join(bundleRoot, 'mastery-policy.mjs');
    await build({ entryPoints: [join(appRoot, 'src/main/ai-harness/mastery-policy.ts')], bundle: true, platform: 'node', format: 'esm', outfile, logLevel: 'silent' });
    const { buildMasteryPolicy } = await import(pathToFileURL(outfile).href);
    const now = 2_000_000_000;

    const untouched = buildMasteryPolicy(snapshot([point('kp1')]), now);
    assert.equal(untouched.next.action, 'probe');
    assert.equal(untouched.points[0].status, 'new');

    const twoCorrect = buildMasteryPolicy(snapshot([point('kp1')], [attempt('a1', 'kp1', true, now - 100), attempt('a2', 'kp1', true, now - 50)]), now);
    assert.equal(twoCorrect.points[0].mastery, 0.8, 'confidence cap prevents two lucky answers from mastery');
    assert.equal(twoCorrect.next.action, 'practice');

    const fiveCorrect = buildMasteryPolicy(snapshot([point('kp1')], Array.from({ length: 5 }, (_, i) => attempt(`a${i}`, 'kp1', true, now - (500 - i * 50)))), now);
    assert.equal(fiveCorrect.points[0].mastery, 1);
    assert.equal(fiveCorrect.next.action, 'complete');

    const quizDoesNotQualify = buildMasteryPolicy(snapshot([point('kp1', 'concept')], [attempt('a1', 'kp1', true, now - 100, 'quiz')]), now);
    assert.equal(quizDoesNotQualify.points[0].status, 'learning', 'quiz evidence must not silently pass a qualitative gate');
    const qualitative = buildMasteryPolicy(snapshot([point('kp1', 'concept')], [attempt('a1', 'kp1', true, now - 100, 'assess')]), now);
    assert.equal(qualitative.points[0].status, 'mastered');
    assert.equal(qualitative.next.action, 'complete');

    const dueReview = buildMasteryPolicy(snapshot([point('due'), point('new')], [attempt('a1', 'due', true, now - 8 * 86_400)]), now);
    assert.equal(dueReview.next.action, 'review');
    assert.equal(dueReview.next.knowledgePointId, 'due');
    assert.equal(dueReview.dueReviews.length, 1);

    const wrongReset = buildMasteryPolicy(snapshot([point('kp1')], [attempt('a1', 'kp1', true, now - 10), attempt('a2', 'kp1', false, now - 5)]), now);
    assert.equal(wrongReset.points[0].status, 'learning');
    assert.ok(wrongReset.points[0].nextReviewAt > now, 'wrong answer reschedules review in the future');

    const deterministicInput = snapshot([point('b'), point('a')], [attempt('a1', 'a', false, now - 100)]);
    assert.deepEqual(buildMasteryPolicy(deterministicInput, now), buildMasteryPolicy(deterministicInput, now));
    assert.equal(buildMasteryPolicy(deterministicInput, now).next.knowledgePointId, 'b', 'module/point order is deterministic');

    console.log(JSON.stringify({ ok: true, cases: 8, policyVersion: fiveCorrect.policyVersion, next: fiveCorrect.next }));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
