import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-r09-restart-'));
let app;

async function launch() {
  const instance = await electron.launch({
    args: [join(appRoot, 'out/main/index.js')],
    env: { ...process.env, OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: dirname(dirname(appRoot)) },
  });
  const page = await instance.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => Boolean(window.omniEdu));
  return { instance, page };
}

async function waitForRun(page, runId, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  let run = await page.evaluate((id) => window.omniEdu.getAiAgentRun(id), runId);
  while (run && (run.status === 'running' || run.status === 'waiting_input') && Date.now() < deadline) {
    await page.waitForTimeout(100);
    run = await page.evaluate((id) => window.omniEdu.getAiAgentRun(id), runId);
  }
  return run;
}

try {
  const first = await launch();
  app = first.instance;
  const accepted = await first.page.evaluate(() => window.omniEdu.deepTutorStartTurn({
    turnId: 'r09-restart-source',
    capability: 'chat',
    prompt: '请先询问老师一个缺失信息，然后继续回答。',
    context: { language: 'zh', dryRun: true, hostToolAuto: { toolName: 'ask_user', arguments: { question: '重启后仍应保留的问题？' } } },
    budgets: { maxEvents: 32, maxWallMs: 120000 },
  }));
  assert.equal(accepted.ok, true);
  const sourceRunId = accepted.result?.runId;
  assert.equal(typeof sourceRunId, 'string');
  const pending = await first.page.evaluate(async (runId) => {
    const deadline = Date.now() + 8_000;
    let checkpoint = await window.omniEdu.getPendingAiCapabilityCheckpoint(runId);
    while (!checkpoint && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      checkpoint = await window.omniEdu.getPendingAiCapabilityCheckpoint(runId);
    }
    return checkpoint;
  }, sourceRunId);
  assert.equal(pending?.checkpointType, 'user_input');
  const waitingRun = await first.page.evaluate((runId) => window.omniEdu.getAiAgentRun(runId), sourceRunId);
  assert.equal(waitingRun?.status, 'waiting_input');
  const requestId = String(pending.state.requestId);
  await app.close();
  app = undefined;

  const second = await launch();
  app = second.instance;
  const recovered = await second.page.evaluate(() => window.omniEdu.listPendingDeepTutorInputs());
  assert.equal(recovered.length, 1, 'restart should rehydrate pending user input');
  assert.equal(recovered[0].requestId, requestId);
  assert.equal(recovered[0].turnId, 'r09-restart-source');
  const submitted = await second.page.evaluate(({ requestId: id, turnId }) => window.omniEdu.deepTutorSubmitUserInput({
    requestId: id,
    turnId,
    text: '老师已在重启后补充信息。',
  }), { requestId, turnId: recovered[0].turnId });
  assert.equal(submitted.ok, true, submitted.errorMessage);
  assert.equal(typeof submitted.runId, 'string');
  const child = await waitForRun(second.page, submitted.runId);
  assert.equal(child?.status, 'succeeded', child?.errorMessage || 'recovery child should settle');
  assert.equal(child?.parentRunId, sourceRunId);
  const resolved = await second.page.evaluate((id) => window.omniEdu.getAiCapabilityCheckpoint(id), pending.id);
  assert.equal(resolved?.status, 'resolved');
  const duplicate = await second.page.evaluate(({ requestId: id, turnId }) => window.omniEdu.deepTutorSubmitUserInput({ requestId: id, turnId, text: '重复提交' }), { requestId, turnId: recovered[0].turnId });
  assert.equal(duplicate.ok, false, 'recovered input must remain one-shot');
  console.log(JSON.stringify({ ok: true, cases: 12, restartRehydrated: true, parentLineage: child.parentRunId === sourceRunId, recoveredChildSucceeded: child.status === 'succeeded', duplicateBlocked: duplicate.ok === false }));
} finally {
  await app?.close().catch(() => undefined);
  rmSync(dataRoot, { recursive: true, force: true });
}
