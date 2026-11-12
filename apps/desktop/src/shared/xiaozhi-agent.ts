// Public education-agent events. Provider-returned reasoning is an explicit bounded channel;
// raw SDK messages, signatures and the rest of the native transcript stay in main.
import type { OfficeProjection } from './office-agent';
import type { XiaozhiMemoryScope } from './xiaozhi-memory';
import type { XiaozhiSkill } from './xiaozhi-skills';
import type { XiaozhiChangeSummary } from './xiaozhi-changes';
import type { OfficeArtifactSummary } from './xiaozhi-office-artifacts';
export type XiaozhiAgentError = 'paper_export_source_changed' | 'paper_export_restart_required' | 'invalid_input' | 'busy' | 'configuration' | 'event_persistence' | 'event_recovered' | 'authentication'
  | 'rate_limited' | 'insufficient_balance' | 'provider_unavailable' | 'timeout' | 'transport' | 'cancelled' | 'model_error' | 'goal_stalled' | 'goal_review_extended' | 'command_conflict' | 'permission_denied' | 'workspace_locked' | 'budget_exhausted' | 'nothing_to_compact' | 'context_limit' | 'compaction_failed' | 'memory_scope_changed' | 'skill_source_changed' | 'skill_scope_changed' | 'attachment_changed';
export type XiaozhiModelCapabilities = { id: string; name: string; contextWindow: number; maxOutputTokens: number;
  /** Absent in older catalogues means unknown, never an inferred image grant. */
  inputModalities?: ('text' | 'image')[];
  effort?: { supportedLevels: ('low' | 'high' | 'max')[]; defaultLevel?: 'low' | 'high' | 'max' };
  observedAt: string; source: 'official' | 'cache'; stale?: boolean };
export type XiaozhiContextPolicy = { auto: boolean; window: number; maxOutputTokens: number; verified: boolean; testPolicy?: boolean };
export type XiaozhiCompactInput = { sessionId: string; commandId: string };
export type XiaozhiBudget = { maxModelCalls: number; maxToolCalls: number; maxTokens: number; activeMs: number; waitMs: number };
export type XiaozhiBudgetSettings = { version: number; budget: XiaozhiBudget };
export type XiaozhiBudgetInput = { sessionId: string; version: number; budget: XiaozhiBudget };
export type XiaozhiBrowserStatus={open:boolean;tabs?:{tabId:string;title:string;url:string;active:boolean}[]};
export type XiaozhiUsage = { runId: string; budget: XiaozhiBudget; modelCalls: number; toolCalls: number;
  limitsEnforced?: boolean;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number } | null;
  completeness: 'unknown' | 'reported' | 'partial'; cost: null; activeMs: number; waitingMs: number;
  state: 'running' | 'waiting' | 'completed' | 'interrupted' | 'failed';
  exhausted?: 'model_calls' | 'tool_calls' | 'tokens' | 'active_time' | 'wait_time' };
export type XiaozhiApprovalState = 'pending' | 'approved' | 'executing' | 'executed' | 'rejected' | 'interrupted' | 'uncertain' | 'verified' | 'failed';
export type XiaozhiApproval = { id: string; runId: string; callId: string; source: string; target: string; state: XiaozhiApprovalState; permission?: import('./xiaozhi-permissions').PermissionApproval };
export type XiaozhiDecisionInput = { sessionId: string; approvalId: string; decision: 'approve' | 'reject' | 'verify' };
export type XiaozhiActionResult = { ok: true } | { ok: false; error: XiaozhiAgentError };
export type XiaozhiPlanStep = { text: string; status: 'pending' | 'in_progress' | 'completed';id?:string;dependsOn?:string[] };
export type XiaozhiControl = { id: string; runId: string; kind: 'plan' | 'question' | 'instruction';
  state: 'pending' | 'answered' | 'queued' | 'dispatching' | 'withdrawn' | 'applied' | 'interrupted' | 'resuming';
  text: string; revision?: number; steps?: XiaozhiPlanStep[];plan?:import('./xiaozhi-plan').PlanMetadata; options?: string[]; answer?: string; mode?: 'steer' | 'followUp'; canResume?: boolean; callId?:string };
