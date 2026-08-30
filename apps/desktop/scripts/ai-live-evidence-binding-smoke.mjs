import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-ai-live-evidence-binding-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-live-evidence-binding-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'ai-live-evidence-binding-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';
          import { routeAiPrompt } from './src/main/ai-harness/router';
          import { gradeAiReplyWithModelProxy } from './src/main/ai-harness/model-grader';

          export async function runAiLiveEvidenceBindingSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            try {
              await store.init();
              const prompt = '请看小A最近数学学习进度，直接告诉我下一步补什么。';
              const router = routeAiPrompt(prompt, { hasStudent: true });
              const students = await store.listStudents('小A');
              const student = students[0];
              assert.ok(student?.id, 'seed student should exist');

              const sessionId = 'session_live_evidence_binding_smoke';
              const model = 'deepseek-live-binding-smoke';
              const promptVersion = 'xiazhi-live-binding-v1.6';
              const runId = await store.startAiAgentRun({
                sessionId,
                prompt,
                route: router.route,
                subIntent: router.subIntent,
                model,
                studentId: student.id,
              });
              await store.recordAiAgentEvent(runId, {
                phase: 'route',
                status: 'succeeded',
                label: '任务识别',
                detail: 'live evidence binding smoke 识别为学生诊断任务。',
                outputSummary: { route: router.route, subIntent: router.subIntent },
              });
              await store.recordAiAgentEvent(runId, {
                phase: 'tool_call',
                status: 'succeeded',
                label: '读取学生学习记录',
                detail: '通过只读工具读取学习记录摘要。',
                toolName: 'get_learning_records',
                outputSummary: { recordCount: 2 },
              });
              await new Promise((resolve) => setTimeout(resolve, 8));
              await store.completeAiAgentRun(runId, 'succeeded');

              const answerMarkdown = [
                '小A当前更需要补“函数图像和参数关系”的对应，而不是泛泛刷题。',
                '## 依据',
                '- 已检查最近学习记录：一次函数图像与参数关系、移项和符号错误反复出现。',
                '## 下一步',
                '- 今天先让小A口头解释 k 值正负和图像走向，再做 2 道相似题。',
                '- 老师确认后再保存为三元题组草稿，可继续调整题目难度。',
              ].join('\\n');
              const usage = { promptTokens: 130, completionTokens: 82, totalTokens: 212 };
              await store.recordAiConsoleRun(
                {
                  prompt,
                  studentId: student.id,
                  timeRange: 'last30',
                  knowledgeScope: 'teacher',
                },
                {
                  ok: true,
                  model,
                  content: answerMarkdown,
                  toolRuns: [{
                    name: 'get_learning_records',
                    label: '读取学习记录',
                    status: 'used',
                    detail: '读取小A最近学习记录摘要。',
                    effect: 'read',
                    privacy: 'local_only',
                  }],
                  sources: [{
                    title: '小A学习记录',
                    type: 'learning_record',
                    detail: '本地 SQLite 学习记录摘要',
                    count: 2,
                  }],
                  usage,
                  harness: {
                    agentRunId: runId,
                    router,
                    selectedContext: ['student_lookup', 'learning_records'],
                    schemaValid: true,
                    schemaErrors: [],
                    usabilityGrade: {
                      passed: true,
                      score: 94,
                      profile: 'evidence_snapshot',
                      issues: [],
                    },
                    trace: [],
                  },
                },
              );

              const before = await store.createAiUsabilityReview({
                sampleId: 'live_binding_before_001',
                prompt,
                route: router.route,
                subIntent: router.subIntent,
                teacherScore: 4,
                needsRewrite: false,
                roundsToUseful: 2,
                mainIssueCode: 'too_long',
                teacherNote: 'before 可用但偏长，下一步不够聚焦。',
                runId: 'run_before_seeded_manual',
                sessionId,
                model: 'deepseek-before',
                reviewedAt: '2026-07-29T11:00:00.000Z',
              });
              const after = await store.createAiUsabilityReview({
                sampleId: 'live_binding_after_001',
                prompt,
                route: router.route,
                subIntent: router.subIntent,
                teacherScore: 5,
                needsRewrite: false,
                roundsToUseful: 1,
                mainIssueCode: 'none',
                teacherNote: 'after 绑定真实 runId，可直接使用。',
                runId,
                sessionId,
                model,
                reviewedAt: '2026-07-29T11:05:00.000Z',
              });
              const replay = await store.createAiUsabilityReplayExperiment({
                beforeReviewId: before.id,
                afterReviewId: after.id,
                replayPrompt: prompt,
                modelBefore: before.model,
                modelAfter: model,
                promptVersionBefore: 'xiazhi-usability-v1.4',
                promptVersionAfter: promptVersion,
                experimentNote: 'live evidence binding smoke: after review binds runId and promptVersion',
              });
              assert.equal(replay.afterRunId, runId);
              assert.equal(replay.scoreDelta, 1);
              assert.equal(replay.roundsDelta, 1);

              const modelGrade = await store.createAiModelGrade(gradeAiReplyWithModelProxy({
                sampleId: 'live_binding_model_grade_001',
                runId,
                sessionId,
                prompt,
                answerMarkdown,
                route: router.route,
                subIntent: router.subIntent,
                targetGrade: student.grade,
                modelUnderReview: model,
                promptVersion,
                totalTokens: usage.totalTokens,
                reviewedAt: '2026-07-29T11:06:00.000Z',
              }));
              assert.equal(modelGrade.runId, runId);
              assert.equal(modelGrade.promptVersion, promptVersion);
              assert.equal(modelGrade.totalTokens, usage.totalTokens);
              assert.equal(modelGrade.passed, true);

              const snapshot = await store.buildAiTelemetrySnapshot();
              assert.equal(snapshot.usabilityReplay.liveLinkedCount, 1);
              assert.equal(snapshot.modelGrader.runLinkedCount, 1);
              assert.equal(snapshot.modelGrader.tokenKnownCount, 1);
              assert.equal(snapshot.modelGrader.promptVersionCounts[promptVersion], 1);

              const report = await store.createAiRegressionReport({
                title: 'Phase 12 v1.6 live evidence binding smoke',
                minimumUsabilityAverageScore: 75,
                minimumTeacherReviewSamples: 2,
                minimumTeacherScore: 4,
                maximumTeacherRoundsToUseful: 2,
                minimumReplayExperimentCount: 1,
                minimumReplayImprovementRate: 1,
                minimumLiveLinkedReplayCount: 1,
                minimumModelGradeSamples: 1,
                minimumModelGradeScore: 4,
                minimumGradeAppropriatenessScore: 4,
                minimumRunLinkedModelGradeCount: 1,
              });
              assert.equal(report.status, 'passed');
              const liveGate = report.gates.find((gate) => gate.id === 'live_evidence_binding_gate');
              assert.ok(liveGate, 'live_evidence_binding_gate should be present');
              assert.equal(liveGate.status, 'passed');

              return {
                ok: true,
                runId,
                replayId: replay.id,
                afterReviewId: after.id,
                modelGradeId: modelGrade.id,
                promptVersion,
                totalTokens: usage.totalTokens,
                liveGate: {
                  id: liveGate.id,
                  status: liveGate.status,
                  detail: liveGate.detail,
                },
                modelGrader: snapshot.modelGrader,
                usabilityReplay: snapshot.usabilityReplay,
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

    const { runAiLiveEvidenceBindingSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runAiLiveEvidenceBindingSmoke(dataRoot);
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
