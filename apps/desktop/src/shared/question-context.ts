import type {QuestionBankItem} from './contracts';
import {plainStudentInput} from './student-context';

export const QUESTION_CONTEXT_SCHEMA='xiaozhi.education.question-context.v1' as const;
export const QUESTION_CONTEXT_TOOLS=['education_search_questions','education_read_question'] as const;
export type QuestionContextQuery={query:string;subject?:string;grade?:string;knowledgePoint?:string;questionType?:string;difficulty?:'easy'|'medium'|'hard';sourceKind?:'local_bank'|'teacher_resource'|'generated';limit?:number};
export type QuestionContextRead={reference:string;version:string};
export type QuestionContextSource={schemaVersion:typeof QUESTION_CONTEXT_SCHEMA;questionId:string;version:string};
export type QuestionContextView={question:QuestionBankItem};
export type QuestionContextResult={ok:true;value:QuestionContextView}|{ok:false;error:'invalid_input'|'permission_denied'|'source_changed'|'question_fact_conflict'|'unavailable'};
const version=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const text=(v:unknown)=>typeof v==='string'&&v.trim().length>0&&v.length<=128&&!/[\x00-\x1f]/.test(v);
export function validQuestionContextQuery(v:unknown):v is QuestionContextQuery{
 return plainStudentInput(v,['query','subject','grade','knowledgePoint','questionType','difficulty','sourceKind','limit'])&&text(v.query)
  &&['subject','grade','knowledgePoint','questionType'].every(k=>v[k]===undefined||text(v[k]))
  &&(v.difficulty===undefined||['easy','medium','hard'].includes(v.difficulty as string))
  &&(v.sourceKind===undefined||['local_bank','teacher_resource','generated'].includes(v.sourceKind as string))
  &&(v.limit===undefined||typeof v.limit==='number'&&Number.isInteger(v.limit)&&v.limit>=1&&v.limit<=10);
}
export function validQuestionContextRead(v:unknown):v is QuestionContextRead{
 return plainStudentInput(v,['reference','version'])&&typeof v.reference==='string'&&/^题目[1-9][0-9]{0,2}$/.test(v.reference)&&version(v.version);
}
export function validQuestionContextSource(v:unknown):v is QuestionContextSource{
 return plainStudentInput(v,['schemaVersion','questionId','version'])&&v.schemaVersion===QUESTION_CONTEXT_SCHEMA
  &&typeof v.questionId==='string'&&/^question_[a-f0-9-]{36}$/i.test(v.questionId)&&version(v.version);
}
