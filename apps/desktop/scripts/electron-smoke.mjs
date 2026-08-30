import { _electron as electron } from 'playwright';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync } from 'node:child_process';
import assert from 'node:assert/strict';

const appRoot = dirname(dirname(fileURLToPath(import.meta.url)));
const dataRoot = mkdtempSync(join(tmpdir(), 'omni-edu-smoke-'));
const attachmentSourceRoot = mkdtempSync(join(tmpdir(), 'omni-edu-attachment-source-'));
const studentExportRoot = mkdtempSync(join(tmpdir(), 'omni-edu-student-export-'));
const dataBackupDestinationRoot = mkdtempSync(join(tmpdir(), 'omni-edu-data-backup-'));
const controlledAttachmentPath = join(attachmentSourceRoot, 'teacher-selected-mistake.png');
const controlledAttachmentBytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
writeFileSync(controlledAttachmentPath, controlledAttachmentBytes);
const artifactRoot = join(appRoot, 'test-results', 'electron-e2e');
mkdirSync(artifactRoot, { recursive: true });
const activeApps = new Set();

async function launchApp(options = {}) {
  const app = await electron.launch({
    args: [join(appRoot, 'out/main/index.js')],
    env: {
      ...process.env,
      OMNI_EDU_DATA_ROOT: dataRoot,
      OMNI_EDU_REPO_ROOT: dirname(dirname(appRoot)),
      OMNI_EDU_E2E_DIALOG_MODE: '1',
      OMNI_EDU_E2E_ATTACHMENT_DIALOG_QUEUE: JSON.stringify([[controlledAttachmentPath], []]),
      OMNI_EDU_E2E_STUDENT_EXPORT_DIALOG_QUEUE: JSON.stringify([[studentExportRoot], []]),
      OMNI_EDU_E2E_DATA_BACKUP_EXPORT_DIALOG_QUEUE: JSON.stringify(options.backupExportDialogQueue ?? [dataBackupDestinationRoot, '']),
      OMNI_EDU_E2E_DATA_BACKUP_VERIFY_DIALOG_QUEUE: JSON.stringify(options.backupVerifyDialogQueue ?? ['$last', '$last', '']),
      OMNI_EDU_E2E_OPEN_PATH_MODE: '1',
    },
  });
  const page = await app.firstWindow();
  await page.waitForLoadState('domcontentloaded');
  await page.waitForFunction(() => Boolean(window.omniEdu));
  const handle = { app, page };
  activeApps.add(app);
  return handle;
}

async function closeApp(app) {
  let child = null;
  try {
    child = typeof app.process === 'function' ? app.process() : null;
  } catch {
    child = null;
  }
  await Promise.race([
    app.close().catch(() => undefined),
    new Promise((resolve) => setTimeout(resolve, 2500)),
  ]);
  if (child && !child.killed) {
    child.kill();
    // On Windows, Electron may leave renderer/utility descendants alive after
    // the parent receives SIGTERM. The PID comes directly from this smoke
    // app, so taskkill is intentionally scoped to its process tree.
    if (process.platform === 'win32' && child.pid) {
      try {
        execFileSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
      } catch {
        // The process may have exited between kill() and taskkill().
      }
    }
  }
  activeApps.delete(app);
}

function removeSmokeDataRoot() {
  let lastError;
  for (let attempt = 0; attempt < 12; attempt += 1) {
    try {
      rmSync(dataRoot, { recursive: true, force: true, maxRetries: 2, retryDelay: 250 });
      return;
    } catch (error) {
      lastError = error;
      Atomics.wait(new Int32Array(new SharedArrayBuffer(4)), 0, 0, 250);
    }
  }
  throw lastError;
}

function removeAttachmentSourceRoot() {
  const expectedPrefix = join(tmpdir(), 'omni-edu-attachment-source-');
  if (!attachmentSourceRoot.startsWith(expectedPrefix)) throw new Error('refusing to remove unexpected attachment source root');
  rmSync(attachmentSourceRoot, { recursive: true, force: true, maxRetries: 2, retryDelay: 250 });
}

function removeStudentExportRoot() {
  const expectedPrefix = join(tmpdir(), 'omni-edu-student-export-');
  if (!studentExportRoot.startsWith(expectedPrefix)) throw new Error('refusing to remove unexpected student export root');
  rmSync(studentExportRoot, { recursive: true, force: true, maxRetries: 2, retryDelay: 250 });
}

function removeDataBackupDestinationRoot() {
  const expectedPrefix = join(tmpdir(), 'omni-edu-data-backup-');
  if (!dataBackupDestinationRoot.startsWith(expectedPrefix)) throw new Error('refusing to remove unexpected data backup destination root');
  rmSync(dataBackupDestinationRoot, { recursive: true, force: true, maxRetries: 2, retryDelay: 250 });
}

async function waitForRun(page, runId, timeoutMs = 8_000) {
  const deadline = Date.now() + timeoutMs;
  let run = await page.evaluate((id) => window.omniEdu.getAiAgentRun(id), runId);
  while (run && (run.status === 'running' || run.status === 'waiting_input') && Date.now() < deadline) {
    await page.waitForTimeout(100);
    run = await page.evaluate((id) => window.omniEdu.getAiAgentRun(id), runId);
  }
  return run;
}

async function waitForCheckpoint(page, runId, timeoutMs = 4_000) {
  const deadline = Date.now() + timeoutMs;
  let checkpoint = await page.evaluate((id) => window.omniEdu.getPendingAiCapabilityCheckpoint(id), runId);
  while (!checkpoint && Date.now() < deadline) {
    await page.waitForTimeout(100);
    checkpoint = await page.evaluate((id) => window.omniEdu.getPendingAiCapabilityCheckpoint(id), runId);
  }
  return checkpoint;
}

async function waitForCheckpointStatus(page, checkpointId, expectedStatus, timeoutMs = 4_000) {
  const deadline = Date.now() + timeoutMs;
  let checkpoint = await page.evaluate((id) => window.omniEdu.getAiCapabilityCheckpoint(id), checkpointId);
  while (checkpoint?.status !== expectedStatus && Date.now() < deadline) {
    await page.waitForTimeout(100);
    checkpoint = await page.evaluate((id) => window.omniEdu.getAiCapabilityCheckpoint(id), checkpointId);
  }
  return checkpoint;
}

