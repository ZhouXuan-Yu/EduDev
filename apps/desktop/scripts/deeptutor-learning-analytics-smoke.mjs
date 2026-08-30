import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-learning-analytics-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-learning-analytics-data-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'learning-analytics-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';
          import { routeAiPrompt } from './src/main/ai-harness/router';
          import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';

          function record(studentId, id, occurredAt, subject, recordType, content, tags = []) {
            return { id, studentId, occurredAt, subject, recordType, title: id, content, summary: '', tags, createdAt: occurredAt, updatedAt: occurredAt, attachments: [] };
          }

          export async function runSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            await store.init();
            const students = await store.listStudents('');
            const student = students.find((item) => item.displayName === '小A') ?? students[0];
            const other = students.find((item) => item.id !== student.id) ?? (await store.createStudent({ displayName: '小B', grade: '初二', subjects: ['数学'] }))[0];
            assert.ok(student && other, 'seed students required');
            await store.createRecord({ studentId: student.id, recordType: 'mastery_attempt', subject: '数学', title: '一次函数练习', content: JSON.stringify({ knowledgePoint: '一次函数', isCorrect: true }), tags: ['一次函数', 'mastery_attempt'], occurredAt: '2026-07-10T23:30:00-08:00' });
            await store.createRecord({ studentId: student.id, recordType: 'mistake', subject: '数学', title: '符号错题', content: 'PRIVATE_RAW_SHOULD_NOT_LEAK', tags: ['符号', '错题'], occurredAt: '2026-07-12T10:00:00Z' });
            await store.createRecord({ studentId: student.id, recordType: 'mastery_attempt', subject: '英语', title: '英语练习', content: JSON.stringify({ knowledgePoint: '阅读', isCorrect: false }), tags: ['阅读', 'mastery_attempt'], occurredAt: '2026-07-15T10:00:00Z' });
            await store.createRecord({ studentId: student.id, recordType: 'note', subject: '数学', title: '范围外', content: 'OUTSIDE_RANGE', tags: ['范围外'], occurredAt: '2026-06-01T10:00:00Z' });

            const router = routeAiPrompt('小A生成阶段学情报告', { hasStudent: true });
            assert.equal(router.route, 'report_draft');
            assert.ok(router.allowedTools.includes('analyze_learning_progress'));
            const state = createAiToolExecutionState(router, { resolvedStudentId: student.id });
            const execution = await executeAiToolCall({
              store,
              prompt: '小A生成阶段学情报告',
              router,
              state,
              call: { name: 'analyze_learning_progress', arguments: { startDate: '2026-07-01', endDate: '2026-07-31', subject: '数学' } },
            });
            assert.equal(execution.toolRun.status, 'used');
            assert.equal(execution.modelResult.analytics.metrics.recordCount, 2);
            assert.equal(execution.modelResult.analytics.metrics.masteryAttemptCount, 1);
            assert.equal(execution.modelResult.analytics.metrics.masteryAccuracy, 1);
            assert.equal(execution.modelResult.analytics.window.timezone, 'UTC-calendar');
            assert.ok(JSON.stringify(execution.modelResult).length <= 4_000, 'analytics tool result must respect the 4k tool budget');
            assert.ok(!JSON.stringify(execution.modelResult).includes('PRIVATE_RAW_SHOULD_NOT_LEAK'));
            assert.ok(!JSON.stringify(execution.modelResult).includes('OUTSIDE_RANGE'));
            assert.ok(execution.modelResult.analytics.evidence.sourceRecordIds.length === 2);

            const replay = await executeAiToolCall({
              store,
              prompt: '小A生成阶段学情报告',
              router,
              state,
              call: { name: 'analyze_learning_progress', arguments: { studentId: other.id, startDate: '2026-07-01', endDate: '2026-07-31' } },
            });
            assert.equal(replay.toolRun.status, 'blocked');
            assert.equal(replay.modelResult.reason, 'student_scope_mismatch');

            const invalidDate = await executeAiToolCall({
              store,
              prompt: '小A生成阶段学情报告',
              router,
              state,
              call: { name: 'analyze_learning_progress', arguments: { startDate: '2026-08-01', endDate: '2026-07-01' } },
            });
            assert.equal(invalidDate.toolRun.status, 'failed');
            assert.match(String(invalidDate.modelResult.reason), /startDate/);

            const empty = await executeAiToolCall({
              store,
              prompt: '小A生成阶段学情报告',
              router,
              state,
              call: { name: 'analyze_learning_progress', arguments: { startDate: '2025-01-01', endDate: '2025-01-02' } },
            });
            assert.equal(empty.toolRun.status, 'used');
            assert.equal(empty.modelResult.analytics.metrics.recordCount, 0);
            assert.ok(empty.modelResult.analytics.unknowns.some((item) => item.includes('显式正误')));

            const analytics = execution.modelResult.analytics;
            const beforeReports = await store.listReports(student.id);
            const confirmation = await store.createAiConfirmation({
              runId: 'e16_analytics_run',
              sessionId: 'e16_analytics_session',
              studentId: student.id,
              actionType: 'create_review_report',
              title: '小A阶段学情分析草稿',
              description: 'E16 教师确认边界',
              previewMd: execution.modelResult.reportDraftMarkdown,
              payload: {
                studentId: student.id,
                subject: '数学',
                startDate: analytics.window.startDate,
                endDate: analytics.window.endDate,
                reportType: 'learning_analytics',
                title: '小A阶段学情分析草稿',
                contentMd: execution.modelResult.reportDraftMarkdown,
                parentSummary: analytics.facts.join('；'),
                sourceRecordIds: analytics.evidence.sourceRecordIds,
              },
            });
            assert.equal((await store.listReports(student.id)).length, beforeReports.length);
            const confirmed = await store.confirmAiConfirmation(confirmation.id);
            assert.equal(confirmed.item.status, 'confirmed');
            assert.equal(confirmed.readback.report.reportType, 'learning_analytics');
            assert.deepEqual(confirmed.readback.report.sourceRecordIds, analytics.evidence.sourceRecordIds);
            assert.equal((await store.listReports(student.id)).length, beforeReports.length + 1);
            await assert.rejects(() => store.confirmAiConfirmation(confirmation.id), /只能确认待确认项/);

            await store.close();
            return { ok: true, cases: 8, recordCount: analytics.metrics.recordCount, sourceRecordCount: analytics.evidence.sourceRecordIds.length, reportConfirmed: true };
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
    const { runSmoke } = await import(pathToFileURL(outfile).href);
    console.log(JSON.stringify(await runSmoke(dataRoot)));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
    try { rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 }); } catch { /* SQLite may still release its temp handle after a failed assertion. */ }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
