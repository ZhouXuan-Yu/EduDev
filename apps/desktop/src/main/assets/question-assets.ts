import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {setTimeout as delay} from 'node:timers/promises';
import {readMaterialOriginal} from './material-original';
import type {MaterialPreviewResult} from '../../shared/material-page-preview';
export type OriginalImage=Omit<Extract<MaterialPreviewResult,{ok:true}>,'dataUrl'>;
const MAX_IMAGE_BYTES=4*1048576;
function validateImageShape(image:OriginalImage,bytes:Buffer){
 if(bytes.length<57||bytes.length>MAX_IMAGE_BYTES||
  !bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||
  bytes.readUInt32BE(16)!==image.width||bytes.readUInt32BE(20)!==image.height)throw new Error('unavailable');
}
/** Immutable bytes, not a second business database. Only ledger/document references confer authority. */
export class QuestionAssets{
 private readonly dataRoot:()=>string;
 constructor(dataRoot:()=>string){this.dataRoot=dataRoot;}
 private async root(formal:boolean){const base=path.resolve(this.dataRoot()),parts=formal?['question-assets','v1']:['cache','question-candidates','v1'];let dir=base;
  const verify=async(target:string)=>{const stat=await fs.lstat(target);if(!stat.isDirectory()||stat.isSymbolicLink()||(await fs.realpath(target)).toLowerCase()!==target.toLowerCase())throw new Error('unavailable');};
  await verify(base);for(const part of parts){dir=path.join(dir,part);await fs.mkdir(dir).catch(e=>{if(e.code!=='EEXIST')throw e;});await verify(dir);}return dir;
 }
 private name(image:OriginalImage){if(!/^asset_[a-f0-9-]{36}$/.test(image.assetId)||!/^[a-f0-9]{64}$/.test(image.sha256))throw new Error('invalid_input');return image.assetId+'.png';}
 async read(image:OriginalImage,formal:boolean,signal:AbortSignal){image={...image};try{const root=await this.root(formal),bytes=await readMaterialOriginal(root,path.join(root,this.name(image)),image.sha256,signal,MAX_IMAGE_BYTES);
  validateImageShape(image,bytes);return bytes;
 }catch(e){if(signal.aborted)throw new Error('cancelled');throw new Error('unavailable');}}
 /** Another publisher briefly owns two links until its pending name is removed. */
 private async readPublished(image:OriginalImage,formal:boolean,signal:AbortSignal,file:string){
  for(let attempt=0;attempt<10;attempt++){
   try{return await this.read(image,formal,signal);}
   catch(error){
    if(signal.aborted)throw error;
    const stat=await fs.lstat(file).catch(()=>undefined);
    if(!stat?.isFile()||stat.isSymbolicLink()||stat.nlink!==2||attempt===9)throw error;
    await delay(5,undefined,{signal});
   }
  }
  throw new Error('unavailable');
 }
 async put(image:OriginalImage,bytes:Buffer,formal:boolean,signal:AbortSignal){signal.throwIfAborted();image={...image};
  // Pin caller-owned bytes before the first asynchronous filesystem operation.
  const content=bytes.length<=MAX_IMAGE_BYTES?Buffer.from(bytes):undefined;
  const root=await this.root(formal),file=path.join(root,this.name(image));
  try{await fs.lstat(file);await this.readPublished(image,formal,signal,file);return;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  if(!content)throw new Error('unavailable');validateImageShape(image,content);
  if(createHash('sha256').update(content).digest('hex')!==image.sha256)throw new Error('unavailable');
  signal.throwIfAborted();
  const temp=path.join(root,'.pending-'+randomUUID()),handle=await fs.open(temp,'wx',0o600);
  try{try{await handle.writeFile(content);await handle.sync();}finally{await handle.close();}
   signal.throwIfAborted(); // Link publishes without replacing an existing immutable identity.
   await fs.link(temp,file).catch(async e=>{if(e.code!=='EEXIST')throw e;});
  }finally{await fs.unlink(temp).catch(()=>undefined);}
  await this.readPublished(image,formal,signal,file);signal.throwIfAborted();
 }
 async promote(image:OriginalImage,signal:AbortSignal){await this.put(image,await this.read(image,false,signal),true,signal);}
}
