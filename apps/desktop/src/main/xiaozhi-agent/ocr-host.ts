import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {createHash} from 'node:crypto';
import {app} from 'electron';
import {LOCAL_OCR_SCHEMA,validLocalOcrReceipt,type LocalOcrReceipt} from '../../shared/xiaozhi-ocr';
import {reserveLocalWorker} from './local-utility-host';
import manifest from './ocr-runtime-manifest.json';

function runtimeRoot(){
 if(app.isPackaged)return path.join(process.resourcesPath,'ocr-runtime');
 let current=path.dirname(fileURLToPath(import.meta.url));
 for(let level=0;level<10;level++,current=path.dirname(current)){
  const pkg=path.join(current,'package.json');
  try{if(JSON.parse(fs.readFileSync(pkg,'utf8')).name==='omni-edu-desktop-prototype')return path.join(current,'.local-ocr','dist','omni-edu-ocr');}catch{/* Only fixed ancestor application roots. */}
 }
 throw new Error('unavailable');
}
export async function recognizeLocalImage(bytes:Buffer,signal:AbortSignal,ownedRuntimeRoot?:string):Promise<Extract<LocalOcrReceipt,{ok:true}>>{
 signal.throwIfAborted();if(!bytes.length||bytes.length>4*1048576)throw new Error('too_large');
 const root=ownedRuntimeRoot??runtimeRoot();if(!path.isAbsolute(root)||!fs.existsSync(root)||fs.lstatSync(root).isSymbolicLink())throw new Error('unavailable');
 // Compiled application lock, not an attacker-supplied manifest next to an executable.
 for(const file of manifest.files){
  signal.throwIfAborted();const target=path.join(root,file.path);let cursor=root;
  for(const piece of file.path.split('/')){cursor=path.join(cursor,piece);if((await fs.promises.lstat(cursor)).isSymbolicLink())throw new Error('configuration');}
  const stat=await fs.promises.stat(target);if(!stat.isFile()||stat.size!==file.size||createHash('sha256').update(await fs.promises.readFile(target)).digest('hex')!==file.sha256)throw new Error('configuration');
 }
 signal.throwIfAborted();const release=reserveLocalWorker();if(!release)throw new Error('busy');
 return new Promise((resolve,reject)=>{
  let stdout='',size=0,reason='',settled=false;
  const env=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP'].flatMap(key=>process.env[key]?[[key,process.env[key]!]]:[]));
  let child:ReturnType<typeof spawn>;
  try{child=spawn(path.join(root,'omni-edu-ocr.exe'),[],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});}catch{release();reject(new Error('unavailable'));return;}
  const stop=(code:string)=>{reason=code;child.kill();};
  const abort=()=>stop(signal.reason==='timeout'?'timeout':'cancelled');
  const timer=setTimeout(()=>stop('timeout'),45000);
  const finish=(error?:string)=>{
   if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);release();
   if(error||reason||signal.aborted){reject(new Error(reason||error||'cancelled'));return;}
   let value:unknown;try{value=JSON.parse(stdout);}catch{reject(new Error('parse_failed'));return;}
   if(!validLocalOcrReceipt(value)){reject(new Error('parse_failed'));return;}
   if(!value.ok){reject(new Error(value.error));return;}resolve(value);
  };
  signal.addEventListener('abort',abort,{once:true});
  child.stdout?.on('data',value=>{size+=value.length;if(size>1024*1024)stop('too_large');else stdout+=String(value);});
  child.stderr?.on('data',value=>{size+=value.length;if(size>1024*1024)stop('too_large');});
  child.once('error',()=>finish('unavailable'));
  child.once('exit',code=>finish(code===0?undefined:'parse_failed'));
  child.stdin?.on('error',()=>{if(!reason)stop('unavailable');});
  child.stdin?.end(JSON.stringify({schemaVersion:LOCAL_OCR_SCHEMA,parentPid:process.pid,data:bytes.toString('base64')})+'\n');
  if(signal.aborted)abort();
 });
}
