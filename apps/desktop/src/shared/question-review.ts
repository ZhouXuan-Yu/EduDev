import {plainStudentInput} from './student-context';
import {QUESTION_DRAFT_TYPES,validQuestionDraftResult,type QuestionDraft,type QuestionDraftIssue} from './question-draft';
import type {QuestionContextSource} from './question-context';
export const QUESTION_REVIEW_SCHEMA='xiaozhi.education.question-review.v1' as const;
export const QUESTION_REVIEW_TOOL='education_propose_questions' as const;
export type QuestionReviewDraft={title:string;reason:string;subject:string;grade:string;knowledgePoint:string;items:(QuestionDraft&{difficulty:'easy'|'medium'|'hard'})[]};
export type QuestionReviewSummary={id:string;runId:string;callId:string;state:'pending'|'confirmed'|'rejected';count:number};
export type QuestionReviewInput={schemaVersion:typeof QUESTION_REVIEW_SCHEMA;sessionId:string;id:string};
export type QuestionReviewDecision=QuestionReviewInput&{action:'confirm'|'reject';draft?:QuestionReviewDraft};
export type QuestionReviewView=QuestionReviewSummary&{draft:QuestionReviewDraft;issues:QuestionDraftIssue[][];sourceCurrent:boolean;sources:{title:string;question:QuestionContextSource}[];saved:{title:string;question:QuestionContextSource}[]};
export type QuestionReviewError='invalid_input'|'permission_denied'|'source_changed'|'conflict'|'unavailable'|'cancelled';
export type QuestionReviewResult<T>={ok:true;value:T}|{ok:false;error:QuestionReviewError};
export const QUESTION_REVIEW_ERRORS:Record<QuestionReviewError,string>={invalid_input:'请检查题干、选项、答案和解析，填写完整后重试。',permission_denied:'当前对话或学生已不可用，未保存题目。',source_changed:'原题已变化，请重新读取后出题。',conflict:'核对结果已变化，请刷新后重试。',unavailable:'题目核对暂时未完成，请重试。',cancelled:'任务已停止，题目未保存。'};
const text=(v:unknown,max:number,empty=false)=>typeof v==='string'&&(empty||v.trim().length>0)&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
/** Structural draft only; DeepTutor's actual format validator runs before committing. */
export function validQuestionReviewDraft(v:unknown):v is QuestionReviewDraft{
 if(!plainStudentInput(v,['title','reason','subject','grade','knowledgePoint','items'])||!text(v.title,160)||!text(v.reason,1000)||!text(v.subject,128,true)||!text(v.grade,128,true)||!text(v.knowledgePoint,128,true)||!Array.isArray(v.items)||v.items.length<1||v.items.length>8)return false;
 return v.items.every(q=>{
  if(!plainStudentInput(q,['questionType','stem','answer','analysis','options','difficulty'])||typeof q.difficulty!=='string'||!['easy','medium','hard'].includes(q.difficulty)||!QUESTION_DRAFT_TYPES.includes(q.questionType as QuestionDraft['questionType']))return false;
  const {difficulty:_difficulty,...question}=q;
  // An incomplete candidate may be fixed by the teacher; valid=true is never forged.
  return validQuestionDraftResult({question,issues:['missing_question'],valid:false},q.questionType as QuestionDraft['questionType']);
 });
}
export function validQuestionReview(v:unknown,decision=false):v is QuestionReviewDecision{
 return plainStudentInput(v,decision?['schemaVersion','sessionId','id','action','draft']:['schemaVersion','sessionId','id'])&&v.schemaVersion===QUESTION_REVIEW_SCHEMA&&typeof v.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(v.sessionId)&&typeof v.id==='string'&&/^xiquestion_[a-f0-9-]{36}$/i.test(v.id)&&(!decision||v.action==='reject'&&v.draft===undefined||v.action==='confirm'&&validQuestionReviewDraft(v.draft));
}
