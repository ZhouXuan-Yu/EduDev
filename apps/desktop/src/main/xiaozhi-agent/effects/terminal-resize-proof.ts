import type {Sql} from '../session-state';
import type {ReceiptReadback} from '../events/receipts';
import type {EffectRecord, EffectProof} from './types';
import {createEffectState} from './state';
import {createTerminalJobState} from '../terminal/job-state';
import {protocolHash} from '../capabilities/validation';

const same = (left: unknown, right: unknown) => protocolHash(left) === protocolHash(right);
const baseContract = (contract: EffectRecord['contract']) => ({...contract, inputDigest: '', target: null, grantRefs: [], authorityRefs: []});

/** A resize cannot affect an already retired console. This proves retirement,
 * not delivery or an ACK. Input, EOF, close and workspace effects are excluded. */
export async function retiredResizeProof(sql: Sql, readback: ReceiptReadback, record: EffectRecord): Promise<{proofs: EffectProof[]; digest: string} | null> {
  if (record.operation !== 'job_resize' || record.state !== 'unknown' || !record.execution?.jobId
      || record.execution.id !== record.commandId || record.execution.inputSequence !== undefined
      || record.target !== record.execution.jobId || record.receipt.runId !== record.owner.runId
      || record.receipt.callId !== record.callId) return null;
  try {
    const saved = await createTerminalJobState(sql).get(record.execution.jobId);
    const job = saved.document, lease = Number(record.targetVersion);
    if (job.sessionId !== record.owner.sessionId || job.taskId !== record.owner.taskId || !job.tty
        || job.state !== 'completed' || job.exitCode !== 0 || job.cleanup !== 'complete'
        || job.projectionState !== 'committed' || !job.inputClosed
        || !Number.isSafeInteger(lease) || lease < 1 || String(lease) !== record.targetVersion
        || record.execution.leaseId !== job.jobId + ':' + lease || job.leaseRevision !== lease + 1
        || !Number.isSafeInteger(saved.inputSequence) || saved.inputSequence < 0
        || saved.acknowledgedInputSequence !== saved.inputSequence
        || job.origin.sessionId !== job.sessionId || job.origin.taskId !== job.taskId
        || !same(job.request.owner, job.origin)) return null;

    // The command may belong to a later controller Run. Its receipt binds that
    // Run; the native terminal audit below binds the original Job owner.
    const receipt = (await sql.all('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?', [record.receipt.runId, record.receipt.callId]))[0];
    if (!receipt || receipt.phase !== 'settled' || receipt.admitted !== 1 || receipt.native_state === 'conflict'
        || Number(receipt.generation) !== record.owner.generation || !receipt.contract_json) return null;
    const contract = JSON.parse(String(receipt.contract_json));
    if (contract.taskId !== job.taskId || !same(baseContract(contract), baseContract(record.contract))) return null;
    if (record.tool === 'terminal.teacher') {
      if (!same(record.owner, job.origin) || record.callId !== job.callId || receipt.tool !== 'exec_command') return null;
    } else if (receipt.tool !== record.tool) return null;

    const effects = createEffectState(sql), parent = await effects.get(job.effectId);
    if (!parent || parent.operation !== 'tool' || parent.tool !== 'exec_command'
        || !['committed', 'reconciled'].includes(parent.state) || !parent.proofs.length
        || !same(parent.owner, job.origin) || parent.callId !== job.callId
        || parent.execution?.jobId !== job.jobId || parent.execution.id !== job.projection.executionId
        || !same(baseContract(parent.contract), baseContract(job.contract))) return null;
    const unresolved = await sql.all(`SELECT effect_id FROM xiaozhi_effects_v1 WHERE session_id=? AND task_id=?
      AND json_extract(document_json,'$.execution.jobId')=? AND state IN ('intent','executing','unknown')
      AND json_extract(document_json,'$.operation')!='job_resize' LIMIT 1`, [job.sessionId, job.taskId, job.jobId]);
    if (unresolved.length) return null;

    const terminal = (await sql.all(`SELECT id,metadata_json FROM xiaozhi_permission_audit_v1
      WHERE session_id=? AND reference=? AND kind='terminal_job_terminal' ORDER BY rowid DESC LIMIT 1`, [job.sessionId, job.jobId]))[0];
    if (!terminal) return null;
    const actual = JSON.parse(String(terminal.metadata_json)), result = actual.result, cleanup = result?.cleanup;
    if (!same(actual.owner, job.origin) || actual.executionId !== job.projection.executionId
        || actual.helperHash !== job.runtime.helperHash || actual.runtimeVersion !== job.runtime.version
        || result?.schemaVersion !== 1 || result.type !== 'result' || result.executionId !== job.projection.executionId
        || result.state !== 'completed' || result.exitCode !== 0 || cleanup?.jobActiveProcesses !== 0
        || cleanup.profileRemoved !== true || cleanup.remainingOwnedAces !== 0 || cleanup.ptyClosed !== true) return null;
    // The existing independent reader checks the canonical committed file hashes.
    if (await readback.readEffect?.(parent.owner, parent.callId, parent.tool) !== 'matched') return null;
    const digest = protocolHash({kind: 'terminal-resize-retired-closed-job.v1', reason: 'closed_job_resize_has_no_live_target', effectId: record.id, effectRevision: record.revision,
      commandOwner: record.owner, commandId: record.commandId, jobOrigin: job.origin, jobId: job.jobId,
      jobRevision: job.revision, leaseRevision: job.leaseRevision, parentEffectId: parent.id, parentRevision: parent.revision,
      terminalAudit: terminal.id, terminalDigest: protocolHash(actual), acknowledgedInputSequence: saved.acknowledgedInputSequence});
    return {digest, proofs: [{kind: 'terminal', reference: 'terminal-resize-retired-closed-job.v1:' + job.jobId + ':' + record.commandId, digest}]};
  } catch {return null;}
}
