import fs from 'node:fs';
import io from 'node:fs/promises';
import path from 'node:path';
import {SKILL_LIMITS,validSkillRelative} from './skill-catalog-state';

const canonical=(value:string)=>process.platform==='win32'?path.resolve(value).toLowerCase():path.resolve(value);
const unchanged=(a:fs.Stats,b:fs.Stats)=>a.ino===b.ino&&a.dev===b.dev&&a.size===b.size&&a.mtimeMs===b.mtimeMs&&a.ctimeMs===b.ctimeMs;
async function sourceIO<T>(work:()=>Promise<T>,signal?:AbortSignal):Promise<T>{
 try{return await work();}catch(error){signal?.throwIfAborted();if(['ENOENT','ENOTDIR','ELOOP'].includes(String((error as NodeJS.ErrnoException)?.code)))throw Error('skill_source_changed');throw error;}
}
/** Same complete link/content boundary as the idle sync reader, yielding every IO. */
export async function noLinksAsync(target:string,signal?:AbortSignal){
 return sourceIO(async()=>{
 signal?.throwIfAborted();const absolute=path.resolve(target),anchor=path.parse(absolute).root;
 if(!path.isAbsolute(target)||!anchor||target.includes('\0'))throw Error('invalid_input');
 let current=anchor;
 for(const part of absolute.slice(anchor.length).split(path.sep).filter(Boolean)){
  signal?.throwIfAborted();current=path.join(current,part);const stat=await io.lstat(current);signal?.throwIfAborted();
  if(stat.isSymbolicLink()||canonical(await io.realpath(current))!==canonical(current))throw Error('skill_source_changed');
 }
 signal?.throwIfAborted();
 },signal);
}
export async function boundedReadAsync(file:string,limit:number,signal?:AbortSignal):Promise<Buffer>{
 return sourceIO(async()=>{
 if(!Number.isSafeInteger(limit)||limit<0||limit>SKILL_LIMITS.bytes)throw Error('invalid_input');
 await noLinksAsync(file,signal);const handle=await io.open(file,fs.constants.O_RDONLY|(fs.constants.O_NOFOLLOW||0));
 try{
  signal?.throwIfAborted();const before=await handle.stat();
  if(!before.isFile()||before.size>limit)throw Error('invalid_input');
  const buffer=Buffer.alloc(before.size+1);let count=0,size=0;
  do{signal?.throwIfAborted();({bytesRead:size}=await handle.read(buffer,count,buffer.length-count,count));count+=size;}while(size&&count<buffer.length);
  const after=await handle.stat();await noLinksAsync(file,signal);const named=await io.lstat(file);signal?.throwIfAborted();
  if(count>limit||count!==before.size||!unchanged(before,after)||!named.isFile()||!unchanged(before,named))throw Error('skill_source_changed');
  return buffer.subarray(0,count);
 }finally{await handle.close();}
 },signal);
}
export async function readPackageAsync(directory:string,signal?:AbortSignal):Promise<Map<string,Buffer>>{
 return sourceIO(async()=>{
 const bytes=new Map<string,Buffer>();let nodes=0,total=0;
 const visit=async(dir:string,prefix:string,depth:number):Promise<void>=>{
  signal?.throwIfAborted();if(depth>SKILL_LIMITS.depth)throw Error('invalid_input');
  await noLinksAsync(dir,signal);const before=await io.lstat(dir);if(!before.isDirectory())throw Error('invalid_input');
  const iterator=await io.opendir(dir),seen=new Set<string>();
  try{signal?.throwIfAborted();let entry:fs.Dirent|null;while((entry=await iterator.read())){
   signal?.throwIfAborted();if(++nodes>SKILL_LIMITS.nodes)throw Error('invalid_input');
   const relative=prefix?`${prefix}/${entry.name}`:entry.name;
   if(!validSkillRelative(relative)||seen.has(entry.name.toLowerCase()))throw Error('invalid_input');seen.add(entry.name.toLowerCase());
   const file=path.join(dir,entry.name),stat=await io.lstat(file);signal?.throwIfAborted();
   if(stat.isSymbolicLink())throw Error('skill_source_changed');
   if(stat.isDirectory())await visit(file,relative,depth+1);
   else if(stat.isFile()){
    if(bytes.size>=SKILL_LIMITS.files)throw Error('invalid_input');
    const content=await boundedReadAsync(file,relative==='SKILL.md'?SKILL_LIMITS.instructionBytes:SKILL_LIMITS.fileBytes,signal);
    if((total+=content.length)>SKILL_LIMITS.bytes)throw Error('invalid_input');bytes.set(relative,content);
   }else throw Error('invalid_input');
  }}finally{await iterator.close();}
  await noLinksAsync(dir,signal);const after=await io.lstat(dir);signal?.throwIfAborted();
  if(!after.isDirectory()||!unchanged(before,after))throw Error('skill_source_changed');
 };
 await visit(directory,'',0);if(!bytes.get('SKILL.md')?.length)throw Error('invalid_input');return bytes;
 },signal);
}
