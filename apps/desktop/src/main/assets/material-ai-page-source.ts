import {createHash} from 'node:crypto';
import {MATERIAL_PAGE_SOURCE,validMaterialPageSource,type MaterialPageSource} from '../../shared/material-ai-page';
import {validPdfFilePage} from '../../shared/material-pdf-file';
type Host={all:(sql:string,p?:(string|number|null)[])=>Promise<Record<string,unknown>[]>};
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
/** A real original page and its local parser receipt; never a fabricated OCR body chunk. */
export async function readAiPageSource(host:Host,resourceId:string,version:string,page:number){
 const r=(await host.all('SELECT j.generation,j.state,j.total,p.status,p.result_json,p.error,r.content_hash,r.parse_status,r.original_file_name FROM material_pdf_jobs j JOIN material_pdf_pages p ON p.generation=j.generation JOIN teacher_resources r ON r.id=j.resource_id WHERE j.resource_id=? AND j.version=? AND p.page=?',[resourceId,version,page]))[0];
 if(!r||r.content_hash!==version||!/\.pdf$/i.test(String(r.original_file_name))||!['complete','partial'].includes(String(r.state))||!['ready','partial','parsed','chunked','indexed','graph_extracted'].includes(String(r.parse_status))||!['complete','blank','failed','needs_review'].includes(String(r.status))||!Number.isSafeInteger(Number(r.total))||page>Number(r.total)||Number(r.total)>10000||typeof r.result_json!=='string'||Buffer.byteLength(r.result_json)>1048576)throw Error('source_incomplete');
 if((await host.all("SELECT 1 FROM resource_chunks WHERE resource_id=? AND contains_personal_data<>0 AND (page_number IS NULL OR typeof(page_number)<>'integer' OR page_number NOT BETWEEN 1 AND 10000 OR page_number=?) LIMIT 1",[resourceId,page])).length)throw Error('privacy_blocked');
 const source:MaterialPageSource={schemaVersion:MATERIAL_PAGE_SOURCE,resourceId,version,page,generation:String(r.generation),receiptSha:hash([r.generation,page,r.status,r.result_json,r.error])};if(!validMaterialPageSource(source))throw Error('source_changed');
 let raw:Record<string,unknown>={};try{if(r.result_json)raw=JSON.parse(r.result_json);}catch{throw Error('source_changed');}
 if(r.result_json&&(!validPdfFilePage(raw)||raw.status!==r.status||raw.error!==r.error)||!r.result_json&&r.status!=='failed')throw Error('source_changed');
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||['text','nativeText','ocrText'].some(k=>raw[k]!==undefined&&typeof raw[k]!=='string'))throw Error('source_changed');
 const text=[...new Set([raw.text,raw.nativeText,raw.ocrText].filter((v):v is string=>typeof v==='string'&&v.length>0))].join('\n');if(Buffer.byteLength(text)>64000)throw Error('unit_too_large');
 return{source,text};
}
export async function validateAiPageSource(host:Host,source:MaterialPageSource){
 if(!validMaterialPageSource(source))throw Error('source_changed');const current=await readAiPageSource(host,source.resourceId,source.version,source.page);if(JSON.stringify(current.source)!==JSON.stringify(source))throw Error('source_changed');return current;
}
