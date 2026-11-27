import type {Sql} from '../session-state';
import {validMemorySession} from '../memory-selection';

export type ReceivedReference = {
  id:string; version:number; fingerprint:string; reason:'named'|'task'|'turn'|'teaching_scope'|'global'; estimatedTokens:number;
};
const digest=/^[a-f0-9]{64}$/;
const runKey=/^run_[a-zA-Z0-9_-]{1,120}$/;
const readbackPrefix='xiaozhi.memory.reference-readback.v1:';
type ScopedReference=ReceivedReference & {scopeVersion:number};
function valid(item:ReceivedReference) {
  return item && Object.keys(item).length===5 && typeof item.id==='string' && digest.test(item.id)
    && typeof item.fingerprint==='string' && digest.test(item.fingerprint)
    && Number.isSafeInteger(item.version) && item.version>0 && ['named','task','turn','teaching_scope','global'].includes(item.reason)
    && Number.isSafeInteger(item.estimatedTokens) && item.estimatedTokens>0 && item.estimatedTokens<=1024;
}
export const referenceReceiptSchema=`CREATE TABLE IF NOT EXISTS xiaozhi_memory_reference_deliveries (
  run_id TEXT NOT NULL REFERENCES ai_agent_runs(id),scope_version INTEGER NOT NULL,
  source_id TEXT NOT NULL,source_version INTEGER NOT NULL,fingerprint TEXT NOT NULL,reason TEXT NOT NULL,
  estimated_tokens INTEGER NOT NULL,PRIMARY KEY(run_id,scope_version,source_id,source_version,fingerprint))`;

function validateWrite(sessionId:string,runId:string,scopeVersion:number,items:readonly ReceivedReference[]) {
  if (!validMemorySession(sessionId) || !runKey.test(runId)
    || !Number.isSafeInteger(scopeVersion) || scopeVersion<0 || !Array.isArray(items) || items.length>12
    || scopeVersion===0&&items.some(item=>item?.reason!=='task'&&item?.reason!=='turn')
    || !items.every(valid)) throw Error('invalid_input');
}

/** Observations of readback and transport never confer read permission. */
export function createReferenceReceipts(sql:Sql) {
  function readDeliveries(sessionId:string,runId?:string) {
    if (!validMemorySession(sessionId) || runId!==undefined&&!runKey.test(runId)) throw Error('invalid_input');
    return sql.all(`SELECT d.run_id AS runId,d.scope_version AS scopeVersion,d.source_id AS id,d.source_version AS version,
      d.fingerprint,d.reason,d.estimated_tokens AS estimatedTokens FROM xiaozhi_memory_reference_deliveries d
      WHERE d.run_id=(SELECT id FROM ai_agent_runs WHERE session_id=? AND sub_intent='pi_education'
        AND (? IS NULL OR id=?) ORDER BY created_at DESC,rowid DESC LIMIT 1)
      ORDER BY d.scope_version DESC,d.source_id LIMIT 12`,[sessionId,runId??null,runId??null]).then(rows=>rows.flatMap(row=>{
      const item:ReceivedReference={id:String(row.id),version:Number(row.version),fingerprint:String(row.fingerprint),
        reason:row.reason as ReceivedReference['reason'],estimatedTokens:Number(row.estimatedTokens)};
      return valid(item)?[{...item,runId:String(row.runId),scopeVersion:Number(row.scopeVersion)}]:[];
    }));
  }

  return {
    async recordReferenceDelivery(sessionId:string,runId:string,scopeVersion:number,items:readonly ReceivedReference[]) {
      validateWrite(sessionId,runId,scopeVersion,items);
      if (!items.length) return;
      await sql.run(`INSERT OR IGNORE INTO xiaozhi_memory_reference_deliveries
        (run_id,scope_version,source_id,source_version,fingerprint,reason,estimated_tokens)
        SELECT r.id,?,j.value->>'$.id',j.value->>'$.version',j.value->>'$.fingerprint',j.value->>'$.reason',j.value->>'$.estimatedTokens'
        FROM ai_agent_runs r,json_each(?) j WHERE r.id=? AND r.session_id=? AND r.sub_intent='pi_education'`,
        [scopeVersion,JSON.stringify(items),runId,sessionId]);
    },
    latestReferenceDeliveries:(sessionId:string)=>readDeliveries(sessionId),
    referenceDeliveriesForRun:(sessionId:string,runId:string)=>readDeliveries(sessionId,runId),

    async recordReferenceReadback(sessionId:string,runId:string,scopeVersion:number,items:readonly ReceivedReference[]) {
      validateWrite(sessionId,runId,scopeVersion,items);
      if (!items.length) return;
      const prefix=readbackPrefix+runId+':'+scopeVersion+':';
      await sql.run(`INSERT OR IGNORE INTO app_settings (key,value_json,updated_at)
        SELECT ? || (j.value->>'$.id') || ':' || (j.value->>'$.version') || ':' || (j.value->>'$.fingerprint'),
          j.value,? FROM ai_agent_runs r,json_each(?) j
        WHERE r.id=? AND r.session_id=? AND r.sub_intent='pi_education'`,
        [prefix,new Date().toISOString(),JSON.stringify(items.map(item=>({...item,scopeVersion}))),runId,sessionId]);
    },

    async referenceReadbacksForRun(sessionId:string,runId:string):Promise<ScopedReference[]> {
      if (!validMemorySession(sessionId) || !runKey.test(runId)) throw Error('invalid_input');
      const prefix=readbackPrefix+runId+':';
      const rows=await sql.all(`SELECT s.value_json AS value FROM app_settings s
        WHERE s.key>=? AND s.key<? AND EXISTS
          (SELECT 1 FROM ai_agent_runs WHERE id=? AND session_id=? AND sub_intent='pi_education')
        ORDER BY s.key LIMIT 12`,[prefix,prefix+'\uffff',runId,sessionId]);
      return rows.flatMap(row=>{
        try {
          const {scopeVersion,...item}=JSON.parse(String(row.value));
          return Number.isSafeInteger(scopeVersion)&&scopeVersion>=0&&valid(item)?[{...item,scopeVersion}]:[];
        } catch { return []; }
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
