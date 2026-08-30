import { _electron as electron } from 'playwright';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-review-reminder-electron-'));
let app;

async function launch() {
  app = await electron.launch({
    args: [join(appRoot, 'out/main/index.js')],
    env: { ...process.env, OMNI_EDU_DATA_ROOT: dataRoot, OMNI_EDU_REPO_ROOT: dirname(dirname(appRoot)) },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => Boolean(window.omniEdu));
  return page;
}

try {
  const page = await launch();
  const bootstrap = await page.evaluate(() => window.omniEdu.bootstrap());
  const student = bootstrap.students[0];
  const now = Date.now();
  await page.evaluate(({ studentId, occurredAt, title }) => window.omniEdu.createRecord({
    studentId,
    recordType: 'mastery_attempt',
    subject: '数学',
    title,
    content: JSON.stringify({ knowledgePoint: title, knowledgeType: 'procedure', isCorrect: true }),
    tags: ['mastery_attempt'],
    occurredAt,
  }), { studentId: student.id, occurredAt: new Date(now - 8 * 86_400_000).toISOString(), title: '到期复习点' });
  await page.evaluate(({ studentId, occurredAt, title }) => window.omniEdu.createRecord({
    studentId,
    recordType: 'mastery_attempt',
    subject: '数学',
    title,
    content: JSON.stringify({ knowledgePoint: title, knowledgeType: 'procedure', isCorrect: true }),
    tags: ['mastery_attempt'],
    occurredAt,
  }), { studentId: student.id, occurredAt: new Date(now - 1 * 86_400_000).toISOString(), title: '近期复习点' });
  const first = await page.evaluate((studentId) => window.omniEdu.getReviewReminder(studentId), student.id);
  assert.equal(first.schemaVersion, 'omni.review.reminder.v1');
  assert.equal(first.status, 'due');
  assert.ok(first.dueCount >= 1);
  assert.ok(first.items.every((item) => !('content' in item) && !('answer' in item) && !('filePath' in item)));
  assert.equal(first.rawRecordsIncluded, false);
  assert.equal(first.timezoneInvariant, true);
  await app.close();

  const pageAfterRestart = await launch();
  const second = await pageAfterRestart.evaluate((studentId) => window.omniEdu.getReviewReminder(studentId), student.id);
  assert.equal(second.schemaVersion, first.schemaVersion);
  assert.equal(second.status, first.status);
  assert.equal(second.dueCount, first.dueCount);
  assert.deepEqual(second.items.map((item) => item.knowledgePointId), first.items.map((item) => item.knowledgePointId));
  const missing = await pageAfterRestart.evaluate(async () => {
    try { await window.omniEdu.getReviewReminder('missing-student'); return 'unexpected_success'; }
    catch (error) { return String(error?.message || error); }
  });
  assert.match(missing, /学生不存在/);
  const emptyId = await pageAfterRestart.evaluate(async () => {
    try { await window.omniEdu.getReviewReminder(''); return 'unexpected_success'; }
    catch (error) { return String(error?.message || error); }
  });
  assert.match(emptyId, /缺少学生 ID/);
  await pageAfterRestart.getByTestId('nav-today').click();
  await pageAfterRestart.waitForSelector('[data-testid="review-reminder-card"]');
  const reminderCardText = await pageAfterRestart.locator('[data-testid="review-reminder-card"]').innerText();
  assert.match(reminderCardText, /复习提醒/);
  assert.match(reminderCardText, /到期|即将到期|没有到期/);
  await app.close();
  app = null;
  console.log(JSON.stringify({ ok: true, cases: 16, sqliteRestart: true, stable: true, failClosed: true, noRawRecords: true }));
} finally {
  if (app) await app.close().catch(() => undefined);
  try { rmSync(dataRoot, { recursive: true, force: true }); } catch { /* best effort */ }
}
