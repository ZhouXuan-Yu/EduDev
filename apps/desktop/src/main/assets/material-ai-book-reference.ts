import {createHash} from 'node:crypto';
import {BOOK_FINAL_REFERENCE_SCHEMA,validBookFinalReferences,type BookFinalReference,type BookFinalReferences} from '../../shared/material-ai-book-reference';
import {validMaterialBookRole,sameMaterialBookIdentity,type MaterialBookRole} from '../../shared/material-book-pair';
import type {AiUnitInput} from '../../shared/material-ai';
import type {AiPageResponse} from '../../shared/material-ai-page';
import {bookAnswerPage,bookSectionAt,bookSectionKey} from './material-book-answer-content';
import type {MaterialBookAnswerRepository} from './material-book-answer-repository';
import type {BookQuestionSectionEvidence,BookAnswerSectionEvidence} from './material-book-question-section';
import type {readAiPageReceipt} from './material-ai-page-evidence';
import {readingBodyComplete} from './material-ai-source-reading';
import type {PageCrop} from './material-ai-page-crops';

type Proof=Awaited<ReturnType<typeof readAiPageReceipt>>;type Value=string|number|null;
type Host={all:(sql:string,p?:Value[])=>Promise<Record<string,unknown>[]>;run:(sql:string,p?:Value[])=>Promise<void>;role:(id:string)=>Promise<MaterialBookRole|null>;receipt:(batch:string,ordinal:number)=>Promise<Proof>;books:MaterialBookAnswerRepository};
type EntryEvidence={number:string;batchId:string;ordinal:number;start:number;firstSha:string;finalSha:string;imageSha:string;source:NonNullable<AiUnitInput['pageSource']>;quoteSha:string;sectionContext?:BookAnswerSectionEvidence};
export type BookReferenceRecord={schemaVersion:'xiaozhi.material-ai-book-reference-record.v1';pair:MaterialBookRole;folderId:string;layoutLookup:boolean;payload:BookFinalReferences;questionSection?:BookQuestionSectionEvidence;evidence:EntryEvidence[]};
export const BOOK_REFERENCE_TABLE=`CREATE TABLE IF NOT EXISTS material_ai_book_references(batch_id TEXT NOT NULL,ordinal INTEGER NOT NULL,source_sha TEXT NOT NULL,context_json TEXT NOT NULL,context_sha TEXT NOT NULL,final_sha TEXT NOT NULL DEFAULT '',PRIMARY KEY(batch_id,ordinal),FOREIGN KEY(batch_id,ordinal) REFERENCES material_ai_units(batch_id,ordinal))`;
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
export const bookReferenceSourceSha=(unit:AiUnitInput,first:AiPageResponse,review:AiPageResponse)=>hash(JSON.stringify([unit.pageSource,first,review]));

