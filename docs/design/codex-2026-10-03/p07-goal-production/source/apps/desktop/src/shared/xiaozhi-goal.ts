import type {XiaozhiAgentError} from './xiaozhi-agent';
export type GoalState='active'|'waiting_teacher'|'paused'|'interrupted'|'review_required'|'completed'|'ended';
export type XiaozhiGoal={schemaVersion:1;id:string;sessionId:string;revision:number;state:GoalState;objective:string;criteria:string[];summary:string;nextStep:string;runId:string;resultRunId:string;candidate:string;evidence:{runId:string;callId:string;label:string}[];checkpoints:number;createdAt:string;updatedAt:string};
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
