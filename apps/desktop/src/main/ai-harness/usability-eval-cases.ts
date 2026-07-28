import type {
  AiActionLevel,
  AiAudience,
  AiIntentRoute,
  AiRouterDecision,
  AiStructuredReply,
  AiSubIntent,
} from '../../shared/contracts';
import { gradeUsabilityReply, structuredReplyToTeacherMarkdown } from './usability-policy';

type UsabilityEvalCaseSpec = {
  id: string;
  prompt: string;
  route: AiIntentRoute;
  subIntent: AiSubIntent;
  actionLevel?: AiActionLevel;
  audience?: AiAudience;
  answerMarkdown?: string;
  facts?: AiStructuredReply['facts'];
  evidence?: AiStructuredReply['evidence'];
  inferences?: string[];
  unknowns?: string[];
  risks?: AiStructuredReply['risks'];
  teacherConfirmations?: string[];
  nextActions?: string[];
  artifacts?: AiStructuredReply['artifacts'];
  processSummary?: string[];
  expectedPassed: boolean;
  expectedIssueCodes?: string[];
  expectedMarkdownIncludes?: string[];
  expectedMarkdownExcludes?: string[];
  targetTeacherScore: 1 | 2 | 3 | 4 | 5;
};

export type AiUsabilityEvalCaseResult = {
  id: string;
  route: AiIntentRoute;
  profile: string;
  passed: boolean;
  expectedPassed: boolean;
  score: number;
  targetTeacherScore: number;
  issueCodes: string[];
  casePassed: boolean;
  failures: string[];
};

export type AiUsabilityEvalSuiteReport = {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  averageScore: number;
  averageTargetTeacherScore: number;
  routeCounts: Record<string, number>;
  issueCounts: Record<string, number>;
  results: AiUsabilityEvalCaseResult[];
};

function routerFor(spec: UsabilityEvalCaseSpec): AiRouterDecision {
  return {
    route: spec.route,
    subIntent: spec.subIntent,
    confidence: 0.92,
    audience: spec.audience ?? 'teacher',
    actionLevel: spec.actionLevel ?? 'answer',
    riskLevel: spec.risks?.some((risk) => risk.level === 'safeguarding') ? 'safeguarding' : 'normal',
    slots: {
      studentRefs: spec.route === 'general_qa' || spec.route === 'workspace_help' || spec.route === 'knowledge_retrieval' ? [] : ['小A'],
      hasMultipleStudentRefs: false,
      timeRange: 'last_week',
      subject: '数学',
      knowledgePoint: '一元一次方程',
      writeIntent: spec.actionLevel === 'write',
    },
    needsStudent: spec.route === 'student_diagnosis'
      || spec.route === 'error_analysis'
      || spec.route === 'practice_design'
      || spec.route === 'report_draft',
    allowedTools: [],
    contextPolicy: {
      include: [],
      recordLimit: 0,
      knowledgeLimit: 0,
      graphNodeLimit: 0,
      reason: 'usability eval sample',
    },
  };
}

function replyFor(spec: UsabilityEvalCaseSpec, router: AiRouterDecision): AiStructuredReply {
  return {
    schemaVersion: 'xiazhi.reply.v2',
    route: router.route,
    subIntent: router.subIntent,
    answerMarkdown: spec.answerMarkdown ?? '小A最近一周的方程错题集中在移项后的符号变化。我建议今天先做短练，再用一道变式题确认是否能迁移。',
    facts: spec.facts ?? [
      { statement: '近 7 天学习记录中，方程移项相关错题出现 3 次', sourceId: 'learning_records', confidence: 'high' },
      { statement: '最近一次订正能写出等量关系，但漏写符号变化', sourceId: 'mistake_20260728', confidence: 'medium' },
    ],
    evidence: spec.evidence ?? [
      { sourceId: 'learning_records', note: '本地学习记录摘要' },
    ],
    inferences: spec.inferences ?? ['主要障碍更像步骤稳定性问题，而不是概念完全缺失。'],
    unknowns: spec.unknowns ?? ['还没有看到今天课堂即时反馈。'],
    risks: spec.risks ?? [{ level: 'normal', category: 'none', mitigation: '不形成永久学生标签。' }],
    teacherConfirmations: spec.teacherConfirmations ?? [],
    nextActions: spec.nextActions ?? [
      '先让小A完成 6 道移项同型题，记录每题是否漏写符号变化。',
      '如果前 4 题正确率低于 75%，先回到等式两边同加同减的口头解释。',
    ],
    artifacts: spec.artifacts ?? [],
    routeCheck: { kind: router.route, passed: true, notes: ['route/subIntent 已匹配'] },
    processSummary: spec.processSummary ?? ['已完成路由和最小上下文装配。'],
  };
}

