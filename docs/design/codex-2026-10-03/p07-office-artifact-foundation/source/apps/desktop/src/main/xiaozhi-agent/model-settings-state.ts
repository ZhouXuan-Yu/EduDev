import type { Sql } from './session-state';
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
