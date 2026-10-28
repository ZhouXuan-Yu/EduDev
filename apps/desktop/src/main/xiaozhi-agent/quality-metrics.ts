/** Numeric-only trace. No prompts, responses, paths or credentials. */
export function createQualityMetrics(clock=()=>performance.now()) {
  const start=clock();let firstEvent:number|undefined,firstText:number|undefined,lastText:number|undefined;
  let requests=0,retries=0,requestBytes=0,toolCount=0;
  return {
    event(){firstEvent??=clock()-start;},
    text(){firstText??=clock()-start;lastText=clock()-start;},
    request(bytes:number,tools:number){requests++;requestBytes+=bytes;toolCount=Math.max(toolCount,tools);},
    retry(){retries++;},
    snapshot(){return {version:1,elapsedMs:clock()-start,firstProviderEventMs:firstEvent,firstAnswerTextMs:firstText,lastAnswerTextMs:lastText,requests,retries,requestBytes,maxExposedTools:toolCount};},
  };
}
