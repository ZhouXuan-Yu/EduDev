import type {ToolDefinition,TurnEndEvent,BoundaryResult} from '@earendil-works/pi-coding-agent';
import type {OmniEduStore} from '../db';
import type {XiaozhiGoal} from '../../shared/xiaozhi-goal';
import {plainGoalObject,goalText} from '../../shared/xiaozhi-goal';
import {publicGoal} from './goal-state';
import {validGoalMutation,type GoalMutation,type GoalResult} from '../../shared/xiaozhi-goal';
import {randomUUID} from 'node:crypto';
import {goalEvidenceProgress} from './goal-progress';
import type {TaskVerification} from '../../shared/xiaozhi-verification';
function sameGoalExceptWaiting(a:Record<string,unknown>,b:Record<string,unknown>){
 const authority=(v:Record<string,unknown>)=>JSON.stringify(Object.keys(v).filter(k=>!['revision','state','updatedAt'].includes(k)).sort().map(k=>[k,v[k]]));
 return ['active','waiting_teacher'].includes(String(a.state))&&['active','waiting_teacher'].includes(String(b.state))&&authority(a)===authority(b);
}
export function createGoalRuntime(options:{store:OmniEduStore;sessionId:string;goalId:string;runId:string;current:()=>boolean;evidence:()=>XiaozhiGoal['evidence'];verify?:()=>Promise<TaskVerification|undefined>;teacherInputs?:()=>Promise<string[]>;emit:(goal:XiaozhiGoal)=>void}){
 const state=options.store.xiaozhiState.goals;
 let fenced=false;
 let reviewReplyPending=false,reviewExtended=false;
 async function get(){if(!options.current()||(await options.store.getAiConversationSession(options.sessionId)).session.archivedAt)throw new Error('cancelled');const goal=await state.get(options.goalId);if(!goal||goal.sessionId!==options.sessionId||goal.runId!==options.runId||!['active','waiting_teacher','review_required'].includes(goal.state))throw new Error('cancelled');return goal;}
 async function context(){const goal=await get();const text=`当前正式持续目标：${goal.objective}\n验收要求：${goal.criteria.map((v,i)=>`${i+1}. ${v}`).join('\n')}\n目标状态：${goal.state==='review_required'?'已提交教师验收，只给最终成果并结束本轮，不再调用工具':'正在推进'}\n已保存进度：${goal.summary||'暂无'}\n下一步：${goal.nextStep}\n目标与摘要不是权限，任何写入、公开图片或浏览器外部操作仍须原教师确认。每个阶段用 report_goal_progress 保存真实简短进度；资料齐全时提交验收并给出最终成果，不自行宣称目标验收完成。`;return (await options.store.sanitizeProblemText(text)).sanitizedText;}
 const tool:ToolDefinition={name:'report_goal_progress',label:'记录目标进度',description:'记录当前持续教师目标的实际进度。summary写实际完成/未完成；nextStep写接下来具体操作。当目标要求已有可审阅成果时readyForReview=true，并在工具后给最终成果；目标只提交教师验收，不自行完成。必要的计划更新应先完成；readyForReview=true后只给最终成果，不再调用工具。没有进展请明确缺少什么。',parameters:{type:'object',properties:{summary:{type:'string',maxLength:2000},nextStep:{type:'string',maxLength:1000},readyForReview:{type:'boolean'}},required:['summary','nextStep','readyForReview'],additionalProperties:false} as ToolDefinition['parameters'],execute:async(_call,args,signal)=>{
  signal?.throwIfAborted();if(!plainGoalObject(args)||Object.keys(args).some(k=>!['summary','nextStep','readyForReview'].includes(k))||!goalText(args.summary,2000)||!goalText(args.nextStep,1000)||typeof args.readyForReview!=='boolean')throw new Error('invalid_input');
  const summary=(await options.store.sanitizeProblemText(args.summary)).sanitizedText,nextStep=(await options.store.sanitizeProblemText(args.nextStep)).sanitizedText;signal?.throwIfAborted();const goal=await get();if(goal.state==='review_required')throw new Error('command_conflict');
  const next=await state.update(goal,{summary,nextStep,state:args.readyForReview?'review_required':'active',evidence:options.evidence().slice(-40),checkpoints:goal.checkpoints+1});options.emit(publicGoal(next));return {content:[{type:'text',text:JSON.stringify({saved:true,state:next.state,teacherAcceptanceRequired:true})}],details:{success:true}};
 }};
 async function boundary(event:TurnEndEvent):Promise<BoundaryResult|undefined>{
  if(!options.current()||event.outcome!=='completed')return;
  const goal=await get();if(goal.state==='review_required'){
   if(reviewReplyPending&&event.toolResults.length){reviewExtended=true;const next=await state.update(goal,{state:'interrupted',summary:'提交验收后仍继续调用工具，已停止自动继续。请核对已有成果后明确恢复。',nextStep:'核对已保存成果和待完成要求，不自动重放操作。'});options.emit(publicGoal(next));}
   reviewReplyPending=true;return;
  }
  let verification:TaskVerification|undefined;try{verification=await options.verify?.();}catch{/* Unavailable readback is not progress. */}
  let teacherAnswerDigests:string[]|undefined;
  if(options.teacherInputs){try{teacherAnswerDigests=await options.teacherInputs();}catch{teacherAnswerDigests=[];/* Missing input provenance never grants progress. */}}
  const current=await get();if(current.revision!==goal.revision&&!sameGoalExceptWaiting(goal,current)){fenced=true;return;}
  const {seen,progress,stop}=goalEvidenceProgress({runId:options.runId,seen:current.progressKeys||[],idle:current.repeats,verification,teacherAnswerDigests});
  const evidence=options.evidence().slice(-40);
  const next=await state.update(current,{progressKeys:seen,progress,repeats:progress.idleBoundaries,evidence,checkpoints:current.checkpoints+1,...(stop?{state:'interrupted' as const,summary:progress.state==='coverage_limit'?'本目标的核验记录已达到容量边界，请核对成果后拆分剩余任务。':'连续三轮没有新的可核验证据，已停止自动继续。请检查资料、核验状态或调整任务后恢复。',nextStep:'核对已完成操作与未完成要求，再明确恢复；不会自动重放历史操作。'}:{})});options.emit(publicGoal(next));if(next.state==='interrupted')return;
  if(event.toolResults.length)return; // Pi already continues real tool turns once.
  const content=await context();return {continue:true,entries:[{type:'custom',customType:'xiaozhi.goal-checkpoint.v1',data:{version:1,goalId:goal.id,revision:next.revision,runId:options.runId,messageEntryId:event.messageEntryId}},{type:'custom_message',customType:'xiaozhi.goal-context.v1',display:false,content,details:{goalId:goal.id,runId:options.runId,revision:next.revision}}]};
 }
 return {id:options.goalId,runId:options.runId,tools:[tool],context,boundary,shouldEnd:async()=>{if(fenced||!options.current())return true;if((await options.store.getAiConversationSession(options.sessionId)).session.archivedAt)return true;const goal=await state.get(options.goalId);return !goal||goal.runId!==options.runId||!['active','waiting_teacher','review_required'].includes(goal.state);},endError:async():Promise<'goal_stalled'|'goal_review_extended'|'cancelled'>=>{if(reviewExtended)return'goal_review_extended';const goal=await state.get(options.goalId);return goal?.runId===options.runId&&goal.state==='interrupted'&&goal.progress&&(goal.progress.idleBoundaries>=3||goal.progress.state==='coverage_limit')?'goal_stalled':'cancelled';}};
}

