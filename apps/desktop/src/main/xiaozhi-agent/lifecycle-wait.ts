import {channel} from 'node:diagnostics_channel';
import {AsyncLocalStorage} from 'node:async_hooks';
import {AgentToolAbortedError,AgentToolTimeoutError,executeWithToolBound} from './vendor/openmaic/tool-timeout';

// Main-only, opt-in scalar timings. No prompts, paths, payloads or error text.
const lifecycleChannel = channel('omni-edu.xiaozhi.lifecycle.v1');
const lifecycleContext = new AsyncLocalStorage<{runId?: string}>();
export function observeLifecycle<T>(operation: string, action: () => Promise<T>, context?: {runId?: string}, countResult?: (value:T)=>number): Promise<T> {
  if (!lifecycleChannel.hasSubscribers) return action();
  const measure = async (): Promise<T> => {
    const startedAt = performance.now(), startedEpochMs = performance.timeOrigin + startedAt;
    let registrationCount:number|undefined;
    let outcome: 'success' | 'cancelled' | 'timeout' | 'error' = 'success';
    try { const result=await action();
      const count=countResult?.(result);
      if(typeof count==='number'&&Number.isSafeInteger(count)&&count>=0)registrationCount=count;
      return result; }
    catch (error) {
      outcome = error instanceof LifecycleTimeoutError ? 'timeout'
        : error instanceof Error && error.message === 'cancelled' ? 'cancelled' : 'error';
      throw error;
    } finally {
      const endedAt = performance.now(), runId = lifecycleContext.getStore()?.runId;
      lifecycleChannel.publish({version: 1, operation: /^[a-z0-9_]{1,80}$/.test(operation) ? operation : 'unknown',
        ...(runId && /^run_[a-z0-9-]{1,80}$/i.test(runId) ? {runId} : {}), startedEpochMs,
        endedEpochMs: performance.timeOrigin + endedAt, durationMs: endedAt - startedAt, outcome,
        ...(registrationCount===undefined?{}:{registrationCount})});
    }
  };
  return context ? lifecycleContext.run(context, measure) : measure();
}

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
export async function waitForLifecycle<T>(name:string,action:(signal:AbortSignal)=>Promise<T>,options:{signal?:AbortSignal;timeoutMs?:number;late?:(value:T)=>void|Promise<void>;track?:(work:Promise<unknown>)=>void;label?:string}={}):Promise<T>{
  return observeLifecycle(options.label || name, async () => {
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
  });
}
