import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {MATERIAL_LAYOUT_SCHEMA,PDF_LAYOUT_ENGINE,validLayoutQuery,validPdfLayout,type LayoutQuery,type PdfLayout,type MaterialLayoutResult} from '../../shared/material-layout';
import {readMaterialOriginal} from './material-original';
import type {MaterialRepository} from './material-repository';
const hash=(value:Buffer|string)=>createHash('sha256').update(value).digest('hex');
const MAX_CACHE=6*1048576;
/** Rebuildable page derivatives only. No question, approval or business facts are stored here. */
export class MaterialLayoutCache{
 private readonly dataRoot:()=>string;
 constructor(dataRoot:()=>string){this.dataRoot=dataRoot;}
 private async root(){let dir=path.resolve(this.dataRoot());
  const verify=async()=>{const stat=await fs.lstat(dir);if(!stat.isDirectory()||stat.isSymbolicLink()||(await fs.realpath(dir)).toLowerCase()!==dir.toLowerCase())throw new Error('unavailable');};
  await verify();for(const part of ['cache','material-layout','v1']){dir=path.join(dir,part);await fs.mkdir(dir).catch(e=>{if(e.code!=='EEXIST')throw e;});await verify();}return dir;
 }
 private key(query:LayoutQuery){return hash(JSON.stringify([query.resourceId,query.version,PDF_LAYOUT_ENGINE,query.page]))+'.json';}
 async read(query:LayoutQuery,signal:AbortSignal):Promise<PdfLayout|undefined>{
  const root=await this.root(),file=path.join(root,this.key(query));let bytes:Buffer;
  try{
   // The first descriptor read is bounded too; a path swap cannot increase its allocation.
   const before=await fs.lstat(file);if(!before.isFile()||before.isSymbolicLink()||before.nlink!==1||before.size>MAX_CACHE||(await fs.realpath(file)).toLowerCase()!==file.toLowerCase())throw new Error('cache_invalid');
   const handle=await fs.open(file,'r');
   try{const stat=await handle.stat();if(!stat.isFile()||stat.nlink!==1||stat.size>MAX_CACHE||before.dev!==stat.dev||before.ino!==stat.ino||before.size!==stat.size||before.mtimeMs!==stat.mtimeMs||before.ctimeMs!==stat.ctimeMs)throw new Error('cache_invalid');
    bytes=Buffer.alloc(stat.size+1);let length=0;while(length<bytes.length){signal.throwIfAborted();const part=await handle.read(bytes,length,bytes.length-length,null);if(!part.bytesRead)break;length+=part.bytesRead;}
    if(length!==stat.size)throw new Error('cache_invalid');bytes=bytes.subarray(0,length);
   }finally{await handle.close();}
   await readMaterialOriginal(root,file,hash(bytes),signal,MAX_CACHE);
   const value=JSON.parse(bytes.toString('utf8'));
   if(!value||Object.keys(value).length!==3||value.schemaVersion!=='xiaozhi.material-layout-cache.v1'||typeof value.sha256!=='string'||hash(JSON.stringify(value.receipt))!==value.sha256||!validPdfLayout(value.receipt)||!value.receipt.ok)throw new Error('cache_invalid');
   return value.receipt;
  }catch(e){if(signal.aborted)throw new Error('cancelled');if((e as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw new Error('cache_invalid');}
 }
 async put(query:LayoutQuery,receipt:PdfLayout,signal:AbortSignal){
  const root=await this.root(),target=path.join(root,this.key(query)),temporary=path.join(root,'.pending-'+randomUUID());
  const bytes=JSON.stringify({schemaVersion:'xiaozhi.material-layout-cache.v1',sha256:hash(JSON.stringify(receipt)),receipt});
  if(Buffer.byteLength(bytes)>MAX_CACHE)throw new Error('too_large');signal.throwIfAborted();
  try{
   const handle=await fs.open(temporary,'wx',0o600);
   try{await handle.writeFile(bytes,'utf8');await handle.sync();}finally{await handle.close();}
   signal.throwIfAborted();await fs.rename(temporary,target);
  }finally{await fs.unlink(temporary).catch(()=>undefined);}
  signal.throwIfAborted();
 }
}
function validateRaster(receipt:PdfLayout){const bytes=Buffer.from(receipt.png,'base64');
 if(bytes.length<57||bytes.length>4*1048576||bytes.toString('base64')!==receipt.png||hash(bytes)!==receipt.rasterSha256||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(8)!==13||bytes.toString('ascii',12,16)!=='IHDR'||bytes.readUInt32BE(16)!==receipt.width||bytes.readUInt32BE(20)!==receipt.height||!bytes.subarray(-12).equals(Buffer.from([0,0,0,0,73,69,78,68,174,66,96,130])))throw new Error('parse_failed');
}
export async function readMaterialLayout(repository:MaterialRepository,cache:MaterialLayoutCache,query:LayoutQuery,signal:AbortSignal,recognize:(bytes:Buffer,page:number,signal:AbortSignal)=>Promise<PdfLayout>):Promise<Extract<MaterialLayoutResult,{ok:true}>>{
 if(!validLayoutQuery(query))throw new Error('invalid_input');signal.throwIfAborted();
 const resource=await repository.resource(query.resourceId);if(!/\.pdf$/i.test(resource.originalFileName))throw new Error('unsupported');
 const bytes=await repository.original(query.resourceId,query.version,signal);
 let layout=query.refresh?undefined:await cache.read(query,signal);const cached=!!layout;
 if(!layout)layout=await recognize(bytes,query.page,signal);
 signal.throwIfAborted();
 if(!validPdfLayout(layout)||!layout.ok||layout.inputSha256!==query.version||layout.page!==query.page)throw new Error(cached?'cache_invalid':'parse_failed');
 try{validateRaster(layout);}catch{throw new Error(cached?'cache_invalid':'parse_failed');}
 await repository.original(query.resourceId,query.version,signal);signal.throwIfAborted();
 if(!cached)await cache.put(query,layout,signal);
 await repository.original(query.resourceId,query.version,signal);signal.throwIfAborted();
 return {schemaVersion:MATERIAL_LAYOUT_SCHEMA,ok:true,requestId:query.requestId,resourceId:query.resourceId,version:query.version,cached,layout};
}
