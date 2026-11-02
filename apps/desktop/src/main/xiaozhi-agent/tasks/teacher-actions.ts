import type {Sql} from '../session-state';
import {taskObject,taskKeys,taskIdentity,taskDigest,taskNatural,taskText,validTaskCorrection,validTaskReview,type TaskView,type TaskCandidate,type TaskCorrectionInput,type TaskReviewInput} from '../../../shared/xiaozhi-task';
import type {TaskDocument,TaskRecord} from './task-state';
import type {TaskVerification} from '../../../shared/xiaozhi-verification';
import {validTaskVerification,verificationOutstandingFailures} from '../../../shared/xiaozhi-verification';
import {taskHash,applyTaskRecheck} from './task-evidence';
import {correctTaskGoal,reviewTaskGoal,requireTaskGoal} from './goal-binding';

type ActionBody={schema:'xiaozhi.task-action.v1';kind:'correct'|'review';requestId:string;sessionId:string;taskId:string;revision:number;requirementsVersion:number;runId:string;generation:number;requestDigest:string;resultRevision:number;createdAt:string;criteria?:TaskCorrectionInput['criteria'];candidate?:TaskCandidate;checked?:TaskReviewInput['checked'];reviewVerification?:TaskVerification};
export type TaskTeacherAction={body:ActionBody;version:string};
const clone=<T>(v:T):T=>structuredClone(v);
const actionKey=(id:string)=>'xiaozhi.task.v1:action:'+id;
export async function readTaskAction(sql:Sql,id:string):Promise<TaskTeacherAction|null>{
 if(!/^xitact_[a-f0-9-]{36}$/iu.test(id))throw Error('invalid_input');
 const row=(await sql.all('SELECT value_json FROM app_settings WHERE key=?',[actionKey(id)]))[0];if(!row)return null;
 let v;try{v=JSON.parse(String(row.value_json));}catch{throw Error('task_action_corrupt');}
 if(!taskObject(v)||Object.keys(v).length!==2||!taskKeys(v,['body','version'])||!taskDigest(v.version)||!taskObject(v.body)||v.version!==taskHash(v.body))throw Error('task_action_corrupt');
 const b=v.body,base=['schema','kind','requestId','sessionId','taskId','revision','requirementsVersion','runId','generation','requestDigest','resultRevision','createdAt'];
 if(b.schema!=='xiaozhi.task-action.v1'||b.requestId!==id||!taskNatural(b.revision)||b.revision<1||!taskNatural(b.requirementsVersion)||b.requirementsVersion<1||b.resultRevision!==b.revision+1||!taskIdentity(b.runId)||!taskNatural(b.generation)||b.generation<1||!taskDigest(b.requestDigest)||typeof b.createdAt!=='string'||!/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/u.test(b.createdAt)||!Number.isFinite(Date.parse(b.createdAt)))throw Error('task_action_corrupt');
 const input={schema:'xiaozhi.task.v1',sessionId:b.sessionId,taskId:b.taskId,revision:b.revision,requirementsVersion:b.requirementsVersion,requestId:id};
 if(b.kind==='correct'?Object.keys(b).length!==base.length+1||!taskKeys(b,[...base,'criteria'])||!validTaskCorrection({...input,criteria:b.criteria})||!Array.isArray(b.criteria)||b.criteria.some(c=>!taskObject(c)||Object.keys(c).length!==2||!taskIdentity(c.id)):b.kind!=='review'||![base.length+2,base.length+3].includes(Object.keys(b).length)||!taskKeys(b,[...base,'candidate','checked','reviewVerification'])||!validTaskReview({...input,candidate:b.candidate,checked:b.checked})||b.reviewVerification!==undefined&&(!taskObject(b.reviewVerification)||!validTaskVerification(b.reviewVerification,String(b.runId))))throw Error('task_action_corrupt');
 return v as unknown as TaskTeacherAction;
}
async function putAction(sql:Sql,action:TaskTeacherAction){if(!sql.change||await sql.change('INSERT OR IGNORE INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',[actionKey(action.body.requestId),JSON.stringify(action),action.body.createdAt])!==1)throw Error('task_request_conflict');}

