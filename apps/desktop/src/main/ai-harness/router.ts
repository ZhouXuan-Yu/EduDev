import type { AiContextPolicy, AiIntentRoute, AiRouterDecision } from '../../shared/contracts';

const ROUTE_ORDER: AiIntentRoute[] = [
  'report_draft',
  'practice_design',
  'error_analysis',
  'student_diagnosis',
  'lesson_design',
  'knowledge_retrieval',
  'workspace_help',
  'general_qa',
];

const ROUTE_KEYWORDS: Record<AiIntentRoute, RegExp[]> = {
  general_qa: [/^(你?好|您好|hello|hi|嗨|在吗)[\s!！。.?？]*$/i, /你是谁|小智能做什么|介绍一下/],
  student_diagnosis: [
    /分析.*学生|当前学生|这个学生|最近.*表现|薄弱点|错因|学习问题|掌握情况|诊断|画像|阶段目标|学习进度/,
    /学生.*(最近|稳定|表现|薄弱|掌握|永久|标记|手机号|身份证|ADHD|自残|自杀|伤害)/i,
    /小[\p{L}\p{N}_-]{1,12}.*(学习|进度|表现|掌握|薄弱|错因|记录|档案)/u,
  ],
  error_analysis: [
    /错题|错在哪里|错误原因|为什么错|失分点|易错点|订正|解题思路|这道题/,
    /小[\p{L}\p{N}_-]{1,12}.*(错题|错因|失分|订正)/u,
  ],
  practice_design: [
    /练习|作业|题组|三元题组|相似题|变式题|巩固|训练|出题|周练/,
    /小[\p{L}\p{N}_-]{1,12}.*(题目|题组|练习|作业|训练|相似题|变式题|巩固|抽取)/u,
  ],
  lesson_design: [/教案|课堂|课时|讲解|导入|板书|教学设计|课程设计|备课|知识讲解/],
  report_draft: [/报告|复盘|家长|沟通摘要|阶段总结|月报|周报|可编辑|docx?|pdf|导出/],
  knowledge_retrieval: [/知识库|资料|讲义|教材|文档|引用|来源|查找|检索|根据.*材料|知识点|知识点图谱|关联|关系/],
  workspace_help: [
    /怎么用|如何操作|API Key|DeepSeek/i,
    /(怎么|如何).*(导入|配置|设置|新建|归档|备份|打开|保存|使用)/,
    /导入.*(资料|知识库|文件|资源)|配置.*(API|Key|DeepSeek)|备份.*数据目录|新建.*文件夹|归档/,
    /普通问答模式|general_qa|学生数据模块|左侧导航|\/student|切换.*模式/,
    /忽略之前规则|上传所有附件原文|直接写入学生档案/,
  ],
};

const ROUTE_POLICIES: Record<AiIntentRoute, AiContextPolicy> = {
  general_qa: {
    include: [],
    recordLimit: 0,
    knowledgeLimit: 0,
    graphNodeLimit: 0,
    reason: '普通问答不默认读取学生数据或知识库。',
  },
  student_diagnosis: {
    include: ['student_lookup', 'student_profile', 'learning_records', 'attachment_metadata', 'teacher_knowledge'],
    recordLimit: 12,
    knowledgeLimit: 4,
    graphNodeLimit: 0,
    reason: '学生诊断需要先解析学生引用，再读取档案、近期记录和少量老师资料作为证据。',
  },
  error_analysis: {
    include: ['student_lookup', 'student_profile', 'learning_records', 'attachment_metadata', 'teacher_knowledge'],
    recordLimit: 8,
    knowledgeLimit: 5,
    graphNodeLimit: 0,
    reason: '错因分析需要学生档案、错题/学习记录证据和相关知识片段。',
  },
  practice_design: {
    include: ['student_lookup', 'student_profile', 'learning_records', 'teacher_knowledge', 'knowledge_graph'],
    recordLimit: 8,
    knowledgeLimit: 6,
    graphNodeLimit: 8,
    reason: '练习设计需要结合学生薄弱点、老师资料和可追溯知识关系生成三元题组。',
  },
  lesson_design: {
    include: ['teacher_knowledge', 'knowledge_graph'],
    recordLimit: 0,
    knowledgeLimit: 8,
    graphNodeLimit: 8,
    reason: '备课任务优先使用老师资料和知识结构，不默认读取学生隐私。',
  },
  report_draft: {
    include: ['student_lookup', 'student_profile', 'learning_records', 'attachment_metadata', 'teacher_knowledge'],
    recordLimit: 20,
    knowledgeLimit: 4,
    graphNodeLimit: 0,
    reason: '报告草稿需要足够学习记录证据，但仍不读取或上传原始附件。',
  },
  knowledge_retrieval: {
    include: ['teacher_knowledge', 'knowledge_graph'],
    recordLimit: 0,
    knowledgeLimit: 8,
    graphNodeLimit: 12,
    reason: '知识检索只读取老师知识库和知识图谱摘要。',
  },
  workspace_help: {
    include: [],
    recordLimit: 0,
    knowledgeLimit: 0,
    graphNodeLimit: 0,
    reason: '工作台帮助不需要读取学生或知识库内容。',
  },
};

