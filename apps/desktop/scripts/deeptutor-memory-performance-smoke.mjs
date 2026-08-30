import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-deeptutor-memory-performance-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-memory-performance-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'memory-performance-smoke.mjs');
    await build({ stdin: { contents: `
      import assert from 'node:assert/strict';
      import { OmniEduStore } from './src/main/db';
      export async function runMemoryPerformanceSmoke(dataRoot) {
        const store = new OmniEduStore(dataRoot); await store.init();
        try {
          const runId = await store.startAiAgentRun({ sessionId: 'memory-performance', prompt: 'bounded', route: 'general_qa', subIntent: 'memory_summary', model: 'smoke' });
          await store.recordAiAgentEvent(runId, { phase: 'route', status: 'succeeded', label: 'route', detail: '', outputSummary: { ok: true } });
          const eventId = (await store.listAiAgentEvents(runId))[0].id;
          for (let i = 0; i < 100; i++) await store.createAiMemoryEntry({ surface: i % 2 ? 'chat' : 'notebook', section: 'fixture', text: 'Teacher-confirmed bounded evidence item ' + i, refs: ['ai_agent_event:' + eventId], origin: 'teacher' });
          await store.createAiMemoryL3Entry({ slot: 'profile', text: 'Teacher-confirmed profile synthesis from bounded evidence.', sourceDocuments: ['chat', 'notebook'] });
          const samples = [];
          for (let i = 0; i < 20; i++) { const started = performance.now(); await Promise.all([store.getAiMemoryEvidenceGraph(200), store.getAiMemoryGovernanceReport()]); samples.push(performance.now() - started); }
          samples.sort((a, b) => a - b); const p95Ms = samples[Math.min(samples.length - 1, Math.ceil(samples.length * 0.95) - 1)];
          assert.ok(p95Ms < 2000, 'memory governance/graph p95 should remain below 2s');
          return { ok: true, entries: 101, samples: samples.length, p95Ms: Math.round(p95Ms), maxMs: Math.round(samples[samples.length - 1]) };
        } finally { await store.close(); }
      }
    `, resolveDir: appRoot, loader: 'ts' }, bundle: true, platform: 'node', format: 'esm', outfile, external: ['sqlite3'], logLevel: 'silent' });
    const { runMemoryPerformanceSmoke } = await import(pathToFileURL(outfile).href);
    console.log(JSON.stringify(await runMemoryPerformanceSmoke(dataRoot), null, 2));
  } finally { rmSync(bundleRoot, { recursive: true, force: true, maxRetries: 3 }); rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3 }); }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