/** Actual persisted public answer, not model supplied text/hash or private chain. */
export async function taskCandidate(sql:Sql,view:TaskView,messageId?:string):Promise<TaskCandidate>{
 const runId=view.binding?.runId;
 // Reviewed/paused tasks retain their candidate run in the caller's document
 // lineage, supplied by teacher-actions below rather than guessed from text.
 if(!runId)throw Error('task_candidate_unavailable');
 const rows=messageId?await sql.all('SELECT id,role,content,metadata_json FROM ai_conversation_messages WHERE id=? AND session_id=?',[messageId,view.sessionId]):await sql.all("SELECT id,role,content,metadata_json FROM ai_conversation_messages WHERE session_id=? AND role='assistant' AND json_extract(metadata_json,'$.agentRunId')=? ORDER BY rowid DESC LIMIT 1",[view.sessionId,runId]);
 const row=rows[0];if(!row||row.role!=='assistant'||!taskIdentity(row.id)||!taskText(row.content,32000))throw Error('task_candidate_unavailable');
 let meta;try{meta=JSON.parse(String(row.metadata_json));}catch{throw Error('task_candidate_unavailable');}
 if(!taskObject(meta)||meta.agentRunId!==runId||meta.piVersion!=='xiaozhi.pi.education.v1'||meta.ok!==true)throw Error('task_candidate_unavailable');
 const run=(await sql.all('SELECT session_id,status FROM ai_agent_runs WHERE id=?',[runId]))[0];
 if(!run||run.session_id!==view.sessionId||run.status!=='succeeded')throw Error('task_candidate_unavailable');
 return{messageId:String(row.id),runId,digest:taskHash([view.sessionId,row.id,row.role,row.content,meta.agentRunId,meta.piVersion,meta.publicItems??null,meta.verification??null,meta.ok,meta.status??null])};
}
async function requireVerifiedExecution(sql:Sql,candidate:TaskCandidate):Promise<TaskVerification>{
 const row=(await sql.all('SELECT metadata_json FROM ai_conversation_messages WHERE id=?',[candidate.messageId]))[0];let meta;
 try{meta=JSON.parse(String(row?.metadata_json));}catch{throw Error('task_result_unverified');}
 const v=meta?.verification;if(!validTaskVerification(v,candidate.runId)||!['needs_human','verified'].includes(v.state)||verificationOutstandingFailures(v)!==0)throw Error('task_result_unverified');return v;
}
export async function auditTaskTeacherChecks(sql:Sql,doc:TaskDocument){
 for(const check of doc.view.checks.filter(c=>c.authority==='teacher')){
  const receipt=await readTaskAction(sql,check.confirmationId!);if(!receipt)throw Error('task_action_corrupt');const body=receipt.body,decision=body.checked?.find(c=>c.criterionId===check.criterionId&&c.version===check.criterionVersion);
  if(body.kind!=='review'||body.sessionId!==doc.view.sessionId||body.taskId!==doc.view.id||body.requirementsVersion!==doc.view.requirementsVersion||body.runId!==check.runId||body.generation!==check.generation||!decision||receipt.version!==check.digest||JSON.stringify(body.candidate)!==JSON.stringify(check.candidate)||check.state!=='unknown'&&check.state!==(decision.accepted?'passed':'failed'))throw Error('task_action_corrupt');
  if(check.state==='passed'){
   if(JSON.stringify(doc.view.reviewVerification)!==JSON.stringify(body.reviewVerification))throw Error('task_action_corrupt');
   const lineage=doc.lineage.at(-1)!;if(body.runId!==lineage.runId)throw Error('task_candidate_changed');
   const actual=await taskCandidate(sql,{...doc.view,binding:{sessionId:doc.view.sessionId,runId:lineage.runId,generation:lineage.generation}},body.candidate!.messageId);
   if(JSON.stringify(actual)!==JSON.stringify(body.candidate))throw Error('task_candidate_changed');
  }
 }
}

