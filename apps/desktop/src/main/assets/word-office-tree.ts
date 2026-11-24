import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {noLinks} from '../xiaozhi-agent/managed-skills';

type WordOfficeTreePin={files:number;installedBytes:number;treeSha256:string};
type WordOfficeFile={local:string;name:string};

const parallelReads=8;
const maxFileBytes=256*1024**2;
const readBlockBytes=256*1024;

async function* officeFiles(folder:string,signal:AbortSignal,relative='',includePyCache=false):AsyncGenerator<WordOfficeFile>{
 const entries=await fs.readdir(folder,{withFileTypes:true});
 entries.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
 for(const entry of entries){
  signal.throwIfAborted();
  if(entry.isSymbolicLink())throw Error('configuration');
  if(!includePyCache&&entry.name==='__pycache__')continue;
  const local=path.join(folder,entry.name),name=relative?relative+'/'+entry.name:entry.name;
  if(entry.isDirectory())yield* officeFiles(local,signal,name,includePyCache);
  else if(entry.isFile())yield {local,name};
  else throw Error('configuration');
 }
}

async function hashOfficeFile(entry:WordOfficeFile,signal:AbortSignal){
 signal.throwIfAborted();
 const handle=await fs.open(entry.local,'r');
 try{
  const stat=await handle.stat();
  if(!stat.isFile()||stat.size>maxFileBytes)throw Error('configuration');
  const hash=createHash('sha256');
  const buffer=Buffer.allocUnsafe(Math.max(1,Math.min(readBlockBytes,stat.size)));
  let bytes=0;
  while(bytes<stat.size){
   signal.throwIfAborted();
   const amount=Math.min(buffer.length,stat.size-bytes);
   const {bytesRead}=await handle.read(buffer,0,amount,bytes);
   if(!bytesRead)throw Error('configuration');
   hash.update(buffer.subarray(0,bytesRead));
   bytes+=bytesRead;
  }
  if((await handle.read(buffer,0,1,bytes)).bytesRead)throw Error('configuration');
  return {name:entry.name,bytes,sha256:hash.digest('hex')};
 }finally{
  await handle.close();
 }
}

export async function verifyOfficeTree(root:string,pin:WordOfficeTreePin,signal:AbortSignal,includePyCache=false){
 signal.throwIfAborted();
 noLinks(root);
 const hash=createHash('sha256');
 const batch:WordOfficeFile[]=[];
 let bytes=0,count=0;
 async function includeBatch(){
  // Wait for every owned file handle to close before propagating a failure or cancellation.
  const results=await Promise.allSettled(batch.map(entry=>hashOfficeFile(entry,signal)));
  signal.throwIfAborted();
  for(const result of results){
   if(result.status==='rejected')throw result.reason;
   const entry=result.value;
   bytes+=entry.bytes;
   if(bytes>pin.installedBytes)throw Error('configuration');
   hash.update(entry.name+'\0'+entry.bytes+'\0'+entry.sha256+'\n');
  }
  batch.length=0;
 }
 for await(const entry of officeFiles(root,signal,'',includePyCache)){
  if(++count>pin.files)throw Error('configuration');
  batch.push(entry);
  if(batch.length===parallelReads)await includeBatch();
 }
 if(batch.length)await includeBatch();
 if(count!==pin.files||bytes!==pin.installedBytes||hash.digest('hex')!==pin.treeSha256)throw Error('configuration');
 signal.throwIfAborted();
 return path.join(root,'program');
}
