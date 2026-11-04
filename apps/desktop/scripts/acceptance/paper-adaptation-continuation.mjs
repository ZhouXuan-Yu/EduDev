/** QA observations only. No business write API/SQL and no Electron import. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';

export const digest=value=>createHash('sha256').update(typeof value==='string'||Buffer.isBuffer(value)?value:JSON.stringify(value)).digest('hex');
/** Live historical evidence only: skip the two owned mutable roots BEFORE
 * recursion/read. Full original/archive fingerprints remain separate gates. */
export function continuationImmutableInventory(root){
  const files=[];
  function walk(directory,isRoot=false){
    for(const entry of fs.readdirSync(directory,{withFileTypes:true}).sort((a,b)=>a.name.localeCompare(b.name))){
      if(isRoot&&['data','profile'].includes(entry.name)){
        assert(entry.isDirectory()&&!entry.isSymbolicLink(),'Mutable evidence root must remain a directory');continue;
      }
      const absolute=path.join(directory,entry.name);
      assert(!entry.isSymbolicLink(),'Immutable evidence must not contain symlinks');
      if(entry.isDirectory())walk(absolute);
      else{assert(entry.isFile(),'Unsupported immutable evidence entry');files.push({file:path.relative(root,absolute).replaceAll('\\','/'),sha256:digest(fs.readFileSync(absolute))});}
    }
  }
  walk(root,true);assert(files.length,'Empty immutable evidence inventory');
  return {sha256:digest(files),files};
}
/** Serializable diagnostic: static codes/phases and allowlisted QA locations only.
 * Never copy an error message, assertion values, provider data or a raw stack. */
export function continuationDiagnostic(error,phase='PREFLIGHT'){
  const phases=['PREFLIGHT','ARCHIVE','BOOTSTRAP_WRITE','LAUNCH','LAUNCH_RETURNED','MAIN_IDENTITY','STORAGE_PATH','GUARD_POLICY','WINDOW_READY','COLD_TERMINAL','BASKET_READBACK','ACCEPTED_REVIEW','FINAL_GUARD','CLOSE','FINAL_SAVED_INTEGRITY','FINAL_GUARD_INTEGRITY','DONE','BOOTSTRAP_PROFILE_BIND','BOOTSTRAP_WAIT_READY','BOOTSTRAP_INSTALL_GUARD','BOOTSTRAP_MAIN_IMPORT','BOOTSTRAP_MAIN_IMPORTED'];
  const message=String(error?.message||''),stack=String(error?.stack||error),names=['Error','AssertionError','TypeError','ReferenceError','SyntaxError','TimeoutError','RangeError'];
  const messages=[['BOOTSTRAP_READY_DEADLINE','BOOTSTRAP_READY_DEADLINE'],['BOOTSTRAP_FAILED','BOOTSTRAP_FAILED'],['Main module inventory unavailable','MAIN_INVENTORY_UNAVAILABLE'],['NO_ZERO_MODEL_GUARD','ZERO_MODEL_GUARD_MISSING'],['NETWORK_POLICIES_NOT_COMPOSED','NETWORK_POLICY_COMPOSITION_FAILED'],['ASYNC_NETWORK_POLICY','NETWORK_POLICY_ASYNC'],['UNSUPPORTED_NETWORK_REGISTRATION','NETWORK_REGISTRATION_UNSUPPORTED'],['CONTINUATION_NETWORK_DENIED','NETWORK_DENIED'],['Owned defaultSession partition','PROFILE_STORAGE_MISMATCH'],['Electron preferences must use the owned profile','PROFILE_USER_DATA_MISMATCH'],['Chromium data must use the owned profile','PROFILE_SESSION_DATA_MISMATCH'],['ZERO network attempts','NETWORK_ATTEMPT_DETECTED'],['ZERO model attempts','MODEL_ATTEMPT_DETECTED'],['Early renderer error latched','EARLY_RENDERER_ERROR'],['Runtime error latched','RUNTIME_ERROR_LATCHED'],['No ledger row may change','LEDGER_CHANGED'],['No native session replay','NATIVE_SESSION_CHANGED'],['Historical archive changed','ARCHIVE_CHANGED'],['Historical evidence changed or added','ORIGINAL_EVIDENCE_CHANGED'],['Final guard observation unavailable','FINAL_GUARD_OBSERVATION_FAILED'],['Target page, context or browser has been closed','ELECTRON_TARGET_CLOSED'],['Target closed','ELECTRON_TARGET_CLOSED']];
  const files=['scripts/acceptance/build-root.mjs','scripts/acceptance/evidence.mjs','scripts/acceptance/paper-adaptation-continuation.mjs','scripts/acceptance/paper-adaptation-live-ui.mjs','scripts/acceptance/paper-basket-ui-driver.mjs','scripts/acceptance/paper-basket-ui-locators.mjs','scripts/acceptance/paper-instance-ui-driver.mjs','scripts/acceptance/paper-instance-ui-wait.mjs','scripts/product-navigation.mjs','scripts/ui-final-paper-adaptation-continuation-live.mjs','scripts/xiaozhi-agent/capture-workspace-metrics.mjs'];
  const qaFrames=[],normalized=stack.replaceAll('\\','/');
  for(const match of normalized.matchAll(/(?:\/|^)(scripts\/[A-Za-z0-9_./-]+\.mjs):(\d+):(\d+)/g))if(files.includes(match[1])&&qaFrames.length<8)qaFrames.push({file:match[1],line:Number(match[2]),column:Number(match[3])});
  for(const match of normalized.matchAll(/\/ui-final-paper-adaptation-continuation-[A-Za-z0-9]+\/owned-bootstrap\.cjs:(\d+):(\d+)/g))if(qaFrames.length<8)qaFrames.push({file:'owned-bootstrap.cjs',line:Number(match[1]),column:Number(match[2])});
  const fixed=['FINAL_GUARD_DEADLINE','FINAL_CLOSE_DEADLINE','GLOBAL_UI_DEADLINE','BOOTSTRAP_CHILD_EXITED','BOOTSTRAP_STATE_REDIRECTED','BOOTSTRAP_STATE_INVALID'];
  const protocol=[['Resulting promise was garbage collected.','CDP_PROMISE_COLLECTED'],['Promise was collected','CDP_PROMISE_COLLECTED'],['Execution context was destroyed, most likely because of a navigation.','CDP_EXECUTION_CONTEXT_DESTROYED'],['JSHandle is disposed!','CDP_HANDLE_DISPOSED'],['JSHandles can be evaluated only in the context they were created!','CDP_HANDLE_CONTEXT_MISMATCH'],['Cannot serialize result: object reference chain is too long.','CDP_SERIALIZATION_LIMIT']];
  const systemCodes=['EPERM','EACCES','EBUSY','EEXIST','ENOENT','EIO','ENOSPC'],system=systemCodes.includes(error?.code)?{systemCode:error.code,...(['open','write','rename','lstat','stat','read','realpath'].includes(error?.syscall)?{syscall:error.syscall}:{})}:{};
  const code=error?.code==='SQLITE_BUSY'||error?.errcode===5?'SQLITE_BUSY':system.systemCode?'FILESYSTEM_OPERATION_FAILED':fixed.includes(message)?message:message==='Owned application close not verified'?'OWNED_CLOSE_UNVERIFIED':protocol.find(([text])=>message===text||message==='electronApplication.evaluate: '+text)?.[1]||messages.find(([text])=>message.includes(text))?.[1]||'CONTINUATION_UNCLASSIFIED_ERROR';
  return {code,name:names.includes(error?.name)?error.name:'Error',phase:phases.includes(phase)?phase:'UNKNOWN',qaFrames,...system,hash:process.getBuiltinModule('crypto').createHash('sha256').update(stack).digest('hex')};
}
export function adaptationObservation(result,onBusy=()=>{}){
  if(result?.ok===false&&result.error==='busy'){onBusy();return undefined;}
  assert.equal(result?.ok,true,'Read-only exact intent failed: '+(result?.error||'invalid_response'));
  return result.value;
}
export async function readAdaptationObservation(page,reference,onBusy){
  return adaptationObservation(await page.evaluate(input=>window.omniEdu.readPaperBasketAdaptation(input),reference),onBusy);
}

export function ownedExact(file,root){
  const absolute=path.resolve(file),real=fs.realpathSync(absolute),relative=path.relative(root,real);
  assert.equal(real,absolute,'No redirected evidence path');
  assert(relative&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep),'Owned evidence required');return real;
}
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
export const pinned=e=>JSON.parse(JSON.stringify({entryId:e.entryId,questionId:e.questionId,contentVersion:e.contentVersion,sectionId:e.sectionId,position:e.position,instance:e.instance,question:e.question,generation:e.generation}));
const points=(b,e)=>b.c2?.entryPoints[e.entryId]??b.blueprint.sections.find(s=>s.id===e.sectionId)?.points;

