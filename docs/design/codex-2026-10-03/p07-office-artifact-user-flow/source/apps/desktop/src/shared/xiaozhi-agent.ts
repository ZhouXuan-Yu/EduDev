// Public education-agent events; SDK messages and private reasoning stay in main.
import type { OfficeProjection } from './office-agent';
import type { XiaozhiMemoryScope } from './xiaozhi-memory';
import type { XiaozhiSkill } from './xiaozhi-skills';
import type { XiaozhiChangeSummary } from './xiaozhi-changes';
import type { OfficeArtifactSummary } from './xiaozhi-office-artifacts';
export type XiaozhiAgentError = 'invalid_input' | 'busy' | 'configuration' | 'authentication'
  | 'rate_limited' | 'timeout' | 'transport' | 'cancelled' | 'model_error' | 'command_conflict' | 'permission_denied' | 'workspace_locked' | 'budget_exhausted' | 'nothing_to_compact' | 'context_limit' | 'compaction_failed' | 'memory_scope_changed' | 'skill_source_changed' | 'skill_scope_changed';
export type XiaozhiModelCapabilities = { id: string; name: string; contextWindow: number; maxOutputTokens: number; observedAt: string; source: 'official' | 'cache'; stale?: boolean };
export type XiaozhiContextPolicy = { auto: boolean; window: number; maxOutputTokens: number; verified: boolean; testPolicy?: boolean };
export type XiaozhiCompactInput = { sessionId: string; commandId: string };
export type XiaozhiBudget = { maxModelCalls: number; maxToolCalls: number; maxTokens: number; activeMs: number; waitMs: number };
export type XiaozhiBudgetSettings = { version: number; budget: XiaozhiBudget };
export type XiaozhiBudgetInput = { sessionId: string; version: number; budget: XiaozhiBudget };
export type XiaozhiUsage = { runId: string; budget: XiaozhiBudget; modelCalls: number; toolCalls: number;
  tokens: { input: number; output: number; cacheRead: number; cacheWrite: number; total: number } | null;
  completeness: 'unknown' | 'reported' | 'partial'; cost: null; activeMs: number; waitingMs: number;
  state: 'running' | 'waiting' | 'completed' | 'interrupted' | 'failed';
  exhausted?: 'model_calls' | 'tool_calls' | 'tokens' | 'active_time' | 'wait_time' };
export type XiaozhiApprovalState = 'pending' | 'approved' | 'executing' | 'executed' | 'rejected' | 'interrupted' | 'uncertain' | 'verified' | 'failed';
export type XiaozhiApproval = { id: string; runId: string; callId: string; source: string; target: string; state: XiaozhiApprovalState };
export type XiaozhiDecisionInput = { sessionId: string; approvalId: string; decision: 'approve' | 'reject' | 'verify' };
export type XiaozhiActionResult = { ok: true } | { ok: false; error: XiaozhiAgentError };
export type XiaozhiPlanStep = { text: string; status: 'pending' | 'in_progress' | 'completed' };
export type XiaozhiControl = { id: string; runId: string; kind: 'plan' | 'question' | 'instruction';
  state: 'pending' | 'answered' | 'queued' | 'dispatching' | 'withdrawn' | 'applied' | 'interrupted' | 'resuming';
  text: string; revision?: number; steps?: XiaozhiPlanStep[]; options?: string[]; answer?: string; mode?: 'steer' | 'followUp'; canResume?: boolean; callId?:string };
export type XiaozhiControlInput = { sessionId: string; controlId: string; answer: string };
export type XiaozhiQueueInput = { sessionId: string; commandId: string; text: string; mode: 'steer' | 'followUp' };
export type XiaozhiQueueMutationInput = { sessionId: string; controlId: string; revision: number }
  & ({ action: 'edit'; text: string; mode: 'steer' | 'followUp' } | { action: 'withdraw' });
export type XiaozhiAgentEventPayload = (
  { kind: 'text_delta'; delta: string }
  | { kind:'assistant_start'; segment:number }
  | { kind:'assistant_end'; segment:number; final:boolean }
  | { kind: 'tool_start'; callId: string; tool: string }
  | { kind: 'tool_end'; callId: string; tool: string; success: boolean; durationMs?: number; source?: string; sources?: { title: string }[] }
  | { kind: 'approval'; approval: XiaozhiApproval }
  | { kind: 'change'; change: XiaozhiChangeSummary }
  | { kind: 'office_artifact'; artifact: OfficeArtifactSummary }
  | { kind: 'control'; control: XiaozhiControl }
  | { kind: 'usage'; usage: XiaozhiUsage }
  | { kind: 'compaction'; state: 'running' | 'completed' | 'failed'; id?: number; automatic?: boolean; error?: XiaozhiAgentError; tokensBefore?: number; estimatedTokensAfter?: number }
  | { kind: 'memory_isolation'; excludedRuns: number; reason?: 'memory_authority' | 'interrupted_tool' }
  | { kind: 'skill_isolation'; excludedRuns: number; reason?: 'skill_authority' | 'interrupted_tool' }
  | { kind: 'status'; status: 'running' | 'completed' | 'interrupted' | 'failed'; error?: XiaozhiAgentError }
);
export type XiaozhiAgentEvent = { sessionId: string; runId: string; sequence: number } & XiaozhiAgentEventPayload;
export type XiaozhiAgentResult = { ok: true; runId: string; text: string; truncated: boolean }
  | { ok: false; runId: string; error: XiaozhiAgentError };
export type XiaozhiStartInput = { sessionId: string; prompt: string; commandId: string };
export type XiaozhiStartResult = { ok: true; runId: string } | { ok: false; error: XiaozhiAgentError };
export type XiaozhiWorkspaceSnapshot = { enabled: boolean; projection: OfficeProjection; running: boolean; operation?: 'compact'; modelCapabilities?: XiaozhiModelCapabilities; contextPolicy?: XiaozhiContextPolicy; legacyHistory: boolean; interruptedSend?: boolean; approvals?: XiaozhiApproval[]; changes?: XiaozhiChangeSummary[]; officeArtifacts?: OfficeArtifactSummary[]; controls?: XiaozhiControl[]; workspace?: { label: string }; budgetSettings?: XiaozhiBudgetSettings; usage?: XiaozhiUsage[]; memoryScope?: XiaozhiMemoryScope; skills?: XiaozhiSkill[] };
