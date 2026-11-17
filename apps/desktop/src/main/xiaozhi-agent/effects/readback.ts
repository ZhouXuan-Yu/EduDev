import fs from 'node:fs/promises';
import path from 'node:path';
import type {Sql} from '../session-state';
import type {JournalOwner} from '../events/journal';
import type {EffectRecord} from './types';
import type {TerminalJobDocument} from '../terminal/job-types';
import type {PermissionScope} from '../../../shared/xiaozhi-permissions';
import {checkedFile, digest, filesystemScope} from '../permissions/resources';
import {validScope, permissionHash} from '../permissions/validation';

type Readback = 'matched' | 'uncertain' | 'not_checked';
const sameOwner = (value: {sessionId?: unknown; runId?: unknown; generation?: unknown}, owner: JournalOwner) =>
  value.sessionId === owner.sessionId && value.runId === owner.runId && value.generation === owner.generation;

/** Read receipts and current files only. This function never launches a process or repeats a write. */
export function createExecutionEffectReader(sql: Sql) {
  async function fileChanges(owner: JournalOwner, executionId: string, root: string, scope: PermissionScope): Promise<boolean> {
    if (scope.kind !== 'filesystem' || !validScope(scope) || scope.root !== root) return false;
    const current = filesystemScope(root, scope.actions);
    if (permissionHash(current) !== permissionHash(scope)) return false;
    const rows = await sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE session_id=? AND reference=? AND kind='projection_commit_intent' ORDER BY rowid DESC LIMIT 1",
      [owner.sessionId, executionId]);
    if (!rows.length) return false;
    const receipt = JSON.parse(String(rows[0].metadata_json));
    if (!sameOwner(receipt.owner || {}, owner) || !Array.isArray(receipt.changes) || receipt.changes.length > 4096) return false;
    for (const change of receipt.changes) {
      if (!change || typeof change.path !== 'string' || change.path.length > 2048 || !['create', 'write', 'delete'].includes(change.action)) return false;
      const filename = checkedFile(scope, path.resolve(root, change.path), 'read');
      let stat;
      try {stat = await fs.lstat(filename);} catch (error) {if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;}
      if (change.action === 'delete') {if (stat) return false; continue;}
      if (!stat || stat.isSymbolicLink()) return false;
      if (change.afterHash === null) {if (!stat.isDirectory()) return false; continue;}
      if (!stat.isFile() || !/^[a-f0-9]{64}$/u.test(change.afterHash) || digest(await fs.readFile(filename)) !== change.afterHash) return false;
    }
    return true;
  }
  return async (owner: JournalOwner, callId: string, tool: string): Promise<Readback> => {
    if (!['exec_command', 'write_stdin', 'close_terminal'].includes(tool)) return 'not_checked';
    try {
      const rows = await sql.all("SELECT document_json FROM xiaozhi_effects_v1 WHERE run_id=? AND generation=? AND call_id=? AND operation='tool'", [owner.runId, owner.generation, callId]);
      if (!rows.length) return 'not_checked';
      const effect = JSON.parse(String(rows[0].document_json)) as EffectRecord;
      const network = await sql.all("SELECT document_json FROM xiaozhi_effects_v1 WHERE receipt_run_id=? AND receipt_call_id=? AND operation IN ('network_get','network_post')", [owner.runId, callId]);
      for(const reference of effect.contract.authorityRefs.filter(reference=>reference.startsWith('network-effect:'))){
        const record=(await sql.all('SELECT document_json FROM xiaozhi_effects_v1 WHERE effect_id=? AND session_id=? AND task_id=?',
          [reference.slice('network-effect:'.length),owner.sessionId,effect.owner.taskId]))[0];
        if(!record)return 'uncertain';network.push(record);
      }
      if (network.some(row => {
        const request = JSON.parse(String(row.document_json)) as EffectRecord;
        return !['committed', 'reconciled'].includes(request.state) || !request.proofs.some(proof => proof.kind === 'remote_receipt');
      })) return 'uncertain';
      if (tool !== 'exec_command') {
        const commands = await sql.all("SELECT document_json FROM xiaozhi_effects_v1 WHERE receipt_run_id=? AND receipt_call_id=? AND operation IN ('job_input','job_eof','job_close')", [owner.runId, callId]);
        if (!commands.length) return 'uncertain';
        for (const row of commands) {
          const command = JSON.parse(String(row.document_json)) as EffectRecord;
          if (!['committed', 'reconciled'].includes(command.state) || !command.execution?.jobId || !command.proofs.length) return 'uncertain';
          const saved = (await sql.all('SELECT * FROM xiaozhi_jobs_v1 WHERE job_id=? AND session_id=? AND task_id=?',
            [command.execution.jobId, owner.sessionId, command.owner.taskId]))[0];
          if (!saved) return 'uncertain';
          const job = JSON.parse(String(saved.document_json)) as TerminalJobDocument;
          if (command.operation === 'job_close' ? job.cleanup !== 'complete'
            : !command.execution.inputSequence || Number(saved.acknowledged_input_sequence) < command.execution.inputSequence) return 'uncertain';
        }
        return 'matched';
      }
      if (!effect.execution?.id) return 'uncertain';
      if (effect.execution.jobId) {
        const saved = (await sql.all('SELECT document_json FROM xiaozhi_jobs_v1 WHERE job_id=? AND effect_id=?', [effect.execution.jobId, effect.id]))[0];
        if (!saved) return 'uncertain';
        const job = JSON.parse(String(saved.document_json)) as TerminalJobDocument;
        if (job.cleanup !== 'complete' || job.projectionState !== 'committed') return 'uncertain';
        const scope = job.request.scopes.find(scope => scope.kind === 'filesystem' && scope.root === job.projection.originalRoot);
        return scope && await fileChanges(owner, effect.execution.id, job.projection.originalRoot, scope) ? 'matched' : 'uncertain';
      }
      const prepared = (await sql.all("SELECT metadata_json FROM xiaozhi_permission_audit_v1 WHERE session_id=? AND reference=? AND kind='sandbox_execution_prepared' ORDER BY rowid DESC LIMIT 1",
        [owner.sessionId, effect.execution.id]))[0];
      if (!prepared) return 'uncertain';
      const receipt = JSON.parse(String(prepared.metadata_json));
      if (!sameOwner(receipt.owner || {}, owner) || typeof receipt.originalRoot !== 'string' || !receipt.originalScope) return 'uncertain';
      return await fileChanges(owner, effect.execution.id, receipt.originalRoot, receipt.originalScope) ? 'matched' : 'uncertain';
    } catch {return 'uncertain';}
  };
}
