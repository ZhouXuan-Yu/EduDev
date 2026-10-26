import {createHash} from 'node:crypto';
import type {Sql} from './session-state';
import {publicControl,type PrivateControl,type createPiControlState} from './control-state';
import type {XiaozhiAgentEvent} from '../../shared/xiaozhi-agent';
import {PLAN_SCHEMA,validPlanProposal,validVersionedPlan,validPlanHistoryInput,validPlanHistoryPage,planCallId,type PlanBasis,type VersionedPlan,type PlanHistoryInput,type PlanHistoryResult,type PlanHistoryPage} from '../../shared/xiaozhi-plan';
import {acquireToolResource} from './tools/resource-lock';

const hash=(v:string)=>createHash('sha256').update(v).digest('hex');
export const nativePlanId=(runId:string)=>`pictrl_${hash(runId)}`;
const failure=(error:unknown):PlanHistoryResult=>({ok:false,error:error instanceof Error&&error.message==='permission_denied'?'permission_denied':'configuration'});

/** Plan structure is adopted; reported step completion is never verification. */
export function createPlanService(options:{sql:Sql;state:ReturnType<typeof createPiControlState>;current:(sessionId:string,runId:string)=>boolean;sanitize:(text:string)=>Promise<string>;publish:(sessionId:string,runId:string,item:PrivateControl)=>Promise<void>}){
 function decode(row:Record<string,unknown>,sessionId:string,runId:string):XiaozhiAgentEvent{
  const text=String(row.event_json);if(hash(text)!==row.event_hash)throw Error('plan_history_corrupt');
  const e=JSON.parse(text) as XiaozhiAgentEvent;
  if(e.sessionId!==sessionId||e.runId!==runId||e.durability!=='committed'||e.schemaVersion!==1||e.generation!==Number(row.generation)||e.sequence!==Number(row.sequence))throw Error('plan_history_corrupt');
  return e;
 }
 async function history(raw:unknown):Promise<PlanHistoryResult>{
  if(!validPlanHistoryInput(raw))return {ok:false,error:'invalid_input'};const input=raw;
  try{
   const control=await options.state.control(input.planId);
   if(!control||control.kind!=='plan'||control.sessionId!==input.sessionId||control.runId!==input.runId||input.planId!==nativePlanId(input.runId))throw Error('permission_denied');
   const base={schemaVersion:PLAN_SCHEMA,planId:input.planId,runId:input.runId};
   if(!control.plan)return {ok:true,value:{...base,legacy:true,records:[],hasMore:false}};
   const rows=await options.sql.all(`SELECT e.* FROM xiaozhi_event_journal e JOIN xiaozhi_event_runs r ON r.run_id=e.run_id AND r.generation=e.generation WHERE r.session_id=? AND r.run_id=? AND e.sequence<? AND json_extract(e.event_json,'$.kind')='control' AND json_extract(e.event_json,'$.control.id')=? ORDER BY e.sequence DESC LIMIT ?`,[input.sessionId,input.runId,input.beforeSequence||Number.MAX_SAFE_INTEGER,input.planId,(input.limit||8)+1]);
   const records=rows.slice(0,input.limit||8).map(row=>{
    const event=decode(row,input.sessionId,input.runId);
    if(event.kind!=='control'||!validVersionedPlan(event.control)||event.control.id!==input.planId||event.control.runId!==event.runId)throw Error('plan_history_corrupt');
    return {control:event.control,cursor:{runId:event.runId,generation:event.generation!,sequence:event.sequence,revision:event.revision||0}};
   });
   const value:PlanHistoryPage={...base,legacy:false,records,hasMore:rows.length>(input.limit||8)};
   if(!validPlanHistoryPage(value,input))throw Error('plan_history_corrupt');return {ok:true,value};
  }catch(error){return failure(error);}
 }
 async function basis(sessionId:string,runId:string,callIds:string[]):Promise<PlanBasis[]>{
  const result:PlanBasis[]=[];
  for(const callId of callIds){
   const rows=await options.sql.all(`SELECT e.*,t.tool AS receipt_tool,t.phase,t.admitted,t.success AS receipt_success,t.result_digest FROM xiaozhi_event_journal e JOIN xiaozhi_event_runs r ON r.run_id=e.run_id AND r.generation=e.generation JOIN xiaozhi_tool_receipts t ON t.run_id=r.run_id AND t.generation=r.generation AND t.call_id=? WHERE r.session_id=? AND r.run_id=? AND json_extract(e.event_json,'$.kind')='tool_end' AND json_extract(e.event_json,'$.callId')=? ORDER BY e.sequence DESC LIMIT 2`,[callId,sessionId,runId,callId]);
   if(rows.length!==1)throw Error('plan_basis_unavailable');const row=rows[0],event=decode(row,sessionId,runId);
   if(event.kind!=='tool_end'||event.callId!==callId||event.tool!==row.receipt_tool||row.phase!=='settled'||![0,1].includes(Number(row.admitted))||Number(row.receipt_success)!==Number(event.success)||event.success&&row.admitted!==1||typeof row.result_digest!=='string'||!/^[a-f0-9]{64}$/.test(row.result_digest))throw Error('plan_basis_unavailable');
   result.push({callId,tool:event.tool,outcome:row.admitted===0?'not_delivered':event.success?'succeeded':'failed',sequence:event.sequence});
  }
  return result;
 }
 async function propose(sessionId:string,runId:string,callId:string,raw:unknown,signal?:AbortSignal){
  signal?.throwIfAborted();if(!options.current(sessionId,runId))throw Error('cancelled');
  if(!planCallId(callId)||!validPlanProposal(raw))throw Error('invalid_input');
  const release=acquireToolResource('plan-update:'+runId,'write');
  try{
   const normalized={...raw,reason:(await options.sanitize(raw.reason)).trim(),steps:await Promise.all(raw.steps.map(async s=>({...s,text:(await options.sanitize(s.text)).trim(),dependsOn:[...s.dependsOn]})))};
   if(!validPlanProposal(normalized))throw Error('invalid_input');
   const id=nativePlanId(runId),prior=await options.state.control(id),requestHash=hash(JSON.stringify(normalized));
   if(prior&&(prior.sessionId!==sessionId||prior.runId!==runId||prior.kind!=='plan'))throw Error('permission_denied');
   if(prior?.plan?.callId===callId){
    if(prior.requestHash!==requestHash)throw Error('plan_call_conflict');
    const saved=await history({sessionId,runId,planId:id,limit:1});
    if(!saved.ok||saved.value.records[0]?.control.plan.revision!==prior.plan.revision)throw Error('plan_commit_unavailable');
    return {control:publicControl(prior) as VersionedPlan,duplicate:true};
   }
   if(prior&&!prior.plan)throw Error('plan_legacy');
   if((prior?.plan?.revision||0)!==normalized.expectedRevision)throw Error('plan_revision_conflict:'+String(prior?.plan?.revision||0));
   const retired=new Set(prior?.planRetiredIds||[]);
   if(normalized.steps.some(s=>retired.has(s.id)))throw Error('plan_retired_step');
   for(const s of prior?.steps||[])if(s.id&&!normalized.steps.some(next=>next.id===s.id))retired.add(s.id);
   if(retired.size>64)throw Error('plan_retired_bounds');
   const references=await basis(sessionId,runId,normalized.basisCallIds);
   signal?.throwIfAborted();if(!options.current(sessionId,runId))throw Error('cancelled');
   const item:PrivateControl&VersionedPlan={id,sessionId,runId,callId,kind:'plan',state:'applied',text:'任务计划',revision:normalized.expectedRevision+1,steps:normalized.steps,requestHash,planRetiredIds:[...retired],plan:{schemaVersion:PLAN_SCHEMA,revision:normalized.expectedRevision+1,previousRevision:normalized.expectedRevision,reason:normalized.reason,changedAt:new Date().toISOString(),proposedBy:'model',callId,basis:references}};
   await options.state.replaceVersionedPlan(item,normalized.expectedRevision);
   signal?.throwIfAborted();if(!options.current(sessionId,runId))throw Error('cancelled');
   await options.publish(sessionId,runId,item);
   signal?.throwIfAborted();if(!options.current(sessionId,runId))throw Error('cancelled');
   return {control:publicControl(item) as VersionedPlan,duplicate:false};
  }finally{release();}
 }
 return {propose,history};
}
