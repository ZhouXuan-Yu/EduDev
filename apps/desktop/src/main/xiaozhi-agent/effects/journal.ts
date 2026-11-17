import type {Sql} from '../session-state';
import type {JournalOwner} from '../events/journal';
import type {ToolContractReceipt} from '../capabilities/core-governance';
import type {ReceiptReadback, ReceiptCapture} from '../events/receipts';
import {protocolHash} from '../capabilities/validation';
import {createEffectState} from './state';
import type {EffectRecord, EffectProof} from './types';
import {TaskAdmissionError} from '../tasks/admission-error';

const inline = (work: Sql): Sql => ({...work, transaction: action => action(work)});
const authority = (record: EffectRecord) => ({kind: 'run' as const, owner: record.owner});

/** These writes run inside the existing receipt/Journal transaction. */
export function createJournalEffects(sql: Sql, readback: ReceiptReadback) {
  async function assertIntent(work: Sql, owner: JournalOwner, callId: string, tool: string, contract: ToolContractReceipt) {
    if (!['local_write', 'external_effect'].includes(contract.effect)) return;
    const prior = await work.all(`SELECT run_id,call_id,document_json FROM xiaozhi_effects_v1
      WHERE session_id=? AND task_id=? AND operation='tool' AND state IN ('executing','unknown')
        AND json_extract(document_json,'$.tool')=? AND json_extract(document_json,'$.contract.requirementsVersion')=?`,
      [owner.sessionId, contract.taskId, tool, contract.requirementsVersion]);
    if (prior.some(row => {
      if (row.run_id === owner.runId && row.call_id === callId) return false;
      const effect = JSON.parse(String(row.document_json)) as EffectRecord;
      return effect.contract.inputDigest === contract.inputDigest || contract.target !== null && effect.target === contract.target;
    })) throw new TaskAdmissionError('task_effect_recheck_required');
  }
  async function read(work: Sql, owner: JournalOwner, callId: string) {
    return createEffectState(inline(work)).byCall(owner.runId, callId);
  }
  async function finish(work: Sql, record: EffectRecord, capture?: ReceiptCapture, recovering = false) {
    const effects = createEffectState(inline(work));
    // A returned background tool still owns an executing Job. Its actual terminal receipt settles the effect.
    if (!recovering && record.execution?.jobId && record.state === 'executing') {
      const job = (await work.all('SELECT state FROM xiaozhi_jobs_v1 WHERE job_id=? AND effect_id=?', [record.execution.jobId, record.id]))[0];
      if (job && ['starting', 'running'].includes(String(job.state))) return record;
    }
    const row = (await work.all('SELECT result_digest,success FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?',
      [record.owner.runId, record.callId]))[0];
    const checked = await readback.readEffect?.(record.owner, record.callId, record.tool);
    const outcome = {digest: capture?.digest || String(row?.result_digest || protocolHash(['missing_result', record.id])),
      references: ['journal:' + record.owner.runId + ':' + record.callId]};
    if (!recovering && record.state === 'intent' && row?.success === 0) {
      return effects.transition(record.id, record.revision, 'failed', authority(record), {outcome: {...outcome, error: 'not_delivered'}});
    }
    const proofs: EffectProof[] = checked === 'matched'
      ? [{kind: 'domain', reference: 'effect-readback:' + record.owner.runId + ':' + record.callId,
        digest: protocolHash([record.id, outcome.digest, checked])}] : [];
    if (proofs.length) {
      if (record.state === 'intent') record = await effects.transition(record.id, record.revision, 'unknown', authority(record));
      if (['unknown', 'failed'].includes(record.state)) return effects.transition(record.id, record.revision, 'reconciled', authority(record), {outcome, proofs});
      if (record.state === 'executing') return effects.transition(record.id, record.revision, 'committed', authority(record), {outcome, proofs});
      return record;
    }
    if (['intent', 'executing'].includes(record.state)) return effects.transition(record.id, record.revision, 'unknown', authority(record), {outcome});
    return record;
  }
  return {
    assertIntent,
    migrate: () => createEffectState(sql).migrate(),
    async intent(work: Sql, owner: JournalOwner, callId: string, tool: string, contract: ToolContractReceipt) {
      if (contract.effect === 'safe_read') return;
      const record = {...owner, taskId: contract.taskId};
      await assertIntent(work, owner, callId, tool, contract);
      await createEffectState(inline(work)).intent({owner: record, callId, commandId: callId, tool, operation: 'tool',
        idempotencyKey: protocolHash(['tool', owner, callId, contract.taskId, contract.inputDigest]),
        receipt: {runId: owner.runId, callId}, contract, target: contract.target, targetVersion: null}, {kind: 'run', owner: record});
    },
    async executing(work: Sql, owner: JournalOwner, callId: string) {
      const record = await read(work, owner, callId);
      if (record?.state === 'intent') await createEffectState(inline(work)).transition(record.id, record.revision, 'executing', authority(record),
        {execution: {id: owner.runId + ':' + callId}});
    },
    async execution(work: Sql, owner: JournalOwner, callId: string, execution: {id: string; jobId?: string; leaseId?: string}) {
      const record = await read(work, owner, callId);
      if (!record) return;
      if (record.state !== 'executing') throw Error('effect_transition_conflict');
      await createEffectState(inline(work)).updateExecution(record.id, record.revision, execution, authority(record));
    },
    async settled(work: Sql, owner: JournalOwner, callId: string, capture?: ReceiptCapture) {
      const record = await read(work, owner, callId);
      if (record) await finish(work, record, capture);
    },
    async recover(work: Sql, owner: JournalOwner) {
      const rows = await work.all("SELECT document_json FROM xiaozhi_effects_v1 WHERE run_id=? AND generation=? AND state IN ('intent','executing','unknown','failed') ORDER BY created_at", [owner.runId, owner.generation]);
      for (const row of rows) await finish(work, JSON.parse(String(row.document_json)) as EffectRecord, undefined, true);
    },
  };
}
