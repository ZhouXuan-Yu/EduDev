import fs from 'node:fs/promises';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import yauzl from 'yauzl';
import {noLinks} from '../xiaozhi-agent/managed-skills';
import type {WordOfficeProgress} from '../../shared/material-word-drawing';

export const WORD_OFFICE_COMPONENT={
 id:'libreoffice-word-drawing',version:'26.8.2',license:'MPL-2.0 and bundled notices',
 downloadBytes:375934976+740956,installedBytes:1526232897,
 msi:{name:'LibreOffice_26.8.2_Win_x86-64.msi',bytes:375934976,sha256:'ff4b911403b67ee9e6249f820f9782c44bb32c94fdaa45b0da53a8e419e5307a',url:'https://download.documentfoundation.org/libreoffice/stable/26.8.2/win/x86_64/LibreOffice_26.8.2_Win_x86-64.msi'},
 extractor:{name:'lessmsi-v2.12.9.zip',bytes:740956,sha256:'5b4e187e74b184ad3a63ccf06c3d17dae2b8c4b6c298a996dbd51a9f6db29d21',url:'https://github.com/activescott/lessmsi/releases/download/v2.12.9/lessmsi-v2.12.9.zip',license:'MIT'},
 // Entire extracted tree, ordered by ordinal UTF16 file name, excluding Python
 // bytecode caches. Python is launched with an isolated cache prefix.
 treeSha256:'36dbb393603e2a1513546c8d10dd6efc745c6522063a4ad51097390c8802ec6f',files:19271,
} as const;
const digest=(bytes:Uint8Array)=>createHash('sha256').update(bytes).digest('hex');

/** Termination targets the PID returned by this spawn, including its descendants.
 * A cancelled receipt is returned only after that process tree has exited.
 */
