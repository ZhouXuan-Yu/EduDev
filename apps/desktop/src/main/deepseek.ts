import type {
  AiModelToolCall,
  AiConsoleRunResult,
  AiConsoleSource,
  AiConsoleToolRun,
  AiAgentTraceStep,
  AiHarnessRunSummary,
  AiRouterDecision,
  KnowledgeNode,
  LearningRecord,
  ResourceChunk,
  SimilarQuestionMatch,
  Student,
} from '../shared/contracts';
import type { OmniEduStore } from './db';
import { gradeEducationalReply } from './ai-harness/education-grader';
import { parseStructuredReply, structuredReplyToMarkdown } from './ai-harness/schema';
import { createAiToolExecutionState, executeAiToolCall, getModelToolDefinitions } from './ai-harness/tool-registry';

type DeepSeekMessage = {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string | null;
  tool_calls?: DeepSeekToolCall[];
  tool_call_id?: string;
};

type DeepSeekToolCall = {
  id?: string;
  type?: 'function';
  function?: {
    name?: string;
    arguments?: string;
  };
};

type DeepSeekUsage = {
  prompt_tokens?: number;
  completion_tokens?: number;
  total_tokens?: number;
};

type DeepSeekResponse = {
  choices?: Array<{
    message?: {
      content?: string;
      tool_calls?: DeepSeekToolCall[];
    };
  }>;
  usage?: DeepSeekUsage;
  error?: {
    message?: string;
  };
};

const DEEPSEEK_BASE_URL = 'https://api.deepseek.com';
const DEFAULT_DEEPSEEK_MODEL = 'deepseek-v4-flash';

export type DeepSeekContext = {
  store?: OmniEduStore;
  prompt: string;
  agentRunId?: string;
  router: AiRouterDecision;
  student?: Student;
  records: LearningRecord[];
  knowledgeSnippets: ResourceChunk[];
  graphNodes: KnowledgeNode[];
  similarQuestions: SimilarQuestionMatch[];
  sources: AiConsoleSource[];
  toolRuns: AiConsoleToolRun[];
  selectedContext: AiHarnessRunSummary['selectedContext'];
  trace: AiAgentTraceStep[];
};

function routeInstruction(route: AiRouterDecision['route']) {
  const instructions: Record<AiRouterDecision['route'], string> = {
    general_qa: '直接回答老师的问题；除非用户明确要求，不要读取或猜测学生档案。',
    student_diagnosis: '围绕学生表现做诊断时，必须区分事实、推断和未知，不形成永久标签。',
    error_analysis: '错因分析要指向具体记录或题目证据，并把可迁移的解题策略讲清楚。',
    practice_design: '练习设计要服务三元题组：原题定位、相似题巩固、变式题迁移。',
    lesson_design: '备课输出面向老师课堂使用，优先给结构、讲解顺序、活动和检查点。',
    report_draft: '报告草稿面向老师二次编辑，涉及家长表达时要克制、可证据化、保护隐私。',
    knowledge_retrieval: '知识检索要优先列出来源和边界，不把未命中的资料说成已读取。',
    workspace_help: '工作台帮助要短、直接、可操作；不要调用学生隐私上下文。',
  };
  return instructions[route];
}

