import type {TaskContinuation} from '../../../shared/xiaozhi-start';
import type {Sql} from '../session-state';
import {isTaskFollowUp,isTaskAmendment,isBoundTaskAmendment} from './continuation';
import {recordTaskAmendment} from './task-amendment';
import {taskControlState,type TaskControlAction,type TaskControlInput} from '../../../shared/xiaozhi-task-control';
import {TASK_SCHEMA,validTaskOwner,validTaskView,validTaskSteps,validTaskCriterion,taskObject,taskKeys,taskText,taskIdentity,taskDigest,taskNatural,taskStepState,type TaskView,type TaskOwner,type TaskCriterion,type TaskSource,type TaskPlanProposal} from '../../../shared/xiaozhi-task';
import {validTaskVerification,type TaskVerification} from '../../../shared/xiaozhi-verification';
import {taskHash as hash,taskToolKinds as toolKinds,applyTaskReadback,applyTaskRecheck} from './task-evidence';
import {createTaskTeacherActions,readTaskAction,auditTaskTeacherChecks} from './teacher-actions';
import {toolManifest} from '../tools/manifest';
import {taskHasRemainingSteps} from '../../../shared/xiaozhi-task';
import {bindGoalRequirements,goalFromSource,goalTaskKey,requireTaskGoal} from './goal-binding';
import {writeTaskCheckpoint, readTaskCheckpoint, type TaskCheckpointRef} from './checkpoints';
import {validTaskPlanning, type TaskPlanning} from '../../../shared/xiaozhi-task-planning';
import {evaluateTaskPlanning} from './planning-policy';
import {mockExamResumeCalls} from '../mock-exam-delivery-resume';
import {fileWasNotDispatched} from '../effects/non-dispatch';

type Admission={runId:string;generation:number;callId:string;tool:string;stepId:string;planRevision:number;requirementsVersion:number;inputDigest:string;resource:string;criterionIds?:string[]};
export type TaskDocument={view:TaskView;retiredIds:string[];lineage:{runId:string;generation:number;commandId:string}[];admissions:Admission[];eventOwner?:TaskOwner;checkpoint?:TaskCheckpointRef};
export type TaskRecord={raw:string;doc:TaskDocument};
const stamp=()=>new Date().toISOString();
const prefix='xiaozhi.task.v1:';
export const taskIdentityFor=(sessionId:string,messageId:string)=>'xitask_'+hash([sessionId,messageId]);
const key=(id:string)=>prefix+id;
const latestKey=(id:string)=>prefix+'session:'+id;
const clone=<T>(v:T):T=>structuredClone(v);
const effectful=(tool:string)=>{try{return['local_write','external_effect'].includes(toolManifest(tool).effect);}catch{return true;}};
const matches=(a:TaskOwner,b:TaskOwner|null)=>!!b&&a.sessionId===b.sessionId&&a.runId===b.runId&&a.generation===b.generation;

function decode(raw:string,id:string):TaskDocument{
 let value:unknown;try{value=JSON.parse(raw);}catch{throw Error('task_corrupt');}
 if(!taskObject(value)||![4,5,6].includes(Object.keys(value).length)||!taskKeys(value,['view','retiredIds','lineage','admissions','eventOwner','checkpoint'])||!validTaskView(value.view)||value.view.id!==id)throw Error('task_corrupt');
 const doc=value as unknown as TaskDocument;
 if(doc.checkpoint!==undefined&&(!taskObject(doc.checkpoint)||Object.keys(doc.checkpoint).length!==4||doc.checkpoint.schemaVersion!==1
  ||doc.checkpoint.taskRevision!==doc.view.revision||!/^xitcp_[a-f0-9]{64}$/u.test(doc.checkpoint.id)||!taskDigest(doc.checkpoint.digest)))throw Error('task_corrupt');
 if(doc.view.id!==taskIdentityFor(doc.view.sessionId,doc.view.origin.messageId))throw Error('task_corrupt');
 if(doc.eventOwner&&(!validTaskOwner(doc.eventOwner)||doc.eventOwner.sessionId!==doc.view.sessionId||doc.view.state==='active'))throw Error('task_corrupt');
 if(!Array.isArray(doc.retiredIds)||doc.retiredIds.length>64||doc.retiredIds.some(id=>!taskText(id,48))||new Set(doc.retiredIds).size!==doc.retiredIds.length||doc.view.steps.some(s=>doc.retiredIds.includes(s.id)))throw Error('task_corrupt');
 if(!Array.isArray(doc.lineage)||!doc.lineage.length||doc.lineage.length>64||doc.lineage.some(o=>!taskObject(o)||Object.keys(o).length!==3||!validTaskOwner({sessionId:doc.view.sessionId,runId:o.runId,generation:o.generation})||!taskIdentity(o.commandId))||new Set(doc.lineage.map(o=>o.runId)).size!==doc.lineage.length||doc.lineage[0].runId!==doc.view.origin.runId||doc.lineage[0].commandId!==doc.view.origin.commandId||doc.view.binding&&!matches({...doc.lineage.at(-1)!,sessionId:doc.view.sessionId},doc.view.binding))throw Error('task_corrupt');
 if(!Array.isArray(doc.admissions)||doc.admissions.length>256||doc.admissions.some(a=>!taskObject(a)||![9,10].includes(Object.keys(a).length)||!taskKeys(a,['runId','generation','callId','tool','stepId','planRevision','requirementsVersion','inputDigest','resource','criterionIds'])||![a.runId,a.callId,a.tool,a.stepId].every(taskIdentity)||!taskNatural(a.generation)||a.generation<1||!taskNatural(a.planRevision)||a.planRevision<1||!taskNatural(a.requirementsVersion)||a.requirementsVersion<1||!taskDigest(a.inputDigest)||typeof a.resource!=='string'||a.resource.length>512||a.criterionIds!==undefined&&(!Array.isArray(a.criterionIds)||!a.criterionIds.length||a.criterionIds.length>16||!a.criterionIds.every(taskIdentity)||new Set(a.criterionIds).size!==a.criterionIds.length)||!doc.lineage.some(o=>o.runId===a.runId&&o.generation===a.generation))||new Set(doc.admissions.map(a=>JSON.stringify([a.runId,a.callId]))).size!==doc.admissions.length)throw Error('task_corrupt');
 if(doc.view.lastRunId!==undefined&&doc.view.lastRunId!==doc.lineage.at(-1)?.runId)throw Error('task_corrupt');
 return doc;
}

