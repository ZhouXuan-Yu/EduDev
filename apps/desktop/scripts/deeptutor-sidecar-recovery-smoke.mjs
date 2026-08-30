import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const repoRoot = dirname(dirname(appRoot));
const bundleRoot = mkdtempSync(join(tmpdir(), 'omni-edu-deeptutor-recovery-'));

function waitFor(predicate, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = () => {
      if (predicate()) return resolve();
      if (Date.now() >= deadline) return reject(new Error('timed out waiting for sidecar exit callback'));
      setTimeout(tick, 50);
    };
    tick();
  });
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
    const { DeepTutorSidecarClient } = await import(pathToFileURL(outfile).href);
    let exitError;
    const client = new DeepTutorSidecarClient({
      repoRoot,
      sidecarRoot: join(repoRoot, 'python'),
      onExit: (error) => { exitError = error; },
    });
    const firstManifest = await client.start();
    assert.equal(firstManifest.bridgeProtocol, 'xiazhi.bridge.v1');
    const accepted = await client.startTurn({
      schemaVersion: 'xiazhi.capability.request.v1',
      turnId: 'recovery-smoke-turn',
      capability: 'chat',
      prompt: 'recovery smoke',
      context: { dryRun: true },
      budgets: { maxEvents: 16, maxWallMs: 120_000 },
    });
    assert.equal(accepted.ok, true);
    const child = client.child;
    assert.ok(child && !child.killed, 'sidecar child should be running before adversarial kill');
    child.kill();
    await waitFor(() => Boolean(exitError));
    assert.equal(client.isReady, false, 'crashed sidecar must not remain ready');

    const restartedManifest = await client.start();
    assert.equal(restartedManifest.sidecarVersion, firstManifest.sidecarVersion);
    await client.stop();
    console.log(JSON.stringify({ ok: true, exitObserved: true, restarted: true, sidecarVersion: firstManifest.sidecarVersion }));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

