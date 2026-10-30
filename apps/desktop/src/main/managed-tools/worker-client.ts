import {spawn} from 'node:child_process';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import type {ManagedToolResult} from '../../shared/managed-tools';

export type ComputationResult={value:unknown;runtime:string;elapsedMs:number};
export function runManagedComputation(wasm:string,code:string,input:unknown,signal?:AbortSignal,version='3.6.2'):Promise<ComputationResult>{
  signal?.throwIfAborted();
  return new Promise((resolve,reject)=>{
    const directory=path.dirname(fileURLToPath(import.meta.url));
    const worker=import.meta.url.endsWith('.ts')?path.resolve(directory,'../../../out/main/managed-tool-worker.js'):path.join(directory,'managed-tool-worker.js');
    const child=spawn(process.execPath,['--max-old-space-size=128',worker],{windowsHide:true,stdio:['ignore','ignore','pipe','ipc'],
      env:{ELECTRON_RUN_AS_NODE:'1',...(process.env.SystemRoot?{SystemRoot:process.env.SystemRoot}:{})}});
    let result:ManagedToolResult<ComputationResult>|undefined,failure:string|undefined,stderr=0;
    const stop=(code:string)=>{failure||=code;child.kill();};
    const abort=()=>stop('cancelled'),timer=setTimeout(()=>stop('timeout'),10000);
    signal?.addEventListener('abort',abort,{once:true});
    child.stderr?.on('data',(chunk:Buffer)=>{stderr+=chunk.length;if(stderr>8192)stop('worker_failed');});
    child.on('error',()=>{failure||='worker_failed';});
    child.on('message',(raw:unknown)=>{const reply=raw as ManagedToolResult<ComputationResult>&{schemaVersion:number};
      if(result||reply?.schemaVersion!==1||typeof reply.ok!=='boolean'){stop('worker_failed');return;}result=reply;});
    child.once('close',code=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);
      if(signal?.aborted)failure='cancelled';
      if(failure||code!==0||!result)return reject(Error(failure||'worker_failed'));
      if(!result.ok)return reject(Error(result.error));resolve(result.value);
    });
    child.send!({schemaVersion:1,wasm,code,input,version},error=>{if(error)stop('worker_failed');});
    if(signal?.aborted)abort();
  });
}
