import { registerPiConsoleEndpoints } from './xiaozhi-agent/legacy-runtime-ipc';
import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { nativeChromeOptions, installDesktopChrome, registerDesktopChromeIpc } from './desktop-chrome';
import { restoreWindowGeometry, installWindowGeometry } from './desktop-chrome/window-geometry';
import { existsSync, readFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { isAbsolute, join } from 'node:path';
import { OmniEduStore } from './db';
import {registerMaterialIpc} from './assets/material-ipc';
import {registerMistakeOcrIpc} from './students/mistake-ocr-api';
import type { AiExerciseSetTeacherEdits, AiConversationFolderInput, AiConversationFolderUpdateInput, AiConversationMessageInput, AiConversationSessionInput, AiConversationSessionUpdateInput, AiModelGradeInput, AiRegressionReportInput, AiUsabilityHumanReviewInput, AiUsabilityReplayExperimentInput, DeepSeekSettingsInput, DocumentArtifactExportInput, AiMemorySurface, AiMemoryEntryInput, AiMemoryEntryUpdateInput, AiMemoryL3Slot, AiMemoryL3EntryInput, AiMemoryL3EntryUpdateInput, AiMemoryEvidenceGraph, ReviewReminder } from '../shared/contracts';
import { buildMasterySnapshot } from './ai-harness/mastery-snapshot';
import { buildMasteryPolicy } from './ai-harness/mastery-policy';
import { buildReviewReminder } from './ai-harness/review-reminder';
import { renderTeachingBookMarkdown } from './ai-harness/teaching-book-renderer';
import { registerXiaozhiIpc } from './xiaozhi-agent/ipc';
import { createPiConsoleFacade } from './xiaozhi-agent/console-facade';
import { resolveRuntimeAuthority, applyLaunchProfile, isBackgroundAcceptance } from './xiaozhi-agent/runtime-authority';

// Electron app preferences also need the launcher's explicit profile, before ready.
applyLaunchProfile({ profile: app.commandLine.getSwitchValue('user-data-dir'), setPath: (name, directory) => app.setPath(name, directory) });

let store: OmniEduStore;
let mainWindow: BrowserWindow | undefined;
let backgroundAcceptance = false;
let e2eAttachmentDialogQueue: string[][] | undefined;
let e2eStudentExportDialogQueue: string[][] | undefined;
let e2eDataBackupExportDialogQueue: string[] | undefined;
let e2eDataBackupVerifyDialogQueue: string[] | undefined;
let lastE2eDataBackupExportPath = '';

function consumeE2eAttachmentDialogSelection() {
  if (process.env.OMNI_EDU_E2E_DIALOG_MODE !== '1') return null;
  if (app.isPackaged) throw new Error('E2E attachment dialog adapter is disabled in packaged builds');
  if (!e2eAttachmentDialogQueue) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(process.env.OMNI_EDU_E2E_ATTACHMENT_DIALOG_QUEUE ?? '[]');
    } catch {
      throw new Error('E2E attachment dialog queue must be valid JSON');
    }
    if (!Array.isArray(parsed) || parsed.length > 20 || !parsed.every((selection) => Array.isArray(selection) && selection.length <= 20 && selection.every((filePath) => typeof filePath === 'string' && isAbsolute(filePath)))) {
      throw new Error('E2E attachment dialog queue must contain bounded absolute path arrays');
    }
    e2eAttachmentDialogQueue = parsed as string[][];
  }
  const filePaths = e2eAttachmentDialogQueue.shift();
  if (!filePaths) throw new Error('E2E attachment dialog queue is exhausted');
  return { canceled: filePaths.length === 0, filePaths };
}

async function selectAttachmentPaths() {
  const controlledSelection = consumeE2eAttachmentDialogSelection();
  if (controlledSelection) return controlledSelection;
  return dialog.showOpenDialog({
    title: '选择要复制到学生档案的附件',
    properties: ['openFile', 'multiSelections'],
  });
}

