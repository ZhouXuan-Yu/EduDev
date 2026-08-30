import type { LearningRecord } from '../../shared/contracts';
import type { OmniEduStore } from '../db';

export type MasterySnapshot = {
  bookId: string;
  modules: Array<{
    id: string;
    name: string;
    order: number;
    knowledge_points: Array<{ id: string; name: string; type: string; module_id: string }>;
  }>;
  attempts: Array<{
    questionId: string;
    knowledgePointId: string;
    moduleId: string;
    isCorrect: boolean;
    evidenceKind: 'quiz' | 'assess' | 'unknown';
    timestamp: number;
  }>;
  evidence: { recordCount: number; attemptCount: number; unknownEvidence: number };
};

/**
 * Convert only explicit, bounded learning-record evidence into the shape
 * consumed by DeepTutor's mastery capability. Free-form records are retained
 * as unknown evidence and never promoted to a correct/incorrect attempt.
 */
export async function buildMasterySnapshot(store: OmniEduStore, studentId: string): Promise<MasterySnapshot> {
  const records = await store.listRecords(studentId, { limit: 200 });
  const points = new Map<string, { id: string; name: string; type: string; moduleId: string; moduleName: string; order: number }>();
  const attempts: MasterySnapshot['attempts'] = [];
  let unknownEvidence = 0;
  for (const record of records as LearningRecord[]) {
    let metadata: Record<string, unknown> = {};
    try {
      const parsed = JSON.parse(record.content || '{}');
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) metadata = parsed as Record<string, unknown>;
    } catch {
      // Free-form records remain valid context, but do not become fake mastery evidence.
    }
    // A title is not mastery evidence.  Only an explicit structured field or
    // a controlled mastery tag may establish a knowledge point; free-form
    // notes must remain unknown and never perturb the review queue.
    const controlledTag = record.tags.find((tag) => tag !== 'mastery_attempt' && tag !== 'mastery_assess' && tag.trim().length > 0);
    const hasMasterySignal = record.recordType === 'mastery_attempt' || record.tags.includes('mastery_attempt') || record.tags.includes('mastery_assess');
    const knowledgePoint = String(metadata.knowledgePoint || (hasMasterySignal ? controlledTag : '') || '').trim().slice(0, 160);
    if (!knowledgePoint) { unknownEvidence += 1; continue; }
    const moduleName = String(metadata.moduleName || record.subject || '未分类').trim().slice(0, 80) || '未分类';
    const moduleId = `subject_${moduleName.replace(/[^\p{L}\p{N}_-]/gu, '_').slice(0, 64) || 'general'}`;
    const pointId = `kp_${knowledgePoint.replace(/[^\p{L}\p{N}_-]/gu, '_').slice(0, 80) || 'unknown'}`;
    const rawType = String(metadata.knowledgeType || 'procedure').toLowerCase();
    const type = ['memory', 'concept', 'procedure', 'design'].includes(rawType) ? rawType : 'procedure';
    if (!points.has(pointId)) points.set(pointId, { id: pointId, name: knowledgePoint, type, moduleId, moduleName, order: points.size });
    const explicitCorrect = typeof metadata.isCorrect === 'boolean' ? metadata.isCorrect : undefined;
    const inferredCorrect = record.recordType === 'mistake' ? false : undefined;
    const isCorrect = explicitCorrect ?? inferredCorrect;
    if (typeof isCorrect !== 'boolean') { unknownEvidence += 1; continue; }
    const evidenceKind: 'quiz' | 'assess' | 'unknown' =
      record.tags.some((tag) => tag === 'mastery_assess') || metadata.type === 'mastery_assessment'
        ? 'assess'
        : record.tags.some((tag) => tag === 'mastery_attempt') || record.recordType === 'mastery_attempt'
          ? 'quiz'
          : 'unknown';
    const occurred = Date.parse(record.occurredAt);
    attempts.push({
      questionId: record.id,
      knowledgePointId: pointId,
      moduleId,
      isCorrect,
      evidenceKind,
      timestamp: Number.isFinite(occurred) ? occurred / 1000 : Date.now() / 1000,
    });
  }
  const modules = [...new Map([...points.values()].map((point) => [point.moduleId, point])).values()]
    .sort((a, b) => a.order - b.order)
    .map((first) => ({
      id: first.moduleId,
      name: first.moduleName,
      order: first.order,
      knowledge_points: [...points.values()]
        .filter((point) => point.moduleId === first.moduleId)
        .map((point) => ({ id: point.id, name: point.name, type: point.type, module_id: point.moduleId })),
    }));
  return {
    bookId: `omni_student_${studentId}`,
    modules,
    attempts,
    evidence: { recordCount: records.length, attemptCount: attempts.length, unknownEvidence },
  };
}