const briefAnswer = '可以。小智会先判断任务类型，再只读取必要的本地上下文；涉及保存报告或题组时，会先进确认队列。';
const workspaceAnswer = '你可以直接输入“查小A最近7天错题并给今天练习”。小智会自己解析学生、时间和任务，不需要你先切换左侧模块。';
const knowledgeAnswer = '当前命中 2 条老师资料，均来自本地知识库；它们能支持课堂导入，但不能直接证明某个学生的掌握情况。';

const CASES: UsabilityEvalCaseSpec[] = [
  {
    id: 'general_capability_brief',
    prompt: '小智能做什么？',
    route: 'general_qa',
    subIntent: 'capability_intro',
    answerMarkdown: briefAnswer,
    facts: [],
    evidence: [],
    inferences: [],
    unknowns: [],
    nextActions: ['直接说学生、时间和目标，例如“查小A最近7天错题”。'],
    expectedPassed: true,
    expectedMarkdownExcludes: ['## 依据', '## 教学判断'],
    targetTeacherScore: 5,
  },
  {
    id: 'general_concept_short',
    prompt: '三元题组是什么意思？',
    route: 'general_qa',
    subIntent: 'concept_explanation',
    answerMarkdown: '三元题组就是围绕同一个薄弱点，给老师一组“原题、相似题、变式题”。它的目标不是多刷，而是确认学生能不能从同型迁移到变化情境。',
    facts: [],
    evidence: [],
    inferences: [],
    unknowns: [],
    nextActions: [],
    expectedPassed: true,
    targetTeacherScore: 5,
  },
  {
    id: 'workspace_direct_steps',
    prompt: '怎么查小A学生数据？',
    route: 'workspace_help',
    subIntent: 'usage_help',
    answerMarkdown: workspaceAnswer,
    facts: [],
    evidence: [],
    inferences: [],
    unknowns: [],
    nextActions: ['在 AI 输入框直接写“小A + 时间 + 目标”。', '如果有同名学生，小智会先让你选择。'],
    expectedPassed: true,
    targetTeacherScore: 5,
  },
  {
    id: 'workspace_settings_brief',
    prompt: 'DeepSeek Key 在哪配置？',
    route: 'workspace_help',
    subIntent: 'settings_help',
    answerMarkdown: '到设置页填写 DeepSeek API Key；Key 只应保存在本地配置或环境变量里，不要写进代码。',
    facts: [],
    evidence: [],
    inferences: [],
    unknowns: [],
    nextActions: ['打开左侧“设置”。', '填写 Key 后先做一次简单问答 smoke。'],
    expectedPassed: true,
    targetTeacherScore: 5,
  },
  {
    id: 'student_progress_evidence',
    prompt: '查小A最近7天学习进度。',
    route: 'student_diagnosis',
    subIntent: 'student_progress',
    expectedPassed: true,
    expectedMarkdownIncludes: ['## 依据', '## 教学判断', '## 下一步'],
    expectedMarkdownExcludes: ['## 事实', '## 推断'],
    targetTeacherScore: 5,
  },
  {
    id: 'student_profile_gap',
    prompt: '看看小A档案还缺哪些信息。',
    route: 'student_diagnosis',
    subIntent: 'student_profile_review',
    answerMarkdown: '小A档案目前够做短期练习建议，但还不够支撑长期阶段判断；最缺的是近期课堂反馈和错题订正后的二次表现。',
    facts: [{ statement: '档案中已有年级、学科和最近学习记录摘要', sourceId: 'student_profile', confidence: 'high' }],
    inferences: ['可以先做短期教学动作，暂不形成长期标签。'],
    unknowns: ['缺少课堂即时反馈。', '缺少订正后二次测记录。'],
    nextActions: ['补一条今天课堂反馈。', '补一条订正后二次测记录。'],
    expectedPassed: true,
    targetTeacherScore: 5,
  },
  {
    id: 'error_reasoning_actionable',
    prompt: '分析小A这道方程错题错在哪里。',
    route: 'error_analysis',
    subIntent: 'mistake_reasoning',
    answerMarkdown: '这道题先不要归因为粗心。更可验证的错因是：移项后符号变化没有稳定执行，导致后续计算全线偏移。',
    facts: [{ statement: '错题步骤中移项后符号没有改变', sourceId: 'mistake_image_1', confidence: 'high' }],
    evidence: [{ sourceId: 'mistake_image_1', note: '老师修正后的错题解析文本' }],
    inferences: ['优先检查等式变形步骤，而不是直接加计算量。'],
    unknowns: ['还不知道学生口头解释等式变形时是否能说清。'],
    nextActions: ['让小A口头解释“为什么移项要变号”。', '做 3 道只考移项的短题。'],
    expectedPassed: true,
    targetTeacherScore: 5,
  },
  {
    id: 'error_correction_guidance',
    prompt: '给小A一个订正指导。',
    route: 'error_analysis',
    subIntent: 'correction_guidance',
    answerMarkdown: '订正时先遮住答案，只让小A重写“等式两边做了什么”。如果能说出同加同减，再进入计算。',
    facts: [{ statement: '最近错题集中在等式变形步骤', sourceId: 'learning_records', confidence: 'medium' }],
    inferences: ['先重建步骤语言，再补计算更稳。'],
    nextActions: ['让小A补写每一步的操作说明。', '老师只检查操作说明，不先看最终答案。'],
    expectedPassed: true,
    targetTeacherScore: 5,
  },
  {
    id: 'practice_triplet_artifact',
    prompt: '根据小A学习进度生成三元题组草稿。',
    route: 'practice_design',
    subIntent: 'triplet_practice',
    answerMarkdown: '我先按“移项符号变化”做一组三元题组草稿：原题用于复现，相似题用于稳定步骤，变式题用于检查迁移。',
    artifacts: [{ id: 'exercise_1', title: '移项符号变化三元题组', type: 'exercise_set', fileName: 'exercise.md', description: '待老师确认', requiresTeacherConfirmation: true }],
    teacherConfirmations: ['确认后才保存到本地题组库。'],
    expectedPassed: true,
    expectedMarkdownIncludes: ['## 产物', '三元题组草稿'],
    targetTeacherScore: 5,
  },
  {
    id: 'practice_similar_questions',
    prompt: '给小A找今天能用的3个练习。',
    route: 'practice_design',
    subIntent: 'similar_questions',
    answerMarkdown: '今天先用 3 道短练，不拉长战线：2 道同型题看稳定性，1 道变式题看迁移。',
    nextActions: ['先做 2 道同型题。', '若都正确，再做 1 道变式题。', '记录是否还漏写变号。'],
    expectedPassed: true,
    targetTeacherScore: 5,
  },
  {
    id: 'lesson_design_brief',
    prompt: '把当前知识点做成15分钟课堂导入。',
    route: 'lesson_design',
    subIntent: 'teaching_sequence',
    answerMarkdown: '15 分钟导入可以分三段：3 分钟复现等式两边同加同减，7 分钟做移项对比，5 分钟用一道变式题检查迁移。',
    facts: [{ statement: '当前知识点是一元一次方程移项', sourceId: 'teacher_context', confidence: 'medium' }],
    inferences: [],
    nextActions: ['准备 1 道同型题和 1 道变式题。', '板书只保留等式两边操作，不先讲口诀。'],
    expectedPassed: true,
    targetTeacherScore: 5,
  },
  {
    id: 'lesson_activity_checkpoints',
    prompt: '设计两个课堂检查点。',
    route: 'lesson_design',
    subIntent: 'classroom_activity',
    answerMarkdown: '检查点 1 看学生能否说出等式两边做了什么；检查点 2 看学生遇到负号移项时是否仍能保持符号变化。',
    facts: [],
    evidence: [],
    inferences: [],
    unknowns: ['还不知道班级整体基础差异。'],
    nextActions: ['检查点 1 用口头解释。', '检查点 2 用一道负号变式题。'],
    expectedPassed: true,
    targetTeacherScore: 5,
  },
  {
    id: 'report_parent_summary',
    prompt: '把小A本周记录整理成家长沟通草稿。',
    route: 'report_draft',
    subIntent: 'weekly_report',
    actionLevel: 'write',
    audience: 'parent_material',
    answerMarkdown: '本周小A在方程移项上已有进步，但符号变化还不稳定。建议家长在家只陪做 10 分钟短练，不额外加大量题。',
    teacherConfirmations: ['请老师确认措辞和事实后，再保存为本地复盘报告。'],
    artifacts: [{ id: 'report_1', title: '小A本周家长沟通草稿', type: 'report_draft', fileName: 'report.md', description: '待老师确认', requiresTeacherConfirmation: true }],
    expectedPassed: true,
    expectedMarkdownIncludes: ['## 需要老师确认', '报告草稿'],
    targetTeacherScore: 5,
  },
  {
    id: 'report_monthly_editable',
    prompt: '给小A生成月报草稿并保存前让我确认。',
    route: 'report_draft',
    subIntent: 'monthly_report',
    actionLevel: 'write',
    answerMarkdown: '月报草稿先聚焦两个事实：方程移项错误减少，但变式题迁移仍不稳定。正文可由老师继续编辑。',
    teacherConfirmations: ['确认后才创建本地复盘报告。'],
    artifacts: [{ id: 'report_2', title: '小A月报草稿', type: 'report_draft', fileName: 'monthly.md', description: '待老师确认', requiresTeacherConfirmation: true }],
    expectedPassed: true,
    targetTeacherScore: 5,
  },
  {
    id: 'knowledge_source_brief',
    prompt: '根据知识库找一段方程导入材料。',
    route: 'knowledge_retrieval',
    subIntent: 'resource_search',
    answerMarkdown: knowledgeAnswer,
    facts: [{ statement: '本地知识库命中 2 条方程导入资料', sourceId: 'teacher_knowledge', confidence: 'high' }],
    evidence: [{ sourceId: 'resource_1', note: '一元一次方程导入片段' }],
    inferences: [],
    unknowns: [],
    nextActions: ['先用命中资料做课堂导入。'],
    expectedPassed: true,
    targetTeacherScore: 5,
  },
  {
    id: 'knowledge_no_hit_honest',
    prompt: '查知识库有没有小A的学习进度。',
    route: 'knowledge_retrieval',
    subIntent: 'resource_search',
    answerMarkdown: '知识库没有命中“小A学习进度”。我只检查了老师资料和知识图谱；学生进度应走本地学生记录，而不是把知识库节点当学生证据。',
    facts: [],
    evidence: [],
    inferences: [],
    unknowns: ['知识库不是学生档案来源。'],
    nextActions: ['改查小A最近 7 天学习记录。'],
    expectedPassed: true,
    targetTeacherScore: 5,
  },
  {
    id: 'bad_manual_module_switch',
    prompt: '查小A学习进度。',
    route: 'workspace_help',
    subIntent: 'usage_help',
    answerMarkdown: '当前为普通问答模式（general_qa），无法自动切换到学生数据查询模式。请手动选择左侧导航栏中的「学生数据」模块。',
    facts: [],
    evidence: [],
    inferences: [],
    unknowns: [],
    nextActions: ['请手动切换学生数据。'],
    processSummary: ['当前路由不支持自动切换。'],
    expectedPassed: false,
    expectedIssueCodes: ['manual_module_switch_fallback'],
    targetTeacherScore: 1,
  },
  {
    id: 'bad_general_too_long',
    prompt: '小智能做什么？',
    route: 'general_qa',
    subIntent: 'capability_intro',
    answerMarkdown: Array.from({ length: 36 }, () => '这是一段普通问答里不应该反复出现的解释，会让老师读完以后仍然不知道下一步要做什么。').join(''),
    facts: [],
    evidence: [],
    inferences: [],
    unknowns: [],
    nextActions: ['可以进一步分析。', '继续观察。', '建议上传资料。'],
    expectedPassed: false,
    expectedIssueCodes: ['answer_too_long_for_route', 'too_many_next_actions'],
    targetTeacherScore: 1,
  },
  {
    id: 'bad_report_write_no_confirmation',
    prompt: '生成小A周报并保存。',
    route: 'report_draft',
    subIntent: 'weekly_report',
    actionLevel: 'write',
    answerMarkdown: '已生成并保存小A周报。',
    teacherConfirmations: [],
    artifacts: [{ id: 'report_bad', title: '小A周报', type: 'report_draft', fileName: 'report.md', description: '已保存', requiresTeacherConfirmation: true }],
    expectedPassed: false,
    expectedIssueCodes: ['write_action_without_low_friction_confirmation'],
    targetTeacherScore: 1,
  },
  {
    id: 'bad_template_pipeline',
    prompt: '查小A错题。',
    route: 'student_diagnosis',
    subIntent: 'student_progress',
    answerMarkdown: '任务识别：Router dry-run 判定为 knowledge_retrieval。上下文装配：读取 teacher_knowledge。结构校验：DeepSeek 返回已通过。',
    processSummary: ['任务识别 -> 上下文装配 -> 结构校验。'],
    nextActions: ['请老师确认是否继续。', '继续观察。', '建议上传资料。', '可以进一步分析。'],
    expectedPassed: false,
    expectedIssueCodes: ['template_pipeline_bloat', 'too_many_next_actions', 'missing_actionable_next_step'],
    targetTeacherScore: 1,
  },
  {
    id: 'bad_practice_overloaded',
    prompt: '给小A设计练习。',
    route: 'practice_design',
    subIntent: 'homework_plan',
    answerMarkdown: Array.from({ length: 70 }, () => '练习设计需要充分考虑学生情况、课堂情况、知识情况和长期发展情况。').join(''),
    nextActions: ['做题。', '订正。', '复盘。', '再做题。', '继续观察。'],
    expectedPassed: false,
    expectedIssueCodes: ['answer_too_long_for_route', 'too_many_next_actions'],
    targetTeacherScore: 2,
  },
  {
    id: 'bad_student_generic_actions',
    prompt: '分析小A薄弱点。',
    route: 'student_diagnosis',
    subIntent: 'student_weakness',
    answerMarkdown: '小A可能需要继续观察。',
    nextActions: ['继续观察。'],
    expectedPassed: true,
    expectedIssueCodes: ['missing_actionable_next_step'],
    targetTeacherScore: 3,
  },
  {
    id: 'bad_risk_noise',
    prompt: '分析小A表现。',
    route: 'student_diagnosis',
    subIntent: 'student_progress',
    risks: [
      { level: 'normal', category: 'none', mitigation: '正常。' },
      { level: 'normal', category: 'none', mitigation: '正常。' },
      { level: 'normal', category: 'none', mitigation: '正常。' },
      { level: 'sensitive', category: 'evidence_gap', mitigation: '缺少近期课堂反馈。' },
    ],
    expectedPassed: true,
    expectedIssueCodes: ['risk_section_noise'],
    targetTeacherScore: 3,
  },
  {
    id: 'bad_source_brief_bloat',
    prompt: '知识库没有命中怎么办？',
    route: 'knowledge_retrieval',
    subIntent: 'resource_search',
    answerMarkdown: '根据当前可用的知识库和知识图谱，未找到与小A相关的学习进度资料或题目。建议上传资料。',
    facts: [],
    evidence: [],
    inferences: [],
    unknowns: ['没有命中相关资料。'],
    nextActions: ['建议上传资料。', '继续观察。', '可以进一步分析。'],
    expectedPassed: false,
    expectedIssueCodes: ['template_pipeline_bloat', 'too_many_next_actions'],
    targetTeacherScore: 2,
  },
  {
    id: 'bad_heading_report',
    prompt: '生成一份很完整的报告。',
    route: 'report_draft',
    subIntent: 'monthly_report',
    actionLevel: 'write',
    answerMarkdown: '## 一\n内容\n## 二\n内容\n## 三\n内容\n## 四\n内容\n## 五\n内容\n## 六\n内容',
    teacherConfirmations: ['确认后保存。'],
    nextActions: ['确认草稿。'],
    expectedPassed: true,
    expectedIssueCodes: ['too_many_headings'],
    targetTeacherScore: 3,
  },
];

