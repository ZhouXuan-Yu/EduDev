import {plainStudentInput} from './student-context';
import {MATERIAL_PREVIEW_SCHEMA,validMaterialPreviewQuery,type MaterialPreviewQuery} from './material-page-preview';
import type {QuestionReviewSummary,QuestionReviewResult} from './question-review';
import type {QuestionContextSource} from './question-context';
export const ORIGINAL_REVIEW_SCHEMA='xiaozhi.education.original-review.v1' as const;
export const ORIGINAL_REVIEW_TOOL='education_propose_original_question' as const;
export const ORIGINAL_REVIEW_ACTION='pi_original_question_candidate' as const;
export type OriginalQuestionDraft={title:string;subject:string;grade:string;knowledgePoint:string;questionType:string;difficulty:'easy'|'medium'|'hard';stem:string;answer:string;analysis:string};
export type OriginalQuestionInput={schemaVersion:typeof ORIGINAL_REVIEW_SCHEMA;sessionId:string;id:string};
export type OriginalQuestionDecision=OriginalQuestionInput&{action:'confirm'|'reject';draft?:OriginalQuestionDraft;complete?:true};
export type OriginalQuestionView={summary:QuestionReviewSummary;draft:OriginalQuestionDraft;sourceCurrent:boolean;sourceTitle:string;image:Extract<import('./material-page-preview').MaterialPreviewResult,{ok:true}>;saved?:QuestionContextSource};
export type OriginalQuestionResult<T>=QuestionReviewResult<T>;
const text=(v:unknown,max:number,empty=false)=>typeof v==='string'&&(empty||!!v.trim())&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
export function validOriginalDraft(v:unknown):v is OriginalQuestionDraft{return plainStudentInput(v,['title','subject','grade','knowledgePoint','questionType','difficulty','stem','answer','analysis'])&&text(v.title,160)&&text(v.subject,128,true)&&text(v.grade,128,true)&&text(v.knowledgePoint,128,true)&&text(v.questionType,128)&&typeof v.difficulty==='string'&&['easy','medium','hard'].includes(v.difficulty)&&text(v.stem,12000)&&text(v.answer,8000,true)&&text(v.analysis,12000,true);}
export function validOriginalInput(v:unknown,decision=false):v is OriginalQuestionDecision{return plainStudentInput(v,decision?['schemaVersion','sessionId','id','action','draft','complete']:['schemaVersion','sessionId','id'])&&v.schemaVersion===ORIGINAL_REVIEW_SCHEMA&&typeof v.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/.test(v.sessionId)&&typeof v.id==='string'&&/^xioriginal_[a-f0-9-]{36}$/.test(v.id)&&(!decision||v.action==='reject'&&v.draft===undefined&&v.complete===undefined||v.action==='confirm'&&v.complete===true&&validOriginalDraft(v.draft));}
export function validOriginalRegion(v:unknown):v is Pick<MaterialPreviewQuery,'resourceId'|'version'|'page'|'box'>{return plainStudentInput(v,['resourceId','version','page','box'])&&validMaterialPreviewQuery({...v,schemaVersion:MATERIAL_PREVIEW_SCHEMA,requestId:'00000000-0000-0000-0000-000000000000'});}
export type QuestionImageInput={schemaVersion:typeof ORIGINAL_REVIEW_SCHEMA;questionId:string;version:string};
export function validQuestionImageInput(v:unknown):v is QuestionImageInput{return plainStudentInput(v,['schemaVersion','questionId','version'])&&v.schemaVersion===ORIGINAL_REVIEW_SCHEMA&&typeof v.questionId==='string'&&/^question_[a-f0-9-]{36}$/.test(v.questionId)&&typeof v.version==='string'&&/^[a-f0-9]{64}$/.test(v.version);}