export type XiaozhiControlInput = { sessionId: string; controlId: string; answer: string };
export type XiaozhiQueueInput = { sessionId: string; commandId: string; text: string; mode: 'steer' | 'followUp' };
export type XiaozhiQueueMutationInput = { sessionId: string; controlId: string; revision: number }
  & ({ action: 'edit'; text: string; mode: 'steer' | 'followUp' } | { action: 'withdraw' });
export type XiaozhiAgentEventPayload = (
  {kind:'model_request';request:import('./xiaozhi-model-request').XiaozhiModelRequest} |
  { kind: 'activity'; stage: 'preparing' | 'waiting_model' | 'responding'; since: number }
  |
  { kind: 'text_delta'; delta: string }
  | { kind: 'model_reasoning'; block: import('./office-agent').OfficeModelReasoning }
  | { kind:'assistant_start'; segment:number }
  | { kind:'assistant_phase'; segment:number; phase:'commentary'|'final_answer'; since:number }
  | { kind:'assistant_end'; segment:number; final:boolean; since?:number }
  | { kind: 'tool_output'; callId: string; terminal: import('./xiaozhi-terminal').XiaozhiTerminalOutput }
  | { kind: 'tool_start'; callId: string; tool: string }
  | { kind:'tool_attempt';attempt:import('./xiaozhi-tool-attempt').XiaozhiToolAttempt }
  | { kind: 'recovery'; recovery:import('./xiaozhi-recovery').XiaozhiRecovery }
  | { kind: 'tool_end'; callId: string; tool: string; success: boolean; terminalState?: import('./xiaozhi-terminal').XiaozhiTerminalOutput['state']; durationMs?: number; resultSummary?: import('./office-agent').OfficeProjectedItem['resultSummary']; source?: string; sources?: import('./xiaozhi-web').XiaozhiPublicSource[]; webError?: import('./xiaozhi-web').XiaozhiWebError; webEmpty?: boolean;browserCapture?:import('./xiaozhi-browser-capture').BrowserCapture }
  | { kind: 'approval'; approval: XiaozhiApproval }
  | { kind: 'change'; change: XiaozhiChangeSummary }
  | { kind: 'office_artifact'; artifact: OfficeArtifactSummary }
  | { kind:'delivery_bundle';delivery:import('./xiaozhi-delivery').DeliverySummary }
  | { kind:'learning_review';review:import('./learning-review').LearningReviewSummary }
  | { kind:'question_collection';review:import('./question-collection').QuestionCollectionSummary }
  | { kind:'question_review';review:import('./question-review').QuestionReviewSummary }
  | { kind:'paper_review';review:import('./paper-blueprint').PaperSummary }
  | { kind:'practice_review';review:import('./practice-review').PracticeReviewSummary }
  | { kind: 'control'; control: XiaozhiControl }
    | {kind:'goal';goal:import('./xiaozhi-goal').XiaozhiGoal}
    | {kind:'task';task:import('./xiaozhi-task').TaskView;goal?:import('./xiaozhi-goal').XiaozhiGoal}
  | { kind:'image_delivery'; image:import('./xiaozhi-public-images').PublicImageDelivery }
  | { kind: 'usage'; usage: XiaozhiUsage }
  | { kind: 'verification'; verification: import('./xiaozhi-verification').TaskVerification }
  | { kind: 'compaction'; state: 'running' | 'completed' | 'failed'; id?: number; automatic?: boolean; error?: XiaozhiAgentError; tokensBefore?: number; estimatedTokensAfter?: number }
  | { kind: 'memory_isolation'; excludedRuns: number; reason?: 'memory_authority' | 'interrupted_tool' }
  | { kind: 'skill_isolation'; excludedRuns: number; reason?: 'skill_authority' | 'interrupted_tool' }
  | { kind: 'status'; status: 'running' | 'completed' | 'interrupted' | 'failed'; error?: XiaozhiAgentError; finishedAt?:number }
) & { /** SDK capture order, independent of asynchronous reasoning sanitization. */ traceOrder?:number; capturedAt?:number; schemaVersion?: 1; generation?: number; revision?: number; durability?: 'committed' | 'unavailable' };
export type XiaozhiAgentEvent = { sessionId: string; runId: string; sequence: number } & XiaozhiAgentEventPayload;
export type XiaozhiAgentResult = { ok: true; runId: string; text: string; truncated: boolean }
  | { ok: false; runId: string; error: XiaozhiAgentError };
