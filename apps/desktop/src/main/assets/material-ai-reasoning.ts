import type {AiPagePrompt} from '../../shared/material-ai-page';
import {highMaterialInference} from '../../shared/material-ai-inference';
import {applyThinkingPayload} from '../xiaozhi-agent/answer-quality';

/** Reuse the production DeepSeek adapter without inheriting mutable chat preferences. */
export function materialInferencePayload(payload:Record<string,unknown>,prompt?:AiPagePrompt){
 if(!highMaterialInference(prompt))return payload;
 const {temperature:_,...supported}=payload;
 return applyThinkingPayload(supported,{requested:'high',effective:'high',scope:'global',thinkingType:'enabled',effort:'high',maxOutputTokens:32768,mode:'deep'});
}
export const materialInferenceLimits=(prompt?:AiPagePrompt)=>highMaterialInference(prompt)?{timeoutMs:300000,responseBytes:1048576}:{timeoutMs:120000,responseBytes:262144};