export function verifyOldGate(root,kind,pins){
  assert(['edit','review'].includes(kind));
  const requestFile=ownedExact(path.join(root,`paper-adaptation-${kind}.request.json`),root);
  const receiptFile=ownedExact(path.join(root,`paper-adaptation-${kind}.receipt.json`),root);
  assert(fs.statSync(requestFile).size<=131072&&fs.statSync(receiptFile).size<=20000);
  const request=json(requestFile),receipt=json(receiptFile),{digest:requestDigest,...unsigned}=request;
  assert.equal(request.schemaVersion,`xiaozhi.qa.paper-adaptation-${kind}-request.v1`);
  assert.equal(receipt.schemaVersion,`xiaozhi.qa.paper-adaptation-${kind}-receipt.v1`);
  assert.equal(digest(unsigned),requestDigest,'Original request digest');
  assert.equal(receipt.requestId,request.requestId);assert.equal(receipt.digest,requestDigest);
  assert.deepEqual(request.pins,{build:pins.build,source:pins.source});
  assert(['human','parent_qa'].includes(receipt.reviewerType));
  assert(typeof receipt.reviewer==='string'&&receipt.reviewer.trim()&&receipt.reviewer.length<=200);
  assert(typeof receipt.rationale==='string'&&receipt.rationale.trim().length>=8&&receipt.rationale.length<=4000);
  const created=Date.parse(request.createdAt),reviewed=Date.parse(receipt.reviewedAt);
  assert(Number.isFinite(created)&&Number.isFinite(reviewed)&&reviewed>=created&&reviewed<=Date.now()+5000);
  const screenshot=ownedExact(request.screenshot,root);
  assert.equal(screenshot,path.join(root,kind==='edit'?'paper-adaptation-before-edit.png':'paper-adaptation-real-comparison.png'));
  assert.equal(digest(fs.readFileSync(screenshot)),request.screenshotSha256);
  if(kind==='review'){
    assert.equal(receipt.decision,'approve');assert.equal(receipt.reviewed,true);
    const checks=['parentLineage','requirements','stemAndOptions','uniqueAnswer','analysis'];
    assert.deepEqual(request.requiredChecks,checks);for(const key of checks)assert.equal(receipt.checks?.[key],true);
    for(const key of ['requirements','draft','quality','original'])assert.equal(digest(request[key]),request[key+'Sha256']);
  }else{
    assert.equal(receipt.decision,'edit');assert.deepEqual(Object.keys(receipt.edits).sort(),['analysis','itemIndex']);
    assert.equal(receipt.edits.itemIndex,0);assert(typeof receipt.edits.analysis==='string'&&receipt.edits.analysis.trim()&&receipt.edits.analysis.length<=12000);
    assert.notEqual(receipt.edits.analysis,request.draft.items[0].analysis);
  }
  return {request,receipt,evidence:{kind,requestHash:digest(fs.readFileSync(requestFile)),receiptHash:digest(fs.readFileSync(receiptFile)),digest:requestDigest,screenshotHash:request.screenshotSha256,reviewerType:receipt.reviewerType,reviewedAt:receipt.reviewedAt}};
}

export const continuationTables=Object.freeze(['ai_agent_runs','ai_agent_run_requests','ai_agent_run_actions','ai_agent_events','xiaozhi_event_journal',
  'xiaozhi_pi_commands','xiaozhi_pi_usage','xiaozhi_tool_receipts','xiaozhi_pi_controls','xiaozhi_pi_session_bindings',
  'ai_confirmation_items','ai_conversation_messages','question_bank_items','paper_baskets','paper_basket_operations']);

export function readContinuationFacts({original,baseline,pins}){
  const old=json(path.join(original,'report.json')),first=json(path.join(original,'paper-adaptation-live-report.json'));
  assert.equal(old.success,false);assert.equal(first.success,false);assert.equal(old.error.message,'Read-only exact intent');
  assert.match(first.error,/paper-adaptation-live-ui\.mjs:216:/);assert.equal(old.integrityVerified,true);
  assert.equal(first.modelSubmissions,1);assert.equal(first.retries,0);assert.equal(old.launchAttempts,1);
  for(const key of ['source','build'])assert.equal(old.pins[key],pins[key]);
  const edit=verifyOldGate(original,'edit',pins),review=verifyOldGate(original,'review',pins);
  assert.equal(old.teacherEditGate.status,'teacher-edit');assert.equal(old.teacherEditGate.digest,edit.evidence.digest);
  assert.equal(old.reviewGate.status,'external-approved');assert.equal(old.reviewGate.digest,review.evidence.digest);assert.equal(old.reviewGate.receiptSha256,review.evidence.receiptHash);
  for(const [gate,name]of [[edit,'teacherEditGate'],[review,'reviewGate']]){
    assert.equal(path.resolve(old[name].request),path.join(original,`paper-adaptation-${gate.evidence.kind}.request.json`));
    assert.equal(path.resolve(old[name].receipt),path.join(original,`paper-adaptation-${gate.evidence.kind}.receipt.json`));
    assert.equal(gate.request.runId,first.runId);assert.equal(gate.request.candidateId,first.wrongCandidate.visibleIds[0]);
    assert.equal(gate.request.requirements,review.request.requirements);assert.deepEqual(gate.request.original,review.request.original);
    assert.deepEqual(Object.fromEntries(Object.keys(first.before.target.question).map(k=>[k,gate.request.original[k]])),first.before.target.question);
  }
  const edited=structuredClone(edit.request.draft);edited.items[0].analysis=edit.receipt.edits.analysis;
  assert.deepEqual(edited,review.request.draft,'Final approved version must be exactly the explicit old teacher edit');
  assert.deepEqual(first.teacherEdit,{field:'analysis',before:edit.request.draft.items[0].analysis,after:edit.receipt.edits.analysis,via:'original visible UI'});
  const db=new DatabaseSync(ownedExact(path.join(original,'data/app.db'),original),{readOnly:true});
  const base=new DatabaseSync(path.join(baseline,'data/app.db'),{readOnly:true});
  try{
    db.exec('PRAGMA query_only=ON; BEGIN;');base.exec('PRAGMA query_only=ON; BEGIN;');
    const q=(sql,args=[])=>db.prepare(sql).all(...args),one=(sql,args=[])=>{const rows=q(sql,args);assert.equal(rows.length,1);return rows[0];};
    assert.equal(q("SELECT id FROM ai_agent_runs WHERE status IS NULL OR status NOT IN ('succeeded','failed','blocked','cancelled','interrupted')").length,0,'Any active/pending/unknown run rejects continuation');
    assert.equal(q("SELECT command_id FROM xiaozhi_pi_commands WHERE status IS NULL OR status NOT IN ('finished','interrupted')").length,0,'Pending command rejects continuation');
    assert.equal(q("SELECT id FROM ai_confirmation_items WHERE status IS NULL OR status NOT IN ('confirmed','rejected')").length,0,'Pending approval rejects continuation');
    assert.equal(q("SELECT id FROM xiaozhi_pi_controls WHERE state IS NULL OR state NOT IN ('answered','withdrawn','applied','interrupted')").length,0,'Pending/unknown control rejects continuation');
    const run=one('SELECT * FROM ai_agent_runs WHERE id=? AND session_id=?',[first.runId,first.sessionId]);assert.equal(run.status,'succeeded');
    assert.equal(q('SELECT id FROM ai_agent_runs WHERE session_id=?',[first.sessionId]).length,1);
    const candidate=one('SELECT * FROM ai_confirmation_items WHERE id=? AND session_id=?',[review.request.candidateId,first.sessionId]);
    assert.equal(candidate.status,'confirmed');assert.equal(candidate.run_id,first.runId);assert.equal(candidate.action_type,'pi_question_candidate');
    const effect=JSON.parse(candidate.result_json),payload=JSON.parse(candidate.payload_json);assert.equal(effect.teacherReviewed,true);
    assert.deepEqual(effect.draft,review.request.draft);assert.deepEqual(effect.quality,review.request.quality);assert.equal(effect.quality.state,'manual_review');
    assert(Date.parse(candidate.confirmed_at)>=Date.parse(review.receipt.reviewedAt));
    assert(effect.qualityHistory.some(h=>digest(h.draft)===digest(effect.draft)&&digest(h.quality)===digest(effect.quality)));
    const operation=one("SELECT * FROM paper_basket_operations WHERE session_id=? AND request_id=? AND operation_kind='domain:adaptation-prepare'",[first.sessionId,first.intentId]);
    const record=JSON.parse(operation.adaptation_json),i=record.input;assert.equal(record.status,'accepted');assert.equal(record.runId,first.runId);assert.equal(run.prompt,record.prompt);
    assert.equal(i.sessionId,first.sessionId);assert.equal(i.basketId,first.basketId);assert.equal(i.entryId,first.before.target.entryId);
    assert.equal(i.studentId,String(run.student_id||''));assert.equal(candidate.student_id,i.studentId);assert.equal(operation.student_id,i.studentId);
    assert.equal(one('SELECT student_id FROM ai_conversation_sessions WHERE id=?',[first.sessionId]).student_id??'',i.studentId);
    assert.equal(i.requirements,review.request.requirements);assert.equal(i.intent,'replace');assert.equal(i.expectedBasketRevision,first.before.revision);
    assert.equal(i.parentQuestionId,first.before.target.questionId);assert.equal(i.parentSourceVersion,first.before.target.contentVersion);assert.equal(i.instanceRevision,first.before.target.instance.instanceRevision);
    assert.deepEqual(record.original,pinned(first.before.target));assert.equal(payload.sources.length,1);assert.deepEqual(payload.sources[0],first.before.target.question);
    const accept=one("SELECT * FROM paper_basket_operations WHERE session_id=? AND basket_id=? AND operation_kind='domain:adaptation-accept'",[first.sessionId,first.basketId]);
    assert.deepEqual(JSON.parse(accept.adaptation_json),record.receipt);assert.equal(accept.request_id,record.receipt.requestId);assert.equal(accept.student_id,i.studentId);
    assert.equal(record.receipt.intentId,first.intentId);assert.equal(record.receipt.candidateId,candidate.id);assert.equal(record.receipt.intent,'replace');
    assert.deepEqual(effect.saved,[{schemaVersion:'xiaozhi.education.question-context.v1',questionId:record.receipt.questionId,version:record.receipt.sourceVersion}]);
    const b=one('SELECT * FROM paper_baskets WHERE id=? AND session_id=?',[first.basketId,first.sessionId]),basket=JSON.parse(b.data_json);
    assert.equal(b.state,'active');assert.equal(b.revision,first.before.revision+1);assert.equal(b.revision,record.receipt.basketRevision);assert.equal(accept.result_revision,b.revision);
    assert.equal(basket.entries.length,2);assert.deepEqual(basket.entries.map(e=>e.entryId).sort(),[first.before.target.entryId,first.before.unchosen.entryId].sort());
    const target=basket.entries.find(e=>e.entryId===i.entryId),unchosen=basket.entries.find(e=>e.entryId===first.before.unchosen.entryId);
    assert.deepEqual(pinned(unchosen),pinned(first.before.unchosen));assert.equal(target.position,first.before.target.position);assert.equal(target.sectionId,first.before.target.sectionId);assert.equal(points(basket,target),first.before.targetPoints);
    assert.equal(target.questionId,record.receipt.questionId);assert.notEqual(target.questionId,i.parentQuestionId);assert.equal(target.contentVersion,record.receipt.sourceVersion);
    assert.equal(target.instance.instanceRevision,i.instanceRevision+1);assert.equal(target.instance.sourceBinding.questionId,target.questionId);assert.equal(target.instance.sourceBinding.sourceVersion,target.contentVersion);
    assert.equal(target.generation.groupId,candidate.id);assert.equal(target.generation.effectDigest,effect.digest);assert.equal(target.generation.generationKind,'variation');assert.deepEqual(target.instance.sourceBinding.generation,target.generation);
    const bank=q('SELECT * FROM question_bank_items ORDER BY id'),originals=base.prepare('SELECT * FROM question_bank_items ORDER BY id').all();assert.equal(originals.length,20);
    const now=new Map(bank.map(row=>[row.id,digest(row)]));for(const row of originals)assert.equal(now.get(row.id),digest(row),'Every old bank row unchanged');assert.equal(bank.length,originals.length+1);
    const saved=one('SELECT * FROM question_bank_items WHERE id=?',[target.questionId]);
    assert.equal(saved.answer,effect.draft.items[0].answer);assert.equal(saved.analysis,effect.draft.items[0].analysis);assert.equal(saved.source_kind,'generated');
    const ledger={};
    for(const table of continuationTables){
      const keys=q('PRAGMA table_info('+table+')').filter(c=>c.pk).sort((a,b)=>a.pk-b.pk).map(c=>'"'+c.name+'"');
      assert(q("SELECT name FROM sqlite_master WHERE type='table' AND name=?",[table]).length===1,'Required ledger table');
      const rows=q('SELECT * FROM '+table+' ORDER BY '+(keys.length?keys.join(','):'rowid'));
      ledger[table]={count:rows.length,sha256:digest(rows)};
    }
    const native=q('SELECT conversation_id,session_file FROM xiaozhi_pi_session_bindings ORDER BY conversation_id').map(row=>{
      const file=ownedExact(path.resolve(original,'data/xiaozhi-pi',row.session_file),path.join(original,'data/xiaozhi-pi'));
      return {sessionHash:digest(row.conversation_id),file:path.relative(original,file),sha256:digest(fs.readFileSync(file))};
    });assert(native.some(row=>row.sessionHash===digest(first.sessionId)));
    return {first,old,record,effect,basket:{...basket,id:b.id,sessionId:b.session_id,revision:b.revision,state:b.state},target,unchosen,ledger,native,
      reference:{schemaVersion:'xiaozhi.paper-basket-adaptation.v1',sessionId:first.sessionId,studentId:i.studentId,basketId:first.basketId,intentId:first.intentId},
      evidence:{gates:[edit.evidence,review.evidence],firstFailure:{success:false,error:old.error,stackHash:digest(first.error),reportHash:digest(fs.readFileSync(path.join(original,'report.json'))),journeyReportHash:digest(fs.readFileSync(path.join(original,'paper-adaptation-live-report.json')))},
        runId:first.runId,candidateId:candidate.id,intentId:first.intentId,basketId:first.basketId,runStatus:run.status,candidateStatus:candidate.status,intentStatus:record.status,receipt:record.receipt,approvedDraftHash:digest(effect.draft),qualityRevision:effect.quality.revisionHash,effectDigest:effect.digest,originalBankCount:20,oldRowsUnchanged:true,acceptReceipts:1}};
  }finally{db.close();base.close();}
}

