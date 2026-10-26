/** One bounded classification only; never retries, grants permission or writes facts. */
export async function boundedShadow(action:(signal:AbortSignal)=>Promise<string>,timeoutMs=8000){
 const controller=new AbortController(),started=performance.now();let timer:ReturnType<typeof setTimeout>|undefined,text:string|undefined;
 try{const timeout=new Promise<never>((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(Error('timeout'));},timeoutMs);});text=await Promise.race([action(controller.signal),timeout]);}catch{/* Safe failed/abstain result; provider text is not copied. */}finally{if(timer)clearTimeout(timer);controller.abort();}
 return{text,elapsedMs:Math.min(60000,Math.round(performance.now()-started))};
}
