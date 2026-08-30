import type {
  AiConsoleArtifactRequest,
  AiIntentRoute,
  AiRouteCheck,
  AiRouterDecision,
  AiStructuredFact,
  AiStructuredReply,
  AiStructuredRisk,
} from '../../shared/contracts';
import { jsonrepair } from 'jsonrepair';
import { structuredReplyToTeacherMarkdown } from './usability-policy';

const ARTIFACT_TYPES = new Set(['markdown', 'pdf', 'docx', 'exercise_set', 'report_draft']);
const RISK_LEVELS = new Set(['normal', 'sensitive', 'safeguarding']);
const RISK_CATEGORIES = new Set(['privacy', 'safeguarding', 'bias', 'write_action', 'evidence_gap', 'none']);

function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
}

function normalizeArtifact(value: unknown, index: number): AiConsoleArtifactRequest | null {
  if (!value || typeof value !== 'object') return null;
  const item = value as Record<string, unknown>;
  const type = String(item.type ?? '');
  if (!ARTIFACT_TYPES.has(type)) return null;
  return {
    id: String(item.id ?? `artifact_${index + 1}`),
    title: String(item.title ?? '草稿产物'),
    type: type as AiConsoleArtifactRequest['type'],
    fileName: String(item.fileName ?? `xiazhi-artifact-${index + 1}.md`),
    description: String(item.description ?? ''),
    requiresTeacherConfirmation: Boolean(item.requiresTeacherConfirmation ?? true),
  };
}

function normalizeFacts(value: unknown): AiStructuredFact[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => {
      const confidence = String(item.confidence ?? 'medium');
      return {
        statement: String(item.statement ?? '').trim(),
        sourceId: String(item.sourceId ?? '').trim(),
        confidence: (confidence === 'high' || confidence === 'medium' || confidence === 'low' ? confidence : 'medium') as AiStructuredFact['confidence'],
      };
    })
    .filter((item) => item.statement && item.sourceId);
}

function normalizeRisks(value: unknown): AiStructuredRisk[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
    .map((item) => {
      const level = String(item.level ?? 'normal');
      const category = String(item.category ?? 'none');
      return {
        level: (RISK_LEVELS.has(level) ? level : 'normal') as AiStructuredRisk['level'],
        category: (RISK_CATEGORIES.has(category) ? category : 'none') as AiStructuredRisk['category'],
        mitigation: String(item.mitigation ?? '').trim(),
      };
    })
    .filter((item) => item.mitigation);
}

function normalizeRouteCheck(value: unknown, fallbackRoute: AiIntentRoute): AiRouteCheck {
  if (!value || typeof value !== 'object') {
    return { kind: fallbackRoute, passed: false, notes: ['缺少 routeCheck。'] };
  }
  const item = value as Record<string, unknown>;
  return {
    kind: String(item.kind ?? fallbackRoute) as AiIntentRoute,
    passed: Boolean(item.passed),
    notes: isStringArray(item.notes) ? item.notes : [],
  };
}

function hasTripletShape(answerMarkdown: string) {
  return /原题/.test(answerMarkdown) && /相似题/.test(answerMarkdown) && /变式题/.test(answerMarkdown);
}

function extractJsonObject(raw: string): { value?: unknown; extracted: boolean } {
  const text = String(raw ?? '')
    .replace(/^\uFEFF/, '')
    .replace(/^\s*```(?:json)?\s*/i, '')
    .replace(/\s*```\s*$/i, '')
    .trim();
  const candidates = [text];
  let start = -1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === '"') inString = false;
      continue;
    }
    if (char === '"') { inString = true; continue; }
    if (char === '{') { if (start < 0) start = index; depth += 1; }
    else if (char === '}' && start >= 0) {
      depth -= 1;
      if (depth === 0) {
        candidates.push(text.slice(start, index + 1));
        // Keep scanning. Some providers prepend a small JSON metadata object
        // before the actual reply; the contract object should win if present.
        start = -1;
      }
    }
  }
  const firstBrace = text.indexOf('{');
  const lastBrace = text.lastIndexOf('}');
  if (firstBrace >= 0 && lastBrace > firstBrace) {
    candidates.push(text.slice(firstBrace, lastBrace + 1));
  }
  const uniqueCandidates = [...new Set(candidates)];
  let firstParsed: unknown;
  for (const candidate of uniqueCandidates) {
    try {
      const value = JSON.parse(candidate) as unknown;
      firstParsed ??= value;
      if (value && typeof value === 'object' && (value as Record<string, unknown>).schemaVersion === 'xiazhi.reply.v2') {
        return { value, extracted: candidate !== text };
      }
    } catch { /* try next bounded candidate */ }
  }
  // Provider JSON mode is a hint rather than a guarantee. Repair only a
  // bounded, complete object envelope, then run the exact same xiazhi.reply.v2
  // semantic validation below. This handles common LLM syntax drift such as a
  // trailing comma or a raw newline without accepting truncated JSON or
  // inventing contract fields.
  for (const candidate of uniqueCandidates) {
    const bounded = candidate.trim();
    if (bounded.length > 64_000 || !bounded.startsWith('{') || !bounded.endsWith('}')) continue;
    try {
      const value = JSON.parse(jsonrepair(bounded)) as unknown;
      firstParsed ??= value;
      if (value && typeof value === 'object' && (value as Record<string, unknown>).schemaVersion === 'xiazhi.reply.v2') {
        return { value, extracted: true };
      }
    } catch { /* retain fail-closed behavior */ }
  }
  return firstParsed === undefined ? { extracted: false } : { value: firstParsed, extracted: true };
}

