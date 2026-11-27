export type HistorySourceKind = 'history_request' | 'history_control';
export type HistorySourceRef = { kind: HistorySourceKind; sessionId: string; recordId: string; sourceVersion: string };
export type HistoryMemoryMode = 'active' | 'disabled' | 'forgotten';
export type HistorySource = {
  sourceId: string;
  ref: HistorySourceRef;
  label: string;
  sessionTitle: string;
  accessRevision: number;
  generation: number;
  allowed: boolean;
  state: HistoryMemoryMode;
  cleanup: 'none' | 'pending' | 'done';
};
export type HistorySelection = { layer: 'history'; source: 'history'; id: string; version: number; sourceVersion: string };
export type HistoryPreview = { source: HistorySource; text: string; offset: number; nextOffset: number | null };
export type HistoryCandidate = HistorySource & {ticket:string};
export type HistoryDiscovery = { candidates: HistoryCandidate[]; mode: 'local' | 'hindsight'; reason?: 'empty_scope' | 'service_unavailable'; elapsedMs: number };
export type HistoryAccessAction = 'allow' | 'revoke' | 'disable' | 'restore' | 'forget';
export type HistoryMemoryError = 'invalid_input' | 'permission_denied' | 'command_conflict' | 'source_changed' | 'source_unavailable' | 'busy' | 'configuration';
export type HistoryIndexStatus = {configured:boolean;active:number;rebuilding:number|null;ready:number;pending:number;failed:number};
export type HistoryResult<T> = {ok:true; value:T} | {ok:false; error:HistoryMemoryError};

export type TaskHistoryUseStage='selected'|'source_read'|'delivered'|'verified';
export type TaskHistoryScope={taskId:string;revision:number;excludeSessionHistory?:true;runOutcome?:'failed';items:Array<{
  sourceId:string;label:string;useStage:TaskHistoryUseStage;
}>};
export type TaskHistoryRemoval = {sessionId:string;taskId:string;revision:number;sourceId:string};
export function validTaskHistoryRemoval(value:unknown):value is TaskHistoryRemoval {
  if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).length!==4)return false;
  const {sessionId,taskId,revision,sourceId}=value as Partial<TaskHistoryRemoval>;
  return typeof sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/iu.test(sessionId)&&
    typeof taskId==='string'&&/^xitask_[a-f0-9]{64}$/u.test(taskId)&&
    typeof revision==='number'&&Number.isSafeInteger(revision)&&revision>0&&
    typeof sourceId==='string'&&/^[a-f0-9]{64}$/u.test(sourceId);
}

export type PendingHistoryReference = {token:string;sourceId:string;scopeVersion:number;title:string};

export function validHistoryIntentIds(value:unknown):value is string[] {
  return Array.isArray(value) && value.length>0 && value.length<=12 &&
    value.every(token=>typeof token==='string' && /^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/u.test(token)) &&
    new Set(value).size===value.length;
}
