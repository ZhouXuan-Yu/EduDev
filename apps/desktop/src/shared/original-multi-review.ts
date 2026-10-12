import {plainStudentInput} from './student-context';
import {validOriginalDraft,validOriginalRegion,type OriginalQuestionDraft} from './original-question-review';
import type {QuestionReviewSummary,QuestionReviewResult} from './question-review';
import type {QuestionContextSource} from './question-context';
import type {MaterialPreviewResult} from './material-page-preview';
import {validQuestionProjection,type QuestionProjection} from './question-projection';
export const ORIGINAL_MULTI_SCHEMA='xiaozhi.education.original-review.v2' as const;
export const ORIGINAL_MULTI_ACTION='pi_original_question_multi_candidate' as const;
export const ORIGINAL_MULTI_MAX_IMAGES=8;
export const ORIGINAL_MULTI_MAX_IMAGE_BYTES=16*1048576;
export type OriginalRegionRole='question'|'answer'|'analysis';
export type OriginalMultiRegion={page:number;box:[number,number,number,number];role:OriginalRegionRole};
export type OriginalMultiDraft=OriginalQuestionDraft&{answerOrigin:'missing'|'teacher'|'source';analysisOrigin:'missing'|'teacher'|'source';sourceChecked:boolean;projection?:QuestionProjection};
export type OriginalMultiInput={schemaVersion:typeof ORIGINAL_MULTI_SCHEMA;sessionId:string;id:string};
export type OriginalMultiDecision=OriginalMultiInput&{action:'confirm'|'reject';revision:string;draft?:OriginalMultiDraft;complete?:true};
export type OriginalMultiRevise=OriginalMultiInput&{revision:string;regions:OriginalMultiRegion[]};
export type OriginalMultiImage={role:OriginalRegionRole;image:Extract<MaterialPreviewResult,{ok:true}>};
export type OriginalMultiView={schemaVersion:typeof ORIGINAL_MULTI_SCHEMA;summary:QuestionReviewSummary;draft:OriginalMultiDraft;revision:string;sourceCurrent:boolean;sourceTitle:string;images:OriginalMultiImage[];saved?:QuestionContextSource};
export type OriginalMultiResult<T>=QuestionReviewResult<T>;
export type OriginalGalleryInput={schemaVersion:typeof ORIGINAL_MULTI_SCHEMA;questionId:string;version:string};
export type OriginalGalleryImage={role:OriginalRegionRole;page:number;assetId:string;sha256:string;dataUrl:string};
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>plainStudentInput(v,keys)&&Reflect.ownKeys(v).length===keys.length;
const sha=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const dense=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&v.length>0&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>d&&'value'in d&&d.enumerable);
export function validMultiRegions(v:unknown,resourceId:string,version:string):v is OriginalMultiRegion[]{
 if(!dense(v,ORIGINAL_MULTI_MAX_IMAGES))return false;
 const seen=new Set<string>();let question=false;
 for(const r of v){if(!exact(r,['page','box','role']))return false;const region=r as OriginalMultiRegion;if(!['question','answer','analysis'].includes(region.role)||!validOriginalRegion({resourceId,version,page:region.page,box:region.box}))return false;
 const key=JSON.stringify([region.page,region.box]);if(seen.has(key))return false;seen.add(key);question ||=region.role==='question';}return question;
}
export function questionToolRegions(v:unknown,resourceId:string,version:string):OriginalMultiRegion[]{
 if(!dense(v,ORIGINAL_MULTI_MAX_IMAGES)||!v.every(r=>exact(r,['page','box'])))throw new Error('invalid_input');
 const regions=v.map(r=>({...r as {page:number;box:[number,number,number,number]},role:'question' as const}));if(!validMultiRegions(regions,resourceId,version))throw new Error('invalid_input');return regions;
}
export function validMultiDraft(v:unknown,complete=true):v is OriginalMultiDraft{
 const fields=['title','subject','grade','knowledgePoint','questionType','difficulty','stem','answer','analysis'];
 if(!plainStudentInput(v,[...fields,'answerOrigin','analysisOrigin','sourceChecked','projection']))return false;
 const hasProjection=Object.prototype.hasOwnProperty.call(v,'projection');
 if(!exact(v,[...fields,'answerOrigin','analysisOrigin','sourceChecked',...(hasProjection?['projection']:[])])||hasProjection&&!validQuestionProjection(v.projection,complete))return false;
 const d=v as OriginalMultiDraft;if(!validOriginalDraft(Object.fromEntries(fields.map(f=>[f,(d as unknown as Record<string,unknown>)[f]])))||typeof d.sourceChecked!=='boolean')return false;
 if(hasProjection&&d.projection!.statement.text!==d.stem)return false;
 return(['answer','analysis'] as const).every(k=>['missing','teacher','source'].includes(d[`${k}Origin`])&&(d[`${k}Origin`]==='missing'?d[k]==='':!!d[k].trim()));
}
export function validMultiInput(v:unknown):v is OriginalMultiInput{return exact(v,['schemaVersion','sessionId','id'])&&v!.schemaVersion===ORIGINAL_MULTI_SCHEMA&&typeof v!.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/.test(v!.sessionId)&&typeof v!.id==='string'&&/^xioriginalmulti_[a-f0-9-]{36}$/.test(v!.id);}
export function validMultiDecision(v:unknown):v is OriginalMultiDecision{
 if(!plainStudentInput(v,['schemaVersion','sessionId','id','action','revision','draft','complete']))return false;
 return validMultiInput({schemaVersion:v.schemaVersion,sessionId:v.sessionId,id:v.id})&&sha(v.revision)&&(v.action==='reject'&&v.draft===undefined&&v.complete===undefined||v.action==='confirm'&&v.complete===true&&validMultiDraft(v.draft));
}
export function validMultiRevise(v:unknown):v is OriginalMultiRevise{return exact(v,['schemaVersion','sessionId','id','revision','regions'])&&validMultiInput({schemaVersion:v!.schemaVersion,sessionId:v!.sessionId,id:v!.id})&&sha(v!.revision)&&dense(v!.regions,ORIGINAL_MULTI_MAX_IMAGES);}
export function validGalleryInput(v:unknown):v is OriginalGalleryInput{return exact(v,['schemaVersion','questionId','version'])&&v!.schemaVersion===ORIGINAL_MULTI_SCHEMA&&typeof v!.questionId==='string'&&/^question_[a-f0-9-]{36}$/.test(v!.questionId)&&sha(v!.version);}
