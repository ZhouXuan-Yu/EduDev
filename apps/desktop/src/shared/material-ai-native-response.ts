import {MATERIAL_AI_RESPONSE,parseAiResponse,type AiQuestion} from './material-ai';
import {validQuestionProjection,type QuestionProjection} from './question-projection';
export const NATIVE_AI_RESPONSE='xiaozhi.material-ai-native-response.v1' as const;
export const NATIVE_PROJECTION_INSTRUCTION='projection的六个字段必须各自是含state和text的对象，不能写成字符串。结构示例 '+JSON.stringify({statement:{state:'provided',text:'与stem完全相同的完整原题文字'},formulas:{state:'not_applicable',text:''},tables:{state:'not_applicable',text:''},figures:{state:'provided',text:'按原图逐项转录实际图形及标注'},choices:{state:'not_applicable',text:''},subquestions:{state:'not_applicable',text:''}} satisfies QuestionProjection)+'。示例只说明字段结构，必须根据本题实际内容分别填写；无法读清的要素使用missing并保留待核。';
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
