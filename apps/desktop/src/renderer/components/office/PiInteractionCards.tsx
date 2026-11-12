import type { XiaozhiWorkspaceSnapshot, XiaozhiQueueMutationInput, XiaozhiDecisionInput } from '../../../shared/xiaozhi-agent';
import type { LearningReviewSummary } from '../../../shared/learning-review';
import type { OfficeInteraction } from './OfficeInteractions';
import { PiCopyApproval } from './PiCopyApproval';
import {PiPermissionApproval} from './PiPermissionApproval';
import {PiDeliveryBundleCard} from './PiDeliveryBundleCard';
import { PiTextChangeCard } from './PiTextChangeCard';
import { PiOfficeArtifactCard } from './PiOfficeArtifactCard';
import { PiLearningReview, PiLearningReviewSet } from './PiLearningReview';
import { PiQuestionCollection } from './PiQuestionCollection';
import { PiQuestionReview } from './PiQuestionReview';
import { PiOriginalQuestionBatchReview, originalReviewGroups } from './PiOriginalQuestionBatchReview';
import { PiPaperReview } from './PiPaperReview';
import { PiPracticeReview } from './PiPracticeReview';
import { PiControlCards } from './PiControlCards';
import {PiTaskReview} from './PiTaskReview';

/** Original business cards and decisions; only their persisted location changes. */
export function buildPiInteractions({ snapshot, sessionId, onRefresh, onOpen, onDecision, onAnswer, onMutation }: {
  snapshot?: XiaozhiWorkspaceSnapshot; sessionId: string; onRefresh: () => Promise<void>; onOpen: (path: string) => void;
  onDecision: (id: string, decision: XiaozhiDecisionInput['decision']) => Promise<void>;
  onAnswer: (id: string, answer: string) => Promise<void>;
  onMutation: (input: XiaozhiQueueMutationInput) => Promise<void>;
}): OfficeInteraction[] {
  if (!snapshot || snapshot.projection.threadId !== sessionId) return [];
  const running = Boolean(snapshot.running);
  const learning = snapshot.learningReviews || [], learningBatches = new Map<string, LearningReviewSummary[]>();
  for (const item of learning) if (item.state === 'pending') learningBatches.set(item.runId, [...(learningBatches.get(item.runId) || []), item]);
  const managed=new Set((snapshot.deliveries||[]).flatMap(d=>d.files.filter(f=>!f.carried).map(f=>f.draftId)));
  const entries: OfficeInteraction[] = [
    ...(snapshot.deliveries||[]).map(item=>({id:`delivery:${item.id}`,runId:item.runId,callId:item.callId,kind:'delivery' as const,content:<PiDeliveryBundleCard delivery={item} sessionId={sessionId} running={running} onRefresh={onRefresh} onOpen={onOpen}/>})),
    ...(snapshot.task&&(!snapshot.task.goal||snapshot.task.goal.id!==snapshot.goal?.id)&&snapshot.task.origin.runId!==snapshot.goal?.runId?[{id:`task:${snapshot.task.id}`,runId:snapshot.task.lastRunId||snapshot.task.origin.runId,kind:'task_review' as const,content:<PiTaskReview sessionId={sessionId} task={snapshot.task} running={running} onRefresh={onRefresh}/>}]:[]),
    ...(snapshot.approvals || []).map(item => ({ id: `approval:${item.id}`, runId: item.runId, callId: item.callId, kind: 'approval' as const,
      content: item.permission ? <PiPermissionApproval approval={item.permission} onRefresh={onRefresh}/>
        : <PiCopyApproval approval={item} onDecision={onDecision} /> })),
    ...(snapshot.changes || []).filter(item=>!managed.has(item.id)).map(item => ({ id: `change:${item.id}`, runId: item.runId, callId: item.callId, kind: 'change' as const,
      content: <PiTextChangeCard sessionId={sessionId} change={item} running={running} onRefresh={onRefresh} onOpen={onOpen} /> })),
    ...(snapshot.officeArtifacts || []).filter(item=>!managed.has(item.id)).map(item => ({ id: `artifact:${item.id}`, runId: item.runId, callId: item.callId, kind: 'artifact' as const,
      content: <PiOfficeArtifactCard sessionId={sessionId} artifact={item} running={running} onRefresh={onRefresh} onOpen={onOpen} /> })),
    ...learning.filter(item => item.state !== 'pending').map(item => ({ id: `learning:${item.id}`, runId: item.runId, callId: item.callId, kind: 'learning' as const,
      content: <PiLearningReview sessionId={sessionId} review={item} onRefresh={onRefresh} /> })),
    ...[...learningBatches].map(([runId, reviews]) => ({ id: `learning-batch:${runId}`, runId, kind: 'learning' as const,
      content: <PiLearningReviewSet sessionId={sessionId} reviews={reviews} onRefresh={onRefresh} /> })),
    ...(snapshot.questionCollections || []).map(item => ({ id: `collection:${item.id}`, runId: item.runId, callId: item.callId, kind: 'collection' as const,
      content: <PiQuestionCollection sessionId={sessionId} review={item} onRefresh={onRefresh} /> })),
    ...(snapshot.questionReviews || []).filter(item => !item.collectionId && !item.originalBatch).map(item => ({ id: `question-review:${item.id}`, runId: item.runId, callId: item.callId, kind: 'question_review' as const,
      content: <PiQuestionReview sessionId={sessionId} review={item} onRefresh={onRefresh} /> })),
    ...(snapshot.paperReviews || []).map(item => ({ id: `paper:${item.id}`, runId: item.runId, callId: item.callId, kind: 'paper' as const,
      content: <PiPaperReview sessionId={sessionId} review={item} running={running} onRefresh={onRefresh} /> })),
    ...(snapshot.practiceReviews || []).map(item => ({ id: `practice:${item.id}`, runId: item.runId, callId: item.callId, kind: 'practice' as const,
      content: <PiPracticeReview sessionId={sessionId} review={item} onRefresh={onRefresh} /> })),
    ...(snapshot.controls || []).filter(item => item.kind !== 'plan').map(item => ({ id: `control:${item.id}`, runId: item.runId, callId: item.callId,
      kind: item.kind as 'question' | 'instruction', content: <PiControlCards items={[item]} sessionId={sessionId} onAnswer={onAnswer} onMutation={onMutation} /> })),
  ];
  const originals = (snapshot.questionReviews || []).filter(item => item.originalBatch);
  for (const runId of new Set(originals.map(item => item.runId))) {
    for (const [groupId, reviews] of originalReviewGroups(originals.filter(item => item.runId === runId))) {
      const calls = new Set(reviews.map(item => item.originalBatch?.rootCallId || item.callId));
      const callId = [...(snapshot.projection.turns.find(turn => turn.id === runId)?.items || [])].reverse()
        .find(item => item.kind === 'tool' && calls.has(item.id))?.id;
      entries.push({ id: `original:${runId}:${groupId}`, runId, callId, kind: 'original_batch',
        content: <PiOriginalQuestionBatchReview sessionId={sessionId} reviews={reviews} onRefresh={onRefresh} /> });
    }
  }
  return entries;
}
