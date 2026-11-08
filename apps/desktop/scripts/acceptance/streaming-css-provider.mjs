/** Serialize before formal main import. Only owned QA responses; never forwards. */
export function installStreamingCssProvider(electron,{presentation='legacy'}={}){
  if(!['legacy','explicit'].includes(presentation))throw Error('CSS_PRESENTATION_INVALID');
  const explicit=presentation==='explicit';
  const state=globalThis.__streamingCssProvider={requests:[],inputs:[],catalogues:0,externalAttempts:0,holding:false,released:false,errors:[],presentation,prefixStarted:false,answerBegun:false};
  const encode=new TextEncoder();let controller,timer;
  const packet=(index,delta,finish_reason=null)=>'data: '+JSON.stringify({id:'cssom-'+index,object:'chat.completion.chunk',model:'deepseek-flash',choices:[{index:0,delta,finish_reason}]})+'\n\n';
  const done=index=>packet(index,{},'stop')+'data: [DONE]\n\n';
  state.beginPrefix=()=>{
    if(!explicit||!state.holding||state.prefixStarted||!controller)throw Error('CSS_PREFIX_INVALID');
    state.prefixStarted=true;controller.enqueue(encode.encode(packet(1,{content:'<xiaozhi_'})));
  };
  state.beginAnswer=()=>{
    if(!explicit||!state.holding||!state.prefixStarted||state.answerBegun||!controller)throw Error('CSS_ANSWER_INVALID');
    state.answerBegun=true;controller.enqueue(encode.encode(packet(1,{content:'answer>附件清单已经核对，当前还未读取正文。以下说明本轮已完成的范围。'})));
  };
  state.release=()=>{
    if(!state.holding||state.released||!controller)throw Error('CSS_RELEASE_INVALID');
    if(explicit&&!state.answerBegun)throw Error('CSS_ANSWER_REQUIRED');
    clearTimeout(timer);state.released=true;state.holding=false;
    const tail=explicit?'\n\n'+Array.from({length:14},(_,i)=>`公开核对范围${i+1}：本轮只确认附件清单，不据此声称已阅读文件、执行教学核验或保存新成果。`).join('\n\n')+'\n\n后续需要读取正文，才能形成有来源依据的教学建议。':'本轮附件范围已核对，正文尚未读取；附件列表不能作为已读正文的证据。';
    controller.enqueue(encode.encode(packet(1,{content:tail})+done(1)));controller.close();
  };
  electron.net.fetch=async(input,init)=>{
    const raw=typeof input==='string'?input:input.url,url=new URL(raw);
    if(url.origin!=='https://api.deepseek.com'){state.externalAttempts++;throw Error('CSS_EXTERNAL_DENIED');}
    const endpoint=url.pathname.replace(/^\/v1(?=\/)/,'');
    if(endpoint==='/models'){
      if(++state.catalogues>2)throw Error('CSS_CATALOGUE_BUDGET');
      return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}),{headers:{'content-type':'application/json'}});
    }
    if(endpoint!=='/chat/completions'){state.externalAttempts++;throw Error('CSS_ENDPOINT_DENIED');}
    // Current SDK FetchFunction may pass a Request carrying its own body.
    const rawBody=init?.body??(typeof input?.clone==='function'?await input.clone().text():undefined);
    const body=JSON.parse(rawBody),index=state.requests.length;
    state.inputs.push({path:endpoint,bodyCarrier:init?.body!==undefined?'init':'Request',stream:body.stream===true,toolCount:body.tools?.length??0,
      toolNames:body.tools?.map(t=>t.function?.name??t.name??'(unknown)')??[]});
    if(index>=2||body.stream!==true)throw Error('CSS_REQUEST_BUDGET');
    const tool='office_list_attachments';
    if(index===0&&!body.tools?.some(t=>t.function?.name===tool))throw Error('CSS_REAL_TOOL_MISSING');
    state.requests.push({index,model:body.model,controlled:true,tool:index===0?tool:null});
    if(index===0){
      const delta={role:'assistant',content:(explicit?'<xiaozhi_progress>':'')+'先检查本轮附件范围，再按实际资料继续。',tool_calls:[{index:0,id:'cssom-read-attachments',type:'function',function:{name:tool,arguments:'{}'}}]};
      return new Response(packet(index,delta)+packet(index,{},'tool_calls')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
    }
    if(!body.messages.some(m=>m.role==='tool'))throw Error('CSS_REAL_TOOL_RESULT_MISSING');
    const stream=new ReadableStream({start(c){controller=c;c.enqueue(encode.encode(packet(index,{role:'assistant'})));state.holding=true;
      timer=setTimeout(()=>{state.errors.push('CSS_HOLD_DEADLINE');state.holding=false;c.error(Error('CSS_HOLD_DEADLINE'));},120000);},cancel(){clearTimeout(timer);state.holding=false;}});
    return new Response(stream,{headers:{'content-type':'text/event-stream'}});
  };
}

export const readStreamingCssProvider=()=>{
  const s=globalThis.__streamingCssProvider;
  return {requests:s.requests,inputs:s.inputs,catalogues:s.catalogues,externalAttempts:s.externalAttempts,holding:s.holding,released:s.released,errors:s.errors,presentation:s.presentation,prefixStarted:s.prefixStarted,answerBegun:s.answerBegun};
};
