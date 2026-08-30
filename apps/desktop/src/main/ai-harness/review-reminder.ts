import { normalizeReviewKnowledgeType, type ReviewKnowledgeType } from './review-scheduler';

export type ReviewReminderCandidate = {
  id: string;
  name: string;
  moduleId: string;
  moduleName: string;
  type: unknown;
  dueAt: number | null | undefined;
};

export type ReviewReminderItem = {
  id: string;
  knowledgePointId: string;
  name: string;
  moduleId: string;
  moduleName: string;
  type: ReviewKnowledgeType;
  dueAt: number;
  state: 'due' | 'upcoming';
};

export type ReviewReminder = {
  schemaVersion: 'omni.review.reminder.v1';
  status: 'due' | 'upcoming' | 'clear';
  generatedAt: number;
  horizonSeconds: number;
  dueCount: number;
  upcomingCount: number;
  nextAt: number | null;
  timezone: string;
  timezoneInvariant: true;
  source: 'omni_edu_learning_records';
  rawRecordsIncluded: false;
  requiresTeacherReview: true;
  items: ReviewReminderItem[];
};

const SECONDS_PER_DAY = 86_400;
const DEFAULT_HORIZON_DAYS = 3;
const MAX_HORIZON_DAYS = 30;
const MAX_ITEMS = 3;

function safeEpoch(value: unknown, fallback = 0) {
  return typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : fallback;
}

function safeTimezone(value: unknown) {
  const timezone = String(value ?? 'UTC').trim().slice(0, 80);
  return timezone || 'UTC';
}

export function buildReviewReminder(
  candidates: readonly ReviewReminderCandidate[],
  now = 0,
  timezone = 'UTC',
  horizonDays = DEFAULT_HORIZON_DAYS,
): ReviewReminder {
  const generatedAt = safeEpoch(now);
  const boundedHorizonDays = typeof horizonDays === 'number' && Number.isFinite(horizonDays)
    ? Math.max(0, Math.min(MAX_HORIZON_DAYS, Math.floor(horizonDays)))
    : DEFAULT_HORIZON_DAYS;
  const horizonSeconds = boundedHorizonDays * SECONDS_PER_DAY;
  const due: ReviewReminderItem[] = [];
  const upcoming: ReviewReminderItem[] = [];
  const seen = new Set<string>();
  for (const candidate of candidates.slice(0, 10_000)) {
    if (!candidate || typeof candidate !== 'object') continue;
    const id = String(candidate.id ?? '').trim().slice(0, 160);
    const name = String(candidate.name ?? '').trim().slice(0, 160);
    const dueAt = typeof candidate.dueAt === 'number' && Number.isFinite(candidate.dueAt) && candidate.dueAt >= 0
      ? candidate.dueAt
      : -1;
    if (!id || !name || dueAt < 0 || seen.has(id)) continue;
    seen.add(id);
    const item: ReviewReminderItem = {
      id: `review_${id}`,
      knowledgePointId: id,
      name,
      moduleId: String(candidate.moduleId ?? '').trim().slice(0, 120),
      moduleName: String(candidate.moduleName ?? '').trim().slice(0, 120),
      type: normalizeReviewKnowledgeType(candidate.type),
      dueAt,
      state: dueAt <= generatedAt ? 'due' : 'upcoming',
    };
    if (item.state === 'due') due.push(item);
    else if (dueAt <= generatedAt + horizonSeconds) upcoming.push(item);
  }
  const order = (a: ReviewReminderItem, b: ReviewReminderItem) => a.dueAt - b.dueAt || a.knowledgePointId.localeCompare(b.knowledgePointId);
  due.sort(order);
  upcoming.sort(order);
  const items = [...due, ...upcoming].slice(0, MAX_ITEMS);
  return {
    schemaVersion: 'omni.review.reminder.v1',
    status: due.length ? 'due' : upcoming.length ? 'upcoming' : 'clear',
    generatedAt,
    horizonSeconds,
    dueCount: due.length,
    upcomingCount: upcoming.length,
    nextAt: items[0]?.dueAt ?? null,
    timezone: safeTimezone(timezone),
    timezoneInvariant: true,
    source: 'omni_edu_learning_records',
    rawRecordsIncluded: false,
    requiresTeacherReview: true,
    items,
  };
}
