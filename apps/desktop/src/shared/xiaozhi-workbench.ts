import type {PermissionApproval} from './xiaozhi-permissions';
import type {XiaozhiApproval, XiaozhiApprovalState} from './xiaozhi-agent';
import type {TaskView} from './xiaozhi-task';

export const WORKBENCH_SCHEMA = 1 as const;
export type WorkbenchApprovalState = PermissionApproval['state'] | XiaozhiApprovalState;
export type WorkbenchApprovalRef =
  | {kind: 'permission_v2'; sessionId: string; id: string; revision: number}
  | {kind: 'legacy_copy'; sessionId: string; id: string; etag: string};
type PageQuery = {schemaVersion: 1; sessionId?: string; cursor?: string; limit?: number};
export type WorkbenchQuery =
  | PageQuery & {kind: 'tasks'; filter: 'unfinished' | 'resumable' | 'blocked' | 'completed' | 'ended' | 'all'}
  | PageQuery & {kind: 'approvals'; state?: WorkbenchApprovalState | 'all'}
  | {schemaVersion: 1; kind: 'approval_detail'; ref: WorkbenchApprovalRef}
  | PageQuery & {kind: 'capabilities'; taskId?: string; requirementsVersion?: number; query?: string};

export type WorkbenchSourceFailure = {
  source: 'tasks' | 'sessions' | 'approvals' | 'registry' | 'acquisition' | 'mcp' | 'extensions';
  code: 'corrupt' | 'unavailable' | 'not_initialized'; records: number | null;
};
export type WorkbenchPage<T> = {
  schemaVersion: 1; asOf: string; items: T[];
  total: number | null; matched: number | null; counts: Record<string, number> | null;
  nextCursor: string | null; partial: boolean; unavailableCount: number;
  sourceFailures: WorkbenchSourceFailure[]; scanned: number;
};
export type WorkbenchTaskRow = {
  sessionId: string; sessionTitle: string; taskId: string; revision: number; requirementsVersion: number;
  state: TaskView['state']; updatedAt: string; lastRunId: string; isLatestForSession: boolean;
  resumeCandidate: boolean; continuationCandidate: boolean; blockedReasons: string[];
  pendingApprovalCount: number | null; unknownEffectCount: number | null;
  planningLevel: 1 | 2 | 3 | null; nativeInspection: 'not_checked';
};
export type WorkbenchApprovalRow = {
  ref: WorkbenchApprovalRef; kind: WorkbenchApprovalRef['kind']; id: string;
  revision: number | null; etag: string | null; sessionId: string; sessionTitle: string;
  taskId: string | null; runId: string; state: WorkbenchApprovalState;
  purpose: string; resources: string[];
  classification: 'public' | 'redacted' | 'teacher_private' | 'student_private' | 'unknown';
  expiresAt: string | null; updatedAt: string; canDecide: boolean; blockedReasons: string[];
};
export type WorkbenchCapabilityRow = {
  id: string; capabilityId: string | null; providerId: string | null; name: string; version: string;
  origin: 'registered' | 'candidate' | 'installed'; sourceKind: 'registry' | 'acquisition' | 'mcp' | 'extension';
  source: string; sourceHash: string | null; schemaHash: string | null; license: string | null;
  installed: 'bundled' | 'installed' | 'missing' | 'unknown';
  verification: 'verified' | 'pending' | 'expired' | 'failed' | 'revoked' | 'quarantined' | 'unknown';
  authorization: 'allowed' | 'required' | 'revoked' | 'task_check_required';
  availability: 'full' | 'partial' | 'blocked' | 'task_check_required';
  requiredMissing: string[]; optionalMissing: string[]; conditionalMissing?: string[]; reasons: string[]; risk: string[];
  verifiedAt: string | null; expiresAt: string | null;
};
export type WorkbenchTaskContext = {
  state: 'none' | 'current' | 'stale'; sessionId: string | null; taskId: string | null; requirementsVersion: number | null;
};
export type WorkbenchApprovalDetail =
  | {kind: 'permission_v2'; ref: Extract<WorkbenchApprovalRef, {kind: 'permission_v2'}>; approval: PermissionApproval}
  | {kind: 'legacy_copy'; ref: Extract<WorkbenchApprovalRef, {kind: 'legacy_copy'}>; approval: XiaozhiApproval};