/** Reuse answer index/section proofs; no new matching truth or AI executor. */
export async function collectBookReferences(host:Host,unit:AiUnitInput,first:AiPageResponse,review:AiPageResponse,crops:PageCrop[],folderId:string,signal:AbortSignal):Promise<BookReferenceRecord>{
 signal.throwIfAborted();const source=unit.pageSource,pair=source?await host.role(source.resourceId):null;
 if(!source||!pair||pair.kind!=='questions'||pair.questionVersion!==source.version)throw Error('source_changed');
 const payload:BookFinalReferences={schemaVersion:BOOK_FINAL_REFERENCE_SCHEMA,sourceSha256:bookReferenceSourceSha(unit,first,review),entries:[]},record:BookReferenceRecord={schemaVersion:'xiaozhi.material-ai-book-reference-record.v1',pair,folderId,layoutLookup:process.env.OMNI_EDU_BOOK_SECTION_LAYOUT!=='0',payload,evidence:[]};
 const authorized=!!folderId&&(await host.all("SELECT 1 FROM material_import_entries e JOIN teacher_resources r ON r.id=e.resource_id WHERE e.batch_id=? AND e.kind='file' AND e.status='saved' AND r.id=? AND r.content_hash=? LIMIT 1",[folderId,pair.answerId,pair.answerVersion])).length>0;
 if(authorized&&await host.books.index.pending())throw Error('index_busy');
 const a=bookAnswerPage(first,first).entries,b=bookAnswerPage(review,review).entries;
 // Existing bounded title inheritance is usable before question publication too.
 const current={unit,first,final:review} as Proof;
 const inherited=authorized&&a.some(e=>!e.section)&&b.some(e=>!e.section)?await host.books.sections.resolve(current,signal):undefined;
 if(inherited)record.questionSection=inherited;
 for(const q of review.questions){
  signal.throwIfAborted();const item:BookFinalReference={number:q.number,state:authorized?'unscoped':'outside_authorization',section:'',answer:'',analysis:'',page:0};payload.entries.push(item);
  if(!authorized)continue;
  const left=a.filter(e=>e.number===q.number),right=b.filter(e=>e.number===q.number),crop=crops.find(c=>c.number===q.number);
  if(first.pageIssues.length||review.pageIssues.length||q.issues.length||!crop||!readingBodyComplete(review,review,q,crop,unit.pagePrompt,crops)){item.state='unchecked';continue;}
  if(left.length!==1||right.length!==1||[...left,...right].some(e=>e.issues.includes('duplicate_number')))continue;
  const x=bookSectionAt(first.pageText,left[0].start),y=bookSectionAt(review.pageText,right[0].start);
  const section=left[0].section&&right[0].section&&bookSectionKey(left[0].section)===bookSectionKey(right[0].section)?right[0].section:x===undefined&&y===undefined?inherited?.section:undefined;
  if(!section)continue;item.section=section;
  const found=await host.books.index.find(pair.answerId,pair.answerVersion,bookSectionKey(section),q.number,record.layoutLookup);
  if(found.length!==1){item.state=found.length?'ambiguous':'not_found';continue;}
  const row=found[0],proof=await host.receipt(String(row.batch_id),Number(row.ordinal)),answerSource=proof.unit.pageSource;
  if(!answerSource||!sameAnswerPair(proof.unit.bookRole,pair))throw Error('source_changed');
  const derived=await host.books.sections.answerPage(proof,signal),entry=derived.page.entries.find(e=>e.start===Number(row.start)&&e.number===q.number&&e.sectionKey===String(row.section_key));
  if(!entry)throw Error('source_changed');
  if(!entry.agrees||entry.issues.some(i=>i!=='missing_analysis')||!entry.answer.trim()){item.state='unchecked';continue;}
  item.state='available';item.answer=entry.answer;item.analysis=entry.analysis;item.page=answerSource.page;
  record.evidence.push({number:q.number,batchId:String(row.batch_id),ordinal:Number(row.ordinal),start:entry.start,source:answerSource,firstSha:proof.firstSha,finalSha:proof.finalSha,imageSha:proof.imageSha,quoteSha:hash(entry.quote),...(derived.context?{sectionContext:derived.context}:{})});
 }
 if(!validBookFinalReferences(payload))throw Error('unit_too_large');return record;
}
function sameAnswerPair(role:MaterialBookRole|undefined,pair:MaterialBookRole){return process.env.OMNI_EDU_BOOK_REFERENCE_RESTORE==='0'?JSON.stringify(role)===JSON.stringify({...pair,kind:'answers'}):sameMaterialBookIdentity(role,{...pair,kind:'answers'});}

/** Validate a frozen selection; never silently substitute newer answers on resume/cold read. */
export async function validateBookReferenceRecord(host:Host,record:BookReferenceRecord,unit:AiUnitInput,first:AiPageResponse,review:AiPageResponse,signal:AbortSignal){
 return validateReference(host,record,unit,first,review,signal,false);
}
/** Historical mode is available only after an authenticated published receipt
 * and its exact saved reference/final digest have been reopened. Never dispatch
 * or publish using this reader; live callers keep the exact revision fence. */
