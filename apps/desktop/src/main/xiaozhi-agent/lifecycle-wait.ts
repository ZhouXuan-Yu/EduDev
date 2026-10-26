import {AgentToolAbortedError,AgentToolTimeoutError,executeWithToolBound} from './vendor/openmaic/tool-timeout';

/** Host await adapter, using the already audited OpenMAIC primitive, not an executor. */
export async function waitForLifecycle<T>(name:string,action:(signal:AbortSignal)=>Promise<T>,options:{signal?:AbortSignal;timeoutMs?:number;late?:(value:T)=>void|Promise<void>}={}):Promise<T>{
  let value:T;
  await executeWithToolBound(async(_id,_args,signal)=>{
    value=await action(signal!);
    if(signal!.aborted){await options.late?.(value);signal!.throwIfAborted();}
    return {content:[],details:{}};
  },name,options.timeoutMs??15000,'lifecycle',{},options.signal,undefined).catch(error=>{
    if(error instanceof AgentToolAbortedError)throw Error('cancelled');
    if(error instanceof AgentToolTimeoutError)throw Error('lifecycle_timeout');
    throw error;
  });
  return value!;
}
