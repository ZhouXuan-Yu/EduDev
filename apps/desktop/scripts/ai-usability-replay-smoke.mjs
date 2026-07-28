import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-ai-usability-replay-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-usability-replay-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'ai-usability-replay-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';

          export async function runAiUsabilityReplaySmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            try {
              await store.init();
              const prompt = '请看小A最近数学错题和学习进度，直接告诉我下一步补什么。';
              const before = await store.createAiUsabilityReview({
                sampleId: 'replay_student_progress_before_001',
                prompt,
                route: 'student_diagnosis',
                subIntent: 'student_progress',
                teacherScore: 2,
                needsRewrite: true,
                roundsToUseful: 4,
                mainIssueCode: 'manual_module_switch_fallback',
                teacherNote: '要求老师手动切换模块，没有主动查询学生数据。',
                runId: 'run_replay_before',
                sessionId: 'session_replay',
                model: 'deepseek-before',
                reviewedAt: '2026-07-29T09:00:00.000Z',
              });
              const after = await store.createAiUsabilityReview({
                sampleId: 'replay_student_progress_after_001',
                prompt,
                route: 'student_diagnosis',
                subIntent: 'student_progress',
                teacherScore: 5,
                needsRewrite: false,
                roundsToUseful: 1,
                mainIssueCode: 'none',
                teacherNote: '能直接识别学生诊断任务，并给出证据边界和下一步。',
                runId: 'run_replay_after',
                sessionId: 'session_replay',
                model: 'deepseek-after',
                reviewedAt: '2026-07-29T09:05:00.000Z',
              });
              const experiment = await store.createAiUsabilityReplayExperiment({
                beforeReviewId: before.id,
                afterReviewId: after.id,
                replayPrompt: prompt,
                modelBefore: 'deepseek-before',
                modelAfter: 'deepseek-after',
                promptVersionBefore: 'xiazhi-usability-v1.3',
                promptVersionAfter: 'xiazhi-usability-v1.4',
                experimentNote: 'smoke seeded before/after replay experiment',
              });

              assert.equal(experiment.beforeReviewId, before.id);
              assert.equal(experiment.afterReviewId, after.id);
              assert.equal(experiment.scoreBefore, 2);
              assert.equal(experiment.scoreAfter, 5);
              assert.equal(experiment.scoreDelta, 3);
              assert.equal(experiment.roundsBefore, 4);
              assert.equal(experiment.roundsAfter, 1);
              assert.equal(experiment.roundsDelta, 3);
              assert.equal(experiment.issueBefore, 'manual_module_switch_fallback');
              assert.equal(experiment.issueAfter, 'none');
              assert.equal(experiment.improved, true);

              const list = await store.listAiUsabilityReplayExperiments();
              assert.equal(list.length, 1);
              assert.equal(list[0].id, experiment.id);
              assert.equal(list[0].scoreDelta, 3);

              const summary = await store.buildAiUsabilityReplaySummary();
              assert.equal(summary.experimentCount, 1);
              assert.equal(summary.improvedCount, 1);
              assert.equal(summary.unresolvedCount, 0);
              assert.equal(summary.improvementRate, 1);
              assert.equal(summary.averageScoreDelta, 3);
              assert.equal(summary.averageRoundsDelta, 3);
              assert.equal(summary.issueTransitionCounts['manual_module_switch_fallback->none'], 1);

              const snapshot = await store.buildAiTelemetrySnapshot();
              assert.deepEqual(snapshot.usabilityReplay, summary);

              const report = await store.createAiRegressionReport({
                title: 'Phase 12 v1.4 replay smoke',
                minimumTeacherReviewSamples: 2,
                minimumTeacherScore: 3.5,
                maximumTeacherRoundsToUseful: 3,
                minimumReplayExperimentCount: 1,
                minimumReplayImprovementRate: 1,
              });
              const replayGate = report.gates.find((gate) => gate.id === 'usability_replay_improvement_gate');
              assert.ok(replayGate, 'usability_replay_improvement_gate should be present');
              assert.equal(replayGate.status, 'passed');
              assert.equal(report.snapshot.usabilityReplay.experimentCount, 1);

              return {
                ok: true,
                experimentCount: summary.experimentCount,
                improvedCount: summary.improvedCount,
                averageScoreDelta: summary.averageScoreDelta,
                averageRoundsDelta: summary.averageRoundsDelta,
                replayGate: {
                  id: replayGate.id,
                  status: replayGate.status,
                  detail: replayGate.detail,
                },
              };
            } finally {
              await store.close();
            }
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

    const { runAiUsabilityReplaySmoke } = await import(pathToFileURL(outfile).href);
    const result = await runAiUsabilityReplaySmoke(dataRoot);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
