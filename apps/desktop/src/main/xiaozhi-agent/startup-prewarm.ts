import {observeLifecycle} from './lifecycle-wait';

/** Optional process-local preparation; never an Agent, Session, execution or authority cache. */
export function createStartupPrewarm(prepare:(signal:AbortSignal)=>Promise<number>) {
  const controller=new AbortController();
  let status:'idle'|'scheduled'|'running'|'ready'|'failed'|'closed'='idle',registrationCount:number|undefined;
  let scheduled:ReturnType<typeof setImmediate>|undefined,job:Promise<void>|undefined,settle:(()=>void)|undefined;
  return {
    schedule() {
      if(job||status==='closed')return;
      status='scheduled';
      job=new Promise<void>(resolve=>{settle=resolve;});
      scheduled=setImmediate(()=>{
        scheduled=undefined;
        if(controller.signal.aborted){status='closed';settle?.();return;}
        status='running';
        void observeLifecycle('startup_registry_prewarm',()=>prepare(controller.signal),undefined,count=>count)
          .then(count=>{registrationCount=count;status=controller.signal.aborted?'closed':'ready';},()=>{status=controller.signal.aborted?'closed':'failed';})
          .finally(()=>settle?.());
      });
    },
    // A foreground run never schedules startup work. It only joins an existing job.
    wait:async()=>{await job;},
    snapshot:()=>({status,...(registrationCount===undefined?{}:{registrationCount})}),
    async close() {
      controller.abort();
      if(scheduled){clearImmediate(scheduled);scheduled=undefined;settle?.();}
      status='closed';
      // A started SQLite transaction must settle before its owner can close the store.
      await job;
    },
  };
}