export type WorkbenchSummary =
  | WorkbenchPage<WorkbenchTaskRow> & {kind: 'tasks'}
  | WorkbenchPage<WorkbenchApprovalRow> & {kind: 'approvals'}
  | WorkbenchPage<WorkbenchCapabilityRow> & {kind: 'capabilities'; context: WorkbenchTaskContext; registryRevision: number | null}
  | {schemaVersion: 1; kind: 'approval_detail'; asOf: string; detail: WorkbenchApprovalDetail};
export type WorkbenchResult = {ok: true; value: WorkbenchSummary}
  | {ok: false; error: 'invalid_input' | 'permission_denied' | 'changed' | 'unavailable'};

const object = (value: unknown): value is Record<string, unknown> => Boolean(value && typeof value === 'object' && !Array.isArray(value));
const text = (value: unknown, maximum: number): value is string => typeof value === 'string' && value.length > 0
  && value.length <= maximum && !/[\u0000-\u001f\u007f]/u.test(value);
const positive = (value: unknown): value is number => Number.isSafeInteger(value) && Number(value) > 0;
const keys = (value: Record<string, unknown>, allowed: string[]) => Object.keys(value).every(key => allowed.includes(key));
const approvalStates = ['pending', 'approved', 'executing', 'executed', 'rejected', 'invalidated', 'uncertain', 'failed', 'interrupted', 'verified', 'all'];
export function validWorkbenchApprovalRef(value: unknown): value is WorkbenchApprovalRef {
  if (!object(value) || !text(value.sessionId, 128) || !text(value.id, 160)) return false;
  return value.kind === 'permission_v2' ? keys(value, ['kind', 'sessionId', 'id', 'revision']) && positive(value.revision)
    : value.kind === 'legacy_copy' && keys(value, ['kind', 'sessionId', 'id', 'etag'])
      && typeof value.etag === 'string' && /^[a-f0-9]{64}$/u.test(value.etag);
}
export function validWorkbenchQuery(value: unknown): value is WorkbenchQuery {
  if (!object(value) || value.schemaVersion !== WORKBENCH_SCHEMA) return false;
  if (value.kind === 'approval_detail') return keys(value, ['schemaVersion', 'kind', 'ref']) && validWorkbenchApprovalRef(value.ref);
  if (value.sessionId !== undefined && !text(value.sessionId, 128)
      || value.cursor !== undefined && !text(value.cursor, 2048)
      || value.limit !== undefined && (!positive(value.limit) || value.limit > 50)) return false;
  const common = ['schemaVersion', 'kind', 'sessionId', 'cursor', 'limit'];
  if (value.kind === 'tasks') return keys(value, [...common, 'filter'])
    && ['unfinished', 'resumable', 'blocked', 'completed', 'ended', 'all'].includes(String(value.filter));
  if (value.kind === 'approvals') return keys(value, [...common, 'state'])
    && (value.state === undefined || approvalStates.includes(String(value.state)));
  if (value.kind !== 'capabilities' || !keys(value, [...common, 'taskId', 'requirementsVersion', 'query'])) return false;
  return (value.query === undefined || typeof value.query === 'string' && value.query.length <= 200 && !/[\u0000-\u001f\u007f]/u.test(value.query))
    && (value.taskId === undefined && value.requirementsVersion === undefined
      || text(value.sessionId, 128) && typeof value.taskId === 'string' && /^xitask_[a-f0-9]{64}$/u.test(value.taskId) && positive(value.requirementsVersion));
}
