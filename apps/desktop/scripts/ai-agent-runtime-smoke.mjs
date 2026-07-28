import { build } from 'esbuild';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-ai-agent-runtime-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-agent-runtime-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'runtime-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';
          import { routeAiPrompt } from './src/main/ai-harness/router';
          import { runAiAgentLoop } from './src/main/ai-harness/agent-loop';

          export async function runRuntimeSmoke(dataRoot) {
            const store = new OmniEduStore(dataRoot);
            await store.init();
            const prompt = '请根据小A最近的学习记录，给出数学错因诊断和下一步练习建议';
            const router = routeAiPrompt(prompt, { hasStudent: false });
            const runId = await store.startAiAgentRun({
              sessionId: 'runtime-smoke-session',
              prompt,
              route: router.route,
              subIntent: router.route,
              model: 'smoke-model',
            });
            const context = await runAiAgentLoop({ store, prompt, agentRunId: runId });
            await store.completeAiAgentRun(runId, 'blocked', 'smoke stops before cloud model');
            const run = await store.getAiAgentRun(runId);
            const events = await store.listAiAgentEvents(runId);
            await store.close();

            assert.ok(run, 'agent run should be persisted');
            assert.equal(run.id, runId);
            assert.equal(run.sessionId, 'runtime-smoke-session');
            assert.equal(run.status, 'blocked');
            assert.ok(events.length >= 5, 'agent events should include route/plan/tool/observe/reflect/finalize');
            assert.deepEqual(events.map((event) => event.sequence), events.map((_, index) => index + 1));
            assert.equal(events[0].phase, 'route');
            assert.ok(events.some((event) => event.phase === 'tool_call'), 'should persist tool_call events');
            assert.ok(events.some((event) => event.phase === 'observe'), 'should persist observe events');
            assert.ok(events.some((event) => Object.keys(event.outputSummary ?? {}).length > 0), 'should persist output summaries');
            assert.equal(context.trace.length, events.length);

            return {
              ok: true,
              runId,
              status: run.status,
              eventCount: events.length,
              phases: [...new Set(events.map((event) => event.phase))],
              selectedContext: context.selectedContext,
              toolRuns: context.toolRuns.map((tool) => ({ name: tool.name, status: tool.status })),
            };
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

    const { runRuntimeSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runRuntimeSmoke(dataRoot);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    rmSync(bundleRoot, { recursive: true, force: true });
    rmSync(dataRoot, { recursive: true, force: true });
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
