import {validMistakeSimilarInput,MISTAKE_SIMILAR_ERRORS,type MistakeSimilarInput,type MistakeSimilarResult,type MistakeSimilarView} from '../../shared/mistake-similar';
export function registerMistakeSimilarIpc(options:{ipcMain:Pick<Electron.IpcMain,'handle'>;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;find:(input:MistakeSimilarInput,signal:AbortSignal)=>Promise<MistakeSimilarView>}){
 const jobs=new Map<string,{input:MistakeSimilarInput;abort:AbortController;work:Promise<MistakeSimilarResult>}>();let closing=false;
 options.ipcMain.handle('mistakeSimilar:find',async(event,raw:unknown):Promise<MistakeSimilarResult>=>{
  if(!options.allowed(event))return{ok:false,error:'permission_denied'};if(!validMistakeSimilarInput(raw))return{ok:false,error:'invalid_input'};if(closing)return{ok:false,error:'cancelled'};
  if(jobs.size>=8||jobs.has(raw.requestId))return{ok:false,error:'busy'};
  const abort=new AbortController(),destroyed=()=>abort.abort();event.sender.once('destroyed',destroyed);const timer=setTimeout(()=>abort.abort('timeout'),60000);
  const work=Promise.resolve().then(async():Promise<MistakeSimilarResult>=>{try{const value=await options.find(raw,abort.signal);abort.signal.throwIfAborted();return{ok:true,value};}catch(e){const code=abort.signal.aborted?abort.signal.reason==='timeout'?'timeout':'cancelled':(e as Error)?.message;return{ok:false,error:Object.prototype.hasOwnProperty.call(MISTAKE_SIMILAR_ERRORS,code)?code as keyof typeof MISTAKE_SIMILAR_ERRORS:'unavailable'};}finally{clearTimeout(timer);event.sender.removeListener('destroyed',destroyed);jobs.delete(raw.requestId);}});
  jobs.set(raw.requestId,{input:raw,abort,work});return work;
 });
 options.ipcMain.handle('mistakeSimilar:cancel',(event,raw:unknown)=>{if(!options.allowed(event)||!validMistakeSimilarInput(raw))return{ok:false};const job=jobs.get(raw.requestId);if(job&&JSON.stringify(job.input)===JSON.stringify(raw))job.abort.abort();return{ok:true};});
 return{async close(){closing=true;for(const j of jobs.values())j.abort.abort();await Promise.allSettled([...jobs.values()].map(j=>j.work));}};
}
