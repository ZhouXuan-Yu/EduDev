import type {XiaozhiModelRequest} from '../../shared/xiaozhi-model-request';
import {isTemporaryProviderHttpStatus, providerRetryAfterSeconds} from './provider-fault-policy';
import type {createModelHealthScope} from './model-provider-health';
type RetryOptions={beforeRetry:()=>Promise<void>;onRetry?:(attempt:number,status:number)=>void;onState?:(request:XiaozhiModelRequest)=>void;delayMs?:number;
  nextRequest?:()=>number; maxAttempts?:1|3; beforeSend?:()=>void; health?:ReturnType<typeof createModelHealthScope>};
/** Retry only explicit transient HTTP rejection, before any response body is read.
 * Never replay a tool, a partial stream, an ambiguous network failure or auth error. */
export function withModelRequestRecovery(fetcher:typeof fetch,options:RetryOptions):typeof fetch {
  let requestSequence=0;
  return async(input,init)=>{
    const request=options.nextRequest?.() ?? ++requestSequence;let currentAttempt=1,started=false,lastStatus:number|undefined;
    const state=(value:Pick<XiaozhiModelRequest,'state'>&Partial<Pick<XiaozhiModelRequest,'status'|'waitMs'>>)=>options.onState?.({schemaVersion:1,request,attempt:currentAttempt as 1|2|3,at:Date.now(),...value});
    const signal=init?.signal??(input instanceof Request?input.signal:undefined);
    // The Pi adapter supplies a replayable JSON POST. Unknown bodies remain one-shot.
    const replayable=typeof init?.body==='string'&&init.method?.toUpperCase()==='POST';
    try{for(let attempt=0;;attempt++){
      currentAttempt=attempt+1;
      started=false;lastStatus=undefined;
      signal?.throwIfAborted();
      if(options.health)await options.health.ready();
      signal?.throwIfAborted();
      const attemptHealth=options.health?.begin();
      let response: Response;
      try {
        options.beforeSend?.();
        started=true;
        state({state:'sending'});
        const received=await fetcher(input,init);
        response=attemptHealth ? await attemptHealth.response(received) : received;
      } catch (error) {await attemptHealth?.failed(error,started);throw error;}
      lastStatus=response.status;
      const done=()=>{state({state:response.ok?'accepted':'rejected',status:response.status});return response;};
      if(!replayable||attempt+1>=(options.maxAttempts??3)||!isTemporaryProviderHttpStatus(response.status))return done();
      const seconds=providerRetryAfterSeconds(response.headers.get('retry-after'));
      // Long server backoff belongs to an explicit later user retry.
      if(seconds!==undefined&&seconds>5)return done();
      await response.body?.cancel();
      options.onRetry?.(attempt+1,response.status);
      const requestedDelay=seconds!==undefined?seconds*1000:(options.delayMs??500)*2**attempt;
      const delay=Number.isFinite(requestedDelay)?Math.max(0,Math.min(5000,requestedDelay)):500;
      state({state:'retry_wait',status:response.status,waitMs:delay});
      await new Promise<void>((resolve,reject)=>{
        if(signal?.aborted){reject(signal.reason);return;}
        const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(signal?.reason??Error('cancelled'));};
        const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},delay);
        signal?.addEventListener('abort',abort,{once:true});
      });
      signal?.throwIfAborted();await options.beforeRetry();signal?.throwIfAborted();
    }}catch(error){if(started)state({state:'interrupted',...(lastStatus===undefined?{}:{status:lastStatus})});throw error;}
  };
}
