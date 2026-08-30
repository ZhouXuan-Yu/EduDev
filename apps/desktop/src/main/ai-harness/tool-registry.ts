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
import { buildMasterySnapshot } from './mastery-snapshot';
import { buildMasteryPolicy } from './mastery-policy';
import { buildLearningAnalytics, buildLearningAnalyticsMarkdown, type LearningAnalytics } from './learning-analytics';
import { buildErrorTaxonomyAnalysis, buildErrorTaxonomyMarkdown } from './error-taxonomy';
import { buildVisionSolverDraft, buildVisionSolverMarkdown } from './vision-solver';
import { buildNotebookAnalysis } from './notebook-analysis';
import { buildQuestionNotebookAnalysis } from './question-notebook';
import { buildTeachingBookInspection } from './teaching-book';
import { renderTeachingBookMarkdown } from './teaching-book-renderer';
import { buildTeachingBookPlan } from './teaching-book-planner';
import { buildResearchOutline } from './research-outline';
import { buildMermaidVisualization } from './visualization';

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
  learningAnalytics?: LearningAnalytics;
};

export type AiToolExecutionResult = {
  review: AiModelToolReview;
  toolRun: AiConsoleToolRun;
  modelResult: Record<string, unknown>;
};

const DEFAULT_TOOL_OUTPUT_LIMIT = 4_000;
const ALL_AI_ROUTES: AiIntentRoute[] = [
  'general_qa',
  'student_diagnosis',
  'error_analysis',
  'practice_design',
  'lesson_design',
  'report_draft',
  'knowledge_retrieval',
  'workspace_help',
];

const TOOL_GROUPS: Record<string, string[]> = {
  student: ['resolve_student_reference', 'get_student_profile'],
  learning: ['search_learning_records', 'mastery_status', 'get_review_queue', 'analyze_learning_progress', 'classify_error_patterns', 'mastery_quiz', 'mastery_grade', 'mastery_assess', 'mastery_build'],
  knowledge: ['search_teacher_knowledge', 'query_knowledge_graph', 'generate_research_outline', 'render_learning_mermaid'],
  practice: ['search_similar_questions', 'search_question_notebook'],
  attachments: ['list_attachment_metadata', 'explore_attached_sources', 'analyze_geometry_figure'],
  notebook: ['analyze_notebook_context'],
  book: ['inspect_teaching_book', 'refresh_teaching_book_health', 'draft_teaching_book_patch', 'draft_teaching_book_selection_patch', 'draft_teaching_book_markdown', 'plan_teaching_book'],
  memory: ['inspect_memory_trace', 'inspect_memory_summary', 'draft_memory_summary', 'inspect_memory_synthesis', 'draft_memory_synthesis', 'inspect_memory_graph', 'inspect_memory_governance'],
};

export function progressiveToolNames(router: AiRouterDecision) {
  const names = ['load_tools'];
  if (router.allowedTools.includes('ask_user')) names.push('ask_user');
  if (router.allowedTools.includes('resolve_student_reference')) names.push('resolve_student_reference');
  return names;
}

