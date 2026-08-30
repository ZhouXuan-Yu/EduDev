import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-deeptutor-memory-trace-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-memory-trace-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'memory-trace-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';
          import { routeAiPrompt } from './src/main/ai-harness/router';
          import { createAiToolExecutionState, executeAiToolCall } from './src/main/ai-harness/tool-registry';

          export async function runMemoryTraceSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            try {
              await store.init();
              const prompt = 'secret student prompt: 小A 的原始学习记录';
              const router = routeAiPrompt('查看小智最近的运行轨迹和工具摘要', { hasStudent: true });
              assert.equal(router.route, 'general_qa');
              assert.equal(router.subIntent, 'memory_trace');
              assert.deepEqual(router.contextPolicy.include, ['memory_trace']);
              assert.equal(router.contextPolicy.recordLimit, 0);
              assert.ok(router.allowedTools.includes('inspect_memory_trace'));
              assert.ok(!router.allowedTools.includes('get_student_profile'));

              const runId = await store.startAiAgentRun({
                sessionId: 'session_memory_trace_smoke',
                prompt,
                route: router.route,
                subIntent: router.subIntent,
                model: 'deepseek-smoke',
              });
              await store.recordAiAgentEvent(runId, {
                phase: 'route',
                status: 'succeeded',
                label: 'Router dry-run',
                detail: 'hidden reasoning: choose the student database',
                inputSummary: { prompt, hiddenReasoning: 'do not expose this' },
                outputSummary: { route: router.route, subIntent: router.subIntent },
              });
              await store.recordAiAgentEvent(runId, {
                phase: 'tool_call',
                status: 'succeeded',
                label: 'Inspect local evidence',
                toolName: 'search_learning_records',
                detail: 'raw student detail should never leave the L1 projection',
                inputSummary: { studentId: 'student_secret', rawPrompt: prompt },
                outputSummary: { evidenceKeys: ['record_count'] },
              });
              await store.completeAiAgentRun(runId, 'succeeded');

              const state = createAiToolExecutionState(router);
              const inspected = await executeAiToolCall({
                store,
                prompt: '查看小智最近的运行轨迹和工具摘要',
                router,
                state,
                call: { name: 'inspect_memory_trace', arguments: {} },
              });
              assert.equal(inspected.toolRun.status, 'used');
              assert.equal(inspected.modelResult.trace.layer, 'L1');
              assert.equal(inspected.modelResult.trace.status, 'succeeded');
              assert.equal(inspected.modelResult.trace.bounded, true);
              assert.equal(inspected.modelResult.trace.rawPromptIncluded, false);
              assert.equal(inspected.modelResult.trace.hiddenReasoningIncluded, false);
              assert.ok(inspected.modelResult.trace.eventCount >= 2);
              assert.ok(!JSON.stringify(inspected.modelResult).includes('secret student prompt'));
              assert.ok(!JSON.stringify(inspected.modelResult).includes('hidden reasoning'));
              assert.ok(!JSON.stringify(inspected.modelResult).includes('raw student detail'));
              const limited = await executeAiToolCall({
                store,
                prompt: 'inspect memory evidence',
                router,
                state: createAiToolExecutionState(router),
                call: { name: 'inspect_memory_trace', arguments: { runId, limit: 1 } },
              });
              assert.equal(limited.toolRun.status, 'used');
              assert.equal(limited.modelResult.trace.events.length, 1);
              assert.equal(limited.modelResult.trace.eventCount, 1);

              const missing = await executeAiToolCall({
                store,
                prompt: 'inspect memory evidence',
                router,
                state: createAiToolExecutionState(router),
                call: { name: 'inspect_memory_trace', arguments: { runId: 'run_missing' } },
              });
              assert.equal(missing.toolRun.status, 'blocked');
              assert.equal(missing.modelResult.ok, false);
              assert.equal(missing.modelResult.trace.status, 'missing');

              const readback = await store.getAiMemoryTrace(runId, 50);
              assert.equal(readback.rawPromptIncluded, false);
              assert.equal(readback.hiddenReasoningIncluded, false);
              assert.equal(readback.events.length, 2);

              return {
                ok: true,
                cases: 30,
                routeAware: true,
                bounded: true,
                noRawPrompt: true,
                noHiddenReasoning: true,
                missingRunFailClosed: true,
                limit: true,
                readback: true,
                runId,
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

    const { runMemoryTraceSmoke } = await import(pathToFileURL(outfile).href);
    console.log(JSON.stringify(await runMemoryTraceSmoke(dataRoot), null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
    rmSync(dataRoot, { recursive: true, force: true, maxRetries: 3, retryDelay: 100 });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
