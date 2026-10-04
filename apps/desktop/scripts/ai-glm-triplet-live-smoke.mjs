import { _electron as electron } from 'playwright';
import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-glm-triplet-live-'));
let app;
try {
  app = await electron.launch({
    args: [join(appRoot, 'out/main/index.js')],
    cwd: appRoot,
    env: { ...process.env, OMNI_EDU_DATA_ROOT: dataRoot, DEEPSEEK_API_KEY: '' },
  });
  let page = await app.firstWindow();
  await page.waitForFunction(() => Boolean(window.omniEdu));
  const setup = await page.evaluate(async () => {
    const settings = await window.omniEdu.saveDeepSeekSettings({ provider: 'glm', model: 'glm-4.5-air' });
    const students = await window.omniEdu.createStudent({ displayName: '隔离测试学生', grade: '初中', subjects: ['数学'] });
    return { provider: settings.provider, configured: settings.configured, studentId: students.find((item) => item.displayName === '隔离测试学生')?.id };
  });
  assert.equal(setup.provider, 'glm');
  assert.equal(setup.configured, true, 'GLM key must be available from ignored local configuration');
  assert.ok(setup.studentId);
  const result = await page.evaluate((studentId) => window.omniEdu.runDeepTutorConsole({
    intent: 'mistake_triplet', studentId,
    prompt: '请根据脱敏题目：一次函数 y=2x+1 的斜率是多少？生成原题、相似题、变式题三元题组草稿，交给教师校正和确认。',
  }), setup.studentId);
  const readback = await page.evaluate(async (runId) => ({
    runs: (await window.omniEdu.listAiAgentRuns(10)).filter((item) => item.id === runId).map((item) => ({ id: item.id, status: item.status, model: item.model })),
    events: (await window.omniEdu.listAiAgentEvents(runId)).map((item) => ({ phase: item.phase, status: item.status, graphVersion: item.outputSummary?.graphVersion })),
    confirmations: (await window.omniEdu.listAiConfirmations('pending')).filter((item) => item.runId === runId).map((item) => ({ id: item.id, status: item.status, roles: item.payload.exerciseSet?.items?.map((entry) => entry.role) })),
  }), result.harness?.agentRunId);
  console.log(JSON.stringify({ suite: 'xiaozhi-glm-triplet-live', ok: result.ok, model: result.model, error: result.errorMessage?.slice(0, 300), replyLength: result.content.length, readback }));
  assert.equal(result.ok, true, 'real GLM triplet task must pass schema and grader');
  assert.equal(readback.runs[0]?.status, 'succeeded');
  assert.equal(readback.confirmations.length, 1);
  assert.deepEqual(readback.confirmations[0]?.roles, ['original', 'similar', 'variant']);
  const confirmed = await page.evaluate(async (id) => {
    const item = (await window.omniEdu.listAiConfirmations('pending')).find((entry) => entry.id === id);
    const edits = item.payload.exerciseSet.items.map((entry, index) => ({ stem: index === 0 ? '教师校正：求 y=2x+1 的斜率' : entry.stem, answer: entry.answer }));
    return window.omniEdu.confirmAiConfirmation(id, edits);
  }, readback.confirmations[0].id);
  assert.equal(confirmed.item.status, 'confirmed');
  assert.equal(confirmed.readback?.exerciseSet?.items?.[0]?.stem, '教师校正：求 y=2x+1 的斜率');
  const exerciseSetId = confirmed.readback.exerciseSet.id;
  await app.close();
  app = await electron.launch({ args: [join(appRoot, 'out/main/index.js')], cwd: appRoot, env: { ...process.env, OMNI_EDU_DATA_ROOT: dataRoot, DEEPSEEK_API_KEY: '' } });
  page = await app.firstWindow();
  await page.waitForFunction(() => Boolean(window.omniEdu));
  const persisted = await page.evaluate(async ({ studentId, exerciseSetId }) => (await window.omniEdu.listExerciseSets(studentId)).find((item) => item.id === exerciseSetId), { studentId: setup.studentId, exerciseSetId });
  assert.equal(persisted?.items?.[0]?.stem, '教师校正：求 y=2x+1 的斜率');
  console.log(JSON.stringify({ suite: 'xiaozhi-glm-triplet-live-readback', confirmed: true, exerciseSetId, restarted: true, teacherEditPersisted: true }));
} finally {
  await app?.close().catch(() => undefined);
  rmSync(dataRoot, { recursive: true, force: true, maxRetries: 5, retryDelay: 150 });
}
