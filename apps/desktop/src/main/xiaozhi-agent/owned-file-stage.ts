import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {assertCurrentPermission} from './permissions/current';

/** Private ledger metadata; never an authority to scan or remove other files. */
export type OwnedFileStage = {schemaVersion:1; name:string; dev:string; ino:string; birthtimeNs:string};
export function parseOwnedFileStage(value:unknown):OwnedFileStage|null {
  if(value==null)return null;
  try {
    const x=JSON.parse(String(value));
    if(x.schemaVersion!==1||!/^\.xiaozhi-stage-[a-f0-9-]{36}\.tmp$/i.test(x.name)
      ||!['dev','ino','birthtimeNs'].every(k=>typeof x[k]==='string'&&/^\d{1,30}$/.test(x[k])))throw Error();
    return {schemaVersion:1,name:x.name,dev:x.dev,ino:x.ino,birthtimeNs:x.birthtimeNs};
  }catch{throw Error('configuration');}
}
/** Caller supplies an already-authorized target in the original mutation queue. */
export function removeOwnedFileStage(destination:string,stage:OwnedFileStage):void {
  const temporary=path.join(path.dirname(destination),stage.name);
  let stat:fs.BigIntStats;
  try{stat=fs.lstatSync(temporary,{bigint:true});}
  catch(error){if((error as NodeJS.ErrnoException).code==='ENOENT')return;throw error;}
  if(!stat.isFile()||stat.isSymbolicLink()||String(stat.dev)!==stage.dev||String(stat.ino)!==stage.ino
    ||String(stat.birthtimeNs)!==stage.birthtimeNs)throw Error('conflict');
  // Unlink this exact name only. A second link may be the already-installed formal file.
  fs.unlinkSync(temporary);
}

/** Receipt is durable before any content is written; final installation stays synchronous. */
export async function withOwnedFileStage(destination:string,bytes:Buffer,store:(stage:OwnedFileStage|null)=>Promise<void>,
  install:(temporary:string)=>void|Promise<void>):Promise<void> {
  await assertCurrentPermission();
  const name=`.xiaozhi-stage-${randomUUID()}.tmp`,temporary=path.join(path.dirname(destination),name);
  const handle=fs.openSync(temporary,'wx',0o600),stat=fs.fstatSync(handle,{bigint:true});
  const stage:OwnedFileStage={schemaVersion:1,name,dev:String(stat.dev),ino:String(stat.ino),birthtimeNs:String(stat.birthtimeNs)};
  let recorded=false,opened=true;
  try{
    await store(stage);recorded=true;
    await assertCurrentPermission();
    fs.writeFileSync(handle,bytes);fs.fsyncSync(handle);fs.closeSync(handle);opened=false;
    await assertCurrentPermission();
    await install(temporary);
  }finally{
    if(opened)fs.closeSync(handle);
    removeOwnedFileStage(destination,stage);
    if(recorded)await store(null);
  }
}
