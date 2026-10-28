import {materialId,type MaterialSource} from './materials';
import type {ArchiveFields} from './question-archive';
import type {AiNativeSelector} from './material-ai-native-input';

export const MATERIAL_AI_SCHEMA='xiaozhi.material-ai.v1' as const;
export const MATERIAL_AI_RESPONSE='xiaozhi.material-ai-response.v1' as const;
export const AI_MODELS=['deepseek-flash','qwen3-vl-plus','qwen3-vl-flash'] as const;
export type AiModel=typeof AI_MODELS[number];
export type AiSettings={revision:number;model:AiModel;configured:boolean;secureStorage:boolean};
export type AiSettingsInput={schemaVersion:typeof MATERIAL_AI_SCHEMA;revision:number;model:AiModel;apiKey?:string};
export type AiBatchInput={schemaVersion:typeof MATERIAL_AI_SCHEMA;resourceId:string;version:string;settingsRevision:number;
  start:number;count:number;maxCalls:number;images:boolean;cloudConsent:true;publicMaterial:true};
export type AiAction={schemaVersion:typeof MATERIAL_AI_SCHEMA;batchId:string;action:'pause'|'resume'|'retry_unknown';acceptDuplicateCharge?:true};
export type AiBatchView={id:string;resourceId:string;title:string;model:string;start:number;count:number;images:boolean;
  status:string;calls:number;maxCalls:number;complete:number;review:number;failed:number;unknown:number;pending:number;questions:number;
  units:{ordinal:number;status:string;error:string;questions:number}[]};
export type AiOrigin='source'|'ai_generated'|'missing';
export const AI_ISSUES=['uncertain_ocr','cross_page','requires_image','incomplete_question','answer_conflict'] as const;
export type AiIssue=typeof AI_ISSUES[number];
export type AiQuestion=ArchiveFields&{number:string;answerOrigin:AiOrigin;analysisOrigin:AiOrigin;requiresImage:boolean;issues:AiIssue[]};
export type AiResponse={schemaVersion:typeof MATERIAL_AI_RESPONSE;outcome:'questions'|'no_questions'|'needs_review';questions:AiQuestion[]};
export type AiUnitInput={sources:MaterialSource[];text:string;page?:number;visualRisk:boolean;stamp:string;native?:AiNativeSelector};
const exact=(v:unknown,keys:string[],optional:string[]=[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&keys.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>keys.includes(k)||optional.includes(k));
const integer=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
export const aiBatchId=(v:unknown):v is string=>typeof v==='string'&&/^aibatch_[a-f0-9-]{36}$/i.test(v);
export function validAiSettings(v:unknown):v is AiSettingsInput{
  return exact(v,['schemaVersion','revision','model'],['apiKey'])&&v.schemaVersion===MATERIAL_AI_SCHEMA&&integer(v.revision,0,Number.MAX_SAFE_INTEGER-1)&&AI_MODELS.includes(v.model as AiModel)
    &&(v.apiKey===undefined||typeof v.apiKey==='string'&&/^[\x21-\x7e]{8,4096}$/.test(v.apiKey));
}
export function validAiBatch(v:unknown):v is AiBatchInput{
  return exact(v,['schemaVersion','resourceId','version','settingsRevision','start','count','maxCalls','images','cloudConsent','publicMaterial'])&&v.schemaVersion===MATERIAL_AI_SCHEMA
    &&materialId(v.resourceId)&&typeof v.version==='string'&&/^[a-f0-9]{64}$/.test(v.version)&&integer(v.settingsRevision,1,Number.MAX_SAFE_INTEGER-1)
    &&integer(v.start,1,10000000)&&integer(v.count,1,100)&&integer(v.maxCalls,2,400)&&v.maxCalls>=Number(v.count)*2&&typeof v.images==='boolean'&&v.cloudConsent===true&&v.publicMaterial===true;
}
export function validAiAction(v:unknown):v is AiAction{
  return exact(v,['schemaVersion','batchId','action'],['acceptDuplicateCharge'])&&v.schemaVersion===MATERIAL_AI_SCHEMA&&aiBatchId(v.batchId)
    &&['pause','resume','retry_unknown'].includes(String(v.action))&&(v.action==='retry_unknown'?v.acceptDuplicateCharge===true:v.acceptDuplicateCharge===undefined);
}
export function parseAiResponse(raw:string):AiResponse{
  if(BufferFreeBytes(raw)>128*1024)throw new Error('invalid_response');
  let v:unknown;try{v=JSON.parse(raw);}catch{throw new Error('invalid_response');}
  if(!exact(v,['schemaVersion','outcome','questions'])||v.schemaVersion!==MATERIAL_AI_RESPONSE||!['questions','no_questions','needs_review'].includes(String(v.outcome))
    ||!Array.isArray(v.questions)||v.questions.length>20||(v.outcome==='questions'?!v.questions.length:v.outcome==='no_questions'&&v.questions.length!==0))throw new Error('invalid_response');
  const ids=new Set<string>();
  for(const q of v.questions){
    if(!exact(q,['number','stem','answer','analysis','subject','grade','knowledgePoint','questionType','difficulty','answerOrigin','analysisOrigin','requiresImage','issues'])
      ||typeof q.number!=='string'||!/^\d{1,5}$/.test(q.number)||ids.has(q.number))throw new Error('invalid_response');
    ids.add(q.number);
    for(const field of ['stem','answer','analysis','subject','grade','knowledgePoint','questionType']){
      const t=q[field];if(typeof t!=='string'||t!==t.trim()||t.length>(['stem','answer','analysis'].includes(field)?12000:128)||/[\x00]/.test(t)||field==='stem'&&!t.length)throw new Error('invalid_response');
    }
    if(!['easy','medium','hard'].includes(String(q.difficulty))||typeof q.requiresImage!=='boolean'||!Array.isArray(q.issues)||q.issues.length>5||new Set(q.issues).size!==q.issues.length||!q.issues.every(i=>AI_ISSUES.includes(i))
      ||!['source','ai_generated','missing'].includes(String(q.answerOrigin))||!['source','ai_generated','missing'].includes(String(q.analysisOrigin))
      ||(q.answerOrigin==='missing')!==(q.answer==='')||(q.analysisOrigin==='missing')!==(q.analysis===''))throw new Error('invalid_response');
  }
  return v as AiResponse;
}
const BufferFreeBytes=(s:string)=>new TextEncoder().encode(s).byteLength;
