import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {imageSize} from 'image-size';
import {readMaterialOriginal} from './material-original';
import {acquireWriterLock} from '../retrieval/writer-lock';
import {WORD_QUESTION_ROLES,wordQuestionBlocks,type WordQuestionSource,type WordQuestionRole} from '../../shared/material-word-question';
import {WORD_PROOF_SCHEMA,validWordProof,validWordProofInput,validWordProofImageQuery,validWordProofEnvironment,type WordProof,type WordProofBase,type WordProofInput,type WordProofImageQuery,type WordProofImage,type WordProofEnvironment,type WordProofPage} from '../../shared/material-word-proof';
import type {WordImageView,WordBlock} from '../../shared/material-word';
import type {WordRenderedProof} from './word-question-render';

type Value=string|number|null;type Row=Record<string,unknown>;
export type WordProofRuntime={environment:()=>Promise<WordProofEnvironment>;render:(source:WordQuestionSource,images:ReadonlyMap<string,Buffer>,signal:AbortSignal,dataRoot:string)=>Promise<WordRenderedProof>};
type Host={root:()=>string;all:(sql:string,p?:Value[])=>Promise<Row[]>;run:(sql:string,p?:Value[])=>Promise<void>;source:(base:WordProofBase)=>Promise<WordQuestionSource>;
 verify:(base:WordProofBase,signal:AbortSignal)=>Promise<void>;stamp:(base:WordProofBase)=>Promise<string>;image:(base:WordProofBase,assetId:string)=>Promise<WordImageView>;
 writer:<T>(action:(target:WordQuestionProofRepository)=>Promise<T>,beforeCommit?:()=>void)=>Promise<T>};
const hash=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
const assetId=(sha:string)=>'asset_'+[sha.slice(0,8),sha.slice(8,12),sha.slice(12,16),sha.slice(16,20),sha.slice(20,32)].join('-');
const baseOf=(v:WordProofBase):WordProofBase=>({schemaVersion:WORD_PROOF_SCHEMA,resourceId:v.resourceId,version:v.version,ordinal:v.ordinal,documentSha:v.documentSha});
const gates=new Map<string,Promise<void>>();
async function cacheGate<T>(root:string,action:()=>Promise<T>):Promise<T>{
 const key=path.resolve(root).toLowerCase(),previous=gates.get(key)||Promise.resolve();let release!:()=>void;const tail=new Promise<void>(resolve=>{release=resolve;});gates.set(key,tail);
 await previous;try{return await action();}finally{release();if(gates.get(key)===tail)gates.delete(key);}
}
const walk=(blocks:WordBlock[]):WordBlock[]=>blocks.flatMap(b=>b.kind==='table'?[b,...b.rows.flatMap(r=>r.cells.flatMap(c=>walk(c.blocks)))]:[b]);

