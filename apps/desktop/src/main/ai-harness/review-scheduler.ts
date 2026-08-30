export type ReviewKnowledgeType = 'memory' | 'concept' | 'procedure' | 'design';

export type ReviewOutcome = {
  isCorrect: boolean;
  timestamp: number;
};

export type ReviewSchedule = {
  intervalIndex: number;
  consecutiveCorrect: number;
  consecutiveWrong: number;
  nextReviewAt: number;
};

export type ReviewQueueItem = {
  id: string;
  knowledgePointId: string;
  knowledgeType: ReviewKnowledgeType;
  dueAt: number;
  priority: number;
  intervalIndex: number;
  due: boolean;
};

export const REVIEW_INTERVAL_DAYS: Record<ReviewKnowledgeType, readonly number[]> = {
  memory: [0, 1, 3, 7, 14, 30, 60],
  concept: [3, 7, 14, 30],
  procedure: [3, 7, 14],
  design: [14, 28],
};

const TYPE_PRIORITY: Record<ReviewKnowledgeType, number> = {
  memory: 2,
  concept: 3,
  procedure: 4,
  design: 5,
};

const SECONDS_PER_DAY = 86_400;
const MAX_OUTCOMES = 200;

export function normalizeReviewKnowledgeType(value: unknown): ReviewKnowledgeType {
  return value === 'memory' || value === 'concept' || value === 'procedure' || value === 'design'
    ? value
    : 'procedure';
}

export function clampReviewNow(value: unknown, fallback = 0): number {
  const parsed = typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  return Math.max(0, parsed);
}

export function scheduleFromOutcomes(
  knowledgeType: unknown,
  rawOutcomes: readonly ReviewOutcome[],
  now = 0,
): ReviewSchedule | null {
  const outcomes = rawOutcomes
    .filter((outcome) => outcome && typeof outcome === 'object' && typeof outcome.isCorrect === 'boolean')
    .map((outcome) => ({
      isCorrect: outcome.isCorrect,
      timestamp: clampReviewNow(outcome.timestamp, 0),
    }))
    .sort((a, b) => a.timestamp - b.timestamp)
    .slice(-MAX_OUTCOMES);
  if (!outcomes.length) return null;
  const type = normalizeReviewKnowledgeType(knowledgeType);
  const intervals = REVIEW_INTERVAL_DAYS[type];
  let intervalIndex = 0;
  let consecutiveCorrect = 0;
  let consecutiveWrong = 0;
  for (const outcome of outcomes) {
    if (outcome.isCorrect) {
      consecutiveWrong = 0;
      consecutiveCorrect += 1;
      intervalIndex += consecutiveCorrect >= 2 ? 2 : 1;
      if (consecutiveCorrect >= 2) consecutiveCorrect = 0;
    } else {
      consecutiveWrong += 1;
      consecutiveCorrect = 0;
      intervalIndex = Math.max(0, intervalIndex - 1);
      if (consecutiveWrong >= 2) consecutiveWrong = 0;
    }
    intervalIndex = Math.max(0, Math.min(intervalIndex, intervals.length - 1));
  }
  const lastTimestamp = outcomes[outcomes.length - 1].timestamp;
  return {
    intervalIndex,
    consecutiveCorrect,
    consecutiveWrong,
    nextReviewAt: Math.max(0, lastTimestamp + intervals[intervalIndex] * SECONDS_PER_DAY),
  };
}

export function buildReviewQueue(
  points: ReadonlyArray<{ id: string; type: unknown; order: number }>,
  outcomesByPoint: ReadonlyMap<string, readonly ReviewOutcome[]>,
  now = 0,
  timezone = 'UTC',
  maxTasks = 20,
): ReviewQueueItem[] {
  // timezone is intentionally metadata only. Epoch comparison makes a zone
  // switch unable to move or drop a task.
  void timezone;
  const safeNow = clampReviewNow(now, 0);
  const items = points.flatMap((point) => {
    const schedule = scheduleFromOutcomes(point.type, outcomesByPoint.get(point.id) ?? [], safeNow);
    if (!schedule) return [];
    const knowledgeType = normalizeReviewKnowledgeType(point.type);
    return [{
      id: `review_${point.id}`,
      knowledgePointId: point.id,
      knowledgeType,
      dueAt: schedule.nextReviewAt,
      priority: TYPE_PRIORITY[knowledgeType],
      intervalIndex: schedule.intervalIndex,
      due: schedule.nextReviewAt <= safeNow,
      order: Number.isFinite(point.order) ? point.order : Number.MAX_SAFE_INTEGER,
    }];
  });
  return items
    .sort((a, b) => a.priority - b.priority || a.order - b.order || a.knowledgePointId.localeCompare(b.knowledgePointId))
    .slice(0, Math.max(0, Math.min(100, Math.floor(maxTasks))))
    .map(({ order: _order, ...item }) => item);
}
