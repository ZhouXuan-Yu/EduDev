import {plainStudentInput} from './student-context';
import {validQuestionProjection,type QuestionProjection} from './question-projection';
import type {QuestionContextSource} from './question-context';
import type {QuestionReviewResult} from './question-review';
export const QUESTION_CONTEXT_EDIT_SCHEMA='xiaozhi.question-context-edit.v1' as const;
export type QuestionContextEditInput={schemaVersion:typeof QUESTION_CONTEXT_EDIT_SCHEMA;questionId:string;version:string;requestId:string;projection:QuestionProjection;complete:true};
export type QuestionContextEditResult=QuestionReviewResult<QuestionContextSource>;
export function validQuestionContextEdit(v:unknown):v is QuestionContextEditInput{
 const keys=['schemaVersion','questionId','version','requestId','projection','complete'];
 if(!plainStudentInput(v,keys)||Reflect.ownKeys(v).length!==keys.length||keys.some(k=>!Object.getOwnPropertyDescriptor(v,k)?.enumerable))return false;
 return v.schemaVersion===QUESTION_CONTEXT_EDIT_SCHEMA&&typeof v.questionId==='string'&&/^question_[a-f0-9-]{36}$/.test(v.questionId)&&typeof v.version==='string'&&/^[a-f0-9]{64}$/.test(v.version)&&typeof v.requestId==='string'&&/^xicontext_[a-f0-9-]{36}$/.test(v.requestId)&&v.complete===true&&validQuestionProjection(v.projection,true);
}
