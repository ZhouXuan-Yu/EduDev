export function composerSendBootstrapSource({profile,main,model,prior}){
  return `const electron=require('electron');\nrequire('node:fs').mkdirSync(${JSON.stringify(profile)},{recursive:true});\nelectron.app.setPath('userData',${JSON.stringify(profile)});\nelectron.app.setPath('sessionData',${JSON.stringify(profile)});\n(async()=>{await electron.app.whenReady();await (${composerSendBudgetMain.toString()})(electron,${JSON.stringify({model,prior})});await import(require('node:url').pathToFileURL(${JSON.stringify(main)}).href);})().catch(error=>{console.error('QA_BOOTSTRAP_'+require('node:crypto').createHash('sha256').update(String(error)).digest('hex'));electron.app.exit(1);});\n`;
}

const qaPhases=['BOOT','TEXT','ATTACHMENT_ONLY','STOP','COLD','DONE'];
// Exact static QA literals only. Arbitrary Error.message/code never becomes report text.
const qaErrors=new Set(`ARGS_REQUIRE_RUN_UI_ALLOW_PAID_PINS_MODEL EXPLICIT_MODEL_AND_INHERITED_KEY_REQUIRED OWNED_PATH_REQUIRED PINS_JSON_REQUIRED INVALID_PINS PINNED_MAIN_REQUIRED
PINS_CHANGED BUILD_CHANGED SOURCE_CHANGED SCRIPTS_CHANGED FIXTURE_CHANGED DATA_DATABASE_REDIRECTED DATA_ROOT_MISMATCH SESSION_STORAGE_NOT_OWNED
RENDERER_ERROR RUN_BUDGET_EXHAUSTED REQUEST_BUDGET_EXHAUSTED REQUEST_GATE_FATAL UNEXPECTED_ADMISSION FOREIGN_SESSION_ADMISSION RUN_IDENTITY_CHANGED
UNBOUND_PROVIDER_REQUEST PROVIDER_ACTIVE_RUN_NOT_UNIQUE COMPOSER_NOT_READY NATIVE_BINDING_NOT_UNIQUE NATIVE_PATH_NOT_OWNED SCENARIO_REENTRY
SUBSET_RUN_COUNT_MISMATCH SUBSET_TERMINAL_MISMATCH DUPLICATE_PROJECTED_TURN RUN_NOT_BOUND SEND_NOT_SUCCEEDED UNEXPECTED_EXTERNAL_GATE
PRIVATE_REASONING_UI_PRESENT TOOL_TIMING_UI_PRESENT SEND_COMPLETION_TIMEOUT COMPLETED_BODY_EMPTY SENT_DRAFT_NOT_CLEARED DUPLICATE_SQL_RUN
TERMINAL_TIMER_NOT_FROZEN TIMER_OBSERVATION SESSION_NOT_READY COMPOSER_NOT_UNIQUE FRESH_HISTORY_NOT_EMPTY FRESH_LEDGER_NOT_ZERO EMPTY_SEND_ENABLED
WHITESPACE_SEND_ENABLED TEXT_SEND_DISABLED USER_PROMPT_NOT_EXACT DUPLICATE_USER_MESSAGE NATIVE_USER_NOT_UNIQUE REENTRY_QUEUED ATTACHMENT_DRAFT_NOT_EMPTY
ATTACHMENT_TRIGGER_NOT_UNIQUE ATTACHMENT_LIST_FAILED ATTACHMENT_IMPORT_TIMEOUT ATTACHMENT_IMPORT_MISMATCH ATTACHMENT_DRAFT_CHIP_MISSING ATTACHMENT_SEND_DISABLED
ATTACHMENT_USER_BINDING_MISSING ATTACHMENT_SUBMITTED_BINDING_MISMATCH ATTACHMENT_SEND_LEDGER_MISMATCH ATTACHMENT_SELECTION_MISMATCH ATTACHMENT_PENDING_NOT_CLEARED
ATTACHMENT_HISTORY_CHIP_MISSING ATTACHMENT_QUESTION_NOT_BOUND ATTACHMENT_QUESTION_INVALID ATTACHMENT_QUESTION_CHANGED ATTACHMENT_QUESTION_REPEATED
ATTACHMENT_QUESTION_UI_MISSING ATTACHMENT_QUESTION_NOT_ANSWERED STOP_WINDOW_MISSED STOP_BODY_TIMEOUT STOP_TRIGGER_NOT_UNIQUE STOP_RUN_CHANGED
STOP_TERMINAL_TIMEOUT STOP_BODY_NOT_RETAINED DRAFT_NOT_DURABLE PUBLIC_HISTORY_TARGET_NOT_UNIQUE PUBLIC_HISTORY_NOT_RESTORED STOP_COLD_PROJECTION_CHANGED
STOP_COLD_BODY_CHANGED STOP_COLD_DRAFT_LOST STOP_COLD_LEDGER_CHANGED STOP_COLD_NATIVE_REPLAY STOP_COLD_PROVIDER_REPLAY STOP_COLD_RESTARTED
STOP_COLD_LEDGER_LATE_CHANGED STOP_COLD_NATIVE_LATE_REPLAY STOP_COLD_PROVIDER_LATE_REPLAY COLD_OBSERVATION`.split(/\s+/));
export function composerSendQaFailure(error,phase,fallback,digest){
  if(!['CHECK_FAILURE','UNCLASSIFIED_FAILURE','INTEGRITY_FAILURE','PREPARATION_FAILED'].includes(fallback)||!/^[a-f0-9]{64}$/.test(digest))throw Error('DIAGNOSTIC_CODE_INVALID');
  const message=error instanceof Error?error.message:undefined;
  return {code:fallback,phase:qaPhases.includes(phase)?phase:'UNKNOWN',...(qaErrors.has(message)?{qaCode:message}:{}),hash:digest};
}

