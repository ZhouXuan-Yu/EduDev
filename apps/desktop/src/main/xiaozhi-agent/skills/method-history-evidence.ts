import type { HistorySelection } from '../../../shared/xiaozhi-history-memory';
import type { MemoryTeachingTarget } from '../../../shared/xiaozhi-memory';
import type { createHistoryMemory } from '../history/memory';
import type { createTaskState } from '../tasks/task-state';

type Source = Awaited<ReturnType<ReturnType<typeof createHistoryMemory>['selectedFor']>>;
type ReviewedTask = NonNullable<Awaited<ReturnType<ReturnType<typeof createTaskState>['completedForOrigin']>>>;
const field = (text: string, label: string) => {
  const values = text.normalize('NFKC').split(/\r?\n/).flatMap(line => {
    const prefix = label + ':';
    const trimmed = line.trim();
    return trimmed.startsWith(prefix) ? [trimmed.slice(prefix.length).trim()] : [];
  });
  return values.length === 1 && /^[^\u0000-\u001f<>]{1,120}$/u.test(values[0]) ? values[0] : undefined;
};

export const namedMethodReview = (request: string) => field(request,'评估方法');

export async function readMethodHistoryEvidence(options: {
  method: string;
  sessionId: string;
  selected: readonly HistorySelection[];
  targetFor: (sessionId: string) => Promise<MemoryTeachingTarget | null>;
  source: (pin: HistorySelection) => Promise<Source>;
  reviewedTask: (sessionId: string, messageId: string) => Promise<ReviewedTask | undefined>;
}) {
  const scope = await options.targetFor(options.sessionId);
  if (!scope) return [];
  const evidence: Array<{ role: 'sample' | 'holdout'; source: string; sourceFingerprint: string; task: ReviewedTask }> = [];
  for (const pin of options.selected) {
    try {
      const original = await options.source(pin);
      if (original.ref.kind !== 'history_request' || original.attributedContent || original.temporal.comparisonTargetTerm
        || field(original.text,'验证方法') !== options.method) continue;
      const purpose = field(original.text,'证据用途');
      if (purpose !== '发现样本' && purpose !== '留出验证') continue;
      const originScope = await options.targetFor(original.ref.sessionId);
      if (originScope?.folderId !== scope.folderId || originScope.term !== scope.term) continue;
      const task = await options.reviewedTask(original.ref.sessionId,original.ref.recordId);
      if (!task || evidence.some(item => item.task.taskId === task.taskId || item.task.runId === task.runId
        || item.task.resultFingerprint === task.resultFingerprint)) continue;
      evidence.push({ role: purpose === '发现样本' ? 'sample' : 'holdout', source: pin.id, sourceFingerprint: original.fingerprint, task });
    } catch {
      // A stale/revoked selection or an unauditable Task cannot support a method.
    }
  }
  return evidence;
}

export type MethodHistoryEvidence = Awaited<ReturnType<typeof readMethodHistoryEvidence>>;