async function run() {
  const first = await launchApp();
  await first.page.setViewportSize({ width: 1366, height: 768 });
  const bootstrap = await first.page.evaluate(() => window.omniEdu.bootstrap());
  assert.equal(typeof bootstrap.dataRoot, 'string');
  assert.ok(bootstrap.students.length >= 1, 'seed student should exist');

  const deepTutorManifest = await first.page.evaluate(() => window.omniEdu.deepTutorHandshake());
  assert.equal(deepTutorManifest.runtime, 'DeepTutor.AgentLoop');
  assert.equal(deepTutorManifest.upstreamCommit, '456f9c24226e008f1ff07a7e3455d7b4d39f6221');
  const deepTutorTurn = await first.page.evaluate(() => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-smoke-turn',
    capability: 'chat',
    prompt: '请用一句话确认 DeepTutor AgentLoop 已接入。',
    context: { language: 'zh' },
    budgets: { maxEvents: 16, maxWallMs: 120000 },
  }));
  assert.equal(deepTutorTurn.ok, true, 'DeepTutor turn should be accepted');
  const hostProxyTurn = await first.page.evaluate(() => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-host-proxy-turn',
    capability: 'deep_solve',
    prompt: '查询不存在学生的错题概况',
    context: {
      language: 'zh',
      hostToolRequest: {
        toolName: 'resolve_student_reference',
        arguments: { studentName: '不存在的学生' },
      },
    },
    budgets: { maxEvents: 32, maxWallMs: 120000 },
  }));
  assert.equal(hostProxyTurn.ok, true, 'DeepTutor HostToolProxy turn should be accepted');
  const nativeToolTurn = await first.page.evaluate(() => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-native-tool-call-turn',
    capability: 'chat',
    prompt: '请查询不存在学生的错题概况，并说明工具结果。',
    context: {
      language: 'zh',
      dryRun: true,
      hostToolAuto: {
        toolName: 'resolve_student_reference',
        arguments: { studentName: '不存在的学生' },
      },
    },
    budgets: { maxEvents: 32, maxWallMs: 120000 },
  }));
  assert.equal(nativeToolTurn.ok, true, 'DeepTutor native AgentLoop tool-call turn should be accepted');
  const knownStudent = bootstrap.students[0];

  // AI conversation library: exercise the existing renderer -> typed preload
  // -> main -> SQLite lifecycle from teacher-visible controls. Archive remains
  // a reversible-in-data visibility state, but no restore UI/IPC is invented.
  await first.page.getByTestId('nav-ai').click();
  await first.page.getByTestId('ai-conversation-sidebar').waitFor({ state: 'visible' });
  const conversationWorkspaceBefore = await first.page.evaluate(() => window.omniEdu.listAiConversations());
  await first.page.getByTestId('ai-conversation-folder-new').click();
  await first.page.getByTestId('ai-conversation-folder-save').click();
  await first.page.getByTestId('ai-conversation-error').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('ai-conversation-error').textContent(), /名称不能为空/, 'blank folder name must show a local validation error');
  assert.equal((await first.page.evaluate(() => window.omniEdu.listAiConversations())).folders.length, conversationWorkspaceBefore.folders.length, 'blank folder validation must perform zero SQLite writes');
  await first.page.getByTestId('ai-conversation-folder-name').fill('AI 对话前端验收');
  await first.page.getByTestId('ai-conversation-folder-save').click();
  await first.page.getByTestId('ai-conversation-success').waitFor({ state: 'visible' });
  let conversationWorkspace = await first.page.evaluate(() => window.omniEdu.listAiConversations());
  const conversationFolder = conversationWorkspace.folders.find((folder) => folder.name === 'AI 对话前端验收');
  assert.ok(conversationFolder, 'folder create click must persist through aiConversations:createFolder');

  const sessionIdsBeforeCreate = new Set(conversationWorkspace.sessions.map((session) => session.id));
  await first.page.getByTestId('ai-conversation-new').click();
  await first.page.waitForFunction((beforeIds) => window.omniEdu.listAiConversations().then((workspace) => workspace.sessions.some((session) => !beforeIds.includes(session.id))), [...sessionIdsBeforeCreate]);
  conversationWorkspace = await first.page.evaluate(() => window.omniEdu.listAiConversations());
  const conversationSession = conversationWorkspace.sessions.find((session) => !sessionIdsBeforeCreate.has(session.id));
  assert.ok(conversationSession, 'new conversation click must create a SQLite session');
  await first.page.getByTestId(`ai-conversation-session-${conversationSession.id}`).click({ button: 'right' });
  await first.page.getByTestId('ai-conversation-context-rename').click();
  await first.page.getByTestId(`ai-conversation-rename-session-${conversationSession.id}`).fill('一次函数对话-已重命名');
  await first.page.getByTestId(`ai-conversation-rename-session-${conversationSession.id}`).press('Enter');
  await first.page.waitForFunction((sessionId) => window.omniEdu.listAiConversations().then((workspace) => workspace.sessions.find((session) => session.id === sessionId)?.title === '一次函数对话-已重命名'), conversationSession.id);

  await first.page.getByTestId(`ai-conversation-session-${conversationSession.id}`).dragTo(first.page.getByTestId(`ai-conversation-drop-${conversationFolder.id}`));
  await first.page.waitForFunction(({ sessionId, folderId }) => window.omniEdu.listAiConversations().then((workspace) => workspace.sessions.find((session) => session.id === sessionId)?.folderId === folderId), { sessionId: conversationSession.id, folderId: conversationFolder.id });
  await first.page.setViewportSize({ width: 1366, height: 768 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-ai-conversation-library-1366x768.png'), fullPage: true });

  await first.page.getByTestId(`ai-conversation-session-${conversationSession.id}`).click({ button: 'right' });
  await first.page.getByTestId('ai-conversation-context-archive').click();
  await first.page.getByTestId('ai-conversation-archive-confirmation').waitFor({ state: 'visible' });
  await first.page.getByTestId('ai-conversation-archive-cancel').click();
  assert.ok((await first.page.evaluate(() => window.omniEdu.listAiConversations())).sessions.some((session) => session.id === conversationSession.id), 'archive cancellation must preserve the active session');
  await first.page.getByTestId(`ai-conversation-session-${conversationSession.id}`).click({ button: 'right' });
  await first.page.getByTestId('ai-conversation-context-archive').click();
  await first.page.getByTestId('ai-conversation-archive-confirm').click();
  await first.page.waitForFunction((sessionId) => window.omniEdu.listAiConversations().then((workspace) => workspace.archivedSessions.some((session) => session.id === sessionId)), conversationSession.id);

  const sessionIdsBeforeFolderArchive = new Set((await first.page.evaluate(() => window.omniEdu.listAiConversations())).sessions.map((session) => session.id));
  await first.page.getByTestId('ai-conversation-new').click();
  await first.page.waitForFunction((beforeIds) => window.omniEdu.listAiConversations().then((workspace) => workspace.sessions.some((session) => !beforeIds.includes(session.id))), [...sessionIdsBeforeFolderArchive]);
  conversationWorkspace = await first.page.evaluate(() => window.omniEdu.listAiConversations());
  const folderArchiveSession = conversationWorkspace.sessions.find((session) => !sessionIdsBeforeFolderArchive.has(session.id));
  assert.ok(folderArchiveSession, 'second user-created session must exist before folder cascade archive');
  await first.page.getByTestId(`ai-conversation-session-${folderArchiveSession.id}`).dragTo(first.page.getByTestId(`ai-conversation-drop-${conversationFolder.id}`));
  await first.page.waitForFunction(({ sessionId, folderId }) => window.omniEdu.listAiConversations().then((workspace) => workspace.sessions.find((session) => session.id === sessionId)?.folderId === folderId), { sessionId: folderArchiveSession.id, folderId: conversationFolder.id });

  const conversationFolderLocator = first.page.getByTestId(`ai-conversation-folder-${conversationFolder.id}`).locator('.ai-folder-title');
  await conversationFolderLocator.click({ button: 'right' });
  await first.page.getByTestId('ai-conversation-context-rename').click();
  await first.page.getByTestId(`ai-conversation-rename-folder-${conversationFolder.id}`).fill('AI 对话前端验收-已重命名');
  await first.page.getByTestId(`ai-conversation-rename-folder-${conversationFolder.id}`).press('Enter');
  await first.page.waitForFunction((folderId) => window.omniEdu.listAiConversations().then((workspace) => workspace.folders.find((folder) => folder.id === folderId)?.name === 'AI 对话前端验收-已重命名'), conversationFolder.id);
  await conversationFolderLocator.click({ button: 'right' });
  await first.page.getByTestId('ai-conversation-context-archive').click();
  await first.page.getByTestId('ai-conversation-archive-cancel').click();
  assert.ok((await first.page.evaluate(() => window.omniEdu.listAiConversations())).folders.some((folder) => folder.id === conversationFolder.id), 'folder archive cancellation must perform zero writes');
  await conversationFolderLocator.click({ button: 'right' });
  await first.page.getByTestId('ai-conversation-context-archive').click();
  await first.page.setViewportSize({ width: 1920, height: 1080 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-ai-conversation-archive-1920x1080.png'), fullPage: true });
  await first.page.getByTestId('ai-conversation-archive-confirm').click();
  await first.page.waitForFunction(({ folderId, sessionId }) => window.omniEdu.listAiConversations().then((workspace) => workspace.archivedFolders.some((folder) => folder.id === folderId) && workspace.archivedSessions.some((session) => session.id === sessionId)), { folderId: conversationFolder.id, sessionId: folderArchiveSession.id });
  await first.page.setViewportSize({ width: 1366, height: 768 });

  await first.page.evaluate((student) => window.omniEdu.createRecord({
    studentId: student.id,
    recordType: 'mastery_attempt',
    subject: '数学',
    title: 'Mastery smoke attempt 1',
    content: JSON.stringify({ knowledgePoint: '一次函数', knowledgeType: 'procedure', isCorrect: false }),
    tags: ['一次函数'],
  }), knownStudent);
  await first.page.evaluate((student) => window.omniEdu.createRecord({
    studentId: student.id,
    recordType: 'mastery_attempt',
    subject: '数学',
    title: 'Mastery smoke attempt 2',
    content: JSON.stringify({ knowledgePoint: '一次函数', knowledgeType: 'procedure', isCorrect: true }),
    tags: ['一次函数'],
  }), knownStudent);
  const usedHostToolTurn = await first.page.evaluate((student) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-used-host-tool-turn',
    capability: 'deep_solve',
    prompt: `请查询学生 ${student.displayName} 的学习概况，并说明工具结果。`,
    context: {
      language: 'zh',
      hostToolRequest: {
        toolName: 'get_student_profile',
        arguments: { studentId: student.id },
      },
    },
    budgets: { maxEvents: 32, maxWallMs: 120000 },
  }), knownStudent);
  assert.equal(usedHostToolTurn.ok, true, 'DeepTutor used HostToolProxy turn should be accepted');
  await first.page.waitForTimeout(800);
  const deepTutorRunId = deepTutorTurn.result?.runId;
  assert.equal(typeof deepTutorRunId, 'string', 'DeepTutor run id should be returned to host');
  const deepTutorRun = await waitForRun(first.page, deepTutorRunId);
  assert.ok(deepTutorRun, 'DeepTutor run should be persisted in SQLite');
  assert.equal(deepTutorRun.status, 'succeeded', 'DeepTutor run should reach succeeded status');
  const deepTutorEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), deepTutorRunId);
  assert.ok(deepTutorEvents.length >= 3, 'DeepTutor events should be persisted in SQLite');
  assert.deepEqual(deepTutorEvents.map((event) => event.sequence), deepTutorEvents.map((_, index) => index + 1));
  assert.ok(deepTutorEvents.some((event) => event.phase === 'finalize'), 'DeepTutor finalize event should be persisted');
  assert.ok(deepTutorEvents.every((event) => !/<\/?think(?:ing)?\b/i.test(String(event.detail ?? ''))), 'hidden reasoning markup must not reach SQLite');
  assert.ok(deepTutorEvents.every((event) => !String(event.detail ?? '').includes('sk-')), 'secret-like values must not reach SQLite event detail');
  const hostProxyRunId = hostProxyTurn.result?.runId;
  assert.equal(typeof hostProxyRunId, 'string', 'HostToolProxy run id should be returned to host');
  const hostProxyRun = await waitForRun(first.page, hostProxyRunId);
  assert.ok(hostProxyRun, 'HostToolProxy run should be persisted in SQLite');
  assert.equal(hostProxyRun.status, 'succeeded', 'HostToolProxy run should reach succeeded status after blocked tool result');
  const hostProxyEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), hostProxyRunId);
  assert.ok(hostProxyEvents.some((event) => event.phase === 'observe' && event.outputSummary?.status === 'blocked'), 'blocked HostToolProxy result should be persisted as an observation');
  assert.deepEqual(hostProxyEvents.map((event) => event.sequence), hostProxyEvents.map((_, index) => index + 1));
  const nativeToolRunId = nativeToolTurn.result?.runId;
  assert.equal(typeof nativeToolRunId, 'string', 'Native tool-call run id should be returned to host');
  const nativeToolRun = await first.page.evaluate((runId) => window.omniEdu.getAiAgentRun(runId), nativeToolRunId);
  assert.ok(nativeToolRun, 'Native tool-call run should be persisted in SQLite');
  assert.equal(nativeToolRun.status, 'succeeded', 'Native tool-call run should reach succeeded status');
  const nativeToolEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), nativeToolRunId);
  assert.ok(nativeToolEvents.some((event) => event.phase === 'tool_call'), 'native AgentLoop tool call should be persisted');
  assert.ok(nativeToolEvents.some((event) => event.phase === 'observe' && event.outputSummary?.status === 'blocked'), 'native AgentLoop blocked observation should be persisted');
  assert.deepEqual(nativeToolEvents.map((event) => event.sequence), nativeToolEvents.map((_, index) => index + 1));
  const usedHostToolRunId = usedHostToolTurn.result?.runId;
  assert.equal(typeof usedHostToolRunId, 'string', 'Used HostToolProxy run id should be returned to host');
  const usedHostToolRun = await waitForRun(first.page, usedHostToolRunId);
  assert.ok(usedHostToolRun, 'Used HostToolProxy run should be persisted in SQLite');
  assert.equal(usedHostToolRun.status, 'succeeded', 'allowed host tool should not be treated as a failed AgentLoop tool result');
  const usedHostToolEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), usedHostToolRunId);
  assert.ok(usedHostToolEvents.some((event) => event.phase === 'observe' && event.outputSummary?.status === 'used'), 'allowed host tool result should be persisted as used observation');
  assert.deepEqual(usedHostToolEvents.map((event) => event.sequence), usedHostToolEvents.map((_, index) => index + 1));
  const masteryStatusTurn = await first.page.evaluate((student) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-mastery-status-tool-turn',
    capability: 'mastery_path',
    prompt: `分析${student.displayName}的学习进度并指出掌握度状态`,
    context: {
      language: 'zh',
      studentId: student.id,
      hostToolRequest: {
        toolName: 'mastery_status',
        arguments: { studentId: student.id },
      },
    },
    budgets: { maxEvents: 32, maxWallMs: 120000 },
  }), knownStudent);
  assert.equal(masteryStatusTurn.ok, true, 'mastery_status host tool turn should be accepted');
  const masteryStatusRunId = masteryStatusTurn.result?.runId;
  const masteryStatusRun = await waitForRun(first.page, masteryStatusRunId);
  assert.equal(masteryStatusRun?.status, 'succeeded', 'mastery_status host tool should complete');
  const masteryStatusEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), masteryStatusRunId);
  const masteryStatusObserve = masteryStatusEvents.find((event) => event.phase === 'observe' && event.outputSummary?.status === 'used');
  assert.ok(masteryStatusObserve, 'mastery_status should produce a used observation');
  assert.equal(masteryStatusObserve.outputSummary?.toolName, 'mastery_status', 'observation should identify mastery_status');
  assert.equal(masteryStatusObserve.outputSummary?.rawRecordsIncluded, false, 'mastery_status must not expose raw records');
  assert.equal(masteryStatusObserve.outputSummary?.policyVersion, 'omni.mastery.policy.v1', 'mastery_status must expose the bounded policy version');
  assert.ok(['review', 'probe', 'practice', 'assess', 'complete'].includes(masteryStatusObserve.outputSummary?.nextAction), 'mastery_status must expose a valid next action');
  assert.equal(typeof masteryStatusObserve.outputSummary?.dueReviewCount, 'number', 'mastery_status must expose only a bounded due-review count');
  const learningAnalyticsTurn = await first.page.evaluate((student) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-learning-analytics-tool-turn',
    capability: 'deep_research',
    prompt: `为${student.displayName}生成阶段学情报告`,
    context: {
      language: 'zh',
      studentId: student.id,
      dryRun: true,
      configOverrides: { mode: 'notes', depth: 'quick' },
      hostToolRequest: {
        toolName: 'analyze_learning_progress',
        arguments: { studentId: student.id, startDate: '2026-01-01', endDate: '2026-12-31', subject: '数学' },
      },
    },
    budgets: { maxEvents: 96, maxWallMs: 120000 },
  }), knownStudent);
  assert.equal(learningAnalyticsTurn.ok, true, 'learning analytics HostTool turn should be accepted');
  const learningAnalyticsRun = await waitForRun(first.page, learningAnalyticsTurn.result?.runId, 12000);
  assert.equal(learningAnalyticsRun?.status, 'succeeded', 'learning analytics HostTool turn should complete');
  const learningAnalyticsEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), learningAnalyticsTurn.result?.runId);
  const learningAnalyticsObservation = learningAnalyticsEvents.find((event) => event.outputSummary?.learningAnalytics);
  assert.ok(learningAnalyticsObservation, 'learning analytics should persist a bounded analytics binding');
  assert.equal(learningAnalyticsObservation.outputSummary.learningAnalytics.schemaVersion, 'omni.learning.analytics.v1');
  assert.equal(learningAnalyticsObservation.outputSummary.learningAnalytics.startDate, '2026-01-01');
  assert.equal(learningAnalyticsObservation.outputSummary.learningAnalytics.endDate, '2026-12-31');
  assert.ok(Array.isArray(learningAnalyticsObservation.outputSummary.learningAnalytics.sourceRecordIds));
  assert.ok(learningAnalyticsEvents.every((event) => !String(event.detail ?? '').includes('PRIVATE_RAW_SHOULD_NOT_LEAK')), 'learning analytics events must not contain raw record content');
  const masteryTurn = await first.page.evaluate((student) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-mastery-path-dry-run',
    capability: 'mastery_path',
    prompt: `为${student.displayName}生成下一步精通学习计划`,
    context: { language: 'zh', studentId: student.id, sessionId: 'electron-mastery-session', dryRun: true },
    budgets: { maxEvents: 64, maxWallMs: 120000 },
  }), knownStudent);
  assert.equal(masteryTurn.ok, true, 'mastery_path dry-run should be accepted');
  const masteryRun = await waitForRun(first.page, masteryTurn.result?.runId, 12000);
  assert.equal(masteryRun?.status, 'succeeded', 'mastery_path should complete from Omni learning records');
  const masteryEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), masteryTurn.result?.runId);
  const masteryResult = masteryEvents.find((event) => event.phase === 'finalize' && event.outputSummary?.capability === 'mastery_path');
  assert.ok(masteryResult, 'mastery_path result evidence should identify capability');
  assert.equal(masteryResult.outputSummary?.mastery?.source, 'omni_edu_learning_records', 'mastery must read Omni learning records, not a second student store');
  assert.equal(masteryResult.outputSummary?.mastery?.next?.action, 'practice', 'two mixed attempts should keep the objective below the mastery gate');
  assert.ok(Number(masteryResult.outputSummary?.mastery?.evidence?.attemptCount) >= 2, 'mastery evidence should count explicit attempt records');
  assert.ok(Number(masteryResult.outputSummary?.mastery?.evidence?.unknownEvidence) >= 1, 'unstructured learning records must remain unknown evidence instead of becoming fake mastery');
  const masteryQuizTurn = await first.page.evaluate((student) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-mastery-quiz-turn',
    capability: 'mastery_path',
    prompt: `请为${student.displayName}做一道掌握度小测并等待回答`,
    context: {
      language: 'zh',
      studentId: student.id,
      hostToolRequest: { toolName: 'mastery_quiz', arguments: { studentId: student.id } },
    },
    budgets: { maxEvents: 64, maxWallMs: 120000 },
  }), knownStudent);
  assert.equal(masteryQuizTurn.ok, true, 'mastery_quiz host tool turn should be accepted');
  const masteryQuizRunId = masteryQuizTurn.result?.runId;
  const masteryQuizCheckpoint = await waitForCheckpoint(first.page, masteryQuizRunId, 8000);
  assert.ok(masteryQuizCheckpoint, 'mastery_quiz should create a user-input checkpoint');
  const masteryQuestionId = String(masteryQuizCheckpoint.state?.questions?.[0]?.id ?? '');
  assert.match(masteryQuestionId, /^mastery_question_/, 'checkpoint must carry only the public mastery question id');
  assert.equal(JSON.stringify(masteryQuizCheckpoint.state).includes('expectedAnswer'), false, 'checkpoint must not contain the expected answer');
  const masteryQuizSubmit = await first.page.evaluate((checkpoint) => window.omniEdu.deepTutorSubmitUserInput({
    requestId: String(checkpoint.state.requestId),
    text: 'A',
  }), masteryQuizCheckpoint);
  assert.equal(masteryQuizSubmit.ok, true, 'mastery_quiz answer should resolve the checkpoint');
  const masteryQuizRun = await waitForRun(first.page, masteryQuizRunId, 12000);
  assert.equal(masteryQuizRun?.status, 'succeeded', 'mastery_quiz should complete after answer');
  const masteryGradeTurn = await first.page.evaluate(({ student, questionId }) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-mastery-grade-turn',
    capability: 'mastery_path',
    prompt: `请评分${student.displayName}刚完成的掌握度小测并写回学习记录`,
    context: {
      language: 'zh',
      studentId: student.id,
      hostToolRequest: { toolName: 'mastery_grade', arguments: { questionId, answer: 'A' } },
    },
    budgets: { maxEvents: 64, maxWallMs: 120000 },
  }), { student: knownStudent, questionId: masteryQuestionId });
  assert.equal(masteryGradeTurn.ok, true, 'mastery_grade host tool turn should be accepted');
  const masteryGradeRun = await waitForRun(first.page, masteryGradeTurn.result?.runId, 12000);
  assert.equal(masteryGradeRun?.status, 'succeeded', 'mastery_grade should complete');
  const masteryGradeEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), masteryGradeTurn.result?.runId);
  const masteryGradeObserve = masteryGradeEvents.find((event) => event.phase === 'observe' && event.outputSummary?.status === 'used');
  assert.ok(masteryGradeObserve, 'mastery_grade should produce a used observation');
  const postGradeRecords = await first.page.evaluate((studentId) => window.omniEdu.listRecords(studentId, { keyword: 'mastery_attempt', limit: 50 }), knownStudent.id);
  assert.ok(postGradeRecords.some((record) => record.recordType === 'mastery_attempt' && record.content.includes('isCorrect')), 'mastery_grade must write explicit mastery_attempt evidence');
  const duplicateGradeTurn = await first.page.evaluate(({ student, questionId }) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-mastery-grade-duplicate-turn',
    capability: 'mastery_path',
    prompt: `请再次评分${student.displayName}刚完成的掌握度小测`,
    context: {
      language: 'zh',
      studentId: student.id,
      hostToolRequest: { toolName: 'mastery_grade', arguments: { questionId, answer: 'A' } },
    },
    budgets: { maxEvents: 64, maxWallMs: 120000 },
  }), { student: knownStudent, questionId: masteryQuestionId });
  const duplicateGradeRun = await waitForRun(first.page, duplicateGradeTurn.result?.runId, 12000);
  assert.equal(duplicateGradeRun?.status, 'succeeded', 'duplicate grade request should close safely');
  const duplicateGradeEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), duplicateGradeTurn.result?.runId);
  assert.ok(duplicateGradeEvents.some((event) => event.phase === 'observe' && event.outputSummary?.status === 'blocked'), 'duplicate mastery_grade must be blocked');
  await first.page.evaluate((student) => window.omniEdu.createRecord({
    studentId: student.id,
    recordType: 'mastery_attempt',
    subject: 'math',
    title: 'Concept assessment seed',
    content: JSON.stringify({ knowledgePoint: 'concept-basics', knowledgeType: 'concept', isCorrect: false }),
    tags: ['concept-basics'],
  }), knownStudent);
  const assessTurn = await first.page.evaluate((student) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-mastery-assess-turn',
    capability: 'mastery_path',
    prompt: `分析当前学生${student.displayName}的学习掌握情况`,
    context: {
      language: 'en',
      studentId: student.id,
      hostToolRequest: { toolName: 'mastery_assess', arguments: { studentId: student.id, knowledgePointId: 'kp_concept-basics', passed: true, feedback: 'teacher confirmed' } },
    },
    budgets: { maxEvents: 64, maxWallMs: 120000 },
  }), knownStudent);
  assert.equal(assessTurn.ok, true, 'mastery_assess host tool turn should be accepted');
  const assessRun = await waitForRun(first.page, assessTurn.result?.runId, 12000);
  assert.equal(assessRun?.status, 'succeeded', 'mastery_assess should complete');
  const assessEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), assessTurn.result?.runId);
  assert.ok(assessEvents.some((event) => event.phase === 'observe' && event.outputSummary?.status === 'used'), 'mastery_assess should produce a used observation');
  const assessConfirmation = (await first.page.evaluate(() => window.omniEdu.listAiConfirmations('pending'))).find((item) => item.runId === assessTurn.result?.runId && item.actionType === 'save_mastery_state');
  assert.ok(assessConfirmation, 'mastery_assess must create a teacher confirmation before writeback');
  const assessConfirmationResult = await first.page.evaluate((id) => window.omniEdu.confirmAiConfirmation(id), assessConfirmation.id);
  assert.equal(assessConfirmationResult.item.status, 'confirmed', 'confirmed mastery_assess should write back');
  assert.ok(assessConfirmationResult.readback?.masteryAttempt, 'mastery_assess confirmation should return a bounded readback');
  const wrongGateTurn = await first.page.evaluate((student) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-mastery-assess-wrong-gate',
    capability: 'mastery_path',
    prompt: `分析当前学生${student.displayName}的学习掌握情况`,
    context: {
      language: 'en',
      studentId: student.id,
      hostToolRequest: { toolName: 'mastery_assess', arguments: { studentId: student.id, knowledgePointId: 'kp_一次函数', passed: true } },
    },
    budgets: { maxEvents: 64, maxWallMs: 120000 },
  }), knownStudent);
  const wrongGateRun = await waitForRun(first.page, wrongGateTurn.result?.runId, 12000);
  assert.equal(wrongGateRun?.status, 'succeeded', 'wrong mastery_assess gate should close safely');
  const wrongGateEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), wrongGateTurn.result?.runId);
  assert.ok(wrongGateEvents.some((event) => event.phase === 'observe' && event.outputSummary?.status === 'blocked'), 'procedure mastery_assess must be blocked in favor of quiz/grade');
  const masteryBuildTurn = await first.page.evaluate((student) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-mastery-build-turn',
    capability: 'mastery_path',
    prompt: `为当前学生${student.displayName}生成学习路径和练习计划`,
    context: {
      language: 'en',
      studentId: student.id,
      hostToolRequest: {
        toolName: 'mastery_build',
        arguments: {
          studentId: student.id,
          mode: 'replace',
          modules: [{ name: 'Functions', knowledgePoints: [{ name: 'domain', type: 'concept' }, { name: 'graph', type: 'procedure' }] }],
        },
      },
    },
    budgets: { maxEvents: 64, maxWallMs: 120000 },
  }), knownStudent);
  assert.equal(masteryBuildTurn.ok, true, 'mastery_build host tool turn should be accepted');
  const masteryBuildRun = await waitForRun(first.page, masteryBuildTurn.result?.runId, 12000);
  assert.equal(masteryBuildRun?.status, 'succeeded', 'mastery_build should complete');
  const masteryBuildEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), masteryBuildTurn.result?.runId);
  const masteryBuildObserve = masteryBuildEvents.find((event) => event.phase === 'observe' && event.outputSummary?.status === 'used');
  assert.ok(masteryBuildObserve, 'mastery_build should produce a used observation');
  assert.equal(masteryBuildObserve.outputSummary?.toolName, 'mastery_build', 'observation should identify mastery_build');
  assert.ok(masteryBuildObserve.outputSummary?.resultKeys?.includes('modules'), 'mastery_build should expose only bounded module summary keys');
  const preBuildPath = await first.page.evaluate((studentId) => window.omniEdu.getAiMasteryPath(studentId), knownStudent.id);
  assert.equal(preBuildPath, null, 'mastery_build must not mutate the path before teacher confirmation');
  const buildConfirmation = (await first.page.evaluate(() => window.omniEdu.listAiConfirmations('pending'))).find((item) => item.runId === masteryBuildTurn.result?.runId && item.actionType === 'save_mastery_state');
  assert.ok(buildConfirmation, 'mastery_build must create a teacher confirmation before writeback');
  const buildConfirmationResult = await first.page.evaluate((id) => window.omniEdu.confirmAiConfirmation(id), buildConfirmation.id);
  assert.equal(buildConfirmationResult.item.status, 'confirmed', 'confirmed mastery_build should persist the path');
  const masteryPath = await first.page.evaluate((studentId) => window.omniEdu.getAiMasteryPath(studentId), knownStudent.id);
  assert.equal(masteryPath?.modules?.[0]?.knowledgePoints?.[0]?.id, 'mastery_m0_kp0', 'mastery_build should persist deterministic point IDs');
  const masteryAppendTurn = await first.page.evaluate((student) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-mastery-build-append',
    capability: 'mastery_path',
    prompt: `为当前学生${student.displayName}生成学习路径和练习计划`,
    context: {
      language: 'zh',
      studentId: student.id,
      hostToolRequest: {
        toolName: 'mastery_build',
        arguments: { studentId: student.id, mode: 'append', modules: [{ name: 'Equations', knowledgePoints: [{ name: 'linear', type: 'concept' }] }] },
      },
    },
    budgets: { maxEvents: 64, maxWallMs: 120000 },
  }), knownStudent);
  const masteryAppendRun = await waitForRun(first.page, masteryAppendTurn.result?.runId, 12000);
  assert.equal(masteryAppendRun?.status, 'succeeded', 'mastery_build append should complete');
  const appendConfirmation = (await first.page.evaluate(() => window.omniEdu.listAiConfirmations('pending'))).find((item) => item.runId === masteryAppendTurn.result?.runId && item.actionType === 'save_mastery_state');
  assert.ok(appendConfirmation, 'mastery_build append must create a teacher confirmation');
  const appendConfirmationResult = await first.page.evaluate((id) => window.omniEdu.confirmAiConfirmation(id), appendConfirmation.id);
  assert.equal(appendConfirmationResult.item.status, 'confirmed', 'confirmed mastery_build append should persist');
  const appendedPath = await first.page.evaluate((studentId) => window.omniEdu.getAiMasteryPath(studentId), knownStudent.id);
  assert.equal(appendedPath?.version, 2, 'mastery_build append should increment path version');
  assert.equal(appendedPath?.modules?.[1]?.id, 'mastery_m1', 'mastery_build append should remap module IDs without collisions');
  const rejectedBuildTurn = await first.page.evaluate((student) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-mastery-build-rejected',
    capability: 'mastery_path',
    prompt: `为当前学生${student.displayName}生成学习路径和练习计划`,
    context: {
      language: 'zh',
      studentId: student.id,
      hostToolRequest: { toolName: 'mastery_build', arguments: { studentId: student.id, modules: [{ name: 'Rejected', knowledgePoints: [{ name: 'never-written', type: 'concept' }] }] } },
    },
    budgets: { maxEvents: 64, maxWallMs: 120000 },
  }), knownStudent);
  const rejectedBuildRun = await waitForRun(first.page, rejectedBuildTurn.result?.runId, 12000);
  assert.equal(rejectedBuildRun?.status, 'succeeded', 'rejected mastery_build should close safely');
  const rejectedConfirmation = (await first.page.evaluate(() => window.omniEdu.listAiConfirmations('pending'))).find((item) => item.runId === rejectedBuildTurn.result?.runId && item.actionType === 'save_mastery_state');
  assert.ok(rejectedConfirmation, 'rejected mastery_build must create a pending confirmation');
  const rejectedConfirmationResult = await first.page.evaluate((id) => window.omniEdu.rejectAiConfirmation(id), rejectedConfirmation.id);
  assert.equal(rejectedConfirmationResult.item.status, 'rejected', 'teacher rejection must be persisted');
  const afterRejectPath = await first.page.evaluate((studentId) => window.omniEdu.getAiMasteryPath(studentId), knownStudent.id);
  assert.equal(afterRejectPath?.version, 2, 'rejected mastery_build must not mutate the persisted path');
  const pathAssessTurn = await first.page.evaluate((student) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-mastery-assess-path-point',
    capability: 'mastery_path',
    prompt: `分析当前学生${student.displayName}的学习掌握情况`,
    context: {
      language: 'zh',
      studentId: student.id,
      hostToolRequest: { toolName: 'mastery_assess', arguments: { studentId: student.id, knowledgePointId: 'mastery_m0_kp0', passed: false } },
    },
    budgets: { maxEvents: 64, maxWallMs: 120000 },
  }), knownStudent);
  const pathAssessRun = await waitForRun(first.page, pathAssessTurn.result?.runId, 12000);
  assert.equal(pathAssessRun?.status, 'succeeded', 'mastery_assess should accept points from the persisted mastery path');
  const pathAssessEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), pathAssessTurn.result?.runId);
  assert.ok(pathAssessEvents.some((event) => event.phase === 'observe' && event.outputSummary?.status === 'used'), 'path-backed mastery_assess should produce a used observation');
  const pathAssessConfirmation = (await first.page.evaluate(() => window.omniEdu.listAiConfirmations('pending'))).find((item) => item.runId === pathAssessTurn.result?.runId && item.actionType === 'save_mastery_state');
  assert.ok(pathAssessConfirmation, 'path-backed mastery_assess must require confirmation');
  const pathAssessConfirmationResult = await first.page.evaluate((id) => window.omniEdu.confirmAiConfirmation(id), pathAssessConfirmation.id);
  assert.equal(pathAssessConfirmationResult.item.status, 'confirmed', 'path-backed mastery_assess confirmation should succeed');
  const invalidBuildTurn = await first.page.evaluate((student) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-mastery-build-invalid',
    capability: 'mastery_path',
    prompt: `为当前学生${student.displayName}生成学习路径和练习计划`,
    context: {
      language: 'en',
      studentId: student.id,
      hostToolRequest: { toolName: 'mastery_build', arguments: { studentId: student.id, modules: [{ name: '', knowledgePoints: [] }] } },
    },
    budgets: { maxEvents: 64, maxWallMs: 120000 },
  }), knownStudent);
  const invalidBuildRun = await waitForRun(first.page, invalidBuildTurn.result?.runId, 12000);
  assert.equal(invalidBuildRun?.status, 'succeeded', 'invalid mastery_build should close safely');
  const invalidBuildEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), invalidBuildTurn.result?.runId);
  assert.ok(invalidBuildEvents.some((event) => event.phase === 'observe' && event.outputSummary?.status === 'blocked'), 'invalid mastery_build must be blocked without mutation');
  const unknownStudentBuildTurn = await first.page.evaluate(() => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-mastery-build-unknown-student',
    capability: 'mastery_path',
    prompt: '为当前学生生成学习路径和练习计划',
    context: {
      language: 'zh',
      studentId: 'student_missing_for_mastery',
      hostToolRequest: { toolName: 'mastery_build', arguments: { studentId: 'student_missing_for_mastery', modules: [{ name: 'Blocked', knowledgePoints: [{ name: 'point', type: 'concept' }] }] } },
    },
    budgets: { maxEvents: 64, maxWallMs: 120000 },
  }));
  const unknownStudentBuildRun = await waitForRun(first.page, unknownStudentBuildTurn.result?.runId, 12000);
  assert.equal(unknownStudentBuildRun?.status, 'succeeded', 'unknown-student mastery_build should close safely');
  const unknownStudentBuildEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), unknownStudentBuildTurn.result?.runId);
  assert.ok(unknownStudentBuildEvents.some((event) => event.phase === 'observe' && event.outputSummary?.status === 'blocked'), 'mastery_build must reject unknown student IDs');
  const askUserTurn = await first.page.evaluate(() => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-ask-user-turn',
    capability: 'chat',
    prompt: '请在继续回答前询问老师一个关键澄清问题。',
    context: {
      language: 'zh',
      dryRun: true,
      hostToolAuto: {
        toolName: 'ask_user',
        arguments: { question: '本轮要面向哪个年级的学生？' },
      },
    },
    budgets: { maxEvents: 32, maxWallMs: 120000 },
  }));
  assert.equal(askUserTurn.ok, true, 'ask_user turn should be accepted');
  const askUserRunId = askUserTurn.result?.runId;
  assert.equal(typeof askUserRunId, 'string', 'ask_user run id should be returned to host');
  const pendingCheckpoint = await waitForCheckpoint(first.page, askUserRunId);
  assert.ok(pendingCheckpoint, 'ask_user should persist a pending capability checkpoint');
  await first.page.waitForFunction(async (runId) => (await window.omniEdu.getAiAgentRun(runId))?.status === 'waiting_input', askUserRunId, { timeout: 4_000 });
  const waitingInputRun = await first.page.evaluate((runId) => window.omniEdu.getAiAgentRun(runId), askUserRunId);
  assert.equal(waitingInputRun?.status, 'waiting_input', 'run should expose waiting_input while the AgentLoop is paused');
  const submittedInput = await first.page.evaluate((checkpoint) => window.omniEdu.deepTutorSubmitUserInput({
    requestId: String(checkpoint.state.requestId),
    text: '初二',
  }), pendingCheckpoint);
  assert.equal(submittedInput.ok, true, 'first user input submission should resolve the checkpoint');
  const duplicateInput = await first.page.evaluate((checkpoint) => window.omniEdu.deepTutorSubmitUserInput({
    requestId: String(checkpoint.state.requestId),
    text: '重复答案',
  }), pendingCheckpoint);
  assert.equal(duplicateInput.ok, false, 'duplicate user input submission must be idempotently rejected');
  const askUserRun = await waitForRun(first.page, askUserRunId);
  assert.equal(askUserRun?.status, 'succeeded', 'AgentLoop should resume and finish after user input');
  const askUserEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), askUserRunId);
  assert.ok(askUserEvents.some((event) => event.phase === 'guardrail' && event.outputSummary?.status === 'pending'), 'pending input guardrail should be persisted');
  assert.ok(askUserEvents.some((event) => event.phase === 'observe' && event.outputSummary?.status === 'answered'), 'answered input observation should be persisted');
  assert.deepEqual(askUserEvents.map((event) => event.sequence), askUserEvents.map((_, index) => index + 1));
  const resolvedCheckpoint = await first.page.evaluate((checkpointId) => window.omniEdu.getAiCapabilityCheckpoint(checkpointId), pendingCheckpoint.id);
  assert.equal(resolvedCheckpoint?.status, 'resolved', 'checkpoint should be durably resolved');
  const cancelInputTurn = await first.page.evaluate(() => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-ask-user-cancel',
    capability: 'chat',
    prompt: '请在取消路径询问一个补充信息。',
    context: { language: 'zh', dryRun: true, hostToolAuto: { toolName: 'ask_user', arguments: { question: '这个问题将被取消。' } } },
    budgets: { maxEvents: 24, maxWallMs: 120000 },
  }));
  assert.equal(cancelInputTurn.ok, true, 'cancel ask_user turn should be accepted');
  const cancelRunId = cancelInputTurn.result?.runId;
  const cancelCheckpoint = await waitForCheckpoint(first.page, cancelRunId);
  assert.ok(cancelCheckpoint, 'cancel path should create a checkpoint');
  const cancelled = await first.page.evaluate((turnId) => window.omniEdu.deepTutorCancelTurn(turnId), 'electron-ask-user-cancel');
  assert.equal(cancelled?.ok, true, 'cancel path should be idempotently accepted');
  const cancelledRun = await waitForRun(first.page, cancelRunId);
  assert.equal(cancelledRun?.status, 'blocked', 'cancelled input should close the run as blocked');
  const cancelledCheckpoint = await waitForCheckpointStatus(first.page, cancelCheckpoint.id, 'cancelled');
  assert.equal(cancelledCheckpoint?.status, 'cancelled', 'cancelled input checkpoint should be resolved as cancelled');
  const deepQuestionTurn = await first.page.evaluate((student) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-deep-question-dry-run',
    capability: 'deep_question',
    prompt: '为分数加法生成一道初中基础练习题。',
    context: {
      language: 'zh',
      sessionId: 'electron-capability-session',
      studentId: student.id,
      dryRun: true,
      configOverrides: { mode: 'custom', topic: '分数加法', num_questions: 1, difficulty: 'easy' },
    },
    budgets: { maxEvents: 96, maxWallMs: 120000 },
  }), knownStudent);
  assert.equal(deepQuestionTurn.ok, true, 'deep_question dry-run should be accepted');
  const deepQuestionRun = await waitForRun(first.page, deepQuestionTurn.result?.runId, 12000);
  if (deepQuestionRun?.status !== 'succeeded') {
    const debugEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), deepQuestionTurn.result?.runId);
    console.error('deep_question debug', JSON.stringify({ run: deepQuestionRun, events: debugEvents }, null, 2));
  }
  assert.equal(deepQuestionRun?.status, 'succeeded', 'deep_question dry-run should complete through upstream capability');
  const deepQuestionEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), deepQuestionTurn.result?.runId);
  assert.ok(deepQuestionEvents.some((event) => event.phase === 'finalize' && event.outputSummary?.capability === 'deep_question'), 'deep_question result evidence should identify capability');
  assert.ok(deepQuestionEvents.some((event) => event.phase === 'plan' && event.outputSummary?.capability === 'deep_question'), 'deep_question should emit upstream stage evidence');
  let deepQuestionConfirmations = [];
  for (let attempt = 0; attempt < 20; attempt += 1) {
    deepQuestionConfirmations = await first.page.evaluate(() => window.omniEdu.listAiConfirmations('pending'));
    if (deepQuestionConfirmations.some((item) => item.runId === deepQuestionTurn.result?.runId)) break;
    await first.page.waitForTimeout(100);
  }
  const deepQuestionConfirmation = deepQuestionConfirmations.find((item) => item.runId === deepQuestionTurn.result?.runId);
  assert.ok(deepQuestionConfirmation, 'deep_question should create a pending teacher confirmation');
  assert.equal(deepQuestionConfirmation.actionType, 'save_exercise_set', 'deep_question confirmation should target exercise-set save');
  assert.equal(deepQuestionConfirmation.status, 'pending', 'deep_question result must not auto-write an exercise set');
  assert.ok(deepQuestionConfirmation.payload.exerciseSet?.items?.length >= 1, 'deep_question confirmation should contain generated items');

  // Frontend teacher workflow: click the real import control, pass through the
  // production attachments:import handler with a bounded E2E dialog adapter,
  // then verify copied bytes/hash before needs_ocr, correction and sanitizing.
  // This intentionally
  // runs before saving a provider key so the UI's no-key degradation is also
  // exercised from a click path.
  const mistakeRecordList = await first.page.evaluate((student) => window.omniEdu.createRecord({
    studentId: student.id,
    recordType: 'mistake',
    subject: '数学',
    title: '错题图片前端验收',
    content: '待处理的错题图片记录',
    tags: ['前端验收'],
  }), knownStudent);
  const mistakeRecord = mistakeRecordList.find((record) => record.title === '错题图片前端验收');
  assert.ok(mistakeRecord, 'mistake record should be created for frontend E2E');
  const emptyMasteryStudentList = await first.page.evaluate(() => window.omniEdu.createStudent({
    displayName: '无路径前端验收学生',
    realName: '',
    grade: '八年级',
    school: '',
    subjects: ['数学'],
    goals: '验证学习路径空态',
    currentIssues: '',
    parentConcerns: '',
    teacherNotes: '',
    tags: ['前端验收'],
  }));
  const emptyMasteryStudent = emptyMasteryStudentList.find((student) => student.displayName === '无路径前端验收学生');
  assert.ok(emptyMasteryStudent, 'mastery empty-state fixture student should be created through the existing student API');
  const reviewReminderRecordList = await first.page.evaluate((student) => window.omniEdu.createRecord({
    studentId: student.id,
    recordType: 'mastery_attempt',
    subject: '数学',
    title: '复习提醒前端验收知识点',
    content: JSON.stringify({ knowledgePoint: '复习提醒前端验收知识点', knowledgeType: 'procedure', isCorrect: true }),
    tags: ['mastery_attempt', '前端验收'],
    occurredAt: new Date(Date.now() - 8 * 86_400_000).toISOString(),
  }), knownStudent);
  const reviewReminderRecord = reviewReminderRecordList.find((record) => record.title === '复习提醒前端验收知识点');
  assert.ok(reviewReminderRecord, 'review reminder fixture must persist through the existing record API');
  await first.page.reload();
  await first.page.waitForLoadState('domcontentloaded');
  await first.page.getByTestId('nav-students').click();
  await first.page.getByTestId(`student-row-${knownStudent.id}`).click();

  // Review reminder: view the existing review:getReminder calculation from
  // the Today navigation, then prove refresh is read-only and students are isolated.
  await first.page.getByTestId('nav-today').click();
  await first.page.getByTestId('review-reminder-due').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('review-reminder-due').textContent(), /复习提醒前端验收知识点/, 'due reminder must render the knowledge point calculated from SQLite records');
  assert.match(await first.page.getByTestId('review-reminder-boundary').textContent(), /不包含学习记录正文、答案或附件路径/, 'reminder UI must expose its bounded privacy projection');
  const knownRecordCountBeforeReminderRefresh = (await first.page.evaluate((studentId) => window.omniEdu.listRecords(studentId), knownStudent.id)).length;
  await first.page.setViewportSize({ width: 1366, height: 768 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-review-reminder-1366x768.png'), fullPage: true });
  await first.page.setViewportSize({ width: 1920, height: 1080 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-review-reminder-1920x1080.png'), fullPage: true });
  await first.page.getByTestId('review-reminder-refresh').click();
  await first.page.getByTestId('review-reminder-due').waitFor({ state: 'visible' });
  assert.equal((await first.page.evaluate((studentId) => window.omniEdu.listRecords(studentId), knownStudent.id)).length, knownRecordCountBeforeReminderRefresh, 'reminder refresh must not write a second queue or learning record');
  await first.page.getByTestId('review-reminder-open-evidence').click();
  await first.page.getByTestId(`student-row-${knownStudent.id}`).waitFor({ state: 'visible' });
  assert.match(await first.page.locator('.topbar h1').textContent(), /学生/, 'review reminder evidence CTA must open the student workspace');
  await first.page.getByTestId(`student-row-${emptyMasteryStudent.id}`).click();
  await first.page.getByTestId('nav-today').click();
  await first.page.getByTestId('review-reminder-clear').waitFor({ state: 'visible' });
  assert.equal(await first.page.getByTestId('review-reminder-due').count(), 0, 'due reminder must not leak to a student without learning records');
  await first.page.getByTestId('nav-students').click();
  await first.page.getByTestId(`student-row-${knownStudent.id}`).click();
  await first.page.getByTestId('nav-today').click();
  await first.page.getByTestId('review-reminder-due').waitFor({ state: 'visible' });

  // Review reports: use the existing reports:generate/update/list chain from
  // teacher-visible controls. Generation persists a SQLite draft plus an
  // initial Markdown snapshot; later edits intentionally update SQLite only.
  await first.page.getByTestId('nav-review').click();
  await first.page.getByTestId('review-report-workspace').waitFor({ state: 'visible' });
  const reportsBeforeReviewValidation = await first.page.evaluate((studentId) => window.omniEdu.listReports(studentId), knownStudent.id);
  await first.page.getByTestId('review-report-start-date').fill('2026-08-12');
  await first.page.getByTestId('review-report-end-date').fill('2026-08-01');
  await first.page.getByTestId('review-report-generate').click();
  await first.page.getByTestId('review-report-error').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('review-report-error').textContent(), /开始日期不能晚于结束日期/, 'invalid review range must fail visibly');
  assert.equal((await first.page.evaluate((studentId) => window.omniEdu.listReports(studentId), knownStudent.id)).length, reportsBeforeReviewValidation.length, 'invalid review range must perform zero SQLite writes');

  await first.page.getByTestId('review-report-start-date').fill('2000-01-01');
  await first.page.getByTestId('review-report-end-date').fill('2099-12-31');
  await first.page.getByTestId('review-report-subject').fill('数学');
  await first.page.getByTestId('review-report-generate').click();
  await first.page.getByTestId('review-report-draft').waitFor({ state: 'visible' });
  const reportsAfterGeneration = await first.page.evaluate((studentId) => window.omniEdu.listReports(studentId), knownStudent.id);
  const previousReviewIds = new Set(reportsBeforeReviewValidation.map((report) => report.id));
  const generatedReviewReport = reportsAfterGeneration.find((report) => !previousReviewIds.has(report.id));
  assert.ok(generatedReviewReport, 'review generation click must create a SQLite report');
  assert.equal(generatedReviewReport.studentId, knownStudent.id, 'generated report must remain student-bound');
  assert.ok(generatedReviewReport.sourceRecordIds.includes(reviewReminderRecord.id), 'generated report must bind the real learning record ID');
  assert.ok(generatedReviewReport.qualityChecks.length > 0, 'generated report must expose backend quality checks');
  await first.page.getByTestId(`review-report-evidence-${reviewReminderRecord.id}`).waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId(`review-report-evidence-${reviewReminderRecord.id}`).textContent(), /复习提醒前端验收知识点/, 'review evidence must render the bound local record');
  const initialReviewSnapshotPath = join(dataRoot, 'students', knownStudent.id, 'reports', `${generatedReviewReport.id}.md`);
  assert.ok(existsSync(initialReviewSnapshotPath), 'review generation must create the initial Markdown snapshot');
  const initialReviewSnapshot = readFileSync(initialReviewSnapshotPath, 'utf8');
  assert.match(initialReviewSnapshot, new RegExp(generatedReviewReport.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'initial Markdown snapshot must contain the generated title');
  await first.page.setViewportSize({ width: 1366, height: 768 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-review-report-draft-1366x768.png'), fullPage: true });

  const revisedReviewContent = '# 教师修订复盘\n\n教师确认内容：一次函数符号检查。';
  const revisedParentSummary = '教师修订家长摘要：继续观察符号变化。';
  await first.page.getByTestId('review-report-content').fill(revisedReviewContent);
  await first.page.getByTestId('review-report-parent-summary').fill(revisedParentSummary);
  const reviewBeforeSave = (await first.page.evaluate((studentId) => window.omniEdu.listReports(studentId), knownStudent.id)).find((report) => report.id === generatedReviewReport.id);
  assert.equal(reviewBeforeSave?.contentMd, generatedReviewReport.contentMd, 'editing the report form must not write SQLite before save');
  await first.page.getByTestId('review-report-save').click();
  await first.page.getByTestId('review-report-saved').waitFor({ state: 'visible' });
  const savedReviewReport = (await first.page.evaluate((studentId) => window.omniEdu.listReports(studentId), knownStudent.id)).find((report) => report.id === generatedReviewReport.id);
  assert.equal(savedReviewReport?.contentMd, revisedReviewContent, 'save click must persist teacher-edited report content');
  assert.equal(savedReviewReport?.parentSummary, revisedParentSummary, 'save click must persist teacher-edited parent summary');
  assert.ok(await first.page.locator('[data-testid^="review-report-quality-"]').count() > 0, 'saved report must render backend quality checks');
  assert.match(await first.page.getByTestId('review-report-boundary').textContent(), /Markdown 初始快照不代表最终稿/, 'review UI must disclose the file/SQLite boundary');
  assert.equal(readFileSync(initialReviewSnapshotPath, 'utf8'), initialReviewSnapshot, 'SQLite save must not be misreported as rewriting the initial Markdown snapshot');

  await first.page.getByTestId('nav-today').click();
  await first.page.getByTestId('nav-review').click();
  await first.page.getByTestId(`review-report-history-${generatedReviewReport.id}`).waitFor({ state: 'visible' });
  await first.page.getByTestId(`review-report-history-${generatedReviewReport.id}`).click();
  assert.equal(await first.page.getByTestId('review-report-content').inputValue(), revisedReviewContent, 'history reopen must read the saved SQLite report');
  await first.page.getByTestId('nav-students').click();
  await first.page.getByTestId(`student-row-${emptyMasteryStudent.id}`).click();
  await first.page.getByTestId('nav-review').click();
  await first.page.getByTestId('review-report-history-empty').waitFor({ state: 'visible' });
  assert.equal(await first.page.getByTestId(`review-report-history-${generatedReviewReport.id}`).count(), 0, 'review history must not leak across students');
  await first.page.getByTestId('nav-students').click();
  await first.page.getByTestId(`student-row-${knownStudent.id}`).click();
  await first.page.getByTestId('nav-review').click();
  await first.page.getByTestId(`review-report-history-${generatedReviewReport.id}`).waitFor({ state: 'visible' });
  await first.page.getByTestId(`review-report-history-${generatedReviewReport.id}`).click();
  await first.page.setViewportSize({ width: 1920, height: 1080 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-review-report-saved-1920x1080.png'), fullPage: true });
  await first.page.setViewportSize({ width: 1366, height: 768 });
  await first.page.getByTestId('nav-mastery').click();
  await first.page.getByTestId('mastery-path-content').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('mastery-path-workspace').textContent(), /版本 v2/, 'mastery path UI must render the confirmed SQLite version');
  assert.match(await first.page.getByTestId('mastery-path-module-0').textContent(), /Functions/, 'mastery path UI must preserve module order and name');
  assert.match(await first.page.getByTestId('mastery-path-point-0-0').textContent(), /domain.*概念/s, 'mastery path UI must preserve knowledge-point type');
  assert.equal((await first.page.getByTestId('mastery-path-workspace').textContent()).includes('%'), false, 'mastery path must not invent a mastery percentage');
  await first.page.getByTestId('mastery-path-refresh').click();
  await first.page.getByTestId('mastery-path-content').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('mastery-path-workspace').textContent(), /版本 v2/, 'mastery path refresh must return the same SQLite readback');
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-mastery-path-1366x768.png') });
  await first.page.getByTestId('nav-students').click();
  await first.page.getByTestId(`student-row-${emptyMasteryStudent.id}`).click();
  await first.page.getByTestId('nav-mastery').click();
  await first.page.getByTestId('mastery-path-empty').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('mastery-path-empty').textContent(), /还没有教师确认的学习路径/, 'student without a path must show a truthful empty state');
  await first.page.getByTestId('nav-students').click();
  await first.page.getByTestId(`student-row-${knownStudent.id}`).click();
  await first.page.getByTestId('nav-mastery').click();
  await first.page.getByTestId('mastery-path-content').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('mastery-path-workspace').textContent(), /Functions/, 'switching back must not leak the other student empty state');
  await first.page.getByTestId('mastery-path-open-ai').click();
  const masteryAiPrompt = first.page.getByPlaceholder('输入要生成的复盘、练习、PDF 或 Word 文档需求');
  await masteryAiPrompt.waitFor({ state: 'visible' });
  assert.match(await masteryAiPrompt.inputValue(), new RegExp(knownStudent.displayName), 'mastery CTA must prefill a student-bound AI planning task');
  await first.page.setViewportSize({ width: 1920, height: 1080 });
  await first.page.getByTestId('nav-mastery').click();
  await first.page.getByTestId('mastery-path-content').waitFor({ state: 'visible' });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-mastery-path-1920x1080.png') });
  await first.page.setViewportSize({ width: 1366, height: 768 });

  // Global search: the existing search:all handler already aggregates students
  // and records across the local SQLite store. Exercise it only from renderer
  // controls, including validation, no-hit, navigation and dual viewports.
  await first.page.getByTestId('nav-search').click();
  await first.page.getByTestId('global-search-idle').waitFor({ state: 'visible' });
  await first.page.getByTestId('global-search-submit').click();
  await first.page.getByTestId('global-search-error').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('global-search-error').textContent(), /至少一个检索关键词/, 'blank global search must fail visibly without querying');
  await first.page.getByTestId('global-search-input').fill(knownStudent.displayName);
  await first.page.getByTestId('global-search-submit').click();
  await first.page.getByTestId(`global-search-student-${knownStudent.id}`).waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId(`global-search-student-${knownStudent.id}`).textContent(), new RegExp(knownStudent.displayName), 'global student search must render the SQLite student');
  await first.page.getByTestId(`global-search-student-${knownStudent.id}`).click();
  await first.page.getByTestId(`student-row-${knownStudent.id}`).waitFor({ state: 'visible' });
  assert.match(await first.page.locator('.topbar h1').textContent(), /学生/, 'student search result must navigate to the student workspace');
  await first.page.getByTestId('nav-search').click();
  await first.page.getByTestId('global-search-input').fill('错题图片前端验收');
  await first.page.getByTestId('global-search-submit').click();
  await first.page.getByTestId(`global-search-record-${mistakeRecord.id}`).waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId(`global-search-record-${mistakeRecord.id}`).textContent(), /错题图片前端验收/, 'global record search must render the cross-student SQLite record');
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-global-search-1366x768.png') });
  await first.page.setViewportSize({ width: 1920, height: 1080 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-global-search-1920x1080.png') });
  await first.page.getByTestId(`global-search-record-${mistakeRecord.id}`).click();
  await first.page.getByTestId(`timeline-record-${mistakeRecord.id}`).waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId(`timeline-record-${mistakeRecord.id}`).textContent(), /错题图片前端验收/, 'record result must open its owning student timeline');
  await first.page.setViewportSize({ width: 1366, height: 768 });
  await first.page.getByTestId('nav-search').click();
  await first.page.getByTestId('global-search-input').fill('NO_HIT_GLOBAL_SEARCH_7E41');
  await first.page.getByTestId('global-search-submit').click();
  await first.page.getByTestId('global-search-empty').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('global-search-empty').textContent(), /没有找到/, 'global search must show a truthful no-hit state');
  await first.page.getByTestId('nav-mistakes').click();
  await first.page.getByTestId('mistakes-workspace').waitFor({ state: 'visible' });
  const viewport1366 = await first.page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  assert.deepEqual(viewport1366, { width: 1366, height: 768 }, 'mistake workflow must be verified at 1366x768');
  await first.page.getByTestId(`mistake-import-${mistakeRecord.id}`).click();
  await first.page.getByTestId('mistake-attachment-import-success').waitFor({ state: 'visible' });
  const importedMistakeRecord = (await first.page.evaluate((studentId) => window.omniEdu.listRecords(studentId, { type: 'mistake' }), knownStudent.id)).find((record) => record.id === mistakeRecord.id);
  assert.equal(importedMistakeRecord.attachments.length, 1, 'import click should create exactly one attachment');
  const importedAttachment = importedMistakeRecord.attachments[0];
  const attachmentId = importedAttachment.id;
  assert.equal(importedAttachment.fileName, 'teacher-selected-mistake.png', 'dialog-selected filename should survive readback');
  assert.equal(importedAttachment.fileSize, controlledAttachmentBytes.length, 'copied attachment size should match source bytes');
  assert.match(importedAttachment.contentHash, /^[a-f0-9]{64}$/i, 'copied attachment should have a real SHA-256');
  assert.ok(importedAttachment.filePath.startsWith(dataRoot), 'attachment target must be managed inside the local data root');
  assert.notEqual(importedAttachment.filePath, controlledAttachmentPath, 'attachment import must copy instead of linking the teacher source file');
  assert.ok(existsSync(importedAttachment.filePath) && existsSync(controlledAttachmentPath), 'copied target and original teacher source should both remain readable');
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-mistakes-1366x768.png'), fullPage: true });
  const attachmentCountBeforeCancel = importedMistakeRecord.attachments.length;
  await first.page.getByTestId(`mistake-import-${mistakeRecord.id}`).click();
  await first.page.getByTestId('mistake-attachment-import-canceled').waitFor({ state: 'visible' });
  const afterCanceledImport = (await first.page.evaluate((studentId) => window.omniEdu.listRecords(studentId, { type: 'mistake' }), knownStudent.id)).find((record) => record.id === mistakeRecord.id);
  assert.equal(afterCanceledImport.attachments.length, attachmentCountBeforeCancel, 'cancelled dialog must produce zero attachment writes');
  await first.page.getByTestId(`create-ocr-${attachmentId}`).click();
  await first.page.getByTestId('mistake-analysis-select').waitFor({ state: 'visible' });
  const needsOcrAnalyses = await first.page.evaluate((studentId) => window.omniEdu.listMistakeImageAnalyses(studentId), knownStudent.id);
  assert.equal(needsOcrAnalyses[0]?.ocrStatus, 'needs_ocr', 'image should enter needs_ocr state');
  await first.page.getByTestId('mistake-correction-input').fill('小A 手机 13800138000 的题目：求一次函数斜率。');
  await first.page.getByTestId('mistake-sanitize-button').click();
  await first.page.getByTestId('mistake-redactions').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('mistake-sanitized-text').textContent(), /\[手机号\]/, 'sanitized preview should redact phone number');
  await first.page.getByTestId('mistake-save-correction').click();
  await first.page.waitForTimeout(120);
  const correctedAnalysis = await first.page.evaluate((studentId) => window.omniEdu.listMistakeImageAnalyses(studentId), knownStudent.id);
  assert.equal(correctedAnalysis[0]?.ocrStatus, 'teacher_corrected', 'teacher correction should persist through preload and SQLite');
  const exerciseCountBeforeFrontendReject = (await first.page.evaluate((studentId) => window.omniEdu.listExerciseSets(studentId), knownStudent.id)).length;
  await first.page.getByTestId('mistake-send-ai').click();
  await first.page.getByTestId('ai-output-error').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('ai-output-error').textContent(), /API Key|凭证|配置|DeepSeek/i, 'no provider key must show an actionable frontend error');
  await first.page.getByTestId('nav-mistakes').click();
  await first.page.getByTestId('mistake-triplet-panel').waitFor({ state: 'visible' });
  await first.page.getByTestId('mistake-triplet-stem-0').fill('教师编辑后的题干');
  assert.equal(await first.page.getByTestId('mistake-triplet-stem-0').inputValue(), '教师编辑后的题干', 'triplet preview should support teacher editing');
  await first.page.getByTestId('mistake-triplet-reject').click();
  await first.page.waitForTimeout(120);
  const rejectedExerciseCount = (await first.page.evaluate((studentId) => window.omniEdu.listExerciseSets(studentId), knownStudent.id)).length;
  assert.equal(rejectedExerciseCount, exerciseCountBeforeFrontendReject, 'rejecting triplet from UI must leave zero exercise-set writes');
  await first.page.setViewportSize({ width: 1920, height: 1080 });
  await first.page.getByTestId('mistakes-workspace').waitFor({ state: 'visible' });
  const viewport1920 = await first.page.evaluate(() => ({ width: window.innerWidth, height: window.innerHeight }));
  assert.deepEqual(viewport1920, { width: 1920, height: 1080 }, 'mistake workflow must be verified at 1920x1080');
  assert.ok(await first.page.getByTestId('mistake-image-import-panel').isVisible(), 'mistake import panel must remain visible at 1920x1080');
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-mistakes-1920x1080.png'), fullPage: true });

  // Confirm path: create a fresh upstream draft, then persist it from a real
  // renderer click and read the resulting exercise set back through preload.
  const confirmTurn = await first.page.evaluate((student) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-deep-question-confirm-ui',
    capability: 'deep_question',
    prompt: '生成一组三元题组并由教师确认保存。',
    context: {
      language: 'zh', sessionId: 'electron-capability-session', studentId: student.id, dryRun: true,
      configOverrides: { mode: 'custom', topic: '一次函数斜率', num_questions: 1, difficulty: 'easy' },
    },
    budgets: { maxEvents: 96, maxWallMs: 120000 },
  }), knownStudent);
  assert.equal(confirmTurn.ok, true, 'second deep_question turn should be accepted for the UI confirm path');
  const confirmRun = await waitForRun(first.page, confirmTurn.result?.runId, 12000);
  assert.equal(confirmRun?.status, 'succeeded', 'UI confirm source run should succeed');
  await first.page.waitForFunction(async (runId) => {
    const confirmations = await window.omniEdu.listAiConfirmations('pending');
    return confirmations.some((item) => item.runId === runId);
  }, confirmTurn.result?.runId);
  const confirmationForUi = (await first.page.evaluate(() => window.omniEdu.listAiConfirmations('pending')))
    .find((item) => item.runId === confirmTurn.result?.runId);
  assert.ok(confirmationForUi, 'fresh exercise-set confirmation should be available to the renderer');
  const exerciseCountBeforeConfirm = (await first.page.evaluate((studentId) => window.omniEdu.listExerciseSets(studentId), knownStudent.id)).length;
  await first.page.getByTestId('nav-ai').click();
  await first.page.getByTestId(`ai-confirm-${confirmationForUi.id}`).click();
  await first.page.waitForFunction(async ({ studentId, expectedCount }) => {
    const sets = await window.omniEdu.listExerciseSets(studentId);
    return sets.length === expectedCount;
  }, { studentId: knownStudent.id, expectedCount: exerciseCountBeforeConfirm + 1 });
  const confirmedExerciseSets = await first.page.evaluate((studentId) => window.omniEdu.listExerciseSets(studentId), knownStudent.id);
  const confirmedExerciseSet = confirmedExerciseSets[0];
  assert.ok(confirmedExerciseSet, 'confirm click should create a SQLite exercise set');
  assert.ok(confirmedExerciseSet.items.every((item) => ['local_bank', 'teacher_resource', 'generated'].includes(item.sourceKind)), 'saved exercise items must retain source kinds');

  // Teacher-visible readback: the confirmed set must be available from the
  // mistake workflow without direct preload calls or a separate duplicate workspace.
  await first.page.getByTestId('nav-mistakes').click();
  await first.page.getByTestId(`exercise-set-card-${confirmedExerciseSet.id}`).waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId(`exercise-set-card-${confirmedExerciseSet.id}`).textContent(), new RegExp(confirmedExerciseSet.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'confirmed exercise-set title must render from SQLite readback');
  assert.match(await first.page.getByTestId('exercise-set-readonly-boundary').textContent(), /不提供隐式编辑/, 'formal exercise-set readback must expose its read-only boundary');
  await first.page.getByTestId(`exercise-set-details-${confirmedExerciseSet.id}`).locator('summary').click();
  for (let index = 0; index < confirmedExerciseSet.items.length; index += 1) {
    const expectedSourceLabel = { local_bank: '本地题库', teacher_resource: '教师资源', generated: '小智生成' }[confirmedExerciseSet.items[index].sourceKind];
    assert.match(await first.page.getByTestId(`exercise-set-source-${confirmedExerciseSet.id}-${index}`).textContent(), new RegExp(expectedSourceLabel), 'each exercise item must expose its truthful source label');
  }
  await first.page.setViewportSize({ width: 1366, height: 768 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-exercise-sets-1366x768.png'), fullPage: true });
  await first.page.setViewportSize({ width: 1920, height: 1080 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-exercise-sets-1920x1080.png'), fullPage: true });
  await first.page.getByTestId('exercise-set-refresh').click();
  await first.page.getByTestId(`exercise-set-card-${confirmedExerciseSet.id}`).waitFor({ state: 'visible' });
  assert.equal((await first.page.evaluate((studentId) => window.omniEdu.listExerciseSets(studentId), knownStudent.id)).length, confirmedExerciseSets.length, 'refresh must be read-only and preserve SQLite row count');
  await first.page.setViewportSize({ width: 1366, height: 768 });
  await first.page.getByTestId('nav-students').click();
  await first.page.getByTestId(`student-row-${emptyMasteryStudent.id}`).click();
  await first.page.getByTestId('nav-mistakes').click();
  await first.page.getByTestId('exercise-set-empty').waitFor({ state: 'visible' });
  assert.equal(await first.page.getByTestId(`exercise-set-card-${confirmedExerciseSet.id}`).count(), 0, 'exercise sets must not leak across students');
  await first.page.getByTestId('nav-students').click();
  await first.page.getByTestId(`student-row-${knownStudent.id}`).click();
  await first.page.getByTestId('nav-mistakes').click();
  await first.page.getByTestId(`exercise-set-card-${confirmedExerciseSet.id}`).waitFor({ state: 'visible' });

  // Question notebook: seed canonical local/generated questions through the
  // existing IPC, then exercise source display, bookmark and no-hit states.
  const notebookQuestions = await first.page.evaluate(async () => {
    const local = await window.omniEdu.createQuestionBankItem({
      subject: '数学', grade: '初二', knowledgePoint: '一次函数', questionType: '解答题', difficulty: 'easy',
      stem: '本地题库命中：求 y=2x+1 的斜率。', answer: '2', analysis: '一次项系数就是斜率。',
      sourceTitle: '教师本地题库', sourceKind: 'local_bank', tags: ['前端验收'],
    });
    const generated = await window.omniEdu.createQuestionBankItem({
      subject: '数学', grade: '初二', knowledgePoint: '一次函数', questionType: '解答题', difficulty: 'medium',
      stem: 'generated 来源标识验收题', answer: '待教师复核', analysis: '由小智生成并明确标识。',
      sourceTitle: '小智生成草稿', sourceKind: 'generated', tags: ['前端验收'],
    });
    return { local, generated };
  });
  await first.page.setViewportSize({ width: 1366, height: 768 });
  await first.page.getByTestId('nav-question_notebook').click();
  await first.page.getByTestId(`question-notebook-card-${notebookQuestions.local.id}`).waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId(`question-notebook-source-${notebookQuestions.local.id}`).textContent(), /local_bank/, 'local question source must be visible');
  assert.match(await first.page.getByTestId(`question-notebook-source-${notebookQuestions.generated.id}`).textContent(), /generated/, 'generated question source must be visible');
  const questionSourceOptions = await first.page.getByTestId('question-notebook-new-source-kind').locator('option').allTextContents();
  assert.equal(questionSourceOptions.some((label) => label.includes('generated')), false, 'teacher creation UI must not allow forged generated provenance');
  const questionCountBeforeEmptyCreate = (await first.page.evaluate(() => window.omniEdu.listQuestionNotebook())).total;
  await first.page.getByTestId('question-notebook-create-question').click();
  await first.page.getByTestId('question-notebook-error').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('question-notebook-error').textContent(), /题干不能为空/, 'empty canonical question should show an actionable validation error');
  assert.equal((await first.page.evaluate(() => window.omniEdu.listQuestionNotebook())).total, questionCountBeforeEmptyCreate, 'empty question validation must produce zero writes');
  await first.page.getByTestId('question-notebook-new-grade').fill('初二');
  await first.page.getByTestId('question-notebook-new-knowledge-point').fill('一次函数图像');
  await first.page.getByTestId('question-notebook-new-stem').fill('教师界面录入：判断一次函数图像的增减性。');
  await first.page.getByTestId('question-notebook-new-answer').fill('当斜率大于 0 时递增，小于 0 时递减。');
  await first.page.getByTestId('question-notebook-new-analysis').fill('根据一次函数斜率符号判断。');
  await first.page.getByTestId('question-notebook-new-tags').fill('课堂例题,前端闭环');
  await first.page.getByTestId('question-notebook-create-question').click();
  await first.page.waitForFunction(async () => (await window.omniEdu.listQuestionNotebook({ query: '教师界面录入' })).items.length === 1);
  const uiCreatedQuestion = (await first.page.evaluate(() => window.omniEdu.listQuestionNotebook({ query: '教师界面录入' }))).items[0];
  assert.equal(uiCreatedQuestion.sourceKind, 'local_bank', 'teacher-created canonical question should retain truthful local provenance');
  await first.page.getByTestId(`question-notebook-card-${uiCreatedQuestion.id}`).waitFor({ state: 'visible' });

  await first.page.getByTestId('question-notebook-category-name').fill('待复习');
  await first.page.getByTestId('question-notebook-create-category').click();
  await first.page.waitForFunction(async () => (await window.omniEdu.listQuestionNotebookCategories()).some((category) => category.name === '待复习'));
  let uiQuestionCategory = (await first.page.evaluate(() => window.omniEdu.listQuestionNotebookCategories())).find((category) => category.name === '待复习');
  assert.ok(uiQuestionCategory, 'category create click should persist to SQLite');
  await first.page.getByTestId(`question-notebook-category-rename-input-${uiQuestionCategory.id}`).fill('本周复习');
  await first.page.getByTestId(`question-notebook-rename-category-${uiQuestionCategory.id}`).click();
  await first.page.waitForFunction(async (categoryId) => (await window.omniEdu.listQuestionNotebookCategories()).find((category) => category.id === categoryId)?.version === 2, uiQuestionCategory.id);
  await first.page.waitForFunction(() => document.querySelector('[data-testid="question-notebook-success"]')?.textContent?.includes('版本锁重命名'));
  await first.page.waitForFunction((categoryId) => !(document.querySelector(`[data-testid="question-notebook-rename-category-${categoryId}"]`))?.disabled, uiQuestionCategory.id);
  uiQuestionCategory = (await first.page.evaluate(() => window.omniEdu.listQuestionNotebookCategories())).find((category) => category.id === uiQuestionCategory.id);
  assert.equal(uiQuestionCategory.name, '本周复习', 'category rename should use optimistic version readback');
  await first.page.evaluate(({ categoryId, version }) => window.omniEdu.updateQuestionNotebookCategory(categoryId, { name: '另一窗口已修改', version }), { categoryId: uiQuestionCategory.id, version: uiQuestionCategory.version });
  await first.page.getByTestId(`question-notebook-category-rename-input-${uiQuestionCategory.id}`).fill('不应覆盖并发修改');
  await first.page.getByTestId(`question-notebook-rename-category-${uiQuestionCategory.id}`).click();
  await first.page.getByTestId('question-notebook-error').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('question-notebook-error').textContent(), /版本冲突/, 'stale category rename should fail closed with a visible conflict');
  assert.equal((await first.page.evaluate(() => window.omniEdu.listQuestionNotebookCategories())).find((category) => category.id === uiQuestionCategory.id).name, '另一窗口已修改', 'stale UI must not overwrite the concurrent category name');
  uiQuestionCategory = (await first.page.evaluate(() => window.omniEdu.listQuestionNotebookCategories())).find((category) => category.id === uiQuestionCategory.id);
  await first.page.getByTestId(`question-notebook-category-${uiCreatedQuestion.id}-${uiQuestionCategory.id}`).click();
  await first.page.waitForFunction(async ({ questionId, categoryId }) => (await window.omniEdu.getQuestionNotebookEntry(questionId))?.categories.some((category) => category.id === categoryId), { questionId: uiCreatedQuestion.id, categoryId: uiQuestionCategory.id });

  await first.page.getByTestId(`question-notebook-usage-open-${uiCreatedQuestion.id}`).click();
  await first.page.getByTestId('question-notebook-usage-empty').waitFor({ state: 'visible' });
  await first.page.getByTestId(`question-notebook-usage-record-${uiCreatedQuestion.id}`).click();
  await first.page.waitForFunction(async (questionId) => (await window.omniEdu.listQuestionNotebookUsage(questionId)).length === 1, uiCreatedQuestion.id);
  assert.match(await first.page.getByTestId(`question-notebook-usage-${uiCreatedQuestion.id}`).textContent(), /manual/, 'manual classroom usage should render from SQLite readback');

  await first.page.getByTestId(`question-notebook-delete-category-${uiQuestionCategory.id}`).click();
  await first.page.waitForFunction(async (categoryId) => (await window.omniEdu.listQuestionNotebookCategories(true)).find((category) => category.id === categoryId)?.status === 'deleted', uiQuestionCategory.id);
  assert.equal((await first.page.evaluate((questionId) => window.omniEdu.getQuestionNotebookEntry(questionId), uiCreatedQuestion.id)).categories.some((category) => category.id === uiQuestionCategory.id), false, 'soft-deleted category must disappear from active question overlay');
  await first.page.getByTestId('question-notebook-deleted-categories').click();
  await first.page.getByTestId(`question-notebook-restore-category-${uiQuestionCategory.id}`).click();
  await first.page.waitForFunction(async (categoryId) => (await window.omniEdu.listQuestionNotebookCategories()).find((category) => category.id === categoryId)?.version === 5, uiQuestionCategory.id);
  assert.ok((await first.page.evaluate((questionId) => window.omniEdu.getQuestionNotebookEntry(questionId), uiCreatedQuestion.id)).categories.some((category) => category.id === uiQuestionCategory.id), 'restored category should reveal its retained historical association');

  await first.page.getByTestId(`question-notebook-bookmark-${notebookQuestions.local.id}`).click();
  await first.page.waitForFunction(async (questionId) => (await window.omniEdu.getQuestionNotebookEntry(questionId))?.bookmarked === true, notebookQuestions.local.id);
  await first.page.getByTestId('question-notebook-bookmarked-only').check();
  await first.page.getByTestId(`question-notebook-card-${notebookQuestions.local.id}`).waitFor({ state: 'visible' });
  await first.page.getByTestId('question-notebook-bookmarked-only').uncheck();
  await first.page.getByTestId('question-notebook-search').fill('绝对不存在的题本检索词-frontend-e2e');
  await first.page.getByTestId('question-notebook-no-results').waitFor({ state: 'visible' });
  await first.page.getByTestId('question-notebook-search').fill('本地题库命中');
  await first.page.getByTestId(`question-notebook-card-${notebookQuestions.local.id}`).waitFor({ state: 'visible' });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-question-notebook-1366x768.png'), fullPage: true });

  // Teacher notebook: all state changes start from renderer controls and use
  // the existing typed preload/main/SQLite CRUD with optimistic versions.
  await first.page.getByTestId('nav-notebook').click();
  await first.page.getByTestId('teacher-notebook-workspace').waitFor({ state: 'visible' });
  await first.page.getByTestId('teacher-notebook-empty').waitFor({ state: 'visible' });
  await first.page.getByTestId('teacher-notebook-name').fill('一次函数备课本');
  await first.page.getByTestId('teacher-notebook-description').fill('用于连接小智研究、解题和协作写作语境。');
  await first.page.getByTestId('teacher-notebook-create').click();
  await first.page.waitForFunction(async () => (await window.omniEdu.listTeacherNotebooks()).some((item) => item.name === '一次函数备课本'));
  const teacherNotebookFixture = (await first.page.evaluate(() => window.omniEdu.listTeacherNotebooks())).find((item) => item.name === '一次函数备课本');
  assert.ok(teacherNotebookFixture, 'teacher notebook create click should persist a notebook');
  await first.page.getByTestId('teacher-notebook-record-title').fill('斜率课堂导入');
  await first.page.getByTestId('teacher-notebook-record-query').fill('如何用生活情境解释一次函数斜率？');
  await first.page.getByTestId('teacher-notebook-record-summary').fill('以速度变化建立斜率直觉。');
  await first.page.getByTestId('teacher-notebook-record-output').fill('先比较相同时间内路程变化，再抽象为纵向变化量与横向变化量之比。');
  await first.page.getByTestId('teacher-notebook-record-save').click();
  await first.page.waitForFunction(async (notebookId) => (await window.omniEdu.listTeacherNotebookRecords(notebookId)).length === 1, teacherNotebookFixture.id);
  let teacherNotebookRecordFixture = (await first.page.evaluate((notebookId) => window.omniEdu.listTeacherNotebookRecords(notebookId), teacherNotebookFixture.id))[0];
  assert.equal(teacherNotebookRecordFixture.recordType, 'research', 'record type should use the selected typed value');
  await first.page.getByTestId(`teacher-notebook-record-edit-${teacherNotebookRecordFixture.id}`).click();
  await first.page.getByTestId('teacher-notebook-record-title').fill('斜率课堂导入（教师修订）');
  await first.page.getByTestId('teacher-notebook-record-output').fill('教师修订：先比较速度，再用坐标增量解释斜率，并保留学生追问。');
  await first.page.getByTestId('teacher-notebook-record-save').click();
  await first.page.waitForFunction(async ({ notebookId, recordId }) => (await window.omniEdu.listTeacherNotebookRecords(notebookId)).find((item) => item.id === recordId)?.version === 2, { notebookId: teacherNotebookFixture.id, recordId: teacherNotebookRecordFixture.id });
  teacherNotebookRecordFixture = (await first.page.evaluate((notebookId) => window.omniEdu.listTeacherNotebookRecords(notebookId), teacherNotebookFixture.id))[0];
  assert.match(teacherNotebookRecordFixture.output, /教师修订/, 'record edit click should persist the revised output');
  await first.page.getByTestId(`teacher-notebook-record-delete-${teacherNotebookRecordFixture.id}`).click();
  await first.page.waitForFunction(async (notebookId) => (await window.omniEdu.listTeacherNotebookRecords(notebookId)).length === 0, teacherNotebookFixture.id);
  await first.page.getByTestId('teacher-notebook-records-show-deleted').check();
  await first.page.getByTestId(`teacher-notebook-record-${teacherNotebookRecordFixture.id}`).waitFor({ state: 'visible' });
  await first.page.getByTestId('teacher-notebook-delete').click();
  await first.page.waitForFunction(async (notebookId) => (await window.omniEdu.listTeacherNotebooks(true)).find((item) => item.id === notebookId)?.status === 'deleted', teacherNotebookFixture.id);
  await first.page.getByTestId('teacher-notebook-restore').click();
  await first.page.waitForFunction(async (notebookId) => (await window.omniEdu.listTeacherNotebooks(true)).find((item) => item.id === notebookId)?.status === 'active', teacherNotebookFixture.id);
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-teacher-notebook-1366x768.png'), fullPage: true });
  await first.page.setViewportSize({ width: 1920, height: 1080 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-teacher-notebook-1920x1080.png'), fullPage: true });

  // Teaching Book: exercise the existing book/chapter/page/block/source,
  // health, patch, preview, export and archive contracts entirely from
  // renderer controls. Patch proposals must leave authored content unchanged
  // until the teacher explicitly applies them.
  await first.page.setViewportSize({ width: 1366, height: 768 });
  await first.page.getByTestId('nav-book').click();
  await first.page.getByTestId('teaching-book-workspace').waitFor({ state: 'visible' });
  await first.page.getByTestId('teaching-book-empty').waitFor({ state: 'visible' });
  await first.page.getByTestId('teaching-book-title').fill('一次函数前端创作验收讲义');
  await first.page.getByTestId('teaching-book-target-level').fill('初二');
  await first.page.getByTestId('teaching-book-description').fill('由教师在完整创作工作区逐步构建。');
  await first.page.getByTestId('teaching-book-create').click();
  await first.page.waitForFunction(async () => (await window.omniEdu.listTeachingBooks()).some((book) => book.title === '一次函数前端创作验收讲义'));
  const teachingBookFixture = (await first.page.evaluate(() => window.omniEdu.listTeachingBooks())).find((book) => book.title === '一次函数前端创作验收讲义');
  assert.ok(teachingBookFixture, 'book create click should persist a teaching book');

  await first.page.getByTestId('teaching-book-description').fill('教师修订后的单元备课包说明。');
  await first.page.getByTestId('teaching-book-status').selectOption('ready');
  await first.page.getByTestId('teaching-book-save').click();
  await first.page.waitForFunction(async (bookId) => (await window.omniEdu.getTeachingBook(bookId))?.book.version === 2, teachingBookFixture.id);
  const teachingBookAfterUpdate = await first.page.evaluate((bookId) => window.omniEdu.getTeachingBook(bookId), teachingBookFixture.id);
  assert.match(teachingBookAfterUpdate.book.description, /教师修订/, 'book update click should persist through optimistic versioning');

  await first.page.getByTestId('teaching-book-chapter-title').fill('函数核心概念');
  await first.page.getByTestId('teaching-book-chapter-objectives').fill('理解斜率\n解释变化率');
  await first.page.getByTestId('teaching-book-chapter-create').click();
  await first.page.waitForFunction(async (bookId) => (await window.omniEdu.getTeachingBook(bookId))?.chapters.length === 1, teachingBookFixture.id);
  let teachingBookDetail = await first.page.evaluate((bookId) => window.omniEdu.getTeachingBook(bookId), teachingBookFixture.id);
  const teachingChapterFixture = teachingBookDetail.chapters[0];

  await first.page.getByTestId('teaching-book-page-chapter').selectOption(teachingChapterFixture.id);
  await first.page.getByTestId('teaching-book-page-title').fill('斜率与变化率');
  await first.page.getByTestId('teaching-book-page-create').click();
  await first.page.waitForFunction(async (bookId) => (await window.omniEdu.getTeachingBook(bookId))?.pages.length === 1, teachingBookFixture.id);
  teachingBookDetail = await first.page.evaluate((bookId) => window.omniEdu.getTeachingBook(bookId), teachingBookFixture.id);
  const teachingPageFixture = teachingBookDetail.pages[0];

  const teachingSourceRef = 'frontend-manual-source-7f4c2a91';
  await first.page.getByTestId('teaching-book-source-ref').fill(teachingSourceRef);
  await first.page.getByTestId('teaching-book-source-title').fill('教师手工来源');
  await first.page.getByTestId('teaching-book-source-snippet').fill('斜率表示单位横向变化对应的纵向变化。');
  await first.page.getByTestId('teaching-book-source-add').click();
  await first.page.waitForFunction(async ({ bookId, sourceRef }) => (await window.omniEdu.getTeachingBook(bookId))?.sources.some((source) => source.ref === sourceRef), { bookId: teachingBookFixture.id, sourceRef: teachingSourceRef });

  await first.page.getByTestId('teaching-book-block-page').selectOption(teachingPageFixture.id);
  await first.page.getByTestId('teaching-book-block-title').fill('斜率定义');
  await first.page.getByTestId('teaching-book-block-text').fill('斜率表示纵向变化量与横向变化量之比。');
  await first.page.locator('.teaching-book-blocks label').filter({ hasText: '来源' }).locator('select').selectOption(teachingSourceRef);
  await first.page.getByTestId('teaching-book-block-save').click();
  await first.page.waitForFunction(async (bookId) => (await window.omniEdu.getTeachingBook(bookId))?.blocks.length === 1, teachingBookFixture.id);
  teachingBookDetail = await first.page.evaluate((bookId) => window.omniEdu.getTeachingBook(bookId), teachingBookFixture.id);
  const teachingBlockFixture = teachingBookDetail.blocks[0];
  assert.equal(teachingBlockFixture.sourceAnchors[0]?.ref, teachingSourceRef, 'block should retain the selected source anchor');
  await first.page.getByTestId('teaching-book-preview').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('teaching-book-preview').textContent(), /斜率表示/, 'compiled preview should show persisted block content');
  assert.match(await first.page.getByTestId('teaching-book-preview-meta').textContent(), /writesFile=false/, 'preview must remain read-only');

  await first.page.getByTestId(`teaching-book-block-edit-${teachingBlockFixture.id}`).click();
  await first.page.getByTestId('teaching-book-patch-title').fill('斜率定义（候选修订）');
  await first.page.getByTestId('teaching-book-patch-text').fill('候选内容：斜率刻画两个变量的变化关系。');
  await first.page.getByTestId('teaching-book-patch-reason').fill('补充教学语言');
  await first.page.getByTestId('teaching-book-patch-propose').click();
  await first.page.waitForFunction(async (bookId) => (await window.omniEdu.listTeachingBookPatches(bookId)).some((patch) => patch.status === 'draft'), teachingBookFixture.id);
  const teachingPatchFixture = (await first.page.evaluate((bookId) => window.omniEdu.listTeachingBookPatches(bookId), teachingBookFixture.id)).find((patch) => patch.status === 'draft');
  assert.ok(teachingPatchFixture, 'patch proposal click should persist a draft');
  const teachingBookBeforePatchApply = await first.page.evaluate((bookId) => window.omniEdu.getTeachingBook(bookId), teachingBookFixture.id);
  assert.equal(teachingBookBeforePatchApply.blocks[0].payload.text, '斜率表示纵向变化量与横向变化量之比。', 'draft patch must produce zero authored-content writes');
  assert.equal(teachingBookBeforePatchApply.blocks[0].version, 1, 'draft patch must not increment block version');

  await first.page.getByTestId(`teaching-book-patch-apply-${teachingPatchFixture.id}`).click();
  await first.page.waitForFunction(async ({ bookId, blockId }) => (await window.omniEdu.getTeachingBook(bookId))?.blocks.find((block) => block.id === blockId)?.version === 2, { bookId: teachingBookFixture.id, blockId: teachingBlockFixture.id });
  const teachingBookAfterPatchApply = await first.page.evaluate((bookId) => window.omniEdu.getTeachingBook(bookId), teachingBookFixture.id);
  assert.match(teachingBookAfterPatchApply.blocks[0].payload.text, /候选内容/, 'teacher apply click should persist the candidate patch');
  await first.page.getByTestId(`teaching-book-patch-undo-${teachingPatchFixture.id}`).click();
  await first.page.waitForFunction(async ({ bookId, blockId }) => (await window.omniEdu.getTeachingBook(bookId))?.blocks.find((block) => block.id === blockId)?.version === 3, { bookId: teachingBookFixture.id, blockId: teachingBlockFixture.id });
  const teachingBookAfterPatchUndo = await first.page.evaluate((bookId) => window.omniEdu.getTeachingBook(bookId), teachingBookFixture.id);
  assert.equal(teachingBookAfterPatchUndo.blocks[0].payload.text, '斜率表示纵向变化量与横向变化量之比。', 'undo click should restore the original content with a new version');

  await first.page.getByTestId(`teaching-book-block-edit-${teachingBlockFixture.id}`).click();
  await first.page.getByTestId('teaching-book-selection-start').fill('0');
  await first.page.getByTestId('teaching-book-selection-end').fill('2');
  await first.page.getByTestId('teaching-book-selection-replacement').fill('斜率（坡度）');
  await first.page.getByTestId('teaching-book-selection-reason').fill('补充同义教学术语');
  assert.match(await first.page.getByTestId('teaching-book-selection-preview').textContent(), /斜率/, 'selection preview should derive exact text from current persisted payload');
  await first.page.getByTestId('teaching-book-selection-propose').click();
  await first.page.waitForFunction(async (bookId) => (await window.omniEdu.listTeachingBookPatches(bookId)).some((patch) => patch.operation === 'replace_selection' && patch.status === 'draft'), teachingBookFixture.id);
  const teachingSelectionPatchFixture = (await first.page.evaluate((bookId) => window.omniEdu.listTeachingBookPatches(bookId), teachingBookFixture.id)).find((patch) => patch.operation === 'replace_selection' && patch.status === 'draft');
  assert.ok(teachingSelectionPatchFixture, 'selection patch click should persist a reviewable draft');
  const teachingBookBeforeSelectionApply = await first.page.evaluate((bookId) => window.omniEdu.getTeachingBook(bookId), teachingBookFixture.id);
  assert.equal(teachingBookBeforeSelectionApply.blocks[0].version, 3, 'selection patch draft must preserve the current block version');
  await first.page.getByTestId(`teaching-book-patch-apply-${teachingSelectionPatchFixture.id}`).click();
  await first.page.waitForFunction(async ({ bookId, blockId }) => (await window.omniEdu.getTeachingBook(bookId))?.blocks.find((block) => block.id === blockId)?.version === 4, { bookId: teachingBookFixture.id, blockId: teachingBlockFixture.id });
  assert.match((await first.page.evaluate((bookId) => window.omniEdu.getTeachingBook(bookId), teachingBookFixture.id)).blocks[0].payload.text, /坡度/, 'selection patch apply should replace only the exact selected range');
  await first.page.getByTestId(`teaching-book-patch-undo-${teachingSelectionPatchFixture.id}`).click();
  await first.page.waitForFunction(async ({ bookId, blockId }) => (await window.omniEdu.getTeachingBook(bookId))?.blocks.find((block) => block.id === blockId)?.version === 5, { bookId: teachingBookFixture.id, blockId: teachingBlockFixture.id });

  await first.page.getByTestId(`teaching-book-block-edit-${teachingBlockFixture.id}`).click();
  await first.page.getByTestId('teaching-book-block-title').fill('斜率定义（教师定稿）');
  await first.page.getByTestId('teaching-book-block-text').fill('斜率表示纵向变化量与横向变化量之比，并可解释变化快慢。');
  await first.page.getByTestId('teaching-book-block-save').click();
  await first.page.waitForFunction(async ({ bookId, blockId }) => (await window.omniEdu.getTeachingBook(bookId))?.blocks.find((block) => block.id === blockId)?.version === 6, { bookId: teachingBookFixture.id, blockId: teachingBlockFixture.id });
  await first.page.waitForFunction(() => document.querySelector('[data-testid="teaching-book-success"]')?.textContent?.includes('内容块已按版本锁更新'));
  assert.match((await first.page.evaluate((bookId) => window.omniEdu.getTeachingBook(bookId), teachingBookFixture.id)).blocks[0].payload.text, /变化快慢/, 'direct teacher edit should use optimistic versioning and persist readback');

  await first.page.waitForFunction(() => !(document.querySelector('[data-testid="teaching-book-export"]'))?.disabled);
  await first.page.getByTestId('teaching-book-export').click();
  await first.page.waitForFunction(() => Boolean(document.querySelector('[data-testid="teaching-book-success"]')?.textContent?.includes('讲义已导出') || document.querySelector('[data-testid="teaching-book-error"]')));
  const teachingBookExportError = await first.page.getByTestId('teaching-book-error').textContent().catch(() => '');
  assert.equal(teachingBookExportError, '', `teaching book export UI should not fail: ${teachingBookExportError}`);
  assert.match(await first.page.getByTestId('teaching-book-success').textContent(), /讲义已导出/, 'export click should render the persisted artifact path');
  const teachingBookArtifactReadback = await first.page.evaluate(async (artifactId) => {
    const direct = await window.omniEdu.getDocumentArtifact(artifactId);
    const artifacts = await window.omniEdu.listDocumentArtifacts();
    return { direct, artifacts, requestedId: artifactId };
  }, `book_${teachingBookFixture.id.slice(-12)}`);
  const teachingBookArtifact = teachingBookArtifactReadback.direct ?? teachingBookArtifactReadback.artifacts.find((artifact) => artifact.id === teachingBookArtifactReadback.requestedId) ?? null;
  assert.ok(teachingBookArtifact, `teaching book export should be readable after exported status: ${JSON.stringify(teachingBookArtifactReadback)}`);
  assert.ok(teachingBookArtifact.contentHash, 'teaching book export should persist SHA-256');
  assert.ok(existsSync(teachingBookArtifact.filePath), 'teaching book export should create a real Markdown file');
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-teaching-book-1366x768.png'), fullPage: true });
  await first.page.setViewportSize({ width: 1920, height: 1080 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-teaching-book-1920x1080.png'), fullPage: true });

  await first.page.getByTestId('teaching-book-health-refresh').click();
  await first.page.waitForFunction(async (bookId) => (await window.omniEdu.getTeachingBookHealth(bookId))?.status === 'healthy', teachingBookFixture.id);
  assert.match(await first.page.getByTestId('teaching-book-health').textContent(), /healthy/, 'manual source health should render truthfully');
  await first.page.getByTestId(`teaching-book-page-regenerate-${teachingPageFixture.id}`).click();
  await first.page.waitForFunction(async (bookId) => (await window.omniEdu.getTeachingBook(bookId))?.pages[0]?.version === 2, teachingBookFixture.id);
  await first.page.getByTestId(`teaching-book-block-regenerate-${teachingBlockFixture.id}`).click();
  await first.page.waitForFunction(async (bookId) => (await window.omniEdu.getTeachingBook(bookId))?.blocks[0]?.version === 7, teachingBookFixture.id);
  await first.page.waitForFunction(() => document.querySelector('[data-testid="teaching-book-success"]')?.textContent?.includes('内容块已标记为 pending'));
  const teachingBookPending = await first.page.evaluate((bookId) => window.omniEdu.getTeachingBook(bookId), teachingBookFixture.id);
  assert.equal(teachingBookPending.pages[0].status, 'pending', 'page regenerate click must expose pending instead of fake generated content');
  assert.equal(teachingBookPending.blocks[0].status, 'pending', 'block regenerate click must expose pending instead of fake generated content');

  await first.page.getByTestId('teaching-book-new').click();
  await first.page.getByTestId('teaching-book-title').fill('待归档讲义前端验收');
  await first.page.getByTestId('teaching-book-create').click();
  await first.page.waitForFunction(async () => (await window.omniEdu.listTeachingBooks()).some((book) => book.title === '待归档讲义前端验收'));
  const archivedTeachingBookFixture = (await first.page.evaluate(() => window.omniEdu.listTeachingBooks())).find((book) => book.title === '待归档讲义前端验收');
  await first.page.getByTestId('teaching-book-archive').click();
  await first.page.getByTestId('teaching-book-archived').waitFor({ state: 'visible' });
  const archivedTeachingBooks = await first.page.evaluate(() => window.omniEdu.listTeachingBooks(true));
  assert.ok(archivedTeachingBooks.find((book) => book.id === archivedTeachingBookFixture.id)?.deletedAt, 'archive click should persist deletedAt');
  assert.equal(await first.page.getByTestId('teaching-book-archived').getByRole('button').count(), 0, 'archived view must not fake a restore operation absent from preload');

  // AI observability: create a run containing a unique raw prompt, then prove
  // that the renderer exposes only the bounded trace projection. The report is
  // generated from a real UI click and read back from SQLite before and after
  // an Electron restart.
  const observabilityRawPrompt = 'OBSERVABILITY_RAW_PROMPT_MUST_NOT_RENDER_7f4c2a91';
  const observabilityTurn = await first.page.evaluate((prompt) => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-observability-sensitive-prompt',
    capability: 'chat',
    prompt,
    context: { language: 'zh', dryRun: true },
    budgets: { maxEvents: 32, maxWallMs: 120000 },
  }), observabilityRawPrompt);
  assert.equal(observabilityTurn.ok, true, 'observability fixture run should be accepted');
  const observabilityRun = await waitForRun(first.page, observabilityTurn.result?.runId, 12000);
  assert.equal(observabilityRun?.status, 'succeeded', 'observability fixture run should complete');

  await first.page.setViewportSize({ width: 1366, height: 768 });
  await first.page.getByTestId('nav-analytics').click();
  await first.page.getByTestId('ai-observability-workspace').waitFor({ state: 'visible' });
  await first.page.getByTestId('ai-observability-summary').waitFor({ state: 'visible' });
  await first.page.getByTestId(`ai-run-item-${observabilityRun.id}`).click();
  await first.page.getByTestId('ai-run-trace-boundary').waitFor({ state: 'visible' });
  const traceBoundary = await first.page.getByTestId('ai-run-trace-boundary').textContent();
  assert.match(traceBoundary ?? '', /bounded=true/, 'run inspector must expose a bounded trace');
  assert.match(traceBoundary ?? '', /rawPromptIncluded=false/, 'run inspector must exclude raw prompts');
  assert.match(traceBoundary ?? '', /hiddenReasoningIncluded=false/, 'run inspector must exclude hidden reasoning');
  assert.equal((await first.page.locator('body').textContent())?.includes(observabilityRawPrompt), false, 'raw prompt must not render anywhere in analytics');

  const observabilityReportTitle = '前端运行观测验收报告';
  await first.page.getByTestId('ai-regression-title').fill(observabilityReportTitle);
  await first.page.getByTestId('ai-regression-create').click();
  await first.page.getByTestId('ai-observability-success').waitFor({ state: 'visible' });
  const observabilityReport = (await first.page.evaluate(() => window.omniEdu.listAiRegressionReports(20)))
    .find((item) => item.title === '前端运行观测验收报告');
  assert.ok(observabilityReport, 'regression report click should persist a SQLite report');
  assert.ok(observabilityReport.gates.length > 0, 'regression report should contain computed gates');
  await first.page.getByTestId(`ai-regression-item-${observabilityReport.id}`).waitFor({ state: 'visible' });
  assert.ok(await first.page.locator('[data-testid="ai-regression-gates"] article').count() > 0, 'computed report gates should render');
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-ai-observability-1366x768.png'), fullPage: true });
  await first.page.setViewportSize({ width: 1920, height: 1080 });
  await first.page.getByTestId('ai-observability-workspace').waitFor({ state: 'visible' });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-ai-observability-1920x1080.png'), fullPage: true });

  // Inspectable memory governance: start from the real Memory navigation and
  // use the existing run/event evidence. Drafts must be zero-write until a
  // teacher clicks adopt; all mutations are verified through preload/SQLite.
  await first.page.setViewportSize({ width: 1366, height: 768 });
  await first.page.getByTestId('nav-memory').click();
  await first.page.getByTestId('memory-governance-workspace').waitFor({ state: 'visible' });
  await first.page.getByTestId('memory-l2-empty').waitFor({ state: 'visible' });
  const l2CountBeforeDraft = (await first.page.evaluate(() => window.omniEdu.getAiMemoryDocument('chat')))?.entries.length ?? 0;
  await first.page.getByTestId('memory-draft-l2').click();
  await first.page.getByTestId('memory-l2-drafts').waitFor({ state: 'visible' });
  assert.ok(await first.page.locator('[data-testid^="memory-adopt-l2-"]').count() >= 2, 'real run should provide multiple bounded L2 candidates');
  assert.equal((await first.page.evaluate(() => window.omniEdu.getAiMemoryDocument('chat')))?.entries.length ?? 0, l2CountBeforeDraft, 'L2 candidate generation must be zero-write');

  await first.page.getByTestId('memory-adopt-l2-0').click();
  await first.page.waitForFunction(async () => (await window.omniEdu.getAiMemoryDocument('chat'))?.entries.length === 1);
  let l2Detail = await first.page.evaluate(() => window.omniEdu.getAiMemoryDocument('chat'));
  const retainedL2Id = l2Detail.entries[0].id;
  await first.page.getByTestId('memory-adopt-l2-0').click();
  await first.page.waitForFunction(async () => (await window.omniEdu.getAiMemoryDocument('chat'))?.entries.length === 2);
  l2Detail = await first.page.evaluate(() => window.omniEdu.getAiMemoryDocument('chat'));
  const deletedL2Id = l2Detail.entries.find((entry) => entry.id !== retainedL2Id).id;

  await first.page.getByTestId(`memory-l2-text-${retainedL2Id}`).fill('教师修订：该运行证据用于记忆治理前端验收。');
  await first.page.getByTestId(`memory-save-l2-${retainedL2Id}`).click();
  await first.page.waitForFunction(async (entryId) => (await window.omniEdu.getAiMemoryDocument('chat'))?.entries.find((entry) => entry.id === entryId)?.version === 2, retainedL2Id);
  assert.match((await first.page.evaluate(() => window.omniEdu.getAiMemoryDocument('chat'))).entries.find((entry) => entry.id === retainedL2Id).text, /教师修订/, 'L2 edit click should persist teacher text');

  const staleL2 = (await first.page.evaluate(() => window.omniEdu.getAiMemoryDocument('chat'))).entries.find((entry) => entry.id === retainedL2Id);
  await first.page.evaluate(({ entryId, version }) => window.omniEdu.updateAiMemoryEntry(entryId, { version, text: '另一窗口已更新的 L2 内容。' }), { entryId: retainedL2Id, version: staleL2.version });
  await first.page.getByTestId(`memory-l2-text-${retainedL2Id}`).fill('不应覆盖并发更新');
  await first.page.getByTestId(`memory-save-l2-${retainedL2Id}`).click();
  await first.page.getByTestId('memory-error').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('memory-error').textContent(), /版本冲突/, 'stale L2 edit should fail closed with a visible conflict');
  assert.ok(await first.page.getByTestId(`memory-l2-entry-${retainedL2Id}`).isVisible(), 'version conflict must preserve the last successful record list');
  assert.equal((await first.page.evaluate(() => window.omniEdu.getAiMemoryDocument('chat'))).entries.find((entry) => entry.id === retainedL2Id).text, '另一窗口已更新的 L2 内容。', 'stale L2 UI must not overwrite concurrent data');

  await first.page.getByTestId(`memory-revisions-l2-${retainedL2Id}`).click();
  await first.page.getByTestId(`memory-revision-list-${retainedL2Id}`).waitFor({ state: 'visible' });
  assert.ok(await first.page.getByTestId(`memory-revision-list-${retainedL2Id}`).locator('div').count() >= 3, 'L2 revision history should expose create and edits');
  await first.page.getByTestId(`memory-disable-l2-${retainedL2Id}`).click();
  await first.page.waitForFunction(async (entryId) => (await window.omniEdu.getAiMemoryDocument('chat'))?.entries.find((entry) => entry.id === entryId)?.status === 'disabled', retainedL2Id);
  await first.page.getByTestId(`memory-restore-l2-${retainedL2Id}`).click();
  await first.page.waitForFunction(async (entryId) => (await window.omniEdu.getAiMemoryDocument('chat'))?.entries.find((entry) => entry.id === entryId)?.status === 'active', retainedL2Id);
  await first.page.getByTestId(`memory-delete-l2-${deletedL2Id}`).click();
  await first.page.waitForFunction(async (entryId) => (await window.omniEdu.getAiMemoryDocument('chat'))?.entries.find((entry) => entry.id === entryId)?.status === 'deleted', deletedL2Id);
  assert.equal(await first.page.getByTestId(`memory-l2-entry-${deletedL2Id}`).getByRole('button', { name: '恢复' }).count(), 0, 'deleted L2 UI must not fake a restore semantic absent from the delete contract');

  const l3CountBeforeDraft = (await first.page.evaluate(() => window.omniEdu.getAiMemoryL3Document('profile')))?.entries.length ?? 0;
  await first.page.getByTestId('memory-draft-l3').click();
  await first.page.getByTestId('memory-l3-drafts').waitFor({ state: 'visible' });
  assert.equal((await first.page.evaluate(() => window.omniEdu.getAiMemoryL3Document('profile')))?.entries.length ?? 0, l3CountBeforeDraft, 'L3 candidate generation must be zero-write');
  await first.page.getByTestId('memory-adopt-l3-0').click();
  await first.page.waitForFunction(async () => (await window.omniEdu.getAiMemoryL3Document('profile'))?.entries.length === 1);
  let l3Entry = (await first.page.evaluate(() => window.omniEdu.getAiMemoryL3Document('profile'))).entries[0];
  await first.page.getByTestId(`memory-l3-text-${l3Entry.id}`).fill('教师修订：跨表面学习者画像仅用于本地教学支持。');
  await first.page.getByTestId(`memory-save-l3-${l3Entry.id}`).click();
  await first.page.waitForFunction(async (entryId) => (await window.omniEdu.getAiMemoryL3Document('profile'))?.entries.find((entry) => entry.id === entryId)?.version === 2, l3Entry.id);
  const staleL3 = (await first.page.evaluate(() => window.omniEdu.getAiMemoryL3Document('profile'))).entries.find((entry) => entry.id === l3Entry.id);
  await first.page.evaluate(({ entryId, version }) => window.omniEdu.updateAiMemoryL3Entry(entryId, { version, text: '另一窗口已更新的跨表面学习者画像。' }), { entryId: l3Entry.id, version: staleL3.version });
  await first.page.getByTestId(`memory-l3-text-${l3Entry.id}`).fill('不应覆盖 L3 并发更新');
  await first.page.getByTestId(`memory-save-l3-${l3Entry.id}`).click();
  await first.page.getByTestId('memory-error').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('memory-error').textContent(), /版本冲突/, 'stale L3 edit should fail closed with a visible conflict');
  assert.ok(await first.page.getByTestId(`memory-l3-entry-${l3Entry.id}`).isVisible(), 'L3 version conflict must preserve the record list');
  assert.equal((await first.page.evaluate(() => window.omniEdu.getAiMemoryL3Document('profile'))).entries.find((entry) => entry.id === l3Entry.id).text, '另一窗口已更新的跨表面学习者画像。', 'stale L3 UI must not overwrite concurrent data');
  await first.page.getByTestId(`memory-disable-l3-${l3Entry.id}`).click();
  await first.page.waitForFunction(async (entryId) => (await window.omniEdu.getAiMemoryL3Document('profile'))?.entries.find((entry) => entry.id === entryId)?.status === 'disabled', l3Entry.id);
  await first.page.getByTestId(`memory-restore-l3-${l3Entry.id}`).click();
  await first.page.waitForFunction(async (entryId) => (await window.omniEdu.getAiMemoryL3Document('profile'))?.entries.find((entry) => entry.id === entryId)?.status === 'active', l3Entry.id);
  l3Entry = (await first.page.evaluate(() => window.omniEdu.getAiMemoryL3Document('profile'))).entries.find((entry) => entry.id === l3Entry.id);

  await first.page.getByTestId('memory-refresh').click();
  const memoryGraph = await first.page.evaluate(() => window.omniEdu.getAiMemoryEvidenceGraph(200));
  const memoryGovernance = await first.page.evaluate(() => window.omniEdu.getAiMemoryGovernanceReport());
  assert.equal(memoryGraph.bounded, true, 'memory evidence graph must remain bounded');
  assert.equal(memoryGraph.rawPromptIncluded, false, 'memory graph must exclude raw prompts');
  assert.equal(memoryGraph.hiddenReasoningIncluded, false, 'memory graph must exclude hidden reasoning');
  assert.ok(memoryGraph.nodes.some((node) => node.kind === 'l2_entry') && memoryGraph.nodes.some((node) => node.kind === 'l3_entry'), 'graph should connect active L2 and L3 entries');
  assert.equal(memoryGovernance.writableByAi, false, 'governance must keep formal memory teacher-writable only');
  assert.equal(memoryGovernance.deletedEntries, 1, 'governance should count the soft-deleted L2 entry');
  assert.equal(memoryGovernance.danglingEvidenceRefs, 0, 'accepted evidence references should remain resolvable');
  assert.equal((await first.page.locator('body').textContent())?.includes(observabilityRawPrompt), false, 'memory UI must not render the raw source prompt');
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-memory-governance-1366x768.png'), fullPage: true });
  await first.page.setViewportSize({ width: 1920, height: 1080 });
  await first.page.getByTestId('memory-governance-report').waitFor({ state: 'visible' });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-memory-governance-1920x1080.png'), fullPage: true });

  // Document export: attach real Markdown/PDF/DOCX artifacts to one persisted
  // conversation, reopen them in the UI and verify user-click -> preload ->
  // main -> file + SQLite. The empty artifact is an adversarial zero-write
  // failure path and must remain visible in the same panel.
  const artifactFixture = await first.page.evaluate(async (studentId) => {
    const detail = await window.omniEdu.createAiConversationSession({ title: '文档导出前端验收', studentId });
    const markdown = {
      id: 'artifact_frontend_export_smoke', title: '一次函数教学建议', type: 'Markdown', artifactType: 'markdown',
      fileName: 'frontend-export-smoke.md', mimeType: 'text/markdown', description: '前端点击导出的验收产物',
      content: '# 一次函数教学建议\n\n教师确认后使用。',
    };
    const pdf = {
      id: 'artifact_frontend_export_pdf', title: '一次函数阶段复盘', type: 'PDF', artifactType: 'pdf',
      fileName: '一次函数阶段复盘.pdf', mimeType: 'application/pdf', description: '包含中文教学事实的 PDF 验收产物',
      content: '# 一次函数阶段复盘\n\n## 教学事实\n- 小A 能识别斜率 k。\n- 小智 Unicode 验收：斜率 k 为正时函数递增。\n\n## 下一步\n- 比较 k > 0 与 k < 0。',
    };
    const docx = {
      id: 'artifact_frontend_export_docx', title: '一次函数超长教学记录', type: 'Word', artifactType: 'docx',
      fileName: '一次函数超长教学记录.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', description: '包含标题、列表、代码和超长中文正文的 DOCX 验收产物',
      content: ['# 一次函数超长教学记录', '', '## 教学事实', '- 小A 能识别斜率 k。', '', '## 教师行动', ...Array.from({ length: 360 }, (_, index) => `- 第 ${index + 1} 条 Unicode 教学记录：比较斜率符号并保留教师复核。`), '', '```text', 'y = kx + b', '```'].join('\n'),
    };
    const empty = {
      id: 'artifact_frontend_export_empty', title: '空正文失败样本', type: 'Word', artifactType: 'docx',
      fileName: '空正文失败样本.docx', mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', description: '用于验证失败提示和零写入', content: '',
    };
    await window.omniEdu.appendAiConversationMessage(detail.session.id, {
      role: 'assistant', content: '已生成可导出的 Markdown、PDF 和 Word 教学建议。', metadata: { ok: true, artifacts: [markdown, pdf, docx, empty] },
    });
    return {
      sessionId: detail.session.id,
      markdownId: markdown.id,
      pdfId: pdf.id,
      docxId: docx.id,
      emptyId: empty.id,
      pdfContent: pdf.content,
      docxContent: docx.content,
    };
  }, knownStudent.id);
  await first.page.reload();
  await first.page.waitForLoadState('domcontentloaded');
  await first.page.getByTestId('nav-ai').click();
  await first.page.locator(`[data-session-id="${artifactFixture.sessionId}"]`).click();
  await first.page.getByTestId(`ai-artifact-open-${artifactFixture.markdownId}`).click();
  await first.page.getByTestId('ai-artifact-export').click();
  await first.page.getByTestId('ai-artifact-export-meta').waitFor({ state: 'visible' });
  const exportedArtifact = await first.page.evaluate((id) => window.omniEdu.getDocumentArtifact(id), artifactFixture.markdownId);
  assert.equal(exportedArtifact?.status, 'exported', 'artifact click should persist exported status');
  assert.ok(exportedArtifact?.contentHash, 'artifact export should persist SHA-256');
  assert.ok(existsSync(exportedArtifact.filePath), 'artifact export should create a real local file');

  await first.page.getByTestId(`ai-artifact-open-${artifactFixture.pdfId}`).click();
  await first.page.getByTestId('ai-artifact-export').click();
  await first.page.getByTestId('ai-artifact-export-meta').waitFor({ state: 'visible' });
  const exportedPdf = await first.page.evaluate((id) => window.omniEdu.getDocumentArtifact(id), artifactFixture.pdfId);
  assert.equal(exportedPdf?.type, 'pdf', 'PDF click must preserve the requested artifact type');
  assert.equal(exportedPdf?.mimeType, 'application/pdf', 'PDF click must persist its MIME type');
  assert.equal(exportedPdf?.contentMd, artifactFixture.pdfContent, 'PDF SQLite readback must preserve Unicode source Markdown');
  assert.match(exportedPdf?.contentHash ?? '', /^[a-f0-9]{64}$/, 'PDF export must persist a real SHA-256');
  assert.ok(existsSync(exportedPdf.filePath), 'PDF click must create a real file');
  const pdfBytes = readFileSync(exportedPdf.filePath);
  assert.equal(pdfBytes.subarray(0, 5).toString('utf8'), '%PDF-', 'PDF file must have a real PDF signature');
  assert.ok(pdfBytes.includes(Buffer.from('/Subtype /Type0')), 'PDF must use a Unicode CID font');
  assert.ok(pdfBytes.includes(Buffer.from('<FEFF')), 'PDF must encode CJK text as UTF-16BE');
  assert.equal(pdfBytes.includes(Buffer.from('(?')), false, 'PDF must not replace CJK text with question marks');
  await first.page.setViewportSize({ width: 1366, height: 768 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-ai-artifact-pdf-1366x768.png') });

  await first.page.getByTestId(`ai-artifact-open-${artifactFixture.docxId}`).click();
  await first.page.getByTestId('ai-artifact-export').click();
  await first.page.getByTestId('ai-artifact-export-meta').waitFor({ state: 'visible' });
  const exportedDocx = await first.page.evaluate((id) => window.omniEdu.getDocumentArtifact(id), artifactFixture.docxId);
  assert.equal(exportedDocx?.type, 'docx', 'DOCX click must preserve the requested artifact type');
  assert.equal(exportedDocx?.mimeType, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'DOCX click must persist its MIME type');
  assert.equal(exportedDocx?.contentMd, artifactFixture.docxContent, 'DOCX SQLite readback must preserve the complete long Unicode Markdown');
  assert.ok(exportedDocx?.contentMd.length > 10_000, 'DOCX adversarial fixture must remain genuinely long');
  assert.match(exportedDocx?.contentHash ?? '', /^[a-f0-9]{64}$/, 'DOCX export must persist a real SHA-256');
  assert.ok(existsSync(exportedDocx.filePath), 'DOCX click must create a real file');
  const docxBytes = readFileSync(exportedDocx.filePath);
  assert.equal(docxBytes.subarray(0, 2).toString('utf8'), 'PK', 'DOCX file must have a real ZIP signature');
  assert.ok(docxBytes.includes(Buffer.from('word/document.xml')), 'DOCX must contain document.xml');
  assert.ok(docxBytes.includes(Buffer.from('word/styles.xml')), 'DOCX must contain styles.xml');
  assert.ok(docxBytes.includes(Buffer.from('<w:pStyle w:val="Heading1"/>')), 'DOCX must preserve heading styles');
  assert.ok(docxBytes.includes(Buffer.from('第 360 条 Unicode 教学记录', 'utf8')), 'DOCX must preserve tail Unicode content instead of truncating it');
  await first.page.setViewportSize({ width: 1920, height: 1080 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-ai-artifact-docx-1920x1080.png') });

  await first.page.getByTestId(`ai-artifact-open-${artifactFixture.emptyId}`).click();
  await first.page.getByTestId('ai-artifact-export').click();
  await first.page.getByTestId('ai-artifact-export-error').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('ai-artifact-export-error').textContent(), /正文为空/, 'empty document must show an actionable panel-local failure');
  assert.equal(await first.page.evaluate((id) => window.omniEdu.getDocumentArtifact(id), artifactFixture.emptyId), null, 'empty document failure must write no artifact row');
  await first.page.setViewportSize({ width: 1366, height: 768 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-ai-artifact-error-1366x768.png') });

  const deepResearchTurn = await first.page.evaluate(() => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-deep-research-dry-run',
    capability: 'deep_research',
    prompt: '研究分数教学的课堂提纲',
    context: { language: 'zh', dryRun: true, configOverrides: { mode: 'notes', depth: 'quick' } },
    budgets: { maxEvents: 96, maxWallMs: 120000 },
  }));
  assert.equal(deepResearchTurn.ok, true, 'deep_research dry-run should be accepted');
  const deepResearchRun = await waitForRun(first.page, deepResearchTurn.result?.runId, 12000);
  assert.equal(deepResearchRun?.status, 'succeeded', 'deep_research dry-run should complete through upstream capability');
  const deepResearchEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), deepResearchTurn.result?.runId);
  assert.ok(deepResearchEvents.some((event) => event.phase === 'finalize' && event.outputSummary?.capability === 'deep_research' && event.outputSummary?.research_config?.depth === 'quick'), 'deep_research result should expose bounded research config');
  const visualizeTurn = await first.page.evaluate(() => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-visualize-dry-run',
    capability: 'visualize',
    prompt: '可视化分数关系',
    context: { language: 'zh', dryRun: true, configOverrides: { render_mode: 'mermaid' } },
    budgets: { maxEvents: 96, maxWallMs: 120000 },
  }));
  assert.equal(visualizeTurn.ok, true, 'visualize dry-run should be accepted');
  const visualizeRun = await waitForRun(first.page, visualizeTurn.result?.runId, 12000);
  assert.equal(visualizeRun?.status, 'succeeded', 'visualize dry-run should complete through upstream capability');
  const visualizeEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), visualizeTurn.result?.runId);
  assert.ok(visualizeEvents.some((event) => event.phase === 'finalize' && event.outputSummary?.capability === 'visualize' && event.outputSummary?.render_type === 'mermaid'), 'visualize result should expose safe mermaid render type');
  const invalidDeepQuestionTurn = await first.page.evaluate(() => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-deep-question-invalid-config',
    capability: 'deep_question',
    prompt: '生成练习题',
    context: { language: 'zh', dryRun: true, configOverrides: { mode: 'custom', topic: '分数加法', num_questions: 'not-a-number' } },
    budgets: { maxEvents: 48, maxWallMs: 120000 },
  }));
  assert.equal(invalidDeepQuestionTurn.ok, true, 'invalid deep_question config should be accepted then fail closed');
  const invalidDeepQuestionRun = await waitForRun(first.page, invalidDeepQuestionTurn.result?.runId, 8000);
  assert.equal(invalidDeepQuestionRun?.status, 'failed', 'invalid deep_question config must fail the run');
  const invalidDeepQuestionEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), invalidDeepQuestionTurn.result?.runId);
  assert.ok(invalidDeepQuestionEvents.some((event) => event.phase === 'guardrail' && event.status === 'failed'), 'invalid deep_question config must persist a failed guardrail');
  const modelProxyTurn = await first.page.evaluate(() => window.omniEdu.deepTutorStartTurn({
    turnId: 'electron-model-proxy-missing-credential',
    capability: 'chat',
    prompt: '请用一句话确认真实模型边界。',
    context: { language: 'zh', modelProxy: 'deepseek' },
    budgets: { maxEvents: 24, maxWallMs: 120000 },
  }));
  assert.equal(modelProxyTurn.ok, true, 'ModelProxy turn should be accepted before provider credential check');
  await first.page.waitForTimeout(800);
  const modelProxyRunId = modelProxyTurn.result?.runId;
  const modelProxyRun = await waitForRun(first.page, modelProxyRunId);
  assert.ok(modelProxyRun, 'ModelProxy run should be persisted in SQLite');
  assert.equal(modelProxyRun.status, 'failed', 'missing model credential should fail closed in Electron main');
  const modelProxyEvents = await first.page.evaluate((runId) => window.omniEdu.listAiAgentEvents(runId), modelProxyRunId);
  assert.ok(modelProxyEvents.some((event) => event.phase === 'guardrail' || event.phase === 'error'), 'missing credential failure event should be persisted');
  assert.ok(modelProxyEvents.every((event) => !String(event.detail ?? '').includes('sk-')), 'provider credential must not enter model proxy evidence');
  const consoleEntryResult = await first.page.evaluate(() => window.omniEdu.runDeepTutorConsole({
    prompt: '请用一句话确认普通问答入口已切换到 DeepTutor。',
    sessionId: '',
  }));
  assert.equal(consoleEntryResult.ok, false, 'console entry should fail closed without a provider credential');
  assert.match(consoleEntryResult.errorMessage ?? '', /API Key|凭证|模型/i, 'console entry should expose an actionable credential error');
  assert.ok(consoleEntryResult.harness?.agentRunId, 'console entry should return its persisted run id');
  await first.page.evaluate(() => window.omniEdu.deepTutorStop());

  const knowledgeFile = join(dataRoot, 'teacher-note.md');
  writeFileSync(
    knowledgeFile,
    [
      '# 一次函数讲义',
      '',
      'k 值为正时，函数图像从左下到右上；k 值为负时，函数图像从左上到右下。',
      '',
      '## 易错点',
      '',
      '学生常把截距 b 和斜率 k 的图像影响混在一起，需要用图像变化分步训练。',
    ].join('\n'),
    'utf8',
  );
  const knowledgeImport = await first.page.evaluate((filePath) => window.omniEdu.importKnowledgeResourcePaths([filePath]), knowledgeFile);
  assert.equal(knowledgeImport.status, 'succeeded', 'knowledge import should succeed');
  assert.equal(knowledgeImport.overview.counts.resources, 1, 'one knowledge resource should be imported');
  assert.ok(knowledgeImport.overview.counts.chunks >= 1, 'knowledge chunks should be created');
  assert.ok(knowledgeImport.overview.counts.nodes >= 2, 'knowledge graph nodes should be created');
  assert.ok(knowledgeImport.overview.counts.edges >= 1, 'knowledge graph edges should be created');

  await first.page.getByTestId('nav-students').click();
  await first.page.getByTestId('student-create').click();
  await first.page.getByTestId('student-profile-form').waitFor({ state: 'visible' });
  await first.page.getByTestId('student-form-display-name').fill('档案生命周期验收学生');
  await first.page.getByTestId('student-form-real-name').fill('本地真实姓名仅用于导出验收');
  await first.page.getByTestId('student-form-grade').fill('八年级');
  await first.page.getByTestId('student-form-save').click();
  await first.page.getByTestId('student-lifecycle-feedback-success').waitFor({ state: 'visible' });
  const lifecycleStudentCreated = (await first.page.evaluate(() => window.omniEdu.listStudents('档案生命周期验收学生')))[0];
  assert.ok(lifecycleStudentCreated?.id, 'student created from renderer form must be readable from SQLite');
  assert.equal(lifecycleStudentCreated.grade, '八年级');
  await first.page.evaluate((studentId) => window.omniEdu.createRecord({
    studentId,
    recordType: 'summary',
    subject: '数学',
    title: '档案导出记录',
    content: '该记录用于验证 metadata.json 的真实 SQLite readback。',
    tags: ['student-export-e2e'],
  }), lifecycleStudentCreated.id);

  await first.page.getByTestId('student-edit').click();
  await first.page.getByTestId('student-profile-form').waitFor({ state: 'visible' });
  await first.page.getByTestId('student-form-display-name').fill('档案生命周期验收学生-已编辑');
  await first.page.getByTestId('student-form-grade').fill('九年级');
  await first.page.getByTestId('student-form-save').click();
  await first.page.getByTestId('student-lifecycle-feedback-success').waitFor({ state: 'visible' });
  const lifecycleStudent = (await first.page.evaluate(() => window.omniEdu.listStudents('档案生命周期验收学生-已编辑')))[0];
  assert.equal(lifecycleStudent.id, lifecycleStudentCreated.id, 'editing must preserve the selected student identity');
  assert.equal(lifecycleStudent.grade, '九年级', 'renderer edit must persist through students:update');

  await first.page.getByTestId('student-open-folder').click();
  await first.page.getByTestId('student-lifecycle-feedback-success').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('student-lifecycle-feedback-success').textContent(), /已打开/, 'open-folder action must expose visible success feedback');

  await first.page.getByTestId('student-export').click();
  await first.page.getByTestId('student-export-path').waitFor({ state: 'visible' });
  const exportedStudentPath = (await first.page.getByTestId('student-export-path').textContent())?.trim() ?? '';
  assert.ok(exportedStudentPath.startsWith(studentExportRoot), 'student export must stay inside the controlled destination selected by the user');
  const studentMetadataPath = join(exportedStudentPath, 'metadata.json');
  assert.ok(existsSync(studentMetadataPath), 'student export must create a real metadata.json file');
  const exportedStudentMetadata = JSON.parse(readFileSync(studentMetadataPath, 'utf8'));
  assert.equal(exportedStudentMetadata.student.id, lifecycleStudent.id, 'export metadata must bind to the selected student');
  assert.equal(exportedStudentMetadata.student.displayName, lifecycleStudent.displayName, 'export metadata must contain the edited SQLite profile');
  assert.ok(exportedStudentMetadata.records.some((record) => record.title === '档案导出记录'), 'export metadata must contain real SQLite learning records');
  const exportEntriesBeforeCancel = readdirSync(studentExportRoot).sort();
  await first.page.getByTestId('student-export').click();
  await first.page.getByTestId('student-lifecycle-feedback-neutral').waitFor({ state: 'visible' });
  assert.deepEqual(readdirSync(studentExportRoot).sort(), exportEntriesBeforeCancel, 'cancelled export must not create another directory or file');

  await first.page.getByTestId('student-archive').click();
  await first.page.getByTestId('student-archive-confirmation').waitFor({ state: 'visible' });
  await first.page.getByTestId('student-archive-cancel').click();
  assert.equal((await first.page.evaluate((id) => window.omniEdu.listStudents('').then((items) => items.find((item) => item.id === id)?.status), lifecycleStudent.id)), 'active', 'archive cancellation must perform zero writes');
  await first.page.getByTestId('student-archive').click();
  await first.page.getByTestId('student-archive-confirm').click();
  await first.page.getByTestId(`student-row-${lifecycleStudent.id}`).waitFor({ state: 'visible' });
  assert.equal((await first.page.evaluate((id) => window.omniEdu.listStudents('').then((items) => items.find((item) => item.id === id)?.status), lifecycleStudent.id)), 'archived', 'confirmed archive must persist status=archived');
  await first.page.getByTestId(`student-row-${lifecycleStudent.id}`).click();
  await first.page.getByTestId('student-status-archived').waitFor({ state: 'visible' });
  assert.equal(await first.page.getByTestId('student-edit').isDisabled(), true, 'archived profile must disable editing');
  assert.equal(await first.page.getByTestId('student-archive').isDisabled(), true, 'archived profile must not offer repeated archive writes');
  assert.match(await first.page.getByTestId(`student-row-status-${lifecycleStudent.id}`).textContent(), /已归档/);
  await first.page.setViewportSize({ width: 1366, height: 768 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-student-lifecycle-1366x768.png'), fullPage: true });
  await first.page.setViewportSize({ width: 1920, height: 1080 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-student-lifecycle-1920x1080.png'), fullPage: true });

  // Quality review uses the existing aiObservability typed preload/main/SQLite
  // contract. A model-grade fixture is inserted through that real contract
  // because grader ingestion is a harness operation, not a teacher form.
  const modelGradeFixture = await first.page.evaluate(() => window.omniEdu.createAiModelGrade({
    sampleId: 'electron_quality_model_grade',
    runId: '',
    prompt: '请根据本地证据分析学生近期错题。',
    answerMarkdown: '基于三条本地记录，先核对符号变化。',
    route: 'student_diagnosis',
    subIntent: 'student_progress',
    targetGrade: '八年级',
    modelUnderReview: 'deepseek-v4-flash',
    graderMode: 'deterministic_proxy',
    promptVersion: 'electron-quality-v1',
    evidenceScore: 4,
    actionabilityScore: 4,
    safetyScore: 5,
    gradeAppropriatenessScore: 4,
    concisionScore: 4,
    teacherControlScore: 5,
    graderRationale: '确定性 fixture，只用于验证只读 UI 和 graderMode 边界。',
  }));

  await first.page.getByTestId('nav-settings').click();
  await first.page.getByTestId('ai-quality-review-workspace').waitFor({ state: 'visible' });
  await first.page.getByTestId('ai-quality-review-loading').waitFor({ state: 'hidden' });
  assert.match(await first.page.getByTestId('ai-quality-review-boundary').textContent(), /不把 proxy 冒充真实模型裁判/, 'quality UI must disclose deterministic proxy versus llm_judge');
  const qualityReviewCountBefore = (await first.page.evaluate(() => window.omniEdu.listAiUsabilityReviews(500))).length;
  await first.page.getByTestId('ai-quality-save').click();
  await first.page.getByTestId('ai-quality-review-error').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('ai-quality-review-error').textContent(), /sampleId/, 'blank quality review must fail locally');
  assert.equal((await first.page.evaluate(() => window.omniEdu.listAiUsabilityReviews(500))).length, qualityReviewCountBefore, 'blank quality review must perform zero SQLite writes');

  await first.page.getByTestId('ai-quality-csv-text').fill('sampleId,prompt,route,subIntent,teacherScore,needsRewrite,roundsToUseful,mainIssueCode\ninvalid_csv,请解释斜率,general_qa,concept_explanation,9,false,1,none');
  await first.page.getByTestId('ai-quality-import').click();
  await first.page.getByTestId('ai-quality-review-error').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('ai-quality-review-error').textContent(), /第 2 行无效.*未写入任何样本/s, 'invalid CSV must expose row-level zero-write feedback');
  assert.equal((await first.page.evaluate(() => window.omniEdu.listAiUsabilityReviews(500))).length, qualityReviewCountBefore, 'invalid CSV preflight must perform zero SQLite writes');

  await first.page.getByTestId('ai-quality-sample-id').fill('electron_quality_before');
  await first.page.getByTestId('ai-quality-prompt').fill('请直接判断小A最近错题原因。');
  await first.page.getByTestId('ai-quality-score').fill('2');
  await first.page.getByTestId('ai-quality-rounds').fill('4');
  await first.page.getByTestId('ai-quality-issue').fill('evidence_gap');
  await first.page.getByTestId('ai-quality-needs-rewrite').check();
  await first.page.getByTestId('ai-quality-note').fill('缺少本地记录证据，需要老师重写。');
  await first.page.getByTestId('ai-quality-save').click();
  await first.page.getByTestId('ai-quality-review-success').waitFor({ state: 'visible' });
  const qualityBeforeReview = (await first.page.evaluate(() => window.omniEdu.listAiUsabilityReviews(500))).find((review) => review.sampleId === 'electron_quality_before');
  assert.ok(qualityBeforeReview, 'teacher save click must persist an ai_usability_reviews row');
  assert.equal(qualityBeforeReview.teacherScore, 2, 'teacher score must round-trip through SQLite');
  assert.equal(qualityBeforeReview.needsRewrite, true, 'needsRewrite must round-trip through SQLite');
  await first.page.getByTestId(`ai-quality-review-${qualityBeforeReview.id}`).waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('ai-quality-review-summary').textContent(), /人工样本.*1/s, 'quality summary must refresh from SQLite after save');
  await first.page.getByTestId(`ai-quality-model-grade-${modelGradeFixture.id}`).waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId(`ai-quality-model-grade-${modelGradeFixture.id}`).textContent(), /deterministic_proxy/, 'model grade UI must show the truthful graderMode');
  await first.page.setViewportSize({ width: 1366, height: 768 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-ai-quality-review-1366x768.png'), fullPage: true });

  await first.page.getByTestId(`ai-quality-replay-${qualityBeforeReview.id}`).click();
  await first.page.getByTestId('ai-prompt-input').waitFor({ state: 'visible' });
  assert.equal(await first.page.getByTestId('ai-prompt-input').inputValue(), qualityBeforeReview.prompt, 'quality replay must place the selected prompt into the real AI input');
  await first.page.getByTestId('nav-settings').click();
  await first.page.getByTestId(`ai-quality-before-${qualityBeforeReview.id}`).waitFor({ state: 'visible' });
  await first.page.getByTestId(`ai-quality-before-${qualityBeforeReview.id}`).click();
  await first.page.getByTestId('ai-quality-selected-before').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('ai-quality-selected-before').textContent(), /electron_quality_before/, 'before selection must be visible beside the edit form');
  await first.page.getByTestId('ai-quality-score').fill('5');
  await first.page.getByTestId('ai-quality-rounds').fill('1');
  await first.page.getByTestId('ai-quality-issue').fill('none');
  await first.page.getByTestId('ai-quality-needs-rewrite').uncheck();
  await first.page.getByTestId('ai-quality-note').fill('补充证据后可直接使用。');
  await first.page.getByTestId('ai-quality-save').click();
  await first.page.getByTestId('ai-quality-review-success').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('ai-quality-review-success').textContent(), /before\/after 回放实验/, 'after save must expose experiment creation success');
  const qualityAfterReview = (await first.page.evaluate(() => window.omniEdu.listAiUsabilityReviews(500))).find((review) => review.sampleId === 'electron_quality_before_after');
  assert.ok(qualityAfterReview, 'after review must persist through the teacher form');
  const qualityExperiment = (await first.page.evaluate(() => window.omniEdu.listAiUsabilityReplayExperiments(200))).find((item) => item.beforeReviewId === qualityBeforeReview.id && item.afterReviewId === qualityAfterReview.id);
  assert.ok(qualityExperiment, 'before/after save must persist a linked replay experiment');
  assert.equal(qualityExperiment.scoreDelta, 3, 'replay score delta must be computed from SQLite-linked reviews');
  await first.page.getByTestId(`ai-quality-experiment-${qualityExperiment.id}`).waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId(`ai-quality-experiment-${qualityExperiment.id}`).textContent(), /已改善.*Δ3\/5/s, 'experiment UI must render the computed improvement');

  await first.page.getByTestId('ai-quality-csv-text').fill('sampleId,prompt,route,subIntent,teacherScore,needsRewrite,roundsToUseful,mainIssueCode,teacherNote\nelectron_quality_csv,请解释一次函数,general_qa,concept_explanation,5,false,1,none,可直接使用');
  await first.page.getByTestId('ai-quality-import').click();
  await first.page.getByTestId('ai-quality-review-success').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('ai-quality-review-success').textContent(), /已导入 1 条/, 'valid CSV import must expose its exact persisted count');
  assert.ok((await first.page.evaluate(() => window.omniEdu.listAiUsabilityReviews(500))).some((review) => review.sampleId === 'electron_quality_csv'), 'valid CSV row must persist through the existing review IPC');
  await first.page.setViewportSize({ width: 1920, height: 1080 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-ai-quality-experiment-1920x1080.png'), fullPage: true });

  await first.page.getByTestId('data-backup-panel').waitFor({ state: 'visible' });
  assert.match(await first.page.getByTestId('data-backup-boundary').textContent(), /不会自动恢复/, 'backup UI must not imply an unimplemented restore operation');
  const backupEntriesBeforeExport = readdirSync(dataBackupDestinationRoot).sort();
  await first.page.getByTestId('data-backup-export').click();
  await first.page.getByTestId('data-backup-export-success').waitFor({ state: 'visible', timeout: 15_000 });
  const dataBackupExportPath = (await first.page.getByTestId('data-backup-export-path').textContent())?.trim() ?? '';
  const dataBackupManifestPath = (await first.page.getByTestId('data-backup-manifest-path').textContent())?.trim() ?? '';
  assert.ok(dataBackupExportPath.startsWith(dataBackupDestinationRoot), 'complete backup must stay inside the user-selected destination');
  assert.equal(dataBackupExportPath.startsWith(dataRoot), false, 'complete backup must be outside the live data root');
  assert.ok(existsSync(dataBackupExportPath), 'complete backup directory must exist');
  assert.ok(existsSync(dataBackupManifestPath), 'complete backup manifest must exist');
  assert.ok(readdirSync(dataBackupDestinationRoot).length > backupEntriesBeforeExport.length, 'successful export must create a backup directory');
  const dataBackupManifest = JSON.parse(readFileSync(dataBackupManifestPath, 'utf8'));
  assert.equal(dataBackupManifest.schemaVersion, 'omni-edu-backup-manifest.v1', 'backup manifest schema must be versioned');
  assert.equal(dataBackupManifest.fileCount, dataBackupManifest.files.length, 'backup manifest file count must match its entries');
  assert.ok(dataBackupManifest.files.length >= 1, 'complete backup must include the live data files');
  for (const file of dataBackupManifest.files) {
    assert.ok(typeof file.path === 'string' && file.path.length > 0, 'manifest file path must be non-empty');
    assert.equal(file.path.startsWith('/'), false, 'manifest file path must be relative');
    assert.equal(file.path.split('/').includes('..'), false, 'manifest file path must not escape the backup root');
    assert.ok(Number.isInteger(file.size) && file.size >= 0, 'manifest file size must be a non-negative integer');
    assert.match(file.sha256, /^[a-f0-9]{64}$/, 'manifest file hash must be SHA-256');
  }

  await first.page.getByTestId('data-backup-verify').click();
  await first.page.getByTestId('data-backup-verify-success').waitFor({ state: 'visible', timeout: 15_000 });
  assert.equal((await first.page.getByTestId('data-backup-verify-path').textContent())?.trim(), dataBackupExportPath, 'clean backup verification must expose the selected backup path');
  await first.page.setViewportSize({ width: 1366, height: 768 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-data-backup-success-1366x768.png'), fullPage: true });

  const backupEntriesBeforeCancel = readdirSync(dataBackupDestinationRoot).sort();
  await first.page.getByTestId('data-backup-export').click();
  await first.page.getByTestId('data-backup-cancelled').waitFor({ state: 'visible' });
  assert.deepEqual(readdirSync(dataBackupDestinationRoot).sort(), backupEntriesBeforeCancel, 'cancelled backup export must perform zero writes');

  const changedBackupRelativePath = dataBackupManifest.files[0].path;
  const changedBackupPath = join(dataBackupExportPath, ...changedBackupRelativePath.split('/'));
  const originalBackupBytes = readFileSync(changedBackupPath);
  writeFileSync(changedBackupPath, Buffer.concat([originalBackupBytes, Buffer.from('\nOMNI_EDU_E2E_TAMPER')]));
  const unexpectedBackupPath = join(dataBackupExportPath, 'unexpected-e2e.txt');
  writeFileSync(unexpectedBackupPath, 'unexpected backup file', 'utf8');
  await first.page.getByTestId('data-backup-verify').click();
  await first.page.getByTestId('data-backup-verify-failed').waitFor({ state: 'visible', timeout: 15_000 });
  const dataBackupIssues = await first.page.getByTestId('data-backup-issues').textContent();
  assert.match(dataBackupIssues ?? '', new RegExp(changedBackupRelativePath.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'verification UI must identify the changed file');
  assert.match(dataBackupIssues ?? '', /unexpected-e2e\.txt/, 'verification UI must identify unexpected files');
  assert.match(await first.page.getByTestId('data-backup-verify-failed').textContent(), /被修改 1.*清单外 1/s, 'verification summary must report changed and unexpected counts');
  await first.page.setViewportSize({ width: 1920, height: 1080 });
  await first.page.screenshot({ path: join(artifactRoot, 'frontend-data-backup-failed-1920x1080.png'), fullPage: true });
  writeFileSync(changedBackupPath, originalBackupBytes);
  rmSync(unexpectedBackupPath, { force: true });

  const manifestBytesBeforeVerifyCancel = readFileSync(dataBackupManifestPath);
  await first.page.getByTestId('data-backup-verify').click();
  await first.page.getByTestId('data-backup-cancelled').waitFor({ state: 'visible' });
  assert.deepEqual(readFileSync(dataBackupManifestPath), manifestBytesBeforeVerifyCancel, 'cancelled backup verification must perform zero writes');

  const savedSettings = await first.page.evaluate(() => window.omniEdu.saveDeepSeekSettings({
    apiKey: 'sk-smoke-test-local-only',
    model: 'deepseek-v4-flash',
  }));
  assert.equal(savedSettings.configured, true, 'DeepSeek settings should be saved');
  assert.equal(savedSettings.model, 'deepseek-v4-flash');

  for (let index = 1; index <= 30; index += 1) {
    await first.page.evaluate((studentIndex) => window.omniEdu.createStudent({
      displayName: `验证学生${studentIndex}`,
      grade: '初二',
      subjects: ['数学'],
      goals: '持久化验证',
      currentIssues: '用于验证重启后仍可读取',
      tags: ['持久化验证'],
    }), index);
  }

  const afterCreate = await first.page.evaluate(() => window.omniEdu.listStudents('验证学生'));
  assert.equal(afterCreate.length, 30, 'should create 30 verification students');
  await closeApp(first.app);

  const second = await launchApp({ backupVerifyDialogQueue: [dataBackupExportPath] });
  const afterRestart = await second.page.evaluate(() => window.omniEdu.listStudents('验证学生'));
  assert.equal(afterRestart.length, 30, '30 students should persist after restart');
  const settingsAfterRestart = await second.page.evaluate(() => window.omniEdu.getDeepSeekSettings());
  assert.equal(settingsAfterRestart.configured, true, 'DeepSeek settings should persist after restart');
  assert.equal(settingsAfterRestart.model, 'deepseek-v4-flash');
  const dataRootAfterRestart = await second.page.evaluate(() => window.omniEdu.getDataRoot());
  assert.equal(dataRootAfterRestart, dataRoot);
  const conversationWorkspaceAfterRestart = await second.page.evaluate(() => window.omniEdu.listAiConversations());
  assert.equal(conversationWorkspaceAfterRestart.archivedFolders.find((folder) => folder.id === conversationFolder.id)?.name, 'AI 对话前端验收-已重命名', 'renamed archived folder must persist after restart');
  assert.ok(conversationWorkspaceAfterRestart.archivedSessions.some((session) => session.id === conversationSession.id), 'individually archived session must persist after restart');
  assert.ok(conversationWorkspaceAfterRestart.archivedSessions.some((session) => session.id === folderArchiveSession.id), 'folder cascade archived session must persist after restart');
  await second.page.getByTestId('nav-settings').click();
  assert.match(await second.page.locator('body').textContent(), /AI 对话前端验收-已重命名/, 'settings UI must render the archived conversation folder after restart');
  await second.page.getByTestId(`ai-quality-review-${qualityBeforeReview.id}`).waitFor({ state: 'visible' });
  await second.page.getByTestId(`ai-quality-experiment-${qualityExperiment.id}`).waitFor({ state: 'visible' });
  await second.page.getByTestId(`ai-quality-model-grade-${modelGradeFixture.id}`).waitFor({ state: 'visible' });
  assert.ok((await second.page.evaluate(() => window.omniEdu.listAiUsabilityReviews(500))).some((review) => review.id === qualityAfterReview.id), 'quality reviews must persist after application restart');
  assert.ok((await second.page.evaluate(() => window.omniEdu.listAiUsabilityReplayExperiments(200))).some((item) => item.id === qualityExperiment.id), 'linked quality experiment must persist after application restart');
  await second.page.getByTestId('data-backup-verify').click();
  await second.page.getByTestId('data-backup-verify-success').waitFor({ state: 'visible', timeout: 15_000 });
  assert.equal((await second.page.getByTestId('data-backup-verify-path').textContent())?.trim(), dataBackupExportPath, 'an external backup must remain verifiable after application restart');
  const knowledgeAfterRestart = await second.page.evaluate(() => window.omniEdu.getKnowledgeOverview());
  assert.equal(knowledgeAfterRestart.counts.resources, 1, 'knowledge resources should persist after restart');
  assert.ok(knowledgeAfterRestart.counts.chunks >= 1, 'knowledge chunks should persist after restart');
  const exerciseSetsAfterRestart = await second.page.evaluate((studentId) => window.omniEdu.listExerciseSets(studentId), knownStudent.id);
  assert.ok(exerciseSetsAfterRestart.some((item) => item.id === confirmedExerciseSet.id), 'UI-confirmed exercise set should persist after restart');
  const notebookAfterRestart = await second.page.evaluate((questionId) => window.omniEdu.getQuestionNotebookEntry(questionId), notebookQuestions.local.id);
  assert.equal(notebookAfterRestart?.bookmarked, true, 'question notebook bookmark should persist after restart');
  const uiCreatedQuestionAfterRestart = await second.page.evaluate((questionId) => window.omniEdu.getQuestionNotebookEntry(questionId), uiCreatedQuestion.id);
  assert.match(uiCreatedQuestionAfterRestart?.stem, /教师界面录入/, 'UI-created canonical question should persist after restart');
  assert.ok(uiCreatedQuestionAfterRestart?.categories.some((category) => category.id === uiQuestionCategory.id), 'restored category association should persist after restart');
  assert.equal((await second.page.evaluate((questionId) => window.omniEdu.listQuestionNotebookUsage(questionId), uiCreatedQuestion.id)).length, 1, 'manual usage readback should persist after restart');
  const artifactAfterRestart = await second.page.evaluate((artifactId) => window.omniEdu.getDocumentArtifact(artifactId), artifactFixture.markdownId);
  assert.equal(artifactAfterRestart?.status, 'exported', 'document artifact metadata should persist after restart');
  assert.equal(artifactAfterRestart?.contentHash, exportedArtifact.contentHash, 'document artifact hash should be stable after restart');
  assert.ok(existsSync(artifactAfterRestart.filePath), 'exported artifact file should remain readable after restart');
  const pdfAfterRestart = await second.page.evaluate((artifactId) => window.omniEdu.getDocumentArtifact(artifactId), artifactFixture.pdfId);
  const docxAfterRestart = await second.page.evaluate((artifactId) => window.omniEdu.getDocumentArtifact(artifactId), artifactFixture.docxId);
  assert.equal(pdfAfterRestart?.contentHash, exportedPdf.contentHash, 'PDF hash should remain stable after restart');
  assert.equal(docxAfterRestart?.contentHash, exportedDocx.contentHash, 'DOCX hash should remain stable after restart');
  assert.ok(existsSync(pdfAfterRestart.filePath) && existsSync(docxAfterRestart.filePath), 'PDF and DOCX files should remain readable after restart');
  assert.equal(await second.page.evaluate((artifactId) => window.omniEdu.getDocumentArtifact(artifactId), artifactFixture.emptyId), null, 'empty artifact must remain zero-write after restart');
  const teacherNotebooksAfterRestart = await second.page.evaluate(() => window.omniEdu.listTeacherNotebooks(true));
  assert.equal(teacherNotebooksAfterRestart.find((item) => item.id === teacherNotebookFixture.id)?.status, 'active', 'restored teacher notebook should remain active after restart');
  const teacherNotebookRecordsAfterRestart = await second.page.evaluate((notebookId) => window.omniEdu.listTeacherNotebookRecords(notebookId, true), teacherNotebookFixture.id);
  assert.ok(teacherNotebookRecordsAfterRestart.find((item) => item.id === teacherNotebookRecordFixture.id)?.deletedAt, 'soft-deleted teacher note should remain auditable after restart');
  const observabilityReportsAfterRestart = await second.page.evaluate(() => window.omniEdu.listAiRegressionReports(20));
  assert.ok(observabilityReportsAfterRestart.some((item) => item.id === observabilityReport.id && item.title === observabilityReportTitle), 'UI-generated regression report should persist after restart');
  const lifecycleStudentAfterRestart = (await second.page.evaluate(() => window.omniEdu.listStudents('档案生命周期验收学生-已编辑')))[0];
  assert.equal(lifecycleStudentAfterRestart?.status, 'archived', 'renderer-confirmed student archive must persist after restart');
  assert.equal(lifecycleStudentAfterRestart?.grade, '九年级', 'renderer-edited student profile must persist after restart');
  await second.page.getByTestId('nav-students').click();
  await second.page.getByTestId(`student-row-${lifecycleStudent.id}`).click();
  await second.page.getByTestId('student-status-archived').waitFor({ state: 'visible' });
  assert.equal(await second.page.getByTestId('student-edit').isDisabled(), true, 'restart UI must preserve archived read-only state');
  await second.page.getByTestId(`student-row-${knownStudent.id}`).click();
  await second.page.getByTestId('nav-mastery').click();
  await second.page.getByTestId('mastery-path-content').waitFor({ state: 'visible' });
  assert.match(await second.page.getByTestId('mastery-path-workspace').textContent(), /版本 v2/, 'restart UI must render the persisted mastery path');
  await second.page.getByTestId('nav-today').click();
  await second.page.getByTestId('review-reminder-due').waitFor({ state: 'visible' });
  assert.match(await second.page.getByTestId('review-reminder-due').textContent(), /复习提醒前端验收知识点/, 'restart UI must recalculate the same due reminder from persisted learning records');
  const reportsAfterRestart = await second.page.evaluate((studentId) => window.omniEdu.listReports(studentId), knownStudent.id);
  const reviewAfterRestart = reportsAfterRestart.find((report) => report.id === generatedReviewReport.id);
  assert.equal(reviewAfterRestart?.contentMd, revisedReviewContent, 'teacher-edited report content must persist after restart');
  assert.equal(reviewAfterRestart?.parentSummary, revisedParentSummary, 'teacher-edited parent summary must persist after restart');
  await second.page.getByTestId('nav-review').click();
  await second.page.getByTestId(`review-report-history-${generatedReviewReport.id}`).waitFor({ state: 'visible' });
  await second.page.getByTestId(`review-report-history-${generatedReviewReport.id}`).click();
  assert.equal(await second.page.getByTestId('review-report-content').inputValue(), revisedReviewContent, 'restart UI must reopen the same SQLite report');
  assert.ok(existsSync(initialReviewSnapshotPath), 'initial Markdown snapshot must remain readable after restart');
  assert.equal(readFileSync(initialReviewSnapshotPath, 'utf8'), initialReviewSnapshot, 'restart must preserve the truthful initial-snapshot boundary');
  await second.page.getByTestId('nav-mistakes').click();
  await second.page.getByTestId(`exercise-set-card-${confirmedExerciseSet.id}`).waitFor({ state: 'visible' });
  assert.match(await second.page.getByTestId(`exercise-set-card-${confirmedExerciseSet.id}`).textContent(), new RegExp(confirmedExerciseSet.title.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')), 'restart UI must render the persisted confirmed exercise set');
  await second.page.getByTestId('nav-search').click();
  await second.page.getByTestId('global-search-input').fill('错题图片前端验收');
  await second.page.getByTestId('global-search-submit').click();
  await second.page.getByTestId(`global-search-record-${mistakeRecord.id}`).waitFor({ state: 'visible' });
  assert.match(await second.page.getByTestId(`global-search-record-${mistakeRecord.id}`).textContent(), /错题图片前端验收/, 'global search must read the same persisted SQLite record after restart');
  await second.page.getByTestId('nav-analytics').click();
  await second.page.getByTestId(`ai-regression-item-${observabilityReport.id}`).waitFor({ state: 'visible' });
  assert.equal((await second.page.locator('body').textContent())?.includes(observabilityRawPrompt), false, 'raw prompt must remain absent after restart');
  const l2AfterRestart = await second.page.evaluate(() => window.omniEdu.getAiMemoryDocument('chat'));
  assert.equal(l2AfterRestart?.entries.find((entry) => entry.id === retainedL2Id)?.text, '另一窗口已更新的 L2 内容。', 'concurrency-safe L2 text should persist after restart');
  assert.equal(l2AfterRestart?.entries.find((entry) => entry.id === deletedL2Id)?.status, 'deleted', 'soft-deleted L2 entry should remain auditable after restart');
  const l3AfterRestart = await second.page.evaluate(() => window.omniEdu.getAiMemoryL3Document('profile'));
  assert.equal(l3AfterRestart?.entries.find((entry) => entry.id === l3Entry.id)?.status, 'active', 'restored L3 entry should persist after restart');
  assert.match(l3AfterRestart?.entries.find((entry) => entry.id === l3Entry.id)?.text ?? '', /跨表面学习者画像/, 'teacher-edited L3 text should persist after restart');
  await second.page.getByTestId('nav-memory').click();
  await second.page.getByTestId(`memory-l2-entry-${retainedL2Id}`).waitFor({ state: 'visible' });
  assert.match(await second.page.getByTestId(`memory-l2-text-${retainedL2Id}`).inputValue(), /另一窗口已更新/, 'restart UI should render current L2 readback');
  const teachingBookAfterRestart = await second.page.evaluate((bookId) => window.omniEdu.getTeachingBook(bookId), teachingBookFixture.id);
  assert.equal(teachingBookAfterRestart?.chapters.length, 1, 'UI-created teaching book chapter should persist after restart');
  assert.equal(teachingBookAfterRestart?.pages[0]?.status, 'pending', 'UI-reset page status should persist after restart');
  assert.equal(teachingBookAfterRestart?.blocks[0]?.version, 7, 'patch cycles, teacher edit, and regenerate block version should persist after restart');
  assert.match(teachingBookAfterRestart?.blocks[0]?.payload.text, /变化快慢/, 'teacher-authored final content should persist after restart');
  const teachingBookArtifactAfterRestart = await second.page.evaluate((artifactId) => window.omniEdu.getDocumentArtifact(artifactId), teachingBookArtifact.id);
  assert.equal(teachingBookArtifactAfterRestart?.contentHash, teachingBookArtifact.contentHash, 'teaching book export hash should remain stable after restart');
  assert.ok(existsSync(teachingBookArtifactAfterRestart.filePath), 'teaching book export file should remain readable after restart');
  assert.ok((await second.page.evaluate(() => window.omniEdu.listTeachingBooks(true))).find((book) => book.id === archivedTeachingBookFixture.id)?.deletedAt, 'archived teaching book should persist after restart');
  await second.page.getByTestId('nav-book').click();
  await second.page.getByTestId(`teaching-book-item-${teachingBookFixture.id}`).waitFor({ state: 'visible' });
  await second.page.setViewportSize({ width: 1366, height: 768 });
  await second.page.getByTestId('nav-question_notebook').click();
  await second.page.getByTestId(`question-notebook-card-${notebookQuestions.local.id}`).waitFor({ state: 'visible' });
  assert.equal(await second.page.getByTestId(`question-notebook-bookmark-${notebookQuestions.local.id}`).getAttribute('aria-label'), '取消收藏', 'restart UI should render the persisted bookmark');
  await closeApp(second.app);

  console.log(JSON.stringify({
    ok: true,
    dataRoot,
    createdStudents: afterRestart.length,
    knowledgeResources: knowledgeImport.overview.counts.resources,
    knowledgeChunks: knowledgeImport.overview.counts.chunks,
    knowledgeNodes: knowledgeImport.overview.counts.nodes,
    frontendAcceptance: {
      cases: [
        'native attachment dialog adapter click', 'attachment copy and hash readback', 'attachment source retained',
        'attachment cancel zero writes', 'attachment status feedback', 'needs_ocr persisted', 'teacher correction persisted', 'phone sanitized',
        'missing credential actionable', 'triplet preview editable', 'triplet reject zero writes', 'triplet confirm writes exercise set',
        'exercise source kinds retained', 'local_bank source visible', 'generated source visible', 'bookmark persisted',
        'bookmarked-only filter hit', 'question search no-hit state', 'question search hit state', 'artifact export file and hash',
        'PDF UI click export', 'PDF Unicode file bytes', 'PDF SQLite metadata readback',
        'DOCX UI click export', 'DOCX Unicode and style bytes', 'DOCX long content SQLite readback',
        'empty artifact visible failure', 'empty artifact zero writes', 'PDF and DOCX restart readback',
        'question UI canonical create', 'teacher provenance cannot forge generated', 'question category create', 'question category versioned rename',
        'question category assignment', 'question category soft delete', 'question category restore', 'question usage empty state',
        'question manual usage readback', 'question management restart readback',
        'question empty validation zero writes', 'question category conflict fail closed',
        'exercise/bookmark/artifact restart readback', '1366x768 and 1920x1080 visual capture',
        'teacher notebook empty state', 'teacher notebook create readback', 'teacher note create readback', 'teacher note versioned edit',
        'teacher note soft delete audit', 'teacher notebook soft delete', 'teacher notebook restore', 'teacher notebook restart readback',
        'AI observability summary readback', 'regression report click persistence', 'computed regression gates visible',
        'recent run inspector visible', 'bounded trace boundary visible', 'raw prompt and hidden reasoning excluded',
        'regression report restart readback',
        'teaching book empty state', 'teaching book create readback', 'teaching book versioned update',
        'teaching chapter create', 'teaching page create', 'manual source binding', 'source-anchored block create',
        'read-only compiled preview', 'patch draft zero writes', 'patch apply readback', 'patch undo readback',
        'selection patch exact preview', 'selection patch zero writes', 'selection patch apply and undo', 'versioned direct block edit',
        'teaching source health refresh', 'page and block pending regeneration state', 'teaching book Markdown export',
        'teaching book archive boundary', 'teaching book restart readback', 'teaching book dual-viewport capture',
        'memory workspace empty state', 'L2 candidate zero writes', 'L2 teacher adoption', 'L2 versioned edit',
        'L2 stale conflict fail closed', 'L2 conflict preserves readback', 'L2 revision history', 'L2 disable and restore',
        'L2 soft delete audit', 'L3 candidate zero writes', 'L3 teacher adoption', 'L3 versioned edit',
        'L3 stale conflict fail closed', 'L3 conflict preserves readback', 'L3 disable and restore', 'bounded evidence graph', 'raw prompt and hidden reasoning excluded from memory',
        'memory governance counts', 'memory restart readback', 'memory dual-viewport capture', 'AI formal memory write disabled',
        'mastery path navigation click', 'mastery path SQLite version readback', 'mastery module and type order visible',
        'mastery refresh stable readback', 'mastery percentage not invented', 'mastery empty state',
        'mastery student isolation', 'mastery AI handoff prefill', 'mastery restart and dual-viewport readback',
        'global search navigation and idle state', 'global search blank validation', 'global student search hit',
        'global student result navigation', 'global record search hit', 'global record owner navigation',
        'global search no-hit state', 'global search restart readback', 'global search dual-viewport capture',
        'exercise-set teacher-visible readback', 'exercise-set read-only boundary', 'exercise-set source labels visible',
        'exercise-set refresh zero writes', 'exercise-set empty state', 'exercise-set student isolation',
        'exercise-set restart UI readback', 'exercise-set 1366x768 capture', 'exercise-set 1920x1080 capture',
        'review reminder navigation click', 'review reminder due SQLite readback', 'review reminder bounded projection',
        'review reminder refresh zero writes', 'review reminder evidence navigation', 'review reminder clear state',
        'review reminder student isolation', 'review reminder restart UI readback',
        'review reminder 1366x768 capture', 'review reminder 1920x1080 capture',
        'student create form SQLite readback', 'student edit identity and SQLite readback',
        'student folder open visible feedback', 'student export user click', 'student export metadata file readback',
        'student export SQLite record projection', 'student export cancel zero writes',
        'student archive confirmation cancel zero writes', 'student archive confirm SQLite write',
        'student archived row label', 'student archived read-only controls', 'student lifecycle restart readback',
        'student lifecycle dual-viewport capture',
        'data backup settings navigation', 'data backup export user click', 'data backup outside live root',
        'data backup manifest schema and file count', 'data backup relative paths and SHA-256', 'data backup clean verification',
        'data backup export cancel zero writes', 'data backup changed file detection', 'data backup unexpected file detection',
        'data backup verify cancel zero writes', 'data backup restart verification', 'data backup dual-viewport capture',
        'AI conversation sidebar navigation', 'AI folder blank validation zero writes', 'AI folder create SQLite readback',
        'AI conversation create SQLite readback', 'AI conversation rename SQLite readback', 'AI conversation drag move SQLite readback',
        'AI conversation archive cancel zero writes', 'AI conversation archive confirm', 'AI folder rename SQLite readback',
        'AI folder archive cancel zero writes', 'AI folder cascade archive', 'AI archived workspace restart readback',
        'AI archived settings UI readback', 'AI conversation dual-viewport capture',
        'review report navigation and validation', 'review invalid range zero writes', 'review generation SQLite readback',
        'review source evidence visible', 'review quality checks visible', 'review initial Markdown snapshot',
        'review edit zero writes before save', 'review save SQLite readback', 'review parent summary readback',
        'review initial snapshot boundary', 'review history reopen', 'review student isolation',
        'review restart SQLite readback', 'review restart file boundary', 'review report dual-viewport capture',
        'AI quality settings navigation and loading', 'quality blank validation zero writes', 'quality invalid CSV zero writes',
        'teacher quality score SQLite readback', 'teacher rewrite flag and failure visibility', 'quality summary refresh readback',
        'model grader truthful mode visibility', 'quality sample replay to AI input', 'quality before selection visibility',
        'quality after review SQLite readback', 'quality replay experiment SQLite link', 'quality score delta visible',
        'quality valid CSV import', 'quality reviews restart readback', 'quality experiment and model grade restart readback',
        'AI quality dual-viewport capture',
      ],
      passed: 207,
      total: 207,
      viewports: ['1366x768', '1920x1080'],
      screenshots: [
        join(artifactRoot, 'frontend-mistakes-1366x768.png'),
        join(artifactRoot, 'frontend-mistakes-1920x1080.png'),
        join(artifactRoot, 'frontend-question-notebook-1366x768.png'),
        join(artifactRoot, 'frontend-ai-artifact-pdf-1366x768.png'),
        join(artifactRoot, 'frontend-ai-artifact-docx-1920x1080.png'),
        join(artifactRoot, 'frontend-ai-artifact-error-1366x768.png'),
        join(artifactRoot, 'frontend-teacher-notebook-1366x768.png'),
        join(artifactRoot, 'frontend-teacher-notebook-1920x1080.png'),
        join(artifactRoot, 'frontend-ai-observability-1366x768.png'),
        join(artifactRoot, 'frontend-ai-observability-1920x1080.png'),
        join(artifactRoot, 'frontend-teaching-book-1366x768.png'),
        join(artifactRoot, 'frontend-teaching-book-1920x1080.png'),
        join(artifactRoot, 'frontend-memory-governance-1366x768.png'),
        join(artifactRoot, 'frontend-memory-governance-1920x1080.png'),
        join(artifactRoot, 'frontend-mastery-path-1366x768.png'),
        join(artifactRoot, 'frontend-mastery-path-1920x1080.png'),
        join(artifactRoot, 'frontend-global-search-1366x768.png'),
        join(artifactRoot, 'frontend-global-search-1920x1080.png'),
        join(artifactRoot, 'frontend-exercise-sets-1366x768.png'),
        join(artifactRoot, 'frontend-exercise-sets-1920x1080.png'),
        join(artifactRoot, 'frontend-review-reminder-1366x768.png'),
        join(artifactRoot, 'frontend-review-reminder-1920x1080.png'),
        join(artifactRoot, 'frontend-student-lifecycle-1366x768.png'),
        join(artifactRoot, 'frontend-student-lifecycle-1920x1080.png'),
        join(artifactRoot, 'frontend-data-backup-success-1366x768.png'),
        join(artifactRoot, 'frontend-data-backup-failed-1920x1080.png'),
        join(artifactRoot, 'frontend-ai-conversation-library-1366x768.png'),
        join(artifactRoot, 'frontend-ai-conversation-archive-1920x1080.png'),
        join(artifactRoot, 'frontend-review-report-draft-1366x768.png'),
        join(artifactRoot, 'frontend-review-report-saved-1920x1080.png'),
        join(artifactRoot, 'frontend-ai-quality-review-1366x768.png'),
        join(artifactRoot, 'frontend-ai-quality-experiment-1920x1080.png'),
      ],
    },
  }, null, 2));
}

run()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await Promise.all([...activeApps].map((app) => closeApp(app)));
    removeSmokeDataRoot();
    removeAttachmentSourceRoot();
    removeStudentExportRoot();
    removeDataBackupDestinationRoot();
    process.exit(process.exitCode ?? 0);
  });
