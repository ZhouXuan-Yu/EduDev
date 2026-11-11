/** Serialized before formal main. Only controlled SSE tool REQUESTS are supplied.
 * No native fetch, runtime event, tool result, OCR or answer is replaced. */
export function installRetainedFixtureProvider(electron,options) {
  const hash=value=>process.getBuiltinModule('crypto').createHash('sha256').update(String(value)).digest('hex');
  const state={responses:0,externalAttempts:0,rendererErrors:0,formalRegistrations:0,requests:[],fatal:null,tasks:0,
    plans:[],teacherRequests:[],processReads:[],sourceReads:[],toolFailures:[],admissionsRequested:[]};
  const fail=code=>{state.fatal??=code;return Error(code);};
  let formal,armed,stage,lastCalls=[],requestSource,planRequest,adoptedPlan,priorTask;
  const web=electron.session.defaultSession.webRequest,register=web.onBeforeRequest.bind(web);
  const combined=(details,callback,probe=false)=>{
    if(/^(https?|wss?):/i.test(details.url)) {
      if(!probe){state.externalAttempts++;fail('RETAINED_NATIVE_NETWORK_DENIED');}
      callback({cancel:true});return;
    }
    if(formal)formal(details,callback);else callback({cancel:false});
  };
  web.onBeforeRequest=(...args)=>{
    if(args.length!==1||args[0]!==null&&typeof args[0]!=='function')throw fail('RETAINED_NETWORK_REGISTRATION');
    formal=args[0];if(formal)state.formalRegistrations++;register(combined);
  };
  register(combined);
  electron.app.on('web-contents-created',(_event,contents)=>{
    contents.on('console-message',(details,level)=>{if(typeof details?.level==='string'?details.level==='error':level===3)state.rendererErrors++;});
    contents.on('preload-error',()=>state.rendererErrors++);
    contents.on('render-process-gone',(_e,value)=>{if(value.reason!=='clean-exit')state.rendererErrors++;});
  });
  globalThis.fetch=async()=>{state.externalAttempts++;throw fail('RETAINED_GLOBAL_FETCH_DENIED');};
  const text=message=>typeof message.content==='string'?message.content:(message.content||[]).map(p=>p.text||'').join('\n');
  function objectAt(raw,start) {
    let depth=0,quoted=false,escaped=false;
    for(let i=start;i>=0&&i<raw.length;i++) {
      const c=raw[i];
      if(quoted){if(escaped)escaped=false;else if(c==='\\')escaped=true;else if(c==='"')quoted=false;}
      else if(c==='"')quoted=true;
      else if(c==='{')depth++;
      else if(c==='}'&&--depth===0)return JSON.parse(raw.slice(start,i+1));
    }
  }
  function realResult(messages,call) {
    const id=call.id;
    const row=messages.findLast(m=>m.role==='tool'&&m.tool_call_id===id);
    if(!row)throw fail('RETAINED_REAL_TOOL_RESULT_REQUIRED');
    const raw=text(row),value=objectAt(raw,raw.indexOf('{'));
    // Pi appends host notes after JSON. Parse the original leading object only.
    if(!value||value.success===false||value.isError===true) {
      const reason=typeof value?.reason==='string'&&/^[a-z_]{1,80}$/.test(value.reason)?value.reason:'unknown';
      state.toolFailures.push({task:state.tasks,tool:call.name,callId:id,scope:value?.scope,reason,receiptSha256:hash(raw)});
      throw fail('RETAINED_REAL_TOOL_FAILED_'+reason);
    }
    return value;
  }
  const canonical=value=>JSON.stringify(value,(_key,item)=>item&&typeof item==='object'&&!Array.isArray(item)?Object.fromEntries(Object.keys(item).sort().map(key=>[key,item[key]])):item);
  function protectedContext(body) {
    const index=body.messages.findLastIndex(message=>message.role==='user');
    const raw=index>=0?text(body.messages[index]):'',boundary='\n\n[教师本次请求]\n';
    const split=raw.indexOf(boundary),header='[小智本会话本地记录，非新增授权]\n';
    if(!raw.startsWith(header)||split<0)throw fail('RETAINED_REAL_HOST_TASK_REQUIRED');
    if(raw.indexOf(boundary,split+boundary.length)>=0)throw fail('RETAINED_PROTECTED_CONTEXT_AMBIGUOUS');
    const prefix=raw.slice(0,split),lines=prefix.split('\n');
    const marker='{"schemaVersion":"xiaozhi.task-plan.v3","taskId":';
    const taskHeaders=lines.filter(line=>line.startsWith('本轮宿主任務：'));
    const taskLines=lines.filter(line=>line.startsWith(marker));
    if(taskHeaders.length!==1||taskLines.length!==1||prefix.split(marker).length!==2||raw.slice(split+boundary.length).includes(marker))throw fail('RETAINED_PROTECTED_CONTEXT_AMBIGUOUS');
    const taskLine=lines.indexOf(taskLines[0]),taskHeader=lines.indexOf(taskHeaders[0]);
    if(taskLine!==taskHeader+1)throw fail('RETAINED_PROTECTED_CONTEXT_AMBIGUOUS');
    let task;
    try{task=JSON.parse(taskLines[0]);}catch{throw fail('RETAINED_REAL_HOST_TASK_REQUIRED');}
    const teacherPrefix='教师要求：';
    let sources;
    try{sources=lines.slice(0,taskHeader).filter(line=>line.startsWith(teacherPrefix)).map(line=>JSON.parse(line.slice(teacherPrefix.length)));}
    catch{throw fail('RETAINED_CURRENT_REQUEST_REQUIRED');}
    const current=sources.filter(source=>source.kind==='request'&&source.taskSource===true);
    if(current.length!==1||new Set(sources.map(source=>source.sourceId)).size!==sources.length)throw fail('RETAINED_PROTECTED_CONTEXT_AMBIGUOUS');
    // Historical SDK user messages may carry their own protected prefix. A
    // duplicate owner/current request cannot silently replace this one.
    for(const message of body.messages.slice(0,index).filter(message=>message.role==='user')) {
      const earlier=text(message),end=earlier.indexOf(boundary);
      if(!earlier.startsWith(header)||end<0)continue;
      const oldLines=earlier.slice(0,end).split('\n');
      for(const line of oldLines) {
        if(!line.startsWith(marker)&&!line.startsWith(teacherPrefix))continue;
        let value;try{value=JSON.parse(line.slice(line.startsWith(teacherPrefix)?teacherPrefix.length:0));}catch{throw fail('RETAINED_PROTECTED_CONTEXT_AMBIGUOUS');}
        if(value.taskId===task.taskId||value.taskSource===true&&value.sourceId===current[0].sourceId)throw fail('RETAINED_PROTECTED_CONTEXT_AMBIGUOUS');
      }
    }
    return {task,source:current[0]};
  }
  function hostTask(body) {
    const {task}=protectedContext(body);
    if(!task||!/^xitask_[a-f0-9]{64}$/.test(task.taskId)||!Number.isSafeInteger(task.revision)||task.revision<0||
      !Number.isSafeInteger(task.requirementsVersion)||task.requirementsVersion<1||!Array.isArray(task.steps)||!Array.isArray(task.criteria))throw fail('RETAINED_REAL_HOST_TASK_REQUIRED');
    return task;
  }
  function currentTeacherRequest(body) {
    const {source}=protectedContext(body);
    if(!source||!Number.isSafeInteger(source.sequence)||source.sequence<1||typeof source.sourceId!=='string'||!source.sourceId||typeof source.runId!=='string'||!source.runId||!/^([a-f0-9]{64})$/.test(source.sourceVersion))throw fail('RETAINED_CURRENT_REQUEST_REQUIRED');
    return source;
  }
  function requirePlanSchema(body) {
    const tool=body.tools?.find(t=>(t.function?.name??t.name)==='update_task_plan');
    if(!options.planParameters||canonical(tool?.function?.parameters??tool?.parameters)!==canonical(options.planParameters))throw fail('RETAINED_PRODUCTION_PLAN_SCHEMA_REQUIRED');
  }
  function planInput(task,phase) {
    if(!options.planSteps?.[phase])throw fail('RETAINED_PLAN_STEPS_REQUIRED');
    const steps=options.planSteps[phase];
    return {schemaVersion:'xiaozhi.task-plan.v3',expectedRevision:task.revision,requirementsVersion:task.requirementsVersion,
      reason:phase==='advance'?'第一道原题已由教师保存，保留该步骤和原标准，依次转入第二道；最终人工核对仍待教师决定。':
        phase==='pending'?'依本次新请求只提出待裁图候选，已保存原题及其旧任务保持历史。':'依本次教师请求分别登记两道独立原题候选与最终教师核对。',steps};
  }
  function verifyPlan(prior) {
    const entry=prior.find(p=>p.call.name==='update_task_plan'),value=entry?.result;
    if(!entry||!planRequest||value?.success!==true||value.adopted!==true||value.schemaVersion!=='xiaozhi.task-plan.v3'||
      value.taskId!==planRequest.taskId||value.requirementsVersion!==planRequest.input.requirementsVersion||
      !Number.isSafeInteger(value.revision)||value.revision<=planRequest.input.expectedRevision||!Array.isArray(value.steps)||!Array.isArray(value.criteria))throw fail('RETAINED_REAL_PLAN_ADOPTION_REQUIRED');
    for(const requested of planRequest.input.steps) {
      const actual=value.steps.find(step=>step.id===requested.id);
      if(!actual||actual.text!==requested.text||actual.reported!==requested.reported||canonical(actual.dependsOn)!==canonical(requested.dependsOn)||
        !actual.criterionIds?.length||actual.criterionIds.some(id=>value.criteria.find(c=>c.id===id)?.kind!==requested.kind))throw fail('RETAINED_PLAN_RECEIPT_MISMATCH');
    }
    const executing=value.steps.filter(step=>step.state==='executing'&&step.criterionIds.some(id=>value.criteria.find(c=>c.id===id)?.kind==='saved_questions'));
    const targets=planRequest.input.steps.filter(step=>step.kind==='saved_questions'&&step.reported==='in_progress').map(step=>step.id);
    if(canonical(executing.map(step=>step.id).sort())!==canonical([...targets].sort()))throw fail('RETAINED_ADOPTED_EXECUTING_STEPS_REQUIRED');
    if(value.steps.length!==planRequest.input.steps.length)throw fail('RETAINED_EXTRA_PLAN_STEPS');
    state.plans.push({task:state.tasks,phase:planRequest.phase,taskId:value.taskId,requirementsVersion:value.requirementsVersion,
      expectedRevision:planRequest.input.expectedRevision,revision:value.revision,steps:value.steps,criteria:value.criteria,
      requestSha256:hash(JSON.stringify(planRequest.input)),receiptSha256:hash(JSON.stringify(value))});
    adoptedPlan=value;planRequest=null;
  }
  function routedProposal(index,call) {
    const requested=options.planSteps[state.tasks===1?'initial':'pending'].filter(step=>step.kind==='saved_questions')[index];
    const adopted=adoptedPlan?.steps.find(step=>step.id===requested?.id);
    if(!adopted||adopted.state!=='executing'||adopted.criterionIds.some(id=>adoptedPlan.criteria.find(c=>c.id===id)?.kind!=='saved_questions'))throw fail('RETAINED_ADOPTED_STEP_REQUIRED');
    const invocation=call('education_propose_original_question',{...armed.proposals[index],taskStepId:adopted.id});
    state.admissionsRequested.push({task:state.tasks,taskId:adoptedPlan.taskId,requirementsVersion:adoptedPlan.requirementsVersion,
      planRevision:adoptedPlan.revision,stepId:adopted.id,callId:invocation.id});
    return invocation;
  }
  function verifySafeReads(prior) {
    const teacher=prior.find(p=>p.call.name==='read_teacher_request')?.result?.data;
    if(!teacher||teacher.sourceId!==requestSource.sourceId||teacher.sourceVersion!==requestSource.sourceVersion||teacher.runId!==requestSource.runId||
      teacher.kind!=='request'||teacher.offset!==0||teacher.nextOffset!==null||teacher.truncated||typeof teacher.text!=='string'||
      teacher.totalLength!==teacher.text.length||!armed.proposals.every(p=>teacher.text.includes(p.title)))throw fail('RETAINED_COMPLETE_TEACHER_REQUEST_REQUIRED');
    const process=prior.find(p=>p.call.name==='read_session_process')?.result;
    if(!process||!Object.hasOwn(process,'trace'))throw fail('RETAINED_REAL_SESSION_PROCESS_REQUIRED');
    state.teacherRequests.push({task:state.tasks,sourceId:teacher.sourceId,sourceVersion:teacher.sourceVersion,runId:teacher.runId,
      totalLength:teacher.totalLength,receiptSha256:hash(JSON.stringify(teacher))});
    state.processReads.push({task:state.tasks,receiptSha256:hash(JSON.stringify(process))});
    const listing=prior.find(p=>p.call.name==='office_list_materials')?.result;
    if(listing?.materials?.filter(r=>r.resourceId===armed.resourceId&&r.title===armed.fileName&&r.bodyAvailable).length!==1)throw fail('RETAINED_REAL_MATERIAL_NOT_READY');
  }
  function verifyMaterialReads(prior) {
    const reads=prior.filter(p=>p.call.name==='office_read_material');
    if(reads.length!==armed.chunks||reads.some((v,i)=>v.result.success!==true||v.result.offset!==i||v.result.totalChunks!==armed.chunks||v.result.truncated||v.result.source?.version!==armed.version))throw fail('RETAINED_REAL_COMPLETE_READ_REQUIRED');
    for(const {call,result}of reads)state.sourceReads.push({task:state.tasks,callId:call.id,offset:result.offset,version:result.source.version,receiptSha256:hash(JSON.stringify(result))});
  }
  const packet=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'owned-retained-input',object:'chat.completion.chunk',model:options.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
  const respond=calls=>new Response(packet({role:'assistant',content:'<xiaozhi_progress>请对照本地合成原图核对，等待实际工具与教师决定。',tool_calls:calls.map((call,index)=>({index,id:call.id,type:'function',function:{name:call.name,arguments:JSON.stringify(call.args)}}))})+packet({},'tool_calls')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
  electron.net.fetch=async(input,init={})=>{
    try {
      if(state.fatal)throw Error(state.fatal);
      if(Date.now()>=options.deadlineAt)throw fail('RETAINED_240S_DEADLINE');
      const url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
      const method=String(init.method??input?.method??'GET').toUpperCase();
      if(url.protocol!=='https:'||url.hostname!=='api.deepseek.com'||url.port||url.username||url.password||url.search||
        !['/chat/completions','/v1/chat/completions'].includes(url.pathname)||method!=='POST') {
        state.externalAttempts++;throw fail('RETAINED_ENDPOINT_DENIED');
      }
      if(!armed||options.cold||state.responses>=9)throw fail('RETAINED_RESPONSE_BUDGET');
      const raw=typeof init.body==='string'?init.body:await input.clone().text();
      if(Buffer.byteLength(raw)>2*1024*1024)throw fail('RETAINED_REQUEST_SIZE');
      const body=JSON.parse(raw),signal=init.signal??input?.signal;
      if(signal?.aborted)throw fail('RETAINED_ABORTED_REQUEST');
      if(body.model!==options.model||body.stream!==true||!Array.isArray(body.messages))throw fail('RETAINED_REQUEST_SCOPE');
      const definitions=body.tools?.map(t=>t.function?.name??t.name)||[];
      state.responses++;
      state.requests.push({index:state.responses,task:state.tasks,stage,requestSha256:hash(raw),tools:definitions});
      const prior=lastCalls.map(call=>({call,result:realResult(body.messages,call)}));
      let calls=[];
      const call=(name,args)=>{if(!definitions.includes(name))throw fail('RETAINED_REAL_TOOL_MISSING_'+name);return {name,args,id:'retained_'+state.tasks+'_'+state.responses+'_'+calls.length};};
      if(stage==='catalogue') {
        requirePlanSchema(body);
        const task=hostTask(body);requestSource=currentTeacherRequest(body);
        if(task.steps.length||task.criteria.some(c=>c.kind!=='human'))throw fail('RETAINED_FRESH_TASK_PLAN_REQUIRED');
        if(state.tasks===2&&(!priorTask||task.taskId===priorTask.taskId||requestSource.runId===priorTask.runId))throw fail('RETAINED_NEW_REQUIREMENT_REQUIRED');
        const phase=state.tasks===1?'initial':'pending';
        planRequest={taskId:task.taskId,phase,input:planInput(task,phase)};
        calls.push(call('office_list_materials',{query:armed.fileName,offset:0}));
        if(!definitions.includes('education_propose_original_question'))calls.push(call('find_education_tools',{query:'education_propose_original_question'}));
        calls.push(call('read_teacher_request',{sourceId:requestSource.sourceId,sourceVersion:requestSource.sourceVersion,offset:0,limit:4000}));
        calls.push(call('read_session_process',{}));
        calls.push(call('update_task_plan',planRequest.input));
        stage='read';
      } else if(stage==='read') {
        verifyPlan(prior);verifySafeReads(prior);
        for(let offset=0;offset<armed.chunks;offset++)calls.push(call('office_read_material',{resourceId:armed.resourceId,offset}));
        stage='propose';
      } else if(stage==='propose') {
        verifyMaterialReads(prior);
        calls.push(routedProposal(0,call));stage=state.tasks===1?'next':'pending-stop';
      } else if(stage==='next') {
        if(prior.length!==1||prior[0].result.success!==true||prior[0].result.state!=='confirmed')throw fail('RETAINED_REAL_CONFIRMATION_REQUIRED');
        requirePlanSchema(body);
        planRequest={taskId:adoptedPlan.taskId,phase:'advance',input:planInput(adoptedPlan,'advance')};
        calls.push(call('update_task_plan',planRequest.input));stage='multi';
      } else if(stage==='multi') {
        verifyPlan(prior);
        calls.push(routedProposal(1,call));stage='finish';
      } else if(stage==='finish') {
        if(prior.length!==1||prior[0].result.success!==true||prior[0].result.state!=='confirmed')throw fail('RETAINED_REAL_CONFIRMATION_REQUIRED');
        priorTask={taskId:adoptedPlan.taskId,runId:requestSource.runId};
        armed=null;stage='idle';lastCalls=[];
        return new Response(packet({role:'assistant',content:'<xiaozhi_answer>本次审核已处理，请以原图、已保存题面和实际审核记录为准。'})+packet({},'stop')+'data: [DONE]\n\n',{headers:{'content-type':'text/event-stream'}});
      } else throw fail('RETAINED_PROVIDER_STAGE');
      lastCalls=calls;return respond(calls);
    } catch(error) {state.fatal??=error.message;throw error;}
  };
  globalThis.__retainedFixture={state,combined,arm(value){
    if(options.cold||armed||state.tasks>=2||!value||!Number.isInteger(value.chunks)||value.chunks<1||value.chunks>8||value.proposals.length!==(state.tasks===0?2:1))throw fail('RETAINED_TASK_BUDGET');
    armed=value;stage='catalogue';lastCalls=[];state.tasks++;
  }};
}

export function retainedProviderControl({BrowserWindow},input={}) {
  const guard=globalThis.__retainedFixture;
  if(input.arm)guard.arm(input.arm);
  if(input.verify) {
    const id=BrowserWindow.getAllWindows()[0].webContents.id;
    const probe=(url,resourceType)=>{let answer;guard.combined({url,resourceType,webContentsId:id,method:'GET'},v=>answer=v,true);if(!answer)throw Error('RETAINED_POLICY_ASYNC');return answer.cancel===true;};
    if(!guard.state.formalRegistrations||!probe('https://example.invalid/retained','mainFrame')||!probe('file:///owned-child.html','subFrame')||probe('file:///owned-main.html','mainFrame'))throw Error('RETAINED_FORMAL_POLICY_REQUIRED');
    guard.state.policyProof='FORMAL_FRAME_AND_ZERO_WIRE';
  }
  return JSON.parse(JSON.stringify(guard.state));
}