export function captureComposerSendDiagnostic(state,code,digest,phase='BOOT'){
  const codes=['PAGE_ERROR','CONSOLE_ERROR','MAIN_STDOUT','MAIN_STDERR','UNCLASSIFIED_FAILURE','CHECK_FAILURE','CLOSE_FAILURE','INTEGRITY_FAILURE'];
  if(!codes.includes(code)||!/^[a-f0-9]{64}$/.test(digest))throw Error('DIAGNOSTIC_CODE_INVALID');
  if(['PAGE_ERROR','CONSOLE_ERROR'].includes(code))state.fatalRenderer=true;
  state.seen++;
  if(state.records.length<128)state.records.push({code,phase:qaPhases.includes(phase)?phase:'UNKNOWN',hash:digest});
}

/** Serialized into this runner's owned bootstrap, before the formal main loads.
 * The real Pi provider uses electron.net.fetch, not globalThis.fetch.
 * No response body, header, prompt or reasoning text enters the audit log.
 */
export async function composerSendBudgetMain({net,session},options){
  const crypto=process.getBuiltinModule('crypto');
  const hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
  const phases=['BOOT','TEXT','ATTACHMENT_ONLY','STOP','COLD','DONE'];
  const prior=options.prior;
  const state={version:1,maxRuns:5,maxRequests:8,model:options.model,phase:'BOOT',observedRuns:0,
    wire:prior?.wire??0,attempts:prior?.attempts??0,hashes:[...(prior?.hashes??[])],
    events:[...(prior?.events??[])],fatal:prior?.fatal??null,stopping:false};
  const tickets=new Map(),pending=new Map(),seen=new Set(state.hashes);
  const emit=(code,digest='')=>{if(state.events.length<256)state.events.push({code,phase:state.phase,n:state.wire,...(digest?{hash:digest}:{})});};
  const trip=(code,digest='')=>{state.fatal??={code,...(digest?{hash:digest}:{})};emit(code,digest);return Error(code);};
  const urlOf=input=>new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);
  const api=url=>url.protocol==='https:'&&url.hostname==='api.deepseek.com'&&!url.port&&!url.username&&!url.password;
  const catalog=(url,method)=>api(url)&&method==='GET'&&['/models','/v1/models'].includes(url.pathname)&&!url.search;
  const model=(url,method)=>api(url)&&method==='POST'&&['/chat/completions','/v1/chat/completions'].includes(url.pathname)&&!url.search;
  const nativeFetch=net.fetch.bind(net),globalFetch=globalThis.fetch;
  // Every model request must carry a one-use reservation generated by net.fetch.
  // The ticket is removed before leaving the owned default session.
  const webRequest=session.defaultSession.webRequest,registerBefore=webRequest.onBeforeRequest.bind(webRequest);
  let formalBefore;
  state.formalHookRegistrations=0;
  const combinedBefore=(details,callback)=>{
    let allowed=false;
    try{const url=new URL(details.url);allowed=!['http:','https:'].includes(url.protocol)||catalog(url,details.method)||model(url,details.method);}
    catch{}
    if(!allowed){emit('NETWORK_SCOPE_BLOCKED');callback({cancel:true});return;}
    if(formalBefore){try{formalBefore(details,callback);}catch{trip('FORMAL_NETWORK_POLICY_FAILED');callback({cancel:true});}}
    else callback({cancel:false});
  };
  // Electron retains only one listener. Keep the current formal unfiltered
  // local-frame policy AND the QA network gate through registration/cleanup.
  // Unknown filtered registrations fail closed instead of guessing matching.
  webRequest.onBeforeRequest=(...args)=>{
    if(args.length!==1||(args[0]!==null&&typeof args[0]!=='function'))throw trip('FILTERED_NETWORK_HOOK_UNSUPPORTED');
    formalBefore=args[0];if(formalBefore)state.formalHookRegistrations++;
    registerBefore(combinedBefore);
  };
  registerBefore(combinedBefore);
  session.defaultSession.webRequest.onBeforeSendHeaders({urls:['https://api.deepseek.com/*']},(details,callback)=>{
    const url=new URL(details.url),headers={...details.requestHeaders};
    if(!model(url,details.method)){callback({requestHeaders:headers});return;}
    const ticketKey=Object.keys(headers).find(key=>key.toLowerCase()==='x-edudev-qa-ticket');
    const ticket=ticketKey?headers[ticketKey]:undefined,entry=tickets.get(ticket);
    if(ticketKey)delete headers[ticketKey];
    tickets.delete(ticket);
    if(state.fatal||!entry||entry.phase!==state.phase||state.wire>=state.maxRequests||state.observedRuns>state.maxRuns){
      trip(state.wire>=state.maxRequests?'REQUEST_BUDGET_EXHAUSTED':'UNRESERVED_MODEL_REQUEST');
      callback({cancel:true});return;
    }
    state.wire++;entry.wired=true;emit('MODEL_WIRE',entry.hash);
    callback({requestHeaders:headers});
  });
  net.fetch=async(input,init={})=>{
    const url=urlOf(input),method=String(init.method||(typeof input==='object'&&input.method)||'GET').toUpperCase();
    if(catalog(url,method))return nativeFetch(input,init);
    if(!model(url,method))throw trip('NETWORK_SCOPE_REJECTED');
    state.attempts++;
    if(state.fatal)throw Error('BUDGET_LATCHED');
    if(!['TEXT','ATTACHMENT_ONLY','STOP'].includes(state.phase))throw trip('MODEL_OUTSIDE_SCENARIO');
    if(state.wire>=state.maxRequests)throw trip('REQUEST_BUDGET_EXHAUSTED');
    if(state.observedRuns>state.maxRuns)throw trip('RUN_BUDGET_EXHAUSTED');
    const body=typeof init.body==='string'?init.body:input instanceof Request?await input.clone().text():undefined;
    if(typeof body!=='string'||Buffer.byteLength(body)>2*1024*1024)throw trip('UNINSPECTABLE_MODEL_BODY');
    const digest=hash(body);
    if(seen.has(digest))throw trip('AUTOMATIC_RETRY_BLOCKED',digest);
    let request;try{request=JSON.parse(body);}catch{throw trip('MODEL_BODY_INVALID',digest);}
    if(request.model!==state.model||request.stream!==true||!Array.isArray(request.messages))throw trip('MODEL_SCOPE_MISMATCH',digest);
    seen.add(digest);state.hashes.push(digest);
    // A readonly Node-side SQL observer must bind each HTTP request to this
    // scenario's one admitted run. No business handler/IPC is replaced.
    await new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{pending.delete(digest);reject(trip('RUN_OBSERVATION_TIMEOUT',digest));},15000);
      pending.set(digest,{release:()=>{clearTimeout(timer);pending.delete(digest);resolve();},phase:state.phase});
    });
    if(state.fatal)throw Error('BUDGET_LATCHED');
    const ticket=crypto.randomUUID(),entry={hash:digest,phase:state.phase,wired:false};tickets.set(ticket,entry);
    const headers=new Headers(init.headers||(input instanceof Request?input.headers:undefined));headers.set('X-EduDev-QA-Ticket',ticket);
    try{
      const response=await nativeFetch(input,{...init,headers,redirect:'error'});
      if(!entry.wired)throw trip('MODEL_WIRE_NOT_OBSERVED',digest);
      if(!response.ok){trip('PROVIDER_HTTP_REJECTED',hash(response.status));}
      else emit('MODEL_ACCEPTED',digest);
      return response;
    }catch(error){
      const aborted=init.signal?.aborted||(input instanceof Request&&input.signal.aborted);
      if(state.stopping&&aborted)emit('EXPECTED_STOP_ABORT',digest);
      else if(!state.fatal)trip('PROVIDER_TRANSPORT_FAILED',hash(error?.message||'unknown'));
      throw error;
    }finally{tickets.delete(ticket);}
  };
  // Fail closed if a future provider revision switches to Node fetch. Known
  // catalogue GETs remain available; no unmetered model POST is permitted.
  globalThis.fetch=async(input,init={})=>{
    const url=urlOf(input),method=String(init.method||(typeof input==='object'&&input.method)||'GET').toUpperCase();
    if(catalog(url,method))return globalFetch(input,init);
    throw trip('UNMETERED_FETCH_BLOCKED');
  };
  globalThis.__eduComposerSendBudget={state,emit,trip,phases,pending,combinedBefore};
  emit('BUDGET_INSTALLED');
}