function applyPlan(doc:TaskDocument,clean:TaskPlanProposal){
    if(doc.view.planRevision!==clean.expectedRevision)throw Error('task_plan_conflict');
    if(clean.steps.some(s=>doc.retiredIds.includes(s.id)||s.criterionIds.some(cid=>!doc.view.criteria.some(c=>c.id===cid))))throw Error('task_plan_invalid');
    // Every original teacher requirement remains attached to a step.
    if(doc.view.criteria.some(c=>!clean.steps.some(s=>s.criterionIds.includes(c.id))))throw Error('task_criteria_unmapped');
    for(const old of doc.view.steps){const next=clean.steps.find(s=>s.id===old.id);if(!next){doc.retiredIds.push(old.id);continue;}
     if((JSON.stringify(old.dependsOn)!==JSON.stringify(next.dependsOn)||JSON.stringify(old.criterionIds)!==JSON.stringify(next.criterionIds))&&doc.admissions.some(a=>a.stepId===old.id))throw Error('task_step_rebind');
    }
    if(doc.retiredIds.length>64)throw Error('task_capacity');doc.view.steps=clone(clean.steps);doc.view.planRevision++;doc.view.planReason=clean.reason;
    if (clean.planning) {
      if (!validTaskPlanning(clean.planning) || clean.planning.planRevision !== doc.view.planRevision || clean.planning.requirementsVersion !== doc.view.requirementsVersion) throw Error('task_plan_invalid');
      doc.view.planning = clone(clean.planning);
    } else delete doc.view.planning;
}
function applyAdmission(doc:TaskDocument,owner:TaskOwner,stepId:string,callId:string,tool:string,inputDigest:string,resource:string,humanScope:boolean,humanEffect:boolean,safeAfterVerified:boolean,accountedPriorEffects:ReadonlySet<string>=new Set()){
    const step=doc.view.steps.find(s=>s.id===stepId);if(!step||taskStepState(doc.view,stepId)==='waiting_dependency')throw Error('task_dependency_blocked');
    if(taskStepState(doc.view,stepId)==='verified'&&!safeAfterVerified)throw Error('task_step_already_verified');
    if(!step.criterionIds.some(cid=>{const criterion=doc.view.criteria.find(c=>c.id===cid)!;return humanScope&&criterion.kind==='human'||criterion.resource===resource&&toolKinds[criterion.kind]?.includes(tool);}))throw Error('task_tool_scope');
    const currentEffect=humanEffect||step.criterionIds.some(cid=>doc.view.criteria.find(c=>c.id===cid)?.kind.startsWith('saved_'));
    const priorEffect=doc.admissions.some(a=>a.runId!==owner.runId&&a.resource===resource&&a.requirementsVersion===doc.view.requirementsVersion&&currentEffect&&effectful(a.tool)&&!accountedPriorEffects.has(JSON.stringify([a.runId,a.callId])));
    if(priorEffect)throw Error(step.criterionIds.some(cid=>doc.view.criteria.find(c=>c.id===cid)?.resource===resource&&doc.view.checks.some(k=>k.criterionId===cid&&k.state==='passed'))?'task_effect_already_saved':'task_effect_needs_recheck');
    if(humanScope&&humanEffect&&doc.view.criteria.some(c=>c.kind!=='human'&&c.resource===resource))throw Error('task_tool_scope');
    const admission:Admission={runId:owner.runId,generation:owner.generation,callId,tool,stepId,planRevision:doc.view.planRevision,requirementsVersion:doc.view.requirementsVersion,inputDigest,resource,criterionIds:[...step.criterionIds]};
    const prior=doc.admissions.find(a=>a.runId===owner.runId&&a.callId===callId);if(prior){if(JSON.stringify(prior)!==JSON.stringify(admission))throw Error('task_call_rebind');throw Error('task_call_already_admitted');}
    if(doc.admissions.length>=256)throw Error('task_capacity');doc.admissions.push(admission);
}

