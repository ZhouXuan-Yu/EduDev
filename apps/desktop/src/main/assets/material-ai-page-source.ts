import {createHash} from 'node:crypto';
import {MATERIAL_PAGE_SOURCE,MATERIAL_IMAGE_SOURCE,validMaterialPageSource,type MaterialPageSource,type AiPagePrompt} from '../../shared/material-ai-page';
import {validPdfFilePage} from '../../shared/material-pdf-file';
import {readImageOcr} from './material-image-ocr';
import {startsWithContinuationChoices,startsWithFirstSubquestion} from '../../shared/material-ai-continuation';
import {sourceLayoutSignature} from '../../shared/material-ai-source-layout';
type Host={all:(sql:string,p?:(string|number|null)[])=>Promise<Record<string,unknown>[]>};
const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
/** A real original page and its local parser receipt; never a fabricated OCR body chunk. */
export async function readAiPageSource(host:Host,resourceId:string,version:string,page:number){
 const resource=(await host.all('SELECT content_hash,original_file_name,parse_status FROM teacher_resources WHERE id=?',[resourceId]))[0];
 if(resource&&/\.(?:png|jpe?g|webp)$/i.test(String(resource.original_file_name))){
  if(page!==1||resource.content_hash!==version||!['ready','partial','parsed','chunked','indexed','graph_extracted','failed'].includes(String(resource.parse_status)))throw Error('source_incomplete');
  if((await host.all('SELECT 1 FROM resource_chunks WHERE resource_id=? AND contains_personal_data<>0 LIMIT 1',[resourceId])).length)throw Error('privacy_blocked');
  const receipt=await readImageOcr(host,resourceId,version),source:MaterialPageSource={schemaVersion:MATERIAL_IMAGE_SOURCE,resourceId,version,page:1,generation:receipt.generation,receiptSha:receipt.receiptSha};
  if(!validMaterialPageSource(source))throw Error('source_changed');return{source,text:receipt.text,selectedText:receipt.text,status:receipt.status,totalPages:1};
 }
 const r=(await host.all('SELECT j.generation,j.state,j.total,p.status,p.result_json,p.error,r.content_hash,r.parse_status,r.original_file_name FROM material_pdf_jobs j JOIN material_pdf_pages p ON p.generation=j.generation JOIN teacher_resources r ON r.id=j.resource_id WHERE j.resource_id=? AND j.version=? AND p.page=?',[resourceId,version,page]))[0];
 if(!r||r.content_hash!==version||!/\.pdf$/i.test(String(r.original_file_name))||!['complete','partial'].includes(String(r.state))||!['ready','partial','parsed','chunked','indexed','graph_extracted'].includes(String(r.parse_status))||!['complete','blank','failed','needs_review'].includes(String(r.status))||!Number.isSafeInteger(Number(r.total))||page>Number(r.total)||Number(r.total)>10000||typeof r.result_json!=='string'||Buffer.byteLength(r.result_json)>1048576)throw Error('source_incomplete');
 if((await host.all("SELECT 1 FROM resource_chunks WHERE resource_id=? AND contains_personal_data<>0 AND (page_number IS NULL OR typeof(page_number)<>'integer' OR page_number NOT BETWEEN 1 AND 10000 OR page_number=?) LIMIT 1",[resourceId,page])).length)throw Error('privacy_blocked');
 const source:MaterialPageSource={schemaVersion:MATERIAL_PAGE_SOURCE,resourceId,version,page,generation:String(r.generation),receiptSha:hash([r.generation,page,r.status,r.result_json,r.error])};if(!validMaterialPageSource(source))throw Error('source_changed');
 let raw:Record<string,unknown>={};try{if(r.result_json)raw=JSON.parse(r.result_json);}catch{throw Error('source_changed');}
 if(r.result_json&&(!validPdfFilePage(raw)||raw.status!==r.status||raw.error!==r.error)||!r.result_json&&r.status!=='failed')throw Error('source_changed');
 if(!raw||typeof raw!=='object'||Array.isArray(raw)||['text','nativeText','ocrText'].some(k=>raw[k]!==undefined&&typeof raw[k]!=='string'))throw Error('source_changed');
 const text=[...new Set([raw.text,raw.nativeText,raw.ocrText].filter((v):v is string=>typeof v==='string'&&v.length>0))].join('\n');if(Buffer.byteLength(text)>64000)throw Error('unit_too_large');
 return{source,text,selectedText:typeof raw.text==='string'?raw.text:'',status:String(r.status) as AiPagePrompt['ocrStatus'],totalPages:Number(r.total),
  ...(r.error==='text_conflict'&&typeof raw.nativeText==='string'&&typeof raw.ocrText==='string'?{conflictingText:{native:raw.nativeText,ocr:raw.ocrText}}:{})};
}
export async function validateAiPageSource(host:Host,source:MaterialPageSource){
 if(!validMaterialPageSource(source))throw Error('source_changed');const current=await readAiPageSource(host,source.resourceId,source.version,source.page);if(JSON.stringify(current.source)!==JSON.stringify(source))throw Error('source_changed');return current;
}
const parent=/^\s*(?:第\s*[0-9]{1,5}\s*题|[0-9]{1,5}\s*[.、．](?![0-9]))/u;
const section=/^[一二三四五六七八九十百]{1,4}(?:[、.．][ \t]*|[ \t]*)[^\r\n()（）:：?？]{1,48}[（(][1-9]\d{0,2}分[）)]$/u;
const fractionPageNumber=/^([1-9]\d{0,4})\s*[/／]\s*([1-9]\d{0,4})$/u;
const nextParent = /^(?:第\s*([1-9]\d{0,4})\s*题|([1-9]\d{0,4})\s*[.、．](?!\d))\s*(.*)$/u;

