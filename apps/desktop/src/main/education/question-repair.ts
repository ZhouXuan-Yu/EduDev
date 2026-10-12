import {plainStudentInput} from '../../shared/student-context';
export const QUESTION_REPAIR_RECORD_SCHEMA='xiaozhi.education.question-review-record.v4' as const;
export const QUESTION_ORIGINAL_AI_RECORD_SCHEMA='xiaozhi.education.question-review-record.v5' as const;
export type QuestionRepairLink={reference:string;attempt:number;parent:null|{id:string;payloadHash:string;revisionHash:string}};
export const validRepairReference=(value:unknown):value is string=>typeof value==='string'&&/^修复_[a-f0-9]{24}$/.test(value);
export function validQuestionRepair(value:unknown):value is QuestionRepairLink{
 if(!plainStudentInput(value,['reference','attempt','parent'])||!validRepairReference(value.reference)||!Number.isInteger(value.attempt)||Number(value.attempt)<0||Number(value.attempt)>3)return false;
 if(value.attempt===0)return value.parent===null;
 return plainStudentInput(value.parent,['id','payloadHash','revisionHash'])&&typeof value.parent.id==='string'&&/^xiquestion_[a-f0-9-]{36}$/i.test(value.parent.id)&&[value.parent.payloadHash,value.parent.revisionHash].every(v=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v));
}
