import {AsyncLocalStorage} from 'node:async_hooks';
import {runHostStage} from '../host-resources/desktop';

const preparation = new AsyncLocalStorage<{deadline:number;active:boolean}>();

/** One lease covers source images, snapshots, HTML/base64, rendering and owned cleanup. */
export async function withOfficePdfBudget<T>(signal:AbortSignal|undefined, timeoutMs:number,
  run:(remainingMs:number)=>Promise<T>):Promise<T>{
  const current=preparation.getStore();
  if(current?.active){
    if(signal?.aborted)throw Error('cancelled');
    const remaining=Math.min(timeoutMs,Math.floor(current.deadline-performance.now()));
    if(remaining<1)throw Error('timeout');
    return run(remaining);
  }
  // The existing source and classroom capture limits are 16 MiB each. Reserve for
  // their snapshots, decoded images, data URLs and the renderer before loading them.
  return runHostStage('office-export','pdf','foreground',{cpu:1,memoryMiB:640,pdfWindows:1},
    timeoutMs,signal,async remaining=>{
      const scope={deadline:performance.now()+remaining,active:true};
      try{return await preparation.run(scope,()=>run(remaining));}
      finally{scope.active=false;}
    });
}
