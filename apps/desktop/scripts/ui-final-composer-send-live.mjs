/** Parent launches only after freeze. Three actual UI admissions, no retries. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash,randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {composerSendBootstrapSource,composerSendBudgetControl,captureComposerSendDiagnostic,composerSendQaFailure} from './acceptance/ui-final-composer-send-budget.mjs';
import {composerSendJourney} from './acceptance/ui-final-composer-send-journey.mjs';

async function mainRun(){
const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const hash=value=>createHash('sha256').update(value).digest('hex');
const demand=(condition,code)=>{if(!condition)throw Error(code);};
const args=process.argv.slice(2),pinsArg=args.filter(v=>v.startsWith('--pins=')),modelArg=args.filter(v=>v.startsWith('--model='));
demand(args.length===4&&args.includes('--run-ui')&&args.includes('--allow-paid')&&pinsArg.length===1&&modelArg.length===1,'ARGS_REQUIRE_RUN_UI_ALLOW_PAID_PINS_MODEL');
const model=modelArg[0].slice(8),key=process.env.DEEPSEEK_API_KEY;
demand(/^[a-zA-Z0-9._-]{1,120}$/.test(model)&&typeof key==='string'&&key.trim().length>0,'EXPLICIT_MODEL_AND_INHERITED_KEY_REQUIRED');
const owned=fs.realpathSync(path.join(desktop,'test-results'));
const ownedPath=value=>{
  const resolved=fs.realpathSync(path.resolve(desktop,value)),relative=path.relative(owned,resolved);
  demand(relative&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep),'OWNED_PATH_REQUIRED');return resolved;
};
const pinsPath=ownedPath(pinsArg[0].slice(7));demand(path.extname(pinsPath).toLowerCase()==='.json','PINS_JSON_REQUIRED');
const pinsBytes=fs.readFileSync(pinsPath),pins=JSON.parse(pinsBytes),build=ownedPath(pins.buildRoot);
for(const field of ['source','build'])demand(/^[a-f0-9]{64}$/.test(pins[field]),'INVALID_PINS');
const main=path.join(build,'main/index.js');demand(fs.statSync(main).isFile(),'PINNED_MAIN_REQUIRED');
const output=fs.mkdtempSync(path.join(owned,'ui-final-composer-send-')),data=path.join(output,'data'),profile=path.join(output,'profile');
const fixtureDir=path.join(output,'selected-files');fs.mkdirSync(fixtureDir);
const fixture=path.join(fixtureDir,'synthetic-classroom.txt');
fs.writeFileSync(fixture,'合成教学验收材料。请仅确认收到附件，不调用工具，不修改文件。课堂练习：17+8=25。\n',{flag:'wx'});
const fixtureHash=hash(fs.readFileSync(fixture));
const scripts=[fileURLToPath(import.meta.url),...['journey','budget'].map(name=>path.join(desktop,`scripts/acceptance/ui-final-composer-send-${name}.mjs`))];
const scriptHashes=()=>scripts.map(file=>({file,hash:hash(fs.readFileSync(file))}));
const tables=['ai_agent_runs','ai_agent_run_requests','ai_agent_run_actions','ai_agent_events','xiaozhi_event_journal'];
const report={suite:'A03-A09-X01-composer-send-subset',status:'PREPARING',success:false,fullAcceptance:false,output,pinsPath,
  pins:{source:pins.source,build:pins.build,buildRoot:build,pinsHash:hash(pinsBytes)},scriptBefore:scriptHashes(),
  fixture:{hash:fixtureHash,synthetic:true,ocr:false},modelHash:hash(model),checks:[],errors:[],launches:[],readbacks:[],
  budget:{plannedRuns:3,maxRuns:5,maxProviderRequests:8,scenarioAttempts:1,automaticRetries:0},
  declaredSubset:{attachmentQuestion:{phase:'ATTACHMENT_ONLY',maxQuestions:1,maxAnswerClicks:1,sameLiveRunOnly:true,originalVisibleUIOnly:true,noSuggestedOptionSelection:true}},
  seams:['Owned pre-main bootstrap meters electron.net.fetch and strips one-use QA tickets before wire; global fetch model calls fail closed.',
    'Every provider request awaits a readonly SQL observer binding it to the scenario run; no business IPC/SQL handler is replaced.',
    'Playwright intercepts the original file input chooser with one real synthetic text file; no OCR or private attachment claim.',
    'Inherited DEEPSEEK_API_KEY only, cwd bypasses repository dotenv; no credentials seeded into SQL or profile.',
    'Only original visible Composer actions and at most one bound attachment-only clarification reply mutate business state. IPC and SQL used by QA are reads. QA control affects only its request gate.',
    'Run budget: at most three UI send actions; extra SQL admission stops immediately and is never released to provider. Observation cannot roll back an unexpected product admission.',
    'Screenshots crop only Composer; no native transcripts, model body/reasoning or raw errors are saved.'],
  notRun:[{code:'ADMISSION_FAILURE_RETRY_NOT_RUN',reason:'No safe original preadmission fault seam; do not fabricate a real failure or mutate draft selection by IPC.'},
    {code:'QUEUE_EDIT_WITHDRAW_NOT_RUN',reason:'Steer/followUp with editing and withdrawal needs a separate bounded continuation scenario.'},
    {code:'BACKEND_COMMAND_IDEMPOTENCY_NOT_RUN',reason:'UI duplicate Enter checks reentry; no direct startXiaozhi replay or fabricated command ID.'},
    {code:'FORCED_PROCESS_CRASH_NOT_RUN',reason:'Cold restart is graceful close after a persisted stop; no process crash claim.'},
    {code:'A05_A08_X08_HANDOFF_NOT_RUN',reason:'No tool/handoff prompt added. Automatic collapse and live manual reopen retention need actual public process events; absence is not credited as PASS.'}]};
let app,page,expectedRuns=0,ownerSession,gate,lastRows=[],phase='BOOT';
const diagnostics={records:report.errors,seen:0,fatalRenderer:false};
const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const diagnostic=(code,value)=>{
  // No raw diagnostics, stacks, URLs, headers, thought content or request bodies.
  captureComposerSendDiagnostic(diagnostics,code,hash(String(value)),phase);
};
const verify=()=>{
  demand(ownedPath(pinsPath)===pinsPath&&hash(fs.readFileSync(pinsPath))===hash(pinsBytes),'PINS_CHANGED');
  demand(ownedPath(pins.buildRoot)===build&&fingerprint(build).sha256===pins.build,'BUILD_CHANGED');
  demand(fingerprint(path.join(desktop,'src')).sha256===pins.source,'SOURCE_CHANGED');
  assert.deepEqual(scriptHashes(),report.scriptBefore,'SCRIPTS_CHANGED');
  demand(hash(fs.readFileSync(fixture))===fixtureHash,'FIXTURE_CHANGED');
};
const query=(sql,values=[])=>{
  const filename=path.join(data,'app.db');demand(ownedPath(filename)===filename,'DATA_DATABASE_REDIRECTED');
  const db=new DatabaseSync(filename,{readOnly:true});try{return db.prepare(sql).all(...values);}finally{db.close();}
};
const ledger=()=>Object.fromEntries(tables.map(table=>[table,query(`SELECT count(*) n FROM ${table}`)[0].n]));
const rows=()=>query('SELECT id,session_id,status,prompt FROM ai_agent_runs ORDER BY created_at,id');
const control=async options=>{gate=await app.evaluate(composerSendBudgetControl,options);report.provider=gate;return gate;};
async function health(){
  demand(!diagnostics.fatalRenderer,'RENDERER_ERROR');
  const current=rows();demand(current.length<=5,'RUN_BUDGET_EXHAUSTED');
  demand(current.length<=expectedRuns,'UNEXPECTED_ADMISSION');
  if(ownerSession)demand(current.every(row=>row.session_id===ownerSession),'FOREIGN_SESSION_ADMISSION');
  for(const prior of lastRows)demand(current.some(row=>row.id===prior.id&&row.session_id===prior.session_id&&row.prompt===prior.prompt),'RUN_IDENTITY_CHANGED');
  lastRows=current;
  const state=await control({observedRuns:current.length});demand(!state.fatal,'REQUEST_GATE_FATAL');
  if(state.pending){
    demand(current.length===expectedRuns&&expectedRuns>0&&['TEXT','ATTACHMENT_ONLY','STOP'].includes(phase),'UNBOUND_PROVIDER_REQUEST');
    const active=current.filter(row=>!['succeeded','failed','blocked','cancelled'].includes(row.status));
    demand(active.length===1,'PROVIDER_ACTIVE_RUN_NOT_UNIQUE');
    await control({release:true,runHash:hash(active[0].id)});
  }
  demand(gate.wire<=8,'REQUEST_BUDGET_EXHAUSTED');return current;
}
async function until(predicate,code,timeout=120000){
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){await health();const result=await predicate();if(result)return result;await new Promise(resolve=>setTimeout(resolve,80));}
  throw Error(code);
}
async function launch(prior){
  verify();
  const bootstrap=path.join(output,`bootstrap-${report.launches.length}.cjs`);
  const content=composerSendBootstrapSource({profile,main,model,prior});
  fs.writeFileSync(bootstrap,content,{flag:'wx'});
  const env={...process.env};
  for(const name of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(name)||name.startsWith('OMNI_EDU_')||['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(name))delete env[name];
  Object.assign(env,{DEEPSEEK_API_KEY:key,DEEPSEEK_MODEL:model,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'1'});
  app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:output,env,timeout:60000});
  app.process().stdout?.on('data',bytes=>diagnostic('MAIN_STDOUT',bytes));
  app.process().stderr?.on('data',bytes=>diagnostic('MAIN_STDERR',bytes));
  page=await app.firstWindow();page.setDefaultTimeout(15000);
  page.on('pageerror',error=>diagnostic('PAGE_ERROR',error));
  page.on('console',message=>{if(message.type()==='error')diagnostic('CONSOLE_ERROR',message.text());});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  await until(async()=>await page.getByTestId('office-prompt-input').count()===1&&!await page.getByTestId('office-prompt-input').isDisabled(),'COMPOSER_NOT_READY',60000);
  demand(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot()))===data,'DATA_ROOT_MISMATCH');
  const isolation=await assertIsolatedPiMain(app,main,profile);
  const storage=await app.evaluate(({session})=>session.defaultSession.storagePath);
  demand(typeof storage==='string'&&path.resolve(storage)===profile&&ownedPath(storage)===profile,'SESSION_STORAGE_NOT_OWNED');
  await control({verifyNetwork:true});
  report.launches.push({bootstrapHash:hash(content),mainHash:hash(fs.readFileSync(main)),isolation,storagePath:storage});
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].setContentSize(1366,768));
  gate=await control({phase:prior?'COLD':'BOOT'});phase=prior?'COLD':'BOOT';return page;
}
const observation=label=>{
  const current=rows(),value={code:label,ledger:ledger(),runs:current.map(row=>({hash:hash(row.id),sessionHash:hash(row.session_id),status:row.status,promptHash:hash(row.prompt)}))};
  report.readbacks.push(value);return value;
};
const nativeBytes=session=>{
  const bindings=query('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[session]);demand(bindings.length===1,'NATIVE_BINDING_NOT_UNIQUE');
  const filename=path.resolve(data,'xiaozhi-pi',bindings[0].session_file),root=path.join(data,'xiaozhi-pi')+path.sep;
  demand(filename.startsWith(root)&&ownedPath(filename)===filename,'NATIVE_PATH_NOT_OWNED');return fs.readFileSync(filename);
};
const check=async(code,work)=>{
  report.active=code;persist();
  try{await health();await work();await health();observation(code);report.checks.push({code,status:'PASS'});persist();}
  catch(error){report.checks.push({code,status:'FAIL',error:composerSendQaFailure(error,phase,'CHECK_FAILURE',hash(String(error)))});persist();throw error;}
};
try{
  verify();report.sourceBefore=pins.source;report.buildBefore=pins.build;report.status='RUNNING';persist();
  await launch();const initial=ledger();report.ledgerBefore=initial;
  for(const table of tables)demand(initial[table]===0,'FRESH_LEDGER_NOT_ZERO');
  await composerSendJourney({getPage:()=>page,output,fixture,report,check,until,query,nativeBytes,hash,
    snapshot:session=>page.evaluate(async id=>{const state=await window.omniEdu.getXiaozhiSnapshot(id);return {...state,projection:{...state.projection,turns:state.projection.turns.map(({modelReasoning,...turn})=>turn)}};},session),
    setScenario:async(next,total,session)=>{demand(total===expectedRuns+1&&total<=3,'SCENARIO_REENTRY');expectedRuns=total;ownerSession=session;phase=next;await control({phase:next,stopping:false});},
    stopping:()=>control({stopping:true}),
    cold:async()=>{const prior=await control({phase:'COLD'});phase='COLD';await app.close();app=undefined;return launch(prior);},
    provider:()=>gate,ledger,random:()=>randomUUID()});
  await health();demand(rows().length===3,'SUBSET_RUN_COUNT_MISMATCH');
  const final=rows();demand(final.filter(row=>row.status==='succeeded').length===2&&final.filter(row=>row.status==='blocked').length===1,'SUBSET_TERMINAL_MISMATCH');
  await control({phase:'DONE'});report.ledgerAfter=ledger();report.success=true;report.status='PASS_SUBSET';
}catch(error){report.success=false;report.status='FAIL';report.failure=composerSendQaFailure(error,phase,'UNCLASSIFIED_FAILURE',hash(String(error)));process.exitCode=1;}
finally{
  if(app){try{report.provider=await control({phase:'DONE'});}catch(error){diagnostic('CLOSE_FAILURE',error);report.success=false;report.status='FAIL';}}
  try{await app?.close();}catch(error){diagnostic('CLOSE_FAILURE',error);report.success=false;report.status='FAIL';}
  if(diagnostics.fatalRenderer){report.success=false;report.status='FAIL';report.rendererFailure={code:'RENDERER_ERROR'};}
  try{verify();report.sourceAfter=fingerprint(path.join(desktop,'src')).sha256;report.buildAfter=fingerprint(build).sha256;report.scriptAfter=scriptHashes();report.integrityVerified=true;if(fs.existsSync(path.join(data,'app.db')))report.ledgerAfterClose=ledger();}
  catch(error){report.success=false;report.status='FAIL';report.failure=composerSendQaFailure(error,phase,'INTEGRITY_FAILURE',hash(String(error)));}
  persist();console.log(JSON.stringify({code:report.status,success:report.success,fullAcceptance:false,output,checks:report.checks.length,wire:report.provider?.wire??0}));
  if(!report.success)process.exitCode=1;
}
}
try{await mainRun();}
catch(error){console.log(JSON.stringify(composerSendQaFailure(error,'BOOT','PREPARATION_FAILED',createHash('sha256').update(String(error)).digest('hex'))));process.exitCode=1;}