/** Main-only QA observations/settings; never calls a business IPC or writes SQL. */
export function composerSendBudgetControl(_electron,{phase,observedRuns,stopping,release,runHash,verifyNetwork}={}){
  const guard=globalThis.__eduComposerSendBudget;
  if(!guard)throw Error('BUDGET_NOT_INSTALLED');
  if(phase!==undefined){if(!guard.phases.includes(phase))throw Error('BAD_PHASE');guard.state.phase=phase;guard.emit('PHASE_SET');}
  if(observedRuns!==undefined){
    if(!Number.isSafeInteger(observedRuns)||observedRuns<0)throw Error('BAD_RUN_COUNT');
    guard.state.observedRuns=observedRuns;
    if(observedRuns>guard.state.maxRuns)guard.trip('RUN_BUDGET_EXHAUSTED');
  }
  if(stopping!==undefined)guard.state.stopping=stopping===true;
  if(release){
    if(!/^[a-f0-9]{64}$/.test(runHash)||!guard.state.observedRuns||guard.state.observedRuns>5||guard.state.fatal)throw Error('INVALID_RUN_OBSERVATION');
    for(const entry of guard.pending.values())if(entry.phase===guard.state.phase)entry.release();
  }
  if(verifyNetwork){
    const webContentsId=_electron.BrowserWindow.getAllWindows()[0].webContents.id;
    const probe=(url,resourceType)=>{let result;guard.combinedBefore({url,resourceType,webContentsId,method:'GET'},value=>result=value);if(!result)throw Error('NETWORK_PROBE_NOT_SYNCHRONOUS');return result.cancel===true;};
    const proof={code:'FINAL_COMPOSED_CALLBACK_PROBE',formalRegistered:guard.state.formalHookRegistrations>0,
      externalBlocked:probe('https://example.invalid/qa','mainFrame'),
      localChildBlocked:probe('file:///owned-qa-child.html','subFrame'),
      localTopAllowed:!probe('file:///owned-qa-top.html','mainFrame'),
      catalogueTopAllowed:!probe('https://api.deepseek.com/v1/models','mainFrame')};
    if(!proof.formalRegistered||!proof.externalBlocked||!proof.localChildBlocked||!proof.localTopAllowed||!proof.catalogueTopAllowed)throw Error('FINAL_NETWORK_COMPOSITION_FAILED');
    guard.state.networkProof=proof;
  }
  const {model,...safe}=guard.state;
  return JSON.parse(JSON.stringify({...safe,modelHash:process.getBuiltinModule('crypto').createHash('sha256').update(model).digest('hex'),pending:guard.pending.size}));
}