export async function readArchivedBookReferenceRecord(host:Host,batchId:string,ordinal:number,proof:Proof,signal:AbortSignal){
 signal.throwIfAborted();
 if(!proof.review||!['complete','review','no_questions'].includes(proof.status)||!proof.finalRaw||hash(proof.finalRaw)!==proof.finalSha)throw Error('source_changed');
 const record=await readBookReferenceRecord(host,batchId,ordinal,bookReferenceSourceSha(proof.unit,proof.first,proof.review),proof.finalRaw);
 if(!record)throw Error('source_changed');
 await validateReference(host,record,proof.unit,proof.first,proof.review,signal,process.env.OMNI_EDU_BOOK_REFERENCE_RESTORE!=='0');
 return record;
}
async function validateReference(host:Host,record:BookReferenceRecord,unit:AiUnitInput,first:AiPageResponse,review:AiPageResponse,signal:AbortSignal,archived:boolean){
 signal.throwIfAborted();
 if(!record||record.schemaVersion!=='xiaozhi.material-ai-book-reference-record.v1'||typeof record.folderId!=='string'||!/^batch_[a-f0-9-]{36}$/i.test(record.folderId)||typeof record.layoutLookup!=='boolean'||!validMaterialBookRole(record.pair)||record.pair.kind!=='questions'||!validBookFinalReferences(record.payload)||record.payload.sourceSha256!==bookReferenceSourceSha(unit,first,review)||(archived?!sameMaterialBookIdentity(record.pair,await host.role(unit.pageSource!.resourceId)):JSON.stringify(record.pair)!==JSON.stringify(await host.role(unit.pageSource!.resourceId)))||!Array.isArray(record.evidence)||record.evidence.length!==record.payload.entries.filter(e=>e.state==='available').length||new Set(record.evidence.map(e=>e?.number)).size!==record.evidence.length)throw Error('source_changed');
 if(JSON.stringify(record.payload.entries.map(e=>e.number))!==JSON.stringify(review.questions.map(q=>q.number)))throw Error('source_changed');
 if(record.questionSection||record.evidence.some(e=>e.sectionContext)){if(await host.books.index.referencePending(unit.pageSource!))throw Error('source_incomplete');}
 if(record.questionSection&&JSON.stringify(await host.books.sections.resolve({unit,first,final:review} as Proof,signal))!==JSON.stringify(record.questionSection))throw Error('source_changed');
 for(const e of record.evidence){
  const item=record.payload.entries.find(x=>x.number===e.number&&x.state==='available');if(!item)throw Error('source_changed');
  if(!(await host.all("SELECT 1 FROM material_import_entries e JOIN teacher_resources r ON r.id=e.resource_id WHERE e.batch_id=? AND e.kind='file' AND e.status='saved' AND r.id=? AND r.content_hash=? LIMIT 1",[record.folderId,record.pair.answerId,record.pair.answerVersion])).length)throw Error('source_changed');
  const found=await host.books.index.find(record.pair.answerId,record.pair.answerVersion,bookSectionKey(item.section),e.number,record.layoutLookup);
  if(found.length!==1||found[0].batch_id!==e.batchId||Number(found[0].ordinal)!==e.ordinal||Number(found[0].start)!==e.start)throw Error('source_changed');
  const proof=await host.receipt(e.batchId,e.ordinal);
  if(!sameAnswerPair(proof.unit.bookRole,record.pair)||JSON.stringify(proof.unit.pageSource)!==JSON.stringify(e.source)||proof.firstSha!==e.firstSha||proof.finalSha!==e.finalSha||proof.imageSha!==e.imageSha)throw Error('source_changed');
  const derived=await host.books.sections.answerPage(proof,signal),entry=derived.page.entries.find(x=>x.start===e.start&&x.number===e.number);
  if(JSON.stringify(derived.context)!==JSON.stringify(e.sectionContext)||!entry||!entry.agrees||entry.issues.some(i=>i!=='missing_analysis')||entry.answer!==item.answer||entry.analysis!==item.analysis||e.source.page!==item.page||hash(entry.quote)!==e.quoteSha)throw Error('source_changed');
  if(e.sectionContext){const latest=await host.books.index.latestPage(e.source.resourceId,e.source.version,e.source.page);if(latest?.batch_id!==e.batchId||Number(latest?.ordinal)!==e.ordinal||!latest?.proof_sha)throw Error('source_changed');}
 }
}
export async function readBookReferenceRecord(host:Pick<Host,'all'>,batchId:string,ordinal:number,sourceSha:string,finalRaw?:string){
 const row=(await host.all('SELECT * FROM material_ai_book_references WHERE batch_id=? AND ordinal=?',[batchId,ordinal]))[0];if(!row)return;
 if(row.source_sha!==sourceSha||typeof row.context_json!=='string'||Buffer.byteLength(row.context_json)>128*1024||hash(row.context_json)!==row.context_sha||row.final_sha!==(finalRaw===undefined?'':hash(finalRaw)))throw Error('source_changed');
 try{return JSON.parse(row.context_json) as BookReferenceRecord;}catch{throw Error('source_changed');}
}
