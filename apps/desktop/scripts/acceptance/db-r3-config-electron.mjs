import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {existsSync,mkdirSync,mkdtempSync,readFileSync,writeFileSync} from 'node:fs';
import {dirname,join,resolve} from 'node:path';
import {setTimeout as wait} from 'node:timers/promises';
import {_electron as electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';
import {withSql} from './db-foundation-r1-task-fixture.mjs';

const desktop=resolve(import.meta.dirname,'../..');
const baseline=process.env.OMNI_EDU_R3_BASELINE_MAIN;
const permissionReference=process.env.OMNI_EDU_R4_PERMISSION_REFERENCE_MAIN;
assert(!(baseline&&permissionReference));
const main=baseline||permissionReference?resolve(baseline||permissionReference):testMain(desktop);
const digest=file=>createHash('sha256').update(readFileSync(file)).digest('hex');
if(baseline)assert.equal(digest(main),process.env.OMNI_EDU_R3_BASELINE_MAIN_SHA256);
if(permissionReference)assert.equal(digest(main),process.env.OMNI_EDU_R4_PERMISSION_REFERENCE_SHA256);
const evidence=resolve(process.env.OMNI_EDU_ACCEPTANCE_ROOT||join(desktop,'test-results','xiaozhi-db-r3'));
const artifacts={};
for(const name of ['evidence','fixtures','images','logs']){
  artifacts[name]=join(evidence,name);mkdirSync(artifacts[name],{recursive:true});
}
const root=mkdtempSync(join(artifacts.fixtures,'R3-electron-'));
const data=join(root,'data'),profile=join(root,'profile');
const report={success:false,sourceMain:main,mainSha256:digest(main),runnerSha256:digest(import.meta.filename),root,checks:[],rendererErrors:[]};
const config=model=>({schemaVersion:'xiaozhi.settings.v1',defaultModel:model});
const a='deepseek-flash', b='deepseek-v4-pro';
const keyA='r3-acceptance-provider-a', keyB='r3-acceptance-provider-b';
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:resolve(desktop,'../..'),
  OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:keyA,GLM_API_KEY:'',DEEPSEEK_MODEL:a};
for(const name of ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'])delete env[name];
let app,page,stage='startup',modelEnvironment=a;
const read=(query,values=[])=>withSql(data,false,db=>db.prepare(query).get(...values));
const rows=(query,values=[])=>withSql(data,false,db=>db.prepare(query).all(...values));
const write=(query,values=[])=>withSql(data,true,db=>db.exec(query,...values));
const cfg=()=>read("SELECT value_json FROM app_settings WHERE key='xiaozhi.provider.v1'");

async function launch(){
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env:{...env,DEEPSEEK_MODEL:modelEnvironment},timeout:60000});
  app.process().stderr?.on('data',chunk=>{
    if(String(chunk).includes('[xiaozhi-journal]'))(report.hostJournalDiagnostics??=[]).push(String(chunk));
  });
  await app.evaluate(({net,app},{a,b,requirePath})=>{
    const sqlite=process.getBuiltinModule('module').createRequire(requirePath)('sqlite3');
    globalThis.r3Fixture={requests:[],models:[a,b],catalogueAttempts:0,pauseCatalogue:false,pausedCatalogue:0,
      failCatalogueAfter:null,holdFirst:true,observedByPi:0};
    const state=globalThis.r3Fixture;
    globalThis.r3Sqlite=sqlite;
    globalThis.r3Runtime={version:process.versions,sqlite:sqlite.VERSION,safeStorage:Boolean(process.getBuiltinModule('electron')?.safeStorage),build:app.getAppPath()};
    if (process.env.OMNI_EDU_R4_DYNAMIC === '1') {
      state.directoryDiagnostics = [];
      const fs = process.getBuiltinModule('node:fs/promises');
      const rename = fs.rename;
      fs.rename = async (from, to) => {
        try {
          if (state.failNextCatalogueRename && String(to).endsWith('deepseek-capabilities.v1.json')) {
            state.failNextCatalogueRename = false;
            state.directoryDiagnostics.push({ kind: 'injected_rename_error', code: 'EPERM' });
            throw Object.assign(new Error('controlled transient Windows sharing failure'), { code: 'EPERM' });
          }
          return await rename(from, to);
        }
        catch (error) {
          if (String(to).endsWith('deepseek-capabilities.v1.json')) {
            state.directoryDiagnostics.push({ kind: 'rename_error', code: error.code });
          }
          throw error;
        }
      };
    }
    net.fetch=async(input,options)=>{
      const url=String(typeof input==='string'?input:input.url);
      if(url.endsWith('/models')){
        const attempt=++state.catalogueAttempts;
        if(state.pauseCatalogue){
          state.pausedCatalogue++;
          const start=Date.now();
          await new Promise(resolve=>{state.releaseCatalogue=resolve;});state.releaseCatalogue=undefined;
          state.directoryDiagnostics?.push({ kind: 'held_catalogue_released', elapsedMs: Date.now()-start,
            aborted: options.signal.aborted, models: [...state.models] });
        }
        if(state.failCatalogueAfter!==null&&attempt>state.failCatalogueAfter)return new Response('{}',{status:503});
        return new Response(JSON.stringify({object:'list',data:state.models.map(id=>({id,
          context_window:1048576,max_output_tokens:32768,input_modalities:['text'],
          effort:{supported_levels:['low','high','max'],default_level:'high'}}))}),{headers:{'content-type':'application/json'}});
      }
      if(!url.endsWith('/chat/completions'))throw Error('Unexpected isolated provider URL');
      const body=JSON.parse(options.body);
      const request={model:body.model,thinking:body.thinking,effort:body.reasoning_effort??null,
        hasTools:Boolean(body.tools?.length),
        protectedSourceDisclosed:JSON.stringify(body.messages).includes('R3-SYNTHETIC-PROTECTED-READBACK'),
        permissionToolAvailable:body.tools?.some(tool=>tool.function?.name==='office_read_text')??false};
      if(process.env.OMNI_EDU_R4_COMBINED==='1'||process.env.OMNI_EDU_R4_PERMISSION_REFERENCE_MAIN){
        request.permissionToolResult=body.messages.find(message=>message.role==='tool'&&message.tool_call_id==='r3_permission_revoke_call')?.content;
      }
      state.requests.push(request);
      state.observedByPi++;
      if(state.holdNext||state.holdFirst&&state.requests.length===1){
        state.holdNext=false;
        await new Promise(resolve=>{state.releasePi=resolve;});
      }
      const chunk=(delta,finish_reason=null)=>'data: '+JSON.stringify({id:'r3-acceptance',object:'chat.completion.chunk',
        created:0,model:body.model,choices:[{index:0,delta,finish_reason}]})+'\n\n';
      const tool=state.nextTool;
      state.nextTool=undefined;
      const providerDelta=tool?chunk({tool_calls:[{index:0,id:'r3_permission_revoke_call',type:'function',
        function:{name:'office_read_text',arguments:JSON.stringify({path:'protected.txt'})}}]},'tool_calls')
        :chunk({content:'合成验收回答。'})+chunk({},'stop');
      return new Response(chunk({role:'assistant',content:''})+providerDelta+'data: [DONE]\n\n',
        {headers:{'content-type':'text/event-stream'}});
    };
  },{a,b,requirePath:join(desktop,'package.json')});
  page=await app.firstWindow();
  page.on('pageerror',error=>report.rendererErrors.push(String(error)));
  assert((await assertIsolatedPiMain(app,main,profile)).modules.length>0);
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  await page.waitForFunction(()=>Boolean(window.omniEdu));
  report.runtime=await app.evaluate(({safeStorage})=>({...globalThis.r3Runtime,safeStorage:safeStorage.isEncryptionAvailable()}));
}
async function close(){
  if(app){await app.close();app=undefined;page=undefined;}
}
function saved(id,value){
  const result={id,fixture:root,mainSha256:report.mainSha256,...value};
  report.checks.push(result);
  writeFileSync(join(artifacts.evidence,id+'-observations.json'),JSON.stringify(result,null,2));
  console.log(JSON.stringify(result));
}
async function until(action,label,timeout=30000){
  const end=performance.now()+timeout;
  while(performance.now()<end){const result=await action();if(result)return result;await wait(50);}
  assert.fail('Timed out: '+label);
}
const hostState=()=>app.evaluate(()=>{const {requests,pausedCatalogue,catalogueAttempts,releasePi}=globalThis.r3Fixture;return {requests,pausedCatalogue,catalogueAttempts,holding:Boolean(releasePi)};});
const configureFixture=input=>app.evaluate((_,value)=>Object.assign(globalThis.r3Fixture,value) && true,input);
const history=(field,sessionId,cursor)=>page.evaluate(input=>window.omniEdu.getXiaozhiConfigHistory(input),{field,sessionId,cursor});
const settings=(query)=>page.evaluate(input=>window.omniEdu.getXiaozhiSettings(input),query);
const resolved=(sessionId,runId)=>page.evaluate(input=>window.omniEdu.getXiaozhiResolvedAgentConfig(input),{sessionId,runId});
const commit=input=>page.evaluate(value=>window.omniEdu.commitXiaozhiConfig(value),{operationId:randomUUID(),...input});
const global=(field,expectedVersion,value,extra)=>commit({field,expectedVersion,value,...extra});
const undo=(field,head,extra)=>page.evaluate(value=>window.omniEdu.undoXiaozhiConfig(value),
  {operationId:randomUUID(),field,changeId:head.changeId,changeVersion:head.version,...extra});
