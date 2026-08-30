import { _electron as electron } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-r11-lineage-'));
let app;

async function waitForRun(page, runId, timeoutMs = 12_000) {
  const deadline = Date.now() + timeoutMs;
  let run = await page.evaluate((id) => window.omniEdu.getAiAgentRun(id), runId);
  while (run && (run.status === 'running' || run.status === 'waiting_input') && Date.now() < deadline) {
    await page.waitForTimeout(100);
    run = await page.evaluate((id) => window.omniEdu.getAiAgentRun(id), runId);
  }
  return run;
}

async function startTurn(page, turnId, maxEvents = 16) {
  const accepted = await page.evaluate(({ turnId, maxEvents }) => window.omniEdu.deepTutorStartTurn({
    turnId,
    capability: 'chat',
    prompt: '请用一句话说明当前教学任务。',
    context: { language: 'zh' },
    budgets: { maxEvents, maxWallMs: 120000 },
  }), { turnId, maxEvents });
  assert.equal(accepted.ok, true);
  const runId = accepted.result?.runId;
  assert.equal(typeof runId, 'string');
  return { runId, run: await waitForRun(page, runId) };
}

try {
  app = await electron.launch({
    args: [join(appRoot, 'out/main/index.js')],
    env: { ...process.env, OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: dirname(dirname(appRoot)) },
  });
  let page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => Boolean(window.omniEdu));

  const succeeded = await startTurn(page, 'r11-lineage-success', 16);
  assert.equal(succeeded.run?.status, 'succeeded');

  const branchAttempts = await page.evaluate((sourceRunId) => Promise.all([
    window.omniEdu.deepTutorMutateRun({ sourceRunId, action: 'branch', idempotencyKey: 'branch-same-key', prompt: '分支任务：只保留核心结论。', budgets: { maxEvents: 16, maxWallMs: 120000 } }),
    window.omniEdu.deepTutorMutateRun({ sourceRunId, action: 'branch', idempotencyKey: 'branch-same-key', prompt: '分支任务：只保留核心结论。', budgets: { maxEvents: 16, maxWallMs: 120000 } }),
  ]), succeeded.runId);
  assert.equal(branchAttempts.every((item) => item.ok), true, 'same idempotency key must return the existing branch');
  assert.equal(new Set(branchAttempts.map((item) => item.runId)).size, 1, 'same idempotency key must not create two children');
  const branch = branchAttempts[0];
  const branchRun = await waitForRun(page, branch.runId);
  assert.equal(branchRun?.status, 'succeeded');
  assert.equal(branchRun?.parentRunId, succeeded.runId);
  const retrySucceeded = await page.evaluate((sourceRunId) => window.omniEdu.deepTutorMutateRun({
    sourceRunId,
    action: 'retry',
    idempotencyKey: 'retry-on-success',
    budgets: { maxEvents: 16, maxWallMs: 120000 },
  }), succeeded.runId);
  assert.equal(retrySucceeded.ok, false, 'retrying a succeeded run must fail closed');

  const blocked = await startTurn(page, 'r11-lineage-blocked', 0);
  assert.equal(blocked.run?.status, 'blocked');
  const retry = await page.evaluate((sourceRunId) => window.omniEdu.deepTutorMutateRun({
    sourceRunId,
    action: 'retry',
    idempotencyKey: 'retry-blocked-once',
    budgets: { maxEvents: 16, maxWallMs: 120000 },
  }), blocked.runId);
  assert.equal(retry.ok, true);
  const retriedRun = await waitForRun(page, retry.runId);
  assert.equal(retriedRun?.status, 'succeeded');
  assert.equal(retriedRun?.parentRunId, blocked.runId);
  const duplicateRetry = await page.evaluate((sourceRunId) => window.omniEdu.deepTutorMutateRun({
    sourceRunId,
    action: 'retry',
    idempotencyKey: 'retry-blocked-once',
    budgets: { maxEvents: 16, maxWallMs: 120000 },
  }), blocked.runId);
  assert.equal(duplicateRetry.ok, true);
  assert.equal(duplicateRetry.runId, retry.runId);
  assert.equal(duplicateRetry.reused, true);

  const retryRunId = retriedRun.id;
  await app.close();
  app = await electron.launch({
    args: [join(appRoot, 'out/main/index.js')],
    env: { ...process.env, OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: dirname(dirname(appRoot)) },
  });
  page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => Boolean(window.omniEdu));
  const reopened = await page.evaluate((id) => window.omniEdu.getAiAgentRun(id), retryRunId);
  assert.equal(reopened?.parentRunId, blocked.runId, 'lineage must survive close/reopen');

  console.log(JSON.stringify({
    ok: true,
    cases: 12,
    branchIdempotency: true,
    branchLineage: branchRun.parentRunId === succeeded.runId,
    retrySuccessBlockedSource: retriedRun.status === 'succeeded',
    retrySucceededSourceRejected: retrySucceeded.ok === false,
    duplicateRetryReused: duplicateRetry.reused === true,
    restartLineage: reopened?.parentRunId === blocked.runId,
  }));
} finally {
  if (app) await app.close().catch(() => undefined);
  rmSync(dataRoot, { recursive: true, force: true });
}
