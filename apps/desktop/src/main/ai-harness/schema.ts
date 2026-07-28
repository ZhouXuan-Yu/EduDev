import type {
  AiConsoleArtifactRequest,
  AiIntentRoute,
  AiStructuredReply,
} from '../../shared/contracts';

const ARTIFACT_TYPES = new Set(['markdown', 'pdf', 'docx', 'exercise_set', 'report_draft']);
const ROUTES = new Set([
  'general_qa',
  'student_diagnosis',
  'error_analysis',
  'practice_design',
  'lesson_design',
  'report_draft',
  'knowledge_retrieval',
  'workspace_help',
]);

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

export function parseStructuredReply(raw: string, fallbackRoute: AiIntentRoute): { reply?: AiStructuredReply; errors: string[] } {
  const errors: string[] = [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(raw);
  } catch {
    return { errors: ['模型没有返回合法 JSON。'] };
  }

  if (!parsed || typeof parsed !== 'object') return { errors: ['模型返回不是 JSON object。'] };
  const value = parsed as Record<string, unknown>;
  if (value.schemaVersion !== 'xiazhi.reply.v1') errors.push('schemaVersion 必须是 xiazhi.reply.v1。');

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

  const route = typeof value.route === 'string' && ROUTES.has(value.route) ? value.route as AiIntentRoute : fallbackRoute;
  if (route !== fallbackRoute) errors.push(`route 必须匹配 router dry-run：${fallbackRoute}。`);

  const reply: AiStructuredReply = {
    schemaVersion: 'xiazhi.reply.v1',
    route,
    answerMarkdown,
    evidence,
    inferences: isStringArray(value.inferences) ? value.inferences : [],
    unknowns: isStringArray(value.unknowns) ? value.unknowns : [],
    teacherConfirmations: isStringArray(value.teacherConfirmations) ? value.teacherConfirmations : [],
    nextActions: isStringArray(value.nextActions) ? value.nextActions : [],
    artifacts,
    processSummary: isStringArray(value.processSummary) ? value.processSummary : [],
  };

  return { reply: errors.length ? undefined : reply, errors };
}

export function structuredReplyToMarkdown(reply: AiStructuredReply) {
  const blocks = [reply.answerMarkdown.trim()];
  if (reply.evidence.length) {
    blocks.push(['## 证据', ...reply.evidence.map((item) => `- ${item.sourceId}：${item.note}`)].join('\n'));
  }
  if (reply.inferences.length) blocks.push(['## 推断', ...reply.inferences.map((item) => `- ${item}`)].join('\n'));
  if (reply.unknowns.length) blocks.push(['## 未知', ...reply.unknowns.map((item) => `- ${item}`)].join('\n'));
  if (reply.teacherConfirmations.length) {
    blocks.push(['## 需要老师确认', ...reply.teacherConfirmations.map((item) => `- ${item}`)].join('\n'));
  }
  if (reply.nextActions.length) blocks.push(['## 下一步', ...reply.nextActions.map((item) => `- ${item}`)].join('\n'));
  return blocks.join('\n\n');
}
