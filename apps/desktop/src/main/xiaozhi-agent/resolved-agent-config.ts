import {readTeacherMemoryPolicy} from '../education/teacher-memory-policy';
import {createTeacherPreferenceState} from '../education/teacher-preference-state';
import type {ConfigObservation, ConfigSource, ResolvedAgentConfig, ResolvedAgentConfigResult, ResolvedConfigQuery, ResolvedPreferenceKey} from '../../shared/xiaozhi-resolved-config';
import {validSessionId} from './model-settings';
import {createXiaozhiSessionState,type Sql} from './session-state';
import {workbenchText} from './workbench-state';
import {readLegacyProviderSetting} from '../provider-credentials';

const defaultModel='deepseek-flash';
const validModel=(value:unknown):value is string=>typeof value==='string' && /^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/u.test(value);
const observed=<T>(value:T,source:ConfigSource,revision:number|string|null=null):ConfigObservation<T>=>({value,source,revision,status:'valid'});
const missing=<T>(status:Exclude<ConfigObservation<T>['status'],'valid'>,source:ConfigSource|null=null):ConfigObservation<T>=>({
  value:null,source,revision:null,status,
});
function validQuery(value:unknown):value is ResolvedConfigQuery|undefined {
  if(value===undefined)return true;
  if(!value || typeof value!=='object' || Array.isArray(value))return false;
  const query=value as ResolvedConfigQuery;
  return Object.keys(query).every(key=>key==='sessionId') && (query.sessionId===undefined || validSessionId(query.sessionId));
}
function classify(error:unknown) {
  const code = error && typeof error==='object' && 'code' in error ? error.code : undefined;
  return typeof code==='string' && code.startsWith('SQLITE_') ? 'unavailable' as const : 'invalid' as const;
}
async function check<T>(source:ConfigSource|null,read:()=>Promise<ConfigObservation<T>>) {
  try{return await read();}catch(error){return missing<T>(classify(error),source);}
}
const environment=()=>({model:process.env.DEEPSEEK_MODEL||defaultModel,keyConfigured:Boolean(process.env.DEEPSEEK_API_KEY)});
const displayText=(value:unknown,limit?:number)=>{
  const text=workbenchText(value,limit);
  return /(?:[a-z]:[\\/]|(?:^|\s)(?:\\\\|\/(?!\s))|file:\/\/)/iu.test(text) ? '' : text;
};