export type XiaozhiStartInput = { paperExportIntent?: import('./paper-export').PaperExportIntent; resumeDeliveryId?: string; classroomPlan?: import('./classroom-plan').ClassroomPlanStart; continueTask?: import('./xiaozhi-start').TaskContinuation; sessionId: string; prompt: string; commandId: string; presentation?: import('./xiaozhi-message-presentation').XiaozhiMessagePresentation; attachments?: import('./xiaozhi-attachments').XiaozhiAttachmentSelection[] };
export type XiaozhiStartResult = { ok: true; runId: string } | { ok: false; error: XiaozhiAgentError };
export type XiaozhiWorkspaceSnapshot = { fileWritesEnabled?:boolean; deliveries?:import('./xiaozhi-delivery').DeliverySummary[]; task?:import('./xiaozhi-task').TaskView;taskUnavailable?:boolean; eventCursors?:import('./xiaozhi-events').XiaozhiEventCursor[]; eventPersistence?:'unavailable'; enabled: boolean; projection: OfficeProjection; running: boolean; operation?: 'compact'; modelCapabilities?: XiaozhiModelCapabilities; contextPolicy?: XiaozhiContextPolicy; legacyHistory: boolean; interruptedSend?: boolean; approvals?: XiaozhiApproval[]; changes?: XiaozhiChangeSummary[]; officeArtifacts?: OfficeArtifactSummary[]; controls?: XiaozhiControl[]; goal?: import('./xiaozhi-goal').XiaozhiGoal; workspace?: { label: string }; paperOutput?: {label:string}; budgetSettings?: XiaozhiBudgetSettings; limitsEnforced?: boolean; browser?:XiaozhiBrowserStatus; usage?: XiaozhiUsage[]; memoryScope?: XiaozhiMemoryScope; skills?: XiaozhiSkill[];paperReviews?:import('./paper-blueprint').PaperSummary[];practiceReviews?:import('./practice-review').PracticeReviewSummary[];questionCollections?:import('./question-collection').QuestionCollectionSummary[];questionReviews?:import('./question-review').QuestionReviewSummary[];learningReviews?:import('./learning-review').LearningReviewSummary[];studentContext?:import('./student-context').StudentContextSelection };
export type XiaozhiHistoryPageInput = { sessionId: string; before: string; limit?: number };
export type XiaozhiHistoryPage = {
  schemaVersion: 1;
  sessionId: string;
  projection: OfficeProjection;
  eventCursors: import('./xiaozhi-events').XiaozhiEventCursor[];
  legacyHistory: boolean;
};
export function validXiaozhiHistoryPageInput(value: unknown): value is XiaozhiHistoryPageInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).every(key => ['sessionId', 'before', 'limit'].includes(key))
    && typeof row.sessionId === 'string' && /^aisession_[a-f0-9-]{36}$/i.test(row.sessionId)
    && typeof row.before === 'string' && /^[A-Za-z0-9_-]{1,200}$/.test(row.before)
    && (row.limit === undefined || Number.isSafeInteger(row.limit) && Number(row.limit) >= 1 && Number(row.limit) <= 40);
}
