import type {AiAgentRunStatus} from '../../shared/contracts';
import type {PreparedAgentConfig,PreparedAgentConfigView} from '../../shared/xiaozhi-resolved-config';
import {validThinkingChoice} from '../../shared/xiaozhi-thinking';
import type {Sql} from './session-state';

const maxBytes=16384;
export const preparedAgentConfigSchema=`CREATE TABLE xiaozhi_prepared_runs_v1(
  run_id TEXT PRIMARY KEY REFERENCES ai_agent_runs(id),
  session_id TEXT NOT NULL REFERENCES ai_conversation_sessions(id),
  captured_at TEXT NOT NULL,
  payload_json TEXT NOT NULL CHECK(json_valid(payload_json) AND length(CAST(payload_json AS BLOB))<=${maxBytes})
);`;
export const validPreparedRunId=(value:unknown):value is string=>typeof value==='string' && /^run_[a-f0-9-]{36}$/iu.test(value);
const marker=(value:unknown)=>typeof value==='string' && /^[a-z0-9_.:-]{1,128}$/iu.test(value);
const isoDate=(value:unknown):value is string=>typeof value==='string' && value.length<=32 && Number.isFinite(Date.parse(value));
const revision=(value:unknown)=>Number.isSafeInteger(value) && Number(value)>=0;
const hasOnly=(value:object,keys:string)=>Object.keys(value).sort().join(',')===keys;
const runStatuses=new Set<AiAgentRunStatus>(['running','succeeded','failed','blocked','waiting_confirmation','waiting_input']);

function encode(receipt:PreparedAgentConfig) {
  const raw=JSON.stringify(receipt);
  if(Buffer.byteLength(raw)>maxBytes)throw Error('prepared_configuration_invalid');
  const {schemaVersion,operation,model,thinking,teacher,native}=receipt;
  if(!hasOnly(receipt,'model,native,operation,schemaVersion,teacher,thinking') || schemaVersion!==1 || !['prompt','compact'].includes(operation) ||
    !model || !hasOnly(model,'revision,source,status') || !['valid','invalid','unavailable'].includes(model.status) ||
    model.source===null || !['session_binding','session_selection','global','legacy_compat','environment','default'].includes(model.source) ||
    !(model.revision===null || revision(model.revision) || isoDate(model.revision)) ||
    !thinking || !hasOnly(thinking,'effective,requested,revision,source') || !['session_selection','global','default'].includes(thinking.source) ||
    !(thinking.revision===null || revision(thinking.revision)) || !validThinkingChoice(thinking.requested) || !validThinkingChoice(thinking.effective) ||
    !teacher || !hasOnly(teacher,'decisionId,eventRecorded,longTermApplied,observedRevision,policyRevision') ||
    !revision(teacher.observedRevision) || !(teacher.policyRevision===null || revision(teacher.policyRevision)) ||
    typeof teacher.longTermApplied!=='boolean' || typeof teacher.eventRecorded!=='boolean' ||
    !(teacher.decisionId===null || /^decision_[a-f0-9]{32}$/u.test(teacher.decisionId)) ||
    !native || !hasOnly(native,'generation,markerId') || !revision(native.generation) || !marker(native.markerId))throw Error('prepared_configuration_invalid');
  // Choose a fixed property order so replay equality reflects semantic content.
  return JSON.stringify({schemaVersion,operation,model:{source:model.source,revision:model.revision,status:model.status},
    thinking:{source:thinking.source,revision:thinking.revision,requested:thinking.requested,effective:thinking.effective},
    teacher:{observedRevision:teacher.observedRevision,policyRevision:teacher.policyRevision,longTermApplied:teacher.longTermApplied,
      eventRecorded:teacher.eventRecorded,decisionId:teacher.decisionId},native:{generation:native.generation,markerId:native.markerId}});
}

export async function savePreparedAgentConfig(sql:Sql,input:{runId:string;sessionId:string;receipt:PreparedAgentConfig},assertCurrent:()=>void) {
  if(!sql.transaction || !validPreparedRunId(input.runId))throw Error('prepared_configuration_invalid');
  const raw=encode(input.receipt);
  await sql.transaction(async work=>{
    assertCurrent();
    const [owner]=await work.all(`SELECT n.generation,json_extract(n.binding_json,'$.markerId') AS marker_id
      FROM ai_agent_runs r JOIN xiaozhi_native_run_bindings n ON n.run_id=r.id
      WHERE r.id=? AND r.session_id=?`,[input.runId,input.sessionId]);
    if(owner?.generation!==input.receipt.native.generation || owner?.marker_id!==input.receipt.native.markerId)throw Error('prepared_configuration_owner');
    assertCurrent();
    await work.run(`INSERT INTO xiaozhi_prepared_runs_v1(run_id,session_id,captured_at,payload_json) VALUES(?,?,?,?)
      ON CONFLICT(run_id) DO NOTHING`,[input.runId,input.sessionId,new Date().toISOString(),raw]);
    const [saved]=await work.all('SELECT session_id,payload_json FROM xiaozhi_prepared_runs_v1 WHERE run_id=?',[input.runId]);
    if(saved?.session_id!==input.sessionId || saved?.payload_json!==raw)throw Error('prepared_configuration_conflict');
    assertCurrent();
  });
}

export async function readPreparedAgentConfig(sql:Sql,sessionId?:string,runId?:string):Promise<PreparedAgentConfigView> {
  const absent:PreparedAgentConfigView={status:'not_recorded',runId:null,runStatus:null,receipt:null};
  if(!sessionId)return absent;
  let row:Record<string,unknown>|undefined;
  try {
    [row]=await sql.all(`SELECT r.id,r.status,r.model,p.captured_at,p.payload_json,n.generation,
      CASE WHEN json_valid(n.binding_json) THEN json_extract(n.binding_json,'$.markerId') END AS marker_id
      FROM ai_agent_runs r LEFT JOIN xiaozhi_prepared_runs_v1 p ON p.run_id=r.id AND p.session_id=r.session_id
      LEFT JOIN xiaozhi_native_run_bindings n ON n.run_id=r.id
      WHERE r.session_id=? AND r.sub_intent='pi_education' ${runId?'AND r.id=?':''}
      ORDER BY r.created_at DESC,r.id DESC LIMIT 1`,runId?[sessionId,runId]:[sessionId]);
  } catch {return {...absent,status:'unavailable'};}
  if(!row || !validPreparedRunId(row.id))return absent;
  const status=row.status as AiAgentRunStatus;
  const base={...absent,runId:row.id,runStatus:runStatuses.has(status)?status:null};
  if(row.payload_json==null || !row.marker_id)return base;
  try {
    if(typeof row.payload_json!=='string' || Buffer.byteLength(row.payload_json)>maxBytes || !isoDate(row.captured_at) ||
      typeof row.model!=='string' || !/^[a-z0-9][a-z0-9._-]{0,119}$/iu.test(row.model))throw Error();
    const decoded=JSON.parse(row.payload_json) as PreparedAgentConfig;
    if(encode(decoded)!==row.payload_json || decoded.native.generation!==row.generation || decoded.native.markerId!==row.marker_id)throw Error();
    return {...base,status:'prepared',receipt:{...decoded,capturedAt:row.captured_at,modelValue:row.model}};
  } catch {return {...base,status:'invalid'};}
}