function consumeE2eStudentExportDialogSelection() {
  if (process.env.OMNI_EDU_E2E_DIALOG_MODE !== '1') return null;
  if (app.isPackaged) throw new Error('E2E student export dialog adapter is disabled in packaged builds');
  if (!e2eStudentExportDialogQueue) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(process.env.OMNI_EDU_E2E_STUDENT_EXPORT_DIALOG_QUEUE ?? '[]');
    } catch {
      throw new Error('E2E student export dialog queue must be valid JSON');
    }
    if (!Array.isArray(parsed) || parsed.length > 10 || !parsed.every((selection) => Array.isArray(selection) && selection.length <= 1 && selection.every((folderPath) => typeof folderPath === 'string' && isAbsolute(folderPath)))) {
      throw new Error('E2E student export dialog queue must contain bounded absolute directory selections');
    }
    e2eStudentExportDialogQueue = parsed as string[][];
  }
  const filePaths = e2eStudentExportDialogQueue.shift();
  if (!filePaths) throw new Error('E2E student export dialog queue is exhausted');
  return { canceled: filePaths.length === 0, filePaths };
}

async function selectStudentExportRoot() {
  const controlledSelection = consumeE2eStudentExportDialogSelection();
  if (controlledSelection) return controlledSelection;
  return dialog.showOpenDialog({
    title: '选择学生档案导出位置',
    properties: ['openDirectory', 'createDirectory'],
  });
}

function consumeE2eDataBackupDirectorySelection(kind: 'export' | 'verify') {
  if (process.env.OMNI_EDU_E2E_DIALOG_MODE !== '1') return null;
  if (app.isPackaged) throw new Error('E2E data-backup dialog adapter is disabled in packaged builds');
  const envName = kind === 'export'
    ? 'OMNI_EDU_E2E_DATA_BACKUP_EXPORT_DIALOG_QUEUE'
    : 'OMNI_EDU_E2E_DATA_BACKUP_VERIFY_DIALOG_QUEUE';
  let queue = kind === 'export' ? e2eDataBackupExportDialogQueue : e2eDataBackupVerifyDialogQueue;
  if (!queue) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(process.env[envName] ?? '[]');
    } catch {
      throw new Error(`E2E ${kind} backup dialog queue must be valid JSON`);
    }
    const validEntry = (value: unknown) => typeof value === 'string'
      && (value === '' || isAbsolute(value) || (kind === 'verify' && value === '$last'));
    if (!Array.isArray(parsed) || parsed.length > 10 || !parsed.every(validEntry)) {
      throw new Error(`E2E ${kind} backup dialog queue must contain bounded absolute directories, cancellation, or the verify-only $last token`);
    }
    queue = parsed as string[];
    if (kind === 'export') e2eDataBackupExportDialogQueue = queue;
    else e2eDataBackupVerifyDialogQueue = queue;
  }
  const selected = queue.shift();
  if (selected === undefined) throw new Error(`E2E ${kind} backup dialog queue is exhausted`);
  const folderPath = selected === '$last' ? lastE2eDataBackupExportPath : selected;
  if (selected === '$last' && !folderPath) throw new Error('E2E backup verification requested $last before a backup was exported');
  return { canceled: !folderPath, filePaths: folderPath ? [folderPath] : [] };
}

async function selectDataBackupExportRoot() {
  const controlledSelection = consumeE2eDataBackupDirectorySelection('export');
  if (controlledSelection) return controlledSelection;
  return dialog.showOpenDialog({
    title: '选择完整数据目录备份位置',
    properties: ['openDirectory', 'createDirectory'],
  });
}

async function selectDataBackupVerifyRoot() {
  const controlledSelection = consumeE2eDataBackupDirectorySelection('verify');
  if (controlledSelection) return controlledSelection;
  return dialog.showOpenDialog({
    title: '选择 Omni-Edu 备份目录进行完整性校验',
    properties: ['openDirectory'],
  });
}

async function openStudentFolder(studentId: string) {
  const folderPath = store.getStudentFolder(studentId);
  if (process.env.OMNI_EDU_E2E_DIALOG_MODE === '1' && process.env.OMNI_EDU_E2E_OPEN_PATH_MODE === '1') {
    if (app.isPackaged) throw new Error('E2E open-path adapter is disabled in packaged builds');
    if (!isAbsolute(folderPath) || !existsSync(folderPath)) throw new Error('学生档案目录不存在');
    return '';
  }
  return shell.openPath(folderPath);
}

app.setName('OmniEduAgent');

