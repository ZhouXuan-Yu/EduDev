import type {TeacherProfile} from './teacher-memory-settings';
import type {TeacherPreferenceValues} from './teacher-preferences';
import type {PermissionMode} from './xiaozhi-permissions';
import type {ThinkingChoice} from './xiaozhi-thinking';
import type {AiAgentRunStatus} from './contracts';

export type ResolvedConfigQuery = {sessionId?:string;runId?:string};
export type ConfigSource='session_binding'|'session_selection'|'global'|'legacy_compat'|'environment'|'default'
  |'teacher_profile'|'teacher_preferences'|'session_memory'|'permission_profile'|'saved_run';
export type ConfigObservation<T> = {
  value:T|null;
  source:ConfigSource|null;
  revision:number|string|null;
  status:'valid'|'unavailable'|'invalid'|'not_applicable';
};
export type PreparedAgentConfig = {
  schemaVersion:1;
  operation:'prompt'|'compact';
  model:Pick<ConfigObservation<string>,'source'|'revision'|'status'>;
  thinking:{source:'session_selection'|'global'|'default';revision:number|null;requested:ThinkingChoice;effective:ThinkingChoice};
  teacher:{observedRevision:number;policyRevision:number|null;longTermApplied:boolean;eventRecorded:boolean;decisionId:string|null};
  native:{generation:number;markerId:string};
};
export type PreparedAgentConfigView = {
  status:'prepared'|'not_recorded'|'invalid'|'unavailable';
  runId:string|null;
  runStatus:AiAgentRunStatus|null;
  receipt:(PreparedAgentConfig & {capturedAt:string;modelValue:string})|null;
};
export type ResolvedAgentConfig = {
  schemaVersion:1;
  observedAt:string;
  consistency:'snapshot'|'stale';
  session:{id:string;title:string}|null;
  model:ConfigObservation<string>;
  thinking:ConfigObservation<ThinkingChoice>;
  lastRun:ConfigObservation<{runId:string;model:string;requested:ThinkingChoice;effective:ThinkingChoice}>;
  prepared:PreparedAgentConfigView;
  teacher:ConfigObservation<TeacherProfile>;
  preferences:ConfigObservation<{savedCount:number;scopeCounts:Record<'relevant'|'profile'|'off',number>}>
    & {application:'requires_task_context'|'disabled'|'unknown';temporary:'not_persisted'; textbook:'reference_only'};
  memory:ConfigObservation<{enabled:boolean;selectedCount:number}>;
  permission:ConfigObservation<PermissionMode>;
  credential:ConfigObservation<boolean>&{verification:'not_checked'};
};
export type ResolvedAgentConfigResult =
  |{ok:true;value:ResolvedAgentConfig}
  |{ok:false;error:'invalid_input'|'permission_denied'|'unavailable'};

export type ResolvedPreferenceKey=keyof TeacherPreferenceValues;
