import {plainStudentInput} from './student-context';
import {validPaperBlueprint,validPaperSession,type PaperBlueprint} from './paper-blueprint';
import type {QuestionReviewView,QuestionReviewResult} from './question-review';

export const QUESTION_COLLECTION_SCHEMA='xiaozhi.education.question-collection.v1' as const;
export const QUESTION_COLLECTION_RECORD_SCHEMA='xiaozhi.education.question-review-record.v6' as const;
export const QUESTION_COLLECTION_TOOLS=['education_begin_paper_questions','education_append_paper_questions','education_review_paper_questions'] as const;
export type QuestionCollectionSummary={id:string;sessionId:string;runId:string;title:string;state:'pending'|'confirmed'|'rejected';phase:'drafting'|'review'|'confirmed'|'rejected';count:number;required:number};
export type QuestionCollectionIssue={sectionId:string;groupId?:string;index?:number;code:'shortage'|'quality_required'|'quality_blocked'|'source_changed'|'duplicate_collection'|'answer_conflict'|'quota_mismatch'};
export type QuestionCollectionView=QuestionCollectionSummary&{blueprint:PaperBlueprint;groups:{sectionId:string;review:QuestionReviewView}[];issues:QuestionCollectionIssue[];revisionHash:string;complete:boolean;sourceCurrent:boolean;answerVerified:false};
export type QuestionCollectionInput={schemaVersion:typeof QUESTION_COLLECTION_SCHEMA;sessionId:string;id:string};
export type QuestionCollectionDecision=QuestionCollectionInput&{action:'confirm'|'reject';revisionHash?:string;reviewed?:true};
export type QuestionCollectionResult<T>=QuestionReviewResult<T>;
export const validCollectionId=(v:unknown):v is string=>typeof v==='string'&&/^xicollection_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export const validCollectionReference=(v:unknown):v is string=>typeof v==='string'&&/^整卷_[a-f0-9]{24}$/.test(v);
export const validCollectionBlueprint=(v:unknown):v is PaperBlueprint=>validPaperBlueprint(v)&&v.mode!=='source_only'&&(v.mode==='ai_original'||v.sections.some(s=>(s.generatedCount||0)>0));
export function validQuestionCollection(v:unknown,decision=false):v is QuestionCollectionDecision{
 return plainStudentInput(v,decision?['schemaVersion','sessionId','id','action','revisionHash','reviewed']:['schemaVersion','sessionId','id'])&&v.schemaVersion===QUESTION_COLLECTION_SCHEMA&&validPaperSession(v.sessionId)&&validCollectionId(v.id)&&(!decision||v.action==='reject'&&v.revisionHash===undefined&&v.reviewed===undefined||v.action==='confirm'&&typeof v.revisionHash==='string'&&/^[a-f0-9]{64}$/.test(v.revisionHash)&&v.reviewed===true);
}
