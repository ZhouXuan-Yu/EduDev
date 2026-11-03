/** Opt-in phase timings only: never log template contents, resource paths or credentials. */
export function templateReadTrace(requestId?:string) {
  const started=Date.now();
  return (stage:string)=>{
    if(process.env.OMNI_EDU_E2E_TEMPLATE_TRACE!=='1')return;
    console.info('[paper-template-read] '+JSON.stringify({
      requestId:requestId??'',stage,elapsedMs:Date.now()-started,
    }));
  };
}
