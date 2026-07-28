import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-ai-usability-human-review-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-usability-human-review-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'ai-usability-human-review-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';

          export async function runAiUsabilityHumanReviewSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            try {
              await store.init();
              const reviewedAt = '2026-07-29T08:00:00.000Z';
              const samples = [
                {
                  sampleId: 'human_review_student_progress_001',
                  prompt: '请看小A最近数学学习进度，告诉我下一步怎么补。',
                  route: 'student_diagnosis',
                  subIntent: 'student_progress',
                  teacherScore: 5,
                  needsRewrite: false,
                  roundsToUseful: 1,
                  mainIssueCode: 'none',
                  teacherNote: '能直接进入学生诊断并给出下一步。',
                  runId: 'run_human_review_001',
                  sessionId: 'session_human_review',
                  model: 'deepseek-smoke',
                  reviewedAt,
                },
                {
                  sampleId: 'human_review_triplet_002',
                  prompt: '基于小A错题出一组三元题组。',
                  route: 'practice_design',
                  subIntent: 'triplet_practice',
                  teacherScore: 4,
                  needsRewrite: false,
                  roundsToUseful: 2,
                  mainIssueCode: 'evidence_gap',
                  teacherNote: '题组结构可用，但希望证据更具体。',
                  runId: 'run_human_review_002',
                  sessionId: 'session_human_review',
                  model: 'deepseek-smoke',
                  reviewedAt: '2026-07-29T08:01:00.000Z',
                },
                {
                  sampleId: 'human_review_workspace_help_003',
                  prompt: '学生数据在哪里导入？',
                  route: 'workspace_help',
                  subIntent: 'data_management_help',
                  teacherScore: 4,
                  needsRewrite: false,
                  roundsToUseful: 1,
                  mainIssueCode: 'none',
                  teacherNote: '路径清楚，适合老师操作。',
                  runId: 'run_human_review_003',
                  sessionId: 'session_human_review',
                  model: 'deepseek-smoke',
                  reviewedAt: '2026-07-29T08:02:00.000Z',
                },
              ];

              for (const sample of samples) {
                const review = await store.createAiUsabilityReview(sample);
                assert.equal(review.sampleId, sample.sampleId);
                assert.equal(review.teacherScore, sample.teacherScore);
                assert.equal(review.needsRewrite, sample.needsRewrite);
              }

              const list = await store.listAiUsabilityReviews();
              assert.equal(list.length, samples.length);
              assert.equal(list[0].sampleId, 'human_review_workspace_help_003');

              const summary = await store.buildAiUsabilityReviewSummary();
              assert.equal(summary.sampleCount, 3);
              assert.equal(summary.averageTeacherScore, 4);
              assert.equal(summary.minTeacherScore, 4);
              assert.equal(summary.passedCount, 3);
              assert.equal(summary.needsRewriteCount, 0);
              assert.equal(summary.averageRoundsToUseful, 1);
              assert.equal(summary.routeCounts.student_diagnosis, 1);
              assert.equal(summary.routeCounts.practice_design, 1);
              assert.equal(summary.routeCounts.workspace_help, 1);
              assert.equal(summary.issueCounts.none, 2);
              assert.equal(summary.issueCounts.evidence_gap, 1);

              const snapshot = await store.buildAiTelemetrySnapshot();
              assert.deepEqual(snapshot.humanUsability, summary);

              const report = await store.createAiRegressionReport({
                title: 'Phase 12 v1.2 human review smoke',
                minimumTeacherReviewSamples: 3,
                minimumTeacherScore: 4,
                maximumTeacherRoundsToUseful: 2,
              });
              const teacherGate = report.gates.find((gate) => gate.id === 'teacher_review_score_gate');
              assert.ok(teacherGate, 'teacher_review_score_gate should be present');
              assert.equal(teacherGate.status, 'passed');
              assert.equal(report.snapshot.humanUsability.sampleCount, 3);
              assert.equal(report.snapshot.humanUsability.averageTeacherScore, 4);

              return {
                ok: true,
                reviewCount: list.length,
                summary,
                reportStatus: report.status,
                teacherGate: {
                  id: teacherGate.id,
                  status: teacherGate.status,
                  detail: teacherGate.detail,
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

    const { runAiUsabilityHumanReviewSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runAiUsabilityHumanReviewSmoke(dataRoot);
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
