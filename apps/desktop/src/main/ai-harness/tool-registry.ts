import type {
  AiConsoleSource,
  AiConsoleToolRun,
  AiContextKey,
  AiRouterDecision,
  KnowledgeNode,
  LearningRecord,
  ResourceChunk,
  Student,
} from '../../shared/contracts';
import type { OmniEduStore } from '../db';

type ToolDescriptor = {
  name: string;
  label: string;
  contextKey: AiContextKey;
  effect: 'read' | 'draft' | 'write';
  privacy: 'local_only' | 'sanitized_cloud';
};

export type CompiledAiContext = {
  student?: Student;
  records: LearningRecord[];
  knowledgeSnippets: ResourceChunk[];
  graphNodes: KnowledgeNode[];
  sources: AiConsoleSource[];
  toolRuns: AiConsoleToolRun[];
  selectedContext: AiContextKey[];
  resolvedStudentId?: string;
};

export const AI_TOOL_REGISTRY: ToolDescriptor[] = [
  {
    name: 'resolve_student_reference',
    label: '解析学生引用',
    contextKey: 'student_lookup',
    effect: 'read',
    privacy: 'local_only',
  },
  {
    name: 'get_student_profile',
    label: '读取学生档案',
    contextKey: 'student_profile',
    effect: 'read',
    privacy: 'local_only',
  },
  {
    name: 'search_learning_records',
    label: '检索学习记录',
    contextKey: 'learning_records',
    effect: 'read',
    privacy: 'local_only',
  },
  {
    name: 'list_attachment_metadata',
    label: '读取附件元数据',
    contextKey: 'attachment_metadata',
    effect: 'read',
    privacy: 'local_only',
  },
  {
    name: 'search_teacher_knowledge',
    label: '检索老师知识库',
    contextKey: 'teacher_knowledge',
    effect: 'read',
    privacy: 'sanitized_cloud',
  },
  {
    name: 'query_knowledge_graph',
    label: '查询知识图谱',
    contextKey: 'knowledge_graph',
    effect: 'read',
    privacy: 'sanitized_cloud',
  },
];