/** Serialized before formal main import. Meters attempts, permits ZERO HTTP. */
export function installContinuationNoModel({app,net,session}){
  const state={networkAttempts:0,modelAttempts:0,rendererErrors:0,formalRegistrations:0},web=session.defaultSession.webRequest,register=web.onBeforeRequest.bind(web);
  const crypto=process.getBuiltinModule('crypto'),hash=value=>crypto.createHash('sha256').update(String(value)).digest('hex');
  state.events=[];let formal;
  const rendererError=(code,value)=>{state.rendererErrors++;if(state.events.length<32)state.events.push({code,hash:hash(value)});};
  // Attach before formal main creates its first webContents; late Playwright listeners
  // alone cannot observe errors emitted during loadFile/preload.
  app?.on('web-contents-created',(_event,contents)=>{
    contents.on('console-message',(details,level,message)=>{const modern=typeof details?.level==='string';if(modern?details.level==='error':level===3)rendererError('EARLY_CONSOLE_ERROR',modern?details.message:message);});
    contents.on('preload-error',(_e,_file,error)=>rendererError('PRELOAD_ERROR',error));
    contents.on('render-process-gone',(_e,details)=>{if(details.reason!=='clean-exit')rendererError('RENDER_PROCESS_GONE',details.reason);});
  });
  const attempt=(code,value)=>{state.networkAttempts++;if(code==='MODEL_ATTEMPT_BLOCKED')state.modelAttempts++;if(state.events.length<32)state.events.push({code,hash:hash(value)});};
  const block=async(input,init={})=>{const url=typeof input==='string'?input:input instanceof URL?input.href:input.url;attempt(/chat\/completions/.test(url)?'MODEL_ATTEMPT_BLOCKED':'NETWORK_ATTEMPT_BLOCKED',url);throw Error('CONTINUATION_NETWORK_DENIED');};
  net.fetch=block;globalThis.fetch=block;
  const combined=(details,callback,probe=false)=>{
    if(/^https?:/.test(details.url)){if(!probe)attempt(/chat\/completions/.test(details.url)?'MODEL_ATTEMPT_BLOCKED':'NETWORK_ATTEMPT_BLOCKED',details.url);callback({cancel:true});return;}
    if(formal)formal(details,callback);else callback({cancel:false});
  };
  web.onBeforeRequest=(...args)=>{if(args.length!==1||(args[0]!==null&&typeof args[0]!=='function'))throw Error('UNSUPPORTED_NETWORK_REGISTRATION');formal=args[0];if(formal)state.formalRegistrations++;register(combined);};register(combined);
  globalThis.__paperContinuationGuard={state,combined};
}
export function continuationGuardRead({BrowserWindow},verify=false){
  const guard=globalThis.__paperContinuationGuard;if(!guard)throw Error('NO_ZERO_MODEL_GUARD');
  if(verify){
    const id=BrowserWindow.getAllWindows()[0].webContents.id;
    const probe=(url,resourceType)=>{let response;guard.combined({url,resourceType,webContentsId:id,method:'GET'},v=>response=v,true);if(!response)throw Error('ASYNC_NETWORK_POLICY');return response.cancel===true;};
    if(!guard.state.formalRegistrations||!probe('https://example.invalid/blocked','mainFrame')||!probe('file:///owned-child.html','subFrame')||probe('file:///owned-main.html','mainFrame'))throw Error('NETWORK_POLICIES_NOT_COMPOSED');
    guard.state.policyProbe='FORMAL_FRAME_AND_ZERO_HTTP_VERIFIED';
  }
  return JSON.parse(JSON.stringify(guard.state));
}

/** Publish one terminal snapshot to a previously absent target. No replacement
 * of a file a parent reader may hold open. Failure has its own immutable target. */
export function publishContinuationBootstrap(fs,path,file,state){
  const target=path.resolve(file),parent=path.dirname(target);
  assert.equal(target,file,'BOOTSTRAP_STATE_REDIRECTED');
  assert.equal(fs.realpathSync(parent),parent,'BOOTSTRAP_STATE_REDIRECTED');
  const directory=fs.lstatSync(parent);assert(directory.isDirectory()&&!directory.isSymbolicLink(),'BOOTSTRAP_STATE_REDIRECTED');
  for(const name of [target,target+'.tmp']){
    try{fs.lstatSync(name);}catch(error){if(error.code==='ENOENT')continue;throw error;}
    throw Error('BOOTSTRAP_STATE_EXISTS');
  }
  const bytes=JSON.stringify(state);assert(Buffer.byteLength(bytes)<=65536,'BOOTSTRAP_STATE_INVALID');
  fs.writeFileSync(target+'.tmp',bytes,{flag:'wx',mode:0o600});
  const temp=fs.lstatSync(target+'.tmp');assert(temp.isFile()&&!temp.isSymbolicLink(),'BOOTSTRAP_STATE_REDIRECTED');
  assert.equal(fs.realpathSync(target+'.tmp'),target+'.tmp','BOOTSTRAP_STATE_REDIRECTED');
  fs.renameSync(target+'.tmp',target);
}
export function continuationBootstrap({main,profile,diagnosticFile}){
  return `const electron=require('electron'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const state=globalThis.__paperContinuationBootstrapState={phase:'BOOTSTRAP_PROFILE_BIND',timeline:[]};
const diagnosticFile=${JSON.stringify(diagnosticFile??null)},diagnostic=${continuationDiagnostic.toString()},publish=${publishContinuationBootstrap.toString()};
const stamp=()=>({wallTimeMs:Date.now(),monotonicNs:process.getBuiltinModule('process').hrtime.bigint().toString()});
const persist=file=>{if(file)publish(fs,path,file,state);};
const trace=event=>{
  assert(state.timeline.length<7,'BOOTSTRAP_STATE_INVALID');
  const point={sequence:state.timeline.length+1,event,phase:state.phase,...stamp()};state.timeline.push(point);
  if(diagnosticFile)publish(fs,path,diagnosticFile+'.phase-'+String(point.sequence).padStart(2,'0')+'.json',{schemaVersion:'xiaozhi.qa.bootstrap-phase.v1',...point});
};
const record=phase=>{state.phase=phase;trace(phase);};
const fail=error=>{state.error=diagnostic(error,state.phase);state.failed=true;if(globalThis.__paperContinuationGuard)state.guardAtFailure=JSON.parse(JSON.stringify(globalThis.__paperContinuationGuard.state));try{persist(diagnosticFile?diagnosticFile+'.error.json':null);}catch(publicationError){process.stderr?.write?.(JSON.stringify({code:'BOOTSTRAP_ERROR_PUBLISH_FAILED',error:state.error,publication:diagnostic(publicationError,state.phase)})+'\\n');}electron.app.exit(1);};
try{
  record('BOOTSTRAP_PROFILE_BIND');fs.mkdirSync(${JSON.stringify(profile)},{recursive:true});
  electron.app.setPath('userData',${JSON.stringify(profile)});electron.app.setPath('sessionData',${JSON.stringify(profile)});
  record('BOOTSTRAP_WAIT_READY');
  (async()=>{
    await electron.app.whenReady();record('BOOTSTRAP_INSTALL_GUARD');
    (${installContinuationNoModel.toString()})(electron);
    trace('GUARD_INSTALLED');record('BOOTSTRAP_MAIN_IMPORT');
    await import(require('node:url').pathToFileURL(${JSON.stringify(main)}).href);
    record('BOOTSTRAP_MAIN_IMPORTED');trace('TERMINAL_PUBLISH_START');
    state.terminalPublishStarted=stamp();persist(diagnosticFile);
  })().catch(fail);
}catch(error){fail(error);}
`;
}

