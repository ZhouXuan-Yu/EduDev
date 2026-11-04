/** X01 QA only. Real UI/Pi/SQLite; controlled pre-wire failure is AFTER admission. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

export const contract=Object.freeze({maxRuns:3,maxLaunches:1,maxNativeWire:0,maxModelAttempts:3,totalMs:180000,cleanupMs:10000,holdMs:45000,
  cases:['QUEUE_EDIT_WITHDRAW_STOP','FAILED_TURN_DRAFT_RECOVERY','EXPLICIT_RETRY_ONLY'],
  notRun:['Successful provider response or succeeded/completed answer','Queue applied/delivered or streaming','Preadmission rejection/transport receipt ambiguity','Backend command replay/CAS injection','Cold restart/crash recovery','Real provider outage or OCR']});
export const hash=value=>createHash('sha256').update(Buffer.isBuffer(value)||typeof value==='string'?value:JSON.stringify(value)).digest('hex');
export function need(condition,code){if(!condition)throw Error(code);}
export const tables=Object.freeze(['ai_agent_runs','ai_agent_run_requests','ai_agent_run_actions','ai_agent_events','xiaozhi_event_journal',
  'xiaozhi_pi_commands','xiaozhi_pi_usage','xiaozhi_tool_receipts','xiaozhi_pi_controls','xiaozhi_pi_session_bindings','ai_confirmation_items',
  'ai_conversation_messages','xiaozhi_pi_attachments','xiaozhi_pi_attachment_sends','xiaozhi_pi_attachment_imports']);

export function boundedTree(root){
  const absolute=path.resolve(root);need(fs.realpathSync(absolute)===absolute,'CLONE_REDIRECTED');const files=[];let bytes=0;
  const walk=directory=>{for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
    const file=path.join(directory,entry.name),stat=fs.lstatSync(file);need(!stat.isSymbolicLink(),'CLONE_REDIRECTED');
    if(stat.isDirectory())walk(file);else{need(stat.isFile(),'CLONE_UNSUPPORTED_FILE');bytes+=stat.size;need(files.length<4096&&bytes<=256*1024*1024,'CLONE_TOO_LARGE');files.push({file:path.relative(absolute,file),bytes:stat.size,sha256:hash(fs.readFileSync(file))});}
  }};walk(absolute);need(files.length>0,'CLONE_EMPTY');return {root:absolute,bytes,files,sha256:hash(files)};
}
export function cloneTree(tree,destination){
  need(!fs.existsSync(destination),'CLONE_TARGET_EXISTS');fs.mkdirSync(destination,{recursive:true});
  for(const entry of tree.files){const source=path.join(tree.root,entry.file),target=path.join(destination,entry.file);need(hash(fs.readFileSync(source))===entry.sha256,'CLONE_SOURCE_CHANGED');fs.mkdirSync(path.dirname(target),{recursive:true});fs.copyFileSync(source,target,fs.constants.COPYFILE_EXCL);need(hash(fs.readFileSync(target))===entry.sha256,'CLONE_COPY_CHANGED');}
  need(boundedTree(tree.root).sha256===tree.sha256,'CLONE_SOURCE_CHANGED');need(boundedTree(destination).sha256===tree.sha256,'CLONE_COPY_CHANGED');
}
export function validateCatalogue(bytes,model,now=Date.now()){
  need(bytes.length<=65536,'CATALOGUE_INVALID');const value=JSON.parse(bytes);
  need(value.version===1&&value.endpoint==='https://api.deepseek.com/v1/models'&&Array.isArray(value.models)&&value.models.length>0&&value.models.length<=32,'CATALOGUE_INVALID');
  const at=Date.parse(value.observedAt);need(Number.isFinite(at)&&at<=now+60000&&now-at<86400000,'CATALOGUE_REFRESH_REQUIRED_NOT_RUN');
  need(new Set(value.models.map(v=>v.id)).size===value.models.length&&value.models.every(v=>v.source==='official'&&v.observedAt===value.observedAt),'CATALOGUE_NOT_OFFICIAL');
  const selected=value.models.filter(v=>v.id===model);need(selected.length===1,'CATALOGUE_MODEL_MISSING');const m=selected[0];
  need(Number.isSafeInteger(m.contextWindow)&&m.contextWindow>=4096&&m.contextWindow<=16*1048576&&Number.isSafeInteger(m.maxOutputTokens)&&m.maxOutputTokens>=4096&&m.maxOutputTokens<=m.contextWindow,'CATALOGUE_INVALID');
  need(Array.isArray(m.inputModalities)&&m.inputModalities.includes('text')&&m.inputModalities.every(v=>['text','image'].includes(v))&&m.effort&&Array.isArray(m.effort.supportedLevels)&&m.effort.supportedLevels.length>0&&m.effort.supportedLevels.every(v=>['low','high','max'].includes(v)),'CATALOGUE_REFRESH_REQUIRED_NOT_RUN');
  return {sha256:hash(bytes),endpoint:value.endpoint,modelHash:hash(model),observedAt:value.observedAt};
}
export function readSql(data,work){
  const file=path.resolve(data,'app.db');need(fs.realpathSync(file)===file,'DATABASE_REDIRECTED');const db=new DatabaseSync(file,{readOnly:true});
  try{db.exec('PRAGMA query_only=ON; BEGIN;');return work((sql,params=[])=>db.prepare(sql).all(...params));}finally{db.close();}
}
export function captureFacts(data){return readSql(data,query=>{
  const records={};for(const table of tables){const info=query('PRAGMA table_info('+table+')');need(info.length>0,'REQUIRED_TABLE_MISSING');const keys=info.filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>c.name);need(keys.length>0,'PRIMARY_KEY_REQUIRED');
    records[table]={keys,rows:query('SELECT * FROM '+table+' ORDER BY '+keys.map(k=>'"'+k+'"').join(','))};}
  return {records,summary:Object.fromEntries(Object.entries(records).map(([table,v])=>[table,{count:v.rows.length,sha256:hash(v.rows)}]))};
});}
export function assertRetained(before,after){
  for(const [table,prior]of Object.entries(before.records)){
    const current=after.records[table];need(current,'REQUIRED_TABLE_MISSING');const key=row=>JSON.stringify(prior.keys.map(k=>row[k])),rows=new Map(current.rows.map(row=>[key(row),row]));
    for(const row of prior.rows){const next=rows.get(key(row));need(next&&Object.keys(row).every(k=>JSON.stringify(next[k])===JSON.stringify(row[k])),'OBSERVED_FACT_CHANGED');}
  }
}
export function assertQuiescent(facts){
  const rows=table=>facts.records[table].rows;
  need(rows('ai_agent_runs').every(r=>['succeeded','failed','blocked','cancelled','interrupted'].includes(r.status)),'BASELINE_ACTIVE_RUN');
  need(rows('xiaozhi_pi_commands').every(r=>['finished','interrupted'].includes(r.status)),'BASELINE_ACTIVE_COMMAND');
  need(rows('ai_confirmation_items').every(r=>['confirmed','rejected'].includes(r.status)),'BASELINE_PENDING_APPROVAL');
  need(rows('xiaozhi_pi_controls').every(r=>['answered','withdrawn','applied','interrupted'].includes(r.state)),'BASELINE_PENDING_CONTROL');
  need(rows('xiaozhi_pi_attachment_imports').every(r=>['ready','interrupted'].includes(r.state)),'BASELINE_PENDING_IMPORT');
}
export function nativeState(data,query){
  const root=path.resolve(data,'xiaozhi-pi');return query('SELECT conversation_id,session_file FROM xiaozhi_pi_session_bindings ORDER BY conversation_id').map(row=>{
    const file=path.resolve(root,row.session_file),relative=path.relative(root,file);need(relative&&!relative.startsWith('..')&&!path.isAbsolute(relative)&&fs.realpathSync(file)===file,'NATIVE_PATH_REDIRECTED');return {sessionHash:hash(row.conversation_id),file,sha256:hash(fs.readFileSync(file))};
  });
}
export function assertNativeRetained(before,after){for(const row of before)need(after.some(v=>v.sessionHash===row.sessionHash&&v.file===row.file&&v.sha256===row.sha256),'NATIVE_REPLAY');}
export function assertFinalSnapshot(before,after){
  need(before.newRuns.length===3&&after.newRuns.length===3&&before.newRuns.map(r=>r.status).join(',')==='blocked,failed,failed'&&hash(before.newRuns)===hash(after.newRuns),'FINAL_FACTS_CHANGED');
  need(hash(before.ledger)===hash(after.ledger)&&hash(before.native)===hash(after.native),'FINAL_FACTS_CHANGED');
}

/** Serialized into OWNED main before any formal imports; never calls native fetch.
 * Does not manufacture model responses, runtime events, SQL or IPC receipts. */
