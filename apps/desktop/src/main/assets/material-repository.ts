import {createHash,randomUUID} from 'node:crypto';
import {MATERIALS_SCHEMA,MATERIAL_PAGE_SIZE,materialTerms,type MaterialQuery,type MaterialBodyQuery,type MaterialPage,type MaterialBody} from '../../shared/materials';
import type {TeacherResource,ResourceChunk} from '../../shared/contracts';
import {DOCUMENT_SCHEMA,DOCUMENT_MAX_INPUT,DOCUMENT_MAX_OUTPUT,isOfficeDocument} from '../../shared/xiaozhi-documents';
import {extractLocalDocument} from '../xiaozhi-agent/document-host';
import type {MaterialSource,MaterialSourceView} from '../../shared/materials';
import {EDUCATION_SEARCH_MAX_BYTES,EDUCATION_SEARCH_MAX_UNITS} from '../../shared/education-capabilities';
import {materialBodyVersion,type MaterialReadingUnit} from './material-source';
import type {MaterialOcrPage,MaterialOcrProgress} from '../../shared/material-pdf-ocr';
import {readMaterialOriginal} from './material-original';
import type {MaterialParseLease} from './material-parse-queue';
export type MaterialReadingSnapshot={units:MaterialReadingUnit[];fingerprint:string};

