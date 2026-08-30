import type { LearningRecord } from '../../shared/contracts';

export const LEARNING_ANALYTICS_SCHEMA_VERSION = 'omni.learning.analytics.v1' as const;

export type LearningAnalyticsWindow = {
  startDate: string;
  endDate: string;
  subject: string;
  timezone: 'UTC-calendar';
};

export type LearningAnalytics = {
  schemaVersion: typeof LEARNING_ANALYTICS_SCHEMA_VERSION;
  studentId: string;
  window: LearningAnalyticsWindow;
  metrics: {
    recordCount: number;
    activeDays: number;
    attachmentCount: number;
    mistakeCount: number;
    masteryAttemptCount: number;
    masteryCorrectCount: number;
    masteryAccuracy: number | null;
    recordTypeCounts: Record<string, number>;
    subjectCounts: Record<string, number>;
  };
  topTags: Array<{ tag: string; count: number }>;
  topKnowledgePoints: Array<{ knowledgePoint: string; attempts: number; correct: number; accuracy: number }>;
  evidence: {
    sourceRecordIds: string[];
    includedRecordCount: number;
    excludedRecordCount: number;
    unknownEvidenceCount: number;
  };
  facts: string[];
  unknowns: string[];
  recalculationKey: string;
};

export type LearningAnalyticsInput = {
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

function dateOfRecord(record: LearningRecord) {
  const parsed = new Date(record.occurredAt);
  if (Number.isNaN(parsed.getTime())) return null;
  return isoDate(parsed);
}

function boundedKey(value: string) {
  return value.trim().slice(0, 120);
}

function increment(map: Map<string, number>, value: string) {
  if (!value) return;
  map.set(value, (map.get(value) ?? 0) + 1);
}

function parseMetadata(record: LearningRecord) {
  try {
    const parsed = JSON.parse(record.content || '{}');
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed)
      ? parsed as Record<string, unknown>
      : {};
  } catch {
    return {};
  }
}

function stableCounts(map: Map<string, number>, limit = 20) {
  return Object.fromEntries(
    [...map.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit),
  );
}

function stableValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value as Record<string, unknown>)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, nested]) => [key, stableValue(nested)]));
  }
  return value;
}

function stableKey(value: unknown) {
  return JSON.stringify(stableValue(value));
}

/**
 * Deterministic, read-only analytics over the existing Omni learning records.
 * Calendar dates are deliberately UTC-calendar dates so a timezone change does
 * not silently move a record across a report boundary.
 */
