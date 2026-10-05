import {plainStudentInput} from './student-context';
export const STUDENT_LEARNING_SCHEMA='xiaozhi.education.learning.v1' as const;
export const STUDENT_LEARNING_REVISION='f07029cfcf2c8dfccdb671cdfc343db8334f5741';
export const LEARNING_MAX_RECORDS=20000,LEARNING_MAX_BYTES=8*1024*1024,LEARNING_MAX_POINTS=128;
export const LEARNING_TYPES=['memory','concept','procedure','design'] as const;
export type LearningType=typeof LEARNING_TYPES[number];
export type LearningOutcome={result:'correct'|'incorrect'|'partial';timestamp:number;qualitative:boolean;teacherConfirmed:boolean};
export type LearningPointInput={id:string;type:LearningType;outcomes:LearningOutcome[]};
export type LearningCalculationInput={now:number;desiredRetention:number;points:LearningPointInput[]};
export type LearningState={interval_index:number;consecutive_correct:number;consecutive_wrong:number;next_review_at:number;difficulty:number;stability:number;retrievability:number;desired_retention:number;review_count:number;lapse_count:number;last_review_at:number|null;last_scheduled_at:number|null;scheduled_after_failure:boolean};
export type LearningPointResult={id:string;mastery:number;threshold:number;status:'new'|'learning'|'mastered';recall:number|null;risk:number|null;due:boolean;state:LearningState|null};
export type LearningCalculation={points:LearningPointResult[];dueOrder:string[]};
export type LearningGradeInput={userAnswer:string;expectedAnswer:string;questionType:'choice'|'short'|'open'};
export type LearningGradeResult={isCorrect:boolean;errorType:'metacognitive'|'application'|null};
export type LearningQuery={subject?:string};
export function validLearningQuery(v:unknown):v is LearningQuery{
 return plainStudentInput(v,['subject'])&&(v.subject===undefined||typeof v.subject==='string'&&v.subject.trim().length>0&&v.subject.length<=128&&!/[\x00-\x1f]/.test(v.subject));
}
const finite=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isFinite(v)&&v>=min&&v<=max;
export function validLearningCalculationInput(v:unknown):v is LearningCalculationInput{
 if(!plainStudentInput(v,['now','desiredRetention','points'])||!finite(v.now,0,4102444800)||!finite(v.desiredRetention,.7,.99)||!Array.isArray(v.points)||v.points.length>LEARNING_MAX_POINTS)return false;
 const ids=new Set<string>();let events=0;
 return v.points.every(p=>{if(!plainStudentInput(p,['id','type','outcomes'])||typeof p.id!=='string'||!/^kp_[a-f0-9]{64}$/.test(p.id)||ids.has(p.id)||typeof p.type!=='string'||!LEARNING_TYPES.includes(p.type as LearningType)||!Array.isArray(p.outcomes))return false;
 ids.add(p.id);events+=p.outcomes.length;if(events>LEARNING_MAX_RECORDS)return false;
 let previous=0;return p.outcomes.every(e=>{if(!plainStudentInput(e,['result','timestamp','qualitative','teacherConfirmed'])||typeof e.result!=='string'||!['correct','incorrect','partial'].includes(e.result)||!finite(e.timestamp,0,v.now as number)||(e.timestamp as number)<previous||typeof e.qualitative!=='boolean'||typeof e.teacherConfirmed!=='boolean')return false;previous=e.timestamp as number;return true;});});
}
export function validLearningCalculation(v:unknown,input:LearningCalculationInput):v is LearningCalculation{
 if(!plainStudentInput(v,['schemaVersion','requestId','ok','points','dueOrder'])||!Array.isArray(v.points)||v.points.length!==input.points.length||!Array.isArray(v.dueOrder))return false;
 const points=new Map(input.points.map(p=>[p.id,p]));const seen=new Set<string>();
 if(!v.points.every(p=>{
  if(!plainStudentInput(p,['id','mastery','threshold','status','recall','risk','due','state'])||typeof p.id!=='string'||!points.has(p.id)||seen.has(p.id)||!finite(p.mastery,0,1)||typeof p.status!=='string'||!['new','learning','mastered'].includes(p.status)||typeof p.due!=='boolean')return false;
  seen.add(p.id);const original=points.get(p.id)!;
  if(p.threshold!==(['concept','design'].includes(original.type)?1:.9))return false;
  if(!original.outcomes.length)return p.state===null&&p.recall===null&&p.risk===null&&p.due===false&&p.status==='new'&&p.mastery===0;
  if(!finite(p.recall,0,1)||!finite(p.risk,0,1)||!plainStudentInput(p.state,['interval_index','consecutive_correct','consecutive_wrong','next_review_at','difficulty','stability','retrievability','desired_retention','review_count','lapse_count','last_review_at','last_scheduled_at','scheduled_after_failure']))return false;
  const s=p.state;return ['interval_index','consecutive_correct','consecutive_wrong','review_count','lapse_count'].every(k=>Number.isSafeInteger(s[k])&&Number(s[k])>=0&&Number(s[k])<=LEARNING_MAX_RECORDS)
   &&s.review_count===original.outcomes.length&&finite(s.next_review_at,0,1e13)&&finite(s.difficulty,.05,.95)&&finite(s.stability,0,1e9)&&finite(s.retrievability,0,1)&&s.desired_retention===input.desiredRetention&&finite(s.last_review_at,0,input.now)&&finite(s.last_scheduled_at,0,input.now)&&typeof s.scheduled_after_failure==='boolean'&&p.due===((s.next_review_at as number)<=input.now);
 }))return false;
 const due=v.points.filter(p=>p.due).map(p=>p.id);return v.dueOrder.length===due.length&&new Set(v.dueOrder).size===due.length&&v.dueOrder.every(id=>typeof id==='string'&&due.includes(id));
}
export function validLearningGradeInput(v:unknown):v is LearningGradeInput{
 return plainStudentInput(v,['userAnswer','expectedAnswer','questionType'])&&typeof v.userAnswer==='string'&&v.userAnswer.length<=8000&&typeof v.expectedAnswer==='string'&&v.expectedAnswer.trim().length>0&&v.expectedAnswer.length<=8000&&typeof v.questionType==='string'&&['choice','short','open'].includes(v.questionType);
}
export function validLearningGrade(v:unknown):v is LearningGradeResult{
 return plainStudentInput(v,['schemaVersion','requestId','ok','isCorrect','errorType'])&&typeof v.isCorrect==='boolean'&&(v.isCorrect?v.errorType===null:typeof v.errorType==='string'&&['metacognitive','application'].includes(v.errorType));
}