export const AI_TOOL_REGISTRY: ToolDescriptor[] = [
  {
    name: 'ask_user',
    label: '询问老师',
    description: '当缺少会改变答案的关键信息时，向老师提出一个明确、可回答的问题；不会读取或写入学生数据。',
    contextKey: 'user_input',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ['general_qa', 'student_diagnosis', 'error_analysis', 'practice_design', 'lesson_design', 'report_draft', 'knowledge_retrieval', 'workspace_help'],
    maxOutputChars: 2_000,
    parameters: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description: '需要老师回答的单个问题。',
          maxLength: 2_000,
        },
      },
      required: ['question'],
      additionalProperties: false,
    },
  },
  {
    name: 'load_tools',
    label: '按需加载工具族',
    description: '按当前 route 的最小需要加载一组工具 schema；只返回宿主已许可的工具，不读取学生数据、不执行工具，也不改变权限。优先请求一个最小工具族。',
    contextKey: 'user_input',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ALL_AI_ROUTES,
    maxOutputChars: 6_000,
    parameters: {
      type: 'object',
      properties: {
        groups: {
          type: 'array',
          description: '工具族：student/learning/knowledge/practice/attachments/notebook/book/memory。最多 4 组。',
          items: { type: 'string' },
          maxItems: 4,
        },
        tools: {
          type: 'array',
          description: '可选的明确工具名；只会返回当前 route 已允许的工具。最多 12 个。',
          items: { type: 'string' },
          maxItems: 12,
        },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'inspect_memory_trace',
    label: '查看小智 L1 运行轨迹',
    description: '读取本地已完成或进行中的 Agent run/event 摘要，复用 DeepTutor L1 trace 语义；只返回阶段、状态、工具名和证据键，不返回 prompt 原文或隐藏推理。',
    contextKey: 'memory_trace',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ['general_qa', 'student_diagnosis', 'error_analysis', 'practice_design', 'lesson_design', 'report_draft', 'knowledge_retrieval', 'workspace_help'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        runId: { type: 'string', description: '可选 run ID；为空时读取最近一次本地 run。', maxLength: 160 },
        limit: { type: 'number', description: '最多返回事件数，1-50。', minimum: 1, maximum: 50 },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'inspect_memory_summary',
    label: '查看小智 L2 表面摘要',
    description: '只读查看指定 surface 的教师可见 L2 摘要条目、证据引用和版本状态；不读取原始 prompt、学生正文或隐藏推理。',
    contextKey: 'memory_summary',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ['general_qa', 'student_diagnosis', 'error_analysis', 'practice_design', 'lesson_design', 'report_draft', 'knowledge_retrieval', 'workspace_help'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        surface: { type: 'string', description: 'DeepTutor L2 surface：chat/notebook/quiz/kb/book/partner/cowriter', enum: ['chat', 'notebook', 'quiz', 'kb', 'book', 'partner', 'cowriter'] },
        includeDeleted: { type: 'boolean', description: '是否包含已禁用/删除条目；默认 false' },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'draft_memory_summary',
    label: '生成 L2 摘要草稿',
    description: '从本地 L1 run/event 证据生成 bounded L2 表面摘要草稿；只返回候选和 evidence refs，不写入正式记忆，必须由老师编辑或确认后保存。',
    contextKey: 'memory_summary',
    effect: 'draft',
    privacy: 'local_only',
    allowedRoutes: ['general_qa', 'student_diagnosis', 'error_analysis', 'practice_design', 'lesson_design', 'report_draft', 'knowledge_retrieval', 'workspace_help'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        surface: { type: 'string', description: 'L2 surface', enum: ['chat', 'notebook', 'quiz', 'kb', 'book', 'partner', 'cowriter'] },
        runId: { type: 'string', description: '可选的本地 run ID；不填则使用最近一次 run', maxLength: 160 },
        limit: { type: 'number', description: '最多生成 1-8 条草稿', minimum: 1, maximum: 8 },
      },
      required: ['surface'],
      additionalProperties: false,
    },
  },
  {
    name: 'inspect_memory_synthesis',
    label: '鏌ョ湅 L3 綜合记忆',
    description: '只读查看按 recent/profile/scope/preferences 槽位组织的跨 surface L3 综合记忆；不读取学生正文，不暴露隐藏推理。',
    contextKey: 'memory_synthesis',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ['general_qa', 'student_diagnosis', 'error_analysis', 'practice_design', 'lesson_design', 'report_draft', 'knowledge_retrieval', 'workspace_help'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: { slot: { type: 'string', enum: ['recent', 'profile', 'scope', 'preferences'] } },
      required: ['slot'],
      additionalProperties: false,
    },
  },
  {
    name: 'draft_memory_synthesis',
    label: '生成 L3 综合候选',
    description: '从已确认的 L2 条目生成 bounded L3 跨 surface 候选；只读、需教师审核，不直接写入正式记忆。',
    contextKey: 'memory_synthesis',
    effect: 'draft',
    privacy: 'local_only',
    allowedRoutes: ['general_qa', 'student_diagnosis', 'error_analysis', 'practice_design', 'lesson_design', 'report_draft', 'knowledge_retrieval', 'workspace_help'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: { slot: { type: 'string', enum: ['recent', 'profile', 'scope', 'preferences'] }, limit: { type: 'number', minimum: 1, maximum: 8 } },
      required: ['slot'],
      additionalProperties: false,
    },
  },
  {
    name: 'inspect_memory_graph',
    label: '鏌ョ湅璁板繂璇佹嵁鍥捐氨',
    description: '读取 L2/L3 条目到 run/event evidence 的 bounded 图投影；只返回节点标签、边类型和状态，不返回正文、prompt 或隐藏推理。',
    contextKey: 'memory_synthesis',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ['general_qa', 'student_diagnosis', 'error_analysis', 'practice_design', 'lesson_design', 'report_draft', 'knowledge_retrieval', 'workspace_help'],
    maxOutputChars: 4_000,
    parameters: { type: 'object', properties: { limit: { type: 'number', minimum: 1, maximum: 200 } }, required: [], additionalProperties: false },
  },
  {
    name: 'inspect_memory_governance',
    label: '鏌ョ湅璁板繂治理状态',
    description: '读取 L2/L3 记忆治理计数、悬空 evidence refs、删除/停用状态和图规模；只读，不允许 AI 写入。',
    contextKey: 'memory_synthesis',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ['general_qa', 'student_diagnosis', 'error_analysis', 'practice_design', 'lesson_design', 'report_draft', 'knowledge_retrieval', 'workspace_help'],
    maxOutputChars: 4_000,
    parameters: { type: 'object', properties: {}, required: [], additionalProperties: false },
  },
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
    name: 'analyze_learning_progress',
    label: '分析学情统计',
    description: '基于当前已绑定学生的本地学习记录，按时间范围和学科计算可重算的学情统计；只返回汇总、事实、未知项和来源 ID，不写入学生档案。',
    contextKey: 'learning_records',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ['student_diagnosis', 'report_draft'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        studentId: { type: 'string', description: '可选学生 ID；必须与本轮已绑定学生一致。', maxLength: 120 },
        startDate: { type: 'string', description: '包含起始日，格式 YYYY-MM-DD。', maxLength: 10 },
        endDate: { type: 'string', description: '包含结束日，格式 YYYY-MM-DD。', maxLength: 10 },
        subject: { type: 'string', description: '可选学科；“全部”表示不筛选。', maxLength: 80 },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'classify_error_patterns',
    label: '鍒嗙被錯因模式',
    description: '基于已绑定学生的本地错题/订正记录，按 DeepTutor 四类 taxonomy 生成可重算的错因分类；未知或低置信结果必须交由老师复核，不写入学生档案。',
    contextKey: 'learning_records',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ['error_analysis'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        studentId: { type: 'string', description: '可选学生 ID；必须与本轮绑定学生一致。', maxLength: 120 },
        startDate: { type: 'string', description: '包含起始日期，格式 YYYY-MM-DD。', maxLength: 10 },
        endDate: { type: 'string', description: '包含结束日期，格式 YYYY-MM-DD。', maxLength: 10 },
        subject: { type: 'string', description: '可选学科；“全部”表示不筛选。', maxLength: 80 },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'mastery_status',
    label: '读取掌握度状态',
    description: '读取当前学生基于显式学习记录计算出的知识点掌握度摘要；不会修改学习数据，也不会暴露原始记录。',
    contextKey: 'learning_records',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ['student_diagnosis', 'practice_design'],
    maxOutputChars: 4_000,
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
    name: 'get_review_queue',
    label: '读取间隔复习队列',
    description: '按 DeepTutor 确定性间隔复习策略读取当前学生到期知识点；只返回知识点摘要、优先级和 due 时间，不修改学习记录。',
    contextKey: 'learning_records',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ['student_diagnosis', 'practice_design'],
    maxOutputChars: 3_500,
    parameters: {
      type: 'object',
      properties: {
        studentId: { type: 'string', description: '学生 ID；为空时使用本轮已解析或当前选中的学生。', maxLength: 120 },
        limit: { type: 'number', description: '最多返回 1-20 个复习任务。', minimum: 1, maximum: 20 },
        timezone: { type: 'string', description: '仅用于展示元数据，不改变 epoch due 判断。', maxLength: 80 },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'mastery_quiz',
    label: '生成掌握度小测',
    description: '为当前学生的薄弱知识点创建一道本地可评分小测；正确答案只保存在主进程，不返回给模型或界面。',
    contextKey: 'learning_records',
    effect: 'draft',
    privacy: 'local_only',
    allowedRoutes: ['student_diagnosis', 'practice_design'],
    maxOutputChars: 2_500,
    parameters: {
      type: 'object',
      properties: {
        studentId: { type: 'string', description: '学生 ID。', maxLength: 120 },
        knowledgePointId: { type: 'string', description: '可选知识点 ID；为空时自动选择最需要练习的点。', maxLength: 120 },
        questionCount: { type: 'number', description: '可选连续题数，1-5；每次只展示当前题，评分后可继续读取下一题。', minimum: 1, maximum: 5 },
      },
      required: ['studentId'],
      additionalProperties: false,
    },
  },
  {
    name: 'mastery_grade',
    label: '评分并写回掌握度',
    description: '使用主进程保存的私有答案对小测评分，并写入一条显式 mastery_attempt 学习记录。',
    contextKey: 'learning_records',
    effect: 'write',
    privacy: 'local_only',
    allowedRoutes: ['student_diagnosis', 'practice_design'],
    maxOutputChars: 2_000,
    parameters: {
      type: 'object',
      properties: {
        questionId: { type: 'string', description: '可选题目 ID；省略时使用当前绑定学生最近一条已回答题目。', maxLength: 160 },
        answer: { type: 'string', description: '老师或学生提交的选项答案。', maxLength: 2_000 },
      },
      required: ['answer'],
      additionalProperties: false,
    },
  },
  {
    name: 'mastery_assess',
    label: '记录概念掌握判断',
    description: '记录概念或设计类知识点的教师/导师判断；只有明确 passed 结果才会写入显式 mastery_attempt。',
    contextKey: 'learning_records',
    effect: 'write',
    privacy: 'local_only',
    allowedRoutes: ['student_diagnosis', 'practice_design'],
    maxOutputChars: 2_000,
    parameters: {
      type: 'object',
      properties: {
        studentId: { type: 'string', description: '学生 ID。', maxLength: 120 },
        knowledgePointId: { type: 'string', description: '知识点 ID。', maxLength: 120 },
        passed: { type: 'boolean', description: '解释是否足以证明掌握。' },
        feedback: { type: 'string', description: '简短证据说明。', maxLength: 600 },
      },
      required: ['studentId', 'knowledgePointId', 'passed'],
      additionalProperties: false,
    },
  },
  {
    name: 'mastery_build',
    label: '构建学习路径',
    description: '根据教师确认的学习目标创建或追加有序知识点路径；宿主会生成稳定 ID 并限制数量、长度和知识点类型。',
    contextKey: 'learning_records',
    effect: 'write',
    privacy: 'local_only',
    allowedRoutes: ['student_diagnosis', 'practice_design'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        studentId: { type: 'string', description: '学生 ID。', maxLength: 120 },
        mode: { type: 'string', description: 'replace 或 append。', enum: ['replace', 'append'] },
        modules: {
          type: 'array',
          description: '模块数组，每个模块包含 name 和 knowledgePoints。',
          maxItems: 12,
          items: { type: 'object' },
        },
      },
      required: ['studentId', 'modules'],
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
    name: 'explore_attached_sources',
    label: '按需探索附件来源',
    description: '复用 DeepTutor read_source/attached-source manifest 的按需探索原则：只读取当前绑定学生已授权附件对应的脱敏 OCR 片段，按查询词选择少量来源，不读取原始路径或全部文件。',
    contextKey: 'attached_sources',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ['student_diagnosis', 'error_analysis', 'report_draft', 'knowledge_retrieval'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        studentId: { type: 'string', description: '可选学生 ID；必须与当前绑定学生一致。', maxLength: 120 },
        query: { type: 'string', description: '要在脱敏附件片段中探索的关键词或问题；为空时只返回有限来源预览。', maxLength: 800 },
        attachmentIds: { type: 'array', description: '可选附件 ID 白名单；只允许当前记录已经挂载的附件。', maxItems: 8, items: { type: 'string' } },
        limit: { type: 'number', description: '最多返回 1-5 个来源片段。', minimum: 1, maximum: 5 },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'analyze_geometry_figure',
    label: '生成几何图形草稿',
    description: '复用 DeepTutor Vision Solver 的单次分析/一次修复边界，为本地错题图片生成经白名单校验的 GeoGebra 草稿；默认不上传原图、不写回数据，必须由老师预览确认。',
    contextKey: 'attachment_metadata',
    effect: 'draft',
    privacy: 'local_only',
    allowedRoutes: ['error_analysis'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        analysisId: { type: 'string', description: '可选本地错题图片分析 ID；为空时使用当前学生最近一条图片分析。', maxLength: 160 },
        questionText: { type: 'string', description: '脱敏题干或题干摘要；不要传入原图路径或学生隐私。', maxLength: 1_200 },
        commands: { type: 'array', description: '视觉模型草拟的 GeoGebra 命令数组；宿主只保留白名单命令。', maxItems: 24, items: { type: 'object' } },
        constraints: { type: 'array', description: '可选几何约束摘要。', maxItems: 12, items: { type: 'string' } },
        geometricRelations: { type: 'array', description: '可选几何关系摘要。', maxItems: 12, items: { type: 'string' } },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'analyze_notebook_context',
    label: '按需分析教师备课本',
    description: '复用 DeepTutor Notebook Analysis/Summarize 的目录选择、有限细节读取和摘要草稿边界；仅在明确请求笔记或备课本时读取，不常驻注入普通问答。',
    contextKey: 'teacher_notebook',
    effect: 'draft',
    privacy: 'local_only',
    allowedRoutes: ['general_qa', 'knowledge_retrieval', 'lesson_design', 'report_draft', 'student_diagnosis'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '笔记目录或内容查询；不会作为学生查询。', maxLength: 1_000 },
        notebookId: { type: 'string', description: '可选备课本 ID；指定后只允许读取该备课本。', maxLength: 160 },
        mode: { type: 'string', description: 'context 返回目录与有限细节；record_summary 返回单条摘要草稿。', enum: ['context', 'record_summary'] },
        recordId: { type: 'string', description: 'record_summary 模式下的本地记录 ID。', maxLength: 160 },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'search_question_notebook',
    label: '检索题目收藏与分类',
    description: '复用 DeepTutor Question Notebook 的书签、分类和历史引用语义，但只读取 Omni-Edu 现有题库上的轻量索引，不复制题目正文。',
    contextKey: 'question_notebook',
    effect: 'read',
    privacy: 'sanitized_cloud',
    allowedRoutes: ['practice_design', 'knowledge_retrieval', 'report_draft'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '题目收藏/分类检索关键词。', maxLength: 240 },
        categoryId: { type: 'string', description: '可选题目分类 ID。', maxLength: 160 },
        bookmarked: { type: 'boolean', description: '是否只返回已收藏题目。' },
        sourceKind: { type: 'string', description: '题目来源类型。', enum: ['local_bank', 'teacher_resource', 'generated'] },
        limit: { type: 'number', description: '最多返回题目数，1-20。', minimum: 1, maximum: 20 },
        offset: { type: 'number', description: '分页偏移量。', minimum: 0, maximum: 10000 },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'inspect_teaching_book',
    label: '检查专题讲义工作区',
    description: '读取 DeepTutor Book Workspace 适配后的专题讲义/单元备课包目录、页面、内容块和来源健康；仅返回 bounded 元数据与引用，不直接写入或盲目重生成。',
    contextKey: 'teaching_book',
    effect: 'read',
    privacy: 'local_only',
    allowedRoutes: ['lesson_design', 'knowledge_retrieval', 'report_draft'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        bookId: { type: 'string', description: '可选讲义 ID；未指定时按查询匹配最近讲义。', maxLength: 160 },
        query: { type: 'string', description: '可选页面/讲义查询关键词。', maxLength: 240 },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'draft_teaching_book_markdown',
    label: '生成讲义 Markdown 预览',
    description: '将已存在的专题讲义 block 编排编译为 bounded Markdown 草稿；支持 text/chapter/quiz/card/figure/concept graph/prompt，未知类型安全降级，不写入文件。',
    contextKey: 'teaching_book',
    effect: 'draft',
    privacy: 'local_only',
    allowedRoutes: ['lesson_design', 'report_draft'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        bookId: { type: 'string', description: '讲义 ID；必须显式指定，避免跨讲义读取。', maxLength: 160 },
      },
      required: ['bookId'],
      additionalProperties: false,
    },
  },
  {
    name: 'refresh_teaching_book_health',
    label: '刷新讲义来源健康',
    description: '重新计算托管知识资源、备课本和题库来源的 fingerprint 健康状态，并把漂移精确写入本地失效队列；不修改讲义正文、不自动重生成。',
    contextKey: 'teaching_book',
    effect: 'draft',
    privacy: 'local_only',
    allowedRoutes: ['lesson_design', 'knowledge_retrieval', 'report_draft'],
    maxOutputChars: 3_000,
    parameters: {
      type: 'object',
      properties: {
        bookId: { type: 'string', description: '讲义 ID；必须显式指定。', maxLength: 160 },
      },
      required: ['bookId'],
      additionalProperties: false,
    },
  },
  {
    name: 'draft_teaching_book_patch',
    label: '生成讲义内容块 patch',
    description: '为指定讲义内容块生成可审阅的替换 patch；保留 before/after、基础版本和理由，不直接覆盖老师正文，应用与撤销必须走显式确认和版本校验。',
    contextKey: 'teaching_book',
    effect: 'draft',
    privacy: 'local_only',
    allowedRoutes: ['lesson_design', 'report_draft'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        bookId: { type: 'string', description: '讲义 ID；必须显式指定。', maxLength: 160 },
        blockId: { type: 'string', description: '内容块 ID；必须显式指定。', maxLength: 160 },
        baseVersion: { type: 'number', description: '内容块当前版本。', minimum: 1, maximum: 100000 },
        title: { type: 'string', description: '可选新标题。', maxLength: 200 },
        payload: { type: 'object', description: '可选的新 payload，最大 12000 字符。' },
        reason: { type: 'string', description: '改写理由。', maxLength: 600 },
      },
      required: ['bookId', 'blockId', 'baseVersion'],
      additionalProperties: false,
    },
  },
  {
    name: 'draft_teaching_book_selection_patch',
    label: '生成讲义选区编辑 patch',
    description: '复用 DeepTutor CoWriter 的 react-edit/automark 语义，对指定内容块的明确选区生成 bounded before/after patch 和流式草稿事件；不自动覆盖正文，应用前必须确认且校验版本与选区指纹。',
    contextKey: 'teaching_book',
    effect: 'draft',
    privacy: 'local_only',
    allowedRoutes: ['lesson_design', 'report_draft'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        bookId: { type: 'string', description: '必须显式指定讲义 ID。', maxLength: 160 },
        blockId: { type: 'string', description: '必须显式指定内容块 ID。', maxLength: 160 },
        baseVersion: { type: 'number', description: '内容块当前版本。', minimum: 1, maximum: 100000 },
        selectionStart: { type: 'number', description: '选区起始字符位置。', minimum: 0, maximum: 20000 },
        selectionEnd: { type: 'number', description: '选区结束字符位置（不含）。', minimum: 1, maximum: 20000 },
        selectedText: { type: 'string', description: '客户端选中的原文，用于选区漂移校验。', maxLength: 20000 },
        replacementText: { type: 'string', description: '模型生成的候选替换文本；必须先作为草稿审阅。', maxLength: 20000 },
        mode: { type: 'string', enum: ['react_edit', 'automark'], description: '局部改写或批注标记模式。' },
        reason: { type: 'string', description: '改写理由。', maxLength: 600 },
      },
      required: ['bookId', 'blockId', 'baseVersion', 'selectionStart', 'selectionEnd', 'selectedText', 'replacementText'],
      additionalProperties: false,
    },
  },
  {
    name: 'plan_teaching_book',
    label: '规划讲义章节骨架',
    description: '复用 DeepTutor SourceExplorer/Spine/PagePlanner 的来源探索与章节规划语义，基于本地知识片段的 bounded 主题生成可审阅的章节/page/block 候选；不写入讲义。',
    contextKey: 'teaching_book',
    effect: 'draft',
    privacy: 'local_only',
    allowedRoutes: ['lesson_design', 'knowledge_retrieval'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        bookId: { type: 'string', description: '必须显式指定讲义 ID。', maxLength: 160 },
        query: { type: 'string', description: '可选章节规划/来源探索主题。', maxLength: 240 },
        limit: { type: 'number', description: '知识片段上限，1-8。', minimum: 1, maximum: 8 },
      },
      required: ['bookId'],
      additionalProperties: false,
    },
  },
  {
    name: 'generate_research_outline',
    label: '生成研究提纲',
    description: '基于本地教师知识切片生成带来源、证据强度和未知项的研究提纲草案；不联网、不读取学生数据、不写文件。',
    contextKey: 'teacher_knowledge',
    effect: 'draft',
    privacy: 'local_only',
    allowedRoutes: ['knowledge_retrieval', 'lesson_design', 'report_draft'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        query: { type: 'string', description: '研究主题或教研问题', maxLength: 240 },
        limit: { type: 'number', description: '最多使用的本地知识切片数', minimum: 1, maximum: 8 },
      },
      required: [],
      additionalProperties: false,
    },
  },
  {
    name: 'render_learning_mermaid',
    label: '生成学习关系图',
    description: '基于本地知识图谱摘要生成受限 Mermaid 关系图；清理脚本、外链和危险字符，不写文件。',
    contextKey: 'knowledge_graph',
    effect: 'draft',
    privacy: 'local_only',
    allowedRoutes: ['knowledge_retrieval', 'lesson_design', 'report_draft'],
    maxOutputChars: 4_000,
    parameters: {
      type: 'object',
      properties: {
        title: { type: 'string', description: '图标题', maxLength: 120 },
        limit: { type: 'number', description: '最多展示的节点数', minimum: 1, maximum: 20 },
      },
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
    } else if (rule.type === 'array') {
      if (!Array.isArray(raw)) {
        errors.push(`${key} 必须是数组。`);
        continue;
      }
      if (rule.maxItems && raw.length > rule.maxItems) errors.push(`${key} 超过最大数量 ${rule.maxItems}。`);
      normalized[key] = raw.slice(0, rule.maxItems ?? 32);
    } else if (rule.type === 'object') {
      if (typeof raw !== 'object' || raw == null || Array.isArray(raw)) {
        errors.push(key + ' 必须是 object。');
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
  const compact: Record<string, unknown> = {
    truncated: true,
    truncatedReason: `tool output exceeded ${maxChars} chars`,
    preview: text.slice(0, maxChars),
  };
  // Keep only non-content status fields that help the AgentLoop decide whether
  // to continue. Never spread the original payload: that would make a result
  // marked "truncated" carry the full record/attachment text anyway.
  for (const key of ['ok', 'count', 'studentId', 'toolName', 'reason', 'rawRecordsIncluded']) {
    if (key in payload && (typeof payload[key] === 'string' || typeof payload[key] === 'number' || typeof payload[key] === 'boolean')) {
      compact[key] = payload[key];
    }
  }
  // Progressive disclosure relies on this control-plane field to activate the
  // schemas in the next AgentLoop round. Preserve it even when descriptions or
  // parameter schemas make the catalog exceed the output budget.
  if (Array.isArray(payload.loadedToolNames)) {
    compact.loadedToolNames = payload.loadedToolNames.slice(0, 32).map((name) => String(name));
  }
  return {
    payload: compact,
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

export function getModelToolDefinitions(router: AiRouterDecision, options: { toolNames?: string[]; includeLoader?: boolean } = {}): AiModelToolDefinition[] {
  const requested = options.toolNames ? new Set(options.toolNames) : undefined;
  return AI_TOOL_REGISTRY
    .filter((tool) => {
      const routeAllowed = tool.allowedRoutes.includes(router.route);
      const routeToolAllowed = router.allowedTools.includes(tool.name) || (options.includeLoader === true && tool.name === 'load_tools');
      const requestedAllowed = !requested || requested.has(tool.name);
      return routeAllowed && routeToolAllowed && requestedAllowed;
    })
    .map((tool) => ({
      type: 'function',
      function: {
        name: tool.name,
        description: `${tool.description} 权限：${tool.effect}/${tool.privacy}。`,
        parameters: tool.parameters,
      },
    }));
}

export function getProgressiveModelToolDefinitions(router: AiRouterDecision): AiModelToolDefinition[] {
  return getModelToolDefinitions(router, { toolNames: progressiveToolNames(router), includeLoader: true });
}

function resolveLoadToolNames(router: AiRouterDecision, args: Record<string, unknown>) {
  const groups = Array.isArray(args.groups) ? args.groups.map((item) => String(item)).slice(0, 4) : [];
  const explicit = Array.isArray(args.tools) ? args.tools.map((item) => String(item)).slice(0, 12) : [];
  const candidates = [...explicit, ...groups.flatMap((group) => TOOL_GROUPS[group] ?? [])];
  return [...new Set(candidates)]
    .filter((name) => name !== 'load_tools')
    .filter((name) => router.allowedTools.includes(name))
    .filter((name) => descriptorByName(name)?.allowedRoutes.includes(router.route));
}

export function reviewModelToolCall(
  call: AiModelToolCall | { name: string; arguments?: Record<string, unknown> | string | null },
  router: AiRouterDecision,
  options: { allowManagedWrite?: boolean } = {},
): AiModelToolReview {
  const toolName = call.name;
  const tool = descriptorByName(toolName);
  if (!tool) return baseBlockedReview(toolName, router, '工具不存在。', ['unknown_tool']);
  if (tool.name !== 'load_tools' && !router.allowedTools.includes(tool.name)) {
    return baseBlockedReview(toolName, router, `当前 route ${router.route} 不允许调用该工具。`, ['route_allowlist_blocked']);
  }
  if (!tool.allowedRoutes.includes(router.route)) {
    return baseBlockedReview(toolName, router, `工具 ${tool.name} 不属于 route ${router.route} 的允许范围。`, ['tool_route_blocked']);
  }
  if (tool.name !== 'ask_user' && tool.name !== 'load_tools' && !router.contextPolicy.include.includes(tool.contextKey)) {
    return baseBlockedReview(toolName, router, '当前上下文策略未包含该工具所需 contextKey。', ['context_policy_blocked']);
  }
  const managedWrite = options.allowManagedWrite === true && ['mastery_quiz', 'mastery_grade', 'mastery_assess', 'mastery_build'].includes(tool.name);
  if (tool.effect !== 'read' && tool.effect !== 'draft' && !managedWrite) {
    return baseBlockedReview(toolName, router, 'Tool Calling v1 只允许只读或本地草稿工具；写入必须进入确认队列。', ['write_requires_confirmation']);
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
    learningAnalytics: seed?.learningAnalytics,
  };
}

export async function executeAiToolCall(params: {
  store: OmniEduStore;
  prompt: string;
  router: AiRouterDecision;
  state: CompiledAiContext;
  call: AiModelToolCall | { name: string; arguments?: Record<string, unknown> | string | null };
  allowManagedWrite?: boolean;
  executionContext?: { runId?: string; turnId?: string };
}): Promise<AiToolExecutionResult> {
  const { store, prompt, router, state, call } = params;
  const toolName = call.name;
  const tool = descriptorByName(toolName);
  const review = reviewModelToolCall(call, router, { allowManagedWrite: params.allowManagedWrite });
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

  const getMasteryKnowledgePoints = async (studentId: string) => {
    const snapshot = await buildMasterySnapshot(store, studentId);
    const path = await store.getAiMasteryPath(studentId);
    const pathPoints = path?.modules.flatMap((module) => module.knowledgePoints.map((point) => ({
      id: point.id,
      name: point.name,
      type: point.type,
      module_id: module.id,
      moduleName: module.name,
    }))) ?? [];
    return { snapshot, points: pathPoints.length ? pathPoints : snapshot.modules.flatMap((module) => module.knowledge_points.map((point) => ({ ...point, moduleName: module.name }))) };
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
    if (tool.name === 'load_tools') {
      const loadedNames = resolveLoadToolNames(router, args);
      const definitions = getModelToolDefinitions(router, { toolNames: loadedNames });
      const outputSummary = {
        schemaVersion: 'omni.tool.catalog.v1',
        requestedGroups: Array.isArray(args.groups) ? args.groups.map((item) => String(item)).slice(0, 4) : [],
        requestedTools: Array.isArray(args.tools) ? args.tools.map((item) => String(item)).slice(0, 12) : [],
        loadedToolNames: definitions.map((definition) => definition.function.name),
        loadedCount: definitions.length,
        permissionSource: 'router_allowlist_and_tool_route',
        toolsExecuted: false,
        rawRecordsIncluded: false,
      };
      const status: AiConsoleToolRun['status'] = definitions.length ? 'used' : 'blocked';
      const toolRun = createToolRun(
        tool,
        status,
        definitions.length ? `已按需加载 ${definitions.length} 个工具 schema；尚未执行任何工具。` : '请求的工具族在当前 route 下没有可加载工具。',
        inputSummary,
        outputSummary,
      );
      state.toolRuns.push(toolRun);
      return {
        review,
        toolRun,
        modelResult: boundedPayload({
          ok: definitions.length > 0,
          toolDefinitions: definitions,
          ...outputSummary,
        }, tool.maxOutputChars).payload,
      };
    }
    if (tool.name === 'inspect_memory_trace') {
      const requestedRunId = String(args.runId ?? '').trim();
      const limit = Math.min(50, Math.max(1, Number(args.limit ?? 50) || 50));
      const recentRuns = requestedRunId ? [] : await store.listAiAgentRuns(1);
      const runId = requestedRunId || recentRuns[0]?.id || '';
      if (!runId) {
        const toolRun = createToolRun(tool, 'used', '本地还没有可检查的 Agent run；没有生成记忆结论。', inputSummary, { layer: 'L1', status: 'missing', eventCount: 0, bounded: true, rawPromptIncluded: false, hiddenReasoningIncluded: false });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: true, layer: 'L1', status: 'missing', events: [], bounded: true, rawPromptIncluded: false, hiddenReasoningIncluded: false } };
      }
      const trace = await store.getAiMemoryTrace(runId, limit);
      const found = trace.status !== 'missing';
      const outputSummary = { runId, layer: trace.layer, status: trace.status, eventCount: trace.eventCount, bounded: trace.bounded, rawPromptIncluded: trace.rawPromptIncluded, hiddenReasoningIncluded: trace.hiddenReasoningIncluded };
      const toolRun = createToolRun(tool, found ? 'used' : 'blocked', found ? `已读取 ${trace.eventCount} 条 L1 阶段/工具摘要；未返回 prompt 原文或隐藏推理。` : '指定 run 不存在。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, { id: runId, title: '小智 L1 运行轨迹', type: 'SQLite ai_agent_runs/ai_agent_events', detail: '只读 bounded 阶段、状态、工具名和证据键；不含 prompt 原文或隐藏推理。', count: trace.eventCount });
      return { review, toolRun, modelResult: boundedPayload({ ok: found, trace, ...outputSummary }, tool.maxOutputChars).payload };
    }

    if (tool.name === 'inspect_memory_summary') {
      const surface = String(args.surface ?? 'chat') as Parameters<OmniEduStore['getAiMemoryDocument']>[0];
      const detail = await store.getAiMemoryDocument(surface);
      const includeDeleted = args.includeDeleted === true;
      const entries = detail?.entries.filter((entry) => includeDeleted || entry.status === 'active') ?? [];
      const outputSummary = {
        layer: 'L2',
        surface,
        exists: Boolean(detail),
        entryCount: entries.length,
        activeEntryCount: entries.filter((entry) => entry.status === 'active').length,
        refsValidated: true,
        rawPromptIncluded: false,
        hiddenReasoningIncluded: false,
      };
      const toolRun = createToolRun(tool, 'used', detail ? '已读取本地 L2 摘要条目与 evidence refs；未读取原始 prompt。' : '当前 surface 尚无 L2 摘要文档。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, { id: `memory_l2:${surface}`, title: `小智 L2 ${surface} 摘要`, type: 'SQLite ai_memory_documents/ai_memory_entries', detail: '教师可见、可编辑、带 evidence refs 的本地摘要；不包含原始 prompt 或隐藏推理。', count: entries.length });
      return {
        review,
        toolRun,
        modelResult: boundedPayload({
          ok: Boolean(detail),
          document: detail?.document ?? null,
          entries: entries.map((entry) => ({
            id: entry.id,
            section: entry.section,
            text: entry.text,
            refs: entry.refs,
            status: entry.status,
            origin: entry.origin,
            version: entry.version,
            updatedAt: entry.updatedAt,
          })),
          ...outputSummary,
        }, tool.maxOutputChars).payload,
      };
    }

    if (tool.name === 'draft_memory_summary') {
      const surface = String(args.surface ?? 'chat') as Parameters<OmniEduStore['draftAiMemorySummary']>[0];
      const runId = args.runId == null ? undefined : String(args.runId);
      const limit = Math.min(8, Math.max(1, Number(args.limit ?? 8) || 8));
      const draft = await store.draftAiMemorySummary(surface, runId, limit);
      const outputSummary = {
        layer: 'L2',
        surface,
        sourceRunId: draft.sourceRunId,
        candidateCount: draft.entries.length,
        requiresTeacherReview: true,
        writesMemory: false,
        rawPromptIncluded: false,
        hiddenReasoningIncluded: false,
      };
      const toolRun = createToolRun(tool, draft.entries.length ? 'used' : 'blocked', draft.entries.length ? '已从本地 L1 证据生成 L2 草稿；尚未写入正式记忆。' : '没有可用 L1 run/event 证据，无法生成 L2 草稿。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, { id: draft.sourceRunId ? `ai_agent_run:${draft.sourceRunId}` : 'memory_l1:missing', title: 'L2 摘要草稿证据', type: 'SQLite ai_agent_events', detail: '草稿只保留阶段/状态/工具名和 evidence refs，保存前需要教师编辑或确认。', count: draft.entries.length });
      return { review, toolRun, modelResult: boundedPayload({ ok: draft.entries.length > 0, draft, ...outputSummary }, tool.maxOutputChars).payload };
    }

    if (tool.name === 'inspect_memory_synthesis') {
      const slot = String(args.slot ?? 'recent') as Parameters<OmniEduStore['getAiMemoryL3Document']>[0];
      const detail = await store.getAiMemoryL3Document(slot);
      const outputSummary = { layer: 'L3', slot, exists: Boolean(detail), entryCount: detail?.entries.length ?? 0, rawPromptIncluded: false, hiddenReasoningIncluded: false };
      const toolRun = createToolRun(tool, detail ? 'used' : 'blocked', detail ? '已读取 bounded L3 综合记忆。' : '当前槽位尚无 L3 文档。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, { id: `memory_l3:${slot}`, title: `小智 L3 ${slot} 综合记忆`, type: 'SQLite ai_memory_l3_documents/ai_memory_l3_entries', detail: '只读跨 surface 综合，不含 prompt、学生正文或隐藏推理。', count: detail?.entries.length ?? 0 });
      return { review, toolRun, modelResult: boundedPayload({ ok: Boolean(detail), detail: detail ? { document: detail.document, entries: detail.entries.filter((entry) => entry.status === 'active') } : null, ...outputSummary }, tool.maxOutputChars).payload };
    }

    if (tool.name === 'draft_memory_synthesis') {
      const slot = String(args.slot ?? 'recent') as Parameters<OmniEduStore['draftAiMemoryL3']>[0];
      const limit = Math.min(8, Math.max(1, Number(args.limit ?? 8) || 8));
      const draft = await store.draftAiMemoryL3(slot, limit);
      const outputSummary = { layer: 'L3', slot, candidateCount: draft.entries.length, requiresTeacherReview: true, writesMemory: false, rawPromptIncluded: false, hiddenReasoningIncluded: false };
      const toolRun = createToolRun(tool, draft.entries.length ? 'used' : 'blocked', draft.entries.length ? '已从 L2 生成 L3 候选，等待教师审核。' : '没有可综合的 L2 条目。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, { id: `memory_l3_draft:${slot}`, title: `L3 ${slot} 候选证据`, type: 'SQLite ai_memory_documents/ai_memory_entries', detail: '候选只引用 surface 名称，不写入正式 L3。', count: draft.entries.length });
      return { review, toolRun, modelResult: boundedPayload({ ok: draft.entries.length > 0, draft, ...outputSummary }, tool.maxOutputChars).payload };
    }

    if (tool.name === 'inspect_memory_graph') {
      const limit = Math.min(200, Math.max(1, Number(args.limit ?? 200) || 200));
      const graph = await store.getAiMemoryEvidenceGraph(limit);
      const outputSummary = { layer: 'L2/L3', nodeCount: graph.nodes.length, edgeCount: graph.edges.length, bounded: true, rawPromptIncluded: false, hiddenReasoningIncluded: false };
      const toolRun = createToolRun(tool, 'used', '已读取 L2/L3 到本地 run/event 的 evidence graph 投影。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, { id: 'memory_graph', title: '小智记忆证据图', type: 'SQLite memory graph projection', detail: '只返回 bounded 节点标签、边类型和状态，不返回正文或隐藏推理。', count: graph.nodes.length });
      return { review, toolRun, modelResult: boundedPayload({ ok: true, graph, ...outputSummary }, tool.maxOutputChars).payload };
    }

    if (tool.name === 'inspect_memory_governance') {
      const governance = await store.getAiMemoryGovernanceReport();
      const toolRun = createToolRun(tool, 'used', '已读取本地记忆治理报告；AI 写入保持关闭。', inputSummary, governance);
      state.toolRuns.push(toolRun);
      addSource(state.sources, { id: 'memory_governance', title: '小智记忆治理报告', type: 'SQLite governance projection', detail: '只读统计和悬空引用检查，不包含记忆正文。', count: governance.graphNodes });
      return { review, toolRun, modelResult: boundedPayload({ ok: true, governance }, tool.maxOutputChars).payload };
    }

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

    if (tool.name === 'get_review_queue') {
      const studentId = String(args.studentId ?? state.resolvedStudentId ?? '').trim();
      if (!studentId) {
        const toolRun = createToolRun(tool, 'blocked', '没有可用学生 ID，无法读取复习队列。', inputSummary, { reason: 'missing_student_id' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'missing_student_id' } };
      }
      const student = (await store.listStudents('')).find((item) => item.id === studentId);
      if (!student) {
        const toolRun = createToolRun(tool, 'blocked', '学生不存在，拒绝读取复习队列。', inputSummary, { reason: 'student_not_found' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'student_not_found' } };
      }
      const snapshot = await buildMasterySnapshot(store, studentId);
      const policy = buildMasteryPolicy(snapshot);
      const limitRaw = Number(args.limit ?? 20);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(20, Math.floor(limitRaw))) : 20;
      const timezone = String(args.timezone ?? 'UTC').trim().slice(0, 80) || 'UTC';
      const queue = policy.dueReviews.slice(0, limit).map((item) => ({
        id: `review_${item.id}`,
        knowledgePointId: item.id,
        name: item.name,
        moduleId: item.moduleId,
        moduleName: item.moduleName,
        type: item.type,
        dueAt: item.nextReviewAt,
      }));
      const outputSummary = {
        ok: true,
        schemaVersion: 'omni.review.queue.v1',
        studentId,
        timezone,
        timezoneInvariant: true,
        queue,
        dueReviewCount: queue.length,
        source: 'omni_edu_learning_records',
        rawRecordsIncluded: false,
        requiresTeacherReview: true,
      };
      const toolRun = createToolRun(tool, 'used', queue.length ? `已读取 ${queue.length} 个到期复习任务。` : '当前没有到期复习任务。', inputSummary, {
        studentId,
        dueReviewCount: queue.length,
        timezone,
        rawRecordsIncluded: false,
      });
      state.toolRuns.push(toolRun);
      addSource(state.sources, {
        id: 'review_queue',
        title: `${student.displayName} 间隔复习队列`,
        type: 'DeepTutor deterministic scheduler',
        detail: 'epoch due 判断不受本地时区切换影响；只返回知识点摘要，不含原始学习记录。',
        count: queue.length,
      });
      return { review, toolRun, modelResult: boundedPayload(outputSummary, tool.maxOutputChars).payload };
    }

    if (tool.name === 'mastery_status') {
      const studentId = String(args.studentId ?? state.resolvedStudentId ?? '');
      if (!studentId) {
        const toolRun = createToolRun(tool, 'blocked', '没有可用学生 ID，无法读取掌握度状态。', inputSummary, { found: false });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'missing_student_id' } };
      }
      const snapshot = await buildMasterySnapshot(store, studentId);
      const policy = buildMasteryPolicy(snapshot);
      const pendingQuestions = await store.getPendingAiMasteryQuestions(studentId, 20);
      const pendingQuestion = pendingQuestions[0] ?? null;
      const attemptsByPoint = new Map<string, { correct: number; total: number }>();
      for (const attempt of snapshot.attempts) {
        const current = attemptsByPoint.get(attempt.knowledgePointId) ?? { correct: 0, total: 0 };
        current.total += 1;
        if (attempt.isCorrect) current.correct += 1;
        attemptsByPoint.set(attempt.knowledgePointId, current);
      }
      const points = snapshot.modules.flatMap((module) => module.knowledge_points.map((point) => {
        const counts = attemptsByPoint.get(point.id) ?? { correct: 0, total: 0 };
        return {
          id: point.id,
          name: point.name,
          module: module.name,
          attempts: counts.total,
          correct: counts.correct,
          accuracy: counts.total ? Math.round((counts.correct / counts.total) * 100) / 100 : null,
          evidence: counts.total ? 'explicit_attempts' : 'no_attempts',
        };
      }));
      const outputSummary = {
        ok: true,
        source: 'omni_edu_learning_records',
        studentId,
        points,
        evidence: snapshot.evidence,
        policy: {
          version: policy.policyVersion,
          next: policy.next,
          dueReviews: policy.dueReviews,
        },
        pendingQuestion: pendingQuestion ? {
          id: pendingQuestion.id,
          knowledgePointId: pendingQuestion.knowledgePointId,
          knowledgePointName: pendingQuestion.knowledgePointName,
          stem: pendingQuestion.stem,
          options: pendingQuestion.options.slice(0, 8),
          status: pendingQuestion.status,
          answerSubmitted: pendingQuestion.status === 'answered',
        } : null,
        pendingQuestionCount: pendingQuestions.length,
        rawRecordsIncluded: false,
      };
      const toolRun = createToolRun(tool, 'used', `已读取 ${points.length} 个知识点的显式掌握度摘要；未读取原始记录正文。`, inputSummary, {
        pointCount: points.length,
        attemptCount: snapshot.evidence.attemptCount,
        unknownEvidence: snapshot.evidence.unknownEvidence,
      });
      state.toolRuns.push(toolRun);
      addSource(state.sources, {
        id: 'mastery_status',
        title: '知识点掌握度',
        type: 'SQLite learning records',
        detail: '仅基于显式正确/错误证据计算；自由文本不会被当作掌握度证据。',
        count: points.length,
      });
      return { review, toolRun, modelResult: boundedPayload(outputSummary, tool.maxOutputChars).payload };
    }

    if (tool.name === 'analyze_learning_progress') {
      const requestedStudentId = String(args.studentId ?? '').trim();
      if (state.resolvedStudentId && requestedStudentId && requestedStudentId !== state.resolvedStudentId) {
        const toolRun = createToolRun(tool, 'blocked', '请求的学生与本轮已绑定学生不一致，拒绝跨学生分析。', inputSummary, { reason: 'student_scope_mismatch' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'student_scope_mismatch' } };
      }
      const studentId = state.resolvedStudentId || requestedStudentId;
      if (!studentId) {
        const toolRun = createToolRun(tool, 'blocked', '没有可用学生 ID，无法生成学情统计。', inputSummary, { reason: 'missing_student_id' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'missing_student_id' } };
      }
      const student = (await store.listStudents('')).find((item) => item.id === studentId);
      if (!student) {
        const toolRun = createToolRun(tool, 'blocked', '学生不存在，拒绝生成学情统计。', inputSummary, { reason: 'student_not_found' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'student_not_found' } };
      }
      const records = await store.listRecords(studentId, { limit: 200 });
      const analytics = buildLearningAnalytics({
        studentId,
        records,
        startDate: String(args.startDate ?? '').trim() || undefined,
        endDate: String(args.endDate ?? '').trim() || undefined,
        subject: String(args.subject ?? '').trim() || undefined,
      });
      state.records = records;
      state.learningAnalytics = analytics;
      const outputSummary = {
        ok: true,
        source: 'omni_edu_learning_records',
        studentId,
        analytics,
        reportDraftMarkdown: buildLearningAnalyticsMarkdown(analytics, student.displayName),
        rawRecordsIncluded: false,
      };
      const toolRun = createToolRun(tool, 'used', analytics.metrics.recordCount
        ? `已完成 ${analytics.window.startDate} 至 ${analytics.window.endDate} 的学情统计。`
        : '统计成功，但当前筛选范围没有学习记录。', inputSummary, {
        studentId,
        recordCount: analytics.metrics.recordCount,
        activeDays: analytics.metrics.activeDays,
        sourceRecordCount: analytics.evidence.sourceRecordIds.length,
        rawRecordsIncluded: false,
      });
      state.toolRuns.push(toolRun);
      addSource(state.sources, {
        id: 'learning_analytics',
        title: `${student.displayName} 学情统计`,
        type: 'SQLite learning_records',
        detail: `统计范围 ${analytics.window.startDate} 至 ${analytics.window.endDate}；可由 ${analytics.evidence.sourceRecordIds.length} 条来源记录重算。`,
        count: analytics.metrics.recordCount,
      });
      return { review, toolRun, modelResult: boundedPayload(outputSummary, tool.maxOutputChars).payload };
    }

    if (tool.name === 'classify_error_patterns') {
      const requestedStudentId = String(args.studentId ?? '').trim();
      if (state.resolvedStudentId && requestedStudentId && requestedStudentId !== state.resolvedStudentId) {
        const toolRun = createToolRun(tool, 'blocked', '请求的学生与本轮已绑定学生不一致，拒绝跨学生错因分析。', inputSummary, { reason: 'student_scope_mismatch' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'student_scope_mismatch' } };
      }
      const studentId = state.resolvedStudentId || requestedStudentId;
      if (!studentId) {
        const toolRun = createToolRun(tool, 'blocked', '没有可用学生 ID，无法进行错因分类。', inputSummary, { reason: 'missing_student_id' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'missing_student_id' } };
      }
      const student = (await store.listStudents('')).find((item) => item.id === studentId);
      if (!student) {
        const toolRun = createToolRun(tool, 'blocked', '学生不存在，拒绝生成错因分类。', inputSummary, { reason: 'student_not_found' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'student_not_found' } };
      }
      const records = await store.listRecords(studentId, { limit: 200 });
      let analysis;
      try {
        analysis = buildErrorTaxonomyAnalysis({
          studentId,
          records,
          startDate: String(args.startDate ?? '').trim() || undefined,
          endDate: String(args.endDate ?? '').trim() || undefined,
          subject: String(args.subject ?? '').trim() || undefined,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : 'invalid_error_taxonomy_window';
        const toolRun = createToolRun(tool, 'failed', `错因分类参数校验失败：${reason}`, inputSummary, { reason: 'invalid_error_taxonomy_window' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason } };
      }
      state.records = records;
      const outputSummary = {
        ok: true,
        source: 'omni_edu_learning_records',
        studentId,
        analysis,
        reportDraftMarkdown: buildErrorTaxonomyMarkdown(analysis, student.displayName),
        rawRecordsIncluded: false,
      };
      const toolRun = createToolRun(tool, 'used', analysis.evidence.includedRecordCount
        ? `已完成 ${analysis.window.startDate} 至 ${analysis.window.endDate} 的错因分类；未知项需老师复核。`
        : '分类完成，但当前筛选范围没有可识别的错题/订正记录。', inputSummary, {
        studentId,
        includedRecordCount: analysis.evidence.includedRecordCount,
        unknownCount: analysis.evidence.unknownRecordIds.length,
        sourceRecordCount: analysis.evidence.sourceRecordIds.length,
        rawRecordsIncluded: false,
      });
      state.toolRuns.push(toolRun);
      addSource(state.sources, {
        id: 'error_taxonomy',
        title: `${student.displayName} 错因分类`,
        type: 'SQLite learning_records',
        detail: `分类范围 ${analysis.window.startDate} 至 ${analysis.window.endDate}；未知项不自动写入学生档案。`,
        count: analysis.evidence.sourceRecordIds.length,
      });
      return { review, toolRun, modelResult: boundedPayload(outputSummary, tool.maxOutputChars).payload };
    }

    if (tool.name === 'mastery_quiz') {
      const studentId = String(args.studentId ?? state.resolvedStudentId ?? '');
      if (!studentId) {
        const toolRun = createToolRun(tool, 'blocked', '没有可用学生 ID，无法创建掌握度小测。', inputSummary, { found: false });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'missing_student_id' } };
      }
      const existingPending = await store.getPendingAiMasteryQuestions(studentId, 1);
      if (existingPending.length) {
        const toolRun = createToolRun(tool, 'blocked', '当前学生已有未完成掌握度小测，请先回答并评分后再创建下一组。', inputSummary, { reason: 'pending_question_exists', questionId: existingPending[0].id });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'pending_question_exists' } };
      }
      const { snapshot, points: masteryPoints } = await getMasteryKnowledgePoints(studentId);
      const attemptsByPoint = new Map<string, { correct: number; total: number }>();
      for (const attempt of snapshot.attempts) {
        const current = attemptsByPoint.get(attempt.knowledgePointId) ?? { correct: 0, total: 0 };
        current.total += 1;
        if (attempt.isCorrect) current.correct += 1;
        attemptsByPoint.set(attempt.knowledgePointId, current);
      }
      const requestedPointId = String(args.knowledgePointId ?? '');
      const candidatePoints = masteryPoints;
      const sortedPoints = [...candidatePoints].sort((a, b) => {
          const left = attemptsByPoint.get(a.id) ?? { correct: 0, total: 0 };
          const right = attemptsByPoint.get(b.id) ?? { correct: 0, total: 0 };
          const leftAccuracy = left.total ? left.correct / left.total : 0;
          const rightAccuracy = right.total ? right.correct / right.total : 0;
          return leftAccuracy - rightAccuracy || left.total - right.total;
        });
      const requestedPoint = sortedPoints.find((item) => item.id === requestedPointId);
      const orderedPoints = requestedPoint ? [requestedPoint, ...sortedPoints.filter((item) => item.id !== requestedPoint.id)] : sortedPoints;
      const requestedCount = Number(args.questionCount);
      const questionCount = Number.isFinite(requestedCount) ? Math.min(5, Math.max(1, Math.trunc(requestedCount))) : 1;
      const pointsForQuiz = orderedPoints.slice(0, questionCount);
      if (!pointsForQuiz.length) {
        const toolRun = createToolRun(tool, 'blocked', '当前没有明确知识点证据，不能凭空生成掌握度小测。', inputSummary, { pointCount: 0, unknownEvidence: snapshot.evidence.unknownEvidence });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'no_explicit_knowledge_point' } };
      }
      if (!params.executionContext?.runId || !params.executionContext.turnId) {
        const toolRun = createToolRun(tool, 'blocked', '缺少宿主运行绑定，拒绝创建不可追踪的掌握度题目。', inputSummary, { reason: 'missing_run_binding' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'missing_run_binding' } };
      }
      const options = ['A. 能说明定义、适用条件，并给出一个正确例子。', 'B. 只记住一个结论，但不能说明适用条件。', 'C. 目前还不能判断。'];
      const questions = await store.createAiMasteryQuestions({
        runId: params.executionContext?.runId ?? '',
        turnId: params.executionContext?.turnId ?? '',
        studentId,
        questions: pointsForQuiz.map((point) => ({
          knowledgePointId: point.id,
          knowledgePointName: point.name,
          stem: `关于“${point.name}”，哪一项最能说明已经达到可应用的掌握标准？`,
          options,
          expectedAnswer: 'A',
        })),
      });
      const question = questions[0];
      const outputSummary = {
        ok: true,
        questionId: question.id,
        knowledgePointId: pointsForQuiz[0].id,
        knowledgePoint: pointsForQuiz[0].name,
        stem: question.stem,
        options,
        questionIndex: 1,
        questionCount: questions.length,
        remainingQuestionCount: Math.max(0, questions.length - 1),
        requiresUserInput: true,
        expectedAnswerIncluded: false,
      };
      const toolRun = createToolRun(tool, 'used', `已创建 ${questions.length} 道连续掌握度小测，当前题为 ${pointsForQuiz[0].name}；正确答案留在主进程。`, inputSummary, { questionId: question.id, knowledgePointId: pointsForQuiz[0].id, questionCount: questions.length, expectedAnswerIncluded: false });
      state.toolRuns.push(toolRun);
      return { review, toolRun, modelResult: boundedPayload(outputSummary, tool.maxOutputChars).payload };
    }

    if (tool.name === 'mastery_grade') {
      const questionId = String(args.questionId ?? '');
      const answer = String(args.answer ?? '').trim().slice(0, 2_000);
      const question = questionId
        ? await store.getAiMasteryQuestion(questionId)
        : (state.resolvedStudentId ? await store.getPendingAiMasteryQuestion(state.resolvedStudentId) : null);
      if (question && state.resolvedStudentId && question.studentId !== state.resolvedStudentId) {
        const toolRun = createToolRun(tool, 'blocked', '题目不属于本轮绑定学生，拒绝跨学生评分。', inputSummary, { questionId: question.id, reason: 'student_scope_mismatch' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'student_scope_mismatch' } };
      }
      if (!question || question.status !== 'answered') {
        const toolRun = createToolRun(tool, 'blocked', '题目不存在、尚未完成答题或已评分，拒绝重复写回。', inputSummary, { questionId, status: question?.status ?? 'missing' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'question_not_answerable' } };
      }
      if (answer && answer !== question.answer) {
        // The host accepts the answer from the tool call only when it matches
        // the answer captured by the user-input checkpoint.
        const toolRun = createToolRun(tool, 'blocked', '评分答案与已提交的 checkpoint 不一致，拒绝越权写回。', inputSummary, { questionId, reason: 'answer_mismatch' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'answer_mismatch' } };
      }
      const pendingQueue = await store.getPendingAiMasteryQuestions(question.studentId, 20);
      if (pendingQueue[0] && pendingQueue[0].id !== question.id) {
        const toolRun = createToolRun(tool, 'blocked', '连续小测必须按题目顺序评分，拒绝跳过前置题目。', inputSummary, { questionId: question.id, reason: 'question_order_mismatch' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'question_order_mismatch' } };
      }
      const isCorrect = question.answer.trim().toUpperCase().startsWith(question.expectedAnswer.toUpperCase());
      const graded = await store.gradeAiMasteryQuestion(question.id, isCorrect);
      if (!graded) {
        const toolRun = createToolRun(tool, 'failed', '掌握度题目评分写回失败。', inputSummary, { questionId });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'grade_write_failed' } };
      }
      // Preserve the point's authoritative type when a quiz is graded.  A
      // generic quiz must not silently reclassify a procedure point as a
      // concept, otherwise a later mastery_assess call could bypass the
      // procedure -> quiz/grade gate.
      const gradedMastery = await getMasteryKnowledgePoints(question.studentId);
      const gradedPoint = gradedMastery.points.find((point) => point.id === question.knowledgePointId);
      const gradedKnowledgeType = gradedPoint?.type ?? 'concept';
      await store.createRecord({
        studentId: question.studentId,
        recordType: 'mastery_attempt',
        subject: '掌握度练习',
        title: `掌握度小测：${question.knowledgePointName}`,
        content: JSON.stringify({ knowledgePoint: question.knowledgePointName, knowledgeType: gradedKnowledgeType, isCorrect, questionId: question.id }),
        tags: [question.knowledgePointName, 'mastery_attempt'],
      });
      const outputSummary = { ok: true, questionId: question.id, knowledgePoint: question.knowledgePointName, knowledgeType: gradedKnowledgeType, isCorrect, writeback: 'learning_records', expectedAnswerIncluded: false };
      const toolRun = createToolRun(tool, 'used', `已评分并写回一条显式掌握度记录：${isCorrect ? '正确' : '待加强'}。`, inputSummary, { questionId: question.id, isCorrect, writeback: 'learning_records' });
      state.toolRuns.push(toolRun);
      return { review, toolRun, modelResult: boundedPayload(outputSummary, tool.maxOutputChars).payload };
    }

    if (tool.name === 'mastery_assess') {
      const studentId = String(args.studentId ?? state.resolvedStudentId ?? '');
      const pointId = String(args.knowledgePointId ?? '');
      const passed = args.passed === true;
      const feedback = String(args.feedback ?? '').slice(0, 600);
      const studentExists = studentId ? (await store.listStudents('')).some((student) => student.id === studentId) : false;
      const mastery = studentId ? await getMasteryKnowledgePoints(studentId) : undefined;
      const point = mastery?.points.find((candidate) => candidate.id === pointId);
      if (!studentExists || !studentId || !pointId || !point) {
        const toolRun = createToolRun(tool, 'blocked', '学生或知识点不存在，不能记录概念掌握判断。', inputSummary, { studentId, knowledgePointId: pointId, reason: 'unknown_knowledge_point' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'unknown_knowledge_point' } };
      }
      if (!['concept', 'design'].includes(point.type)) {
        const toolRun = createToolRun(tool, 'blocked', `知识点类型为 ${point.type}，应使用 mastery_quiz + mastery_grade。`, inputSummary, { knowledgePointId: pointId, type: point.type, reason: 'wrong_gate' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'wrong_gate', type: point.type } };
      }
      const pendingAssessment = { ok: true, knowledgePointId: pointId, knowledgePoint: point.name, knowledgeType: point.type, passed, writeback: 'teacher_confirmation', pendingConfirmation: { actionType: 'save_mastery_state', operation: 'assess' }, expectedAnswerIncluded: false };
      const pendingAssessmentRun = createToolRun(tool, 'used', 'Mastery assessment draft is awaiting teacher confirmation.', inputSummary, { knowledgePointId: pointId, passed, writeback: 'teacher_confirmation' });
      state.toolRuns.push(pendingAssessmentRun);
      return { review, toolRun: pendingAssessmentRun, modelResult: boundedPayload(pendingAssessment, tool.maxOutputChars).payload };
    }

    if (tool.name === 'mastery_build') {
      const studentId = String(args.studentId ?? state.resolvedStudentId ?? '');
      const mode = String(args.mode ?? 'replace') === 'append' ? 'append' : 'replace';
      const rawModules = Array.isArray(args.modules) ? args.modules : [];
      const studentExists = studentId ? (await store.listStudents('')).some((student) => student.id === studentId) : false;
      if (!studentExists || !studentId || !rawModules.length || rawModules.length > 12) {
        const toolRun = createToolRun(tool, 'blocked', '学习路径必须包含 1-12 个模块，并绑定学生。', inputSummary, { reason: 'invalid_modules' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'invalid_modules' } };
      }
      const modules: Array<{ id: string; name: string; order: number; knowledgePoints: Array<{ id: string; name: string; type: 'memory' | 'procedure' | 'concept' | 'design' }> }> = [];
      let invalidModule = false;
      for (let moduleIndex = 0; moduleIndex < rawModules.length; moduleIndex += 1) {
        const rawModule = rawModules[moduleIndex] && typeof rawModules[moduleIndex] === 'object' ? rawModules[moduleIndex] as Record<string, unknown> : {};
        const name = String(rawModule.name ?? '').trim().slice(0, 200);
        const rawPoints = Array.isArray(rawModule.knowledgePoints) ? rawModule.knowledgePoints : Array.isArray(rawModule.knowledge_points) ? rawModule.knowledge_points : [];
        if (!name || rawPoints.length < 1 || rawPoints.length > 20) { invalidModule = true; continue; }
        const knowledgePoints: Array<{ id: string; name: string; type: 'memory' | 'procedure' | 'concept' | 'design' }> = [];
        for (let pointIndex = 0; pointIndex < rawPoints.length; pointIndex += 1) {
          const rawPoint = rawPoints[pointIndex] && typeof rawPoints[pointIndex] === 'object' ? rawPoints[pointIndex] as Record<string, unknown> : {};
          const pointName = String(rawPoint.name ?? '').trim().slice(0, 160);
          const rawType = String(rawPoint.type ?? 'concept').toLowerCase();
          if (!pointName || !['memory', 'procedure', 'concept', 'design'].includes(rawType)) { invalidModule = true; continue; }
          knowledgePoints.push({ id: `mastery_m${moduleIndex}_kp${pointIndex}`, name: pointName, type: rawType as 'memory' | 'procedure' | 'concept' | 'design' });
        }
        if (knowledgePoints.length) modules.push({ id: `mastery_m${moduleIndex}`, name, order: moduleIndex, knowledgePoints });
      }
      if (invalidModule || modules.length !== rawModules.length || !modules.length) {
        const toolRun = createToolRun(tool, 'blocked', '没有有效模块：每个模块需要名称和至少一个合法知识点类型。', inputSummary, { reason: 'no_valid_modules' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'no_valid_modules' } };
      }
      const pendingBuild = { ok: true, mode, modules: modules.map((module) => ({ id: module.id, name: module.name, order: module.order, knowledgePointCount: module.knowledgePoints.length })), writeback: 'teacher_confirmation', pendingConfirmation: { actionType: 'save_mastery_state', operation: 'build' } };
      const pendingBuildRun = createToolRun(tool, 'used', 'Mastery path draft is awaiting teacher confirmation.', inputSummary, { moduleCount: modules.length, writeback: 'teacher_confirmation' });
      state.toolRuns.push(pendingBuildRun);
      return { review, toolRun: pendingBuildRun, modelResult: boundedPayload(pendingBuild, tool.maxOutputChars).payload };
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

    if (tool.name === 'explore_attached_sources') {
      const requestedStudentId = String(args.studentId ?? '').trim();
      if (state.resolvedStudentId && requestedStudentId && requestedStudentId !== state.resolvedStudentId) {
        const toolRun = createToolRun(tool, 'blocked', '请求的学生与本轮绑定学生不一致，拒绝探索附件来源。', inputSummary, { reason: 'student_scope_mismatch' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'student_scope_mismatch' } };
      }
      const studentId = state.resolvedStudentId || requestedStudentId;
      if (!studentId) {
        const toolRun = createToolRun(tool, 'blocked', '没有绑定学生，无法确定附件来源边界。', inputSummary, { reason: 'missing_student_id' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'missing_student_id' } };
      }
      const student = (await store.listStudents('')).find((item) => item.id === studentId);
      if (!student) {
        const toolRun = createToolRun(tool, 'blocked', '学生不存在，拒绝探索附件来源。', inputSummary, { reason: 'student_not_found' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'student_not_found' } };
      }
      const records = await store.listRecords(studentId, { limit: 200 });
      const attached = new Map<string, { recordId: string; fileName: string; fileType: string }>();
      for (const record of records) {
        for (const attachment of record.attachments) {
          attached.set(attachment.id, { recordId: record.id, fileName: attachment.fileName, fileType: attachment.fileType });
        }
      }
      const requestedIds = Array.isArray(args.attachmentIds)
        ? args.attachmentIds.map((item) => String(item).trim()).filter(Boolean).slice(0, 8)
        : [];
      const selectedIds = requestedIds.length ? requestedIds.filter((id) => attached.has(id)) : [...attached.keys()];
      if (requestedIds.some((id) => !attached.has(id))) {
        const toolRun = createToolRun(tool, 'blocked', '指定附件不属于当前学生已授权记录。', inputSummary, { reason: 'attachment_scope_mismatch' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'attachment_scope_mismatch' } };
      }
      if (!selectedIds.length) {
        const toolRun = createToolRun(tool, 'blocked', '当前没有可探索的附件来源；不会读取任意本地路径。', inputSummary, { reason: 'no_attached_sources' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'no_attached_sources' } };
      }
      const analyses = await store.listMistakeImageAnalyses(studentId);
      const analysisByAttachment = new Map(analyses.filter((analysis) => analysis.attachmentId).map((analysis) => [analysis.attachmentId, analysis]));
      const query = String(args.query ?? '').trim().slice(0, 800);
      const normalizedQuery = query.toLocaleLowerCase();
      const terms = normalizedQuery.split(/\s+/u).filter((term) => term.length > 1).slice(0, 12);
      const limitRaw = Number(args.limit ?? 5);
      const limit = Number.isFinite(limitRaw) ? Math.max(1, Math.min(5, Math.trunc(limitRaw))) : 5;
      const candidates = selectedIds.map((attachmentId) => {
        const metadata = attached.get(attachmentId)!;
        const analysis = analysisByAttachment.get(attachmentId);
        const text = String(analysis?.sanitizedText ?? '').replace(/\s+/gu, ' ').trim().slice(0, 12_000);
        const lowerText = text.toLocaleLowerCase();
        const score = !normalizedQuery ? (text ? 1 : 0) : normalizedQuery && lowerText.includes(normalizedQuery) ? 3 : terms.filter((term) => lowerText.includes(term)).length;
        const matchIndex = normalizedQuery ? lowerText.indexOf(normalizedQuery) : 0;
        const start = matchIndex > 80 ? matchIndex - 80 : 0;
        const snippet = text ? text.slice(start, start + 600) : '';
        return {
          sourceHandle: `attachment:${attachmentId}`,
          attachmentId,
          recordId: metadata.recordId,
          fileName: metadata.fileName,
          fileType: metadata.fileType,
          analysisId: analysis?.id ?? null,
          ocrStatus: analysis?.ocrStatus ?? 'needs_ocr',
          score,
          snippet,
          readable: Boolean(text),
        };
      }).sort((left, right) => right.score - left.score || left.attachmentId.localeCompare(right.attachmentId));
      const sources = candidates.filter((item) => item.score > 0 || !normalizedQuery).slice(0, limit);
      const unreadableCount = candidates.filter((item) => !item.readable).length;
      const outputSummary = {
        ok: sources.length > 0,
        schemaVersion: 'omni.attached.sources.exploration.v1',
        studentId,
        query,
        sources,
        sourceCount: sources.length,
        authorizedSourceCount: selectedIds.length,
        unreadableCount,
        sourceHandlesOnly: true,
        rawFilesIncluded: false,
        localPathsIncluded: false,
        requiresTeacherReview: true,
        unknowns: unreadableCount ? [`${unreadableCount} 个附件没有可用脱敏 OCR 文本，未读取原始文件。`] : [],
      };
      const toolRun = createToolRun(tool, sources.length ? 'used' : 'blocked', sources.length ? `已按查询探索 ${sources.length} 个脱敏附件片段；未读取原始文件。` : '已检查授权附件，但没有匹配的脱敏 OCR 片段。', inputSummary, {
        sourceCount: sources.length,
        authorizedSourceCount: selectedIds.length,
        unreadableCount,
        rawFilesIncluded: false,
      });
      state.toolRuns.push(toolRun);
      addSource(state.sources, {
        id: 'attached_source_exploration',
        title: `${student.displayName} 附件来源探索`,
        type: 'SQLite sanitized OCR source handles',
        detail: '只读取当前学生授权附件的脱敏片段；不返回原始路径，不把全文注入上下文。',
        count: sources.length,
      });
      return { review, toolRun, modelResult: boundedPayload(outputSummary, tool.maxOutputChars).payload };
    }

    if (tool.name === 'analyze_geometry_figure') {
      const studentId = String(state.resolvedStudentId ?? '').trim();
      if (!studentId) {
        const toolRun = createToolRun(tool, 'blocked', '没有绑定学生，无法读取本地错题图片分析。', inputSummary, { reason: 'missing_student_id' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'missing_student_id' } };
      }
      const analyses = await store.listMistakeImageAnalyses(studentId);
      const requestedId = String(args.analysisId ?? '').trim();
      const analysis = requestedId ? analyses.find((item) => item.id === requestedId) : analyses[0];
      if (requestedId && !analysis) {
        const toolRun = createToolRun(tool, 'blocked', '指定的错题图片分析不存在或不属于当前学生。', inputSummary, { reason: 'analysis_not_found' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'analysis_not_found' } };
      }
      const draft = buildVisionSolverDraft({
        analysis,
        questionText: String(args.questionText ?? '').trim() || analysis?.sanitizedText || prompt,
        commands: args.commands,
        constraints: args.constraints,
        geometricRelations: args.geometricRelations,
      });
      const outputSummary = {
        status: draft.status,
        hasImage: draft.hasImage,
        analysisId: draft.analysisId,
        validCommandCount: draft.commands.filter((item) => item.valid).length,
        rejectedCommandCount: draft.commands.filter((item) => !item.valid).length,
        originalImageUploaded: false,
        requiresTeacherReview: true,
      };
      const toolRun = createToolRun(tool, 'used', draft.status === 'ready'
        ? '已生成经白名单校验的 GeoGebra 草稿；原图未上传，需老师预览。'
        : draft.status === 'no_image'
          ? '当前没有本地错题图片，视觉求解正常结束。'
          : '已读取本地图片元数据，但没有可执行命令；需先完成脱敏 OCR 或教师修正。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, {
        id: 'vision_solver',
        title: 'DeepTutor Vision Solver / GeoGebra 草稿',
        type: '本地错题图片分析',
        detail: `状态 ${draft.status}；原图未上传；命令需老师预览。`,
        count: draft.commands.filter((item) => item.valid).length,
      });
      return {
        review,
        toolRun,
        modelResult: boundedPayload({ ok: true, draft, previewMarkdown: buildVisionSolverMarkdown(draft), rawImageIncluded: false }, tool.maxOutputChars).payload,
      };
    }

    if (tool.name === 'analyze_notebook_context') {
      const requestedNotebookId = String(args.notebookId ?? '').trim();
      const requestedRecordId = String(args.recordId ?? '').trim();
      const mode = args.mode === 'record_summary' ? 'record_summary' : 'context';
      const requestedQuery = String(args.query ?? prompt).trim();
      const notebooks = await store.listTeacherNotebooks(false);
      const scopedNotebooks = requestedNotebookId
        ? notebooks.filter((notebook) => notebook.id === requestedNotebookId)
        : notebooks;
      if (requestedNotebookId && scopedNotebooks.length === 0) {
        const toolRun = createToolRun(tool, 'blocked', '指定的备课本不存在、已删除或不属于当前本地工作区。', inputSummary, { reason: 'notebook_not_found' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'notebook_not_found' } };
      }
      const recordGroups = await Promise.all(scopedNotebooks.map(async (notebook) => ({
        notebook,
        records: await store.listTeacherNotebookRecords(notebook.id, false),
      })));
      if (mode === 'record_summary' && requestedRecordId && !recordGroups.some(({ records }) => records.some((record) => record.id === requestedRecordId))) {
        const toolRun = createToolRun(tool, 'blocked', '指定的备课本记录不存在、已删除或不属于当前可见范围。', inputSummary, { reason: 'record_not_found' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'record_not_found' } };
      }
      const analysis = await buildNotebookAnalysis({
        notebooks: scopedNotebooks,
        records: recordGroups,
        query: requestedQuery,
        mode,
        recordId: requestedRecordId || undefined,
        sanitize: async (text) => {
          const sanitized = await store.sanitizeProblemText(text);
          return { sanitizedText: sanitized.sanitizedText, redactions: sanitized.redactions };
        },
      });
      const outputSummary = {
        mode: analysis.mode,
        catalogCount: analysis.coverage.catalogCount,
        selectedCount: analysis.coverage.selectedCount,
        detailCount: analysis.coverage.detailCount,
        omittedCount: analysis.coverage.omittedCount,
        requiresTeacherReview: Boolean(analysis.summaryDraft),
        rawNotebookFilesUploaded: false,
      };
      const toolRun = createToolRun(tool, analysis.coverage.catalogCount ? 'used' : 'blocked', analysis.coverage.catalogCount
        ? `已按需扫描 ${analysis.coverage.catalogCount} 条备课本目录，读取 ${analysis.coverage.detailCount} 条有限细节。`
        : '当前没有可用备课本记录，未读取任何笔记正文。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, {
        id: 'teacher_notebook',
        title: '教师备课本（DeepTutor Notebook Analysis/Summarize）',
        type: 'SQLite / 本地备课本',
        detail: analysis.coverage.catalogCount ? '仅按查询选择有限记录细节；原始笔记文件不上传，摘要草稿需老师复核。' : '当前没有可用备课本记录。',
        count: analysis.coverage.catalogCount,
      });
      return {
        review,
        toolRun,
        modelResult: boundedPayload({ ok: analysis.coverage.catalogCount > 0, analysis, ...outputSummary }, tool.maxOutputChars).payload,
      };
    }

    if (tool.name === 'search_question_notebook') {
      const sanitizeQuery = await store.sanitizeProblemText(String(args.query ?? prompt));
      const sourceKind = args.sourceKind === 'local_bank' || args.sourceKind === 'teacher_resource' || args.sourceKind === 'generated'
        ? args.sourceKind as 'local_bank' | 'teacher_resource' | 'generated'
        : undefined;
      const filters = {
        query: sanitizeQuery.sanitizedText,
        categoryId: String(args.categoryId ?? '').trim() || undefined,
        bookmarked: typeof args.bookmarked === 'boolean' ? args.bookmarked : undefined,
        sourceKind,
        limit: capLimit(args.limit, 20, 20),
        offset: Math.max(0, Math.min(Math.trunc(Number(args.offset ?? 0) || 0), 10_000)),
      };
      const result = await store.listQuestionNotebook(filters);
      const analysis = await buildQuestionNotebookAnalysis({
        result,
        filters,
        sanitize: async (text) => {
          const sanitized = await store.sanitizeProblemText(text);
          return { sanitizedText: sanitized.sanitizedText };
        },
      });
      const notebookInputSummary = { ...inputSummary, args: { ...inputSummary.args, query: filters.query } };
      const outputSummary = {
        total: analysis.coverage.total,
        selected: analysis.coverage.selected,
        hasMore: analysis.coverage.hasMore,
        rawQuestionFilesUploaded: false,
      };
      const toolRun = createToolRun(tool, result.total ? 'used' : 'blocked', result.total
        ? `从现有题库 Question Notebook 索引命中 ${result.total} 道题目。`
        : '题目收藏/分类索引没有命中题目。', notebookInputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, {
        id: 'question_notebook',
        title: 'Question Notebook 题目收藏与分类',
        type: 'SQLite / question_bank overlay',
        detail: result.total ? '已从现有 canonical 题库读取收藏、分类和历史引用索引；没有复制题目正文。' : '当前没有命中题目收藏/分类索引。',
        count: result.total,
      });
      return {
        review,
        toolRun,
        modelResult: boundedPayload({ ok: result.total > 0, analysis, ...outputSummary }, tool.maxOutputChars).payload,
      };
    }

    if (tool.name === 'inspect_teaching_book') {
      const query = String(args.query ?? '').trim().slice(0, 240);
      const requestedBookId = String(args.bookId ?? '').trim().slice(0, 160);
      let detail = requestedBookId ? await store.getTeachingBook(requestedBookId) : undefined;
      if (!detail && !requestedBookId) {
        const books = await store.listTeachingBooks(false);
        const match = books.find((book) => !query || `${book.title} ${book.description}`.toLowerCase().includes(query.toLowerCase())) ?? books[0];
        if (match) detail = await store.getTeachingBook(match.id);
      }
      const inspection = buildTeachingBookInspection(detail, query);
      const outputSummary = { ok: inspection.ok, status: inspection.health?.status ?? 'not_found', chapterCount: inspection.coverage?.chapterCount ?? 0, pageCount: inspection.coverage?.pageCount ?? 0, blockCount: inspection.coverage?.blockCount ?? 0, stalePageCount: inspection.health?.stalePageIds?.length ?? 0, missingSourceCount: inspection.health?.missingSourceRefs?.length ?? 0 };
      const toolRun = createToolRun(tool, inspection.ok ? 'used' : 'blocked', inspection.ok ? `已读取讲义目录、${outputSummary.pageCount} 个页面及来源健康状态 ${outputSummary.status}。` : '没有找到可读取的专题讲义。', { ...inputSummary, args: { bookId: requestedBookId, query } }, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, { id: detail?.book.id ?? 'teaching_book', title: '专题讲义 / 单元备课包', type: 'SQLite / DeepTutor Book Workspace adapter', detail: inspection.ok ? '已读取结构化章节、页面、内容块和来源指纹；未读取学生数据或原始文件。' : '当前没有可用讲义。', count: outputSummary.pageCount });
      return { review, toolRun, modelResult: boundedPayload(inspection, tool.maxOutputChars).payload };
    }

    if (tool.name === 'refresh_teaching_book_health') {
      const bookId = String(args.bookId ?? '').trim();
      if (!bookId) {
        const toolRun = createToolRun(tool, 'blocked', '刷新来源健康必须显式指定 bookId，避免跨讲义写入失效状态。', inputSummary, { reason: 'book_id_required' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'book_id_required' } };
      }
      const detail = await store.getTeachingBook(bookId);
      if (!detail) {
        const toolRun = createToolRun(tool, 'blocked', '指定讲义不存在、已归档或不属于当前本地工作区。', inputSummary, { reason: 'book_not_found' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'book_not_found' } };
      }
      const health = await store.refreshTeachingBookHealth(bookId);
      const invalidations = await store.listTeachingBookInvalidations(bookId);
      const outputSummary = {
        bookId,
        status: health.status,
        sourceCount: health.sourceCount,
        staleSourceCount: health.staleSourceRefs.length,
        missingSourceCount: health.missingSourceRefs.length,
        stalePageCount: health.stalePageIds.length,
        staleBlockCount: health.staleBlockIds.length,
        openInvalidationCount: invalidations.length,
        writesContent: false,
        requiresTeacherReview: health.status !== 'healthy',
      };
      const toolRun = createToolRun(tool, 'used', health.status === 'healthy' ? '来源 fingerprint 已刷新，当前讲义健康；未修改正文。' : '已定位来源漂移/缺失并写入局部失效队列；请老师复核后按块或按页重生成。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, { id: bookId, title: '专题讲义来源健康', type: 'SQLite / fingerprint invalidation queue', detail: '仅更新来源状态和局部失效索引，不修改正文、不触发整本重生成。', count: outputSummary.staleBlockCount + outputSummary.missingSourceCount });
      return { review, toolRun, modelResult: boundedPayload({ ok: true, health, invalidations, writesContent: false, requiresTeacherReview: health.status !== 'healthy' }, tool.maxOutputChars).payload };
    }

    if (tool.name === 'draft_teaching_book_patch') {
      const bookId = String(args.bookId ?? '').trim();
      const blockId = String(args.blockId ?? '').trim();
      const baseVersion = Number(args.baseVersion);
      if (!bookId || !blockId || !Number.isInteger(baseVersion) || baseVersion < 1) {
        const toolRun = createToolRun(tool, 'blocked', '生成 patch 必须显式指定 bookId、blockId 和有效 baseVersion。', inputSummary, { reason: 'patch_scope_required' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'patch_scope_required' } };
      }
      const detail = await store.getTeachingBook(bookId);
      if (!detail) {
        const toolRun = createToolRun(tool, 'blocked', '指定讲义不存在、已归档或不属于当前本地工作区。', inputSummary, { reason: 'book_not_found' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'book_not_found' } };
      }
      try {
        const patch = await store.proposeTeachingBookBlockPatch({ bookId, blockId, baseVersion, title: args.title == null ? undefined : String(args.title), payload: args.payload && typeof args.payload === 'object' && !Array.isArray(args.payload) ? args.payload as Record<string, unknown> : undefined, reason: args.reason == null ? undefined : String(args.reason) });
        const outputSummary = { patchId: patch.id, bookId, blockId, baseVersion: patch.baseVersion, status: patch.status, changed: patch.beforeTitle !== patch.afterTitle || JSON.stringify(patch.beforePayload) !== JSON.stringify(patch.afterPayload), writesContent: false, requiresTeacherReview: true };
        const toolRun = createToolRun(tool, 'used', '已生成可审阅 patch；尚未覆盖讲义正文，应用或撤销需教师确认。', inputSummary, outputSummary);
        state.toolRuns.push(toolRun);
        addSource(state.sources, { id: bookId, title: '专题讲义 patch 草稿', type: 'SQLite / CoWriter patch history', detail: '保留 before/after 与 baseVersion；未写入内容块正文。', count: 1 });
        return { review, toolRun, modelResult: boundedPayload({ ok: true, patch, ...outputSummary }, tool.maxOutputChars).payload };
      } catch (error) {
        const toolRun = createToolRun(tool, 'blocked', error instanceof Error ? error.message : 'patch 生成失败', inputSummary, { reason: 'patch_conflict' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'patch_conflict' } };
      }
    }

    if (tool.name === 'draft_teaching_book_selection_patch') {
      const bookId = String(args.bookId ?? '').trim();
      const blockId = String(args.blockId ?? '').trim();
      const baseVersion = Number(args.baseVersion);
      const selectionStart = Number(args.selectionStart);
      const selectionEnd = Number(args.selectionEnd);
      const selectedText = String(args.selectedText ?? '');
      const replacementText = String(args.replacementText ?? '');
      if (!bookId || !blockId || !Number.isInteger(baseVersion) || baseVersion < 1 || !Number.isInteger(selectionStart) || !Number.isInteger(selectionEnd) || selectionStart < 0 || selectionEnd <= selectionStart || !selectedText || !replacementText) {
        const toolRun = createToolRun(tool, 'blocked', '选区 patch 必须显式指定讲义、内容块、版本、选区边界、原文和候选替换文本。', inputSummary, { reason: 'selection_scope_required' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'selection_scope_required' } };
      }
      const detail = await store.getTeachingBook(bookId);
      if (!detail) {
        const toolRun = createToolRun(tool, 'blocked', '指定讲义不存在、已归档或不属于当前本地工作区。', inputSummary, { reason: 'book_not_found' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'book_not_found' } };
      }
      try {
        const patch = await store.proposeTeachingBookSelectionPatch({ bookId, blockId, baseVersion, selectionStart, selectionEnd, selectedText, replacementText, mode: args.mode === 'automark' ? 'automark' : 'react_edit', reason: args.reason == null ? undefined : String(args.reason) });
        const chunks = replacementText.match(/.{1,80}/gu) ?? [replacementText];
        const streamEvents = [
          { type: 'draft_started', mode: patch.operation === 'automark_selection' ? 'automark' : 'react_edit', selectionStart, selectionEnd },
          ...chunks.map((content) => ({ type: 'draft_delta', content })),
          { type: 'draft_ready', chars: replacementText.length },
        ];
        const outputSummary = { patchId: patch.id, operation: patch.operation, selectionStart, selectionEnd, selectedTextHash: patch.selectedTextHash, status: patch.status, streamEventCount: streamEvents.length, writesContent: false, requiresTeacherReview: true };
        const toolRun = createToolRun(tool, 'used', '已生成选区编辑草稿和流式事件；尚未覆盖讲义正文，应用需教师确认并再次校验版本/选区指纹。', inputSummary, outputSummary);
        state.toolRuns.push(toolRun);
        addSource(state.sources, { id: bookId, title: '专题讲义选区 CoWriter 草稿', type: 'SQLite / bounded selection patch', detail: '复用 react-edit/automark 的选区语义；保存 before/after、理由、选区哈希和草稿事件。', count: 1 });
        return { review, toolRun, modelResult: boundedPayload({ ok: true, patch, streamEvents, ...outputSummary }, tool.maxOutputChars).payload };
      } catch (error) {
        const toolRun = createToolRun(tool, 'blocked', error instanceof Error ? error.message : '选区 patch 生成失败', inputSummary, { reason: 'selection_drift_or_conflict' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'selection_drift_or_conflict' } };
      }
    }

    if (tool.name === 'draft_teaching_book_markdown') {
      const bookId = String(args.bookId ?? '').trim();
      const detail = bookId ? await store.getTeachingBook(bookId) : undefined;
      if (!detail) {
        const toolRun = createToolRun(tool, 'blocked', '指定讲义不存在、已归档或不属于当前本地工作区。', inputSummary, { reason: 'book_not_found' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'book_not_found' } };
      }
      const rendered = renderTeachingBookMarkdown(detail);
      const outputSummary = { bookId, blockCount: rendered.blockCount, fallbackCount: rendered.fallbackCount, sourceRefCount: rendered.sourceRefs.length, markdownChars: rendered.markdown.length, requiresTeacherReview: true, writesFile: false };
      const toolRun = createToolRun(tool, 'used', rendered.fallbackCount ? `已生成 Markdown 预览，${rendered.fallbackCount} 个块使用兼容 fallback；导出前需老师复核。` : '已生成 Markdown 预览；未写入文件，需老师确认后导出。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, { id: bookId, title: '专题讲义 Markdown 预览', type: 'SQLite / local draft compiler', detail: '仅编译已保存的 block payload；导出和发布仍需教师确认。', count: rendered.blockCount });
      return { review, toolRun, modelResult: boundedPayload({ ok: true, analysis: rendered, ...outputSummary }, tool.maxOutputChars).payload };
    }

    if (tool.name === 'plan_teaching_book') {
      const bookId = String(args.bookId ?? '').trim();
      const detail = bookId ? await store.getTeachingBook(bookId) : undefined;
      if (!detail) {
        const toolRun = createToolRun(tool, 'blocked', '指定讲义不存在、已归档或不属于当前本地工作区。', inputSummary, { reason: 'book_not_found' });
        state.toolRuns.push(toolRun);
        return { review, toolRun, modelResult: { ok: false, reason: 'book_not_found' } };
      }
      const querySanitized = await store.sanitizeProblemText(String(args.query ?? detail.book.title));
      const limit = capLimit(args.limit, router.contextPolicy.knowledgeLimit || 6, 6);
      const chunks = await store.searchKnowledge(querySanitized.sanitizedText, limit);
      const plan = buildTeachingBookPlan(detail, chunks, querySanitized.sanitizedText);
      const outputSummary = { bookId, sourceChunks: chunks.length, proposedChapters: plan.coverage.proposedChapters, selectedSources: plan.coverage.selectedSources, requiresTeacherReview: true, writesBook: false };
      const toolRun = createToolRun(tool, 'used', chunks.length ? `已探索 ${chunks.length} 条本地知识片段，生成 ${plan.coverage.proposedChapters} 个章节候选；等待老师确认。` : '没有命中知识片段，已使用安全章节模板生成草案；等待老师补充来源。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, { id: bookId, title: '讲义章节规划 / 来源探索', type: 'SQLite / bounded knowledge chunks', detail: '只读取知识片段主题和来源元数据，不写入 book/chapter/page。', count: chunks.length });
      return { review, toolRun, modelResult: boundedPayload({ ok: true, analysis: plan, ...outputSummary }, tool.maxOutputChars).payload };
    }

    if (tool.name === 'generate_research_outline') {
      const querySanitized = await store.sanitizeProblemText(String(args.query ?? prompt));
      const limit = capLimit(args.limit, router.contextPolicy.knowledgeLimit || 6, 6);
      const chunks = await store.searchKnowledge(querySanitized.sanitizedText, limit);
      const analysis = buildResearchOutline(querySanitized.sanitizedText, chunks, limit);
      const outputSummary = {
        sourceCount: analysis.sourceRefs.length,
        outlineCount: analysis.outline.length,
        unknownCount: analysis.unknowns.length,
        evidenceBoundary: analysis.evidenceBoundary,
        requiresTeacherReview: true,
        writesFile: false,
      };
      const toolRun = createToolRun(tool, analysis.sourceRefs.length ? 'used' : 'blocked', analysis.sourceRefs.length ? '已基于本地教师知识切片生成研究提纲草案，未联网、未写文件。' : '本地教师知识库没有命中，已返回明确未知项。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, { id: 'research_outline', title: '本地研究提纲草案', type: 'SQLite / teacher knowledge', detail: '仅使用脱敏后的本地知识切片；来源、未知项和教师复核边界随结果返回。', count: analysis.sourceRefs.length });
      return { review, toolRun, modelResult: boundedPayload({ ok: analysis.sourceRefs.length > 0, analysis, ...outputSummary }, tool.maxOutputChars).payload };
    }

    if (tool.name === 'render_learning_mermaid') {
      const overview = await store.getKnowledgeOverview();
      const limit = capLimit(args.limit, router.contextPolicy.graphNodeLimit || 12, 12);
      const analysis = buildMermaidVisualization(String(args.title ?? prompt), overview.nodes, overview.edges, limit);
      state.graphNodes = overview.nodes.slice(0, limit);
      const outputSummary = {
        nodeCount: analysis.nodeCount,
        edgeCount: analysis.edgeCount,
        safe: true,
        requiresTeacherReview: true,
        writesFile: false,
      };
      const toolRun = createToolRun(tool, analysis.nodeCount ? 'used' : 'blocked', analysis.nodeCount ? '已生成受限 Mermaid 关系图；输出不执行脚本、不加载外链。' : '知识图谱暂无可视化节点。', inputSummary, outputSummary);
      state.toolRuns.push(toolRun);
      addSource(state.sources, { id: 'learning_visualization', title: '学习知识关系图', type: 'SQLite / knowledge graph', detail: '节点和边仅作为本地图谱背景，图表需教师复核后再展示或导出。', count: analysis.nodeCount });
      return { review, toolRun, modelResult: boundedPayload({ ok: analysis.nodeCount > 0, analysis, ...outputSummary }, tool.maxOutputChars).payload };
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
