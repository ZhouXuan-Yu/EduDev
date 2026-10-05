import {plainStudentInput,validStudentId} from './student-context';
import type {QuestionBankItem,ExerciseSet,ExerciseSetItemRole} from './contracts';
import type {QuestionContextSource} from './question-context';
export const PRACTICE_REVIEW_SCHEMA='xiaozhi.education.practice-review.v1' as const;
export const PRACTICE_REVIEW_TOOLS=['education_propose_practice','education_read_practice'] as const;
export type PracticeReviewDraft={title:string;reason:string;subject:string;knowledgePoint:string;items:{index:number;role:ExerciseSetItemRole;teacherObservation:string}[]};
export type PracticeReviewSummary={id:string;runId:string;callId:string;state:'pending'|'confirmed'|'rejected';count:number};
export type PracticeReviewInput={schemaVersion:typeof PRACTICE_REVIEW_SCHEMA;sessionId:string;id:string};
export type PracticeReviewDecision=PracticeReviewInput&{action:'confirm'|'reject';draft?:PracticeReviewDraft};
export type PracticeReviewView=PracticeReviewSummary&{studentLabel:string;draft:PracticeReviewDraft;sourceCurrent:boolean;questions:{question:QuestionBankItem;source:QuestionContextSource;parents:QuestionContextSource[]}[];exercise?:ExerciseSet;exerciseVersion?:string};
export type PracticeSourceInput={schemaVersion:typeof PRACTICE_REVIEW_SCHEMA;studentId:string;exerciseId:string};
export type PracticeReviewError='invalid_input'|'permission_denied'|'source_changed'|'conflict'|'unavailable'|'cancelled';
export type PracticeReviewResult<T>={ok:true;value:T}|{ok:false;error:PracticeReviewError};
export const PRACTICE_REVIEW_ERRORS:Record<PracticeReviewError,string>={invalid_input:'请填写练习名称、核对说明和题目安排后重试。',permission_denied:'请先选择当前学生；对话或学生已不可用时不能保存练习。',source_changed:'练习引用的题目已变化，请重新读取后安排。',conflict:'这份练习已处理，请刷新后重试。',unavailable:'练习读取或保存未完成，请重试。',cancelled:'任务已停止，练习未保存。'};
const text=(v:unknown,max:number,empty=false)=>typeof v==='string'&&(empty||v.trim().length>0)&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
export function validPracticeDraft(v:unknown):v is PracticeReviewDraft{
 if(!plainStudentInput(v,['title','reason','subject','knowledgePoint','items'])||!text(v.title,160)||!text(v.reason,1000)||!text(v.subject,128,true)||!text(v.knowledgePoint,128,true)||!Array.isArray(v.items)||v.items.length<1||v.items.length>8)return false;
 return v.items.every(q=>plainStudentInput(q,['index','role','teacherObservation'])&&Number.isSafeInteger(q.index)&&(q.index as number)>=0&&(q.index as number)<8&&typeof q.role==='string'&&['original','similar','variant'].includes(q.role)&&text(q.teacherObservation,1000,true))&&new Set(v.items.map(q=>q.index)).size===v.items.length;
}
export function validPracticeReview(v:unknown,decision=false):v is PracticeReviewDecision{
 return plainStudentInput(v,decision?['schemaVersion','sessionId','id','action','draft']:['schemaVersion','sessionId','id'])&&v.schemaVersion===PRACTICE_REVIEW_SCHEMA&&typeof v.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(v.sessionId)&&typeof v.id==='string'&&/^xipractice_[a-f0-9-]{36}$/i.test(v.id)&&(!decision||v.action==='reject'&&v.draft===undefined||v.action==='confirm'&&validPracticeDraft(v.draft));
}
export function validPracticeSource(v:unknown):v is PracticeSourceInput{return plainStudentInput(v,['schemaVersion','studentId','exerciseId'])&&v.schemaVersion===PRACTICE_REVIEW_SCHEMA&&validStudentId(v.studentId)&&typeof v.exerciseId==='string'&&/^exercise_set_[a-f0-9-]{36}$/i.test(v.exerciseId);}
