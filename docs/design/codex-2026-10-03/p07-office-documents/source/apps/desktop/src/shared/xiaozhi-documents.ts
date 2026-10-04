/** Private local body extraction; not a model message or asset database. */
export const DOCUMENT_SCHEMA='xiaozhi.document.v1' as const;
export const DOCUMENT_MAX_INPUT=50*1024*1024;
export const DOCUMENT_MAX_OUTPUT=1024*1024;
export const DOCUMENT_TIMEOUT=15000;
export type OfficeDocumentFormat='docx'|'pdf'|'xlsx'|'pptx';
export type DocumentFailure='unsupported'|'parse_failed'|'needs_ocr'|'too_large'|'empty'|'cancelled'|'timeout'|'unavailable'|'text_unreadable';
export type DocumentExtraction={ok:true;schemaVersion:typeof DOCUMENT_SCHEMA;requestId:string;format:OfficeDocumentFormat;markdown:string;parser:'hana-anydoc-0.1.2';warnings:string[]}
  |{ok:false;schemaVersion:typeof DOCUMENT_SCHEMA;requestId:string;error:DocumentFailure};
export type DocumentRequest={schemaVersion:typeof DOCUMENT_SCHEMA;requestId:string;filename:string;bytes:Uint8Array};
export const isOfficeDocument=(name:string):boolean=>/\.(docx|pdf|xlsx|pptx)$/i.test(name);
export function validDocumentRequest(value:unknown):value is DocumentRequest {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Record<string,unknown>;
  return Object.keys(v).length===4&&Object.keys(v).every(key=>['schemaVersion','requestId','filename','bytes'].includes(key))
    &&v.schemaVersion===DOCUMENT_SCHEMA&&typeof v.requestId==='string'&&/^xifile_[a-f0-9-]{36}$/i.test(v.requestId)
    &&typeof v.filename==='string'&&v.filename.length<=255&&!/[\\/\x00-\x1f]/.test(v.filename)&&isOfficeDocument(v.filename)
    &&v.bytes instanceof Uint8Array&&v.bytes.byteLength<=DOCUMENT_MAX_INPUT;
}
export function validDocumentResult(value:unknown,id:string):value is DocumentExtraction {
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  const v=value as Record<string,unknown>;
  if(v.schemaVersion!==DOCUMENT_SCHEMA||v.requestId!==id)return false;
  if(v.ok===false)return Object.keys(v).length===4&&typeof v.error==='string'&&['unsupported','parse_failed','needs_ocr','too_large','empty','cancelled','timeout','unavailable','text_unreadable'].includes(v.error);
  return v.ok===true&&Object.keys(v).length===7&&['docx','pdf','xlsx','pptx'].includes(String(v.format))
    &&v.parser==='hana-anydoc-0.1.2'&&typeof v.markdown==='string'&&new TextEncoder().encode(v.markdown).length<=DOCUMENT_MAX_OUTPUT
    &&Array.isArray(v.warnings)&&v.warnings.length<=4&&v.warnings.every(x=>typeof x==='string'&&x.length<=120);
}
