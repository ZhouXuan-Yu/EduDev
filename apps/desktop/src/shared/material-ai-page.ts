import {validPageContinuation,type PageContinuation} from './material-ai-continuation';
import {MATERIAL_TEXT_SOURCE_CROPS,MATERIAL_CROP_CORRECTION_POLICY,MATERIAL_CROP_REVIEW_IMAGES_POLICY,MATERIAL_CROP_REVIEW_POLICY,pageFragmentsPolicy,MATERIAL_PAGE_FRAGMENTS_PROMPT,MATERIAL_PAGE_FRAGMENT_TEXT_PROMPT,MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT,pageFragmentTextPolicy,comparableFragmentQuestion,validBlockTexts,MATERIAL_PAGE_FRAGMENTS_RESPONSE,validQuestionFragments,fragmentsMatchPage,type AiQuestionFragments,type BlockTextHint} from './material-ai-page-fragments';
import {validPageBlocks,type PageBlocks} from './material-page-blocks';
import {MATERIAL_OWNED_CROP_GEOMETRY} from './material-ai-owned-crops';
import {aiBatchId,AI_ISSUES,type AiIssue} from './material-ai';
import {materialId} from './materials';
import {MATERIAL_AI_IMAGE_RESPONSE,parseAiBatchResponse,imageTextEvidence,aiTextSignature,type AiImageResponse} from './material-ai-image';
import type {TeacherResource} from './contracts';
import {bookSectionKey,type BookAnswerPage} from './material-book-answer';
import {pageRegionsPolicy,MATERIAL_PAGE_LAYOUT_PROMPT,MATERIAL_PAGE_REGIONS_PROMPT,MATERIAL_PAGE_REGIONS_RESPONSE,validQuestionRegions,type AiQuestionRegion} from './material-ai-page-regions';
import {validLocalPageRegions,type LocalPageRegions} from './material-ai-layout-regions';
export const MATERIAL_PAGE_SOURCE='xiaozhi.material-page-source.v1' as const;
export const MATERIAL_IMAGE_SOURCE='xiaozhi.material-image-source.v1' as const;
export const MATERIAL_AI_PAGE='xiaozhi.material-ai-page.v1' as const;
export const MATERIAL_AI_PAGE_RESPONSE='xiaozhi.material-ai-page-response.v1' as const;
export const MATERIAL_AI_BOOK_PAGE_RESPONSE='xiaozhi.material-ai-book-page-response.v2' as const;
export const MATERIAL_BOOK_PAGE_POLICY='answer-entry-uncertainty.v2' as const;
export type AiAnswerIssue={section:string;number:string;issues:AiIssue[]};
export const MATERIAL_PAGE_PROMPT='page-restoration.v2' as const;
export const MATERIAL_QUESTION_PAGE_PROMPT='page-restoration.v3' as const;
type OcrStatus='complete'|'blank'|'failed'|'needs_review';
export type AiPagePrompt={policy:typeof MATERIAL_PAGE_PROMPT;ocrStatus:OcrStatus}|{policy:typeof MATERIAL_QUESTION_PAGE_PROMPT;ocrStatus:OcrStatus;totalPages:number}|{policy:typeof MATERIAL_PAGE_REGIONS_PROMPT|'page-regions.v1';ocrStatus:OcrStatus;totalPages:number;resourceTitle:string}|{policy:typeof MATERIAL_PAGE_LAYOUT_PROMPT;ocrStatus:OcrStatus;totalPages:number;resourceTitle:string;layout:LocalPageRegions}|{policy:typeof MATERIAL_PAGE_FRAGMENTS_PROMPT;ocrStatus:OcrStatus;totalPages:number;resourceTitle:string;blocks:PageBlocks}|{policy:typeof MATERIAL_PAGE_FRAGMENT_TEXT_PROMPT|typeof MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT;ocrStatus:OcrStatus;totalPages:number;resourceTitle:string;blocks:PageBlocks;blockTexts:BlockTextHint[];sourceCropPolicy?:typeof MATERIAL_TEXT_SOURCE_CROPS;cropReviewPolicy?:typeof MATERIAL_CROP_REVIEW_POLICY|typeof MATERIAL_CROP_REVIEW_IMAGES_POLICY|typeof MATERIAL_CROP_CORRECTION_POLICY;cropGeometryPolicy?:typeof MATERIAL_OWNED_CROP_GEOMETRY;continuation?:PageContinuation};
export type MaterialPageSource={schemaVersion:typeof MATERIAL_PAGE_SOURCE|typeof MATERIAL_IMAGE_SOURCE;resourceId:string;version:string;page:number;generation:string;receiptSha:string};
export type AiPageResponse=Omit<AiImageResponse,'schemaVersion'>&{pageText:string;pageIssues:AiIssue[]}&({schemaVersion:typeof MATERIAL_AI_PAGE_RESPONSE}|{schemaVersion:typeof MATERIAL_AI_BOOK_PAGE_RESPONSE;answerIssues:AiAnswerIssue[]}|{schemaVersion:typeof MATERIAL_PAGE_REGIONS_RESPONSE;regions:AiQuestionRegion[]}|{schemaVersion:typeof MATERIAL_PAGE_FRAGMENTS_RESPONSE;fragments:AiQuestionFragments[]});
export function pageResponseMatchesPolicy(response:AiPageResponse,policy:unknown,answerBook:boolean,prompt?:AiPagePrompt){return pageFragmentsPolicy(prompt?.policy)?!answerBook&&policy===undefined&&response.schemaVersion===MATERIAL_PAGE_FRAGMENTS_RESPONSE&&fragmentsMatchPage(response.fragments,prompt.blocks):pageRegionsPolicy(prompt?.policy)?!answerBook&&policy===undefined&&response.schemaVersion===MATERIAL_PAGE_REGIONS_RESPONSE:policy===undefined?response.schemaVersion===MATERIAL_AI_PAGE_RESPONSE:policy===MATERIAL_BOOK_PAGE_POLICY&&answerBook&&response.schemaVersion===MATERIAL_AI_BOOK_PAGE_RESPONSE;}
export type AiPageQuery={schemaVersion:typeof MATERIAL_AI_PAGE;batchId:string;ordinal:number;includeImage?:true};
export type AiPageStatus='complete'|'needs_review'|'blank';
export type AiPageView={schemaVersion:typeof MATERIAL_AI_PAGE;resource:TeacherResource;source:MaterialPageSource;text:string;ocrText:string;status:AiPageStatus;transcriptionStatus?:AiPageStatus;issues:AiIssue[];continuation?:{source:MaterialPageSource;ocrText:string};inputImage?:{dataUrl:string};bookAnswers?:BookAnswerPage};
const plain=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value'in d;});
const sha=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function exactContinuation(v:unknown,keys:string[],review:(p:unknown)=>boolean):v is Record<string,unknown>{
 const shape=plain(v,[...keys,'cropGeometryPolicy','continuation'])||plain(v,[...keys,'cropGeometryPolicy','cropReviewPolicy','continuation'])&&review(v.cropReviewPolicy);
 return shape&&v.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT&&v.cropGeometryPolicy===MATERIAL_OWNED_CROP_GEOMETRY&&validPageContinuation(v.continuation)&&Number(v.continuation.source.page)<=Number(v.totalPages)&&v.continuation.image.total===v.totalPages;
}
export function validAiPagePrompt(v:unknown):v is AiPagePrompt{
 if(v&&typeof v==='object'&&Object.hasOwn(v,'sourceCropPolicy')){
  if(!plain(v,Object.keys(v))||v.sourceCropPolicy!==MATERIAL_TEXT_SOURCE_CROPS||v.policy!==MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT)return false;
  const {sourceCropPolicy:_,...previous}=v;return validAiPagePrompt(previous);
 }
 const old=plain(v,['policy','ocrStatus'])&&v.policy===MATERIAL_PAGE_PROMPT;
 const keys=['policy','ocrStatus','totalPages','resourceTitle','blocks','blockTexts'];
 const review=(p:unknown)=>p===MATERIAL_CROP_REVIEW_POLICY||p===MATERIAL_CROP_REVIEW_IMAGES_POLICY||p===MATERIAL_CROP_CORRECTION_POLICY;
 const text=exactContinuation(v,keys,review)||plain(v,keys)||plain(v,[...keys,'cropReviewPolicy'])&&v.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT&&review(v.cropReviewPolicy)||(plain(v,[...keys,'cropGeometryPolicy'])||plain(v,[...keys,'cropGeometryPolicy','cropReviewPolicy'])&&review(v.cropReviewPolicy))&&v.policy===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT&&v.cropGeometryPolicy===MATERIAL_OWNED_CROP_GEOMETRY;
 const fragment=(plain(v,['policy','ocrStatus','totalPages','resourceTitle','blocks'])&&v.policy===MATERIAL_PAGE_FRAGMENTS_PROMPT||text&&pageFragmentTextPolicy(v.policy))&&validPageBlocks(v.blocks)&&v.blocks.ok&&(!pageFragmentTextPolicy(v.policy)||validBlockTexts(v.blockTexts,v.blocks));
 const region=(plain(v,['policy','ocrStatus','totalPages','resourceTitle'])&&(v.policy==='page-regions.v1'||v.policy===MATERIAL_PAGE_REGIONS_PROMPT)||plain(v,['policy','ocrStatus','totalPages','resourceTitle','layout'])&&v.policy===MATERIAL_PAGE_LAYOUT_PROMPT&&validLocalPageRegions(v.layout)&&v.layout.total===v.totalPages||fragment)&&typeof v.resourceTitle==='string'&&v.resourceTitle.length>0&&v.resourceTitle.length<=512&&!/[\x00-\x1f]/.test(v.resourceTitle);
 const page=plain(v,['policy','ocrStatus','totalPages'])&&v.policy===MATERIAL_QUESTION_PAGE_PROMPT||region;
 return (old||page&&Number.isSafeInteger(v.totalPages)&&Number(v.totalPages)>=1&&Number(v.totalPages)<=10000)&&typeof v.ocrStatus==='string'&&['complete','blank','failed','needs_review'].includes(v.ocrStatus);
}
export function validMaterialPageSource(v:unknown):v is MaterialPageSource{return plain(v,['schemaVersion','resourceId','version','page','generation','receiptSha'])&&(v.schemaVersion===MATERIAL_PAGE_SOURCE||v.schemaVersion===MATERIAL_IMAGE_SOURCE&&v.page===1)&&materialId(v.resourceId)&&sha(v.version)&&Number.isSafeInteger(v.page)&&Number(v.page)>=1&&Number(v.page)<=10000&&typeof v.generation==='string'&&/^[a-f0-9-]{36}$/i.test(v.generation)&&sha(v.receiptSha);}
export function validAiPageQuery(v:unknown):v is AiPageQuery{return (plain(v,['schemaVersion','batchId','ordinal'])||plain(v,['schemaVersion','batchId','ordinal','includeImage'])&&v.includeImage===true)&&v.schemaVersion===MATERIAL_AI_PAGE&&aiBatchId(v.batchId)&&Number.isSafeInteger(v.ordinal)&&Number(v.ordinal)>=1&&Number(v.ordinal)<=100;}
export function parseAiPageResponse(raw:string):AiPageResponse{
 try{
  if(new TextEncoder().encode(raw).length>128*1024)throw Error();const v=JSON.parse(raw);
  const book=v?.schemaVersion===MATERIAL_AI_BOOK_PAGE_RESPONSE,regions=v?.schemaVersion===MATERIAL_PAGE_REGIONS_RESPONSE,fragments=v?.schemaVersion===MATERIAL_PAGE_FRAGMENTS_RESPONSE;
  if(!plain(v,['schemaVersion','outcome','questions','pageText','pageIssues',...(book?['answerIssues']:regions?['regions']:fragments?['fragments']:[])])||!book&&!regions&&!fragments&&v.schemaVersion!==MATERIAL_AI_PAGE_RESPONSE||typeof v.pageText!=='string'||v.pageText!==v.pageText.trim()||/[\x00]/.test(v.pageText)||new TextEncoder().encode(v.pageText).length>64000||!Array.isArray(v.pageIssues)||v.pageIssues.length>5||new Set(v.pageIssues).size!==v.pageIssues.length||!v.pageIssues.every(i=>AI_ISSUES.includes(i)))throw Error();
  if(book){const keys=new Set<string>();if(!Array.isArray(v.answerIssues)||v.answerIssues.length>200||!Array.isArray(v.questions)||v.questions.length||v.outcome==='questions'||!v.answerIssues.every((item:unknown)=>{
   if(!plain(item,['section','number','issues'])||typeof item.section!=='string'||!item.section.trim()||item.section!==item.section.trim()||item.section.length>200||/[\x00-\x1f]/.test(item.section)||typeof item.number!=='string'||!/^\d{1,5}$/.test(item.number)||!Array.isArray(item.issues)||!item.issues.length||item.issues.length>5||new Set(item.issues).size!==item.issues.length||!item.issues.every(i=>AI_ISSUES.includes(i)))return false;
   const key=bookSectionKey(item.section)+'\0'+item.number;if(keys.has(key))return false;keys.add(key);return true;
  })||(v.pageIssues.length||v.answerIssues.length)&&v.outcome!=='needs_review')throw Error();}
  parseAiBatchResponse(JSON.stringify({schemaVersion:MATERIAL_AI_IMAGE_RESPONSE,outcome:v.outcome,questions:v.questions}));
  if(regions&&!validQuestionRegions(v.regions,(v.questions as AiImageResponse['questions']).map(q=>q.number)))throw Error();
  if(fragments&&!validQuestionFragments(v.fragments,(v.questions as AiImageResponse['questions']).map(q=>q.number)))throw Error();
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
export function pageQuestionEvidence(first:AiPageResponse,final:AiPageResponse,number:string,imageSha:string,sourceStem:string,prompt?:AiPagePrompt){
 if(!pageTranscriptionAgrees(first,final))return;
 if(first.schemaVersion===MATERIAL_PAGE_FRAGMENTS_RESPONSE&&(!pageFragmentTextPolicy(prompt?.policy)||[first,final].some(r=>{const q=r.questions.find(q=>q.number===number);return !q||q.requiresImage||q.projection.figures.state!=='not_applicable';}))){if(final.schemaVersion!==MATERIAL_PAGE_FRAGMENTS_RESPONSE)return;const a=first.fragments.find(r=>r.number===number),b=final.fragments.find(r=>r.number===number);if(!a?.complete||!b?.complete||JSON.stringify(a.blockIds)!==JSON.stringify(b.blockIds))return;}
 // Canonical question rows store the complete stem. Separate coverage fields cannot
 // excuse dropping choices, subquestions, table values or formulas from that stem.
 for(const response of [first,final]){const raw=response.questions.find(item=>item.number===number);if(!raw)return;const q=comparableFragmentQuestion(raw,final.questions.find(b=>b.number===number),sourceStem,prompt?.policy);
  for(const field of ['choices','subquestions','tables','formulas'] as const){const part=q.projection[field];if(part.state==='provided'&&(!normalized(q.stem).includes(normalized(part.text))||!normalized(sourceStem).includes(normalized(part.text))))return;}
 }
 const convert=(r:AiPageResponse):AiImageResponse=>({schemaVersion:MATERIAL_AI_IMAGE_RESPONSE,outcome:r.outcome,questions:r.questions.map(q=>q.number===number?comparableFragmentQuestion(q,final.questions.find(b=>b.number===number),sourceStem,prompt?.policy):q)});
 return imageTextEvidence(convert(first),convert(final),number,imageSha,sourceStem);
}
