/** Private deterministic PDF/OCR protocol; text is a derivative, never a confirmed question. */
export const MATERIAL_PDF_OCR_SCHEMA='xiaozhi.local-pdf-ocr.v1' as const;
export const MATERIAL_PDF_OCR_ENGINE='pdfium-5.14.0-rapidocr-3.9.2.v1' as const;
/** Resume transport only; extracted text keeps the unchanged recognition identity. */
export const MATERIAL_PDF_RESUME_SCHEMA='xiaozhi.local-pdf-ocr.v2' as const;
export type MaterialOcrPage={page:number;text:string;width:number;height:number};
export type MaterialOcrProgress={schemaVersion:typeof MATERIAL_PDF_OCR_SCHEMA;kind:'progress';page:number;total:number};
export type MaterialOcrCompleted={schemaVersion:typeof MATERIAL_PDF_RESUME_SCHEMA;kind:'completed';total:number;result:MaterialOcrPage};
export type MaterialPdfOcrResult={schemaVersion:typeof MATERIAL_PDF_OCR_SCHEMA;ok:true;engine:typeof MATERIAL_PDF_OCR_ENGINE;pages:MaterialOcrPage[]}
 |{schemaVersion:typeof MATERIAL_PDF_OCR_SCHEMA;ok:false;error:'invalid_input'|'too_large'|'configuration'|'empty'|'parse_failed'};
function plain(value:unknown):value is Record<string,unknown>{return !!value&&typeof value==='object'&&!Array.isArray(value)&&Object.getPrototypeOf(value)===Object.prototype&&Object.values(Object.getOwnPropertyDescriptors(value)).every(p=>'value' in p);}
function pageNumber(v:unknown){return typeof v==='number'&&Number.isSafeInteger(v)&&v>=1&&v<=50;}
export function validMaterialOcrPages(value:unknown):value is MaterialOcrPage[]{
 if(!Array.isArray(value)||value.length>50||Object.keys(value).length!==value.length)return false;
 let bytes=0;
 return value.every((p,index)=>{if(!plain(p)||Object.keys(p).length!==4||p.page!==index+1||typeof p.text!=='string'||p.text.length>128000)return false;
  if(![p.width,p.height].every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>0&&n<=2401)||(p.width as number)*(p.height as number)>16000000)return false;
  bytes+=new TextEncoder().encode(p.text).length;return bytes<=1048576;
 });
}
export function validMaterialOcrCompleted(value:unknown):value is MaterialOcrCompleted{
 if(!plain(value)||Object.keys(value).length!==4||value.schemaVersion!==MATERIAL_PDF_RESUME_SCHEMA||value.kind!=='completed'||!pageNumber(value.total)||!plain(value.result)||!pageNumber(value.result.page)||(value.result.page as number)>(value.total as number))return false;
 return validMaterialOcrPages([{...value.result,page:1}]);
}
export function validMaterialOcrProgress(value:unknown):value is MaterialOcrProgress{return plain(value)&&Object.keys(value).length===4&&value.schemaVersion===MATERIAL_PDF_OCR_SCHEMA&&value.kind==='progress'&&pageNumber(value.page)&&pageNumber(value.total)&&(value.page as number)<=(value.total as number);}
export function validMaterialPdfOcrResult(value:unknown):value is MaterialPdfOcrResult{
 if(!plain(value)||value.schemaVersion!==MATERIAL_PDF_OCR_SCHEMA)return false;
 if(value.ok===false)return Object.keys(value).length===3&&typeof value.error==='string'&&['invalid_input','too_large','configuration','empty','parse_failed'].includes(value.error);
 if(value.ok!==true||Object.keys(value).length!==4||value.engine!==MATERIAL_PDF_OCR_ENGINE||!Array.isArray(value.pages)||!value.pages.length||value.pages.length>50)return false;
 return validMaterialOcrPages(value.pages)&&value.pages.some(p=>p.text.trim());
}
