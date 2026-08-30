import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-error-taxonomy-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-error-taxonomy-data-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'error-taxonomy-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';
          import { routeAiPrompt } from './src/main/ai-harness/router';
          import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';
          import { executeHostToolRequest } from './src/main/ai-harness/host-tool-proxy';

          export async function runSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            await store.init();
            const students = await store.listStudents('');
            const student = students[0] ?? (await store.createStudent({ displayName: '小A', grade: '初二', subjects: ['数学'] }))[0];
            const other = students.find((item) => item.id !== student.id) ?? (await store.createStudent({ displayName: '小B', grade: '初二', subjects: ['数学'] }))[0];
            const at = (day) => '2026-07-' + String(day).padStart(2, '0') + 'T10:00:00Z';
            await store.createRecord({ studentId: student.id, recordType: 'mistake', subject: '数学', title: '概念混淆', content: JSON.stringify({ errorType: 'structural', private: 'PRIVATE_RAW_SHOULD_NOT_LEAK' }), tags: ['错题'], occurredAt: at(1) });
            await store.createRecord({ studentId: student.id, recordType: 'mistake', subject: '数学', title: '空白作答', content: JSON.stringify({ isCorrect: false, answer: '' }), tags: ['错题'], occurredAt: at(2) });
            await store.createRecord({ studentId: student.id, recordType: 'mistake', subject: '数学', title: '粗心漏写符号', content: '学生计算时漏写符号', tags: ['错因'], occurredAt: at(3) });
            await store.createRecord({ studentId: student.id, recordType: 'mistake', subject: '数学', title: '题意读错', content: '读题时把条件理解错了', tags: ['错题'], occurredAt: at(4) });
            await store.createRecord({ studentId: student.id, recordType: 'mistake', subject: '数学', title: '无法判断', content: 'OUTSIDE_RAW_SHOULD_NOT_LEAK', tags: ['错题'], occurredAt: at(5) });
            await store.createRecord({ studentId: student.id, recordType: 'note', subject: '数学', title: '范围外', content: 'OUTSIDE_RANGE', tags: [], occurredAt: '2026-06-01T10:00:00Z' });

            const router = routeAiPrompt('分析这道错题为什么会错', { hasStudent: true });
            assert.equal(router.route, 'error_analysis');
            assert.ok(router.allowedTools.includes('classify_error_patterns'));
            const state = createAiToolExecutionState(router, { resolvedStudentId: student.id });
            const call = { name: 'classify_error_patterns', arguments: { startDate: '2026-07-01', endDate: '2026-07-31', subject: '数学' } };
            const execution = await executeAiToolCall({ store, prompt: '分析错因', router, state, call });
            assert.equal(execution.toolRun.status, 'used');
            assert.equal(execution.modelResult.analysis.schemaVersion, 'omni.error.taxonomy.v1');
            assert.equal(execution.modelResult.analysis.evidence.includedRecordCount, 5);
            assert.equal(execution.modelResult.analysis.counts.structural, 1);
            assert.equal(execution.modelResult.analysis.counts.metacognitive, 1);
            assert.equal(execution.modelResult.analysis.counts.application, 1);
            assert.equal(execution.modelResult.analysis.counts.deviation, 1);
            assert.equal(execution.modelResult.analysis.counts.unknown, 1);
            assert.ok(execution.modelResult.analysis.evidence.unknownRecordIds.length === 1);
            assert.ok(JSON.stringify(execution.modelResult).length <= 4_000);
            assert.ok(!JSON.stringify(execution.modelResult).includes('PRIVATE_RAW_SHOULD_NOT_LEAK'));
            assert.ok(!JSON.stringify(execution.modelResult).includes('OUTSIDE_RAW_SHOULD_NOT_LEAK'));
            assert.ok(!JSON.stringify(execution.modelResult).includes('OUTSIDE_RANGE'));

            const rerun = await executeAiToolCall({ store, prompt: '分析错因', router, state: createAiToolExecutionState(router, { resolvedStudentId: student.id }), call });
            assert.equal(rerun.modelResult.analysis.recalculationKey, execution.modelResult.analysis.recalculationKey);

            const hostRoundTrip = await executeHostToolRequest({
              store,
              prompt: '分析错因',
              router,
              boundStudentId: student.id,
              request: { schemaVersion: 'xiazhi.host_tool.request.v1', requestId: 'e14_host_1', turnId: 'e14_turn_1', capability: 'deep_solve', toolName: 'classify_error_patterns', arguments: { startDate: '2026-07-01', endDate: '2026-07-31', subject: '数学' } },
            });
            assert.equal(hostRoundTrip.result.status, 'used');
            assert.equal(hostRoundTrip.result.modelResult.analysis.schemaVersion, 'omni.error.taxonomy.v1');

            const mismatch = await executeAiToolCall({ store, prompt: '分析错因', router, state, call: { name: 'classify_error_patterns', arguments: { studentId: other.id } } });
            assert.equal(mismatch.toolRun.status, 'blocked');
            assert.equal(mismatch.modelResult.reason, 'student_scope_mismatch');

            const invalid = await executeAiToolCall({ store, prompt: '分析错因', router, state, call: { name: 'classify_error_patterns', arguments: { startDate: '2026-08-01', endDate: '2026-07-01' } } });
            assert.equal(invalid.toolRun.status, 'failed');
            assert.match(String(invalid.modelResult.reason), /startDate/);

            const empty = await executeAiToolCall({ store, prompt: '分析错因', router, state, call: { name: 'classify_error_patterns', arguments: { startDate: '2025-01-01', endDate: '2025-01-02' } } });
            assert.equal(empty.toolRun.status, 'used');
            assert.equal(empty.modelResult.analysis.evidence.includedRecordCount, 0);
            assert.ok(empty.modelResult.analysis.unknowns.length > 0);

            const reportsBefore = (await store.listReports(student.id)).length;
            assert.equal((await store.listReports(student.id)).length, reportsBefore);
            await store.close();
            return { ok: true, cases: 11, included: execution.modelResult.analysis.evidence.includedRecordCount, unknown: execution.modelResult.analysis.evidence.unknownRecordIds.length, hostRoundTrip: true, noWrite: true };
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
