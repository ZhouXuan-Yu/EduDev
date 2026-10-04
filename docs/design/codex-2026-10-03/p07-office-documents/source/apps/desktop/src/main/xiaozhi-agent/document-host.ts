import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { utilityProcess } from 'electron';
import { DOCUMENT_SCHEMA,DOCUMENT_TIMEOUT,validDocumentRequest,validDocumentResult,type DocumentRequest,type DocumentExtraction } from '../../shared/xiaozhi-documents';
/** Spawn is main-owned; no executable/path/deadline supplied through IPC. */
export function extractLocalDocument(request:DocumentRequest,signal:AbortSignal):Promise<DocumentExtraction>{
  const fail=(error:Extract<DocumentExtraction,{ok:false}>['error']):DocumentExtraction=>({ok:false,schemaVersion:DOCUMENT_SCHEMA,requestId:request.requestId,error});
  if(!validDocumentRequest(request))return Promise.resolve(fail('unsupported'));
  if(signal.aborted)return Promise.resolve(fail(signal.reason==='timeout'?'timeout':'cancelled'));
  return new Promise(resolve=>{
    let settled=false;
    let child:Electron.UtilityProcess;
    const env=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP','LANG'].flatMap(key=>process.env[key]?[[key,process.env[key]!]]:[]));
    try{child=utilityProcess.fork(path.join(path.dirname(fileURLToPath(import.meta.url)),'document-worker.js'),[],{stdio:'pipe',serviceName:'小智本地文档解析',env});}
    catch{resolve(fail('unavailable'));return;}
    const finish=(result:DocumentExtraction)=>{
      if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);
      child.kill();resolve(result);
    };
    const abort=()=>finish(fail(signal.reason==='timeout'?'timeout':'cancelled'));
    const timer=setTimeout(()=>finish(fail('timeout')),DOCUMENT_TIMEOUT);
    signal.addEventListener('abort',abort,{once:true});
    // Drain bounded diagnostics. They are never returned to UI/model or persisted.
    let diagnostics=0;
    child.stderr?.on('data',(bytes:Buffer)=>{diagnostics=Math.min(4096,diagnostics+bytes.length);});
    child.stdout?.on('data',()=>{});
    child.on('exit',()=>finish(fail('unavailable')));
    child.on('message',value=>finish(validDocumentResult(value,request.requestId)?value:fail('parse_failed')));
    try{child.postMessage(request);}catch{finish(fail('unavailable'));}
    if(signal.aborted)abort();
  });
}
