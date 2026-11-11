/** Finite, opt-in NEW genuine retained baseline. Root owns actual execution.
 * Run --self-test for pure transport/input checks, --run-ui --pins=... for UI.
 * Only teacher-authored arithmetic PDF input, real production Pi/tools/host/UI.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {validateCatalogue} from './acceptance/ui-final-queue-recovery.mjs';
import {productEntry} from './product-navigation.mjs';
import {fixtureCases,arithmeticPdf,proposalFor,projectionFor,inputSelfTest,planContract,fixturePlanSteps} from './acceptance/retained-fixture-input.mjs';
import {installRetainedFixtureProvider,retainedProviderControl} from './acceptance/retained-fixture-provider.mjs';
import {fixtureSchema,fixtureBudget,fixtureParent,fixtureScriptHashes,ownedExact,safeTree,readSql,snapshot,snapshotHash,retainRows,inspectCases,nativeMessages,readFixtureManifest} from './acceptance/retained-fixture-evidence.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),args=process.argv.slice(2);
if(args.length===1&&args[0]==='--self-test') {
  const {retainedFixtureSelfTest}=await import('./acceptance/retained-fixture-selftest.mjs');
  const checks=[...inputSelfTest(),...await retainedFixtureSelfTest(desktop)];
  console.log(JSON.stringify({success:true,scope:'pure QA input/transport/path contract only',checks,
    electronLaunches:0,piTasks:0,externalRequests:0,applicationDatabasesWritten:0}));
  process.exit(0);
}
const started=Date.now(),deadlineAt=started+fixtureBudget.totalMs;
assert(args.length===2&&args.includes('--run-ui'),'Explicit --run-ui --pins=<frozen pins> required');
const pinsArg=args.find(arg=>arg.startsWith('--pins='));assert(pinsArg);
const owned=path.join(desktop,'test-results'),pinsFile=ownedExact(path.resolve(desktop,pinsArg.slice(7)),owned);
const pins=JSON.parse(fs.readFileSync(pinsFile,'utf8'));
ownedExact(pins.buildRoot,owned);process.env.OMNI_EDU_TEST_BUILD_ROOT=pins.buildRoot;
const main=testMain(desktop),verify=()=>{
  assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source,'Frozen current source');
  assert.equal(fingerprint(pins.buildRoot).sha256,pins.build,'Frozen real build');
};
verify();
const parent=fixtureParent(desktop);fs.mkdirSync(parent,{recursive:true});
ownedExact(parent,owned);
const output=fs.mkdtempSync(path.join(parent,'run-')),sourceRoot=path.join(output,'baseline');
const data=path.join(sourceRoot,'data'),profile=path.join(sourceRoot,'profile'),workspace=path.join(sourceRoot,'workspace');
for(const dir of [data,profile,workspace])fs.mkdirSync(dir,{recursive:true});
const inputFile=path.join(workspace,'teacher-authored-arithmetic.pdf'),inputBytes=arithmeticPdf();
fs.writeFileSync(inputFile,inputBytes,{flag:'wx'});
const cacheSource=ownedExact(path.join(owned,'ui-final-dialogue-20261111/catalogue/data/xiaozhi-pi/deepseek-capabilities.v1.json'),owned);
const catalogueBytes=fs.readFileSync(cacheSource),model='deepseek-flash';
const catalogue=validateCatalogue(catalogueBytes,model),cache=path.join(data,'xiaozhi-pi/deepseek-capabilities.v1.json');
fs.mkdirSync(path.dirname(cache),{recursive:true});fs.copyFileSync(cacheSource,cache,fs.constants.COPYFILE_EXCL);
assert.deepEqual(fs.readFileSync(cache),catalogueBytes);
const reportFile=path.join(output,'report.json');
const report={schemaVersion:fixtureSchema,success:false,output,sourceRoot,pins:{source:pins.source,build:pins.build},budget:fixtureBudget,
  scripts:fixtureScriptHashes(desktop),
  launches:0,submissions:0,checks:[],screens:[],errors:[],cases:[],catalogue:{...catalogue,source:cacheSource},
  input:{file:inputFile,sha256:sha256(inputBytes),kind:'teacher-authored synthetic arithmetic PDF',pages:3,embeddedRaster:true},
  boundaries:['Controlled SSE supplies tool requests only. Real permission checks, Pi events, tool results, parser and host PNG/approval/SQLite remain authoritative.',
    'Proxy operates the visible teacher review against explicit authored truth. No natural model vision, autonomous OCR/answer accuracy or human acceptance claim.',
    'New arithmetic cases keep their own identities. Historical three source cases and failures remain historical.',
    'No paid/native network request. Official capability cache is byte-copied with its original observation time.']};
const save=()=>fs.writeFileSync(reportFile,JSON.stringify(report,null,2)+'\n');
const check=id=>{report.checks.push({id,pass:true});save();};
let app,page,child,sessionId,resource,phase='preflight',timedOut=false;
const remaining=()=>{assert(!timedOut&&Date.now()<deadlineAt-2000,'RETAINED_240S_DEADLINE');return deadlineAt-Date.now()-2000;};
const delay=ms=>new Promise(resolve=>setTimeout(resolve,ms));
async function until(fn,label,max=15000) {
  const end=Date.now()+Math.min(max,remaining());
  while(Date.now()<end){remaining();const value=await fn();if(value)return value;await delay(80);}
  throw Error('RETAINED_TIMEOUT_'+label);
}
function killOwned() {
  if(child&&child.exitCode===null&&child.signalCode===null)spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'}).unref();
}
const watchdog=setTimeout(()=>{timedOut=true;report.success=false;report.timeout=true;save();killOwned();},Math.max(1,deadlineAt-Date.now()));
const sql=(statement,params=[])=>readSql(data,query=>query(statement,params));
const reviews=()=>sql("SELECT * FROM ai_confirmation_items WHERE action_type='pi_original_question_multi_candidate' ORDER BY created_at,id");
const taskPlanFacts=()=>sql("SELECT key,value_json,updated_at FROM app_settings WHERE key LIKE 'xiaozhi.task.v1:%' OR key LIKE 'xiaozhi.task-plan.v3:%' ORDER BY key");
const snapshotUi=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
async function shot(id) {
  const file=path.join(output,id+'.png');await page.screenshot({path:file,animations:'disabled'});
  report.screens.push({id,file,sha256:sha256(fs.readFileSync(file))});save();
}
async function close() {
  if(!app)return;
  const closing=app;app=undefined;
  await Promise.race([closing.close(),delay(Math.min(8000,Math.max(1,deadlineAt-Date.now()))).then(()=>{throw Error('RETAINED_CLOSE_DEADLINE');})]);
  await until(()=>child.exitCode!==null||child.signalCode!==null,'OWNED_CHILD_EXIT',5000);
}
async function launch(cold=false) {
  remaining();verify();assert(report.launches<2,'Two launch budget');report.launches++;save();
  const bootstrap=path.join(output,cold?'cold-bootstrap.cjs':'bootstrap.cjs');
  fs.writeFileSync(bootstrap,`const e=require('electron'),fs=require('node:fs');
e.app.setPath('userData',${JSON.stringify(profile)});e.app.setPath('sessionData',${JSON.stringify(profile)});
e.app.whenReady().then(async()=>{
  (${installRetainedFixtureProvider.toString()})(e,${JSON.stringify({model,deadlineAt,cold,planParameters:planContract.TASK_PLAN_PARAMETERS,planSteps:fixturePlanSteps})});
  await import(require('node:url').pathToFileURL(${JSON.stringify(main)}).href);
}).catch(error=>{fs.writeFileSync(${JSON.stringify(path.join(output,cold?'cold-bootstrap-error.json':'bootstrap-error.json'))},JSON.stringify({code:error.code,hash:require('node:crypto').createHash('sha256').update(String(error.stack)).digest('hex')}));e.app.exit(1);});\n`,{flag:'wx'});
  const env={...process.env};
  for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
  Object.assign(env,{NODE_ENV:'development',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',
    OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'1',DEEPSEEK_API_KEY:'owned-retained-tool-requests-only',DEEPSEEK_MODEL:model});
  const {_electron}=await import('playwright');
  app=await _electron.launch({args:[bootstrap,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:Math.min(30000,remaining())});child=app.process();
  page=await app.firstWindow({timeout:Math.min(25000,remaining())});page.setDefaultTimeout(Math.min(10000,remaining()));
  page.on('pageerror',error=>report.errors.push({code:'PAGE',hash:sha256(String(error))}));
  await page.getByTestId('xiaozhi-pi-workspace').waitFor();await assertIsolatedPiMain(app,main,profile);
  assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
  const visible=await app.evaluate(({BrowserWindow})=>{const windows=BrowserWindow.getAllWindows();return windows.length===1&&windows[0].isVisible()&&!windows[0].isMinimized();});
  assert(visible,'Current visible teacher UI');
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1366,768));
  await page.emulateMedia({colorScheme:'light'});
  sessionId=await page.locator('.office-composer-container:visible').getAttribute('data-session-id');assert(sessionId);
  await until(async()=>!await page.getByTestId('office-prompt-input').isDisabled(),'COMPOSER_READY');
  await app.evaluate(retainedProviderControl,{verify:true});
}
async function submit(items) {
  remaining();assert(report.submissions<2);assert.equal((await snapshotUi()).running,false);
  const chunks=sql('SELECT id FROM resource_chunks WHERE resource_id=?',[resource.id]).length;
  assert(chunks>=1&&chunks<=8,'Bounded actual imported chunks');
  await app.evaluate(retainedProviderControl,{arm:{resourceId:resource.id,version:resource.content_hash,fileName:path.basename(inputFile),chunks,proposals:items.map(item=>proposalFor(item,resource.id))}});
  const before=sql('SELECT id FROM ai_agent_runs').map(r=>r.id);
  const requestScope=items.length===2?'新任务：依次核对并保存以下两道合成原题。':'新任务：仅提出以下待裁图候选并等我核对，前两道已保存原题保留为历史，不重新提出。';
  const prompt=`${requestScope}本次使用我编写的合成算术PDF ${path.basename(inputFile)}，用原资料工具实际查找并读取全部${chunks}段。先实读read_teacher_request和read_session_process，按宿主当前要求版本及计划revision调用update_task_plan，为本次候选采用saved_questions target=current步骤与最终human核对步骤，再按我提供的题面和页码提出原题候选。${items.map(item=>JSON.stringify(proposalFor(item,resource.id))).join('\n')}。所有文字是教师提供的候选输入，不能标为已核对。不得调用OCR/解题模型，不提供答案解析，不创建文件。逐项等待我在当前审核界面对照真实原图。`;
  await page.getByTestId('office-prompt-input').fill(prompt);
  await page.locator('.office-composer-container:visible button[aria-label="发送消息"]').click();report.submissions++;save();
  return until(()=>{const rows=sql('SELECT id FROM ai_agent_runs').filter(r=>!before.includes(r.id));assert(rows.length<=1,'No extra Pi task');return rows[0]?.id;},'ACTUAL_TASK');
}
async function terminal(runId,status) {
  await until(async()=>{
    const view=await snapshotUi(),turn=view.projection.turns.find(t=>t.id===runId);
    if(view.running||turn?.status!==status)return false;
    const messages=sql("SELECT metadata_json FROM ai_conversation_messages WHERE session_id=? AND role='assistant' AND json_extract(metadata_json,'$.agentRunId')=?",[sessionId,runId]);
    return messages.length===1&&JSON.parse(messages[0].metadata_json).status===status;
  },'PERSISTED_TERMINAL_'+status,20000);
  assert.equal(sql('SELECT status FROM ai_agent_runs WHERE id=?',[runId])[0].status,status==='completed'?'succeeded':'blocked');
}
async function reviewCard(item) {
  const row=await until(async()=>{
    const guard=await app.evaluate(retainedProviderControl);
    if(guard.fatal)throw Error(guard.fatal);
    return reviews().find(r=>r.title===item.title);
  },'PROPOSAL_'+item.role,30000);
  assert.equal(row.status,'pending');
  const card=page.locator(`[data-testid="pi-original-review"][data-review-id="${row.id}"]`);
  await card.getByTestId('original-multi-images').waitFor();
  await until(()=>card.getByTestId('original-multi-image').evaluateAll(images=>images.length>0&&images.every(i=>i.complete&&i.naturalWidth>0)),'HOST_PNG_'+item.role);
  assert.equal(await card.getByTestId('original-multi-image').count(),item.pages.length);
  assert(await card.getByTestId('original-multi-confirm').isDisabled());
  return {row,card};
}
async function approve(item) {
  const {row,card}=await reviewCard(item),payload=JSON.parse(row.payload_json);
  assert.equal(payload.draft.sourceChecked,false);assert.equal(await card.getByTestId('original-multi-answer').inputValue(),'');
  for(const [key,part]of Object.entries(projectionFor(item))) {
    assert.equal(await card.getByTestId('projection-'+key+'-state').inputValue(),'missing','No supplied teacher coverage');
    await card.getByTestId('projection-'+key+'-text').fill(part.text);
    await card.getByTestId('projection-'+key+'-state').selectOption(part.state);
  }
  await card.getByTestId('original-multi-complete').locator('[data-slot="checkbox-content"]').click();
  const confirm=card.getByTestId('original-multi-confirm');await confirm.scrollIntoViewIfNeeded();
  assert(await confirm.isEnabled());await shot(item.role+'-before-confirm');await confirm.click();
  await until(()=>reviews().find(r=>r.id===row.id)?.status==='confirmed','SQL_APPROVAL_'+item.role);
  const effect=JSON.parse(reviews().find(r=>r.id===row.id).result_json);assert.equal(effect.complete,true);assert.equal(effect.draft.sourceChecked,false);
  assert.equal(sql('SELECT id FROM question_bank_items WHERE id=?',[effect.saved.questionId]).length,1);
  check(item.role==='single'?'SINGLE_APPROVED':'MULTI_APPROVED');
}

try {
  save();phase='launch';await launch();
  // Native chooser supplies an owned path. The existing UI performs its grant.
  await app.evaluate(({dialog},selected)=>{const old=dialog.showOpenDialog;dialog.showOpenDialog=async()=>{dialog.showOpenDialog=old;return {canceled:false,filePaths:[selected]};};},workspace);
  await page.getByTestId('pi-permission-picker').click();await page.getByRole('menuitem',{name:'选择教学工作目录',exact:true}).click();
  await until(()=>snapshotUi().then(s=>!!s.workspace),'ORIGINAL_WORKSPACE_PERMISSION');
  phase='import';await productEntry(page,'materials').click();
  await app.evaluate(({dialog},selected)=>{const old=dialog.showOpenDialog;dialog.showOpenDialog=async()=>{dialog.showOpenDialog=old;return {canceled:false,filePaths:[selected]};};},inputFile);
  await page.getByTestId('materials-import').click();
  resource=await until(()=>{
    const row=sql('SELECT * FROM teacher_resources').find(r=>r.content_hash===report.input.sha256);
    if(row&&['failed','cancelled','partial'].includes(row.parse_status))throw Error('RETAINED_REAL_PARSER_'+row.parse_status);
    return row?.parse_status==='ready'?row:false;
  },'ACTUAL_PDF_PARSE',45000);
  assert.equal(sha256(fs.readFileSync(ownedExact(resource.local_path,data))),report.input.sha256);
  // Allow formal numbered-text startup extraction to finish before any proposal.
  await until(async()=>{const state=await page.evaluate(()=>window.omniEdu.getMaterialQuestionStatus());return state.pending===0&&!state.associating&&state.failed===0&&state.documents>=1;},'FORMAL_ARCHIVE_SETTLED',15000);
  await shot('imported-pdf');check('IMPORTED_PDF');
  const imported=snapshot(data);await productEntry(page,'ask').click();
  phase='two-approvals';const first=await submit(fixtureCases.slice(0,2));
  await approve(fixtureCases[0]);await approve(fixtureCases[1]);await terminal(first,'completed');
  const approved=snapshot(data);
  const approvedPlans=taskPlanFacts().filter(row=>row.key!=='xiaozhi.task.v1:session:'+sessionId);
  for(const row of imported.question_bank_items)assert.deepEqual(approved.question_bank_items.find(q=>q.id===row.id),row,'Imported candidates retained');
  phase='pending';const second=await submit([fixtureCases[2]]),pending=await reviewCard(fixtureCases[2]);
  await shot('pending-before-stop');await page.locator('.office-composer-container:visible button[aria-label="停止本轮"]').click();
  await terminal(second,'interrupted');assert.equal(reviews().find(r=>r.id===pending.row.id).status,'pending');
  retainRows(approved,snapshot(data));check('PENDING_STOPPED');
  const currentPlans=taskPlanFacts();
  for(const row of approvedPlans)assert.deepEqual(currentPlans.find(current=>current.key===row.key),row,'Previous saved task/plan history conserved under new requirement');
  report.provider=await app.evaluate(retainedProviderControl,{verify:true});
  assert.equal(report.provider.responses,fixtureBudget.responses);assert.equal(report.provider.externalAttempts,0);assert.equal(report.provider.fatal,null);assert.equal(report.provider.rendererErrors,0);
  assert.deepEqual(report.provider.plans.map(p=>p.phase),['initial','advance','pending']);
  assert.equal(report.provider.teacherRequests.length,2);assert.equal(report.provider.processReads.length,2);assert.deepEqual(report.provider.toolFailures,[]);
  assert.notEqual(report.provider.plans[0].taskId,report.provider.plans[2].taskId,'Actual new requirement task');
  report.taskPlanning={previousPlanHistoryConserved:true,ledgerSha256:sha256(JSON.stringify(currentPlans))};
  phase='cold';await close();
  const coldBefore=snapshot(data),nativeBefore=nativeMessages(data).map(({messages,...row})=>row);
  report.cases=inspectCases(sourceRoot,resource.id);await launch(true);
  assert.equal((await snapshotUi()).running,false);
  const coldCard=page.locator(`[data-testid="pi-original-review"][data-review-id="${pending.row.id}"]`);
  await coldCard.waitFor();assert.equal(await coldCard.getAttribute('data-state'),'pending');
  await shot('cold-pending');report.coldProvider=await app.evaluate(retainedProviderControl,{verify:true});
  assert.equal(report.coldProvider.responses,0);assert.equal(report.coldProvider.externalAttempts,0);assert.equal(report.coldProvider.fatal,null);assert.equal(report.coldProvider.rendererErrors,0);
  await close();assert.deepEqual(snapshot(data),coldBefore,'Cold question/source/approval/command/run/usage/journal conservation');
  assert.deepEqual(taskPlanFacts(),currentPlans,'Cold task plan and all revision/retired/admission facts conserved');
  assert.deepEqual(nativeMessages(data).map(({messages,...row})=>row),nativeBefore,'Cold native history unchanged');
  assert.deepEqual(inspectCases(sourceRoot,resource.id),report.cases);report.coldVerified=true;check('COLD_CONSERVED');
  verify();assert.deepEqual(fixtureScriptHashes(desktop),report.scripts);assert.deepEqual(fs.readFileSync(inputFile),inputBytes);assert.deepEqual(fs.readFileSync(cacheSource),catalogueBytes);
  assert.deepEqual(report.errors,[]);report.sqliteSha256=snapshotHash(data);report.integrityVerified=true;
  const sourceTreeSha256=safeTree(sourceRoot,output);remaining();report.elapsedMs=Date.now()-started;report.success=true;save();
  const manifest={schemaVersion:fixtureSchema,success:true,budget:fixtureBudget,pins:{source:pins.source,build:pins.build},
    reportFile,reportSha256:sha256(fs.readFileSync(reportFile)),sourceRoot,sourceTreeSha256,sqliteSha256:report.sqliteSha256,resourceId:resource.id,cases:report.cases};
  const manifestFile=path.join(output,'manifest.json');
  // Validate all publication claims before creating the success-only manifest.
  const staged=path.join(output,'manifest.pending.json');fs.writeFileSync(staged,JSON.stringify(manifest,null,2)+'\n',{flag:'wx'});
  readFixtureManifest(staged,desktop,pins);remaining();fs.renameSync(staged,manifestFile);
  console.log(JSON.stringify({success:true,output,manifest:manifestFile,cases:report.cases.map(c=>({role:c.role,questionId:c.questionId,proposalId:c.proposalId}))}));
} catch(error) {
  report.success=false;report.failure={phase,name:error.name,message:String(error.message).replace(/sk-[\w-]+/g,'[credential]').slice(0,1000),stackSha256:sha256(String(error.stack))};
  if(app){report.providerAtFailure=await app.evaluate(retainedProviderControl).catch(()=>null);if(page&&!page.isClosed())await shot('failure').catch(()=>{});}
  process.exitCode=1;
} finally {
  try{await close();}catch(error){killOwned();report.success=false;report.errors.push({code:'CLOSE',hash:sha256(String(error.stack))});process.exitCode=1;}
  clearTimeout(watchdog);
  if(!report.success){report.elapsedMs=Date.now()-started;save();console.log(JSON.stringify({success:false,output,failure:report.failure}));}
}
