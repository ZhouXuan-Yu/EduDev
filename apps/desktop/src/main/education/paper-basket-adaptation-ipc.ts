import type {IpcMain,IpcMainInvokeEvent} from 'electron';
import {validAdaptationRead} from '../../shared/paper-basket-adaptation';
import type {createPaperBasketAdaptationService} from './paper-basket-adaptation-service';
export function registerPaperBasketAdaptationIpc(ipc:Pick<IpcMain,'handle'>,allowed:(event:IpcMainInvokeEvent)=>boolean,service:ReturnType<typeof createPaperBasketAdaptationService>){
 const jobs=new Map<number,{sessionId:string;basketId:string;intentId:string;controller:AbortController}>();
 for(const method of ['list','prepare','read','accept','cancel'] as const)ipc.handle('education:paper-adaptation-'+method,async(event,raw)=>{
  if(!allowed(event))return {ok:false,error:'permission_denied'};
  const active=jobs.get(event.sender.id);
  if(method==='cancel'&&validAdaptationRead(raw,'cancel')&&active?.sessionId===raw.sessionId&&active.basketId===raw.basketId&&active.intentId===raw.intentId)active.controller.abort();
  else if(active)return {ok:false,error:'busy'};
  const controller=new AbortController(),job={sessionId:String(raw?.sessionId||''),basketId:String(raw?.basketId||''),intentId:String(raw?.intentId||raw?.requestId||''),controller};jobs.set(event.sender.id,job);
  const stop=()=>controller.abort();event.sender.once('destroyed',stop);
  try{const value=method==='read'||method==='list'?await service[method](raw):await service[method](raw,controller.signal);return {ok:true,value};}
  catch(e){const code=e instanceof Error?e.message:'';return {ok:false,error:controller.signal.aborted?'cancelled':['invalid_input','permission_denied','source_changed','conflict','unavailable','cancelled','shortage','too_large'].includes(code)?code:'unavailable'};}
  finally{event.sender.removeListener('destroyed',stop);if(jobs.get(event.sender.id)===job)jobs.delete(event.sender.id);}
 });
}