function increment(target: Record<string, number>, key: string) {
  target[key] = (target[key] ?? 0) + 1;
}

export function runAiUsabilityEvalSuite(): AiUsabilityEvalSuiteReport {
  const results = CASES.map((spec) => {
    const router = routerFor(spec);
    const reply = replyFor(spec, router);
    const grade = gradeUsabilityReply({ reply, router });
    const markdown = structuredReplyToTeacherMarkdown(reply);
    const issueCodes = grade.issues.map((item) => item.code);
    const failures: string[] = [];

    if (grade.passed !== spec.expectedPassed) {
      failures.push(`expected passed=${spec.expectedPassed}, got ${grade.passed}`);
    }
    for (const code of spec.expectedIssueCodes ?? []) {
      if (!issueCodes.includes(code)) failures.push(`missing issue ${code}`);
    }
    for (const text of spec.expectedMarkdownIncludes ?? []) {
      if (!markdown.includes(text)) failures.push(`markdown missing ${text}`);
    }
    for (const text of spec.expectedMarkdownExcludes ?? []) {
      if (markdown.includes(text)) failures.push(`markdown should not include ${text}`);
    }

    return {
      id: spec.id,
      route: spec.route,
      profile: grade.profile,
      passed: grade.passed,
      expectedPassed: spec.expectedPassed,
      score: grade.score,
      targetTeacherScore: spec.targetTeacherScore,
      issueCodes,
      casePassed: failures.length === 0,
      failures,
    };
  });

  const routeCounts: Record<string, number> = {};
  const issueCounts: Record<string, number> = {};
  for (const result of results) {
    increment(routeCounts, result.route);
    for (const code of result.issueCodes) increment(issueCounts, code);
  }
  const passed = results.filter((result) => result.casePassed).length;
  return {
    ok: passed === results.length,
    total: results.length,
    passed,
    failed: results.length - passed,
    averageScore: Math.round(results.reduce((sum, result) => sum + result.score, 0) / results.length),
    averageTargetTeacherScore: Math.round((results.reduce((sum, result) => sum + result.targetTeacherScore, 0) / results.length) * 10) / 10,
    routeCounts,
    issueCounts,
    results,
  };
}
