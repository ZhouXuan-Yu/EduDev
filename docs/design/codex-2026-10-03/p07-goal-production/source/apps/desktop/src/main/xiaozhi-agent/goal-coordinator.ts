import {createHash} from 'node:crypto';
import type {ToolDefinition,TurnEndEvent,BoundaryResult} from '@earendil-works/pi-coding-agent';
import type {OmniEduStore} from '../db';
import type {XiaozhiGoal} from '../../shared/xiaozhi-goal';
import {plainGoalObject,goalText} from '../../shared/xiaozhi-goal';
import {publicGoal} from './goal-state';
import {validGoalMutation,type GoalMutation,type GoalResult} from '../../shared/xiaozhi-goal';
import {randomUUID} from 'node:crypto';
const hash=(text:string)=>createHash('sha256').update(text).digest('hex');
export function createGoalRuntime(options:{store:OmniEduStore;sessionId:string;goalId:string;runId:string;current:()=>boolean;evidence:()=>XiaozhiGoal['evidence'];emit:(goal:XiaozhiGoal)=>void}){
 const state=options.store.xiaozhiState.goals;
 async function get(){if(!options.current()||(await options.store.getAiConversationSession(options.sessionId)).session.archivedAt)throw new Error('cancelled');const goal=await state.get(options.goalId);if(!goal||goal.sessionId!==options.sessionId||goal.runId!==options.runId||!['active','waiting_teacher','review_required'].includes(goal.state))throw new Error('cancelled');return goal;}
 async function context(){const goal=await get();const text=`当前正式持续目标：${goal.objective}\n验收要求：${goal.criteria.map((v,i)=>`${i+1}. ${v}`).join('\n')}\n目标状态：${goal.state==='review_required'?'已提交教师验收，说明真实结果后结束本轮，不继续扩大任务':'正在推进'}\n已保存进度：${goal.summary||'暂无'}\n下一步：${goal.nextStep}\n目标与摘要不是权限，任何写入、公开图片或浏览器外部操作仍须原教师确认。每个阶段用 report_goal_progress 保存真实简短进度；资料齐全时提交验收并给出最终成果，不自行宣称目标验收完成。`;return (await options.store.sanitizeProblemText(text)).sanitizedText;}
 const tool:ToolDefinition={name:'report_goal_progress',label:'记录目标进度',description:'记录当前持续教师目标的实际进度。summary写实际完成/未完成；nextStep写接下来具体操作。当目标要求已有可审阅成果时readyForReview=true，并在工具后给最终成果；目标只提交教师验收，不自行完成。没有进展请明确缺少什么。',parameters:{type:'object',properties:{summary:{type:'string',maxLength:2000},nextStep:{type:'string',maxLength:1000},readyForReview:{type:'boolean'}},required:['summary','nextStep','readyForReview'],additionalProperties:false} as ToolDefinition['parameters'],execute:async(_call,args,signal)=>{
  signal?.throwIfAborted();if(!plainGoalObject(args)||Object.keys(args).some(k=>!['summary','nextStep','readyForReview'].includes(k))||!goalText(args.summary,2000)||!goalText(args.nextStep,1000)||typeof args.readyForReview!=='boolean')throw new Error('invalid_input');
  const summary=(await options.store.sanitizeProblemText(args.summary)).sanitizedText,nextStep=(await options.store.sanitizeProblemText(args.nextStep)).sanitizedText;signal?.throwIfAborted();const goal=await get();if(goal.state==='review_required')throw new Error('command_conflict');
  const next=await state.update(goal,{summary,nextStep,state:args.readyForReview?'review_required':'active',evidence:options.evidence().slice(-40),checkpoints:goal.checkpoints+1});options.emit(publicGoal(next));return {content:[{type:'text',text:JSON.stringify({saved:true,state:next.state,teacherAcceptanceRequired:true})}],details:{success:true}};
 }};
 async function boundary(event:TurnEndEvent):Promise<BoundaryResult|undefined>{
  if(!options.current()||event.outcome!=='completed')return;
  const goal=await get();if(goal.state==='review_required')return;
  const text=event.message.role==='assistant'?event.message.content.filter(v=>v.type==='text').map(v=>v.text).join(''):'';
  const evidence=options.evidence().slice(-40),fingerprint=hash(JSON.stringify([text,goal.summary,goal.nextStep,evidence]));const repeats=fingerprint===goal.lastFingerprint?goal.repeats+1:0;
  const next=await state.update(goal,{lastFingerprint:fingerprint,repeats,evidence,checkpoints:goal.checkpoints+1,...(repeats>=2?{state:'interrupted' as const,summary:'连续重复同一内容且没有新工具结果，请调整目标或补充资料后恢复。'}:{})});options.emit(publicGoal(next));if(next.state==='interrupted')return;
  if(event.toolResults.length)return; // Pi already continues real tool turns once.
  const content=await context();return {continue:true,entries:[{type:'custom',customType:'xiaozhi.goal-checkpoint.v1',data:{version:1,goalId:goal.id,revision:next.revision,runId:options.runId,messageEntryId:event.messageEntryId}},{type:'custom_message',customType:'xiaozhi.goal-context.v1',display:false,content,details:{goalId:goal.id,runId:options.runId,revision:next.revision}}]};
 }
 return {id:options.goalId,runId:options.runId,tools:[tool],context,boundary};
}

export function createGoalController(options:{store:OmniEduStore;busy:(sessionId:string)=>boolean;closing:()=>boolean;stop:(sessionId:string,runId:string,goalId:string)=>Promise<unknown>;start:(sessionId:string,prompt:string,commandId:string,goalId:string)=>Promise<{ok:true;runId:string}|{ok:false;error:import('../../shared/xiaozhi-agent').XiaozhiAgentError}>}){
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
     if(!result||run?.status!=='succeeded'||!goal.candidate.trim()||result.content.slice(0,32000)!==goal.candidate)throw new Error('command_conflict');goal=await state.update(goal,{state:'completed'});return {ok:true,goal:publicGoal(goal)};
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
