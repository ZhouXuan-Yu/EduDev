import type { AiContextPolicy, AiIntentRoute, AiRouterDecision, AiRouterSlots, AiSubIntent } from '../../shared/contracts';

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

const SUBJECT_PATTERNS: Array<[string, RegExp]> = [
  ['数学', /数学|方程|函数|几何|分数|应用题|代数|概率|统计|圆|三角/u],
  ['英语', /英语|单词|语法|阅读|听力|完形|写作/u],
  ['语文', /语文|作文|阅读理解|文言文|古诗|现代文/u],
  ['物理', /物理|力学|电路|电学|光学/u],
  ['化学', /化学|方程式|实验|酸碱|物质/u],
  ['生物', /生物|细胞|遗传|生态/u],
  ['历史', /历史|朝代|事件|史料/u],
  ['地理', /地理|地图|气候|经纬/u],
];

const ROUTE_KEYWORDS: Record<AiIntentRoute, RegExp[]> = {
  general_qa: [/^(你?好|您好|hello|hi|嗨|在吗)[\s!！。.?？]*$/i, /你是谁|小智能做什么|介绍一下/, /解释.*(是什么|概念|区别)/],
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
  lesson_design: [/教案|课堂|课时|讲解|导入|板书|教学设计|课程设计|备课|知识讲解|课堂活动/],
  report_draft: [/报告|复盘|家长|沟通摘要|阶段总结|月报|周报|可编辑|docx?|pdf|导出/],
  knowledge_retrieval: [/知识库|资料|讲义|教材|文档|引用|来源|查找|检索|根据.*材料|知识点|知识点图谱|关联|关系|先修/],
  workspace_help: [
    /怎么用|如何操作|API Key|DeepSeek/i,
    /(怎么|如何).*(导入|配置|设置|新建|归档|备份|打开|保存|使用)/,
    /导入.*(资料|知识库|文件|资源)|配置.*(API|Key|DeepSeek)|备份.*数据目录|新建.*文件夹|归档/,
    /普通问答模式|general_qa|学生数据模块|左侧导航|\/student|切换.*模式/,
    /忽略之前规则|上传所有附件原文|直接写入学生档案|自动.*学生数据工具|自动保存.*标签/,
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
    include: ['student_lookup', 'student_profile', 'learning_records', 'teacher_knowledge', 'knowledge_graph', 'question_bank'],
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

function unique(values: string[]) {
  return [...new Set(values.filter(Boolean))];
}

function extractStudentRefs(prompt: string) {
  const refs = prompt.match(/小[A-Za-z0-9_-]{1,12}|小[\u4e00-\u9fa5]{1,3}/g) ?? [];
  return unique(refs.map((ref) => ref.trim()).filter((ref) => ref !== '小智' && ref !== '小智能'));
}

function hasExplicitStudentReference(prompt: string, slots: AiRouterSlots) {
  return slots.studentRefs.length > 0 || /学生|当前学生|这个学生/u.test(prompt);
}

function scoreRoute(prompt: string, route: AiIntentRoute) {
  return ROUTE_KEYWORDS[route].reduce((score, pattern) => score + (pattern.test(prompt) ? 1 : 0), 0);
}

function inferTimeRange(prompt: string): AiRouterSlots['timeRange'] {
  if (/\d{4}[-/年]\d{1,2}[-/月]\d{1,2}|从.+到.+|近\d+\s*(天|周|月)/.test(prompt)) return 'custom';
  if (/最近一周|近一周|本周|这周|一周|周报|周复盘/.test(prompt)) return 'last_week';
  if (/最近一个月|近一个月|本月|这个月|月报|月度|30\s*天/.test(prompt)) return 'last_month';
  if (/本学期|这学期|本期|期中|期末|学期/.test(prompt)) return 'this_term';
  return 'none';
}

function inferSubject(prompt: string) {
  return SUBJECT_PATTERNS.find(([, pattern]) => pattern.test(prompt))?.[0] ?? '';
}

function inferKnowledgePoint(prompt: string) {
  const known = ['一次函数', '二次函数', '勾股定理', '概率统计', '分数应用题', '圆的性质'];
  const hit = known.find((item) => prompt.includes(item));
  if (hit) return hit;
  const match = prompt.match(/(?:关于|围绕|针对|讲解|解释|复习|巩固|查找|检索)([\p{L}\p{N}A-Za-z0-9_+\-（）()·]{2,12})(?:这个)?(?:知识点|内容|专题|题型|讲义|材料)?/u);
  if (match?.[1]) return match[1].replace(/^(这个|一下|一下这个)/, '').trim();
  const direct = prompt.match(/([\p{L}\p{N}A-Za-z0-9_+\-（）()·]{2,24})(?:知识点|题型|专题)/u);
  return direct?.[1]?.trim() ?? '';
}

function extractSlots(prompt: string): AiRouterSlots {
  const studentRefs = extractStudentRefs(prompt);
  return {
    studentRefs,
    hasMultipleStudentRefs: studentRefs.length > 1 || /多个学生|两名学生|几个学生|全班|小组/.test(prompt),
    timeRange: inferTimeRange(prompt),
    subject: inferSubject(prompt),
    knowledgePoint: inferKnowledgePoint(prompt),
    writeIntent: /保存|写入|更新|归档|提交|发布|直接保存|生成.*并保存|落库/.test(prompt),
  };
}

function pickRoute(prompt: string, slots: AiRouterSlots): { route: AiIntentRoute; confidence: number } {
  const trimmed = prompt.trim();
  if (!trimmed) return { route: 'general_qa', confidence: 0.4 };

  if (/忽略之前规则|上传所有附件原文|直接写入学生档案/.test(trimmed)) {
    return { route: 'workspace_help', confidence: 0.9 };
  }
  if (/自动.*学生数据工具|自动保存.*标签|怎么.*(导入|配置|设置|备份|新建|归档|打开|保存|使用)|如何.*(导入|配置|设置|备份|新建|归档|打开|保存|使用)|API|Key|DeepSeek/i.test(trimmed)) {
    return { route: 'workspace_help', confidence: 0.86 };
  }
  if (/(分析当前学生|当前学生|这个学生).*(错因|学习|表现|掌握|薄弱)/.test(trimmed)) {
    return { route: 'student_diagnosis', confidence: 0.86 };
  }
  if (/(板书|导入|总结流程|课时安排).*(流程|练习|总结)|生成.*(板书|导入)/.test(trimmed)) {
    return { route: 'lesson_design', confidence: 0.86 };
  }
  if (/(题目|题组|练习|作业|训练|相似题|变式题|巩固|抽取|周练)/.test(trimmed)) {
    return { route: 'practice_design', confidence: 0.85 };
  }
  if (/(错题|错因|失分|失分原因|错的点|错误原因|订正|纠错)/.test(trimmed)) {
    return { route: 'error_analysis', confidence: 0.84 };
  }
  if (/(教案|课堂|课时|讲解|导入|板书|教学设计|课程设计|备课|课时安排|例题顺序|讲解版|课堂活动|总结流程)/.test(trimmed)) {
    return { route: 'lesson_design', confidence: 0.84 };
  }
  if (/(档案|阶段目标|家长关注点)/.test(trimmed) && slots.studentRefs.length) {
    return { route: 'student_diagnosis', confidence: 0.84 };
  }

  const asksStudentWork = /(学习进度|题目|题组|练习|作业|错题|错因|表现|掌握|薄弱|抽取|记录|档案|复盘|报告|月报|周报)/.test(trimmed);
  if (slots.studentRefs.length && asksStudentWork) {
    if (/(报告|复盘|月报|周报|家长|沟通摘要|总结)/.test(trimmed)) return { route: 'report_draft', confidence: 0.88 };
    if (/(题目|题组|练习|作业|训练|相似题|变式题|巩固|抽取|周练)/.test(trimmed)) return { route: 'practice_design', confidence: 0.87 };
    if (/(错题|错因|失分|订正|错误原因)/.test(trimmed)) return { route: 'error_analysis', confidence: 0.85 };
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
  if (/给学生|学生版|讲给孩子|课堂讲义|练习|作业/.test(prompt)) return 'student_material' as const;
  return 'teacher' as const;
}

function inferActionLevel(route: AiIntentRoute, slots: AiRouterSlots) {
  if (slots.writeIntent) return 'write' as const;
  if (route === 'report_draft' || route === 'practice_design' || route === 'lesson_design') return 'draft' as const;
  return 'answer' as const;
}

function routeNeedsStudent(route: AiIntentRoute) {
  return route === 'student_diagnosis' || route === 'error_analysis' || route === 'practice_design' || route === 'report_draft';
}

function inferSubIntent(route: AiIntentRoute, prompt: string, slots: AiRouterSlots, risk: AiRouterDecision['riskLevel']): AiSubIntent {
  if (/忽略之前规则|上传所有附件原文|直接写入学生档案|手机号|身份证|自动保存.*标签/.test(prompt)) return 'safety_boundary';
  if (risk === 'safeguarding') return 'risk_support';
  switch (route) {
    case 'general_qa':
      if (/^(你?好|您好|hello|hi|嗨|在吗)/i.test(prompt)) return 'casual_greeting';
      if (/你是谁|小智能做什么|介绍一下|能不能自动读取学生数据/.test(prompt)) return 'capability_intro';
      return 'concept_explanation';
    case 'student_diagnosis':
      if (/画像|档案|阶段目标|标签|永久/.test(prompt)) return 'student_profile_review';
      if (/薄弱|弱点|短板|掌握情况|掌握/.test(prompt)) return 'student_weakness';
      return 'student_progress';
    case 'error_analysis':
      if (/高频|模式|归纳|汇总|找出|集中|排序|都容易错/.test(prompt)) return 'error_pattern_summary';
      if (/订正|讲解思路|改正|纠错/.test(prompt)) return 'correction_guidance';
      return 'mistake_reasoning';
    case 'practice_design':
      if (/三元题组|原题|变式/.test(prompt)) return 'triplet_practice';
      if (/相似题|同类题|类似题/.test(prompt)) return 'similar_questions';
      return 'homework_plan';
    case 'lesson_design':
      if (/活动|互动|检查点|课堂练习/.test(prompt)) return 'classroom_activity';
      if (/顺序|流程|课时安排|板书|导入|讲解版/.test(prompt)) return 'teaching_sequence';
      return 'lesson_plan';
    case 'report_draft':
      if (/月报|月度/.test(prompt) || slots.timeRange === 'last_month') return 'monthly_report';
      if (/周报|每周|周复盘/.test(prompt) || slots.timeRange === 'last_week') return 'weekly_report';
      if (/Word|PDF|docx?|导出|可编辑/i.test(prompt)) return 'export_document';
      return 'parent_summary';
    case 'knowledge_retrieval':
      if (/图谱|关联|关系|先修|前置知识/.test(prompt)) return 'knowledge_graph_lookup';
      if (/引用|来源|出处/.test(prompt)) return 'source_citation';
      return 'resource_search';
    case 'workspace_help':
      if (/API|Key|DeepSeek|配置|设置/i.test(prompt)) return 'settings_help';
      if (/导入|备份|数据目录|归档|文件夹|打开|保存/.test(prompt)) return 'data_management_help';
      return 'usage_help';
    default:
      return 'concept_explanation';
  }
}

function allowedToolsFor(policy: AiContextPolicy) {
  const tools: string[] = [];
  if (policy.include.includes('student_lookup')) tools.push('resolve_student_reference');
  if (policy.include.includes('student_profile')) tools.push('get_student_profile');
  if (policy.include.includes('learning_records')) tools.push('search_learning_records');
  if (policy.include.includes('attachment_metadata')) tools.push('list_attachment_metadata');
  if (policy.include.includes('teacher_knowledge')) tools.push('search_teacher_knowledge');
  if (policy.include.includes('knowledge_graph')) tools.push('query_knowledge_graph');
  if (policy.include.includes('question_bank')) tools.push('search_similar_questions');
  return tools;
}

function buildClarificationQuestion(params: {
  needsStudent: boolean;
  hasStudent: boolean;
  slots: AiRouterSlots;
  prompt: string;
}) {
  if (params.slots.hasMultipleStudentRefs && params.needsStudent) {
    return '请确认本轮要以哪一个学生作为主对象；如果是对比任务，请说明是否允许分别读取两名学生的本地记录。';
  }
  const canResolveNamedStudent = !params.hasStudent && params.slots.studentRefs.length === 1;
  if (params.needsStudent && !params.hasStudent && !canResolveNamedStudent) {
    return '请先选择一个学生，或在任务里明确学生显示名，例如“小A”。';
  }
  if (/帮我看看这个情况|给我一个计划|这个怎么办/.test(params.prompt) && params.prompt.length < 12) {
    return '请补充任务对象：是学生诊断、错题分析、练习设计，还是知识库检索？';
  }
  return undefined;
}

export function routeAiPrompt(prompt: string, options: { hasStudent: boolean }): AiRouterDecision {
  const slots = extractSlots(prompt);
  const picked = pickRoute(prompt, slots);
  const contextPolicy = ROUTE_POLICIES[picked.route];
  const riskLevel = inferRisk(prompt);
  const needsStudent = routeNeedsStudent(picked.route);
  const subIntent = inferSubIntent(picked.route, prompt, slots, riskLevel);
  const clarificationQuestion = buildClarificationQuestion({
    needsStudent,
    hasStudent: options.hasStudent,
    slots,
    prompt: prompt.trim(),
  });

  return {
    route: picked.route,
    subIntent,
    confidence: clarificationQuestion ? Math.min(picked.confidence, 0.58) : picked.confidence,
    audience: inferAudience(prompt),
    actionLevel: inferActionLevel(picked.route, slots),
    riskLevel,
    slots,
    needsStudent: needsStudent || hasExplicitStudentReference(prompt, slots),
    clarificationQuestion,
    allowedTools: allowedToolsFor(contextPolicy),
    contextPolicy,
  };
}
