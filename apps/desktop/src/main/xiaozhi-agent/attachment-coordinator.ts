import path from 'node:path';
import {XIAOZHI_ATTACHMENTS_SCHEMA,validAttachmentInput,XIAOZHI_ATTACHMENT_ERRORS,type XiaozhiAttachmentInput,type XiaozhiAttachmentSelectedInput,
 type XiaozhiAttachmentError,type XiaozhiAttachmentResult,type XiaozhiAttachment,type XiaozhiAttachmentChoice,type XiaozhiAttachmentPreview} from '../../shared/xiaozhi-attachments';
import {createAttachmentImportService} from './attachment-import-service';
import {publicAttachment} from './attachment-state';
import type {OmniEduStore} from '../db';
import {validOcrDecision,type AttachmentOcrReview} from '../../shared/xiaozhi-ocr';
import {publicOcr} from './attachment-ocr-state';

export function createAttachmentCoordinator(options:{store:OmniEduStore;dataRoot:string;reserve:(id:string)=>boolean;release:(id:string)=>void;closing:()=>boolean}){
 const jobs=new Map<string,{sessionId:string;abort:AbortController;work:Promise<unknown>}>();
 const validateImportedImage=async(bytes:Buffer,mime:string,signal:AbortSignal)=>(await import('./image-host')).validateImportedImage(bytes,mime,signal);
 const error=(raw:unknown):XiaozhiAttachmentError=>raw instanceof Error&&Object.prototype.hasOwnProperty.call(XIAOZHI_ATTACHMENT_ERRORS,raw.message)?raw.message as XiaozhiAttachmentError:'read_failed';
 const assertSession=async(id:string,signal:AbortSignal)=>{
  signal.throwIfAborted();if(options.closing())throw new Error('cancelled');
  const detail=await options.store.getAiConversationSession(id);
  signal.throwIfAborted();if(options.closing()||detail.session.archivedAt)throw new Error('permission_denied');
 };
 async function execute<T>(raw:unknown,selected:boolean,mutating:boolean,timeout:number,action:(input:XiaozhiAttachmentSelectedInput,signal:AbortSignal)=>Promise<T>):Promise<XiaozhiAttachmentResult<T>>{
  const failure=(requestId:string,reason:XiaozhiAttachmentError):XiaozhiAttachmentResult<T>=>({ok:false,schemaVersion:XIAOZHI_ATTACHMENTS_SCHEMA,requestId,error:reason});
  if(!validAttachmentInput(raw,selected))return failure('','invalid_input');
  const input=raw;
  if(options.closing())return failure(input.requestId,'cancelled');
  if(jobs.size>=8||jobs.has(input.requestId))return failure(input.requestId,'busy');
  if(mutating&&!options.reserve(input.sessionId))return failure(input.requestId,'busy');
  const abort=new AbortController();
  let terminal!:(value:XiaozhiAttachmentResult<T>)=>void;
  const cancelled=new Promise<XiaozhiAttachmentResult<T>>(resolve=>terminal=resolve);
  const onAbort=()=>terminal(failure(input.requestId,abort.signal.reason==='timeout'?'timeout':'cancelled'));
  abort.signal.addEventListener('abort',onAbort,{once:true});
  const timer=setTimeout(()=>abort.abort('timeout'),timeout);
  // Start after synchronously reserving the request and host owner.
  const work=Promise.resolve().then(async()=>{
   try{
    await assertSession(input.sessionId,abort.signal);
    const data=await action(input,abort.signal);
    await assertSession(input.sessionId,abort.signal);
    return {ok:true,schemaVersion:XIAOZHI_ATTACHMENTS_SCHEMA,requestId:input.requestId,data} as XiaozhiAttachmentResult<T>;
   }catch(cause){return failure(input.requestId,abort.signal.aborted?(abort.signal.reason==='timeout'?'timeout':'cancelled'):error(cause));}
  }).finally(()=>{clearTimeout(timer);abort.signal.removeEventListener('abort',onAbort);jobs.delete(input.requestId);if(mutating)options.release(input.sessionId);});
  jobs.set(input.requestId,{sessionId:input.sessionId,abort,work});
  return Promise.race([work,cancelled]);
 }
 const importer=(input:XiaozhiAttachmentInput,signal:AbortSignal)=>createAttachmentImportService({dataRoot:options.dataRoot,
  state:options.store.xiaozhiState.attachments,imports:options.store.xiaozhiState.attachmentImports,
  isCurrent:()=>!signal.aborted&&!options.closing(),validateImage:validateImportedImage,
  afterStage:async()=>assertSession(input.sessionId,signal)});
 const ocrSource=async(input:XiaozhiAttachmentSelectedInput,signal:AbortSignal)=>{
  await assertSession(input.sessionId,signal);const row=await options.store.xiaozhiState.attachments.get(input.sessionId,input.selection.id);
  if(!row||row.state==='removed')throw new Error('not_found');if(row.revision!==input.selection.revision)throw new Error('changed');
  if(row.format!=='image')throw new Error('unsupported');await importer(input,signal).verify(input.sessionId,input.selection,signal);return row;
 };
 return {
  ocrReview:(raw:unknown)=>execute<AttachmentOcrReview|null>(raw,true,false,35000,async(input,signal)=>{
   const row=await ocrSource(input,signal),review=await options.store.xiaozhiState.attachmentOcr.get(row);return review?publicOcr(review):null;
  }),
  ocrStart:(raw:unknown)=>execute<AttachmentOcrReview>(raw,true,true,60000,async(input,signal)=>{
   const row=await ocrSource(input,signal),state=options.store.xiaozhiState.attachmentOcr;
   const previous=await state.get(row);if(previous&&['review','approved'].includes(previous.status))return publicOcr(previous);
   const pending=await state.begin(row);
   try{
    const preview=await importer(input,signal).preview(input.sessionId,input.selection,signal);if(!preview.image)throw new Error('unsupported');
    const result=await (await import('./ocr-host')).recognizeLocalImage(Buffer.from(preview.image.split(',')[1],'base64'),signal);
    await ocrSource(input,signal);signal.throwIfAborted();return publicOcr(await state.finish(row,pending.revision,result));
   }catch(cause){await state.interrupt(row,pending.revision);throw cause;}
  }),
  ocrDecide:(raw:unknown):Promise<XiaozhiAttachmentResult<AttachmentOcrReview>>=>{
   if(!validOcrDecision(raw))return Promise.resolve({ok:false,schemaVersion:XIAOZHI_ATTACHMENTS_SCHEMA,requestId:'',error:'invalid_input'});
   const input={schemaVersion:raw.schemaVersion,sessionId:raw.sessionId,requestId:raw.requestId,selection:raw.selection};
   return execute<AttachmentOcrReview>(input,true,true,35000,async(value,signal)=>{
    const row=await ocrSource(value,signal);signal.throwIfAborted();
    return publicOcr(await options.store.xiaozhiState.attachmentOcr.decide(row,raw.ocrRevision,raw.decision,raw.text));
   });
  },
  choose:(raw:unknown,choose:()=>Promise<string[]|undefined>)=>execute<XiaozhiAttachmentChoice>(raw,false,true,120_000,async(input,signal)=>{
   const paths=await choose();await assertSession(input.sessionId,signal);
   if(!paths?.length)throw new Error('cancelled');if(paths.length>32)throw new Error('too_large');
   const service=importer(input,signal),items:XiaozhiAttachment[]=[],failures:XiaozhiAttachmentChoice['failures']=[];
   for(const filename of paths){
    await assertSession(input.sessionId,signal);
    try{items.push(await service.importFile(input.sessionId,filename,signal));}
    catch(cause){signal.throwIfAborted();failures.push({name:path.basename(filename).slice(0,255),error:error(cause)});}
   }
   return {items,failures};
  }),
  list:(raw:unknown)=>execute<XiaozhiAttachment[]>(raw,false,false,10_000,async(input)=>
   (await options.store.xiaozhiState.attachments.list(input.sessionId)).filter(v=>v.state==='draft').map(publicAttachment)),
  remove:(raw:unknown)=>execute<XiaozhiAttachment>(raw,true,true,10_000,async(input,signal)=>{
   await assertSession(input.sessionId,signal);return publicAttachment(await options.store.xiaozhiState.attachments.remove(input.sessionId,input.selection));
  }),
  preview:(raw:unknown)=>execute<XiaozhiAttachmentPreview>(raw,true,false,35_000,async(input,signal)=>{
   const preview=await importer(input,signal).preview(input.sessionId,input.selection,signal);
   if(preview.image)await validateImportedImage(Buffer.from(preview.image.split(',')[1],'base64'),preview.image.slice(5,preview.image.indexOf(';')),signal);
   return preview;
  }),
  thumbnail:(raw:unknown)=>execute<import('../../shared/xiaozhi-images').LocalImagePreview>(raw,true,false,35_000,async(input,signal)=>{
   const preview=await importer(input,signal).preview(input.sessionId,input.selection,signal);
   if(!preview.image)throw new Error('unsupported');
   return validateImportedImage(Buffer.from(preview.image.split(',')[1],'base64'),preview.image.slice(5,preview.image.indexOf(';')),signal);
  }),
  cancel(raw:unknown){
   if(!validAttachmentInput(raw))return {ok:false};
   const job=jobs.get(raw.requestId);if(job?.sessionId===raw.sessionId)job.abort.abort();return {ok:true};
  },
  cancelSession(id:string){for(const job of jobs.values())if(job.sessionId===id)job.abort.abort();},
  async close(){for(const job of jobs.values())job.abort.abort();await Promise.allSettled([...jobs.values()].map(job=>job.work));},
 };
}