function hasExplicitStudentReference(prompt: string) {
  return /小[\p{L}\p{N}_-]{1,12}|学生|当前学生|这个学生/u.test(prompt);
}

function hasNamedStudentReference(prompt: string) {
  return /小[\p{L}\p{N}_-]{1,12}/u.test(prompt);
}

function scoreRoute(prompt: string, route: AiIntentRoute) {
  return ROUTE_KEYWORDS[route].reduce((score, pattern) => score + (pattern.test(prompt) ? 1 : 0), 0);
}

function pickRoute(prompt: string): { route: AiIntentRoute; confidence: number } {
  const trimmed = prompt.trim();
  if (!trimmed) return { route: 'general_qa', confidence: 0.4 };

  const namedStudent = hasNamedStudentReference(trimmed);
  const asksStudentWork = /(学习进度|题目|题组|练习|作业|错题|错因|表现|掌握|薄弱|抽取|记录|档案)/.test(trimmed);
  if (namedStudent && asksStudentWork) {
    if (/(题目|题组|练习|作业|训练|相似题|变式题|巩固|抽取)/.test(trimmed)) {
      return { route: 'practice_design', confidence: 0.86 };
    }
    if (/(错题|错因|失分|订正)/.test(trimmed)) {
      return { route: 'error_analysis', confidence: 0.84 };
    }
    return { route: 'student_diagnosis', confidence: 0.84 };
  }

  const scored = ROUTE_ORDER.map((route) => ({ route, score: scoreRoute(trimmed, route) }))
    .sort((a, b) => b.score - a.score || ROUTE_ORDER.indexOf(a.route) - ROUTE_ORDER.indexOf(b.route));
  const best = scored[0] ?? { route: 'general_qa' as const, score: 0 };
  if (best.score <= 0) return { route: 'general_qa', confidence: 0.55 };
  return { route: best.route, confidence: Math.min(0.95, 0.62 + best.score * 0.11) };
}

function inferRisk(prompt: string) {
  if (/自杀|自残|伤害自己|虐待|暴力|性侵|违法|危险/i.test(prompt)) return 'safeguarding' as const;
  if (/诊断|标签|智力|抑郁|多动|ADHD|隐私|身份证|电话|手机号|永久/i.test(prompt)) return 'sensitive' as const;
  return 'normal' as const;
}

function inferAudience(prompt: string) {
  if (/家长|沟通摘要|亲子/.test(prompt)) return 'parent_material' as const;
  if (/给学生|学生版|讲给孩子|课堂讲义|练习/.test(prompt)) return 'student_material' as const;
  return 'teacher' as const;
}

function inferActionLevel(route: AiIntentRoute, prompt: string) {
  if (/保存|写入|更新|归档|提交|发布/.test(prompt)) return 'write' as const;
  if (route === 'report_draft' || route === 'practice_design' || route === 'lesson_design') return 'draft' as const;
  return 'answer' as const;
}

function routeNeedsStudent(route: AiIntentRoute) {
  return route === 'student_diagnosis' || route === 'error_analysis' || route === 'practice_design' || route === 'report_draft';
}

function allowedToolsFor(policy: AiContextPolicy) {
  const tools: string[] = [];
  if (policy.include.includes('student_lookup')) tools.push('resolve_student_reference');
  if (policy.include.includes('student_profile')) tools.push('get_student_profile');
  if (policy.include.includes('learning_records')) tools.push('search_learning_records');
  if (policy.include.includes('attachment_metadata')) tools.push('list_attachment_metadata');
  if (policy.include.includes('teacher_knowledge')) tools.push('search_teacher_knowledge');
  if (policy.include.includes('knowledge_graph')) tools.push('query_knowledge_graph');
  return tools;
}

export function routeAiPrompt(prompt: string, options: { hasStudent: boolean }): AiRouterDecision {
  const picked = pickRoute(prompt);
  const contextPolicy = ROUTE_POLICIES[picked.route];
  const needsStudent = routeNeedsStudent(picked.route);
  const canResolveNamedStudent = !options.hasStudent && hasNamedStudentReference(prompt);
  const clarificationQuestion = needsStudent && !options.hasStudent && !canResolveNamedStudent
    ? '请先选择一个学生，或在任务里明确学生显示名，例如“小A”。'
    : undefined;

  return {
    route: picked.route,
    confidence: picked.confidence,
    audience: inferAudience(prompt),
    actionLevel: inferActionLevel(picked.route, prompt),
    riskLevel: inferRisk(prompt),
    needsStudent: needsStudent || hasExplicitStudentReference(prompt),
    clarificationQuestion,
    allowedTools: allowedToolsFor(contextPolicy),
    contextPolicy,
  };
}