const newSession=title=>page.evaluate(async title=>(await window.omniEdu.createAiConversationSession({title})).session.id,title);
const admitted=(sessionId,prompt,commandId='xicmd_'+randomUUID(),extra)=>page.evaluate(input=>window.omniEdu.startXiaozhi(input),{sessionId,prompt,commandId,...extra});
const releaseRun=()=>app.evaluate(()=>{globalThis.r3Fixture.releasePi();globalThis.r3Fixture.releasePi=undefined;});
async function finished(prompt,sessionId){
  const value=await until(()=>read("SELECT id,model,status FROM ai_agent_runs WHERE session_id=? AND prompt=? AND status<>'running'",[sessionId,prompt]),'run settlement');
  assert.equal(value.status,'succeeded',JSON.stringify(value));
  await until(async()=>!(await settings({sessionId})).value?.locked,'host release');return value;
}
const value=result=>{assert.equal(result.ok,true,JSON.stringify(result));return result.value;};
const scopeView=field=>history(field).then(value);
const staged=apiKey=>page.evaluate(input=>window.omniEdu.stageXiaozhiCredential(input),{schemaVersion:'xiaozhi.settings.v1',apiKey}).then(value);
async function openSettings(){
  if (!await page.getByTestId('pi-model-settings').isVisible()) {
    const shortcut=page.getByRole('button',{name:'小智模型设置',exact:true});
    if(await shortcut.isVisible())await shortcut.click();
    else{
      await page.getByRole('button',{name:'设置',exact:true}).click();
      await page.getByRole('button',{name:'模型与连接',exact:true}).click();
    }
  }
  await page.getByTestId('pi-model-settings').waitFor();
  await until(async()=>!await page.getByTestId('pi-settings-default-model').isDisabled(),'settings ready');
}
async function choose(model){
  await page.getByTestId('pi-settings-default-model').click();
  await page.getByRole('menuitemradio',{name:model,exact:true}).click();
}
async function historyPanel(){
  await page.getByRole('button',{name:'最近配置修改',exact:true}).click();
  await page.getByTestId('pi-config-history-default_model').waitFor();
}

