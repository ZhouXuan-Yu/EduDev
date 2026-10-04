import assert from 'node:assert/strict';
import { _electron as electron } from 'playwright';
import { existsSync, mkdtempSync, realpathSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { spawnSync } from 'node:child_process';

const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-triplet-crash-'));
const crashPhase = process.argv.includes('--retrieve') ? 'retrieve' : 'model';
const teacherDecision = process.argv.includes('--confirm') ? 'confirm' : 'reject';
const confirmationTransactionCrash = process.argv.includes('--confirmation-transaction-crash');
const appEntry = join(process.cwd(), 'out/main/index.js');
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
  OMNI_EDU_E2E_TRIPLET_REPLY: JSON.stringify(reply), GLM_API_KEY: 'isolated-test-only', DEEPSEEK_API_KEY: '',
};
let app;
const launch = async (additionalEnv = {}) => {
  app = await electron.launch({ args: [appEntry], cwd: process.cwd(), env: { ...env, ...additionalEnv } });
  const page = await app.firstWindow();
  await page.waitForFunction(() => Boolean(window.omniEdu));
  return page;
};

try {
  let page = await launch(crashPhase === 'retrieve'
    ? { OMNI_EDU_E2E_TRIPLET_RETRIEVE_DELAY_MS: '30000' }
    : { OMNI_EDU_E2E_TRIPLET_MODEL_DELAY_MS: '30000' });
  const setup = await page.evaluate(async () => {
    await window.omniEdu.saveDeepSeekSettings({ provider: 'glm', model: 'glm-4.5-air' });
    const students = await window.omniEdu.createStudent({ displayName: '隔离测试学生', grade: '初中', subjects: ['数学'] });
    const studentId = students.find((item) => item.displayName === '隔离测试学生')?.id;
    const session = await window.omniEdu.createAiConversationSession({ title: '真实退出恢复验收', studentId });
    return { studentId, sessionId: session.session.id };
  });
  assert.ok(setup.studentId && setup.sessionId);
  await page.evaluate(({ inputPrompt, sessionId, studentId }) => {
    void window.omniEdu.runDeepTutorConsole({ prompt: inputPrompt, intent: 'mistake_triplet', sessionId, studentId });
  }, { inputPrompt: prompt, ...setup });

  let runId = '';
  const deadline = Date.now() + 30_000;
  while (Date.now() < deadline) {
    const db = new DatabaseSync(join(dataRoot, 'app.db'));
    const row = db.prepare(`SELECT r.id, r.status, COUNT(g.checkpoint_id) AS checkpoints
      FROM ai_agent_runs r LEFT JOIN ai_graph_checkpoints g ON g.thread_id = r.id
      WHERE r.session_id = ? GROUP BY r.id ORDER BY r.created_at DESC LIMIT 1`).get(setup.sessionId);
    const retrievals = row ? db.prepare("SELECT COUNT(*) AS n FROM ai_agent_events WHERE run_id = ? AND label = '检索本地相似题'").get(row.id).n : 0;
    db.close();
    const inFlight = crashPhase === 'retrieve' ? row?.checkpoints === 3 : row?.checkpoints >= 4;
    if (row?.status === 'running' && inFlight && retrievals === 1) { runId = row.id; break; }
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(runId, `${crashPhase} node must be in flight with the expected prior checkpoint`);
  const crashedProcess = app.process();
  if (process.platform === 'win32') {
    const killed = spawnSync('taskkill', ['/PID', String(crashedProcess.pid), '/T', '/F'], { encoding: 'utf8' });
    assert.equal(killed.status, 0, killed.stderr || killed.stdout);
  } else crashedProcess.kill('SIGKILL');
  app = undefined;
  await new Promise((resolve) => setTimeout(resolve, 500));

  page = await launch({
    OMNI_EDU_E2E_TRIPLET_MODEL_DELAY_MS: '', OMNI_EDU_E2E_TRIPLET_RETRIEVE_DELAY_MS: '',
    OMNI_EDU_E2E_CONFIRMATION_DELAY_MS: confirmationTransactionCrash ? '30000' : '',
  });
  await page.getByTestId('ai-conversation-sidebar').waitFor({ state: 'visible' });
  await page.getByTestId(`ai-conversation-session-${setup.sessionId}`).click();
  await page.getByTestId(`ai-triplet-recovery-${runId}`).waitFor({ state: 'visible' });
  await page.getByTestId(`ai-triplet-resume-${runId}`).click();
  await page.getByTestId(`ai-triplet-recovery-${runId}`).waitFor({ state: 'detached' });
  const readback = await page.evaluate(async ({ id, sessionId }) => ({
    run: await window.omniEdu.getAiAgentRun(id),
    confirmations: (await window.omniEdu.listAiConfirmations('all')).filter((item) => item.runId === id),
    recoverable: await window.omniEdu.listRecoverableTripletRuns(sessionId),
  }), { id: runId, sessionId: setup.sessionId });
  assert.equal(readback.run.status, 'succeeded');
  assert.equal(readback.confirmations.length, 1);
  assert.equal(readback.confirmations[0].status, 'pending');
  assert.equal(readback.recoverable.length, 0);
  if (confirmationTransactionCrash) {
    assert.equal(teacherDecision, 'confirm');
    await page.getByTestId(`ai-confirm-${readback.confirmations[0].id}`).click();
    const marker = join(dataRoot, '.e2e-confirmation-in-transaction');
    const markerDeadline = Date.now() + 30_000;
    while (!existsSync(marker) && Date.now() < markerDeadline) await new Promise((resolve) => setTimeout(resolve, 50));
    assert.ok(existsSync(marker), 'formal insert must be paused before confirmation status update');
    const inFlight = app.process();
    if (process.platform === 'win32') {
      const killed = spawnSync('taskkill', ['/PID', String(inFlight.pid), '/T', '/F'], { encoding: 'utf8' });
      assert.equal(killed.status, 0, killed.stderr || killed.stdout);
    } else inFlight.kill('SIGKILL');
    app = undefined;
    await new Promise((resolve) => setTimeout(resolve, 500));
    const rolledBack = new DatabaseSync(join(dataRoot, 'app.db'));
    assert.equal(rolledBack.prepare('SELECT COUNT(*) AS n FROM exercise_sets WHERE student_id = ?').get(setup.studentId).n, 0, 'uncommitted formal set must roll back on process death');
    assert.equal(rolledBack.prepare('SELECT status FROM ai_confirmation_items WHERE id = ?').get(readback.confirmations[0].id).status, 'pending');
    rolledBack.close();
    page = await launch({ OMNI_EDU_E2E_TRIPLET_MODEL_DELAY_MS: '', OMNI_EDU_E2E_TRIPLET_RETRIEVE_DELAY_MS: '', OMNI_EDU_E2E_CONFIRMATION_DELAY_MS: '' });
    await page.getByTestId('ai-conversation-sidebar').waitFor({ state: 'visible' });
    await page.getByTestId(`ai-conversation-session-${setup.sessionId}`).click();
  }
  await page.getByTestId(`ai-${teacherDecision}-${readback.confirmations[0].id}`).click();
  await page.waitForFunction(async ({ id, studentId, expectedCount, expectedStatus }) => {
    const confirmation = (await window.omniEdu.listAiConfirmations('all')).find((item) => item.id === id);
    return confirmation?.status === expectedStatus && (await window.omniEdu.listExerciseSets(studentId)).length === expectedCount;
  }, { id: readback.confirmations[0].id, studentId: setup.studentId, expectedCount: teacherDecision === 'confirm' ? 1 : 0, expectedStatus: teacherDecision === 'confirm' ? 'confirmed' : 'rejected' });
  const afterDecision = await page.evaluate(async ({ id, studentId }) => ({
    confirmation: (await window.omniEdu.listAiConfirmations('all')).find((item) => item.id === id),
    exerciseSets: await window.omniEdu.listExerciseSets(studentId),
  }), { id: readback.confirmations[0].id, studentId: setup.studentId });
  assert.equal(afterDecision.confirmation.status, teacherDecision === 'confirm' ? 'confirmed' : 'rejected');
  assert.equal(afterDecision.exerciseSets.length, teacherDecision === 'confirm' ? 1 : 0);
  const db = new DatabaseSync(join(dataRoot, 'app.db'));
  const expectedRetrievalExecutions = crashPhase === 'retrieve' ? 2 : 1;
  assert.equal(db.prepare("SELECT COUNT(*) AS n FROM ai_agent_events WHERE run_id = ? AND label = '检索本地相似题'").get(runId).n, expectedRetrievalExecutions);
  db.close();
  await app.close();
  app = undefined;
  page = await launch({ OMNI_EDU_E2E_TRIPLET_MODEL_DELAY_MS: '', OMNI_EDU_E2E_TRIPLET_RETRIEVE_DELAY_MS: '' });
  const restarted = await page.evaluate(async ({ id, studentId }) => ({
    confirmation: (await window.omniEdu.listAiConfirmations('all')).find((item) => item.id === id),
    exerciseSets: await window.omniEdu.listExerciseSets(studentId),
  }), { id: readback.confirmations[0].id, studentId: setup.studentId });
  assert.equal(restarted.confirmation.status, teacherDecision === 'confirm' ? 'confirmed' : 'rejected');
  assert.equal(restarted.exerciseSets.length, teacherDecision === 'confirm' ? 1 : 0);
  if (teacherDecision === 'confirm') {
    const duplicateDecision = await page.evaluate(async (id) => {
      try { await window.omniEdu.confirmAiConfirmation(id); return 'accepted'; }
      catch { return 'rejected'; }
    }, readback.confirmations[0].id);
    assert.equal(duplicateDecision, 'rejected', 'confirmed action cannot write a second formal set');
    assert.equal((await page.evaluate((studentId) => window.omniEdu.listExerciseSets(studentId), setup.studentId)).length, 1);
  }
  await app.close();
  app = undefined;
  console.log(JSON.stringify({ suite: 'triplet-real-process-crash-resume', crashPhase, teacherDecision, confirmationTransactionCrash, passed: true, sameRunId: runId, retrievalExecutions: crashPhase === 'retrieve' ? 2 : 1, confirmations: 1, formalSetsAfterRestart: teacherDecision === 'confirm' ? 1 : 0 }));
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
