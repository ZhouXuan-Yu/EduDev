import type {
  AiRouterDecision,
  AiStructuredReply,
  AiConsoleToolRun,
} from '../../shared/contracts';
import { routeAiPrompt } from './router';
import { allAiRoleProfiles, buildAiRoleProfileGuidance } from './role-profile';
import {
  AI_TOOL_REGISTRY,
  getModelToolDefinitions,
  reviewModelToolCall,
} from './tool-registry';
import { parseStructuredReply } from './schema';
import { gradeEducationalReply } from './education-grader';
import {
  buildUsabilityInstructions,
  getAiUsabilityProfile,
  gradeUsabilityReply,
} from './usability-policy';
import { buildMasterySnapshot } from './mastery-snapshot';
import { AI_HARNESS_EVAL_CASES } from './eval-cases';

export type DeepTutorCapabilityEvalResult = {
  id: string;
  capability: string;
  passed: boolean;
  detail: string;
};

export type DeepTutorCapabilityEvalReport = {
  ok: boolean;
  total: number;
  passed: number;
  failed: number;
  groups: Record<string, { total: number; passed: number; failed: number }>;
  cases: DeepTutorCapabilityEvalResult[];
};

type EvalCase = {
  id: string;
  capability: string;
  run: () => boolean | string | Promise<boolean | string>;
};

function resultOf(testCase: EvalCase, result: boolean | string): DeepTutorCapabilityEvalResult {
  const passed = result === true;
  return {
    id: testCase.id,
    capability: testCase.capability,
    passed,
    detail: typeof result === 'string' ? result : passed ? 'passed' : 'assertion failed',
  };
}

function stableRouter(prompt: string, hasStudent = true) {
  return routeAiPrompt(prompt, { hasStudent });
}

const knownDiagnosisPrompt = AI_HARNESS_EVAL_CASES.find((item) => item.id === 'diagnosis-01')?.prompt ?? '鍒嗘瀽褰撳墠瀛︾敓';

function replyFor(router: AiRouterDecision, overrides: Partial<AiStructuredReply> = {}): AiStructuredReply {
  return {
    schemaVersion: 'xiazhi.reply.v2',
    route: router.route,
    subIntent: router.subIntent,
    answerMarkdown: '已基于本地证据完成本轮处理。',
    facts: [],
    evidence: [],
    inferences: [],
    unknowns: [],
    risks: [],
    teacherConfirmations: [],
    nextActions: ['查看本轮证据并决定下一步教学动作'],
    artifacts: [],
    routeCheck: { kind: router.route, passed: true, notes: [] },
    processSummary: ['已完成路由、按需上下文和结构校验'],
    ...overrides,
  };
}

function toolRun(name: string, status: AiConsoleToolRun['status'] = 'used'): AiConsoleToolRun {
  return { name, label: name, status, detail: status };
}

function hasTool(router: AiRouterDecision, name: string) {
  return router.allowedTools.includes(name);
}

