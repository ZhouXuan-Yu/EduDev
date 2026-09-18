import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-error-review-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-error-review-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'error-review-write-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';

          export async function runErrorReviewWriteSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            await store.init();
            const students = await store.listStudents('');
            const student = students[0];
            const otherStudent = await store.createStudent({ displayName: '错因隔离学生', realName: '', grade: '八年级', school: '', subjects: ['数学'], goals: '', currentIssues: '', parentConcerns: '', teacherNotes: '', tags: [] });
            assert.ok(student, 'seed should provide a student');

            // 1. 造证据：不同错因信号的错题记录。
            await store.createRecord({ studentId: student.id, recordType: 'mistake', subject: '数学', title: '概念混淆错题', content: '概念混淆：把斜率与截距的几何意义搞混了。', summary: '', tags: ['一次函数'] });
            await store.createRecord({ studentId: student.id, recordType: 'mistake', subject: '数学', title: '审题偏差错题', content: '读题时漏掉条件，题意理解偏差。', summary: '', tags: ['审题'] });
            await store.createRecord({ studentId: student.id, recordType: 'mistake', subject: '数学', title: '计算步骤错题', content: '计算过程中符号写错，步骤代入错误。', summary: '', tags: ['计算'] });
            const foreignRecord = await store.createRecord({ studentId: otherStudent[0].id, recordType: 'mistake', subject: '数学', title: '别的学生错题', content: '概念混淆，属于其他学生。', summary: '', tags: [] });

            // 2. 分析：必须产生分类结果且都带证据边界。
            const analysis = await store.analyzeStudentErrorPatterns(student.id, {});
            assert.equal(analysis.analysis.schemaVersion, 'omni.error.taxonomy.v1', 'analysis must carry the taxonomy schema');
            assert.ok(analysis.analysis.classifications.length >= 3, 'analysis must classify the seeded mistake records');
            assert.ok(analysis.analysis.classifications.some((item) => item.category === 'structural'), 'concept confusion must classify as structural');

            // 3. 提案（教师修正分类）只进确认队列，零写入。
            const beforeRecords = (await store.listRecords(student.id)).length;
            const target = analysis.analysis.classifications.find((item) => item.category === 'structural');
            const proposal = await store.proposeErrorReview({
              studentId: student.id,
              startDate: analysis.analysis.window.startDate,
              endDate: analysis.analysis.window.endDate,
              items: [{ recordId: target.recordId, category: 'application', note: '教师修正：其实是计算步骤问题。' }],
            });
            assert.equal(proposal.actionType, 'save_error_review', 'proposal must target the error review action');
            assert.equal(proposal.status, 'pending', 'proposal must stay pending until the teacher confirms');
            assert.equal(proposal.payload.errorReview.items[0].category, 'application', 'teacher category correction must be carried into the payload');
            assert.equal(proposal.payload.errorReview.items[0].note, '教师修正：其实是计算步骤问题。', 'teacher note must be carried into the payload');
            assert.equal((await store.listRecords(student.id)).length, beforeRecords, 'proposal must not write any learning record');

            // 4. 越权与非法输入必须 fail-closed。
            await assert.rejects(
              () => store.proposeErrorReview({ studentId: student.id, items: [{ recordId: foreignRecord[0].id, category: 'structural' }] }),
              /不在本次错因分析范围/,
              'records outside the analysis must be rejected',
            );
            await assert.rejects(
              () => store.proposeErrorReview({ studentId: student.id, items: [{ recordId: target.recordId, category: 'bogus' }] }),
              /错因分类非法/,
              'unknown categories must be rejected',
            );
            await assert.rejects(
              () => store.proposeErrorReview({ studentId: student.id, items: [] }),
              /没有可提交的错因条目/,
              'empty submissions must be rejected',
            );

            // 5. 教师确认 → 写入学习记录并 readback。
            const confirmed = await store.confirmAiConfirmation({ id: proposal.id });
            assert.equal(confirmed.item.status, 'confirmed', 'confirmation must settle as confirmed');
            assert.ok(confirmed.readback?.errorReview, 'confirmation must return an error review readback');
            assert.equal(confirmed.readback.errorReview.createdRecordIds.length, 1, 'one reviewed item must create one record');
            const afterRecords = await store.listRecords(student.id);
            assert.equal(afterRecords.length, beforeRecords + 1, 'confirming must write exactly one record');
            const written = afterRecords.find((record) => record.id === confirmed.readback.errorReview.createdRecordIds[0]);
            assert.equal(written?.recordType, 'error_review', 'written record must use the error_review type');
            const metadata = JSON.parse(written.content);
            assert.equal(metadata.category, 'application', 'written metadata must keep the teacher-corrected category');
            assert.equal(metadata.sourceRecordId, target.recordId, 'written metadata must reference the source record');
            assert.equal(metadata.taxonomyVersion, 'omni.error.taxonomy.v1', 'written metadata must keep the taxonomy version');
            assert.equal(metadata.teacherConfirmed, true, 'written metadata must record teacher confirmation');
            assert.ok(Array.isArray(metadata.evidence), 'written metadata must keep the evidence list');
            await assert.rejects(() => store.confirmAiConfirmation({ id: proposal.id }), /只能确认待确认项/, 're-confirming must be rejected');

            // 6. 拒绝路径零写入。
            const rejectProposal = await store.proposeErrorReview({ studentId: student.id, items: [{ recordId: target.recordId, category: 'unknown' }] });
            const beforeReject = (await store.listRecords(student.id)).length;
            const rejected = await store.rejectAiConfirmation(rejectProposal.id);
            assert.equal(rejected.item.status, 'rejected', 'reject must settle the item');
            assert.equal((await store.listRecords(student.id)).length, beforeReject, 'rejecting must not write any record');

            // 7. 重启后回读。
            await store.close();
            await store.init();
            const afterRestart = await store.listRecords(student.id);
            assert.ok(afterRestart.some((record) => record.id === confirmed.readback.errorReview.createdRecordIds[0]), 'confirmed error review must persist after restart');
            assert.ok(!afterRestart.some((record) => record.title.includes('unknown')), 'rejected proposal must not leave a record');

            await store.close();
            return {
              ok: true,
              classified: analysis.analysis.classifications.length,
              confirmedRecords: confirmed.readback.errorReview.createdRecordIds.length,
              writebackCategory: metadata.category,
              rejectedZeroWrites: true,
              restartReadback: true,
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

    const { runErrorReviewWriteSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runErrorReviewWriteSmoke(dataRoot);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await cleanupWithRetry(bundleRoot);
    await cleanupWithRetry(dataRoot);
  }
}

async function cleanupWithRetry(target) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      rmSync(target, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 9) {
        console.error(`cleanup warning (${target}): ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 150));
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