function validateRouteSpecific(reply: AiStructuredReply, router: AiRouterDecision) {
  const errors: string[] = [];
  const needsEvidenceBoundaries = router.route === 'student_diagnosis'
    || router.route === 'error_analysis'
    || router.route === 'report_draft';
  if (needsEvidenceBoundaries && !reply.facts.length && !reply.unknowns.length) {
    errors.push(`${router.route} 必须至少提供 facts 或 unknowns，不能只给泛化建议。`);
  }
  if (router.route === 'student_diagnosis' && reply.inferences.length && !reply.facts.length) {
    errors.push('学生诊断出现 inferences 时必须有 facts 支撑。');
  }
  if (router.route === 'practice_design' && router.subIntent === 'triplet_practice') {
    const hasExerciseArtifact = reply.artifacts.some((artifact) => artifact.type === 'exercise_set');
    if (!hasExerciseArtifact && !hasTripletShape(reply.answerMarkdown)) {
      errors.push('三元题组必须包含原题、相似题、变式题，或提供 exercise_set artifact。');
    }
  }
  if (router.route === 'report_draft' && router.actionLevel === 'write') {
    const hasConfirmation = reply.teacherConfirmations.some((item) => /确认|保存|写入/.test(item));
    if (!hasConfirmation) errors.push('写入型报告草稿必须在 teacherConfirmations 中说明需要老师确认后才能保存。');
  }
  if (!reply.routeCheck.passed) errors.push('routeCheck.passed 必须为 true。');
  if (reply.routeCheck.kind !== router.route) errors.push(`routeCheck.kind 必须是 ${router.route}。`);
  return errors;
}

export function parseStructuredReply(raw: string, router: AiRouterDecision): { reply?: AiStructuredReply; errors: string[] } {
  const errors: string[] = [];
  const extracted = extractJsonObject(raw);
  const parsed = extracted.value;
  if (parsed === undefined) {
    const normalized = raw.replace(/^\uFEFF/, '').trim();
    if (!normalized) return { errors: ['模型没有返回 JSON content。'] };
    if (normalized.startsWith('{') && !normalized.endsWith('}')) {
      return { errors: ['模型返回的 JSON 不完整，可能因输出长度上限被截断。'] };
    }
    return { errors: ['模型没有返回合法 JSON。'] };
  }
  // Fenced/prose-wrapped JSON is normalized locally; the wrapper itself is not
  // a contract error because the object still undergoes the same validation.

  if (!parsed || typeof parsed !== 'object') return { errors: ['模型返回不是 JSON object。'] };
  const value = parsed as Record<string, unknown>;
  if (value.schemaVersion !== 'xiazhi.reply.v2') errors.push('schemaVersion 必须是 xiazhi.reply.v2。');

  const answerMarkdown = typeof value.answerMarkdown === 'string' ? value.answerMarkdown.trim() : '';
  if (!answerMarkdown) errors.push('answerMarkdown 不能为空。');

  const evidence = Array.isArray(value.evidence)
    ? value.evidence
        .filter((item): item is Record<string, unknown> => Boolean(item && typeof item === 'object'))
        .map((item) => ({
          sourceId: String(item.sourceId ?? ''),
          quote: typeof item.quote === 'string' ? item.quote : undefined,
          note: String(item.note ?? ''),
        }))
        .filter((item) => item.sourceId && item.note)
    : [];

  const artifacts = Array.isArray(value.artifacts)
    ? value.artifacts.map(normalizeArtifact).filter((item): item is AiConsoleArtifactRequest => Boolean(item))
    : [];

  const route = typeof value.route === 'string' ? value.route as AiIntentRoute : router.route;
  if (route !== router.route) errors.push(`route 必须匹配 router dry-run：${router.route}。`);
  const subIntent = typeof value.subIntent === 'string' ? value.subIntent : router.subIntent;
  if (subIntent !== router.subIntent) errors.push(`subIntent 必须匹配 router dry-run：${router.subIntent}。`);

  const reply: AiStructuredReply = {
    schemaVersion: 'xiazhi.reply.v2',
    route,
    subIntent: router.subIntent,
    answerMarkdown,
    facts: normalizeFacts(value.facts),
    evidence,
    inferences: isStringArray(value.inferences) ? value.inferences : [],
    unknowns: isStringArray(value.unknowns) ? value.unknowns : [],
    risks: normalizeRisks(value.risks),
    teacherConfirmations: isStringArray(value.teacherConfirmations) ? value.teacherConfirmations : [],
    nextActions: isStringArray(value.nextActions) ? value.nextActions : [],
    artifacts,
    routeCheck: normalizeRouteCheck(value.routeCheck, router.route),
    processSummary: isStringArray(value.processSummary) ? value.processSummary : [],
  };

  errors.push(...validateRouteSpecific(reply, router));
  return { reply: errors.length ? undefined : reply, errors };
}

export function structuredReplyToMarkdown(reply: AiStructuredReply) {
  return structuredReplyToTeacherMarkdown(reply);
}
