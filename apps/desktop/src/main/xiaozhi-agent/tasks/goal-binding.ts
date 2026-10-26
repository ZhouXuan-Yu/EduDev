import type {Sql} from '../session-state';
import {createGoalState,publicGoal,type PrivateGoal} from '../goal-state';
import type {TaskView,TaskCandidate} from '../../../shared/xiaozhi-task';
import {taskHash} from './task-evidence';

/** A requirement version excludes runtime progress, waiting and run revisions. */
export const goalRequirementsVersion=(goal:PrivateGoal)=>taskHash(['xiaozhi.goal-requirements.v1',goal.id,goal.sessionId,goal.objective,goal.criteria,goal.createdAt]);
export const goalCriterionId=(index:number)=>`goal_requirement_${index+1}`;
export const goalTaskKey=(id:string)=>'xiaozhi.task.v1:goal:'+id;
export async function goalFromSource(sql:Sql,sessionId:string,messageId:string){
 const row=(await sql.all('SELECT metadata_json FROM ai_conversation_messages WHERE id=? AND session_id=? AND role=?',[messageId,sessionId,'user']))[0];
 let meta;try{meta=JSON.parse(String(row?.metadata_json));}catch{throw Error('task_source_changed');}
 if(meta.goalId===undefined)return null;
 if(typeof meta.goalId!=='string'||!/^xigoal_[a-f0-9-]{36}$/iu.test(meta.goalId))throw Error('task_source_changed');
 const state=createGoalState(sql),goal=await state.get(meta.goalId);
 if(!goal||goal.sessionId!==sessionId||(await state.latest(sessionId))?.id!==goal.id)throw Error('task_source_changed');return goal;
}
export function bindGoalRequirements(view:TaskView,goal:PrivateGoal){
 if(view.goal)throw Error('task_goal_already_bound');
 // Legacy mapping is structural adoption of the same saved request. Never
 // merge separate tasks, inherit old human approval or change effect versions.
 if(view.requirementsVersion!==1||view.sources.length!==1||view.sources[0].messageId!==view.origin.messageId)throw Error('task_goal_legacy_conflict');
 const old=view.criteria.filter(c=>c.kind==='human'),source=view.sources[0];
 if(old.length!==1||old[0].id!=='teacher_request')throw Error('task_goal_legacy_conflict');
 const criteria=goal.criteria.map((text,i)=>({id:goalCriterionId(i),version:1,sourceId:view.origin.messageId,sourceVersion:source.version,text,kind:'human' as const}));
 if(view.criteria.length-1+criteria.length>32)throw Error('task_capacity');
 view.criteria=[...criteria,...view.criteria.filter(c=>c.kind!=='human')];
 view.checks=view.checks.filter(c=>c.authority!=='teacher');delete view.reviewVerification;
 view.steps=view.steps.map(s=>({...s,criterionIds:s.criterionIds.flatMap(id=>id==='teacher_request'?criteria.map(c=>c.id):[id])}));
 if(view.steps.length)view.planRevision++;
 view.planReason='按教师已保存的持续目标逐项关联要求，既有教学确认需重新核对';
 view.goal={id:goal.id,version:goalRequirementsVersion(goal)};
}
export async function requireTaskGoal(sql:Sql,view:TaskView){
 if(!view.goal)throw Error('task_goal_missing');
 const goal=await goalFromSource(sql,view.sessionId,view.origin.messageId),human=view.criteria.filter(c=>c.kind==='human');
 if(!goal||goal.id!==view.goal.id||goalRequirementsVersion(goal)!==view.goal.version||human.length!==goal.criteria.length||human.some((c,i)=>c.text!==goal.criteria[i]))throw Error('task_source_changed');return goal;
}
export async function correctTaskGoal(sql:Sql,view:TaskView,criteria:{id:string;text:string}[]){
 const goal=await requireTaskGoal(sql,view),texts=criteria.map(c=>c.text);
 if(goal.state==='ended')throw Error('task_owner_stale');
 if(!texts.length||texts.length>8||texts.some(v=>!v))throw Error('task_criteria_invalid');
 const next=await createGoalState(sql).update(goal,{criteria:texts as string[],state:'paused',candidate:'',resultRunId:'',summary:'教师修正了验收要求，旧核对结论已失效。',nextStep:'核对已有成果，明确恢复剩余步骤。'});
 view.goal={id:next.id,version:goalRequirementsVersion(next)};
}
export async function reviewTaskGoal(sql:Sql,view:TaskView,candidate:TaskCandidate){
 const goal=await requireTaskGoal(sql,view);
 if(!['review_required','paused'].includes(goal.state)||goal.resultRunId!==candidate.runId||!goal.candidate.trim())throw Error('task_candidate_changed');
 const result=(await sql.all('SELECT content FROM ai_conversation_messages WHERE id=? AND session_id=?',[candidate.messageId,view.sessionId]))[0];if(String(result?.content).slice(0,32000)!==goal.candidate)throw Error('task_candidate_changed');
 return createGoalState(sql).update(goal,{state:view.state==='completed'?'completed':'paused'});
}
export async function taskGoalProjection(sql:Sql,view:TaskView){return view.goal?publicGoal(await requireTaskGoal(sql,view)):undefined;}
