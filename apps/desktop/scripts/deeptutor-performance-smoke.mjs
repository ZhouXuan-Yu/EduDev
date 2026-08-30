import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(appRoot));
const bundleRoot = mkdtempSync(join(tmpdir(), 'omni-edu-deeptutor-performance-'));

function percentile(values, p) {
  const sorted = [...values].sort((a, b) => a - b);
  return sorted[Math.min(sorted.length - 1, Math.ceil(sorted.length * p) - 1)] ?? 0;
}

async function run() {
  try {
    const outfile = join(bundleRoot, 'sidecar-client.mjs');
    await build({
      entryPoints: [join(appRoot, 'src/main/ai-harness/sidecar-client.ts')],
      bundle: true,
      platform: 'node',
      format: 'esm',
      outfile,
      logLevel: 'silent',
    });
    const terminalEvents = new Map();
    const client = new (await import(pathToFileURL(outfile).href)).DeepTutorSidecarClient({
      repoRoot,
      sidecarRoot: join(repoRoot, 'python'),
      onEvent: (event) => {
        if (event.phase === 'done') terminalEvents.get(event.turnId)?.(event);
      },
    });
    await client.start();
    const startTurn = async (turnId) => {
      const terminal = new Promise((resolve, reject) => {
        const timeout = setTimeout(() => reject(new Error(`terminal event timeout: ${turnId}`)), 5_000);
        terminalEvents.set(turnId, (event) => { clearTimeout(timeout); terminalEvents.delete(turnId); resolve(event); });
      });
      await client.startTurn({
        schemaVersion: 'xiazhi.capability.request.v1',
        turnId,
        capability: 'chat',
        prompt: 'performance smoke',
        context: { dryRun: true },
        budgets: { maxEvents: 32, maxWallMs: 120_000 },
      });
      return terminal;
    };

    const sequential = [];
    for (let index = 0; index < 10; index += 1) {
      const turnId = `perf-seq-${index}`;
      const started = performance.now();
      const event = await startTurn(turnId);
      sequential.push(performance.now() - started);
      assert.equal(event.status, 'succeeded');
    }

    const parallelStarted = performance.now();
    const parallel = await Promise.all(Array.from({ length: 6 }, (_, index) => startTurn(`perf-par-${index}`)));
    const parallelElapsed = performance.now() - parallelStarted;
    assert.ok(parallel.every((event) => event.status === 'succeeded'));
    const p95 = percentile(sequential, 0.95);
    assert.ok(p95 <= 2_000, `dry-run p95 exceeded 2s: ${p95.toFixed(1)}ms`);
    assert.ok(parallelElapsed <= 2_000, `parallel dry-run exceeded 2s: ${parallelElapsed.toFixed(1)}ms`);
    await client.stop();
    console.log(JSON.stringify({ ok: true, sequentialCount: sequential.length, p50Ms: Number(percentile(sequential, 0.5).toFixed(1)), p95Ms: Number(p95.toFixed(1)), parallelCount: parallel.length, parallelElapsedMs: Number(parallelElapsed.toFixed(1)) }));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

