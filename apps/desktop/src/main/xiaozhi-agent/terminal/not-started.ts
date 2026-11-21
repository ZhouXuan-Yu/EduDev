import {protocolHash} from '../capabilities/validation';
import {createEffectState} from '../effects/state';
import type {EffectRecord} from '../effects/types';
import type {JournalOwner} from '../events/journal';
import type {Sql} from '../session-state';
import type {PermissionOwner} from '../../../shared/xiaozhi-permissions';

const proofKind = 'terminal-runtime-disk-full-before-start.v1';

export class TerminalNotStartedError extends Error {
  constructor() {
    super('system_disk_full');
  }
}

const callMatches = (record: EffectRecord, owner: JournalOwner, callId: string) =>
  record.operation === 'tool' && record.tool === 'exec_command' && record.contract.effect === 'local_write'
  && record.owner.sessionId === owner.sessionId && record.owner.runId === owner.runId
  && record.owner.generation === owner.generation && record.contract.taskId === record.owner.taskId
  && record.callId === callId && record.receipt.runId === owner.runId && record.receipt.callId === callId
  && record.execution?.id === owner.runId + ':' + callId
  && !record.execution.jobId && !record.execution.leaseId && !record.execution.inputSequence;

const proofDigest = (record: EffectRecord, startSequence: number) => protocolHash({
  proofKind, id: record.id, owner: record.owner, callId: record.callId,
  contract: record.contract, execution: record.execution, startSequence,
});

async function matchingReceipt(work: Sql, record: EffectRecord, phase: 'admitted' | 'settled') {
  const row = (await work.all('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?',
    [record.owner.runId, record.callId]))[0];
  if (!row || row.generation !== record.owner.generation || row.tool !== record.tool || row.phase !== phase
      || row.admitted !== 1 || row.native_state === 'conflict' || !row.contract_json
      || protocolHash(JSON.parse(String(row.contract_json))) !== protocolHash(record.contract)) return null;
  const startSequence = Number(row.start_sequence);
  if (!Number.isSafeInteger(startSequence) || startSequence < 1) return null;
  return {row, startSequence};
}

/** Called only when Windows runtime preparation failed before any projection or Job was created. */
export async function sealTerminalNotStarted(sql: Sql, owner: PermissionOwner, callId: string): Promise<boolean> {
  if (!sql.transaction) return false;
  return sql.transaction(async work => {
    const effects = createEffectState({...work, transaction: action => action(work)});
    const record = await effects.byCall(owner.runId, callId);
    if (!record || record.state !== 'executing' || record.owner.taskId !== owner.taskId
        || !callMatches(record, owner, callId)) return false;
    const receipt = await matchingReceipt(work, record, 'admitted');
    if (!receipt) return false;
    const digest = proofDigest(record, receipt.startSequence);
    await effects.transition(record.id, record.revision, 'failed', {kind: 'run', owner}, {
      outcome: {digest, references: [proofKind], error: proofKind},
      proofs: [{kind: 'domain', reference: proofKind, digest}],
    });
    return true;
  });
}

/** Readback trusts only the host's exact failed effect and matching settled receipt. */
export async function terminalWasNotStarted(work: Sql, owner: JournalOwner, callId: string, tool: string) {
  if (tool !== 'exec_command') return false;
  try {
    const record = await createEffectState(work).byCall(owner.runId, callId);
    if (!record || record.state !== 'failed' || !callMatches(record, owner, callId)
        || record.outcome?.error !== proofKind || record.proofs.length !== 1) return false;
    const receipt = await matchingReceipt(work, record, 'settled');
    if (!receipt || receipt.row.success !== 0) return false;
    const digest = proofDigest(record, receipt.startSequence);
    return record.outcome.digest === digest && record.outcome.references.length === 1
      && record.outcome.references[0] === proofKind && record.proofs[0].kind === 'domain'
      && record.proofs[0].reference === proofKind && record.proofs[0].digest === digest;
  } catch {
    return false;
  }
}
