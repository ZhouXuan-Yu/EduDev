import fs from 'node:fs/promises';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {readMaterialOriginal} from './material-original';
import type {MaterialPreviewResult} from '../../shared/material-page-preview';
export type OriginalImage=Omit<Extract<MaterialPreviewResult,{ok:true}>,'dataUrl'>;
/** Immutable bytes, not a second business database. Only ledger/document references confer authority. */
export class QuestionAssets{
 private readonly dataRoot:()=>string;
 constructor(dataRoot:()=>string){this.dataRoot=dataRoot;}
 private async root(formal:boolean){const base=path.resolve(this.dataRoot()),parts=formal?['question-assets','v1']:['cache','question-candidates','v1'];let dir=base;
  const verify=async(target:string)=>{const stat=await fs.lstat(target);if(!stat.isDirectory()||stat.isSymbolicLink()||(await fs.realpath(target)).toLowerCase()!==target.toLowerCase())throw new Error('unavailable');};
  await verify(base);for(const part of parts){dir=path.join(dir,part);await fs.mkdir(dir).catch(e=>{if(e.code!=='EEXIST')throw e;});await verify(dir);}return dir;
 }
 private name(image:OriginalImage){if(!/^asset_[a-f0-9-]{36}$/.test(image.assetId)||!/^[a-f0-9]{64}$/.test(image.sha256))throw new Error('invalid_input');return image.assetId+'.png';}
 async read(image:OriginalImage,formal:boolean,signal:AbortSignal){try{const root=await this.root(formal),bytes=await readMaterialOriginal(root,path.join(root,this.name(image)),image.sha256,signal,4*1048576);
  if(bytes.length<57||!bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||bytes.readUInt32BE(16)!==image.width||bytes.readUInt32BE(20)!==image.height)throw new Error('unavailable');return bytes;
 }catch(e){if(signal.aborted)throw new Error('cancelled');throw new Error('unavailable');}}
 async put(image:OriginalImage,bytes:Buffer,formal:boolean,signal:AbortSignal){signal.throwIfAborted();const root=await this.root(formal),file=path.join(root,this.name(image));
  try{await fs.lstat(file);await this.read(image,formal,signal);return;}catch(e){if((e as NodeJS.ErrnoException).code!=='ENOENT')throw e;}
  const temp=path.join(root,'.pending-'+randomUUID()),handle=await fs.open(temp,'wx',0o600);
  try{try{await handle.writeFile(bytes);await handle.sync();}finally{await handle.close();}
   signal.throwIfAborted(); // Link publishes without replacing an existing immutable identity.
   await fs.link(temp,file).catch(async e=>{if(e.code!=='EEXIST')throw e;});
  }finally{await fs.unlink(temp).catch(()=>undefined);}
  await this.read(image,formal,signal);signal.throwIfAborted();
 }
 async promote(image:OriginalImage,signal:AbortSignal){await this.put(image,await this.read(image,false,signal),true,signal);}
}
