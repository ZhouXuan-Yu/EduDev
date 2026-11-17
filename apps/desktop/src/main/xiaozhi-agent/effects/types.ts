import type {PermissionOwner} from '../../../shared/xiaozhi-permissions';
import type {ToolContractReceipt} from '../capabilities/core-governance';

export type EffectState = 'intent' | 'executing' | 'committed' | 'failed' | 'unknown' | 'reconciled' | 'compensated';
export type EffectProof = {
  kind: 'domain' | 'file' | 'remote_receipt' | 'job_input' | 'terminal';
  reference: string;
  digest: string;
};
export type EffectExecution = {id: string; leaseId?: string; jobId?: string; inputSequence?: number};
export type EffectOutcome = {
  digest: string;
  references: string[];
  acknowledgedInputSequence?: number;
  error?: string;
};
export type EffectRecord = {
  schemaVersion: 1;
  id: string;
  revision: number;
  owner: PermissionOwner;
  callId: string;
  commandId: string;
  tool: string;
  operation: string;
  idempotencyKey: string;
  receipt: {runId: string; callId: string};
  contract: ToolContractReceipt;
  target: string | null;
  targetVersion: string | null;
  state: EffectState;
  execution: EffectExecution | null;
  outcome: EffectOutcome | null;
  proofs: EffectProof[];
  createdAt: string;
  updatedAt: string;
};
export type EffectIntent = Omit<EffectRecord, 'schemaVersion' | 'id' | 'revision' | 'state' | 'execution' | 'outcome' | 'proofs' | 'createdAt' | 'updatedAt'>;
export type EffectAuthority =
  | {kind: 'run'; owner: PermissionOwner}
  | {kind: 'job'; jobId: string; leaseRevision: number; controllerRevision: number}
  | {kind: 'recovery'; sessionId: string; taskId: string};
