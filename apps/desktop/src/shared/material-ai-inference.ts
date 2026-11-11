import type {AiPagePrompt} from './material-ai-page';

/** Immutable per-unit provider budget; missing means the historical non-thinking request. */
export const MATERIAL_HIGH_INFERENCE='deepseek-high.v1' as const;
export const highMaterialInference=(prompt?:AiPagePrompt)=>prompt?.policy==='page-fragments.v3'&&prompt.inferencePolicy===MATERIAL_HIGH_INFERENCE;
/** New quality units freeze thinking into their prompt. Existing units keep their saved policy. */
export const useHighMaterialInference=(mode:string,setting:string|undefined)=>
 mode==='quality'?setting!=='0':mode==='legacy'&&setting==='1';