export function buildLearningAnalytics(input: LearningAnalyticsInput): LearningAnalytics {
  const now = Number.isFinite(input.nowMs) ? Number(input.nowMs) : Date.now();
  const defaultEnd = isoDate(new Date(now));
  const defaultStart = isoDate(new Date(now - 29 * 86_400_000));
  const startDate = parseDateOnly(input.startDate || defaultStart, 'startDate');
  const endDate = parseDateOnly(input.endDate || defaultEnd, 'endDate');
  if (startDate > endDate) throw new Error('startDate 不能晚于 endDate。');
  const spanDays = Math.floor((Date.parse(`${endDate}T00:00:00.000Z`) - Date.parse(`${startDate}T00:00:00.000Z`)) / 86_400_000) + 1;
  if (spanDays > 366) throw new Error('分析时间范围不能超过 366 天。');

  const subject = boundedKey(input.subject || '');
  const included: LearningRecord[] = [];
  let excludedRecordCount = 0;
  for (const record of input.records) {
    const day = dateOfRecord(record);
    const subjectMatch = !subject || subject === '全部' || record.subject === subject;
    if (day && day >= startDate && day <= endDate && subjectMatch) included.push(record);
    else excludedRecordCount += 1;
  }
  included.sort((a, b) => {
    const timeA = Date.parse(a.occurredAt);
    const timeB = Date.parse(b.occurredAt);
    return (Number.isFinite(timeB) ? timeB : 0) - (Number.isFinite(timeA) ? timeA : 0) || a.id.localeCompare(b.id);
  });

  const recordTypeCounts = new Map<string, number>();
  const subjectCounts = new Map<string, number>();
  const tagCounts = new Map<string, number>();
  const activeDays = new Set<string>();
  const pointStats = new Map<string, { attempts: number; correct: number }>();
  let attachmentCount = 0;
  let mistakeCount = 0;
  let masteryAttemptCount = 0;
  let masteryCorrectCount = 0;
  let unknownEvidenceCount = 0;

  for (const record of included) {
    const recordType = boundedKey(record.recordType || 'unknown');
    const recordSubject = boundedKey(record.subject || '未分类') || '未分类';
    const day = dateOfRecord(record);
    increment(recordTypeCounts, recordType);
    increment(subjectCounts, recordSubject);
    if (day) activeDays.add(day);
    attachmentCount += record.attachments.length;
    if (/mistake|错题|错因|失分|错误/i.test(recordType) || /错题|错因|失分|错误/.test(record.title)) mistakeCount += 1;
    for (const tag of record.tags.slice(0, 16)) increment(tagCounts, boundedKey(tag));

    const metadata = parseMetadata(record);
    const knowledgePoint = boundedKey(String(metadata.knowledgePoint || ''));
    const explicitCorrect = typeof metadata.isCorrect === 'boolean' ? metadata.isCorrect : undefined;
    if (knowledgePoint && typeof explicitCorrect === 'boolean') {
      masteryAttemptCount += 1;
      if (explicitCorrect) masteryCorrectCount += 1;
      const stats = pointStats.get(knowledgePoint) ?? { attempts: 0, correct: 0 };
      stats.attempts += 1;
      if (explicitCorrect) stats.correct += 1;
      pointStats.set(knowledgePoint, stats);
    } else if (record.recordType === 'mastery_attempt' || record.tags.includes('mastery_attempt') || record.tags.includes('mastery_assess')) {
      unknownEvidenceCount += 1;
    }
  }

  const topKnowledgePoints = [...pointStats.entries()]
    .map(([knowledgePoint, stats]) => ({
      knowledgePoint,
      attempts: stats.attempts,
      correct: stats.correct,
      accuracy: Math.round((stats.correct / stats.attempts) * 1000) / 1000,
    }))
    .sort((a, b) => b.attempts - a.attempts || a.accuracy - b.accuracy || a.knowledgePoint.localeCompare(b.knowledgePoint))
    .slice(0, 20);
  const masteryAccuracy = masteryAttemptCount ? Math.round((masteryCorrectCount / masteryAttemptCount) * 1000) / 1000 : null;
  const metrics = {
    recordCount: included.length,
    activeDays: activeDays.size,
    attachmentCount,
    mistakeCount,
    masteryAttemptCount,
    masteryCorrectCount,
    masteryAccuracy,
    recordTypeCounts: stableCounts(recordTypeCounts),
    subjectCounts: stableCounts(subjectCounts),
  };
  const facts = included.length
    ? [
      `时间范围内共有 ${included.length} 条学习记录，覆盖 ${activeDays.size} 个学习日。`,
      `错题/错误相关记录 ${mistakeCount} 条，显式掌握度证据 ${masteryAttemptCount} 条。`,
      masteryAccuracy == null ? '当前范围没有可计算掌握度的显式正误证据。' : `显式掌握度证据正确率为 ${(masteryAccuracy * 100).toFixed(1)}%。`,
    ]
    : ['当前时间范围和学科筛选下没有学习记录。'];
  const unknowns = [
    ...(masteryAttemptCount ? [] : ['没有足够的显式正误证据，不能推断掌握度。']),
    ...(included.length && mistakeCount ? [] : ['没有足够错题证据，不能归纳稳定错因。']),
  ];
  const sourceRecordIds = included.map((record) => record.id).slice(0, 100);
  const recalculationKey = stableKey({
    studentId: input.studentId,
    window: { startDate, endDate, subject },
    sourceRecordIds,
    metrics,
    topTags: Object.entries(stableCounts(tagCounts, 10)),
    topKnowledgePoints,
  });
  return {
    schemaVersion: LEARNING_ANALYTICS_SCHEMA_VERSION,
    studentId: input.studentId,
    window: { startDate, endDate, subject, timezone: 'UTC-calendar' },
    metrics,
    topTags: Object.entries(stableCounts(tagCounts, 10)).map(([tag, count]) => ({ tag, count })),
    topKnowledgePoints,
    evidence: {
      sourceRecordIds,
      includedRecordCount: included.length,
      excludedRecordCount,
      unknownEvidenceCount,
    },
    facts,
    unknowns,
    recalculationKey,
  };
}

export function buildLearningAnalyticsMarkdown(analytics: LearningAnalytics, studentName: string) {
  const { metrics, window } = analytics;
  const subjectLabel = window.subject || '全部学科';
  return [
    `# ${studentName} 学情分析草稿`,
    '',
    `分析范围：${window.startDate} 至 ${window.endDate}（${subjectLabel}，UTC 日历边界）`,
    '',
    '## 一、可核验事实',
    ...analytics.facts.map((fact) => `- ${fact}`),
    `- 学习记录类型：${Object.entries(metrics.recordTypeCounts).map(([key, value]) => `${key} ${value} 条`).join('，') || '暂无'}`,
    `- 学科分布：${Object.entries(metrics.subjectCounts).map(([key, value]) => `${key} ${value} 条`).join('，') || '暂无'}`,
    '',
    '## 二、证据薄弱处',
    ...analytics.unknowns.map((unknown) => `- ${unknown}`),
    '',
    '## 三、教师复核建议',
    '- 请结合课堂表现和订正过程确认这些统计是否代表稳定趋势。',
    '- 任何学生标签或正式结论都需要教师单独确认，不能由统计结果自动写入档案。',
    '',
    '## 四、来源记录',
    analytics.evidence.sourceRecordIds.length ? analytics.evidence.sourceRecordIds.map((id) => `- ${id}`) : ['- 暂无可引用记录。'],
  ].join('\n');
}
