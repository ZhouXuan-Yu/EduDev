/** One host queue for computation and health processes across all versions. */
export function createManagedWorkerQueue(limit=2,maximumWaiting=32){
  type Waiter={start:()=>void;cancel:()=>void};
  const waiting:Waiter[]=[],active=new Map<AbortController,Promise<unknown>>();let closed=false;
  const drain=()=>{while(!closed&&active.size<limit&&waiting.length)waiting.shift()!.start();};
  return{
    state:()=>({running:active.size,queued:waiting.length,limit}),
    run<T>(operation:(signal:AbortSignal)=>Promise<T>,signal?:AbortSignal):Promise<T>{
      if(closed)return Promise.reject(Error('cancelled'));if(signal?.aborted)return Promise.reject(Error('cancelled'));
      if(waiting.length>=maximumWaiting)return Promise.reject(Error('busy'));
      return new Promise<T>((resolve,reject)=>{
        let started=false,finished=false;const controller=new AbortController();
        const abort=()=>{if(started){controller.abort();return;}const index=waiting.indexOf(item);if(index>=0)waiting.splice(index,1);signal?.removeEventListener('abort',abort);finished=true;reject(Error('cancelled'));};
        const item:Waiter={cancel:abort,start:()=>{
          if(finished||closed||signal?.aborted){abort();return;}started=true;
          const work=Promise.resolve().then(()=>operation(AbortSignal.any([controller.signal,...(signal?[signal]:[])])));active.set(controller,work);
          const cleanup=()=>{finished=true;signal?.removeEventListener('abort',abort);active.delete(controller);drain();};
          void work.then(value=>{cleanup();if(signal?.aborted||closed)reject(Error('cancelled'));else resolve(value);},error=>{cleanup();reject(error);});
        }};
        signal?.addEventListener('abort',abort,{once:true});waiting.push(item);drain();
      });
    },
    async dispose(){closed=true;for(const item of waiting.splice(0))item.cancel();for(const controller of active.keys())controller.abort();await Promise.allSettled(active.values());},
  };
}
