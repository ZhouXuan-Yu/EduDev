export type TaskRecoveryInspection = {
  schemaVersion: 1;
  sessionId: string;
  taskId: string;
  taskRevision: number;
  requirementsVersion: number;
  checkpointId: string | null;
  native: {state: 'available' | 'unbound' | 'missing' | 'changed' | 'invalid' | 'unavailable'; digest: string | null};
  canRebuildSession: boolean;
  unknownEffects: {id: string; revision: number; state: string}[];
  approvals: {id: string; revision: number; state: string; action: string}[];
  providerSnapshots: {id: string; capabilityId: string; providerId: string; version: string; hash: string}[];
  automaticReplay: false;
};
