import { Annotation, Command, END, START, StateGraph, interrupt } from '@langchain/langgraph';
import { join } from 'node:path';
import type { AiAgentTraceStep, AiConsoleRunInput, AiConsoleRunResult, AiConsoleToolRun, AiProviderId, AiRouterDecision, AiStructuredReply } from '../../shared/contracts';
import type { OmniEduStore } from '../db';
import { buildAiSystemPrompt, requestDeepSeekCompletion, requestStructuredReplyRepair } from '../deepseek';
import { routeAiPrompt } from './router';
import { createAiToolExecutionState, executeAiToolCall, type CompiledAiContext } from './tool-registry';
import { parseStructuredReply, structuredReplyToMarkdown } from './schema';
import { gradeEducationalReply } from './education-grader';
import { gradeUsabilityReply } from './usability-policy';
import { SqliteGraphCheckpointer } from './sqlite-graph-checkpointer';

export const TRIPLET_GRAPH_VERSION = 'xiazhi.langgraph.triplet.v1';
export const TRIPLET_APPROVAL_GRAPH_VERSION = 'xiazhi.langgraph.triplet.v2';
const TRIPLET_MODEL_TIMEOUT_MS = 90_000;

export function isTripletGraphRequest(prompt: string, intent?: AiConsoleRunInput['intent']): boolean {
  return intent === 'mistake_triplet'
    && prompt.includes('脱敏题目：')
    && prompt.includes('三元题组');
}

const State = Annotation.Root({
  router: Annotation<AiRouterDecision>,
  toolPayload: Annotation<string>,
  similarQuestionIds: Annotation<string[]>,
  toolRuns: Annotation<AiConsoleToolRun[]>,
  rawReply: Annotation<string>,
  reply: Annotation<AiStructuredReply | undefined>,
  approvalDecision: Annotation<{ approved: boolean; confirmationId: string } | undefined>,
  errors: Annotation<string[]>,
});

function boundedError(error: unknown, provider: AiProviderId = 'deepseek'): string {
  const message = error instanceof Error ? error.message : String(error);
  if (/fetch failed|network|ECONN|ENOTFOUND|ETIMEDOUT|abort/i.test(message)) {
    return `${provider === 'glm' ? '智谱 GLM' : 'DeepSeek'} 连接失败或超时，请检查网络与模型配置后重试。`;
  }
  return message.slice(0, 600);
}

