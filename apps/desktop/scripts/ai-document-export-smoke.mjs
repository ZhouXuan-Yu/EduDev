import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { existsSync, mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-ai-document-export-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-document-export-data-'));
const exportRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-document-export-out-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'ai-document-export-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { existsSync, readFileSync } from 'node:fs';
          import { OmniEduStore } from './src/main/db';

          export async function runAiDocumentExportSmoke(dataRoot, exportRoot) {
            const store = new OmniEduStore(dataRoot);
            try {
              await store.init();
              const contentMd = [
                '# 小智学习复盘草稿',
                '',
                '## 事实',
                '- 小A 最近 3 次练习都涉及一次函数斜率。',
                '',
                '## 下一步',
                '- 先讲清 k 的符号，再做一题变式。'
              ].join('\\n');
              const cases = [
                { artifactId: 'artifact_smoke_md', type: 'markdown', fileName: '复盘草稿.md' },
                { artifactId: 'artifact_smoke_pdf', type: 'pdf', fileName: '复盘草稿.pdf' },
                { artifactId: 'artifact_smoke_docx', type: 'docx', fileName: '复盘草稿.docx' },
              ];
              const exported = [];
              for (const item of cases) {
                const result = await store.exportDocumentArtifact({
                  ...item,
                  sessionId: 'session_document_smoke',
                  messageId: 'message_document_smoke',
                  title: '小智学习复盘草稿',
                  description: '文档导出 smoke',
                  contentMd,
                  destinationRoot: exportRoot,
                });
                assert.equal(result.status, 'exported');
                assert.ok(result.filePath.startsWith(exportRoot), 'file should be written into requested export root');
                assert.ok(existsSync(result.filePath), 'exported file should exist');
                assert.ok(result.fileSize > 0, 'exported file should not be empty');
                assert.match(result.contentHash, /^[a-f0-9]{64}$/);
                const readback = await store.getDocumentArtifact(result.id);
                assert.ok(readback, 'artifact row should be readable');
                assert.equal(readback.status, 'exported');
                assert.equal(readback.contentHash, result.contentHash);
                exported.push(result);
              }

              const markdown = exported.find((item) => item.type === 'markdown');
              assert.equal(readFileSync(markdown.filePath, 'utf8'), contentMd);
              const pdf = readFileSync(exported.find((item) => item.type === 'pdf').filePath);
              assert.equal(pdf.subarray(0, 5).toString('utf8'), '%PDF-');
              const docx = readFileSync(exported.find((item) => item.type === 'docx').filePath);
              assert.equal(docx.subarray(0, 2).toString('utf8'), 'PK');
              assert.ok(docx.includes(Buffer.from('word/document.xml')), 'docx zip should contain document.xml entry');

              const listed = await store.listDocumentArtifacts('session_document_smoke');
              assert.equal(listed.length, 3);
              assert.deepEqual(new Set(listed.map((item) => item.status)), new Set(['exported']));
              await assert.rejects(
                () => store.exportDocumentArtifact({
                  artifactId: 'artifact_bad_empty',
                  sessionId: 'session_document_smoke',
                  title: '空正文',
                  type: 'markdown',
                  fileName: 'empty.md',
                  contentMd: '',
                  destinationRoot: exportRoot,
                }),
                /正文不能为空/,
              );

              return {
                ok: true,
                exported: exported.map((item) => ({
                  id: item.id,
                  type: item.type,
                  fileName: item.fileName,
                  fileSize: item.fileSize,
                  hashPrefix: item.contentHash.slice(0, 12),
                  status: item.status,
                })),
                listed: listed.length,
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

    const { runAiDocumentExportSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runAiDocumentExportSmoke(dataRoot, exportRoot);
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
