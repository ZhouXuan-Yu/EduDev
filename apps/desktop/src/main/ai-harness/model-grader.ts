import type {
  AiIntentRoute,
  AiModelGradeInput,
  AiSubIntent,
} from '../../shared/contracts';

const MANUAL_SWITCH_PATTERNS = [
  /当前为普通问答模式/,
  /无法自动切换/,
  /请手动选择左侧导航/,
  /请.*切换.*学生数据/,
];

const UNSAFE_STUDENT_LABEL_PATTERNS = [
  /懒惰/,
  /不努力/,
  /态度差/,
  /就是.*笨/,
  /永久标签/,
];

const EVIDENCE_PATTERNS = [
  /依据/,
  /来源/,
  /已检查/,
  /错题/,
  /学习记录/,
  /知识点/,
];

const ACTION_PATTERNS = [
  /下一步/,
  /今天/,
  /先/,
  /再/,
  /建议/,
  /练/,
  /确认/,
];

const TEACHER_CONTROL_PATTERNS = [
  /老师确认/,
  /确认后/,
  /可修改/,
  /草稿/,
  /预览/,
];

const OVER_COMPLEX_FOR_PRIMARY_PATTERNS = [
  /二次函数/,
  /导数/,
  /微积分/,
  /矩阵/,
  /极限/,
];

const TOO_CHILDISH_FOR_HIGH_SCHOOL_PATTERNS = [
  /数苹果/,
  /小红花/,
  /拍手歌/,
  /幼儿/,
];

function clampScore(score: number) {
  return Math.max(1, Math.min(5, Math.round(score)));
}

function containsAny(text: string, patterns: RegExp[]) {
  return patterns.some((pattern) => pattern.test(text));
}

function readableLength(text: string) {
  return text.replace(/```[\s\S]*?```/g, '').replace(/[#>*_`~\-\s|]/g, '').length;
}

function routeNeedsEvidence(route: AiIntentRoute) {
  return route === 'student_diagnosis'
    || route === 'error_analysis'
    || route === 'practice_design'
    || route === 'report_draft'
    || route === 'knowledge_retrieval';
}

function routeNeedsTeacherControl(route: AiIntentRoute) {
  return route === 'report_draft' || route === 'practice_design';
}

function gradeAppropriateness(text: string, targetGrade: string) {
  const normalizedGrade = targetGrade.trim();
  if (!normalizedGrade) return 4;
  if (/小学|一|二|三|四|五|六/.test(normalizedGrade) && containsAny(text, OVER_COMPLEX_FOR_PRIMARY_PATTERNS)) return 2;
  if (/高一|高二|高三|高中/.test(normalizedGrade) && containsAny(text, TOO_CHILDISH_FOR_HIGH_SCHOOL_PATTERNS)) return 2;
  return 5;
}

function issue(code: string, condition: boolean, issues: string[]) {
  if (condition) issues.push(code);
}

export function gradeAiReplyWithModelProxy(params: {
  sampleId: string;
  prompt: string;
  answerMarkdown: string;
  route: AiIntentRoute;
  subIntent: AiSubIntent | string;
  targetGrade?: string;
  modelUnderReview?: string;
  graderModel?: string;
  reviewedAt?: string;
}): AiModelGradeInput {
  const answer = params.answerMarkdown.trim();
  const combined = `${params.prompt}\n${answer}`;
  const answerLength = readableLength(answer);
  const issues: string[] = [];
  const hasManualSwitch = containsAny(combined, MANUAL_SWITCH_PATTERNS);
  const hasUnsafeStudentLabel = containsAny(combined, UNSAFE_STUDENT_LABEL_PATTERNS);
  const hasEvidence = containsAny(answer, EVIDENCE_PATTERNS);
  const hasAction = containsAny(answer, ACTION_PATTERNS);
  const hasTeacherControl = containsAny(answer, TEACHER_CONTROL_PATTERNS);
  const gradeScore = gradeAppropriateness(answer, params.targetGrade ?? '');

  issue('manual_module_switch_fallback', hasManualSwitch, issues);
  issue('unsafe_student_label', hasUnsafeStudentLabel, issues);
  issue('missing_evidence_boundary', routeNeedsEvidence(params.route) && !hasEvidence, issues);
  issue('missing_actionable_next_step', !hasAction && params.route !== 'general_qa', issues);
  issue('missing_teacher_control', routeNeedsTeacherControl(params.route) && !hasTeacherControl, issues);
  issue('answer_too_long_for_teacher_review', answerLength > 1400, issues);
  issue('grade_inappropriate_content', gradeScore <= 2, issues);

  const evidenceScore = routeNeedsEvidence(params.route) ? (hasEvidence ? 5 : 2) : 4;
  const actionabilityScore = hasManualSwitch ? 1 : hasAction ? 5 : 3;
  const safetyScore = hasUnsafeStudentLabel ? 1 : 5;
  const concisionScore = answerLength > 1600 ? 2 : answerLength > 1000 ? 4 : 5;
  const teacherControlScore = routeNeedsTeacherControl(params.route) ? (hasTeacherControl ? 5 : 2) : 4;

  return {
    sampleId: params.sampleId,
    prompt: params.prompt,
    answerMarkdown: answer,
    route: params.route,
    subIntent: params.subIntent,
    targetGrade: params.targetGrade ?? '',
    modelUnderReview: params.modelUnderReview ?? '',
    graderModel: params.graderModel ?? 'deterministic-model-grader-proxy-v1',
    graderMode: 'deterministic_proxy',
    evidenceScore: clampScore(evidenceScore),
    actionabilityScore: clampScore(actionabilityScore),
    safetyScore: clampScore(safetyScore),
    gradeAppropriatenessScore: clampScore(gradeScore),
    concisionScore: clampScore(concisionScore),
    teacherControlScore: clampScore(teacherControlScore),
    issueCodes: issues,
    graderRationale: issues.length
      ? `Proxy model grader detected: ${issues.join(', ')}.`
      : 'Proxy model grader: reply is evidence-aware, actionable, safe, age-appropriate, concise, and preserves teacher control.',
    reviewedAt: params.reviewedAt,
  };
}