export function buildAiSystemPrompt(router: AiRouterDecision) {
  return [
    '你是“小智”，Omni-Edu Agent 的教师 AI 中控台。',
    '你的用户是 K-12 独立教师或小微教研团队，不是学生端聊天用户。',
    '先遵守任务路由，再遵守 route 专属规则，最后使用提供的上下文。',
    `当前 route：${router.route}，subIntent：${router.subIntent}，受众：${router.audience}，动作级别：${router.actionLevel}，风险级别：${router.riskLevel}。`,
    `已抽取槽位：${JSON.stringify(router.slots)}。`,
    routeInstruction(router.route),
    '不要声称读取了未提供的 PDF、Word、图片原文或未接入的知识图谱。',
    '涉及保存复盘、题组、学生标签或知识图谱关系时，只能提出草稿和待确认项，不能宣称已经写入。',
    '三元题组中来自本地题库的题必须标注 sourceKind=local_bank 或引用题库来源；模型临时生成的变式题必须标注 generated，不得冒充题库命中。',
    '学生相关判断必须区分事实、推断和未知；不得自动形成永久学生标签。',
    '如果上下文不足，明确写入 unknowns，不要用流畅文字掩盖缺口。',
    'processSummary 只能复述提供的 Agent loop 轨迹，不展示模型内部隐式推理。',
    '中文回答，语气专业、克制、适合老师工作台。',
    '只返回合法 JSON，不要使用 Markdown 代码围栏。',
    '必须返回 xiazhi.reply.v2 JSON。facts 是可核验事实；evidence 是来源说明；inferences 是推断；risks 是隐私/写入/证据缺口等边界。',
    'routeCheck 必须说明当前 route 校验已通过。学生诊断必须有 facts 或 unknowns；三元题组必须包含原题、相似题、变式题；写入型报告必须要求老师确认。',
    'JSON schema：{"schemaVersion":"xiazhi.reply.v2","route":"当前route","subIntent":"当前subIntent","answerMarkdown":"string","facts":[{"statement":"string","sourceId":"string","confidence":"high|medium|low"}],"evidence":[{"sourceId":"string","quote":"string","note":"string"}],"inferences":["string"],"unknowns":["string"],"risks":[{"level":"normal|sensitive|safeguarding","category":"privacy|safeguarding|bias|write_action|evidence_gap|none","mitigation":"string"}],"teacherConfirmations":["string"],"nextActions":["string"],"artifacts":[{"id":"string","title":"string","type":"markdown|pdf|docx|exercise_set|report_draft","fileName":"string","description":"string","requiresTeacherConfirmation":true}],"routeCheck":{"kind":"当前route","passed":true,"notes":["string"]},"processSummary":["string"]}',
  ].join('\n');
}

