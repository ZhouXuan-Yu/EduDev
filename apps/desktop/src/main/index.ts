import { app, BrowserWindow, dialog, ipcMain, shell } from 'electron';
import { randomUUID } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';
import { buildAiSystemPrompt, recoverStructuredJsonCompletion, requestDeepSeekCompletion, requestStructuredReplyRepair, runDeepSeekChat, type DeepSeekMessage } from './deepseek';
import { OmniEduStore } from './db';
import type {
  AiAgentEvent,
  AiAgentTraceStep,
  XiazhiCapabilityEvent,
  XiazhiCapabilityRequest,
  XiazhiModelRequest,
  XiazhiModelResult,
  XiazhiUserInputRequest,
  XiazhiUserInputResult,
  AiConfirmationItem,
  AiConfirmationPayload,
  AiMasteryPathModule,
  AiConsoleRunInput,
  AiConsoleRunResult,
  AiConsoleToolRun,
  AiConversationFolderInput,
  AiConversationFolderUpdateInput,
  AiConversationMessageInput,
  AiConversationSessionInput,
  AiConversationSessionUpdateInput,
  AiModelGradeInput,
  AiRegressionReportInput,
  AiUsabilityHumanReviewInput,
  AiUsabilityReplayExperimentInput,
  DeepSeekSettingsInput,
  DocumentArtifactExportInput,
  AiMemorySurface,
  AiMemoryEntryInput,
  AiMemoryEntryUpdateInput,
  AiMemoryL3Slot,
  AiMemoryL3EntryInput,
  AiMemoryL3EntryUpdateInput,
  AiMemoryEvidenceGraph,
  ReviewReminder,
  XiazhiContinuationResult,
  XiazhiRunMutationAction,
  XiazhiRunMutationResult,
} from '../shared/contracts';
import { routeAiPrompt } from './ai-harness/router';
import { runAiAgentLoop } from './ai-harness/agent-loop';
import { parseStructuredReply, structuredReplyToMarkdown } from './ai-harness/schema';
import { boundDeepTutorEventDetail } from './ai-harness/deeptutor-event-bounds';
import { getModelToolDefinitions, progressiveToolNames, type CompiledAiContext } from './ai-harness/tool-registry';
import { DeepTutorSidecarClient } from './ai-harness/sidecar-client';
import { executeHostToolRequest } from './ai-harness/host-tool-proxy';
import {
  isConsoleRunPendingStatus,
  selectDeepTutorCapability,
  XIAZHI_AGENT_HARNESS_VERSION,
} from './ai-harness/agent-harness-profile';
import { buildMasterySnapshot } from './ai-harness/mastery-snapshot';
import { buildMasteryPolicy } from './ai-harness/mastery-policy';
import { buildReviewReminder } from './ai-harness/review-reminder';
import { renderTeachingBookMarkdown } from './ai-harness/teaching-book-renderer';
import { gradeEducationalReply } from './ai-harness/education-grader';
import { gradeUsabilityReply } from './ai-harness/usability-policy';

let store: OmniEduStore;
let deepTutorSidecar: DeepTutorSidecarClient | undefined;
let mainWindow: BrowserWindow | undefined;
let e2eAttachmentDialogQueue: string[][] | undefined;
let e2eStudentExportDialogQueue: string[][] | undefined;
let e2eDataBackupExportDialogQueue: string[] | undefined;
let e2eDataBackupVerifyDialogQueue: string[] | undefined;
let lastE2eDataBackupExportPath = '';

function resolveRepoRoot() {
  const explicit = process.env.OMNI_EDU_REPO_ROOT?.trim();
  const seeds = [explicit, process.cwd(), app.getAppPath()].filter((value): value is string => Boolean(value));
  const visited = new Set<string>();
  for (const seed of seeds) {
    let candidate = resolve(seed);
    for (let depth = 0; depth < 7; depth += 1) {
      if (visited.has(candidate)) break;
      visited.add(candidate);
      if (existsSync(join(candidate, 'python', 'omni_edu_deeptutor_bridge', '__main__.py'))) return candidate;
      const parent = dirname(candidate);
      if (parent === candidate) break;
      candidate = parent;
    }
  }
  throw new Error('无法定位 Omni-Edu 仓库根目录，DeepTutor Python Sidecar 未启动。可通过 OMNI_EDU_REPO_ROOT 显式配置。');
}

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

type DeepTutorRunBinding = {
  runId: string;
  turnId: string;
  capability: XiazhiCapabilityRequest['capability'];
  sessionId?: string;
  studentId?: string;
  queue: Promise<void>;
  /** AgentLoop events accepted by the host for this turn. */
  maxEvents: number;
  persistedEvents: number;
  requestSnapshot: XiazhiCapabilityRequest;
  parentRunId?: string;
  continuationCount: number;
  errorMessage?: string;
  capabilityResultRecorded?: boolean;
  masteryConfirmationRecorded?: boolean;
  toolState?: CompiledAiContext;
  timeoutHandle?: NodeJS.Timeout;
  terminalRecoveryScheduled?: boolean;
};

const deepTutorRuns = new Map<string, DeepTutorRunBinding>();
const pendingDeepTutorInputs = new Map<string, {
  runId: string;
  checkpointId: string;
  request: XiazhiUserInputRequest;
  resolve?: (result: XiazhiUserInputResult) => void;
  requestSnapshot?: XiazhiCapabilityRequest;
  rehydrated?: boolean;
}>();

function boundedDeepTutorText(value: unknown, limit = 8000) {
  const text = String(value ?? '');
  return text.length <= limit ? text : `${text.slice(0, limit)}...[truncated]`;
}

function handleDeepTutorSidecarExit(error: Error) {
  const detail = `DeepTutor sidecar disconnected: ${boundedDeepTutorText(error.message, 800)}`;
  for (const [turnId, binding] of [...deepTutorRuns.entries()]) {
    if (binding.timeoutHandle) clearTimeout(binding.timeoutHandle);
    const next = binding.queue.then(async () => {
      try {
        await store.recordAiAgentEvent(binding.runId, {
          phase: 'guardrail',
          status: 'failed',
          label: 'DeepTutor sidecar disconnected',
          detail,
          outputSummary: { recovery: 'fail_closed', turnId },
        });
        await store.completeAiAgentRun(binding.runId, 'failed', detail);
      } catch {
        // Keep the process-level recovery path best-effort; the run must not remain in memory.
      } finally {
        deepTutorRuns.delete(turnId);
      }
    });
    binding.queue = next;
  }
  for (const [requestId, pending] of [...pendingDeepTutorInputs.entries()]) {
    void (async () => {
      try {
        for (const question of pending.request.questions ?? []) {
          if (question.id.startsWith('mastery_question_')) await store.cancelAiMasteryQuestion(question.id);
        }
        await store.resolveAiCapabilityCheckpoint(pending.checkpointId, 'cancelled', { requestId, reason: 'sidecar_disconnected' });
      } catch {
        // The terminal run state is still handled by the run binding above.
      } finally {
        pendingDeepTutorInputs.delete(requestId);
        pending.resolve?.({
          schemaVersion: 'xiazhi.user_input.result.v1',
          requestId,
          turnId: pending.request.turnId,
          status: 'cancelled',
          text: '',
        });
      }
    })();
  }
}

function sanitizeDeepTutorMessages(messages: Array<Record<string, unknown>>): DeepSeekMessage[] {
  return messages.slice(0, 64).map((message) => {
    const role = message.role === 'system' || message.role === 'assistant' || message.role === 'tool' || message.role === 'user'
      ? message.role
      : 'user';
    const content = message.content === null ? null : boundedDeepTutorText(message.content, 20_000);
    const toolCalls = Array.isArray(message.tool_calls)
      ? message.tool_calls.slice(0, 8).map((call) => {
          const item = call && typeof call === 'object' ? call as Record<string, unknown> : {};
          const fn = item.function && typeof item.function === 'object' ? item.function as Record<string, unknown> : {};
          return {
            id: boundedDeepTutorText(item.id, 120),
            type: 'function' as const,
            function: {
              name: boundedDeepTutorText(fn.name, 120),
              arguments: boundedDeepTutorText(fn.arguments, 4_000),
            },
          };
        })
      : undefined;
    return {
      role,
      content,
      ...(toolCalls?.length ? { tool_calls: toolCalls } : {}),
      ...(typeof message.tool_call_id === 'string' ? { tool_call_id: boundedDeepTutorText(message.tool_call_id, 120) } : {}),
    };
  });
}

