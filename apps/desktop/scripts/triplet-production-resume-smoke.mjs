import assert from 'node:assert/strict';
import { build } from 'esbuild';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { _electron as electron } from 'playwright';

const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-triplet-resume-'));
const bundleDir = mkdtempSync(join(process.cwd(), '.triplet-resume-smoke-'));
let app;
const prompt = '请分析当前学生的错题，并基于以下脱敏题目文本检索本地相似题，生成原题、相似题、变式题三元题组草稿。只使用可验证来源，保留 generated/source 标记，不要自动保存。\n\n脱敏题目：\n求 2 + 3。';
const validReply = {
  schemaVersion: 'xiazhi.reply.v2', route: 'practice_design', subIntent: 'triplet_practice',
  answerMarkdown: '## 原题\n求 2 + 3。\n## 相似题\n求 3 + 4。\n## 变式题\n求 2 + 3 + 4。\n本地题库未命中，以上为 generated 草稿，答案与解析请教师校正。',
  facts: [], evidence: [], inferences: [], unknowns: ['本地题库未命中相似题。'],
  risks: [{ level: 'normal', category: 'evidence_gap', mitigation: '不将生成题标记为本地题库来源。' }],
  teacherConfirmations: ['保存题组前请教师确认。'], nextActions: ['请老师校正题干、答案与解析。'],
  artifacts: [], routeCheck: { kind: 'practice_design', passed: true, notes: ['题组草稿已通过路由检查。'] },
  processSummary: ['检索本地题库，没有命中。'],
  exerciseSetDraft: {
    title: '加法三元题组', subject: '数学', knowledgePoint: '整数加法', contentMd: '原题、相似题、变式题',
    items: ['original', 'similar', 'variant'].map((role, index) => ({
      role, sourceKind: 'generated', stem: `求 ${index + 2} + 3。`, answer: String(index + 5),
      analysis: '按整数加法计算。', knowledgePoint: '整数加法', difficulty: 'easy', teacherObservation: '请老师检查。',
    })),
  },
};