/** Disposable source-bound PNG cache. It never grants question, teacher or formal export authority. */
export class WordQuestionProofRepository{
 private active=false;
 constructor(private host:Host){}
 async migrate(){
  await this.host.run('CREATE TABLE IF NOT EXISTS material_word_proofs(cache_key TEXT PRIMARY KEY,resource_id TEXT NOT NULL,version TEXT NOT NULL,ordinal INTEGER NOT NULL,source_digest TEXT NOT NULL,renderer TEXT NOT NULL,proof_json TEXT NOT NULL,digest TEXT NOT NULL,last_access INTEGER NOT NULL)');
  await this.host.run('CREATE TABLE IF NOT EXISTS material_word_proof_files(proof_id TEXT NOT NULL,sha256 TEXT NOT NULL,bytes INTEGER NOT NULL,PRIMARY KEY(proof_id,sha256))');
  await this.host.run('CREATE INDEX IF NOT EXISTS material_word_proof_files_sha ON material_word_proof_files(sha256)');
  // A disposable cache must never prevent the business database from opening.
  await this.gate(folder=>this.recover(folder,AbortSignal.timeout(5000))).catch(()=>undefined);
 }
 private async gate<T>(action:(folder:string)=>Promise<T>):Promise<T>{
  return cacheGate(this.host.root(),async()=>{
   const folder=await this.folder();let owner;
   try{owner=await acquireWriterLock(folder);}catch(error){throw Error((error as Error).message==='index_busy'?'busy':'unavailable');}
   try{return await action(folder);}finally{await owner.close();}
  });
 }
 private async recover(folder:string,signal:AbortSignal){
  // Exact private filenames only. A live publisher holds the same OS lock, so
  // an uncommitted PNG is reclaimable here only after that owner has exited.
  const entries=await fs.opendir(folder);let scanned=0;
  for await(const entry of entries){
   signal.throwIfAborted();if(++scanned>4096)throw Error('too_large');
   if(!entry.isFile()||entry.isSymbolicLink())continue;
   const png=/^([a-f0-9]{64})\.png$/.exec(entry.name);
   const pending=/^\.pending-[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(entry.name);
   if(!png&&!pending)continue;
   if(png&&(await this.host.all('SELECT 1 FROM material_word_proof_files WHERE sha256=? LIMIT 1',[png[1]])).length)continue;
   await fs.unlink(path.join(folder,entry.name)).catch(e=>{if(e.code!=='ENOENT')throw e;});
  }
 }
 private async folder(){
  let folder=path.resolve(this.host.root());
  const check=async(p:string)=>{const s=await fs.lstat(p);if(!s.isDirectory()||s.isSymbolicLink()||(await fs.realpath(p)).toLowerCase()!==p.toLowerCase())throw Error('unavailable');};
  await check(folder);
  for(const piece of ['cache','word-question-pages','v1']){folder=path.join(folder,piece);await fs.mkdir(folder).catch(e=>{if(e.code!=='EEXIST')throw e;});await check(folder);}
  return folder;
 }
 private async source(base:WordProofBase){const source=await this.host.source(base);if(source.ordinal!==base.ordinal||source.documentSha!==base.documentSha)throw Error('source_changed');return source;}
 private async guard(base:WordProofBase,digest:string,stamp:string,signal:AbortSignal){signal.throwIfAborted();if(hash(JSON.stringify(await this.source(base)))!==digest||await this.host.stamp(base)!==stamp)throw Error('source_changed');signal.throwIfAborted();}
 private async load(id:string,source:WordQuestionSource,base:WordProofBase):Promise<WordProof|undefined>{
  const row=(await this.host.all('SELECT * FROM material_word_proofs WHERE cache_key=?',[id]))[0];if(!row)return undefined;
  if(typeof row.proof_json!=='string'||Buffer.byteLength(row.proof_json)>256*1024||hash(row.proof_json)!==row.digest)return undefined;
  let value:unknown;try{value=JSON.parse(row.proof_json);}catch{return undefined;}
  if(!validWordProof(value,source)||value.proofId!==id||value.resourceId!==base.resourceId||value.version!==base.version||value.sourceDigest!==hash(JSON.stringify(source))||row.source_digest!==value.sourceDigest||row.resource_id!==value.resourceId||row.version!==value.version||row.ordinal!==value.ordinal||row.renderer!==value.environment.renderer)return undefined;
  const references=await this.host.all('SELECT sha256,bytes FROM material_word_proof_files WHERE proof_id=?',[id]),expected=new Map(value.pages.map(p=>[p.sha256,p.bytes]));
  if(references.length!==expected.size||references.some(r=>expected.get(String(r.sha256))!==r.bytes))return undefined;
  return value;
 }
 private async readPng(folder:string,page:WordProofPage,signal:AbortSignal){
  const data=await readMaterialOriginal(folder,path.join(folder,page.sha256+'.png'),page.sha256,signal,4*1048576);let dimensions;try{dimensions=imageSize(data);}catch{throw Error('source_changed');}
  if(data.length!==page.bytes||dimensions.type!=='png'||dimensions.width!==page.width||dimensions.height!==page.height||assetId(page.sha256)!==page.assetId)throw Error('source_changed');return data;
 }
 private async put(folder:string,page:WordProofPage,bytes:Buffer,signal:AbortSignal,created:string[]){
  if(bytes.length!==page.bytes||hash(bytes)!==page.sha256)throw Error('source_changed');
  const file=path.join(folder,page.sha256+'.png');let exists=false;
  try{const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink())throw Error('unavailable');exists=true;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  if(exists){try{await this.readPng(folder,page,signal);return;}catch{signal.throwIfAborted();}}
  const pending=path.join(folder,'.pending-'+randomUUID()),handle=await fs.open(pending,'wx',0o600);
  try{try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}signal.throwIfAborted();await fs.rename(pending,file);if(!exists)created.push(page.sha256);await this.readPng(folder,page,signal);}
  finally{await fs.unlink(pending).catch(e=>{if(e.code!=='ENOENT')throw e;});}
 }
 private async purge(folder:string,candidates:readonly string[]){
  for(const sha of new Set(candidates)){
   if(!/^[a-f0-9]{64}$/.test(sha)||(await this.host.all('SELECT 1 FROM material_word_proof_files WHERE sha256=? LIMIT 1',[sha])).length)continue;
   await fs.unlink(path.join(folder,sha+'.png')).catch(e=>{if(e.code!=='ENOENT')throw e;});
  }
 }
 private async evict(current:string){
  const candidates:string[]=[];let count=Number((await this.host.all('SELECT COUNT(*) n FROM material_word_proofs'))[0]?.n||0);
  const bytes=async()=>Number((await this.host.all('SELECT COALESCE(SUM(bytes),0) n FROM (SELECT sha256,MAX(bytes) bytes FROM material_word_proof_files GROUP BY sha256)'))[0]?.n||0);
  const old=await this.host.all('SELECT cache_key FROM material_word_proofs WHERE cache_key<>? ORDER BY last_access,cache_key',[current]);
  for(const row of old){if(count<=32&&await bytes()<=128*1048576)break;const id=String(row.cache_key);candidates.push(...(await this.host.all('SELECT sha256 FROM material_word_proof_files WHERE proof_id=?',[id])).map(r=>String(r.sha256)));await this.host.run('DELETE FROM material_word_proof_files WHERE proof_id=?',[id]);await this.host.run('DELETE FROM material_word_proofs WHERE cache_key=?',[id]);count--;}
  return candidates;
 }
 async create(input:WordProofInput,runtime:WordProofRuntime,requestSignal:AbortSignal):Promise<WordProof>{
  if(!validWordProofInput(input))throw Error('invalid_input');if(requestSignal.aborted)throw Error('cancelled');if(this.active)throw Error('busy');this.active=true;
  const timeout=AbortSignal.timeout(60000),signal=AbortSignal.any([requestSignal,timeout]);
  try{
   const base=baseOf(input),source=await this.source(base),sourceDigest=hash(JSON.stringify(source)),environment=await runtime.environment();
   if(!validWordProofEnvironment(environment))throw Error('configuration');
   await this.host.verify(base,signal);const stamp=await this.host.stamp(base),id=hash(JSON.stringify([base,sourceDigest,environment]));
   const cached=await this.gate(async folder=>{
    await this.recover(folder,signal);
    const candidate=await this.load(id,source,base);if(!candidate)return undefined;
    try{for(const p of candidate.pages)await this.readPng(folder,p,signal);}catch{signal.throwIfAborted();return undefined;}
    await this.guard(base,sourceDigest,stamp,signal);await this.host.run('UPDATE material_word_proofs SET last_access=? WHERE cache_key=?',[Date.now(),id]);return candidate;
   });
   if(cached)return cached;
   const images=new Map<string,Buffer>();
   for(const b of walk(WORD_QUESTION_ROLES.flatMap(role=>wordQuestionBlocks(source,role))))if(b.kind==='paragraph')for(const i of b.inlines)if(i.kind==='image'&&i.assetId&&!images.has(i.assetId)){signal.throwIfAborted();const image=await this.host.image(base,i.assetId);images.set(i.assetId,Buffer.from(image.dataUrl.split(',')[1]||'','base64'));}
   const rendered=await runtime.render(source,images,signal,this.host.root());
   if(rendered.sourceDigest!==sourceDigest||JSON.stringify(rendered.environment)!==JSON.stringify(environment))throw Error('source_changed');
   const candidate={...base,proofId:id,sourceDigest,environment,issues:[...source.issues],pages:rendered.pages.map(({bytes,...p})=>({...p,bytes:bytes.length,sha256:hash(bytes),assetId:assetId(hash(bytes))}))};
   if(!validWordProof(candidate,source))throw Error('source_incomplete');
   await this.host.verify(base,signal);await this.guard(base,sourceDigest,stamp,signal);
   return await this.gate(async folder=>{
    await this.recover(folder,signal);
    const created:string[]=[];let published=false;
    try{
     const stat=await fs.statfs(folder),needed=candidate.pages.reduce((n,p)=>n+p.bytes,0);if(stat.bavail*stat.bsize<needed+16*1048576)throw Error('disk_full');
     for(const [i,p] of candidate.pages.entries())await this.put(folder,p,rendered.pages[i].bytes,signal,created);
     const evicted=await this.host.writer(async target=>{
      await target.guard(base,sourceDigest,stamp,signal);const json=JSON.stringify(candidate);
      await target.host.run('INSERT INTO material_word_proofs(cache_key,resource_id,version,ordinal,source_digest,renderer,proof_json,digest,last_access) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(cache_key) DO UPDATE SET proof_json=excluded.proof_json,digest=excluded.digest,last_access=excluded.last_access',[id,base.resourceId,base.version,base.ordinal,sourceDigest,environment.renderer,json,hash(json),Date.now()]);
      await target.host.run('DELETE FROM material_word_proof_files WHERE proof_id=?',[id]);
      for(const p of new Map(candidate.pages.map(p=>[p.sha256,p])).values())await target.host.run('INSERT INTO material_word_proof_files(proof_id,sha256,bytes) VALUES(?,?,?)',[id,p.sha256,p.bytes]);
      const evicted=await target.evict(id);await target.guard(base,sourceDigest,stamp,signal);return evicted;
     },()=>signal.throwIfAborted());published=true;
     await this.purge(folder,evicted);return candidate;
    }finally{if(!published)await this.purge(folder,created);}
   });
  }catch(error){if(requestSignal.aborted)throw Error('cancelled');if(timeout.aborted)throw Error('timeout');if((error as NodeJS.ErrnoException).code==='ENOSPC')throw Error('disk_full');throw error;}
  finally{this.active=false;}
 }
 async image(input:WordProofImageQuery,signal:AbortSignal):Promise<WordProofImage>{
  if(!validWordProofImageQuery(input))throw Error('invalid_input');const base=baseOf(input),source=await this.source(base),digest=hash(JSON.stringify(source));await this.host.verify(base,signal);const stamp=await this.host.stamp(base);
  const result=await this.gate(async folder=>{
   const proof=await this.load(input.proofId,source,base),page=proof?.pages.find(p=>p.role===input.role&&p.index===input.index);if(!proof||!page)throw Error('source_changed');
   const bytes=await this.readPng(folder,page,signal);return {page,dataUrl:'data:image/png;base64,'+bytes.toString('base64')};
  });await this.guard(base,digest,stamp,signal);return result;
 }
}