export function createResolvedAgentConfig(snapshot:<T>(read:(sql:Sql)=>Promise<T>)=>Promise<T>) {
  return async (input:unknown):Promise<ResolvedAgentConfigResult>=>{
    if(!validQuery(input))return {ok:false,error:'invalid_input'};
    try {
      const sessionId=input?.sessionId, env=environment();
      const value=await snapshot(async(sql):Promise<ResolvedAgentConfig>=>{
        const state=createXiaozhiSessionState(sql);
        const modelSettings=state.modelSettings;
        const [session]=sessionId
          ?await sql.all('SELECT title FROM ai_conversation_sessions WHERE id=? AND archived_at IS NULL',[sessionId]):[];
        if(sessionId&&!session)throw Error('permission_denied');
        const global=await check('global',async()=>observed(await modelSettings.configuration(),'global'));
        const legacy=async()=>{
          const record=await readLegacyProviderSetting(sql,'deepseek');
          if(record.invalid)throw Error('configuration');
          const stored=record.stored;
          if(stored.model!==undefined && typeof stored.model!=='string')throw Error('configuration');
          if(Object.hasOwn(stored,'sealedKey') && (typeof stored.sealedKey!=='string' || !stored.sealedKey || stored.sealedKey.length>16384))
            throw Error('configuration');
          if(stored.apiKey!==undefined && typeof stored.apiKey!=='string')throw Error('configuration');
          const credentialSource=Object.hasOwn(stored,'sealedKey') || typeof stored.apiKey==='string'
            || stored.legacyCredentialDisabled===true ? 'legacy_compat' : env.keyConfigured ? 'environment' : 'default';
          const credentialConfigured=Object.hasOwn(stored,'sealedKey') || (typeof stored.apiKey==='string'
            ?Boolean(stored.apiKey):stored.legacyCredentialDisabled!==true && env.keyConfigured);
          return {model:(typeof stored.model==='string'&&stored.model.trim())||env.model,updatedAt:record.updatedAt,
            credentialSource,credentialConfigured} as const;
        };
        let legacySetting:ReturnType<typeof legacy>|undefined;
        const readLegacy=()=>legacySetting??=legacy();
        const model=await check<string>(null,async()=>{
          if(!global.value)return missing(global.status==='unavailable'?'unavailable':'invalid','global');
          const binding=sessionId?await check('session_binding',async()=>{
            const value=await state.getBinding(sessionId);
            if(!value?.model)return missing<string>('not_applicable','session_binding');
            if(!validModel(value.model))return missing<string>('invalid','session_binding');
            const ledger=await state.modelSwitch.current(sessionId);
            return observed(value.model,'session_binding',ledger?.revision??null);
          }):undefined;
          if(binding?.status==='invalid'||binding?.status==='unavailable')return binding;
          const selection=sessionId?await check('session_selection',async()=>observed(await modelSettings.session(sessionId),'session_selection')):undefined;
          if(selection && !selection.value)return missing(selection.status==='unavailable'?'unavailable':'invalid','session_selection');
          if(binding?.value)return binding;
          if(selection?.value?.model)return observed(selection.value.model,'session_selection',selection.value.revision);
          if(global.value.defaultModel)return observed(global.value.defaultModel,'global',global.value.revision);
          return check('legacy_compat',async()=>{
            const previous=await readLegacy();
            if(!previous.updatedAt&&!previous.credentialConfigured)return observed(defaultModel,'default');
            if(!validModel(previous.model))return missing('invalid','legacy_compat');
            return observed(previous.model,'legacy_compat',previous.updatedAt||null);
          });
        });
        const credential=await check<boolean>('legacy_compat',async()=>{
          if(!global.value)return missing(global.status==='unavailable'?'unavailable':'invalid','global');
          if(global.value.sealedKey)return observed(true,'global',global.value.revision);
          const previous=await readLegacy();
          return observed(previous.credentialConfigured,previous.credentialSource,
            previous.credentialSource==='legacy_compat'?previous.updatedAt||null:null);
        });
        const thinking=await check<NonNullable<ResolvedAgentConfig['thinking']['value']>>(null,async()=>{
          const saved=await check('global',async()=>observed(await modelSettings.thinking(),'global'));
          if(!saved.value)return missing(saved.status==='unavailable'?'unavailable':'invalid','global');
          const sessionChoice=sessionId?await check('session_selection',async()=>observed(await modelSettings.thinking(sessionId),'session_selection')):undefined;
          if(sessionChoice&&!sessionChoice.value)return missing(sessionChoice.status==='unavailable'?'unavailable':'invalid','session_selection');
          if(sessionChoice?.value?.choice)return observed(sessionChoice.value.choice,'session_selection',sessionChoice.value.version);
          return observed(saved.value.choice??'auto',saved.value.version?'global':'default',saved.value.version||null);
        });
        const lastRun= sessionId? await check<NonNullable<ResolvedAgentConfig['lastRun']['value']>>('saved_run',async()=>{
          const value=await modelSettings.thinkingRun(sessionId);
          if(!value){
            const [present]=await sql.all('SELECT 1 FROM app_settings WHERE key=?',['xiaozhi.thinking-run.'+sessionId]);
            return missing(present?'invalid':'not_applicable','saved_run');
          }
          if(!/^[A-Za-z0-9_:.-]{1,160}$/u.test(value.runId))return missing('invalid','saved_run');
          const {runId,model,requested,effective}=value;
          return observed({runId,model,requested,effective},'saved_run');
        }):missing<NonNullable<ResolvedAgentConfig['lastRun']['value']>>('not_applicable');
        const policy=await check('teacher_profile',async()=>observed(await readTeacherMemoryPolicy(sql),'teacher_profile'));
        const teacher=policy.value?observed({...policy.value.profile,textbook:displayText(policy.value.profile.textbook)},
          'teacher_profile',policy.value.revision):missing<NonNullable<ResolvedAgentConfig['teacher']['value']>>(
          policy.status==='unavailable'?'unavailable':'invalid','teacher_profile');
        const preferences=await check<NonNullable<ResolvedAgentConfig['preferences']['value']>>('teacher_preferences',async()=>{
          const value=await createTeacherPreferenceState(sql).snapshot();
          if(!policy.value)return missing(policy.status==='unavailable'?'unavailable':'invalid','teacher_preferences');
          const keys=Object.keys(value.values) as ResolvedPreferenceKey[];
          const scopeCounts={relevant:0,profile:0,off:0};
          for(const key of keys)scopeCounts[policy.value.use[key]??'relevant']++;
          return observed({savedCount:keys.length,scopeCounts},'teacher_preferences',value.revision);
        });
        const memory=sessionId?await check('session_memory',async()=>{
          const scope=await state.memoryScope(sessionId);
          return observed({enabled:scope.enabled,selectedCount:scope.selections.length},'session_memory',scope.version);
        }):missing<NonNullable<ResolvedAgentConfig['memory']['value']>>('not_applicable');
        const permission=sessionId?await check('permission_profile',async()=>{
          const profile=await state.permissions.profile(sessionId);
          return observed(profile.mode,profile.updatedAt==='1970-01-01T00:00:00.000Z'?'default':'permission_profile',
            profile.updatedAt==='1970-01-01T00:00:00.000Z'?null:profile.revision);
        }):missing<NonNullable<ResolvedAgentConfig['permission']['value']>>('not_applicable');
        return {schemaVersion:1,observedAt:new Date().toISOString(),consistency:'snapshot',
          session:sessionId?{id:sessionId,title:displayText(session?.title)||'未命名会话'}:null,
          model,thinking,lastRun,teacher,memory,permission,credential:{...credential,verification:'not_checked'},
          preferences:{...preferences,application:!preferences.value?'unknown':preferences.value.savedCount>0 &&
            preferences.value.scopeCounts.off===preferences.value.savedCount?'disabled':'requires_task_context',
            temporary:'not_persisted',textbook:'reference_only'}};
      });
      const after=environment();
      if(env.model!==after.model || env.keyConfigured!==after.keyConfigured)value.consistency='stale';
      return {ok:true,value};
    }catch(error){
      return {ok:false,error:error instanceof Error && error.message==='permission_denied'?'permission_denied':'unavailable'};
    }
  };
}
