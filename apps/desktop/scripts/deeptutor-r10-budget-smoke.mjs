import { _electron as electron } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import sqlite3 from 'sqlite3';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-r10-budget-'));
let app;

async function waitForRun(page, runId, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  let run = await page.evaluate((id) => window.omniEdu.getAiAgentRun(id), runId);
  while (run && (run.status === 'running' || run.status === 'waiting_input') && Date.now() < deadline) {
    await page.waitForTimeout(100);
    run = await page.evaluate((id) => window.omniEdu.getAiAgentRun(id), runId);
  }
  return run;
}

function runSql(sql, params = []) {
  return new Promise((resolve, reject) => {
    const db = new sqlite3.Database(join(dataRoot, 'app.db'), (openError) => {
      if (openError) { reject(openError); return; }
      db.run(sql, params, (error) => {
        db.close(() => {
          if (error) reject(error);
          else resolve();
        });
      });
    });
  });
}

try {
  app = await electron.launch({
    args: [join(appRoot, 'out/main/index.js')],
    env: {
      ...process.env,
      OMNI_EDU_DATA_ROOT: dataRoot,
      OMNI_EDU_REPO_ROOT: dirname(dirname(appRoot)),
    },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => Boolean(window.omniEdu));

  const accepted = await page.evaluate(() => window.omniEdu.deepTutorStartTurn({
    turnId: 'r10-budget-hard-stop',
    capability: 'chat',
    prompt: '请用一句话说明预算硬终止。',
    context: { language: 'zh' },
    // 0 is intentionally adversarial: the host must normalize it to the
    // smallest valid budget instead of allowing an unbounded AgentLoop.
    budgets: { maxEvents: 0, maxWallMs: 120000 },
  }));
  assert.equal(accepted.ok, true);
  const runId = accepted.result?.runId;
  assert.equal(typeof runId, 'string');
  const run = await waitForRun(page, runId);
  assert.ok(run, 'budget run should be persisted');
  assert.equal(run.status, 'blocked', 'event budget must pause with a resumable blocked status');

  const events = await page.evaluate((id) => window.omniEdu.listAiAgentEvents(id), runId);
  const guardrail = events.find((event) => event.phase === 'guardrail' && event.outputSummary?.terminationReason === 'budget_exhausted');
  assert.ok(guardrail, 'budget exhaustion must be observable as a guardrail event');
  assert.equal(guardrail.outputSummary?.continuationAvailable, true);
  assert.equal(guardrail.outputSummary?.hardStop, true);
  assert.equal(typeof guardrail.outputSummary?.continuationToken, 'string');
  assert.ok(Number(guardrail.outputSummary?.maxEvents) >= 1 && Number(guardrail.outputSummary?.maxEvents) <= 256);
  assert.ok(events.every((event) => event.outputSummary?.rawFilesIncluded !== true), 'budget evidence must not leak raw files');
  const pendingCheckpoint = await page.evaluate((id) => window.omniEdu.getPendingAiCapabilityCheckpoint(id), runId);
  assert.equal(pendingCheckpoint?.checkpointType, 'continuation');
  assert.equal(pendingCheckpoint?.state?.continuationAvailable, true);
  assert.equal('request' in (pendingCheckpoint?.state ?? {}), false, 'renderer checkpoint state must not expose request snapshots');
  assert.equal('continuationToken' in (pendingCheckpoint?.state ?? {}), false, 'renderer checkpoint state must not expose bearer tokens');

  // Late sidecar events must be ignored after the host deletes the binding.
  await page.waitForTimeout(500);
  const afterLateEvents = await page.evaluate((id) => window.omniEdu.listAiAgentEvents(id), runId);
  assert.deepEqual(afterLateEvents, events, 'late events must not resurrect or mutate a hard-stopped run');

  const expiredAccepted = await page.evaluate(() => window.omniEdu.deepTutorStartTurn({
    turnId: 'r10-budget-expiry',
    capability: 'chat',
    prompt: '验证过期续写令牌。',
    context: { language: 'zh' },
    budgets: { maxEvents: 0, maxWallMs: 120000 },
  }));
  const expiredRunId = expiredAccepted.result?.runId;
  const expiredRun = await waitForRun(page, expiredRunId);
  assert.equal(expiredRun?.status, 'blocked');
  const expiredEvents = await page.evaluate((id) => window.omniEdu.listAiAgentEvents(id), expiredRunId);
  const expiredGuardrail = expiredEvents.find((event) => event.phase === 'guardrail' && event.outputSummary?.continuationToken);
  const expiredCheckpoint = await page.evaluate((id) => window.omniEdu.getPendingAiCapabilityCheckpoint(id), expiredRunId);
  assert.ok(expiredGuardrail && expiredCheckpoint, 'expiry case must create a continuation checkpoint');
  await runSql('UPDATE ai_capability_checkpoints SET expires_at = ? WHERE id = ?', [new Date(Date.now() - 1_000).toISOString(), expiredCheckpoint.id]);
  const expiredContinuation = await page.evaluate((continuationToken) => window.omniEdu.deepTutorContinueTurn({ continuationToken }), expiredGuardrail.outputSummary.continuationToken);
  assert.equal(expiredContinuation.ok, false, 'expired continuation token must fail closed');
  const expiredReadback = await page.evaluate((id) => window.omniEdu.getAiCapabilityCheckpoint(id), expiredCheckpoint.id);
  assert.equal(expiredReadback?.status, 'expired');

  const approvalRequest = await page.evaluate((continuationToken) => window.omniEdu.deepTutorContinueTurn({
    continuationToken,
    budgets: { maxEvents: 16, maxWallMs: 120000 },
  }), guardrail.outputSummary.continuationToken);
  assert.equal(approvalRequest.ok, false, 'budget increase must pause for explicit approval');
  assert.equal(approvalRequest.approvalRequired, true);
  assert.equal(typeof approvalRequest.approvalCheckpointId, 'string');
  const tokenStillPending = await page.evaluate((continuationToken) => window.omniEdu.deepTutorContinueTurn({ continuationToken, budgets: { maxEvents: 16, maxWallMs: 120000 } }), guardrail.outputSummary.continuationToken);
  assert.equal(tokenStillPending.approvalRequired, true, 'approval request must not consume the continuation token');
  assert.equal(tokenStillPending.approvalCheckpointId, approvalRequest.approvalCheckpointId, 'repeated budget request must reuse one approval checkpoint');
  const approvalAttempts = await page.evaluate((checkpointId) => Promise.all([
    window.omniEdu.deepTutorApproveBudget(checkpointId),
    window.omniEdu.deepTutorApproveBudget(checkpointId),
  ]), approvalRequest.approvalCheckpointId);
  assert.equal(approvalAttempts.filter((item) => item.ok).length, 1, 'concurrent budget approvals must have exactly one winner');
  assert.equal(approvalAttempts.filter((item) => !item.ok).length, 1, 'concurrent budget approvals must reject the loser');
  const continuation = approvalAttempts.find((item) => item.ok);
  assert.equal(continuation.ok, true, 'one-time continuation should start a child turn');
  assert.equal(continuation.parentRunId, runId);
  assert.equal(typeof continuation.runId, 'string');
  const continuedRun = await waitForRun(page, continuation.runId);
  assert.equal(continuedRun?.status, 'succeeded', 'continued dry-run should settle successfully');
  assert.equal(continuedRun?.parentRunId, runId, 'continuation lineage must be persisted');
  const duplicateContinuation = await page.evaluate((continuationToken) => window.omniEdu.deepTutorContinueTurn({ continuationToken }), guardrail.outputSummary.continuationToken);
  assert.equal(duplicateContinuation.ok, false, 'continuation token must be single-use');

  // Exercise the full bounded settlement chain: three child turns are
  // allowed, while the fourth generation must stop without issuing another
  // bearer token.
  const chainAccepted = await page.evaluate(() => window.omniEdu.deepTutorStartTurn({
    turnId: 'r10-budget-settlement-chain',
    capability: 'chat',
    prompt: '验证受限多轮 settlement。',
    context: { language: 'zh' },
    budgets: { maxEvents: 0, maxWallMs: 120000 },
  }));
  let chainRunId = chainAccepted.result?.runId;
  assert.equal(typeof chainRunId, 'string');
  const chainLineage = [];
  for (let generation = 0; generation < 4; generation += 1) {
    const chainRun = await waitForRun(page, chainRunId);
    assert.equal(chainRun?.status, generation === 3 ? 'failed' : 'blocked');
    const chainEvents = await page.evaluate((id) => window.omniEdu.listAiAgentEvents(id), chainRunId);
    const chainGuardrail = chainEvents.find((event) => event.phase === 'guardrail' && event.outputSummary?.terminationReason === 'budget_exhausted');
    assert.ok(chainGuardrail, `settlement generation ${generation} must have a guardrail`);
    if (generation < 3) {
      assert.equal(chainGuardrail.outputSummary?.continuationAvailable, true);
      const next = await page.evaluate((continuationToken) => window.omniEdu.deepTutorContinueTurn({
        continuationToken,
        budgets: { maxEvents: 0, maxWallMs: 120000 },
      }), chainGuardrail.outputSummary.continuationToken);
      assert.equal(next.ok, true);
      assert.equal(next.parentRunId, chainRunId);
      chainLineage.push({ parentRunId: chainRunId, childRunId: next.runId });
      chainRunId = next.runId;
    } else {
      assert.equal(chainGuardrail.outputSummary?.continuationAvailable, false, 'settlement limit must not issue a fourth token');
      assert.equal(typeof chainGuardrail.outputSummary?.continuationToken, 'undefined');
    }
  }
  assert.equal(chainLineage.length, 3);

  console.log(JSON.stringify({
    ok: true,
    cases: 31,
    status: run.status,
    terminationReason: guardrail.outputSummary.terminationReason,
    continuationAvailable: guardrail.outputSummary.continuationAvailable,
    lateEventsIgnored: true,
    continuationSettled: continuedRun.status,
    lineageBound: continuedRun.parentRunId === runId,
    duplicateContinuationBlocked: duplicateContinuation.ok === false,
    budgetIncreaseRequiresApproval: approvalRequest.approvalRequired === true,
    budgetApprovalSingleWinner: approvalAttempts.filter((item) => item.ok).length === 1,
    checkpointStateRedacted: pendingCheckpoint?.state?.continuationAvailable === true,
    expiredContinuationBlocked: expiredContinuation.ok === false,
    expiredCheckpointMarked: expiredReadback?.status === 'expired',
    multiRoundSettlementBounded: chainLineage.length === 3,
    settlementHardStopAtLimit: true,
  }));
} finally {
  if (app) await app.close().catch(() => undefined);
  rmSync(dataRoot, { recursive: true, force: true });
}