async function executeDeepTutorModelRequest(request: XiazhiModelRequest): Promise<XiazhiModelResult> {
  const base = {
    schemaVersion: 'xiazhi.model.result.v1' as const,
    requestId: request.requestId,
    turnId: request.turnId,
  };
  const settings = await store.getDeepSeekRuntimeSettings();
  if (!settings.apiKey) {
    return { ...base, status: 'blocked', error: { code: 'MISSING_MODEL_CREDENTIAL', message: 'DeepSeek API Key 未配置，模型请求已在 Electron main 阻断。', retryable: false } };
  }
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  try {
    const tools = Array.isArray(request.tools) ? request.tools as ReturnType<typeof import('./ai-harness/tool-registry').getModelToolDefinitions> : undefined;
    const messages = sanitizeDeepTutorMessages(request.messages);
    const initial = await requestDeepSeekCompletion({
      apiKey: settings.apiKey,
      model: settings.model,
      messages,
      tools,
      temperature: typeof request.temperature === 'number' ? Math.max(0, Math.min(1, request.temperature)) : 0.2,
      maxTokens: typeof request.maxTokens === 'number' ? Math.max(128, Math.min(8_000, Math.trunc(request.maxTokens))) : 2_000,
      // Tool rounds need the provider's native tool-call envelope. Once the
      // AgentLoop has no tools left, force JSON mode so the final console
      // response targets the local xiazhi.reply.v2 contract. The parser and
      // one-shot repair below remain the fail-closed backstop for providers
      // that ignore JSON mode.
      responseFormat: Array.isArray(request.tools) && request.tools.length ? 'none' : 'json_object',
      signal: controller.signal,
    });
    const recovered = tools?.length
      ? { response: initial, recovery: { attempted: false } }
      : await recoverStructuredJsonCompletion({
          initial,
          apiKey: settings.apiKey,
          model: settings.model,
          messages,
          signal: controller.signal,
        });
    const response = recovered.response;
    return {
      ...base,
      status: 'succeeded',
      response: {
        choices: (response.choices ?? []).slice(0, 4) as Array<Record<string, unknown>>,
        usage: response.usage as Record<string, unknown> | undefined,
        recovery: recovered.recovery,
      },
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ...base, status: 'failed', error: { code: 'MODEL_PROVIDER_ERROR', message: boundedDeepTutorText(message, 800), retryable: true } };
  } finally {
    clearTimeout(timeout);
  }
}

function mapDeepTutorEvent(event: XiazhiCapabilityEvent): AiAgentTraceStep {
  const phase: AiAgentTraceStep['phase'] = event.phase === 'tool_request'
    ? 'tool_call'
    : event.phase === 'tool_result'
      ? 'observe'
      : event.phase === 'result'
        ? 'finalize'
        : event.phase === 'error' || event.phase === 'done'
          ? 'guardrail'
          : 'plan';
  const status: AiAgentTraceStep['status'] = event.status === 'succeeded'
    ? 'succeeded'
    : event.status === 'failed'
      ? 'failed'
      : event.status === 'cancelled'
        ? 'blocked'
        : 'running';
  const summary = event.publicSummary && typeof event.publicSummary === 'object'
    ? event.publicSummary
    : {};
  const toolName = typeof summary.toolName === 'string' ? summary.toolName : undefined;
  const sidecarSummary = { ...summary, sidecarSequence: event.sequence, sidecarPhase: event.phase };
  return {
    phase,
    status,
    label: boundedDeepTutorText(event.label, 240),
    detail: boundDeepTutorEventDetail(event.phase, event.detail),
    toolName,
    inputSummary: event.phase === 'tool_request' ? sidecarSummary : undefined,
    outputSummary: event.phase !== 'tool_request' ? sidecarSummary : undefined,
  };
}

const MAX_DEEPTUTOR_CONTINUATIONS = 3;

function buildDeepTutorBudgetDoneEvent(
  binding: DeepTutorRunBinding,
  continuationToken = '',
): XiazhiCapabilityEvent {
  const continuationAvailable = Boolean(continuationToken);
  return {
    schemaVersion: 'xiazhi.capability.event.v1',
    turnId: binding.turnId,
    sequence: binding.persistedEvents + 1,
    phase: 'done',
    status: continuationAvailable ? 'cancelled' : 'failed',
    label: 'DeepTutor event budget exhausted',
    detail: continuationAvailable
      ? `The host accepted ${binding.persistedEvents} AgentLoop events and paused this turn at its ${binding.maxEvents}-event budget. Continue with the supplied one-time token to resume the bounded task.`
      : `The host accepted ${binding.persistedEvents} AgentLoop events and stopped the turn at its ${binding.maxEvents}-event budget. The continuation limit has been reached.`,
    publicSummary: {
      runId: binding.runId,
      terminationReason: 'budget_exhausted',
      maxEvents: binding.maxEvents,
      persistedEvents: binding.persistedEvents,
      continuationAvailable,
      ...(continuationAvailable ? { continuationToken } : {}),
      hardStop: true,
    },
  };
}

async function recoverDeepTutorEventBudget(binding: DeepTutorRunBinding) {
  if (binding.terminalRecoveryScheduled) return;
  binding.terminalRecoveryScheduled = true;
  let continuationToken = '';
  try {
    if (binding.continuationCount < MAX_DEEPTUTOR_CONTINUATIONS) {
      const events = await store.listAiAgentEvents(binding.runId);
      const visibleSummary = events
        .filter((event) => event.phase === 'finalize' || event.phase === 'observe')
        .slice(-3)
        .map((event) => `${event.phase}: ${boundedDeepTutorText(event.detail, 2_000)}`)
        .join('\n')
        .slice(-6_000);
      continuationToken = `cont_${randomUUID()}`;
      await store.createAiCapabilityCheckpoint({
        runId: binding.runId,
        capabilityName: binding.capability,
        checkpointType: 'continuation',
        state: {
          continuationToken,
          continuationCount: binding.continuationCount,
          sourceRunId: binding.runId,
          sourceTurnId: binding.turnId,
          request: binding.requestSnapshot,
          visibleSummary,
        },
        expiresAt: new Date(Date.now() + 10 * 60_000).toISOString(),
      });
    }
    const doneEvent = buildDeepTutorBudgetDoneEvent(binding, continuationToken);
    await store.recordAiAgentEvent(binding.runId, {
      phase: 'guardrail',
      status: continuationToken ? 'blocked' : 'failed',
      label: doneEvent.label,
      detail: doneEvent.detail,
      outputSummary: doneEvent.publicSummary,
    });
    await store.completeAiAgentRun(
      binding.runId,
      continuationToken ? 'blocked' : 'failed',
      continuationToken
        ? 'DeepTutor event budget exhausted; continue with the one-time continuation token.'
        : 'DeepTutor event budget exhausted; the continuation limit was reached.',
    );
  } finally {
    if (binding.timeoutHandle) clearTimeout(binding.timeoutHandle);
    deepTutorRuns.delete(binding.turnId);
    void deepTutorSidecar?.cancelTurn(binding.turnId).catch(() => undefined);
    const doneEvent = buildDeepTutorBudgetDoneEvent(binding, continuationToken);
    mainWindow?.webContents.send('ai:deepTutorEvent', doneEvent);
  }
}

