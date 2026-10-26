import fs from 'node:fs/promises';
import {constants} from 'node:fs';
import path from 'node:path';
/** libuv's documented Windows exclusive sharing flag. Held by the actual index process.
 * https://github.com/libuv/libuv/blob/v1.51.0/include/uv/win.h
 * An actual second-open probe fails closed if a future runtime does not preserve it. */
export async function acquireWriterLock(root:string){
  if(process.platform!=='win32')throw Error('index_unavailable');
  const file=path.join(root,'.writer.lock'),flags=constants.O_RDWR|constants.O_CREAT|0x10000000;
  let owner;try{owner=await fs.open(file,flags,0o600);}catch{throw Error('index_busy');}
  try{
    const stat=await owner.stat();if(!stat.isFile()||stat.nlink!==1||(await fs.realpath(file)).toLowerCase()!==file.toLowerCase())throw Error('index_path');
    let second;
    try{second=await fs.open(file,flags,0o600);}catch(error){if(!['EACCES','EPERM','EBUSY'].includes((error as NodeJS.ErrnoException).code||''))throw error;}
    if(second){await second.close();throw Error('index_unavailable');}
    return owner;
  }catch(error){await owner.close();throw error;}
}
