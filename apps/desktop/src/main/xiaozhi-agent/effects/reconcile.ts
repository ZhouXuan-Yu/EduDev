import type {Sql} from '../session-state';
import type {ReceiptReadback} from '../events/receipts';
import type {EffectRecord, EffectProof} from './types';
import {createEffectState} from './state';
import {createNetworkReceiptFiles, networkOutcomeMatches} from './network-receipts';
import {protocolHash} from '../capabilities/validation';
import {retiredResizeProof} from './terminal-resize-proof';

/** Explicit continuation rechecks durable receipts. No operation or network request is repeated. */
export function createEffectReconciler(options: {sql: Sql; readback: ReceiptReadback; networkDirectory: string}) {
  const effects = createEffectState(options.sql);
  const files = createNetworkReceiptFiles(options.networkDirectory);
  async function proof(record: EffectRecord): Promise<{proofs: EffectProof[]; digest: string; failed?: boolean} | null> {
    if (record.operation === 'job_resize') return retiredResizeProof(options.sql, options.readback, record);
    const execution = record.execution;
    if (record.operation === 'network_get' || record.operation === 'network_post') {
      if (!execution?.leaseId) return null;
      try {
        const response = await files.read(record.id, execution.leaseId);
        const digest = protocolHash({status: response.status, bodyDigest: protocolHash(response.body)});
        if (!networkOutcomeMatches(record, digest)) return null;
        return {digest, proofs: [{kind: 'remote_receipt', reference: 'http:' + record.id, digest}]};
      } catch {return null;}
    }
    if (execution?.jobId) {
      const row = (await options.sql.all('SELECT * FROM xiaozhi_jobs_v1 WHERE job_id=? AND session_id=? AND task_id=?',
        [execution.jobId, record.owner.sessionId, record.owner.taskId]))[0];
      if (!row) return null;
      const job = JSON.parse(String(row.document_json));
      if (['job_input', 'job_eof'].includes(record.operation) && execution.inputSequence
          && Number(row.acknowledged_input_sequence) >= execution.inputSequence) {
        const digest = protocolHash([execution.jobId, record.commandId, execution.inputSequence]);
        return {digest, proofs: [{kind: 'job_input', reference: 'job:' + execution.jobId + ':' + record.commandId, digest}]};
      }
      if (['starting', 'running'].includes(job.state)) return null;
      if (record.operation === 'tool') {
        const checked = await options.readback.readEffect?.(record.owner, record.callId, record.tool);
        if (checked === 'matched') {
          const digest = protocolHash([record.id, job.projectionState, job.committed]);
          return {digest, proofs: [{kind: 'domain', reference: 'job:' + execution.jobId, digest}]};
        }
        // The isolated PTY has no network broker. A stopped Job with no projection intent delivered no original-workspace write.
        const terminal = (await options.sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE session_id=? AND kind='terminal_job_terminal' AND reference=? ORDER BY rowid DESC LIMIT 1",
          [record.owner.sessionId, execution.jobId]))[0];
        const intents = await options.sql.all("SELECT id FROM xiaozhi_permission_audit_v1 WHERE session_id=? AND kind='projection_commit_intent' AND reference=? LIMIT 1",
          [record.owner.sessionId, execution.id]);
        if (terminal && !intents.length) {
          const actual = JSON.parse(String(terminal.metadata_json));
          const cleanup = actual.result?.cleanup;
          if (actual.executionId === execution.id && actual.helperHash === job.runtime.helperHash
              && protocolHash(actual.owner) === protocolHash(record.owner) && cleanup?.jobActiveProcesses === 0
              && cleanup.profileRemoved === true && cleanup.remainingOwnedAces === 0 && cleanup.ptyClosed === true) {
            const digest = protocolHash([actual, 'workspace_not_committed']);
            return {digest, failed: true, proofs: [{kind: 'terminal', reference: 'job:' + execution.jobId, digest}]};
          }
        }
      }
      return null;
    }
    if (record.operation === 'tool' && await options.readback.readEffect?.(record.owner, record.callId, record.tool) === 'matched') {
      const digest = protocolHash([record.id, 'independent_readback']);
      return {digest, proofs: [{kind: 'domain', reference: 'effect-readback:' + record.id, digest}]};
    }
    return null;
  }
  return {
    async recheck(sessionId: string, taskId: string) {
      const records = await effects.forTask(sessionId, taskId);
      // Network receipts may satisfy the enclosing foreground tool's independent readback.
      records.sort((left, right) => Number(right.operation.startsWith('network_')) - Number(left.operation.startsWith('network_')));
      for (const saved of records) {
        if (!['intent', 'executing', 'unknown', 'failed'].includes(saved.state)) continue;
        const run = (await options.sql.all('SELECT status FROM xiaozhi_event_runs WHERE run_id=? AND session_id=? AND generation=?',
          [saved.owner.runId, sessionId, saved.owner.generation]))[0];
        if (!run || run.status === 'running') continue;
        const checked = await proof(saved);
        if (!checked || checked.failed && saved.state === 'failed') continue;
        let record = await effects.get(saved.id);
        if (!record || record.revision !== saved.revision) throw Error('effect_revision_conflict');
        const authority = {kind: 'recovery' as const, sessionId, taskId};
        if (['intent', 'executing'].includes(record.state)) record = await effects.transition(record.id, record.revision, 'unknown', authority);
        await effects.transition(record.id, record.revision, checked.failed ? 'failed' : 'reconciled', authority, {
          proofs: checked.proofs, outcome: {digest: checked.digest, references: checked.proofs.map(proof => proof.reference),
            ...(checked.failed ? {error: 'workspace_not_committed'} : {})},
        });
      }
      return effects.forTask(sessionId, taskId);
    },
  };
}
