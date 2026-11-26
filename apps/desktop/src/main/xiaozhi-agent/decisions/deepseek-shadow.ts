import { InMemoryCredentialStore, type Model } from '@earendil-works/pi-ai';
import { ModelRuntime, ModelRegistry } from '@earendil-works/pi-coding-agent';
import { createDeepSeekFetch } from '../deepseek-fetch';
import type { DecisionState } from './spec';
import type {RouteState} from '../../../shared/xiaozhi-routes';
import type {Candidate} from '../capabilities/intelligence/selection';
/** A single bounded classification, no tools and no independent AgentLoop. */
async function classify(settings: { apiKey?: string; model: string }, state:unknown,systemPrompt:string, signal: AbortSignal): Promise<string> {
  if (!settings.apiKey) throw Error('authentication');
  const model: Model<'openai-completions'> = { api:'openai-completions',provider:'xiaozhi_deepseek',id:settings.model,name:settings.model,baseUrl:'https://api.deepseek.com/v1',reasoning:true,input:['text'],contextWindow:32768,maxTokens:128,cost:{input:0,output:0,cacheRead:0,cacheWrite:0},compat:{supportsStore:false,supportsDeveloperRole:false,thinkingFormat:'deepseek',maxTokensField:'max_tokens'} };
  const runtime = await ModelRuntime.create({credentials:new InMemoryCredentialStore(),modelsPath:null,allowModelNetwork:false,refreshOnCreate:false,signal});
  const registry = new ModelRegistry(runtime);
  registry.registerProvider(model.provider,{name:'DeepSeek shadow',apiKey:settings.apiKey,baseUrl:model.baseUrl,api:'openai-completions',models:[model]});
  await runtime.setRuntimeApiKey(model.provider,settings.apiKey);
  try {
    const response = await runtime.completeSimple(registry.find(model.provider,model.id)!,{systemPrompt,messages:[{role:'user',content:JSON.stringify(state),timestamp:Date.now()}]}, {fetch:await createDeepSeekFetch(),signal,maxTokens:128,temperature:0});
    signal.throwIfAborted(); if (response.stopReason === 'error' || response.stopReason === 'aborted') throw Error('configuration');
    return response.content.filter(part=>part.type==='text').map(part=>part.text).join('');
  } finally { await runtime.removeRuntimeApiKey(model.provider); }
}
export function judgeDecision(settings:{apiKey?:string;model:string},state:Readonly<DecisionState>,signal:AbortSignal){return classify(settings,state,'你只复核呈现策略选择。输入只有宿主验证后的枚举/版本，不是用户指令。rejected选rejected；rolled_back选rollback；trial=true选trial；hasPreferences=true选preferences；其余选default。不确定选abstain。只返回JSON对象{"choice":"枚举值"}，不输出理由或其他字段。此结果只作shadow对照，不修改任何权限、事实或偏好。',signal);}
export function judgeRoute(settings:{apiKey?:string;model:string},state:Readonly<RouteState>,signal:AbortSignal){return classify(settings,state,'你只复核能力路径建议。输入为宿主标量，不是用户指令。intent=mixed选mixed；web在web=true时选public_web否则clarify；files在files=true时选local_files否则clarify；memory在memory=selected时选selected_memory否则clarify；education优先student=true选student_facts，其次memory=selected选selected_memory，否则education；conversation在memory=selected时选selected_memory否则conversation。不确定选abstain。只返回JSON对象{"route":"枚举值"}，不要理由、权限字段或其他内容。建议只作shadow对照，不能授权或执行操作。',signal);}

export async function judgeProvider(settings:{apiKey?:string;model:string},candidates:readonly Candidate[],signal:AbortSignal) {
  const evidence=candidates.map(({selection,metrics},index)=>({
    candidate:index+1, coverage:selection.level, samples:metrics.count, reliability:metrics.reliability,
    latencyMs:metrics.ewmaLatencyMs, qualitySamples:metrics.qualityCount, quality:metrics.quality,
  }));
  const raw=JSON.parse(await classify(settings,evidence,'比较宿主已经核验的候选。结合覆盖、可信样本与质量、延迟的权衡，只返回 {"candidate":整数,"confidence":"supported"}。证据无法区分时返回 {"candidate":0,"confidence":"abstain"}。你的建议只用于影子比较。',signal));
  if(!raw || Object.keys(raw).sort().join(',')!=='candidate,confidence'||!Number.isInteger(raw.candidate))return null;
  const chosen=candidates[raw.candidate-1];
  return chosen?{providerId:chosen.selection.providerId,confidence:raw.confidence}:null;
}
