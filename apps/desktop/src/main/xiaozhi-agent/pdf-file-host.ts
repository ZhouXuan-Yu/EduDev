import {spawn} from 'node:child_process';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {StringDecoder} from 'node:string_decoder';
import {PDF_FILE_SCHEMA,PDF_FILE_ENGINE,validPdfFileEvent,type PdfFileEvent} from '../../shared/material-pdf-file';
import type {PageBox,PdfPageReceipt} from '../../shared/material-page-preview';
import {verifyOcrRuntime} from './ocr-host';
import type {PdfLayout} from '../../shared/material-layout';
import manifest from './ocr-runtime-manifest.json';
import {reserveLocalWorker} from './local-utility-host';

export const pdfFileWorkerVersion=()=>createHash('sha256').update(JSON.stringify([PDF_FILE_ENGINE,manifest.workerSha256,(manifest as {pdfStreamSha256?:string}).pdfStreamSha256])).digest('hex');
type Input={localPath:string;contentHash:string};
type Operation={operation:'parse';skipPages:number[]}|{operation:'preview';page:number;box:PageBox}|{operation:'layout';page:number};
/** One parent-owned worker, bounded NDJSON, durable page ACK before advancing. */
async function runFile(input:Input,operation:Operation,signal:AbortSignal,onEvent?:(event:PdfFileEvent,executionSignal:AbortSignal)=>Promise<void>){
 const root=await verifyOcrRuntime(signal);signal.throwIfAborted();const release=reserveLocalWorker();if(!release)throw new Error('busy');
 const requestId=randomUUID(),environment=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP'].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[]));
 let child:ReturnType<typeof spawn>;try{child=spawn(path.join(root,'omni-edu-ocr.exe'),[],{env:environment,windowsHide:true,stdio:['pipe','pipe','pipe']});}catch{release();throw new Error('unavailable');}if(!child.stdout||!child.stderr||!child.stdin){child.kill();release();throw new Error('unavailable');}
 let reason='',timer:ReturnType<typeof setTimeout>|undefined,stderr=0,manifestTotal=0,active=0,expected=1,finished=false,publication=false,publicationCommitted=false,preview:Extract<PdfPageReceipt,{ok:true}>|PdfLayout|undefined;
 const skipped=new Set(operation.operation==='parse'?operation.skipPages:[]),received=new Set<number>();
 const execution=new AbortController();
 const stopped=new Promise<{code:number|null;error?:string}>(resolve=>{child.once('error',()=>{execution.abort('unavailable');resolve({code:null,error:'unavailable'});});child.once('close',code=>{if(!finished&&!publicationCommitted)execution.abort('worker_closed');resolve({code});});});
 const stop=(code:string)=>{if(!reason)reason=code;execution.abort(code);child.kill();};
 const deadline=(ms:number)=>{if(timer)clearTimeout(timer);timer=setTimeout(()=>stop('timeout'),ms);};
 const abort=()=>stop('cancelled');signal.addEventListener('abort',abort,{once:true});
 child.stderr.on('data',value=>{stderr+=value.length;if(stderr>65536)stop('too_large');});
 child.stdin.on('error',()=>{if(!finished)stop('unavailable');});
 function next(){while(skipped.has(expected)||received.has(expected))expected++;}
 try{
  deadline(180000);
  child.stdin.write(JSON.stringify({schemaVersion:PDF_FILE_SCHEMA,requestId,parentPid:process.pid,root:path.dirname(input.localPath),file:input.localPath,inputSha256:input.contentHash,...operation})+'\n');
  if(operation.operation!=='parse')child.stdin.end();
  if(signal.aborted)abort();
  const decoder=new StringDecoder('utf8');let pending='';const maxLine=operation.operation==='parse'?2*1048576:8*1048576;
  for await(const bytes of child.stdout){
   signal.throwIfAborted();if(reason)throw new Error(reason);pending+=decoder.write(bytes);
   for(;;){const at=pending.indexOf('\n');if(at<0)break;const line=pending.slice(0,at);pending=pending.slice(at+1);if(Buffer.byteLength(line)>maxLine)throw new Error('too_large');
    let value:unknown;try{value=JSON.parse(line);}catch{throw new Error('parse_failed');}
    if(value&&typeof value==='object'&&'ok'in value&&value.ok===false&&'error'in value)throw new Error(['source_changed','missing','invalid_input','configuration','too_large','empty'].includes(String(value.error))?String(value.error):'parse_failed');
    if(!validPdfFileEvent(value)||value.requestId!==requestId||finished)throw new Error('parse_failed');
    if(operation.operation!=='parse'){
     if(value.kind!==operation.operation||!(value.kind==='preview'||value.kind==='layout')||value.receipt.inputSha256!==input.contentHash||value.receipt.page!==operation.page||value.kind==='preview'&&operation.operation==='preview'&&JSON.stringify(value.receipt.box)!==JSON.stringify(operation.box))throw new Error('parse_failed');preview=value.receipt;finished=true;deadline(10000);continue;
    }
    if(value.kind==='manifest'){
     if(manifestTotal||value.inputSha256!==input.contentHash||value.engine!==PDF_FILE_ENGINE||operation.skipPages.some(p=>p>value.total))throw new Error('parse_failed');manifestTotal=value.total;next();
    }else if(!manifestTotal||value.kind==='preview'||value.kind==='layout')throw new Error('parse_failed');
    else if(value.kind==='progress'){
     if(active||value.page!==expected||value.total!==manifestTotal)throw new Error('parse_failed');active=value.page;
    }else if(value.kind==='page'){
     if(value.page!==active||value.page!==expected||value.total!==manifestTotal||received.has(value.page))throw new Error('parse_failed');
    }else if(value.kind==='finished'){
     if(publication||active||value.total!==manifestTotal||value.inputSha256!==input.contentHash||received.size+skipped.size!==manifestTotal)throw new Error('parse_failed');publication=true;
    }else if(value.kind==='released'){
     if(!publication||value.total!==manifestTotal||value.inputSha256!==input.contentHash)throw new Error('parse_failed');finished=true;
    }
    await onEvent?.(value,execution.signal);signal.throwIfAborted();execution.signal.throwIfAborted();if(reason)throw new Error(reason);
    if(value.kind==='page'){received.add(value.page);active=0;next();child.stdin.write(JSON.stringify({requestId,page:value.page,ack:true})+'\n');}
    if(value.kind==='finished'){publicationCommitted=true;child.stdin.write(JSON.stringify({requestId,commit:true})+'\n');}
    deadline(finished?10000:120000);
   }
   if(Buffer.byteLength(pending)>maxLine)throw new Error('too_large');
  }
  pending+=decoder.end();const result=await stopped;
  if(reason||signal.aborted)throw new Error(reason||'cancelled');
  if(result.error||result.code!==0||!finished||pending.trim())throw new Error(result.error||'parse_failed');
  return preview;
 }catch(error){stop(error instanceof Error?error.message:'parse_failed');await stopped;throw new Error(signal.aborted?'cancelled':reason||'parse_failed');}
 finally{if(timer)clearTimeout(timer);signal.removeEventListener('abort',abort);child.stdin.destroy();release();}
}
export async function parsePdfFile(input:Input,skipPages:number[],signal:AbortSignal,onEvent:(event:PdfFileEvent,executionSignal:AbortSignal)=>Promise<void>){await runFile(input,{operation:'parse',skipPages},signal,onEvent);}
export async function previewPdfFile(input:Input,page:number,box:PageBox,signal:AbortSignal){const receipt=await runFile(input,{operation:'preview',page,box},signal);if(!receipt||receipt.schemaVersion!=='xiaozhi.local-pdf-page.v1')throw new Error('parse_failed');return receipt;}

export async function layoutPdfFile(input:Input,page:number,signal:AbortSignal){const receipt=await runFile(input,{operation:'layout',page},signal);if(!receipt||receipt.schemaVersion!=='xiaozhi.local-pdf-layout.v1')throw new Error('parse_failed');return receipt;}
