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
              assert.ok(snapshot.latency.p50Ms > 0, 'latency should be measurable');

              const report = await store.createAiRegressionReport({
                title: 'Phase 11 smoke regression',
                expectedEvalTotal: 96,
                expectedEvalPassed: 96,
              });
              assert.equal(report.status, 'passed');
              assert.equal(report.snapshot.runCount, 1);
              assert.ok(report.gates.length >= 7);
              assert.ok(report.gates.every((gate) => gate.status === 'passed'), 'all smoke gates should pass');
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
