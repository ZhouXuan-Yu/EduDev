import type {TaskContinuation} from '../../../shared/xiaozhi-start';
import {createHash,randomUUID} from 'node:crypto';
import type {OmniEduStore} from '../../db';
import type {Sql} from '../session-state';
import type {createEventPublisher} from '../events/publisher';
import type {XiaozhiAgentEvent} from '../../../shared/xiaozhi-agent';
import {validTaskQuery,validTaskReview,validTaskCorrection,validTaskView,type TaskApiError,type TaskApiResult,type TaskView,type TaskSnapshot,type TaskOwner,type TaskReviewInput,type TaskCorrectionInput,type TaskCandidate} from '../../../shared/xiaozhi-task';
import {validTaskVerification,type TaskVerification} from '../../../shared/xiaozhi-verification';
import {createTaskState} from './task-state';
import {readTaskAction} from './teacher-actions';
import {validTaskResume,taskHasRemainingSteps,type TaskResumeInput} from '../../../shared/xiaozhi-task';
import {createGoalState,publicGoal,type PrivateGoal} from '../goal-state';
import {goalFromSource,goalCriterionId} from './goal-binding';
import {isTaskContinuation} from './continuation';

const digest=(s:string)=>createHash('sha256').update(s).digest('hex');
const errorCode=(e:unknown):TaskApiError=>{
 const text=e instanceof Error?e.message:'';
 if(text==='invalid_input')return'invalid_input';if(text==='busy')return'busy';if(text==='permission_denied')return'permission_denied';
 if(/candidate_unavailable|effect_recheck_required/.test(text))return'not_ready';if(text==='task_result_unverified')return'verification_failed';
 if(/conflict|changed|owner_stale|criteria_invalid|resume_invalid/.test(text))return'changed';return'unavailable';
};
/** Product adapter around the main-only task authority. It never calls a model.
 * Full native plan/step admission remains a separate B2 integration. */
