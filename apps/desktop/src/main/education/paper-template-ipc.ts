import type {IpcMain,IpcMainInvokeEvent} from 'electron';
import {plainStudentInput} from '../../shared/student-context';
import {validTemplateTarget} from '../../shared/paper-template-validation';
import {createPaperTemplateService,type PaperTemplateHost} from './paper-template-service';
export function registerPaperTemplateIpc(ipc:Pick<IpcMain,'handle'>,allowed:(event:IpcMainInvokeEvent)=>boolean,host:PaperTemplateHost) {
  const service=createPaperTemplateService(host);
  const active=new Map<number,{sessionId:string;basketId:string;requestId:string;controller:AbortController}>();
  for(const [channel,method] of [['list','list'],['read','read'],['save','save'],['apply','apply'],['arrange','arrange']] as const)
    ipc.handle('education:paper-template-'+channel,async(event,input)=>{
      if(!allowed(event))return {ok:false,error:'permission_denied'};
      if(active.has(event.sender.id))return {ok:false,error:'busy'};
      const controller=new AbortController();
      const job={sessionId:String(input?.sessionId||''),basketId:String(input?.basketId||''),requestId:String(input?.requestId||''),controller};
      active.set(event.sender.id,job);const stop=()=>controller.abort();event.sender.once('destroyed',stop);
      try {
        // Each method validates its exact input before any SQL or file access.
        const value=await (service[method] as (input:unknown,signal:AbortSignal)=>Promise<unknown>)(input,controller.signal);
        // A committed receipt remains success even if cancellation races the response.
        return {ok:true,value};
      } catch(error){
        const message=error instanceof Error?error.message:'';
        const known=['invalid_input','permission_denied','source_changed','conflict','unavailable','too_large','cancelled','fields_unconfirmed','explicit_mapping_required','quota_mapping_required','nonempty_section','idempotency_conflict'];
        return {ok:false,error:controller.signal.aborted?'cancelled':known.includes(message)?message:'unavailable'};
      }finally{event.sender.removeListener('destroyed',stop);if(active.get(event.sender.id)===job)active.delete(event.sender.id);}
    });
  ipc.handle('education:paper-template-cancel',async(event,input)=>{
    if(!allowed(event))return {ok:false,error:'permission_denied'};
    if(!plainStudentInput(input,['sessionId','basketId','requestId'])||!validTemplateTarget({sessionId:input.sessionId,basketId:input.basketId})
      || typeof input.requestId!=='string')return {ok:false,error:'invalid_input'};
    const job=active.get(event.sender.id);
    if(!job||job.sessionId!==input.sessionId||job.basketId!==input.basketId||job.requestId!==input.requestId)return {ok:true,value:false};
    job.controller.abort();return {ok:true,value:true};
  });
}
