import type { LearningRecord } from '../../shared/contracts';

export const ERROR_TAXONOMY_SCHEMA_VERSION = 'omni.error.taxonomy.v1' as const;

export type ErrorCategory = 'structural' | 'deviation' | 'application' | 'metacognitive' | 'unknown';
export type ErrorConfidence = 'high' | 'medium' | 'low';

export type ErrorClassification = {
  recordId: string;
  category: ErrorCategory;
  confidence: ErrorConfidence;
  evidence: string[];
  needsTeacherReview: boolean;
};

export type ErrorTaxonomyAnalysis = {
  schemaVersion: typeof ERROR_TAXONOMY_SCHEMA_VERSION;
  studentId: string;
  window: {
    startDate: string;
    endDate: string;
    subject: string;
    timezone: 'UTC-calendar';
  };
  counts: Record<ErrorCategory, number>;
  classifications: ErrorClassification[];
  evidence: {
    sourceRecordIds: string[];
    includedRecordCount: number;
    excludedRecordCount: number;
    unknownRecordIds: string[];
  };
  facts: string[];
  unknowns: string[];
  recalculationKey: string;
};

export type ErrorTaxonomyInput = {
  studentId: string;
  records: LearningRecord[];
  startDate?: string;
  endDate?: string;
  subject?: string;
  nowMs?: number;
};

function isoDate(value: Date) {
  return value.toISOString().slice(0, 10);
}

function parseDateOnly(value: string, label: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) throw new Error(`${label} 必须是 YYYY-MM-DD。`);
  const parsed = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime()) || isoDate(parsed) !== value) throw new Error(`${label} 不是有效日期。`);
  return value;
}

function resolveWindow(startDate?: string, endDate?: string, nowMs = Date.now()) {
  const today = isoDate(new Date(nowMs));
  const end = parseDateOnly(endDate || today, 'endDate');
  const startFallback = isoDate(new Date(new Date(`${end}T00:00:00.000Z`).getTime() - 29 * 86_400_000));
  const start = parseDateOnly(startDate || startFallback, 'startDate');
  const startMs = Date.parse(`${start}T00:00:00.000Z`);
  const endMs = Date.parse(`${end}T00:00:00.000Z`);
  if (startMs > endMs) throw new Error('startDate 不能晚于 endDate。');
  if ((endMs - startMs) / 86_400_000 > 365) throw new Error('错因分析时间跨度不能超过 366 天。');
  return { startDate: start, endDate: end };
}

function dateOfRecord(record: LearningRecord) {
  const parsed = new Date(record.occurredAt);
  return Number.isNaN(parsed.getTime()) ? null : isoDate(parsed);
}

function parseMetadata(record: LearningRecord) {
  try {
    const value = JSON.parse(record.content || '{}');
    return value && typeof value === 'object' && !Array.isArray(value)
      ? value as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function normalized(value: unknown) {
  return String(value ?? '').trim().toLowerCase();
}

function explicitCategory(value: unknown): ErrorCategory | undefined {
  const key = normalized(value);
  if (!key) return undefined;
  if (['structural', 'knowledge_structural', 'concept', 'knowledge', '知识结构', '概念混淆'].includes(key)) return 'structural';
  if (['deviation', 'understanding_deviation', 'understanding', '题意偏差', '理解偏差', '审题'].includes(key)) return 'deviation';
  if (['application', 'application_error', 'procedure', '应用错误', '步骤错误', '计算错误'].includes(key)) return 'application';
  if (['metacognitive', 'metacognition', 'blank', 'unknown_answer', '元认知', '不会', '空白'].includes(key)) return 'metacognitive';
  if (['unknown', '未分类', '未知'].includes(key)) return 'unknown';
  return undefined;
}

function isBlank(value: unknown) {
  const text = normalized(value);
  return !text || ['空白', '未作答', '不会', '不知道', '放弃', ''].includes(text);
}

function candidateText(record: LearningRecord) {
  return [record.recordType, record.title, record.summary, ...record.tags, record.content]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function classifyRecord(record: LearningRecord): ErrorClassification {
  const metadata = parseMetadata(record);
  const explicit = explicitCategory(
    metadata.errorType ?? metadata.error_type ?? metadata.errorCategory ?? metadata.error_category ?? metadata.mistakeType,
  );
  if (explicit) {
    return {
      recordId: record.id,
      category: explicit,
      confidence: explicit === 'unknown' ? 'low' : 'high',
      evidence: ['记录元数据提供了显式错因类别。'],
      needsTeacherReview: explicit === 'unknown',
    };
  }

  if (metadata.isCorrect === false && isBlank(metadata.answer ?? metadata.userAnswer ?? metadata.user_answer)) {
    return {
      recordId: record.id,
      category: 'metacognitive',
      confidence: 'high',
      evidence: ['结构化记录显示题目未作答或回答为空。'],
      needsTeacherReview: false,
    };
  }

  const text = candidateText(record);
  const signals: Array<{ category: ErrorCategory; words: string[] }> = [
    { category: 'metacognitive', words: ['空白', '未作答', '不会', '不知道', '没思路', '放弃'] },
    { category: 'structural', words: ['概念混淆', '定义不清', '公式不会', '定理不清', '知识点不会', '知识结构'] },
    { category: 'deviation', words: ['读题', '题意', '审题', '条件理解', '理解偏差', '转化错误'] },
    { category: 'application', words: ['步骤', '计算', '符号', '单位', '代入', '抄错', '粗心', '运算'] },
  ];
  const matched = signals.find((item) => item.words.some((word) => text.includes(word)));
  if (matched) {
    const teacherReview = matched.category === 'application' && text.includes('粗心');
    return {
      recordId: record.id,
      category: matched.category,
      confidence: matched.category === 'metacognitive' ? 'medium' : 'low',
      evidence: [`记录文本包含“${matched.words.find((word) => text.includes(word))}”信号。`],
      needsTeacherReview: teacherReview || matched.category === 'application',
    };
  }

  return {
    recordId: record.id,
    category: 'unknown',
    confidence: 'low',
    evidence: ['记录没有显式错因类别或足够的可验证信号。'],
    needsTeacherReview: true,
  };
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, nested]) => [key, stableValue(nested)]));
  }
  return value;
}

