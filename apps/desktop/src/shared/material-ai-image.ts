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
const normalized=(s:string)=>s.normalize('NFKC').replace(/\s/g,'');
function signature(q:AiImageQuestion){
 return JSON.stringify([
  q.number,...(['stem','answer','analysis','subject','grade','knowledgePoint','questionType'] as const).map(k=>normalized(q[k])),
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