export function runWordOfficeProcess(executable:string,args:string[],options:{cwd:string;env?:NodeJS.ProcessEnv;input?:string;signal:AbortSignal;timeout:number;stdoutLimit?:number}):Promise<string>{
 options.signal.throwIfAborted();
 return new Promise((resolve,reject)=>{
  const child=spawn(executable,args,{cwd:options.cwd,env:options.env,windowsHide:true,stdio:['pipe','pipe','pipe']});
  const chunks:Buffer[]=[];let size=0,stderr=0,reason='',closed=false,killing:Promise<void>|undefined;
  const kill=()=>{
   if(killing||closed||!child.pid)return;
   killing=new Promise<void>(done=>{
    const killer=spawn(path.join(process.env.SystemRoot||'C:\\Windows','System32','taskkill.exe'),['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
    killer.once('error',()=>{child.kill();done();});killer.once('close',()=>done());
   });
  };
  const stop=(error:string)=>{if(!reason)reason=error;kill();};
  const abort=()=>stop('cancelled');
  const timer=setTimeout(()=>stop('timeout'),options.timeout);
  child.stdout.on('data',(data:Buffer)=>{
   size+=data.length;if(size>(options.stdoutLimit??65536)){stop('too_large');return;}
   chunks.push(Buffer.from(data));
  });
  child.stderr.on('data',(data:Buffer)=>{stderr+=data.length;if(stderr>65536)stop('too_large');});
  child.stdin.on('error',()=>stop('unavailable'));
  child.once('error',()=>{reason ||= 'unavailable';});
  child.once('close',code=>{
   closed=true;clearTimeout(timer);options.signal.removeEventListener('abort',abort);
   void (killing||Promise.resolve()).then(()=>{
    if(reason||code!==0)reject(Error(reason||'parse_failed'));
    else resolve(Buffer.concat(chunks).toString('utf8'));
   });
  });
  options.signal.addEventListener('abort',abort,{once:true});
  if(options.signal.aborted)abort();
  child.stdin.end(options.input);
 });
}

export async function verifyWordOfficeTree(root:string,signal:AbortSignal){
 noLinks(root);
 const hash=createHash('sha256');let bytes=0,count=0;
 async function walk(folder:string,relative=''){
  const entries=await fs.readdir(folder,{withFileTypes:true});
  entries.sort((a,b)=>a.name<b.name?-1:a.name>b.name?1:0);
  for(const entry of entries){
   signal.throwIfAborted();
   const name=relative?relative+'/'+entry.name:entry.name,file=path.join(folder,entry.name);
   if(entry.isSymbolicLink())throw Error('configuration');
   if(entry.name==='__pycache__')continue;
   if(entry.isDirectory())await walk(file,name);
   else if(entry.isFile()){
    const stat=await fs.stat(file);
    if(stat.size>256*1048576||bytes+stat.size>WORD_OFFICE_COMPONENT.installedBytes)throw Error('configuration');
    const data=await fs.readFile(file);bytes+=data.length;count++;
    if(bytes>WORD_OFFICE_COMPONENT.installedBytes||count>WORD_OFFICE_COMPONENT.files)throw Error('configuration');
    hash.update(name+'\0'+data.length+'\0'+digest(data)+'\n');
   }else throw Error('configuration');
  }
 }
 await walk(root);
 if(count!==WORD_OFFICE_COMPONENT.files||bytes!==WORD_OFFICE_COMPONENT.installedBytes||hash.digest('hex')!==WORD_OFFICE_COMPONENT.treeSha256)throw Error('configuration');
 signal.throwIfAborted();return path.join(root,'program');
}

async function extractLessMsi(file:string,folder:string,signal:AbortSignal){
 const data=await fs.readFile(file);
 if(data.length!==WORD_OFFICE_COMPONENT.extractor.bytes||digest(data)!==WORD_OFFICE_COMPONENT.extractor.sha256)throw Error('configuration');
 const zip=await new Promise<yauzl.ZipFile>((resolve,reject)=>yauzl.fromBuffer(data,{lazyEntries:true,strictFileNames:true},(error,value)=>error?reject(error):resolve(value!)));
 let total=0,count=0;
 try{
  await new Promise<void>((resolve,reject)=>{
   zip.once('error',reject);zip.once('end',resolve);
   zip.on('entry',(entry:yauzl.Entry)=>{void(async()=>{
    signal.throwIfAborted();
    if(++count>200||entry.isEncrypted()||entry.fileName.includes('\\')||entry.fileName.startsWith('/')||entry.fileName.split('/').some(p=>p==='..'||p==='.')||(total+=entry.uncompressedSize)>5*1048576)throw Error('configuration');
    const target=path.resolve(folder,entry.fileName);
    if(!target.startsWith(path.resolve(folder)+path.sep))throw Error('configuration');
    if(entry.fileName.endsWith('/'))await fs.mkdir(target,{recursive:true});
    else{
     const stream=await new Promise<NodeJS.ReadableStream>((yes,no)=>zip.openReadStream(entry,(error,value)=>error?no(error):yes(value!)));
     const chunks:Buffer[]=[];let size=0;
     for await(const raw of stream as AsyncIterable<Buffer>){signal.throwIfAborted();size+=raw.length;if(size>entry.uncompressedSize)throw Error('configuration');chunks.push(raw);}
     if(size!==entry.uncompressedSize)throw Error('configuration');
     await fs.mkdir(path.dirname(target),{recursive:true});await fs.writeFile(target,Buffer.concat(chunks),{flag:'wx'});
    }
    zip.readEntry();
   })().catch(reject);});zip.readEntry();
  });
 }finally{zip.close();}
}

export function createWordOfficeComponent(options:{root:string;fetch?:typeof fetch;onProgress?:(value:WordOfficeProgress)=>void}){
 const root=path.resolve(options.root),recipe=WORD_OFFICE_COMPONENT,target=path.join(root,recipe.id+'-'+recipe.version),cache=path.join(root,'downloads');
 const publish=(phase:WordOfficeProgress['phase'],downloadedBytes=0,error?:string)=>options.onProgress?.({phase,downloadedBytes,totalBytes:recipe.downloadBytes,installedBytes:recipe.installedBytes,...(error?{error}:{})});
 async function download(item:typeof recipe.msi|typeof recipe.extractor,signal:AbortSignal,offset:number){
  signal=AbortSignal.any([signal,AbortSignal.timeout(20*60*1000)]);
  const file=path.join(cache,item.name);noLinks(file,true);
  try{const data=await fs.readFile(file);if(data.length===item.bytes&&digest(data)===item.sha256)return file;}catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
  const temporary=path.join(cache,item.name+'.'+randomUUID()+'.part');let handle;
  try{
   const response=await(options.fetch||globalThis.fetch)(item.url,{signal,credentials:'omit'});
   if(!response.ok||!response.body)throw Error('unavailable');
   handle=await fs.open(temporary,'wx',0o600);let size=0;const hash=createHash('sha256');
   const reader=response.body.getReader();
   try{
    for(;;){const {done,value}=await reader.read();if(done)break;signal.throwIfAborted();size+=value.length;if(size>item.bytes)throw Error('configuration');hash.update(value);await handle.writeFile(value);publish('downloading',offset+size);}
   }finally{await reader.cancel().catch(()=>{});reader.releaseLock();}
   if(size!==item.bytes||hash.digest('hex')!==item.sha256)throw Error('configuration');
   await handle.sync();await handle.close();handle=undefined;signal.throwIfAborted();
   await fs.rename(temporary,file);return file;
  }finally{await handle?.close();await fs.unlink(temporary).catch(error=>{if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;});}
 }
 return {async ensure(signal:AbortSignal){
  if(process.platform!=='win32'||process.arch!=='x64')throw Error('unavailable');
  publish('checking');signal.throwIfAborted();
  noLinks(root,true);await fs.mkdir(root,{recursive:true});noLinks(root);
  let damaged=false;
  if(await fs.stat(target).catch(error=>{if((error as NodeJS.ErrnoException).code==='ENOENT')return undefined;throw error;})){
   publish('verifying');
   try{const program=await verifyWordOfficeTree(target,signal);publish('ready');return program;}
   catch(error){signal.throwIfAborted();if(!(error instanceof Error)||error.message!=='configuration')throw error;damaged=true;}
  }
  const lock=path.join(root,recipe.id+'.lock');let ownedLock,stage:string|undefined;
  try{
   // Electron's single-instance lock owns this userData. A dead installation
   // owner can therefore be recovered without taking a live process's lock.
   noLinks(lock,true);
   try{
    const stat=await fs.stat(lock);if(stat.size>256)throw Error('configuration');
    const content=await fs.readFile(lock,'utf8');let owner:{pid:number}|undefined;
    try{const value=JSON.parse(content);if(Number.isSafeInteger(value?.pid)&&value.pid>0)owner=value;}catch{/* Interrupted initial owner write. */}
    if(!owner){
     if(await fs.readFile(lock,'utf8')===content)await fs.rename(lock,lock+'.interrupted-'+randomUUID());
    }else{
     let alive=true;try{process.kill(owner.pid,0);}catch(error){if((error as NodeJS.ErrnoException).code==='ESRCH')alive=false;else throw error;}
     if(!alive&&await fs.readFile(lock,'utf8')===content)await fs.unlink(lock);
    }
   }catch(error){if((error as NodeJS.ErrnoException).code!=='ENOENT')throw error;}
   ownedLock=await fs.open(lock,'wx',0o600).catch(error=>{if((error as NodeJS.ErrnoException).code==='EEXIST')throw Error('busy');throw error;});
   await ownedLock.writeFile(JSON.stringify({pid:process.pid,nonce:randomUUID()}));
   const disk=await fs.statfs(root);if(Number(disk.bavail)*Number(disk.bsize)<3*1024**3)throw Error('disk_full');
   await fs.mkdir(cache,{recursive:true});noLinks(cache);
   const msi=await download(recipe.msi,signal,0),extractor=await download(recipe.extractor,signal,recipe.msi.bytes);
   stage=path.join(root,'.office-'+randomUUID());await fs.mkdir(stage);
   const less=path.join(stage,'lessmsi');await fs.mkdir(less);await extractLessMsi(extractor,less,signal);
   const output=path.join(stage,'unpacked');publish('extracting',recipe.downloadBytes);
   await runWordOfficeProcess(path.join(less,'lessmsi.exe'),['x',msi,output+path.sep],{cwd:stage,signal,timeout:600000,stdoutLimit:4*1048576});
   const extracted=path.join(output,'SourceDir','LibreOffice');publish('verifying',recipe.downloadBytes);
   await verifyWordOfficeTree(extracted,signal);signal.throwIfAborted();
   const quarantine=path.join(root,'.damaged-office-'+randomUUID());
   if(damaged){noLinks(target);await fs.rename(target,quarantine);}
   try{await fs.rename(extracted,target);}
   catch(error){if(damaged)await fs.rename(quarantine,target);throw error;}
   publish('ready',recipe.downloadBytes);return path.join(target,'program');
  }catch(error){publish('failed',0,error instanceof Error?error.message:'configuration');throw error;}
  finally{
   if(ownedLock){await ownedLock.close();await fs.unlink(lock);}
   if(stage){
    const resolved=path.resolve(stage);if(path.dirname(resolved)!==root||!path.basename(resolved).startsWith('.office-'))throw Error('configuration');
    await fs.rm(resolved,{recursive:true,force:true});
   }
  }
 }};
}