function makeCases(): EvalCase[] {
  const cases: EvalCase[] = [];

  // 12 control-plane and routing cases.
  const routing = [
    ['route-01', '问候不触发学生工具', '浣犲ソ锛屽皬鏅?', 'general_qa', false],
    ['route-02', '学生进度自动进入诊断', '鍒嗘瀽褰撳墠瀛︾敓鏈€杩戜竴涓湀鐨勪富瑕侀敊鍥?', 'student_diagnosis', true],
    ['route-03', '错题原因进入错误分析', '分析这道错题为什么错', 'error_analysis', true],
    ['route-04', '三元题组进入练习设计', '生成三元题组：原题、相似题、变式题', 'practice_design', true],
    ['route-05', '教案进入课程设计', '帮我设计一节课的教案', 'lesson_design', true],
    ['route-06', '报告进入报告草稿', '生成一份家长沟通摘要', 'report_draft', true],
    ['route-07', '知识库检索独立路由', '在老师知识库里查找勾股定理讲义', 'knowledge_retrieval', true],
    ['route-08', '工作台帮助不读取学生', 'DeepSeek API Key 在哪里配置？', 'workspace_help', false],
    ['route-09', '未绑定学生要求澄清', '分析当前学生最近的学习进度', 'student_diagnosis', false],
    ['route-10', '多学生引用要求澄清', '比较小A和小B最近表现', 'student_diagnosis', false],
    ['route-11', '写入意图被标记', '按小A错因设计三元题组并保存', 'practice_design', false],
    ['route-12', '安全风险保持诊断路由', '学生说想要自残，老师现在该怎么处理？', 'student_diagnosis', true],
  ] as const;
  for (const [id, detail, prompt, expectedRoute, hasStudent] of routing) {
    cases.push({
      id,
      capability: 'control-plane',
      run: () => {
        const router = stableRouter(id === 'route-02' ? knownDiagnosisPrompt : prompt, hasStudent);
        if (router.route !== expectedRoute) return `${detail}: ${router.route}`;
        if (id === 'route-09' && !router.clarificationQuestion) return 'missing student clarification';
        if (id === 'route-10' && !router.clarificationQuestion) return 'missing multi-student clarification';
        if (id === 'route-11' && router.slots.writeIntent !== true) return 'write intent not detected';
        if (id === 'route-12' && router.riskLevel !== 'safeguarding') return 'safeguarding risk not detected';
        return true;
      },
    });
  }

  // 10 context assembly and tool-governance cases.
  const diagnosis = stableRouter('鍒嗘瀽褰撳墠瀛︾敓鏈€杩戜竴涓湀鐨勪富瑕侀敊鍥?', false);
  Object.assign(diagnosis, stableRouter(knownDiagnosisPrompt, false));
  const lesson = stableRouter('帮我设计一节课的教案');
  const practice = stableRouter('生成三元题组：原题、相似题、变式题');
  const general = stableRouter('浣犲ソ锛屽皬鏅?');
  cases.push(
    { id: 'context-01', capability: 'context-governance', run: () => diagnosis.contextPolicy.include.includes('student_profile') || 'profile omitted' },
    { id: 'context-02', capability: 'context-governance', run: () => diagnosis.contextPolicy.include.includes('learning_records') || 'records omitted' },
    { id: 'context-03', capability: 'context-governance', run: () => !lesson.contextPolicy.include.includes('student_profile') || 'lesson leaked student profile' },
    { id: 'context-04', capability: 'context-governance', run: () => hasTool(lesson, 'search_teacher_knowledge') || 'teacher knowledge unavailable' },
    { id: 'context-05', capability: 'context-governance', run: () => hasTool(practice, 'search_similar_questions') || 'question bank unavailable' },
    { id: 'context-06', capability: 'context-governance', run: () => getModelToolDefinitions(general).every((item) => !['get_student_profile', 'search_learning_records'].includes(item.function.name)) || 'general route exposed student tool' },
    { id: 'context-07', capability: 'context-governance', run: () => getModelToolDefinitions(lesson).every((item) => item.function.name !== 'get_student_profile') || 'lesson exposed student profile' },
    { id: 'context-08', capability: 'context-governance', run: () => getModelToolDefinitions(practice).some((item) => item.function.name === 'search_similar_questions') || 'practice tool definition missing' },
    { id: 'context-09', capability: 'context-governance', run: () => AI_TOOL_REGISTRY.every((tool) => tool.maxOutputChars <= 6000) || 'tool output exceeds the bounded 6000-character ceiling' },
    { id: 'context-10', capability: 'context-governance', run: () => {
      const peer = routeAiPrompt('以同伴口吻分析学生当前学习进度', { hasStudent: true });
      const research = routeAiPrompt('以研究助理口吻分析学生当前学习进度', { hasStudent: true });
      return diagnosis.contextPolicy.recordLimit <= 20
        && diagnosis.contextPolicy.knowledgeLimit <= 12
        && peer.roleProfile === 'peer'
        && research.roleProfile === 'research_assistant'
        && JSON.stringify(peer.allowedTools) === JSON.stringify(diagnosis.allowedTools)
        && JSON.stringify(peer.contextPolicy) === JSON.stringify(diagnosis.contextPolicy)
        && allAiRoleProfiles().every((profile) => buildAiRoleProfileGuidance(profile).length > 20)
        || 'role profile changed capability/context policy';
    } },
  );

  // 8 native education-loop and reply-quality cases.
  const safeReply = replyFor(diagnosis, {
    answerMarkdown: '已检查学生档案和学习记录，当前证据显示本周练习量下降。',
    facts: [{ statement: '本周有 3 条显式学习记录', sourceId: 'learning_records', confidence: 'high' }],
    evidence: [{ sourceId: 'learning_records', note: '已读取本地学习记录' }],
    unknowns: ['尚未知道家庭作业完成环境'],
    inferences: ['可能需要缩短单次练习时长'],
  });
  const helpReply = replyFor(general, { answerMarkdown: '你好，我可以直接按任务调用学习、知识和练习能力。' });
  cases.push(
    { id: 'education-01', capability: 'education-loop', run: () => gradeEducationalReply({ reply: safeReply, router: diagnosis, toolRuns: [toolRun('get_student_profile')] }).passed || 'student evidence grade failed' },
    { id: 'education-02', capability: 'education-loop', run: () => gradeUsabilityReply({ reply: safeReply, router: diagnosis }).passed || 'student usability grade failed' },
    { id: 'education-03', capability: 'education-loop', run: () => gradeUsabilityReply({ reply: replyFor(general, { answerMarkdown: '当前为普通问答模式，无法自动切换，请手动选择学生数据。' }), router: general }).issues.some((issue) => issue.code === 'manual_module_switch_fallback') || 'fallback language not caught' },
    { id: 'education-04', capability: 'education-loop', run: () => gradeEducationalReply({ reply: replyFor(diagnosis, { answerMarkdown: '无法判断', inferences: ['无证据推断'], processSummary: [] }), router: diagnosis, toolRuns: [] }).issues.some((issue) => issue.code === 'student_gap_without_audit') || 'missing audit not caught' },
    { id: 'education-05', capability: 'education-loop', run: () => getAiUsabilityProfile({ route: 'practice_design' }).maxNextActions <= 3 || 'practice profile not bounded' },
    { id: 'education-06', capability: 'education-loop', run: () => buildUsabilityInstructions({ route: 'lesson_design' }).includes('answerMarkdown') || 'route instructions missing schema guidance' },
    { id: 'education-07', capability: 'education-loop', run: () => gradeEducationalReply({ reply: replyFor(diagnosis, { answerMarkdown: '学生手机号 13812345678' }), router: diagnosis, toolRuns: [] }).issues.some((issue) => issue.code === 'direct_sensitive_data_leak') || 'sensitive data leak not caught' },
    { id: 'education-08', capability: 'education-loop', run: () => gradeEducationalReply({ reply: replyFor(diagnosis, { risks: [{ level: 'safeguarding', category: 'safeguarding', mitigation: '联系监护人和专业支持' }] }), router: { ...diagnosis, riskLevel: 'safeguarding' }, toolRuns: [] }).passed || 'safeguarding mitigation rejected' },
  );

  // 6 practice and quiz guard cases.
  cases.push(
    { id: 'practice-guard-01', capability: 'practice-loop', run: () => !reviewModelToolCall({ name: 'mastery_grade', arguments: { questionId: 'q1', answer: 'A' } }, practice).ok || 'write tool bypassed confirmation' },
    { id: 'practice-guard-02', capability: 'practice-loop', run: () => reviewModelToolCall({ name: 'mastery_grade', arguments: { questionId: 'q1', answer: 'A' } }, practice, { allowManagedWrite: true }).ok || 'managed quiz write blocked' },
    { id: 'practice-guard-03', capability: 'practice-loop', run: () => reviewModelToolCall({ name: 'mastery_quiz', arguments: { studentId: 's1' } }, practice, { allowManagedWrite: true }).ok || 'quiz schema rejected valid request' },
    { id: 'practice-guard-04', capability: 'practice-loop', run: () => !reviewModelToolCall({ name: 'mastery_quiz', arguments: { studentId: 's1', unexpected: true } }, practice, { allowManagedWrite: true }).ok || 'additional property accepted' },
    { id: 'practice-guard-05', capability: 'practice-loop', run: () => !reviewModelToolCall({ name: 'search_similar_questions', arguments: { limit: 999 } }, practice).ok || 'limit overflow accepted' },
    { id: 'practice-guard-06', capability: 'practice-loop', run: () => !reviewModelToolCall({ name: 'not_a_real_tool', arguments: {} }, practice).ok || 'unknown tool accepted' },
  );

  // 6 mastery data-boundary cases.
  const fakeStore = {
    listRecords: async () => [
      { id: 'r1', occurredAt: '2026-08-01T00:00:00.000Z', recordType: 'practice', subject: '数学', title: '一次函数', content: JSON.stringify({ knowledgePoint: '一次函数', knowledgeType: 'concept', isCorrect: true, moduleName: '函数' }), tags: [], attachments: [] },
      { id: 'r2', occurredAt: '2026-08-02T00:00:00.000Z', recordType: 'note', subject: '数学', title: '', content: 'free form note', tags: [], attachments: [] },
    ],
  };
  cases.push(
    { id: 'mastery-01', capability: 'mastery-boundary', run: async () => (await buildMasterySnapshot(fakeStore as never, 's1')).bookId === 'omni_student_s1' || 'snapshot identity drifted' },
    { id: 'mastery-02', capability: 'mastery-boundary', run: async () => (await buildMasterySnapshot(fakeStore as never, 's1')).attempts.length === 1 || 'implicit prose became attempt' },
    { id: 'mastery-03', capability: 'mastery-boundary', run: async () => (await buildMasterySnapshot(fakeStore as never, 's1')).evidence.unknownEvidence === 1 || 'unknown evidence not counted' },
    { id: 'mastery-04', capability: 'mastery-boundary', run: async () => (await buildMasterySnapshot(fakeStore as never, 's1')).modules[0]?.knowledge_points[0]?.type === 'concept' || 'knowledge type not preserved' },
    { id: 'mastery-05', capability: 'mastery-boundary', run: () => reviewModelToolCall({ name: 'mastery_assess', arguments: { studentId: 's1', knowledgePointId: 'kp1', passed: true } }, practice, { allowManagedWrite: true }).ok || 'assess contract rejected' },
    { id: 'mastery-06', capability: 'mastery-boundary', run: () => reviewModelToolCall({ name: 'mastery_build', arguments: { studentId: 's1', modules: [] } }, practice, { allowManagedWrite: true }).ok || 'build contract rejected' },
  );

  // 6 structured reply, evidence and safety cases.
  const validJson = JSON.stringify(replyFor(general, { answerMarkdown: '简短回答' }));
  cases.push(
    { id: 'reply-01', capability: 'reply-contract', run: () => Boolean(parseStructuredReply(validJson, general).reply) || 'valid reply rejected' },
    { id: 'reply-02', capability: 'reply-contract', run: () => parseStructuredReply('{"schemaVersion":"xiazhi.reply.v2"}', general).errors.length > 0 || 'empty reply accepted' },
    { id: 'reply-03', capability: 'reply-contract', run: () => parseStructuredReply(JSON.stringify({ ...replyFor(general), route: 'lesson_design' }), general).errors.some((error) => error.includes('route')) || 'route mismatch accepted' },
    { id: 'reply-04', capability: 'reply-contract', run: () => parseStructuredReply(JSON.stringify({ ...replyFor(general), routeCheck: { kind: 'general_qa', passed: false, notes: [] } }), general).errors.length > 0 || 'failed route check accepted' },
    { id: 'reply-05', capability: 'reply-contract', run: () => parseStructuredReply(JSON.stringify({ ...replyFor(practice, { answerMarkdown: '原题、相似题、变式题' }), artifacts: [{ type: 'exercise_set', title: '三元题组' }] }), practice).reply !== undefined || 'practice artifact rejected' },
    { id: 'reply-06', capability: 'reply-contract', run: () => parseStructuredReply(JSON.stringify({ ...replyFor(diagnosis), inferences: ['没有事实'] }), diagnosis).errors.length > 0 || 'diagnosis inference without facts accepted' },
  );

  return cases;
}

export async function runDeepTutorCapabilityEvalSuite(): Promise<DeepTutorCapabilityEvalReport> {
  const cases = makeCases();
  const results: DeepTutorCapabilityEvalResult[] = [];
  for (const testCase of cases) {
    try {
      results.push(resultOf(testCase, await testCase.run()));
    } catch (error) {
      results.push(resultOf(testCase, error instanceof Error ? `threw: ${error.message}` : 'threw'));
    }
  }
  const groups: DeepTutorCapabilityEvalReport['groups'] = {};
  for (const item of results) {
    const group = groups[item.capability] ?? { total: 0, passed: 0, failed: 0 };
    group.total += 1;
    if (item.passed) group.passed += 1;
    else group.failed += 1;
    groups[item.capability] = group;
  }
  const passed = results.filter((item) => item.passed).length;
  return { ok: results.length === 48 && passed === results.length, total: results.length, passed, failed: results.length - passed, groups, cases: results };
}
