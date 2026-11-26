import {AsyncLocalStorage} from 'node:async_hooks';
import {runHostStage} from '../host-resources/desktop';

const preparation = new AsyncLocalStorage<{deadline:number;active:boolean}>();
const outstanding = new Set<Promise<unknown>>();
let closing = false;

export function officePdfWorkPending() {
  return outstanding.size > 0;
}

/** Keep new top-level prints out while the app attempts to close its existing owners. */
export async function prepareOfficePdfShutdown(timeoutMs: number): Promise<boolean> {
  closing = true;
  if (!officePdfWorkPending()) return true;
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    const settled = await Promise.race([
      Promise.allSettled(outstanding).then(() => true),
      new Promise<false>(resolve => {timer = setTimeout(() => resolve(false), timeoutMs);}),
    ]);
    if (!settled) closing = false;
    return settled;
  } finally {
    clearTimeout(timer);
  }
}

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
  if (closing) throw Error('cancelled');
  // The existing source and classroom capture limits are 16 MiB each. Reserve for
  // their snapshots, decoded images, data URLs and the renderer before loading them.
  const work = runHostStage('office-export','pdf','foreground',{cpu:1,memoryMiB:640,pdfWindows:1},
    timeoutMs,signal,async remaining=>{
      const scope={deadline:performance.now()+remaining,active:true};
      try{return await preparation.run(scope,()=>run(remaining));}
      finally{scope.active=false;}
    });
  outstanding.add(work);
  try {return await work;}
  finally {outstanding.delete(work);}
}
