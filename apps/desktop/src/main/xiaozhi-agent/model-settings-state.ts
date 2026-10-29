import type { Sql } from './session-state';
import type { XiaozhiWebPreferences } from '../../shared/xiaozhi-web';
import {validThinkingChoice,type ThinkingSetting,type ThinkingView} from '../../shared/xiaozhi-thinking';
const globalKey='xiaozhi.provider.v1';
const modelId=(value:unknown)=>typeof value==='string'&&/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(value);
export type ProviderConfiguration={schema:1;revision:number;defaultModel:string|null;sealedKey?:string};
export function createModelSettingsState(sql:Sql){
  async function read(key:string){const row=(await sql.all('SELECT value_json FROM app_settings WHERE key=?',[key]))[0];return row?String(row.value_json):undefined;}
  async function commit(key:string,previous:number,value:object){
    if(!sql.change)throw new Error('configuration');const encoded=JSON.stringify(value),time=new Date().toISOString();
    if(previous===0){const changed=await sql.change('INSERT OR IGNORE INTO app_settings(key,value_json,updated_at) VALUES(?,?,?)',[key,encoded,time]);if(changed===1)return;}
    if(await sql.change("UPDATE app_settings SET value_json=?,updated_at=? WHERE key=? AND json_extract(value_json,'$.schema')=1 AND json_extract(value_json,'$.revision')=?",[encoded,time,key,previous])!==1)throw new Error('conflict');
  }
  return {
    async thinking(id?:string):Promise<ThinkingSetting>{
      const raw=await read(`xiaozhi.thinking.${id||'default'}`);
      if(!raw)return {version:0,choice:id?null:'auto'};
      let value;try{value=JSON.parse(raw);}catch{throw Error('configuration');}
      if(!value||value.schema!==1||!Number.isSafeInteger(value.revision)||value.revision<1
        ||!(validThinkingChoice(value.choice)||id&&value.choice===null)||Object.keys(value).sort().join(',')!=='choice,revision,schema')throw Error('configuration');
      return {version:value.revision,choice:value.choice};
    },
    async saveThinking(id:string|undefined,expected:number,choice:ThinkingSetting['choice']){
      if((await this.thinking(id)).version!==expected)throw Error('conflict');
      await commit(`xiaozhi.thinking.${id||'default'}`,expected,{schema:1,revision:expected+1,choice});
    },
    async thinkingRun(id:string):Promise<ThinkingView['lastRun']>{
      const raw=await read(`xiaozhi.thinking-run.${id}`);if(!raw)return;
      let value;try{value=JSON.parse(raw);}catch{return;}
      if(!value||value.schema!==1||!validThinkingChoice(value.requested)||!validThinkingChoice(value.effective)
        ||!['session','global'].includes(value.scope)||!['enabled','disabled'].includes(value.thinkingType)
        ||!['low','high','max','none',undefined].includes(value.effort)||!['fast','standard','deep'].includes(value.mode)
        ||!Number.isSafeInteger(value.maxOutputTokens)||value.maxOutputTokens<1||!modelId(value.model)
        ||typeof value.runId!=='string'||value.runId.length>160
        ||![undefined,'capability_unknown','unsupported_choice'].includes(value.reason))return;
      return {requested:value.requested,effective:value.effective,scope:value.scope,thinkingType:value.thinkingType,
        ...(value.effort?{effort:value.effort}:{}),maxOutputTokens:value.maxOutputTokens,mode:value.mode,runId:value.runId,model:value.model,...(value.reason?{reason:value.reason}:{})};
    },
    async saveThinkingRun(id:string,value:NonNullable<ThinkingView['lastRun']>){
      if(!sql.change)throw Error('configuration');
      await sql.change('INSERT INTO app_settings(key,value_json,updated_at) VALUES(?,?,?) ON CONFLICT(key) DO UPDATE SET value_json=excluded.value_json,updated_at=excluded.updated_at',
        [`xiaozhi.thinking-run.${id}`,JSON.stringify({schema:1,...value}),new Date().toISOString()]);
    },
    async web(): Promise<XiaozhiWebPreferences> {
      const raw = await read('xiaozhi.web.v1');
      if (!raw) return { version: 0, enabled: true, dnsMode: 'auto' };
      let value; try { value = JSON.parse(raw); } catch { throw new Error('configuration'); }
      if (!value || value.schema !== 1 || !Number.isSafeInteger(value.revision) || value.revision < 1 || typeof value.enabled !== 'boolean'
        || !['auto', 'system', 'alidns'].includes(value.dnsMode) || Object.keys(value).sort().join(',') !== 'dnsMode,enabled,revision,schema') throw new Error('configuration');
      return { version: value.revision, enabled: value.enabled, dnsMode: value.dnsMode };
    },
    async saveWeb(value: XiaozhiWebPreferences, assertCurrent?: () => void) {
      const old = await this.web(); if (old.version !== value.version) throw new Error('conflict');
      assertCurrent?.();
      await commit('xiaozhi.web.v1', value.version, { schema: 1, revision: value.version + 1, enabled: value.enabled, dnsMode: value.dnsMode });
      return this.web();
    },
    async configuration():Promise<ProviderConfiguration>{
      const raw=await read(globalKey);if(!raw)return {schema:1,revision:0,defaultModel:null};
      let value:ProviderConfiguration;try{value=JSON.parse(raw);}catch{throw new Error('configuration');}
      if(!value||value.schema!==1||!Number.isSafeInteger(value.revision)||value.revision<1||!modelId(value.defaultModel)
        ||Object.keys(value).some(key=>!['schema','revision','defaultModel','sealedKey'].includes(key))
        ||value.sealedKey!==undefined&&(typeof value.sealedKey!=='string'||value.sealedKey.length>16384||!value.sealedKey.length))throw new Error('configuration');
      return value;
    },
    async saveConfiguration(expected:number,value:Omit<ProviderConfiguration,'revision'>){
      const current=await this.configuration();if(current.revision!==expected)throw new Error('conflict');
      await commit(globalKey,expected,{...value,revision:expected+1});
    },
    async session(id:string):Promise<{revision:number;model?:string}>{
      const raw=await read(`xiaozhi.model.${id}`);if(!raw)return {revision:0};let value;try{value=JSON.parse(raw);}catch{throw new Error('configuration');}
      if(!value||value.schema!==1||!Number.isSafeInteger(value.revision)||value.revision<1||!modelId(value.model)||Object.keys(value).sort().join(',')!=='model,revision,schema')throw new Error('configuration');return {revision:value.revision,model:value.model};
    },
    async saveSession(id:string,expected:number,model:string){const old=await this.session(id);if(old.revision!==expected)throw new Error('conflict');await commit(`xiaozhi.model.${id}`,expected,{schema:1,revision:expected+1,model});},
  };
}