export async function runTripletGraph(params: {
  store: OmniEduStore;
  input: AiConsoleRunInput;
  apiKey?: string;
  provider?: AiProviderId;
  model: string;
  modelRequest?: typeof requestDeepSeekCompletion;
  checkpoint?: boolean;
  resumeRunId?: string;
  testRetrieveDelayMs?: number;
  enableTeacherInterrupt?: boolean;
  teacherDecision?: { approved: boolean; confirmationId: string };
}): Promise<AiConsoleRunResult> {
  const { store, input, model } = params;
  const prompt = input.prompt.trim();
  const router = routeAiPrompt('根据错题生成原题、相似题、变式题三元题组草稿', { hasStudent: Boolean(input.studentId) });
  const runId = params.resumeRunId ?? await store.startAiAgentRun({
    sessionId: input.sessionId, prompt, route: router.route, subIntent: router.subIntent,
    model, studentId: input.studentId,
  });
  const trace: AiAgentTraceStep[] = [];
  const emit = async (step: AiAgentTraceStep) => {
    trace.push(step);
    await store.recordAiAgentEvent(runId, step);
  };
  let finalStatus: 'succeeded' | 'failed' | 'blocked' | 'waiting_confirmation' = 'failed';
  let finalError = '';
  let result: AiConsoleRunResult;
  let executionContext: CompiledAiContext | undefined;
  let checkpointer: SqliteGraphCheckpointer | undefined;
  try {
    if (params.checkpoint !== false && !params.resumeRunId) {
      await store.saveAiAgentRunRequest(runId, {
        schemaVersion: 'xiazhi.triplet.request.v1',
        input: { ...input, prompt: prompt.slice(0, 8_000) },
        provider: params.provider === 'glm' ? 'glm' : 'deepseek', model,
      });
    }
    if (params.checkpoint !== false) {
      checkpointer = new SqliteGraphCheckpointer(join(store.getDataRoot(), 'app.db'), async (checkpoint) => {
        await emit({
          phase: 'observe', status: 'succeeded', label: 'LangGraph 节点检查点',
          detail: '节点状态已写入本地 SQLite。',
          outputSummary: { graphVersion: TRIPLET_GRAPH_VERSION, checkpointId: checkpoint.id, step: checkpoint.step, source: checkpoint.source },
        });
      });
    }
    const graph = new StateGraph(State)
      .addNode('route', async () => {
        if (!isTripletGraphRequest(prompt, input.intent) || router.route !== 'practice_design' || router.subIntent !== 'triplet_practice') throw new Error('三元题组任务路由不匹配。');
        if (!input.studentId) throw new Error('请选择学生后再分析错题。');
        if (!params.apiKey) throw new Error(`缺少${params.provider === 'glm' ? '智谱 GLM' : 'DeepSeek'} API Key，请在设置页保存配置。`);
        await emit({ phase: 'route', status: 'succeeded', label: '三元题组任务路由', detail: '进入 LangGraph 受控任务图。', outputSummary: { route: router.route, subIntent: router.subIntent, graphVersion: TRIPLET_GRAPH_VERSION } });
        return { router };
      })
      .addNode('retrieve', async () => {
        const context = createAiToolExecutionState(router, { resolvedStudentId: input.studentId });
        const observation = await executeAiToolCall({
          store, prompt, router, state: context,
          call: { name: 'search_similar_questions', arguments: { query: prompt.slice(-800), limit: 6, subject: router.slots.subject, knowledgePoint: router.slots.knowledgePoint } },
        });
        await emit({
          phase: 'tool_call', status: observation.toolRun.status === 'used' ? 'succeeded' : 'blocked',
          label: '检索本地相似题', detail: observation.toolRun.detail, toolName: 'search_similar_questions',
          outputSummary: { status: observation.toolRun.status, matchCount: context.similarQuestions.length, reviewAllowed: observation.review.ok },
        });
        if (params.testRetrieveDelayMs) await new Promise((resolve) => setTimeout(resolve, params.testRetrieveDelayMs));
        const safeObservation = await store.sanitizeProblemText(JSON.stringify(observation.modelResult), input.studentId);
        executionContext = context;
        const safeDetail = await store.sanitizeProblemText(observation.toolRun.detail.slice(0, 500), input.studentId);
        const toolRun: AiConsoleToolRun = {
          name: observation.toolRun.name, label: observation.toolRun.label,
          status: observation.toolRun.status, detail: safeDetail.sanitizedText,
          effect: observation.toolRun.effect, privacy: observation.toolRun.privacy,
        };
        return { similarQuestionIds: context.similarQuestions.map((item) => item.id).slice(0, 6), toolPayload: safeObservation.sanitizedText.slice(0, 4_000), toolRuns: [toolRun] };
      })
      .addNode('model', async (state) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), TRIPLET_MODEL_TIMEOUT_MS);
        try {
          const data = await (params.modelRequest ?? requestDeepSeekCompletion)({
            provider: params.provider,
            apiKey: params.apiKey!, model, signal: controller.signal, tools: [], maxTokens: 8_000,
            messages: [
              { role: 'system', content: `${buildAiSystemPrompt(router)}\n本轮额外必须返回 exerciseSetDraft：{title,subject,knowledgePoint,contentMd,items:[原题、相似题、变式题]}。items 按 original/similar/variant 顺序，每项包含 role,sourceKind,stem,answer,analysis,knowledgePoint,difficulty,teacherObservation；role 必须依次为英文枚举 original、similar、variant，difficulty 只能为英文枚举 easy、medium、hard，sourceKind 只能为 generated、local_bank、teacher_resource。本地题库项还需真实 questionId。无可验证题库命中时三项均标 generated。不要伪造 local_bank 或 teacher_resource 来源。` },
              { role: 'user', content: `${prompt.slice(0, 8_000)}\n\n本地相似题工具返回（已脱敏、有界）：${state.toolPayload ?? ''}\n没有命中时在 unknowns 中说明，不得编造本地题库来源。` },
            ],
          });
          const raw = data.choices?.[0]?.message?.content ?? '';
          const safeReply = await store.sanitizeProblemText(raw.slice(0, 32_000), input.studentId);
          const rawReply = safeReply.sanitizedText;
          await emit({ phase: 'observe', status: 'succeeded', label: '生成题组草稿', detail: '模型返回待校验草稿。', outputSummary: { replyLength: rawReply.length } });
          return { rawReply };
        } finally {
          clearTimeout(timeout);
        }
      })
      .addNode('validate', async (state) => {
        let parsed = parseStructuredReply(state.rawReply ?? '', router);
        if (parsed.errors.length && state.rawReply?.trim()) {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 45_000);
          try {
            const repair = await (params.modelRequest ?? requestStructuredReplyRepair)({
              provider: params.provider, apiKey: params.apiKey!, model, signal: controller.signal,
              messages: [
                { role: 'system', content: `${buildAiSystemPrompt(router)}\n只修复 JSON 结构和枚举值；不得新增事实、题库命中或来源 ID。exerciseSetDraft.items 的 role 必须依次为 original、similar、variant；difficulty 只能为 easy、medium、hard。` },
                { role: 'user', content: `以下草稿未通过校验：${parsed.errors.slice(0, 12).join('；').slice(0, 1_200)}\n请在保留原题目含义、答案和来源边界的前提下，返回完整且符合 xiazhi.reply.v2 的 JSON。原草稿：${state.rawReply.slice(0, 12_000)}` },
              ],
            });
            const repaired = parseStructuredReply(repair.choices?.[0]?.message?.content ?? '', router);
            await emit({ phase: 'guardrail', status: repaired.errors.length ? 'blocked' : 'succeeded', label: '结构化草稿受控修复', detail: repaired.errors.length ? repaired.errors.join('；').slice(0, 600) : '模型按 schema 修复草稿，继续执行来源与教学门禁。', outputSummary: { attempted: true, valid: repaired.errors.length === 0 } });
            parsed = repaired;
          } catch (error) {
            await emit({ phase: 'guardrail', status: 'blocked', label: '结构化草稿受控修复', detail: boundedError(error, params.provider), outputSummary: { attempted: true, valid: false } });
          } finally {
            clearTimeout(timeout);
          }
        }
        const errors = [...parsed.errors];
        if (parsed.reply && !parsed.reply.exerciseSetDraft) errors.push('三元题组缺少可保存的 exerciseSetDraft。');
        const allowedQuestionIds = new Set(state.similarQuestionIds ?? []);
        for (const item of parsed.reply?.exerciseSetDraft?.items ?? []) {
          if (item.sourceKind === 'local_bank' && (!item.questionId || !allowedQuestionIds.has(item.questionId))) errors.push(`${item.role} 声称的本地题库来源未在本轮召回结果中。`);
          if (item.sourceKind === 'teacher_resource') errors.push(`${item.role} 没有本轮可核验的教师资源来源。`);
        }
        if (parsed.reply) {
          const education = gradeEducationalReply({ reply: parsed.reply, router, toolRuns: state.toolRuns ?? [] });
          const usability = gradeUsabilityReply({ reply: parsed.reply, router });
          if (!education.passed) errors.push(...education.issues.map((issue) => issue.message));
          if (!usability.passed) errors.push(...usability.issues.map((issue) => issue.message));
        }
        await emit({ phase: 'guardrail', status: errors.length ? 'blocked' : 'succeeded', label: '结构与教学质量门禁', detail: errors.length ? errors.join('；').slice(0, 600) : '结构与教学质量校验通过。', outputSummary: { schemaValid: Boolean(parsed.reply), issueCount: errors.length } });
        return { reply: errors.length ? undefined : parsed.reply, errors };
      })
      .addNode('teacher_approval', async () => {
        const decision = interrupt<{ kind: string; runId: string }, { approved: boolean; confirmationId: string }>({ kind: 'teacher_confirmation', runId });
        if (!decision || typeof decision.approved !== 'boolean' || typeof decision.confirmationId !== 'string' || !decision.confirmationId.startsWith('confirm_')) {
          throw new Error('教师确认恢复载荷无效。');
        }
        await emit({ phase: 'guardrail', status: decision.approved ? 'succeeded' : 'blocked', label: '教师确认已处理', detail: decision.approved ? '老师已确认保存题组。' : '老师已拒绝保存题组。', outputSummary: { approved: decision.approved, confirmationId: decision.confirmationId } });
        return { approvalDecision: decision };
      })
      .addEdge(START, 'route').addEdge('route', 'retrieve').addEdge('retrieve', 'model')
      .addEdge('model', 'validate')
      .addConditionalEdges('validate', () => params.enableTeacherInterrupt ? 'teacher_approval' : END)
      .addEdge('teacher_approval', END)
      .compile({ checkpointer });
    const config = { configurable: { thread_id: runId }, durability: 'sync' as const };
    if (params.teacherDecision) {
      const prior = await graph.getState(config);
      if (!prior.next.includes('teacher_approval')) throw new Error('原任务不在等待教师确认状态。');
    }
    const state = await graph.invoke(params.teacherDecision
      ? new Command({ resume: params.teacherDecision })
      : params.resumeRunId ? null : { router, errors: [] }, config);
    const snapshot = params.enableTeacherInterrupt ? await graph.getState(config) : undefined;
    const approvalPending = Boolean(snapshot?.next.includes('teacher_approval'));
    if (!state.reply) throw new Error(state.errors.join('；') || '题组草稿未通过校验。');
    const reply: AiStructuredReply = state.reply.artifacts.some((item) => item.type === 'exercise_set')
      ? state.reply
      : { ...state.reply, artifacts: [...state.reply.artifacts, { id: 'triplet-draft', title: '小智三元题组草稿', type: 'exercise_set', fileName: 'triplet-draft.md', description: '请教师校正后确认保存。', requiresTeacherConfirmation: true }] };
    const educationGrade = gradeEducationalReply({ reply, router, toolRuns: state.toolRuns ?? [] });
    const usabilityGrade = gradeUsabilityReply({ reply, router });
    finalStatus = approvalPending ? 'waiting_confirmation' : params.teacherDecision && !params.teacherDecision.approved ? 'blocked' : 'succeeded';
    await emit({ phase: 'finalize', status: approvalPending ? 'pending' : finalStatus === 'succeeded' ? 'succeeded' : 'blocked', label: approvalPending ? '图等待教师确认' : params.teacherDecision ? '图审批已结束' : '待教师确认', detail: approvalPending ? 'LangGraph 已持久化教师确认中断。' : params.teacherDecision ? '教师决策已从原检查点继续。' : '题组仅作为草稿返回，保存仍需教师确认。', outputSummary: { graphVersion: params.enableTeacherInterrupt ? TRIPLET_APPROVAL_GRAPH_VERSION : TRIPLET_GRAPH_VERSION, requiresTeacherConfirmation: approvalPending } });
    result = {
      ok: true, executionMode: 'structured', model, provider: params.provider ?? 'deepseek', content: structuredReplyToMarkdown(reply),
      toolRuns: state.toolRuns ?? [], sources: executionContext?.sources ?? [],
      similarQuestions: executionContext?.similarQuestions ?? [],
      structuredReply: reply, artifacts: reply.artifacts,
      harness: { agentRunId: runId, harnessVersion: TRIPLET_GRAPH_VERSION, router, selectedContext: executionContext?.selectedContext ?? [], schemaValid: true, schemaApplicable: true, graderApplicable: true, schemaErrors: [], educationGrade, usabilityGrade, trace },
    };
  } catch (error) {
    finalError = boundedError(error, params.provider);
    const errorCode = /连接失败或超时/.test(finalError) ? 'network' : 'task_failed';
    await emit({ phase: 'finalize', status: 'failed', label: '题组任务失败', detail: finalError, outputSummary: { graphVersion: TRIPLET_GRAPH_VERSION, errorCode } });
    result = {
      ok: false, executionMode: 'structured', model, provider: params.provider ?? 'deepseek', content: '', toolRuns: [], sources: [], errorMessage: finalError,
      harness: { agentRunId: runId, harnessVersion: TRIPLET_GRAPH_VERSION, router, selectedContext: [], schemaValid: false, schemaApplicable: true, graderApplicable: true, schemaErrors: [finalError], trace },
    };
  } finally {
    await checkpointer?.close();
  }
  await store.completeAiAgentRun(runId, finalStatus, finalError);
  return result;
}