export function installQueueRecoveryGuard({app,net,session},options){
  const crypto=process.getBuiltinModule('crypto'),hash=v=>crypto.createHash('sha256').update(String(v)).digest('hex');
  const state={phase:'BOOT',attempts:0,nativeWire:0,nativeEscapeAttempts:0,observedRuns:0,expectedRuns:0,fatal:null,rendererErrors:0,formalRegistrations:0,events:[],requests:[]},pending=new Map();let formal;
  const emit=(code,digest)=>{if(state.events.length<128)state.events.push({code,phase:state.phase,...(digest?{hash:digest}:{})});};
  const trip=code=>{state.fatal??=code;emit(code);return Error(code);};
  const combined=(details,callback,probe=false)=>{if(/^(https?|wss?):/i.test(details.url)){if(!probe){state.nativeEscapeAttempts++;trip('UNEXPECTED_NATIVE_WIRE_BLOCKED');}callback({cancel:true});return;}if(formal)formal(details,callback);else callback({cancel:false});};
  const web=session.defaultSession.webRequest,register=web.onBeforeRequest.bind(web);
  web.onBeforeRequest=(...args)=>{if(args.length!==1||args[0]!==null&&typeof args[0]!=='function')throw trip('NETWORK_REGISTRATION_UNSUPPORTED');formal=args[0];if(formal)state.formalRegistrations++;register(combined);};register(combined);
  app.on('web-contents-created',(_e,content)=>{
    const error=(code,value)=>{state.rendererErrors++;emit(code,hash(value));};
    content.on('console-message',(details,level,message)=>{const modern=typeof details?.level==='string';if(modern?details.level==='error':level===3)error('RENDERER_CONSOLE_ERROR',modern?details.message:message);});
    content.on('preload-error',(_event,_file,e)=>error('PRELOAD_ERROR',e));content.on('render-process-gone',(_event,d)=>{if(d.reason!=='clean-exit')error('RENDERER_GONE',d.reason);});
  });
  net.fetch=async(input,init={})=>{
    if(state.fatal)throw Error('GUARD_LATCHED');let url;try{url=new URL(typeof input==='string'?input:input instanceof URL?input.href:input.url);}catch{throw trip('NETWORK_SCOPE_REJECTED');}
    const method=String(init.method??input?.method??'GET').toUpperCase();
    if(url.protocol!=='https:'||url.hostname!=='api.deepseek.com'||url.port||url.username||url.password||url.search||!['/chat/completions','/v1/chat/completions'].includes(url.pathname)||method!=='POST')throw trip('NETWORK_SCOPE_REJECTED');
    if(!['HOLD','FAIL','RETRY'].includes(state.phase))throw trip('MODEL_OUTSIDE_SCENARIO');
    if(state.attempts>=3||state.observedRuns>3||state.expectedRuns<1||state.requests.some(r=>r.phase===state.phase))throw trip('AUTOMATIC_RETRY_OR_BUDGET');
    const body=typeof init.body==='string'?init.body:input instanceof Request?await input.clone().text():undefined;
    if(typeof body!=='string'||Buffer.byteLength(body)>2*1024*1024)throw trip('MODEL_BODY_INVALID');let payload;try{payload=JSON.parse(body);}catch{throw trip('MODEL_BODY_INVALID');}
    if(payload.model!==options.model||payload.stream!==true||!Array.isArray(payload.messages))throw trip('MODEL_SCOPE_MISMATCH');
    const signal=init.signal??(input instanceof Request?input.signal:undefined);if(!signal||typeof signal.addEventListener!=='function')throw trip('MODEL_ABORT_SIGNAL_MISSING');
    const phase=state.phase,entry={phase,hash:hash(body),bound:false,aborted:false,rejected:false};state.requests.push(entry);state.attempts++;emit('MODEL_INTERCEPTED',entry.hash);
    let bindingTimer,holdTimer,onAbort;
    try{
      await new Promise((resolve,reject)=>{onAbort=()=>{entry.aborted=true;reject(signal.reason??Error('X01_STOP_ABORT'));};if(signal.aborted){onAbort();return;}signal.addEventListener('abort',onAbort,{once:true});
        bindingTimer=setTimeout(()=>reject(trip('SQL_BIND_DEADLINE')),Math.min(10000,Math.max(1,options.deadlineAt-Date.now())));pending.set(phase,{entry,release:resolve});});
      clearTimeout(bindingTimer);signal.removeEventListener('abort',onAbort);pending.delete(phase);
      if(state.fatal)throw Error('GUARD_LATCHED');signal.throwIfAborted();
      if(phase==='HOLD')await new Promise((_,reject)=>{onAbort=()=>{entry.aborted=true;emit('EXPECTED_HOLD_ABORT',entry.hash);reject(signal.reason??Error('X01_STOP_ABORT'));};if(signal.aborted){onAbort();return;}signal.addEventListener('abort',onAbort,{once:true});holdTimer=setTimeout(()=>reject(trip('HOLD_DEADLINE')),Math.min(45000,Math.max(1,options.deadlineAt-Date.now())));});
      else{entry.rejected=true;emit('CONTROLLED_PREWIRE_REJECTION',entry.hash);throw Error('X01_PREWIRE_CONTROLLED_REJECTION');}
    }finally{clearTimeout(bindingTimer);clearTimeout(holdTimer);signal.removeEventListener('abort',onAbort);pending.delete(phase);}
  };
  globalThis.fetch=async()=>{throw trip('UNMETERED_FETCH_BLOCKED');};
  globalThis.__queueRecoveryGuard={state,pending,trip,combined};emit('ZERO_WIRE_GUARD_INSTALLED');
}
/** Only QA state control and reads. Never invokes any business endpoint. */
export function queueRecoveryControl(electron,input={}){
  const g=globalThis.__queueRecoveryGuard;if(!g)throw Error('GUARD_NOT_INSTALLED');const {state}=g;
  if(input.phase!==undefined){const transitions={BOOT:'HOLD',HOLD:'STOPPING',STOPPING:'FAIL',FAIL:'RETRY',RETRY:'DONE'};
    if(input.phase!==transitions[state.phase]||g.pending.size||state.phase==='HOLD'&&!state.requests.some(r=>r.bound))throw g.trip('PHASE_TRANSITION_INVALID');state.phase=input.phase;}
  if(input.expectedRuns!==undefined){if(!Number.isSafeInteger(input.expectedRuns)||input.expectedRuns<state.expectedRuns||input.expectedRuns>3)throw g.trip('RUN_BUDGET_EXHAUSTED');state.expectedRuns=input.expectedRuns;}
  if(input.observedRuns!==undefined){if(!Number.isSafeInteger(input.observedRuns)||input.observedRuns<0||input.observedRuns>state.expectedRuns||input.observedRuns>3)throw g.trip('UNEXPECTED_ADMISSION');state.observedRuns=input.observedRuns;}
  if(input.bind){const {runHash,sessionHash}=input.bind;if(!/^[a-f0-9]{64}$/.test(runHash)||!/^[a-f0-9]{64}$/.test(sessionHash)||state.observedRuns!==state.expectedRuns)throw g.trip('SQL_BIND_INVALID');
    const item=g.pending.get(state.phase);if(!item||state.requests.some(r=>r!==item.entry&&r.runHash===runHash))throw g.trip('SQL_BIND_INVALID');Object.assign(item.entry,{runHash,sessionHash,bound:true});item.release();}
  if(input.verifyNetwork){const id=electron.BrowserWindow.getAllWindows()[0].webContents.id,probe=(url,resourceType)=>{let result;g.combined({url,resourceType,method:'GET',webContentsId:id},v=>result=v,true);if(!result)throw g.trip('NETWORK_POLICY_ASYNC');return result.cancel===true;};
    if(!state.formalRegistrations||!probe('https://example.invalid/x01','mainFrame')||!probe('file:///owned-child.html','subFrame')||probe('file:///owned-main.html','mainFrame'))throw g.trip('NETWORK_COMPOSITION_FAILED');state.networkProof='FORMAL_FRAME_AND_ZERO_WIRE';}
  return JSON.parse(JSON.stringify({...state,pending:[...g.pending.keys()]}));
}
export function bootstrapSource({profile,main,stateFile,model,deadlineAt}){
  return `const e=require('electron'),fs=require('node:fs');const f=${JSON.stringify(stateFile)},s={phase:'BOOT'};const save=()=>{fs.writeFileSync(f+'.tmp',JSON.stringify(s));fs.renameSync(f+'.tmp',f);};const fail=error=>{s.failed=true;s.errorHash=require('node:crypto').createHash('sha256').update(String(error?.stack||error)).digest('hex');try{save();}catch{}e.app.exit(1);};try{fs.mkdirSync(${JSON.stringify(profile)},{recursive:true});e.app.setPath('userData',${JSON.stringify(profile)});e.app.setPath('sessionData',${JSON.stringify(profile)});save();(async()=>{await e.app.whenReady();(${installQueueRecoveryGuard.toString()})(e,${JSON.stringify({model,deadlineAt})});s.phase='MAIN_IMPORT';save();await import(require('node:url').pathToFileURL(${JSON.stringify(main)}).href);s.phase='MAIN_IMPORTED';save();})().catch(fail);}catch(error){fail(error);}\n`;
}

