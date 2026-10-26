import type {Sql} from '../session-state';import {observedRoute,type RouteReceipt,type StoredRoute} from './route-spec';
export async function readRouteObservation(sql:Sql,sessionId:string,runId:string):Promise<NonNullable<StoredRoute['observed']>>{
 const run=(await sql.all('SELECT r.status,e.status AS public_status,e.generation FROM ai_agent_runs r JOIN xiaozhi_event_runs e ON e.run_id=r.id AND e.session_id=r.session_id WHERE r.id=? AND r.session_id=?',[runId,sessionId]))[0];
 if(!run||run.status==='running'||!['completed','failed','interrupted'].includes(String(run.public_status)))throw Error('busy');
 const rows=await sql.all('SELECT call_id,tool,phase,admitted,success,result_digest,effect_state,native_state,generation FROM xiaozhi_tool_receipts WHERE run_id=? ORDER BY call_id LIMIT 1025',[runId]);if(rows.some(row=>Number(row.generation)!==Number(run.generation)))throw Error('configuration');
 // An empty receipt table alone cannot prove that the primary loop used no tools.
 // Both records are committed by the existing journal transaction; reconcile their
 // bounded identities before sealing or revalidating the historical observation.
 const calls=await sql.all("SELECT generation,json_extract(event_json,'$.callId') AS call_id,json_extract(event_json,'$.tool') AS tool,json_extract(event_json,'$.sessionId') AS session_id,json_extract(event_json,'$.runId') AS payload_run,json_extract(event_json,'$.generation') AS payload_generation FROM xiaozhi_event_journal WHERE run_id=? AND json_extract(event_json,'$.kind')='tool_start' ORDER BY json_extract(event_json,'$.callId') LIMIT 1025",[runId]);
 if(calls.length!==rows.length||calls.some((call,index)=>call.session_id!==sessionId||call.payload_run!==runId||Number(call.generation)!==Number(run.generation)||Number(call.payload_generation)!==Number(run.generation)||call.call_id!==rows[index].call_id||call.tool!==rows[index].tool||index>0&&call.call_id===calls[index-1].call_id))throw Error('configuration');
 const receipts=rows.slice(0,1024).map(row=>({callId:row.call_id,tool:row.tool,phase:row.phase,admitted:row.admitted,success:row.success,digest:row.result_digest,effect:row.effect_state,native:row.native_state})) as RouteReceipt[];
 return observedRoute(String(run.status),String(run.public_status),receipts,rows.length>1024,Number(run.generation));
}
