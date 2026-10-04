import { extractDocument } from './vendor/hana/lib/document-extract/index';
import { createRequire } from 'node:module';
import { DOCUMENT_SCHEMA,DOCUMENT_MAX_OUTPUT,validDocumentRequest,type DocumentExtraction } from '../../shared/xiaozhi-documents';
// One request per isolated utility process. Native parser failures cannot block main.
const parent=(process as unknown as {parentPort?:{on:(name:string,fn:(event:{data:unknown})=>void)=>void;postMessage:(value:unknown)=>void}}).parentPort;
const reply=(value:DocumentExtraction)=>parent?parent.postMessage(value):process.send?.(value);
let started=false;
async function receive(raw:unknown){
  if(started)return;started=true;
  const requestId=typeof (raw as {requestId?:unknown})?.requestId==='string'?String((raw as {requestId:string}).requestId):'';
  const fail=(error:Extract<DocumentExtraction,{ok:false}>['error'])=>reply({ok:false,schemaVersion:DOCUMENT_SCHEMA,requestId,error});
  if(!validDocumentRequest(raw)){fail('unsupported');return;}
  try{
    if(createRequire(import.meta.url)('@firecrawl/anydoc/package.json').version!=='0.1.2'){fail('unavailable');return;}
    const result=await extractDocument({buffer:Buffer.from(raw.bytes),filename:raw.filename});
    if(!result.ok){fail(result.reason==='scanned-pdf'?'needs_ocr':result.reason==='too-large'?'too_large':result.reason==='unsupported'?'unsupported':'parse_failed');return;}
    const format=result.format==='excel'?'xlsx':result.format;
    if(!['docx','pdf','xlsx','pptx'].includes(format)){fail('unsupported');return;}
    if(Buffer.byteLength(result.markdown,'utf8')>DOCUMENT_MAX_OUTPUT){fail('too_large');return;}
    if(!result.markdown.trim()){fail('empty');return;}
    if(result.markdown.includes('\ufffd')){fail('text_unreadable');return;}
    reply({ok:true,schemaVersion:DOCUMENT_SCHEMA,requestId,format:format as 'docx'|'pdf'|'xlsx'|'pptx',markdown:result.markdown,parser:'hana-anydoc-0.1.2',warnings:[]});
  }catch{fail('unavailable');}
}
if(parent)parent.on('message',event=>void receive(event.data));
else process.on('message',raw=>void receive(raw));
