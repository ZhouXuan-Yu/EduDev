import {validMistakeFactsInput,type MistakeFactsResult,MISTAKE_FACTS_ERRORS} from '../../shared/mistake-facts';
import type {MistakeFactsRepository} from './mistake-facts-repository';
import {MISTAKE_OCR_SCHEMA,type MistakeOcrInput,type MistakeOcrResult} from '../../shared/mistake-ocr';
export type MistakeLocalJob={input:MistakeOcrInput;abort:AbortController;work:Promise<MistakeOcrResult>};
/** Same host job/cancel authority, without coupling teacher facts to the OCR executable. */
export function registerMistakeFactsIpc(options:{ipcMain:Pick<Electron.IpcMain,'handle'>;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;facts:MistakeFactsRepository;jobs:Map<string,MistakeLocalJob>;closing:()=>boolean}){
 const {jobs}=options;
 options.ipcMain.handle('mistakeFacts:confirm',async(event,raw:unknown):Promise<MistakeFactsResult>=>{
  if(!options.allowed(event))return{ok:false,error:'permission_denied'};if(!validMistakeFactsInput(raw))return{ok:false,error:'invalid_input'};
  if(options.closing())return{ok:false,error:'cancelled'};if(jobs.size>=8||jobs.has(raw.source.requestId)||[...jobs.values()].some(j=>j.input.analysisId===raw.source.analysisId))return{ok:false,error:'conflict'};
  const abort=new AbortController(),closed=()=>abort.abort();event.sender.once('destroyed',closed);
  const work=Promise.resolve().then(async()=>{try{return{ok:true,...await options.facts.confirm(raw,abort.signal)} as const;}catch(error){return{ok:false,error:abort.signal.aborted?'cancelled':error instanceof Error&&Object.prototype.hasOwnProperty.call(MISTAKE_FACTS_ERRORS,error.message)?error.message as keyof typeof MISTAKE_FACTS_ERRORS:'unavailable'} as const;}finally{event.sender.removeListener('destroyed',closed);jobs.delete(raw.source.requestId);}});
  jobs.set(raw.source.requestId,{input:raw.source,abort,work:work.then(result=>result.ok?{ok:true,schemaVersion:MISTAKE_OCR_SCHEMA,analysis:result.analysis}:{ok:false,schemaVersion:MISTAKE_OCR_SCHEMA,error:'unavailable'})});return work;
 });
}