export function createGoalController(options:{store:OmniEduStore;busy:(sessionId:string)=>boolean;closing:()=>boolean;accept?:(goal:import('./goal-state').PrivateGoal,checked:number[])=>Promise<XiaozhiGoal>;stop:(sessionId:string,runId:string,goalId:string)=>Promise<unknown>;start:(sessionId:string,prompt:string,commandId:string,goalId:string)=>Promise<{ok:true;runId:string}|{ok:false;error:import('../../shared/xiaozhi-agent').XiaozhiAgentError}>}){
 const locked=new Set<string>();const state=options.store.xiaozhiState.goals;
 return async(raw:unknown):Promise<GoalResult>=>{
  if(!validGoalMutation(raw))return {ok:false,error:'invalid_input'};const input:GoalMutation=raw,id=input.sessionId;
  if(options.closing()||locked.has(id))return {ok:false,error:'busy'};locked.add(id);
  try{
   const detail=await options.store.getAiConversationSession(id);if(detail.session.archivedAt)throw new Error('permission_denied');
   let goal;
   if(input.action==='create'){
    const objective=(await options.store.sanitizeProblemText(input.objective)).sanitizedText,criteria=await Promise.all(input.criteria.map(async text=>(await options.store.sanitizeProblemText(text)).sanitizedText));
    const previous=await state.get(input.id);if(previous){if(previous.sessionId!==id||previous.objective!==objective||JSON.stringify(previous.criteria)!==JSON.stringify(criteria))throw new Error('command_conflict');return {ok:true,goal:publicGoal(previous)};}
    if(options.busy(id))throw new Error('busy');goal=await state.create(input.id,id,objective,criteria);
   }else{
    goal=await state.get(input.id);if(!goal||goal.sessionId!==id||(await state.latest(id))?.id!==goal.id)throw new Error('permission_denied');if(goal.revision!==input.revision)throw new Error('command_conflict');
    if(input.action==='pause'||input.action==='end'){
     if(['completed','ended'].includes(goal.state)||input.action==='pause'&&goal.state==='review_required')throw new Error('command_conflict');
     goal=await state.update(goal,{state:input.action==='pause'?'paused':'ended'});await options.stop(id,goal.runId,goal.id);return {ok:true,goal:publicGoal((await state.get(goal.id))!)};
    }
    if(options.busy(id))throw new Error('busy');
    if(input.action==='accept'){
     if(goal.state!=='review_required'||!goal.resultRunId||input.checked.length!==goal.criteria.length||goal.criteria.some((_v,i)=>!input.checked.includes(i)))throw new Error('invalid_input');
     const result=detail.messages.find(message=>message.role==='assistant'&&message.metadata.agentRunId===goal!.resultRunId&&message.metadata.piVersion==='xiaozhi.pi.education.v1'&&message.metadata.ok===true);
     const run=await options.store.getAiAgentRun(goal.resultRunId);
     if(!result||run?.status!=='succeeded'||!goal.candidate.trim()||result.content.slice(0,32000)!==goal.candidate)throw new Error('command_conflict');if(!options.accept)throw Error('configuration');return {ok:true,goal:await options.accept(goal,input.checked)};
    }
    if(!['paused','interrupted'].includes(goal.state))throw new Error('command_conflict');goal=await state.update(goal,{state:'active',resultRunId:'',candidate:'',lastFingerprint:'',repeats:0});
   }
   const prompt=input.action==='create'?`持续完成教师目标：${goal.objective}\n验收要求：${goal.criteria.join('；')}\n先核对需求与已授权资料，再实际执行并公开阶段说明。完成后通过 report_goal_progress 提交教师验收并给出最终成果。`:`恢复教师持续目标：${goal.objective}\n之前进度：${goal.summary}\n从尚未完成步骤继续；不重放历史写入、附件上传或批准，所有新效果仍需当前确认。`;
   const outcome=await options.start(id,prompt,input.action==='create'?goal.id.replace('xigoal_','xicmd_'):`xicmd_${randomUUID()}`,goal.id);
   if(!outcome.ok){const current=(await state.get(goal.id))!;if(current.state==='active')await state.update(current,{state:'interrupted',summary:'启动未完成，请检查当前会话后明确恢复。'});return outcome;}
   return {ok:true,goal:publicGoal((await state.get(goal.id))!)};
  }catch(error){const message=error instanceof Error?error.message:'';return {ok:false,error:['busy','permission_denied','command_conflict','invalid_input'].includes(message)?message as 'busy'|'permission_denied'|'command_conflict'|'invalid_input':'configuration'};}
  finally{locked.delete(id);}
 };
}
