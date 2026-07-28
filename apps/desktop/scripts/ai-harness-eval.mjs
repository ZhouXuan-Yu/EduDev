import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(tmpdir(), 'omni-edu-ai-harness-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'evals.mjs');
    await build({
      entryPoints: [join(appRoot, 'src/main/ai-harness/evals.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      logLevel: 'silent',
    });

    const { runAiHarnessEvalSuite } = await import(pathToFileURL(outfile).href);
    const report = runAiHarnessEvalSuite();
    assert.equal(report.total, 48, 'AI harness eval suite should contain 48 cases');
    assert.equal(report.failed, 0, JSON.stringify(report.cases.filter((item) => !item.passed), null, 2));

    console.log(JSON.stringify({
      ok: true,
      total: report.total,
      passed: report.passed,
      failed: report.failed,
      routeAccuracy: report.routeAccuracy,
    }, null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
