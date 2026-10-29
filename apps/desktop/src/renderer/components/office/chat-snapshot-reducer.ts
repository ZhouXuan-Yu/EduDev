import type { XiaozhiAgentEvent, XiaozhiWorkspaceSnapshot } from '../../../shared/xiaozhi-agent';
import { applyXiaozhiEvent } from '../../../shared/xiaozhi-projection';

/** Preserve all business cards while batching only renderer commits. */
export function applyChatSnapshotEvent(
  previous: XiaozhiWorkspaceSnapshot,
  event: XiaozhiAgentEvent,
): XiaozhiWorkspaceSnapshot {
  if (
    previous.projection.turns.at(-1)?.id === event.runId &&
    event.sequence <= previous.projection.sourceSequence
  )
    return previous;
  const turns = previous.projection.turns.slice();
  let index = turns.findIndex((turn) => turn.id === event.runId);
  if (index < 0) {
    const pending = turns.at(-1)?.id === 'pending-send' ? turns.pop() : undefined;
    turns.push({ id: event.runId, status: 'running', items: pending?.items || [] });
    index = turns.length - 1;
  }
  turns[index] = applyXiaozhiEvent(turns[index], event);
  const approvals =
    event.kind === 'approval'
      ? [
          ...(previous.approvals || []).filter((item) => item.id !== event.approval.id),
          event.approval,
        ]
      : previous.approvals;
  const changes =
    event.kind === 'change'
      ? [...(previous.changes || []).filter((item) => item.id !== event.change.id), event.change]
      : previous.changes;
  const officeArtifacts =
    event.kind === 'office_artifact'
      ? [
          ...(previous.officeArtifacts || []).filter((item) => item.id !== event.artifact.id),
          event.artifact,
        ]
      : previous.officeArtifacts;
  const learningReviews =
    event.kind === 'learning_review'
      ? [
          ...(previous.learningReviews || []).filter((item) => item.id !== event.review.id),
          event.review,
        ]
      : previous.learningReviews;
  const paperReviews =
    event.kind === 'paper_review'
      ? [
          ...(previous.paperReviews || []).filter((item) => item.id !== event.review.id),
          event.review,
        ]
      : previous.paperReviews;
  const practiceReviews =
    event.kind === 'practice_review'
      ? [
          ...(previous.practiceReviews || []).filter((item) => item.id !== event.review.id),
          event.review,
        ]
      : previous.practiceReviews;
  const questionCollections =
    event.kind === 'question_collection'
      ? [
          ...(previous.questionCollections || []).filter((item) => item.id !== event.review.id),
          event.review,
        ]
      : previous.questionCollections;
  const questionReviews =
    event.kind === 'question_review'
      ? [
          ...(previous.questionReviews || []).filter((item) => item.id !== event.review.id),
          event.review,
        ]
      : previous.questionReviews;
  const controls =
    event.kind === 'control'
      ? [...(previous.controls || []).filter((item) => item.id !== event.control.id), event.control]
      : previous.controls;
  const usage =
    event.kind === 'usage'
      ? [...(previous.usage || []).filter((item) => item.runId !== event.usage.runId), event.usage]
      : previous.usage;
  return {
    ...previous,
    approvals,
    changes,
    officeArtifacts,
    deliveries:event.kind==='delivery_bundle'?[...(previous.deliveries||[]).filter(d=>d.id!==event.delivery.id),event.delivery]:previous.deliveries,
    learningReviews,
    questionCollections,
    questionReviews,
    practiceReviews,
    paperReviews,
    controls,
    usage,
    ...(event.kind === 'goal' ? { goal: event.goal } : {}),
    ...(event.kind === 'compaction' && !event.automatic ? { operation: 'compact' as const } : {}),
    running: event.kind === 'status' ? event.status === 'running' : previous.running,
    projection: { ...previous.projection, sourceSequence: event.sequence, turns },
  };
}
