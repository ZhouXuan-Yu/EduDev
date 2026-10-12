import assert from 'node:assert/strict';
import {MATERIAL_PDF_OCR_SCHEMA as schema,MATERIAL_PDF_OCR_ENGINE as engine,validMaterialOcrProgress,validMaterialPdfOcrResult} from '../../src/shared/material-pdf-ocr.ts';
/** Shared protocol boundaries; real executable/content/SQLite are checked by the Golden journey. */
export async function materialPdfBoundaries(check){
 const page={page:1,text:'本地识别，未经核对',width:1697,height:2400},receipt={schemaVersion:schema,ok:true,engine,pages:[page]},progress={schemaVersion:schema,kind:'progress',page:1,total:6};
 await check('PDF protocol rejects forged scope, extra fields, invalid dimensions and unknown engines',async()=>{
  assert(validMaterialPdfOcrResult(receipt));assert(validMaterialOcrProgress(progress));
  for(const v of [{...receipt,path:'C:/private'},{...receipt,engine:'other'}, {...receipt,pages:[{...page,page:0}]},{...receipt,pages:[{...page,width:Infinity}]},{...receipt,pages:[{...page,height:2402}]},{...receipt,pages:[{...page,width:1.5}]},{...receipt,pages:[{...page,bbox:[0,0,1,1]}]}])assert(!validMaterialPdfOcrResult(v));
  for(const v of [{...progress,page:7},{...progress,total:51},{...progress,page:0},{...progress,total:NaN},{...progress,resourceId:'forged'}])assert(!validMaterialOcrProgress(v));
 });
 await check('PDF receipt preserves contiguous actual pages including blanks, and enforces text byte bounds',async()=>{
  assert(validMaterialPdfOcrResult({...receipt,pages:[{...page,text:''},{...page,page:2}]}));
  for(const pages of [[],[{...page,text:' '}],[page,{...page,page:3}],Array.from({length:51},(_,i)=>({...page,page:i+1})),[{...page,text:'x'.repeat(128001)}],Array.from({length:3},(_,i)=>({...page,page:i+1,text:'文'.repeat(128000)}))])assert(!validMaterialPdfOcrResult({...receipt,pages}));
 });
 await check('PDF protocol never invokes getters or error coercion; failures cannot masquerade as partial success',async()=>{
  let invoked=0;const accessor={...receipt};Object.defineProperty(accessor,'pages',{enumerable:true,get(){invoked++;return[page];}});assert(!validMaterialPdfOcrResult(accessor));
  const error={toString(){invoked++;return'empty';}};assert(!validMaterialPdfOcrResult({schemaVersion:schema,ok:false,error}));assert.equal(invoked,0);
  for(const code of ['invalid_input','too_large','configuration','empty','parse_failed'])assert(validMaterialPdfOcrResult({schemaVersion:schema,ok:false,error:code}));
  assert(!validMaterialPdfOcrResult({schemaVersion:schema,ok:false,error:'empty',pages:[page]}));assert(!validMaterialPdfOcrResult({schemaVersion:schema,ok:true,engine,pages:[{...page,page:2}]}));
 });
}
