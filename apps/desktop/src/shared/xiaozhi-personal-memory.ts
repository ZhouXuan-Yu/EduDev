export type PersonalMemoryScope = {kind:'teacher'|'class'|'course'|'task'|'artifact'; id:string};
export type PersonalMemorySelection = {layer:'personal'; source:'personal'; id:string; version:number; sourceVersion:string};
export type PersonalMemoryKind = 'preference'|'teaching_context';
export type PersonalMemoryError = 'invalid_input'|'permission_denied'|'revision_conflict'|'command_conflict'
  | 'source_changed'|'stale_policy'|'cancelled'|'busy'|'configuration';
export type PersonalMemoryResult<T> = {ok:true; value:T}|{ok:false; error:PersonalMemoryError};

export type PersonalMemoryPolicy = {enabled:boolean; pausedByUsePolicy:boolean; policyRevision:number};
export type PersonalMemoryPolicyInput = {enabled:boolean; revision:number};
export type PersonalMemorySummary = {id:string; revision:number; kind:PersonalMemoryKind;
  scope:PersonalMemoryScope; term:string; value:string; sourceVersion:string; sourceOccurredAt:string|null; sourceCurrent:boolean;
  state:'active'|'disabled'|'forgotten'; cleanupPending:boolean};
export type PersonalMemoryCandidate = {key:string; revision:number; kind:PersonalMemoryKind;
  scope:PersonalMemoryScope; term:string; state:'pending'|'conflict'; value:string; targetRevision:number};
export type PersonalMemoryView = {policy:PersonalMemoryPolicy; records:PersonalMemorySummary[]; candidates:PersonalMemoryCandidate[]};
export type PersonalMemoryReview = {quote:string; quoteSha256:string; occurredAt:string|null};
export type PersonalMemoryCandidateInput = {key:string; revision:number};
export type PersonalMemoryRecordInput = {id:string; revision:number};
export type PersonalMemoryAdoptInput = PersonalMemoryCandidateInput &
  {operationId:string; targetRevision:number; reviewedQuoteSha256:string};
export type PersonalMemoryEditInput = {operationId:string; id:string; revision:number} &
  ({action:'edit'; value:string}|{action:'disable'|'restore'|'forget'});
export type PersonalMemoryReceipt = {operationId:string; id:string; revision:number};
import type {HistorySourceRef} from './xiaozhi-history-memory';

export type PersonalMemorySourcePermission = {allowed:boolean; revision:number};
export type PersonalMemorySourceInput = {ref:HistorySourceRef; enabled:boolean; revision:number};