function createWindow() {
  const { maximized, ...geometry } = restoreWindowGeometry();
  const window = new BrowserWindow({
    ...geometry,
    minWidth: 1100,
    minHeight: 720,
    title: 'Omni-Edu Agent',
    show: !backgroundAcceptance,
    backgroundColor: '#eef1f3',
    ...nativeChromeOptions(),
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      backgroundThrottling: !backgroundAcceptance,
    },
  });
  mainWindow = window;
  installDesktopChrome(window);
  installWindowGeometry(window, maximized, geometry);

  window.webContents.setWindowOpenHandler(({ url }) => {
    try {
      const protocol = new URL(url).protocol;
      if (protocol === 'http:' || protocol === 'https:') {
        shell.openExternal(url);
      }
    } catch {
      // Ignore malformed or non-URL navigation attempts.
    }
    return { action: 'deny' };
  });

  if (process.env.NODE_ENV === 'development' && process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function loadLocalEnv() {
  if (process.env.OMNI_EDU_E2E_DIALOG_MODE === '1' && !app.isPackaged) return;
  const envPath = join(process.cwd(), '.env.local');
  if (!existsSync(envPath)) return;
  const lines = readFileSync(envPath, 'utf8').split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const separatorIndex = trimmed.indexOf('=');
    if (separatorIndex <= 0) continue;
    const key = trimmed.slice(0, separatorIndex).trim();
    const rawValue = trimmed.slice(separatorIndex + 1).trim();
    if (!key || process.env[key]) continue;
    process.env[key] = rawValue.replace(/^['"]|['"]$/g, '');
  }
}

const ownsDesktop = app.requestSingleInstanceLock();
const desktopRevision = () => createHash('sha256').update([
  __filename, join(__dirname, '../preload/index.cjs'), join(__dirname, '../renderer/index.html'),
].map(file => existsSync(file) ? readFileSync(file).toString('base64') : '').join('\n')).digest('hex');
const openedRevision = desktopRevision();
if (!ownsDesktop) app.quit();
else app.on('second-instance', () => {
  if (desktopRevision() !== openedRevision) {
    // The launcher rebuilt out while this process still holds the old renderer/main.
    app.relaunch();
    app.quit();
    return;
  }
  if (!mainWindow || mainWindow.isDestroyed()) return;
  if (backgroundAcceptance) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.show();
  mainWindow.focus();
});

if (ownsDesktop) app.whenReady().then(async () => {
  loadLocalEnv();
  const dataRoot = process.env.OMNI_EDU_DATA_ROOT || join(app.getPath('userData'), 'OmniEduData');
  const authority = resolveRuntimeAuthority({ packaged: app.isPackaged, env: process.env, dataRoot, profileRoot: app.getPath('userData') });
  store = new OmniEduStore(dataRoot);
  await store.init();
  backgroundAcceptance = isBackgroundAcceptance({ packaged: app.isPackaged, env: process.env, dataRoot,
    profileRoot: app.getPath('userData'), repoRoot: process.env.OMNI_EDU_REPO_ROOT || join(process.cwd(), '../..') });
  const legacyTestRuntime = authority.mode === 'legacy-test'
    ? (await import('./legacy-ai/test-runtime')).registerLegacyTestRuntime({store,authority,window:()=>mainWindow})
    : undefined;


  ipcMain.handle('app:bootstrap', () => store.init());
  ipcMain.handle('ai:deepTutorListPendingInputs', event => {
    if (!mainWindow || mainWindow.isDestroyed() || event.sender !== mainWindow.webContents || event.senderFrame !== event.sender.mainFrame) throw new Error('permission_denied');
    return legacyTestRuntime?.listPendingInputs() ?? [];
  });
  ipcMain.handle('app:getDataRoot', () => store.getDataRoot());
  ipcMain.handle('app:getPlatformOverview', () => store.getPlatformOverview());
  const settingsSender = (event: Electron.IpcMainInvokeEvent) => event.sender === mainWindow?.webContents && event.senderFrame === event.sender.mainFrame;
  ipcMain.handle('students:createConversation',async(event,input)=>{
    if(!settingsSender(event))throw new Error('permission_denied');
    const {createStudentConversation}=await import('./students/context-service');return createStudentConversation(store,input);
  });
  ipcMain.handle('students:contextSource',async(event,input)=>{
    if(!settingsSender(event))throw new Error('permission_denied');
    const {getStudentContextSource}=await import('./students/context-service');return getStudentContextSource(store,input);
  });
  const publicProviderSettings = async () => {
    const legacy = await store.getDeepSeekSettings();
    if (!xiaozhi.enabled) return legacy;
    const current = await xiaozhi.modelSettingsView();
    const deepseek = { configured: current.configured, model: current.defaultModel, maskedApiKey: current.maskedApiKey };
    return { provider: 'deepseek' as const, ...deepseek, updatedAt: '', providers: { ...legacy.providers, deepseek } };
  };
  ipcMain.handle('settings:getDeepSeek', event => { if (!settingsSender(event)) throw new Error('permission_denied'); return publicProviderSettings(); });
  ipcMain.handle('settings:saveDeepSeek', async (event, input: DeepSeekSettingsInput) => {
    if (!settingsSender(event)) throw new Error('permission_denied');
    if (!xiaozhi.enabled) return store.saveDeepSeekSettings(input);
    if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(key => !['provider','apiKey','model'].includes(key))
      || input.provider !== undefined && input.provider !== 'deepseek') throw new Error('invalid_input');
    const { validSettingsInput } = await import('./xiaozhi-agent/model-settings');
    const current = await xiaozhi.modelSettingsView();
    const request = { schemaVersion: 'xiaozhi.settings.v1' as const, version: current.version, defaultModel: input.model, ...(input.apiKey ? { apiKey: input.apiKey } : {}) };
    if (!validSettingsInput(request)) throw new Error('invalid_input');
    await xiaozhi.saveModelSettings(request);
    return publicProviderSettings();
  });
  ipcMain.handle('knowledge:getOverview', () => store.getKnowledgeOverview());
  registerMaterialIpc(store, () => mainWindow);
  ipcMain.handle('knowledge:importPaths', (event, sourcePaths: string[]) => {
    if (!settingsSender(event) || authority.mode !== 'legacy-test') throw new Error('permission_denied');
    if (!Array.isArray(sourcePaths) || sourcePaths.length > 50 || sourcePaths.some(value => typeof value !== 'string' || !isAbsolute(value))) throw new Error('invalid_input');
    return store.importKnowledgeResources(sourcePaths);
  });
  ipcMain.handle('knowledge:showResource', async (event, filePath: string) => {
    if (!settingsSender(event) || typeof filePath !== 'string') throw new Error('permission_denied');
    if (!(await store.isManagedLocalPath(filePath))) {
      throw new Error('只能打开本地数据目录内的知识资源');
    }
    shell.showItemInFolder(filePath);
  });
  ipcMain.handle('app:exportDataRoot', async event => {
    if (!settingsSender(event)) throw new Error('permission_denied');
    const action = async (assertCurrent: () => void) => {
      const result = await selectDataBackupExportRoot();
      assertCurrent();
      if (!settingsSender(event)) throw new Error('permission_denied');
      if (result.canceled || !result.filePaths[0]) return null;
      const exported = await store.exportDataRoot(result.filePaths[0]);
      if (process.env.OMNI_EDU_E2E_DIALOG_MODE === '1' && !app.isPackaged) lastE2eDataBackupExportPath = exported.exportPath;
      return exported;
    };
    return xiaozhi.withLocalSettingsJob(action);
  });
  ipcMain.handle('app:verifyDataBackup', async event => {
    if (!settingsSender(event)) throw new Error('permission_denied');
    return xiaozhi.withLocalSettingsJob(async assertCurrent => {
      const result = await selectDataBackupVerifyRoot();
      assertCurrent();
      if (!settingsSender(event)) throw new Error('permission_denied');
      if (result.canceled || !result.filePaths[0]) return null;
      return store.verifyDataBackup(result.filePaths[0]);
    });
  });
  ipcMain.handle('students:list', (_event, query: string) => store.listStudents(query));
  ipcMain.handle('students:create', (_event, input) => store.createStudent(input));
  ipcMain.handle('students:update', (_event, id: string, input) => store.updateStudent(id, input));
  ipcMain.handle('students:archive', (_event, id: string) => store.archiveStudent(id));
  ipcMain.handle('students:openFolder', (_event, id: string) => openStudentFolder(id));
  ipcMain.handle('students:export', async (_event, id: string) => {
    const result = await selectStudentExportRoot();
    if (result.canceled || !result.filePaths[0]) return null;
    return store.exportStudentArchive(id, result.filePaths[0]);
  });
  ipcMain.handle('documents:exportArtifact', async (_event, input: DocumentArtifactExportInput) => {
    let destinationRoot = input.destinationRoot;
    if (!destinationRoot) {
      const result = await dialog.showOpenDialog({
        title: '选择小智文档产物导出位置',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (result.canceled || !result.filePaths[0]) return null;
      destinationRoot = result.filePaths[0];
    }
    return store.exportDocumentArtifact({ ...input, destinationRoot });
  });
  ipcMain.handle('documents:listArtifacts', (_event, sessionId?: string) => store.listDocumentArtifacts(sessionId));
  ipcMain.handle('documents:getArtifact', (_event, id: string) => store.getDocumentArtifact(id));
  ipcMain.handle('documents:showArtifact', async (_event, id: string) => {
    const artifact = await store.getDocumentArtifact(id);
    if (!artifact || artifact.status !== 'exported' || !artifact.filePath || !existsSync(artifact.filePath)) {
      throw new Error('文档产物文件不存在或尚未成功导出');
    }
    shell.showItemInFolder(artifact.filePath);
  });
  ipcMain.handle('aiObservability:getSnapshot', (_event, input?: Pick<AiRegressionReportInput, 'since' | 'until'>) =>
    store.buildAiTelemetrySnapshot(input ?? {}),
  );
  ipcMain.handle('aiObservability:createRegressionReport', (_event, input?: AiRegressionReportInput) =>
    store.createAiRegressionReport(input ?? {}),
  );
  ipcMain.handle('aiObservability:listRegressionReports', (_event, limit?: number) => store.listAiRegressionReports(limit));
  ipcMain.handle('aiObservability:getRegressionReport', (_event, id: string) => store.getAiRegressionReport(id));
  ipcMain.handle('aiObservability:createUsabilityReview', (_event, input: AiUsabilityHumanReviewInput) =>
    store.createAiUsabilityReview(input),
  );
  ipcMain.handle('aiObservability:listUsabilityReviews', (_event, limit?: number) => store.listAiUsabilityReviews(limit));
  ipcMain.handle('aiObservability:getUsabilityReviewSummary', (_event, input?: Pick<AiRegressionReportInput, 'since' | 'until'>) =>
    store.buildAiUsabilityReviewSummary(input ?? {}),
  );
  ipcMain.handle('aiObservability:createUsabilityReplayExperiment', (_event, input: AiUsabilityReplayExperimentInput) =>
    store.createAiUsabilityReplayExperiment(input),
  );
  ipcMain.handle('aiObservability:listUsabilityReplayExperiments', (_event, limit?: number) =>
    store.listAiUsabilityReplayExperiments(limit),
  );
  ipcMain.handle('aiObservability:getUsabilityReplaySummary', (_event, input?: Pick<AiRegressionReportInput, 'since' | 'until'>) =>
    store.buildAiUsabilityReplaySummary(input ?? {}),
  );
  ipcMain.handle('aiObservability:createModelGrade', (_event, input: AiModelGradeInput) => store.createAiModelGrade(input));
  ipcMain.handle('aiObservability:listModelGrades', (_event, limit?: number) => store.listAiModelGrades(limit));
  ipcMain.handle('aiObservability:getModelGradeSummary', (_event, input?: Pick<AiRegressionReportInput, 'since' | 'until'>) =>
    store.buildAiModelGradeSummary(input ?? {}),
  );
  ipcMain.handle('aiAgent:getRun', (_event, runId: string) => store.getAiAgentRun(runId));
  ipcMain.handle('aiAgent:listRuns', (_event, limit = 20) => store.listAiAgentRuns(limit));
  ipcMain.handle('aiAgent:listEvents', (_event, runId: string) => store.listAiAgentEvents(runId));
  ipcMain.handle('aiAgent:getMemoryTrace', (_event, runId: string, limit = 50) => store.getAiMemoryTrace(runId, limit));
  ipcMain.handle('aiMemory:listDocuments', () => store.listAiMemoryDocuments());
  ipcMain.handle('aiMemory:getDocument', (_event, surface: AiMemorySurface) => store.getAiMemoryDocument(surface));
  ipcMain.handle('aiMemory:draftSummary', (_event, surface: AiMemorySurface, runId?: string, limit = 8) => store.draftAiMemorySummary(surface, runId, limit));
  ipcMain.handle('aiMemory:listRevisions', (_event, entryId: string, limit = 50) => store.listAiMemoryRevisions(entryId, limit));
  ipcMain.handle('aiMemory:createEntry', (_event, input: AiMemoryEntryInput) => store.createAiMemoryEntry(input));
  ipcMain.handle('aiMemory:updateEntry', (_event, entryId: string, input: AiMemoryEntryUpdateInput) => store.updateAiMemoryEntry(entryId, input));
  ipcMain.handle('aiMemory:deleteEntry', (_event, entryId: string, version: number) => store.deleteAiMemoryEntry(entryId, version));
  ipcMain.handle('aiMemoryL3:listDocuments', () => store.listAiMemoryL3Documents());
  ipcMain.handle('aiMemoryL3:getDocument', (_event, slot: AiMemoryL3Slot) => store.getAiMemoryL3Document(slot));
  ipcMain.handle('aiMemoryL3:draft', (_event, slot: AiMemoryL3Slot, limit = 8) => store.draftAiMemoryL3(slot, limit));
  ipcMain.handle('aiMemoryL3:createEntry', (_event, input: AiMemoryL3EntryInput) => store.createAiMemoryL3Entry(input));
  ipcMain.handle('aiMemoryL3:updateEntry', (_event, entryId: string, input: AiMemoryL3EntryUpdateInput) => store.updateAiMemoryL3Entry(entryId, input));
  ipcMain.handle('aiMemoryGraph:get', (_event, limit = 200) => store.getAiMemoryEvidenceGraph(limit) as Promise<AiMemoryEvidenceGraph>);
  ipcMain.handle('aiMemoryGovernance:get', () => store.getAiMemoryGovernanceReport());
  ipcMain.handle('aiAgent:getPendingCheckpoint', (_event, runId: string) => store.getPendingAiCapabilityCheckpoint(runId));
  ipcMain.handle('aiAgent:getCheckpoint', (_event, checkpointId: string) => store.getAiCapabilityCheckpoint(checkpointId));
  ipcMain.handle('records:list', (_event, studentId: string, filters) => store.listRecords(studentId, filters));
  ipcMain.handle('records:create', (_event, input) => store.createRecord(input));
  ipcMain.handle('mastery:getPath', (_event, studentId: string) => store.getAiMasteryPath(studentId));
  ipcMain.handle('review:getReminder', async (_event, studentId: string): Promise<ReviewReminder> => {
    const safeStudentId = String(studentId ?? '').trim();
    if (!safeStudentId) throw new Error('缺少学生 ID，无法计算复习提醒。');
    const student = (await store.listStudents('')).find((item) => item.id === safeStudentId);
    if (!student) throw new Error('学生不存在，拒绝计算复习提醒。');
    const snapshot = await buildMasterySnapshot(store, safeStudentId);
    const policy = buildMasteryPolicy(snapshot);
    return buildReviewReminder(policy.points.map((point) => ({
      id: point.id,
      name: point.name,
      moduleId: point.moduleId,
      moduleName: point.moduleName,
      type: point.type,
      dueAt: point.nextReviewAt,
    })), Date.now() / 1000, 'UTC');
  });
  ipcMain.handle('records:update', (_event, recordId: string, input) => store.updateRecord(recordId, input));
  ipcMain.handle('notebooks:create', (_event, input) => store.createTeacherNotebook(input));
  ipcMain.handle('notebooks:list', (_event, includeDeleted = false) => store.listTeacherNotebooks(Boolean(includeDeleted)));
  ipcMain.handle('notebooks:update', (_event, id: string, input) => store.updateTeacherNotebook(id, input));
  ipcMain.handle('notebooks:delete', (_event, id: string) => store.deleteTeacherNotebook(id));
  ipcMain.handle('notebooks:restore', (_event, id: string) => store.restoreTeacherNotebook(id));
  ipcMain.handle('notebooks:listRecords', (_event, notebookId: string, includeDeleted = false) => store.listTeacherNotebookRecords(notebookId, Boolean(includeDeleted)));
  ipcMain.handle('notebooks:addRecord', (_event, input) => store.addTeacherNotebookRecord(input));
  ipcMain.handle('notebooks:updateRecord', (_event, id: string, input) => store.updateTeacherNotebookRecord(id, input));
  ipcMain.handle('notebooks:deleteRecord', (_event, id: string) => store.deleteTeacherNotebookRecord(id));
  ipcMain.handle('attachments:import', async (_event, studentId: string, recordId: string) => {
    const result = await selectAttachmentPaths();
    if (result.canceled) return { status: 'canceled', records: await store.listRecords(studentId), items: [] };
    return store.importAttachments(studentId, recordId, result.filePaths);
  });
  ipcMain.handle('attachments:show', async (_event, filePath: string) => {
    if (!(await store.isManagedLocalPath(filePath))) {
      throw new Error('只能打开本地数据目录内的附件');
    }
    shell.showItemInFolder(filePath);
  });
  ipcMain.handle('mistakeImages:createAnalysis', (_event, input) => store.createMistakeImageAnalysis(input));
  ipcMain.handle('mistakeImages:updateCorrection', (_event, id: string, input) => store.updateMistakeImageCorrection(id, input));
  ipcMain.handle('mistakeImages:list', (_event, studentId: string) => store.listMistakeImageAnalyses(studentId));
  ipcMain.handle('mistakeImages:sanitizeText', (_event, text: string, studentId?: string) => store.sanitizeProblemText(text, studentId));
  ipcMain.handle('reports:generate', (_event, input) => store.generateReview(input));
  ipcMain.handle('reports:update', (_event, id: string, contentMd: string, parentSummary?: string) => store.updateReport(id, contentMd, parentSummary));
  ipcMain.handle('reports:list', (_event, studentId: string) => store.listReports(studentId));
  ipcMain.handle('questionBank:create', (_event, input) => store.createQuestionBankItem(input));
  ipcMain.handle('questionBank:search', (_event, filters) => store.searchQuestionBank(filters));
  ipcMain.handle('questionNotebook:list', (_event, filters) => store.listQuestionNotebook(filters));
  ipcMain.handle('questionNotebook:getEntry', (_event, questionId: string) => store.getQuestionNotebookEntry(questionId));
  ipcMain.handle('questionNotebook:setBookmark', (_event, input) => store.setQuestionNotebookBookmark(input));
  ipcMain.handle('questionNotebook:listCategories', (_event, includeDeleted = false) => store.listQuestionNotebookCategories(includeDeleted));
  ipcMain.handle('questionNotebook:createCategory', (_event, input) => store.createQuestionNotebookCategory(input));
  ipcMain.handle('questionNotebook:updateCategory', (_event, id: string, input) => store.updateQuestionNotebookCategory(id, input));
  ipcMain.handle('questionNotebook:deleteCategory', (_event, id: string) => store.deleteQuestionNotebookCategory(id));
  ipcMain.handle('questionNotebook:restoreCategory', (_event, id: string) => store.restoreQuestionNotebookCategory(id));
  ipcMain.handle('questionNotebook:addCategory', (_event, questionId: string, categoryId: string) => store.addQuestionNotebookCategory(questionId, categoryId));
  ipcMain.handle('questionNotebook:removeCategory', (_event, questionId: string, categoryId: string) => store.removeQuestionNotebookCategory(questionId, categoryId));
  ipcMain.handle('questionNotebook:recordUsage', (_event, input) => store.recordQuestionBankUsage(input));
  ipcMain.handle('questionNotebook:listUsage', (_event, questionId: string, limit = 20) => store.listQuestionNotebookUsage(questionId, limit));
  ipcMain.handle('teachingBook:create', (_event, input) => store.createTeachingBook(input));
  ipcMain.handle('teachingBook:list', (_event, includeDeleted = false) => store.listTeachingBooks(includeDeleted));
  ipcMain.handle('teachingBook:get', (_event, id: string) => store.getTeachingBook(id));
  ipcMain.handle('teachingBook:previewMarkdown', async (_event, id: string) => {
    const detail = await store.getTeachingBook(id);
    if (!detail) throw new Error('指定讲义不存在、已归档或不属于当前本地工作区');
    const rendered = renderTeachingBookMarkdown(detail);
    return { ...rendered, requiresTeacherReview: true as const, writesFile: false as const };
  });
  ipcMain.handle('teachingBook:update', (_event, id: string, input) => store.updateTeachingBook(id, input));
  ipcMain.handle('teachingBook:delete', (_event, id: string) => store.deleteTeachingBook(id));
  ipcMain.handle('teachingBook:createChapter', (_event, input) => store.createTeachingBookChapter(input));
  ipcMain.handle('teachingBook:createPage', (_event, input) => store.createTeachingBookPage(input));
  ipcMain.handle('teachingBook:upsertBlock', (_event, input, id?: string, version?: number) => store.upsertTeachingBookBlock(input, id, version));
  ipcMain.handle('teachingBook:addSource', (_event, input) => store.addTeachingBookSource(input));
  ipcMain.handle('teachingBook:regenerateBlock', (_event, id: string, version: number) => store.regenerateTeachingBookBlock(id, version));
  ipcMain.handle('teachingBook:regeneratePage', (_event, id: string, version: number) => store.regenerateTeachingBookPage(id, version));
  ipcMain.handle('teachingBook:health', (_event, id: string) => store.getTeachingBookHealth(id));
  ipcMain.handle('teachingBook:refreshHealth', (_event, id: string) => store.refreshTeachingBookHealth(id));
  ipcMain.handle('teachingBook:listInvalidations', (_event, id: string, includeResolved = false) => store.listTeachingBookInvalidations(id, includeResolved));
  ipcMain.handle('teachingBook:proposePatch', (_event, input) => store.proposeTeachingBookBlockPatch(input));
  ipcMain.handle('teachingBook:proposeSelectionPatch', (_event, input) => store.proposeTeachingBookSelectionPatch(input));
  ipcMain.handle('teachingBook:applyPatch', (_event, id: string) => store.applyTeachingBookPatch(id));
  ipcMain.handle('teachingBook:undoPatch', (_event, id: string) => store.undoTeachingBookPatch(id));
  ipcMain.handle('teachingBook:listPatches', (_event, id: string) => store.listTeachingBookPatches(id));
  ipcMain.handle('exerciseSets:list', (_event, studentId: string) => store.listExerciseSets(studentId));
  ipcMain.handle('aiConfirmations:list', (_event, status = 'pending') => store.listAiConfirmations(status));
  ipcMain.handle('aiConfirmations:confirm', (_event, id: string, edits?: AiExerciseSetTeacherEdits) => store.confirmAiConfirmation(id, edits));
  ipcMain.handle('aiConfirmations:reject', (_event, id: string) => store.rejectAiConfirmation(id));
  ipcMain.handle('search:all', (_event, keyword: string) => store.search(keyword));
  ipcMain.handle('aiConversations:list', () => store.listAiConversationWorkspace());
  ipcMain.handle('aiConversations:createFolder', (_event, input: AiConversationFolderInput) => store.createAiConversationFolder(input));
  ipcMain.handle('aiConversations:createSession', async(event, input: AiConversationSessionInput) => {
    if(!settingsSender(event))throw new Error('permission_denied');
    const {plainStudentInput,validStudentId}=await import('../shared/student-context');
    if(!plainStudentInput(input,['title','folderId','studentId'])||input.title!==undefined&&typeof input.title!=='string'||input.folderId!==undefined&&input.folderId!==null&&typeof input.folderId!=='string')throw new Error('invalid_input');
    if(input.studentId!==undefined&&input.studentId!==''){if(!validStudentId(input.studentId))throw new Error('invalid_input');await store.studentContext.snapshot(input.studentId);}
    return store.createAiConversationSession(input);
  });
  ipcMain.handle('aiConversations:getSession', (_event, sessionId: string) => store.getAiConversationSession(sessionId));
  ipcMain.handle('aiConversations:appendMessage', (_event, sessionId: string, input: AiConversationMessageInput) =>
    store.appendAiConversationMessage(sessionId, input),
  );
  ipcMain.handle('aiConversations:moveSession', (_event, sessionId: string, folderId: string | null) =>
    store.moveAiConversationSession(sessionId, folderId),
  );
  ipcMain.handle('aiConversations:renameFolder', (_event, folderId: string, input: AiConversationFolderUpdateInput) =>
    store.renameAiConversationFolder(folderId, input),
  );
  ipcMain.handle('aiConversations:renameSession', (_event, sessionId: string, input: AiConversationSessionUpdateInput) =>
    store.renameAiConversationSession(sessionId, input),
  );
  ipcMain.handle('aiConversations:archiveFolder', (_event, folderId: string) =>
    store.archiveAiConversationFolder(folderId),
  );
  ipcMain.handle('aiConversations:archiveSession', (_event, sessionId: string) =>
    store.archiveAiConversationSession(sessionId),
  );

  const xiaozhi = registerXiaozhiIpc({ ipcMain, store, authority, dataRoot, window: () => mainWindow });
  const mistakeOcr=registerMistakeOcrIpc({ipcMain,repository:store.mistakeOcr,facts:store.mistakeFacts,allowed:event=>!!mainWindow&&!mainWindow.isDestroyed()&&event.sender===mainWindow.webContents&&event.senderFrame===mainWindow.webContents.mainFrame});
  const piConsole = createPiConsoleFacade({store,host:xiaozhi});
  if (authority.mode === 'pi') registerPiConsoleEndpoints({ipcMain,authority,window:()=>mainWindow,run:input=>piConsole.run(input)});
  let xiaozhiClosing = false;
  app.on('before-quit', event => {
    if (xiaozhiClosing) return;
    event.preventDefault(); xiaozhiClosing = true;
    void Promise.allSettled([xiaozhi.close(),mistakeOcr.close()]).finally(() => app.quit());
  });
  registerDesktopChromeIpc(ipcMain, () => mainWindow);
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
