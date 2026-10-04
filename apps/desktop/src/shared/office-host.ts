import type { OfficeProjection, OfficeRunStatus } from './office-agent';
import type { OfficeCopyApproval } from './office-tools';

// Renderer contract. Engine RPC, transcript, credentials and file contents stay private.
export interface OfficeSessionSnapshot {
  schemaVersion: 'xiaozhi.office.session.v1';
  sessionId: string;
  title: string;
  workspaceLabel: string;
  provider: 'deepseek';
  model: string;
  access: 'read_only' | 'workspace_edit';
  runtimeMode: 'controlled_tools';
  createdAt: string;
  updatedAt: string;
}
export interface OfficeRunSnapshot {
  schemaVersion: 'xiaozhi.office.run.v1';
  runId: string;
  sessionId: string;
  status: 'starting' | OfficeRunStatus;
  provider: 'deepseek';
  model: string;
  startedAt: string;
  finishedAt?: string;
  reason?: 'user_stop' | 'engine_exit' | 'connection_lost' | 'tool_error' | 'model_error';
}
export interface OfficeApprovalSnapshot {
  schemaVersion: 'xiaozhi.office.approval.v1';
  approvalId: string;
  sessionId: string;
  runId: string;
  status: 'pending' | 'accepted' | 'declined' | 'expired';
  action: OfficeCopyApproval;
  createdAt: string;
  resolvedAt?: string;
}
export interface OfficeArtifactSnapshot {
  schemaVersion: 'xiaozhi.office.artifact.v1';
  artifactId: string;
  sessionId: string;
  runId: string;
  name: string;
  kind: 'text' | 'document' | 'spreadsheet' | 'presentation' | 'pdf' | 'image';
  status: 'draft' | 'ready' | 'committed' | 'failed';
  relativePath: string;
  sha256: string;
  size: number;
  sourceIds: string[];
}
export type OfficeHostErrorCode = 'invalid_input' | 'not_found' | 'busy' | 'stale'
  | 'permission_denied' | 'configuration' | 'timeout' | 'connection_lost' | 'storage';
export type OfficeHostResult<T> = { ok: true; value: T }
  | { ok: false; error: { code: OfficeHostErrorCode; message: string; retryable: boolean } };
export interface OfficeStartTurnInput {
  commandId: string;
  sessionId: string;
  prompt: string;
  attachmentIds: string[];
}
export interface OfficeInterruptInput { commandId: string; sessionId: string; runId: string }
export interface OfficeResolveApprovalInput {
  commandId: string; sessionId: string; runId: string; approvalId: string;
  decision: 'accept' | 'decline';
}
export interface OfficeCommandAck {
  schemaVersion: 'xiaozhi.office.command.v1';
  commandId: string;
  sessionId: string;
  runId: string;
  accepted: true;
}
export type OfficeHostEvent = {
  schemaVersion: 'xiaozhi.office.event.v1'; sessionId: string; sequence: number;
} & (
  { kind: 'projection'; value: OfficeProjection }
  | { kind: 'run'; value: OfficeRunSnapshot }
  | { kind: 'approval'; value: OfficeApprovalSnapshot }
  | { kind: 'artifact'; value: OfficeArtifactSnapshot }
);
// IPC adapter implements this after host persistence is accepted. No private raw RPC method.
export interface OfficeHostApi {
  listSessions(): Promise<OfficeHostResult<OfficeSessionSnapshot[]>>;
  readSession(sessionId: string): Promise<OfficeHostResult<{ session: OfficeSessionSnapshot; projection: OfficeProjection }>>;
  startTurn(input: OfficeStartTurnInput): Promise<OfficeHostResult<OfficeCommandAck>>;
  interrupt(input: OfficeInterruptInput): Promise<OfficeHostResult<OfficeCommandAck>>;
  resolveApproval(input: OfficeResolveApprovalInput): Promise<OfficeHostResult<OfficeCommandAck>>;
  onEvent(listener: (event: OfficeHostEvent) => void): () => void;
}
