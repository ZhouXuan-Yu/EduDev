import {plainStudentInput} from './student-context';
import type {StudentContextSource} from './student-context';
import {validTrainingPlan,type TrainingPlan} from './training-plan';
export const LEARNING_REVIEW_SCHEMA='xiaozhi.education.learning-review.v1' as const;
export type LearningCorrection={result:'correct'|'incorrect'|'partial';errorType:'none'|'metacognitive'|'application';feedback:string};
export type LearningReviewDraft=({kind:'assessment';correction:LearningCorrection}|{kind:'strategy';desiredRetention:number;plan?:TrainingPlan})&{reason:string};
export type LearningReviewSummary={id:string;runId:string;state:'pending'|'confirmed'|'rejected';kind:'assessment'|'strategy';version:number};
export type LearningReviewInput={schemaVersion:typeof LEARNING_REVIEW_SCHEMA;sessionId:string;id:string};
export type LearningReviewDecision=LearningReviewInput&{action:'confirm'|'reject';draft?:LearningReviewDraft};
export type LearningReviewView=LearningReviewSummary&{draft:LearningReviewDraft;planCurrent?:boolean;planSources?:{title:string;reference:StudentContextSource}[];source?:{title:string;content:string;subject:string;occurredAt:string};heuristic?:{isCorrect:boolean;errorType:'metacognitive'|'application'|null};previousRetention:number;previousVersion:number};
export type LearningReviewError='invalid_input'|'permission_denied'|'source_changed'|'conflict'|'unavailable'|'cancelled'|'no_evidence';
export type LearningReviewResult<T>={ok:true;value:T}|{ok:false;error:LearningReviewError};
export const LEARNING_HISTORY_PAGE_SIZE=5;
export type LearningHistoryInput={schemaVersion:typeof LEARNING_REVIEW_SCHEMA;sessionId:string;beforeVersion?:number};
export type LearningHistoryItem={id:string;version:number;confirmedAt:string;sameConversation:boolean;planCurrent?:boolean;subject:string|null;draft:LearningReviewDraft;proposal:LearningReviewDraft;previous?:{version:number;draft:LearningReviewDraft};previousRetention:number;sourceStatus:'current'|'changed'|'missing'|'not_applicable';source?:{title:string;reference:StudentContextSource}};
export type LearningHistoryPage={items:LearningHistoryItem[];total:number;latestVersion:number;nextBeforeVersion:number|null};
export function validLearningHistory(v:unknown):v is LearningHistoryInput{
 return plainStudentInput(v,['schemaVersion','sessionId','beforeVersion'])&&v.schemaVersion===LEARNING_REVIEW_SCHEMA&&typeof v.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(v.sessionId)&&(v.beforeVersion===undefined||typeof v.beforeVersion==='number'&&Number.isSafeInteger(v.beforeVersion)&&v.beforeVersion>0);
}
export const LEARNING_REVIEW_ERRORS:Record<LearningReviewError,string>={invalid_input:'核对内容不正确，请修改后重试。',permission_denied:'当前学生或对话已不可用，未保存校正。',source_changed:'学习证据已变化，请重新分析并核对。',conflict:'已有新的校正或策略，请刷新后重新核对。',unavailable:'核对暂时未完成，请重试。',cancelled:'任务已停止，未确认的建议仍可重新核对。',no_evidence:'没有可核对的学习结果，暂不能制定训练计划。请先补充学生学习记录。'};
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
export function validLearningDraft(v:unknown):v is LearningReviewDraft{
 if(!plainStudentInput(v,['kind','correction','desiredRetention','reason','plan'])||!text(v.reason,1000))return false;
 if(v.kind==='strategy')return v.correction===undefined&&typeof v.desiredRetention==='number'&&Number.isFinite(v.desiredRetention)&&v.desiredRetention>=.7&&v.desiredRetention<=.99&&(v.plan===undefined||validTrainingPlan(v.plan));
 if(v.kind!=='assessment'||v.desiredRetention!==undefined||v.plan!==undefined||!plainStudentInput(v.correction,['result','errorType','feedback']))return false;
 const c=v.correction;
 return typeof c.result==='string'&&['correct','incorrect','partial'].includes(c.result)&&typeof c.errorType==='string'&&['none','metacognitive','application'].includes(c.errorType)&&text(c.feedback,2000)&&(c.result==='correct'?c.errorType==='none':c.errorType!=='none');
}
export function validLearningReview(v:unknown,decision=false):v is LearningReviewDecision{
 return plainStudentInput(v,decision?['schemaVersion','sessionId','id','action','draft']:['schemaVersion','sessionId','id'])&&v.schemaVersion===LEARNING_REVIEW_SCHEMA&&typeof v.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(v.sessionId)&&typeof v.id==='string'&&/^xilearning_[a-f0-9-]{36}$/i.test(v.id)&&(!decision||v.action==='reject'&&v.draft===undefined||v.action==='confirm'&&validLearningDraft(v.draft));
}
