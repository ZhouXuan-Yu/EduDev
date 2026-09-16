import { build } from 'esbuild';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { pathToFileURL } from 'node:url';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const bundleRoot = mkdtempSync(join(appRoot, '.tmp-knowledge-import-'));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-knowledge-import-'));
const fixtureRoot = mkdtempSync(join(tmpdir(), 'omni-edu-knowledge-fixture-'));

async function run() {
  try {
    const outfile = join(bundleRoot, 'knowledge-import-smoke.mjs');
    await build({
      stdin: {
        contents: `
          import assert from 'node:assert/strict';
          import { mkdirSync, writeFileSync } from 'node:fs';
          import { join } from 'node:path';
          import { OmniEduStore } from './src/main/db';

          export async function runKnowledgeImportSmoke(dataRoot, fixtureRoot) {
            const store = new OmniEduStore(dataRoot);
            await store.init();

            // 1. 目录导入：递归扫描、去重、pdf 进入 needs_parser、job/items 全量回读。
            const dirA = join(fixtureRoot, 'dirA');
            mkdirSync(join(dirA, 'sub'), { recursive: true });
            writeFileSync(join(dirA, 'a.md'), '# 斜率教学资料A\\n\\n一次函数斜率的定义与几何意义。', 'utf8');
            writeFileSync(join(dirA, 'b.txt'), '内容B：一次函数图像特征。', 'utf8');
            writeFileSync(join(dirA, 'dup-a.md'), '# 斜率教学资料A\\n\\n一次函数斜率的定义与几何意义。', 'utf8');
            writeFileSync(join(dirA, 'c.pdf'), '%PDF-1.4\\n1 0 obj\\n<<>>\\nendobj\\ntrailer\\n<<>>\\n%%EOF', 'utf8');
            writeFileSync(join(dirA, 'sub', 'nested.md'), '# 嵌套资料\\n\\n子目录中的教学资料。', 'utf8');
            const jobA = await store.createKnowledgeImportJob(dirA);
            assert.equal(jobA.status, 'queued', 'created job must start queued');
            assert.equal(jobA.rootPath, dirA, 'job must persist its root path');
            const runA = await store.runKnowledgeImportJob(jobA.id);
            assert.equal(runA.status, 'ready', 'directory import must complete as ready');
            assert.equal(runA.totalFiles, 5, 'walk must collect 5 importable files');
            assert.equal(runA.succeededFiles, 4, 'four unique files must succeed');
            assert.equal(runA.duplicateFiles, 1, 'same-content file must be deduplicated by SHA-256');
            assert.equal(runA.failedFiles, 0, 'no file should fail in the clean directory');
            assert.equal(runA.items.length, 5, 'every processed file must have a job item row');
            assert.equal(runA.items.filter((item) => item.status === 'duplicate').length, 1, 'duplicate item must be labelled');
            assert.ok(runA.items.every((item) => /^[a-f0-9]{64}$/.test(item.contentHash) || item.status === 'failed'), 'item content hashes must be real SHA-256');
            const overviewAfterA = await store.getKnowledgeOverview();
            assert.equal(overviewAfterA.counts.resources, 4, 'dedupe must keep exactly 4 teacher resources');
            const pdfResource = overviewAfterA.resources.find((resource) => resource.resourceType === 'pdf');
            assert.equal(pdfResource?.parseStatus, 'needs_parser', 'binary resource must enter needs_parser instead of fake parsing');

            // 2. 重复导入同一目录：全部判重、零新增资源。
            const jobADup = await store.createKnowledgeImportJob(dirA);
            const runADup = await store.runKnowledgeImportJob(jobADup.id);
            assert.equal(runADup.status, 'ready', 'second import of the same directory must complete');
            assert.equal(runADup.succeededFiles, 0, 'second import must not create new resources');
            assert.equal(runADup.duplicateFiles, 5, 'second import must mark every file as duplicate');
            assert.equal((await store.getKnowledgeOverview()).counts.resources, 4, 'repeated import must be zero-write for resources');

            // 3. 排队任务取消：确定性立即取消，且已取消任务不可运行。
            const jobQueued = await store.createKnowledgeImportJob(dirA);
            const cancelledQueued = await store.cancelKnowledgeImportJob(jobQueued.id);
            assert.equal(cancelledQueued.status, 'cancelled', 'cancelling a queued job must settle as cancelled');
            await assert.rejects(() => store.runKnowledgeImportJob(jobQueued.id), /只能运行待处理状态/, 'cancelled job must refuse to run');

            // 4. 导入中取消：40 个文件窗口中取消，处理过的保留、未处理的不产生资源。
            const dirB = join(fixtureRoot, 'dirB');
            mkdirSync(dirB, { recursive: true });
            for (let index = 0; index < 40; index += 1) {
              writeFileSync(join(dirB, 'cancel-file-' + index + '.txt'), '取消窗口测试文件 ' + index, 'utf8');
            }
            const jobB = await store.createKnowledgeImportJob(dirB);
            const runBPromise = store.runKnowledgeImportJob(jobB.id);
            let jobBStatus = null;
            for (let attempt = 0; attempt < 400; attempt += 1) {
              jobBStatus = await store.getKnowledgeImportJob(jobB.id);
              if (jobBStatus && jobBStatus.status === 'importing' && jobBStatus.processedFiles >= 1) break;
              await new Promise((resolveWait) => setTimeout(resolveWait, 10));
            }
            assert.equal(jobBStatus?.status, 'importing', 'mid-run job must reach importing with at least one file processed');
            await store.cancelKnowledgeImportJob(jobB.id);
            const runB = await runBPromise;
            assert.equal(runB.status, 'cancelled', 'mid-run cancel must settle the job as cancelled');
            assert.ok(runB.processedFiles < 40, 'cancel must stop before all files are processed');
            assert.ok(runB.succeededFiles >= 1, 'files processed before cancel must remain imported');
            assert.equal(runB.items.length, runB.processedFiles, 'every processed file must have exactly one item row');

            // 5. 显式路径导入 + 部分失败 + 重试修复。
            const goodPath = join(fixtureRoot, 'good.md');
            const missingPath = join(fixtureRoot, 'missing.md');
            writeFileSync(goodPath, '# 重试样例\\n\\n重试前就存在的资料。', 'utf8');
            const dupGoodPath = join(fixtureRoot, 'dup-good.md');
            writeFileSync(dupGoodPath, '# 重试样例\\n\\n重试前就存在的资料。', 'utf8');
            const jobPaths = await store.createKnowledgeImportJobFromPaths([goodPath, missingPath, dupGoodPath]);
            assert.equal(jobPaths.items.filter((item) => item.status === 'queued').length, 3, 'explicit-path job must pre-register queued items');
            const runPaths = await store.runKnowledgeImportJob(jobPaths.id);
            assert.equal(runPaths.status, 'partial_failed', 'missing source file must produce partial_failed');
            assert.equal(runPaths.succeededFiles, 1, 'existing file must succeed');
            assert.equal(runPaths.duplicateFiles, 1, 'same-content explicit path must dedupe');
            assert.equal(runPaths.failedFiles, 1, 'missing file must fail as one item');
            const failedItem = runPaths.items.find((item) => item.status === 'failed');
            assert.ok(failedItem && failedItem.errorMessage.length > 0, 'failed item must record an actionable error');
            writeFileSync(missingPath, '# 补上的资料\\n\\n重试时已修复的文件。', 'utf8');
            const retried = await store.retryKnowledgeImportJob(jobPaths.id);
            assert.equal(retried.status, 'ready', 'retry after fixing the missing file must complete');
            assert.equal(retried.succeededFiles, 1, 'retry must import the previously failed file');
            assert.equal(retried.failedFiles, 0, 'retry must have zero remaining failures');
            assert.equal((await store.getKnowledgeOverview()).counts.resources, 4 + runB.succeededFiles + 2, 'resource count must reflect only new imports');

            // 6. 扫描失败：目录不存在必须落 failed 并可读原因。
            const jobBadDir = await store.createKnowledgeImportJob(join(fixtureRoot, 'no-such-dir'));
            const runBadDir = await store.runKnowledgeImportJob(jobBadDir.id);
            assert.equal(runBadDir.status, 'failed', 'missing root directory must fail the job');
            assert.ok(runBadDir.lastError.length > 0, 'scan failure must persist an actionable lastError');

            // 7. 重启恢复：未完成任务重启后必须收敛为 failed（可重试），不得悬挂。
            const jobInterrupted = await store.createKnowledgeImportJob(dirA);
            await store.close();
            await store.init();
            const interrupted = await store.getKnowledgeImportJob(jobInterrupted.id);
            assert.equal(interrupted?.status, 'failed', 'queued job interrupted by restart must settle as failed');
            assert.equal(interrupted?.lastError, 'interrupted_by_restart', 'restart recovery must record its honest reason');

            // 8. 任务列表：最近的导入任务可回读。
            const jobs = await store.listKnowledgeImportJobs(10);
            assert.ok(jobs.length >= 6, 'job history must be readable');
            assert.ok(jobs.some((job) => job.id === runA.id), 'completed job must appear in history');

            await store.close();
            return {
              ok: true,
              dirImport: { succeeded: runA.succeededFiles, duplicate: runA.duplicateFiles, total: runA.totalFiles },
              repeatedImportDuplicates: runADup.duplicateFiles,
              queuedCancel: cancelledQueued.status,
              midRunCancel: { status: runB.status, processed: runB.processedFiles, succeeded: runB.succeededFiles },
              partialThenRetry: { status: runPaths.status, retriedStatus: retried.status, retriedSucceeded: retried.succeededFiles },
              scanFailure: runBadDir.status,
              restartRecovery: interrupted?.status,
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

    const { runKnowledgeImportSmoke } = await import(pathToFileURL(outfile).href);
    const result = await runKnowledgeImportSmoke(dataRoot, fixtureRoot);
    console.log(JSON.stringify(result, null, 2));
  } finally {
    await cleanupWithRetry(bundleRoot);
    await cleanupWithRetry(dataRoot);
    await cleanupWithRetry(fixtureRoot);
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
