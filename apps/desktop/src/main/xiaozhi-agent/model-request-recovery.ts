import type {XiaozhiModelRequest} from '../../shared/xiaozhi-model-request';
type RetryOptions={beforeRetry:()=>Promise<void>;onRetry?:(attempt:number,status:number)=>void;onState?:(request:XiaozhiModelRequest)=>void;delayMs?:number};
/** Retry only explicit transient HTTP rejection, before any response body is read.
 * Never replay a tool, a partial stream, an ambiguous network failure or auth error. */
export function withModelRequestRecovery(fetcher:typeof fetch,options:RetryOptions):typeof fetch {
  let requestSequence=0;
  return async(input,init)=>{
    const request=++requestSequence;let currentAttempt=1,started=false,lastStatus:number|undefined;
    const state=(value:Pick<XiaozhiModelRequest,'state'>&Partial<Pick<XiaozhiModelRequest,'status'|'waitMs'>>)=>options.onState?.({schemaVersion:1,request,attempt:currentAttempt as 1|2|3,at:Date.now(),...value});
    const signal=init?.signal??(input instanceof Request?input.signal:undefined);
    // The Pi adapter supplies a replayable JSON POST. Unknown bodies remain one-shot.
    const replayable=typeof init?.body==='string'&&init.method?.toUpperCase()==='POST';
    try{for(let attempt=0;;attempt++){
      currentAttempt=attempt+1;
      started=false;lastStatus=undefined;
      signal?.throwIfAborted();
      started=true;
      state({state:'sending'});
      const response=await fetcher(input,init);
      lastStatus=response.status;
      const done=()=>{state({state:response.ok?'accepted':'rejected',status:response.status});return response;};
      if(!replayable||attempt>=2||![429,500,502,503,504].includes(response.status))return done();
      const header=response.headers.get('retry-after');
      const retryAt=header?Date.parse(header):NaN;
      const seconds=header&&/^\d+(\.\d+)?$/.test(header)?Number(header)
        :Number.isFinite(retryAt)?Math.max(0,(retryAt-Date.now())/1000):undefined;
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
