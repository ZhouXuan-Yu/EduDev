import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-ai-observability-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-observability-'));
const exportRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-observability-export-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'ai-observability-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';
          import { routeAiPrompt } from './src/main/ai-harness/router';
          import { gradeAiReplyWithModelProxy } from './src/main/ai-harness/model-grader';
          import { runAiUsabilityEvalSuite } from './src/main/ai-harness/usability-eval-cases';

          export async function runAiObservabilitySmoke(dataRoot, exportRoot) {
            const store = new OmniEduStore(dataRoot);
            try {
              await store.init();
              const student = (await store.listStudents('小A'))[0];
              assert.ok(student, 'seed should provide 小A');
              const prompt = '请查看小A最近学习记录，并给出下一步练习建议';
              const router = routeAiPrompt(prompt, { hasStudent: true });
              const runId = await store.startAiAgentRun({
                sessionId: 'session_observability_smoke',
                prompt,
                route: router.route,
                subIntent: router.subIntent,
                model: 'deepseek-smoke',
                studentId: student.id,
              });
              await store.recordAiAgentEvent(runId, {
                phase: 'route',
                status: 'succeeded',
                label: 'Router dry-run',
                detail: '识别学生诊断任务。',
                outputSummary: { route: router.route, subIntent: router.subIntent },
              });
              await store.recordAiAgentEvent(runId, {
                phase: 'tool_call',
                status: 'succeeded',
                label: '读取学生档案',
                detail: '通过只读工具读取学生摘要。',
                toolName: 'get_student_profile',
                inputSummary: { studentId: student.id },
                outputSummary: { fields: ['displayName', 'grade', 'subjects'] },
              });
              await store.recordAiAgentEvent(runId, {
                phase: 'observe',
                status: 'succeeded',
                label: '证据边界',
                detail: '已记录工具观察结果。',
                outputSummary: { evidenceCount: 1 },
              });
              await new Promise((resolve) => setTimeout(resolve, 8));
              await store.completeAiAgentRun(runId, 'succeeded');
              const usabilitySuite = runAiUsabilityEvalSuite();
              assert.equal(usabilitySuite.ok, true, 'usability eval suite should pass before creating regression report');
              await store.createAiUsabilityReview({
                sampleId: 'observability_human_review_001',
                prompt,
                route: router.route,
                subIntent: router.subIntent,
                teacherScore: 5,
                needsRewrite: false,
                roundsToUseful: 1,
                mainIssueCode: 'none',
                teacherNote: 'smoke 样本：能直达学生诊断并给出下一步。',
                runId,
                sessionId: 'session_observability_smoke',
                model: 'deepseek-smoke',
                reviewedAt: '2026-07-29T08:10:00.000Z',
              });
              const replayBefore = await store.createAiUsabilityReview({
                sampleId: 'observability_replay_before_001',
                prompt,
                route: router.route,
                subIntent: router.subIntent,
                teacherScore: 4,
                needsRewrite: false,
                roundsToUseful: 2,
                mainIssueCode: 'too_long',
                teacherNote: 'smoke before：可用但仍然偏长。',
                runId,
                sessionId: 'session_observability_smoke',
                model: 'deepseek-before',
                reviewedAt: '2026-07-29T08:11:00.000Z',
              });
              const replayAfter = await store.createAiUsabilityReview({
                sampleId: 'observability_replay_after_001',
                prompt,
                route: router.route,
                subIntent: router.subIntent,
                teacherScore: 5,
                needsRewrite: false,
                roundsToUseful: 1,
                mainIssueCode: 'none',
                teacherNote: 'smoke after：更短并能直接进入学生诊断。',
                runId,
                sessionId: 'session_observability_smoke',
                model: 'deepseek-after',
                reviewedAt: '2026-07-29T08:12:00.000Z',
              });
              await store.createAiUsabilityReplayExperiment({
                beforeReviewId: replayBefore.id,
                afterReviewId: replayAfter.id,
                replayPrompt: prompt,
                modelBefore: 'deepseek-before',
                modelAfter: 'deepseek-after',
                promptVersionBefore: 'observability-v1.3',
                promptVersionAfter: 'observability-v1.4',
                experimentNote: 'observability smoke seeded before/after replay',
              });
              await store.createAiModelGrade(gradeAiReplyWithModelProxy({
                sampleId: 'observability_model_grade_001',
                prompt,
                answerMarkdown: [
                  '小A当前更像是分数应用题条件筛选不稳。',
                  '## 依据',
                  '- 已检查最近错题和学习记录，问题集中在单位换算和条件筛选。',
                  '## 下一步',
                  '- 今天先做 2 道单位换算解释，再做 1 道相似题。',
                  '- 老师确认后再保存练习草稿。',
                ].join('\\n'),
                route: router.route,
                subIntent: router.subIntent,
                targetGrade: '小学五年级',
                modelUnderReview: 'deepseek-smoke',
                reviewedAt: '2026-07-29T08:13:00.000Z',
              }));
              await store.createAiModelGrade(gradeAiReplyWithModelProxy({
                sampleId: 'observability_model_grade_002',
                prompt: '基于小A错题出一组三元题组。',
                answerMarkdown: [
                  '这组三元题组先复现原题结构，再做相似变式，最后做条件反转。',
                  '## 依据',
                  '- 来源：本地题库相似题命中 2 条，知识点为分数应用题。',
                  '## 下一步',
                  '- 先让小A说出每题条件和问题，再限时完成。',
                  '## 需要老师确认',
                  '- 老师确认后保存为三元题组草稿，可继续修改。',
                ].join('\\n'),
                route: 'practice_design',
                subIntent: 'triplet_practice',
                targetGrade: '小学五年级',
                modelUnderReview: 'deepseek-smoke',
                reviewedAt: '2026-07-29T08:14:00.000Z',
              }));

              await store.recordAiConsoleRun(
                {
                  prompt,
                  studentId: student.id,
                  timeRange: 'last30',
                  knowledgeScope: 'teacher',
                },
                {
                  ok: true,
                  model: 'deepseek-smoke',
                  content: '这是小智可观测性 smoke 回复。',
                  toolRuns: [{
                    name: 'get_student_profile',
                    label: '读取学生档案',
                    status: 'used',
                    detail: '读取学生摘要。',
                    effect: 'read',
                    privacy: 'local_only',
                  }],
                  sources: [{
                    title: '学生档案',
                    type: 'student_profile',
                    detail: '本地学生档案摘要',
                    count: 1,
                  }],
                  knowledgeSnippets: [],
                  graphNodes: [],
                  usage: {
                    promptTokens: 120,
                    completionTokens: 80,
                    totalTokens: 200,
                  },
                  harness: {
                    agentRunId: runId,
                    router,
                    selectedContext: ['student_lookup', 'student_profile', 'learning_records'],
                    schemaValid: true,
                    schemaErrors: [],
                    usabilityGrade: {
                      passed: true,
                      score: 92,
                      profile: 'evidence_snapshot',
                      issues: [],
                    },
                    trace: [],
                  },
                },
              );

              await store.exportDocumentArtifact({
                artifactId: 'artifact_observability_smoke',
                sessionId: 'session_observability_smoke',
                messageId: 'message_observability_smoke',
                title: '小智可观测性报告样本',
                type: 'markdown',
                fileName: 'observability.md',
                contentMd: '# 小智可观测性报告样本\\n\\n- smoke artifact',
                destinationRoot: exportRoot,
              });

              const confirmation = await store.createAiConfirmation({
                runId,
                sessionId: 'session_observability_smoke',
                studentId: student.id,
                actionType: 'create_review_report',
                title: '可观测性 smoke 复盘草稿',
                description: '用于确认队列状态统计',
                previewMd: '# 可观测性 smoke 复盘草稿',
                payload: {
                  studentId: student.id,
                  subject: '数学',
                  startDate: '2026-07-01',
                  endDate: '2026-07-28',
                  reportType: 'ai_draft',
                  title: '可观测性 smoke 复盘草稿',
                  contentMd: '# 可观测性 smoke 复盘草稿',
                  sourceRecordIds: [],
                },
              });
              await store.rejectAiConfirmation(confirmation.id);

              const snapshot = await store.buildAiTelemetrySnapshot();
              assert.equal(snapshot.runCount, 1);
              assert.equal(snapshot.statusCounts.succeeded, 1);
              assert.ok(snapshot.eventCount >= 3, 'event count should cover persisted trace');
              assert.ok(snapshot.toolEventCount >= 2, 'tool events should include agent event and ai_tool_runs');
              assert.equal(snapshot.artifactCounts.exported, 1);
              assert.equal(snapshot.confirmationCounts.rejected, 1);
              assert.equal(snapshot.tokenBudget.totalTokens, 200);
              assert.equal(snapshot.contextBudget.sourceCount, 1);
              assert.equal(snapshot.usability.sampleCount, 1);
              assert.equal(snapshot.usability.passedCount, 1);
              assert.equal(snapshot.usability.averageScore, 92);
              assert.equal(snapshot.usability.profileCounts.evidence_snapshot, 1);
              assert.equal(snapshot.humanUsability.sampleCount, 3);
              assert.equal(snapshot.humanUsability.averageTeacherScore, 5);
              assert.equal(snapshot.humanUsability.needsRewriteCount, 0);
              assert.equal(snapshot.usabilityReplay.experimentCount, 1);
              assert.equal(snapshot.usabilityReplay.improvedCount, 1);
              assert.equal(snapshot.modelGrader.sampleCount, 2);
              assert.equal(snapshot.modelGrader.passedCount, 2);
              assert.equal(snapshot.modelGrader.averageOverallScore, 5);
              assert.ok(snapshot.latency.p50Ms > 0, 'latency should be measurable');

              const report = await store.createAiRegressionReport({
                title: 'Phase 11 smoke regression',
                expectedEvalTotal: 96,
                expectedEvalPassed: 96,
                expectedUsabilityEvalTotal: usabilitySuite.total,
                expectedUsabilityEvalPassed: usabilitySuite.passed,
                minimumUsabilityAverageScore: 75,
                minimumTeacherReviewSamples: 1,
                minimumTeacherScore: 4,
                maximumTeacherRoundsToUseful: 2,
                minimumReplayExperimentCount: 1,
                minimumReplayImprovementRate: 1,
                minimumModelGradeSamples: 2,
                minimumModelGradeScore: 4,
                minimumGradeAppropriatenessScore: 4,
              });
              assert.equal(report.status, 'passed');
              assert.equal(report.snapshot.runCount, 1);
              assert.ok(report.gates.length >= 10);
              assert.ok(report.gates.every((gate) => gate.status === 'passed'), 'all smoke gates should pass');
              assert.ok(report.gates.some((gate) => gate.id === 'usability_quality_gate'));
              assert.ok(report.gates.some((gate) => gate.id === 'usability_eval_baseline'));
              assert.ok(report.gates.some((gate) => gate.id === 'teacher_review_score_gate'));
              assert.ok(report.gates.some((gate) => gate.id === 'usability_replay_improvement_gate'));
              assert.ok(report.gates.some((gate) => gate.id === 'model_grader_quality_gate'));
              assert.equal(report.reportJson.schemaVersion, 'xiazhi.observability.v1');
              const readback = await store.getAiRegressionReport(report.id);
              assert.ok(readback, 'regression report should be readable');
              assert.equal(readback.id, report.id);
              const reports = await store.listAiRegressionReports();
              assert.equal(reports.length, 1);

              return {
                ok: true,
                reportId: report.id,
                status: report.status,
                runCount: report.snapshot.runCount,
                eventCount: report.snapshot.eventCount,
                toolEventCount: report.snapshot.toolEventCount,
                gates: report.gates.map((gate) => ({ id: gate.id, status: gate.status })),
                latency: report.snapshot.latency,
                tokenBudget: report.snapshot.tokenBudget,
                usability: report.snapshot.usability,
                humanUsability: report.snapshot.humanUsability,
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

    const { runAiObservabilitySmoke } = await import(pathToFileURL(outfile).href);
    const result = await runAiObservabilitySmoke(dataRoot, exportRoot);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    rmSync(exportRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