function recalculationKey(value: unknown) {
  return JSON.stringify(stableValue(value));
}

function fingerprint(value: string) {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, '0');
}

export function buildErrorTaxonomyAnalysis(input: ErrorTaxonomyInput): ErrorTaxonomyAnalysis {
  const window = resolveWindow(input.startDate, input.endDate, input.nowMs);
  const subject = String(input.subject ?? '').trim();
  const included = input.records.filter((record) => {
    const date = dateOfRecord(record);
    if (!date || date < window.startDate || date > window.endDate) return false;
    if (subject && subject !== '全部' && record.subject !== subject) return false;
    const text = candidateText(record);
    return /mistake|错题|错因|失分|错误|订正|纠错/.test(text);
  });
  const classifications = included.map(classifyRecord);
  const counts: Record<ErrorCategory, number> = { structural: 0, deviation: 0, application: 0, metacognitive: 0, unknown: 0 };
  for (const item of classifications) counts[item.category] += 1;
  const sourceRecordIds = included.map((record) => record.id).slice(0, 100);
  const unknownRecordIds = classifications.filter((item) => item.category === 'unknown').map((item) => item.recordId).slice(0, 100);
  const facts = [
    `共纳入 ${included.length} 条可识别的错题/订正记录。`,
    `结构性、理解偏差、应用错误、元认知和未知分别为 ${counts.structural}/${counts.deviation}/${counts.application}/${counts.metacognitive}/${counts.unknown}。`,
    ...(counts.application ? ['应用错误仍需区分粗心、步骤和计算，不能直接当作稳定能力结论。'] : []),
  ];
  const unknowns = [
    ...(unknownRecordIds.length ? [`${unknownRecordIds.length} 条记录没有足够证据完成错因分类，需老师复核。`] : []),
    ...(included.length ? [] : ['当前时间窗和学科筛选没有可识别的错题/订正记录。']),
  ];
  return {
    schemaVersion: ERROR_TAXONOMY_SCHEMA_VERSION,
    studentId: input.studentId,
    window: { ...window, subject: subject || '全部', timezone: 'UTC-calendar' },
    counts,
    classifications,
    evidence: {
      sourceRecordIds,
      includedRecordCount: included.length,
      excludedRecordCount: Math.max(0, input.records.length - included.length),
      unknownRecordIds,
    },
    facts,
    unknowns,
    recalculationKey: recalculationKey({
      studentId: input.studentId,
      window,
      subject: subject || '全部',
      records: included.map((record) => ({
        id: record.id,
        occurredAt: record.occurredAt,
        titleFingerprint: fingerprint(record.title),
        tagsFingerprint: fingerprint(record.tags.join('|')),
        contentFingerprint: fingerprint(record.content),
      })),
    }),
  };
}

export function buildErrorTaxonomyMarkdown(analysis: ErrorTaxonomyAnalysis, displayName: string) {
  const lines = [
    `## ${displayName}错因分类草稿`,
    `- 统计范围：${analysis.window.startDate} 至 ${analysis.window.endDate}（${analysis.window.subject}）`,
    `- 证据记录：${analysis.evidence.sourceRecordIds.length} 条；未知分类：${analysis.evidence.unknownRecordIds.length} 条`,
    '',
    '### 可验证事实',
    ...analysis.facts.map((fact) => `- ${fact}`),
    '',
    '### 分类结果（需老师确认）',
    ...analysis.classifications.slice(0, 100).map((item) => `- ${item.recordId}：${item.category}（${item.confidence}，${item.needsTeacherReview ? '需复核' : '可暂用'}）`),
    '',
    '### 未知与边界',
    ...(analysis.unknowns.length ? analysis.unknowns.map((item) => `- ${item}`) : ['- 当前没有额外未知项。']),
    '',
    `来源记录 ID：${analysis.evidence.sourceRecordIds.join('、') || '无'}`,
  ];
  return lines.join('\n').slice(0, 3_800);
}