/** Main-only authority. No model-facing tool or renderer may call evidence/confirm
 * directly. Production activation awaits the typed/runtime B2 adapter. */
export function createTaskState(sql:Sql,options:{sanitize:(text:string)=>Promise<string>;recheck?:(task:TaskView)=>Promise<TaskVerification[]>;resultRecheck?:(candidate:import('../../../shared/xiaozhi-task').TaskCandidate,task:TaskView)=>Promise<TaskVerification>}){
 async function historicalEffectProofs(work:Sql,doc:TaskDocument,owner:TaskOwner,resource:string,stepId:string,humanEffect:boolean,resumeBundleId?:string){
  const criterionIds=doc.view.steps.find(step=>step.id===stepId)?.criterionIds??[];
  const criteria=doc.view.criteria.filter(criterion=>criterionIds.includes(criterion.id));
  const proved=resumeBundleId&&criteria.some(criterion=>criterion.kind==='saved_bundle'&&criterion.resource===resource)
   ?await mockExamResumeCalls(work,owner.sessionId,doc.view.id+':'+doc.view.requirementsVersion,resumeBundleId):new Set<string>();
  if(!humanEffect&&!criteria.some(criterion=>criterion.kind.startsWith('saved_')))return proved;
  for(const admission of doc.admissions){
   if(admission.runId===owner.runId||admission.resource!==resource||admission.requirementsVersion!==doc.view.requirementsVersion||!effectful(admission.tool))continue;
   const call=JSON.stringify([admission.runId,admission.callId]);
   if(!proved.has(call)&&await fileWasNotDispatched(work,doc,admission))proved.add(call);
  }
  return proved;
 }
 async function transaction<T>(action:(work:Sql)=>Promise<T>){if(!sql.transaction)throw Error('task_transaction_required');return sql.transaction(action);}
 async function recordFromRow(work:Sql,id:string,row:Record<string,unknown>,auditChecks=true){
  const raw=String(row.value_json),result={raw,doc:decode(raw,id)};
  if(auditChecks)await auditTaskTeacherChecks(work,result.doc);
  return result;
 }
 async function read(work:Sql,id:string,auditChecks=true){if(!/^xitask_[a-f0-9]{64}$/u.test(id))throw Error('invalid_input');const row=(await work.all('SELECT value_json FROM app_settings WHERE key=?',[key(id)]))[0];return row?recordFromRow(work,id,row,auditChecks):null;}
 async function latestId(work:Sql,sessionId:string):Promise<string|null>{
  const row=(await work.all('SELECT value_json FROM app_settings WHERE key=?',[latestKey(sessionId)]))[0];if(!row)return null;
  let v;try{v=JSON.parse(String(row.value_json));}catch{throw Error('task_corrupt');}
  if(!taskObject(v)||Object.keys(v).length!==2||v.schema!==TASK_SCHEMA||typeof v.taskId!=='string'||!/^xitask_[a-f0-9]{64}$/u.test(v.taskId))throw Error('task_corrupt');return v.taskId;
 }
 async function latestRecord(sessionId:string,audited?:TaskRecord){
  if(!validTaskOwner({sessionId,runId:'validation',generation:1}))throw Error('invalid_input');
  const id=await latestId(sql,sessionId);if(!id)return null;
  const row=audited?.doc.view.id===id?audited:await read(sql,id);
  if(!row||row.doc.view.sessionId!==sessionId)throw Error('task_corrupt');
  return row;
 }
 async function latestView(sessionId:string,audited?:TaskRecord){return clone((await latestRecord(sessionId,audited))?.doc.view||null);}
 function summary(record:TaskRecord){return clone({view:record.doc.view,runIds:record.doc.lineage.map(owner=>owner.runId)});}
 async function current(work:Sql,owner:TaskOwner){
  if(!validTaskOwner(owner))throw Error('invalid_input');
  const row=(await work.all('SELECT o.run_id,o.generation,r.status,s.archived_at FROM xiaozhi_event_owners o JOIN xiaozhi_event_runs r ON r.run_id=o.run_id AND r.generation=o.generation JOIN ai_conversation_sessions s ON s.id=o.session_id WHERE o.session_id=?',[owner.sessionId]))[0];
  if(!row||row.run_id!==owner.runId||Number(row.generation)!==owner.generation||row.status!=='running'||row.archived_at)throw Error('task_owner_stale');
 }
 async function command(work:Sql,owner:TaskOwner,id:string){
  if(!taskIdentity(id))throw Error('invalid_input');const row=(await work.all('SELECT conversation_id,run_id,status FROM xiaozhi_pi_commands WHERE command_id=?',[id]))[0];
  if(!row||row.conversation_id!==owner.sessionId||row.run_id!==owner.runId||row.status!=='running')throw Error('task_command_stale');
 }
 async function source(work:Sql,sessionId:string,messageId:string):Promise<{source:TaskSource;text:string}>{
  if(!taskIdentity(messageId))throw Error('invalid_input');const row=(await work.all('SELECT session_id,role,content,metadata_json FROM ai_conversation_messages WHERE id=?',[messageId]))[0];
  if(!row||row.session_id!==sessionId||row.role!=='user'||!taskText(row.content,64000))throw Error('task_source_changed');
  let metadata:unknown;try{metadata=JSON.parse(String(row.metadata_json));}catch{throw Error('task_source_changed');}
  if(!taskObject(metadata)||metadata.piVersion!=='xiaozhi.pi.education.v1'||!taskIdentity(metadata.agentRunId))throw Error('task_source_changed');
  return{source:{messageId,runId:metadata.agentRunId,version:hash([sessionId,messageId,row.role,row.content,metadata.agentRunId])},text:String(row.content)};
 }
 async function sources(work:Sql,doc:TaskDocument){if(doc.view.goal){const goal=await requireTaskGoal(work,doc.view);if(doc.view.state==='active'&&!['active','waiting_teacher','review_required'].includes(goal.state))throw Error('task_owner_stale');}for(const saved of doc.view.sources){
  if(saved.actionId){const action=await readTaskAction(work,saved.actionId);if(!action||action.body.kind!=='correct'||action.body.taskId!==doc.view.id||action.body.sessionId!==doc.view.sessionId||action.body.runId!==saved.runId||action.version!==saved.version||action.body.requirementsVersion+1!==doc.view.requirementsVersion)throw Error('task_source_changed');const human=doc.view.criteria.filter(c=>c.kind==='human'&&c.sourceId===saved.actionId);if(human.length!==action.body.criteria!.length||human.some(c=>c.version!==doc.view.requirementsVersion||!action.body.criteria!.some(s=>s.id===c.id&&s.text===c.text)))throw Error('task_source_changed');}
  else{const actual=await source(work,doc.view.sessionId,saved.messageId!);if(JSON.stringify(saved)!==JSON.stringify(actual.source))throw Error('task_source_changed');}
 }}
 async function load(work:Sql,id:string,revision:number,owner?:TaskOwner,checkSources=true){
  const record=await read(work,id,checkSources);if(!record)throw Error('task_missing');
  if(record.doc.view.revision!==revision)throw Error('task_revision_conflict');
  if(owner){await current(work,owner);if(record.doc.view.state!=='active'||!matches(owner,record.doc.view.binding)||await latestId(work,owner.sessionId)!==id)throw Error('task_owner_stale');}
  if(checkSources)await sources(work,record.doc);return record;
 }
 async function save(work:Sql,previous:{raw:string;doc:TaskDocument}|null,doc:TaskDocument){
  if(!work.change)throw Error('task_transaction_required');
  const view=doc.view;view.revision=previous?previous.doc.view.revision+1:1;view.updatedAt=stamp();
  if(view.planning&&(view.planning.requirementsVersion!==view.requirementsVersion||view.planning.planRevision!==view.planRevision))delete view.planning;
  doc.checkpoint=await writeTaskCheckpoint(work,view,doc.eventOwner||view.binding||{sessionId:view.sessionId,...doc.lineage.at(-1)!});
  const raw=JSON.stringify(doc);if(Buffer.byteLength(raw)>512*1024)throw Error('task_capacity');decode(raw,view.id);
  const changed=previous?await work.change('UPDATE app_settings SET value_json=?,updated_at=? WHERE key=? AND value_json=?',[raw,view.updatedAt,key(view.id),previous.raw]):await work.change('INSERT OR IGNORE INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',[key(view.id),raw,view.updatedAt]);
  if(changed!==1)throw Error('task_revision_conflict');
  // This immutable internal state history is not the public event journal. The
  // runtime adapter must commit its public task event before tool dispatch.
  if(await work.change('INSERT OR IGNORE INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',[`${key(view.id)}:revision:${view.revision}`,raw,view.updatedAt])!==1)throw Error('task_history_conflict');
  return clone(view);
 }
 async function mutate(owner:TaskOwner,id:string,revision:number,action:(doc:TaskDocument,work:Sql)=>Promise<void>|void){return transaction(async work=>{const before=await load(work,id,revision,owner),next=clone(before.doc);await action(next,work);await current(work,owner);return save(work,before,next);});}
 return{
  ...createTaskTeacherActions({sql,sanitize:options.sanitize,recheck:options.recheck,resultRecheck:options.resultRecheck,transaction,read,load,save,latestId}),
  async previewProposal(owner:TaskOwner,id:string,revision:number,input:TaskPlanProposal,criteria:TaskCriterion[]=[]){
   const doc=clone((await load(sql,id,revision,owner)).doc);
   if(criteria.some(c=>!validTaskCriterion(c)||c.kind==='human'||c.version!==1||doc.view.criteria.some(old=>old.id===c.id))||doc.view.criteria.length+criteria.length>32)throw Error('task_criteria_locked');
   if(!taskText(input.reason,500)||!validTaskSteps(input.steps))throw Error('task_plan_invalid');doc.view.criteria.push(...clone(criteria));applyPlan(doc,input);decode(JSON.stringify(doc),id);
  },
  async validateCurrent(owner:TaskOwner,id:string,revision:number){await load(sql,id,revision,owner);},
  /** Authority reads observe one current snapshot. A legitimate planning write
   * must not turn a cached mutation-CAS revision into lost Run authority. */
  async validateCurrentOwner(owner:TaskOwner,id:string,requirementsVersion:number){
    if(!taskNatural(requirementsVersion)||requirementsVersion<1)throw Error('invalid_input');
    const check=async(work:Sql)=>{
      const record=await read(work,id);if(!record)throw Error('task_missing');
      await current(work,owner);
      if(record.doc.view.state!=='active'||!matches(owner,record.doc.view.binding)
        ||await latestId(work,owner.sessionId)!==id)throw Error('task_owner_stale');
      if(record.doc.view.requirementsVersion!==requirementsVersion)throw Error('task_source_changed');
      await sources(work,record.doc);
    };
    if(sql.readTransaction)await sql.readTransaction(check);
    else await transaction(check);
  },
  async recordPlanning(owner:TaskOwner,id:string,revision:number,planning:TaskPlanning){
    return mutate(owner,id,revision,doc=>{
      if(!validTaskPlanning(planning)||planning.requirementsVersion!==doc.view.requirementsVersion||planning.planRevision!==doc.view.planRevision)throw Error('task_plan_invalid');
      doc.view.planning=clone(planning);
    });
  },
  async admission(owner:TaskOwner,id:string,revision:number,callId:string){
    const record=await load(sql,id,revision,owner);
    return clone(record.doc.admissions.find(item=>item.runId===owner.runId&&item.generation===owner.generation&&item.callId===callId)||null);
  },
  async previewResume(sessionId:string,id:string,revision:number,requirementsVersion:number){const record=await load(sql,id,revision),view=record.doc.view;if(view.sessionId!==sessionId||view.requirementsVersion!==requirementsVersion||await latestId(sql,sessionId)!==id||!taskHasRemainingSteps(view))throw Error('task_resume_invalid');return clone(view);},
  async admittedRuns(sessionId:string,id:string){const record=await read(sql,id);if(!record||record.doc.view.sessionId!==sessionId)throw Error('permission_denied');return record.doc.lineage.filter(o=>record.doc.admissions.some(a=>a.runId===o.runId&&a.generation===o.generation&&a.requirementsVersion===record.doc.view.requirementsVersion)).map(o=>({runId:o.runId,generation:o.generation}));},
  async previewAdmission(owner:TaskOwner,id:string,revision:number,stepId:string,callId:string,tool:string,inputDigest:string,resource:string,humanScope=false,humanEffect=false,safeAfterVerified=false,resumeBundleId?:string){
    const doc=clone((await load(sql,id,revision,owner)).doc);applyAdmission(doc,owner,stepId,callId,tool,inputDigest,resource,humanScope,humanEffect,safeAfterVerified,await historicalEffectProofs(sql,doc,owner,resource,stepId,humanEffect,tool==='office_deliver_files'?resumeBundleId:undefined));decode(JSON.stringify(doc),id);
  },
  async get(id:string){return clone((await read(sql,id))?.doc.view||null);},
  async summaryRecord(id:string){const record=await read(sql,id);return record?summary(record):null;},
  async latestSummary(sessionId:string){const record=await latestRecord(sessionId);return record?summary(record):null;},
  /** Main-only isolated snapshot reader: audit the scanned row once and reuse
   * that same document only while checking its original session's latest index. */
  async summaryRecordFromRow(id:string,row:Record<string,unknown>){
   if(!/^xitask_[a-f0-9]{64}$/u.test(id))throw Error('invalid_input');
   if(row.key!==key(id))throw Error('task_corrupt');
   const record=await recordFromRow(sql,id,row);
   return{...summary(record),
    latest:()=>latestView(record.doc.view.sessionId,record)};
  },
  async inspection(id:string){
    const record=await read(sql,id);
    if(!record)return null;
    await sources(sql,record.doc);
    return clone({view:record.doc.view,lineage:record.doc.lineage,
      checkpoint:record.doc.checkpoint?await readTaskCheckpoint(sql,id,record.doc.checkpoint):null});
  },
  async checkpoint(id:string){const record=await read(sql,id);if(!record)return null;return record.doc.checkpoint?readTaskCheckpoint(sql,id,record.doc.checkpoint):null;},
  async ownerForRun(sessionId:string,runId:string){
    const rows=await sql.all(`SELECT key,value_json FROM app_settings WHERE key LIKE 'xiaozhi.task.v1:xitask_%'
      AND key='xiaozhi.task.v1:' || json_extract(value_json,'$.view.id')
      AND json_extract(value_json,'$.view.sessionId')=?
      AND EXISTS(SELECT 1 FROM json_each(value_json,'$.lineage') WHERE json_extract(value,'$.runId')=?)`,[sessionId,runId]);
    if(rows.length!==1)return null;
    const id=String(JSON.parse(String(rows[0].value_json)).view.id);
    const record=await read(sql,id);
    if(!record||record.doc.view.sessionId!==sessionId||['cancelled','completed'].includes(record.doc.view.state))return null;
    const binding=record.doc.lineage.find(item=>item.runId===runId);
    return binding?{sessionId,taskId:id,runId,generation:binding.generation,requirementsVersion:record.doc.view.requirementsVersion}:null;
  },
  async forGoal(sessionId:string,goalId:string){
   if(!/^xigoal_[a-f0-9-]{36}$/iu.test(goalId))throw Error('invalid_input');
   const index=(await sql.all('SELECT value_json FROM app_settings WHERE key=?',[goalTaskKey(goalId)]))[0];
   if(index){let saved;try{saved=JSON.parse(String(index.value_json));}catch{throw Error('task_corrupt');}const row=await read(sql,String(saved?.taskId));if(!row||saved.schema!==TASK_SCHEMA||Object.keys(saved).length!==2||row.doc.view.sessionId!==sessionId||row.doc.view.goal?.id!==goalId)throw Error('task_corrupt');return clone(row.doc.view);}
   const messages=await sql.all("SELECT id FROM ai_conversation_messages WHERE session_id=? AND role='user' AND json_extract(metadata_json,'$.goalId')=? ORDER BY rowid DESC LIMIT 65",[sessionId,goalId]);
   const found:TaskView[]=[];for(const message of messages){const row=await read(sql,taskIdentityFor(sessionId,String(message.id)));if(row)found.push(row.doc.view);if(found.length>1)throw Error('task_goal_legacy_conflict');}
   return found.length?clone(found[0]):null;
  },
  async previewGoalResume(sessionId:string,id:string,revision:number,goalId:string){
   const next=clone((await load(sql,id,revision)).doc),goal=await goalFromSource(sql,sessionId,next.view.origin.messageId);
   if(!goal||goal.id!==goalId||goal.state!=='active'||next.view.sessionId!==sessionId||!['paused','interrupted','review_required'].includes(next.view.state)||next.lineage.length>=64)throw Error('task_resume_invalid');
   if(!next.view.goal)bindGoalRequirements(next.view,goal);else await requireTaskGoal(sql,next.view);return clone(next.view);
  },
  async adoptGoal(owner:TaskOwner,id:string,revision:number,goalId:string){return transaction(async work=>{
   await current(work,owner);const before=await load(work,id,revision),next=clone(before.doc),goal=await goalFromSource(work,owner.sessionId,next.view.origin.messageId);
   if(!goal||goal.id!==goalId||goal.runId!==owner.runId||next.view.sessionId!==owner.sessionId||next.view.state==='active'||['completed','ended'].includes(next.view.state))throw Error('task_resume_invalid');
   if(!next.view.goal)bindGoalRequirements(next.view,goal);else await requireTaskGoal(work,next.view);
   const saved=next.view.goal&&!before.doc.view.goal?await save(work,before,next):clone(next.view);
   for(const [index,value]of[[goalTaskKey(goalId),{schema:TASK_SCHEMA,taskId:id}],[latestKey(owner.sessionId),{schema:TASK_SCHEMA,taskId:id}]] as const)await work.run('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at',[index,JSON.stringify(value),stamp()]);return saved;
  });},
  async adoptGoalReview(sessionId:string,id:string,revision:number,goalId:string){return transaction(async work=>{
   const before=await load(work,id,revision),next=clone(before.doc),goal=await goalFromSource(work,sessionId,next.view.origin.messageId);
   if(!goal||goal.id!==goalId||goal.state!=='review_required'||goal.resultRunId!==next.lineage.at(-1)?.runId||next.view.sessionId!==sessionId||await latestId(work,sessionId)!==id||!['review_required','paused'].includes(next.view.state))throw Error('task_resume_invalid');
   if(next.view.goal){await requireTaskGoal(work,next.view);return clone(next.view);}
   bindGoalRequirements(next.view,goal);const saved=await save(work,before,next);
   await work.run('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',[goalTaskKey(goalId),JSON.stringify({schema:TASK_SCHEMA,taskId:id}),stamp()]);return saved;
  });},
  latest:(sessionId:string)=>latestView(sessionId),
  async requirements(sessionId:string){
   if(!validTaskOwner({sessionId,runId:'validation',generation:1}))throw Error('invalid_input');const id=await latestId(sql,sessionId);if(!id)return null;
   const row=await read(sql,id);if(!row||row.doc.view.sessionId!==sessionId)throw Error('task_corrupt');await sources(sql,row.doc);return clone(row.doc.view);
  },
  async create(owner:TaskOwner,messageId:string,commandId:string){
   if(!validTaskOwner(owner))throw Error('invalid_input');
   const initial=await source(sql,owner.sessionId,messageId),text=await options.sanitize(initial.text);if(!taskText(text,64000))throw Error('invalid_input');
   return transaction(async work=>{
    await current(work,owner);await command(work,owner,commandId);const actual=await source(work,owner.sessionId,messageId);
    if(actual.source.version!==initial.source.version||actual.source.runId!==owner.runId)throw Error('task_source_changed');
    const id=taskIdentityFor(owner.sessionId,messageId),prior=await read(work,id);
    if(prior){if(prior.doc.view.origin.commandId!==commandId||!matches(owner,prior.doc.view.binding)||await latestId(work,owner.sessionId)!==id)throw Error('task_revision_conflict');return clone(prior.doc.view);}
    const goal=await goalFromSource(work,owner.sessionId,messageId);
    const previousId=await latestId(work,owner.sessionId);let contextSources:TaskView['sources']=[];
    if(previousId){const previous=await read(work,previousId);if(!previous||previous.doc.view.sessionId!==owner.sessionId)throw Error('task_corrupt');if(previous.doc.lineage.some(o=>o.runId===owner.runId))throw Error('task_run_already_bound');
     if(!goal&&isTaskAmendment(actual.text)&&previous.doc.view.state!=='ended'){
      await sources(work,previous.doc);contextSources=clone(previous.doc.view.sources).filter(source=>!!source.messageId);
      if(contextSources.length>=32)throw Error('task_capacity');
     }
     if(previous.doc.view.state==='active'){const interrupted=clone(previous.doc);interrupted.view.state='interrupted';interrupted.view.binding=null;await save(work,previous,interrupted);}
    }
    const now=stamp(),view:TaskView={schema:TASK_SCHEMA,id,sessionId:owner.sessionId,revision:1,requirementsVersion:1,planRevision:0,planReason:'依据教师当前请求建立任务；历史来源仅保留上下文，冲突约束以最新明确修订为准，步骤尚未采用',state:'active',origin:{messageId,commandId,runId:owner.runId},sources:[...contextSources,actual.source],criteria:[{id:'teacher_request',version:1,sourceId:messageId,sourceVersion:actual.source.version,text:text.length>400?text.slice(0,399)+'…':text,kind:'human'}],steps:[],checks:[],binding:clone(owner),createdAt:now,updatedAt:now};
    if(goal){if(goal.runId!==owner.runId||goal.state!=='active')throw Error('task_source_changed');bindGoalRequirements(view,goal);}
    view.planning={schemaVersion:1,...evaluateTaskPlanning({stepCount:view.steps.length,dependencyEdges:view.steps.reduce((sum,step)=>sum+step.dependsOn.length,0),
      longRunning:false,requiredCapabilities:0,unresolvedCapabilities:0,selectedProviders:0}),observedTools:[],capabilityRequirements:[],
      requirementsVersion:view.requirementsVersion,planRevision:view.planRevision,checkedAt:now};
    const saved=await save(work,null,{view,retiredIds:[],lineage:[{runId:owner.runId,generation:owner.generation,commandId}],admissions:[]});
    if(goal)await work.run('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',[goalTaskKey(goal.id),JSON.stringify({schema:TASK_SCHEMA,taskId:id}),now]);
    await work.run('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at',[latestKey(owner.sessionId),JSON.stringify({schema:TASK_SCHEMA,taskId:id}),now]);return saved;
   });
  },
  async addCriteria(owner:TaskOwner,id:string,revision:number,criteria:TaskCriterion[],extendPlanned=false){
   if(!Array.isArray(criteria)||!criteria.length||!criteria.every(validTaskCriterion)||criteria.some(c=>c.version!==1||c.kind==='human'))throw Error('invalid_input');
   const cleaned=await Promise.all(criteria.map(async c=>({...c,text:await options.sanitize(c.text)})));
   return mutate(owner,id,revision,doc=>{if(doc.view.planRevision&&!extendPlanned||doc.view.criteria.length+cleaned.length>32||cleaned.some(c=>doc.view.criteria.some(old=>old.id===c.id)))throw Error('task_criteria_locked');doc.view.criteria.push(...clone(cleaned));});
  },
  async propose(owner:TaskOwner,id:string,revision:number,input:TaskPlanProposal){
   if(!taskObject(input)||![3,4].includes(Object.keys(input).length)||!taskKeys(input,['expectedRevision','reason','steps','planning'])||!taskNatural(input.expectedRevision)||!taskText(input.reason,500)||!validTaskSteps(input.steps)
     ||input.planning!==undefined&&!validTaskPlanning(input.planning))throw Error('invalid_input');
   const clean={...input,reason:await options.sanitize(input.reason),steps:await Promise.all(input.steps.map(async s=>({...s,text:await options.sanitize(s.text)})))};
   if(!taskText(clean.reason,500)||!validTaskSteps(clean.steps))throw Error('invalid_input');
   return mutate(owner,id,revision,doc=>{
    applyPlan(doc,clean);
   });
  },
  async admit(owner:TaskOwner,id:string,revision:number,stepId:string,callId:string,tool:string,inputDigest:string,resource:string,humanScope=false,humanEffect=false,safeAfterVerified=false,resumeBundleId?:string){
   if(![stepId,callId,tool].every(taskIdentity)||!taskDigest(inputDigest)||typeof resource!=='string'||resource.length>512)throw Error('invalid_input');
   return mutate(owner,id,revision,async(doc,work)=>{
     applyAdmission(doc,owner,stepId,callId,tool,inputDigest,resource,humanScope,humanEffect,safeAfterVerified,await historicalEffectProofs(work,doc,owner,resource,stepId,humanEffect,tool==='office_deliver_files'?resumeBundleId:undefined));
   });
  },
  async readback(owner:TaskOwner,id:string,revision:number,verification:TaskVerification){
   if(!validTaskVerification(verification,owner.runId)||Math.abs(Date.now()-Date.parse(verification.checkedAt))>60000)throw Error('task_verification_invalid');
   return mutate(owner,id,revision,doc=>applyTaskReadback(doc,verification));
  },
  async recheck(owner:TaskOwner,id:string,revision:number){
   if(!options.recheck)throw Error('task_effect_recheck_required');const before=await load(sql,id,revision,owner),proofs=await options.recheck(clone(before.doc.view));
   return mutate(owner,id,revision,doc=>applyTaskRecheck(doc,proofs));
  },
  async settle(owner:TaskOwner,id:string,revision:number,failed:boolean,control?:TaskControlAction){return transaction(async work=>{
   const before=await load(work,id,revision,undefined,false),next=clone(before.doc),last=next.lineage.at(-1)!;
   const eventOwner=next.eventOwner||{...last,sessionId:next.view.sessionId};
   if(next.view.sessionId!==owner.sessionId||eventOwner.runId!==owner.runId||eventOwner.generation!==owner.generation||!['active','review_required'].includes(next.view.state))throw Error('task_owner_stale');
   const fence=(await work.all('SELECT run_id,generation FROM xiaozhi_event_owners WHERE session_id=?',[owner.sessionId]))[0];
   if(!fence||fence.run_id!==owner.runId||Number(fence.generation)!==owner.generation)throw Error('task_owner_stale');
   if(control&&(!failed||next.view.goal||!matches(owner,next.view.binding)||next.view.state!=='active'))throw Error('task_owner_stale');
   next.view.state=control?taskControlState(control):failed?'interrupted':'review_required';next.view.binding=null;return save(work,before,next);
  });},
  async cancelInactive(input:Extract<TaskControlInput,{revision:number}>){return transaction(async work=>{
   const before=await load(work,input.taskId,input.revision),view=before.doc.view;
   if(view.sessionId!==input.sessionId||view.goal||await latestId(work,input.sessionId)!==view.id)throw Error('permission_denied');
   if(view.requirementsVersion!==input.requirementsVersion||!['paused','interrupted','review_required'].includes(view.state))throw Error('task_revision_conflict');
   const next=clone(before.doc);next.view.state='ended';return save(work,before,next);
  });},
  async bindEventOwner(owner:TaskOwner,id:string,revision:number){return transaction(async work=>{
   await current(work,owner);const before=await load(work,id,revision,undefined,false),next=clone(before.doc);
   if(next.view.sessionId!==owner.sessionId||next.view.state==='active')throw Error('task_owner_stale');
   next.eventOwner=clone(owner);return save(work,before,next);
  });},
  async pause(sessionId:string,id:string,revision:number){return transaction(async work=>{const before=await load(work,id,revision);if(before.doc.view.sessionId!==sessionId||before.doc.view.state!=='active')throw Error('permission_denied');const next=clone(before.doc);next.view.state='paused';next.view.binding=null;return save(work,before,next);});},
  async resume(owner:TaskOwner,id:string,revision:number,commandId:string,goalId?:string,continuationMessageId?:string,continuationTarget?:TaskContinuation,revisionInstruction?:string){return transaction(async work=>{
   await current(work,owner);await command(work,owner,commandId);const before=await load(work,id,revision),next=clone(before.doc);
   const continuation=continuationMessageId?await source(work,owner.sessionId,continuationMessageId):undefined;
   if(continuationTarget&&(!continuation||continuationTarget.taskId!==next.view.id||continuationTarget.requirementsVersion!==next.view.requirementsVersion))throw Error('task_resume_invalid');
   if(continuation&&next.view.sources.length>=32)throw Error('task_capacity');
   if(continuation&&(continuation.source.runId!==owner.runId||!continuationTarget&&!isTaskFollowUp(continuation.text)||next.view.goal||next.view.sources.some(s=>s.messageId===continuationMessageId)))throw Error('task_resume_invalid');
   if(revisionInstruction!==undefined&&(!continuation||!isBoundTaskAmendment(continuation.text)))throw Error('task_resume_invalid');
   if(next.view.sessionId!==owner.sessionId||goalId&&next.view.goal?.id!==goalId||!(['paused','interrupted'].includes(next.view.state)||next.view.state==='review_required'&&(Boolean(goalId)||Boolean(continuation)||taskHasRemainingSteps(next.view)))||next.lineage.some(o=>o.runId===owner.runId)||await latestId(work,owner.sessionId)!==id)throw Error('task_resume_invalid');
   if(continuation){
    next.view.sources.push(continuation.source);
    if(revisionInstruction!==undefined)recordTaskAmendment(next.view,continuation.source,revisionInstruction);
   }
   if(next.lineage.length>=64)throw Error('task_capacity');next.view.state='active';next.view.binding=clone(owner);next.lineage.push({runId:owner.runId,generation:owner.generation,commandId});
   delete next.eventOwner;
   next.view.lastRunId=owner.runId;
   // Existing effects are retained, never dispatched again here. A new runtime
   // must re-read them before unlocking their dependents in the new run.
   next.view.checks=next.view.checks.map(c=>({...c,state:'unknown'}));
   delete next.view.reviewVerification;
   return save(work,before,next);
  });},
 };
}
