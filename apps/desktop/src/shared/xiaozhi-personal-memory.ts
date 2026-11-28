export type PersonalMemoryScope = {kind:'teacher'|'class'|'course'|'task'|'artifact'; id:string};
export type PersonalMemorySelection = {layer:'personal'; source:'personal'; id:string; version:number; sourceVersion:string};
export type PersonalMemoryKind = 'preference'|'teaching_context';
// Business roles describe the authority being read. Classification never grants access.
export const teacherMemoryCategories = {
  teacher_profile: {layer:'L3', family:'semantic', authority:'teacher_profile', label:'教学画像'},
  teaching_preference: {layer:'L3', family:'semantic', authority:'teacher_preference', label:'教学偏好'},
  teaching_context: {layer:'L3', family:'semantic', authority:'teaching_context', label:'教学情境'},
  task_requirement: {layer:'L1', family:'working', authority:'task', label:'当前任务要求'},
  work_experience: {layer:'L2', family:'episodic', authority:'session_task_effect', label:'历史工作经历'},
  artifact_reference: {layer:'L2', family:'episodic', authority:'artifact_version', label:'历史成果关联'},
  reusable_method: {layer:'L4', family:'procedural', authority:'verified_method', label:'可复用工作方法'},
} as const;

/** Read-only evidence about the current task. A method requires independent validation. */
export type MethodReviewEvidence = {
  category:'reusable_method';
  scope:'current_task';
  requirementsVersion:number;
  teacherAccepted:number;
  teacherRejected:number;
  readbackPassed:number;
  independentValidation:'not_established';
};

export function isPersonalMemoryKind(value:unknown):value is PersonalMemoryKind {
  return value === 'preference' || value === 'teaching_context';
}

export function personalMemoryCategory(kind:PersonalMemoryKind) {
  return kind === 'preference' ? 'teaching_preference' : 'teaching_context';
}
export type PersonalMemoryError = 'invalid_input'|'permission_denied'|'revision_conflict'|'command_conflict'
  | 'source_changed'|'stale_policy'|'cancelled'|'busy'|'configuration';
export type PersonalMemoryResult<T> = {ok:true; value:T}|{ok:false; error:PersonalMemoryError};

export type PersonalMemoryPolicy = {enabled:boolean; pausedByUsePolicy:boolean; policyRevision:number};
export type PersonalMemoryPolicyInput = {enabled:boolean; revision:number};
export type PersonalMemorySummary = {category:ReturnType<typeof personalMemoryCategory>; evidence:'teacher_confirmed'; recordedAt:number; id:string; revision:number; kind:PersonalMemoryKind;
  scope:PersonalMemoryScope; term:string; value:string; sourceVersion:string; sourceOccurredAt:string|null; sourceCurrent:boolean; contentRestricted:boolean;
  state:'active'|'disabled'|'forgotten'; cleanupPending:boolean};
export type PersonalMemoryCandidate = {key:string; revision:number; kind:PersonalMemoryKind;
  category:ReturnType<typeof personalMemoryCategory>; evidence:'ai_inferred'; recordedAt:number|null; sourceOccurredAt:string|null;
  scope:PersonalMemoryScope; term:string; state:'pending'|'conflict'; value:string; targetRevision:number};
export type PersonalMemoryJob = {id:string; revision:string; kind:'extract'|'organize';
  state:'pending'|'running'|'waiting_budget'|'succeeded'|'partial'|'failed'|'cancelled';
  saved:number|null; notSaved:number|null; error:string|null; outbound:boolean};
export type PersonalMemoryCancelJobInput = {id:string; revision:string};
export type PersonalMemoryCancelJobReceipt = {state:PersonalMemoryJob['state']; cancelled:boolean; outbound:boolean};
export type PersonalMemoryQueue = {policy:PersonalMemoryPolicy; candidates:PersonalMemoryCandidate[]};
export type PersonalMemoryView = PersonalMemoryQueue & {records:PersonalMemorySummary[]; jobs:PersonalMemoryJob[]; workerAvailable:boolean};
export type PersonalMemoryReview = {quote:string; quoteSha256:string; occurredAt:string|null};
export type PersonalMemoryCandidateInput = {key:string; revision:number};
export type PersonalMemoryRecordInput = {id:string; revision:number};
export type PersonalMemoryAdoptInput = PersonalMemoryCandidateInput &
  {operationId:string; targetRevision:number; reviewedQuoteSha256:string};
export type PersonalMemoryEditInput = {operationId:string; id:string; revision:number} &
  ({action:'edit'; value:string}|{action:'disable'|'restore'|'forget'});
export type PersonalMemoryReceipt = {operationId:string; id:string; revision:number};
import type {HistorySourceRef} from './xiaozhi-history-memory';

export type PersonalMemorySourcePermission = {allowed:boolean; revision:number; teachingTarget?:{term:string;version:number}};
export type PersonalMemorySourceInput = {ref:HistorySourceRef; enabled:boolean; revision:number; teachingTargetVersion?:number};
