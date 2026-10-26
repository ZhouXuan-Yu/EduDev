import {randomUUID} from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {TeacherResource} from '../../shared/contracts';
import {PDF_FILE_ENGINE,PDF_FILE_MAX_BYTES,type PdfFileEvent,type MaterialPdfStatus} from '../../shared/material-pdf-file';
import {parsePdfFile,pdfFileWorkerVersion} from '../xiaozhi-agent/pdf-file-host';
import {verifyMaterialOriginal} from './material-original';
import {splitMaterialText} from './material-chunks';
import type {MaterialParseLease} from './material-parse-queue';
type Row=Record<string,unknown>;type Value=string|number|null;
type Host={root:()=>string;all:(q:string,p?:Value[])=>Promise<Row[]>;run:(q:string,p?:Value[])=>Promise<void>;resource:(id:string)=>Promise<TeacherResource>;lease:(lease:MaterialParseLease)=>Promise<boolean>;infer:(title:string,heading:string,text:string)=>Row;enqueueQuestions:(id:string,hash:string,generation:string)=>Promise<void>;withWriter:<T>(action:(repo:MaterialPdfRepository)=>Promise<T>,beforeCommit?:()=>void)=>Promise<T>};
type Claim={resource:TeacherResource;generation:string;owner:string;lease?:MaterialParseLease;signal:AbortSignal};
const alive=(pid:number)=>{try{process.kill(pid,0);return true;}catch(error){return(error as NodeJS.ErrnoException).code!=='ESRCH';}};
const time=()=>new Date().toISOString();
/** Source-backed page staging. Publication is separate from page completion and question approval. */
export class MaterialPdfRepository{
 private host:Host;
 constructor(host:Host){this.host=host;}
 async migrate(){for(const q of [
  `CREATE TABLE IF NOT EXISTS material_pdf_jobs(resource_id TEXT PRIMARY KEY,generation TEXT NOT NULL,version TEXT NOT NULL,worker TEXT NOT NULL,total INTEGER NOT NULL DEFAULT 0,state TEXT NOT NULL DEFAULT 'pending',bytes INTEGER NOT NULL DEFAULT 0,owner_pid INTEGER NOT NULL DEFAULT 0,owner_nonce TEXT NOT NULL DEFAULT '',error TEXT NOT NULL DEFAULT '',updated_at TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS material_pdf_pages(generation TEXT NOT NULL,page INTEGER NOT NULL,status TEXT NOT NULL,attempts INTEGER NOT NULL DEFAULT 0,result_json TEXT NOT NULL DEFAULT '',bytes INTEGER NOT NULL DEFAULT 0,error TEXT NOT NULL DEFAULT '',PRIMARY KEY(generation,page))`,
  `CREATE TABLE IF NOT EXISTS material_pdf_chunks(id TEXT PRIMARY KEY,generation TEXT NOT NULL,page INTEGER NOT NULL,local_index INTEGER NOT NULL,heading TEXT NOT NULL,content_md TEXT NOT NULL,metadata_json TEXT NOT NULL,UNIQUE(generation,page,local_index))`,
  `CREATE INDEX IF NOT EXISTS material_pdf_page_state ON material_pdf_pages(generation,status,page)`,
  `CREATE INDEX IF NOT EXISTS material_pdf_chunk_order ON material_pdf_chunks(generation,page,local_index)`,
 ])await this.host.run(q);}
 async status(id:string):Promise<MaterialPdfStatus|undefined>{
  const job=(await this.host.all('SELECT * FROM material_pdf_jobs WHERE resource_id=?',[id]))[0];if(!job)return;
  const counts=await this.host.all('SELECT status,COUNT(*) n FROM material_pdf_pages WHERE generation=? GROUP BY status',[String(job.generation)]),count=(status:string)=>Number(counts.find(r=>r.status===status)?.n||0),complete=count('complete'),blank=count('blank'),review=count('needs_review'),failed=count('failed');
  const failures=(await this.host.all("SELECT page,error,attempts FROM material_pdf_pages WHERE generation=? AND status IN ('failed','needs_review') ORDER BY page LIMIT 10",[String(job.generation)])).map(r=>({page:Number(r.page),error:String(r.error),attempts:Number(r.attempts)}));
  return{generation:String(job.generation),total:Number(job.total),complete,blank,review,failed,pending:Math.max(0,Number(job.total)-complete-blank-review-failed),state:String(job.state),bytes:Number(job.bytes),failures};
 }
 async retryFailures(id:string,version:string){return this.host.withWriter(async target=>{
  const resource=await target.host.resource(id),job=(await target.host.all('SELECT * FROM material_pdf_jobs WHERE resource_id=?',[id]))[0];if(resource.contentHash!==version||!job||job.version!==version)throw new Error('source_changed');
  if(Number(job.owner_pid)>0&&alive(Number(job.owner_pid)))throw new Error('busy');
  const totals=(await target.host.all("SELECT COUNT(*) n,COALESCE(SUM(bytes),0) bytes FROM material_pdf_pages WHERE generation=? AND status IN ('failed','needs_review')",[String(job.generation)]))[0];if(!Number(totals.n))return;
  await target.host.run("DELETE FROM material_pdf_chunks WHERE generation=? AND page IN (SELECT page FROM material_pdf_pages WHERE generation=? AND status IN ('failed','needs_review'))",[String(job.generation),String(job.generation)]);
  await target.host.run("UPDATE material_pdf_pages SET status='pending',attempts=0,result_json='',bytes=0,error='' WHERE generation=? AND status IN ('failed','needs_review')",[String(job.generation)]);
  await target.host.run("UPDATE material_pdf_jobs SET state='interrupted',bytes=MAX(0,bytes-?),error='',updated_at=? WHERE resource_id=?",[Number(totals.bytes),time(),id]);
 });}
 private async guard(claim:Claim){
  claim.signal.throwIfAborted();if(claim.lease&&!await this.host.lease(claim.lease))throw new Error('cancelled');
  const row=(await this.host.all('SELECT * FROM material_pdf_jobs WHERE resource_id=?',[claim.resource.id]))[0],current=await this.host.resource(claim.resource.id);
  if(!row||row.generation!==claim.generation||row.owner_nonce!==claim.owner||row.version!==claim.resource.contentHash||current.contentHash!==claim.resource.contentHash||current.localPath!==claim.resource.localPath)throw new Error('source_changed');
  claim.signal.throwIfAborted();return row;
 }
 private async write<T>(claim:Claim,action:(repo:MaterialPdfRepository,job:Row)=>Promise<T>){return this.host.withWriter(async target=>{const job=await target.guard(claim),result=await action(target,job);await target.guard(claim);return result;},()=>claim.signal.throwIfAborted());}
 private async start(resource:TeacherResource,signal:AbortSignal,lease?:MaterialParseLease){
  const owner=randomUUID(),worker=pdfFileWorkerVersion();return this.host.withWriter(async target=>{
   signal.throwIfAborted();if(lease&&!await target.host.lease(lease))throw new Error('cancelled');const fresh=await target.host.resource(resource.id);if(fresh.contentHash!==resource.contentHash||fresh.localPath!==resource.localPath)throw new Error('source_changed');
   const old=(await target.host.all('SELECT * FROM material_pdf_jobs WHERE resource_id=?',[resource.id]))[0];if(old&&Number(old.owner_pid)>0&&alive(Number(old.owner_pid)))throw new Error('busy');
   const same=old&&old.version===resource.contentHash&&old.worker===worker,generation=same?String(old.generation):randomUUID();
   if(same)await target.host.run("UPDATE material_pdf_jobs SET state='processing',owner_pid=?,owner_nonce=?,error='',updated_at=? WHERE resource_id=?",[process.pid,owner,time(),resource.id]);
   else await target.host.run("INSERT INTO material_pdf_jobs(resource_id,generation,version,worker,state,owner_pid,owner_nonce,updated_at) VALUES(?,?,?,?,'processing',?,?,?) ON CONFLICT(resource_id) DO UPDATE SET generation=excluded.generation,version=excluded.version,worker=excluded.worker,total=0,state='processing',bytes=0,owner_pid=excluded.owner_pid,owner_nonce=excluded.owner_nonce,error='',updated_at=excluded.updated_at",[resource.id,generation,resource.contentHash,worker,process.pid,owner,time()]);
   await target.host.run("UPDATE material_pdf_pages SET status='failed',error='interrupted' WHERE generation=? AND status='processing'",[generation]);
   return{resource,generation,owner,lease,signal};
  });
 }
 private async accept(claim:Claim,event:PdfFileEvent){
  if(event.kind==='finished')return this.publish(claim);
  if(event.kind==='manifest')return this.write(claim,async(target,job)=>{if(Number(job.total)&&Number(job.total)!==event.total)throw new Error('source_changed');await target.host.run('UPDATE material_pdf_jobs SET total=?,updated_at=? WHERE resource_id=?',[event.total,time(),claim.resource.id]);});
  if(event.kind==='progress')return this.write(claim,async target=>{await target.host.run("INSERT INTO material_pdf_pages(generation,page,status,attempts) VALUES(?,?,'processing',1) ON CONFLICT(generation,page) DO UPDATE SET status='processing',attempts=attempts+1,error=''",[claim.generation,event.page]);});
  if(event.kind!=='page')return;
  const result=event.result,json=JSON.stringify(result),chunks=(result.status==='complete'?splitMaterialText(result.text):[]).map((c,index)=>({...c,index,id:'chunk_'+randomUUID(),metadata:this.host.infer(claim.resource.title,c.heading,c.content)})),bytes=Buffer.byteLength(json)+chunks.reduce((sum,c)=>sum+Buffer.byteLength(c.content)+Buffer.byteLength(JSON.stringify(c.metadata)),0);
  const space=await fs.statfs(this.host.root());if(Number(space.bavail)*Number(space.bsize)<bytes*4+64*1048576)throw new Error('disk_full');
  await this.write(claim,async(target,job)=>{
   const old=(await target.host.all('SELECT bytes,status FROM material_pdf_pages WHERE generation=? AND page=?',[claim.generation,event.page]))[0];if(!old||old.status!=='processing')throw new Error('parse_failed');
   const totalBytes=Number(job.bytes)-Number(old.bytes)+bytes;if(totalBytes>512*1048576)throw new Error('too_large');
   await target.host.run('DELETE FROM material_pdf_chunks WHERE generation=? AND page=?',[claim.generation,event.page]);
   for(const c of chunks)await target.host.run('INSERT INTO material_pdf_chunks(id,generation,page,local_index,heading,content_md,metadata_json) VALUES(?,?,?,?,?,?,?)',[c.id,claim.generation,event.page,c.index,c.heading,c.content,JSON.stringify(c.metadata)]);
   await target.host.run('UPDATE material_pdf_pages SET status=?,result_json=?,bytes=?,error=? WHERE generation=? AND page=?',[result.status,json,bytes,result.error,claim.generation,event.page]);
   await target.host.run('UPDATE material_pdf_jobs SET bytes=?,updated_at=? WHERE resource_id=?',[totalBytes,time(),claim.resource.id]);
  });
 }
 private async failedPage(claim:Claim,page:number,error:string){if(!page)return;await this.write(claim,async target=>{await target.host.run("UPDATE material_pdf_pages SET status='failed',error=? WHERE generation=? AND page=? AND status='processing'",[error,claim.generation,page]);});}
 async ingest(resource:TeacherResource,signal:AbortSignal,lease?:MaterialParseLease){
  if(resource.fileSize>PDF_FILE_MAX_BYTES)throw new Error('too_large');
  await verifyMaterialOriginal(path.join(this.host.root(),'teacher_resources'),resource.localPath,resource.contentHash,signal);
  const previous=(await this.host.all('SELECT * FROM material_pdf_jobs WHERE resource_id=?',[resource.id]))[0];
  if(previous?.state==='complete'&&previous.version===resource.contentHash&&previous.worker===pdfFileWorkerVersion()&&resource.parseEngine===PDF_FILE_ENGINE&&resource.parseStatus==='ready')return resource;
  const claim=await this.start(resource,signal,lease),blocked=new Set<number>();let currentPage=0,published=false;
  try{
   for(let attempts=0;attempts<4;attempts++){
    const saved=await this.host.all("SELECT page,status,attempts FROM material_pdf_pages WHERE generation=? AND (status IN ('complete','blank','needs_review') OR attempts>=3)",[claim.generation]);
    const skip=[...new Set([...saved.map(r=>Number(r.page)),...blocked])];currentPage=0;
    try{
     await parsePdfFile(resource,skip,signal,async(event,executionSignal)=>{await this.accept({...claim,signal:AbortSignal.any([signal,executionSignal])},event);if(event.kind==='progress')currentPage=event.page;else if(event.kind==='page')currentPage=0;else if(event.kind==='finished')published=true;});break;
    }catch(error){
     signal.throwIfAborted();const code=error instanceof Error?error.message:'';
     if(code!=='timeout'||!currentPage)throw error;
     await this.failedPage(claim,currentPage,'page_timeout');blocked.add(currentPage);if(attempts===3)break;
    }
   }
   if(!published){
    const total=Number((await this.guard(claim)).total);if(!total)throw new Error('parse_failed');
    // Even a partial publication holds a verified read-only worker handle until commit.
    await parsePdfFile(resource,Array.from({length:total},(_,i)=>i+1),signal,async(event,executionSignal)=>this.accept({...claim,signal:AbortSignal.any([signal,executionSignal])},event));
   }return await this.host.resource(resource.id);
  }catch(error){
   if(!signal.aborted)await this.failedPage(claim,currentPage,error instanceof Error?error.message:'parse_failed').catch(()=>undefined);
   throw error;
  }finally{
   if(signal.aborted)await this.write({...claim,signal:new AbortController().signal,lease:undefined},async target=>{await target.host.run("UPDATE material_pdf_pages SET status='pending',attempts=MAX(0,attempts-1),error='cancelled' WHERE generation=? AND status='processing'",[claim.generation]);}).catch(()=>undefined);
   await this.host.run("UPDATE material_pdf_jobs SET owner_pid=0,owner_nonce='',state=CASE WHEN state='processing' THEN 'interrupted' ELSE state END,updated_at=? WHERE resource_id=? AND owner_nonce=?",[time(),resource.id,claim.owner]).catch(()=>undefined);
  }
 }
 private async publish(claim:Claim){return this.write(claim,async(target,job)=>{
  const status=await target.status(claim.resource.id);if(!status||!status.total)throw new Error('parse_failed');
  const count=(await target.host.all('SELECT COUNT(*) n,MIN(page) first,MAX(page) last FROM material_pdf_pages WHERE generation=?',[claim.generation]))[0];
  const complete=Number(count.n)===status.total&&Number(count.first)===1&&Number(count.last)===status.total&&!status.failed&&!status.review&&!status.pending;
  // Staging is already bounded and durable; publication copies rows in SQL, never gathers the book in JS.
  const eligible="SELECT c.id FROM material_pdf_chunks c JOIN material_pdf_pages p ON p.generation=c.generation AND p.page=c.page WHERE c.generation=? AND p.status='complete'";
  await target.host.run(`DELETE FROM knowledge_edges WHERE evidence_source_id IN (SELECT id FROM resource_chunks WHERE resource_id=? AND id NOT IN (${eligible}))`,[claim.resource.id,claim.generation]);
  await target.host.run(`DELETE FROM knowledge_nodes WHERE id IN (SELECT 'node_'||id FROM resource_chunks WHERE resource_id=? AND id NOT IN (${eligible}))`,[claim.resource.id,claim.generation]);
  await target.host.run(`DELETE FROM resource_chunks WHERE resource_id=? AND id NOT IN (${eligible})`,[claim.resource.id,claim.generation]);
  const timestamp=time();
  await target.host.run(`WITH eligible AS (SELECT c.* FROM material_pdf_chunks c JOIN material_pdf_pages p ON p.generation=c.generation AND p.page=c.page WHERE p.status='complete') INSERT INTO resource_chunks(id,resource_id,chunk_index,heading,content_md,page_number,bbox_json,token_count,subject,grade,knowledge_point,question_type,difficulty,source_trust,contains_personal_data,quality_score,evidence_strength,embedding_status,created_at)
   SELECT id,?,ROW_NUMBER() OVER (ORDER BY page,local_index)-1,heading,content_md,page,'',CAST((length(content_md)+1)/2 AS INTEGER),json_extract(metadata_json,'$.subject'),json_extract(metadata_json,'$.grade'),json_extract(metadata_json,'$.knowledgePoint'),json_extract(metadata_json,'$.questionType'),json_extract(metadata_json,'$.difficulty'),'machine_extracted',json_extract(metadata_json,'$.containsPersonalData'),json_extract(metadata_json,'$.qualityScore'),'background','pending',? FROM eligible WHERE generation=?
   ON CONFLICT(id) DO UPDATE SET chunk_index=excluded.chunk_index WHERE resource_chunks.chunk_index<>excluded.chunk_index`,[claim.resource.id,timestamp,claim.generation]);
  await target.host.run(`INSERT OR REPLACE INTO knowledge_nodes(id,node_type,name,summary,source_kind,source_id,confidence,evidence_strength,created_at,updated_at) SELECT 'node_'||id,'片段',CASE WHEN heading<>'' THEN heading ELSE ?||' #'||(chunk_index+1) END,substr(content_md,1,180),'resource_chunk',id,quality_score/100.0,'background',?,? FROM resource_chunks WHERE resource_id=?`,[claim.resource.title,timestamp,timestamp,claim.resource.id]);
  await target.host.run(`INSERT OR IGNORE INTO knowledge_edges(id,source_node_id,target_node_id,relation_type,evidence_source_id,evidence_text,confidence,evidence_strength,evidence_kind,created_at) SELECT 'edge_'||?||'_'||id,'node_'||?,'node_'||id,'包含',id,?,quality_score/100.0,'background','direct_quote',? FROM resource_chunks WHERE resource_id=?`,[claim.resource.id,claim.resource.id,claim.resource.title,timestamp,claim.resource.id]);
  await target.host.run('UPDATE teacher_resources SET parse_status=?,parse_engine=?,updated_at=? WHERE id=?',[complete?'ready':'partial',PDF_FILE_ENGINE+(complete?'':':partial_pages'),timestamp,claim.resource.id]);
  await target.host.run('UPDATE material_pdf_jobs SET state=?,error=?,updated_at=? WHERE resource_id=?',[complete?'complete':'partial',complete?'':'partial_pages',timestamp,claim.resource.id]);
  await target.host.enqueueQuestions(claim.resource.id,claim.resource.contentHash,claim.generation+':'+timestamp);
 });}
}