async function persistDeepQuestionConfirmation(binding: DeepTutorRunBinding, event: XiazhiCapabilityEvent) {
  if (binding.capability !== 'deep_question' || binding.capabilityResultRecorded || !binding.studentId) return;
  const summary = event.publicSummary?.summary;
  if (!summary || typeof summary !== 'object') return;
  const rawResults: unknown[] = Array.isArray((summary as Record<string, unknown>).results)
    ? (summary as Record<string, unknown>).results as unknown[]
    : [];
  type DeepQuestionItem = {
    role: 'variant';
    questionId: string;
    sourceKind: 'generated';
    stem: string;
    answer: string;
    analysis: string;
    knowledgePoint: string;
    difficulty: 'easy' | 'medium' | 'hard';
    teacherObservation: string;
  };
  const items: DeepQuestionItem[] = rawResults.slice(0, 12).flatMap((raw: unknown, index: number): DeepQuestionItem[] => {
    const result = raw && typeof raw === 'object' ? raw as Record<string, unknown> : {};
    const qa = result.qa_pair && typeof result.qa_pair === 'object' ? result.qa_pair as Record<string, unknown> : {};
    const stem = boundedDeepTutorText(qa.question, 2_000).trim();
    const answer = boundedDeepTutorText(qa.correct_answer, 2_000).trim();
    const analysis = boundedDeepTutorText(qa.explanation, 2_000).trim();
    if (!stem || !answer || answer === 'N/A' || answer === '暂无') return [];
    const rawDifficulty = String(qa.difficulty || 'medium').toLowerCase();
    const difficulty = rawDifficulty === 'easy' || rawDifficulty === 'hard' ? rawDifficulty : 'medium';
    const knowledgePoint = boundedDeepTutorText(qa.concentration || qa.topic || '', 240);
    return [{
      role: 'variant' as const,
      questionId: String(qa.question_id || `deep_question_${index + 1}`).slice(0, 120),
      sourceKind: 'generated' as const,
      stem,
      answer,
      analysis: analysis || 'DeepTutor 未提供额外解析，需老师复核。',
      knowledgePoint,
      difficulty,
      teacherObservation: '请老师确认题面、答案与难度后再保存。',
    }];
  });
  if (!items.length) return;
  const title = `小智题组：${items[0].knowledgePoint || 'Deep Question 练习'}`;
  const contentMd = items.map((item: DeepQuestionItem, index: number) => (
    `## ${index + 1}. ${item.stem}\n\n- 参考答案：${item.answer}\n- 解析：${item.analysis}\n- 难度：${item.difficulty}`
  )).join('\n\n');
  const confirmation = await store.createAiConfirmation({
    runId: binding.runId,
    sessionId: binding.sessionId,
    studentId: binding.studentId,
    actionType: 'save_exercise_set',
    title,
    description: 'DeepTutor 已生成题组草稿；保存前必须由老师复核。',
    previewMd: contentMd.slice(0, 8_000),
    payload: {
      studentId: binding.studentId,
      startDate: '',
      endDate: '',
      reportType: 'deep_question',
      title,
      contentMd,
      exerciseSet: {
        title,
        subject: '',
        knowledgePoint: items[0].knowledgePoint,
        contentMd,
        items,
        sourceQuestionIds: [],
      },
    },
  });
  binding.capabilityResultRecorded = true;
  mainWindow?.webContents.send('ai:deepTutorConfirmation', confirmation);
}

function normalizeMasteryConfirmationModules(value: unknown): AiMasteryPathModule[] {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 12).flatMap((rawModule, moduleIndex) => {
    if (!rawModule || typeof rawModule !== 'object') return [];
    const module = rawModule as Record<string, unknown>;
    const name = String(module.name ?? '').trim().slice(0, 200);
    const rawPoints = Array.isArray(module.knowledgePoints) ? module.knowledgePoints : Array.isArray(module.knowledge_points) ? module.knowledge_points : [];
    if (!name || rawPoints.length < 1 || rawPoints.length > 20) return [];
    const knowledgePoints = rawPoints.slice(0, 20).flatMap((rawPoint, pointIndex) => {
      if (!rawPoint || typeof rawPoint !== 'object') return [];
      const point = rawPoint as Record<string, unknown>;
      const pointName = String(point.name ?? '').trim().slice(0, 160);
      const type = String(point.type ?? 'concept').toLowerCase();
      if (!pointName || !['memory', 'procedure', 'concept', 'design'].includes(type)) return [];
      return [{ id: `mastery_m${moduleIndex}_kp${pointIndex}`, name: pointName, type: type as 'memory' | 'procedure' | 'concept' | 'design' }];
    });
    return knowledgePoints.length ? [{ id: `mastery_m${moduleIndex}`, name, order: moduleIndex, knowledgePoints }] : [];
  });
}

async function createMasteryConfirmationFromHostResult(
  binding: DeepTutorRunBinding,
  request: import('../shared/contracts').XiazhiHostToolRequest,
  result: import('../shared/contracts').XiazhiHostToolResult,
) {
  if (binding.masteryConfirmationRecorded || result.status !== 'used' || result.modelResult.pendingConfirmation == null) return;
  const operation = result.modelResult.pendingConfirmation && typeof result.modelResult.pendingConfirmation === 'object'
    ? String((result.modelResult.pendingConfirmation as Record<string, unknown>).operation ?? '')
    : '';
  const studentId = String(request.arguments.studentId ?? binding.studentId ?? '').trim();
  if (!studentId || (operation !== 'build' && operation !== 'assess')) return;
  const title = operation === 'build' ? '小智学习路径草案' : '小智掌握度评估草案';
  let previewMd = '';
  let payload: AiConfirmationPayload;
  if (operation === 'build') {
    const modules = normalizeMasteryConfirmationModules(request.arguments.modules);
    if (!modules.length) return;
    previewMd = modules.map((module) => `## ${module.name}\n\n${module.knowledgePoints.map((point) => `- ${point.name}（${point.type}）`).join('\n')}`).join('\n\n');
    payload = {
      studentId,
      startDate: '', endDate: '', reportType: 'mastery_path', title, contentMd: previewMd,
      masteryOperation: 'build', masteryPath: { mode: request.arguments.mode === 'append' ? 'append' : 'replace', modules },
    };
  } else {
    const pointId = String(request.arguments.knowledgePointId ?? request.arguments.knowledge_point_id ?? result.modelResult.knowledgePointId ?? '').trim();
    const pointName = String(result.modelResult.knowledgePoint ?? pointId).trim().slice(0, 160);
    const pointType = result.modelResult.knowledgeType === 'design' ? 'design' : 'concept';
    if (!pointId || !pointName) return;
    previewMd = `知识点：${pointName}\n\n评估结果：${request.arguments.passed === true ? '通过' : '未通过'}\n\n反馈：${String(request.arguments.feedback ?? '').slice(0, 600)}`;
    payload = {
      studentId,
      startDate: '', endDate: '', reportType: 'mastery_assessment', title, contentMd: previewMd,
      masteryOperation: 'assess',
      masteryAssessment: { knowledgePointId: pointId, knowledgePointName: pointName, knowledgeType: pointType, passed: request.arguments.passed === true, feedback: String(request.arguments.feedback ?? '').slice(0, 600) },
    };
  }
  const confirmation = await store.createAiConfirmation({
    runId: binding.runId,
    sessionId: binding.sessionId,
    studentId,
    actionType: 'save_mastery_state',
    title,
    description: 'Mastery 写入草案必须经老师确认后才会写入本地学习数据。',
    previewMd,
    payload,
  });
  binding.masteryConfirmationRecorded = true;
  mainWindow?.webContents.send('ai:deepTutorConfirmation', confirmation);
}

function persistDeepTutorEvent(event: XiazhiCapabilityEvent) {
  const binding = deepTutorRuns.get(event.turnId);
  if (!binding) return;
  const next = binding.queue.then(async () => {
    if (binding.terminalRecoveryScheduled) return;
    if (binding.persistedEvents >= binding.maxEvents) {
      await recoverDeepTutorEventBudget(binding);
      return;
    }
    binding.persistedEvents += 1;
    const step = mapDeepTutorEvent(event);
    await store.recordAiAgentEvent(binding.runId, step);
    if (event.phase === 'result' && binding.capability === 'deep_question') {
      await persistDeepQuestionConfirmation(binding, event);
    }
    if (event.phase === 'error' || event.status === 'failed') {
      const detail = step.detail.trim();
      if (detail) binding.errorMessage = detail;
    }
    if (event.phase === 'done') {
      const status = event.status === 'succeeded' ? 'succeeded' : event.status === 'cancelled' ? 'blocked' : 'failed';
      if (binding.timeoutHandle) clearTimeout(binding.timeoutHandle);
      await store.completeAiAgentRun(binding.runId, status, event.status === 'failed' ? (binding.errorMessage || step.detail) : '');
      deepTutorRuns.delete(event.turnId);
    }
    mainWindow?.webContents.send('ai:deepTutorEvent', event);
  }).catch(async (error) => {
    try {
      await store.completeAiAgentRun(binding.runId, 'failed', boundedDeepTutorText(error, 800));
    } catch {
      // Database failures stay in the local diagnostics path.
    } finally {
      if (binding.timeoutHandle) clearTimeout(binding.timeoutHandle);
      deepTutorRuns.delete(event.turnId);
    }
  });
  binding.queue = next;
}

app.setName('OmniEduAgent');

