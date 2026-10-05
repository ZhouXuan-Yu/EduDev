import {plainStudentInput} from './student-context';
import {LEARNING_TYPES,type LearningType} from './student-learning';
export const TRAINING_PLAN_SCHEMA='xiaozhi.education.training-plan.v1' as const;
export const TRAINING_ACTIVITIES=['review','practice','reflection','rest'] as const;
export const TRAINING_DIFFICULTIES=['warmup','standard','challenge'] as const;
export type TrainingTopic={id:string;name:string;subject:string;type:LearningType};
export type TrainingDay={day:number;pointId:string|null;activity:typeof TRAINING_ACTIVITIES[number];count:number;difficulty:typeof TRAINING_DIFFICULTIES[number];notes:string};
export type TrainingPlan={schemaVersion:typeof TRAINING_PLAN_SCHEMA;title:string;startDate:string;topics:TrainingTopic[];days:TrainingDay[]};
export const trainingText=(v:unknown,max:number):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\x00-\x1f]/.test(v);
export function trainingArray(v:unknown):v is unknown[]{
 if(!Array.isArray(v)||Object.getPrototypeOf(v)!==Array.prototype)return false;
 const keys=Reflect.ownKeys(v);if(keys.some(k=>k!=='length'&&(typeof k!=='string'||!/^\d+$/.test(k)||Number(k)>=v.length))||keys.length!==v.length+1)return false;
 return keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&'value'in d;});
}
export function validTrainingDate(v:unknown):v is string{
 if(typeof v!=='string'||!/^20\d{2}-\d{2}-\d{2}$/.test(v))return false;
 const parsed=new Date(v+'T00:00:00Z');return Number.isFinite(parsed.getTime())&&parsed.toISOString().slice(0,10)===v;
}
export function validTrainingPlan(v:unknown):v is TrainingPlan{
 if(!plainStudentInput(v,['schemaVersion','title','startDate','topics','days'])||v.schemaVersion!==TRAINING_PLAN_SCHEMA||!trainingText(v.title,160)||!validTrainingDate(v.startDate)||!trainingArray(v.topics)||v.topics.length<1||v.topics.length>32||!trainingArray(v.days)||v.days.length!==14)return false;
 const ids=new Set<string>();
 if(!v.topics.every(t=>{
  if(!plainStudentInput(t,['id','name','subject','type'])||typeof t.id!=='string'||!/^kp_[a-f0-9]{64}$/.test(t.id)||ids.has(t.id)||!trainingText(t.name,160)||!trainingText(t.subject,128)||typeof t.type!=='string'||!LEARNING_TYPES.includes(t.type as LearningType))return false;ids.add(t.id);return true;
 }))return false;
 return v.days.every((d,index)=>plainStudentInput(d,['day','pointId','activity','count','difficulty','notes'])&&d.day===index+1&&typeof d.activity==='string'&&TRAINING_ACTIVITIES.includes(d.activity as TrainingDay['activity'])&&typeof d.difficulty==='string'&&TRAINING_DIFFICULTIES.includes(d.difficulty as TrainingDay['difficulty'])&&Number.isSafeInteger(d.count)&&Number(d.count)>=0&&Number(d.count)<=20&&trainingText(d.notes,300)&&(d.activity==='rest'?d.pointId===null&&d.count===0:typeof d.pointId==='string'&&ids.has(d.pointId)&&Number(d.count)>0))&&v.days.some(d=>(d as TrainingDay).activity!=='rest');
}
export function trainingDayDate(startDate:string,day:number){return new Date(Date.parse(startDate+'T00:00:00Z')+(day-1)*86400000).toISOString().slice(0,10);}
