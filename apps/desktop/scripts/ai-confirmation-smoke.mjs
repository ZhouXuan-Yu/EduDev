import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-ai-confirmation-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-confirmation-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'ai-confirmation-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';

          export async function runAiConfirmationSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            await store.init();
            const students = await store.listStudents('');
            const student = students.find((item) => item.displayName === '小A') ?? students[0];
            assert.ok(student, 'seed should provide at least one student');

            const beforeReports = await store.listReports(student.id);
            const payload = {
              studentId: student.id,
              subject: '数学',
              startDate: '2026-07-01',
              endDate: '2026-07-28',
              reportType: 'ai_draft',
              title: '小A 7月数学复盘草稿',
              contentMd: '# 小A 7月数学复盘草稿\\n\\n## 下阶段建议\\n1. 每天 10 分钟专项订正。\\n\\n## 家长沟通版摘要\\n本草稿需要老师确认后再使用。',
              parentSummary: '本草稿需要老师确认后再使用，确认前不会进入报告库。',
              sourceRecordIds: [],
            };

            const rejectItem = await store.createAiConfirmation({
              runId: 'run_reject_smoke',
              sessionId: 'session_reject_smoke',
              studentId: student.id,
              actionType: 'create_review_report',
              title: payload.title,
              description: '拒绝路径测试',
              previewMd: payload.contentMd,
              payload,
            });
            assert.equal((await store.listReports(student.id)).length, beforeReports.length, 'creating confirmation must not write reports');
            const rejected = await store.rejectAiConfirmation(rejectItem.id);
            assert.equal(rejected.item.status, 'rejected');
            assert.equal((await store.listReports(student.id)).length, beforeReports.length, 'rejecting confirmation must not write reports');

            const confirmItem = await store.createAiConfirmation({
              runId: 'run_confirm_smoke',
              sessionId: 'session_confirm_smoke',
              studentId: student.id,
              actionType: 'create_review_report',
              title: payload.title,
              description: '确认路径测试',
              previewMd: payload.contentMd,
              payload,
            });
            const pending = await store.listAiConfirmations('pending');
            assert.ok(pending.some((item) => item.id === confirmItem.id), 'created item should appear in pending queue');
            assert.equal((await store.listReports(student.id)).length, beforeReports.length, 'pending confirmation still must not write reports');

            const confirmed = await store.confirmAiConfirmation(confirmItem.id);
            assert.equal(confirmed.item.status, 'confirmed');
            assert.ok(confirmed.readback?.report, 'confirmation should return report readback');
            assert.equal(confirmed.readback.report.title, payload.title);
            assert.equal(confirmed.readback.report.contentMd, payload.contentMd);
            assert.equal((await store.listReports(student.id)).length, beforeReports.length + 1, 'confirming should write exactly one report');
            await assert.rejects(() => store.confirmAiConfirmation(confirmItem.id), /只能确认待确认项/);

            await store.close();
            return {
              ok: true,
              beforeReports: beforeReports.length,
              afterReports: beforeReports.length + 1,
              rejectedStatus: rejected.item.status,
              confirmedStatus: confirmed.item.status,
              reportId: confirmed.readback.report.id,
            };
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

    const { runAiConfirmationSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runAiConfirmationSmoke(dataRoot);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
    rmSync(dataRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
