import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-ai-mistake-image-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-mistake-image-'));
const sourceRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-mistake-source-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'ai-mistake-image-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { writeFileSync } from 'node:fs';
          import { join } from 'node:path';
          import { OmniEduStore } from './src/main/db';

          export async function runAiMistakeImageSmoke(dataRoot, sourceRoot) {
            const store = new OmniEduStore(dataRoot);
            try {
              await store.init();
              const student = (await store.listStudents('小A'))[0];
              assert.ok(student, 'seed should provide 小A');

              const records = await store.createRecord({
                studentId: student.id,
                recordType: 'mistake',
                subject: '数学',
                title: '错题图片导入 smoke',
                content: '用于验证错题图片解析状态和脱敏链路。',
                tags: ['错题图片', '脱敏'],
              });
              const record = records.find((item) => item.title === '错题图片导入 smoke');
              assert.ok(record, 'record should be created');

              const imagePath = join(sourceRoot, 'mistake-smoke.png');
              writeFileSync(imagePath, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
              const imported = await store.importAttachments(student.id, record.id, [imagePath]);
              assert.equal(imported.status, 'succeeded');
              const importedRecord = imported.records.find((item) => item.id === record.id);
              const attachment = importedRecord?.attachments.find((item) => item.fileType === 'image');
              assert.ok(attachment, 'image attachment should be copied into managed data root');
              assert.ok(await store.isManagedLocalPath(attachment.filePath), 'attachment path must stay inside managed data root');

              const pending = await store.createMistakeImageAnalysis({
                studentId: student.id,
                recordId: record.id,
                attachmentId: attachment.id,
              });
              assert.equal(pending.ocrStatus, 'needs_ocr');
              assert.equal(pending.extractedText, '');
              assert.equal(pending.sanitizedText, '');

              const rawText = '小A 手机号 13812345678，身份证 110101200001011234，邮箱 test@example.com。题目：一次函数 y=2x+1，求 k。';
              const sanitized = await store.createMistakeImageAnalysis({
                studentId: student.id,
                recordId: record.id,
                attachmentId: attachment.id,
                extractedText: rawText,
              });
              assert.equal(sanitized.ocrStatus, 'sanitized');
              assert.ok(!sanitized.sanitizedText.includes('13812345678'), 'phone must be redacted');
              assert.ok(!sanitized.sanitizedText.includes('110101200001011234'), 'id card must be redacted');
              assert.ok(!sanitized.sanitizedText.includes('test@example.com'), 'email must be redacted');
              assert.ok(!sanitized.sanitizedText.includes('小A'), 'student display name must be redacted');
              assert.ok(sanitized.sanitizedText.includes('一次函数'), 'math problem content should remain');
              assert.ok(sanitized.redactions.some((item) => item.kind === 'phone' && item.count === 1));
              assert.ok(sanitized.redactions.some((item) => item.kind === 'id_card' && item.count === 1));
              assert.ok(sanitized.redactions.some((item) => item.kind === 'email' && item.count === 1));
              assert.ok(sanitized.redactions.some((item) => item.kind === 'student_name' && item.count >= 1));

              const corrected = await store.updateMistakeImageCorrection(sanitized.id, {
                extractedText: '小A 修正题干：手机号 13900001111。题目：若 y=kx+1 递增，判断 k 的符号。',
              });
              assert.equal(corrected.ocrStatus, 'teacher_corrected');
              assert.ok(!corrected.sanitizedText.includes('13900001111'), 'corrected phone must be redacted');
              assert.ok(!corrected.sanitizedText.includes('小A'), 'corrected student name must be redacted');
              assert.ok(corrected.sanitizedText.includes('判断 k 的符号'), 'corrected problem content should remain');

              const allAnalyses = await store.listMistakeImageAnalyses(student.id);
              assert.ok(allAnalyses.some((item) => item.id === pending.id));
              assert.ok(allAnalyses.some((item) => item.id === corrected.id));

              return {
                ok: true,
                importStatus: imported.status,
                pendingStatus: pending.ocrStatus,
                correctedStatus: corrected.ocrStatus,
                redactionKinds: corrected.redactions.map((item) => item.kind).sort(),
                analysisCount: allAnalyses.length,
                rawImageUploaded: false,
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

    const { runAiMistakeImageSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runAiMistakeImageSmoke(dataRoot, sourceRoot);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    rmSync(sourceRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
