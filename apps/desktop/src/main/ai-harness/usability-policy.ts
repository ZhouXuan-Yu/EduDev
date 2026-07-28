import type {
  AiConsoleArtifactRequest,
  AiIntentRoute,
  AiRouterDecision,
  AiStructuredReply,
  AiUsabilityGradeReport,
  AiUsabilityIssue,
} from '../../shared/contracts';

type AiUsabilityProfile = {
  id: string;
  maxAnswerChars: number;
  maxFacts: number;
  maxEvidence: number;
  maxInferences: number;
  maxUnknowns: number;
  maxNextActions: number;
  instruction: string;
};

const PROFILES: Record<AiIntentRoute, AiUsabilityProfile> = {
  general_qa: {
    id: 'brief_answer',
    maxAnswerChars: 450,
    maxFacts: 0,
    maxEvidence: 0,
    maxInferences: 0,
    maxUnknowns: 2,
    maxNextActions: 2,
    instruction: '普通问答用短答：先给结论，再给必要解释；通常不展开事实/证据/推断模板。',
  },
  workspace_help: {
    id: 'workspace_steps',
    maxAnswerChars: 500,
    maxFacts: 0,
    maxEvidence: 0,
    maxInferences: 0,
    maxUnknowns: 2,
    maxNextActions: 3,
    instruction: '工作台帮助要像操作指引：最多 3 步，直接告诉老师怎么做；不要要求老师手动切模块来弥补小智路由失败。',
  },
  student_diagnosis: {
    id: 'evidence_snapshot',
    maxAnswerChars: 950,
    maxFacts: 4,
    maxEvidence: 3,
    maxInferences: 2,
    maxUnknowns: 3,
    maxNextActions: 3,
    instruction: '学生诊断要短证据化：先说当前判断，再列最多 3 条依据、最多 2 个教学判断、最多 3 个下一步。',
  },
  error_analysis: {
    id: 'error_action_plan',
    maxAnswerChars: 1050,
    maxFacts: 4,
    maxEvidence: 3,
    maxInferences: 2,
    maxUnknowns: 3,
    maxNextActions: 3,
    instruction: '错因分析必须可执行：错在哪里、怎么验证、今天做什么；避免把“粗心/不努力”当解释。',
  },
  practice_design: {
    id: 'teaching_artifact',
    maxAnswerChars: 1500,
    maxFacts: 4,
    maxEvidence: 3,
    maxInferences: 2,
    maxUnknowns: 3,
    maxNextActions: 3,
    instruction: '练习设计优先交付题组或练习草稿；说明题源边界和老师要观察的点，不写长篇铺垫。',
  },
  lesson_design: {
    id: 'lesson_brief',
    maxAnswerChars: 1300,
    maxFacts: 3,
    maxEvidence: 3,
    maxInferences: 1,
    maxUnknowns: 3,
    maxNextActions: 3,
    instruction: '备课回复按课堂可用结构输出：目标、流程、检查点；不堆泛泛教学理念。',
  },
  report_draft: {
    id: 'draft_with_confirmation',
    maxAnswerChars: 1600,
    maxFacts: 5,
    maxEvidence: 4,
    maxInferences: 2,
    maxUnknowns: 3,
    maxNextActions: 3,
    instruction: '报告草稿面向老师二次编辑：正文要能直接改，家长表达要克制；保存前必须提醒老师确认。',
  },
  knowledge_retrieval: {
    id: 'source_brief',
    maxAnswerChars: 900,
    maxFacts: 3,
    maxEvidence: 4,
    maxInferences: 1,
    maxUnknowns: 3,
    maxNextActions: 2,
    instruction: '知识检索先给命中结论和来源边界；无命中就说清查了什么以及缺口，不编造资料。',
  },
};

const WEAK_FALLBACK_PATTERNS = [
  /当前为普通问答模式/,
  /无法自动切换/,
  /请手动选择左侧导航/,
  /请.*切换.*学生数据/,
  /当前路由不支持自动/,
];

const TEMPLATE_BLOAT_PATTERNS = [
  /根据当前可用的知识库和知识图谱，未找到/,
  /如果您在使用中遇到困难，请描述具体需要查询的信息/,
  /任务识别[\s\S]{0,40}上下文装配[\s\S]{0,40}结构校验/,
];

const GENERIC_ACTION_PATTERNS = [
  /^请老师确认是否继续[。.]?$/,
  /^建议上传资料[。.]?$/,
  /^继续观察[。.]?$/,
  /^可以进一步分析[。.]?$/,
];

function issue(severity: AiUsabilityIssue['severity'], code: string, message: string): AiUsabilityIssue {
  return { severity, code, message };
}

