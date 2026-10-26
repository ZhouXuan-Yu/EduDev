import {validTaskVerification,type TaskVerification} from './xiaozhi-verification';
/** Versioned task authority. v2 native plans remain immutable historical records. */
export const TASK_SCHEMA='xiaozhi.task.v1' as const;
export type TaskCriterionKind='human'|'file'|'attachment'|'web'|'image'|'saved_text'|'saved_office'|'saved_questions';
export type TaskSource={runId:string;version:string}&({messageId:string;actionId?:never}|{actionId:string;messageId?:never});
export type TaskCriterion={id:string;version:number;sourceId:string;sourceVersion:string;text:string;kind:TaskCriterionKind;resource?:string};
export type TaskStep={id:string;text:string;dependsOn:string[];criterionIds:string[];reported:'pending'|'in_progress'|'completed'};
export type TaskCandidate={messageId:string;runId:string;digest:string};
export type TaskCheck={criterionId:string;criterionVersion:number;state:'passed'|'failed'|'unknown'|'needs_human';runId:string;generation:number;callId:string;checkedAt:string;digest:string;authority:'readback'|'teacher';confirmationId?:string;candidate?:TaskCandidate};
export type TaskOwner={sessionId:string;runId:string;generation:number};
export type TaskStepState='pending'|'executing'|'waiting_dependency'|'needs_check'|'verified'|'needs_fix';
export type TaskPlanProposal={expectedRevision:number;reason:string;steps:TaskStep[]};
export type TaskTeacherBase={schema:typeof TASK_SCHEMA;sessionId:string;taskId:string;revision:number;requirementsVersion:number;requestId:string};
/** Omit id for a new teacher row; only main assigns persistent identities. */
export type TaskCorrectionInput=TaskTeacherBase&{criteria:{id?:string;text:string}[]};
export type TaskReviewInput=TaskTeacherBase&{candidate:TaskCandidate;checked:{criterionId:string;version:number;accepted:boolean}[]};
export type TaskView={schema:typeof TASK_SCHEMA;id:string;sessionId:string;revision:number;requirementsVersion:number;planRevision:number;planReason:string;state:'active'|'review_required'|'paused'|'interrupted'|'completed'|'ended';origin:{messageId:string;commandId:string;runId:string};sources:TaskSource[];criteria:TaskCriterion[];steps:TaskStep[];checks:TaskCheck[];binding:TaskOwner|null;lastRunId?:string;goal?:{id:string;version:string};createdAt:string;updatedAt:string;reviewVerification?:TaskVerification};
export type TaskQuery={sessionId:string};
export type TaskResumeInput={schema:typeof TASK_SCHEMA;sessionId:string;taskId:string;revision:number;requirementsVersion:number;commandId:string};
export type TaskSnapshot={task:TaskView|null;candidate?:TaskCandidate;canAccept:boolean;canResume?:boolean};
export function validTaskResume(v:unknown):v is TaskResumeInput{return taskObject(v)&&Object.keys(v).length===6&&taskKeys(v,['schema','sessionId','taskId','revision','requirementsVersion','commandId'])&&v.schema===TASK_SCHEMA&&validTaskQuery({sessionId:v.sessionId})&&typeof v.taskId==='string'&&/^xitask_[a-f0-9]{64}$/u.test(v.taskId)&&taskNatural(v.revision)&&v.revision>0&&taskNatural(v.requirementsVersion)&&v.requirementsVersion>0&&typeof v.commandId==='string'&&/^xicmd_[a-f0-9-]{36}$/iu.test(v.commandId);}
export function taskHasRemainingSteps(task:TaskView):boolean{return task.steps.length>0&&(['paused','interrupted'].includes(task.state)||task.state==='review_required'&&task.criteria.some(c=>c.kind!=='human'&&!task.checks.some(k=>k.criterionId===c.id&&k.criterionVersion===c.version&&k.state==='passed')));}
export type TaskApiError='invalid_input'|'permission_denied'|'busy'|'changed'|'not_ready'|'verification_failed'|'unavailable';
export type TaskApiResult<T=TaskSnapshot>={ok:true;value:T}|{ok:false;error:TaskApiError};
export const TASK_API_ERRORS:Record<TaskApiError,string>={invalid_input:'核对内容不完整，请重新检查。',permission_denied:'当前会话无法执行此操作。',busy:'请等待本轮结束后再核对或修改要求。',changed:'要求或成果已经变化，请重新读取后核对。',not_ready:'尚无可核对的本轮成果。',verification_failed:'系统核验尚未通过，请先检查未完成项；仍可记录需要修改。',unavailable:'任务记录暂时无法核对，请重试。'};
export function validTaskQuery(v:unknown):v is TaskQuery{return taskObject(v)&&Object.keys(v).length===1&&typeof v.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/iu.test(v.sessionId);}

