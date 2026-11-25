import {readLegacyProviderSetting} from '../provider-credentials';
import type {ConfigObservation,ConfigSource} from '../../shared/xiaozhi-resolved-config';
import type {ThinkingSetting} from '../../shared/xiaozhi-thinking';
import type {ProviderConfiguration} from './model-settings-state';
import type {Sql} from './session-state';

export const defaultDeepSeekModel='deepseek-flash';
export const deepSeekModelEnvironment=()=>({model:process.env.DEEPSEEK_MODEL||'',keyConfigured:Boolean(process.env.DEEPSEEK_API_KEY)});
const validModel=(value:unknown):value is string=>typeof value==='string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(value);
export const observed=<T>(value:T,source:ConfigSource,revision:number|string|null=null):ConfigObservation<T>=>({value,source,revision,status:'valid'});
export const missing=<T>(status:Exclude<ConfigObservation<T>['status'],'valid'>,source:ConfigSource|null=null):ConfigObservation<T>=>({value:null,source,revision:null,status});
export function classifyConfigError(error:unknown) {
  const code=error && typeof error==='object' && 'code' in error ? error.code : undefined;
  return typeof code==='string' && code.startsWith('SQLITE_') ? 'unavailable' as const : 'invalid' as const;
}

export function readLegacyDeepSeekSetting(sql:Pick<Sql,'all'>, env:ReturnType<typeof deepSeekModelEnvironment>) {
  return readLegacyProviderSetting(sql,'deepseek').then(setting=>describeLegacyDeepSeekSetting(setting,env));
}
export function describeLegacyDeepSeekSetting({stored,updatedAt,invalid}:Awaited<ReturnType<typeof readLegacyProviderSetting>>,env:ReturnType<typeof deepSeekModelEnvironment>) {
    const sealed=Object.hasOwn(stored,'sealedKey');
    const credentialConfigured=sealed || (typeof stored.apiKey==='string'
      ?Boolean(stored.apiKey):stored.legacyCredentialDisabled!==true && env.keyConfigured);
    const credentialSource=sealed || typeof stored.apiKey==='string' || stored.legacyCredentialDisabled===true
      ?'legacy_compat':env.keyConfigured?'environment':'default';
    const storedModel=typeof stored.model==='string'?stored.model.trim():'';
    return {storedModel,updatedAt,credentialConfigured,credentialSource,environmentModel:env.model,
      invalid:invalid || stored.model!==undefined && typeof stored.model!=='string' ||
        sealed && (typeof stored.sealedKey!=='string' || !stored.sealedKey || stored.sealedKey.length>16384) ||
        stored.apiKey!==undefined && typeof stored.apiKey!=='string'} as const;
}

export function resolveAgentModel(input:{configuration:ProviderConfiguration;
  binding?:{model:string;revision:number|null;failure?:ReturnType<typeof classifyConfigError>};
  selection?:{model?:string;revision:number};legacy?:Awaited<ReturnType<typeof readLegacyDeepSeekSetting>>}) {
  const {configuration,binding,selection,legacy}=input;
  if(binding?.model)return {runtimeValue:binding.model,observation:!binding.failure && validModel(binding.model)
    ?observed(binding.model,'session_binding',binding.revision):missing<string>(binding.failure??'invalid','session_binding')};
  if(selection?.model)return {runtimeValue:selection.model,observation:observed(selection.model,'session_selection',selection.revision)};
  if(configuration.defaultModel)return {runtimeValue:configuration.defaultModel,observation:observed(configuration.defaultModel,'global',configuration.revision)};
  const legacyApplies=legacy && (legacy.updatedAt || legacy.credentialConfigured);
  const runtimeValue=legacyApplies?(legacy.storedModel||legacy.environmentModel||defaultDeepSeekModel):defaultDeepSeekModel;
  if(legacy?.invalid)return {runtimeValue,observation:missing<string>('invalid','legacy_compat')};
  if(legacyApplies && legacy.storedModel)return {runtimeValue,observation:validModel(runtimeValue)
    ?observed(runtimeValue,'legacy_compat',legacy.updatedAt||null):missing<string>('invalid','legacy_compat')};
  if(legacyApplies && legacy.environmentModel)return {runtimeValue,observation:validModel(runtimeValue)
    ?observed(runtimeValue,'environment'):missing<string>('invalid','environment')};
  return {runtimeValue,observation:observed(runtimeValue,'default')};
}

export function resolveAgentThinking(global:ThinkingSetting, session?:ThinkingSetting) {
  return session?.choice
    ? {value:session.choice,source:'session_selection',revision:session.version,status:'valid'} as const
    : {value:global.choice??'auto',source:global.version?'global':'default',revision:global.version||null,status:'valid'} as const;
}
