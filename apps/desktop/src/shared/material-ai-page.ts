import {aiBatchId,AI_ISSUES,type AiIssue} from './material-ai';
import {materialId} from './materials';
import {MATERIAL_AI_IMAGE_RESPONSE,parseAiBatchResponse,imageTextEvidence,type AiImageResponse} from './material-ai-image';
import type {TeacherResource} from './contracts';
export const MATERIAL_PAGE_SOURCE='xiaozhi.material-page-source.v1' as const;
export const MATERIAL_AI_PAGE='xiaozhi.material-ai-page.v1' as const;
export const MATERIAL_AI_PAGE_RESPONSE='xiaozhi.material-ai-page-response.v1' as const;
export type MaterialPageSource={schemaVersion:typeof MATERIAL_PAGE_SOURCE;resourceId:string;version:string;page:number;generation:string;receiptSha:string};
export type AiPageResponse=Omit<AiImageResponse,'schemaVersion'>&{schemaVersion:typeof MATERIAL_AI_PAGE_RESPONSE;pageText:string;pageIssues:AiIssue[]};
export type AiPageQuery={schemaVersion:typeof MATERIAL_AI_PAGE;batchId:string;ordinal:number};
export type AiPageView={schemaVersion:typeof MATERIAL_AI_PAGE;resource:TeacherResource;source:MaterialPageSource;text:string;ocrText:string;status:'complete'|'needs_review'|'blank';issues:AiIssue[]};
const plain=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value'in d;});
const sha=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function validMaterialPageSource(v:unknown):v is MaterialPageSource{return plain(v,['schemaVersion','resourceId','version','page','generation','receiptSha'])&&v.schemaVersion===MATERIAL_PAGE_SOURCE&&materialId(v.resourceId)&&sha(v.version)&&Number.isSafeInteger(v.page)&&Number(v.page)>=1&&Number(v.page)<=10000&&typeof v.generation==='string'&&/^[a-f0-9-]{36}$/i.test(v.generation)&&sha(v.receiptSha);}
export function validAiPageQuery(v:unknown):v is AiPageQuery{return plain(v,['schemaVersion','batchId','ordinal'])&&v.schemaVersion===MATERIAL_AI_PAGE&&aiBatchId(v.batchId)&&Number.isSafeInteger(v.ordinal)&&Number(v.ordinal)>=1&&Number(v.ordinal)<=100;}
export function parseAiPageResponse(raw:string):AiPageResponse{
 try{
  if(new TextEncoder().encode(raw).length>128*1024)throw Error();const v=JSON.parse(raw);
  if(!plain(v,['schemaVersion','outcome','questions','pageText','pageIssues'])||v.schemaVersion!==MATERIAL_AI_PAGE_RESPONSE||typeof v.pageText!=='string'||v.pageText!==v.pageText.trim()||/[\x00]/.test(v.pageText)||new TextEncoder().encode(v.pageText).length>64000||!Array.isArray(v.pageIssues)||v.pageIssues.length>5||new Set(v.pageIssues).size!==v.pageIssues.length||!v.pageIssues.every(i=>AI_ISSUES.includes(i)))throw Error();
  parseAiBatchResponse(JSON.stringify({schemaVersion:MATERIAL_AI_IMAGE_RESPONSE,outcome:v.outcome,questions:v.questions}));
  if(v.outcome==='questions'&&!v.pageText)throw Error();return v as AiPageResponse;
 }catch{throw Error('invalid_response');}
}
const normalized=(v:string)=>v.normalize('NFKC').replace(/\s/g,'');
export function pageTranscriptionAgrees(first:AiPageResponse,final:AiPageResponse){return !first.pageIssues.length&&!final.pageIssues.length&&first.outcome===final.outcome&&normalized(first.pageText)===normalized(final.pageText);}
export function pageQuestionEvidence(first:AiPageResponse,final:AiPageResponse,number:string,imageSha:string,sourceStem:string){
 if(!pageTranscriptionAgrees(first,final))return;
 const convert=(r:AiPageResponse):AiImageResponse=>({schemaVersion:MATERIAL_AI_IMAGE_RESPONSE,outcome:r.outcome,questions:r.questions});
 return imageTextEvidence(convert(first),convert(final),number,imageSha,sourceStem);
}