export function createTaskCoordinator(options:{store:OmniEduStore;closing:()=>boolean;busy:(id:string)=>boolean;running:(id:string)=>boolean;emit:(event:XiaozhiAgentEvent)=>void;resultRecheck?:(candidate:TaskCandidate,task:TaskView)=>Promise<TaskVerification>;taskRecheck?:(task:TaskView)=>Promise<TaskVerification[]>}){
 const sql=options.store.xiaozhiState.sql,journal=options.store.xiaozhiState.eventJournal,locked=new Set<string>();
 const deny=async():Promise<string>=>{throw Error('invalid_input');};
 const state=(work=sql,sanitize:(s:string)=>Promise<string>=deny,proof?:TaskVerification,proofs?:TaskVerification[])=>createTaskState(work,{sanitize,...(proof?{resultRecheck:async()=>proof}:{}),...(proofs?{recheck:async()=>proofs}:proof?{recheck:async()=>[proof]}:{})});
 const inline=(work:Sql):Sql=>({...work,transaction:action=>action(work)});
 async function allowed(id:string){if(options.closing())throw Error('busy');if((await options.store.getAiConversationSession(id)).session.archivedAt)throw Error('permission_denied');}
 async function owner(id:string):Promise<TaskOwner>{const row=(await sql.all('SELECT run_id,generation FROM xiaozhi_event_owners WHERE session_id=?',[id]))[0];if(!row)throw Error('permission_denied');return{sessionId:id,runId:String(row.run_id),generation:Number(row.generation)};}
 async function checkpoint(id:string,change:(work:Sql)=>Promise<TaskView>){
  const own=await owner(id),row=(await sql.all('SELECT revision,sequence FROM xiaozhi_event_runs WHERE session_id=? AND run_id=? AND generation=?',[id,own.runId,own.generation]))[0];if(!row)throw Error('permission_denied');
  const saved=await journal.changeTask(own,Number(row.revision),Number(row.sequence)+1,work=>change(inline(work)));
  let delivered=true;for(const event of saved.events){try{options.emit(event);}catch{delivered=false;}}
  if(delivered)await journal.notified(own.runId,saved.cursor.sequence).catch(()=>undefined);return saved.task;
 }
 async function recover(id:string){
  if(options.running(id)||locked.has(id))return;
  const task=await state().latest(id);if(!task||!['active','review_required'].includes(task.state))return;
  const own=await owner(id),row=(await sql.all('SELECT status FROM xiaozhi_event_runs WHERE run_id=? AND session_id=? AND generation=?',[own.runId,id,own.generation]))[0];
  if(!row||row.status==='running')return;
  const success=row.status==='completed';if(task.state==='review_required')try{await state().candidate(id,task.id);return;}catch{/* Interrupted/corrupt completion stays unaccepted. */}
  locked.add(id);try{await checkpoint(id,work=>state(work).settle(own,task.id,task.revision,!success));}finally{locked.delete(id);}
 }
 async function committed(id:string):Promise<TaskView|null>{
  const task=await state().latest(id);if(!task)return null;
  const rows=await sql.all("SELECT e.event_json,e.event_hash FROM xiaozhi_event_journal e JOIN xiaozhi_event_runs r ON r.run_id=e.run_id AND r.generation=e.generation WHERE r.session_id=? AND json_extract(e.event_json,'$.kind')='task' AND json_extract(e.event_json,'$.task.id')=? ORDER BY e.rowid DESC LIMIT 1",[id,task.id]);
  if(!rows.length)throw Error('task_record_uncommitted');const raw=String(rows[0].event_json);if(digest(raw)!==rows[0].event_hash)throw Error('task_record_uncommitted');const event=JSON.parse(raw) as XiaozhiAgentEvent;
  if(event.kind!=='task'||event.durability!=='committed'||event.sessionId!==id||!validTaskView(event.task)||JSON.stringify(event.task)!==JSON.stringify(task))throw Error('task_record_uncommitted');return task;
 }
 async function details(id:string):Promise<TaskSnapshot>{
  const task=await committed(id);if(!task)return{task:null,canAccept:false};
  let candidate;try{candidate=await state().candidate(id,task.id);}catch(e){if(!/candidate_unavailable|owner_stale/.test(e instanceof Error?e.message:''))throw e;}
  let canAccept=false;if(candidate&&!options.busy(id)&&['review_required','paused'].includes(task.state)){
   const message=(await options.store.getAiConversationSession(id)).messages.find(m=>m.id===candidate!.messageId),v=message?.metadata.verification;
   canAccept=validTaskVerification(v,candidate.runId)&&['needs_human','verified'].includes(v.state)&&v.operations.failed===0&&task.criteria.every(c=>c.kind==='human'||task.checks.some(k=>k.criterionId===c.id&&k.criterionVersion===c.version&&k.state==='passed'));
  }
  let canResume=false;if(!options.busy(id)&&taskHasRemainingSteps(task))try{await resumeSource(id,task.id,task.revision,task.requirementsVersion);canResume=true;}catch{/* Changed sources cannot be resumed from a stale card. */}
  return{task,...(candidate?{candidate}:{}),canAccept,canResume};
 }
 return{
  async start(sessionId:string,runId:string,commandId:string,publisher:ReturnType<typeof createEventPublisher>,continuation?:TaskContinuation){
   const detail=await options.store.getAiConversationSession(sessionId),message=detail.messages.find(m=>m.role==='user'&&m.metadata.agentRunId===runId&&m.metadata.piVersion==='xiaozhi.pi.education.v1');if(!message)throw Error('task_source_changed');
   if(continuation){
    const current=await committed(sessionId);
    if(!current||current.id!==continuation.taskId||current.requirementsVersion!==continuation.requirementsVersion||current.goal||!['paused','interrupted','review_required'].includes(current.state))throw Error('task_resume_invalid');
    return publisher.checkpointTask(work=>state(inline(work)).resume(publisher.owner,current.id,current.revision,commandId,undefined,message.id,continuation));
   }
   const goal=await goalFromSource(sql,sessionId,message.id),prior=goal?await state().forGoal(sessionId,goal.id):null;
   if(goal&&prior)return publisher.checkpointTask(async work=>{const tasks=state(inline(work)),bound=await tasks.adoptGoal(publisher.owner,prior.id,prior.revision,goal.id);return tasks.resume(publisher.owner,bound.id,bound.revision,commandId,goal.id);});
   const unfinished=!goal&&isTaskContinuation(message.content)?await committed(sessionId):null;
   if(unfinished&&!unfinished.goal&&['paused','interrupted','review_required'].includes(unfinished.state)){
    return publisher.checkpointTask(work=>state(inline(work)).resume(publisher.owner,unfinished.id,unfinished.revision,commandId,undefined,message.id));
   }
   const cleaned=(await options.store.sanitizeProblemText(message.content)).sanitizedText;
   return publisher.checkpointTask(work=>state(inline(work),async text=>{if(text!==message.content)throw Error('task_source_changed');return cleaned;}).create(publisher.owner,message.id,commandId));
  },
  async finish(task:TaskView,publisher:ReturnType<typeof createEventPublisher>,failed:boolean){return publisher.checkpointTask(async work=>{
   const tasks=state(inline(work)),actual=await tasks.get(task.id);if(!actual)throw Error('task_missing');return tasks.settle(publisher.owner,actual.id,actual.revision,failed);
  });},
  async compact(sessionId:string,publisher:ReturnType<typeof createEventPublisher>){const current=await state().latest(sessionId);if(!current)return;return publisher.checkpointTask(work=>state(inline(work)).bindEventOwner(publisher.owner,current.id,current.revision));},
  prepareResume,
  async prepareGoal(sessionId:string,goalId:string){await allowed(sessionId);const prior=await state().forGoal(sessionId,goalId);if(prior)await state().previewGoalResume(sessionId,prior.id,prior.revision,goalId);},
  async resume(input:TaskResumeInput,publisher:ReturnType<typeof createEventPublisher>){await prepareResume(input);return publisher.checkpointTask(work=>state(inline(work)).resume(publisher.owner,input.taskId,input.revision,input.commandId));},
  admittedRuns:(sessionId:string,taskId:string)=>state().admittedRuns(sessionId,taskId),
  recover,
  committed,
  async acceptGoal(goal:PrivateGoal,checked:number[]){
   if(checked.length!==goal.criteria.length||goal.criteria.some((_v,i)=>!checked.includes(i)))throw Error('invalid_input');
   const prior=await state().forGoal(goal.sessionId,goal.id);if(!prior)throw Error('command_conflict');
   if(!prior.goal)await checkpoint(goal.sessionId,work=>state(work).adoptGoalReview(goal.sessionId,prior.id,prior.revision,goal.id));
   const current=await details(goal.sessionId);if(!current.task?.goal||current.task.goal.id!==goal.id||!current.candidate)throw Error('command_conflict');
   const input:TaskReviewInput={schema:'xiaozhi.task.v1',sessionId:goal.sessionId,taskId:current.task.id,revision:current.task.revision,requirementsVersion:current.task.requirementsVersion,requestId:'xitact_'+randomUUID(),candidate:current.candidate,checked:current.task.criteria.filter(c=>c.kind==='human').map(c=>({criterionId:c.id,version:c.version,accepted:true}))};
   const result=await mutate(input,'review',goal);if(!result.ok)throw Error(result.error==='busy'?'busy':result.error==='permission_denied'?'permission_denied':'command_conflict');
   const updated=await createGoalState(sql).get(goal.id);if(!updated||updated.state!=='completed')throw Error('command_conflict');return publicGoal(updated);
  },
  async snapshot(raw:unknown):Promise<TaskApiResult>{if(!validTaskQuery(raw))return{ok:false,error:'invalid_input'};try{await allowed(raw.sessionId);await recover(raw.sessionId);return{ok:true,value:await details(raw.sessionId)};}catch(e){return{ok:false,error:errorCode(e)};}},
  async review(raw:unknown):Promise<TaskApiResult>{
   if(!validTaskReview(raw))return{ok:false,error:'invalid_input'};return mutate(raw,'review');
  },
  async correct(raw:unknown):Promise<TaskApiResult>{
   if(!validTaskCorrection(raw))return{ok:false,error:'invalid_input'};return mutate(raw,'correct');
  }
 };
 async function prepareResume(input:TaskResumeInput){
  if(!validTaskResume(input))throw Error('invalid_input');await allowed(input.sessionId);
  return resumeSource(input.sessionId,input.taskId,input.revision,input.requirementsVersion);
 }
 async function resumeSource(sessionId:string,taskId:string,revision:number,requirementsVersion:number){
  const detail=await options.store.getAiConversationSession(sessionId),task=await state().previewResume(sessionId,taskId,revision,requirementsVersion);
  if(detail.messages.some(m=>m.id===task.origin.messageId&&m.metadata.goalId))throw Error('task_resume_invalid');
  return task;
 }
 async function mutate(input:TaskReviewInput|TaskCorrectionInput,kind:'review'|'correct',expectedGoal?:PrivateGoal):Promise<TaskApiResult>{
  const id=input.sessionId;if(locked.has(id))return{ok:false,error:'busy'};locked.add(id);
  try{
   await allowed(id);if(options.busy(id))throw Error('busy');const observed=await committed(id);if(!observed||observed.id!==input.taskId)throw Error('task_source_changed');
   const cleaned=new Map<string,string>();if(kind==='correct')for(const c of (input as TaskCorrectionInput).criteria)cleaned.set(c.text,(await options.store.sanitizeProblemText(c.text)).sanitizedText);
   let proof:TaskVerification|undefined;
   if(kind==='review'&&(input as TaskReviewInput).checked.every(c=>c.accepted)&&!await readTaskAction(sql,input.requestId)&&options.resultRecheck){const current=await state().candidate(id,input.taskId);if(JSON.stringify(current)!==JSON.stringify((input as TaskReviewInput).candidate))throw Error('task_candidate_changed');proof=await options.resultRecheck(current,observed);}
   let proofs:TaskVerification[]|undefined;
   if(kind==='review'&&(input as TaskReviewInput).checked.every(c=>c.accepted)&&!await readTaskAction(sql,input.requestId)&&observed.criteria.some(c=>c.kind!=='human')&&options.taskRecheck){const fresh=await options.taskRecheck(observed);proofs=[...new Map([...fresh,...(proof?[proof]:[])].map(v=>[v.runId,v])).values()];}
   if(options.busy(id)||options.closing())throw Error('busy');
   await checkpoint(id,async work=>{if(expectedGoal){const current=await createGoalState(work).get(expectedGoal.id);if(!current||current.revision!==expectedGoal.revision)throw Error('task_revision_conflict');}const task=state(work,async text=>{const value=cleaned.get(text);if(value===undefined)throw Error('invalid_input');return value;},proof,proofs);return kind==='review'?task.review(input as TaskReviewInput):task.correct(input as TaskCorrectionInput);});
   return{ok:true,value:await details(id)};
  }catch(e){return{ok:false,error:errorCode(e)};}finally{locked.delete(id);}
 }
}
