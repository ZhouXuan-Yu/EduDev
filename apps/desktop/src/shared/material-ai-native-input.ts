import {isNativeFieldReview,type NativeFieldReviewPolicy} from './material-ai-native-review';
import {validWordProofImageQuery,type WordProofBase} from './material-word-proof';
import {MATERIAL_HIGH_INFERENCE} from './material-ai-inference';

/** Private durable unit selector. Word ordinal is independent of the batch ordinal. */
export const MATERIAL_AI_NATIVE_INPUT='xiaozhi.material-ai-native-input.v1' as const;
export type AiNativeSelector={schemaVersion:typeof MATERIAL_AI_NATIVE_INPUT;base:WordProofBase;sourceDigest:string;reviewPolicy?:NativeFieldReviewPolicy;inferencePolicy?:typeof MATERIAL_HIGH_INFERENCE};
export function validAiNativeSelector(value:unknown):value is AiNativeSelector{
 if(!value||typeof value!=='object'||Array.isArray(value))return false;
 const v=value as Record<string,unknown>;
 return ['base','schemaVersion','sourceDigest'].every(key=>Object.hasOwn(v,key))&&Object.keys(v).every(key=>['base','schemaVersion','sourceDigest','reviewPolicy','inferencePolicy'].includes(key))&&(!Object.hasOwn(v,'reviewPolicy')||isNativeFieldReview(v.reviewPolicy))&&(!Object.hasOwn(v,'inferencePolicy')||v.inferencePolicy===MATERIAL_HIGH_INFERENCE)&&v.schemaVersion===MATERIAL_AI_NATIVE_INPUT
  &&!!v.base&&typeof v.base==='object'&&!Array.isArray(v.base)
  &&Object.keys(v.base).sort().join(',')==='documentSha,ordinal,resourceId,schemaVersion,version'
  &&validWordProofImageQuery({...v.base,proofId:v.sourceDigest,role:'question',index:0});
}
