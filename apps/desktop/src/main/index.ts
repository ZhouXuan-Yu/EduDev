import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { existsSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runDeepSeekChat } from './deepseek';
import { OmniEduStore } from './db';
import type {
  AiAgentTraceStep,
  AiConfirmationItem,
  AiConsoleRunInput,
  AiConsoleRunResult,
  AiConversationFolderInput,
  AiConversationFolderUpdateInput,
  AiConversationMessageInput,
  AiConversationSessionInput,
  AiConversationSessionUpdateInput,
  DeepSeekSettingsInput,
  DocumentArtifactExportInput,
} from '../shared/contracts';
import { routeAiPrompt } from './ai-harness/router';
import { runAiAgentLoop } from './ai-harness/agent-loop';

let store: OmniEduStore;

app.setName('OmniEduAgent');

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 1360,
    height: 900,
    minWidth: 1100,
    minHeight: 720,
    title: 'Omni-Edu Agent',
    backgroundColor: '#eef1f3',
    webPreferences: {
      preload: join(__dirname, '../preload/index.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
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

  if (process.env.ELECTRON_RENDERER_URL) {
    mainWindow.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'));
  }
}

function loadLocalEnv() {
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

function defaultAiReportRange() {
  const end = new Date();
  const start = new Date(end.getTime() - 30 * 86400000);
  return {
    startDate: start.toISOString().slice(0, 10),
    endDate: end.toISOString().slice(0, 10),
  };
}

async function createAiConfirmationsFromResult(
  input: AiConsoleRunInput,
  result: AiConsoleRunResult,
  agentRunId: string,
): Promise<AiConfirmationItem[]> {
  if (!result.ok || !input.studentId || !result.structuredReply) return [];
  const confirmations: AiConfirmationItem[] = [];
  const reportArtifact = result.structuredReply.artifacts.find(
    (artifact) => artifact.type === 'report_draft' && artifact.requiresTeacherConfirmation,
  );
  const contentMd = result.structuredReply.answerMarkdown.trim();
  if (contentMd && (reportArtifact || result.structuredReply.route === 'report_draft')) {
    const range = defaultAiReportRange();
    const title = reportArtifact?.title || '小智复盘草稿';
    confirmations.push(await store.createAiConfirmation({
      runId: agentRunId,
      sessionId: input.sessionId,
      studentId: input.studentId,
      actionType: 'create_review_report',
      title,
      description: reportArtifact?.description || '小智生成的复盘报告草稿，确认后才保存到本地报告库。',
      previewMd: contentMd,
      payload: {
        studentId: input.studentId,
        subject: '',
        startDate: range.startDate,
        endDate: range.endDate,
        reportType: 'ai_draft',
        title,
        contentMd,
        parentSummary: result.structuredReply.nextActions.join('；').slice(0, 240),
        sourceRecordIds: result.structuredReply.evidence
          .map((item) => item.sourceId)
          .filter((sourceId) => sourceId.startsWith('record_')),
      },
    }));
  }

  const exerciseArtifact = result.structuredReply.artifacts.find(
    (artifact) => artifact.type === 'exercise_set' && artifact.requiresTeacherConfirmation,
  );
  if (contentMd && exerciseArtifact) {
    const similarQuestions = result.similarQuestions ?? [];
    const title = exerciseArtifact.title || '小智三元题组草稿';
    confirmations.push(await store.createAiConfirmation({
      runId: agentRunId,
      sessionId: input.sessionId,
      studentId: input.studentId,
      actionType: 'save_exercise_set',
      title,
      description: exerciseArtifact.description || '小智生成的三元题组草稿，确认后才保存到本地题组库。',
      previewMd: contentMd,
      payload: {
        studentId: input.studentId,
        subject: result.structuredReply.routeCheck.kind === 'practice_design' ? result.structuredReply.routeCheck.notes.find((note) => note.includes('数学')) ?? '' : '',
        startDate: '',
        endDate: '',
        reportType: 'exercise_set',
        title,
        contentMd,
        sourceRecordIds: result.structuredReply.evidence
          .map((item) => item.sourceId)
          .filter((sourceId) => sourceId.startsWith('record_')),
        exerciseSet: {
          title,
          subject: result.harness?.router.slots.subject ?? '',
          knowledgePoint: result.harness?.router.slots.knowledgePoint ?? '',
          contentMd,
          sourceQuestionIds: similarQuestions.map((item) => item.id),
          items: similarQuestions.slice(0, 3).map((question, index) => ({
            role: index === 0 ? 'original' : 'similar',
            questionId: question.id,
            sourceKind: question.sourceKind,
            stem: question.stem,
            answer: question.answer,
            analysis: question.analysis,
            knowledgePoint: question.knowledgePoint,
            difficulty: question.difficulty,
            teacherObservation: `观察学生是否能迁移 ${question.knowledgePoint || '当前知识点'}。`,
          })),
        },
      },
    }));
  }

  return confirmations;
}

app.whenReady().then(async () => {
  loadLocalEnv();
  store = new OmniEduStore(process.env.OMNI_EDU_DATA_ROOT || join(app.getPath('userData'), 'OmniEduData'));
  await store.init();

  ipcMain.handle('app:bootstrap', () => store.init());
  ipcMain.handle('app:getDataRoot', () => store.getDataRoot());
  ipcMain.handle('app:getPlatformOverview', () => store.getPlatformOverview());
  ipcMain.handle('settings:getDeepSeek', () => store.getDeepSeekSettings());
  ipcMain.handle('settings:saveDeepSeek', (_event, input: DeepSeekSettingsInput) => store.saveDeepSeekSettings(input));
  ipcMain.handle('knowledge:getOverview', () => store.getKnowledgeOverview());
  ipcMain.handle('knowledge:import', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择要导入教师知识库的资源',
      properties: ['openFile', 'multiSelections'],
      filters: [
        { name: '教学资源', extensions: ['pdf', 'doc', 'docx', 'ppt', 'pptx', 'xls', 'xlsx', 'jpg', 'jpeg', 'png', 'webp', 'bmp', 'md', 'txt'] },
        { name: '全部文件', extensions: ['*'] },
      ],
    });
    if (result.canceled) return store.importKnowledgeResources([]);
    return store.importKnowledgeResources(result.filePaths);
  });
  ipcMain.handle('knowledge:importPaths', (_event, sourcePaths: string[]) => store.importKnowledgeResources(sourcePaths));
  ipcMain.handle('knowledge:showResource', async (_event, filePath: string) => {
    if (!(await store.isManagedLocalPath(filePath))) {
      throw new Error('只能打开本地数据目录内的知识资源');
    }
    shell.showItemInFolder(filePath);
  });
  ipcMain.handle('app:exportDataRoot', async () => {
    const result = await dialog.showOpenDialog({
      title: '选择完整数据目录备份位置',
      properties: ['openDirectory', 'createDirectory'],
    });
    if (result.canceled || !result.filePaths[0]) return null;
    return store.exportDataRoot(result.filePaths[0]);
  });
  ipcMain.handle('students:list', (_event, query: string) => store.listStudents(query));
  ipcMain.handle('students:create', (_event, input) => store.createStudent(input));
  ipcMain.handle('students:update', (_event, id: string, input) => store.updateStudent(id, input));
  ipcMain.handle('students:archive', (_event, id: string) => store.archiveStudent(id));
  ipcMain.handle('students:openFolder', (_event, id: string) => shell.openPath(store.getStudentFolder(id)));
  ipcMain.handle('students:export', async (_event, id: string) => {
    const result = await dialog.showOpenDialog({
      title: '选择学生档案导出位置',
      properties: ['openDirectory', 'createDirectory'],
    });
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
  ipcMain.handle('records:list', (_event, studentId: string, filters) => store.listRecords(studentId, filters));
  ipcMain.handle('records:create', (_event, input) => store.createRecord(input));
  ipcMain.handle('records:update', (_event, recordId: string, input) => store.updateRecord(recordId, input));
  ipcMain.handle('attachments:import', async (_event, studentId: string, recordId: string) => {
    const result = await dialog.showOpenDialog({
      title: '选择要复制到学生档案的附件',
      properties: ['openFile', 'multiSelections'],
    });
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
  ipcMain.handle('exerciseSets:list', (_event, studentId: string) => store.listExerciseSets(studentId));
  ipcMain.handle('aiConfirmations:list', (_event, status = 'pending') => store.listAiConfirmations(status));
  ipcMain.handle('aiConfirmations:confirm', (_event, id: string) => store.confirmAiConfirmation(id));
  ipcMain.handle('aiConfirmations:reject', (_event, id: string) => store.rejectAiConfirmation(id));
  ipcMain.handle('search:all', (_event, keyword: string) => store.search(keyword));
  ipcMain.handle('aiConversations:list', () => store.listAiConversationWorkspace());
  ipcMain.handle('aiConversations:createFolder', (_event, input: AiConversationFolderInput) => store.createAiConversationFolder(input));
  ipcMain.handle('aiConversations:createSession', (_event, input: AiConversationSessionInput) => store.createAiConversationSession(input));
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
  ipcMain.handle('ai:runDeepSeek', async (_event, input: AiConsoleRunInput) => {
    const deepSeekSettings = await store.getDeepSeekRuntimeSettings();
    const apiKey = deepSeekSettings.apiKey;
    const prompt = input.prompt?.trim() ?? '';
    const router = routeAiPrompt(prompt, { hasStudent: Boolean(input.studentId) });
    const agentRunId = await store.startAiAgentRun({
      sessionId: input.sessionId,
      prompt,
      route: router.route,
      subIntent: router.subIntent,
      model: deepSeekSettings.model,
      studentId: input.studentId,
    });

    if (!prompt) {
      const trace: AiAgentTraceStep[] = [
        {
          phase: 'guardrail',
          status: 'blocked',
          label: '输入校验',
          detail: '任务为空，未执行路由后的工具调用。',
          inputSummary: { promptLength: 0 },
          outputSummary: { blockedReason: 'empty_prompt' },
        },
      ];
      for (const step of trace) await store.recordAiAgentEvent(agentRunId, step);
      const result: AiConsoleRunResult = {
        ok: false,
        model: deepSeekSettings.model,
        content: '',
        toolRuns: [],
        sources: [],
        harness: {
          agentRunId,
          router,
          selectedContext: [],
          schemaValid: false,
          schemaErrors: ['请输入 AI 任务。'],
          trace,
        },
        errorMessage: '请输入 AI 任务。',
      };
      await store.completeAiAgentRun(agentRunId, 'blocked', result.errorMessage);
      await store.recordAiConsoleRun(input, result);
      return result;
    }

    try {
      const context = await runAiAgentLoop({ store, prompt, studentId: input.studentId, agentRunId });

      if (!apiKey) {
        const configStep: AiAgentTraceStep = {
          phase: 'guardrail',
          status: 'blocked',
          label: 'DeepSeek 配置',
          detail: '缺少 DeepSeek API Key，已保留本地路由与工具轨迹，但未进入模型调用。',
          outputSummary: { blockedReason: 'missing_deepseek_api_key' },
        };
        context.trace.push(configStep);
        await store.recordAiAgentEvent(agentRunId, configStep);
        const result: AiConsoleRunResult = {
          ok: false,
          model: deepSeekSettings.model,
          content: '',
          toolRuns: context.toolRuns,
          sources: context.sources,
          knowledgeSnippets: context.knowledgeSnippets,
          graphNodes: context.graphNodes,
          similarQuestions: context.similarQuestions,
          harness: {
            agentRunId,
            router: context.router,
            selectedContext: context.selectedContext,
            schemaValid: false,
            schemaErrors: ['缺少 DeepSeek API Key。'],
            trace: context.trace,
          },
          errorMessage: '缺少 DeepSeek API Key。请在设置页保存 DeepSeek API 配置。',
        };
        await store.completeAiAgentRun(agentRunId, 'blocked', result.errorMessage);
        await store.recordAiConsoleRun(input, result);
        return result;
      }

      const result = await runDeepSeekChat({ store, prompt, ...context }, apiKey, deepSeekSettings.model);
      const confirmations = await createAiConfirmationsFromResult(input, result, agentRunId);
      if (confirmations.length) {
        const confirmationStep: AiAgentTraceStep = {
          phase: 'guardrail',
          status: 'pending',
          label: '写入确认',
          detail: `已创建 ${confirmations.length} 个待老师确认的本地写入项；确认前不会写入报告库。`,
          outputSummary: { confirmationIds: confirmations.map((item) => item.id) },
        };
        result.confirmations = confirmations;
        result.harness?.trace.push(confirmationStep);
        await store.recordAiAgentEvent(agentRunId, confirmationStep);
      }
      await store.completeAiAgentRun(agentRunId, confirmations.length ? 'waiting_confirmation' : result.ok ? 'succeeded' : 'failed', result.errorMessage ?? '');
      await store.recordAiConsoleRun(input, result);
      return result;
    } catch (error) {
      const message = error instanceof Error ? error.message : '小智 Agent 运行失败。';
      await store.completeAiAgentRun(agentRunId, 'failed', message);
      throw error;
    }
  });

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
