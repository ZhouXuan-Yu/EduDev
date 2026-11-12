export const PERMISSION_SCHEMA = 1 as const;
export const PERMISSION_MODES = ['request', 'acceptEdits', 'approveForMe', 'fullAccess'] as const;
export type PermissionMode = typeof PERMISSION_MODES[number];
export type PermissionScope =
  | { kind: 'filesystem'; root: string; identity: string; actions: ('read' | 'write' | 'delete')[] }
  | { kind: 'process'; backend: 'appcontainer'; executable: string; executableHash: string; workspace: string }
  | { kind: 'network'; origin: string; methods: string[]; purpose: string }
  | { kind: 'egress'; origin: string; classifications: ('public' | 'redacted' | 'teacher_private' | 'student_private')[] }
  | { kind: 'dependency'; source: string; package: string; version: string; sha256: string; environment: string; installScripts: boolean }
  | { kind: 'mcp'; serverId: string; sourceHash: string; schemaHash: string; tools: string[] }
  | { kind: 'extension'; extensionId: string; sourceHash: string; actions: ('install' | 'run')[] }
  | { kind: 'secret'; reference: string; consumer: string };

export type PermissionProfile = {
  schemaVersion: 1;
  sessionId: string;
  revision: number;
  mode: PermissionMode;
  updatedAt: string;
};
export type ScopeGrant = {
  schemaVersion: 1;
  grantId: string;
  revision: number;
  sessionId: string;
  taskId: string | null;
  scope: PermissionScope;
  provenance: { kind: 'teacher' | 'legacy_workspace' | 'approval'; reference: string };
  createdAt: string;
  expiresAt: string | null;
  revokedAt: string | null;
};
export type PermissionOwner = { sessionId: string; taskId: string; runId: string; generation: number };
export type PermissionRequest = {
  schemaVersion: 2;
  owner: PermissionOwner;
  requirementsVersion: number;
  callId: string;
  action: string;
  inputDigest: string;
  purpose: string;
  summary?: string;
  scopes: PermissionScope[];
  files: {root: string; path: string; version: string | null; sha256: string | null}[];
  provider: { id: string; version: string; sourceHash: string; schemaHash: string } | null;
  classification: 'public' | 'redacted' | 'teacher_private' | 'student_private';
  expiresAt: string;
};
export type PermissionDecision = {
  schemaVersion: 1;
  state: 'allow' | 'pending' | 'blocked';
  requestDigest: string;
  permissionSnapshotHash: string;
  grantRefs: { grantId: string; revision: number }[];
  missing: PermissionScope[];
  reason?: 'missing_grant' | 'rejected' | 'expired' | 'revoked' | 'source_changed';
  approvalId?: string;
};
export type PermissionApproval = {
  schemaVersion: 2;
  id: string;
  revision: number;
  request: PermissionRequest;
  requestDigest: string;
  permissionSnapshotHash: string;
  grantRefs: PermissionDecision['grantRefs'];
  state: 'pending' | 'approved' | 'executing' | 'executed' | 'rejected' | 'invalidated' | 'uncertain' | 'failed';
  scope: 'operation' | 'task' | 'persistent';
  invalidatedReason?: string;
  admittedOwner?: PermissionOwner;
  createdAt: string;
  updatedAt: string;
};
export type PermissionView = {
  schemaVersion: 1;
  profile: PermissionProfile;
  grants: ScopeGrant[];
  approvals: PermissionApproval[];
  legacyApprovals?: {id: string; source: string; target: string; state: 'pending' | 'approved'}[];
};
export type PermissionSettingsInput = { sessionId: string; revision: number; mode: PermissionMode };
export type PermissionGrantInput = {
  sessionId: string;
  scopes: PermissionScope[];
  taskId: string | null;
  expiresAt: string | null;
};
export type PermissionApprovalInput = {
  sessionId: string;
  approvalId: string;
  revision: number;
  decision: 'approve' | 'reject';
  scope: 'operation' | 'task' | 'persistent';
};
export type PermissionApiResult<T> = {ok: true; value: T} | {ok: false; error: 'invalid_input' | 'permission_denied' | 'conflict' | 'unavailable' | 'unsupported_constraint'};
