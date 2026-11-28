import type {Sql} from '../session-state';
import {protocolHash} from '../capabilities/validation';
import {readNativeToolEntries, type NativeRunBinding} from '../events/native-tail';
import {captureSkillPrivateContext, type SkillPrivateContext} from './private-context';

/** Retired native files retain their rejection evidence. Missing evidence cannot approve a Skill. */
export async function captureRetiredPrivateHistory(sql: Sql, root: string, sessionId: string, target: SkillPrivateContext) {
  const archives = await sql.all("SELECT value_json FROM app_settings WHERE key LIKE 'xiaozhi.native-rebuild.v1:%'");
  const files = new Set<string>();
  for (const row of archives) {
    try {
      const archive = JSON.parse(String(row.value_json)), document = archive.document;
      if (document?.owner?.sessionId !== sessionId) continue;
      if (archive.schemaVersion !== 1 || document.schemaVersion !== 1 || protocolHash(document) !== archive.hash
          || document.previousBinding?.conversation_id !== sessionId || typeof document.previousBinding.session_file !== 'string')
        throw Error('evidence_missing');
      files.add(document.previousBinding.session_file.replaceAll('\\', '/'));
    } catch {target.unavailableHistory();}
  }
  if (!files.size) return;
  const bindings = await sql.all(`SELECT binding.run_id,binding.generation,binding.binding_json FROM xiaozhi_native_run_bindings binding
    JOIN xiaozhi_event_runs run ON run.run_id=binding.run_id WHERE run.session_id=?`, [sessionId]);
  for (const file of files) {
    let found = false;
    for (const row of bindings) {
      try {
        const binding = JSON.parse(String(row.binding_json)) as NativeRunBinding;
        if (typeof binding.file !== 'string' || binding.file.replaceAll('\\', '/') !== file) continue;
        found = true;
        if (binding.sessionId !== sessionId || binding.runId !== row.run_id || binding.generation !== Number(row.generation)) throw Error('evidence_missing');
        const entries = await readNativeToolEntries(binding, root,sql);
        const receipts = await sql.all('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=?', [binding.runId]);
        for (const entry of entries.filter(value => !value.failed)) {
          const receipt = receipts.find(value => value.call_id === entry.callId);
          if (!receipt || receipt.tool !== entry.tool || Number(receipt.generation) !== binding.generation
              || !receipt.admitted || !receipt.success || receipt.result_digest !== entry.digest
              || receipt.native_digest && receipt.native_digest !== entry.digest
              || receipt.native_entry_id && receipt.native_entry_id !== entry.id) throw Error('evidence_missing');
          captureSkillPrivateContext(target, entry.tool, entry.message);
        }
        if (receipts.some(receipt => receipt.success && receipt.result_digest
            && !entries.some(entry => entry.callId === receipt.call_id && entry.digest === receipt.result_digest))) throw Error('evidence_missing');
      } catch {target.unavailableHistory();}
    }
    if (!found) target.unavailableHistory();
  }
}
