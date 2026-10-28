import type {NativeQuestionRole,NativeQuestionFigure} from './native-question';
export const NATIVE_IMAGE_SCHEMA='xiaozhi.native-question-image.v1' as const;
export type NativeQuestionImageQuery={schemaVersion:typeof NATIVE_IMAGE_SCHEMA;questionId:string;version:string;role:NativeQuestionRole;index:number};
export type NativeQuestionImage={figure:NativeQuestionFigure;dataUrl:string};
export type NativeQuestionOriginQuery={schemaVersion:typeof NATIVE_IMAGE_SCHEMA;questionId:string;version:string};
export function validNativeQuestionOriginQuery(value:unknown):value is NativeQuestionOriginQuery{if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).sort().join(',')!=='questionId,schemaVersion,version')return false;return validNativeQuestionImageQuery({...value,role:'question',index:0});}
export function validNativeQuestionImageQuery(value:unknown):value is NativeQuestionImageQuery{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;const v=value as NativeQuestionImageQuery;
 return Object.keys(v).sort().join(',')==='index,questionId,role,schemaVersion,version'&&v.schemaVersion===NATIVE_IMAGE_SCHEMA&&/^question_[a-f0-9-]{36}$/.test(v.questionId)&&/^[a-f0-9]{64}$/.test(v.version)&&['question','answer','analysis'].includes(v.role)&&Number.isSafeInteger(v.index)&&v.index>=0&&v.index<8;
}
