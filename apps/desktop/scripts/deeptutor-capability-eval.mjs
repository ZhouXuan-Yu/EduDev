import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(tmpdir(), 'omni-edu-deeptutor-capability-evals-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'capability-evals.mjs');
    await build({
      entryPoints: [join(appRoot, 'src/main/ai-harness/deeptutor-capability-evals.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      logLevel: 'silent',
    });
    const { runDeepTutorCapabilityEvalSuite } = await import(pathToFileURL(outfile).href);
    const report = await runDeepTutorCapabilityEvalSuite();
    assert.equal(report.total, 48, JSON.stringify(report, null, 2));
    assert.equal(report.failed, 0, JSON.stringify(report.cases.filter((item) => !item.passed), null, 2));
    console.log(JSON.stringify({ ok: report.ok, total: report.total, passed: report.passed, failed: report.failed, groups: report.groups }, null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

