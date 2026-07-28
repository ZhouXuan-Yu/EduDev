import type {
  AiConsoleSource,
  AiConsoleToolRun,
  AiContextKey,
  AiIntentRoute,
  AiModelToolCall,
  AiModelToolDefinition,
  AiModelToolJsonSchema,
  AiModelToolReview,
  AiRouterDecision,
  KnowledgeNode,
  LearningRecord,
  ResourceChunk,
  SimilarQuestionMatch,
  Student,
} from '../../shared/contracts';
import type { OmniEduStore } from '../db';

type ToolDescriptor = {
  name: string;
  label: string;
  description: string;
  contextKey: AiContextKey;
  effect: 'read' | 'draft' | 'write';
  privacy: 'local_only' | 'sanitized_cloud';
  allowedRoutes: AiIntentRoute[];
  parameters: AiModelToolJsonSchema;
  maxOutputChars: number;
};

export type CompiledAiContext = {
  student?: Student;
  records: LearningRecord[];
  knowledgeSnippets: ResourceChunk[];
  graphNodes: KnowledgeNode[];
  similarQuestions: SimilarQuestionMatch[];
  sources: AiConsoleSource[];
  toolRuns: AiConsoleToolRun[];
  selectedContext: AiContextKey[];
  resolvedStudentId?: string;
};

export type AiToolExecutionResult = {
  review: AiModelToolReview;
  toolRun: AiConsoleToolRun;
  modelResult: Record<string, unknown>;
};

const DEFAULT_TOOL_OUTPUT_LIMIT = 4_000;