function profileForRoute(route: AiIntentRoute) {
  return PROFILES[route];
}

function readableLength(text: string) {
  return text
    .replace(/```[\s\S]*?```/g, '')
    .replace(/[#>*_`~\-\s|]/g, '')
    .length;
}

function countMarkdownHeadings(text: string) {
  return (text.match(/^#{2,6}\s+/gm) ?? []).length;
}

function countNonNoneRisks(reply: AiStructuredReply) {
  return reply.risks.filter((risk) => risk.category !== 'none' || risk.level !== 'normal').length;
}

function hasWeakFallback(reply: AiStructuredReply) {
  const combined = [
    reply.answerMarkdown,
    ...reply.unknowns,
    ...reply.nextActions,
    ...reply.processSummary,
  ].join('\n');
  return WEAK_FALLBACK_PATTERNS.some((pattern) => pattern.test(combined));
}

function hasTemplateBloat(reply: AiStructuredReply) {
  const combined = [
    reply.answerMarkdown,
    ...reply.processSummary,
  ].join('\n');
  return TEMPLATE_BLOAT_PATTERNS.some((pattern) => pattern.test(combined));
}

function hasOnlyGenericActions(reply: AiStructuredReply) {
  if (!reply.nextActions.length) return false;
  return reply.nextActions.every((action) => GENERIC_ACTION_PATTERNS.some((pattern) => pattern.test(action.trim())));
}

function scoreFromIssues(issues: AiUsabilityIssue[]) {
  const penalty = issues.reduce((total, item) => {
    if (item.severity === 'critical') return total + 45;
    if (item.severity === 'warning') return total + 16;
    return total + 5;
  }, 0);
  return Math.max(0, 100 - penalty);
}

function limitedList(items: string[], limit: number) {
  return items.map((item) => item.trim()).filter(Boolean).slice(0, limit);
}

function artifactLabel(artifact: AiConsoleArtifactRequest) {
  if (artifact.type === 'pdf') return 'PDF 文件';
  if (artifact.type === 'docx') return 'Word 文件';
  if (artifact.type === 'markdown') return 'Markdown 文件';
  if (artifact.type === 'exercise_set') return '三元题组草稿';
  if (artifact.type === 'report_draft') return '报告草稿';
  return artifact.title;
}

export function getAiUsabilityProfile(router: Pick<AiRouterDecision, 'route'>) {
  return profileForRoute(router.route);
}

export function buildUsabilityInstructions(router: Pick<AiRouterDecision, 'route'>) {
  const profile = profileForRoute(router.route);
  return [
    `可用性模式：${profile.id}。${profile.instruction}`,
    `answerMarkdown 建议不超过 ${profile.maxAnswerChars} 个中文字符；nextActions 最多 ${profile.maxNextActions} 条，每条必须是老师下一步能直接执行的动作。`,
    '不要输出固定流水线废话，不要写“当前为普通问答模式 / 无法自动切换 / 请手动切换学生数据”。',
    '如果没有命中数据，要说清已经检查的工具或上下文，以及缺口；不要只说“建议上传资料”。',
    '最终回答只保留对当前任务有帮助的段落；不要为了填字段而堆“事实/证据/推断/未知/下一步”。',
  ].join('\n');
}

export function gradeUsabilityReply(params: {
  reply: AiStructuredReply;
  router: AiRouterDecision;
}): AiUsabilityGradeReport {
  const { reply, router } = params;
  const profile = profileForRoute(router.route);
  const issues: AiUsabilityIssue[] = [];
  const answerLength = readableLength(reply.answerMarkdown);

  if (hasWeakFallback(reply)) {
    issues.push(issue(
      'critical',
      'manual_module_switch_fallback',
      '回复出现“无法自动切换/请手动切学生数据”等退化话术，小智必须自己按 route 调度能力。',
    ));
  }

  if (hasTemplateBloat(reply)) {
    issues.push(issue(
      'warning',
      'template_pipeline_bloat',
      '回复包含固定流水线式话术，容易让老师误以为所有问题都走同一流程。',
    ));
  }

  if (answerLength > profile.maxAnswerChars) {
    issues.push(issue(
      'warning',
      'answer_too_long_for_route',
      `当前 route 的 answerMarkdown 过长：${answerLength}/${profile.maxAnswerChars}。`,
    ));
  }

  if (countMarkdownHeadings(reply.answerMarkdown) > 5) {
    issues.push(issue(
      'warning',
      'too_many_headings',
      'answerMarkdown 标题过多，像模板报告而不是一次对话回复。',
    ));
  }

  if (reply.facts.length > profile.maxFacts) {
    issues.push(issue('info', 'too_many_facts', `facts 超过建议数量：${reply.facts.length}/${profile.maxFacts}。`));
  }

  if (reply.evidence.length > profile.maxEvidence) {
    issues.push(issue('info', 'too_many_evidence_items', `evidence 超过建议数量：${reply.evidence.length}/${profile.maxEvidence}。`));
  }

  if (reply.inferences.length > profile.maxInferences) {
    issues.push(issue('info', 'too_many_inferences', `inferences 超过建议数量：${reply.inferences.length}/${profile.maxInferences}。`));
  }

  if (reply.unknowns.length > profile.maxUnknowns) {
    issues.push(issue('info', 'too_many_unknowns', `unknowns 超过建议数量：${reply.unknowns.length}/${profile.maxUnknowns}。`));
  }

  if (reply.nextActions.length > profile.maxNextActions) {
    issues.push(issue(
      'warning',
      'too_many_next_actions',
      `下一步超过 ${profile.maxNextActions} 条，老师难以立刻执行。`,
    ));
  }

  const needsActionableNextStep = router.route === 'student_diagnosis'
    || router.route === 'error_analysis'
    || router.route === 'practice_design'
    || router.route === 'report_draft';
  if (needsActionableNextStep && (!reply.nextActions.length || hasOnlyGenericActions(reply))) {
    issues.push(issue(
      'warning',
      'missing_actionable_next_step',
      '教育任务需要 1-3 个可执行下一步，不能只写“继续观察/请确认是否继续”。',
    ));
  }

  if (router.actionLevel === 'write' && !reply.teacherConfirmations.length) {
    issues.push(issue(
      'critical',
      'write_action_without_low_friction_confirmation',
      '写入型任务缺少老师确认提示。',
    ));
  }

  if (reply.risks.length > 3 && countNonNoneRisks(reply) <= 1) {
    issues.push(issue(
      'info',
      'risk_section_noise',
      '风险列表里正常项过多，会稀释真正需要老师注意的边界。',
    ));
  }

  const score = scoreFromIssues(issues);
  return {
    passed: score >= 75 && !issues.some((item) => item.severity === 'critical'),
    score,
    profile: profile.id,
    issues,
  };
}

export function structuredReplyToTeacherMarkdown(reply: AiStructuredReply) {
  const profile = profileForRoute(reply.route);
  const blocks = [reply.answerMarkdown.trim()].filter(Boolean);
  const isBriefRoute = reply.route === 'general_qa' || reply.route === 'workspace_help';
  const facts = reply.facts.slice(0, profile.maxFacts).map((item) => `${item.statement}（来源：${item.sourceId}）`);
  const evidence = reply.evidence.slice(0, profile.maxEvidence).map((item) => `${item.sourceId}：${item.note}`);
  const inferences = reply.inferences.slice(0, profile.maxInferences);
  const unknowns = reply.unknowns.slice(0, profile.maxUnknowns);
  const nextActions = limitedList(reply.nextActions, profile.maxNextActions);
  const confirmations = limitedList(reply.teacherConfirmations, 2);
  const notableRisks = reply.risks
    .filter((risk) => risk.category !== 'none' || risk.level !== 'normal')
    .slice(0, 2)
    .map((risk) => `${risk.category}/${risk.level}：${risk.mitigation}`);
  const artifactHints = reply.artifacts
    .slice(0, 3)
    .map((artifact) => `${artifactLabel(artifact)}：${artifact.title}`);

  if (!isBriefRoute && facts.length) {
    blocks.push(['## 依据', ...facts.map((item) => `- ${item}`)].join('\n'));
  }
  if (!isBriefRoute && inferences.length) {
    blocks.push(['## 教学判断', ...inferences.map((item) => `- ${item}`)].join('\n'));
  }
  if (!isBriefRoute && evidence.length && !facts.length) {
    blocks.push(['## 来源', ...evidence.map((item) => `- ${item}`)].join('\n'));
  }
  if (unknowns.length) {
    blocks.push(['## 还不确定', ...unknowns.map((item) => `- ${item}`)].join('\n'));
  }
  if (notableRisks.length) {
    blocks.push(['## 边界', ...notableRisks.map((item) => `- ${item}`)].join('\n'));
  }
  if (nextActions.length) {
    blocks.push(['## 下一步', ...nextActions.map((item) => `- ${item}`)].join('\n'));
  }
  if (confirmations.length) {
    blocks.push(['## 需要老师确认', ...confirmations.map((item) => `- ${item}`)].join('\n'));
  }
  if (artifactHints.length) {
    blocks.push(['## 产物', ...artifactHints.map((item) => `- ${item}`)].join('\n'));
  }

  return blocks.join('\n\n');
}