const errorCodes=new Set(['CLONE_REDIRECTED','CLONE_UNSUPPORTED_FILE','CLONE_TOO_LARGE','CLONE_EMPTY','CLONE_TARGET_EXISTS','CLONE_SOURCE_CHANGED','CLONE_COPY_CHANGED','CATALOGUE_INVALID','CATALOGUE_REFRESH_REQUIRED_NOT_RUN','CATALOGUE_NOT_OFFICIAL','CATALOGUE_MODEL_MISSING','BASELINE_ACTIVE_RUN','BASELINE_ACTIVE_COMMAND','BASELINE_PENDING_APPROVAL','BASELINE_PENDING_CONTROL','BASELINE_PENDING_IMPORT','OBSERVED_FACT_CHANGED','NATIVE_REPLAY','UNEXPECTED_ADMISSION','AUTOMATIC_RETRY_OR_BUDGET','NETWORK_SCOPE_REJECTED','NETWORK_COMPOSITION_FAILED','HOLD_DEADLINE','SQL_BIND_DEADLINE','SOURCE_CHANGED','BUILD_CHANGED','PINS_CHANGED','SCRIPTS_CHANGED','BASELINE_CHANGED','BOOTSTRAP_FAILED','BOOTSTRAP_DEADLINE','BOOTSTRAP_CHILD_EXITED','GUARD_FATAL','RENDERER_ERROR','UNIQUE_UI_REQUIRED','CONDITION_DEADLINE','RUN_NOT_BOUND','TERMINAL_MISMATCH','DRAFT_CHANGED','ATTACHMENT_CHANGED','QUEUE_CHANGED','RECOVERY_STARTED_RUN','UNEXPECTED_GATE','CLOSE_DEADLINE','OWNED_PROCESS_ALIVE','NOT_CONFIGURED','MODEL_NOT_BOUND','FINAL_FACTS_CHANGED','ARGS_INVALID','OWNED_PATH_REQUIRED','BASELINE_NOT_CHECKPOINTED','RESTORE_SELECTION_FORBIDDEN']);
export function safeDiagnostic(error,phase){
  const message=String(error?.message??''),stack=String(error?.stack||error);return {code:errorCodes.has(message)?message:'UNCLASSIFIED_QA_FAILURE',phase:['PREPARE','BOOT','SENTINEL','HOLD','STOPPING','FAIL','RETRY','DONE','CLOSE'].includes(phase)?phase:'UNKNOWN',hash:hash(stack),qaFrames:[...stack.replaceAll('\\','/').matchAll(/\/(scripts\/(?:acceptance\/ui-final-queue-recovery|ui-final-queue-recovery-live)\.mjs):(\d+):(\d+)/g)].slice(0,6).map(m=>({file:m[1],line:Number(m[2]),column:Number(m[3])}))};
}