export const AI_TOOL_REGISTRY: ToolDescriptor[] = [
  {
    name: 'resolve_student_reference',
    label: '解析学生引用',
    description: '从当前任务文本或显式 studentName 中解析本地学生显示名，只返回最小绑定信息。',
    contextKey: 'student_lookup',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ['student_diagnosis', 'error_analysis', 'practice_design', 'report_draft'],
    maxOutputChars: 2_000,
    parameters: {
      type: 'object',
      properties: {
        studentName: {
          type: 'string',
          description: '老师提到的学生显示名，例如“小A”。为空时从任务文本中解析。',
          maxLength: 40,
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'get_student_profile',
    label: '读取学生档案',
    description: '读取已绑定学生的脱敏档案摘要，用于学生诊断、错因分析、题组设计或报告草稿。',
    contextKey: 'student_profile',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ['student_diagnosis', 'error_analysis', 'practice_design', 'report_draft'],
    maxOutputChars: 3_000,
    parameters: {
      type: 'object',
      properties: {
        studentId: {
          type: 'string',
          description: '可选学生 ID。为空时使用本轮已解析或当前选中的学生。',
          maxLength: 120,
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'search_learning_records',
    label: '检索学习记录',
    description: '按已绑定学生读取近期学习记录，可选 keyword 缩小范围；返回 bounded 摘要。',
    contextKey: 'learning_records',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ['student_diagnosis', 'error_analysis', 'practice_design', 'report_draft'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        studentId: {
          type: 'string',
          description: '可选学生 ID。为空时使用本轮已解析或当前选中的学生。',
          maxLength: 120,
        },
        keyword: {
          type: 'string',
          description: '可选检索关键词，例如“方程”“计算粗心”。',
          maxLength: 80,
        },
        limit: {
          type: 'number',
          description: '最多读取记录数，不能超过当前 route 的 recordLimit。',
          minimum: 1,
          maximum: 20,
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'list_attachment_metadata',
    label: '读取附件元数据',
    description: '统计已读取学习记录中的附件数量和类型；不读取、不上传原始附件。',
    contextKey: 'attachment_metadata',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ['student_diagnosis', 'error_analysis', 'report_draft'],
    maxOutputChars: 1_500,
    parameters: {
      type: 'object',
      properties: {},
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'search_teacher_knowledge',
    label: '检索老师知识库',
    description: '检索老师本地知识库切片，返回可发送给模型的 bounded 教学资料片段。',
    contextKey: 'teacher_knowledge',
    effect: 'read',
    privacy: 'sanitized_cloud',
    allowedRoutes: ['student_diagnosis', 'error_analysis', 'practice_design', 'lesson_design', 'report_draft', 'knowledge_retrieval'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '知识库检索查询。为空时使用老师原始任务。',
          maxLength: 160,
        },
        limit: {
          type: 'number',
          description: '最多返回知识片段数，不能超过当前 route 的 knowledgeLimit。',
          minimum: 1,
          maximum: 12,
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'query_knowledge_graph',
    label: '查询知识图谱',
    description: '读取知识图谱节点摘要，不执行 Graph RAG，只返回 bounded 节点列表。',
    contextKey: 'knowledge_graph',
    effect: 'read',
    privacy: 'sanitized_cloud',
    allowedRoutes: ['practice_design', 'lesson_design', 'knowledge_retrieval'],
    maxOutputChars: 3_000,
    parameters: {
      type: 'object',
      properties: {
        limit: {
          type: 'number',
          description: '最多返回节点数，不能超过当前 route 的 graphNodeLimit。',
          minimum: 1,
          maximum: 20,
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'search_similar_questions',
    label: '检索本地相似题',
    description: '按学科、知识点和查询文本从本地题库召回相似题；返回题库题和生成题来源边界。',
    contextKey: 'question_bank',
    effect: 'read',
    privacy: 'sanitized_cloud',
    allowedRoutes: ['practice_design'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: '检索查询，例如“一次函数 k 值 图像”。为空时使用老师原始任务。',
          maxLength: 160,
        },
        subject: {
          type: 'string',
          description: '学科，例如“数学”。',
          maxLength: 40,
        },
        knowledgePoint: {
          type: 'string',
          description: '知识点，例如“一次函数”。',
          maxLength: 80,
        },
        limit: {
          type: 'number',
          description: '最多返回题目数，1-12。',
          minimum: 1,
          maximum: 12,
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
];

function descriptorByName(name: string) {
  return AI_TOOL_REGISTRY.find((tool) => tool.name === name);
}

function createToolRun(
  tool: Pick<ToolDescriptor, 'name' | 'label' | 'effect' | 'privacy'>,
  status: AiConsoleToolRun['status'],
  detail: string,
  inputSummary?: Record<string, unknown>,
  outputSummary?: Record<string, unknown>,
): AiConsoleToolRun {
  return {
    name: tool.name,
    label: tool.label,
    status,
    detail,
    effect: tool.effect,
    privacy: tool.privacy,
    inputSummary,
    outputSummary,
  };
}

function addSource(sources: AiConsoleSource[], source: AiConsoleSource) {
  sources.push(source);
}

function extractNamedStudentHints(prompt: string) {
  const hints = new Set<string>();
  for (const match of prompt.matchAll(/小[\p{L}\p{N}_-]{1,12}/gu)) {
    hints.add(match[0]);
  }
  return [...hints];
}

function findStudentByPrompt(prompt: string, students: Student[], explicitName?: string) {
  const hints = new Set(extractNamedStudentHints(prompt));
  if (explicitName?.trim()) hints.add(explicitName.trim());
  const hintList = [...hints];
  const exact = students.find((student) =>
    [student.displayName, student.realName].some((name) => name && hintList.includes(name)),
  );
  if (exact) return { student: exact, matchType: 'exact_hint' as const, hints: hintList };

  const embedded = students.find((student) =>
    [student.displayName, student.realName].some((name) => name && `${prompt} ${explicitName ?? ''}`.includes(name)),
  );
  if (embedded) return { student: embedded, matchType: 'embedded_name' as const, hints: hintList };

  return { student: undefined, matchType: 'none' as const, hints: hintList };
}

function parseToolArguments(value: Record<string, unknown> | string | null | undefined) {
  if (!value) return {};
  if (typeof value === 'string') {
    const parsed = JSON.parse(value || '{}');
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('工具参数必须是 JSON object。');
    }
    return parsed as Record<string, unknown>;
  }
  if (typeof value === 'object' && !Array.isArray(value)) return value;
  throw new Error('工具参数必须是 object。');
}

function normalizeNumber(value: unknown) {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return undefined;
}

function validateArguments(tool: ToolDescriptor, rawArgs: Record<string, unknown>) {
  const schema = tool.parameters;
  const errors: string[] = [];
  const normalized: Record<string, unknown> = {};
  const allowedKeys = new Set(Object.keys(schema.properties));

  for (const key of Object.keys(rawArgs)) {
    if (!allowedKeys.has(key)) errors.push(`不允许的参数：${key}`);
  }

  for (const requiredKey of schema.required ?? []) {
    if (rawArgs[requiredKey] == null || rawArgs[requiredKey] === '') errors.push(`缺少必填参数：${requiredKey}`);
  }

  for (const [key, rule] of Object.entries(schema.properties)) {
    const raw = rawArgs[key];
    if (raw == null || raw === '') continue;
    if (rule.type === 'string') {
      if (typeof raw !== 'string') {
        errors.push(`${key} 必须是字符串。`);
        continue;
      }
      const value = raw.trim();
      if (rule.maxLength && value.length > rule.maxLength) errors.push(`${key} 超过最大长度 ${rule.maxLength}。`);
      if (rule.enum && !rule.enum.includes(value)) errors.push(`${key} 不在允许范围内。`);
      normalized[key] = value;
    } else if (rule.type === 'number') {
      const value = normalizeNumber(raw);
      if (value == null) {
        errors.push(`${key} 必须是数字。`);
        continue;
      }
      if (rule.minimum != null && value < rule.minimum) errors.push(`${key} 小于最小值 ${rule.minimum}。`);
      if (rule.maximum != null && value > rule.maximum) errors.push(`${key} 超过最大值 ${rule.maximum}。`);
      normalized[key] = Math.trunc(value);
    } else if (rule.type === 'boolean') {
      if (typeof raw !== 'boolean') {
        errors.push(`${key} 必须是布尔值。`);
        continue;
      }
      normalized[key] = raw;
    }
  }

  return { errors, normalized };
}

function capLimit(requested: unknown, routeLimit: number, fallback: number) {
  const numeric = normalizeNumber(requested);
  const max = Math.max(0, routeLimit);
  const base = numeric == null ? fallback : Math.trunc(numeric);
  if (max <= 0) return 0;
  return Math.max(1, Math.min(base, max));
}

function boundedPayload(payload: Record<string, unknown>, maxChars = DEFAULT_TOOL_OUTPUT_LIMIT) {
  const text = JSON.stringify(payload);
  if (text.length <= maxChars) return { payload, truncated: false };
  return {
    payload: {
      ...payload,
      truncated: true,
      truncatedReason: `tool output exceeded ${maxChars} chars`,
      preview: text.slice(0, maxChars),
    },
    truncated: true,
  };
}

function summarizeRecords(records: LearningRecord[]) {
  return records.map((record) => ({
    id: record.id,
    occurredAt: record.occurredAt,
    recordType: record.recordType,
    subject: record.subject,
    title: record.title,
    contentPreview: record.content.slice(0, 600),
    tags: record.tags.slice(0, 8),
    attachmentCount: record.attachments.length,
  }));
}

function summarizeStudent(student: Student) {
  return {
    id: student.id,
    displayName: student.displayName,
    grade: student.grade,
    subjects: student.subjects,
    goals: student.goals,
    currentIssues: student.currentIssues,
    parentConcerns: student.parentConcerns,
    tags: student.tags,
    recordCount: student.recordCount,
    attachmentBytes: student.attachmentBytes,
  };
}

function baseBlockedReview(toolName: string, router: AiRouterDecision, reason: string, errors: string[] = []): AiModelToolReview {
  return {
    ok: false,
    toolName,
    route: router.route,
    reason,
    errors,
    normalizedArguments: {},
  };
}

export function getModelToolDefinitions(router: AiRouterDecision): AiModelToolDefinition[] {
  return AI_TOOL_REGISTRY
    .filter((tool) => router.allowedTools.includes(tool.name) && tool.allowedRoutes.includes(router.route))
    .map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: `${tool.description} 权限：${tool.effect}/${tool.privacy}。`,
        parameters: tool.parameters,
      },
    }));
}

export function reviewModelToolCall(
  call: AiModelToolCall | { name: string; arguments?: Record<string, unknown> | string | null },
  router: AiRouterDecision,
): AiModelToolReview {
  const toolName = call.name;
  const tool = descriptorByName(toolName);
  if (!tool) return baseBlockedReview(toolName, router, '工具不存在。', ['unknown_tool']);
  if (!router.allowedTools.includes(tool.name)) {
    return baseBlockedReview(toolName, router, `当前 route ${router.route} 不允许调用该工具。`, ['route_allowlist_blocked']);
  }
  if (!tool.allowedRoutes.includes(router.route)) {
    return baseBlockedReview(toolName, router, `工具 ${tool.name} 不属于 route ${router.route} 的允许范围。`, ['tool_route_blocked']);
  }
  if (!router.contextPolicy.include.includes(tool.contextKey)) {
    return baseBlockedReview(toolName, router, '当前上下文策略未包含该工具所需 contextKey。', ['context_policy_blocked']);
  }
  if (tool.effect !== 'read') {
    return baseBlockedReview(toolName, router, 'Tool Calling v1 只允许只读工具；写入必须进入确认队列。', ['write_requires_confirmation']);
  }
  if (tool.privacy !== 'local_only' && tool.privacy !== 'sanitized_cloud') {
    return baseBlockedReview(toolName, router, '工具隐私级别未知。', ['invalid_privacy_level']);
  }

  try {
    const args = parseToolArguments(call.arguments ?? {});
    const checked = validateArguments(tool, args);
    if (checked.errors.length) {
      return baseBlockedReview(toolName, router, '工具参数未通过本地 schema 校验。', checked.errors);
    }
    return {
      ok: true,
      toolName,
      route: router.route,
      reason: '工具调用通过本地审核。',
      errors: [],
      normalizedArguments: checked.normalized,
    };
  } catch (error) {
    return baseBlockedReview(toolName, router, '工具参数不是合法 JSON object。', [error instanceof Error ? error.message : 'invalid_arguments']);
  }
}

export function createAiToolExecutionState(router: AiRouterDecision, seed?: Partial<CompiledAiContext>): CompiledAiContext {
  return {
    student: seed?.student,
    records: seed?.records ?? [],
    knowledgeSnippets: seed?.knowledgeSnippets ?? [],
    graphNodes: seed?.graphNodes ?? [],
    similarQuestions: seed?.similarQuestions ?? [],
    sources: seed?.sources ?? [],
    toolRuns: seed?.toolRuns ?? [],
    selectedContext: seed?.selectedContext ?? router.contextPolicy.include,
    resolvedStudentId: seed?.resolvedStudentId,
  };
}

export async function executeAiToolCall(params: {
  store: OmniEduStore;
  prompt: string;
  router: AiRouterDecision;
  state: CompiledAiContext;
  call: AiModelToolCall | { name: string; arguments?: Record<string, unknown> | string | null };
}): Promise<AiToolExecutionResult> {
  const { store, prompt, router, state, call } = params;
  const toolName = call.name;
  const tool = descriptorByName(toolName);
  const review = reviewModelToolCall(call, router);
  const safeTool = tool ?? {
    name: toolName,
    label: toolName,
    effect: 'read' as const,
    privacy: 'local_only' as const,
    maxOutputChars: DEFAULT_TOOL_OUTPUT_LIMIT,
  };
  const inputSummary = {
    args: review.normalizedArguments,
    route: router.route,
    review: review.ok ? 'allowed' : 'blocked',
  };

  if (!review.ok || !tool) {
    const toolRun = createToolRun(safeTool, 'blocked', review.reason, inputSummary, { errors: review.errors });
    state.toolRuns.push(toolRun);
    return {
      review,
      toolRun,
      modelResult: {
        ok: false,
        toolName,
        blocked: true,
        reason: review.reason,
        errors: review.errors,
      },
    };
  }

  try {
    const args = review.normalizedArguments;
    if (tool.name === 'resolve_student_reference') {
      const students = await store.listStudents('');
      const resolved = findStudentByPrompt(prompt, students, String(args.studentName ?? ''));
      if (resolved.student) {
        state.resolvedStudentId = resolved.student.id;
        const outputSummary = {
          displayName: resolved.student.displayName,
          matchType: resolved.matchType,
          hints: resolved.hints,
        };
        const toolRun = createToolRun(tool, 'used', `从任务文本中解析到学生：${resolved.student.displayName}。`, inputSummary, outputSummary);
        state.toolRuns.push(toolRun);
        addSource(state.sources, {
          id: 'student_lookup',
          title: '学生引用解析',
          type: 'SQLite students',
          detail: `小智已自动把任务绑定到 ${resolved.student.displayName}。`,
          count: '已解析',
        });
        return {
          review,
          toolRun,
          modelResult: boundedPayload({ ok: true, studentId: resolved.student.id, ...outputSummary }, tool.maxOutputChars).payload,
        };
      }
      const outputSummary = { hints: resolved.hints, candidatesChecked: students.length };
      const toolRun = createToolRun(
        tool,
        'blocked',
        resolved.hints.length ? `检测到学生引用 ${resolved.hints.join('、')}，但本地学生档案未命中。` : '未找到可解析学生。',
        inputSummary,
        outputSummary,
      );
      state.toolRuns.push(toolRun);
      return { review, toolRun, modelResult: boundedPayload({ ok: false, ...outputSummary }, tool.maxOutputChars).payload };
    }

    if (tool.name === 'get_student_profile') {
      const studentId = String(args.studentId ?? state.resolvedStudentId ?? '');
      if (!studentId) {
        const toolRun = createToolRun(tool, 'blocked', '没有可用学生 ID，无法读取学生档案。', inputSummary, { found: false });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'missing_student_id' } };
      }
      const student = (await store.listStudents('')).find((item) => item.id === studentId);
      state.student = student;
      const outputSummary = { studentId, found: Boolean(student), displayName: student?.displayName ?? '' };
      const toolRun = createToolRun(tool, student ? 'used' : 'blocked', student ? `已读取 ${student.displayName} 的学生档案。` : '学生不存在。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, {
        id: 'student_profile',
        title: student?.displayName ?? '学生不存在',
        type: '学生档案',
        detail: student ? '阶段目标、当前问题、家长关注点和标签已纳入。' : '未读取到学生档案。',
        count: student ? '已读取' : '未命中',
      });
      return {
        review,
        toolRun,
        modelResult: boundedPayload({ ok: Boolean(student), student: student ? summarizeStudent(student) : null }, tool.maxOutputChars).payload,
      };
    }

    if (tool.name === 'search_learning_records') {
      const studentId = String(args.studentId ?? state.resolvedStudentId ?? '');
      if (!studentId) {
        const toolRun = createToolRun(tool, 'blocked', '没有可用学生 ID，无法检索学习记录。', inputSummary, { count: 0 });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'missing_student_id' } };
      }
      const limit = capLimit(args.limit, router.contextPolicy.recordLimit, router.contextPolicy.recordLimit || 8);
      const records = limit
        ? await store.listRecords(studentId, { keyword: String(args.keyword ?? ''), limit })
        : [];
      state.records = records;
      const outputSummary = { count: records.length, limit, keyword: String(args.keyword ?? '') };
      const toolRun = createToolRun(tool, records.length ? 'used' : 'blocked', records.length ? `按 route 读取 ${records.length} 条学习记录。` : '当前学生没有可用学习记录。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, {
        id: 'learning_records',
        title: '学习记录',
        type: 'SQLite',
        detail: `按 ${router.route} 路由读取，最多 ${limit} 条。`,
        count: records.length,
      });
      return {
        review,
        toolRun,
        modelResult: boundedPayload({ ok: records.length > 0, records: summarizeRecords(records), ...outputSummary }, tool.maxOutputChars).payload,
      };
    }

    if (tool.name === 'list_attachment_metadata') {
      const attachmentCount = state.records.reduce((count, record) => count + record.attachments.length, 0);
      const attachmentTypes = new Map<string, number>();
      for (const record of state.records) {
        for (const attachment of record.attachments) {
          attachmentTypes.set(attachment.fileType, (attachmentTypes.get(attachment.fileType) ?? 0) + 1);
        }
      }
      const outputSummary = {
        count: attachmentCount,
        types: Object.fromEntries(attachmentTypes),
        rawFilesUploaded: false,
      };
      const toolRun = createToolRun(tool, 'used', `统计 ${attachmentCount} 个附件；原始文件不上云。`, inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, {
        id: 'attachment_metadata',
        title: '附件元数据',
        type: '本地文件系统',
        detail: '只纳入数量和元数据，不读取或上传原始附件。',
        count: attachmentCount,
      });
      return { review, toolRun, modelResult: boundedPayload({ ok: true, ...outputSummary }, tool.maxOutputChars).payload };
    }

    if (tool.name === 'search_teacher_knowledge') {
      const query = String(args.query ?? prompt);
      const limit = capLimit(args.limit, router.contextPolicy.knowledgeLimit, router.contextPolicy.knowledgeLimit || 6);
      const snippets = limit ? await store.searchKnowledge(query, limit) : [];
      state.knowledgeSnippets = snippets;
      const outputSummary = {
        count: snippets.length,
        limit,
        query,
        directEvidence: snippets.filter((chunk) => chunk.evidenceStrength === 'direct').length,
        indirectEvidence: snippets.filter((chunk) => chunk.evidenceStrength === 'indirect').length,
        backgroundOnly: snippets.filter((chunk) => chunk.evidenceStrength === 'background').length,
        personalDataHidden: snippets.filter((chunk) => chunk.containsPersonalData).length,
      };
      const toolRun = createToolRun(tool, snippets.length ? 'used' : 'blocked', snippets.length ? `命中 ${snippets.length} 个老师知识库片段。` : '没有命中可用老师知识库片段。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, {
        id: 'teacher_knowledge',
        title: '老师知识库',
        type: 'SQLite / 本地切片',
        detail: snippets.length ? '已纳入命中的老师知识库片段；含个人信息片段只返回元数据，不返回正文预览。' : '当前没有命中可用知识库文本片段。',
        count: snippets.length,
      });
      return {
        review,
        toolRun,
        modelResult: boundedPayload({
          ok: snippets.length > 0,
          snippets: snippets.map((chunk) => ({
            id: chunk.id,
            resourceId: chunk.resourceId,
            resourceTitle: chunk.resourceTitle,
            heading: chunk.heading,
            subject: chunk.subject,
            grade: chunk.grade,
            knowledgePoint: chunk.knowledgePoint,
            questionType: chunk.questionType,
            difficulty: chunk.difficulty,
            sourceTrust: chunk.sourceTrust,
            evidenceStrength: chunk.evidenceStrength,
            qualityScore: chunk.qualityScore,
            containsPersonalData: chunk.containsPersonalData,
            contentPreview: chunk.containsPersonalData ? '[含个人信息，正文预览已隐藏]' : chunk.contentMd.slice(0, 800),
          })),
          ...outputSummary,
        }, tool.maxOutputChars).payload,
      };
    }

    if (tool.name === 'query_knowledge_graph') {
      const overview = await store.getKnowledgeOverview();
      const limit = capLimit(args.limit, router.contextPolicy.graphNodeLimit, router.contextPolicy.graphNodeLimit || 8);
      const graphNodes = overview.nodes.slice(0, limit);
      state.graphNodes = graphNodes;
      const graphEdges = overview.edges
        .filter((edge) => graphNodes.some((node) => node.id === edge.sourceNodeId || node.id === edge.targetNodeId))
        .slice(0, Math.max(0, limit * 2));
      const outputSummary = {
        selectedNodes: graphNodes.length,
        selectedEdges: graphEdges.length,
        totalNodes: overview.counts.nodes,
        totalEdges: overview.counts.edges,
        graphEvidenceBoundary: 'graph_nodes_are_background_not_direct_text_evidence',
      };
      const toolRun = createToolRun(tool, graphNodes.length ? 'used' : 'blocked', graphNodes.length ? `读取 ${graphNodes.length} 个知识图谱节点摘要。` : '知识图谱暂无节点。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, {
        id: 'knowledge_graph',
        title: '知识图谱',
        type: 'SQLite nodes / edges',
        detail: graphNodes.length ? '已纳入知识图谱节点/边摘要；图谱只作为关系背景，不能冒充正文直接证据。' : '当前没有可用图谱节点。',
        count: `${overview.counts.nodes} 节点 / ${overview.counts.edges} 边`,
      });
      return {
        review,
        toolRun,
        modelResult: boundedPayload({
          ok: graphNodes.length > 0,
          nodes: graphNodes.map((node) => ({
            id: node.id,
            nodeType: node.nodeType,
            name: node.name,
            summary: node.summary,
            sourceKind: node.sourceKind,
            sourceId: node.sourceId,
            confidence: node.confidence,
            evidenceStrength: node.evidenceStrength,
          })),
          edges: graphEdges.map((edge) => ({
            id: edge.id,
            sourceNodeId: edge.sourceNodeId,
            targetNodeId: edge.targetNodeId,
            relationType: edge.relationType,
            evidenceSourceId: edge.evidenceSourceId,
            evidenceText: edge.evidenceText,
            confidence: edge.confidence,
            evidenceStrength: edge.evidenceStrength,
            evidenceKind: edge.evidenceKind,
          })),
          ...outputSummary,
        }, tool.maxOutputChars).payload,
      };
    }

    if (tool.name === 'search_similar_questions') {
      const limit = capLimit(args.limit, 12, 6);
      const subject = String(args.subject ?? router.slots.subject ?? '');
      const knowledgePoint = String(args.knowledgePoint ?? router.slots.knowledgePoint ?? '');
      const query = String(args.query ?? (knowledgePoint || prompt));
      const matches = await store.searchQuestionBank({
        query,
        subject,
        knowledgePoint,
        limit,
      });
      state.similarQuestions = matches;
      const outputSummary = {
        count: matches.length,
        query,
        subject,
        knowledgePoint,
        localBankHits: matches.filter((item) => item.sourceKind === 'local_bank').length,
      };
      const toolRun = createToolRun(
        tool,
        matches.length ? 'used' : 'blocked',
        matches.length ? `从本地题库召回 ${matches.length} 道相似题。` : '本地题库没有命中可用相似题。',
        inputSummary,
        outputSummary,
      );
      state.toolRuns.push(toolRun);
      addSource(state.sources, {
        id: 'question_bank',
        title: '本地题库',
        type: 'SQLite question_bank_items',
        detail: matches.length ? '已纳入本地题库相似题候选；生成题不得冒充题库命中。' : '当前题库没有命中相似题。',
        count: matches.length,
      });
      return {
        review,
        toolRun,
        modelResult: boundedPayload({
          ok: matches.length > 0,
          matches: matches.map((item) => ({
            id: item.id,
            subject: item.subject,
            grade: item.grade,
            knowledgePoint: item.knowledgePoint,
            questionType: item.questionType,
            difficulty: item.difficulty,
            stem: item.stem,
            answer: item.answer,
            analysis: item.analysis,
            sourceKind: item.sourceKind,
            sourceTitle: item.sourceTitle,
            matchReason: item.matchReason,
          })),
          ...outputSummary,
        }, tool.maxOutputChars).payload,
      };
    }

    const toolRun = createToolRun(tool, 'failed', '工具执行器未实现该工具。', inputSummary, { implemented: false });
    state.toolRuns.push(toolRun);
    return { review, toolRun, modelResult: { ok: false, reason: 'executor_not_implemented' } };
  } catch (error) {
    const message = error instanceof Error ? error.message : '工具执行失败。';
    const toolRun = createToolRun(safeTool, 'failed', message, inputSummary, { error: message });
    state.toolRuns.push(toolRun);
    return { review, toolRun, modelResult: { ok: false, reason: message } };
  }
}

export async function compileAiContext(params: {
  store: OmniEduStore;
  prompt: string;
  studentId?: string;
  router: AiRouterDecision;
}): Promise<CompiledAiContext> {
  const state = createAiToolExecutionState(params.router, { resolvedStudentId: params.studentId });
  for (const toolName of params.router.allowedTools) {
    const args: Record<string, unknown> = {};
    if (toolName === 'search_learning_records') args.limit = params.router.contextPolicy.recordLimit;
    if (toolName === 'search_teacher_knowledge') args.limit = params.router.contextPolicy.knowledgeLimit;
    if (toolName === 'query_knowledge_graph') args.limit = params.router.contextPolicy.graphNodeLimit;
    if (toolName === 'search_similar_questions') {
      args.limit = 6;
      args.subject = params.router.slots.subject;
      args.knowledgePoint = params.router.slots.knowledgePoint;
      args.query = params.router.slots.knowledgePoint || params.prompt;
    }
    await executeAiToolCall({
      store: params.store,
      prompt: params.prompt,
      router: params.router,
      state,
      call: { name: toolName, arguments: args },
    });
  }
  return state;
}
