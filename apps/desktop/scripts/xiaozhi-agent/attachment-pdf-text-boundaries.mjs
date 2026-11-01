import '../office-agent/register-source.mjs';
import {registerHooks} from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';

// Adapter contract doubles only; actual locked worker coverage is in the host suite.
registerHooks({resolve(specifier,context,next){
 if(specifier==='./pdf-file-host'&&context.parentURL?.endsWith('/attachment-pdf-text.ts'))
  return {url:'data:text/javascript,export const parsePdfFile=(...args)=>globalThis.pdfAdapterTransport(...args);',shortCircuit:true};
 return next(specifier,context);
}});
const {readAttachmentPdfText}=await import('../../src/main/xiaozhi-agent/attachment-pdf-text.ts');
fs.mkdirSync(path.resolve('test-results/xiaozhi-agent'),{recursive:true});
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/attachment-pdf-adapter-'));
const file=path.join(output,'synthetic.pdf');fs.writeFileSync(file,'%PDF-1.7\nfixture');
const input={localPath:file,contentHash:'a'.repeat(64)},signal=()=>new AbortController().signal;
const native=text=>({status:'complete',method:'native',text,nativeText:text,ocrText:''});
let passed=0;
const check=async(name,run)=>{await run();passed++;console.log('PASS '+name);};
function pages(results){globalThis.pdfAdapterTransport=async(actual,skip,scoped,receive)=>{
 assert.deepEqual(actual,input);assert.deepEqual(skip,[]);
 await receive({kind:'manifest',total:results.length},scoped);
 for(const result of results)await receive({kind:'page',result},scoped);
};}
await check('only complete native pages contribute; genuine blank pages do not invent text',async()=>{
 pages([native('原生页一'),{status:'blank',method:'blank',text:'',nativeText:'',ocrText:''},native('原生页三')]);
 assert.equal(await readAttachmentPdfText(input,signal()),'原生页一\n原生页三');
});
await check('native plus OCR or review is rejected as a whole, without partial native text',async()=>{
 for(const result of [{...native('PRIVATE_PARTIAL'),method:'ocr',ocrText:'OCR'}, {...native('PRIVATE_PARTIAL'),status:'needs_review'}]){
  pages([native('PRIVATE_PARTIAL'),result]);
  await assert.rejects(readAttachmentPdfText(input,signal()),{message:'needs_ocr'});
 }
});
await check('failed, empty and undecodable pages return errors rather than fabricated content',async()=>{
 pages([{status:'failed',method:'failed',text:'',nativeText:'',ocrText:''}]);await assert.rejects(readAttachmentPdfText(input,signal()),{message:'parse_failed'});
 pages([{status:'blank',method:'blank',text:'',nativeText:'',ocrText:''}]);await assert.rejects(readAttachmentPdfText(input,signal()),{message:'empty'});
 pages([native('broken\ufffd')]);await assert.rejects(readAttachmentPdfText(input,signal()),{message:'text_unreadable'});
 pages([{...native('original'),text:'different'}]);await assert.rejects(readAttachmentPdfText(input,signal()),{message:'parse_failed'});
});
await check('whole extraction has a UTF-8 1MiB cap and never truncates into success',async()=>{
 pages(Array.from({length:5},()=>native('a'.repeat(256*1024))));
 await assert.rejects(readAttachmentPdfText(input,signal()),{message:'too_large'});
});
await check('50MiB input boundary rejects before invoking the PDF host',async()=>{
 const large=path.join(output,'large.pdf'),handle=fs.openSync(large,'w');fs.ftruncateSync(handle,50*1024*1024+1);fs.closeSync(handle);
 let calls=0;globalThis.pdfAdapterTransport=async()=>{calls++;};
 await assert.rejects(readAttachmentPdfText({...input,localPath:large},signal()),{message:'too_large'});assert.equal(calls,0);
});
await check('cancel and timeout discard late native output even if the transport returns it',async()=>{
 for(const reason of [new DOMException('cancel','AbortError'),new DOMException('time','TimeoutError')]){
  const controller=new AbortController();
  globalThis.pdfAdapterTransport=async(_input,_skip,_scoped,receive)=>{
   controller.abort(reason);await receive({kind:'manifest',total:1},signal());
   await receive({kind:'page',result:native('LATE_BODY')},signal());
  };
  await assert.rejects(readAttachmentPdfText(input,controller.signal),{message:reason.name==='TimeoutError'?'timeout':'cancelled'});
 }
});
await check('host failure and incomplete publication cannot become a successful document',async()=>{
 globalThis.pdfAdapterTransport=async()=>{throw Error('busy');};await assert.rejects(readAttachmentPdfText(input,signal()),{message:'busy'});
 globalThis.pdfAdapterTransport=async(_input,_skip,scoped,receive)=>receive({kind:'manifest',total:2},scoped);
 await assert.rejects(readAttachmentPdfText(input,signal()),{message:'parse_failed'});
});
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({success:true,passed,scope:'Actual adapter with PDF transport doubles; no native-worker, model or desktop claim'},null,2));
console.log(JSON.stringify({success:true,passed,output}));