export const taskObject=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v));
export const taskKeys=(v:Record<string,unknown>,keys:string[])=>Object.keys(v).every(k=>keys.includes(k));
export const taskText=(v:unknown,max:number):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max&&!/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(v);
export const taskNatural=(v:unknown):v is number=>Number.isSafeInteger(v)&&Number(v)>=0&&Number(v)<Number.MAX_SAFE_INTEGER;
export const taskIdentity=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_:.-]{1,160}$/u.test(v);
export const taskLocalId=(v:unknown):v is string=>typeof v==='string'&&/^[a-z][a-z0-9_-]{0,47}$/u.test(v);
export const taskDigest=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/u.test(v);
const date=(v:unknown)=>typeof v==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(v)&&Number.isFinite(Date.parse(v));
export const taskSourceIdentity=(source:TaskSource)=>source.actionId||source.messageId!;
export function validTaskCandidate(v:unknown):v is TaskCandidate{return taskObject(v)&&Object.keys(v).length===3&&taskKeys(v,['messageId','runId','digest'])&&taskIdentity(v.messageId)&&taskIdentity(v.runId)&&taskDigest(v.digest);}
function validTeacherBase(v:Record<string,unknown>){return v.schema===TASK_SCHEMA&&typeof v.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/iu.test(v.sessionId)&&typeof v.taskId==='string'&&/^xitask_[a-f0-9]{64}$/u.test(v.taskId)&&taskNatural(v.revision)&&v.revision>0&&taskNatural(v.requirementsVersion)&&v.requirementsVersion>0&&typeof v.requestId==='string'&&/^xitact_[a-f0-9-]{36}$/iu.test(v.requestId);}
const teacherBaseKeys=['schema','sessionId','taskId','revision','requirementsVersion','requestId'];
export function validTaskCorrection(v:unknown):v is TaskCorrectionInput{return taskObject(v)&&taskKeys(v,[...teacherBaseKeys,'criteria'])&&validTeacherBase(v)&&Array.isArray(v.criteria)&&v.criteria.length>0&&v.criteria.length<=8&&v.criteria.every(c=>taskObject(c)&&[1,2].includes(Object.keys(c).length)&&taskKeys(c,['id','text'])&&(!Object.prototype.hasOwnProperty.call(c,'id')||taskLocalId(c.id))&&taskText(c.text,400))&&new Set(v.criteria.filter(c=>c.id!==undefined).map(c=>c.id)).size===v.criteria.filter(c=>c.id!==undefined).length;}
export function validTaskReview(v:unknown):v is TaskReviewInput{return taskObject(v)&&taskKeys(v,[...teacherBaseKeys,'candidate','checked'])&&validTeacherBase(v)&&validTaskCandidate(v.candidate)&&Array.isArray(v.checked)&&v.checked.length>0&&v.checked.length<=8&&v.checked.every(c=>taskObject(c)&&Object.keys(c).length===3&&taskKeys(c,['criterionId','version','accepted'])&&taskLocalId(c.criterionId)&&taskNatural(c.version)&&c.version>0&&typeof c.accepted==='boolean')&&new Set(v.checked.map(c=>c.criterionId)).size===v.checked.length;}
export function validTaskOwner(v:unknown):v is TaskOwner{return taskObject(v)&&Object.keys(v).length===3&&taskKeys(v,['sessionId','runId','generation'])&&typeof v.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/iu.test(v.sessionId)&&taskIdentity(v.runId)&&taskNatural(v.generation)&&v.generation>0;}
export function validTaskCriterion(v:unknown):v is TaskCriterion{
 return taskObject(v)&&taskKeys(v,['id','version','sourceId','sourceVersion','text','kind','resource'])&&taskLocalId(v.id)&&taskNatural(v.version)&&v.version>0&&taskIdentity(v.sourceId)&&taskDigest(v.sourceVersion)&&taskText(v.text,400)&&['human','file','attachment','web','image','saved_text','saved_office','saved_questions'].includes(String(v.kind))&&(v.kind==='human'?v.resource===undefined:taskText(v.resource,512));
}
export function validTaskSteps(v:unknown):v is TaskStep[]{
 if(!Array.isArray(v)||!v.length||v.length>8||v.some(s=>!taskObject(s)||Object.keys(s).length!==5||!taskKeys(s,['id','text','dependsOn','criterionIds','reported'])||!taskLocalId(s.id)||!taskText(s.text,200)||!['pending','in_progress','completed'].includes(String(s.reported))||!Array.isArray(s.dependsOn)||s.dependsOn.length>7||!s.dependsOn.every(taskLocalId)||new Set(s.dependsOn).size!==s.dependsOn.length||!Array.isArray(s.criterionIds)||!s.criterionIds.length||s.criterionIds.length>16||!s.criterionIds.every(taskLocalId)||new Set(s.criterionIds).size!==s.criterionIds.length))return false;
 const steps=v as TaskStep[],byId=new Map(steps.map(s=>[s.id,s]));
 if(byId.size!==steps.length||steps.filter(s=>s.reported==='in_progress').length>1||steps.some(s=>s.dependsOn.some(id=>id===s.id||!byId.has(id))))return false;
 const visiting=new Set<string>(),visited=new Set<string>();
 function visit(id:string):boolean{if(visiting.has(id))return false;if(visited.has(id))return true;visiting.add(id);if(!byId.get(id)!.dependsOn.every(visit))return false;visiting.delete(id);visited.add(id);return true;}
 return steps.every(s=>visit(s.id));
}
function validCheck(v:unknown):v is TaskCheck{
 return taskObject(v)&&taskKeys(v,['criterionId','criterionVersion','state','runId','generation','callId','checkedAt','digest','authority','confirmationId','candidate'])&&taskLocalId(v.criterionId)&&taskNatural(v.criterionVersion)&&v.criterionVersion>0&&['passed','failed','unknown','needs_human'].includes(String(v.state))&&taskIdentity(v.runId)&&taskNatural(v.generation)&&v.generation>0&&typeof v.callId==='string'&&(v.callId===''||taskIdentity(v.callId))&&date(v.checkedAt)&&taskDigest(v.digest)&&['readback','teacher'].includes(String(v.authority))&&(v.authority==='teacher'?taskIdentity(v.confirmationId)&&v.callId===''&&validTaskCandidate(v.candidate)&&v.candidate.runId===v.runId:v.confirmationId===undefined&&v.candidate===undefined&&taskIdentity(v.callId));
}
export function validTaskView(v:unknown):v is TaskView{
 if(!taskObject(v)||!taskKeys(v,['schema','id','sessionId','revision','requirementsVersion','planRevision','planReason','state','origin','sources','criteria','steps','checks','binding','lastRunId','goal','createdAt','updatedAt','reviewVerification'])||v.schema!==TASK_SCHEMA||typeof v.id!=='string'||!/^xitask_[a-f0-9]{64}$/u.test(v.id)||!validTaskOwner({sessionId:v.sessionId,runId:'validation',generation:1})||!taskNatural(v.revision)||v.revision<1||!taskNatural(v.requirementsVersion)||v.requirementsVersion<1||!taskNatural(v.planRevision)||!taskText(v.planReason,500)||!['active','review_required','paused','interrupted','completed','ended'].includes(String(v.state))||!date(v.createdAt)||!date(v.updatedAt))return false;
 if(v.goal!==undefined&&(!taskObject(v.goal)||Object.keys(v.goal).length!==2||!taskKeys(v.goal,['id','version'])||typeof v.goal.id!=='string'||!/^xigoal_[a-f0-9-]{36}$/iu.test(v.goal.id)||!taskDigest(v.goal.version)))return false;
 if(!taskObject(v.origin)||Object.keys(v.origin).length!==3||!taskKeys(v.origin,['messageId','commandId','runId'])||!taskIdentity(v.origin.messageId)||!taskIdentity(v.origin.commandId)||!taskIdentity(v.origin.runId))return false;
 if(!Array.isArray(v.sources)||!v.sources.length||v.sources.length>32||v.sources.some(s=>!taskObject(s)||Object.keys(s).length!==3||!taskKeys(s,['messageId','actionId','runId','version'])||!(s.actionId===undefined?taskIdentity(s.messageId):s.messageId===undefined&&typeof s.actionId==='string'&&/^xitact_[a-f0-9-]{36}$/iu.test(s.actionId))||!taskIdentity(s.runId)||!taskDigest(s.version))||new Set((v.sources as TaskSource[]).map(taskSourceIdentity)).size!==v.sources.length)return false;
 const sources=v.sources as TaskSource[];
 if(!Array.isArray(v.criteria)||!v.criteria.length||v.criteria.length>32||!v.criteria.every(validTaskCriterion)||new Set(v.criteria.map(c=>c.id)).size!==v.criteria.length||v.criteria.some(c=>!sources.some(s=>taskSourceIdentity(s)===c.sourceId&&s.version===c.sourceVersion)))return false;
 const criteria=v.criteria as TaskCriterion[];
 if(!Array.isArray(v.steps)||v.steps.length&&!validTaskSteps(v.steps)||v.steps.some(s=>s.criterionIds.some((id:string)=>!criteria.some(c=>c.id===id)))||Boolean(v.steps.length)!==Boolean(v.planRevision))return false;
 if(!Array.isArray(v.checks)||v.checks.length>32||!v.checks.every(validCheck)||new Set(v.checks.map(c=>c.criterionId)).size!==v.checks.length||v.checks.some(c=>!criteria.some(k=>k.id===c.criterionId&&k.version===c.criterionVersion&&(k.kind==='human')===(c.authority==='teacher'))))return false;
 if(v.lastRunId!==undefined&&!taskIdentity(v.lastRunId))return false;
 if(v.reviewVerification!==undefined&&(!taskObject(v.reviewVerification)||!validTaskVerification(v.reviewVerification,String(v.reviewVerification.runId))))return false;
 return v.state==='active'?validTaskOwner(v.binding)&&v.binding.sessionId===v.sessionId:v.binding===null;
}
/** Model completion alone never produces verified state or unlocks dependencies. */
export function taskStepState(task:TaskView,stepId:string):TaskStepState{
 const step=task.steps.find(s=>s.id===stepId);if(!step)return'pending';
 const memo=new Map<string,boolean>();
 const accepted=(s:TaskStep|undefined):boolean=>{if(!s)return false;if(memo.has(s.id))return memo.get(s.id)!;memo.set(s.id,false);const value=s.criterionIds.every(id=>task.checks.some(c=>c.criterionId===id&&c.criterionVersion===task.criteria.find(k=>k.id===id)?.version&&c.state==='passed'))&&s.dependsOn.every(id=>accepted(task.steps.find(step=>step.id===id)));memo.set(s.id,value);return value;};
 if(step.dependsOn.some(id=>!accepted(task.steps.find(s=>s.id===id)!)))return'waiting_dependency';
 if(accepted(step))return'verified';
 if(step.criterionIds.some(id=>task.checks.some(c=>c.criterionId===id&&c.state==='failed')))return'needs_fix';
 return step.reported==='completed'?'needs_check':step.reported==='in_progress'?'executing':'pending';
}