export async function queueRecoveryJourney(api){
  const {page,until,query,check,phase,snapshot,nativeBytes,rememberDrafts,assertDrafts,fixture,shot,health}=api;
  const composer=()=>page.locator('.office-composer-container:visible'),input=()=>composer().getByTestId('office-prompt-input');
  const unique=async locator=>{need(await locator.count()===1&&await locator.isVisible()&&await locator.isEnabled(),'UNIQUE_UI_REQUIRED');return locator;};
  const click=async locator=>{await health();await(await unique(locator)).click();};
  const currentId=()=>composer().getAttribute('data-session-id');
  async function fresh(){const old=await currentId();await click(page.locator('[data-testid="pi-new-session"]:visible'));return until(async()=>{const id=await currentId();return id&&id!==old&&!await input().isDisabled()?id:false;});}
  const controls=id=>query('SELECT * FROM xiaozhi_pi_controls WHERE conversation_id=? AND kind=? ORDER BY rowid',[id,'instruction']).map(row=>({...JSON.parse(row.payload_json),state:row.state}));
  const card=id=>page.locator('[data-testid="pi-queued-instruction"][data-control-id="'+id+'"]:visible');
  const run=id=>query('SELECT id,session_id,status,prompt FROM ai_agent_runs WHERE id=?',[id])[0];
  async function send(id,prompt,next,total){await input().fill(prompt);await phase(next,total,id,prompt);await click(composer().getByRole('button',{name:'发送消息',exact:true}));
    return until(async()=>{const state=await snapshot(id),turn=state.projection.turns.at(-1);if(!turn||turn.id==='pending-send')return false;const row=run(turn.id);need(!row||row.session_id===id&&row.prompt===prompt,'RUN_NOT_BOUND');return row&&await input().inputValue()===''?row:false;});}
  async function terminal(id,row,status,sqlStatus){return until(async()=>{const state=await snapshot(id),turn=state.projection.turns.at(-1),saved=run(row.id);need(turn?.id===row.id&&saved?.session_id===id,'RUN_NOT_BOUND');if(state.running)return false;need(turn.status===status&&saved.status===sqlStatus,'TERMINAL_MISMATCH');return state;});}
  const marker='X01-'+api.random(),originalQueueText='待编辑指令 '+marker;let sentinel,selection,sentinelDraft,queueId,queueRun,first,second,protectedDraft,failedId,failedRun,retryRun;
  await check('UNRELATED_DRAFT_AND_ATTACHMENT_SENTINEL',async()=>{
    sentinel=await fresh();sentinelDraft='未发送保护草稿 '+marker;await input().fill(sentinelDraft);
    const picker=composer().locator('input[type="file"]');need(await picker.count()===1,'UNIQUE_UI_REQUIRED');await picker.setInputFiles(fixture);
    selection=await until(async()=>{const rows=query('SELECT * FROM xiaozhi_pi_attachments WHERE conversation_id=?',[sentinel]);return rows.length===1&&rows[0].state==='draft'&&await composer().getByTestId('pi-agent-attachment-'+rows[0].id).isVisible()?rows[0]:false;});
    need(selection.run_id===null&&selection.message_id===null,'ATTACHMENT_CHANGED');await rememberDrafts(sentinel,sentinelDraft);await shot('sentinel');
  });
  await check('QUEUE_IDS_REVISION_MODES_EDIT_WITHDRAW',async()=>{
    queueId=await fresh();queueRun=await send(queueId,'合成测试：请只确认收到，不调用工具。 '+marker,'HOLD',1);
    await until(async()=>{const g=await health();return g.requests.some(r=>r.phase==='HOLD'&&r.bound);});
    const enqueue=async(text,mode)=>{const before=controls(queueId).length;await(await unique(composer().getByTestId('pi-queue-mode'))).selectOption(mode);await input().fill(text);await click(composer().getByTestId('pi-queue-submit'));return until(async()=>{const rows=controls(queueId);need(rows.length<=before+1,'QUEUE_CHANGED');return rows.length===before+1&&await input().inputValue()===''?rows[before]:false;});};
    first=await enqueue(originalQueueText,'steer');second=await enqueue('待撤回指令 '+marker,'followUp');need(first.id!==second.id&&first.revision===0&&second.revision===0&&first.runId===queueRun.id&&second.runId===queueRun.id&&first.mode==='steer'&&second.mode==='followUp','QUEUE_CHANGED');
    await click(card(first.id).getByTestId('pi-instruction-edit'));const edited='编辑完成但不交付 '+marker;
    await card(first.id).getByTestId('pi-instruction-text').fill(edited);await card(first.id).getByTestId('pi-instruction-mode').selectOption('followUp');
    protectedDraft='排队操作之外的未发送草稿 '+marker;await input().fill(protectedDraft);await click(card(first.id).getByTestId('pi-instruction-save'));
    first=await until(async()=>{const row=controls(queueId).find(v=>v.id===first.id);return row?.revision===1?row:false;});need(first.text===edited&&first.mode==='followUp'&&first.state==='queued'&&await input().inputValue()===protectedDraft,'QUEUE_CHANGED');
    await click(card(second.id).getByTestId('pi-instruction-withdraw'));second=await until(async()=>{const row=controls(queueId).find(v=>v.id===second.id);return row?.state==='withdrawn'?row:false;});need(second.revision===1&&second.mode==='followUp'&&await input().inputValue()===protectedDraft,'QUEUE_CHANGED');
    const text=nativeBytes(queueId).toString('utf8');need(![originalQueueText,first.text,second.text].some(v=>text.includes(v)),'NATIVE_REPLAY');await rememberDrafts(queueId,protectedDraft);await shot('queue-edit-withdraw');
  });
  await check('STOP_BEFORE_WIRE_NO_REPLAY',async()=>{
    await phase('STOPPING',1,queueId);await click(composer().getByRole('button',{name:'停止本轮',exact:true}));await terminal(queueId,queueRun,'interrupted','blocked');
    const list=controls(queueId);need(list.length===2&&list.find(v=>v.id===first.id)?.state==='interrupted'&&list.find(v=>v.id===second.id)?.state==='withdrawn','QUEUE_CHANGED');
    for(const old of [first,second]){const saved=list.find(v=>v.id===old.id);need(['id','runId','sessionId','requestHash','text','mode','revision'].every(key=>saved[key]===old[key]),'QUEUE_CHANGED');}
    const guard=await health();need(guard.requests.length===1&&guard.requests[0].bound&&guard.requests[0].aborted&&!guard.requests[0].rejected,'RUN_NOT_BOUND');
    need(await input().inputValue()===protectedDraft,'DRAFT_CHANGED');const stable=nativeBytes(queueId);need(![originalQueueText,first.text,second.text].some(v=>stable.toString('utf8').includes(v)),'NATIVE_REPLAY');await api.observeStable(async()=>{need(!((await snapshot(queueId)).running),'NATIVE_REPLAY');need(nativeBytes(queueId).equals(stable),'NATIVE_REPLAY');});await assertDrafts();await shot('stopped');
  });
  await check('AFTER_ADMISSION_PREWIRE_FAILURE',async()=>{
    failedId=await fresh();const prompt='合成失败恢复测试：只确认收到。 '+marker;failedRun=await send(failedId,prompt,'FAIL',2);await terminal(failedId,failedRun,'failed','failed');need(await input().inputValue()==='','DRAFT_CHANGED');
    const g=await health();need(g.requests.filter(r=>r.phase==='FAIL'&&r.rejected&&r.runHash===hash(failedRun.id)).length===1,'RUN_NOT_BOUND');await shot('failed-after-admission');
  });
  await check('RECOVER_DRAFT_PROTECT_NONEMPTY_NO_AUTOSEND',async()=>{
    const retry=page.locator('[data-turn-id="'+failedRun.id+'"]:visible').getByTestId('office-turn-retry'),protectedText='不能被失败恢复覆盖的草稿 '+marker;
    await input().fill(protectedText);await click(retry);need(await input().inputValue()===protectedText,'DRAFT_CHANGED');await until(async()=>await page.getByTestId('pi-retry-hint').isVisible());
    await input().fill('');await click(retry);await until(async()=>await input().inputValue()===failedRun.prompt);
    await api.observeStable(async()=>{await health();need(await input().inputValue()===failedRun.prompt&&!((await snapshot(failedId)).running),'RECOVERY_STARTED_RUN');});await shot('recovered-unsent');
  });
  await check('ONE_EXPLICIT_RETRY_NO_AUTOMATIC_RETRY',async()=>{
    retryRun=await send(failedId,failedRun.prompt,'RETRY',3);need(retryRun.id!==failedRun.id,'RUN_NOT_BOUND');await terminal(failedId,retryRun,'failed','failed');
    const g=await health();need(g.attempts===3&&g.requests.every(v=>v.bound)&&g.requests.map(v=>v.phase).join(',')==='HOLD,FAIL,RETRY'&&g.requests[0].aborted&&g.requests[1].rejected&&g.requests[2].rejected,'RUN_NOT_BOUND');
    const stable=nativeBytes(failedId);await api.observeStable(async()=>{await health();need(nativeBytes(failedId).equals(stable),'NATIVE_REPLAY');});await assertDrafts();await shot('explicit-retry-failed');
  });
  await check('UNRELATED_DRAFT_SELECTION_AND_OBSERVED_FACTS_RETAINED',async()=>{
    const navigation=page.locator('[data-testid="edu-navigation"]:visible');need(await navigation.count()===1,'UNIQUE_UI_REQUIRED');if(await navigation.getAttribute('data-collapsed')==='true')await click(navigation.getByTestId('workbench-sidebar-toggle'));
    await click(navigation.getByTestId('workbench-session-'+sentinel));await until(async()=>await currentId()===sentinel&&!await input().isDisabled());need(await input().inputValue()===sentinelDraft,'DRAFT_CHANGED');
    const rows=query('SELECT * FROM xiaozhi_pi_attachments WHERE conversation_id=?',[sentinel]);need(rows.length===1&&hash(rows[0])===hash(selection),'ATTACHMENT_CHANGED');need(await composer().getByTestId('pi-agent-attachment-'+selection.id).isVisible(),'ATTACHMENT_CHANGED');need((await snapshot(sentinel)).projection.turns.length===0,'RECOVERY_STARTED_RUN');await assertDrafts();await shot('sentinel-retained');
  });
  return {sessions:[sentinel,queueId,failedId].map(hash),runIds:[queueRun,failedRun,retryRun].map(row=>hash(row.id)),terminalContract:['blocked/interrupted','failed/failed','failed/failed'],attachmentSelectionHash:hash(selection)};
}

