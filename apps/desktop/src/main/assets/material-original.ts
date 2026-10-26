import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
/** Archive integrity is independent of the parser's in-memory input limit. */
export async function verifyMaterialOriginal(rootPath:string,file:string,version:string,signal:AbortSignal):Promise<void>{
 signal.throwIfAborted();const root=path.resolve(rootPath),target=path.resolve(file);
 if(path.dirname(target)!==root)throw new Error('missing');
 const rootStat=await fs.lstat(root);
 if(rootStat.isSymbolicLink()||(await fs.realpath(root)).toLowerCase()!==root.toLowerCase())throw new Error('missing');
 async function identity(){const s=await fs.lstat(target);if(!s.isFile()||s.isSymbolicLink()||s.nlink!==1||(await fs.realpath(target)).toLowerCase()!==target.toLowerCase())throw new Error('missing');return s;}
 const before=await identity(),handle=await fs.open(target,'r');
 const same=(s:typeof before)=>s.isFile()&&s.nlink===1&&s.dev===before.dev&&s.ino===before.ino&&s.size===before.size&&s.mtimeMs===before.mtimeMs&&s.ctimeMs===before.ctimeMs;
 try{
  if(!same(await handle.stat()))throw new Error('source_changed');
  const buffer=Buffer.alloc(256*1024),hash=createHash('sha256');let length=0;
  for(;;){signal.throwIfAborted();const {bytesRead}=await handle.read(buffer,0,buffer.length,null);if(!bytesRead)break;hash.update(buffer.subarray(0,bytesRead));length+=bytesRead;if(length>before.size)throw new Error('source_changed');}
  signal.throwIfAborted();if(length!==before.size||!same(await handle.stat())||!same(await identity())||hash.digest('hex')!==version)throw new Error('source_changed');
 }finally{await handle.close();}
}
/** Bound the bytes at the file descriptor, reject link/path swaps, retain the original truth. */
export async function readMaterialOriginal(rootPath:string,file:string,version:string,signal:AbortSignal,maxBytes:number):Promise<Buffer>{
 signal.throwIfAborted();const root=path.resolve(rootPath),target=path.resolve(file);
 if(path.dirname(target)!==root)throw new Error('missing');
 const rootStat=await fs.lstat(root);
 if(rootStat.isSymbolicLink()||(await fs.realpath(root)).toLowerCase()!==root.toLowerCase())throw new Error('missing');
 async function identity(){const stat=await fs.lstat(target);if(!stat.isFile()||stat.isSymbolicLink()||stat.nlink!==1||(await fs.realpath(target)).toLowerCase()!==target.toLowerCase())throw new Error('missing');if(stat.size>maxBytes)throw new Error('too_large');return stat;}
 const before=await identity(),handle=await fs.open(target,'r');
 const same=(a:Awaited<ReturnType<typeof identity>>,b:Awaited<ReturnType<typeof identity>>)=>a.dev===b.dev&&a.ino===b.ino&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs&&b.nlink===1&&b.isFile();
 try{
  if(!same(before,await handle.stat()))throw new Error('source_changed');
  const bytes=Buffer.alloc(before.size+1);let length=0;
  while(length<bytes.length){signal.throwIfAborted();const next=await handle.read(bytes,length,bytes.length-length,null);if(!next.bytesRead)break;length+=next.bytesRead;}
  signal.throwIfAborted();if(length>maxBytes)throw new Error('too_large');
  if(length!==before.size||!same(before,await handle.stat())||!same(before,await identity()))throw new Error('source_changed');
  const result=bytes.subarray(0,length);if(createHash('sha256').update(result).digest('hex')!==version)throw new Error('source_changed');return result;
 }finally{await handle.close();}
}
