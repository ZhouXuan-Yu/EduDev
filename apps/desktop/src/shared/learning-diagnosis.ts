import {plainStudentInput} from './student-context';
import {trainingArray} from './training-plan';
import {savedPracticeResult} from './practice-result';

export const LEARNING_DIAGNOSIS_SCHEMA='xiaozhi.learning-diagnosis.v1' as const;
export const DIAGNOSIS_CATEGORIES={concept:'概念理解',calculation:'计算过程',reading:'读题或抄写',method:'方法选择',insufficient:'证据不足，需核对',none:'本次未见错误'} as const;
export type LearningDiagnosis={schemaVersion:typeof LEARNING_DIAGNOSIS_SCHEMA;category:keyof typeof DIAGNOSIS_CATEGORIES;evidence:{answerNumber:number;fromLine:number;toLine:number}[];interpretation:string;intervention:string};
export type DiagnosisAnswer={number:number;lines:string[]};
const text=(v:unknown,max:number)=>typeof v==='string'&&Boolean(v.trim())&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
export function validLearningDiagnosis(v:unknown):v is LearningDiagnosis{
 if(!plainStudentInput(v,['schemaVersion','category','evidence','interpretation','intervention'])||Object.keys(v).length!==5||v.schemaVersion!==LEARNING_DIAGNOSIS_SCHEMA||typeof v.category!=='string'||!Object.hasOwn(DIAGNOSIS_CATEGORIES,v.category)||!text(v.interpretation,1000)||!text(v.intervention,1000)||!trainingArray(v.evidence)||v.evidence.length>3||v.category!=='insufficient'&&!v.evidence.length)return false;
 const seen=new Set<string>();
 return v.evidence.every(e=>{
  if(!plainStudentInput(e,['answerNumber','fromLine','toLine'])||Object.keys(e).length!==3||!Number.isSafeInteger(e.answerNumber)||Number(e.answerNumber)<1||Number(e.answerNumber)>8||!Number.isSafeInteger(e.fromLine)||Number(e.fromLine)<1||Number(e.fromLine)>200||!Number.isSafeInteger(e.toLine)||Number(e.toLine)<Number(e.fromLine)||Number(e.toLine)-Number(e.fromLine)>=3||Number(e.toLine)>200)return false;
  const key=`${e.answerNumber}:${e.fromLine}:${e.toLine}`;if(seen.has(key))return false;seen.add(key);return true;
 });
}
/** Original saved answers only. Line numbers include blank lines; expected answers and notes are never student work. */
export function diagnosisAnswers(content:string):DiagnosisAnswer[]{
 let meta:Record<string,unknown>;try{meta=JSON.parse(content);}catch{return[];}
 if(!meta||typeof meta!=='object'||Array.isArray(meta))return[];
 const practice=savedPracticeResult(meta.practice);
 const answers=practice?practice.answers.map(a=>({number:a.index+1,answer:a.answer})):[{number:1,answer:typeof meta.actualAnswer==='string'?meta.actualAnswer:meta.userAnswer}];
 return answers.filter((a):a is {number:number;answer:string}=>typeof a.answer==='string'&&a.answer.length<=8000&&Boolean(a.answer.trim())).map(a=>({number:a.number,lines:a.answer.replace(/\r\n?/g,'\n').split('\n').slice(0,200)}));
}
export function diagnosisEvidence(diagnosis:LearningDiagnosis,content:string){
 const answers=diagnosisAnswers(content);
 return diagnosis.evidence.map(e=>{
  const answer=answers.find(a=>a.number===e.answerNumber),lines=answer?.lines.slice(e.fromLine-1,e.toLine),quote=lines?.join('\n');
  return{...e,quote:answer&&e.toLine<=answer.lines.length&&quote?.trim()&&quote.length<=1200?quote:null};
 });
}
export function diagnosisFitsSource(diagnosis:LearningDiagnosis,content:string){return validLearningDiagnosis(diagnosis)&&diagnosisEvidence(diagnosis,content).every(e=>e.quote!==null);}
export const learningDiagnosisParameters={type:'object',additionalProperties:false,required:['schemaVersion','category','evidence','interpretation','intervention'],properties:{schemaVersion:{type:'string',const:LEARNING_DIAGNOSIS_SCHEMA},category:{type:'string',enum:Object.keys(DIAGNOSIS_CATEGORIES)},evidence:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['answerNumber','fromLine','toLine'],properties:{answerNumber:{type:'integer',minimum:1,maximum:8},fromLine:{type:'integer',minimum:1,maximum:200},toLine:{type:'integer',minimum:1,maximum:200}}}},interpretation:{type:'string',minLength:1,maxLength:1000},intervention:{type:'string',minLength:1,maxLength:1000}},description:'初步错因与针对干预，不是人格或掌握结论。evidence引用本次sourceEvidence.answerEvidence真实作答编号和1起始行号，每段最多3行/1200字，最多3段；不填写引文，宿主从原作答提取。concept/calculation/reading/method/none至少一段，证据不足用insufficient，可为空。只有result=correct用none；其余不能none。'} as const;
