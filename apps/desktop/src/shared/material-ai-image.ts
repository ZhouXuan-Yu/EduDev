import {MATERIAL_AI_RESPONSE,parseAiResponse,type AiQuestion,type AiResponse} from './material-ai';
import {QUESTION_PROJECTION_FIELDS,validQuestionProjection,type QuestionProjection} from './question-projection';

export const MATERIAL_AI_IMAGE_RESPONSE='xiaozhi.material-ai-image-response.v1' as const;
export type AiImageQuestion=AiQuestion&{projection:QuestionProjection};
export type AiImageResponse={schemaVersion:typeof MATERIAL_AI_IMAGE_RESPONSE;outcome:AiResponse['outcome'];questions:AiImageQuestion[]};
export type AiBatchResponse=AiResponse|AiImageResponse;

/** Older durable batches retain their strict text schema; image coverage is never inferred. */
export function parseAiBatchResponse(raw:string):AiBatchResponse{
 try{
 if(new TextEncoder().encode(raw).byteLength>128*1024)throw Error('invalid_response');
 let value;try{value=JSON.parse(raw);}catch{throw Error('invalid_response');}
 if(value?.schemaVersion!==MATERIAL_AI_IMAGE_RESPONSE)return parseAiResponse(raw);
 if(Object.keys(value).sort().join(',')!=='outcome,questions,schemaVersion'||!Array.isArray(value.questions)||value.questions.length>20)throw Error('invalid_response');
 const scalar=value.questions.map((q:AiImageQuestion)=>{
  const {projection,...fields}=q;
  if(!validQuestionProjection(projection)||projection.statement.text!==q.stem)throw Error('invalid_response');
  return fields;
 });
 parseAiResponse(JSON.stringify({schemaVersion:MATERIAL_AI_RESPONSE,outcome:value.outcome,questions:scalar}));
 return value as AiImageResponse;
 }catch{throw Error('invalid_response');}
}
// Compatibility normalization destroys mathematical meaning (x² -> x2, y₁ -> y1).
// Keep word/number boundaries (1 2 != 12, x 2 != x2), while accepting layout around operators.
export const aiTextSignature=(s:string)=>s.normalize('NFC').replace(/\s+/gu,' ').replace(/(?<=[^\p{L}\p{N}]) | (?=[^\p{L}\p{N}])|^ | $/gu,'');
/** Known parent numbering is layout, never a free-form numeric prefix or decimal. */
export function questionNumberPrefix(stem:string,number:string){
 if(!/^\d{1,5}$/.test(number))return null;
 return new RegExp('^(?:第'+number+'题[ \\t]*[:：]?[ \\t]*|'+number+'[.、．](?!\\d)[ \\t]*)').exec(stem);
}
const normalized=aiTextSignature;
const questionTypes=new Set(['填空','选择','解答','计算','判断','证明','作图','实验','综合']);
function typeSignature(value:string){
 const text=value.normalize('NFC').replace(/\s/g,''),parts=text.split(/[/、,，]/).map(p=>p.replace(/题$/,''));
 // Only a closed vocabulary of classification labels; never normalize content, unknown labels or order.
 return parts.length>0&&parts.every(p=>questionTypes.has(p))?'known:'+JSON.stringify(parts):'raw:'+text;
}
function signature(q:AiImageQuestion){
 return JSON.stringify([
  q.number,...(['stem','answer','analysis','subject','grade','knowledgePoint'] as const).map(k=>normalized(q[k])),typeSignature(q.questionType),
  q.difficulty,q.answerOrigin,q.analysisOrigin,q.requiresImage,q.issues,
  ...QUESTION_PROJECTION_FIELDS.map(k=>[q.projection[k].state,normalized(q.projection[k].text)])
 ]);
}
/** An AI transcription-consistency receipt, never independent answer verification or a teacher signature. */
export function imageTextEvidence(first:AiBatchResponse,final:AiBatchResponse,number:string,imageSha:string,sourceStem=''):AiImageQuestion|undefined{
 if(!/^[a-f0-9]{64}$/.test(imageSha)||first.schemaVersion!==MATERIAL_AI_IMAGE_RESPONSE||final.schemaVersion!==MATERIAL_AI_IMAGE_RESPONSE
  ||first.outcome!=='questions'||final.outcome!=='questions'||first.questions.length!==final.questions.length)return;
 const a=first.questions.find(q=>q.number===number),b=final.questions.find(q=>q.number===number);
 if(!a||!b||a.requiresImage||b.requiresImage||a.issues.length||b.issues.length||!validQuestionProjection(a.projection,true)||!validQuestionProjection(b.projection,true)
  ||a.projection.figures.state!=='not_applicable'||b.projection.figures.state!=='not_applicable'
  ||/如图|下图|图中|见图|如下表|下表|!\[|<\s*(?:img|svg)/i.test(sourceStem+'\n'+b.stem)||signature(a)!==signature(b))return;
 const text=(sourceStem+'\n'+b.stem).normalize('NFKC');
 if(/选涂|选填|(?:^|\n)\s*[A-H][.、:：)]/.test(text)&&b.projection.choices.state!=='provided')return;
 const parts=[...text.matchAll(/\((\d{1,3})\)/g)].map(m=>m[1]);
 if(parts.length&&(b.projection.subquestions.state!=='provided'||parts.some(number=>!b.projection.subquestions.text.normalize('NFKC').includes('('+number+')'))))return;
 return b;
}
