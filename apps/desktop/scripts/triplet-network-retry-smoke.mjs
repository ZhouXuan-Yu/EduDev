import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright';
import { mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const capCase = process.argv.includes('--cap');
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-triplet-network-'));
const prompt = '请分析当前学生的错题，并基于以下脱敏题目文本检索本地相似题，生成原题、相似题、变式题三元题组草稿。只使用可验证来源，保留 generated/source 标记，不要自动保存。\n\n脱敏题目：\n求 2 + 3。';
const reply = {
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
const env = {
  ...process.env, OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_E2E_DIALOG_MODE: '1',
  OMNI_EDU_E2E_TRIPLET_REPLY: JSON.stringify(reply), OMNI_EDU_E2E_TRIPLET_NETWORK_FAILURES: capCase ? '3' : '1',
  GLM_API_KEY: 'isolated-test-only', DEEPSEEK_API_KEY: '',
};
let app;
const launch = async () => {
  app = await electron.launch({ args: [join(process.cwd(), 'out/main/index.js')], cwd: process.cwd(), env });
  const page = await app.firstWindow();
  await page.waitForFunction(() => Boolean(window.omniEdu));
  return page;
};

try {
  let page = await launch();
  const setup = await page.evaluate(async () => {
    await window.omniEdu.saveDeepSeekSettings({ provider: 'glm', model: 'glm-4.5-air' });
    const students = await window.omniEdu.createStudent({ displayName: '隔离测试学生', grade: '初中', subjects: ['数学'] });
    const studentId = students.find((item) => item.displayName === '隔离测试学生')?.id;
    const session = await window.omniEdu.createAiConversationSession({ title: '网络重试验收', studentId });
    return { studentId, sessionId: session.session.id };
  });
  const failed = await page.evaluate(({ inputPrompt, sessionId, studentId }) => window.omniEdu.runDeepTutorConsole({
    prompt: inputPrompt, intent: 'mistake_triplet', sessionId, studentId,
  }), { inputPrompt: prompt, ...setup });
  assert.equal(failed.ok, false);
  assert.match(failed.errorMessage, /连接失败或超时/);
  const runId = failed.harness.agentRunId;
  assert.ok(runId);
  assert.deepEqual((await page.evaluate((sessionId) => window.omniEdu.listRecoverableTripletRuns(sessionId), setup.sessionId)).map((run) => run.id), [runId]);
  await page.getByTestId('ai-conversation-sidebar').waitFor({ state: 'visible' });
  await page.getByTestId(`ai-conversation-session-${setup.sessionId}`).click();
  const retryButton = page.getByTestId(`ai-triplet-resume-${runId}`);
  await retryButton.waitFor({ state: 'visible' });
  await retryButton.click();
  if (capCase) {
    await page.waitForFunction(async (id) => (await window.omniEdu.listAiAgentEvents(id)).filter((event) => event.label === '网络恢复重试').length === 1, runId);
    await retryButton.waitFor({ state: 'visible' });
    await retryButton.click();
    await page.waitForFunction(async (id) => (await window.omniEdu.listAiAgentEvents(id)).filter((event) => event.label === '网络恢复重试').length === 2, runId);
  }
  await page.getByTestId(`ai-triplet-recovery-${runId}`).waitFor({ state: 'detached' });
  const readback = await page.evaluate(async ({ id, sessionId }) => ({
    run: await window.omniEdu.getAiAgentRun(id),
    events: await window.omniEdu.listAiAgentEvents(id),
    confirmations: (await window.omniEdu.listAiConfirmations('all')).filter((item) => item.runId === id),
    recoverable: await window.omniEdu.listRecoverableTripletRuns(sessionId),
  }), { id: runId, sessionId: setup.sessionId });
  assert.equal(readback.run.status, capCase ? 'failed' : 'succeeded');
  assert.equal(readback.events.filter((event) => event.label === '网络恢复重试').length, capCase ? 2 : 1);
  assert.equal(readback.events.filter((event) => event.label === '检索本地相似题').length, 1);
  assert.equal(readback.confirmations.length, capCase ? 0 : 1);
  assert.equal(readback.recoverable.length, 0);
  await app.close();
  app = undefined;
  page = await launch();
  assert.equal((await page.evaluate((sessionId) => window.omniEdu.listRecoverableTripletRuns(sessionId), setup.sessionId)).length, 0);
  await app.close();
  app = undefined;
  console.log(JSON.stringify({ suite: 'triplet-network-checkpoint-retry', passed: true, capCase, sameRunId: runId, retryEvents: capCase ? 2 : 1, confirmations: capCase ? 0 : 1 }));
} finally {
  if (app) await app.close();
  if (realpathSync(dataRoot).startsWith(realpathSync(tmpdir()))) {
    let lastError;
    for (let attempt = 0; attempt < 20; attempt += 1) {
      try { rmSync(dataRoot, { recursive: true, force: true, maxRetries: 2, retryDelay: 200 }); lastError = undefined; break; }
      catch (error) { lastError = error; await new Promise((resolve) => setTimeout(resolve, 500)); }
    }
    if (lastError) throw lastError;
  }
}