export function buildAiUserPrompt(context: DeepSeekContext) {
  const studentBlock = context.student
    ? [
        `学生：${context.student.displayName}`,
        `年级：${context.student.grade || '未填写'}`,
        `科目：${context.student.subjects.join(' / ') || '未填写'}`,
        `阶段目标：${context.student.goals || '未填写'}`,
        `当前问题：${context.student.currentIssues || '未填写'}`,
        `家长关注点：${context.student.parentConcerns || '未填写'}`,
        `标签：${context.student.tags.join('、') || '无'}`,
      ].join('\n')
    : '未选择学生。';

  const recordBlock = context.records.length
    ? context.records
        .map((record, index) =>
          [
            `[记录 ${index + 1}]`,
            `时间：${record.occurredAt}`,
            `类型：${record.recordType}`,
            `科目：${record.subject || '未填写'}`,
            `标题：${record.title}`,
            `正文：${record.content || '无正文'}`,
            `标签：${record.tags.join('、') || '无'}`,
            `附件数量：${record.attachments.length}`,
          ].join('\n'),
        )
        .join('\n\n')
    : '当前学生没有可用学习记录。';

  const sourceBlock = context.sources.length
    ? context.sources
        .map((source) => `- ${source.id ?? source.title}｜${source.title}｜${source.type}｜${source.detail}｜数量/状态：${source.count}`)
        .join('\n')
    : '本 route 没有读取本地上下文。';

  const toolBlock = context.toolRuns
    .map((tool) => `- ${tool.label} (${tool.name})：${tool.status}｜${tool.detail}`)
    .join('\n')

  const traceBlock = context.trace.length
    ? context.trace
        .map((step, index) => `${index + 1}. [${step.phase}/${step.status}] ${step.label}：${step.detail}`)
        .join('\n')
    : '本轮没有可展示的 Agent loop 轨迹。';

  const knowledgeBlock = context.knowledgeSnippets.length
    ? context.knowledgeSnippets
        .slice(0, 8)
        .map((chunk, index) =>
          [
            `[知识片段 ${index + 1}]`,
            `资源：${chunk.resourceTitle}`,
            `标题：${chunk.heading || '未命名片段'}`,
            `内容：${chunk.contentMd.slice(0, 900)}`,
          ].join('\n'),
        )
        .join('\n\n')
    : '没有命中可用的老师知识库文本片段。';

  const graphBlock = context.graphNodes.length
    ? context.graphNodes
        .slice(0, 12)
        .map((node) => `- ${node.nodeType}：${node.name}｜${node.summary || '无摘要'}｜来源：${node.sourceKind}:${node.sourceId}`)
        .join('\n')
    : '当前没有可用知识图谱节点。';

  const questionBlock = context.similarQuestions.length
    ? context.similarQuestions
        .slice(0, 8)
        .map((question, index) =>
          [
            `[题库命中 ${index + 1}]`,
            `ID：${question.id}`,
            `来源：${question.sourceKind}｜${question.sourceTitle}`,
            `学科/知识点：${question.subject || '未填'} / ${question.knowledgePoint || '未填'}`,
            `难度/题型：${question.difficulty} / ${question.questionType || '未填'}`,
            `题干：${question.stem}`,
            `答案：${question.answer || '未填写'}`,
            `解析：${question.analysis || '未填写'}`,
            `匹配原因：${question.matchReason}`,
          ].join('\n'),
        )
        .join('\n\n')
    : '本地题库没有命中可用相似题；如需生成题，必须标注 generated。';

  return [
    `老师的一句话任务：${context.prompt}`,
    `Router dry-run：${context.router.route}/${context.router.subIntent}，confidence=${context.router.confidence.toFixed(2)}。`,
    `Router slots：${JSON.stringify(context.router.slots)}。`,
    `上下文策略：${context.router.contextPolicy.reason}`,
    context.router.clarificationQuestion ? `需要澄清：${context.router.clarificationQuestion}` : '',
    '',
    context.selectedContext.includes('student_profile') ? '## 当前学生档案' : '',
    context.selectedContext.includes('student_profile') ? studentBlock : '',
    '',
    context.selectedContext.includes('learning_records') ? '## 可用学习记录' : '',
    context.selectedContext.includes('learning_records') ? recordBlock : '',
    '',
    '## 可调用数据源',
    sourceBlock,
    '',
    context.selectedContext.includes('teacher_knowledge') ? '## 老师知识库命中片段' : '',
    context.selectedContext.includes('teacher_knowledge') ? knowledgeBlock : '',
    '',
    context.selectedContext.includes('knowledge_graph') ? '## 知识图谱节点' : '',
    context.selectedContext.includes('knowledge_graph') ? graphBlock : '',
    '',
    context.selectedContext.includes('question_bank') ? '## 本地题库相似题候选' : '',
    context.selectedContext.includes('question_bank') ? questionBlock : '',
    '',
    '## 工具状态',
    toolBlock || '本 route 没有执行工具。',
    '',
    '## Agent loop 轨迹（可展示给老师的外部过程，不是隐藏推理链）',
    traceBlock,
    '',
    '请基于上述真实上下文回答。必须返回 xiazhi.reply.v2 JSON。',
  ].join('\n');
}

function statusFromToolRun(status: AiConsoleToolRun['status']): AiAgentTraceStep['status'] {
  if (status === 'used') return 'succeeded';
  if (status === 'failed') return 'failed';
  if (status === 'blocked') return 'blocked';
  return 'pending';
}

function toModelToolCall(toolCall: DeepSeekToolCall): AiModelToolCall {
  return {
    id: toolCall.id,
    name: toolCall.function?.name ?? '',
    arguments: toolCall.function?.arguments ?? {},
  };
}

async function emitTrace(context: DeepSeekContext, step: AiAgentTraceStep) {
  context.trace.push(step);
  if (context.store && context.agentRunId) {
    await context.store.recordAiAgentEvent(context.agentRunId, step);
  }
}

