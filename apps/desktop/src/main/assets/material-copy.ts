import {createReadStream,createWriteStream} from 'node:fs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {pipeline} from 'node:stream/promises';
/** Bounded streaming copy; cancellation removes only this operation's new private target. */
export async function copyMaterialFile(source:string,target:string,bytes:number,signal:AbortSignal){
 signal.throwIfAborted();
 const space=await fs.statfs(path.dirname(target));
 if(space.bavail*space.bsize<bytes+64*1048576)throw Object.assign(new Error('磁盘空间不足，请释放空间后重试。'),{code:'ENOSPC'});
 let created=false;
 const output=createWriteStream(target,{flags:'wx'});output.once('open',()=>{created=true;});
 try{await pipeline(createReadStream(source),output,{signal});}
 catch(error){if(created)await fs.rm(target,{force:true});throw error;}
}
