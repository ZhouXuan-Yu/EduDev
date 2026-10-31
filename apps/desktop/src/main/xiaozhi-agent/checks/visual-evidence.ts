import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {readMaterialOriginal} from '../../assets/material-original';
import {validVisualEvidence,type DeliveryVisualEvidence} from '../../../shared/xiaozhi-delivery-checks';

export const VISUAL_CACHE_LIMITS={imageBytes:3*1048576,totalBytes:96*1048576,files:256} as const;
const sha=(bytes:Buffer)=>createHash('sha256').update(bytes).digest('hex');
const name=/^[a-f0-9]{64}\.png$/;
const same=(a:string,b:string)=>process.platform==='win32'?a.toLowerCase()===b.toLowerCase():a===b;
async function directory(folder:string){const s=await fs.lstat(folder);if(!s.isDirectory()||s.isSymbolicLink()||!same(await fs.realpath(folder),folder))throw Error('unavailable');}
/** PNG capture metadata is measured from actual bytes, not declared by the model or renderer IPC. */
export function visualMetadata(bytes:Buffer,input:Pick<DeliveryVisualEvidence,'page'|'kind'>&{viewport?:string}):DeliveryVisualEvidence{
 if(bytes.length<33||bytes.length>VISUAL_CACHE_LIMITS.imageBytes||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.toString('ascii',12,16)!=='IHDR')throw Error('invalid_input');
 const width=bytes.readUInt32BE(16),height=bytes.readUInt32BE(20),value={page:input.page,kind:input.kind,sha256:sha(bytes),bytes:bytes.length,width,height,viewport:input.viewport||`${width}x${height}`};
 if(!validVisualEvidence(value))throw Error('invalid_input');return value;
}
/** Disposable derived cache only. SQLite keeps bounded references; no Base64 image rows. */
export function createVisualEvidenceCache(dataRoot:string){
 async function folder(create=false){
  if(!path.isAbsolute(dataRoot))throw Error('unavailable');let current=path.resolve(dataRoot);await directory(current);
  for(const part of ['cache','delivery-check-visual','v1']){current=path.join(current,part);if(create)await fs.mkdir(current).catch(e=>{if(e.code!=='EEXIST')throw e;});await directory(current);}return current;
 }
 async function read(evidence:DeliveryVisualEvidence,signal:AbortSignal){
  if(!validVisualEvidence(evidence))throw Error('invalid_input');const root=await folder();const bytes=await readMaterialOriginal(root,path.join(root,evidence.sha256+'.png'),evidence.sha256,signal,VISUAL_CACHE_LIMITS.imageBytes);
  const actual=visualMetadata(bytes,evidence);if(actual.bytes!==evidence.bytes||actual.width!==evidence.width||actual.height!==evidence.height)throw Error('unavailable');return bytes;
 }
 async function room(root:string,incoming:number,keep:Set<string>,signal:AbortSignal){
  const entries: {file:string;bytes:number;time:number}[]=[];const iterator=await fs.opendir(root);let seen=0;
  for await(const item of iterator){signal.throwIfAborted();if(++seen>512)throw Error('too_large');if(!name.test(item.name))continue;
   const file=path.join(root,item.name),s=await fs.lstat(file);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1)throw Error('unavailable');entries.push({file,bytes:s.size,time:s.mtimeMs});}
  let total=entries.reduce((n,e)=>n+e.bytes,0)+incoming,count=entries.length+1;
  for(const entry of entries.sort((a,b)=>a.time-b.time||a.file.localeCompare(b.file))){
   if(total<=VISUAL_CACHE_LIMITS.totalBytes&&count<=VISUAL_CACHE_LIMITS.files)break;if(keep.has(path.basename(entry.file,'.png')))continue;
   await directory(root);const s=await fs.lstat(entry.file);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||!same(await fs.realpath(entry.file),entry.file))throw Error('unavailable');
   await fs.unlink(entry.file);total-=entry.bytes;count--;
  }
  if(total>VISUAL_CACHE_LIMITS.totalBytes||count>VISUAL_CACHE_LIMITS.files)throw Error('too_large');
 }
 return{
  read,
  async put(captures:{bytes:Buffer;page:number;kind:DeliveryVisualEvidence['kind'];viewport?:string}[],signal:AbortSignal){
   if(!captures.length||captures.length>64)throw Error('invalid_input');const metadata=captures.map(c=>visualMetadata(c.bytes,c)),keep=new Set(metadata.map(m=>m.sha256)),root=await folder(true);
   for(let i=0;i<captures.length;i++){
    signal.throwIfAborted();const item=metadata[i],target=path.join(root,item.sha256+'.png');
    try{await read(item,signal);continue;}catch(e){
     if((e as NodeJS.ErrnoException).code!=='ENOENT'){
      // A fresh actual capture can rebuild its corrupted derived entry, never an original file.
      if(!['source_changed','invalid_input','unavailable'].includes((e as Error).message))throw e;
      signal.throwIfAborted();await directory(root);const s=await fs.lstat(target);
      if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||!same(await fs.realpath(target),target))throw Error('unavailable');await fs.unlink(target);
     }
    }
    await room(root,item.bytes,keep,signal);signal.throwIfAborted();await directory(root);
    try{await fs.writeFile(target,captures[i].bytes,{flag:'wx',mode:0o600});}catch(e){if((e as NodeJS.ErrnoException).code!=='EEXIST')throw e;}
    await read(item,signal);
   }
   signal.throwIfAborted();return metadata;
  },
 };
}