try {
  await build({ entryPoints: { db: 'src/main/db.ts', graph: 'src/main/ai-harness/triplet-graph.ts' }, outdir: bundleDir, bundle: true, platform: 'node', format: 'esm', packages: 'external' });
  const { OmniEduStore } = await import(`file:///${join(bundleDir, 'db.js').replaceAll('\\', '/')}`);
  const { runTripletGraph } = await import(`file:///${join(bundleDir, 'graph.js').replaceAll('\\', '/')}`);
  let store = new OmniEduStore(dataRoot);
  await store.init();
  const students = await store.createStudent({ displayName: '隔离测试学生', grade: '初中', subjects: ['数学'] });
  const studentId = students.find((item) => item.displayName === '隔离测试学生')?.id;
  assert.ok(studentId);
  const session = await store.createAiConversationSession({ title: '恢复验收会话', studentId });
  const input = { prompt, intent: 'mistake_triplet', sessionId: session.session.id, studentId };
  const failed = await runTripletGraph({ store, input, provider: 'glm', model: 'glm-test', apiKey: 'isolated-test-only', modelRequest: async () => { throw new Error('planned model interruption'); } });
  assert.equal(failed.ok, false);
  const runId = failed.harness.agentRunId;
  assert.ok(runId);
  assert.equal((await store.listAiAgentEvents(runId)).filter((event) => event.label === '检索本地相似题').length, 1);
  await store.close();

  // Simulate a process lost after the model node started. The app startup must expose the saved run.
  const db = new DatabaseSync(join(dataRoot, 'app.db'));
  db.prepare("UPDATE ai_agent_runs SET status = 'running', error_message = '', completed_at = NULL WHERE id = ?").run(runId);
  db.close();
  store = new OmniEduStore(dataRoot);
  await store.init();
  const recoverable = await store.listRecoverableTripletRuns(input.sessionId);
  assert.deepEqual(recoverable.map((run) => run.id), [runId]);
  assert.equal(await store.claimRecoverableTripletRun(runId, 'wrong-session'), false);
  assert.equal(await store.claimRecoverableTripletRun(runId, input.sessionId), true);
  assert.equal(await store.claimRecoverableTripletRun(runId, input.sessionId), false, 'concurrent caller must not own same run');
  const resumed = await runTripletGraph({
    store, input, resumeRunId: runId, provider: 'glm', model: 'glm-test', apiKey: 'isolated-test-only',
    modelRequest: async () => ({ choices: [{ message: { content: JSON.stringify(validReply) } }] }),
  });
  assert.equal(resumed.ok, true, resumed.errorMessage);
  assert.equal(resumed.harness.agentRunId, runId);
  assert.equal((await store.listAiAgentEvents(runId)).filter((event) => event.label === '检索本地相似题').length, 1, 'completed retrieval must not rerun');
  assert.equal((await store.getAiAgentRun(runId)).status, 'succeeded');
  assert.equal((await store.listRecoverableTripletRuns(input.sessionId)).length, 1, 'successful graph still needs confirmation repair after crash');
  await store.close();
  app = await electron.launch({
    args: [join(process.cwd(), 'out/main/index.js')], cwd: process.cwd(),
    env: { ...process.env, OMNI_EDU_DATA_ROOT: dataRoot, GLM_API_KEY: 'isolated-test-only', DEEPSEEK_API_KEY: '', OMNI_EDU_E2E_DIALOG_MODE: '1', OMNI_EDU_E2E_TRIPLET_REPLY: JSON.stringify(validReply) },
  });
  const page = await app.firstWindow();
  await page.waitForFunction(() => Boolean(window.omniEdu));
  await page.getByTestId('ai-conversation-sidebar').waitFor({ state: 'visible', timeout: 10000 }).catch(() => undefined);
  if (!await page.getByTestId('ai-conversation-sidebar').isVisible()) await page.getByTestId('nav-ai').click();
  await page.getByTestId(`ai-conversation-session-${input.sessionId}`).click();
  await page.getByTestId(`ai-triplet-recovery-${runId}`).waitFor({ state: 'visible' });
  await page.getByTestId(`ai-triplet-resume-${runId}`).click();
  await page.getByTestId(`ai-triplet-recovery-${runId}`).waitFor({ state: 'detached' });
  const observed = await page.evaluate(async (id) => ({
    run: await window.omniEdu.getAiAgentRun(id),
    confirmations: (await window.omniEdu.listAiConfirmations('all')).filter((item) => item.runId === id),
  }), runId);
  assert.equal(observed.run.status, 'succeeded');
  assert.equal(observed.confirmations.length, 1, 'UI resume must create one teacher confirmation');
  assert.equal(observed.confirmations[0].status, 'pending');
  assert.deepEqual(await page.evaluate((sessionId) => window.omniEdu.listRecoverableTripletRuns(sessionId), input.sessionId), []);
  const duplicate = await page.evaluate(async ({ id, sessionId }) => {
    try { await window.omniEdu.resumeTripletRun(id, sessionId); return 'accepted'; }
    catch { return 'rejected'; }
  }, { id: runId, sessionId: input.sessionId });
  assert.equal(duplicate, 'rejected', 'a completed run must not create a second confirmation');
  const concurrent = await page.evaluate(async (id) => {
    const decisions = await Promise.allSettled([
      window.omniEdu.confirmAiConfirmation(id), window.omniEdu.confirmAiConfirmation(id),
    ]);
    return decisions.map((decision) => decision.status);
  }, observed.confirmations[0].id);
  assert.deepEqual(concurrent.sort(), ['fulfilled', 'rejected'], 'concurrent confirmation calls must serialize');
  assert.equal((await page.evaluate((studentId) => window.omniEdu.listExerciseSets(studentId), studentId)).length, 1);
  await app.close();
  app = undefined;
  console.log(JSON.stringify({ suite: 'triplet-production-same-run-resume', passed: true, runId, retrievalExecutions: 1, atomicClaim: true }));
} finally {
  if (app) await app.close();
  if (realpathSync(dataRoot).startsWith(realpathSync(tmpdir()))) rmSync(dataRoot, { recursive: true, force: true });
  if (realpathSync(bundleDir).startsWith(realpathSync(process.cwd()))) rmSync(bundleDir, { recursive: true, force: true });
}
