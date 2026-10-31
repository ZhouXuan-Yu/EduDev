import {aiBatchId,AI_ISSUES,type AiIssue} from './material-ai';
import {materialId} from './materials';
import {MATERIAL_AI_IMAGE_RESPONSE,parseAiBatchResponse,imageTextEvidence,aiTextSignature,type AiImageResponse} from './material-ai-image';
import type {TeacherResource} from './contracts';
import {bookSectionKey,type BookAnswerPage} from './material-book-answer';
export const MATERIAL_PAGE_SOURCE='xiaozhi.material-page-source.v1' as const;
export const MATERIAL_IMAGE_SOURCE='xiaozhi.material-image-source.v1' as const;
export const MATERIAL_AI_PAGE='xiaozhi.material-ai-page.v1' as const;
export const MATERIAL_AI_PAGE_RESPONSE='xiaozhi.material-ai-page-response.v1' as const;
export const MATERIAL_AI_BOOK_PAGE_RESPONSE='xiaozhi.material-ai-book-page-response.v2' as const;
export const MATERIAL_BOOK_PAGE_POLICY='answer-entry-uncertainty.v2' as const;
export type AiAnswerIssue={section:string;number:string;issues:AiIssue[]};
export const MATERIAL_PAGE_PROMPT='page-restoration.v2' as const;
export type AiPagePrompt={policy:typeof MATERIAL_PAGE_PROMPT;ocrStatus:'complete'|'blank'|'failed'|'needs_review'};
export type MaterialPageSource={schemaVersion:typeof MATERIAL_PAGE_SOURCE|typeof MATERIAL_IMAGE_SOURCE;resourceId:string;version:string;page:number;generation:string;receiptSha:string};
export type AiPageResponse=Omit<AiImageResponse,'schemaVersion'>&{pageText:string;pageIssues:AiIssue[]}&({schemaVersion:typeof MATERIAL_AI_PAGE_RESPONSE}|{schemaVersion:typeof MATERIAL_AI_BOOK_PAGE_RESPONSE;answerIssues:AiAnswerIssue[]});
export function pageResponseMatchesPolicy(response:AiPageResponse,policy:unknown,answerBook:boolean){return policy===undefined?response.schemaVersion===MATERIAL_AI_PAGE_RESPONSE:policy===MATERIAL_BOOK_PAGE_POLICY&&answerBook&&response.schemaVersion===MATERIAL_AI_BOOK_PAGE_RESPONSE;}
export type AiPageQuery={schemaVersion:typeof MATERIAL_AI_PAGE;batchId:string;ordinal:number;includeImage?:true};
export type AiPageStatus='complete'|'needs_review'|'blank';
export type AiPageView={schemaVersion:typeof MATERIAL_AI_PAGE;resource:TeacherResource;source:MaterialPageSource;text:string;ocrText:string;status:AiPageStatus;transcriptionStatus?:AiPageStatus;issues:AiIssue[];inputImage?:{dataUrl:string};bookAnswers?:BookAnswerPage};
const plain=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value'in d;});
const sha=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function validAiPagePrompt(v:unknown):v is AiPagePrompt{return plain(v,['policy','ocrStatus'])&&v.policy===MATERIAL_PAGE_PROMPT&&typeof v.ocrStatus==='string'&&['complete','blank','failed','needs_review'].includes(v.ocrStatus);}
export function validMaterialPageSource(v:unknown):v is MaterialPageSource{return plain(v,['schemaVersion','resourceId','version','page','generation','receiptSha'])&&(v.schemaVersion===MATERIAL_PAGE_SOURCE||v.schemaVersion===MATERIAL_IMAGE_SOURCE&&v.page===1)&&materialId(v.resourceId)&&sha(v.version)&&Number.isSafeInteger(v.page)&&Number(v.page)>=1&&Number(v.page)<=10000&&typeof v.generation==='string'&&/^[a-f0-9-]{36}$/i.test(v.generation)&&sha(v.receiptSha);}
export function validAiPageQuery(v:unknown):v is AiPageQuery{return (plain(v,['schemaVersion','batchId','ordinal'])||plain(v,['schemaVersion','batchId','ordinal','includeImage'])&&v.includeImage===true)&&v.schemaVersion===MATERIAL_AI_PAGE&&aiBatchId(v.batchId)&&Number.isSafeInteger(v.ordinal)&&Number(v.ordinal)>=1&&Number(v.ordinal)<=100;}
export function parseAiPageResponse(raw:string):AiPageResponse{
 try{
  if(new TextEncoder().encode(raw).length>128*1024)throw Error();const v=JSON.parse(raw);
  const book=v?.schemaVersion===MATERIAL_AI_BOOK_PAGE_RESPONSE;
  if(!plain(v,['schemaVersion','outcome','questions','pageText','pageIssues',...(book?['answerIssues']:[])])||!book&&v.schemaVersion!==MATERIAL_AI_PAGE_RESPONSE||typeof v.pageText!=='string'||v.pageText!==v.pageText.trim()||/[\x00]/.test(v.pageText)||new TextEncoder().encode(v.pageText).length>64000||!Array.isArray(v.pageIssues)||v.pageIssues.length>5||new Set(v.pageIssues).size!==v.pageIssues.length||!v.pageIssues.every(i=>AI_ISSUES.includes(i)))throw Error();
  if(book){const keys=new Set<string>();if(!Array.isArray(v.answerIssues)||v.answerIssues.length>200||!Array.isArray(v.questions)||v.questions.length||v.outcome==='questions'||!v.answerIssues.every((item:unknown)=>{
   if(!plain(item,['section','number','issues'])||typeof item.section!=='string'||!item.section.trim()||item.section!==item.section.trim()||item.section.length>200||/[\x00-\x1f]/.test(item.section)||typeof item.number!=='string'||!/^\d{1,5}$/.test(item.number)||!Array.isArray(item.issues)||!item.issues.length||item.issues.length>5||new Set(item.issues).size!==item.issues.length||!item.issues.every(i=>AI_ISSUES.includes(i)))return false;
   const key=bookSectionKey(item.section)+'\0'+item.number;if(keys.has(key))return false;keys.add(key);return true;
  })||(v.pageIssues.length||v.answerIssues.length)&&v.outcome!=='needs_review')throw Error();}
  parseAiBatchResponse(JSON.stringify({schemaVersion:MATERIAL_AI_IMAGE_RESPONSE,outcome:v.outcome,questions:v.questions}));
  if(v.outcome==='questions'&&!v.pageText)throw Error();return v as AiPageResponse;
 }catch{throw Error('invalid_response');}
}
// Compatibility normalization erases mathematical superscripts/subscripts (x² -> x2).
const normalized=aiTextSignature;
export const pageHasAnswerIssues=(r:AiPageResponse)=>r.schemaVersion===MATERIAL_AI_BOOK_PAGE_RESPONSE&&r.answerIssues.length>0;
export function pageTranscriptionAgrees(first:AiPageResponse,final:AiPageResponse){return first.schemaVersion===final.schemaVersion&&!first.pageIssues.length&&!final.pageIssues.length&&!pageHasAnswerIssues(first)&&!pageHasAnswerIssues(final)&&first.outcome===final.outcome&&normalized(first.pageText)===normalized(final.pageText);}
/** Transcription quality is separate from extracting/solving a figure-dependent question. */
export function pageTranscriptionStatus(first:AiPageResponse,final:AiPageResponse):AiPageStatus{
 const unclear=(r:AiPageResponse)=>r.questions.some(q=>q.issues.some(i=>i==='uncertain_ocr'||i==='cross_page'||i==='incomplete_question'));
 if(first.schemaVersion!==final.schemaVersion||first.schemaVersion===MATERIAL_AI_BOOK_PAGE_RESPONSE&&(first.outcome==='needs_review'||final.outcome==='needs_review')||first.pageIssues.length||final.pageIssues.length||pageHasAnswerIssues(first)||pageHasAnswerIssues(final)||normalized(first.pageText)!==normalized(final.pageText)||unclear(first)||unclear(final))return 'needs_review';
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