export async function selfTest(){
  const vm=await import('node:vm'),checks=[];const test=async(code,work)=>{await work();checks.push({code,status:'PASS'});};
  function lab(){const hooks={},session={defaultSession:{webRequest:{onBeforeRequest:fn=>hooks.before=fn}}},events={},native={calls:0};const net={fetch:async()=>{native.calls++;throw Error('native must not run');}};
    const context=vm.createContext({URL,Request,Buffer,Date,setTimeout,clearTimeout,process:{getBuiltinModule:process.getBuiltinModule}});
    vm.runInContext('('+installQueueRecoveryGuard.toString()+')',context)({app:{on:(name,fn)=>events[name]=fn},net,session},{model:'official-test',deadlineAt:Date.now()+1000});
    const control=input=>vm.runInContext('('+queueRecoveryControl.toString()+')',context)({BrowserWindow:{getAllWindows:()=>[{webContents:{id:1}}]}},input);
    const request=(signal)=>net.fetch('https://api.deepseek.com/v1/chat/completions',{method:'POST',signal,body:JSON.stringify({model:'official-test',stream:true,messages:[{role:'user',content:'synthetic private fixture'}]})});
    const bind=n=>control({observedRuns:n,bind:{runHash:String(n).repeat(64),sessionHash:'a'.repeat(64)}});return {hooks,session,events,net,context,control,request,bind,native};}
  await test('HOLD_ABORT_AND_NO_NATIVE_CALL',async()=>{const l=lab(),abort=new AbortController();l.control({phase:'HOLD',expectedRuns:1});const pending=l.request(abort.signal);const outcome=assert.rejects(pending);l.bind(1);await new Promise(r=>setTimeout(r,0));l.control({phase:'STOPPING'});abort.abort();await outcome;assert.equal(l.native.calls,0);assert(l.control().requests[0].bound&&l.control().requests[0].aborted);});
  await test('CONTROLLED_REJECT_EXPLICIT_RETRY_MAX_THREE',async()=>{const l=lab(),abort=new AbortController();l.control({phase:'HOLD',expectedRuns:1});const p=assert.rejects(l.request(abort.signal));l.bind(1);await new Promise(r=>setTimeout(r,0));l.control({phase:'STOPPING'});abort.abort();await p;for(const [phase,n]of [['FAIL',2],['RETRY',3]]){l.control({phase,expectedRuns:n});const failure=assert.rejects(l.request(new AbortController().signal),/X01_PREWIRE_CONTROLLED_REJECTION/);l.bind(n);await failure;}assert.equal(l.control().attempts,3);assert.equal(l.native.calls,0);assert.throws(()=>l.control({expectedRuns:4}),/RUN_BUDGET_EXHAUSTED/);});
  await test('AUTOMATIC_RETRY_FAILS_CLOSED',async()=>{const l=lab(),abort=new AbortController();l.control({phase:'HOLD',expectedRuns:1});const p=assert.rejects(l.request(abort.signal));l.bind(1);await new Promise(r=>setTimeout(r,0));await assert.rejects(l.request(new AbortController().signal),/AUTOMATIC_RETRY_OR_BUDGET/);abort.abort();await p;assert.equal(l.native.calls,0);});
  await test('UNEXPECTED_SQL_ADMISSION_LATCH',async()=>{const l=lab();assert.throws(()=>l.control({observedRuns:1}),/UNEXPECTED_ADMISSION/);assert.equal(l.control().fatal,'UNEXPECTED_ADMISSION');});
  await test('CATALOGUE_AND_GLOBAL_FETCH_NEVER_WIRE',async()=>{for(const global of [false,true]){const l=lab();await assert.rejects(global?l.context.fetch('https://api.deepseek.com/v1/models'):l.net.fetch('https://api.deepseek.com/v1/models'),/NETWORK_SCOPE_REJECTED|UNMETERED_FETCH_BLOCKED/);assert.equal(l.native.calls,0);}});
  await test('FORMAL_FRAME_POLICY_AND_NETWORK_COMPOSE',async()=>{const l=lab();l.session.defaultSession.webRequest.onBeforeRequest((r,done)=>done({cancel:r.resourceType==='subFrame'}));assert.equal(l.control({verifyNetwork:true}).networkProof,'FORMAL_FRAME_AND_ZERO_WIRE');let result;l.hooks.before({url:'https://example.invalid'},v=>result=v);assert(result.cancel);assert.equal(l.control().nativeEscapeAttempts,1);assert.equal(l.control().nativeWire,0);});
  await test('CATALOGUE_BYTES_PROVENANCE_AND_STALENESS',async()=>{const value={version:1,endpoint:'https://api.deepseek.com/v1/models',observedAt:new Date().toISOString(),models:[{id:'official-test',source:'official',observedAt:new Date().toISOString(),contextWindow:8192,maxOutputTokens:4096,inputModalities:['text'],effort:{supportedLevels:['low']}}]};value.models[0].observedAt=value.observedAt;const bytes=Buffer.from(JSON.stringify(value));assert.equal(validateCatalogue(bytes,'official-test').sha256,hash(bytes));assert.throws(()=>validateCatalogue(bytes,'official-test',Date.now()+86400001),/CATALOGUE_REFRESH_REQUIRED_NOT_RUN/);value.models[0].source='synthetic';assert.throws(()=>validateCatalogue(Buffer.from(JSON.stringify(value)),'official-test'),/CATALOGUE_NOT_OFFICIAL/);});
  await test('OLD_ROWS_AND_NATIVE_CANNOT_BE_REWRITTEN',async()=>{const before={records:{t:{keys:['id'],rows:[{id:'old',text:'unchanged',revision:1}]}}};assertRetained(before,{records:{t:{rows:[...before.records.t.rows,{id:'new'}]}}});assert.throws(()=>assertRetained(before,{records:{t:{rows:[{id:'old',text:'changed',revision:1}]}}}),/OBSERVED_FACT_CHANGED/);assert.throws(()=>assertNativeRetained([{sessionHash:'a',file:'x',sha256:'a'}],[{sessionHash:'a',file:'x',sha256:'b'}]),/NATIVE_REPLAY/);});
  await test('ACTIVE_BASELINE_FAILS_CLOSED',async()=>{const make=()=>({records:Object.fromEntries(tables.map(table=>[table,{rows:[]}]))});assertQuiescent(make());for(const [table,row]of [['ai_agent_runs',{status:'running'}],['xiaozhi_pi_commands',{status:'pending'}],['ai_confirmation_items',{status:'pending'}],['xiaozhi_pi_controls',{state:'queued'}],['xiaozhi_pi_attachment_imports',{state:'staging'}]]){const f=make();f.records[table].rows.push(row);assert.throws(()=>assertQuiescent(f),/BASELINE_/);}});
  await test('AFTER_CLOSE_EXTRA_RUN_TERMINAL_ATTACHMENT_NATIVE_DRIFT_REJECTED',async()=>{const before={newRuns:['blocked','failed','failed'].map((status,i)=>({id:String(i),session_id:'owned',prompt:'synthetic',status})),ledger:{attachments:{sha256:'before'},controls:{sha256:'before'}},native:[{sha256:'before'}]};assertFinalSnapshot(before,structuredClone(before));for(const mutate of [a=>a.newRuns.push({...a.newRuns[2],id:'fourth'}),a=>a.newRuns[0].status='succeeded',a=>a.newRuns[1].session_id='foreign',a=>a.ledger.attachments.sha256='changed',a=>a.ledger.controls.sha256='changed',a=>a.native[0].sha256='changed']){const after=structuredClone(before);mutate(after);assert.throws(()=>assertFinalSnapshot(before,after),/FINAL_FACTS_CHANGED/);}});
  await test('DIAGNOSTICS_DO_NOT_PUBLISH_PRIVATE_CONTENT',async()=>{const d=safeDiagnostic(Error('private key https://secret.invalid'),'private phase');assert.equal(d.code,'UNCLASSIFIED_QA_FAILURE');assert(!JSON.stringify(d).includes('secret'));assert.equal(d.phase,'UNKNOWN');});
  return {code:'X01_PREPARATION_SELF_TEST_PASS',checks,electronLaunches:0,nativeWire:0,actualAcceptance:false};
}
