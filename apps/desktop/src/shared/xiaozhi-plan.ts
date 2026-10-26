import type {XiaozhiControl} from './xiaozhi-agent';
import type {XiaozhiEventCursor} from './xiaozhi-events';

export const PLAN_SCHEMA='xiaozhi.plan.v2' as const;
export type PlanStep={id:string;text:string;status:'pending'|'in_progress'|'completed';dependsOn:string[]};
export type PlanBasis={callId:string;tool:string;outcome:'succeeded'|'failed'|'not_delivered';sequence:number};
export type PlanMetadata={schemaVersion:typeof PLAN_SCHEMA;revision:number;previousRevision:number;reason:string;changedAt:string;proposedBy:'model';callId:string;basis:PlanBasis[]};
export type PlanProposal={schemaVersion:typeof PLAN_SCHEMA;expectedRevision:number;reason:string;basisCallIds:string[];steps:PlanStep[]};
export type VersionedPlan=Omit<XiaozhiControl,'kind'|'state'|'revision'|'steps'|'plan'|'callId'>&{kind:'plan';state:'applied';revision:number;steps:PlanStep[];plan:PlanMetadata;callId:string};
export type PlanHistoryInput={sessionId:string;runId:string;planId:string;beforeSequence?:number;limit?:number};
export type PlanHistoryPage={schemaVersion:typeof PLAN_SCHEMA;planId:string;runId:string;legacy:boolean;records:{control:VersionedPlan;cursor:XiaozhiEventCursor}[];hasMore:boolean};
export type PlanHistoryResult={ok:true;value:PlanHistoryPage}|{ok:false;error:'invalid_input'|'permission_denied'|'configuration'};
export const PLAN_HISTORY_ERRORS={invalid_input:'计划读取参数无效，请刷新后重试。',permission_denied:'无法读取这份计划，请检查当前会话。',configuration:'计划记录暂时无法核对，请重试。'};

