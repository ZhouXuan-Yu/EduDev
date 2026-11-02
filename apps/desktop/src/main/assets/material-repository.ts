import {MATERIAL_STUDY_SCHEMA,studyRevision,validStudySave,type MaterialStudySave,type MaterialStudyView,type MaterialStudyEntry,type MaterialStudyPage} from '../../shared/material-study';
import {validMaterialSource} from '../../shared/materials';
import {materialSource} from './material-source';
import {extractWord} from './word-host';
import {wordText,WORD_PARSER,type WordPayload} from '../../shared/material-word';
import {createHash,randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import {MATERIALS_SCHEMA,MATERIAL_PAGE_SIZE,materialTerms,type MaterialQuery,type MaterialBodyQuery,type MaterialPage,type MaterialBody} from '../../shared/materials';
import type {TeacherResource,ResourceChunk} from '../../shared/contracts';
import {DOCUMENT_SCHEMA,DOCUMENT_MAX_INPUT,DOCUMENT_MAX_OUTPUT,isOfficeDocument} from '../../shared/xiaozhi-documents';
import {extractLocalDocument} from '../xiaozhi-agent/document-host';
import type {MaterialReference,MaterialSource,MaterialSourceView} from '../../shared/materials';
import {validAiTextSource,type AiTextSource} from '../../shared/material-ai-text';
import type {AiPageView} from '../../shared/material-ai-page';
import {EDUCATION_SEARCH_MAX_BYTES,EDUCATION_SEARCH_MAX_UNITS} from '../../shared/education-capabilities';
import {materialBodyVersion,type MaterialReadingUnit} from './material-source';
import type {MaterialOcrPage,MaterialOcrProgress} from '../../shared/material-pdf-ocr';
import {readMaterialOriginal,verifyMaterialOriginal} from './material-original';
import type {MaterialParseLease} from './material-parse-queue';
import {saveImageOcr} from './material-image-ocr';
export type MaterialReadingSnapshot={units:MaterialReadingUnit[];fingerprint:string};

type Row=Record<string,unknown>;
type SqlValue=string|number|null;
export type MaterialRepositoryHost={
 restored?:(source:AiTextSource)=>Promise<AiPageView>;
 root:string;change:(sql:string,params?:SqlValue[])=>Promise<number>;all:(sql:string,params?:SqlValue[])=>Promise<Row[]>;
 mapResource:(row:Row)=>TeacherResource;mapChunk:(row:Row)=>ResourceChunk;
 commit:(id:string,content:string,engine:string,hash:string,signal:AbortSignal,pages?:MaterialOcrPage[],lease?:MaterialParseLease,word?:WordPayload)=>Promise<void>;
 reuse:(id:string,engine:string,lease?:MaterialParseLease)=>Promise<void>;
 failure:(id:string,code:string,lease?:MaterialParseLease)=>Promise<void>;
 pdf?:(resource:TeacherResource,signal:AbortSignal,lease?:MaterialParseLease)=>Promise<TeacherResource>;
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
   try{await verifyMaterialOriginal(this.host.root,resource.localPath,hash,signal);signal.throwIfAborted();const after=await this.resource(resource.id);if(after.contentHash===hash&&after.localPath===resource.localPath)return after;}catch(error){if(signal.aborted)throw error;}
  }
 }
 async resource(id:string):Promise<TeacherResource>{
  const row=(await this.host.all(`SELECT r.*, (SELECT COUNT(*) FROM resource_chunks c WHERE c.resource_id=r.id) AS chunk_count FROM teacher_resources r WHERE r.id=?`,[id]))[0];
  if(!row)throw new Error('material_not_found');return this.host.mapResource(row);
 }
 /** Conservative reference-use gate; no private chunk contents or local paths cross IPC. */
 async privateResourceIds(ids:string[]):Promise<string[]>{
  if(ids.length>50||ids.some(id=>!/^resource_[a-f0-9-]{36}$/i.test(id)))throw Error('invalid_input');
  if(!ids.length)return [];
  return (await this.host.all(`SELECT DISTINCT resource_id FROM resource_chunks WHERE contains_personal_data<>0 AND resource_id IN (${ids.map(()=>'?').join(',')})`,ids)).map(row=>String(row.resource_id));
 }
 async original(id:string,version:string,signal:AbortSignal):Promise<Buffer>{
  const resource=await this.resource(id);if(resource.contentHash!==version)throw new Error('source_changed');
  const bytes=await readMaterialOriginal(this.host.root,resource.localPath,version,signal,DOCUMENT_MAX_INPUT);
  signal.throwIfAborted();const after=await this.resource(id);
  if(after.contentHash!==version||after.localPath!==resource.localPath)throw new Error('source_changed');return bytes;
 }
 async verify(id:string,version:string,signal:AbortSignal){const resource=await this.resource(id);if(resource.contentHash!==version)throw new Error('source_changed');await verifyMaterialOriginal(this.host.root,resource.localPath,version,signal);const after=await this.resource(id);if(after.contentHash!==version||after.localPath!==resource.localPath)throw new Error('source_changed');}
 async originalStamp(id:string,version:string){const resource=await this.resource(id),root=path.resolve(this.host.root),file=path.resolve(resource.localPath);if(resource.contentHash!==version||path.dirname(file)!==root)throw new Error('source_changed');const stat=await fs.lstat(file,{bigint:true});if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1n||(await fs.realpath(file)).toLowerCase()!==file.toLowerCase()||(await fs.realpath(root)).toLowerCase()!==root.toLowerCase())throw new Error('missing');return[stat.dev,stat.ino,stat.size,stat.mtimeNs,stat.ctimeNs].map(String).join(':');}
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
  const readable=['ready','partial','parsed','chunked','indexed','graph_extracted'].includes(resource.parseStatus);
  const rows=readable?await this.host.all(`SELECT c.*,r.title AS resource_title FROM resource_chunks c JOIN teacher_resources r ON r.id=c.resource_id WHERE c.resource_id=? ORDER BY c.chunk_index ASC,c.id ASC LIMIT ? OFFSET ?`,[resource.id,10,input.offset]):[];
  const total=readable?resource.chunkCount:0;
  return {schemaVersion:MATERIALS_SCHEMA,resource,chunks:rows.map(this.host.mapChunk),total,offset:input.offset,hasMore:input.offset+rows.length<total};
 }
 /** Metadata-only page authority: never materialize the book's text to authorize OCR. */
 async pageReadAccess(resourceId:string,page:number){
  const row=(await this.host.all(`SELECT r.content_hash AS version,r.parse_status AS status,
   EXISTS(SELECT 1 FROM resource_chunks c WHERE c.resource_id=r.id) AS has_body,
   EXISTS(SELECT 1 FROM resource_chunks c WHERE c.resource_id=r.id AND c.page_number=?) AS has_page,
   EXISTS(SELECT 1 FROM resource_chunks c WHERE c.resource_id=r.id AND c.contains_personal_data<>0 AND (c.page_number IS NULL OR c.page_number=0 OR c.page_number=?)) AS private_page
   FROM teacher_resources r WHERE r.id=?`,[page,page,resourceId]))[0];
  if(!row)throw new Error('material_not_found');
  const eligible=Number(row.has_body)===1&&(['ready','parsed','chunked','indexed','graph_extracted'].includes(String(row.status))||row.status==='partial'&&Number(row.has_page)===1);
  return {version:String(row.version),eligible,privatePage:Number(row.private_page)!==0};
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
 source(input:MaterialSource):Promise<{source:MaterialSource;body:MaterialBody}>;
 source(input:AiTextSource):Promise<MaterialSourceView>;
 source(input:MaterialReference):Promise<MaterialSourceView>;
 async source(input:MaterialReference):Promise<MaterialSourceView>{
  if(validAiTextSource(input)){
   if(!this.host.restored)throw Error('unavailable');const restored=await this.host.restored(input);
   return{source:input,restored,body:{schemaVersion:MATERIALS_SCHEMA,resource:restored.resource,chunks:[],total:0,offset:0,hasMore:false}};
  }
  if(!validMaterialSource(input))throw Error('invalid_input');
  const body=await this.body({schemaVersion:MATERIALS_SCHEMA,resourceId:input.resourceId,offset:input.offset});
  const chunk=body.chunks[0];
  if(body.resource.contentHash!==input.version||!chunk||chunk.id!==input.chunkId||materialBodyVersion(chunk)!==input.bodyVersion)throw new Error('source_changed');
  const after=await this.resource(input.resourceId);
  if(after.contentHash!==body.resource.contentHash||after.parseStatus!==body.resource.parseStatus)throw new Error('source_changed');
  return {source:input,body:{...body,chunks:[chunk],hasMore:input.offset+1<body.total}};
 }
 /** Bounded per-resource window for durable extraction; offsets refer to the current ordered body. */
 async readingWindow(resourceId:string,offset:number,limit=16):Promise<MaterialReadingSnapshot&{hasMore:boolean}>{
  const resource=await this.resource(resourceId);if(!['ready','partial','parsed','chunked','indexed','graph_extracted'].includes(resource.parseStatus))throw new Error('unavailable');
  const rows=await this.host.all('SELECT c.*,r.title AS resource_title FROM resource_chunks c JOIN teacher_resources r ON r.id=c.resource_id WHERE c.resource_id=? ORDER BY c.chunk_index,c.id LIMIT ? OFFSET ?',[resourceId,limit+1,offset]);
  const units=rows.slice(0,limit).map((row,i)=>({resourceId,version:resource.contentHash,title:resource.originalFileName,offset:offset+i,chunk:this.host.mapChunk(row)}));
  return{units,hasMore:rows.length>limit,fingerprint:createHash('sha256').update(JSON.stringify(units)).digest('hex')};
 }


 async readingPage(input:MaterialBodyQuery):Promise<MaterialStudyPage>{
  const body=await this.body(input),chunk=body.chunks[0];
  if(!chunk)throw new Error('empty');
  const view=await this.source(materialSource({resourceId:body.resource.id,version:body.resource.contentHash,title:body.resource.title,offset:input.offset,chunk}));
  const row=(await this.host.all('SELECT note FROM material_reading_entries WHERE resource_id=? AND source_json=? ORDER BY sequence DESC LIMIT 1',[view.source.resourceId,JSON.stringify(view.source)]))[0];
  if(row&&(typeof row.note!=='string'||row.note.length>8000))throw new Error('unavailable');
  return {...view,...(row?{savedNote:String(row.note)}:{})};
 }
 async study(resourceId:string):Promise<MaterialStudyView>{
  await this.resource(resourceId);
  const row=(await this.host.all('SELECT * FROM material_reading_entries WHERE resource_id=? ORDER BY sequence DESC LIMIT 1',[resourceId]))[0];
  if(!row)return {schemaVersion:MATERIAL_STUDY_SCHEMA,stale:false};
  const source:unknown=JSON.parse(String(row.source_json));
  if(!validMaterialSource(source)||!studyRevision(row.id)||typeof row.note!=='string'||row.note.length>8000||![0,1].includes(Number(row.completed)))throw new Error('unavailable');
  const entry:MaterialStudyEntry={id:String(row.id),source,note:row.note,completed:Number(row.completed)===1,updatedAt:String(row.updated_at)};
  try{await this.source(source);return {schemaVersion:MATERIAL_STUDY_SCHEMA,entry,stale:false};}
  catch(error){if((error as Error).message!=='source_changed')throw error;return {schemaVersion:MATERIAL_STUDY_SCHEMA,entry,stale:true};}
 }
 async saveStudy(input:MaterialStudySave):Promise<MaterialStudyView>{
  if(!validStudySave(input))throw new Error('invalid_input');
  const source=input.source,view=await this.source(source),chunk=view.body.chunks[0];
  const id=`read_${randomUUID()}`,updatedAt=new Date().toISOString();
  // One SQLite statement owns source/CAS and revision ordering; no gap between checking and writing.
  const changed=await this.host.change(`INSERT INTO material_reading_entries (id,resource_id,source_json,note,completed,updated_at)
   SELECT ?,?,?,?,?,? WHERE EXISTS (
    SELECT 1 FROM teacher_resources r JOIN resource_chunks c ON c.resource_id=r.id
    WHERE r.id=? AND r.content_hash=? AND r.parse_status IN ('ready','partial','parsed','chunked','indexed','graph_extracted')
    AND c.id=? AND c.chunk_index=? AND c.content_md=? AND c.contains_personal_data=? AND coalesce(c.page_number,0)=?
    AND c.id=(SELECT id FROM resource_chunks WHERE resource_id=r.id ORDER BY chunk_index,id LIMIT 1 OFFSET ?)
   ) AND coalesce((SELECT id FROM material_reading_entries WHERE resource_id=? ORDER BY sequence DESC LIMIT 1),'')=?`,
   [id,source.resourceId,JSON.stringify(source),input.note,input.completed?1:0,updatedAt,source.resourceId,source.version,source.chunkId,chunk.chunkIndex,chunk.contentMd,chunk.containsPersonalData?1:0,chunk.pageNumber||0,source.offset,source.resourceId,input.expectedRevision||'']);
  if(changed!==1){await this.source(source);throw new Error('revision_conflict');}
  return {schemaVersion:MATERIAL_STUDY_SCHEMA,stale:false,entry:{id,source:{...source},note:input.note,completed:input.completed,updatedAt}};
 }

 async ingest(id:string,signal:AbortSignal,lease?:MaterialParseLease):Promise<TeacherResource>{
  if(this.active.has(id))throw new Error('material_busy');this.active.add(id);
  try{
   const resource=await this.resource(id);let failure:string|undefined;
   try{
    signal.throwIfAborted();
    if(this.host.pdf&&/\.pdf$/i.test(resource.originalFileName))return await this.host.pdf(resource,signal,lease);
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
      let content='',engine='local-text-v1',pages:MaterialOcrPage[]|undefined,word:WordPayload|undefined;
      if(/\.(txt|md)$/i.test(resource.originalFileName)){
       if(bytes.length>DOCUMENT_MAX_OUTPUT)failure='too_large';
       else {try{content=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{failure='text_unreadable';}}
      } else if(/\.(jpe?g|png|webp)$/i.test(resource.originalFileName)){
       const {recognizeLocalImage}=await import('../xiaozhi-agent/ocr-host');
       let ocr:Awaited<ReturnType<typeof recognizeLocalImage>>;
       try{ocr=await recognizeLocalImage(bytes,signal);}
       catch(error){
        if(!signal.aborted&&error instanceof Error&&['empty','parse_failed','configuration','too_large','invalid_input','timeout','unavailable'].includes(error.message)){
         await this.original(id,hash,signal);await saveImageOcr(this.host,id,hash,error,signal,lease);
        }
        throw error;
       }
       signal.throwIfAborted();await this.original(id,hash,signal);await saveImageOcr(this.host,id,hash,ocr,signal,lease);
       content=ocr.text;engine='image-'+ocr.engine;
       pages=[{page:1,text:ocr.text,width:ocr.width,height:ocr.height}];
      } else if(/\.docx$/i.test(resource.originalFileName)){
       const result=await extractWord(bytes,signal);if(!result.ok)failure=result.error;else{word=result.payload;content=wordText(word.document.blocks);engine=WORD_PARSER;}
      } else if(isOfficeDocument(resource.originalFileName)){
       const parsed=await extractLocalDocument({schemaVersion:DOCUMENT_SCHEMA,requestId:`xifile_${randomUUID()}`,filename:resource.originalFileName,bytes},signal);
       if(parsed.ok){content=parsed.markdown;engine=parsed.parser;}
       else if(parsed.error==='needs_ocr'&&/\.pdf$/i.test(resource.originalFileName)){
        const {recognizeLocalPdf}=await import('../xiaozhi-agent/ocr-host');
        const ocr=await recognizeLocalPdf(bytes,signal,value=>{this.progress=value;},this.host.root);
        pages=ocr.pages;content=pages.map(page=>page.text).join('\n\n');engine=ocr.engine;
       }else failure=parsed.error;
      } else failure='unsupported';
      if(!failure){if(!content.trim())failure='empty';else {signal.throwIfAborted();await this.original(id,hash,signal);await this.host.commit(id,content,engine,hash,signal,pages,lease,word);}}
     }
    }
   }catch(error){const code=error instanceof Error?error.message:'';failure=signal.aborted?'cancelled':['source_changed','partial_existing','too_large','empty','configuration','timeout','busy','unavailable','disk_full'].includes(code)?code:code==='missing'||['ENOENT','EACCES','EPERM'].includes(String((error as {code?:unknown})?.code))?'missing':'parse_failed';}
   if(failure)await this.host.failure(id,failure,lease);
   return await this.resource(id);
  }finally{this.progress=undefined;this.active.delete(id);}
 }
}
