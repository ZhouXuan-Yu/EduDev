import type {Sql} from '../session-state';
import {validMemorySession} from '../memory-selection';

export type ReceivedReference = {
  id:string; version:number; fingerprint:string; reason:'named'|'task'|'teaching_scope'|'global'; estimatedTokens:number;
};
const digest=/^[a-f0-9]{64}$/;
function valid(item:ReceivedReference) {
  return item && Object.keys(item).length===5 && typeof item.id==='string' && digest.test(item.id)
    && typeof item.fingerprint==='string' && digest.test(item.fingerprint)
    && Number.isSafeInteger(item.version) && item.version>0 && ['named','task','teaching_scope','global'].includes(item.reason)
    && Number.isSafeInteger(item.estimatedTokens) && item.estimatedTokens>0 && item.estimatedTokens<=1024;
}
export const referenceReceiptSchema=`CREATE TABLE IF NOT EXISTS xiaozhi_memory_reference_deliveries (
  run_id TEXT NOT NULL REFERENCES ai_agent_runs(id),scope_version INTEGER NOT NULL,
  source_id TEXT NOT NULL,source_version INTEGER NOT NULL,fingerprint TEXT NOT NULL,reason TEXT NOT NULL,
  estimated_tokens INTEGER NOT NULL,PRIMARY KEY(run_id,scope_version,source_id,source_version,fingerprint))`;

/** The provider acknowledged a request containing the reference. This ledger never confers read permission. */
export function createReferenceReceipts(sql:Sql) {
  return {
    async recordReferenceDelivery(sessionId:string,runId:string,scopeVersion:number,items:readonly ReceivedReference[]) {
      if (!validMemorySession(sessionId) || !/^run_[a-zA-Z0-9_-]{1,120}$/.test(runId)
        || !Number.isSafeInteger(scopeVersion) || scopeVersion<1 || !Array.isArray(items) || items.length>12
        || !items.every(valid)) throw Error('invalid_input');
      if (!items.length) return;
      await sql.run(`INSERT OR IGNORE INTO xiaozhi_memory_reference_deliveries
        (run_id,scope_version,source_id,source_version,fingerprint,reason,estimated_tokens)
        SELECT r.id,?,j.value->>'$.id',j.value->>'$.version',j.value->>'$.fingerprint',j.value->>'$.reason',j.value->>'$.estimatedTokens'
        FROM ai_agent_runs r,json_each(?) j WHERE r.id=? AND r.session_id=? AND r.sub_intent='pi_education'`,
        [scopeVersion,JSON.stringify(items),runId,sessionId]);
    },
    async latestReferenceDeliveries(sessionId:string) {
      if(!validMemorySession(sessionId)) throw Error('invalid_input');
      const rows=await sql.all(`SELECT run_id AS runId,scope_version AS scopeVersion,source_id AS id,source_version AS version,
        fingerprint,reason,estimated_tokens AS estimatedTokens FROM xiaozhi_memory_reference_deliveries
        WHERE run_id=(SELECT id FROM ai_agent_runs WHERE session_id=? AND sub_intent='pi_education'
          ORDER BY created_at DESC,rowid DESC LIMIT 1) ORDER BY scope_version DESC,source_id LIMIT 12`,[sessionId]);
      return rows.flatMap(row=>{
        const item:ReceivedReference={id:String(row.id),version:Number(row.version),fingerprint:String(row.fingerprint),
          reason:row.reason as ReceivedReference['reason'],estimatedTokens:Number(row.estimatedTokens)};
        return valid(item)?[{...item,runId:String(row.runId),scopeVersion:Number(row.scopeVersion)}]:[];
      });
    },
  };
}

/** Inspect the outgoing provider representation without copying its contents into diagnostics. */
export function carriesReferenceProjection(payload:unknown,projection:string) {
  if (!projection || !payload || typeof payload!=='object' || !('messages' in payload) || !Array.isArray(payload.messages)) return false;
  const user=payload.messages.findLast(message=>message?.role==='user');
  return typeof user?.content==='string' ? user.content.includes(projection)
    : Array.isArray(user?.content) && user.content.some((part:{type?:string;text?:string}|null)=>
      part?.type==='text' && typeof part.text==='string' && part.text.includes(projection));
}
