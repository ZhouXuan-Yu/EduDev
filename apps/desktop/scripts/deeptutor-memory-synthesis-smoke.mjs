import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-deeptutor-memory-synthesis-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-memory-synthesis-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'memory-synthesis-smoke.mjs');
    await build({
      stdin: { contents: `
        import assert from 'node:assert/strict';
        import { OmniEduStore } from './src/main/db';
        import { routeAiPrompt } from './src/main/ai-harness/router';
        import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';
        export async function runMemorySynthesisSmoke(dataRoot) {
          const store = new OmniEduStore(dataRoot); await store.init();
          try {
            const router = routeAiPrompt('inspect the L3 cross-surface profile memory', { hasStudent: true });
            assert.equal(router.subIntent, 'memory_synthesis');
            assert.deepEqual(router.contextPolicy.include, ['memory_synthesis']);
            assert.ok(router.allowedTools.includes('inspect_memory_synthesis'));
            assert.ok(!router.allowedTools.includes('get_student_profile'));
            const runId = await store.startAiAgentRun({ sessionId: 'memory_synthesis_smoke', prompt: 'secret', route: 'general_qa', subIntent: 'memory_summary', model: 'smoke' });
            await store.recordAiAgentEvent(runId, { phase: 'route', status: 'succeeded', label: 'route', detail: 'hidden', inputSummary: { prompt: 'secret' }, outputSummary: { ok: true } });
            await store.completeAiAgentRun(runId, 'succeeded');
            const eventId = (await store.listAiAgentEvents(runId))[0].id;
            await store.createAiMemoryEntry({ surface: 'chat', section: 'Activity', text: 'Teacher confirmed a recent algebra review.', refs: ['ai_agent_event:' + eventId], origin: 'teacher' });
            const draft = await store.draftAiMemoryL3('profile', 8);
            assert.equal(draft.layer, 'L3'); assert.equal(draft.entries.length, 1); assert.equal(draft.entries[0].requiresTeacherReview, true);
            assert.ok(!JSON.stringify(draft).includes('secret'));
            const tool = await executeAiToolCall({ store, prompt: 'draft a recent memory synthesis from confirmed L2 entries', router, state: createAiToolExecutionState(router), call: { name: 'draft_memory_synthesis', arguments: { slot: 'profile', limit: 8 } } });
            assert.equal(tool.toolRun.status, 'used'); assert.equal(tool.modelResult.writesMemory, false);
            assert.equal((await store.getAiMemoryL3Document('profile')), null);
            const entry = await store.createAiMemoryL3Entry({ slot: 'profile', text: draft.entries[0].text, sourceDocuments: draft.entries[0].sourceDocuments });
            assert.equal(entry.version, 1);
            const graph = await store.getAiMemoryEvidenceGraph(200);
            assert.ok(graph.nodes.some((node) => node.kind === 'l3_entry'));
            assert.ok(graph.edges.some((edge) => edge.kind === 'derived_from'));
            assert.equal(graph.rawPromptIncluded, false);
            const inspectedGraph = await executeAiToolCall({ store, prompt: 'inspect the L3 cross-surface profile memory', router, state: createAiToolExecutionState(router), call: { name: 'inspect_memory_graph', arguments: { limit: 200 } } });
            assert.equal(inspectedGraph.toolRun.status, 'used'); assert.equal(inspectedGraph.modelResult.graph.rawPromptIncluded, false);
            const governance = await store.getAiMemoryGovernanceReport();
            assert.equal(governance.policyVersion, 'memory-governance.v1'); assert.equal(governance.danglingEvidenceRefs, 0); assert.equal(governance.writableByAi, false);
            const governanceTool = await executeAiToolCall({ store, prompt: 'inspect memory governance', router, state: createAiToolExecutionState(router), call: { name: 'inspect_memory_governance', arguments: {} } });
            assert.equal(governanceTool.toolRun.status, 'used'); assert.equal(governanceTool.modelResult.governance.danglingEvidenceRefs, 0);
            const inspected = await executeAiToolCall({ store, prompt: 'inspect the L3 cross-surface profile memory', router, state: createAiToolExecutionState(router), call: { name: 'inspect_memory_synthesis', arguments: { slot: 'profile' } } });
            assert.equal(inspected.toolRun.status, 'used'); assert.equal(inspected.modelResult.detail.entries.length, 1); assert.equal(inspected.modelResult.rawPromptIncluded, false);
            await assert.rejects(() => store.updateAiMemoryL3Entry(entry.id, { version: 0, text: 'stale' }), /version conflict/);
            const updated = await store.updateAiMemoryL3Entry(entry.id, { version: 1, text: 'Teacher revised the cross-surface profile.' }); assert.equal(updated.version, 2);
            return { ok: true, cases: 30, routeAware: true, draftNoWrite: true, evidenceBound: true, graphBound: true, governanceBound: true, optimisticLock: true, noSensitiveLeak: true };
          } finally { await store.close(); }
        }
      `, resolveDir: appRoot, loader: 'ts' },
      bundle: true, platform: 'node', format: 'esm', outfile, external: ['sqlite3'], logLevel: 'silent',
    });
    const { runMemorySynthesisSmoke } = await import(pathToFileURL(outfile).href);
    console.log(JSON.stringify(await runMemorySynthesisSmoke(dataRoot), null, 2));
  } finally { rmSync(bundleRoot, { recursive: true, force: true, maxRetries: 3 }); rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3 }); }
}
run().catch((error) => { console.error(error); process.exitCode = 1; });
