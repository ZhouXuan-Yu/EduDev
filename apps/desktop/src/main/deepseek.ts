import type {
  AiConsoleRunResult,
  AiConsoleSource,
  AiConsoleToolRun,
  AiAgentTraceStep,
  AiHarnessRunSummary,
  AiRouterDecision,
  KnowledgeNode,
  LearningRecord,
  ResourceChunk,
  Student,
} from '../shared/contracts';
import { parseStructuredReply, structuredReplyToMarkdown } from './ai-harness/schema';

type DeepSeekMessage = {
  role: 'system' | 'user';
  content: string;
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
  prompt: string;
  agentRunId?: string;
  router: AiRouterDecision;
  student?: Student;
  records: LearningRecord[];
  knowledgeSnippets: ResourceChunk[];
  graphNodes: KnowledgeNode[];
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
    `当前 route：${router.route}，受众：${router.audience}，动作级别：${router.actionLevel}，风险级别：${router.riskLevel}。`,
    routeInstruction(router.route),
    '不要声称读取了未提供的 PDF、Word、图片原文或未接入的知识图谱。',
    '涉及保存复盘、题组、学生标签或知识图谱关系时，只能提出草稿和待确认项，不能宣称已经写入。',
    '学生相关判断必须区分事实、推断和未知；不得自动形成永久学生标签。',
    '如果上下文不足，明确写入 unknowns，不要用流畅文字掩盖缺口。',
    'processSummary 只能复述提供的 Agent loop 轨迹，不展示模型内部隐式推理。',
    '中文回答，语气专业、克制、适合老师工作台。',
    '只返回合法 JSON，不要使用 Markdown 代码围栏。',
    'JSON schema：{"schemaVersion":"xiazhi.reply.v1","route":"当前route","answerMarkdown":"string","evidence":[{"sourceId":"string","quote":"string","note":"string"}],"inferences":["string"],"unknowns":["string"],"teacherConfirmations":["string"],"nextActions":["string"],"artifacts":[{"id":"string","title":"string","type":"markdown|pdf|docx|exercise_set|report_draft","fileName":"string","description":"string","requiresTeacherConfirmation":true}],"processSummary":["string"]}',
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

  return [
    `老师的一句话任务：${context.prompt}`,
    `Router dry-run：${context.router.route}，confidence=${context.router.confidence.toFixed(2)}。`,
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
    '## 工具状态',
    toolBlock || '本 route 没有执行工具。',
    '',
    '## Agent loop 轨迹（可展示给老师的外部过程，不是隐藏推理链）',
    traceBlock,
    '',
    '请基于上述真实上下文回答。必须返回 xiazhi.reply.v1 JSON。',
  ].join('\n');
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
    const response = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model,
        messages,
        stream: false,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      }),
      signal: controller.signal,
    });

    const data = (await response.json().catch(() => ({}))) as DeepSeekResponse;
    if (!response.ok) {
      throw new Error(data.error?.message || `DeepSeek 请求失败：HTTP ${response.status}`);
    }

    const content = data.choices?.[0]?.message?.content?.trim();
    if (!content) throw new Error('DeepSeek 返回为空。');
    const parsed = parseStructuredReply(content, context.router.route);
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
        harness,
        errorMessage: `DeepSeek 结构化回复校验失败：${parsed.errors.join('；') || '未知错误'}`,
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
      harness,
      errorMessage: error instanceof Error ? error.message : 'DeepSeek 调用失败。',
    };
  } finally {
    clearTimeout(timeout);
  }
}
