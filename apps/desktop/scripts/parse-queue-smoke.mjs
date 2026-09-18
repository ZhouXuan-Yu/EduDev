import { build } from 'esbuild';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-parse-queue-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-parse-queue-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'parse-queue-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { OmniEduStore } from './src/main/db';

          export async function runParseQueueSmoke(dataRoot) {
            const outcomes = new Map();
            let calls = 0;
            const provider = {
              parseResource: async (resourceId) => {
                calls += 1;
                const planned = outcomes.get(resourceId);
                if (planned?.slow) await new Promise((resolveWait) => setTimeout(resolveWait, 150));
                if (planned && !planned.ok) return { ok: false, code: 'ENGINE_FAILED', message: planned.message || '模拟失败' };
                return { ok: true, text: '解析文本 ' + resourceId, engine: 'fake', engineVersion: '1', pageCount: 1 };
              },
            };
            const store = new OmniEduStore(dataRoot, undefined, undefined, provider);
            await store.init();

            // 1. 造 4 个待解析资源（文本资源导入后是 ready，改用直接构造 teacher_resources 行）。
            const resourceIds = [];
            for (let index = 0; index < 4; index += 1) {
              const id = 'resource_queue_' + index;
              resourceIds.push(id);
              await store.run(
                \`INSERT INTO teacher_resources (
                  id, title, resource_type, original_file_name, local_path, file_size,
                  content_hash, parse_status, parse_engine, created_at, updated_at
                ) VALUES (?, ?, 'pdf', ?, ?, 100, '', 'needs_parser', '', '2026-09-18T00:00:00.000Z', '2026-09-18T00:00:00.000Z')\`,
                [id, '队列资源 ' + index, 'queue-' + index + '.pdf', 'C:\\\\fake\\\\' + index + '.pdf'],
              );
            }
            // 第 4 个资源永久失败。
            outcomes.set(resourceIds[3], { ok: false, message: '永久失败样本' });

            // 2. 排队任务：只有待解析资源被收集。
            const job = await store.createParseJob();
            assert.equal(job.status, 'queued', 'fresh job must be queued');
            assert.equal(job.totalResources, 4, 'job must collect all pending resources');
            assert.equal(job.items.length, 4, 'job items must mirror the pending resources');

            // 3. 运行：部分失败。
            const run = await store.runParseJob(job.id);
            assert.equal(run.status, 'partial_failed', 'job with failures must settle as partial_failed');
            assert.equal(run.succeededResources, 3, 'three resources must succeed');
            assert.equal(run.failedResources, 1, 'one permanently failing resource must fail');
            assert.ok(run.items.some((item) => item.resourceId === resourceIds[3] && item.errorMessage.includes('永久失败样本')), 'failed item must record its error');
            assert.equal(calls, 4, 'each resource must be attempted exactly once per run');

            // 4. 重试只重跑失败项。
            outcomes.set(resourceIds[3], { ok: true });
            const retried = await store.retryParseJob(job.id);
            assert.equal(retried.status, 'ready', 'retry after fixing the resource must settle as ready');
            assert.equal(retried.succeededResources, 1, 'retry must only process the failed resource');
            assert.equal(retried.totalResources, 1, 'retry job must only carry failed resources');

            // 5. 取消：queued 取消确定性；running 取消逐项生效。
            for (const id of resourceIds) {
              await store.run(\`UPDATE teacher_resources SET parse_status = 'needs_parser' WHERE id = ?\`, [id]);
            }
            const cancelJob = await store.createParseJob();
            const cancelled = await store.cancelParseJob(cancelJob.id);
            assert.equal(cancelled.status, 'cancelled', 'queued job must cancel immediately');
            assert.ok(cancelled.items.every((item) => item.status === 'cancelled'), 'queued items must be marked cancelled');
            await assert.rejects(() => store.runParseJob(cancelJob.id), /只能运行待处理状态/, 'cancelled job must refuse to run');
            const runningJob = await store.createParseJob();
            outcomes.set(resourceIds[0], { ok: true, slow: true });
            const runningPromise = store.runParseJob(runningJob.id);
            let midRun = null;
            for (let attempt = 0; attempt < 40; attempt += 1) {
              midRun = await store.getParseJob(runningJob.id);
              if (midRun?.status === 'running') break;
              await new Promise((resolveWait) => setTimeout(resolveWait, 25));
            }
            assert.equal(midRun?.status, 'running', 'job must enter running state');
            await store.cancelParseJob(runningJob.id);
            const runResult = await runningPromise;
            assert.equal(runResult.status, 'cancelled', 'running job must settle as cancelled after the flag');
            assert.ok(runResult.processedResources < 4, 'cancel must stop before every resource completes');

            // 6. 重启恢复：非终态任务收敛为 failed 并可读。
            for (const id of resourceIds) {
              await store.run(\`UPDATE teacher_resources SET parse_status = 'needs_parser' WHERE id = ?\`, [id]);
            }
            const interruptedJob = await store.createParseJob();
            await store.runParseJob(interruptedJob.id).catch(() => undefined);
            await store.run(\`UPDATE parse_jobs SET status = 'running', completed_at = '' WHERE id = ?\`, [interruptedJob.id]);
            await store.close();
            await store.init();
            const recovered = await store.getParseJob(interruptedJob.id);
            assert.equal(recovered?.status, 'failed', 'interrupted job must recover as failed');
            assert.equal(recovered?.lastError, 'interrupted_by_restart', 'recovery reason must be recorded');

            // 7. 空队列拒绝 + 无 provider 拒绝。
            for (const id of resourceIds) {
              await store.run(\`UPDATE teacher_resources SET parse_status = 'ready' WHERE id = ?\`, [id]);
            }
            await assert.rejects(() => store.createParseJob(), /没有待解析的资源/, 'empty queue must be rejected');
            const noProviderStore = new OmniEduStore(dataRoot);
            await noProviderStore.init();
            await assert.rejects(() => noProviderStore.createParseJob(), /解析引擎未初始化/, 'missing provider must fail closed');
            await noProviderStore.close();

            await store.close();
            return {
              ok: true,
              collected: job.totalResources,
              succeeded: run.succeededResources,
              failed: run.failedResources,
              retriedSucceeded: retried.succeededResources,
              queuedCancel: true,
              runningCancelStops: true,
              restartRecovery: recovered?.status,
              emptyQueueRejected: true,
              missingProviderRejected: true,
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

    const { runParseQueueSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runParseQueueSmoke(dataRoot);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await cleanupWithRetry(bundleRoot);
    await cleanupWithRetry(dataRoot);
  }
}

async function cleanupWithRetry(target) {
  for (let attempt = 0; attempt < 10; attempt += 1) {
    try {
      rmSync(target, { recursive: true, force: true });
      return;
    } catch (error) {
      if (attempt === 9) {
        console.error(`cleanup warning (${target}): ${error instanceof Error ? error.message : String(error)}`);
        return;
      }
      await new Promise((resolveWait) => setTimeout(resolveWait, 150));
    }
  }
}

run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
