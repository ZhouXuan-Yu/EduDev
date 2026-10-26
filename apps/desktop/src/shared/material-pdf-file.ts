import {pageSha,validPdfPageReceipt,type PdfPageReceipt} from './material-page-preview';
import {validPdfLayout,type PdfLayout} from './material-layout';
export const PDF_FILE_SCHEMA='xiaozhi.local-pdf-file.v3' as const;
export const PDF_FILE_ENGINE='pdfium-5.14.0-rapidocr-3.9.2-file.v3' as const;
export const PDF_FILE_MAX_PAGES=10000;
export const PDF_FILE_MAX_BYTES=16*1024**3;
export type PdfFilePage={status:'complete'|'blank'|'needs_review'|'failed';error:string;method:'native'|'ocr'|'blank'|'failed';text:string;nativeText:string;ocrText:string;width:number;height:number;imageArea:number;nativeBoxes:[number,number,number,number][]};
type Base={schemaVersion:typeof PDF_FILE_SCHEMA;requestId:string};
export type PdfFileEvent=Base&({kind:'manifest';inputSha256:string;engine:typeof PDF_FILE_ENGINE;total:number}|{kind:'progress';page:number;total:number}|{kind:'page';page:number;total:number;result:PdfFilePage}|{kind:'finished'|'released';inputSha256:string;total:number}|{kind:'preview';receipt:Extract<PdfPageReceipt,{ok:true}>}|{kind:'layout';receipt:PdfLayout});
export type MaterialPdfStatus={generation:string;total:number;complete:number;blank:number;review:number;failed:number;pending:number;state:string;bytes:number;failures:{page:number;error:string;attempts:number}[]};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const page=(v:unknown)=>Number.isSafeInteger(v)&&Number(v)>=1&&Number(v)<=PDF_FILE_MAX_PAGES;
const text=(v:unknown)=>typeof v==='string'&&new TextEncoder().encode(v).length<=256*1024;
export function validPdfFilePage(v:unknown):v is PdfFilePage{
 if(!object(v)||Object.keys(v).length!==10||!['complete','blank','needs_review','failed'].includes(String(v.status))||!['native','ocr','blank','failed'].includes(String(v.method))||typeof v.error!=='string'||v.error.length>40||![v.text,v.nativeText,v.ocrText].every(text)||![v.width,v.height].every(n=>Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=2401)||typeof v.imageArea!=='number'||!Number.isFinite(v.imageArea)||v.imageArea<0||v.imageArea>1||!Array.isArray(v.nativeBoxes)||v.nativeBoxes.length>2000||!v.nativeBoxes.every(box=>Array.isArray(box)&&box.length===4&&box.every(n=>typeof n==='number'&&Number.isFinite(n)&&Math.abs(n)<1e8)))return false;
 if(v.status==='failed')return v.method==='failed'&&!!v.error&&v.text===''&&v.nativeText===''&&v.ocrText==='';
 if(Number(v.width)<1||Number(v.height)<1)return false;
 if(v.status==='blank')return v.method==='blank'&&v.text===''&&v.nativeText===''&&v.ocrText===''&&v.error==='';
 return v.status==='needs_review'?v.error.length>0:v.error===''&&!!String(v.text).trim()&&['native','ocr'].includes(String(v.method));
}
export function validPdfFileEvent(v:unknown):v is PdfFileEvent{
 if(!object(v)||v.schemaVersion!==PDF_FILE_SCHEMA||typeof v.requestId!=='string'||!/^[a-f0-9-]{36}$/i.test(v.requestId))return false;
 if(v.kind==='manifest')return Object.keys(v).length===6&&pageSha(v.inputSha256)&&v.engine===PDF_FILE_ENGINE&&page(v.total);
 if(v.kind==='finished'||v.kind==='released')return Object.keys(v).length===5&&pageSha(v.inputSha256)&&page(v.total);
 if(v.kind==='progress')return Object.keys(v).length===5&&page(v.page)&&page(v.total)&&Number(v.page)<=Number(v.total);
 if(v.kind==='page')return Object.keys(v).length===6&&page(v.page)&&page(v.total)&&Number(v.page)<=Number(v.total)&&validPdfFilePage(v.result);
 return v.kind==='preview'&&Object.keys(v).length===4&&validPdfPageReceipt(v.receipt)&&v.receipt.ok||v.kind==='layout'&&Object.keys(v).length===4&&validPdfLayout(v.receipt)&&v.receipt.ok;
}
