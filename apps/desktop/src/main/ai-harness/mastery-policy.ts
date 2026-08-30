import type { MasterySnapshot } from './mastery-snapshot';
import { scheduleFromOutcomes as computeReviewSchedule } from './review-scheduler';

export type MasteryPolicyPoint = {
  id: string;
  name: string;
  type: string;
  moduleId: string;
  moduleName: string;
  order: number;
  attempts: number;
  correct: number;
  mastery: number;
  threshold: number;
  status: 'new' | 'learning' | 'mastered';
  nextReviewAt: number | null;
  due: boolean;
};

export type MasteryPolicyResult = {
  policyVersion: 'omni.mastery.policy.v1';
  now: number;
  next: {
    action: 'review' | 'probe' | 'practice' | 'assess' | 'complete';
    moduleId?: string;
    moduleName?: string;
    knowledgePointId?: string;
    knowledgePointName?: string;
    knowledgePointType?: string;
    status?: MasteryPolicyPoint['status'];
    mastery?: number;
    threshold?: number;
    reason: string;
  };
  dueReviews: Array<Pick<MasteryPolicyPoint, 'id' | 'name' | 'moduleId' | 'moduleName' | 'type' | 'nextReviewAt'>>;
  points: MasteryPolicyPoint[];
  evidence: MasterySnapshot['evidence'];
};

const RECENCY_WEIGHTS = [0.5, 0.7, 0.85, 0.95, 1.0];
const CONFIDENCE_CAP: Record<number, number> = { 1: 0.5, 2: 0.8 };
const QUANTITATIVE_GATE = 0.9;
const QUALITATIVE_TYPES = new Set(['concept', 'design']);
const TYPE_PRIORITY: Record<string, number> = { memory: 2, concept: 3, procedure: 4, design: 5 };

function boundedOutcomeList(snapshot: MasterySnapshot, pointId: string) {
  return snapshot.attempts
    .filter((attempt) => attempt.knowledgePointId === pointId)
    .sort((a, b) => a.timestamp - b.timestamp || a.questionId.localeCompare(b.questionId))
    .slice(-200);
}

function computeMastery(outcomes: boolean[]) {
  if (!outcomes.length) return 0;
  const recent = outcomes.slice(-RECENCY_WEIGHTS.length);
  const weights = RECENCY_WEIGHTS.slice(-recent.length);
  const weighted = recent.reduce((sum, value, index) => sum + weights[index] * (value ? 1 : 0), 0) /
    weights.reduce((sum, value) => sum + value, 0);
  return Math.min(weighted, CONFIDENCE_CAP[recent.length] ?? 1);
}

function scheduleFromOutcomes(type: string, outcomes: Array<{ isCorrect: boolean; timestamp: number }>) {
  return computeReviewSchedule(type, outcomes, 0)?.nextReviewAt ?? null;
}

export function buildMasteryPolicy(snapshot: MasterySnapshot, now = Date.now() / 1000): MasteryPolicyResult {
  const points: MasteryPolicyPoint[] = [];
  for (const module of [...snapshot.modules].sort((a, b) => a.order - b.order || a.id.localeCompare(b.id))) {
    for (const [pointOrder, point] of module.knowledge_points.entries()) {
      const attempts = boundedOutcomeList(snapshot, point.id);
      const outcomes = attempts.map((attempt) => attempt.isCorrect);
      const mastery = computeMastery(outcomes);
      // Concept/design mastery is a teacher/mentor gate. A correct quiz answer
      // is useful evidence but must not silently promote a qualitative point.
      const qualitativePassed = QUALITATIVE_TYPES.has(point.type) &&
        attempts.some((attempt) => attempt.evidenceKind === 'assess' && attempt.isCorrect);
      const mastered = qualitativePassed || (!QUALITATIVE_TYPES.has(point.type) && mastery >= QUANTITATIVE_GATE);
      const nextReviewAt = scheduleFromOutcomes(point.type, attempts);
      points.push({
        id: point.id,
        name: point.name,
        type: point.type,
        moduleId: module.id,
        moduleName: module.name,
        order: module.order * 10_000 + pointOrder,
        attempts: attempts.length,
        correct: outcomes.filter(Boolean).length,
        mastery: Math.round(mastery * 1000) / 1000,
        threshold: QUALITATIVE_TYPES.has(point.type) ? 1 : QUANTITATIVE_GATE,
        status: mastered ? 'mastered' : attempts.length ? 'learning' : 'new',
        nextReviewAt,
        due: nextReviewAt != null && nextReviewAt <= now,
      });
    }
  }

  const dueReviews = points
    .filter((point) => point.due)
    .sort((a, b) => (TYPE_PRIORITY[a.type] ?? 9) - (TYPE_PRIORITY[b.type] ?? 9) || a.order - b.order)
    .slice(0, 20);
  const nextReview = dueReviews[0];
  let next: MasteryPolicyResult['next'];
  if (nextReview) {
    next = {
      action: 'review',
      moduleId: nextReview.moduleId,
      moduleName: nextReview.moduleName,
      knowledgePointId: nextReview.id,
      knowledgePointName: nextReview.name,
      knowledgePointType: nextReview.type,
      status: nextReview.status,
      mastery: nextReview.mastery,
      threshold: nextReview.threshold,
      reason: '到期复习优先于推进新知识点。',
    };
  } else {
    const candidate = points.find((point) => point.status !== 'mastered');
    if (!candidate) {
      next = { action: 'complete', reason: '所有知识点均已通过掌握门禁，且没有到期复习。' };
    } else {
      const qualitative = QUALITATIVE_TYPES.has(candidate.type);
      next = {
        action: candidate.status === 'new' ? 'probe' : qualitative ? 'assess' : 'practice',
        moduleId: candidate.moduleId,
        moduleName: candidate.moduleName,
        knowledgePointId: candidate.id,
        knowledgePointName: candidate.name,
        knowledgePointType: candidate.type,
        status: candidate.status,
        mastery: candidate.mastery,
        threshold: candidate.threshold,
        reason: candidate.status === 'new' ? '尚无显式证据，先做探测题，不预设已掌握。' : '尚未达到该知识点的掌握门禁，继续练习或进行质性评估。',
      };
    }
  }
  return { policyVersion: 'omni.mastery.policy.v1', now, next, dueReviews, points, evidence: snapshot.evidence };
}
