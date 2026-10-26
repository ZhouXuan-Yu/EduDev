import type {TeacherPreferenceValues} from './teacher-preferences';
export type TeacherCandidateStatus='collecting'|'trial'|'accepted'|'failed'|'superseded';
export type TeacherCandidateReason='source_changed'|'legacy_source'|'baseline_changed'|'teacher_rejected'|'quality_failed'|'metric_changed';
export type TeacherCandidateSummary={id:string;revision:number;status:TeacherCandidateStatus;reason?:TeacherCandidateReason;patch:TeacherPreferenceValues;baselineRevision:number;sourceCurrent:boolean;baselineCurrent:boolean;training:{total:number;evaluated:number;passed:number};holdout:'not_started'|'waiting'|'passed'|'failed';metric:'presentation_only';activeVersion?:number};
export type TeacherCandidateInput={sessionId:string;id:string;revision:number};
export type TeacherCandidateResult<T>={ok:true;value:T}|{ok:false;error:'invalid_input'|'permission_denied'|'configuration'|'conflict'|'busy'};