function toolRun(tool: ToolDescriptor, status: AiConsoleToolRun['status'], detail: string, outputSummary?: Record<string, unknown>): AiConsoleToolRun {
  return {
    name: tool.name,
    label: tool.label,
    status,
    detail,
    effect: tool.effect,
    privacy: tool.privacy,
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

function findStudentByPrompt(prompt: string, students: Student[]) {
  const hints = extractNamedStudentHints(prompt);
  const exact = students.find((student) =>
    [student.displayName, student.realName].some((name) => name && hints.includes(name)),
  );
  if (exact) return { student: exact, matchType: 'exact_hint' as const, hints };

  const embedded = students.find((student) =>
    [student.displayName, student.realName].some((name) => name && prompt.includes(name)),
  );
  if (embedded) return { student: embedded, matchType: 'embedded_name' as const, hints };

  return { student: undefined, matchType: 'none' as const, hints };
}

export async function compileAiContext(params: {
  store: OmniEduStore;
  prompt: string;
  studentId?: string;
  router: AiRouterDecision;
}): Promise<CompiledAiContext> {
  const { store, prompt, router } = params;
  const selectedContext = router.contextPolicy.include;
  const sources: AiConsoleSource[] = [];
  const toolRuns: AiConsoleToolRun[] = [];
  let resolvedStudentId = params.studentId;
  let student: Student | undefined;
  let records: LearningRecord[] = [];
  let knowledgeSnippets: ResourceChunk[] = [];
  let graphNodes: KnowledgeNode[] = [];

  for (const tool of AI_TOOL_REGISTRY) {
    if (!selectedContext.includes(tool.contextKey)) continue;

    if (tool.name === 'resolve_student_reference') {
      const students = await store.listStudents('');
      if (resolvedStudentId) {
        const selected = students.find((item) => item.id === resolvedStudentId);
        toolRuns.push(toolRun(tool, selected ? 'used' : 'blocked', selected
          ? `已使用当前选中的学生：${selected.displayName}。`
          : '当前选择的学生不存在。', {
          selectedStudentId: resolvedStudentId,
          found: Boolean(selected),
        }));
        if (selected) {
          addSource(sources, {
            id: 'student_lookup',
            title: '当前选中学生',
            type: 'SQLite students',
            detail: `已绑定 ${selected.displayName}，后续学生工具使用该档案。`,
            count: '已绑定',
          });
        }
        continue;
      }

      const resolved = findStudentByPrompt(prompt, students);
      if (resolved.student) {
        resolvedStudentId = resolved.student.id;
        toolRuns.push(toolRun(tool, 'used', `从任务文本中解析到学生：${resolved.student.displayName}。`, {
          displayName: resolved.student.displayName,
          matchType: resolved.matchType,
          hints: resolved.hints,
        }));
        addSource(sources, {
          id: 'student_lookup',
          title: '学生引用解析',
          type: 'SQLite students',
          detail: `小智已自动把任务绑定到 ${resolved.student.displayName}，不需要手动切换左侧模块。`,
          count: '已解析',
        });
      } else {
        toolRuns.push(toolRun(tool, 'blocked', resolved.hints.length
          ? `检测到学生引用 ${resolved.hints.join('、')}，但本地学生档案未命中。`
          : '任务需要学生数据，但没有当前学生，也没有可解析的学生显示名。', {
          hints: resolved.hints,
          candidatesChecked: students.length,
        }));
        addSource(sources, {
          id: 'student_lookup',
          title: '学生引用未命中',
          type: 'SQLite students',
          detail: resolved.hints.length
            ? `检测到 ${resolved.hints.join('、')}，但本地学生列表无匹配项。`
            : '需要老师选择学生或在任务里写出学生显示名。',
          count: '未命中',
        });
      }
      continue;
    }

    if (tool.name === 'get_student_profile') {
      if (!resolvedStudentId) {
        toolRuns.push(toolRun(tool, 'blocked', '没有可用学生 ID，无法读取学生档案。'));
        addSource(sources, {
          id: 'student_profile',
          title: '未绑定学生',
          type: '学生档案',
          detail: '本轮未读取个人档案。',
          count: '待绑定',
        });
        continue;
      }
      student = (await store.listStudents('')).find((item) => item.id === resolvedStudentId);
      toolRuns.push(toolRun(tool, student ? 'used' : 'blocked', student ? `已读取 ${student.displayName} 的学生档案。` : '学生不存在。', {
        studentId: resolvedStudentId,
        found: Boolean(student),
      }));
      addSource(sources, {
        id: 'student_profile',
        title: student?.displayName ?? '学生不存在',
        type: '学生档案',
        detail: student ? '阶段目标、当前问题、家长关注点和标签已纳入。' : '未读取到学生档案。',
        count: student ? '已读取' : '未命中',
      });
      continue;
    }

    if (tool.name === 'search_learning_records') {
      if (!resolvedStudentId) {
        toolRuns.push(toolRun(tool, 'blocked', '没有可用学生 ID，无法检索学习记录。'));
        continue;
      }
      records = await store.listRecords(resolvedStudentId, { limit: router.contextPolicy.recordLimit });
      toolRuns.push(toolRun(tool, records.length ? 'used' : 'blocked', records.length ? `按 route 读取 ${records.length} 条学习记录。` : '当前学生没有可用学习记录。', {
        count: records.length,
        limit: router.contextPolicy.recordLimit,
      }));
      addSource(sources, {
        id: 'learning_records',
        title: '学习记录',
        type: 'SQLite',
        detail: `按 ${router.route} 路由读取，最多 ${router.contextPolicy.recordLimit} 条。`,
        count: records.length,
      });
      continue;
    }

    if (tool.name === 'list_attachment_metadata') {
      const attachmentCount = records.reduce((count, record) => count + record.attachments.length, 0);
      toolRuns.push(toolRun(tool, 'used', `统计 ${attachmentCount} 个附件；原始文件不上云。`, {
        count: attachmentCount,
        rawFilesUploaded: false,
      }));
      addSource(sources, {
        id: 'attachment_metadata',
        title: '附件元数据',
        type: '本地文件系统',
        detail: '只纳入数量和元数据，不读取或上传原始附件。',
        count: attachmentCount,
      });
      continue;
    }

    if (tool.name === 'search_teacher_knowledge') {
      knowledgeSnippets = await store.searchKnowledge(prompt, router.contextPolicy.knowledgeLimit);
      toolRuns.push(toolRun(tool, knowledgeSnippets.length ? 'used' : 'blocked', knowledgeSnippets.length ? `命中 ${knowledgeSnippets.length} 个老师知识库片段。` : '没有命中可用老师知识库片段。', {
        count: knowledgeSnippets.length,
        limit: router.contextPolicy.knowledgeLimit,
      }));
      addSource(sources, {
        id: 'teacher_knowledge',
        title: '老师知识库',
        type: 'SQLite / 本地切片',
        detail: knowledgeSnippets.length ? '已纳入命中的老师知识库片段。' : '当前没有命中可用知识库文本片段。',
        count: knowledgeSnippets.length,
      });
      continue;
    }

    if (tool.name === 'query_knowledge_graph') {
      const overview = await store.getKnowledgeOverview();
      graphNodes = overview.nodes.slice(0, router.contextPolicy.graphNodeLimit);
      toolRuns.push(toolRun(tool, graphNodes.length ? 'used' : 'blocked', graphNodes.length ? `读取 ${graphNodes.length} 个知识图谱节点摘要。` : '知识图谱暂无节点。', {
        selectedNodes: graphNodes.length,
        totalNodes: overview.counts.nodes,
      }));
      addSource(sources, {
        id: 'knowledge_graph',
        title: '知识图谱',
        type: 'SQLite nodes / edges',
        detail: graphNodes.length ? '已纳入知识图谱节点摘要。' : '当前没有可用图谱节点。',
        count: `${overview.counts.nodes} 节点 / ${overview.counts.edges} 边`,
      });
    }
  }

  return { student, records, knowledgeSnippets, graphNodes, sources, toolRuns, selectedContext, resolvedStudentId };
}