type Row=Record<string,unknown>;
type SqlValue=string|number|null;
export type MaterialRepositoryHost={
 root:string;all:(sql:string,params?:SqlValue[])=>Promise<Row[]>;
 mapResource:(row:Row)=>TeacherResource;mapChunk:(row:Row)=>ResourceChunk;
 commit:(id:string,content:string,engine:string,hash:string,signal:AbortSignal,pages?:MaterialOcrPage[],lease?:MaterialParseLease)=>Promise<void>;
 reuse:(id:string,engine:string,lease?:MaterialParseLease)=>Promise<void>;
 failure:(id:string,code:string,lease?:MaterialParseLease)=>Promise<void>;
};
/** Business adapter only: same SQLite facts and existing Hana worker, no runtime. */
export class MaterialRepository {
 progress?:MaterialOcrProgress;
 private readonly active=new Set<string>();
 private readonly host:MaterialRepositoryHost;
 constructor(host:MaterialRepositoryHost){this.host=host;}
 /** Reuse only the same named immutable content with an intact managed original. */
 async duplicate(name:string,hash:string,size:number,signal:AbortSignal):Promise<TeacherResource|undefined>{
  const rows=await this.host.all(`SELECT r.*, (SELECT COUNT(*) FROM resource_chunks c WHERE c.resource_id=r.id) AS chunk_count FROM teacher_resources r WHERE original_file_name=? AND content_hash=? AND file_size=? ORDER BY created_at,r.id LIMIT 8`,[name,hash,size]);
  for(const row of rows){signal.throwIfAborted();const resource=this.host.mapResource(row);
   try{await this.original(resource.id,hash,signal);signal.throwIfAborted();return resource;}catch(error){if(signal.aborted)throw error;}
  }
 }
 async resource(id:string):Promise<TeacherResource>{
  const row=(await this.host.all(`SELECT r.*, (SELECT COUNT(*) FROM resource_chunks c WHERE c.resource_id=r.id) AS chunk_count FROM teacher_resources r WHERE r.id=?`,[id]))[0];
  if(!row)throw new Error('material_not_found');return this.host.mapResource(row);
 }
 async original(id:string,version:string,signal:AbortSignal):Promise<Buffer>{
  const resource=await this.resource(id);if(resource.contentHash!==version)throw new Error('source_changed');
  const bytes=await readMaterialOriginal(this.host.root,resource.localPath,version,signal,DOCUMENT_MAX_INPUT);
  signal.throwIfAborted();const after=await this.resource(id);
  if(after.contentHash!==version||after.localPath!==resource.localPath)throw new Error('source_changed');return bytes;
 }
 async list(input:MaterialQuery):Promise<MaterialPage>{
  // instr treats %, _ and backslashes literally; all user terms are bound parameters.
  const terms=materialTerms(input.query),params:SqlValue[]=[];
  const where=terms.length?'WHERE '+terms.map(term=>{params.push(term);return `instr(lower(r.title || ' ' || r.original_file_name || ' ' || r.resource_type), ?) > 0`;}).join(' AND '):'';
  const total=Number((await this.host.all(`SELECT COUNT(*) AS n FROM teacher_resources r ${where}`,params))[0]?.n||0);
  const rows=await this.host.all(`SELECT r.*, (SELECT COUNT(*) FROM resource_chunks c WHERE c.resource_id=r.id) AS chunk_count FROM teacher_resources r ${where} ORDER BY r.updated_at DESC,r.id DESC LIMIT ? OFFSET ?`,[...params,MATERIAL_PAGE_SIZE,input.offset]);
  return {schemaVersion:MATERIALS_SCHEMA,resources:rows.map(this.host.mapResource),total,offset:input.offset,hasMore:input.offset+rows.length<total};
 }
 async body(input:MaterialBodyQuery):Promise<MaterialBody>{
  const resource=await this.resource(input.resourceId);
  // Failed/incomplete contents must never masquerade as committed excerpts.
  const readable=['ready','parsed','chunked','indexed','graph_extracted'].includes(resource.parseStatus);
  const rows=readable?await this.host.all(`SELECT c.*,r.title AS resource_title FROM resource_chunks c JOIN teacher_resources r ON r.id=c.resource_id WHERE c.resource_id=? ORDER BY c.chunk_index ASC,c.id ASC LIMIT ? OFFSET ?`,[resource.id,10,input.offset]):[];
  const total=readable?resource.chunkCount:0;
  return {schemaVersion:MATERIALS_SCHEMA,resource,chunks:rows.map(this.host.mapChunk),total,offset:input.offset,hasMore:input.offset+rows.length<total};
 }
 /** One SQLite statement is a consistent snapshot across resources and derivatives. */
 async readingSnapshot(resourceId?:string):Promise<MaterialReadingSnapshot>{
  if(resourceId)await this.resource(resourceId);
  const rows=await this.host.all(`SELECT c.*,r.title AS resource_title,r.original_file_name AS source_name,r.content_hash AS source_version,r.parse_status AS source_status FROM resource_chunks c JOIN teacher_resources r ON r.id=c.resource_id
   WHERE r.parse_status IN ('ready','parsed','chunked','indexed','graph_extracted') ${resourceId?'AND r.id=?':''} ORDER BY r.id,c.chunk_index,c.id LIMIT ?`,[...(resourceId?[resourceId]:[]),EDUCATION_SEARCH_MAX_UNITS+1]);
  if(rows.length>EDUCATION_SEARCH_MAX_UNITS)throw new Error('too_large');
  let bytes=0,last='',offset=0;const units:MaterialReadingUnit[]=[];
  for(const row of rows){const chunk=this.host.mapChunk(row);bytes+=Buffer.byteLength(chunk.contentMd,'utf8');if(bytes>EDUCATION_SEARCH_MAX_BYTES)throw new Error('too_large');
   if(chunk.resourceId!==last){last=chunk.resourceId;offset=0;}
   units.push({resourceId:chunk.resourceId,version:String(row.source_version),title:String(row.source_name),offset:offset++,chunk});
  }
  return {units,fingerprint:createHash('sha256').update(JSON.stringify(rows)).digest('hex')};
 }
 async source(input:MaterialSource):Promise<MaterialSourceView>{
  const body=await this.body({schemaVersion:MATERIALS_SCHEMA,resourceId:input.resourceId,offset:input.offset});
  const chunk=body.chunks[0];
  if(body.resource.contentHash!==input.version||!chunk||chunk.id!==input.chunkId||materialBodyVersion(chunk)!==input.bodyVersion)throw new Error('source_changed');
  const after=await this.resource(input.resourceId);
  if(after.contentHash!==body.resource.contentHash||after.parseStatus!==body.resource.parseStatus)throw new Error('source_changed');
  return {source:input,body:{...body,chunks:[chunk],hasMore:input.offset+1<body.total}};
 }
 async ingest(id:string,signal:AbortSignal,lease?:MaterialParseLease):Promise<TeacherResource>{
  if(this.active.has(id))throw new Error('material_busy');this.active.add(id);
  try{
   const resource=await this.resource(id);let failure:string|undefined;
   try{
    signal.throwIfAborted();
    {
     const bytes=await this.original(id,resource.contentHash,signal);signal.throwIfAborted();
     const hash=createHash('sha256').update(bytes).digest('hex');
     if(hash!==resource.contentHash)failure='source_changed';
     else if(resource.chunkCount>0&&['ready','parsed','chunked','indexed','graph_extracted'].includes(resource.parseStatus))return resource;
     else if(resource.chunkCount>0&&/:(missing|source_changed)$/.test(resource.parseEngine)){
      signal.throwIfAborted();await this.host.reuse(id,resource.parseEngine.split(':')[0],lease);
     }
     else if(resource.chunkCount>0)failure='partial_existing';
     else {
      let content='',engine='local-text-v1',pages:MaterialOcrPage[]|undefined;
      if(/\.(txt|md)$/i.test(resource.originalFileName)){
       if(bytes.length>DOCUMENT_MAX_OUTPUT)failure='too_large';
       else {try{content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{failure='text_unreadable';}}
      } else if(isOfficeDocument(resource.originalFileName)){
       const parsed=await extractLocalDocument({schemaVersion:DOCUMENT_SCHEMA,requestId:`xifile_${randomUUID()}`,filename:resource.originalFileName,bytes},signal);
       if(parsed.ok){content=parsed.markdown;engine=parsed.parser;}
       else if(parsed.error==='needs_ocr'&&/\.pdf$/i.test(resource.originalFileName)){
        const {recognizeLocalPdf}=await import('../xiaozhi-agent/ocr-host');
        const ocr=await recognizeLocalPdf(bytes,signal,value=>{this.progress=value;},this.host.root);
        pages=ocr.pages;content=pages.map(page=>page.text).join('\n\n');engine=ocr.engine;
       }else failure=parsed.error;
      } else failure='unsupported';
      if(!failure){if(!content.trim())failure='empty';else {signal.throwIfAborted();await this.original(id,hash,signal);await this.host.commit(id,content,engine,hash,signal,pages,lease);}}
     }
    }
   }catch(error){const code=error instanceof Error?error.message:'';failure=signal.aborted?'cancelled':['source_changed','partial_existing','too_large','empty','configuration','timeout','busy','unavailable'].includes(code)?code:code==='missing'||['ENOENT','EACCES','EPERM'].includes(String((error as {code?:unknown})?.code))?'missing':'parse_failed';}
   if(failure)await this.host.failure(id,failure,lease);
   return await this.resource(id);
  }finally{this.progress=undefined;this.active.delete(id);}
 }
}
