import type {QuestionBankItem} from './contracts';
import {plainStudentInput} from './student-context';
import {validQuestionProjection,type QuestionProjection} from './question-projection';
import {validQuestionDocument,QUESTION_DOCUMENT_COMPLETE_SCHEMA} from './question-document';
export const NATIVE_QUESTION_SCHEMA='xiaozhi.ai-native-question.v1' as const;
export const NATIVE_QUESTION_MAX_BYTES=96*1024;
export const NATIVE_QUESTION_ROLES=['question','answer','analysis'] as const;
export type NativeQuestionRole=typeof NATIVE_QUESTION_ROLES[number];
export type NativeQuestionFigure={blockId:string;assetId:string;sha256:string;width:1240;height:number;bytes:number};
export type NativeQuestionBody={text:string;origin:'source'|'ai_generated'|'teacher'|'missing';figures:NativeQuestionFigure[]};
/** AI transcription and current publishable role images. Original source evidence lives in its own ledger. */
export type NativeQuestionDocument={schemaVersion:typeof NATIVE_QUESTION_SCHEMA;
 source:{kind:'word-native.v1';resourceId:string;resourceVersion:string;documentSha:string;ordinal:number;sourceDigest:string};
 projection:QuestionProjection;roles:Record<NativeQuestionRole,NativeQuestionBody>};
const exact=(v:unknown,keys:string[]):v is Record<string,unknown>=>plainStudentInput(v,keys)&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>Object.getOwnPropertyDescriptor(v,k)?.enumerable);
const sha=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const identifier=(v:unknown,prefix:string)=>typeof v==='string'&&new RegExp('^'+prefix+'_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$').test(v);
const integer=(v:unknown,min:number,max:number):v is number=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
function plainTree(value:unknown,seen=new Set<object>(),budget={nodes:0},depth=0):boolean{
 if(++budget.nodes>6000||depth>16)return false;
 if(value===null||typeof value==='boolean'||typeof value==='number')return typeof value!=='number'||Number.isFinite(value);
 if(typeof value==='string')return value.length<=NATIVE_QUESTION_MAX_BYTES&&!value.includes('\0');
 if(!value||typeof value!=='object'||seen.has(value))return false;
 const array=Array.isArray(value),prototype=Object.getPrototypeOf(value),descriptors=Object.getOwnPropertyDescriptors(value),keys=Reflect.ownKeys(descriptors);
 if(array?prototype!==Array.prototype||value.length>6000||keys.length!==value.length+1:![Object.prototype,null].includes(prototype))return false;
 seen.add(value);
 for(const key of keys){if(array&&key==='length')continue;if(typeof key!=='string'||array&&!/^(0|[1-9][0-9]*)$/.test(key))return false;const d=descriptors[key];if(!('value'in d)||!d.enumerable||!plainTree(d.value,seen,budget,depth+1))return false;}
 seen.delete(value);return true;
}
/** Structural validity never grants source/image authority or teacher confirmation. */
export function validNativeQuestionDocument(value:unknown):value is NativeQuestionDocument{
 try{
  if(!plainTree(value)||!exact(value,['schemaVersion','source','projection','roles'])||value.schemaVersion!==NATIVE_QUESTION_SCHEMA||!validQuestionProjection(value.projection))return false;
  const s=value.source;if(!exact(s,['kind','resourceId','resourceVersion','documentSha','ordinal','sourceDigest'])||s.kind!=='word-native.v1'||!identifier(s.resourceId,'resource')||!sha(s.resourceVersion)||!sha(s.documentSha)||!sha(s.sourceDigest)||!integer(s.ordinal,1,10000)||!exact(value.roles,[...NATIVE_QUESTION_ROLES]))return false;
  let count=0,bytes=0,pixels=0;const ids=new Set<string>();
  for(const role of NATIVE_QUESTION_ROLES){
   const body=value.roles[role];if(!exact(body,['text','origin','figures'])||typeof body.text!=='string'||body.text.length>12000||!Array.isArray(body.figures)||body.figures.length>8||!['source','ai_generated','teacher','missing'].includes(String(body.origin)))return false;
   if(role==='question'&&(body.origin!=='source'&&body.origin!=='teacher'||body.text!==value.projection.statement.text))return false;
   if(body.origin==='missing'?(body.text!==''||body.figures.length>0):!body.text.trim())return false;
   // A rewritten answer cannot silently retain an original answer screenshot.
   if(body.origin!=='source'&&body.figures.length)return false;
   for(const [index,f]of body.figures.entries()){
    if(!exact(f,['blockId','assetId','sha256','width','height','bytes'])||f.blockId!=='native_'+role+'_'+index||ids.has(f.blockId as string)||!identifier(f.assetId,'asset')||!sha(f.sha256)||f.width!==1240||!integer(f.height,1,1760)||!integer(f.bytes,57,4*1048576))return false;
    ids.add(f.blockId);count++;bytes+=f.bytes;pixels+=1240*f.height;
   }
  }
  return count<=8&&bytes<=16*1048576&&pixels<=32000000&&new TextEncoder().encode(JSON.stringify(value)).byteLength<=NATIVE_QUESTION_MAX_BYTES;
 }catch{return false;}
}
export function nativeQuestionComplete(value:NativeQuestionDocument):boolean{
 return validNativeQuestionDocument(value)&&validQuestionProjection(value.projection,true)&&NATIVE_QUESTION_ROLES.every(role=>value.roles[role].origin!=='missing'&&(value.roles[role].origin!=='source'||value.roles[role].figures.length>0));
}
export function nativeQuestionConflicts(q:Pick<QuestionBankItem,'stem'|'answer'|'analysis'>,document:NativeQuestionDocument):Array<'statement'|'answer'|'analysis'>{
 const conflicts:Array<'statement'|'answer'|'analysis'>=[];
 if(q.stem!==document.roles.question.text||q.stem!==document.projection.statement.text)conflicts.push('statement');
 for(const role of ['answer','analysis'] as const)if(q[role]!==document.roles[role].text)conflicts.push(role);
 return conflicts;
}
/** One presentation boundary. AI coverage remains AI coverage, including after a routine teacher edit. */
export function questionPresentation(q:QuestionBankItem){
 if(q.archive?.native){if(q.document||!validNativeQuestionDocument(q.archive.native)||nativeQuestionConflicts(q,q.archive.native).length)throw Error('question_fact_conflict');return{kind:'ai_native' as const,authority:'ai' as const,document:q.archive.native,projection:q.archive.native.projection};}
 if(q.document){if(!validQuestionDocument(q.document))throw Error('question_document_invalid');return{kind:'teacher_document' as const,authority:q.document.schemaVersion===QUESTION_DOCUMENT_COMPLETE_SCHEMA?'teacher' as const:'unreviewed' as const,document:q.document,projection:q.document.schemaVersion===QUESTION_DOCUMENT_COMPLETE_SCHEMA?q.document.context.projection:undefined};}
 return{kind:'text' as const,authority:'unreviewed' as const,document:undefined,projection:undefined};
}
