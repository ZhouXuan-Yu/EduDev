import {plainStudentInput} from './student-context';
import {QUESTION_DRAFT_TYPES,validQuestionDraftResult,type QuestionDraft,type QuestionDraftIssue} from './question-draft';
import type {QuestionContextSource} from './question-context';
import type {QuestionQualityReview,QuestionQualityConfirmation} from './question-quality';
export const QUESTION_REVIEW_SCHEMA='xiaozhi.education.question-review.v1' as const;
export const QUESTION_REVIEW_TOOL='education_propose_questions' as const;
export type QuestionReviewDraft={title:string;reason:string;subject:string;grade:string;knowledgePoint:string;items:(QuestionDraft&{difficulty:'easy'|'medium'|'hard'})[]};
export type QuestionReviewSummary={id:string;runId:string;callId:string;state:'pending'|'confirmed'|'rejected';count:number;kind?:'original';generationKind?:'ai_original'|'variation';repairAttempt?:number;repairParentId?:string;supersededBy?:string;collectionId?:string};
export type QuestionReviewInput={schemaVersion:typeof QUESTION_REVIEW_SCHEMA;sessionId:string;id:string;draft?:QuestionReviewDraft};
export type QuestionReviewDecision=QuestionReviewInput&{action:'confirm'|'reject';qualityConfirmation?:QuestionQualityConfirmation};
export type QuestionReviewView=QuestionReviewSummary&{draft:QuestionReviewDraft;issues:QuestionDraftIssue[][];quality?:QuestionQualityReview;qualityHistoryCount?:number;legacyQuality?:boolean;repairPrevious?:{draft:QuestionReviewDraft;quality:QuestionQualityReview};sourceCurrent:boolean;sources:{title:string;question:QuestionContextSource}[];saved:{title:string;question:QuestionContextSource}[]};
export type QuestionReviewError='invalid_input'|'permission_denied'|'source_changed'|'conflict'|'unavailable'|'cancelled'|'quality_required'|'quality_stale'|'quality_blocked'|'review_limit'|'repair_required'|'repair_limit'|'superseded'|'collection_required';
export type QuestionReviewResult<T>={ok:true;value:T}|{ok:false;error:QuestionReviewError};
export const QUESTION_REVIEW_ERRORS:Record<QuestionReviewError,string>={collection_required:'这些题属于整卷草稿，请在整卷中集中核对和确认。',repair_required:'请使用本次失败候选的修复编号继续，保留修复历史。',repair_limit:'本候选已自动修复三次，请教师编辑或拒绝后重新起草。',superseded:'此候选已有修复版本，只能查看或拒绝，请核对最新版本。',invalid_input:'请检查题干、选项、答案和解析，填写完整后重试。',permission_denied:'当前对话或学生已不可用，未保存题目。',source_changed:'原题已变化，请重新读取后出题。',conflict:'核对结果已变化，请刷新后重试。',unavailable:'题目核对暂时未完成，请重试。',cancelled:'任务已停止，题目未保存。',quality_required:'请先检查当前版本，并明确核对题干、条件、答案和解析后再保存。',quality_stale:'题目或检查版本已变化，请重新检查并核对。',quality_blocked:'题目检查未通过，候选仍被隔离；请修正问题后重新检查。',review_limit:'本候选已检查8个版本。请拒绝本候选后重新起草，历史记录会保留。'};
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
 return plainStudentInput(v,decision?['schemaVersion','sessionId','id','action','draft','qualityConfirmation']:['schemaVersion','sessionId','id','draft'])&&v.schemaVersion===QUESTION_REVIEW_SCHEMA&&typeof v.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(v.sessionId)&&typeof v.id==='string'&&/^xiquestion_[a-f0-9-]{36}$/i.test(v.id)&&(!decision?(v.draft===undefined||validQuestionReviewDraft(v.draft)):v.action==='reject'&&v.draft===undefined&&v.qualityConfirmation===undefined||v.action==='confirm'&&validQuestionReviewDraft(v.draft)&&(v.qualityConfirmation===undefined||plainStudentInput(v.qualityConfirmation,['revisionHash','reviewed'])&&typeof v.qualityConfirmation.revisionHash==='string'&&/^[a-f0-9]{64}$/.test(v.qualityConfirmation.revisionHash)&&v.qualityConfirmation.reviewed===true));
}