type Internals={sql:Sql;sanitize:(text:string)=>Promise<string>;recheck?: (task:TaskView)=>Promise<TaskVerification[]>;resultRecheck?:(candidate:TaskCandidate,task:TaskView)=>Promise<TaskVerification>;transaction:<T>(action:(work:Sql)=>Promise<T>)=>Promise<T>;read:(work:Sql,id:string)=>Promise<TaskRecord|null>;load:(work:Sql,id:string,revision:number,owner?:undefined,checkSources?:boolean)=>Promise<TaskRecord>;save:(work:Sql,previous:TaskRecord,doc:TaskDocument)=>Promise<TaskView>;latestId:(work:Sql,sessionId:string)=>Promise<string|null>};
/** These methods are for future typed human actions only, never SDK customTools. */
export function createTaskTeacherActions(api:Internals){
 async function fence(work:Sql,doc:TaskDocument,completed=false){
  const last=doc.eventOwner||doc.lineage.at(-1)!;
  const row=(await work.all('SELECT s.archived_at,o.run_id,o.generation,r.status FROM ai_conversation_sessions s JOIN xiaozhi_event_owners o ON o.session_id=s.id JOIN xiaozhi_event_runs r ON r.run_id=o.run_id AND r.generation=o.generation WHERE s.id=?',[doc.view.sessionId]))[0];
  if(!row||row.archived_at||row.run_id!==last.runId||Number(row.generation)!==last.generation||completed&&(doc.eventOwner?row.status==='running':row.status!=='completed')||await api.latestId(work,doc.view.sessionId)!==doc.view.id)throw Error('task_owner_stale');
 }
 async function retry(work:Sql,input:TaskCorrectionInput|TaskReviewInput,kind:'correct'|'review'){
  const old=await readTaskAction(work,input.requestId);if(!old)return null;
  if(old.body.kind!==kind||old.body.sessionId!==input.sessionId||old.body.taskId!==input.taskId||old.body.requestDigest!==taskHash(input))throw Error('task_request_conflict');
  const current=await api.read(work,input.taskId);if(!current||current.doc.view.sessionId!==input.sessionId)throw Error('permission_denied');await fence(work,current.doc);return clone(current.doc.view);
 }
 async function packet(input:TaskCorrectionInput|TaskReviewInput,work:Sql,checkSources=true){
  const before=await api.load(work,input.taskId,input.revision,undefined,checkSources);
  if(before.doc.view.sessionId!==input.sessionId||before.doc.view.requirementsVersion!==input.requirementsVersion||before.doc.view.state==='ended'||checkSources&&before.doc.view.state==='completed')throw Error('task_revision_conflict');await fence(work,before.doc);return before;
 }
 function action(input:TaskCorrectionInput|TaskReviewInput,doc:TaskDocument,kind:'correct'|'review',payload:Partial<ActionBody>):TaskTeacherAction{
  const last=doc.lineage.at(-1)!,body:ActionBody={schema:'xiaozhi.task-action.v1',kind,requestId:input.requestId,sessionId:input.sessionId,taskId:input.taskId,revision:input.revision,requirementsVersion:input.requirementsVersion,runId:last.runId,generation:last.generation,requestDigest:taskHash(input),resultRevision:input.revision+1,createdAt:new Date().toISOString(),...payload};return{body,version:taskHash(body)};
 }
 return{
  async candidate(sessionId:string,id:string){const row=await api.read(api.sql,id);if(!row||row.doc.view.sessionId!==sessionId)throw Error('permission_denied');await fence(api.sql,row.doc,true);const last=row.doc.lineage.at(-1)!;if(row.doc.view.goal){const goal=await requireTaskGoal(api.sql,row.doc.view);if(goal.resultRunId!==last.runId||!goal.candidate.trim())throw Error('task_candidate_unavailable');}return taskCandidate(api.sql,{...row.doc.view,binding:{sessionId,runId:last.runId,generation:last.generation}});},
  async correct(input:TaskCorrectionInput){
   if(!validTaskCorrection(input))throw Error('invalid_input');
   const clean=await Promise.all(input.criteria.map(async c=>({...c,text:await api.sanitize(c.text)})));if(clean.some(c=>!taskText(c.text,400)))throw Error('invalid_input');
   return api.transaction(async work=>{
    const duplicate=await retry(work,input,'correct');if(duplicate)return duplicate;
    // An explicit correction replaces current authority even if its original
    // user message was edited. All old checks are invalidated, never inherited.
    const before=await packet(input,work,false),next=clone(before.doc),human=next.view.criteria.filter(c=>c.kind==='human');
    if(clean.some(c=>c.id!==undefined&&!human.some(old=>old.id===c.id)))throw Error('task_criteria_invalid');
    const resolved=clean.map((c,i)=>({id:c.id??'teacher_'+taskHash([input.requestId,i]).slice(0,32),text:c.text}));
    const machine=next.view.criteria.filter(c=>c.kind!=='human');
    if(machine.length+resolved.length>32||resolved.some(c=>machine.some(m=>m.id===c.id)))throw Error('task_capacity');
    const added=resolved.filter(c=>!human.some(old=>old.id===c.id)).map(c=>c.id),humanIds=new Set(human.map(c=>c.id)),kept=new Set(resolved.map(c=>c.id));
    // Keep step/dependency/effect identities. A withdrawn human-only step
    // remains a review step, never an empty or automatically verified step.
    const steps=next.view.steps.map(s=>{const heldHuman=s.criterionIds.some(id=>humanIds.has(id));let ids=s.criterionIds.filter(id=>!humanIds.has(id)||kept.has(id));if(heldHuman)ids=[...new Set([...ids,...added])];if(!ids.length)ids=resolved.map(c=>c.id);return{...s,criterionIds:ids,reported:'pending' as const};});
    if(steps.length){for(const c of resolved)if(!steps.some(s=>s.criterionIds.includes(c.id)))steps.at(-1)!.criterionIds.push(c.id);if(steps.some(s=>s.criterionIds.length>16))throw Error('task_capacity');}
    if(next.view.goal)await correctTaskGoal(work,next.view,resolved);
    const receipt=action(input,next,'correct',{criteria:resolved});await putAction(work,receipt);
    const updatedSource={actionId:input.requestId,runId:receipt.body.runId,version:receipt.version};next.view.sources=[updatedSource];
    next.view.criteria=[...resolved.map(c=>({...c,version:next.view.requirementsVersion+1,sourceId:input.requestId,sourceVersion:receipt.version,kind:'human' as const})),...machine.map(c=>({...c,version:c.version+1,sourceId:input.requestId,sourceVersion:receipt.version}))];
    next.view.requirementsVersion++;next.view.checks=[];delete next.view.reviewVerification;next.view.steps=steps;if(next.view.steps.length)next.view.planRevision++;
    next.view.planReason='教师修正、添加或撤回了要求；保留步骤和保存记录，按新标准重新核对';next.view.state='paused';next.view.binding=null;
    return api.save(work,before,next);
   });
  },
  async review(input:TaskReviewInput){
   if(!validTaskReview(input))throw Error('invalid_input');
   // Check a retry before invoking any effect reader. Idempotent human actions
   // must not repeat IO or create another acceptance receipt.
   const repeated=await api.transaction(work=>retry(work,input,'review'));if(repeated)return repeated;
   const observed=await packet(input,api.sql);await fence(api.sql,observed.doc,true);const lastObserved=observed.doc.lineage.at(-1)!;
   const candidateObserved=await taskCandidate(api.sql,{...observed.doc.view,binding:{sessionId:input.sessionId,runId:lastObserved.runId,generation:lastObserved.generation}},input.candidate.messageId);
   if(JSON.stringify(candidateObserved)!==JSON.stringify(input.candidate))throw Error('task_candidate_changed');
   const humanObserved=observed.doc.view.criteria.filter(c=>c.kind==='human');
   if(input.checked.length!==humanObserved.length||humanObserved.some(c=>!input.checked.some(s=>s.criterionId===c.id&&s.version===c.version)))throw Error('task_criteria_invalid');
   const accepting=input.checked.every(c=>c.accepted);let reviewVerification:TaskVerification|undefined;
   if(accepting){const original=await requireVerifiedExecution(api.sql,candidateObserved),machine=original.checks.filter(c=>c.state==='passed'&&c.evidenceIds.length);
    if(machine.length){if(!api.resultRecheck)throw Error('task_effect_recheck_required');reviewVerification=await api.resultRecheck(candidateObserved,clone(observed.doc.view));if(!validTaskVerification(reviewVerification,candidateObserved.runId)||Math.abs(Date.now()-Date.parse(reviewVerification.checkedAt))>60000||!['needs_human','verified'].includes(reviewVerification.state)||verificationOutstandingFailures(reviewVerification)||machine.some(c=>!reviewVerification!.checks.some(fresh=>fresh.id===c.id&&fresh.state==='passed')))throw Error('task_result_unverified');}
   }
   let proofs:TaskVerification[]=[];
   if(accepting&&observed.doc.view.criteria.some(c=>c.kind!=='human')){if(!api.recheck)throw Error('task_effect_recheck_required');proofs=await api.recheck(clone(observed.doc.view));}
   return api.transaction(async work=>{
    const duplicate=await retry(work,input,'review');if(duplicate)return duplicate;
    const before=await packet(input,work),next=clone(before.doc);await fence(work,next,true);
    const last=next.lineage.at(-1)!,candidate=await taskCandidate(work,{...next.view,binding:{sessionId:input.sessionId,runId:last.runId,generation:last.generation}},input.candidate.messageId);
    if(JSON.stringify(candidate)!==JSON.stringify(input.candidate))throw Error('task_candidate_changed');
    if(accepting)await requireVerifiedExecution(work,candidate);
    const human=next.view.criteria.filter(c=>c.kind==='human');
    if(input.checked.length!==human.length||human.some(c=>!input.checked.some(s=>s.criterionId===c.id&&s.version===c.version)))throw Error('task_criteria_invalid');
    applyTaskRecheck(next,proofs);
    // A rejected positive review must not leave partial human passes or change
    // the goal state. Current machine proofs are a prerequisite to this action.
    if(accepting&&next.view.criteria.some(c=>c.kind!=='human'&&!next.view.checks.some(k=>k.criterionId===c.id&&k.criterionVersion===c.version&&k.state==='passed')))throw Error('task_result_unverified');
    const receipt=action(input,next,'review',{candidate,checked:clone(input.checked),...(reviewVerification?{reviewVerification}: {})});await putAction(work,receipt);
    if(reviewVerification)next.view.reviewVerification=clone(reviewVerification);else delete next.view.reviewVerification;
    for(const criterion of human){const decision=input.checked.find(c=>c.criterionId===criterion.id)!;next.view.checks=next.view.checks.filter(c=>c.criterionId!==criterion.id);next.view.checks.push({criterionId:criterion.id,criterionVersion:criterion.version,state:decision.accepted?'passed':'failed',runId:last.runId,generation:last.generation,callId:'',checkedAt:receipt.body.createdAt,digest:receipt.version,authority:'teacher',confirmationId:input.requestId,candidate});}
    next.view.state=next.view.criteria.every(c=>next.view.checks.some(k=>k.criterionId===c.id&&k.criterionVersion===c.version&&k.state==='passed'))?'completed':'paused';next.view.binding=null;
    if(next.view.goal)await reviewTaskGoal(work,next.view,candidate);
    return api.save(work,before,next);
   });
  }
 };
}