async function requestDeepSeek(params: {
  apiKey: string;
  model: string;
  messages: DeepSeekMessage[];
  signal: AbortSignal;
  tools?: ReturnType<typeof getModelToolDefinitions>;
}) {
  const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${params.apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: params.model,
      messages: params.messages,
      stream: false,
      temperature: 0.2,
      response_format: { type: 'json_object' },
      ...(params.tools?.length ? { tools: params.tools, tool_choice: 'auto' } : {}),
    }),
    signal: params.signal,
  });

  const data = (await response.json().catch(() => ({}))) as DeepSeekResponse;
  if (!response.ok) {
    throw new Error(data.error?.message || `DeepSeek 请求失败：HTTP ${response.status}`);
  }
  return data;
}

export async function runDeepSeekChat(context: DeepSeekContext, apiKey: string, model = DEFAULT_DEEPSEEK_MODEL): Promise<AiConsoleRunResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45_000);
  const messages: DeepSeekMessage[] = [
    { role: 'system', content: buildAiSystemPrompt(context.router) },
    { role: 'user', content: buildAiUserPrompt(context) },
  ];
  const harness: AiHarnessRunSummary = {
    agentRunId: context.agentRunId,
    router: context.router,
    selectedContext: context.selectedContext,
    schemaValid: false,
    schemaErrors: [],
    trace: context.trace,
  };

  try {
    const tools = context.store ? getModelToolDefinitions(context.router) : [];
    let data = await requestDeepSeek({ apiKey, model, messages, signal: controller.signal, tools });
    const firstMessage = data.choices?.[0]?.message;
    const toolCalls = firstMessage?.tool_calls ?? [];
    if (toolCalls.length && context.store) {
      const state = createAiToolExecutionState(context.router, context);
      messages.push({
        role: 'assistant',
        content: firstMessage?.content ?? null,
        tool_calls: toolCalls,
      });

      for (const toolCall of toolCalls.slice(0, 4)) {
        const modelToolCall = toModelToolCall(toolCall);
        const execution = await executeAiToolCall({
          store: context.store,
          prompt: context.prompt,
          router: context.router,
          state,
          call: modelToolCall,
        });
        await emitTrace(context, {
          phase: 'tool_call',
          status: statusFromToolRun(execution.toolRun.status),
          label: `模型请求工具：${execution.toolRun.label}`,
          detail: `${execution.toolRun.name}｜${execution.review.ok ? '已通过主进程审核' : execution.review.reason}`,
          toolName: execution.toolRun.name,
          inputSummary: execution.toolRun.inputSummary,
          outputSummary: {
            review: execution.review.ok ? 'allowed' : 'blocked',
            errors: execution.review.errors,
          },
        });
        await emitTrace(context, {
          phase: 'observe',
          status: statusFromToolRun(execution.toolRun.status),
          label: `模型工具观察：${execution.toolRun.label}`,
          detail: execution.toolRun.detail,
          toolName: execution.toolRun.name,
          outputSummary: execution.toolRun.outputSummary,
        });
        messages.push({
          role: 'tool',
          tool_call_id: toolCall.id ?? execution.toolRun.name,
          content: JSON.stringify(execution.modelResult),
        });
      }

      context.student = state.student;
      context.records = state.records;
      context.knowledgeSnippets = state.knowledgeSnippets;
      context.graphNodes = state.graphNodes;
      context.similarQuestions = state.similarQuestions;
      context.sources = state.sources;
      context.toolRuns = state.toolRuns;
      context.selectedContext = state.selectedContext;
      harness.selectedContext = context.selectedContext;
      messages.push({
        role: 'user',
        content: '工具结果已返回。请基于工具结果和已提供上下文，严格返回 xiazhi.reply.v2 JSON；不要再请求工具。',
      });
      data = await requestDeepSeek({ apiKey, model, messages, signal: controller.signal });
    }

    let content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('DeepSeek 返回为空。');
    let parsed = parseStructuredReply(content, context.router);
    if (!parsed.reply) {
      await emitTrace(context, {
        phase: 'guardrail',
        status: 'blocked',
        label: '结构化回复修复',
        detail: `第一次 xiazhi.reply.v2 校验失败，执行一次受控 JSON repair。错误：${parsed.errors.join('；')}`,
        outputSummary: { schemaErrors: parsed.errors, repairAttempted: true },
      });
      messages.push({ role: 'assistant', content });
      messages.push({
        role: 'user',
        content: [
          '你的上一条回复没有通过本地 xiazhi.reply.v2 校验。',
          `校验错误：${parsed.errors.join('；')}`,
          `必须保持 route=${context.router.route}，subIntent=${context.router.subIntent}。`,
          '只修复 JSON 结构和缺失字段，不要新增工具调用，不要编造未提供证据。',
          '重新返回一个合法 xiazhi.reply.v2 JSON。',
        ].join('\n'),
      });
      const repairData = await requestDeepSeek({ apiKey, model, messages, signal: controller.signal });
      content = repairData.choices?.[0]?.message?.content?.trim();
      if (!content) throw new Error('DeepSeek repair 返回为空。');
      data = repairData;
      parsed = parseStructuredReply(content, context.router);
    }
    harness.schemaValid = Boolean(parsed.reply);
    harness.schemaErrors = parsed.errors;
    if (!parsed.reply) {
      return {
        ok: false,
        model,
        content: '',
        toolRuns: context.toolRuns,
        sources: context.sources,
        knowledgeSnippets: context.knowledgeSnippets,
        graphNodes: context.graphNodes,
        similarQuestions: context.similarQuestions,
        harness,
        errorMessage: `DeepSeek xiazhi.reply.v2 结构化回复校验失败：${parsed.errors.join('；') || '未知错误'}`,
      };
    }
    const educationGrade = gradeEducationalReply({
      reply: parsed.reply,
      router: context.router,
      toolRuns: context.toolRuns,
    });
    harness.educationGrade = educationGrade;
    await emitTrace(context, {
      phase: 'reflect',
      status: educationGrade.passed ? 'succeeded' : 'blocked',
      label: '教育质量评分',
      detail: educationGrade.passed
        ? `Education Grader 通过，score=${educationGrade.score}。`
        : `Education Grader 未通过，score=${educationGrade.score}：${educationGrade.issues.map((item) => item.code).join('、')}`,
      outputSummary: {
        score: educationGrade.score,
        passed: educationGrade.passed,
        issues: educationGrade.issues,
      },
    });
    if (!educationGrade.passed) {
      return {
        ok: false,
        model,
        content: '',
        toolRuns: context.toolRuns,
        sources: context.sources,
        knowledgeSnippets: context.knowledgeSnippets,
        graphNodes: context.graphNodes,
        similarQuestions: context.similarQuestions,
        structuredReply: parsed.reply,
        artifacts: parsed.reply.artifacts,
        harness,
        errorMessage: `Education Grader 未通过：${educationGrade.issues.map((item) => item.message).join('；')}`,
      };
    }
    const responseContent = parsed.reply ? structuredReplyToMarkdown(parsed.reply) : content;

    return {
      ok: true,
      model,
      content: responseContent,
      toolRuns: context.toolRuns,
      sources: context.sources,
      knowledgeSnippets: context.knowledgeSnippets,
      graphNodes: context.graphNodes,
      similarQuestions: context.similarQuestions,
      structuredReply: parsed.reply,
      artifacts: parsed.reply?.artifacts ?? [],
      harness,
      usage: {
        promptTokens: data.usage?.prompt_tokens,
        completionTokens: data.usage?.completion_tokens,
        totalTokens: data.usage?.total_tokens,
      },
    };
  } catch (error) {
    return {
      ok: false,
      model,
      content: '',
      toolRuns: context.toolRuns,
      sources: context.sources,
      knowledgeSnippets: context.knowledgeSnippets,
      graphNodes: context.graphNodes,
      similarQuestions: context.similarQuestions,
      harness,
      errorMessage: error instanceof Error ? error.message : 'DeepSeek 调用失败。',
    };
  } finally {
    clearTimeout(timeout);
  }
}