const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const keys=(v:Record<string,unknown>,allowed:string[])=>Object.keys(v).every(k=>allowed.includes(k));
const natural=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<Number.MAX_SAFE_INTEGER;
export const planStepId=(v:unknown):v is string=>typeof v==='string'&&/^[a-z][a-z0-9_-]{0,47}$/.test(v);
export const planCallId=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_:.-]{1,128}$/.test(v);
const text=(v:unknown,max:number):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max&&!v.includes('\0');
export function validPlanSteps(v:unknown):v is PlanStep[]{
 if(!Array.isArray(v)||!v.length||v.length>8||v.some(s=>!object(s)||!keys(s,['id','text','status','dependsOn'])||!planStepId(s.id)||!text(s.text,200)||!['pending','in_progress','completed'].includes(String(s.status))||!Array.isArray(s.dependsOn)||s.dependsOn.length>7||!s.dependsOn.every(planStepId)||new Set(s.dependsOn).size!==s.dependsOn.length))return false;
 const steps=v as PlanStep[],byId=new Map(steps.map(s=>[s.id,s]));
 if(byId.size!==steps.length||steps.filter(s=>s.status==='in_progress').length>1||steps.some(s=>s.dependsOn.some(id=>id===s.id||!byId.has(id)||(s.status!=='pending'&&byId.get(id)!.status!=='completed'))))return false;
 const visiting=new Set<string>(),visited=new Set<string>();
 function visit(id:string):boolean{if(visiting.has(id))return false;if(visited.has(id))return true;visiting.add(id);if(!byId.get(id)!.dependsOn.every(visit))return false;visiting.delete(id);visited.add(id);return true;}
 return steps.every(s=>visit(s.id));
}
export function validPlanProposal(v:unknown):v is PlanProposal{
 return object(v)&&keys(v,['schemaVersion','expectedRevision','reason','basisCallIds','steps'])&&v.schemaVersion===PLAN_SCHEMA&&natural(v.expectedRevision)&&text(v.reason,500)&&Array.isArray(v.basisCallIds)&&v.basisCallIds.length<=8&&v.basisCallIds.every(planCallId)&&new Set(v.basisCallIds).size===v.basisCallIds.length&&validPlanSteps(v.steps);
}
export function validVersionedPlan(v:unknown):v is VersionedPlan{
 if(!object(v)||v.kind!=='plan'||v.state!=='applied'||!text(v.id,160)||!planCallId(v.runId)||!planCallId(v.callId)||!validPlanSteps(v.steps)||!object(v.plan))return false;
 const m=v.plan;
 return keys(m,['schemaVersion','revision','previousRevision','reason','changedAt','proposedBy','callId','basis'])&&m.schemaVersion===PLAN_SCHEMA&&natural(m.revision)&&m.revision>0&&natural(m.previousRevision)&&m.previousRevision===m.revision-1&&v.revision===m.revision&&text(m.reason,500)&&typeof m.changedAt==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(m.changedAt)&&Number.isFinite(Date.parse(m.changedAt))&&m.proposedBy==='model'&&m.callId===v.callId&&Array.isArray(m.basis)&&m.basis.length<=8&&new Set(m.basis.map(b=>object(b)?b.callId:undefined)).size===m.basis.length&&m.basis.every(b=>object(b)&&keys(b,['callId','tool','outcome','sequence'])&&planCallId(b.callId)&&planCallId(b.tool)&&['succeeded','failed','not_delivered'].includes(String(b.outcome))&&natural(b.sequence)&&b.sequence>0);
}
export function validPlanHistoryInput(v:unknown):v is PlanHistoryInput{
 return object(v)&&keys(v,['sessionId','runId','planId','beforeSequence','limit'])&&typeof v.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(v.sessionId)&&planCallId(v.runId)&&typeof v.planId==='string'&&/^pictrl_[a-f0-9]{64}$/.test(v.planId)&&(v.beforeSequence===undefined||natural(v.beforeSequence)&&v.beforeSequence>0)&&(v.limit===undefined||natural(v.limit)&&v.limit>0&&v.limit<=16);
}
export function validPlanHistoryPage(v:unknown,input:PlanHistoryInput):v is PlanHistoryPage{
 if(!object(v)||v.schemaVersion!==PLAN_SCHEMA||v.planId!==input.planId||v.runId!==input.runId||typeof v.legacy!=='boolean'||typeof v.hasMore!=='boolean'||!Array.isArray(v.records)||v.records.length>(input.limit||8)||v.legacy&&(v.records.length>0||v.hasMore))return false;
 let before=input.beforeSequence||Number.MAX_SAFE_INTEGER,revision=Number.MAX_SAFE_INTEGER;
 return v.records.every(r=>{if(!object(r)||!object(r.cursor)||!validVersionedPlan(r.control)||r.control.id!==input.planId||r.control.runId!==input.runId||r.cursor.runId!==input.runId||!natural(r.cursor.generation)||r.cursor.generation<1||!natural(r.cursor.sequence)||r.cursor.sequence<1||r.cursor.sequence>=before||!natural(r.cursor.revision)||r.control.plan.revision>=revision)return false;before=r.cursor.sequence;revision=r.control.plan.revision;return true;});
}

export const PLAN_UPDATE_SCHEMA={type:'object',properties:{schemaVersion:{type:'string',const:PLAN_SCHEMA},expectedRevision:{type:'integer',minimum:0,description:'首次为0，后续必须使用上次成功回执revision。'},reason:{type:'string',minLength:1,maxLength:500,description:'可给教师看的计划建立/调整原因，不提供私有推理。'},basisCallIds:{type:'array',maxItems:8,items:{type:'string'},description:'只复制本轮工具结果中明确返回的planBasisCallId，宿主会核对实际已提交回执；不要用模型侧tool_call_id或猜ID。无工具依据用空数组。'},steps:{type:'array',minItems:1,maxItems:8,items:{type:'object',properties:{id:{type:'string',pattern:'^[a-z][a-z0-9_-]{0,47}$',description:'同一步骤更新/排序时保持ID；删除后不复用。'},text:{type:'string',minLength:1,maxLength:200},status:{type:'string',enum:['pending','in_progress','completed']},dependsOn:{type:'array',maxItems:7,items:{type:'string'},description:'本列表内前置步骤ID。'}},required:['id','text','status','dependsOn'],additionalProperties:false}}},required:['schemaVersion','expectedRevision','reason','basisCallIds','steps'],additionalProperties:false} as const;
