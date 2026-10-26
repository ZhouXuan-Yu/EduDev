import {spawn} from 'node:child_process';
import {existsSync} from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {frozenEducationCommand,type EducationWorker} from './runtime-command';
let workers=0;
function localPython(){
 if(process.env.OMNI_EDU_PYTHON)return {command:process.env.OMNI_EDU_PYTHON,args:[]};
 if(process.platform!=='win32')return {command:'python3',args:[]};
 const bundled=process.resourcesPath?path.join(process.resourcesPath,'python-embed','python.exe'):'';
 const command=[bundled,'C:\\Python314\\python.exe','D:\\Anaconda\\python.exe','C:\\Windows\\py.exe'].filter(Boolean).find(existsSync)||'py';
 return {command,args:/(?:^|[\\/])py(?:\.exe)?$/i.test(command)?['-3']:[]};
}
/** Existing reading host shared by fixed reviewed workers; no arbitrary scripts. */
export async function runEducationWorker<T>(worker:'reading'|'learning'|'question'|'math',input:Record<string,unknown>,schema:string,signal:AbortSignal,inputLimit:number,outputLimit:number,valid:(v:unknown)=>v is T,project:(v:T)=>T):Promise<T>{
 if(!['reading','learning','question','math'].includes(worker))throw new Error('invalid_input');
 signal.throwIfAborted();
 const requestId=randomUUID(),bytes=Buffer.from(JSON.stringify({schemaVersion:schema,requestId,...input}));
 if(bytes.length>inputLimit)throw new Error('invalid_input');
 if(workers>=4)throw new Error('busy');workers++;
 let released=false,started=false,timedOut=false;
 const release=()=>{if(!released){released=true;workers--;}};
 const controller=new AbortController(),cancel=()=>controller.abort();
 signal.addEventListener('abort',cancel,{once:true});if(signal.aborted)cancel();
 const deadline=setTimeout(()=>{timedOut=true;controller.abort();},worker==='math'?15000:5000);
 const failure=()=>timedOut?'timeout':signal.aborted?'cancelled':'unavailable';
 try{
 const browser=(process as NodeJS.Process&{type?:string}).type==='browser';
 const packaged=browser?(await import('electron')).app.isPackaged:false;
 let command:{command:string;args:string[]};
 try{command=packaged?await frozenEducationCommand(process.resourcesPath,worker as EducationWorker,controller.signal):(()=>{const python=localPython();return {command:python.command,args:[...python.args,'-I','-S','-B','-X','utf8',path.join(path.dirname(fileURLToPath(import.meta.url)),worker+'-worker.py')]};})();}catch{throw new Error(failure());}
 if(controller.signal.aborted)throw new Error(failure());
 const env=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP','LANG'].flatMap(k=>process.env[k]?[[k,process.env[k]!]]:[]));
 return await new Promise<T>((resolve,reject)=>{
  let settled=false,stderrBytes=0,out=Buffer.alloc(0),child:ReturnType<typeof spawn>;
  const finish=(error?:string,result?:T)=>{if(settled)return;settled=true;controller.signal.removeEventListener('abort',abort);child?.kill();error?reject(new Error(error)):resolve(result!);};
  const abort=()=>finish(failure());
  try{child=spawn(command.command,command.args,{env,windowsHide:true,stdio:['pipe','pipe','pipe']});started=true;}
  catch{reject(new Error('unavailable'));return;}
  child.once('error',()=>{release();finish('unavailable');});child.stderr!.on('data',(data:Buffer)=>{stderrBytes+=data.length;if(stderrBytes>65536)finish('unavailable');});
  child.stdout!.on('data',(data:Buffer)=>{if(out.length+data.length>outputLimit)finish('unavailable');else out=Buffer.concat([out,data]);});
  child.once('close',code=>{
   release();if(settled)return;
   try{const value=JSON.parse(out.toString('utf8'));if(code!==0||value?.schemaVersion!==schema||value.requestId!==requestId)throw new Error();
    if(value.ok===false&&value.error==='invalid_input'){finish('invalid_input');return;}
    if(value.ok!==true||!valid(value))throw new Error();finish(undefined,project(value));}catch{finish('unavailable');}
  });
  child.stdin!.on('error',()=>finish('unavailable'));controller.signal.addEventListener('abort',abort,{once:true});child.stdin!.end(bytes);if(controller.signal.aborted)abort();
 });
 }finally{clearTimeout(deadline);signal.removeEventListener('abort',cancel);if(!started)release();}
}
