import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
let workers=0;
function localPython(){
 if(process.env.OMNI_EDU_PYTHON)return {command:process.env.OMNI_EDU_PYTHON,args:[]};
 if(process.platform!=='win32')return {command:'python3',args:[]};
 const command=['C:\\Python314\\python.exe','D:\\Anaconda\\python.exe','C:\\Windows\\py.exe'].find(existsSync)||'py';
 return {command,args:/(?:^|[\\/])py(?:\.exe)?$/i.test(command)?['-3']:[]};
}
/** Existing reading host shared by fixed reviewed workers; no arbitrary scripts. */
export async function runEducationWorker<T>(worker:'reading'|'learning'|'question',input:Record<string,unknown>,schema:string,signal:AbortSignal,inputLimit:number,outputLimit:number,valid:(v:unknown)=>v is T,project:(v:T)=>T):Promise<T>{
 if(!['reading','learning','question'].includes(worker))throw new Error('invalid_input');
 signal.throwIfAborted();
 const requestId=randomUUID(),bytes=Buffer.from(JSON.stringify({schemaVersion:schema,requestId,...input}));
 if(bytes.length>inputLimit)throw new Error('invalid_input');
 if(workers>=4)throw new Error('busy');workers++;
 const python=localPython();
 const env=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP','LANG'].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[]));
 return new Promise((resolve,reject)=>{
  let settled=false,released=false,out=Buffer.alloc(0),child:ReturnType<typeof spawn>;
  const release=()=>{if(!released){released=true;workers--;}};
  const finish=(error?:string,result?:T)=>{if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);child?.kill();error?reject(new Error(error)):resolve(result!);};
  const abort=()=>finish('cancelled');const timer=setTimeout(()=>finish('timeout'),5000);
  try{child=spawn(python.command,[...python.args,'-I','-S','-B','-X','utf8',path.join(path.dirname(fileURLToPath(import.meta.url)),worker+'-worker.py')],{env,windowsHide:true,stdio:['pipe','pipe','pipe']});}
  catch{clearTimeout(timer);release();reject(new Error('unavailable'));return;}
  child.once('error',()=>{release();finish('unavailable');});child.stderr!.on('data',()=>{});
  child.stdout!.on('data',(data:Buffer)=>{if(out.length+data.length>outputLimit)finish('unavailable');else out=Buffer.concat([out,data]);});
  child.once('close',code=>{
   release();if(settled)return;
   try{const value=JSON.parse(out.toString('utf8'));if(code!==0||value?.schemaVersion!==schema||value.requestId!==requestId)throw new Error();
    if(value.ok===false&&value.error==='invalid_input'){finish('invalid_input');return;}
    if(value.ok!==true||!valid(value))throw new Error();finish(undefined,project(value));}catch{finish('unavailable');}
  });
  child.stdin!.on('error',()=>finish('unavailable'));signal.addEventListener('abort',abort,{once:true});child.stdin!.end(bytes);if(signal.aborted)abort();
 });
}
