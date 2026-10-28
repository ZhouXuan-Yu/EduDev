type RetryOptions={beforeRetry:()=>Promise<void>;onRetry?:(attempt:number,status:number)=>void;delayMs?:number};
/** Retry only explicit transient HTTP rejection, before any response body is read.
 * Never replay a tool, a partial stream, an ambiguous network failure or auth error. */
export function withModelRequestRecovery(fetcher:typeof fetch,options:RetryOptions):typeof fetch {
  return async(input,init)=>{
    const signal=init?.signal??(input instanceof Request?input.signal:undefined);
    // The Pi adapter supplies a replayable JSON POST. Unknown bodies remain one-shot.
    const replayable=typeof init?.body==='string'&&init.method?.toUpperCase()==='POST';
    for(let attempt=0;;attempt++){
      signal?.throwIfAborted();
      const response=await fetcher(input,init);
      if(!replayable||attempt>=2||![429,502,503,504].includes(response.status))return response;
      const header=response.headers.get('retry-after');
      const retryAt=header?Date.parse(header):NaN;
      const seconds=header&&/^\d+(\.\d+)?$/.test(header)?Number(header)
        :Number.isFinite(retryAt)?Math.max(0,(retryAt-Date.now())/1000):undefined;
      // Long server backoff belongs to an explicit later user retry.
      if(seconds!==undefined&&seconds>5)return response;
      await response.body?.cancel();
      options.onRetry?.(attempt+1,response.status);
      const delay=seconds!==undefined?seconds*1000:(options.delayMs??500)*2**attempt;
      await new Promise<void>((resolve,reject)=>{
        if(signal?.aborted){reject(signal.reason);return;}
        const abort=()=>{clearTimeout(timer);signal?.removeEventListener('abort',abort);reject(signal?.reason??Error('cancelled'));};
        const timer=setTimeout(()=>{signal?.removeEventListener('abort',abort);resolve();},delay);
        signal?.addEventListener('abort',abort,{once:true});
      });
      signal?.throwIfAborted();await options.beforeRetry();signal?.throwIfAborted();
    }
  };
}