function openingParent(text:string,page:number,total:number){
 const lines=text.split(/\r?\n/u,3).map(line=>line.trim());
 const first=lines.findIndex(Boolean);
 if(first<0)return;
 const fraction=fractionPageNumber.exec(lines[first]);
 const header=fraction??/^第\s*([1-9]\d{0,4})\s*页\s*(?:共|[/／])\s*([1-9]\d{0,4})\s*页?$/u.exec(lines[first]);
 if(header&&(Number(header[1])!==page||Number(header[2])!==total))return;
 const line=lines[header?first+1:first]??'';
 const match=nextParent.exec(line);
 if(!match)return;
 const textKey=sourceLayoutSignature(match[3]);
 // A label, page fragment, or short numeric expression cannot prove a parent.
 if(textKey.length<12||[...textKey.matchAll(/\p{L}/gu)].length<4)return;
 return {number:Number(match[1]||match[2]),textKey,usesFraction:!!fraction};
}

/** A bare fraction can be math; confirm pagination on the authenticated
 * preceding page before stripping it from either next-page reading. */
async function precedingPageHasCounter(host:Host,source:MaterialPageSource,totalPages:number){
 const previous=await validateAiPageSource(host,source);
 const streams=previous.conflictingText?Object.values(previous.conflictingText):[previous.text];
 return streams.some(stream=>{
  const lines=stream.trim().split(/\r?\n/u);
  return [lines[0],lines.at(-1)].some(line=>{
   const marker=fractionPageNumber.exec(line?.trim()??'');
   return !!marker&&Number(marker[1])===source.page&&Number(marker[2])===totalPages;
  });
 });
}

export type FollowingPageBoundary={status:'separate'|'continued'|'unknown';nextParentSource?:MaterialPageSource;choiceLead?:true;firstSubquestionLead?:true};
/** A conflicted next page may independently prove its opening parent. The
 * evidence concerns this boundary only; its own text stays in needs_review. */
export async function readFollowingPageBoundary(host:Host,source:MaterialPageSource,totalPages:number,priorNumber?:string):Promise<FollowingPageBoundary>{
 if(source.schemaVersion!==MATERIAL_PAGE_SOURCE||source.page>=totalPages)return {status:'separate'};
 try{
  const following=await readAiPageSource(host,source.resourceId,source.version,source.page+1);
  if(following.source.generation!==source.generation||following.totalPages!==totalPages)return {status:'unknown'};
  if(following.status==='needs_review'&&following.conflictingText&&priorNumber&&/^[1-9]\d{0,4}$/u.test(priorNumber)){
   const {native,ocr}=following.conflictingText;
   const a=openingParent(native,source.page+1,totalPages),b=openingParent(ocr,source.page+1,totalPages);
   if(a&&b&&a.number===Number(priorNumber)+1&&a.number===b.number&&a.textKey===b.textKey&&(!(a.usesFraction||b.usesFraction)||await precedingPageHasCounter(host,source,totalPages)))return {status:'separate',nextParentSource:following.source};
  }
  if(following.status!=='complete'||!following.text.trim())return {status:'unknown'};
  if(startsWithFirstSubquestion(following.selectedText))return {status:'unknown',firstSubquestionLead:true};
  if(/^\s*(?:[（(]\s*(?:[2-9]|[1-9][0-9])\s*[)）]|[②-⑳])/u.test(following.text))return {status:'continued'};
  if(startsWithContinuationChoices(following.text))return {status:'unknown',choiceLead:true};
  if(parent.test(following.text))return {status:'separate'};
  const lines=following.text.split(/\r?\n/).map(s=>s.trim()).filter(Boolean);
  // Do not skip arbitrary prose, captions, page headers or intervening continuation.
  return {status:section.test(lines[0]||'')&&parent.test(lines[1]||'')?'separate':'unknown'};
 }catch{return {status:'unknown'};}
}

export async function followingPageStatus(host:Host,source:MaterialPageSource,totalPages:number,priorNumber?:string){
 return (await readFollowingPageBoundary(host,source,totalPages,priorNumber)).status;
}
