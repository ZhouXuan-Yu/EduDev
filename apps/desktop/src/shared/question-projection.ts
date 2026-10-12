import {plainStudentInput} from './student-context';

export const QUESTION_PROJECTION_SCHEMA='xiaozhi.question-projection.v1' as const;
export const QUESTION_PROJECTION_FIELDS=['statement','formulas','tables','figures','choices','subquestions'] as const;
export type QuestionProjectionField=typeof QUESTION_PROJECTION_FIELDS[number];
export type QuestionProjectionPart={state:'missing'|'provided'|'not_applicable';text:string};
export type QuestionProjection=Record<QuestionProjectionField,QuestionProjectionPart>;
export const QUESTION_PROJECTION_LABELS:Record<QuestionProjectionField,string>={statement:'全部条件与所求',formulas:'公式与符号含义',tables:'表格数据与单位',figures:'图形关系与标注',choices:'全部选项',subquestions:'全部小问'};
export const QUESTION_TRANSCRIPTION_SCHEMA='xiaozhi.question-transcription.v1' as const;
export type QuestionTranscription={schemaVersion:typeof QUESTION_TRANSCRIPTION_SCHEMA}&Record<Exclude<QuestionProjectionField,'statement'>,string>;
/** Model text is a candidate only. It cannot supply teacher coverage flags. */
export function validQuestionTranscription(value:unknown,statement:string):value is QuestionTranscription{
 try{
  const fields=QUESTION_PROJECTION_FIELDS.filter(k=>k!=='statement');
  if(!plainStudentInput(value,['schemaVersion',...fields])||Reflect.ownKeys(value).length!==6||value.schemaVersion!==QUESTION_TRANSCRIPTION_SCHEMA)return false;
  if(fields.some(k=>typeof value[k]!=='string'||value[k].length>4000||value[k].includes('\0')||!Object.getOwnPropertyDescriptor(value,k)?.enumerable))return false;
  return new TextEncoder().encode(statement+fields.map(k=>value[k]).join('')).byteLength<=24000;
 }catch{return false;}
}
export function candidateQuestionProjection(statement:string,value:QuestionTranscription):QuestionProjection{
 if(!validQuestionTranscription(value,statement))throw new Error('invalid_input');
 return Object.fromEntries(QUESTION_PROJECTION_FIELDS.map(k=>[k,{state:'missing',text:k==='statement'?statement:value[k]}])) as QuestionProjection;
}
/** Teacher transcription completeness; never a mathematical correctness assertion. */
export function validQuestionProjection(value:unknown,complete=false):value is QuestionProjection{
 try{
  if(!plainStudentInput(value,[...QUESTION_PROJECTION_FIELDS])||Reflect.ownKeys(value).length!==6||QUESTION_PROJECTION_FIELDS.some(k=>!Object.getOwnPropertyDescriptor(value,k)?.enumerable))return false;
  let bytes=0;
  for(const field of QUESTION_PROJECTION_FIELDS){
   const p=value[field];
   if(!plainStudentInput(p,['state','text'])||Reflect.ownKeys(p).length!==2||['state','text'].some(k=>!Object.getOwnPropertyDescriptor(p,k)?.enumerable)||typeof p.text!=='string'||p.text.length>(field==='statement'?12000:4000)||p.text.includes('\0'))return false;
   if(p.state==='not_applicable'){if(field==='statement'||p.text!=='')return false;}
   else if(p.state==='provided'){if(!p.text.trim())return false;}
   else if(p.state!=='missing'||complete)return false;
   bytes+=new TextEncoder().encode(p.text).byteLength;
  }
  return bytes<=24000;
 }catch{return false;}
}
export function emptyQuestionProjection(statement=''):QuestionProjection{
 return Object.fromEntries(QUESTION_PROJECTION_FIELDS.map(k=>[k,{state:'missing',text:k==='statement'?statement:''}])) as QuestionProjection;
}
/** A changed source range requires fresh coverage, while preserving the teacher's unsaved text. */
export function resetQuestionProjectionCoverage(value:QuestionProjection):QuestionProjection{
 return Object.fromEntries(QUESTION_PROJECTION_FIELDS.map(key=>[key,{state:'missing',text:value[key].text}])) as QuestionProjection;
}