/** Only the newly owned bootstrap output, never app/profile/business state.
 * Atomic child writes make malformed/oversize/redirected data a real failure. */
export function readContinuationBootstrapFile(file,child){
  assert(child,'BOOTSTRAP_CHILD_EXITED');
  const read=name=>{
    const absolute=path.resolve(name),parent=path.dirname(absolute);
    assert.equal(absolute,name,'BOOTSTRAP_STATE_REDIRECTED');
    assert.equal(fs.realpathSync(parent),parent,'BOOTSTRAP_STATE_REDIRECTED');
    const directory=fs.lstatSync(parent);assert(directory.isDirectory()&&!directory.isSymbolicLink(),'BOOTSTRAP_STATE_REDIRECTED');
    let stat;try{stat=fs.lstatSync(absolute);}catch(error){if(error.code==='ENOENT')return null;throw error;}
    assert(stat.isFile()&&!stat.isSymbolicLink(),'BOOTSTRAP_STATE_REDIRECTED');assert(stat.size<=65536,'BOOTSTRAP_STATE_INVALID');
    assert.equal(fs.realpathSync(absolute),absolute,'BOOTSTRAP_STATE_REDIRECTED');
    const bytes=fs.readFileSync(absolute);assert(bytes.length<=65536,'BOOTSTRAP_STATE_INVALID');
    const state=JSON.parse(bytes);
    assert(state&&typeof state.phase==='string'&&/^BOOTSTRAP_(PROFILE_BIND|WAIT_READY|INSTALL_GUARD|MAIN_IMPORT|MAIN_IMPORTED)$/.test(state.phase),'BOOTSTRAP_STATE_INVALID');
    assert(state.failed===undefined||state.failed===true,'BOOTSTRAP_STATE_INVALID');return state;
  };
  // Read the once-only failure before the exit gate, so exit cannot hide it.
  const failure=read(path.resolve(file)+'.error.json');
  if(failure){assert.equal(failure.failed,true,'BOOTSTRAP_STATE_INVALID');return failure;}
  assert(child.exitCode===null&&child.signalCode===null,'BOOTSTRAP_CHILD_EXITED');
  return read(file);
}

/** One fixed stage deadline, inside the caller's existing whole-run deadline.
 * Observes the same child only; never relaunches or retries a business action. */
export async function waitContinuationBootstrap(app,{timeout=30000,onObservation=()=>{},readState,observeWindow=false,onWindow=()=>{},now=Date.now,pause=ms=>new Promise(r=>setTimeout(r,ms))}={}){
  assert(Number.isFinite(timeout)&&timeout>0&&timeout<=30000);
  let expired=false,timer;const limit=now()+timeout;
  const deadline=new Promise((_,reject)=>{timer=setTimeout(()=>{expired=true;reject(Error('BOOTSTRAP_READY_DEADLINE'));},timeout);});
  const poll=async()=>{
    while(!expired&&now()<limit){
      const state=readState?await readState():await app.evaluate(()=>{const s=globalThis.__paperContinuationBootstrapState;return s?{phase:s.phase,failed:s.failed===true,error:s.error??null}:null;});
      if(expired)throw Error('BOOTSTRAP_READY_DEADLINE');onObservation(state);
      if(state?.failed)throw Error('BOOTSTRAP_FAILED');
      if(state?.phase==='BOOTSTRAP_MAIN_IMPORTED')return state;
      await pause(Math.min(100,Math.max(0,limit-now())));
    }
    throw Error('BOOTSTRAP_READY_DEADLINE');
  };
  try{
    // Start the public Playwright window-event wait immediately, alongside the
    // plain Node readiness poll. Both must succeed within this SAME deadline.
    const window=observeWindow?Promise.resolve(app.firstWindow({timeout})).then(value=>{
      if(expired||now()>=limit)throw Error('BOOTSTRAP_READY_DEADLINE');
      return onWindow(value);
    }):null;
    const ready=poll();
    const complete=window?Promise.all([window,ready]).then(([,state])=>state):ready;
    return await Promise.race([complete,deadline]);
  }finally{expired=true;clearTimeout(timer);}
}

/** Do not let a failed/hung readiness observation hang again during finally.
 * Both operations consume the caller's original deadline, never a new run. */
export async function closeContinuationRuntime({observeGuard,close,forceClose,deadlineAt,cap=5000,onPhase=()=>{}}){
  assert(Number.isFinite(deadlineAt)&&cap>0&&cap<=5000);const result={closed:false};
  const bounded=async(operation,code)=>{const remaining=Math.min(cap,Math.max(0,deadlineAt-Date.now()));if(!remaining)throw Error(code);let timer;
    try{return await Promise.race([Promise.resolve().then(operation),new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(code)),remaining);})]);}finally{clearTimeout(timer);}};
  onPhase('FINAL_GUARD');try{result.guard=await bounded(observeGuard,'FINAL_GUARD_DEADLINE');}catch(e){result.guardError=continuationDiagnostic(e,'FINAL_GUARD');}
  onPhase('CLOSE');try{await bounded(close,'FINAL_CLOSE_DEADLINE');result.closed=true;}catch(e){result.closeError=continuationDiagnostic(e,'CLOSE');try{forceClose();}catch(forceError){result.forceCloseError={...continuationDiagnostic(forceError,'CLOSE'),code:'OWNED_FORCE_CLOSE_FAILED'};}}
  return result;
}

/** PREPARATION ONLY. Parent explicitly runs the generated single-launch fixture.
 * No formal main, original profile, app.db or model configuration is loaded. */
export function prepareContinuationIsolation(desktop){
  const output=fs.mkdtempSync(path.join(desktop,'test-results/ui-final-continuation-isolation-'));
  const profile=path.join(output,'profile'),fixture=path.join(output,'fixture-main.cjs'),bootstrap=path.join(output,'owned-bootstrap.cjs'),helper=fileURLToPath(import.meta.url);
  fs.writeFileSync(fixture,`const {app,BrowserWindow}=require('electron');const fs=require('node:fs');fs.writeFileSync(${JSON.stringify(path.join(output,'local-control.json'))},JSON.stringify({url:require('node:inspector').url(),pid:process.pid}));app.whenReady().then(()=>{globalThis.__continuationSyntheticFixture=true;const window=new BrowserWindow({show:false,webPreferences:{sandbox:true,contextIsolation:true,nodeIntegration:false}});window.loadURL('about:blank');});\n`,{flag:'wx'});
  fs.writeFileSync(bootstrap,continuationBootstrap({main:fixture,profile,diagnosticFile:path.join(output,'bootstrap-state.json')}),{flag:'wx'});
  const options={output,desktop,profile,fixture,bootstrap,helper,helperHash:digest(fs.readFileSync(helper))};
  const runner=path.join(output,'run-isolation.mjs');fs.writeFileSync(runner,`if(process.argv.slice(2).join(' ')!=='--run-owned-isolation')throw Error('Explicit parent --run-owned-isolation required');\nawait (${runContinuationIsolation.toString()})(${JSON.stringify(options)});\n`,{flag:'wx'});
  fs.writeFileSync(path.join(output,'preparation.json'),JSON.stringify({code:'PREPARED_NOT_RUN',output,runner,launches:0,modelCalls:0,businessDatabasesOpened:0,files:[fixture,bootstrap,runner].map(file=>({file:path.basename(file),sha256:digest(fs.readFileSync(file))})),helperHash:options.helperHash},null,2),{flag:'wx'});
  return {code:'PREPARED_NOT_RUN',output,runner,launches:0,modelCalls:0,businessDatabasesOpened:0};
}

/** Serialized synthetic runner. CDP controls are diagnostic constants ONLY;
 * never used by the actual acceptance runner or by any business API. */