/** Network-free harness for the serialized pre-main gate and strict terminals.
 * Explicitly a QA seam test, never an Electron/provider acceptance result.
 * Run: node scripts/acceptance/ui-final-composer-send-budget.mjs --self-test
 */
export async function composerSendBudgetSelfTest(){
  const {default:assert}=await import('node:assert/strict');
  const vm=await import('node:vm');
  const {composerSendTerminal,composerAttachmentQuestion}=await import('./ui-final-composer-send-journey.mjs');
  const checks=[];
  const test=async(code,work)=>{await work();checks.push({code,status:'PASS'});};
  async function lab({prior,status=200}={}){
    const hooks={},wire=[];
    const session={defaultSession:{webRequest:{onBeforeRequest:(...args)=>hooks.before=args.at(-1),onBeforeSendHeaders:(_filter,fn)=>hooks.headers=fn}}};
    const net={fetch:async(input,init)=>{
      const details={url:String(input),method:init.method,requestHeaders:Object.fromEntries(new Headers(init.headers))};
      let verdict;hooks.before(details,value=>verdict=value);if(verdict.cancel)throw Error('CANCELLED_BEFORE_REQUEST');
      hooks.headers(details,value=>verdict=value);if(verdict.cancel)throw Error('CANCELLED_BEFORE_HEADERS');
      wire.push(verdict.requestHeaders);return {ok:status>=200&&status<300,status};
    }};
    const context=vm.createContext({URL,Request,Headers,Buffer,setTimeout,clearTimeout,process:{getBuiltinModule:process.getBuiltinModule},fetch:async()=>({ok:true})});
    const install=vm.runInContext(`(${composerSendBudgetMain.toString()})`,context),control=vm.runInContext(`(${composerSendBudgetControl.toString()})`,context);
    await install({net,session},{model:'synthetic-test-model',prior});
    const read=options=>control({BrowserWindow:{getAllWindows:()=>[{webContents:{id:41}}]}},options);
    const request=(content='synthetic')=>net.fetch('https://api.deepseek.com/v1/chat/completions',{method:'POST',headers:{authorization:'Bearer SYNTHETIC-NOT-A-KEY'},body:JSON.stringify({model:'synthetic-test-model',stream:true,messages:[{role:'user',content}]})});
    const release=()=>read({observedRuns:1,release:true,runHash:'a'.repeat(64)});
    return {net,session,hooks,wire,read,request,release,context};
  }
  await test('READONLY_RUN_ACK_BEFORE_WIRE',async()=>{
    const l=await lab();l.read({phase:'TEXT'});const pending=l.request();assert.equal(l.wire.length,0);assert.equal(l.read().pending,1);
    l.release();await pending;assert.equal(l.wire.length,1);assert.equal(l.read().wire,1);
    assert(!Object.keys(l.wire[0]).some(key=>key.toLowerCase()==='x-edudev-qa-ticket'));
    const audit=JSON.stringify(l.read());assert(!audit.includes('SYNTHETIC-NOT-A-KEY')&&!audit.includes('synthetic-test-model')&&!audit.includes('"content"'));
  });
  await test('DUPLICATE_BODY_NO_SECOND_WIRE',async()=>{
    const l=await lab();l.read({phase:'TEXT'});const one=l.request();l.release();await one;
    await assert.rejects(l.request(),/AUTOMATIC_RETRY_BLOCKED/);assert.equal(l.wire.length,1);
  });
  await test('HTTP_FAILURE_LATCH_NO_RETRY',async()=>{
    const l=await lab({status:503});l.read({phase:'TEXT'});const one=l.request();l.release();await one;
    assert.equal(l.read().fatal.code,'PROVIDER_HTTP_REJECTED');await assert.rejects(l.request('different'),/BUDGET_LATCHED/);assert.equal(l.wire.length,1);
  });
  await test('EIGHT_REQUEST_HARD_LIMIT',async()=>{
    const l=await lab({prior:{wire:7}});l.read({phase:'TEXT'});const one=l.request();l.release();await one;
    assert.equal(l.read().wire,8);await assert.rejects(l.request('ninth'),/REQUEST_BUDGET_EXHAUSTED/);assert.equal(l.wire.length,1);
  });
  await test('RUN_COUNT_LATCH',async()=>{
    const l=await lab();l.read({phase:'TEXT',observedRuns:6});await assert.rejects(l.request(),/BUDGET_LATCHED/);assert.equal(l.wire.length,0);
  });
  await test('BOOT_AND_COLD_DENY_MODEL',async()=>{
    for(const phase of ['BOOT','COLD']){const l=await lab({prior:{wire:3}});l.read({phase});await assert.rejects(l.request(),/MODEL_OUTSIDE_SCENARIO/);assert.equal(l.wire.length,0);assert.equal(l.read().wire,3);}
  });
  await test('UNRESERVED_WIRE_BLOCKED',async()=>{
    const l=await lab();let result;l.hooks.headers({url:'https://api.deepseek.com/v1/chat/completions',method:'POST',requestHeaders:{}},value=>result=value);
    assert(result.cancel);assert.equal(l.read().wire,0);assert.equal(l.read().fatal.code,'UNRESERVED_MODEL_REQUEST');
  });
  await test('NODE_FETCH_MODEL_FAILS_CLOSED',async()=>{
    const l=await lab();await assert.rejects(l.context.fetch('https://api.deepseek.com/v1/chat/completions',{method:'POST'}),/UNMETERED_FETCH_BLOCKED/);assert.equal(l.wire.length,0);
  });
  await test('FOREIGN_NETWORK_DENIED',async()=>{
    const l=await lab();let result;l.hooks.before({url:'https://example.invalid/private',method:'GET'},value=>result=value);assert(result.cancel);
  });
  await test('FINAL_FORMAL_AND_QA_POLICIES_COMPOSED',async()=>{
    const l=await lab();l.session.defaultSession.webRequest.onBeforeRequest((request,done)=>done({cancel:request.webContentsId===41&&request.resourceType==='subFrame'&&!/^(?:about:|data:|blob:)/.test(request.url)}));
    const proof=l.read({verifyNetwork:true}).networkProof;assert(proof.externalBlocked&&proof.localChildBlocked&&proof.localTopAllowed&&proof.catalogueTopAllowed);
    l.session.defaultSession.webRequest.onBeforeRequest(null);let result;l.hooks.before({url:'https://example.invalid/after-cleanup',method:'GET'},value=>result=value);assert(result.cancel);
  });
  await test('EARLY_PROFILE_BEFORE_READY_OR_SESSION',async()=>{
    const events=[],profile='/owned/profile';
    const source=composerSendBootstrapSource({profile,main:'/owned/main.js',model:'synthetic-test-model'});
    const app={setPath:(name,value)=>events.push([name,value]),whenReady:()=>{events.push(['ready']);return new Promise(()=>{});}};
    vm.runInNewContext(source,{require:name=>name==='electron'?{app}:name==='node:fs'?{mkdirSync:value=>events.push(['mkdir',value])}:assert.fail('Unexpected bootstrap dependency'),console});
    assert.deepEqual(events,[['mkdir',profile],['userData',profile],['sessionData',profile],['ready']]);
  });
  await test('DIAGNOSTIC_CAP_NEVER_HIDES_RENDERER_FAILURE',async()=>{
    for(const code of ['PAGE_ERROR','CONSOLE_ERROR']){
      const state={records:[],seen:0,fatalRenderer:false};for(let i=0;i<140;i++)captureComposerSendDiagnostic(state,'MAIN_STDOUT','a'.repeat(64));
      captureComposerSendDiagnostic(state,code,'b'.repeat(64));assert.equal(state.records.length,128);assert.equal(state.fatalRenderer,true);
    }
  });
  const terminal=(turnStatus='completed',runStatus='succeeded',running=false)=>[{running,projection:{turns:[{id:'owned-run',status:turnStatus}]}},{id:'owned-run',session_id:'owned-session',status:runStatus},'owned-session',1];
  await test('TERMINAL_REQUIRES_BOTH_AND_INACTIVE',async()=>{
    assert.equal(composerSendTerminal(...terminal()),true);assert.equal(composerSendTerminal(...terminal('completed','running')),false);assert.equal(composerSendTerminal(...terminal('running','succeeded')),false);assert.equal(composerSendTerminal(...terminal('completed','succeeded',true)),false);
  });
  await test('FAILED_OR_INTERRUPTED_NOT_SUCCESS',async()=>{
    for(const values of [terminal('failed','failed'),terminal('interrupted','blocked')])assert.throws(()=>composerSendTerminal(...values),/SEND_NOT_SUCCEEDED/);
  });
  await test('FOREIGN_OR_DUPLICATE_RUN_REJECTED',async()=>{
    const values=terminal();values[1].session_id='foreign';assert.throws(()=>composerSendTerminal(...values),/RUN_NOT_BOUND/);
    const duplicate=terminal();duplicate[0].projection.turns.push({id:'extra',status:'completed'});assert.throws(()=>composerSendTerminal(...duplicate),/DUPLICATE_PROJECTED_TURN/);
  });
  const clarification=()=>{
    const question={id:'pictrl_00000000-0000-0000-0000-000000000000',runId:'attachment-run',callId:'owned-call',kind:'question',state:'pending',text:'如何处理本附件？',options:['确认收到','另行说明']};
    const state={running:true,projection:{threadId:'owned-session',turns:[{id:'text-run',status:'completed'},{id:'attachment-run',status:'waiting_input'}]},controls:[question]};
    return [state,{id:'attachment-run',session_id:'owned-session',status:'running'},{phase:'ATTACHMENT_ONLY',sessionId:'owned-session',runId:'attachment-run'},2];
  };
  await test('DECLARED_ATTACHMENT_QUESTION_ACCEPTS_ONLY_CURRENT_LIVE_BINDING',async()=>{
    const values=clarification();assert.equal(composerAttachmentQuestion(...values),values[0].controls[0]);
    values[2].question=structuredClone(values[0].controls[0]);values[2].submitted=true;
    // The same still-pending snapshot may be polled after one click; the UI
    // caller's submitted latch prevents a second click. It is never terminal.
    assert.equal(composerAttachmentQuestion(...values).id,values[2].question.id);
    assert.equal(composerSendTerminal(values[0],values[1],'owned-session',2),false);
    values[0].running=false;values[0].projection.turns[1].status='completed';values[1].status='succeeded';
    assert.equal(composerSendTerminal(values[0],values[1],'owned-session',2),false);
  });
  await test('ATTACHMENT_QUESTION_WRONG_SCENARIO_OR_MULTIPLE_FAIL_CLOSED',async()=>{
    for(const phase of ['TEXT','STOP','COLD']){const v=clarification();v[2].phase=phase;assert.throws(()=>composerAttachmentQuestion(...v),/UNEXPECTED_EXTERNAL_GATE/);}
    const absent=clarification();absent[2]=undefined;assert.throws(()=>composerAttachmentQuestion(...absent),/UNEXPECTED_EXTERNAL_GATE/);
    const multiple=clarification();multiple[0].controls.push({...multiple[0].controls[0],id:'pictrl_10000000-0000-0000-0000-000000000000'});assert.throws(()=>composerAttachmentQuestion(...multiple),/UNEXPECTED_EXTERNAL_GATE/);
    const count=clarification();count[3]=3;assert.throws(()=>composerAttachmentQuestion(...count),/UNEXPECTED_EXTERNAL_GATE/);
  });
  await test('ATTACHMENT_QUESTION_FOREIGN_STALE_OR_RESUMABLE_FAILS_CLOSED',async()=>{
    const mutations=[v=>v[0].projection.threadId='foreign',v=>v[1].session_id='foreign',v=>v[0].controls[0].runId='foreign',v=>v[0].projection.turns[1].id='foreign',v=>v[1].status='succeeded',v=>v[0].running=false];
    for(const mutate of mutations){const v=clarification();mutate(v);assert.throws(()=>composerAttachmentQuestion(...v),/ATTACHMENT_QUESTION_NOT_BOUND/);}
    const resumed=clarification();resumed[0].controls[0].canResume=true;assert.throws(()=>composerAttachmentQuestion(...resumed),/ATTACHMENT_QUESTION_INVALID/);
    const shape=clarification();shape[0].controls[0].options.push('三','四');assert.throws(()=>composerAttachmentQuestion(...shape),/ATTACHMENT_QUESTION_INVALID/);
  });
  await test('ATTACHMENT_QUESTION_CHANGED_REPEATED_OR_APPROVAL_DENIED',async()=>{
    const changed=clarification();changed[2].question=structuredClone(changed[0].controls[0]);changed[0].controls[0].text='另一问题';assert.throws(()=>composerAttachmentQuestion(...changed),/ATTACHMENT_QUESTION_CHANGED/);
    const repeated=clarification();repeated[0].controls.push({...repeated[0].controls[0],id:'old-question',state:'answered'});assert.throws(()=>composerAttachmentQuestion(...repeated),/ATTACHMENT_QUESTION_REPEATED/);
    for(const collection of ['approvals','changes']){const v=clarification();v[0][collection]=[{state:'pending'}];assert.throws(()=>composerAttachmentQuestion(...v),/UNEXPECTED_EXTERNAL_GATE/);}
  });
  await test('SAFE_QA_ERROR_ALLOWLIST_AND_PHASE_NO_RAW_CONTENT',async()=>{
    const digest='c'.repeat(64),known=composerSendQaFailure(new Error('UNEXPECTED_EXTERNAL_GATE'),'ATTACHMENT_ONLY','CHECK_FAILURE',digest);
    assert.equal(known.qaCode,'UNEXPECTED_EXTERNAL_GATE');assert.equal(known.phase,'ATTACHMENT_ONLY');
    const unknown=composerSendQaFailure(new Error('private provider text https://secret.invalid/?key=hidden'),'private phase','CHECK_FAILURE',digest);
    assert.deepEqual(unknown,{code:'CHECK_FAILURE',phase:'UNKNOWN',hash:digest});
    const record={records:[],seen:0,fatalRenderer:false};captureComposerSendDiagnostic(record,'CONSOLE_ERROR',digest,'STOP');
    assert.deepEqual(record.records,[{code:'CONSOLE_ERROR',phase:'STOP',hash:digest}]);assert(record.fatalRenderer);
  });
  return {code:'QA_SEAM_SELF_TEST_PASS',checks,actualElectron:false,providerRequests:0};
}
if(process.argv.includes('--self-test')){
  try{console.log(JSON.stringify(await composerSendBudgetSelfTest()));}
  catch(error){console.log(JSON.stringify({code:'QA_SEAM_SELF_TEST_FAIL',hash:process.getBuiltinModule('crypto').createHash('sha256').update(String(error)).digest('hex')}));process.exitCode=1;}
}
