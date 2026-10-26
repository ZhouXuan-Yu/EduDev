import type {XiaozhiAgentError} from './xiaozhi-agent';
export type GoalState='active'|'waiting_teacher'|'paused'|'interrupted'|'review_required'|'completed'|'ended';
type ProgressFields={checkedAt:string;newEvidence:number;idleBoundaries:number;state:'advanced'|'no_new_evidence'|'stalled'|'unavailable'|'coverage_limit'};
export type GoalProgress=ProgressFields&({schemaVersion:1;scope:'result_integrity'}|{schemaVersion:2;scope:'evidence_and_teacher_input';newTeacherInputs:number});
export function validGoalProgress(value:unknown):value is GoalProgress{
 if(!plainGoalObject(value))return false;
 const v1=value.schemaVersion===1&&value.scope==='result_integrity'&&Object.keys(value).sort().join(',')==='checkedAt,idleBoundaries,newEvidence,schemaVersion,scope,state';
 const v2=value.schemaVersion===2&&value.scope==='evidence_and_teacher_input'&&Object.keys(value).sort().join(',')==='checkedAt,idleBoundaries,newEvidence,newTeacherInputs,schemaVersion,scope,state'&&Number.isSafeInteger(value.newTeacherInputs)&&Number(value.newTeacherInputs)>=0&&Number(value.newTeacherInputs)<=32;
 if(!v1&&!v2)return false;
 const total=Number(value.newEvidence)+(v2?Number(value.newTeacherInputs):0);
 return typeof value.checkedAt==='string'&&/^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d\.\d{3}Z$/.test(value.checkedAt)&&Number.isFinite(Date.parse(value.checkedAt))&&Number.isSafeInteger(value.newEvidence)&&Number(value.newEvidence)>=0&&Number(value.newEvidence)<=128&&total<=128&&Number.isSafeInteger(value.idleBoundaries)&&Number(value.idleBoundaries)>=0&&Number(value.idleBoundaries)<=3&&typeof value.state==='string'&&['advanced','no_new_evidence','stalled','unavailable','coverage_limit'].includes(value.state)&&(value.state==='advanced'?total>0&&value.idleBoundaries===0:total===0);
}
export type XiaozhiGoal={schemaVersion:1;id:string;sessionId:string;revision:number;state:GoalState;objective:string;criteria:string[];summary:string;nextStep:string;runId:string;resultRunId:string;candidate:string;evidence:{runId:string;callId:string;label:string}[];checkpoints:number;createdAt:string;updatedAt:string;progress?:GoalProgress};
export type GoalMutation={schemaVersion:1;sessionId:string;id:string;revision:number}&({action:'create';objective:string;criteria:string[]}|{action:'pause'|'resume'|'end'}|{action:'accept';checked:number[]});
export type GoalResult={ok:true;goal:XiaozhiGoal}|{ok:false;error:XiaozhiAgentError};
export const GOAL_LABELS:Record<GoalState,string>={active:'进行中的目标',waiting_teacher:'等待教师决定',paused:'目标已暂停',interrupted:'目标已中断',review_required:'等待验收',completed:'目标已完成',ended:'目标已结束'};
export function plainGoalObject(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)&&[Object.prototype,null].includes(Object.getPrototypeOf(value))&&Object.values(Object.getOwnPropertyDescriptors(value)).every(d=>'value'in d);}
export const goalText=(value:unknown,max:number):value is string=>typeof value==='string'&&!!value.trim()&&value.length<=max&&!value.includes('\0');
export function validGoalMutation(value:unknown):value is GoalMutation{
 if(!plainGoalObject(value)||value.schemaVersion!==1||!/^aisession_[a-f0-9-]{36}$/i.test(String(value.sessionId))||!/^xigoal_[a-f0-9-]{36}$/i.test(String(value.id))||!Number.isSafeInteger(value.revision)||Number(value.revision)<0)return false;
 const keys=['schemaVersion','sessionId','id','revision','action'];
 if(value.action==='create')return value.revision===0&&goalText(value.objective,4000)&&Array.isArray(value.criteria)&&value.criteria.length>0&&value.criteria.length<=8&&value.criteria.every(v=>goalText(v,400))&&Object.keys(value).every(k=>[...keys,'objective','criteria'].includes(k));
 if(value.action==='accept')return Array.isArray(value.checked)&&value.checked.length>0&&value.checked.length<=8&&value.checked.every(v=>Number.isSafeInteger(v)&&v>=0&&v<8)&&new Set(value.checked).size===value.checked.length&&Object.keys(value).every(k=>[...keys,'checked'].includes(k));
 return ['pause','resume','end'].includes(String(value.action))&&Object.keys(value).every(k=>keys.includes(k));
}