export async function runContinuationIsolation(options){
  const fs=await import('node:fs'),path=await import('node:path'),{pathToFileURL}=await import('node:url'),{createHash}=await import('node:crypto'),{spawn}=await import('node:child_process');
  const hash=value=>createHash('sha256').update(String(value)).digest('hex'),h=await import(pathToFileURL(options.helper).href);
  if(hash(fs.readFileSync(options.helper))!==options.helperHash)throw Error('ISOLATION_HELPER_CHANGED');
  const prepared=JSON.parse(fs.readFileSync(path.join(options.output,'preparation.json'),'utf8'));for(const file of prepared.files){if(!['fixture-main.cjs','owned-bootstrap.cjs','run-isolation.mjs'].includes(file.file)||hash(fs.readFileSync(path.join(options.output,file.file)))!==file.sha256)throw Error('ISOLATION_FIXTURE_CHANGED');}
  const version=name=>JSON.parse(fs.readFileSync(path.join(options.desktop,'node_modules',name,'package.json'),'utf8')).version;
  const report={code:'DIAGNOSTIC_IN_PROGRESS',productAcceptance:false,launches:0,modelCalls:0,businessDatabasesOpened:0,scope:'Synthetic no-DB one-launch API/CDP controls only',probes:[],output:options.output,qaHelperHash:options.helperHash,fixtureHashes:prepared.files,versions:{node:process.version,playwright:version('playwright'),electron:version('electron')}};
  const persist=()=>fs.writeFileSync(path.join(options.output,'report.json'),JSON.stringify(report,null,2));
  // This file stays local and is deliberately excluded from the public report.
  // Fixture code/config/data are synthetic; never point this runner at an app profile.
  const raw=(label,error)=>{fs.appendFileSync(path.join(options.output,'local-api-errors.jsonl'),JSON.stringify({label,name:error?.name,message:String(error?.message||error),stack:String(error?.stack||'')})+'\n',{mode:0o600});return h.continuationDiagnostic(error,'LAUNCH_RETURNED');};
  let app,proc,socket,timer,firstFailure,killRequested=false;const start=Date.now(),deadlineAt=start+30000;
  const terminate=()=>{if(killRequested||!proc||proc.exitCode!==null||proc.signalCode!==null)return;killRequested=true;if(!Number.isInteger(proc.pid)||proc.pid<=0||proc.pid===process.pid)throw Error('ISOLATION_PID_INVALID');if(process.platform==='win32'){const child=spawn('taskkill.exe',['/PID',String(proc.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});child.on('error',()=>{});child.unref();}else proc.kill('SIGKILL');};
  const bounded=async(fn,code,cap=3000)=>{const remaining=Math.min(cap,Math.max(0,deadlineAt-Date.now()));if(!remaining)throw Error(code);let t;try{return await Promise.race([Promise.resolve().then(fn),new Promise((_,reject)=>{t=setTimeout(()=>reject(Error(code)),remaining);})]);}finally{clearTimeout(t);}};
  const probe=async(label,operation)=>{try{const value=await bounded(operation,'ISOLATION_PROBE_DEADLINE');report.probes.push({label,status:'RETURNED',value});persist();return true;}catch(e){const diagnostic=raw(label,e);firstFailure??=diagnostic;report.probes.push({label,status:'FAILED',diagnostic});persist();if(diagnostic.code!=='CDP_PROMISE_COLLECTED')throw e;return false;}};
  try{
    persist();const env={...process.env};for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
    Object.assign(env,{OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_DATA_ROOT:path.join(options.output,'empty-data')});
    const {_electron:electron}=await import('playwright');report.launches=1;persist();
    app=await electron.launch({args:[options.bootstrap,'--user-data-dir='+options.profile,'--force-device-scale-factor=1'],cwd:options.output,env,timeout:Math.max(1,deadlineAt-Date.now())});proc=app.process();
    proc.once('exit',(code,signal)=>{report.processExit={code,signal,at:Date.now()-start};persist();});app.on('close',()=>{report.appCloseAt=Date.now()-start;persist();});
    timer=setTimeout(()=>{report.deadline=true;try{terminate();}catch(e){raw('deadline-close',e);}},Math.max(0,deadlineAt-Date.now()));
    // Stop the high-level sequence at its first failure. Only the explicitly
    // declared synthetic CDP control matrix follows a classified Promise-GC.
    if(await probe('PW_SYNC_CONSTANT',()=>app.evaluate(()=>1))&&await probe('PW_APP_READY',()=>app.evaluate(({app})=>app.isReady())))await probe('PW_SYNC_BOOTSTRAP_STATE',()=>app.evaluate(()=>globalThis.__paperContinuationBootstrapState?.phase??null));
    if(!firstFailure){report.code='PW_CONTROLS_RETURNED';}else{
    if(firstFailure.code!=='CDP_PROMISE_COLLECTED')throw Error('ISOLATION_UNCLASSIFIED_FIRST_FAILURE');
    const controlFile=path.join(options.output,'local-control.json');while(!fs.existsSync(controlFile)){if(Date.now()>=deadlineAt)throw Error('ISOLATION_CONTROL_DEADLINE');await new Promise(r=>setTimeout(r,20));}
    const control=JSON.parse(fs.readFileSync(controlFile,'utf8'));report.fixtureProcessPid=control.pid;
    if(!Number.isInteger(control.pid)||control.pid!==proc.pid||proc.exitCode!==null||proc.signalCode!==null)throw Error('ISOLATION_CONTROL_PID_MISMATCH');
    const endpoint=new URL(control.url);if(endpoint.protocol!=='ws:'||endpoint.username||endpoint.password||!['127.0.0.1','localhost','[::1]'].includes(endpoint.hostname))throw Error('ISOLATION_CONTROL_NOT_LOCAL');
    socket=new WebSocket(control.url);const pending=new Map(),contexts=[];let sequence=0;
    socket.addEventListener('message',event=>{const message=JSON.parse(String(event.data));if(message.method==='Runtime.executionContextCreated')contexts.push(message.params.context);const p=pending.get(message.id);if(p){pending.delete(message.id);if(message.error)p.reject(Error(message.error.message));else p.resolve(message.result);}});
    await bounded(()=>new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});}),'ISOLATION_CONTROL_CONNECT');
    const send=(method,params)=>bounded(()=>new Promise((resolve,reject)=>{const id=++sequence;pending.set(id,{resolve,reject});socket.send(JSON.stringify({id,method,params}));}),'ISOLATION_CDP_DEADLINE');
    await send('Runtime.enable',{});const context=contexts.find(c=>c.auxData?.isDefault);if(!context)throw Error('ISOLATION_DEFAULT_CONTEXT_MISSING');
    const evaluate=async(expression,awaitPromise)=>{const r=await send('Runtime.evaluate',{expression,contextId:context.id,returnByValue:true,awaitPromise});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;};
    await probe('CDP_SYNC_EVALUATE_AWAIT_FALSE',()=>evaluate('1',false));await probe('CDP_SYNC_EVALUATE_AWAIT_TRUE',()=>evaluate('1',true));
    const object=await send('Runtime.evaluate',{expression:'globalThis.__continuationSyntheticControl={value:1}',contextId:context.id,returnByValue:false,awaitPromise:false});if(!object.result?.objectId)throw Error('ISOLATION_CONTROL_OBJECT_MISSING');
    for(const awaitPromise of [false,true])await probe('CDP_SYNC_CALL_AWAIT_'+String(awaitPromise).toUpperCase(),async()=>{const r=await send('Runtime.callFunctionOn',{objectId:object.result.objectId,functionDeclaration:'function(){return {constant:1};}',returnByValue:true,awaitPromise});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;});
    await probe('CDP_SYNC_GUARD_COUNTS',async()=>{const counts=await evaluate('({networkAttempts:globalThis.__paperContinuationGuard.state.networkAttempts,modelAttempts:globalThis.__paperContinuationGuard.state.modelAttempts})',false);if(counts?.networkAttempts!==0||counts?.modelAttempts!==0)throw Error('ISOLATION_NETWORK_ATTEMPT');return counts;});
    report.code='DIAGNOSTIC_COLLECTED';
    }
  }catch(e){report.code='DIAGNOSTIC_FAILED';report.error=raw('isolation',e);process.exitCode=1;}
  finally{socket?.close();if(app){const cleanup=await h.closeContinuationRuntime({observeGuard:async()=>({scope:'Synthetic fixture; no business runtime loaded'}),close:()=>app.close(),forceClose:terminate,deadlineAt,cap:3000});report.cleanup=cleanup;if(!cleanup.closed){report.code='DIAGNOSTIC_FAILED';process.exitCode=1;}}clearTimeout(timer);report.elapsedMs=Date.now()-start;report.originalDataTouched=false;report.localRawErrorsFile='local-api-errors.jsonl';persist();console.log(JSON.stringify({code:report.code,output:options.output,launches:report.launches,modelCalls:0,businessDatabasesOpened:0,productAcceptance:false}));}
}

