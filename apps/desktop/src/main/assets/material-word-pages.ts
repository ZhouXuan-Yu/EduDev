import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import type {TeacherResource} from '../../shared/contracts';
import {WORD_PAGES_SCHEMA,WORD_PAGES_ENGINE,validWordPagesQuery,type WordPagesQuery,type WordPagesView} from '../../shared/material-word-pages';
import {verifyMaterialOriginal} from './material-original';
import {migrateWordPageSources} from './material-word-page-source';

type Row=Record<string,unknown>;
type Host={root:()=>string;all:(sql:string,values?:(string|number|null)[])=>Promise<Row[]>;run:(sql:string,values?:(string|number|null)[])=>Promise<void>;
 resource:(id:string)=>Promise<TeacherResource>;original:(id:string,version:string,signal:AbortSignal)=>Promise<Buffer>;
 stamp:(id:string,version:string)=>Promise<string>;verify:(id:string,version:string,signal:AbortSignal)=>Promise<void>;
 duplicate:(name:string,sha:string,bytes:number,signal:AbortSignal)=>Promise<TeacherResource|undefined>;
 publish:(file:string,signal:AbortSignal,guard:()=>Promise<void>)=>Promise<TeacherResource>;
 writer:<T>(action:(target:MaterialWordPagesRepository)=>Promise<T>)=>Promise<T>};
export type WordPdfRender=(bytes:Buffer,job:string,signal:AbortSignal)=>Promise<{sha256:string;bytes:number;pages:number}>;
const owned=new Set<string>();
const alive=(pid:number)=>{try{process.kill(pid,0);return true;}catch(error){return(error as NodeJS.ErrnoException).code!=='ESRCH';}};
const clock=()=>new Date().toISOString();
const failure=(error:unknown)=>{const value=error instanceof Error?error.message:'';return ['source_changed','unsupported','too_large','cancelled','busy','disk_full','unavailable','timeout','parse_failed','material_not_found'].includes(value)?value:'parse_failed';};

