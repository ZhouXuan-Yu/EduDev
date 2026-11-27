import type {Sql} from '../session-state';
import {validMemorySession} from '../memory-selection';

export type ReceivedReference = {
  id:string; version:number; fingerprint:string; reason:'named'|'task'|'turn'|'teaching_scope'|'global'; estimatedTokens:number;
};
const digest=/^[a-f0-9]{64}$/;
const runKey=/^run_[a-zA-Z0-9_-]{1,120}$/;
const readbackPrefix='xiaozhi.memory.reference-readback.v1:';
const deliveryPrefix='xiaozhi.memory.reference-delivery.v1:';
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
  async function hasDeliveryLedger() {
    const [table]=await sql.all("SELECT 1 FROM sqlite_schema WHERE type='table' AND name='xiaozhi_memory_reference_deliveries'");
    return Boolean(table);
  }

  async function writeStored(prefix:string,sessionId:string,runId:string,scopeVersion:number,items:readonly ReceivedReference[]) {
    await sql.run(`INSERT OR IGNORE INTO app_settings (key,value_json,updated_at)
      SELECT ? || (j.value->>'$.id') || ':' || (j.value->>'$.version') || ':' || (j.value->>'$.fingerprint'),
        j.value,? FROM ai_agent_runs r,json_each(?) j
      WHERE r.id=? AND r.session_id=? AND r.sub_intent='pi_education'`,
      [prefix+runId+':'+scopeVersion+':',new Date().toISOString(),JSON.stringify(items.map(item=>({...item,scopeVersion}))),runId,sessionId]);
  }

  async function readStored(kind:string,sessionId:string,runId:string):Promise<ScopedReference[]> {
    if (!validMemorySession(sessionId) || !runKey.test(runId)) throw Error('invalid_input');
    const prefix=kind+runId+':';
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
  }

  async function readDeliveries(sessionId:string,runId?:string) {
    if (!validMemorySession(sessionId) || runId!==undefined&&!runKey.test(runId)) throw Error('invalid_input');
    const [owner]=await sql.all(`SELECT id FROM ai_agent_runs WHERE session_id=? AND sub_intent='pi_education'
      AND (? IS NULL OR id=?) ORDER BY created_at DESC,rowid DESC LIMIT 1`,[sessionId,runId??null,runId??null]);
    if (!owner || typeof owner.id!=='string' || !runKey.test(owner.id)) return [];
    const ownerRun=owner.id;
    const fallback=await readStored(deliveryPrefix,sessionId,ownerRun);
    const rows=await hasDeliveryLedger()?await sql.all(`SELECT scope_version AS scopeVersion,source_id AS id,source_version AS version,
      fingerprint,reason,estimated_tokens AS estimatedTokens FROM xiaozhi_memory_reference_deliveries
      WHERE run_id=? ORDER BY scope_version DESC,source_id LIMIT 12`,[ownerRun]):[];
    const normal=rows.flatMap(row=>{
      const item:ReceivedReference={id:String(row.id),version:Number(row.version),fingerprint:String(row.fingerprint),
        reason:row.reason as ReceivedReference['reason'],estimatedTokens:Number(row.estimatedTokens)};
      const scopeVersion=Number(row.scopeVersion);
      return valid(item)&&Number.isSafeInteger(scopeVersion)&&scopeVersion>=0?[{...item,scopeVersion}]:[];
    });
    const unique=new Map([...fallback,...normal].map(item=>
      [`${item.scopeVersion}:${item.id}:${item.version}:${item.fingerprint}`,item]));
    return [...unique.values()].sort((a,b)=>b.scopeVersion-a.scopeVersion||a.id.localeCompare(b.id,'en'))
      .slice(0,12).map(item=>({...item,runId:ownerRun}));
  }

  return {
    async recordReferenceDelivery(sessionId:string,runId:string,scopeVersion:number,items:readonly ReceivedReference[]) {
      validateWrite(sessionId,runId,scopeVersion,items);
      if (!items.length) return;
      // A published schema lineage can reach v9 without the optional ledger.
      // Keep new observations durable in that valid layout without runtime DDL.
      if (!await hasDeliveryLedger()) return writeStored(deliveryPrefix,sessionId,runId,scopeVersion,items);
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
      if (items.length) await writeStored(readbackPrefix,sessionId,runId,scopeVersion,items);
    },
    referenceReadbacksForRun:(sessionId:string,runId:string)=>readStored(readbackPrefix,sessionId,runId),
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
