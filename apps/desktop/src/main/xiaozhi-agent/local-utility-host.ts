import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {utilityProcess} from 'electron';
import {reserveHostStage} from '../host-resources/desktop';

// A cancelled receipt is not an exited process. Documents and images share this pool.
let workers=0;
/** Shared document/image/OCR slots; release only after the actual owned child exits. */
export function reserveLocalWorker(){
 if(workers>=8)return null;workers++;let released=false;
 return ()=>{if(!released){released=true;workers--;}};
}
type UtilityFailure='busy'|'cancelled'|'timeout'|'unavailable'|'parse_failed';
export async function runLocalUtility<T>(options:{entry:'pdf-text-worker.js'|'document-worker.js'|'image-worker.js'|'word-worker.js'|'inspection-worker.js';serviceName:string;
 request:unknown;timeout:number;signal:AbortSignal;valid:(value:unknown)=>value is T;fail:(error:UtilityFailure)=>T}):Promise<T>{
 const {signal,fail}=options;
 const cancelled=()=>fail(signal.reason==='timeout'?'timeout':'cancelled');
 if(signal.aborted)return cancelled();
 const deadline=performance.now()+options.timeout;
 let lease;
 try{lease=await reserveHostStage('local-utility',options.entry,'foreground',{cpu:1,memoryMiB:256,processes:1},options.timeout,signal);}
 catch(error){return signal.aborted?cancelled():fail((error as Error).message==='timeout'?'timeout':'busy');}
 if(!lease.start()){lease.settle();return signal.aborted?cancelled():fail('timeout');}
 const localRelease=reserveLocalWorker();if(!localRelease){lease.settle();return fail('busy');}
 const release=()=>{localRelease();lease.settle();};
 return new Promise(resolve=>{
  let settled=false;
  let child:Electron.UtilityProcess;
  const env=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP','LANG'].flatMap(key=>process.env[key]?[[key,process.env[key]!]]:[]));
  try{child=utilityProcess.fork(path.join(path.dirname(fileURLToPath(import.meta.url)),options.entry),[],{stdio:'pipe',serviceName:options.serviceName,env});}
  catch{release();resolve(fail('unavailable'));return;}
  const finish=(result:T)=>{
   if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);
   child.kill();resolve(result);
  };
  const abort=()=>finish(fail(signal.reason==='timeout'?'timeout':'cancelled'));
  const timer=setTimeout(()=>finish(fail('timeout')),Math.max(1,deadline-performance.now()));
  signal.addEventListener('abort',abort,{once:true});
  // Drain streams without exposing parser diagnostics, contents or paths.
  child.stderr?.on('data',()=>{});child.stdout?.on('data',()=>{});
  child.once('spawn',()=>{if(settled)child.kill();});
  child.once('exit',()=>{release();finish(fail('unavailable'));});
  child.on('message',value=>finish(options.valid(value)?value:fail('parse_failed')));
  try{child.postMessage(options.request);}catch{finish(fail('unavailable'));}
  if(signal.aborted)abort();
 });
}
