import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {readMaterialOriginal} from './material-original';
import {acquireWriterLock} from '../retrieval/writer-lock';

type Row=Record<string,unknown>;
export type AiImageHost={root?:()=>string;all:(sql:string,p?:(string|number|null)[])=>Promise<Row[]>;run:(sql:string,p?:(string|number|null)[])=>Promise<void>};
export type AiImageFileReference={imageSha:string;mime:string;bytes:number};
type Image={data:string;mime:string};
const limit=4*1048576,hash=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const validSha=(value:unknown):value is string=>typeof value==='string'&&/^[a-f0-9]{64}$/.test(value);
const mime=(value:unknown):value is string=>typeof value==='string'&&['image/png','image/jpeg','image/webp'].includes(value);
const samePath=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;

async function directory(folder:string){
 const stat=await fs.lstat(folder);
 if(!stat.isDirectory()||stat.isSymbolicLink()||!samePath(await fs.realpath(folder),folder))throw Error('source_changed');
}
async function folder(root:string,sha?:string,create=false){
 if(!path.isAbsolute(root))throw Error('source_changed');
 let current=path.resolve(root);await directory(current);
 for(const part of ['material-ai-images','v1',...(sha?[sha.slice(0,2)]:[])]){
  current=path.join(current,part);
  if(create)await fs.mkdir(current).catch(error=>{if(error.code!=='EEXIST')throw error;});
  await directory(current);
 }
 return current;
}
async function readFile(root:string,sha:string,signal:AbortSignal){
 try{const parent=await folder(root,sha);return await readMaterialOriginal(parent,path.join(parent,sha+'.bin'),sha,signal,limit);}
 catch(error){signal.throwIfAborted();throw Error('source_changed');}
}

/** Old inline evidence remains readable; file versions never fall back to inline bytes. */
export async function readAiImageInput(host:Pick<AiImageHost,'root'>,row:Row,signal=new AbortController().signal):Promise<Image>{
 signal.throwIfAborted();if(!validSha(row.image_sha)||!mime(row.mime))throw Error('source_changed');
 const version=row.storage_version===undefined?'inline.v1':row.storage_version;
 let bytes:Buffer;
 if(version==='file.v1'){
  if(!host.root||row.data_base64!==''||!Number.isSafeInteger(row.image_bytes)||Number(row.image_bytes)<1||Number(row.image_bytes)>limit)throw Error('source_changed');
  bytes=await readFile(host.root(),row.image_sha,signal);if(bytes.length!==row.image_bytes)throw Error('source_changed');
 }else if(version==='inline.v1'){
  if(typeof row.data_base64!=='string'||row.data_base64.length>5592408||row.image_bytes!==undefined&&row.image_bytes!==0)throw Error('source_changed');
  bytes=Buffer.from(row.data_base64,'base64');
  if(!bytes.length||bytes.length>limit||bytes.toString('base64')!==row.data_base64||hash(bytes)!==row.image_sha)throw Error('source_changed');
 }else throw Error('source_changed');
 signal.throwIfAborted();return{mime:row.mime,data:bytes.toString('base64')};
}

async function unlinkOwned(parent:string,name:string){
 await directory(parent);const file=path.join(parent,name);
 const stat=await fs.lstat(file).catch(error=>{if(error.code!=='ENOENT')throw error;return undefined;});
 if(!stat)return;
 if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||!samePath(await fs.realpath(file),file))throw Error('source_changed');
 await fs.unlink(file);
}
async function finishPending(host:AiImageHost,root:string,row:Row,signal:AbortSignal){
 signal.throwIfAborted();const sha=row.sha256,name=row.temporary_name;
 if(!validSha(sha)||typeof name!=='string'||!/^\.pending-[a-f0-9-]{36}$/.test(name))throw Error('source_changed');
 const parent=await folder(root,sha,true);await unlinkOwned(parent,name);
 const referenced=(await host.all("SELECT 1 FROM material_ai_image_inputs WHERE image_sha=? AND storage_version='file.v1' LIMIT 1",[sha])).length;
 if(!referenced)await unlinkOwned(parent,sha+'.bin');
 await host.run('DELETE FROM material_ai_image_pending WHERE sha256=?',[sha]);
}
async function recoverLocked(host:AiImageHost,root:string,signal:AbortSignal){
 const rows=await host.all("SELECT sha256,temporary_name FROM material_ai_image_pending WHERE error='' ORDER BY sha256 LIMIT 8");
 for(const row of rows)try{await finishPending(host,root,row,signal);}catch(error){
  signal.throwIfAborted();await host.run("UPDATE material_ai_image_pending SET error='source_changed' WHERE sha256=?",[String(row.sha256)]);
 }
}
/** Recover only a bounded journal, never enumerate a growing evidence directory. */
export async function recoverAiImageFiles(host:AiImageHost,signal=new AbortController().signal){
 if(!host.root)return;signal.throwIfAborted();const root=host.root(),base=await folder(root,undefined,true),lock=await acquireWriterLock(base);
 try{await recoverLocked(host,root,signal);}finally{await lock.close();}
}

/** Prepare/sync exact bytes outside SQLite transactions, holding the file lease until publication. */
export async function withAiImageFile<T>(host:AiImageHost,image:Image,signal:AbortSignal,publish:(ref:AiImageFileReference)=>Promise<T>):Promise<T>{
 signal.throwIfAborted();
 if(!host.root||!mime(image.mime)||typeof image.data!=='string'||image.data.length>5592408)throw Error('unit_too_large');
 const bytes=Buffer.from(image.data,'base64');if(!bytes.length||bytes.length>limit||bytes.toString('base64')!==image.data)throw Error('unit_too_large');
 const root=host.root(),sha=hash(bytes),base=await folder(root,undefined,true),lock=await acquireWriterLock(base);
 try{
  await recoverLocked(host,root,signal);signal.throwIfAborted();
  if((await host.all('SELECT 1 FROM material_ai_image_pending WHERE sha256=? LIMIT 1',[sha])).length)throw Error('source_changed');
  const parent=await folder(root,sha,true),target=path.join(parent,sha+'.bin');
  const prior=await fs.lstat(target).catch(error=>{if(error.code!=='ENOENT')throw error;return undefined;});
  let pending:Row|undefined;
  if(prior)await readFile(root,sha,signal);
  else{
   const disk=await fs.statfs(parent);if(disk.bavail*disk.bsize<bytes.length+16*1048576)throw Error('disk_full');
   const name='.pending-'+randomUUID();pending={sha256:sha,temporary_name:name};
   await host.run('INSERT INTO material_ai_image_pending(sha256,temporary_name) VALUES(?,?)',[sha,name]);
   const handle=await fs.open(path.join(parent,name),'wx',0o600);
   try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
   signal.throwIfAborted();await directory(parent);await fs.rename(path.join(parent,name),target);await readFile(root,sha,signal);
  }
  signal.throwIfAborted();if(!samePath(path.resolve(host.root()),path.resolve(root)))throw Error('source_changed');
  const result=await publish({imageSha:sha,mime:image.mime,bytes:bytes.length});
  if(pending)await finishPending(host,root,pending,new AbortController().signal);
  return result;
 }catch(error){if((error as NodeJS.ErrnoException).code==='ENOSPC')throw Error('disk_full');throw error;}
 finally{await lock.close();}
}
