import {plainStudentInput} from './student-context';
import {validOriginalDraft,type OriginalQuestionDraft} from './original-question-review';
import {questionToolRegions,type OriginalMultiRegion} from './original-multi-review';
import {validQuestionTranscription,type QuestionTranscription} from './question-projection';

export const ORIGINAL_BATCH_TOOL='education_propose_original_questions';
export const ORIGINAL_BATCH_MAX=12;
export type OriginalBatchBinding={rootCallId:string;digest:string;index:number;total:number};
export type OriginalBatchPosition={id:string;index:number;total:number;collectionId?:string;stagedAt?:string;rootCallId?:string};
export type OriginalBatchCandidate={draft:OriginalQuestionDraft;regions:OriginalMultiRegion[];transcription?:QuestionTranscription};
const fields=['title','subject','grade','knowledgePoint','questionType','difficulty','stem'] as const;
export function validOriginalBatchBinding(value:unknown):value is OriginalBatchBinding{
 return plainStudentInput(value,['rootCallId','digest','index','total'])&&Reflect.ownKeys(value).length===4&&typeof value.rootCallId==='string'&&value.rootCallId.length>0&&value.rootCallId.length<=128&&typeof value.digest==='string'&&/^[a-f0-9]{64}$/.test(value.digest)&&Number.isSafeInteger(value.total)&&(value.total as number)>=1&&(value.total as number)<=ORIGINAL_BATCH_MAX&&Number.isSafeInteger(value.index)&&(value.index as number)>=0&&(value.index as number)<(value.total as number);
}
/** Normalize every candidate before staging any images/approval rows. No model coverage or answers. */
export function originalBatchCandidates(raw:unknown,version:string):{resourceId:string;questions:OriginalBatchCandidate[]}{
 if(!plainStudentInput(raw,['resourceId','questions'])||Reflect.ownKeys(raw).length!==2||typeof raw.resourceId!=='string'||!Array.isArray(raw.questions)||Object.getPrototypeOf(raw.questions)!==Array.prototype||raw.questions.length<1||raw.questions.length>ORIGINAL_BATCH_MAX||Reflect.ownKeys(raw.questions).length!==raw.questions.length+1)throw new Error('invalid_input');
 const descriptors=Object.getOwnPropertyDescriptors(raw.questions);
 for(let index=0;index<raw.questions.length;index++){const d=descriptors[index];if(!d||!('value'in d)||!d.enumerable)throw new Error('invalid_input');}
 const resourceId=raw.resourceId,seen=new Set<string>();
 const questions=raw.questions.map(q=>{
  if(!plainStudentInput(q,[...fields,'page','box','regions','transcription']))throw new Error('invalid_input');
  const draft={...Object.fromEntries(fields.map(f=>[f,q[f]])),answer:'',analysis:''};if(!validOriginalDraft(draft)||q.regions!==undefined&&(q.page!==undefined||q.box!==undefined)||q.transcription!==undefined&&!validQuestionTranscription(q.transcription,draft.stem))throw new Error('invalid_input');
  const regions=questionToolRegions(q.regions??[{page:q.page,box:q.box}],resourceId,version),key=draft.stem.trim().replace(/\s+/g,' ');
  if(seen.has(key))throw new Error('invalid_input');seen.add(key);
  return {draft,regions,...(q.transcription!==undefined?{transcription:q.transcription as QuestionTranscription}:{})};
 });
 if(new TextEncoder().encode(JSON.stringify(questions)).length>192*1024)throw new Error('invalid_input');
 return {resourceId,questions};
}

/** Same tool, additive phases; legacy inputs retain the original wait behavior. */
export function originalBatchRequest(raw:unknown){
 if(!plainStudentInput(raw,['resourceId','questions','action'])||typeof raw.resourceId!=='string'||!raw.resourceId.trim()||raw.resourceId.length>160||raw.action!==undefined&&!['stage','review'].includes(raw.action as string))throw new Error('invalid_input');
 if(raw.action==='review'){
  if(Reflect.ownKeys(raw).length!==2||raw.questions!==undefined)throw new Error('invalid_input');
  return{action:'review' as const,resourceId:raw.resourceId};
 }
 const candidates=originalBatchCandidates({resourceId:raw.resourceId,questions:raw.questions},'0'.repeat(64));
 return{action:raw.action==='stage'?'stage' as const:'wait' as const,...candidates};
}
