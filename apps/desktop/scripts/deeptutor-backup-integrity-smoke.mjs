import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-backup-integrity-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-backup-source-'));
const destinationRoot = mkdtempSync(join(tmpdir(), 'omni-edu-backup-destination-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'backup-integrity-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { existsSync, readFileSync, writeFileSync } from 'node:fs';
          import { join } from 'node:path';
          import { OmniEduStore } from './src/main/db';
          export async function runSmoke(dataRoot, destinationRoot) {
            const store = new OmniEduStore(dataRoot);
            await store.init();
            await store.createStudent({ displayName: '备份校验学生', grade: '初一', subjects: ['数学'], goals: '', currentIssues: '', parentConcerns: '', teacherNotes: '', tags: [] });
            const backup = await store.exportDataRoot(destinationRoot);
            assert.equal(backup.verified, true);
            assert.ok(backup.manifestPath.endsWith('omni-edu-backup-manifest.v1.json'));
            assert.equal(existsSync(backup.manifestPath), true);
            const verified = await store.verifyDataBackup(backup.exportPath);
            assert.equal(verified.verified, true);
            assert.equal(verified.fileCount, backup.fileCount);
            const manifest = JSON.parse(readFileSync(backup.manifestPath, 'utf8'));
            const first = manifest.files[0];
            assert.ok(first?.path);
            const tamperedPath = join(backup.exportPath, first.path);
            writeFileSync(tamperedPath, readFileSync(tamperedPath, 'utf8') + '\\nTAMPERED');
            const tampered = await store.verifyDataBackup(backup.exportPath);
            assert.equal(tampered.verified, false);
            assert.ok(tampered.changedFiles.includes(first.path));
            await assert.rejects(() => store.exportDataRoot(dataRoot), /不能位于当前数据目录内/);
            await store.close();
            return { ok: true, cases: 9, manifest: true, initialVerified: true, tamperDetected: true, sourceBoundary: true, bounded: true };
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
    console.log(JSON.stringify(await runSmoke(dataRoot, destinationRoot)));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
    rmSync(dataRoot, { recursive: true, force: true });
    rmSync(destinationRoot, { recursive: true, force: true });
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
