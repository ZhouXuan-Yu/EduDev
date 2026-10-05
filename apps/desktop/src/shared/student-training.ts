import {plainStudentInput,validStudentId} from './student-context';
import type {Student,LearningRecord} from './contracts';
import type {TrainingPlan} from './training-plan';
import {validPracticeResult,type PracticeResultInput,type SavedPracticeResult} from './practice-result';
export const STUDENT_TRAINING_SCHEMA='xiaozhi.education.student-training.v1' as const;
export type StudentTrainingInput={schemaVersion:typeof STUDENT_TRAINING_SCHEMA;studentId:string};
export type StudentTrainingSource=StudentTrainingInput&{planId:string;recordId:string;version:string};
export type StudentTrainingResultInput=StudentTrainingInput&{requestId:string;planId:string;planVersion:number;day:number;result:'correct'|'incorrect'|'partial';occurredAt:string;notes:string;allowHistorical?:boolean;practice?:PracticeResultInput};
export type StudentTrainingReceipt={recordId:string;duplicate:boolean};
export type StudentTrainingView={plan?:{id:string;version:number;confirmedAt:string;plan:TrainingPlan;reason:string;sourceCurrent:boolean;strategyCurrent:boolean;sources:{title:string;reference:StudentTrainingSource}[]};results:{recordId:string;planVersion:number;day:number;result:StudentTrainingResultInput['result'];occurredAt:string;notes:string;practice?:SavedPracticeResult}[];totalResults:number};
export type StudentTrainingEvidence={student:Student;record:Omit<LearningRecord,'attachments'>};
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const planId=(v:unknown)=>typeof v==='string'&&v.startsWith('xilearning_')&&uuid(v.slice(11));
const fields=['schemaVersion','studentId'];
export function validStudentTrainingInput(v:unknown):v is StudentTrainingInput{return plainStudentInput(v,fields)&&v.schemaVersion===STUDENT_TRAINING_SCHEMA&&validStudentId(v.studentId);}
export function validStudentTrainingSource(v:unknown):v is StudentTrainingSource{return plainStudentInput(v,[...fields,'planId','recordId','version'])&&v.schemaVersion===STUDENT_TRAINING_SCHEMA&&validStudentId(v.studentId)&&planId(v.planId)&&typeof v.recordId==='string'&&v.recordId.startsWith('record_')&&uuid(v.recordId.slice(7))&&typeof v.version==='string'&&/^[a-f0-9]{64}$/.test(v.version);}
export function validStudentTrainingResult(v:unknown,now=Date.now()):v is StudentTrainingResultInput{
 if(!plainStudentInput(v,[...fields,'requestId','planId','planVersion','day','result','occurredAt','notes','allowHistorical','practice'])||v.schemaVersion!==STUDENT_TRAINING_SCHEMA||!validStudentId(v.studentId)||!uuid(v.requestId)||!planId(v.planId)||!Number.isSafeInteger(v.planVersion)||Number(v.planVersion)<1||!Number.isSafeInteger(v.day)||Number(v.day)<1||Number(v.day)>14||typeof v.result!=='string'||!['correct','incorrect','partial'].includes(v.result)||typeof v.notes!=='string'||v.notes.length>2000||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v.notes)||v.allowHistorical!==undefined&&typeof v.allowHistorical!=='boolean'||typeof v.occurredAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.occurredAt))return false;
 if(v.practice!==undefined&&!validPracticeResult(v.practice))return false;
 const time=Date.parse(v.occurredAt);return Number.isFinite(time)&&time>=0&&time<=now&&new Date(time).toISOString()===v.occurredAt;
}
