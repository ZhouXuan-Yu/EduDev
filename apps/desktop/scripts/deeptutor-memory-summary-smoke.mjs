import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-deeptutor-memory-summary-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-memory-summary-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'memory-summary-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';
          import { routeAiPrompt } from './src/main/ai-harness/router';
          import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';

          export async function runMemorySummarySmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            try {
              await store.init();
              const router = routeAiPrompt('inspect the editable L2 memory summary', { hasStudent: true });
              assert.equal(router.route, 'general_qa');
              assert.equal(router.subIntent, 'memory_summary');
              assert.deepEqual(router.contextPolicy.include, ['memory_summary']);
              assert.equal(router.contextPolicy.recordLimit, 0);
              assert.ok(router.allowedTools.includes('inspect_memory_summary'));
              assert.ok(router.allowedTools.includes('draft_memory_summary'));
              assert.ok(!router.allowedTools.includes('get_student_profile'));

              const before = await store.getAiMemoryDocument('chat');
              assert.equal(before, null);
              const runId = await store.startAiAgentRun({ sessionId: 'session_memory_summary_smoke', prompt: 'secret original prompt that must not leak', route: router.route, subIntent: router.subIntent, model: 'deepseek-smoke' });
              await store.recordAiAgentEvent(runId, { phase: 'route', status: 'succeeded', label: 'route', detail: 'secret hidden detail', inputSummary: { prompt: 'secret original prompt' }, outputSummary: { route: router.route } });
              await store.recordAiAgentEvent(runId, { phase: 'tool_call', status: 'succeeded', label: 'tool', toolName: 'search_learning_records', detail: 'secret student body', inputSummary: { raw: 'secret original prompt' }, outputSummary: { recordCount: 2 } });
              await store.completeAiAgentRun(runId, 'succeeded');
              const eventId = (await store.listAiAgentEvents(runId))[0].id;

              const draft = await store.draftAiMemorySummary('chat', runId, 8);
              assert.equal(draft.layer, 'L2');
              assert.equal(draft.sourceRunId, runId);
              assert.equal(draft.entries.length, 2);
              assert.equal(draft.entries[0].requiresTeacherReview, true);
              assert.equal(draft.rawPromptIncluded, false);
              assert.equal(draft.hiddenReasoningIncluded, false);
              assert.ok(!JSON.stringify(draft).includes('secret original prompt'));
              assert.ok(!JSON.stringify(draft).includes('secret student body'));

              const toolState = createAiToolExecutionState(router);
              const drafted = await executeAiToolCall({ store, prompt: 'draft a surface summary from local evidence without writing memory', router, state: toolState, call: { name: 'draft_memory_summary', arguments: { surface: 'chat', runId, limit: 2 } } });
              assert.equal(drafted.toolRun.status, 'used');
              assert.equal(drafted.modelResult.writesMemory, false);
              assert.equal(drafted.modelResult.requiresTeacherReview, true);
              assert.equal((await store.getAiMemoryDocument('chat')), null);
              assert.ok(!JSON.stringify(drafted.modelResult).includes('secret original prompt'));

              const entry = await store.createAiMemoryEntry({ surface: 'chat', section: 'Teacher notes', text: 'Teacher confirmed the recent work focused on bounded evidence review.', refs: ['ai_agent_event:' + eventId], origin: 'teacher' });
              assert.equal(entry.status, 'active');
              assert.equal(entry.origin, 'teacher');
              assert.equal(entry.version, 1);
              assert.equal(entry.refs[0].kind, 'event');
              const detail = await store.getAiMemoryDocument('chat');
              assert.ok(detail);
              assert.equal(detail.document.activeEntryCount, 1);
              assert.equal(detail.entries.length, 1);

              const inspected = await executeAiToolCall({ store, prompt: 'inspect the editable L2 memory summary', router, state: createAiToolExecutionState(router), call: { name: 'inspect_memory_summary', arguments: { surface: 'chat' } } });
              assert.equal(inspected.toolRun.status, 'used');
              assert.equal(inspected.modelResult.layer, 'L2');
              assert.equal(inspected.modelResult.entries.length, 1);
              assert.equal(inspected.modelResult.entries[0].refs[0].id, eventId);
              assert.equal(inspected.modelResult.rawPromptIncluded, false);

              const updated = await store.updateAiMemoryEntry(entry.id, { version: entry.version, text: 'Teacher edited the summary after reviewing the evidence.', refs: ['ai_agent_event:' + eventId] });
              assert.equal(updated.version, 2);
              assert.equal(updated.text, 'Teacher edited the summary after reviewing the evidence.');
              await assert.rejects(() => store.updateAiMemoryEntry(entry.id, { version: 1, text: 'stale edit', refs: ['ai_agent_event:' + eventId] }), /version conflict/);
              const revisions = await store.listAiMemoryRevisions(entry.id, 20);
              assert.equal(revisions.length, 2);
              assert.equal(revisions[0].action, 'edit');

              const disabled = await store.updateAiMemoryEntry(entry.id, { version: updated.version, status: 'disabled' });
              assert.equal(disabled.status, 'disabled');
              const hidden = await executeAiToolCall({ store, prompt: 'inspect the editable L2 memory summary', router, state: createAiToolExecutionState(router), call: { name: 'inspect_memory_summary', arguments: { surface: 'chat' } } });
              assert.equal(hidden.modelResult.entries.length, 0);
              const visibleDeleted = await executeAiToolCall({ store, prompt: 'inspect the editable L2 memory summary', router, state: createAiToolExecutionState(router), call: { name: 'inspect_memory_summary', arguments: { surface: 'chat', includeDeleted: true } } });
              assert.equal(visibleDeleted.modelResult.entries.length, 1);
              assert.equal(visibleDeleted.modelResult.entries[0].status, 'disabled');

              await assert.rejects(() => store.createAiMemoryEntry({ surface: 'chat', text: 'always mastered', refs: ['ai_agent_event:' + eventId] }), /absolute claim/);
              await assert.rejects(() => store.createAiMemoryEntry({ surface: 'chat', text: 'bad ref', refs: ['ai_agent_event:event_missing'] }), /evidence not found/);
              await assert.rejects(() => store.createAiMemoryEntry({ surface: 'chat', text: 'derived must remain draft', refs: ['ai_agent_event:' + eventId], origin: 'derived' }), /remain drafts/);

              const deleted = await store.deleteAiMemoryEntry(entry.id, disabled.version);
              assert.equal(deleted.status, 'deleted');
              const finalDetail = await store.getAiMemoryDocument('chat');
              assert.equal(finalDetail.document.activeEntryCount, 0);
              assert.equal(finalDetail.entries[0].status, 'deleted');
              assert.ok((await store.listAiMemoryDocuments()).some((doc) => doc.surface === 'chat'));

              return { ok: true, cases: 36, routeAware: true, draftNoWrite: true, evidenceBound: true, teacherEditable: true, optimisticLock: true, revisionAudit: true, disableDelete: true, bannedClaimGuard: true, invalidRefGuard: true, noSensitiveLeak: true, runId, entryId: entry.id };
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
    const { runMemorySummarySmoke } = await import(pathToFileURL(outfile).href);
    console.log(JSON.stringify(await runMemorySummarySmoke(dataRoot), null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

run().catch((error) => { console.error(error); process.exitCode = 1; });
