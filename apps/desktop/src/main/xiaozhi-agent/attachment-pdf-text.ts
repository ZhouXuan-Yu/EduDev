import fs from 'node:fs';
import path from 'node:path';
import {DOCUMENT_MAX_INPUT,DOCUMENT_MAX_OUTPUT} from '../../shared/xiaozhi-documents';
import {parsePdfFile} from './pdf-file-host';

/** Main-only adapter over the existing hash-locked PDF host. No OCR transcript
 * or partial document is eligible for attachment/model delivery. */
export async function readAttachmentPdfText(input:{localPath:string;contentHash:string},signal:AbortSignal):Promise<string>{
 const scoped=AbortSignal.any([signal,AbortSignal.timeout(30000)]);
 const parts:string[]=[];let size=0,total=0,pages=0;
 try{
  scoped.throwIfAborted();
  if(!path.isAbsolute(input.localPath)||!/^[a-f0-9]{64}$/.test(input.contentHash))throw new Error('invalid_input');
  const stat=await fs.promises.lstat(input.localPath);scoped.throwIfAborted();
  if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1)throw new Error('permission_denied');
  if(stat.size>DOCUMENT_MAX_INPUT)throw new Error('too_large');
  await parsePdfFile(input,[],scoped,async(event,executionSignal)=>{
   scoped.throwIfAborted();executionSignal.throwIfAborted();
   if(event.kind==='manifest'){total=event.total;return;}
   if(event.kind!=='page')return;
   pages++;
   const page=event.result;
   if(page.status==='failed')throw new Error('parse_failed');
   if(page.status==='blank'&&page.method==='blank')return;
   if(page.status!=='complete'||page.method!=='native'||page.ocrText)throw new Error('needs_ocr');
   if(!page.nativeText.trim()||page.text!==page.nativeText)throw new Error('parse_failed');
   if(page.nativeText.includes('\ufffd'))throw new Error('text_unreadable');
   size+=Buffer.byteLength(page.nativeText,'utf8')+(parts.length?1:0);
   if(size>DOCUMENT_MAX_OUTPUT)throw new Error('too_large');
   parts.push(page.nativeText);
  });
  scoped.throwIfAborted();
  if(!total||pages!==total)throw new Error('parse_failed');
  const text=parts.join('\n');
  if(!text.trim())throw new Error('empty');
  return text;
 }catch(error){
  if(scoped.aborted)throw new Error(scoped.reason instanceof Error&&scoped.reason.name==='TimeoutError'?'timeout':'cancelled');
  throw error;
 }finally{parts.length=0;}
}
