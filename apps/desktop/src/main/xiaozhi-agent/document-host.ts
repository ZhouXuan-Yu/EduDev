import {DOCUMENT_SCHEMA,DOCUMENT_TIMEOUT,validDocumentRequest,validDocumentResult,type DocumentRequest,type DocumentExtraction} from '../../shared/xiaozhi-documents';
import {runLocalUtility} from './local-utility-host';
/** Spawn is main-owned; no executable/path/deadline supplied through IPC. */
export function extractLocalDocument(request:DocumentRequest,signal:AbortSignal):Promise<DocumentExtraction>{
 const fail=(error:Extract<DocumentExtraction,{ok:false}>['error']):DocumentExtraction=>({ok:false,schemaVersion:DOCUMENT_SCHEMA,requestId:request.requestId,error});
 if(!validDocumentRequest(request))return Promise.resolve(fail('unsupported'));
 return runLocalUtility({entry:'document-worker.js',serviceName:'小智本地文档解析',request,timeout:DOCUMENT_TIMEOUT,signal,
  valid:(value):value is DocumentExtraction=>validDocumentResult(value,request.requestId),fail});
}