export async function continuationSelfTest(){
  const vm=await import('node:vm'),checks=[];
  // Exercise the real inventory with fail-on-access mutable roots, without
  // opening any old evidence/profile/DB or requiring platform-specific locks.
  const inventoryRoot=path.resolve('continuation-inventory-fixture'),file=name=>path.join(inventoryRoot,name),dir=name=>({name,isDirectory:()=>true,isFile:()=>false,isSymbolicLink:()=>false}),leaf=name=>({name,isDirectory:()=>false,isFile:()=>true,isSymbolicLink:()=>false});
  const tree=new Map([[inventoryRoot,[dir('profile'),leaf('report.json'),dir('data'),dir('evidence')]],[file('evidence'),[dir('data')]],[file('evidence/data'),[leaf('proof.json')]]]);
  const bytes=new Map([[file('report.json'),Buffer.from('original')],[file('evidence/data/proof.json'),Buffer.from('nested-data-is-immutable')]]),access=[];
  const io={readdirSync:directory=>{access.push(directory);assert(tree.has(directory),'Excluded mutable root must never be traversed');return tree.get(directory);},readFileSync:absolute=>{access.push(absolute);assert(bytes.has(absolute),'Unexpected evidence read');return bytes.get(absolute);}};
  const inventory=vm.runInNewContext('('+continuationImmutableInventory.toString()+')',{fs:io,path,digest,assert});
  const expected=[{file:'evidence/data/proof.json',sha256:digest(bytes.get(file('evidence/data/proof.json')))},{file:'report.json',sha256:digest(bytes.get(file('report.json')))}];
  const baseline=inventory(inventoryRoot);assert.equal(JSON.stringify(baseline),JSON.stringify({sha256:digest(expected),files:expected}));
  assert(!access.includes(file('data'))&&!access.includes(file('profile')));checks.push('LIVE_INVENTORY_SKIPS_MUTABLE_ROOTS_BEFORE_ANY_ACCESS');
  bytes.set(file('report.json'),Buffer.from('changed'));assert.notEqual(inventory(inventoryRoot).sha256,baseline.sha256);bytes.set(file('report.json'),Buffer.from('original'));
  tree.get(inventoryRoot).push(leaf('new-evidence.json'));bytes.set(file('new-evidence.json'),Buffer.from('added'));assert.equal(inventory(inventoryRoot).files.length,3);assert.notEqual(inventory(inventoryRoot).sha256,baseline.sha256);tree.get(inventoryRoot).pop();
  bytes.set(file('evidence/data/proof.json'),Buffer.from('changed nested data'));assert.notEqual(inventory(inventoryRoot).sha256,baseline.sha256);checks.push('IMMUTABLE_CHANGED_ADDED_AND_NESTED_DATA_FILES_CHANGE_HASH');
  const redirect={name:'profile',isDirectory:()=>false,isFile:()=>false,isSymbolicLink:()=>true};tree.set(inventoryRoot,[redirect]);assert.throws(()=>inventory(inventoryRoot),/Mutable evidence root must remain a directory/);
  tree.set(inventoryRoot,[{...redirect,name:'other'}]);assert.throws(()=>inventory(inventoryRoot),/Immutable evidence must not contain symlinks/);checks.push('IMMUTABLE_AND_MUTABLE_ROOT_REDIRECTS_FAIL_CLOSED');
  const diagnostic=continuationDiagnostic({name:'Error',message:'private sk-fixture NO_ZERO_MODEL_GUARD',stack:'private sk-fixture\n at file:///owned/scripts/ui-final-paper-adaptation-continuation-live.mjs:74:19\n at file:///private/src/sensitive.ts:2:3'},'MAIN_IDENTITY');
  assert.equal(diagnostic.code,'ZERO_MODEL_GUARD_MISSING');assert.deepEqual(diagnostic.qaFrames,[{file:'scripts/ui-final-paper-adaptation-continuation-live.mjs',line:74,column:19}]);assert(!JSON.stringify(diagnostic).includes('sk-fixture'));assert(!JSON.stringify(diagnostic).includes('sensitive'));
  assert.equal(continuationDiagnostic(Error('electronApplication.evaluate: Resulting promise was garbage collected.'),'LAUNCH_RETURNED').code,'CDP_PROMISE_COLLECTED');
  assert.equal(continuationDiagnostic(Error('private fixture Resulting promise was garbage collected. trailing'),'LAUNCH_RETURNED').code,'CONTINUATION_UNCLASSIFIED_ERROR');
  for(const error of ['permission_denied','conflict','source_changed','cancelled','unavailable','invalid_input','unclassified'])assert.throws(()=>adaptationObservation({ok:false,error}),/Read-only exact intent failed/);
  let busy=0;assert.equal(adaptationObservation({ok:false,error:'busy'},()=>busy++),undefined);assert.equal(busy,1);assert.deepEqual(adaptationObservation({ok:true,value:{status:'accepted'}}),{status:'accepted'});checks.push('BUSY_ONLY_OBSERVATION_OTHER_ERRORS_FAIL');
  // Exercise the ACTUAL unchanged original loop with a deterministic clock.
  const source=fs.readFileSync(new URL('./paper-adaptation-live-ui.mjs',import.meta.url),'utf8');
  const loop=source.match(/const until=(async\(predicate,label\)=>\{[^\n]+\});/);assert(loop,'Original fixed-deadline loop');
  let now=0,calls=0;const until=vm.runInNewContext('('+loop[1]+')',{timeoutMs:600,Date:{now:()=>now},setTimeout:callback=>{now+=250;callback();}});
  await assert.rejects(until(async()=>{calls++;return !!await readAdaptationObservation({evaluate:async()=>({ok:false,error:'busy'})},{intentId:'exact'});},'busy'),/A27 timeout: busy/);
  assert.equal(calls,3);assert.equal(now,750);checks.push('ACTUAL_ORIGINAL_LOOP_BUSY_DEADLINE_UNCHANGED');
  now=0;calls=0;await until(async()=>{calls++;return !!await readAdaptationObservation({evaluate:async()=>calls===1?{ok:false,error:'busy'}:{ok:true,value:{status:'accepted'}}},{intentId:'exact'});},'eventual');assert.equal(calls,2);checks.push('ACTUAL_LOOP_BUSY_THEN_ACCEPTED_OBSERVATION');
  now=0;calls=0;await assert.rejects(until(async()=>{calls++;return !!await readAdaptationObservation({evaluate:async()=>({ok:false,error:'source_changed'})},{intentId:'exact'});},'other'),/source_changed/);assert.equal(calls,1);assert.equal(now,0);checks.push('ACTUAL_LOOP_NON_BUSY_FAILS_IMMEDIATELY');
  const hooks={},events=[],electron={app:{setPath:(n,p)=>events.push(n),whenReady:()=>{events.push('ready');return new Promise(()=>{});}}};
  const bootstrapContext=vm.createContext({process:{getBuiltinModule:process.getBuiltinModule},require:name=>name==='electron'?electron:name==='node:path'?path:name==='node:assert/strict'?assert:{mkdirSync:()=>events.push('mkdir')}});
  vm.runInContext(continuationBootstrap({main:'/owned/main.js',profile:'/owned/profile'}),bootstrapContext);
  assert.deepEqual(events,['mkdir','userData','sessionData','ready']);assert.equal(bootstrapContext.__paperContinuationBootstrapState.phase,'BOOTSTRAP_WAIT_READY');
  let clock=0,observations=0;const states=[null,{phase:'BOOTSTRAP_WAIT_READY'},{phase:'BOOTSTRAP_MAIN_IMPORT'},{phase:'BOOTSTRAP_MAIN_IMPORTED'}];
  await waitContinuationBootstrap({evaluate:async()=>{observations++;return states.shift();}},{timeout:400,now:()=>clock,pause:async ms=>{clock+=ms;}});assert.equal(observations,4);assert.equal(clock,300);
  observations=0;await assert.rejects(waitContinuationBootstrap({evaluate:async()=>{observations++;return {phase:'BOOTSTRAP_INSTALL_GUARD',failed:true};}},{timeout:300}),/BOOTSTRAP_FAILED/);assert.equal(observations,1);
  clock=0;observations=0;await assert.rejects(waitContinuationBootstrap({evaluate:async()=>{observations++;return {phase:'BOOTSTRAP_MAIN_IMPORT'};}},{timeout:300,now:()=>clock,pause:async ms=>{clock+=ms;}}),/BOOTSTRAP_READY_DEADLINE/);assert.equal(clock,300);assert.equal(observations,3);
  await assert.rejects(waitContinuationBootstrap({evaluate:()=>new Promise(()=>{})},{timeout:5}),/BOOTSTRAP_READY_DEADLINE/);
  let closeCalls=0,forceCalls=0;const cleanup=await closeContinuationRuntime({observeGuard:()=>new Promise(()=>{}),close:async()=>{closeCalls++;},forceClose:()=>{forceCalls++;},deadlineAt:Date.now()+1000,cap:5});
  assert.equal(cleanup.closed,true);assert.equal(cleanup.guardError.phase,'FINAL_GUARD');assert.equal(cleanup.guardError.code,'FINAL_GUARD_DEADLINE');assert.equal(closeCalls,1);assert.equal(forceCalls,0);
  const stuckClose=await closeContinuationRuntime({observeGuard:async()=>({networkAttempts:0}),close:()=>new Promise(()=>{}),forceClose:()=>{forceCalls++;},deadlineAt:Date.now()+1000,cap:5});assert.equal(stuckClose.closed,false);assert.equal(stuckClose.closeError.code,'FINAL_CLOSE_DEADLINE');assert.equal(forceCalls,1);
  const forceFailure=await closeContinuationRuntime({observeGuard:async()=>({}),close:async()=>{throw Error('closed');},forceClose:()=>{throw Error('private fixture dispatcher destroyed');},deadlineAt:Date.now()+1000,cap:5});assert.equal(forceFailure.closed,false);assert.equal(forceFailure.forceCloseError.code,'OWNED_FORCE_CLOSE_FAILED');assert(!JSON.stringify(forceFailure).includes('private fixture'));
  let fileReads=0;clock=0;await waitContinuationBootstrap({evaluate:()=>assert.fail('No CDP observation before latched import')},{timeout:300,now:()=>clock,pause:async ms=>{clock+=ms;},readState:async()=>++fileReads===1?{phase:'BOOTSTRAP_MAIN_IMPORT'}:{phase:'BOOTSTRAP_MAIN_IMPORTED'}});assert.equal(fileReads,2);assert.equal(clock,100);
  fileReads=0;await assert.rejects(waitContinuationBootstrap(null,{timeout:300,readState:async()=>{fileReads++;throw Error('BOOTSTRAP_STATE_INVALID');}}),/BOOTSTRAP_STATE_INVALID/);assert.equal(fileReads,1);
  assert.throws(()=>readContinuationBootstrapFile('/unused',{exitCode:0,signalCode:null}),/BOOTSTRAP_CHILD_EXITED/);
  const bootstrapWrites=[],bootstrapExits=[],terminalRoot=path.resolve('continuation-bootstrap-fixture'),terminalFile=path.join(terminalRoot,'bootstrap-state.json');
  const missing=()=>Object.assign(Error('missing fixture'),{code:'ENOENT'}),terminalFiles=new Map();
  const terminalIo={mkdirSync:()=>{},realpathSync:file=>file,lstatSync:file=>file===terminalRoot?{isDirectory:()=>true,isSymbolicLink:()=>false}:terminalFiles.has(file)?{isFile:()=>true,isSymbolicLink:()=>false,size:Buffer.byteLength(terminalFiles.get(file))}:(()=>{throw missing();})(),
    readFileSync:file=>Buffer.from(terminalFiles.get(file)),writeFileSync:(file,bytes,options)=>{if(options?.flag==='wx'&&terminalFiles.has(file))throw Object.assign(Error('exists'),{code:'EEXIST'});terminalFiles.set(file,bytes);bootstrapWrites.push(JSON.parse(bytes));},
    renameSync:(from,to)=>{if(terminalFiles.has(to))throw Object.assign(Error('locked replacement'),{code:'EPERM',syscall:'rename'});terminalFiles.set(to,terminalFiles.get(from));terminalFiles.delete(from);}};
  const fixtureRequire=host=>name=>name==='electron'?host:name==='node:path'?path:name==='node:assert/strict'?assert:terminalIo;
  const failedContext=vm.createContext({Buffer,process:{getBuiltinModule:process.getBuiltinModule},require:fixtureRequire({app:{setPath:()=>{},whenReady:async()=>{throw Error('private sk-fixture NO_ZERO_MODEL_GUARD');},exit:code=>bootstrapExits.push(code)}})});
  await vm.runInContext(continuationBootstrap({main:'/owned/main.js',profile:'/owned/profile',diagnosticFile:terminalFile}),failedContext);
  assert.equal(failedContext.__paperContinuationBootstrapState.failed,true);assert.equal(failedContext.__paperContinuationBootstrapState.error.code,'ZERO_MODEL_GUARD_MISSING');assert.equal(failedContext.__paperContinuationBootstrapState.error.phase,'BOOTSTRAP_WAIT_READY');assert.deepEqual(bootstrapExits,[1]);assert(!JSON.stringify(bootstrapWrites).includes('sk-fixture'));
  const readTerminal=vm.runInNewContext('('+readContinuationBootstrapFile.toString()+')',{fs:terminalIo,path,assert});
  assert.equal(readTerminal(terminalFile,{exitCode:1,signalCode:null}).error.code,'ZERO_MODEL_GUARD_MISSING');
  await assert.rejects(waitContinuationBootstrap(null,{timeout:100,readState:()=>readTerminal(terminalFile,{exitCode:1,signalCode:null})}),/BOOTSTRAP_FAILED/);
  checks.push('TERMINAL_FAILURE_SURVIVES_CHILD_EXIT_WITHOUT_REPLACEMENT');
  terminalFiles.clear();bootstrapWrites.length=0;bootstrapExits.length=0;
  const terminalHost={app:{setPath:()=>{},whenReady:async()=>{},on:()=>{},exit:code=>bootstrapExits.push(code)},net:{fetch:()=>assert.fail('No native fetch')},session:{defaultSession:{webRequest:{onBeforeRequest:()=>{}}}}};
  const terminalContext=vm.createContext({Buffer,URL,process:{getBuiltinModule:process.getBuiltinModule},require:fixtureRequire(terminalHost)});
  terminalContext.__testImport=async()=>{assert(terminalContext.__paperContinuationGuard,'Guard precedes formal import');assert(!terminalFiles.has(terminalFile),'No terminal exists before import completes');assert.equal(bootstrapWrites.length,5,'Intermediate phases have distinct immutable targets');};
  const generated=continuationBootstrap({main:'/owned/main.js',profile:'/owned/profile',diagnosticFile:terminalFile});
  // Unit-only import seam executes the generated bootstrap/guard/publisher;
  // it never imports a production main or manufactures acceptance evidence.
  const expression=`await import(require('node:url').pathToFileURL(${JSON.stringify('/owned/main.js')}).href)`;
  assert.equal(generated.split(expression).length,2);const terminalSource='{'+generated.replace(expression,'await globalThis.__testImport()')+'}';
  await vm.runInContext(terminalSource,terminalContext);assert.equal(bootstrapWrites.length,8);assert.equal(bootstrapExits.length,0);
  assert.equal(readTerminal(terminalFile,{exitCode:null,signalCode:null}).phase,'BOOTSTRAP_MAIN_IMPORTED');
  assert.throws(()=>readTerminal(terminalFile,{exitCode:0,signalCode:null}),/BOOTSTRAP_CHILD_EXITED/);
  assert.throws(()=>publishContinuationBootstrap(terminalIo,path,terminalFile,{phase:'BOOTSTRAP_MAIN_IMPORTED'}),/BOOTSTRAP_STATE_EXISTS/);
  assert.equal(bootstrapWrites.length,8,'A held terminal reader never encounters a replacement');checks.push('READY_PUBLISHED_ONCE_NO_INTERMEDIATE_REPLACE_LOCK_AND_DEAD_READY_REJECTED');
  const expectedEvents=['BOOTSTRAP_PROFILE_BIND','BOOTSTRAP_WAIT_READY','BOOTSTRAP_INSTALL_GUARD','GUARD_INSTALLED','BOOTSTRAP_MAIN_IMPORT','BOOTSTRAP_MAIN_IMPORTED','TERMINAL_PUBLISH_START'];
  const phaseFrames=expectedEvents.map((_event,index)=>JSON.parse(terminalFiles.get(terminalFile+'.phase-'+String(index+1).padStart(2,'0')+'.json')));
  assert.deepEqual(phaseFrames.map(p=>p.event),expectedEvents);
  for(const [index,point]of phaseFrames.entries()){
    assert.equal(point.schemaVersion,'xiaozhi.qa.bootstrap-phase.v1');assert.equal(point.sequence,index+1);
    assert(Number.isSafeInteger(point.wallTimeMs));assert.match(point.monotonicNs,/^\d+$/);
    if(index)assert(BigInt(point.monotonicNs)>=BigInt(phaseFrames[index-1].monotonicNs));
  }
  const savedReady=JSON.parse(terminalFiles.get(terminalFile));assert.deepEqual(savedReady.timeline,phaseFrames.map(({schemaVersion,...point})=>point));
  assert(BigInt(savedReady.terminalPublishStarted.monotonicNs)>=BigInt(phaseFrames.at(-1).monotonicNs));
  checks.push('ONCE_ONLY_PHASE_ORDER_WALL_MONOTONIC_AND_TERMINAL_PUBLICATION_BOUNDARY');
  terminalFiles.clear();bootstrapWrites.length=0;bootstrapExits.length=0;
  terminalContext.__testImport=async()=>{throw Object.assign(Error('private sk-fixture import denied'),{code:'EPERM',syscall:'open'});};
  await vm.runInContext(terminalSource,terminalContext);
  assert(!terminalFiles.has(terminalFile));const failedTerminal=readTerminal(terminalFile,{exitCode:1,signalCode:null});
  assert.equal(failedTerminal.phase,'BOOTSTRAP_MAIN_IMPORT');assert.equal(failedTerminal.error.systemCode,'EPERM');assert.equal(failedTerminal.error.syscall,'open');assert.equal(failedTerminal.guardAtFailure.modelAttempts,0);assert.equal(bootstrapExits.length,1);assert(!JSON.stringify(failedTerminal).includes('sk-fixture'));checks.push('IMPORT_FAILURE_TERMINAL_HAS_SAFE_SYSTEM_CODE_AND_EARLY_GUARD');
  terminalFiles.clear();bootstrapWrites.length=0;bootstrapExits.length=0;
  terminalContext.__testImport=async()=>{};const rename=terminalIo.renameSync;
  terminalIo.renameSync=(from,to)=>{if(to===terminalFile)throw Object.assign(Error('locked fixture publication'),{code:'EPERM',syscall:'rename'});rename(from,to);};
  await vm.runInContext(terminalSource,terminalContext);terminalIo.renameSync=rename;
  assert(terminalFiles.has(terminalFile+'.tmp'),'Failed ready temp is retained');assert(!terminalFiles.has(terminalFile));
  const publishFailure=readTerminal(terminalFile,{exitCode:1,signalCode:null});assert.equal(publishFailure.failed,true);assert.equal(publishFailure.error.systemCode,'EPERM');assert.equal(publishFailure.error.syscall,'rename');assert.equal(bootstrapExits.length,1);checks.push('PUBLICATION_FAILURE_RETAINED_IN_SEPARATE_ONCE_ONLY_ERROR_FILE');
  terminalFiles.clear();terminalFiles.set(terminalFile+'.tmp','{');assert.equal(readTerminal(terminalFile,{exitCode:null,signalCode:null}),null);
  terminalFiles.set(terminalFile,'{');assert.throws(()=>readTerminal(terminalFile,{exitCode:null,signalCode:null}),{name:'SyntaxError'});
  terminalFiles.set(terminalFile,'x'.repeat(65537));assert.throws(()=>readTerminal(terminalFile,{exitCode:null,signalCode:null}),/BOOTSTRAP_STATE_INVALID/);
  terminalFiles.clear();const lstat=terminalIo.lstatSync;terminalIo.lstatSync=file=>file===terminalFile?{isFile:()=>false,isSymbolicLink:()=>true,size:1}:lstat(file);
  assert.throws(()=>readTerminal(terminalFile,{exitCode:null,signalCode:null}),/BOOTSTRAP_STATE_REDIRECTED/);terminalIo.lstatSync=lstat;checks.push('PARTIAL_TEMP_NEVER_READY_AND_INVALID_OVERSIZE_SYMLINK_FAIL_CLOSED');
  terminalFiles.clear();bootstrapWrites.length=0;bootstrapExits.length=0;delete terminalContext.__paperContinuationGuard;
  let releaseReady,importCalls=0;
  terminalHost.app.whenReady=()=>new Promise(resolve=>{releaseReady=resolve;});terminalContext.__testImport=async()=>{importCalls++;};
  const pendingReady=vm.runInContext(terminalSource,terminalContext);await Promise.resolve();
  assert.equal(bootstrapWrites.length,2);assert.equal(bootstrapWrites.at(-1).event,'BOOTSTRAP_WAIT_READY');assert.equal(importCalls,0);assert(!terminalContext.__paperContinuationGuard);
  await assert.rejects(waitContinuationBootstrap(null,{timeout:5,readState:()=>readTerminal(terminalFile,{exitCode:null,signalCode:null})}),/BOOTSTRAP_READY_DEADLINE/);
  releaseReady();await pendingReady;assert.equal(importCalls,1);assert.equal(bootstrapWrites.length,8);checks.push('WHEN_READY_STALL_TRACE_DISTINCT_AND_ORIGINAL_DEADLINE_FAILS');
  terminalFiles.clear();bootstrapWrites.length=0;bootstrapExits.length=0;delete terminalContext.__paperContinuationGuard;
  let releaseImport;terminalHost.app.whenReady=async()=>{};terminalContext.__testImport=()=>new Promise(resolve=>{releaseImport=resolve;});
  const pendingImport=vm.runInContext(terminalSource,terminalContext);await new Promise(resolve=>setImmediate(resolve));
  assert.equal(bootstrapWrites.length,5);assert.equal(bootstrapWrites.at(-1).event,'BOOTSTRAP_MAIN_IMPORT');assert(terminalContext.__paperContinuationGuard);assert(!terminalFiles.has(terminalFile));
  await assert.rejects(waitContinuationBootstrap(null,{timeout:5,readState:()=>readTerminal(terminalFile,{exitCode:null,signalCode:null})}),/BOOTSTRAP_READY_DEADLINE/);
  releaseImport();await pendingImport;assert.equal(bootstrapWrites.length,8);checks.push('FORMAL_IMPORT_STALL_TRACE_DISTINCT_LATE_TERMINAL_NEVER_RETROACTIVE_PASS');
  terminalFiles.clear();bootstrapWrites.length=0;bootstrapExits.length=0;delete terminalContext.__paperContinuationGuard;
  importCalls=0;terminalContext.__testImport=async()=>{importCalls++;};
  terminalIo.renameSync=(from,to)=>{if(to===terminalFile+'.phase-03.json')throw Object.assign(Error('private fixture trace denied'),{code:'EACCES',syscall:'rename'});rename(from,to);};
  await vm.runInContext(terminalSource,terminalContext);terminalIo.renameSync=rename;
  const traceFailure=readTerminal(terminalFile,{exitCode:1,signalCode:null});assert.equal(traceFailure.failed,true);assert.equal(traceFailure.phase,'BOOTSTRAP_INSTALL_GUARD');assert.equal(traceFailure.error.systemCode,'EACCES');assert.equal(importCalls,0);assert.equal(bootstrapExits.length,1);assert(!terminalFiles.has(terminalFile));
  checks.push('PHASE_PUBLICATION_FAILURE_FAILS_CLOSED_WITH_SEPARATE_SAFE_ERROR');
  let windowCalls=0,windowObserved=0,windowResolve,settled=false;
  const jointReady={phase:'BOOTSTRAP_MAIN_IMPORTED'},jointPage={fixture:'public-window'};
  const joint=waitContinuationBootstrap({firstWindow:options=>{windowCalls++;assert.equal(options.timeout,1000);return new Promise(resolve=>windowResolve=resolve);},evaluate:()=>assert.fail('No Inspector readiness polling')},{timeout:1000,observeWindow:true,readState:()=>jointReady,onWindow:value=>{assert.equal(value,jointPage);windowObserved++;}}).then(value=>{settled=true;return value;});
  await new Promise(resolve=>setImmediate(resolve));assert.equal(settled,false,'Ready file alone is insufficient');assert.equal(windowCalls,1);
  windowResolve(jointPage);assert.equal(await joint,jointReady);assert.equal(windowObserved,1);checks.push('JOINT_STARTUP_READY_FILE_ALONE_NEEDS_ONE_PUBLIC_WINDOW');
  windowCalls=0;windowObserved=0;clock=0;fileReads=0;
  const windowFirst=await waitContinuationBootstrap({firstWindow:options=>{windowCalls++;assert.equal(options.timeout,300);return Promise.resolve(jointPage);},evaluate:()=>assert.fail('No Inspector readiness polling')},{timeout:300,observeWindow:true,now:()=>clock,pause:async ms=>{clock+=ms;},readState:()=>++fileReads===3?jointReady:null,onWindow:()=>{windowObserved++;}});
  assert.equal(windowFirst,jointReady);assert.equal(clock,200);assert.equal(windowCalls,1);assert.equal(windowObserved,1);checks.push('JOINT_STARTUP_WINDOW_ALONE_NEEDS_TERMINAL_WITHIN_SAME_DEADLINE');
  const windowFailure=Error('unit window closed');let pauseResolve,afterFailureObservations=0;
  await assert.rejects(waitContinuationBootstrap({firstWindow:()=>Promise.reject(windowFailure)},{timeout:1000,observeWindow:true,readState:()=>null,onObservation:()=>{afterFailureObservations++;},pause:()=>new Promise(resolve=>pauseResolve=resolve)}),error=>error===windowFailure);
  const latchedObservations=afterFailureObservations;pauseResolve?.();await new Promise(resolve=>setImmediate(resolve));assert.equal(afterFailureObservations,latchedObservations);checks.push('JOINT_WINDOW_FAILURE_FAILS_FAST_AND_STOPS_NODE_OBSERVATIONS');
  windowObserved=0;const fileFailure=Error('unit exact readiness failure');
  await assert.rejects(waitContinuationBootstrap({firstWindow:()=>new Promise(resolve=>windowResolve=resolve)},{timeout:1000,observeWindow:true,readState:()=>{throw fileFailure;},onWindow:()=>{windowObserved++;}}),error=>error===fileFailure);
  windowResolve(jointPage);await new Promise(resolve=>setImmediate(resolve));assert.equal(windowObserved,0,'Late window callback cannot mutate caller after first failure');checks.push('JOINT_FILE_FAILURE_PRESERVED_AND_LATE_WINDOW_IGNORED');
  windowObserved=0;
  await assert.rejects(waitContinuationBootstrap({firstWindow:options=>{assert.equal(options.timeout,5);return new Promise(resolve=>windowResolve=resolve);}},{timeout:5,observeWindow:true,readState:()=>jointReady,onWindow:()=>{windowObserved++;}}),/BOOTSTRAP_READY_DEADLINE/);
  windowResolve(jointPage);await new Promise(resolve=>setImmediate(resolve));assert.equal(windowObserved,0);checks.push('JOINT_HUNG_WINDOW_FIXED_DEADLINE_NO_LATE_CALLBACK');
  const runner=fs.readFileSync(new URL('../ui-final-paper-adaptation-continuation-live.mjs',import.meta.url),'utf8');
  assert(runner.indexOf('await waitContinuationBootstrap(app,')<runner.indexOf('report.main=await assertIsolatedPiMain('));assert(runner.includes('timeout:30000,observeWindow:true'));assert(runner.indexOf('page=window;')<runner.indexOf('app.evaluate(continuationGuardRead,true)'));assert(runner.indexOf('report.main=await assertIsolatedPiMain(')<runner.indexOf("phase('GUARD_POLICY')"));assert(runner.indexOf("phase('GUARD_POLICY')")<runner.indexOf("phase('COLD_TERMINAL')"));assert(runner.includes('},180000)'));
  checks.push('PROFILE_BEFORE_READY_LATCHED_BOOTSTRAP_AND_BOUNDED_READY_PROOF_DIAGNOSTICS');
  const session={defaultSession:{webRequest:{onBeforeRequest:fn=>hooks.before=fn}}},net={fetch:()=>assert.fail('No native fetch')};
  const context=vm.createContext({URL,process:{getBuiltinModule:process.getBuiltinModule}}),appEvents={},contentEvents={};
  vm.runInContext(`(${installContinuationNoModel.toString()})`,context)({app:{on:(name,fn)=>appEvents[name]=fn},net,session});
  session.defaultSession.webRequest.onBeforeRequest((r,done)=>done({cancel:r.resourceType==='subFrame'}));
  const read=vm.runInContext(`(${continuationGuardRead.toString()})`,context),host={BrowserWindow:{getAllWindows:()=>[{webContents:{id:1}}]}};
  assert.equal(read(host,true).networkAttempts,0);checks.push('COMPOSED_ZERO_HTTP_AND_FORMAL_FRAME');
  await assert.rejects(net.fetch('https://api.deepseek.com/v1/chat/completions'),/CONTINUATION_NETWORK_DENIED/);assert.equal(read(host).modelAttempts,1);checks.push('MODEL_FAILS_BEFORE_NATIVE_FETCH');
  await assert.rejects(context.fetch('https://example.invalid'),/CONTINUATION_NETWORK_DENIED/);assert.equal(read(host).networkAttempts,2);checks.push('GLOBAL_FETCH_FAILS_CLOSED');
  appEvents['web-contents-created']({}, {on:(name,fn)=>contentEvents[name]=fn});
  contentEvents['console-message']({level:'error',message:'private fixture modern'});assert.equal(read(host).rendererErrors,1);
  contentEvents['console-message']({},3,'private fixture legacy');assert.equal(read(host).rendererErrors,2);
  contentEvents['console-message']({level:'warning',message:'private fixture warning'},3,'private fixture deprecated');assert.equal(read(host).rendererErrors,2,'Modern event details take precedence');
  for(let i=2;i<40;i++)if(i%2)contentEvents['console-message']({level:'error',message:'private fixture modern'});else contentEvents['console-message']({},3,'private fixture legacy');
  assert.equal(read(host).rendererErrors,40);assert(read(host).events.length<=32);assert(!JSON.stringify(read(host)).includes('private fixture'));checks.push('EARLY_RENDERER_ERROR_LATCH_SURVIVES_LOG_CAP');
  return {code:'CONTINUATION_SEAM_TEST_PASS',checks,providerRequests:0,electronLaunches:0};
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)&&process.argv.includes('--self-test'))console.log(JSON.stringify(await continuationSelfTest()));
