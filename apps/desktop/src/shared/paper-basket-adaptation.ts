import {plainStudentInput,validStudentId} from './student-context';
import {validBasketId,validBasketEntryId,validBasketRevision,type PaperBasketEntry} from './paper-basket';
import {validPaperSession} from './paper-blueprint';
import type {PaperInstance} from './paper-instance';
import type {QuestionReviewDraft,QuestionReviewSummary,QuestionReviewView} from './question-review';
export const PAPER_ADAPTATION_SCHEMA='xiaozhi.paper-basket-adaptation.v1' as const;
export type PaperAdaptationPrepare={schemaVersion:typeof PAPER_ADAPTATION_SCHEMA;sessionId:string;studentId:string;basketId:string;requestId:string;expectedBasketRevision:number;entryId:string;instanceRevision:number;parentQuestionId:string;parentSourceVersion:string;requirements:string;intent:'replace'|'add'};
export type PaperAdaptationRead=Pick<PaperAdaptationPrepare,'schemaVersion'|'sessionId'|'studentId'|'basketId'>&{intentId:string};
export type PaperAdaptationList=Pick<PaperAdaptationPrepare,'schemaVersion'|'sessionId'|'studentId'|'basketId'|'entryId'>;
export type PaperAdaptationAccept=PaperAdaptationRead&{requestId:string;candidateId:string;candidateDigest:string};
export type PaperAdaptationCancel=PaperAdaptationRead&{requestId:string};
export type PaperAdaptationCandidate=QuestionReviewSummary&{draft:QuestionReviewDraft;variation:NonNullable<QuestionReviewView['variation']>;sourceCurrent:boolean;effectDigest?:string};
export type PaperAdaptationReceipt={requestId:string;intentId:string;basketId:string;basketRevision:number;entryId:string;candidateId:string;questionId:string;sourceVersion:string;intent:'replace'|'add'};
export type PaperAdaptationView={schemaVersion:typeof PAPER_ADAPTATION_SCHEMA;intentId:string;input:PaperAdaptationPrepare;prompt:string;status:'prepared'|'cancelled'|'accepted';current:boolean;generationStarted:boolean;original:PaperBasketEntry&{instance:PaperInstance};candidates:PaperAdaptationCandidate[];receipt?:PaperAdaptationReceipt};
export type PaperAdaptationResult<T>={ok:true;value:T}|{ok:false;error:string};
export interface PaperBasketAdaptationApi {
 listPaperBasketAdaptations:(input:PaperAdaptationList)=>Promise<PaperAdaptationResult<PaperAdaptationView[]>>;
 preparePaperBasketAdaptation:(input:PaperAdaptationPrepare)=>Promise<PaperAdaptationResult<PaperAdaptationView>>;
 readPaperBasketAdaptation:(input:PaperAdaptationRead)=>Promise<PaperAdaptationResult<PaperAdaptationView>>;
 acceptPaperBasketAdaptation:(input:PaperAdaptationAccept)=>Promise<PaperAdaptationResult<PaperAdaptationReceipt>>;
 cancelPaperBasketAdaptation:(input:PaperAdaptationCancel)=>Promise<PaperAdaptationResult<PaperAdaptationView>>;
}
const request=(v:unknown):v is string=>typeof v==='string'&&/^[a-zA-Z0-9_-]{8,100}$/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const owner=(v:Record<string,unknown>)=>v.schemaVersion===PAPER_ADAPTATION_SCHEMA&&validPaperSession(v.sessionId)&&(v.studentId===''||validStudentId(v.studentId))&&validBasketId(v.basketId);
export function validAdaptationPrepare(v:unknown):v is PaperAdaptationPrepare {
 return plainStudentInput(v,['schemaVersion','sessionId','studentId','basketId','requestId','expectedBasketRevision','entryId','instanceRevision','parentQuestionId','parentSourceVersion','requirements','intent'])&&owner(v)&&request(v.requestId)&&validBasketRevision(v.expectedBasketRevision)&&validBasketRevision(v.instanceRevision)&&validBasketEntryId(v.entryId)&&typeof v.parentQuestionId==='string'&&/^question_[a-f0-9-]{36}$/i.test(v.parentQuestionId)&&hash(v.parentSourceVersion)&&typeof v.requirements==='string'&&v.requirements===v.requirements.trim()&&v.requirements.length>0&&v.requirements.length<=4000&&!/[\x00-\x1f]/.test(v.requirements)&&['replace','add'].includes(String(v.intent));
}
export function validAdaptationRead(v:unknown,action:'read'|'accept'|'cancel'='read'):v is PaperAdaptationAccept {
 return plainStudentInput(v,['schemaVersion','sessionId','studentId','basketId','intentId',...(action!=='read'?['requestId']:[]),...(action==='accept'?['candidateId','candidateDigest']:[])])&&owner(v)&&request(v.intentId)&&(action==='read'||request(v.requestId))&&(action!=='accept'||typeof v.candidateId==='string'&&/^xiquestion_[a-f0-9-]{36}$/i.test(v.candidateId)&&hash(v.candidateDigest));
}

export function validAdaptationList(v:unknown):v is PaperAdaptationList{return plainStudentInput(v,['schemaVersion','sessionId','studentId','basketId','entryId'])&&owner(v)&&validBasketEntryId(v.entryId);}
