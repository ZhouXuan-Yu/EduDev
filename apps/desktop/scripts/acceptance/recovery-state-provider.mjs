/** Controlled SSE transport only; real Pi tools, approvals and persistence stay intact. */
export function installRecoveryStateProvider(electron){
 const s=globalThis.__recoveryProvider={requests:[],catalogues:0,discoveries:0,plans:0,externalAttempts:0,aborts:0,expectedFailures:0,rejections:[],holding:false,mode:null,target:null,step:0,stage:null,lastCall:null};
 const encoder=new TextEncoder();let controller,timer;
 const packet=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'owned-recovery',object:'chat.completion.chunk',model:'deepseek-flash',choices:[{index:0,delta,finish_reason}]})+'\n\n';
 const done=()=>packet({},'stop')+'data: [DONE]\n\n';
 s.arm=(mode,target)=>{if(s.holding||!['stop','failure','copy'].includes(mode))throw Error('RECOVERY_ARM_INVALID');if(mode==='copy'&&!['拒绝副本.txt','停止副本.txt','批准副本.txt'].includes(target))throw Error('RECOVERY_TARGET_INVALID');s.mode=mode;s.target=target;s.step=0;s.stage='plan';s.lastCall=null;};
 s.fail=()=>{if(s.mode!=='failure'||!s.holding||!controller)throw Error('RECOVERY_FAIL_INVALID');clearTimeout(timer);s.holding=false;s.expectedFailures++;controller.error(Error('OWNED_TRANSPORT_INTERRUPTED'));};
 electron.net.fetch=async(input,init)=>{
  const url=new URL(typeof input==='string'?input:input.url);if(url.origin!=='https://api.deepseek.com'){s.externalAttempts++;throw Error('RECOVERY_EXTERNAL_DENIED');}
  const endpoint=url.pathname.replace(/^\/v1(?=\/)/,'');
  if(endpoint==='/models'){if(++s.catalogues>8)throw Error('RECOVERY_CATALOGUE_BUDGET');return new Response(JSON.stringify({object:'list',data:[{id:'deepseek-flash',context_window:1048576,max_output_tokens:32768}]}));}
  if(endpoint!=='/chat/completions'){s.externalAttempts++;throw Error('RECOVERY_ENDPOINT_DENIED');}
  if(!s.mode||s.requests.length>=13)throw Error('RECOVERY_REQUEST_BUDGET');
  const body=JSON.parse(init?.body??await input.clone().text());if(body.stream!==true)throw Error('RECOVERY_STREAM_REQUIRED');const step=s.step++;
  s.requests.push({mode:s.mode,step,target:s.target,model:body.model,toolNames:body.tools?.map(t=>t.function?.name??t.name)??[]});
  if(s.mode==='copy'){
   const text=m=>typeof m.content==='string'?m.content:(m.content??[]).map(v=>v.text??'').join('\n');
   function objectAt(raw,index){if(index<0)return;let depth=0,quote=false,escape=false;for(let i=index;i<raw.length;i++){const c=raw[i];if(quote){if(escape)escape=false;else if(c==='\\')escape=true;else if(c==='"')quote=false;}else if(c==='"')quote=true;else if(c==='{')depth++;else if(c==='}'&&--depth===0)return JSON.parse(raw.slice(index,i+1));}}
   const reply=(name,args,message,next)=>{if(!body.tools?.some(t=>t.function?.name===name))throw Error('RECOVERY_REAL_TOOL_MISSING_'+name);s.lastCall='recovery-'+name+'-'+s.requests.length;s.stage=next;return new Response(packet({role:'assistant',content:'<xiaozhi_progress>'+message,tool_calls:[{index:0,id:s.lastCall,type:'function',function:{name,arguments:JSON.stringify(args)}}]})+packet({},'tool_calls')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});};
   if(s.stage==='plan'){
    const states=body.messages.filter(m=>m.role==='system').map(text).map(raw=>objectAt(raw,raw.lastIndexOf('{"schemaVersion":"xiaozhi.task-plan.v3","taskId":'))).filter(Boolean);const task=states.at(-1);
    if(!task||!Number.isInteger(task.revision)||!Number.isInteger(task.requirementsVersion))throw Error('RECOVERY_HOST_TASK_CONTEXT_REQUIRED');s.plans++;
    return reply('update_task_plan',{schemaVersion:'xiaozhi.task-plan.v3',expectedRevision:task.revision,requirementsVersion:task.requirementsVersion,reason:'只复制教师指定的公开合成原件，等待本次明确审批。',steps:[{id:'copy_save',text:'等待审批后复制指定文件并核对实际结果',kind:'saved_text',target:s.target,dependsOn:[],reported:'in_progress'},{id:'teacher_check',text:'教师核对本次实际结果',kind:'human',dependsOn:['copy_save'],reported:'pending'}]},'先登记本次复制及最终教师核对步骤，不把计划当作执行完成。','planned');
   }
   const result=body.messages.findLast(m=>m.role==='tool'&&m.tool_call_id===s.lastCall);if(!result)throw Error('RECOVERY_REAL_TOOL_RESULT_REQUIRED');
   if(s.stage==='planned'){const raw=text(result),plan=objectAt(raw,raw.indexOf('{'));if(!plan?.success||!plan.adopted)throw Error('RECOVERY_REAL_PLAN_ADOPTION_REQUIRED');s.stage='ready';}
   if(s.stage==='ready'&&!body.tools?.some(t=>t.function?.name==='office_copy_file')){s.discoveries++;return reply('find_education_tools',{query:'office_copy_file'},'查找本次复制所需的已授权工具，不执行文件操作。','discovered');}
   if(s.stage==='ready'||s.stage==='discovered')return reply('office_copy_file',{source:'公开原件.txt',target:s.target,taskStepId:'copy_save'},'请求复制公开合成文件，等待本次教师决定。','copied');
   if(s.stage!=='copied')throw Error('RECOVERY_COPY_STAGE_INVALID');s.stage='finished';
   return new Response(packet({role:'assistant',content:'<xiaozhi_answer>本轮复制请求已处理，请以工具回执和确认卡的实际状态为准。'})+done(),{headers:{'content-type':'text/event-stream'}});
  }
  if(step!==0)throw Error('RECOVERY_NO_HIDDEN_RETRY');
  const signal=init?.signal??input?.signal;
  const stream=new ReadableStream({start(c){controller=c;s.holding=true;c.enqueue(encoder.encode(packet({role:'assistant',content:'<xiaozhi_answer>'+(s.mode==='stop'?'这是停止前已收到的公开正文。':'这是传输失败前已收到的公开正文。')})));
   const abort=()=>{if(s.holding){clearTimeout(timer);s.holding=false;s.aborts++;c.error(new DOMException('Owned request aborted','AbortError'));}};
   if(signal?.aborted)abort();else signal?.addEventListener('abort',abort,{once:true});
   timer=setTimeout(()=>{if(s.holding){s.holding=false;c.error(Error('RECOVERY_HOLD_DEADLINE'));}},90000);
  },cancel(){clearTimeout(timer);if(s.holding){s.holding=false;s.aborts++;}}});
  return new Response(stream,{headers:{'content-type':'text/event-stream'}});
 };
 const controlled=electron.net.fetch;electron.net.fetch=async(...args)=>{try{return await controlled(...args);}catch(error){s.rejections.push(String(error.message));throw error;}};
}
export const readRecoveryStateProvider=()=>{const s=globalThis.__recoveryProvider;return{requests:s.requests,catalogues:s.catalogues,discoveries:s.discoveries,plans:s.plans,externalAttempts:s.externalAttempts,aborts:s.aborts,expectedFailures:s.expectedFailures,rejections:s.rejections,holding:s.holding,mode:s.mode};};
