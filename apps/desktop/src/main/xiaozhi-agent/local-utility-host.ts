import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {utilityProcess} from 'electron';
import {reserveHostStage} from '../host-resources/desktop';
import {runMaterialWorker} from '../host-resources/material-buffer-budget';

// A cancelled receipt is not an exited process. Documents and images share this pool.
let workers=0;
/** Shared document/image/OCR slots; release only after the actual owned child exits. */
export function reserveLocalWorker(){
 if(workers>=8)return null;workers++;let released=false;
 return ()=>{if(!released){released=true;workers--;}};
}
type UtilityFailure='busy'|'cancelled'|'timeout'|'unavailable'|'parse_failed';
type UtilityOptions<T>={entry:'pdf-text-worker.js'|'document-worker.js'|'image-worker.js'|'word-worker.js'|'inspection-worker.js';serviceName:string;
 request:unknown;timeout:number;signal:AbortSignal;valid:(value:unknown)=>value is T;fail:(error:UtilityFailure)=>T};
const utilityDemand={cpu:1,memoryMiB:256,processes:1};

export async function runLocalUtility<T>(options:UtilityOptions<T>):Promise<T>{
 const {signal,fail}=options;
 const cancelled=()=>fail(signal.reason==='timeout'?'timeout':'cancelled');
 if(signal.aborted)return cancelled();
 const deadline=performance.now()+options.timeout;
 let lease;
 try{
  const material=runMaterialWorker(signal,utilityDemand,options.timeout,
   remaining=>runUtilityProcess(options,performance.now()+remaining,true,()=>{}));
  if(material)return await material;
  lease=await reserveHostStage('local-utility',options.entry,'foreground',utilityDemand,options.timeout,signal);
 }
 catch(error){return signal.aborted?cancelled():fail((error as Error).message==='timeout'?'timeout':'busy');}
 if(!lease.start()){lease.settle();return signal.aborted?cancelled():fail('timeout');}
 return runUtilityProcess(options,deadline,false,()=>lease.settle());
}

function runUtilityProcess<T>(options:UtilityOptions<T>,deadline:number,waitForExit:boolean,settle:()=>void):Promise<T>{
 const {signal,fail}=options;
 const cancelled=()=>fail(signal.reason==='timeout'?'timeout':'cancelled');
 const localRelease=reserveLocalWorker();if(!localRelease){settle();return Promise.resolve(fail('busy'));}
 const release=()=>{localRelease();settle();};
 return new Promise(resolve=>{
  let settled=false;
  let resultAfterExit:T;
  let child:Electron.UtilityProcess;
  const env=Object.fromEntries(['SystemRoot','WINDIR','TEMP','TMP','LANG'].flatMap(key=>process.env[key]?[[key,process.env[key]!]]:[]));
  try{child=utilityProcess.fork(path.join(path.dirname(fileURLToPath(import.meta.url)),options.entry),[],{stdio:'pipe',serviceName:options.serviceName,env});}
  catch{release();resolve(fail('unavailable'));return;}
  const finish=(result:T)=>{
   if(settled)return;settled=true;clearTimeout(timer);signal.removeEventListener('abort',abort);
   resultAfterExit=result;
   child.kill();if(!waitForExit)resolve(result);
  };
  const abort=()=>finish(cancelled());
  const timer=setTimeout(()=>finish(fail('timeout')),Math.max(1,deadline-performance.now()));
  signal.addEventListener('abort',abort,{once:true});
  // Drain streams without exposing parser diagnostics, contents or paths.
  child.stderr?.on('data',()=>{});child.stdout?.on('data',()=>{});
  child.once('spawn',()=>{if(settled)child.kill();});
  child.once('exit',()=>{
   release();
   clearTimeout(timer);signal.removeEventListener('abort',abort);
   if(waitForExit||!settled)resolve(signal.aborted?cancelled():settled?resultAfterExit:fail('unavailable'));
   settled=true;
  });
  child.on('message',value=>finish(options.valid(value)?value:fail('parse_failed')));
  try{child.postMessage(options.request);}catch{finish(fail('unavailable'));}
  if(signal.aborted)abort();
 });
}