function createWindow() {
  const window = new BrowserWindow({
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
  mainWindow = window;

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

  if (process.env.ELECTRON_RENDERER_URL) {
    window.loadURL(process.env.ELECTRON_RENDERER_URL);
  } else {
    window.loadFile(join(__dirname, '../renderer/index.html'));
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

function extractLearningAnalyticsBinding(events: AiAgentEvent[]): AiConsoleRunResult['learningAnalytics'] | undefined {
  const raw = [...events].reverse()
    .map((event) => event.outputSummary?.learningAnalytics)
    .find((value) => value && typeof value === 'object' && !Array.isArray(value)) as Record<string, unknown> | undefined;
  if (!raw) return undefined;
  const startDate = String(raw.startDate ?? '');
  const endDate = String(raw.endDate ?? '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(startDate) || !/^\d{4}-\d{2}-\d{2}$/.test(endDate)) return undefined;
  const sourceRecordIds = Array.isArray(raw.sourceRecordIds)
    ? raw.sourceRecordIds.map((value) => String(value).slice(0, 160)).filter(Boolean).slice(0, 100)
    : [];
  return {
    schemaVersion: 'omni.learning.analytics.v1',
    startDate,
    endDate,
    subject: String(raw.subject ?? '').slice(0, 80),
    sourceRecordIds,
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
    const range = result.learningAnalytics ?? { ...defaultAiReportRange(), subject: '', sourceRecordIds: [] };
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
        subject: range.subject,
        startDate: range.startDate,
        endDate: range.endDate,
        reportType: result.learningAnalytics ? 'learning_analytics' : 'ai_draft',
        title,
        contentMd,
        parentSummary: result.structuredReply.nextActions.join('；').slice(0, 240),
        sourceRecordIds: result.learningAnalytics?.sourceRecordIds.length
          ? result.learningAnalytics.sourceRecordIds
          : result.structuredReply.evidence.map((item) => item.sourceId).filter((sourceId) => sourceId.startsWith('record_')),
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

  const handleUserInputRequest = async (request: XiazhiUserInputRequest): Promise<XiazhiUserInputResult> => {
    const binding = deepTutorRuns.get(request.turnId);
    if (!binding) {
      return {
        schemaVersion: 'xiazhi.user_input.result.v1',
        requestId: request.requestId,
        turnId: request.turnId,
        status: 'cancelled',
        text: '',
      };
    }
    const checkpoint = await store.createAiCapabilityCheckpoint({
      runId: binding.runId,
      capabilityName: binding.capability,
      checkpointType: 'user_input',
      state: {
        requestId: request.requestId,
        prompt: request.prompt.slice(0, 2_000),
        questions: request.questions ?? [],
      },
      expiresAt: request.expiresAt || new Date(Date.now() + 120_000).toISOString(),
    });
    await store.recordAiAgentEvent(binding.runId, {
      phase: 'guardrail',
      status: 'running',
      label: '等待老师输入',
      detail: request.prompt.slice(0, 2_000),
      outputSummary: { checkpointId: checkpoint.id, requestId: request.requestId, status: 'pending' },
    });
    await store.completeAiAgentRun(binding.runId, 'waiting_input', '等待老师输入后继续。');
    mainWindow?.webContents.send('ai:deepTutorInputRequest', request);
    return new Promise<XiazhiUserInputResult>((resolve) => {
      pendingDeepTutorInputs.set(request.requestId, { runId: binding.runId, checkpointId: checkpoint.id, request, resolve });
    });
  };

  const listPendingDeepTutorInputs = async (): Promise<XiazhiUserInputRequest[]> => {
    const checkpoints = await store.listPendingAiUserInputCheckpoints(50);
    const requests: XiazhiUserInputRequest[] = [];
    for (const checkpoint of checkpoints) {
      const run = await store.getAiAgentRun(checkpoint.runId);
      if (!run || String(run.status) !== 'waiting_input') continue;
      const state = checkpoint.state && typeof checkpoint.state === 'object' ? checkpoint.state : {};
      const requestId = String(state.requestId ?? '').trim();
      const prompt = boundedDeepTutorText(state.prompt, 2_000).trim();
      if (!requestId || !prompt) continue;
      const requestSnapshot = await store.getAiAgentRunRequest(checkpoint.runId);
      if (!requestSnapshot) {
        await store.resolveAiCapabilityCheckpoint(checkpoint.id, 'cancelled', { requestId, reason: 'resume_snapshot_missing' });
        await store.completeAiAgentRun(checkpoint.runId, 'failed', '等待输入恢复缺少原始请求快照。');
        continue;
      }
      const request: XiazhiUserInputRequest = {
        schemaVersion: 'xiazhi.user_input.request.v1',
        requestId,
        turnId: String(requestSnapshot.turnId ?? run.id),
        prompt,
        questions: Array.isArray(state.questions)
          ? state.questions.slice(0, 8).map((question) => {
              const item = question && typeof question === 'object' ? question as Record<string, unknown> : {};
              const options = Array.isArray(item.options) ? item.options : [];
              return {
              id: String(item.id ?? '').slice(0, 120),
              question: boundedDeepTutorText(item.question, 1_000),
              ...(options.length ? { options: options.slice(0, 8).map((option) => boundedDeepTutorText(option, 200)) } : {}),
              };
            }).filter((question) => question.id && question.question)
          : [],
        expiresAt: checkpoint.expiresAt,
      };
      pendingDeepTutorInputs.set(requestId, {
        runId: checkpoint.runId,
        checkpointId: checkpoint.id,
        request,
        requestSnapshot: requestSnapshot as unknown as XiazhiCapabilityRequest,
        rehydrated: true,
      });
      requests.push(request);
    }
    return requests;
  };

  const getDeepTutorSidecar = () => {
    if (!deepTutorSidecar) {
      const repoRoot = resolveRepoRoot();
      deepTutorSidecar = new DeepTutorSidecarClient({
        repoRoot,
        onExit: handleDeepTutorSidecarExit,
        onEvent: persistDeepTutorEvent,
        onHostToolRequest: async (request) => {
          const binding = deepTutorRuns.get(request.turnId);
          const router = routeAiPrompt(request.prompt, {
            hasStudent: Boolean(request.arguments.studentId || binding?.studentId),
          });
          const execution = await executeHostToolRequest({
            store,
            prompt: request.prompt,
            router,
            request,
            boundStudentId: binding?.studentId || undefined,
            state: binding?.toolState,
            executionContext: { runId: binding?.runId, turnId: request.turnId },
          });
          if (binding) binding.toolState = execution.state;
          if (binding && request.capability === 'mastery_path') {
            await createMasteryConfirmationFromHostResult(binding, request, execution.result);
          }
          return execution.result;
        },
        onModelRequest: executeDeepTutorModelRequest,
        onUserInputRequest: handleUserInputRequest,
      });
    }
    return deepTutorSidecar;
  };

  const startDeepTutorTurn = async (
    request: XiazhiCapabilityRequest,
    options: { parentRunId?: string; continuationCount?: number; existingRunId?: string } = {},
  ) => {
    const prompt = String(request?.prompt ?? '').trim();
    const turnId = String(request?.turnId ?? '').trim();
    if (!prompt || !turnId) throw new Error('DeepTutor turn requires prompt and turnId.');
    const context = request.context && typeof request.context === 'object' ? request.context : {};
    const router = routeAiPrompt(prompt, { hasStudent: Boolean(context.studentId) });
    const requestedMaxEvents = Number(request.budgets?.maxEvents);
    const maxEvents = Number.isFinite(requestedMaxEvents)
      ? Math.max(1, Math.min(Math.trunc(requestedMaxEvents), 256))
      : 64;
    const runId = options.existingRunId ?? await store.startAiAgentRun({
      parentRunId: options.parentRunId,
      sessionId: typeof context.sessionId === 'string' ? context.sessionId : '',
      prompt,
      route: router.route,
      subIntent: router.subIntent,
      model: typeof context.model === 'string' ? context.model : 'deeptutor',
      studentId: typeof context.studentId === 'string' ? context.studentId : '',
    });
    const binding: DeepTutorRunBinding = {
      runId,
      turnId,
      capability: request.capability,
      sessionId: typeof context.sessionId === 'string' ? context.sessionId : '',
      studentId: typeof context.studentId === 'string' ? context.studentId : '',
      queue: Promise.resolve(),
      maxEvents,
      persistedEvents: 0,
      requestSnapshot: request,
      parentRunId: options.parentRunId,
      continuationCount: options.continuationCount ?? 0,
    };
    deepTutorRuns.set(turnId, binding);
    const requestedWallMs = Number(request.budgets?.maxWallMs);
    const maxWallMs = Number.isFinite(requestedWallMs) ? Math.max(1_000, Math.min(Math.trunc(requestedWallMs), 120_000)) : 45_000;
    binding.timeoutHandle = setTimeout(() => {
      const active = deepTutorRuns.get(turnId);
      if (!active || active.terminalRecoveryScheduled) return;
      active.terminalRecoveryScheduled = true;
      const recovery = active.queue.then(async () => {
        try {
          await store.recordAiAgentEvent(active.runId, {
            phase: 'guardrail',
            status: 'failed',
            label: 'DeepTutor turn timeout',
            detail: `Turn exceeded ${maxWallMs}ms budget and was cancelled.`,
            outputSummary: { recovery: 'timeout_cancel', maxWallMs },
          });
          await store.completeAiAgentRun(active.runId, 'failed', 'DeepTutor turn exceeded its wall-time budget.');
        } catch {
          // Keep timeout cleanup best-effort; no in-memory run may remain active.
        } finally {
          deepTutorRuns.delete(turnId);
          void getDeepTutorSidecar().cancelTurn(turnId).catch(() => undefined);
        }
      });
      active.queue = recovery;
    }, maxWallMs);
    await store.recordAiAgentEvent(runId, {
      phase: 'route',
      status: 'succeeded',
      label: 'DeepTutor 能力路由',
      detail: `已将本轮交给 ${request.capability}。`,
      outputSummary: {
        capability: request.capability,
        route: router.route,
        subIntent: router.subIntent,
        harnessVersion: String(request.context?.harnessVersion || XIAZHI_AGENT_HARNESS_VERSION),
      },
    });
    try {
      const sidecar = getDeepTutorSidecar();
      await sidecar.start();
      const enrichedRequest = request.capability === 'mastery_path' && typeof context.studentId === 'string' && context.studentId.trim()
        ? {
            ...request,
            context: {
              ...context,
              masterySnapshot: await buildMasterySnapshot(store, context.studentId),
            },
          }
        : request;
      const normalizedRequest: XiazhiCapabilityRequest = {
        ...enrichedRequest,
        budgets: { maxEvents, maxWallMs },
      };
      binding.requestSnapshot = normalizedRequest;
      await store.saveAiAgentRunRequest(runId, normalizedRequest as unknown as Record<string, unknown>);
      const response = await sidecar.startTurn(normalizedRequest);
      return { response, runId, router };
    } catch (error) {
      deepTutorRuns.delete(turnId);
      await store.completeAiAgentRun(runId, 'failed', boundedDeepTutorText(error, 800));
      throw error;
    }
  };

  const continueDeepTutorTurn = async (
    continuationToken: string,
    budgets?: { maxEvents?: number; maxWallMs?: number },
    approvedBudget = false,
  ): Promise<XiazhiContinuationResult> => {
    const normalizedToken = String(continuationToken ?? '').trim();
    const pendingCheckpoint = await store.getPendingAiContinuation(normalizedToken);
    if (!pendingCheckpoint) return { ok: false, errorMessage: '续写令牌不存在、已使用或已过期。' };
    const pendingState = pendingCheckpoint.state && typeof pendingCheckpoint.state === 'object' ? pendingCheckpoint.state : {};
    const pendingRequest = pendingState.request && typeof pendingState.request === 'object' ? pendingState.request as Record<string, unknown> : {};
    const pendingBudgets = pendingRequest.budgets && typeof pendingRequest.budgets === 'object' ? pendingRequest.budgets as Record<string, unknown> : {};
    const originalMaxEvents = Number.isFinite(Number(pendingBudgets.maxEvents)) ? Math.max(1, Math.min(Math.trunc(Number(pendingBudgets.maxEvents)), 256)) : 64;
    const originalMaxWallMs = Number.isFinite(Number(pendingBudgets.maxWallMs)) ? Math.max(1_000, Math.min(Math.trunc(Number(pendingBudgets.maxWallMs)), 120_000)) : 45_000;
    const requestedMaxEvents = Number.isFinite(Number(budgets?.maxEvents)) ? Math.max(1, Math.min(Math.trunc(Number(budgets?.maxEvents)), 256)) : originalMaxEvents;
    const requestedMaxWallMs = Number.isFinite(Number(budgets?.maxWallMs)) ? Math.max(1_000, Math.min(Math.trunc(Number(budgets?.maxWallMs)), 120_000)) : originalMaxWallMs;
    if (!approvedBudget && (requestedMaxEvents > originalMaxEvents || requestedMaxWallMs > originalMaxWallMs)) {
      const state = pendingState;
      const approval = await store.getPendingAiBudgetApproval(normalizedToken) ?? await store.createAiCapabilityCheckpoint({
          runId: String(state.sourceRunId ?? pendingCheckpoint.runId),
          capabilityName: pendingCheckpoint.capabilityName,
          checkpointType: 'budget_approval',
          state: {
            continuationToken: normalizedToken,
            sourceRunId: String(state.sourceRunId ?? pendingCheckpoint.runId),
            continuationCount: Number(state.continuationCount ?? 0),
            originalBudgets: { maxEvents: originalMaxEvents, maxWallMs: originalMaxWallMs },
            requestedBudgets: { maxEvents: requestedMaxEvents, maxWallMs: requestedMaxWallMs },
          },
          expiresAt: new Date(Date.now() + 2 * 60_000).toISOString(),
        });
      return {
        ok: false,
        approvalRequired: true,
        approvalCheckpointId: approval.id,
        requestedBudgets: { maxEvents: requestedMaxEvents, maxWallMs: requestedMaxWallMs },
        errorMessage: '续写请求超出原预算，需要老师确认后继续。',
      };
    }
    const checkpoint = await store.claimAiContinuation(normalizedToken);
    if (!checkpoint) return { ok: false, errorMessage: '续写令牌不存在、已使用或已过期。' };
    const state = checkpoint.state && typeof checkpoint.state === 'object' ? checkpoint.state : {};
    const rawRequest = state.request && typeof state.request === 'object' ? state.request as Record<string, unknown> : {};
    const capability = String(rawRequest.capability ?? checkpoint.capabilityName);
    const prompt = String(rawRequest.prompt ?? '').trim();
    const context = rawRequest.context && typeof rawRequest.context === 'object' ? rawRequest.context as Record<string, unknown> : {};
    const sourceRunId = String(state.sourceRunId ?? checkpoint.runId).trim();
    const visibleSummary = boundedDeepTutorText(state.visibleSummary, 6_000).trim();
    const continuationCount = Math.max(0, Math.min(3, Math.trunc(Number(state.continuationCount ?? 0))));
    if (!prompt || !['chat', 'deep_solve', 'deep_question', 'deep_research', 'visualize', 'mastery_path'].includes(capability)) {
      return { ok: false, errorMessage: '续写状态无效，已拒绝恢复。' };
    }
    const nextTurnId = `cont-${Date.now()}-${randomUUID().slice(0, 8)}`;
    const nextPrompt = [
      prompt,
      '上一轮因事件预算暂停。请从已完成的工作继续，不要重复已经给出的内容；如果证据不足，明确标注未知并给出下一步。',
      visibleSummary ? `上一轮可见处理摘要：\n${visibleSummary}` : '',
    ].filter(Boolean).join('\n\n').slice(0, 20_000);
    const nextRequest: XiazhiCapabilityRequest = {
      schemaVersion: 'xiazhi.capability.request.v1',
      turnId: nextTurnId,
      capability: capability as XiazhiCapabilityRequest['capability'],
      prompt: nextPrompt,
      context,
      budgets: {
        maxEvents: Number.isFinite(requestedMaxEvents) ? Math.max(1, Math.min(Math.trunc(requestedMaxEvents), 256)) : 64,
        maxWallMs: Number.isFinite(requestedMaxWallMs) ? Math.max(1_000, Math.min(Math.trunc(requestedMaxWallMs), 120_000)) : 45_000,
      },
    };
    try {
      const { response, runId } = await startDeepTutorTurn(nextRequest, {
        parentRunId: sourceRunId,
        continuationCount: continuationCount + 1,
      });
      return {
        ok: response.ok === true,
        runId,
        turnId: nextTurnId,
        parentRunId: sourceRunId,
        errorMessage: response.ok === true ? undefined : '续写 turn 未被 sidecar 接受。',
      };
    } catch (error) {
      return { ok: false, parentRunId: sourceRunId, errorMessage: boundedDeepTutorText(error, 800) };
    }
  };

  const approveDeepTutorBudget = async (checkpointId: string): Promise<XiazhiContinuationResult> => {
    const checkpoint = await store.claimAiBudgetApproval(String(checkpointId ?? ''));
    if (!checkpoint) return { ok: false, errorMessage: '预算审批不存在、已处理或已过期。' };
    const state = checkpoint.state && typeof checkpoint.state === 'object' ? checkpoint.state : {};
    const continuationToken = String(state.continuationToken ?? '').trim();
    const requested = state.requestedBudgets && typeof state.requestedBudgets === 'object' ? state.requestedBudgets as Record<string, unknown> : {};
    if (!continuationToken) return { ok: false, errorMessage: '预算审批缺少续写令牌，已拒绝恢复。' };
    return continueDeepTutorTurn(continuationToken, {
      maxEvents: Number(requested.maxEvents),
      maxWallMs: Number(requested.maxWallMs),
    }, true);
  };

  const mutateDeepTutorRun = async (input: {
    sourceRunId?: string;
    action?: XiazhiRunMutationAction;
    idempotencyKey?: string;
    prompt?: string;
    budgets?: { maxEvents?: number; maxWallMs?: number };
  }): Promise<XiazhiRunMutationResult> => {
    const sourceRunId = String(input?.sourceRunId ?? '').trim();
    const action = String(input?.action ?? '') as XiazhiRunMutationAction;
    const idempotencyKey = String(input?.idempotencyKey ?? '').trim().slice(0, 180);
    const baseResult = { action, sourceRunId } as const;
    if (!sourceRunId || !['retry', 'branch', 'regenerate'].includes(action) || !idempotencyKey) {
      return { ...baseResult, ok: false, errorMessage: '运行变更参数无效，已拒绝。' };
    }
    const source = await store.getAiAgentRun(sourceRunId);
    if (!source) return { ...baseResult, ok: false, errorMessage: '源运行不存在，无法创建变更。' };
    const terminalStatuses = ['succeeded', 'failed', 'blocked', 'cancelled'];
    if (!terminalStatuses.includes(source.status)) {
      return { ...baseResult, ok: false, errorMessage: '运行仍在进行中，不能重试或分支。' };
    }
    if (action === 'retry' && source.status === 'succeeded') {
      return { ...baseResult, ok: false, errorMessage: '成功运行不能使用 retry；请使用 branch 或 regenerate。' };
    }
    const stored = await store.getAiAgentRunRequest(sourceRunId);
    if (!stored) return { ...baseResult, ok: false, errorMessage: '源运行缺少可恢复请求快照，已拒绝重放。' };
    const capability = String(stored.capability ?? 'chat');
    if (!['chat', 'deep_solve', 'deep_question', 'deep_research', 'visualize', 'mastery_path'].includes(capability)) {
      return { ...baseResult, ok: false, errorMessage: '源运行能力不受支持，已拒绝重放。' };
    }
    const prompt = String(input.prompt ?? stored.prompt ?? source.prompt).trim().slice(0, 20_000);
    const context = stored.context && typeof stored.context === 'object' ? stored.context as Record<string, unknown> : {};
    const rawBudgets = stored.budgets && typeof stored.budgets === 'object' ? stored.budgets as Record<string, unknown> : {};
    const requestedMaxEvents = Number(input.budgets?.maxEvents ?? rawBudgets.maxEvents);
    const requestedMaxWallMs = Number(input.budgets?.maxWallMs ?? rawBudgets.maxWallMs);
    const nextRequest: XiazhiCapabilityRequest = {
      schemaVersion: 'xiazhi.capability.request.v1',
      turnId: `${action}-${Date.now()}-${randomUUID().slice(0, 8)}`,
      capability: capability as XiazhiCapabilityRequest['capability'],
      prompt,
      context,
      budgets: {
        maxEvents: Number.isFinite(requestedMaxEvents) ? Math.max(1, Math.min(Math.trunc(requestedMaxEvents), 256)) : 64,
        maxWallMs: Number.isFinite(requestedMaxWallMs) ? Math.max(1_000, Math.min(Math.trunc(requestedMaxWallMs), 120_000)) : 45_000,
      },
    };
    const router = routeAiPrompt(prompt, { hasStudent: Boolean(context.studentId) });
    let child: { runId: string; reused: boolean };
    try {
      child = await store.createAiAgentChildRun({
        sourceRunId,
        action,
        idempotencyKey,
        prompt,
        route: router.route,
        subIntent: router.subIntent,
        model: typeof context.model === 'string' ? context.model : source.model,
        studentId: typeof context.studentId === 'string' ? context.studentId : source.studentId,
        sessionId: typeof context.sessionId === 'string' ? context.sessionId : source.sessionId,
        request: nextRequest as unknown as Record<string, unknown>,
      });
    } catch (error) {
      return { ...baseResult, ok: false, errorMessage: boundedDeepTutorText(error, 800) };
    }
    if (child.reused) {
      return { ...baseResult, ok: true, runId: child.runId, parentRunId: sourceRunId, reused: true };
    }
    try {
      const { response } = await startDeepTutorTurn(nextRequest, { existingRunId: child.runId, parentRunId: sourceRunId });
      return {
        ...baseResult,
        ok: response.ok === true,
        runId: child.runId,
        turnId: nextRequest.turnId,
        parentRunId: sourceRunId,
        reused: false,
        ...(response.ok === true ? {} : { errorMessage: '变更后的 turn 未被 sidecar 接受。' }),
      };
    } catch (error) {
      return { ...baseResult, ok: false, runId: child.runId, turnId: nextRequest.turnId, parentRunId: sourceRunId, errorMessage: boundedDeepTutorText(error, 800) };
    }
  };

  ipcMain.handle('ai:deepTutorHandshake', () => getDeepTutorSidecar().start());
  ipcMain.handle('ai:deepTutorStartTurn', async (_event, request: XiazhiCapabilityRequest) => {
    const { response, runId } = await startDeepTutorTurn(request);
    return { ...response, result: { ...(response.result ?? {}), runId } };
  });
  ipcMain.handle('ai:deepTutorContinueTurn', async (_event, input: { continuationToken?: string; budgets?: { maxEvents?: number; maxWallMs?: number } }) => (
    continueDeepTutorTurn(String(input?.continuationToken ?? ''), input?.budgets)
  ));
  ipcMain.handle('ai:deepTutorApproveBudget', async (_event, checkpointId: string) => approveDeepTutorBudget(checkpointId));
  ipcMain.handle('ai:deepTutorMutateRun', async (_event, input: { sourceRunId?: string; action?: XiazhiRunMutationAction; idempotencyKey?: string; prompt?: string; budgets?: { maxEvents?: number; maxWallMs?: number } }) => (
    mutateDeepTutorRun(input)
  ));
  ipcMain.handle('ai:deepTutorRunConsole', async (_event, input: AiConsoleRunInput): Promise<AiConsoleRunResult> => {
    const prompt = input.prompt?.trim() ?? '';
    const router = routeAiPrompt(prompt, { hasStudent: Boolean(input.studentId) });
    const capability = selectDeepTutorCapability(router);
    const settings = await store.getDeepSeekRuntimeSettings();
    const request: XiazhiCapabilityRequest = {
      schemaVersion: 'xiazhi.capability.request.v1',
      turnId: `console-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      capability,
      prompt,
      context: {
        language: 'zh',
        sessionId: input.sessionId ?? '',
        studentId: input.studentId ?? '',
        model: settings.model,
        modelProxy: 'deepseek',
        executionProfile: 'omni_console',
        systemPrompt: buildAiSystemPrompt(router, capability),
        harnessVersion: XIAZHI_AGENT_HARNESS_VERSION,
        hostTools: getModelToolDefinitions(router, { includeLoader: true }),
        progressiveToolNames: progressiveToolNames(router),
      },
      budgets: { maxEvents: 64, maxWallMs: 120_000 },
    };
    if (!prompt) {
      return {
        ok: false,
        model: settings.model,
        content: '',
        toolRuns: [],
        sources: [],
        harness: {
          harnessVersion: XIAZHI_AGENT_HARNESS_VERSION,
          selectedCapability: capability,
          router,
          selectedContext: [],
          schemaValid: false,
          schemaErrors: ['请输入 AI 任务。'],
          trace: [],
        },
        errorMessage: '请输入 AI 任务。',
      };
    }
    const { runId } = await startDeepTutorTurn(request);
    const deadline = Date.now() + request.budgets.maxWallMs + 2_000;
    let run = await store.getAiAgentRun(runId);
    while (run && isConsoleRunPendingStatus(run.status) && Date.now() < deadline) {
      await new Promise((resolve) => setTimeout(resolve, 80));
      run = await store.getAiAgentRun(runId);
    }
    const events = await store.listAiAgentEvents(runId);
    const trace: AiAgentTraceStep[] = events.map((event) => ({
      phase: event.phase,
      status: event.status,
      label: event.label,
      detail: event.detail,
      toolName: event.toolName,
      inputSummary: event.inputSummary,
      outputSummary: event.outputSummary,
    } satisfies AiAgentTraceStep));
    const finalEvent = events.find((event) => event.phase === 'finalize' && event.outputSummary?.sidecarPhase === 'result');
    const finalText = finalEvent?.detail ?? '';
    let parsed = finalText ? parseStructuredReply(finalText, router) : { reply: undefined, errors: ['DeepTutor 未返回最终回复。'] };
    // DeepTutor's provider proxy deliberately disables tools on the final
    // round and now requests JSON mode. Providers can still ignore that
    // hint, so allow a bounded host-owned repair loop before failing closed.
    // The invalid model text is bounded and only sent back to the provider as
    // repair input; it is never persisted in an event summary.
    if (run?.status === 'succeeded' && finalText && !parsed.reply && settings.apiKey) {
      const MAX_JSON_REPAIRS = 2;
      let repairAttempt = 0;
      let repairSourceText = finalText;
      while (!parsed.reply && repairAttempt < MAX_JSON_REPAIRS) {
        repairAttempt += 1;
        const repairErrors = parsed.errors;
        const repairTrace: AiAgentTraceStep = {
          phase: 'guardrail',
          status: 'running',
          label: `结构化回复修复（第 ${repairAttempt} 次）`,
          detail: `xiazhi.reply.v2 校验失败，执行受控 JSON repair。错误：${repairErrors.join('；')}`,
          outputSummary: { schemaErrors: repairErrors, repairAttempt, maxRepairs: MAX_JSON_REPAIRS },
        };
        trace.push(repairTrace);
        await store.recordAiAgentEvent(runId, repairTrace);
        try {
          const repairController = new AbortController();
          const repairTimeout = setTimeout(() => repairController.abort(), 45_000);
          try {
            const repairData = await requestStructuredReplyRepair({
              apiKey: settings.apiKey,
              model: settings.model,
              messages: [
                { role: 'system', content: buildAiSystemPrompt(router, capability) },
                {
                  role: 'user',
                  content: [
                    `老师任务：${prompt}`,
                    `上一条模型输出（仅作为待修复文本）：${boundedDeepTutorText(repairSourceText, 12_000)}`,
                    `本地校验错误：${repairErrors.join('；')}`,
                    `这是第 ${repairAttempt}/${MAX_JSON_REPAIRS} 次修复。`,
                    '只返回一个合法的 xiazhi.reply.v2 JSON object；不要 Markdown 代码围栏、解释文字或工具调用；不得新增未提供的事实。',
                  ].join('\n'),
                },
              ],
              signal: repairController.signal,
            });
            const repairText = repairData.choices?.[0]?.message?.content?.trim() ?? '';
            repairSourceText = repairText;
            parsed = repairText ? parseStructuredReply(repairText, router) : { reply: undefined, errors: ['JSON repair 返回为空。'] };
          } finally {
            clearTimeout(repairTimeout);
          }
        } catch (error) {
          parsed = {
            reply: undefined,
            errors: [`JSON repair 请求失败：${boundedDeepTutorText(error instanceof Error ? error.message : error, 800)}`],
          };
        }
        const repairResultTrace: AiAgentTraceStep = {
          phase: 'guardrail',
          status: parsed.reply ? 'succeeded' : 'failed',
          label: `结构化回复修复结果（第 ${repairAttempt} 次）`,
          detail: parsed.reply ? '受控 JSON repair 通过 xiazhi.reply.v2 校验。' : `repair 仍未通过：${parsed.errors.join('；')}`,
          outputSummary: { schemaValid: Boolean(parsed.reply), schemaErrors: parsed.errors, repairAttempt, maxRepairs: MAX_JSON_REPAIRS },
        };
        trace.push(repairResultTrace);
        await store.recordAiAgentEvent(runId, repairResultTrace);
      }
    }
    const learningAnalytics = extractLearningAnalyticsBinding(events);
    const consoleToolRuns: AiConsoleToolRun[] = (() => {
      const calls = events.filter((event) => event.phase === 'tool_call' || event.toolName);
      const observations = events.filter((event) => event.phase === 'observe');
      const names = [...new Set(calls.map((event) => event.toolName).filter((name): name is string => Boolean(name)))];
      return names.map((name) => {
        const observation = observations.find((event) => event.outputSummary?.tool === name || event.toolName === name);
        const status = observation?.outputSummary?.status === 'blocked'
          ? 'blocked'
          : observation?.status === 'failed'
            ? 'failed'
            : 'used';
        return {
          name,
          label: name,
          status,
          detail: observation?.detail ?? 'DeepTutor AgentLoop 已请求宿主工具。',
          effect: 'read' as const,
          privacy: 'local_only' as const,
          inputSummary: calls.find((event) => event.toolName === name)?.inputSummary,
          outputSummary: observation?.outputSummary,
        };
      });
    })();
    const educationGrade = parsed.reply
      ? gradeEducationalReply({ reply: parsed.reply, router, toolRuns: consoleToolRuns })
      : undefined;
    const usabilityGrade = parsed.reply
      ? gradeUsabilityReply({ reply: parsed.reply, router })
      : undefined;
    if (educationGrade) {
      const step: AiAgentTraceStep = {
        phase: 'reflect',
        status: educationGrade.passed ? 'succeeded' : 'blocked',
        label: '教育质量评分',
        detail: educationGrade.passed
          ? `Education Grader 通过，score=${educationGrade.score}。`
          : `Education Grader 未通过：${educationGrade.issues.map((issue) => issue.message).join('；')}`,
        outputSummary: { score: educationGrade.score, passed: educationGrade.passed, issues: educationGrade.issues },
      };
      trace.push(step);
      await store.recordAiAgentEvent(runId, step);
    }
    if (usabilityGrade) {
      const step: AiAgentTraceStep = {
        phase: 'reflect',
        status: usabilityGrade.passed ? 'succeeded' : 'blocked',
        label: '教师可用性评分',
        detail: usabilityGrade.passed
          ? `Usability Grader 通过，score=${usabilityGrade.score}。`
          : `Usability Grader 未通过：${usabilityGrade.issues.map((issue) => issue.message).join('；')}`,
        outputSummary: { score: usabilityGrade.score, passed: usabilityGrade.passed, issues: usabilityGrade.issues },
      };
      trace.push(step);
      await store.recordAiAgentEvent(runId, step);
    }
    const qualityError = educationGrade && !educationGrade.passed
      ? `Education Grader 未通过：${educationGrade.issues.map((issue) => issue.message).join('；')}`
      : usabilityGrade && !usabilityGrade.passed
        ? `Usability Grader 未通过：${usabilityGrade.issues.map((issue) => issue.message).join('；')}`
        : '';
    if (!run || run.status !== 'succeeded' || !parsed.reply || qualityError) {
      const errorEvent = [...events].reverse().find((event) => event.status === 'failed' && event.outputSummary?.sidecarPhase !== 'done');
      const errorMessage = qualityError || errorEvent?.detail || run?.errorMessage || parsed.errors.join('；') || 'DeepTutor 运行失败。';
      if (run?.status !== 'failed') await store.completeAiAgentRun(runId, 'failed', errorMessage);
      const result: AiConsoleRunResult = {
        ok: false,
        model: settings.model,
        content: '',
        toolRuns: consoleToolRuns,
        sources: [],
        harness: {
          agentRunId: runId,
          harnessVersion: XIAZHI_AGENT_HARNESS_VERSION,
          selectedCapability: capability,
          router,
          selectedContext: router.contextPolicy.include,
          schemaValid: Boolean(parsed.reply),
          schemaErrors: parsed.errors,
          educationGrade,
          usabilityGrade,
          trace,
        },
        errorMessage,
      };
      await store.recordAiConsoleRun(input, result);
      return result;
    }
    const result: AiConsoleRunResult = {
      ok: true,
      model: settings.model,
      content: structuredReplyToMarkdown(parsed.reply),
      toolRuns: consoleToolRuns,
      sources: parsed.reply.evidence.map((evidence) => ({
        id: evidence.sourceId,
        title: evidence.sourceId,
        type: 'structured_evidence',
        detail: evidence.note || evidence.quote || '结构化回复引用。',
        count: evidence.quote ? 1 : 0,
      })),
      structuredReply: parsed.reply,
      artifacts: parsed.reply.artifacts,
      learningAnalytics,
      harness: {
        agentRunId: runId,
        harnessVersion: XIAZHI_AGENT_HARNESS_VERSION,
        selectedCapability: capability,
        router,
        selectedContext: router.contextPolicy.include,
        schemaValid: true,
        schemaErrors: [],
        educationGrade,
        usabilityGrade,
        trace,
      },
    };
    await store.recordAiConsoleRun(input, result);
    return result;
  });
  ipcMain.handle('ai:deepTutorSubmitUserInput', async (_event, input: { requestId?: string; turnId?: string; text?: string; answers?: Array<{ id: string; value: string }> }) => {
    const requestId = String(input?.requestId ?? '').trim();
    if (!requestId || requestId.length > 120) {
      return { ok: false, errorMessage: '无效 requestId' };
    }
    const pending = pendingDeepTutorInputs.get(requestId);
    if (!pending || (input?.turnId && input.turnId !== pending.request.turnId)) {
      return { ok: false, errorMessage: '等待输入不存在、已处理或已过期。' };
    }
    const text = String(input?.text ?? '').trim().slice(0, 4_000);
    const answers = Array.isArray(input?.answers)
      ? input.answers.slice(0, 8).map((answer) => ({ id: String(answer?.id ?? '').slice(0, 120), value: String(answer?.value ?? '').slice(0, 400) }))
      : undefined;
    const masteryAnswer = answers?.find((answer) => answer.id.startsWith('mastery_question_'))
      ?? (pending.request.questions?.find((question) => question.id.startsWith('mastery_question_'))
        ? { id: String(pending.request.questions.find((question) => question.id.startsWith('mastery_question_'))?.id), value: text }
        : undefined);
    if (pending.rehydrated) {
      const claimed = await store.claimAiUserInputCheckpoint(pending.checkpointId, {
        requestId,
        answerText: text,
        answers: answers ?? [],
        ...(masteryAnswer ? { masteryQuestionId: masteryAnswer.id } : {}),
        recovery: 'restart_resume_child_run',
      });
      if (!claimed) return { ok: false, errorMessage: '等待输入已被其他窗口处理或已过期。' };
      if (masteryAnswer) await store.answerAiMasteryQuestion(masteryAnswer.id, masteryAnswer.value || text);
      const original = pending.requestSnapshot;
      const capability = String(original?.capability ?? '');
      if (!original || !['chat', 'deep_solve', 'deep_question', 'deep_research', 'visualize', 'mastery_path'].includes(capability)) {
        await store.completeAiAgentRun(pending.runId, 'failed', '等待输入恢复请求能力无效。');
        pendingDeepTutorInputs.delete(requestId);
        return { ok: false, errorMessage: '等待输入恢复请求无效，已安全终止。' };
      }
      const nextTurnId = `resume-${Date.now()}-${randomUUID().slice(0, 8)}`;
      const resumeContext = original.context && typeof original.context === 'object'
        ? { ...original.context }
        : {};
      delete resumeContext.hostToolAuto;
      const nextRequest: XiazhiCapabilityRequest = {
        ...original,
        schemaVersion: 'xiazhi.capability.request.v1',
        turnId: nextTurnId,
        capability: capability as XiazhiCapabilityRequest['capability'],
        context: resumeContext,
        prompt: `${boundedDeepTutorText(original.prompt, 16_000)}\n\n上一轮等待老师输入的问题：${pending.request.prompt}\n老师补充：${text || '(老师未填写文字，已提交选项)'}`.slice(0, 20_000),
      };
      const resumeRouter = routeAiPrompt(nextRequest.prompt, { hasStudent: Boolean(nextRequest.context?.studentId) });
      const childRunId = await store.startAiAgentRun({
        parentRunId: pending.runId,
        sessionId: typeof nextRequest.context?.sessionId === 'string' ? nextRequest.context.sessionId : '',
        prompt: nextRequest.prompt,
        route: resumeRouter.route,
        subIntent: resumeRouter.subIntent,
        model: typeof nextRequest.context?.model === 'string' ? nextRequest.context.model : '',
        studentId: typeof nextRequest.context?.studentId === 'string' ? nextRequest.context.studentId : '',
      });
      try {
        await startDeepTutorTurn(nextRequest, { existingRunId: childRunId, parentRunId: pending.runId });
        await store.completeAiAgentRun(pending.runId, 'blocked', '应用重启后由恢复子运行接管本次等待输入。');
      } catch (error) {
        await store.completeAiAgentRun(childRunId, 'failed', boundedDeepTutorText(error, 800));
        await store.completeAiAgentRun(pending.runId, 'failed', '等待输入恢复子运行启动失败。');
        pendingDeepTutorInputs.delete(requestId);
        return { ok: false, errorMessage: boundedDeepTutorText(error, 800) };
      }
      pendingDeepTutorInputs.delete(requestId);
      return { ok: true, checkpointId: pending.checkpointId, runId: childRunId };
    }
    const claimed = await store.claimAiUserInputCheckpoint(pending.checkpointId, {
      requestId,
      answerText: text,
      answers: answers ?? [],
      ...(masteryAnswer ? { masteryQuestionId: masteryAnswer.id } : {}),
    });
    if (!claimed) return { ok: false, errorMessage: '等待输入已被其他窗口处理或已过期。' };
    if (masteryAnswer) await store.answerAiMasteryQuestion(masteryAnswer.id, masteryAnswer.value || text);
    await store.reopenAiAgentRun(pending.runId);
    await store.recordAiAgentEvent(pending.runId, {
      phase: 'observe',
      status: 'succeeded',
      label: '老师输入已提交',
      detail: `已收到老师输入（${text.length} 字符）。`,
      outputSummary: { checkpointId: pending.checkpointId, requestId, status: 'answered', answerLength: text.length },
    });
    pendingDeepTutorInputs.delete(requestId);
    pending.resolve?.({
      schemaVersion: 'xiazhi.user_input.result.v1',
      requestId,
      turnId: pending.request.turnId,
      status: 'answered',
      text,
      answers,
    });
    return { ok: true, checkpointId: pending.checkpointId };
  });
  ipcMain.handle('ai:deepTutorCancelTurn', async (_event, turnId: string) => {
    const pending = [...pendingDeepTutorInputs.entries()].find(([, item]) => item.request.turnId === turnId);
    if (pending) {
      const [requestId, item] = pending;
      for (const question of item.request.questions ?? []) {
        if (question.id.startsWith('mastery_question_')) await store.cancelAiMasteryQuestion(question.id);
      }
      await store.resolveAiCapabilityCheckpoint(item.checkpointId, 'cancelled', { requestId, reason: 'cancelled_by_host' });
      pendingDeepTutorInputs.delete(requestId);
      item.resolve?.({ schemaVersion: 'xiazhi.user_input.result.v1', requestId, turnId, status: 'cancelled', text: '' });
    }
    return getDeepTutorSidecar().cancelTurn(turnId);
  });
  ipcMain.handle('ai:deepTutorStop', async () => {
    const result = await getDeepTutorSidecar().stop();
    for (const [requestId, pending] of pendingDeepTutorInputs) {
      for (const question of pending.request.questions ?? []) {
        if (question.id.startsWith('mastery_question_')) await store.cancelAiMasteryQuestion(question.id);
      }
      await store.resolveAiCapabilityCheckpoint(pending.checkpointId, 'cancelled', { requestId, reason: 'sidecar_stopped' });
      pending.resolve?.({ schemaVersion: 'xiazhi.user_input.result.v1', requestId, turnId: pending.request.turnId, status: 'cancelled', text: '' });
    }
    pendingDeepTutorInputs.clear();
    for (const binding of deepTutorRuns.values()) {
      if (binding.timeoutHandle) clearTimeout(binding.timeoutHandle);
      await store.completeAiAgentRun(binding.runId, 'blocked', 'DeepTutor sidecar stopped by host.');
    }
    deepTutorRuns.clear();
    return result;
  });
  await store.init();

  ipcMain.handle('app:bootstrap', () => store.init());
  ipcMain.handle('ai:deepTutorListPendingInputs', () => listPendingDeepTutorInputs());
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
    const result = await selectDataBackupExportRoot();
    if (result.canceled || !result.filePaths[0]) return null;
    const exported = await store.exportDataRoot(result.filePaths[0]);
    if (process.env.OMNI_EDU_E2E_DIALOG_MODE === '1' && !app.isPackaged) lastE2eDataBackupExportPath = exported.exportPath;
    return exported;
  });
  ipcMain.handle('app:verifyDataBackup', async () => {
    const result = await selectDataBackupVerifyRoot();
    if (result.canceled || !result.filePaths[0]) return null;
    return store.verifyDataBackup(result.filePaths[0]);
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

    // Fail fast when the provider credential is unavailable. The renderer must
    // receive an actionable error promptly instead of waiting for the full
    // local AgentLoop (and its retrieval/tool work) to finish first.
    if (!apiKey) {
      const trace: AiAgentTraceStep[] = [
        {
          phase: 'guardrail',
          status: 'blocked',
          label: 'DeepSeek 閰嶇疆',
          detail: '缂哄皯 DeepSeek API Key锛屽凡鍦ㄦā鍨嬭姹傚墠闃诲锛屼繚鐣欐湰鍦伴敊璇建杩广€?',
          inputSummary: { route: router.route, subIntent: router.subIntent },
          outputSummary: { blockedReason: 'missing_deepseek_api_key' },
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
          schemaErrors: ['缂哄皯 DeepSeek API Key銆?',],
          trace,
        },
        errorMessage: '缂哄皯 DeepSeek API Key銆傝鍦ㄨ缃〉淇濆瓨 DeepSeek API 閰嶇疆銆?',
      };
      await store.completeAiAgentRun(agentRunId, 'blocked', result.errorMessage);
      await store.recordAiConsoleRun(input, result);
      return result;
    }

    try {
      const context = await runAiAgentLoop({ store, prompt, studentId: input.studentId, agentRunId });

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
