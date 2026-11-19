import type {Sql} from '../session-state';
import type {JournalOwner} from '../events/journal';
import {protocolHash} from '../capabilities/validation';
import {createEffectState} from './state';

/** The original Journal alone writes failed/not_delivered for a settled intent.
 * No execution means the HTTP adapter never crossed its durable dispatch gate.
 * Old unknown/executing effects and interrupted intents remain conservative. */
export async function mcpIntentWasNotDispatched(work: Sql, owner: JournalOwner, callId: string, tool: string) {
  if (!/^mcp_[a-f0-9]{24}_/u.test(tool)) return false;
  try {
    const record = await createEffectState({...work, transaction: action => action(work)}).byCall(owner.runId, callId);
    if (!record || record.state !== 'failed' || record.execution !== null || record.outcome?.error !== 'not_delivered'
        || record.tool !== tool || record.callId !== callId || record.owner.sessionId !== owner.sessionId
        || record.owner.runId !== owner.runId || record.owner.generation !== owner.generation
        || record.receipt.runId !== owner.runId || record.receipt.callId !== callId
        || record.contract.scopePolicy !== 'mcp_tool_request' || record.contract.effect !== 'external_effect') return false;
    const row = (await work.all('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?', [owner.runId, callId]))[0];
    return !!row && row.phase === 'settled' && row.success === 0 && row.admitted === 1 && row.tool === tool
      && Number(row.generation) === owner.generation && row.native_state !== 'conflict' && !!row.contract_json
      && protocolHash(JSON.parse(String(row.contract_json))) === protocolHash(record.contract)
      && typeof row.result_digest === 'string' && /^[a-f0-9]{64}$/u.test(row.result_digest)
      && record.outcome.digest === row.result_digest && record.proofs.length === 0
      && JSON.stringify(record.outcome.references) === JSON.stringify(['journal:' + owner.runId + ':' + callId]);
  } catch {return false;}
}
