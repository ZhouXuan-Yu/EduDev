import {MISTAKE_OCR_SCHEMA,MISTAKE_OCR_ERRORS,validMistakeOcrInput,type MistakeOcrResult,type MistakeOcrInput} from '../../shared/mistake-ocr';
import type {MistakeOcrRepository} from './mistake-ocr-repository';
import {recognizeLocalImage} from '../xiaozhi-agent/ocr-host';
import {registerMistakeFactsIpc} from './mistake-facts-api';
import type {MistakeFactsRepository} from './mistake-facts-repository';
/** Only the current teacher frame may invoke the fixed local executable. */
export function registerMistakeOcrIpc(options:{ipcMain:Pick<Electron.IpcMain,'handle'>;allowed:(event:Electron.IpcMainInvokeEvent)=>boolean;repository:MistakeOcrRepository;facts:MistakeFactsRepository}){
 const jobs=new Map<string,{input:MistakeOcrInput;abort:AbortController;work:Promise<MistakeOcrResult>}>();let closing=false;
 const failed=(error:unknown):MistakeOcrResult=>({ok:false,schemaVersion:MISTAKE_OCR_SCHEMA,error:error instanceof Error&&Object.prototype.hasOwnProperty.call(MISTAKE_OCR_ERRORS,error.message)?error.message as keyof typeof MISTAKE_OCR_ERRORS:'unavailable'});
 registerMistakeFactsIpc({...options,jobs,closing:()=>closing});
 for(const [channel,correction] of [['mistakeOcr:start',false],['mistakeOcr:correct',true]] as const)options.ipcMain.handle(channel,async(event,raw:unknown):Promise<MistakeOcrResult>=>{
  if(!options.allowed(event))return failed(new Error('permission_denied'));if(!validMistakeOcrInput(raw,correction))return failed(new Error('invalid_input'));if(closing)return failed(new Error('cancelled'));
  if(jobs.size>=8||jobs.has(raw.requestId)||[...jobs.values()].some(j=>j.input.analysisId===raw.analysisId))return failed(new Error('busy'));
  const abort=new AbortController(),closed=()=>abort.abort();event.sender.once('destroyed',closed);const timer=setTimeout(()=>abort.abort('timeout'),60000);
  const work=Promise.resolve().then(async():Promise<MistakeOcrResult>=>{try{const analysis=await(correction?options.repository.correct(raw,abort.signal):options.repository.recognize(raw,abort.signal,recognizeLocalImage));return{ok:true,schemaVersion:MISTAKE_OCR_SCHEMA,analysis};}catch(cause){return failed(abort.signal.aborted?new Error(abort.signal.reason==='timeout'?'timeout':'cancelled'):cause);}finally{clearTimeout(timer);event.sender.removeListener('destroyed',closed);jobs.delete(raw.requestId);}});
  jobs.set(raw.requestId,{input:raw,abort,work});return work;
 });
 options.ipcMain.handle('mistakeOcr:cancel',(event,raw:unknown)=>{if(!options.allowed(event)||!validMistakeOcrInput(raw))return{ok:false};const job=jobs.get(raw.requestId);if(job&&job.input.analysisId===raw.analysisId&&job.input.studentId===raw.studentId)job.abort.abort();return{ok:true};});
 return{async close(){closing=true;for(const job of jobs.values())job.abort.abort();await Promise.allSettled([...jobs.values()].map(job=>job.work));}};
}