async function checkPermissionRevocation(){
  stage='AC-14 live permission revocation';
  const permissionSession=await newSession('撤销教师目录授权');
  const external=join(root,'permission-fixture');mkdirSync(external);
  writeFileSync(join(external,'protected.txt'),'R3-SYNTHETIC-PROTECTED-READBACK','utf8');
  await app.evaluate(({dialog},selected)=>{
    const original=dialog.showOpenDialog;
    dialog.showOpenDialog=async()=>{dialog.showOpenDialog=original;return {canceled:false,filePaths:[selected]};};
  },external);
  value(await page.evaluate(id=>window.omniEdu.selectXiaozhiWorkspace(id),permissionSession));
  const permissionView=()=>page.evaluate(id=>window.omniEdu.getXiaozhiPermissions(id),permissionSession).then(value);
  const beforeRevoke=await permissionView();
  const eligible=beforeRevoke.grants.filter(grant=>!grant.revokedAt&&grant.scope.kind==='filesystem');
  assert(eligible.length>0);
  const permissionPrompt='请通过当前工作目录读取 protected.txt，报告是否能核对内容。';
  await configureFixture({holdNext:true,nextTool:true});
  const gate=await admitted(permissionSession,permissionPrompt);
  assert.equal(gate.ok,true,JSON.stringify(gate));
  await until(async()=> (await hostState()).holding,'prepared permission run');
  const preparedBefore=(await resolved(permissionSession,gate.runId).then(value)).prepared.receipt;
  assert.equal(preparedBefore.operation,'prompt');
  assert.equal((await hostState()).requests.at(-1).permissionToolAvailable,true);
  for(const grant of eligible){
    const revoked=value(await page.evaluate(data=>window.omniEdu.revokeXiaozhiGrant(data),{
      sessionId:permissionSession,grantId:grant.grantId,revision:grant.revision,
    }));
    assert(revoked.revokedAt);
  }
  await releaseRun();
  const finishedPermission=await until(()=>read("SELECT status,error_message FROM ai_agent_runs WHERE id=? AND status<>'running'",[gate.runId]),'permission result');
  const nativeFile=read('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[permissionSession]).session_file;
  const deniedResult=readFileSync(join(data,'xiaozhi-pi',nativeFile),'utf8').trim().split('\n').map(JSON.parse)
    .find(entry=>entry.message?.role==='toolResult'&&entry.message?.toolCallId==='r3_permission_revoke_call')?.message;
  const denial=read("SELECT phase,admitted,success FROM xiaozhi_tool_receipts WHERE run_id=? AND tool='office_read_text'",[gate.runId]);
  const requestsAfter=(await hostState()).requests;
  assert(!requestsAfter.some(item=>item.protectedSourceDisclosed));
  assert.equal(deniedResult?.isError,true);
  assert.match(JSON.stringify(deniedResult.content),/permission_denied|授权|权限/u);
  report.permissionRedWitness={run:finishedPermission,receipt:denial,nativeResult:deniedResult.content};
  if (process.env.OMNI_EDU_R4_COMBINED === '1' || permissionReference) {
    const outbound = requestsAfter.filter(request => request.permissionToolResult !== undefined)
      .map(request => request.permissionToolResult);
    saved('AC-R4-12-permission-wire', { ...report.permissionRedWitness, outbound });
    if (!permissionReference) {
      assert.equal(outbound.length, 1, 'Pi must deliver the denial to the model in its next request');
      assert.match(JSON.stringify(outbound[0]), /permission_denied|授权|权限/u);
    }
  }
  assert.equal(finishedPermission.status,'succeeded',JSON.stringify(report.permissionRedWitness));
  assert.deepEqual({...denial},{phase:'settled',admitted:0,success:0});
  assert((await permissionView()).grants.every(grant=>grant.revokedAt||grant.scope.kind!=='filesystem'));
  assert.deepEqual((await resolved(permissionSession,gate.runId).then(value)).prepared.receipt,preparedBefore);
  await finished(permissionPrompt,permissionSession);
  saved('AC-14',{runId:gate.runId,grantsRevoked:eligible.map(grant=>grant.grantId),denial,preparedUnchanged:true,disclosed:false});
  return permissionSession;
}

try{
  await launch();
  const initial=await settings({refresh:true}).then(value);
  assert.equal(initial.defaultModel,a);
  if(permissionReference){
    await configureFixture({holdFirst:false});
    await checkPermissionRevocation();
    assert.fail('The archived reference unexpectedly passed the current revocation assertion');
  }
  if(baseline){
    assert.equal((await page.evaluate(input=>window.omniEdu.saveXiaozhiThinking(input),{schemaVersion:'xiaozhi.settings.v1',version:0,choice:'high'})).ok,true);
  }else{
    assert.equal(value(await global('global_thinking',0,'high')).version,1);
  }
  const first=await newSession('R3 合成运行 A'),promptA='R3-AC11 合成运行 A';
  stage='AC-11 first Pi request';
  value(await admitted(first,promptA));
  await until(async()=> (await hostState()).holding,'first real Pi request');
  const runA=read("SELECT id,model,status FROM ai_agent_runs WHERE prompt=?",[promptA]);
  const before=await resolved(first,runA.id).then(value);
  assert.equal(before.prepared.receipt.modelValue,a);
  assert.equal(before.prepared.receipt.thinking.requested,'high');
  if(baseline){
    const old=await page.evaluate(input=>window.omniEdu.saveXiaozhiSettings(input),{...config(b),version:0});
    saved('AC-11-baseline',{observed:old,firstPi:(await hostState()).requests[0],expected:'Save commits while an admitted Pi run is active'});
    assert.equal(old.ok,true,'Behavior red: the baseline rejects the allowed ordinary model edit during the active run');
  }
  stage='AC-11 online mutation';
  const thinking=value(await global('global_thinking',1,'low'));
  const model=value(await global('default_model',initial.version,b));
  assert.equal(thinking.outcome,'committed');assert.equal(model.outcome,'committed');
  assert.equal((await resolved(first,runA.id).then(value)).prepared.receipt.thinking.requested,'high');
  await app.evaluate(()=>{globalThis.r3Fixture.releasePi();globalThis.r3Fixture.releasePi=undefined;});
  await finished(promptA,first);
  const piA=(await hostState()).requests[0];assert.equal(piA.model,a);assert.equal(piA.effort,'high');
  saved('AC-11',{admitted:before.prepared.receipt,actualRequest:piA,commits:[thinking,model]});

  stage='AC-12 next and bound sessions';
  const next=await newSession('R3 合成运行 B'),promptB='R3-AC12 新会话';
  value(await admitted(next,promptB));const runB=await finished(promptB,next);
  const preparedB=(await resolved(next,runB.id).then(value)).prepared.receipt;
  assert.equal(preparedB.modelValue,b);assert.equal(preparedB.thinking.requested,'low');
  const continued='R3-AC12 同一已绑定会话';
  value(await admitted(first,continued));const runA2=await finished(continued,first);
  const preparedA2=(await resolved(first,runA2.id).then(value)).prepared.receipt;
  assert.equal(preparedA2.modelValue,a);assert.equal(preparedA2.model.source,'session_binding');
  const native=rows('SELECT conversation_id,session_file,model FROM xiaozhi_pi_session_bindings WHERE conversation_id IN (?,?)',[first,next]);
  assert.deepEqual(Object.fromEntries(native.map(row=>[row.conversation_id,row.model])),{[first]:a,[next]:b});
  assert.equal(native.length,2);
  saved('AC-12',{first:preparedA2,next:preparedB,bindings:native,requests:(await hostState()).requests});

  stage='AC-01 and IPC history scopes';
  const inherited=value(await history('session_thinking',first));
  assert.equal(inherited.value,null);
  const readGlobal=await scopeView('global_thinking');
  assert.equal(readGlobal.value,'low');
  const auto=value(await commit({field:'session_thinking',sessionId:first,expectedVersion:0,value:'auto'}));
  assert.equal(value(await history('session_thinking',first)).value,'auto');
  assert.equal(value(await history('session_thinking',next)).value,null);
  const autoSource=(await resolved(first).then(value)).thinking;
  const inheritReceipt=value(await commit({field:'session_thinking',sessionId:first,expectedVersion:auto.version,value:null}));
  const inheritedSource=(await resolved(first).then(value)).thinking;
  assert.equal(autoSource.source,'session_selection');assert.equal(autoSource.value,'auto');
  assert.equal(inheritedSource.source,'global');assert.equal(inheritedSource.value,'low');
  saved('AC-01',{global:readGlobal.value,explicit:autoSource,inherited:inheritedSource,receipt:inheritReceipt});

  stage='AC-04 atomic fault';
  const beforeFault=await scopeView('global_thinking');
  const operations=()=>read('SELECT count(*) AS count FROM xiaozhi_config_operations_v1').count;
  const priorCount=operations();
  write("CREATE TRIGGER r3_test_reject_receipt BEFORE INSERT ON xiaozhi_config_operations_v1 BEGIN SELECT RAISE(ABORT,'r3 controlled receipt failure'); END;");
  let rejected;
  try{rejected=await global('global_thinking',beforeFault.version,'high');}
  finally{write('DROP TRIGGER r3_test_reject_receipt');}
  assert.deepEqual(rejected,{ok:false,error:'unavailable'});
  assert.deepEqual(await scopeView('global_thinking'),beforeFault);assert.equal(operations(),priorCount);
  saved('AC-04',{fault:rejected,fieldUnchanged:true,receiptsBefore:priorCount,receiptsAfter:operations()});

  stage='AC-05 and AC-06 no-op and idempotency';
  const noop=value(await global('global_thinking',beforeFault.version,beforeFault.value));
  assert.equal(noop.outcome,'no_change');assert.equal(noop.version,beforeFault.version);
  assert.deepEqual(await scopeView('global_thinking'),beforeFault);
  saved('AC-05',{receipt:noop,fieldAndHeadUnchanged:true});
  const idempotent={operationId:randomUUID(),field:'global_thinking',expectedVersion:beforeFault.version,value:'high'};
  const [firstCommit,repeat]=await Promise.all([commit(idempotent),commit(idempotent)]);
  assert.deepEqual(value(firstCommit),value(repeat));
  assert.equal((await commit({...idempotent,value:'low'})).error,'invalid_input');
  saved('AC-06',{first:firstCommit.value,repeat:repeat.value,changedPayload:'invalid_input'});

  stage='AC-08 concurrency';
  const version=(await scopeView('global_thinking')).version;
  const contenders=await Promise.all([global('global_thinking',version,'low'),global('global_thinking',version,'max')]);
  assert.equal(contenders.filter(entry=>entry.ok).length,1);
  assert.equal(contenders.filter(entry=>entry.error==='conflict').length,1);
  saved('AC-08',{contenders});

  stage='AC-09 credential-only and AC-18 field undo';
  const modelBefore=await scopeView('default_model');
  const rotateA=value(await global('default_model',modelBefore.version,b,await staged(keyA)));
  assert.equal(rotateA.changeId,null);assert.equal((await scopeView('default_model')).undo.changeId,modelBefore.undo.changeId);
  const changed=value(await global('default_model',rotateA.version,a));
  const rotated=value(await global('default_model',changed.version,a,await staged(keyB)));
  assert.equal(rotated.changeId,null);
  const head=(await scopeView('default_model')).undo;
  const sealed=JSON.parse(cfg().value_json).sealedKey;
  const operationId=randomUUID();
  const un=value(await undo('default_model',head,{operationId}));
  assert.equal(un.outcome,'committed');
  const current=JSON.parse(cfg().value_json);
  assert.equal(current.defaultModel,b);assert.equal(current.sealedKey,sealed);
  const safe=await app.evaluate(({safeStorage},cipher)=>safeStorage.isEncryptionAvailable()&&safeStorage.decryptString(Buffer.from(cipher,'base64'))==='r3-acceptance-provider-b',sealed);
  assert.equal(safe,true);
  assert.equal(read('SELECT model FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[first]).model,a);
  const replay=value(await undo('default_model',head,{operationId}));
  assert.deepEqual(replay,un);
  const secondUndo=await undo('default_model',{changeId:un.changeId,version:un.version});
  assert.equal(secondUndo.error,'stale_change');assert.equal((await scopeView('default_model')).undo,null);
  const ledger=JSON.stringify(rows('SELECT * FROM xiaozhi_config_operations_v1'))+JSON.stringify(rows('SELECT * FROM xiaozhi_config_changes_v1'));
  for(const secret of [keyA,keyB,sealed]){assert(!ledger.includes(secret));assert(!ledger.includes(createHash('sha256').update(secret).digest('hex')));}
  saved('AC-09',{credentialOnlyReceipts:[rotateA,rotated],nonSecretLedger:true});
  saved('AC-18',{receipt:un,defaultModel:current.defaultModel,actualSafeStorage:true,sameCiphertext:true,binding:a});
  saved('AC-20',{receipt:un,repeat:replay,repeatedUndoDenied:secondUndo});

  stage='AC-10 and AC-22 external validation';
  let currentModel=await scopeView('default_model');
  await configureFixture({models:[a]});
  const invalidCurrent=await global('default_model',currentModel.version,b);
  assert.equal(invalidCurrent.error,'model_unavailable');
  assert.deepEqual(await scopeView('default_model'),currentModel);
  await configureFixture({models:[b]});
  assert.equal((await global('default_model',currentModel.version,a)).error,'model_unavailable');
  await configureFixture({models:[a,b]});
  value(await global('default_model',currentModel.version,a));
  currentModel=await scopeView('default_model');
  await configureFixture({models:[a]});
  const removed=await undo('default_model',currentModel.undo);
  assert.equal(removed.error,'model_unavailable');assert.deepEqual(await scopeView('default_model'),currentModel);
  await configureFixture({models:[a,b],pauseCatalogue:true});
  // B is not the current override; its validation waits outside the database writer.
  const wouldRace=global('default_model',currentModel.version,b);
  await until(async()=> (await hostState()).pausedCatalogue===1,'official model preflight');
  const concurrent=value(await global('default_model',currentModel.version,null));
  await app.evaluate(()=>{
    const fixture=globalThis.r3Fixture;
    fixture.pauseCatalogue=false;
    if(process.env.OMNI_EDU_R4_RENAME_FAULT==='1') fixture.failNextCatalogueRename=true;
    fixture.releaseCatalogue();
  });
  const race=await wouldRace;
  assert.deepEqual(race,{ok:false,error:'conflict'});
  assert.equal((await scopeView('default_model')).value,null);
  saved('AC-10',{removedCurrent:invalidCurrent,unknown:'model_unavailable',concurrentClear:concurrent,latePreflight:race});
  if (process.env.OMNI_EDU_R4_RENAME_FAULT === '1') {
    const diagnostics = await app.evaluate(() => globalThis.r3Fixture.directoryDiagnostics);
    assert.equal(diagnostics.filter(item => item.kind === 'injected_rename_error').length, 1);
    saved('AC-R4-11-catalogue-replace', { diagnostics, staleCommitRejected: race.error });
  }
  saved('AC-22',{removed,unchangedRevision:currentModel.version,undoStillAvailable:true});

  stage='AC-07 model commit and refresh downgrade';
  await openSettings();
  await choose(b);
  const at=(await hostState()).catalogueAttempts;
  await configureFixture({failCatalogueAfter:at+1});
  await page.getByTestId('pi-settings-save').click();
  const feedback=page.getByTestId('pi-settings-feedback');
  await until(async()=> (await feedback.textContent())?.includes('已保存。')&&(await feedback.textContent())?.includes('刷新失败'),'committed and independent refresh failure');
  const receiptView=await scopeView('default_model');
  assert.equal(receiptView.value,b);
  await page.screenshot({path:join(artifacts.images,'AC-07.png')});
  await configureFixture({failCatalogueAfter:null});
  const successfulRefresh=await settings({refresh:true}).then(value);
  assert.equal(successfulRefresh.catalogueError,undefined);
  await close();modelEnvironment=b;await launch();
  assert.equal((await scopeView('default_model')).value,b);
  saved('AC-07',{receipt:receiptView.items[0],independentRefreshRecovered:true,coldReadBack:true,screenshot:'images/AC-07.png'});

  stage='AC-17 and AC-21 exact field head';
  let globalThinking=await scopeView('global_thinking');
  // Two saves of the same value with a distinct intervening head exercise ABA.
  for(const selected of ['high','low','high'])globalThinking=await scopeView('global_thinking').then(async existing=>{
    if(existing.value!==selected)value(await global('global_thinking',existing.version,selected));
    return scopeView('global_thinking');
  });
  const olderHead=globalThinking.undo;
  globalThinking=await scopeView('global_thinking');
  value(await global('global_thinking',globalThinking.version,'low'));
  let currentHead=(await scopeView('global_thinking')).undo;
  value(await global('global_thinking',currentHead.version,'high'));
  currentHead=(await scopeView('global_thinking')).undo;
  assert.notEqual(currentHead.changeId,olderHead.changeId);
  const oldPointer=await undo('global_thinking',olderHead);
  assert.deepEqual(oldPointer,{ok:false,error:'stale_change'});
  assert.equal((await scopeView('global_thinking')).undo.changeId,currentHead.changeId);
  let currentDefaults=await scopeView('default_model');
  value(await global('default_model',currentDefaults.version,null));
  assert.equal((await scopeView('global_thinking')).undo.changeId,currentHead.changeId);
  const abaReceipt=value(await undo('global_thinking',currentHead));
  assert.equal((await scopeView('global_thinking')).value,'low');
  saved('AC-21',{oldPointer,currentHead,receipt:abaReceipt,unrelatedDefaultChangePreservedHead:true});
  const high=value(await global('global_thinking',abaReceipt.version,'high'));
  const low=value(await global('global_thinking',high.version,'low'));
  const stopped=value(await undo('global_thinking',{changeId:low.changeId,version:low.version}));
  const ended=await scopeView('global_thinking');
  assert.equal(ended.value,'high');assert.equal(ended.undo,null);
  assert(ended.items.some(item=>item.changeId===low.changeId&&item.undone));
  assert(ended.items.some(item=>item.changeId===stopped.changeId&&item.kind==='undo'));
  saved('AC-17',{high,low,undo:stopped,value:ended.value,mayUndoAgain:false});

  stage='AC-19 session undo to inheritance';
  let scoped=value(await history('session_thinking',next));
  assert.equal(scoped.value,null);
  const scopedAuto=value(await commit({field:'session_thinking',sessionId:next,expectedVersion:scoped.version,value:'auto'}));
  assert.equal((await resolved(next).then(value)).thinking.source,'session_selection');
  const inherit=value(await undo('session_thinking',{changeId:scopedAuto.changeId,version:scopedAuto.version},{sessionId:next}));
  const currentResolution=(await resolved(next).then(value)).thinking;
  assert.equal(currentResolution.value,'high');assert.equal(currentResolution.source,'global');
  assert.equal(value(await history('session_thinking',next)).value,null);
  saved('AC-19',{explicitAuto:scopedAuto,undo:inherit,sourceAfter:currentResolution});

  stage='AC-23 history and draft';
  assert.equal(value(await history('session_thinking',await newSession('空历史和跨会话游标'))).items.length,0);
  currentDefaults=await scopeView('default_model');
  value(await global('default_model',currentDefaults.version,b));
  const bulk=await scopeView('global_thinking');
  let rev=bulk.version;
  for(let i=0;i<21;i++)rev=value(await global('global_thinking',rev,i%2===0?'auto':'low')).version;
  await openSettings();await choose(a);await historyPanel();
  const section=page.getByTestId('pi-config-history-global_thinking');
  await until(async()=>await section.locator('li').count()===20,'first bounded UI history page');
  await section.getByRole('button',{name:'较早一页'}).click();
  await until(async()=> {const count=await section.locator('li').count();return count>0&&count<20;},'second UI history page');
  const headPage=await scopeView('global_thinking');
  assert.equal(headPage.items.length,20);
  const older=value(await history('global_thinking',undefined,headPage.cursor));
  assert(older.items.length>0&&older.items.length<=20);
  assert.equal(new Set([...headPage.items,...older.items].map(item=>item.changeId)).size,headPage.items.length+older.items.length);
  assert.equal((await history('default_model',undefined,headPage.cursor)).error,'invalid_input');
  assert.equal((await history('global_thinking',undefined,headPage.cursor.slice(0,-2)+'zz')).error,'invalid_input');
  assert.equal((await history('session_thinking','aisession_'+randomUUID())).error,'permission_denied');
  saved('AC-16',{first:headPage.items.length,next:older.items.length,scopeBound:true,tamperRejected:true});
  const concurrentModel=await scopeView('default_model');
  value(await global('default_model',concurrentModel.version,null));
  await page.getByRole('button',{name:'可用模型与账户信息',exact:true}).click();
  await page.getByTestId('pi-settings-refresh').click();
  await page.getByTestId('pi-settings-draft-conflict').waitFor();
  assert((await page.getByTestId('pi-settings-default-model').textContent()).includes(a));
  assert(await page.getByTestId('pi-settings-save').isDisabled());
  await page.screenshot({path:join(artifacts.images,'AC-23.png')});
  saved('AC-23',{boundedPages:true,conflict:true,draftPreserved:true,screenshot:'images/AC-23.png'});

  stage='AC-24 keyboard undo';
  await page.getByTestId('pi-settings-discard').click();
  await configureFixture({holdFirst:false,holdNext:true});
  const activePrompt='R3-AC24 合成后台运行';
  value(await admitted(first,activePrompt));
  await until(async()=> (await hostState()).holding,'teacher task continues while settings open');
  const beforeUndoRun=read("SELECT id,status FROM ai_agent_runs WHERE prompt=?",[activePrompt]);
  assert.equal(beforeUndoRun.status,'running');
  const button=page.getByTestId('pi-config-undo-default_model');
  await page.getByTestId('pi-config-refresh-default_model').click();
  await until(async()=>await button.getAttribute('aria-disabled')==='false','available undo');
  await button.focus();await page.keyboard.press('Enter');
  await until(async()=> (await page.getByTestId('pi-config-feedback-default_model').textContent())?.includes('已撤回'),'undo feedback');
  assert.equal(await page.evaluate(()=>document.activeElement?.getAttribute('data-testid')),'pi-config-undo-default_model');
  assert.equal((await scopeView('default_model')).value,b);
  await page.screenshot({path:join(artifacts.images,'AC-24.png')});
  assert.equal(read("SELECT status FROM ai_agent_runs WHERE id=?",[beforeUndoRun.id]).status,'running');
  await releaseRun();
  const finishedDuringUndo=await finished(activePrompt,first);
  assert.equal(finishedDuringUndo.id,beforeUndoRun.id);
  saved('AC-24',{keyboard:'Enter',focusPreserved:true,runId:finishedDuringUndo.id,sameRunCompleted:true,screenshot:'images/AC-24.png'});
  stage='AC-13 pending admission, replay and cold continuation';
  const queuedSession=await newSession('待接纳的合成教学任务');
  const queuedPrompt='请整理一项合成教学任务，保留原任务判据42，并核对是否满足要求。';
  const command='xicmd_'+randomUUID();
  await app.evaluate(()=>{process.env.OMNI_EDU_E2E_PI_COMMAND_DELAY_MS='3500';});
  await configureFixture({holdNext:true,holdFirst:false});
  const queued=admitted(queuedSession,queuedPrompt,command);
  const marker=join(data,'.e2e-pi-command-claimed');
  await until(()=>existsSync(marker)&&readFileSync(marker,'utf8')===command,'pending command ownership before capture');
  assert.equal(read('SELECT id FROM ai_agent_runs WHERE prompt=?',[queuedPrompt]),undefined);
  let liveThinking=await scopeView('global_thinking');
  if(liveThinking.value!=='high')value(await global('global_thinking',liveThinking.version,'high'));
  const accepted=await queued;
  assert.equal(accepted.ok,true,JSON.stringify(accepted));
  await app.evaluate(()=>{delete process.env.OMNI_EDU_E2E_PI_COMMAND_DELAY_MS;});
  await until(async()=> (await hostState()).holding,'pinned request after delayed admission');
  const queuedPrepared=(await resolved(queuedSession,accepted.runId).then(value)).prepared.receipt;
  assert.equal(queuedPrepared.thinking.requested,'high');
  liveThinking=await scopeView('global_thinking');
  value(await global('global_thinking',liveThinking.version,'low'));
  const repeated=await admitted(queuedSession,queuedPrompt,command);
  assert.deepEqual(repeated,accepted);
  const same=(await resolved(queuedSession,accepted.runId).then(value)).prepared.receipt;
  assert.deepEqual(same,queuedPrepared);
  let task=await page.evaluate(sessionId=>window.omniEdu.getXiaozhiTask({sessionId}),queuedSession).then(value);
  assert(task.task?.criteria.some(item=>item.text.includes('原任务判据42')));
  const stop=page.evaluate(sessionId=>window.omniEdu.stopXiaozhi(sessionId),queuedSession);
  await wait(250);await releaseRun();
  assert.equal((await stop).ok,true);
  await until(async()=>!(await settings({sessionId:queuedSession})).value?.locked,'stopped task host release');
  task=await page.evaluate(sessionId=>window.omniEdu.getXiaozhiTask({sessionId}),queuedSession).then(value);
  assert(['paused','interrupted','review_required'].includes(task.task.state),JSON.stringify(task.task));
  await close();await launch();await configureFixture({holdFirst:false});
  const continuation='继续归纳上次已经确认的原任务要求。';
  const resumed=await admitted(queuedSession,continuation,undefined,{
    continueTask:{taskId:task.task.id,requirementsVersion:task.task.requirementsVersion},
  });
  assert.equal(resumed.ok,true,JSON.stringify(resumed));
  assert.notEqual(resumed.runId,accepted.runId);
  await finished(continuation,queuedSession);
  const afterTask=(await page.evaluate(sessionId=>window.omniEdu.getXiaozhiTask({sessionId}),queuedSession).then(value)).task;
  assert.equal(afterTask.id,task.task.id);
  assert.equal(afterTask.requirementsVersion,task.task.requirementsVersion);
  assert.deepEqual(afterTask.criteria,task.task.criteria);
  const cold=(await resolved(queuedSession,resumed.runId).then(value)).prepared.receipt;
  assert.equal(cold.thinking.requested,'low');
  saved('AC-13',{beforeAdmissionHadNoRun:true,first:accepted.runId,replayed:repeated.runId,newRun:resumed.runId,
    firstThinking:queuedPrepared.thinking,coldThinking:cold.thinking,sameTask:afterTask.id,criteriaPreserved:true});

  const permissionSession=await checkPermissionRevocation();

  stage='AC-15 production ownership and AC-27 negative IPC';
  const factSql="SELECT key,value_json FROM app_settings WHERE key GLOB 'xiaozhi.task.v1:*' OR key GLOB 'teacher.*' ORDER BY key";
  const boundary=()=>({
    taskAndTeacher:rows(factSql),
    runtime:rows('SELECT run_id,payload_json FROM xiaozhi_prepared_runs_v1 ORDER BY run_id'),
    permission:rows('SELECT * FROM xiaozhi_permission_grants_v1 ORDER BY 1'),
    native:rows('SELECT conversation_id,model FROM xiaozhi_pi_session_bindings ORDER BY 1'),
  });
  const beforeBoundary=boundary(), beforeOrdinary=await scopeView('global_thinking');
  assert(beforeBoundary.taskAndTeacher.some(row=>row.key.includes(afterTask.id)));
  assert(beforeBoundary.permission.length>0);assert(beforeBoundary.runtime.length>0);
  const ordinary=value(await global('global_thinking',beforeOrdinary.version,'auto'));
  assert.deepEqual(boundary(),beforeBoundary);
  const teacher=await page.evaluate(()=>window.omniEdu.getTeacherMemorySettings()).then(value);
  const requests=await page.evaluate(async({operationId,sessionId})=>{
    const edit={operationId,field:'session_thinking',sessionId,expectedVersion:0,value:'auto'};
    return [
      await window.omniEdu.commitXiaozhiConfig({...edit,sessionId:'../invalid'}),
      await window.omniEdu.commitXiaozhiConfig({...edit,unlisted:'value'}),
      await window.omniEdu.commitXiaozhiConfig({...edit,expectedVersion:2**54}),
      await window.omniEdu.commitXiaozhiConfig({...edit,field:'permission'}),
      await window.omniEdu.getXiaozhiConfigHistory({field:'default_model',sessionId}),
      await window.omniEdu.getXiaozhiConfigHistory({field:'global_thinking',cursor:'a'.repeat(257)}),
    ];
  },{operationId:randomUUID(),sessionId:permissionSession});
  assert(requests.every(result=>!result.ok&&result.error==='invalid_input'));
  assert.deepEqual(await page.evaluate(()=>window.omniEdu.getTeacherMemorySettings()).then(value),teacher);
  const ordinaryBeforeNative=await scopeView('default_model');
  const selected=await settings({sessionId:first}).then(value);
  const switched=value(await page.evaluate(input=>window.omniEdu.selectXiaozhiModel(input),
    {schemaVersion:'xiaozhi.settings.v1',sessionId:first,version:selected.sessionModel.version,model:b}));
  assert.equal(switched.model,b);
  assert.equal(read('SELECT model FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[first]).model,b);
  assert.deepEqual(await scopeView('default_model'),ordinaryBeforeNative);
  saved('AC-15',{ordinary,unchangedTaskRecords:beforeBoundary.taskAndTeacher.length,unchangedPrepared:beforeBoundary.runtime.length,
    unchangedPermission:beforeBoundary.permission.length,nativeSwitchKeptSeparate:true,teacherPreferencesRevision:teacher.preference.revision});
  saved('AC-27',{strictInputs:requests,rendererErrors:report.rendererErrors,electron:report.runtime.version.electron});
  if (process.env.OMNI_EDU_R4_COMBINED === '1') {
    stage = 'AC-R4-10 combined credential and default model';
    const before = await scopeView('default_model');
    assert.equal(before.value, b);
    const beforeJson = cfg().value_json;
    const beforeReceipts = operations();
    const testKey = 'r4-acceptance-combined-credential';
    await openSettings();
    await choose(a);
    await page.getByTestId('pi-settings-key').fill(testKey);
    const button = page.getByTestId('pi-settings-save');
    const feedback = page.getByTestId('pi-settings-feedback');

    const attempts = (await hostState()).catalogueAttempts;
    await configureFixture({ failCatalogueAfter: attempts });
    try {
      await button.click();
      await feedback.waitFor();
      assert.doesNotMatch(await feedback.innerText(), /已保存/);
      assert.equal(await page.getByTestId('pi-settings-key').inputValue(), testKey);
      assert.equal(cfg().value_json, beforeJson);
      assert.deepEqual(await scopeView('default_model'), before);
      assert.equal(operations(), beforeReceipts);
    } finally {
      await configureFixture({ failCatalogueAfter: null });
    }

    write("CREATE TRIGGER r4_reject_config_receipt BEFORE INSERT ON xiaozhi_config_operations_v1 BEGIN SELECT RAISE(ABORT,'r4 controlled receipt failure'); END;");
    try {
      await button.click();
      await feedback.waitFor();
      assert.doesNotMatch(await feedback.innerText(), /已保存/);
      assert.equal(await page.getByTestId('pi-settings-key').inputValue(), testKey);
      assert.equal(cfg().value_json, beforeJson);
      assert.deepEqual(await scopeView('default_model'), before);
      assert.equal(operations(), beforeReceipts);
    } finally {
      write('DROP TRIGGER r4_reject_config_receipt');
    }

    await button.click();
    await until(async () => (await feedback.innerText()).startsWith('已保存。'), 'combined form receipt');
    const after = await scopeView('default_model');
    const atomicallySaved = JSON.parse(cfg().value_json);
    assert.equal(after.version, before.version + 1);
    assert.equal(after.value, a);
    assert.equal(atomicallySaved.defaultModel, a);
    assert.notEqual(atomicallySaved.sealedKey, JSON.parse(beforeJson).sealedKey);
    assert.equal(operations(), beforeReceipts + 1);
    assert.equal(after.items[0].changeId, after.undo.changeId);
    assert.equal(after.items[0].previous, b);
    assert.equal(await page.getByTestId('pi-settings-key').inputValue(), '');
    const restored = value(await undo('default_model', after.undo));
    const afterUndo = JSON.parse(cfg().value_json);
    assert.equal(afterUndo.defaultModel, b);
    assert.equal(afterUndo.sealedKey, atomicallySaved.sealedKey);
    const latestCredentialPreserved = await app.evaluate(({ safeStorage }, { ciphertext, cleartext }) =>
      safeStorage.isEncryptionAvailable() && safeStorage.decryptString(Buffer.from(ciphertext, 'base64')) === cleartext,
    { ciphertext: afterUndo.sealedKey, cleartext: testKey });
    assert.equal(latestCredentialPreserved, true);
    const publicData = JSON.stringify({
      ledger: rows('SELECT * FROM xiaozhi_config_operations_v1'),
      history: await scopeView('default_model'),
      resolved: await resolved(first).then(value),
      diagnostics: report.hostJournalDiagnostics,
      checks: report.checks,
    });
    for (const secret of [testKey, afterUndo.sealedKey, JSON.parse(beforeJson).sealedKey]) {
      assert(!publicData.includes(secret));
      assert(!publicData.includes(createHash('sha256').update(secret).digest('hex')));
    }
    saved('AC-R4-10', { fieldVersion: after.version, changeId: after.undo.changeId, restored,
      catalogueFailureAtomic: true, receiptFailureAtomic: true, safeStoragePreserved: true, publicEvidenceRedacted: true });
  }

  if (process.env.OMNI_EDU_R4_DYNAMIC === '1') {
    stage = 'AC-R4-09 dynamic inheritance after undo';
    const inherited = await newSession('R4 动态继承测试');
    const explicit = await newSession('R4 保留会话自动设置');
    const available = await scopeView('global_thinking');
    value(await global('global_thinking', available.version, 'high'));
    for (const sessionId of [inherited, explicit]) {
      const initial = value(await history('session_thinking', sessionId));
      assert.equal(initial.value, null);
      value(await commit({ field: 'session_thinking', sessionId, value: 'auto', expectedVersion: initial.version }));
      assert.equal(value(await history('session_thinking', sessionId)).value, 'auto');
    }
    const head = value(await history('session_thinking', inherited)).undo;
    const undone = value(await undo('session_thinking', head, { sessionId: inherited }));
    const high = value(await resolved(inherited)).thinking;
    assert.equal(high.source, 'global');
    assert.equal(high.value, 'high');
    assert.equal(value(await history('session_thinking', inherited)).value, null);
    const lower = value(await global('global_thinking', (await scopeView('global_thinking')).version, 'low'));
    const low = value(await resolved(inherited)).thinking;
    const observedExplicit = value(await resolved(explicit)).thinking;
    assert.equal(low.source, 'global');
    assert.equal(low.value, 'low');
    assert.equal(observedExplicit.source, 'session_selection');
    assert.equal(observedExplicit.value, 'auto');
    const last = (await hostState()).requests.length;
    const records = [];
    const prompt = '请完整推导一元一次方程 2(x-3)=x+5 的解，并代回验证。';
    for (const [sessionId, expected] of [[inherited, 'low'], [explicit, 'auto']]) {
      const admittedRun = await admitted(sessionId, prompt);
      assert.equal(admittedRun.ok, true, JSON.stringify(admittedRun));
      await finished(prompt, sessionId);
      const prepared = value(await resolved(sessionId, admittedRun.runId)).prepared.receipt;
      assert.equal(prepared.thinking.requested, expected);
      assert.equal(prepared.thinking.source, expected === 'low' ? 'global' : 'session_selection');
      assert.equal(prepared.thinking.effective, expected === 'low' ? 'low' : 'high');
      records.push({ sessionId, runId: admittedRun.runId, thinking: prepared.thinking });
    }
    const outgoing = (await hostState()).requests.slice(last);
    assert.equal(outgoing.length, 2);
    assert.equal(outgoing[0].effort, 'low');
    assert.equal(outgoing[1].effort, 'high');
    saved('AC-R4-09', { target: head.changeId, undone, lower, high, low, explicit: observedExplicit, records, outgoing });
  }

  assert.deepEqual(report.rendererErrors,[]);
  report.success=true;
}catch(error){
  report.failedAt=stage;report.error=String(error.stack??error);
  if (app && process.env.OMNI_EDU_R4_DYNAMIC === '1') {
    report.directoryDiagnostics=await app.evaluate(()=>globalThis.r3Fixture.directoryDiagnostics).catch(()=>undefined);
  }
  if(page)await page.screenshot({path:join(root,'failure.png')}).catch(()=>{});
  process.exitCode=1;
}finally{
  await close();
  writeFileSync(join(root,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,failedAt:report.failedAt,error:report.error,report:join(root,'report.json')}));
}
