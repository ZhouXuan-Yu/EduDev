import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {Sql} from '../session-state';
import type {createEventPublisher} from '../events/publisher';
import type {TaskVerification} from '../../../shared/xiaozhi-verification';
import {TASK_PLAN_SCHEMA,TASK_PLAN_PARAMETERS,validTaskPlanInput} from '../../../shared/xiaozhi-task-plan';
import {taskStepState,type TaskView,type TaskCriterion,type TaskStep} from '../../../shared/xiaozhi-task';
import {createTaskState} from './task-state';
import {taskHash,taskToolKinds} from './task-evidence';
import {createTaskResources} from './resources';
import {TaskAdmissionError} from './admission-error';
import {TASK_CONTROL_TOOLS,unwrapTaskArguments} from './tool-envelope';
import {toolManifest} from '../tools/manifest';
import {acquireToolResource} from '../tools/resource-lock';

type Publisher=ReturnType<typeof createEventPublisher>;
type Options={sql:Sql;taskId:string;publisher:Publisher;current:()=>boolean;sanitize:(text:string)=>Promise<string>;resources:ReturnType<typeof createTaskResources>;proofs:()=>Promise<TaskVerification[]>;trustedMcpNames?:ReadonlySet<string>};
function normalizeTaskPlanInput(value:unknown):unknown{
 if(!value||typeof value!=='object'||Array.isArray(value))return value;
 const plan=value as Record<string,unknown>;
 if(!Array.isArray(plan.steps))return value;
 return{...plan,steps:plan.steps.map(step=>{
  if(!step||typeof step!=='object'||Array.isArray(step))return step;
  const row=step as Record<string,unknown>;
  if(row.kind!=='human'||!Object.prototype.hasOwnProperty.call(row,'target'))return row;
  const {target:_ignored,...rest}=row;return rest;
 })};
}
function inferredStepId(task:TaskView,tool:string){
 const matches=task.steps.filter(step=>step.criterionIds.some(id=>{
  const criterion=task.criteria.find(c=>c.id===id);
  return criterion&&taskToolKinds[criterion.kind]?.includes(tool);
 }));
 const executing=matches.filter(step=>taskStepState(task,step.id)==='executing');
 if(executing.length===1)return executing[0].id;
 if(executing.length>1)return undefined;
 const ready=matches.filter(step=>['pending','needs_fix'].includes(taskStepState(task,step.id)));
 return ready.length===1?ready[0].id:undefined;
}
/** Task governance inside the existing Pi dispatch. No model loop or effect replay. */
export function createTaskPlanRuntime(options:Options){
 const {sql,publisher}=options,owner=publisher.owner;
 const state=(work=sql,clean:Map<string,string>=new Map())=>createTaskState(work,{sanitize:async text=>{const value=clean.get(text);if(value===undefined)throw Error('invalid_input');return value;}});
 const inline=(work:Sql):Sql=>({...work,transaction:action=>action(work)});
 const fence=()=>{if(!options.current())throw Error('cancelled');};
 async function governed<T>(action:()=>Promise<T>){let release:()=>void;try{release=acquireToolResource('task-state:'+options.taskId,'write');}catch{throw new TaskAdmissionError('task_busy');}try{return await action();}finally{release();}}
 async function preflight(action:()=>Promise<void>){try{await action();}catch(e){if(e instanceof Error&&/^task_(plan_|criteria_|step_|tool_|call_|effect_|dependency_|source_|requirements_|capacity|owner_stale)/.test(e.message))throw new TaskAdmissionError(e.message);throw e;}}
 async function latest(){fence();const task=await state().latest(owner.sessionId);fence();if(!task||task.id!==options.taskId||task.state!=='active'||task.binding?.runId!==owner.runId||task.binding?.generation!==owner.generation)throw new TaskAdmissionError('task_owner_stale');await preflight(()=>state().validateCurrent(owner,task.id,task.revision));return task;}
 function publicState(task:TaskView){return{schemaVersion:TASK_PLAN_SCHEMA,taskId:task.id,requirementsVersion:task.requirementsVersion,revision:task.planRevision,steps:task.steps.map(s=>({...s,state:taskStepState(task,s.id)})),criteria:task.criteria.map(c=>({id:c.id,text:c.text,kind:c.kind,version:c.version})),note:'reported是模型报告；state来自当前主进程核验。human只能教师确认。'};}
 async function refresh(){await latest();const proofs=await options.proofs();await latest();if(!proofs.length)return;
  await publisher.checkpointTask(async work=>{const tasks=createTaskState(inline(work),{sanitize:async()=>{throw Error('invalid_input');},recheck:async()=>proofs}),task=await tasks.get(options.taskId);if(!task)throw Error('task_missing');return tasks.recheck(owner,task.id,task.revision);});fence();
 }
  async function propose(callId:string,proposed:unknown){
   const raw=normalizeTaskPlanInput(proposed);
  if(!/^[A-Za-z0-9_:.-]{1,128}$/.test(callId)||!validTaskPlanInput(raw))throw new TaskAdmissionError('task_plan_invalid');
  const observed=await latest();if(observed.requirementsVersion!==raw.requirementsVersion)throw new TaskAdmissionError('task_requirements_changed');
  const clean=new Map<string,string>();for(const value of[raw.reason,...raw.steps.map(s=>s.text)])clean.set(value,await options.sanitize(value));
  const criteria:TaskCriterion[]=[],steps:TaskStep[]=[];
  for(const step of raw.steps){
   let ids:string[];
   if(step.kind==='human')ids=observed.criteria.filter(c=>c.kind==='human').map(c=>c.id);
   else{
    let resource:string;try{resource=await options.resources.resource(step.kind,step.target!);}catch(e){if(e instanceof TaskAdmissionError)throw e;if(e instanceof Error&&/permission_denied|no_workspace|invalid.*url/i.test(e.message))throw new TaskAdmissionError('task_target_invalid');throw e;}
    const id='check_'+taskHash([observed.id,step.id,step.kind,resource]).slice(0,24),source=observed.criteria[0];
    ids=[id];if(!observed.criteria.some(c=>c.id===id)){criteria.push({id,version:1,sourceId:source.sourceId,sourceVersion:source.sourceVersion,text:clean.get(step.text)!,kind:step.kind,resource});clean.set(clean.get(step.text)!,clean.get(step.text)!);}
   }
   steps.push({id:step.id,text:step.text,dependsOn:step.dependsOn,reported:step.reported,criterionIds:ids});
  }
  const key='xiaozhi.task-plan.v3:'+taskHash([observed.id,owner.runId,callId]),requestHash=taskHash(raw),prior=(await sql.all('SELECT value_json FROM app_settings WHERE key=?',[key]))[0];
  if(prior){const saved=JSON.parse(String(prior.value_json));if(saved.schema!==TASK_PLAN_SCHEMA||saved.requestHash!==requestHash||saved.taskId!==observed.id||saved.runId!==owner.runId||saved.generation!==owner.generation)throw new TaskAdmissionError('task_plan_call_conflict');return publicState(observed);}
  await preflight(()=>state().previewProposal(owner,observed.id,observed.revision,{expectedRevision:raw.expectedRevision,reason:clean.get(raw.reason)!,steps:steps.map(s=>({...s,text:clean.get(s.text)!}))},criteria));
   const task=await publisher.checkpointTask(async work=>{fence();const tasks=state(inline(work),clean);let current=await tasks.get(observed.id);if(!current)throw Error('task_missing');if(current.requirementsVersion!==raw.requirementsVersion)throw new TaskAdmissionError('task_requirements_changed');
    if(criteria.length)current=await tasks.addCriteria(owner,current.id,current.revision,criteria,true);
    const next=await tasks.propose(owner,current.id,current.revision,{expectedRevision:raw.expectedRevision,reason:raw.reason,steps});
    await work.run('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',[key,JSON.stringify({schema:TASK_PLAN_SCHEMA,requestHash,taskId:next.id,runId:owner.runId,generation:owner.generation,revision:next.planRevision}),next.updatedAt]);return next;});return publicState(task);
 }
 return{
  async context(){return '\n本轮宿主任務：单次读取、单次答复或单次起草不要先调用任务计划工具，直接调用目标工具并继续。safe_read可先直接执行，不要把它们登记进任务计划；计划只登记需要taskStepId准入的写入或候选卡工具。计划采用后，目标工具调用必须在参数顶层包含taskStepId，值取当前executing步骤id；宿主只有在同一工具类型恰有一个可执行匹配步骤时才允许无taskStepId的确定性绑定，多个匹配仍失败关闭。kind必须对应实际操作：file仅读取已有文件，attachment读附件，saved_text新建/修改.md/.txt/.html/.svg或用office_copy_file复制现有文件，saved_office为office_create_document生成普通DOCX/PDF/XLSX/PPTX、education_export_paper导出本会话已确认试卷快照（学生卷/教师卷/答题卡，DOCX/PDF，等待教师Office审批）、education_export_classroom导出课堂快照（PPTX/DOCX/PDF，等待教师确认），human只用于最终教师确认；中间起草不是human，也不应让保存步骤依赖human。office_create_science_figure生成的.html/.svg无论之后是否导出PPT，生成步骤都登记为saved_text，不能登记为saved_office。保存计划通常是第一个无human前置的saved_text或saved_questions步骤，加一个依赖它的最终human步骤。题目/练习卡计划可仅用saved_questions target=current登记变式卡、再登记依赖它的练习卡，最后一个人工核对步骤。实际写入必须有步骤；机器前置只有独立核验通过才解锁。不能用旧update_plan的completed代替。读取/保存目标用相对路径，office_copy_file的saved_text target填写复制目标而不是源文件，saved_questions目标为current；无确定性读回的教学工作使用human，最终由教师核对。每个非human步骤必须提供target；human步骤必须完全省略target字段。\n'+JSON.stringify(publicState(await latest()));},
  tools:[{name:'update_task_plan',label:'更新任务步骤',description:'提出xiaozhi.task-plan.v3任务步骤。safe_read不需要计划，直接执行且不要登记为file/attachment/web/image步骤。只为需要taskStepId准入的写入或候选卡建立计划；单次读取/答复/起草直接调用目标工具。计划采用后，实际写入或候选卡工具调用必须在参数顶层填写taskStepId，值取当前executing步骤id；无taskStepId时宿主只在同一工具恰有一个可执行匹配步骤时确定性绑定，多个匹配失败关闭。expectedRevision取上次宿主revision，requirementsVersion取当前宿主要求版本；首次revision=0。稳定id/dependsOn/reported。kind必须对应实际操作：file=读取已有文件，attachment=读取附件，web=读取网页，image=查看图片，saved_text=新建/修改.md/.txt/.html/.svg或office_copy_file复制文件（包括office_create_science_figure），saved_office=office_create_document生成普通DOCX/PDF/XLSX/PPTX，education_export_paper导出本会话已确认试卷快照（学生卷/教师卷/答题卡，DOCX/PDF，等待教师Office审批），education_export_classroom导出课堂快照（PPTX/DOCX/PDF，等待教师确认），saved_questions=保存题目/练习候选，human=仅最终教师确认。科普HTML即使后续导出PPT，生成步骤也必须用saved_text，不能因“演示/课件”字样改成saved_office。每个非human步骤都必须提供machine target；saved_text使用目标相对路径，office_copy_file填写复制目标而非源文件，saved_questions及saved_bundle使用current；office_deliver_files整包交付用saved_bundle；human步骤必须完全省略target字段。只有最终教师核对用human；中间起草不是human，保存步骤也不要依赖human。模型reported完成不会通过核验；不要删除仍需核对的标准或复用已退役id。',parameters:TASK_PLAN_PARAMETERS as unknown as ToolDefinition['parameters'],execute:async(callId,args)=>{
   try{const value=await governed(()=>propose(callId,args));return{content:[{type:'text' as const,text:JSON.stringify({success:true,adopted:true,...value})}],details:{success:true}};}
   catch(e){if(!(e instanceof TaskAdmissionError))throw e;return{content:[{type:'text' as const,text:JSON.stringify({success:false,adopted:false,reason:e.reason,...publicState(await latest())})}],details:{success:true}};}
  }}] as ToolDefinition[],
  async admit(callId:string,tool:string,raw:unknown){
   if(TASK_CONTROL_TOOLS.has(tool))return;
   // Safe reads without a declared step do not depend on task state. They must not
   // wait behind a concurrent plan checkpoint, which can legitimately take longer
   // than the tool gate while the model issued both calls in one response.
   const unwrapped=unwrapTaskArguments(raw),declared=toolManifest(tool,options.trustedMcpNames);
   const manifest=tool==='education_web_answer'&&['authorize','status'].includes(String(unwrapped.input.action))?{...declared,effect:'local_cache' as const}:declared;
    if(manifest.effect==='safe_read'||manifest.effect==='local_cache'){
     if(!unwrapped.stepId)return;
     let observed:TaskView|null=null;try{observed=await state().latest(owner.sessionId);}catch{/* The execution boundary still fences stale runs. */}
     // A model may prefill a step from a draft plan that was never adopted.
     // Safe/local cache tools remain independent of task state in that case.
     if(!observed?.steps.some(step=>step.id===unwrapped.stepId))return;
    }
   return governed(async()=>{const {stepId:providedStepId,input}=unwrapped,independent=manifest.effect==='safe_read'||manifest.effect==='local_cache';
   let task=await latest(),refreshed=false;
   if(!providedStepId&&!independent){await refresh();task=await latest();refreshed=true;}
   const stepId=providedStepId||(independent?undefined:inferredStepId(task,tool));
   if(!stepId){if(manifest.effect==='safe_read'||manifest.effect==='local_cache')return;throw new TaskAdmissionError('task_plan_required');}
   const step=task.steps.find(s=>s.id===stepId);if(!step)throw new TaskAdmissionError('task_step_missing');
   if(!refreshed)await refresh();const current=refreshed?task:await latest(),actual=current.steps.find(s=>s.id===stepId);if(!actual)throw new TaskAdmissionError('task_step_missing');
   const human=actual.criterionIds.every(id=>current.criteria.find(c=>c.id===id)?.kind==='human');
   let resource:string;if(human){const saved=Object.entries(taskToolKinds).find(([kind,names])=>kind.startsWith('saved_')&&names?.includes(tool));resource=saved?await options.resources.invocation(saved[0] as TaskCriterion['kind'],tool,input):typeof input.path==='string'?await options.resources.resource('file',input.path):taskHash(['human-operation',current.id,tool]);}
   else{const criterion=current.criteria.find(c=>c.id===actual.criterionIds[0])!;try{resource=await options.resources.invocation(criterion.kind,tool,input,criterion.resource);}catch(e){if(e instanceof TaskAdmissionError)throw e;throw new TaskAdmissionError('task_target_invalid');}}
    const action=typeof input.action==='string'?input.action:'';
    const safeAfterVerified=manifest.effect==='safe_read'||manifest.effect==='local_cache'||tool==='office_browser'&&['snapshot','screenshot','show','tabs','wait','scroll'].includes(action);
    if(taskStepState(current,stepId)==='waiting_dependency')throw new TaskAdmissionError('task_dependency_blocked');if(taskStepState(current,stepId)==='verified'&&!safeAfterVerified)throw new TaskAdmissionError('task_step_already_verified');
   // Known model conflicts are refused before a task checkpoint, not disguised
   // as a failed critical journal write.
   if(!human&&!actual.criterionIds.some(id=>current.criteria.find(c=>c.id===id)?.resource===resource))throw new TaskAdmissionError('task_tool_scope');
    await preflight(()=>state().previewAdmission(owner,current.id,current.revision,stepId,callId,tool,taskHash([tool,input]),resource,human,human&&['local_write','external_effect'].includes(manifest.effect),safeAfterVerified));
    await publisher.checkpointTask(async work=>{const tasks=state(inline(work)),view=await tasks.get(current.id);if(!view)throw Error('task_missing');return tasks.admit(owner,view.id,view.revision,stepId,callId,tool,taskHash([tool,input]),resource,human,human&&['local_write','external_effect'].includes(manifest.effect),safeAfterVerified);});fence();
   });
  },
  refresh,
 };
}
