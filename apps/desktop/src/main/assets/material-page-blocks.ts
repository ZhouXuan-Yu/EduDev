import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {PAGE_BLOCKS_ENGINE,pageBlocksMatch,type PageBlocks} from '../../shared/material-page-blocks';
import type {MaterialRepository} from './material-repository';
import {readMaterialOriginal} from './material-original';
const hash=(v:Buffer|string)=>createHash('sha256').update(v).digest('hex');
const MAX_BYTES=128*1024;
type RasterResult={resourceId:string;version:string;layout:{page:number;png:string;rasterSha256:string;width:number;height:number}};

/** Bounded, rebuildable geometry; immutable original/source receipts remain authoritative. */
export async function withMaterialPageBlocks<T extends RasterResult>(repository:MaterialRepository,dataRoot:string,result:T,refresh:boolean,signal:AbortSignal,recognize:(bytes:Buffer,signal:AbortSignal)=>Promise<PageBlocks>):Promise<T&{pageBlocks:{cached:boolean;receipt:PageBlocks}}>{
 signal.throwIfAborted();const raster=result.layout,bytes=Buffer.from(raster.png,'base64');
 if(hash(bytes)!==raster.rasterSha256)throw Error('source_changed');
 const stamp=await repository.originalStamp(result.resourceId,result.version);
 let root=path.resolve(dataRoot);
 const verify=async()=>{const s=await fs.lstat(root);if(!s.isDirectory()||s.isSymbolicLink()||(await fs.realpath(root)).toLowerCase()!==root.toLowerCase())throw Error('unavailable');};
 await verify();for(const part of ['cache','material-page-blocks','v1']){root=path.join(root,part);await fs.mkdir(root).catch(e=>{if(e.code!=='EEXIST')throw e;});await verify();}
 const key=hash(JSON.stringify([result.resourceId,result.version,raster.page,raster.rasterSha256,PAGE_BLOCKS_ENGINE])),file=path.join(root,key+'.json');
 let receipt:PageBlocks|undefined,cached=false;
 if(!refresh)try{
  const stat=await fs.lstat(file);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||stat.size>MAX_BYTES)throw Error('cache_invalid');
  const handle=await fs.open(file,'r');let data:Buffer;
  try{const opened=await handle.stat();if(!opened.isFile()||opened.nlink!==1||opened.size>MAX_BYTES||opened.ino!==stat.ino||opened.dev!==stat.dev||opened.size!==stat.size||opened.mtimeMs!==stat.mtimeMs||opened.ctimeMs!==stat.ctimeMs)throw Error('cache_invalid');data=Buffer.alloc(opened.size+1);let length=0;while(length<data.length){signal.throwIfAborted();const n=await handle.read(data,length,data.length-length,null);if(!n.bytesRead)break;length+=n.bytesRead;}if(length!==opened.size)throw Error('cache_invalid');data=data.subarray(0,length);}finally{await handle.close();}
  await readMaterialOriginal(root,file,hash(data),signal,MAX_BYTES);
  const value=JSON.parse(data.toString('utf8'));if(!pageBlocksMatch(value,raster))throw Error('cache_invalid');receipt=value;cached=true;
 }catch(e){if(signal.aborted)throw Error('cancelled');if((e as NodeJS.ErrnoException).code!=='ENOENT')throw Error('cache_invalid');}
 if(!receipt){receipt=await recognize(bytes,signal);if(!pageBlocksMatch(receipt,raster))throw Error('parse_failed');}
 signal.throwIfAborted();await repository.verify(result.resourceId,result.version,signal);
 if(await repository.originalStamp(result.resourceId,result.version)!==stamp)throw Error('source_changed');
 if(!cached){const data=JSON.stringify(receipt);if(Buffer.byteLength(data)>MAX_BYTES)throw Error('too_large');const pending=path.join(root,'.pending-'+randomUUID());try{const h=await fs.open(pending,'wx',0o600);try{await h.writeFile(data);await h.sync();}finally{await h.close();}signal.throwIfAborted();await fs.rename(pending,file);}finally{await fs.unlink(pending).catch(()=>undefined);}}
 signal.throwIfAborted();if(await repository.originalStamp(result.resourceId,result.version)!==stamp)throw Error('source_changed');
 return{...result,pageBlocks:{cached,receipt}};
}
