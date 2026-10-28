import {MATERIAL_AI_RESPONSE,parseAiResponse,type AiQuestion} from './material-ai';
import {validQuestionProjection,type QuestionProjection} from './question-projection';
export const NATIVE_AI_RESPONSE='xiaozhi.material-ai-native-response.v1' as const;
export type NativeAiQuestion=AiQuestion&{projection:QuestionProjection};
export type NativeAiResponse={schemaVersion:typeof NATIVE_AI_RESPONSE;outcome:'questions'|'needs_review'|'no_questions';questions:NativeAiQuestion[]};
export function parseNativeAiResponse(raw:string):NativeAiResponse{
 try{
  if(new TextEncoder().encode(raw).byteLength>128*1024)throw Error();
  const v=JSON.parse(raw);if(!v||Object.keys(v).sort().join(',')!=='outcome,questions,schemaVersion'||v.schemaVersion!==NATIVE_AI_RESPONSE||!Array.isArray(v.questions)||v.questions.length>1)throw Error();
  const scalar=v.questions.map((q:NativeAiQuestion)=>{const {projection,...fields}=q;if(!validQuestionProjection(projection)||projection.statement.text!==q.stem)throw Error();return fields;});
  parseAiResponse(JSON.stringify({schemaVersion:MATERIAL_AI_RESPONSE,outcome:v.outcome,questions:scalar}));return v;
 }catch{throw Error('invalid_response');}
}
