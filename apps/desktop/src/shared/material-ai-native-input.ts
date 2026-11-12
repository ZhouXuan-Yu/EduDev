import {NATIVE_FIELD_REVIEW} from './material-ai-native-review';
import {validWordProofImageQuery,type WordProofBase} from './material-word-proof';

/** Private durable unit selector. Word ordinal is independent of the batch ordinal. */
export const MATERIAL_AI_NATIVE_INPUT='xiaozhi.material-ai-native-input.v1' as const;
export type AiNativeSelector={schemaVersion:typeof MATERIAL_AI_NATIVE_INPUT;base:WordProofBase;sourceDigest:string;reviewPolicy?:typeof NATIVE_FIELD_REVIEW};
export function validAiNativeSelector(value:unknown):value is AiNativeSelector{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return Object.keys(v).sort().join(',')===(Object.hasOwn(v,'reviewPolicy')?'base,reviewPolicy,schemaVersion,sourceDigest':'base,schemaVersion,sourceDigest')&&(!Object.hasOwn(v,'reviewPolicy')||v.reviewPolicy===NATIVE_FIELD_REVIEW)&&v.schemaVersion===MATERIAL_AI_NATIVE_INPUT
  &&!!v.base&&typeof v.base==='object'&&!Array.isArray(v.base)
  &&Object.keys(v.base).sort().join(',')==='documentSha,ordinal,resourceId,schemaVersion,version'
  &&validWordProofImageQuery({...v.base,proofId:v.sourceDigest,role:'question',index:0});
}
