import {AgentToolAbortedError,AgentToolTimeoutError,executeWithToolBound} from './vendor/openmaic/tool-timeout';

export class LifecycleTimeoutError extends Error {
  constructor(readonly operation: string, readonly timeoutMs: number, readonly elapsedMs: number) {
    super('lifecycle_timeout');
  }
}

export function createLifecycleWorkTracker() {
  const pending = new Set<Promise<unknown>>();
  return {
    track(work: Promise<unknown>) {
      pending.add(work);
      const remove = () => { pending.delete(work); };
      void work.then(remove, remove);
    },
    isPending: () => pending.size > 0,
  };
}

/** Host await adapter, using the already audited OpenMAIC primitive, not an executor. */
export async function waitForLifecycle<T>(name:string,action:(signal:AbortSignal)=>Promise<T>,options:{signal?:AbortSignal;timeoutMs?:number;late?:(value:T)=>void|Promise<void>;track?:(work:Promise<unknown>)=>void}={}):Promise<T>{
  let value:T;
  const timeoutMs = options.timeoutMs ?? 15000;
  const startedAt = performance.now();
  await executeWithToolBound((_id,_args,signal)=>{
    const work=(async()=>{
      value=await action(signal!);
      if(signal!.aborted){await options.late?.(value);signal!.throwIfAborted();}
      return {content:[],details:{}};
    })();
    options.track?.(work);
    return work;
  },name,timeoutMs,'lifecycle',{},options.signal,undefined).catch(error=>{
    if(error instanceof AgentToolAbortedError)throw Error('cancelled');
    if(error instanceof AgentToolTimeoutError)throw new LifecycleTimeoutError(name,timeoutMs,Math.round(performance.now()-startedAt));
    throw error;
  });
  return value!;
}
