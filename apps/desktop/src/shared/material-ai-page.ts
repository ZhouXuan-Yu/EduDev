import {aiBatchId,AI_ISSUES,type AiIssue} from './material-ai';
import {materialId} from './materials';
import {MATERIAL_AI_IMAGE_RESPONSE,parseAiBatchResponse,imageTextEvidence,aiTextSignature,type AiImageResponse} from './material-ai-image';
import type {TeacherResource} from './contracts';
import type {BookAnswerPage} from './material-book-answer';
export const MATERIAL_PAGE_SOURCE='xiaozhi.material-page-source.v1' as const;
export const MATERIAL_IMAGE_SOURCE='xiaozhi.material-image-source.v1' as const;
export const MATERIAL_AI_PAGE='xiaozhi.material-ai-page.v1' as const;
export const MATERIAL_AI_PAGE_RESPONSE='xiaozhi.material-ai-page-response.v1' as const;
export const MATERIAL_PAGE_PROMPT='page-restoration.v2' as const;
export type AiPagePrompt={policy:typeof MATERIAL_PAGE_PROMPT;ocrStatus:'complete'|'blank'|'failed'|'needs_review'};
export type MaterialPageSource={schemaVersion:typeof MATERIAL_PAGE_SOURCE|typeof MATERIAL_IMAGE_SOURCE;resourceId:string;version:string;page:number;generation:string;receiptSha:string};
export type AiPageResponse=Omit<AiImageResponse,'schemaVersion'>&{schemaVersion:typeof MATERIAL_AI_PAGE_RESPONSE;pageText:string;pageIssues:AiIssue[]};
export type AiPageQuery={schemaVersion:typeof MATERIAL_AI_PAGE;batchId:string;ordinal:number;includeImage?:true};
export type AiPageStatus='complete'|'needs_review'|'blank';
export type AiPageView={schemaVersion:typeof MATERIAL_AI_PAGE;resource:TeacherResource;source:MaterialPageSource;text:string;ocrText:string;status:AiPageStatus;transcriptionStatus?:AiPageStatus;issues:AiIssue[];inputImage?:{dataUrl:string};bookAnswers?:BookAnswerPage};
const plain=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value'in d;});
const sha=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function validAiPagePrompt(v:unknown):v is AiPagePrompt{return plain(v,['policy','ocrStatus'])&&v.policy===MATERIAL_PAGE_PROMPT&&['complete','blank','failed','needs_review'].includes(String(v.ocrStatus));}
export function validMaterialPageSource(v:unknown):v is MaterialPageSource{return plain(v,['schemaVersion','resourceId','version','page','generation','receiptSha'])&&(v.schemaVersion===MATERIAL_PAGE_SOURCE||v.schemaVersion===MATERIAL_IMAGE_SOURCE&&v.page===1)&&materialId(v.resourceId)&&sha(v.version)&&Number.isSafeInteger(v.page)&&Number(v.page)>=1&&Number(v.page)<=10000&&typeof v.generation==='string'&&/^[a-f0-9-]{36}$/i.test(v.generation)&&sha(v.receiptSha);}
export function validAiPageQuery(v:unknown):v is AiPageQuery{return (plain(v,['schemaVersion','batchId','ordinal'])||plain(v,['schemaVersion','batchId','ordinal','includeImage'])&&v.includeImage===true)&&v.schemaVersion===MATERIAL_AI_PAGE&&aiBatchId(v.batchId)&&Number.isSafeInteger(v.ordinal)&&Number(v.ordinal)>=1&&Number(v.ordinal)<=100;}
export function parseAiPageResponse(raw:string):AiPageResponse{
 try{
  if(new TextEncoder().encode(raw).length>128*1024)throw Error();const v=JSON.parse(raw);
  if(!plain(v,['schemaVersion','outcome','questions','pageText','pageIssues'])||v.schemaVersion!==MATERIAL_AI_PAGE_RESPONSE||typeof v.pageText!=='string'||v.pageText!==v.pageText.trim()||/[\x00]/.test(v.pageText)||new TextEncoder().encode(v.pageText).length>64000||!Array.isArray(v.pageIssues)||v.pageIssues.length>5||new Set(v.pageIssues).size!==v.pageIssues.length||!v.pageIssues.every(i=>AI_ISSUES.includes(i)))throw Error();
  parseAiBatchResponse(JSON.stringify({schemaVersion:MATERIAL_AI_IMAGE_RESPONSE,outcome:v.outcome,questions:v.questions}));
  if(v.outcome==='questions'&&!v.pageText)throw Error();return v as AiPageResponse;
 }catch{throw Error('invalid_response');}
}
// Compatibility normalization erases mathematical superscripts/subscripts (x² -> x2).
const normalized=aiTextSignature;
export function pageTranscriptionAgrees(first:AiPageResponse,final:AiPageResponse){return !first.pageIssues.length&&!final.pageIssues.length&&first.outcome===final.outcome&&normalized(first.pageText)===normalized(final.pageText);}
/** Transcription quality is separate from extracting/solving a figure-dependent question. */
export function pageTranscriptionStatus(first:AiPageResponse,final:AiPageResponse):AiPageStatus{
 const unclear=(r:AiPageResponse)=>r.questions.some(q=>q.issues.some(i=>i==='uncertain_ocr'||i==='cross_page'||i==='incomplete_question'));
 if(first.pageIssues.length||final.pageIssues.length||normalized(first.pageText)!==normalized(final.pageText)||unclear(first)||unclear(final))return 'needs_review';
 return final.pageText?'complete':'blank';
}
/** Missing new metadata keeps the old conservative status for older host adapters. */
export function readablePageTranscription(view:AiPageView){return ['complete','blank'].includes(view.transcriptionStatus??view.status);}
export function pageQuestionEvidence(first:AiPageResponse,final:AiPageResponse,number:string,imageSha:string,sourceStem:string){
 if(!pageTranscriptionAgrees(first,final))return;
 // Canonical question rows store the complete stem. Separate coverage fields cannot
 // excuse dropping choices, subquestions, table values or formulas from that stem.
 for(const response of [first,final]){const q=response.questions.find(item=>item.number===number);if(!q)return;
  for(const field of ['choices','subquestions','tables','formulas'] as const){const part=q.projection[field];if(part.state==='provided'&&(!normalized(q.stem).includes(normalized(part.text))||!normalized(sourceStem).includes(normalized(part.text))))return;}
 }
 const convert=(r:AiPageResponse):AiImageResponse=>({schemaVersion:MATERIAL_AI_IMAGE_RESPONSE,outcome:r.outcome,questions:r.questions});
 return imageTextEvidence(convert(first),convert(final),number,imageSha,sourceStem);
}
