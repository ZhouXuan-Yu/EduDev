import {randomUUID} from 'node:crypto';
import type {OrdinaryIntent} from '../../shared/xiaozhi-ordinary-config';
import {supportedThinking,validThinkingChoice} from '../../shared/xiaozhi-thinking';
import type {XiaozhiCredentialInput} from '../../shared/xiaozhi-settings';
import {openProviderCredential,sealProviderCredential,type SettingsKeyCodec} from '../provider-credentials';
import {readDeepSeekCatalogue} from './model-capabilities';
import type {createModelSettings} from './model-settings';
import {createOrdinaryConfigJournal} from './ordinary-config-journal';
import type {Sql} from './session-state';

const maxTickets=8;
const ticketLifetimeMs=120_000;
type Models=ReturnType<typeof createModelSettings>;
type ModelSnapshot=Awaited<ReturnType<Models['modelSnapshot']>>;
function sameModelSource(before:ModelSnapshot,after:ModelSnapshot){
  const a=before.resolved.observation,b=after.resolved.observation;
  return before.saved.revision===after.saved.revision&&before.saved.defaultModel===after.saved.defaultModel&&
    before.saved.sealedKey===after.saved.sealedKey&&before.legacy.updatedAt===after.legacy.updatedAt&&
    before.legacy.invalid===after.legacy.invalid&&before.fallbackKey===after.fallbackKey&&
    before.environmentModel===after.environmentModel&&
    ['sealedKey','apiKey','legacyCredentialDisabled','model'].every(key=>before.legacy.stored[key]===after.legacy.stored[key])&&
    before.resolved.runtimeValue===after.resolved.runtimeValue&&a.value===b.value&&a.revision===b.revision&&a.source===b.source&&a.status===b.status;
}

export function createOrdinaryConfigService({sql,model,root,codec}:{
  sql:Sql;model:Models;root:string;codec?:SettingsKeyCodec;
}){
  const journal=createOrdinaryConfigJournal(sql);
  const tickets=new Map<string,{sealed:string;expires:number}>();

  function stageCredential(input:XiaozhiCredentialInput){
    if(!codec)throw Error('storage_unavailable');
    const sealed=sealProviderCredential(codec,input.apiKey.trim());
    for(const [id,ticket] of tickets)if(ticket.expires<=Date.now())tickets.delete(id);
    if(tickets.size>=maxTickets)throw Error('busy');
    const credentialId=randomUUID();
    tickets.set(credentialId,{sealed,expires:Date.now()+ticketLifetimeMs});
    return {credentialId};
  }

  async function snapshot(sessionId?:string){
    if(!sql.readTransaction)throw Error('configuration');
    return sql.readTransaction(work=>model.modelSnapshot(work,sessionId));
  }

  async function apply(input:OrdinaryIntent,assertCurrent:()=>void){
    const prior=await journal.repeat(input);
    if(prior)return prior;
    assertCurrent();
    const candidate=await journal.preview(input);
    if(candidate.receipt)return candidate.receipt;
    const {current,next}=candidate;
    const credentialId='credentialId' in input?input.credentialId:undefined;
    const changed=next!==current.value;
    const validateModel=input.field==='default_model' && (Boolean(credentialId)||next!==null);
    const validateThinking=input.field!=='default_model' && changed && validThinkingChoice(next)&&next!=='auto';
    const before=validateModel||validateThinking?await snapshot(input.sessionId):undefined;
    let sealedKey:string|undefined;
    if(validateModel && before){
      if(before.saved.revision!==current.version)throw Error('conflict');
      const ticket=credentialId?tickets.get(credentialId):undefined;
      if(credentialId&&(!ticket||ticket.expires<=Date.now()))throw Error('validation_unavailable');
      const proposedKey=ticket?openProviderCredential(codec,ticket.sealed):model.keyFromSnapshot(before);
      try{await model.preflightModelSetting(next,proposedKey,Boolean(ticket));}
      catch(error){
        if(error instanceof Error&&['transport','timeout','configuration'].includes(error.message))throw Error('validation_unavailable');
        throw error;
      }
      if(ticket){
        let currentKey:string|undefined;
        try{currentKey=model.keyFromSnapshot(before);}
        catch(error){if(!(error instanceof Error)||!['configuration','storage_unavailable'].includes(error.message))throw error;}
        if(!before.saved.sealedKey||currentKey!==proposedKey)sealedKey=ticket.sealed;
      }
    }
    if(validateThinking && before && validThinkingChoice(next)){
      const catalogue=await readDeepSeekCatalogue(root);
      const capabilities=catalogue?.models.find(item=>item.id===before.resolved.runtimeValue);
      if(!supportedThinking(capabilities).includes(next))throw Error('thinking_unavailable');
    }
    const receipt=await journal.write(input,{
      ...(validateModel?{expectedModelVersion:current.version}:{}),sealedKey,assertCurrent,
      ...(before?{verify:async(work:Sql)=>{
        if(!sameModelSource(before,await model.modelSnapshot(work,input.sessionId)))throw Error('conflict');
      }}:{}),
    });
    if(credentialId)tickets.delete(credentialId);
    return receipt;
  }

  return {apply,stageCredential,history:journal.history,repeat:journal.repeat,clear:()=>tickets.clear()};
}