/** Durable conversion receipts reference ordinary PDF resources and preserve every earlier snapshot. */
export class MaterialWordPagesRepository{
 constructor(private host:Host){}
 async migrate(){
  await migrateWordPageSources(this.host);
 }
 private directory(id:string){
  if(!/^wpg_[a-f0-9-]{36}$/.test(id))throw Error('source_changed');
  return path.join(this.host.root(),'cache','word-pages',id);
 }
 private async pdf(row:Row){
  if(!row.pdf_resource_id)return;
  const pdf=await this.host.resource(String(row.pdf_resource_id)).catch(()=>undefined);
  return pdf&&pdf.contentHash===row.pdf_sha&&pdf.fileSize===Number(row.pdf_bytes)&&pdf.originalFileName===row.pdf_name?pdf:undefined;
 }
 async view(input:WordPagesQuery):Promise<WordPagesView|undefined>{
  if(!validWordPagesQuery(input))throw Error('invalid_input');
  const resource=await this.host.resource(input.resourceId);if(resource.contentHash!==input.version)throw Error('source_changed');
  const original=/\.docx$/i.test(resource.originalFileName);
  const row=(await this.host.all(original?'SELECT * FROM material_word_page_sources WHERE resource_id=? AND version=? AND engine=? ORDER BY rowid DESC LIMIT 1':"SELECT * FROM material_word_page_sources WHERE pdf_resource_id=? AND pdf_sha=? OR pdf_resource_id='' AND pdf_sha=? AND pdf_bytes=? AND pdf_name=? ORDER BY rowid DESC LIMIT 1",original?[resource.id,input.version,WORD_PAGES_ENGINE]:[resource.id,input.version,input.version,resource.fileSize,resource.originalFileName]))[0];
  if(!original&&!row)return;
  const stale=row?.status==='running'&&(!alive(Number(row.owner_pid))||Number(row.owner_pid)===process.pid&&!owned.has(String(row.id)));
  const pdf=row?await this.pdf(row):undefined;
  const parent=original?resource:await this.host.resource(String(row.resource_id)).catch(()=>undefined);
  return{schemaVersion:WORD_PAGES_SCHEMA,role:original?'original':'pages',status:stale?'interrupted':row?String(row.status) as WordPagesView['status']:'idle',
   error:stale?'interrupted':String(row?.error||''),original:{id:String(row?.resource_id||resource.id),version:String(row?.version||input.version),name:String(row?.original_name||resource.originalFileName)},originalAvailable:!!parent&&parent.contentHash===String(row?.version||input.version),...(pdf?{pdf}:{}),...(Number(row?.pages)>0?{pages:Number(row.pages)}:{})};
 }
 async prepare(input:WordPagesQuery,render:WordPdfRender,signal:AbortSignal):Promise<WordPagesView>{
  if(!validWordPagesQuery(input))throw Error('invalid_input');
  const resource=await this.host.resource(input.resourceId);
  if(!/\.docx$/i.test(resource.originalFileName))throw Error('unsupported');
  const bytes=await this.host.original(resource.id,input.version,signal),stamp=await this.host.stamp(resource.id,input.version);
  const guard=async()=>{signal.throwIfAborted();if(await this.host.stamp(resource.id,input.version)!==stamp)throw Error('source_changed');};
  const history=await this.host.all('SELECT * FROM material_word_page_sources WHERE resource_id=? AND version=? AND engine=? ORDER BY rowid DESC LIMIT 1',[resource.id,input.version,WORD_PAGES_ENGINE]);
  const prior=history[0];
  if(prior?.status==='complete'){
   const pdf=await this.pdf(prior);
   if(pdf)try{await this.host.verify(pdf.id,pdf.contentHash,signal);await guard();return(await this.view(input))!;}catch(error){signal.throwIfAborted();}
  }
  let claimed:string|undefined;
  const nonce=randomUUID();
  let row:Row;
  try{
   row=await this.host.writer(async target=>{
    await guard();
    const latest=(await target.host.all('SELECT * FROM material_word_page_sources WHERE resource_id=? AND version=? AND engine=? ORDER BY rowid DESC LIMIT 1',[resource.id,input.version,WORD_PAGES_ENGINE]))[0];
    if(latest?.status==='running'&&alive(Number(latest.owner_pid))&&(Number(latest.owner_pid)!==process.pid||owned.has(String(latest.id))))throw Error('busy');
    // A completed snapshot is immutable. An interrupted unpublished conversion can recover its exact file.
    const resume=latest&&latest.status!=='complete';
    const id=resume?String(latest.id):'wpg_'+randomUUID();
    const name=Array.from(resource.originalFileName.replace(/\.docx$/i,'')).slice(0,60).join('')+'-原版-'+resource.id.slice(-8)+'-'+input.version.slice(0,8)+'.pdf';
    if(resume)await target.host.run("UPDATE material_word_page_sources SET status='running',error='',owner_pid=?,owner_nonce=?,updated_at=? WHERE id=?",[process.pid,nonce,clock(),id]);
    else await target.host.run("INSERT INTO material_word_page_sources(id,resource_id,version,engine,original_name,status,owner_pid,owner_nonce,pdf_name,created_at,updated_at) VALUES(?,?,?,?,?,'running',?,?,?,?,?)",[id,resource.id,input.version,WORD_PAGES_ENGINE,resource.originalFileName,process.pid,nonce,name,clock(),clock()]);
    claimed=id;owned.add(id);
    return(await target.host.all('SELECT * FROM material_word_page_sources WHERE id=?',[id]))[0];
   });
  }catch(error){if(claimed)owned.delete(claimed);throw error;}
  const id=String(row.id),job=this.directory(id);
  const ownedGuard=async()=>{
   await guard();const current=(await this.host.all('SELECT status,owner_nonce FROM material_word_page_sources WHERE id=?',[id]))[0];
   if(current?.status!=='running'||current.owner_nonce!==nonce)throw Error('source_changed');
  };
  const change=async(action:(target:MaterialWordPagesRepository)=>Promise<void>)=>this.host.writer(async target=>{await ownedGuard();await action(target);await guard();});
  try{
   let pdf:TeacherResource|undefined;
   if(row.pdf_sha)pdf=await this.host.duplicate(String(row.pdf_name),String(row.pdf_sha),Number(row.pdf_bytes),signal);
   const file=path.join(job,String(row.pdf_name));
   if(!pdf){
    await fs.mkdir(job,{recursive:true});
    if((await fs.lstat(job)).isSymbolicLink()||(await fs.realpath(job)).toLowerCase()!==path.resolve(job).toLowerCase())throw Error('source_changed');
    let cached=false;
    if(row.pdf_sha)try{await verifyMaterialOriginal(job,file,String(row.pdf_sha),signal);cached=true;}catch(error){signal.throwIfAborted();}
    if(!cached){
     const result=await render(bytes,job,signal);await ownedGuard();
     const output=path.join(job,'rendered.pdf');await verifyMaterialOriginal(job,output,result.sha256,signal);
     await fs.rename(output,file);
     await change(target=>target.host.run('UPDATE material_word_page_sources SET pdf_sha=?,pdf_bytes=?,pages=?,updated_at=? WHERE id=?',[result.sha256,result.bytes,result.pages,clock(),id]));
     Object.assign(row,{pdf_sha:result.sha256,pdf_bytes:result.bytes,pages:result.pages});
    }
    await this.host.verify(resource.id,input.version,signal);await ownedGuard();
    pdf=await this.host.publish(file,signal,ownedGuard);
   }
   if(pdf.contentHash!==row.pdf_sha||pdf.fileSize!==Number(row.pdf_bytes)||pdf.originalFileName!==row.pdf_name)throw Error('source_changed');
   await this.host.verify(resource.id,input.version,signal);await this.host.verify(pdf.id,pdf.contentHash,signal);
   await change(target=>target.host.run("UPDATE material_word_page_sources SET pdf_resource_id=?,status='complete',owner_pid=0,owner_nonce='',error='',updated_at=? WHERE id=?",[pdf!.id,clock(),id]));
   // The ordinary resource archive now owns the PDF. Keep private files only for unfinished recovery.
   if(path.dirname(job)===path.join(path.resolve(this.host.root()),'cache','word-pages')){
    const real=await fs.realpath(job).catch(()=>undefined);
    if(real?.toLowerCase()===path.resolve(job).toLowerCase())await fs.rm(job,{recursive:true,force:true}).catch(()=>undefined);
   }
   return(await this.view(input))!;
  }catch(error){
   const code=signal.aborted?'cancelled':failure(error);
   await this.host.writer(target=>target.host.run("UPDATE material_word_page_sources SET status=?,error=?,owner_pid=0,owner_nonce='',updated_at=? WHERE id=? AND owner_nonce=?",[code==='cancelled'?'cancelled':'failed',code,clock(),id,nonce])).catch(()=>undefined);
   throw Error(code);
  }finally{owned.delete(id);}
 }
}
