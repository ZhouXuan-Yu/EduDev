/** Parent-only X01 runner. Prepare/self-test now; actual needs NEW frozen pins. */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn,spawnSync} from 'node:child_process';
import {randomUUID} from 'node:crypto';
import {fingerprint} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {contract,hash,need,boundedTree,cloneTree,validateCatalogue,readSql,captureFacts,assertRetained,assertQuiescent,nativeState,assertNativeRetained,assertFinalSnapshot,
  bootstrapSource,queueRecoveryControl,queueRecoveryJourney,safeDiagnostic,selfTest} from './acceptance/ui-final-queue-recovery.mjs';

const desktop=path.resolve(fileURLToPath(new URL('..',import.meta.url))),args=process.argv.slice(2);
let report,output,app,child,timer,phaseName='PREPARE',closed=false,killRequested=false,deadlineAt;
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const persist=()=>{if(report&&output)fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));};
const diagnostic=(error,phase=phaseName)=>safeDiagnostic(error,phase);
// Only this cached child tree can be terminated. Never match an app by name.
function terminateOwned(){if(killRequested||!child||child.exitCode!==null||child.signalCode!==null)return;need(Number.isInteger(child.pid)&&child.pid>0&&child.pid!==process.pid,'OWNED_PROCESS_ALIVE');killRequested=true;
  if(process.platform==='win32'){const killer=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});killer.on('error',()=>{});killer.unref();}else child.kill('SIGKILL');}
function ownedProcesses(profile){
  need(process.platform==='win32','OWNED_PROCESS_ALIVE');const encoded=Buffer.from(profile).toString('base64');
  const command=`$needle=[Text.Encoding]::UTF8.GetString([Convert]::FromBase64String('${encoded}')); $matches=Get-CimInstance Win32_Process | Where-Object { $_.Name -eq 'electron.exe' -and $_.CommandLine -and $_.CommandLine.Contains($needle) }; @($matches | Select-Object ProcessId,ParentProcessId) | ConvertTo-Json -Compress`;
  const result=spawnSync('powershell.exe',['-NoProfile','-Command',command],{encoding:'utf8',windowsHide:true,timeout:8000});need(result.status===0,'OWNED_PROCESS_ALIVE');const rows=result.stdout.trim()?JSON.parse(result.stdout):[];need(Array.isArray(rows),'OWNED_PROCESS_ALIVE');return rows;
}
async function bounded(work,code,cap=5000){const remaining=Math.min(cap,Math.max(0,deadlineAt-Date.now()));need(remaining>0,code);let timeout;
  try{return await Promise.race([Promise.resolve().then(work),new Promise((_,reject)=>{timeout=setTimeout(()=>reject(Error(code)),remaining);})]);}finally{clearTimeout(timeout);}}
async function main(){
  if(args.length===1&&args[0]==='--self-test'){console.log(JSON.stringify(await selfTest()));return;}
  need(args.length===4&&args.filter(v=>['--preflight','--run-ui'].includes(v)).length===1&&new Set(args.map(v=>v.split('=')[0])).size===4&&args.every(v=>['--preflight','--run-ui'].includes(v)||/^--(?:pins|baseline|model)=.+/.test(v)),'ARGS_INVALID');
  const value=name=>args.find(v=>v.startsWith('--'+name+'='))?.slice(name.length+3),model=value('model');need(/^[A-Za-z0-9][A-Za-z0-9._-]{0,119}$/.test(model??''),'ARGS_INVALID');
  const owned=fs.realpathSync(path.join(desktop,'test-results')),own=value=>{const absolute=path.resolve(desktop,value),relative=path.relative(owned,absolute);need(relative&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep)&&fs.realpathSync(absolute)===absolute,'OWNED_PATH_REQUIRED');return absolute;};
  const pinsFile=own(value('pins')),pinsBytes=fs.readFileSync(pinsFile),pins=JSON.parse(pinsBytes),baseline=own(value('baseline'));
  need(pinsFile.endsWith('.json')&&/^[a-f0-9]{64}$/.test(pins.source??'')&&/^[a-f0-9]{64}$/.test(pins.build??''),'ARGS_INVALID');
  const build=own(pins.buildRoot),main=own(path.join(build,'main/index.js')),sourceData=own(path.join(baseline,'data')),sourceProfile=own(path.join(baseline,'profile'));
  need(!fs.existsSync(path.join(sourceProfile,'xiaozhi-data-selection.v1.json'))&&!fs.existsSync(path.join(sourceData,'xiaozhi-recovery.v1.json')),'RESTORE_SELECTION_FORBIDDEN');
  need(!fs.existsSync(path.join(sourceData,'app.db-wal'))&&!fs.existsSync(path.join(sourceData,'app.db-shm')),'BASELINE_NOT_CHECKPOINTED');
  const sourceTrees=[boundedTree(sourceData),boundedTree(sourceProfile)],sourceFacts=captureFacts(sourceData);assertQuiescent(sourceFacts);
  const catalogueFile=own(path.join(sourceData,'xiaozhi-pi/deepseek-capabilities.v1.json')),catalogueBytes=fs.readFileSync(catalogueFile),catalogue=validateCatalogue(catalogueBytes,model);
  const scripts=[fileURLToPath(import.meta.url),path.join(desktop,'scripts/acceptance/ui-final-queue-recovery.mjs'),path.join(desktop,'scripts/acceptance/build-root.mjs'),path.join(desktop,'scripts/acceptance/evidence.mjs')];
  const scriptHashes=()=>scripts.map(file=>({file:path.relative(desktop,file).replaceAll('\\','/'),sha256:hash(fs.readFileSync(file))})),scriptBefore=scriptHashes();
  function verify(){need(hash(fs.readFileSync(pinsFile))===hash(pinsBytes),'PINS_CHANGED');need(fingerprint(path.join(desktop,'src')).sha256===pins.source,'SOURCE_CHANGED');need(fingerprint(build).sha256===pins.build,'BUILD_CHANGED');need(hash(scriptHashes())===hash(scriptBefore),'SCRIPTS_CHANGED');}
  function verifyBaseline(){for(const tree of sourceTrees)need(boundedTree(tree.root).sha256===tree.sha256,'BASELINE_CHANGED');need(hash(fs.readFileSync(catalogueFile))===catalogue.sha256,'BASELINE_CHANGED');}
  verify();verifyBaseline();need(ownedProcesses(sourceProfile).length===0,'BASELINE_NOT_CHECKPOINTED');
  if(args.includes('--preflight')){console.log(JSON.stringify({code:'X01_READ_ONLY_PREFLIGHT_PASS',contract,pins:{source:pins.source,build:pins.build,buildRoot:build},catalogue:{...catalogue,sourceFile:catalogueFile,copiedBytes:true},clone:sourceTrees.map(t=>({files:t.files.length,bytes:t.bytes,sha256:t.sha256})),launches:0,nativeWire:0,actualAcceptance:false}));return;}
  output=fs.mkdtempSync(path.join(owned,'ui-final-queue-recovery-'));const data=path.join(output,'data'),profile=path.join(output,'profile');
  report={suite:'X01-bounded-zero-wire-queue-recovery',status:'PREPARING',success:false,productAcceptance:false,paidProviderAcceptance:false,output,contract,
    pins:{file:pinsFile,sha256:hash(pinsBytes),source:pins.source,build:pins.build,buildRoot:build},scriptBefore,
    baseline:{root:baseline,sourceTrees:sourceTrees.map(t=>({root:t.root,sha256:t.sha256,files:t.files.length,bytes:t.bytes})),ledger:sourceFacts.summary},
    catalogue:{...catalogue,sourceFile:catalogueFile,copiedBytes:true,synthetic:false},launches:0,checks:[],errors:[],observations:[],
    boundaries:['Existing owned cold data/profile bounded clone; original source trees stay byte-identical. No key read/seed or raw key/body/thought logs.',
      'Configuration inherited only through cloned formal settings. Endpoint is the official cached-catalogue endpoint; native provider requests are held/rejected before native fetch.',
      'Only visible original UI mutates business state. Read-only SQL/IPC/native bytes observe; QA control changes only the transport guard.',
      'Controlled failure is AFTER admission; blocked/interrupted and failed/failed terminals are expected, never succeeded/completed or natural outage proof.',
      'No automatic scenario retry, second launch, accept/approval, fake model response, runtime event injection or direct business SQL/IPC writes.'],notRun:contract.notRun};persist();
  cloneTree(sourceTrees[0],data);cloneTree(sourceTrees[1],profile);verifyBaseline();
  const fixture=path.join(output,'owned-sentinel.txt');fs.writeFileSync(fixture,'合成附件：只保留在未发送会话，不送入模型，不执行 OCR。\n',{flag:'wx'});const fixtureHash=hash(fs.readFileSync(fixture));
  const catalogueTarget=path.join(data,'xiaozhi-pi/deepseek-capabilities.v1.json');need(fs.readFileSync(catalogueTarget).equals(catalogueBytes),'CLONE_COPY_CHANGED');
  const query=(sql,params=[])=>readSql(data,q=>q(sql,params)),originalIds=new Set(sourceFacts.records.ai_agent_runs.rows.map(row=>row.id));
  const newRuns=()=>query('SELECT id,session_id,status,prompt FROM ai_agent_runs ORDER BY rowid').filter(row=>!originalIds.has(row.id)),plans=[];
  const nativeBefore=nativeState(data,query);report.nativeBeforeLaunch=nativeBefore.map(({sessionHash,sha256})=>({sessionHash,sha256}));persist();
  let fatal=false,oldDrafts,expectedDrafts=new Map();const settledRuns=new Map();
  const captureError=(code,error,isFatal=false)=>{if(report.errors.length<64)report.errors.push({code,phase:phaseName,hash:hash(String(error))});fatal||=isFatal;persist();};
  const control=options=>bounded(()=>app.evaluate(queueRecoveryControl,options),'CONDITION_DEADLINE');
  async function health(){
    need(!fatal,'RENDERER_ERROR');const rows=newRuns();need(rows.length<=plans.length&&rows.length<=3,'UNEXPECTED_ADMISSION');
    for(const [i,row]of rows.entries())need(row.session_id===plans[i].session&&row.prompt===plans[i].prompt,'RUN_NOT_BOUND');
    for(const [id,digest]of settledRuns)need(rows.some(row=>row.id===id&&hash(row)===digest),'FINAL_FACTS_CHANGED');
    let g=await control({observedRuns:rows.length});need(!g.fatal&&g.nativeWire===0&&g.attempts<=3,'GUARD_FATAL');need(g.rendererErrors===0,'RENDERER_ERROR');
    if(g.pending.length){need(g.pending.length===1,'RUN_NOT_BOUND');const index=plans.findIndex(p=>p.phase===g.pending[0]),row=rows[index];need(row&&row.status==='running'&&rows.filter(r=>r.status==='running').length===1,'RUN_NOT_BOUND');g=await control({bind:{runHash:hash(row.id),sessionHash:hash(row.session_id)}});}
    for(const request of g.requests.filter(v=>v.bound)){const index=plans.findIndex(p=>p.phase===request.phase),row=rows[index];need(row&&request.runHash===hash(row.id)&&request.sessionHash===hash(row.session_id),'RUN_NOT_BOUND');}
    report.provider=g;return g;
  }
  async function until(predicate,cap=20000){const end=Math.min(deadlineAt,Date.now()+cap);while(Date.now()<end){await health();const result=await predicate();if(result)return result;await new Promise(r=>setTimeout(r,80));}throw Error('CONDITION_DEADLINE');}
  const snapshot=async session=>{const state=await bounded(()=>report.page.evaluate(id=>{const s=window.omniEdu.getXiaozhiSnapshot(id);return s.then(v=>({...v,projection:{...v.projection,turns:v.projection.turns.map(({modelReasoning,...turn})=>turn)}}));},session),'CONDITION_DEADLINE');need(state.projection.threadId===session,'RUN_NOT_BOUND');need(!(state.approvals??[]).some(v=>['pending','approved','executing'].includes(v.state))&&!(state.controls??[]).some(v=>v.kind==='question'&&['pending','resuming'].includes(v.state)),'UNEXPECTED_GATE');return state;};
  const nativeBytes=session=>{const matches=nativeState(data,query).filter(row=>row.sessionHash===hash(session));need(matches.length===1,'RUN_NOT_BOUND');return fs.readFileSync(matches[0].file);};
  async function draftMap(){return report.page.evaluate(()=>Object.fromEntries(Object.keys(localStorage).filter(k=>k.startsWith('xiaozhi.composer-draft.v1:')).map(k=>[k,localStorage.getItem(k)])));}
  async function assertDrafts(){const current=await draftMap();for(const [key,value]of Object.entries(oldDrafts??{}))need(current[key]===value,'DRAFT_CHANGED');for(const [session,text]of expectedDrafts)need(JSON.parse(current['xiaozhi.composer-draft.v1:'+session]??'null')?.text===text,'DRAFT_CHANGED');}
  const rememberDrafts=async(session,text)=>{expectedDrafts.set(session,text);await until(async()=>{const m=await draftMap();return JSON.parse(m['xiaozhi.composer-draft.v1:'+session]??'null')?.text===text;});};
  async function stable(work){const rows=hash(newRuns());const end=Math.min(deadlineAt,Date.now()+1000);while(Date.now()<end){await health();await work();need(hash(newRuns())===rows,'RECOVERY_STARTED_RUN');await new Promise(r=>setTimeout(r,100));}}
  let finalBeforeClose;
  function preserve(){const facts=captureFacts(data);assertRetained(sourceFacts,facts);assertNativeRetained(nativeBefore,nativeState(data,query));need(hash(fs.readFileSync(fixture))===fixtureHash,'ATTACHMENT_CHANGED');need(fs.readFileSync(catalogueTarget).equals(catalogueBytes),'CLONE_COPY_CHANGED');return facts;}
  try{
    verify();phaseName='BOOT';deadlineAt=Date.now()+contract.totalMs;timer=setTimeout(()=>{fatal=true;report.deadline=true;terminateOwned();},contract.totalMs);
    const bootstrap=path.join(output,'owned-bootstrap.cjs'),stateFile=path.join(output,'bootstrap-state.json'),source=bootstrapSource({profile,main,stateFile,model,deadlineAt});fs.writeFileSync(bootstrap,source,{flag:'wx'});report.bootstrapHash=hash(source);
    const env={...process.env};for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
    Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'1'});
    const {_electron:electron}=await import('playwright');need(report.launches===0,'UNEXPECTED_ADMISSION');report.launches=1;persist();app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:output,env,timeout:30000});child=app.process();report.ownedPid=child.pid;
    child.once('exit',(code,signal)=>{report.childExit={code,signal};persist();});
    for(const stream of [child.stdout,child.stderr])stream?.on('data',bytes=>captureError('MAIN_OUTPUT',bytes,/uncaught|unhandledrejection|unhandled rejection/i.test(String(bytes))));
    const bootstrapDeadline=Math.min(deadlineAt,Date.now()+30000);let imported=false;
    while(Date.now()<bootstrapDeadline){need(child.exitCode===null&&child.signalCode===null,'BOOTSTRAP_CHILD_EXITED');if(fs.existsSync(stateFile)){need(fs.realpathSync(stateFile)===stateFile&&fs.statSync(stateFile).size<=65536,'BOOTSTRAP_FAILED');const state=json(stateFile);report.bootstrapState=state;need(!state.failed,'BOOTSTRAP_FAILED');if(state.phase==='MAIN_IMPORTED'){imported=true;break;}}await new Promise(r=>setTimeout(r,80));}need(imported,'BOOTSTRAP_DEADLINE');
    report.isolation=await bounded(()=>assertIsolatedPiMain(app,main,profile),'CONDITION_DEADLINE');const page=await bounded(()=>app.firstWindow(),'CONDITION_DEADLINE',30000);
    // Keep the Page outside serialized evidence; report contains only safe facts.
    Object.defineProperty(report,'page',{value:page,enumerable:false});page.setDefaultTimeout(10000);page.on('pageerror',e=>captureError('PAGE_ERROR',e,true));page.on('console',m=>{if(m.type()==='error')captureError('CONSOLE_ERROR',m.text(),true);});
    if(!await page.locator('[data-testid="xiaozhi-pi-workspace"]:visible').isVisible()){const entry=page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-ai-workspace');need(await entry.count()===1,'UNIQUE_UI_REQUIRED');await entry.click();}
    await page.locator('[data-testid="xiaozhi-pi-workspace"]:visible').waitFor({timeout:30000});await until(async()=>await page.locator('.office-composer-container:visible').getByTestId('office-prompt-input').count()===1&&!await page.locator('.office-composer-container:visible').getByTestId('office-prompt-input').isDisabled());
    need(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot()))===data,'DATABASE_REDIRECTED');need(path.resolve(await bounded(()=>app.evaluate(({session})=>session.defaultSession.storagePath),'CONDITION_DEADLINE'))===profile,'DATABASE_REDIRECTED');
    await control({verifyNetwork:true});const settings=await page.evaluate(()=>window.omniEdu.getXiaozhiSettings());need(settings?.ok&&settings.value.configured,'NOT_CONFIGURED');need(settings.value.defaultModel===model&&settings.value.models.some(v=>v.id===model),'MODEL_NOT_BOUND');
    assertNativeRetained(nativeBefore,nativeState(data,query));report.oldNativeUnchangedAfterBoot=true;assertRetained(sourceFacts,captureFacts(data));oldDrafts=await draftMap();report.oldDrafts={count:Object.keys(oldDrafts).length,sha256:hash(oldDrafts)};
    report.ledgerBefore=captureFacts(data).summary;report.status='RUNNING';persist();
    const check=async(code,work)=>{report.active=code;persist();try{await health();await work();await health();const facts=preserve();for(const row of newRuns())if(['blocked','failed','succeeded','cancelled','interrupted'].includes(row.status))settledRuns.set(row.id,hash(row));report.observations.push({code,ledger:facts.summary,newRuns:newRuns().map(r=>({runHash:hash(r.id),sessionHash:hash(r.session_id),promptHash:hash(r.prompt),status:r.status}))});report.checks.push({code,status:'PASS'});persist();}catch(error){report.checks.push({code,status:'FAIL',diagnostic:diagnostic(error)});throw error;}};
    report.journey=await queueRecoveryJourney({page,until,query,check,snapshot,nativeBytes,rememberDrafts,assertDrafts,fixture,health,random:()=>randomUUID(),observeStable:stable,
      phase:async(next,total,session,prompt)=>{need(total<=3&&(next==='STOPPING'?total===plans.length:total===plans.length+1),'UNEXPECTED_ADMISSION');phaseName=next;if(next!=='STOPPING')plans.push({phase:next,session,prompt});await control({phase:next,expectedRuns:total});persist();},
      shot:async code=>{const target=page.locator('.office-composer-container:visible');need(await target.count()===1,'UNIQUE_UI_REQUIRED');const file=path.join(output,code+'.png');await target.screenshot({path:file});report.screenshots??=[];report.screenshots.push({code,sha256:hash(fs.readFileSync(file))});}});
    await health();need(newRuns().length===3,'UNEXPECTED_ADMISSION');need(newRuns().map(r=>r.status).join(',')==='blocked,failed,failed','TERMINAL_MISMATCH');await control({phase:'DONE'});phaseName='DONE';const finalFacts=preserve();await assertDrafts();
    finalBeforeClose={newRuns:newRuns(),ledger:finalFacts.summary,native:nativeState(data,query)};
    report.beforeClose={ledger:finalBeforeClose.ledger,native:finalBeforeClose.native.map(({sessionHash,sha256})=>({sessionHash,sha256})),newRunDigest:hash(finalBeforeClose.newRuns),draftDigest:hash(await draftMap())};report.success=true;report.status='PASS_BOUNDED_QA_SUBSET';
  }catch(error){report.status='FAIL';report.success=false;report.failure=diagnostic(error);process.exitCode=1;}
  finally{
    phaseName='CLOSE';if(app){try{report.provider=await control({});need(!report.provider.fatal&&report.provider.nativeWire===0&&report.provider.rendererErrors===0,'GUARD_FATAL');}catch(error){report.success=false;report.status='FAIL';report.guardFailure=diagnostic(error);}
      try{await bounded(()=>app.close(),'CLOSE_DEADLINE',5000);closed=true;}catch(error){report.success=false;report.status='FAIL';report.closeFailure=diagnostic(error);terminateOwned();}}
    clearTimeout(timer);const cleanupDeadline=Date.now()+contract.cleanupMs;
    // A failed launch may not have returned a ChildProcess. The unique NEW
    // profile path also proves ownership of any remaining Electron descendants.
    try{let remaining=ownedProcesses(profile);for(const row of remaining){need(Number.isInteger(row.ProcessId)&&row.ProcessId>0&&row.ProcessId!==process.pid,'OWNED_PROCESS_ALIVE');const result=spawnSync('taskkill.exe',['/PID',String(row.ProcessId),'/T','/F'],{windowsHide:true,stdio:'ignore',timeout:Math.max(1,Math.min(3000,cleanupDeadline-Date.now()))});if(result.error)throw result.error;}
      while(remaining.length&&Date.now()<cleanupDeadline){await new Promise(r=>setTimeout(r,100));remaining=ownedProcesses(profile);}report.remainingOwnedProcesses=remaining.length;need(remaining.length===0,'OWNED_PROCESS_ALIVE');
    }catch(error){report.success=false;report.status='FAIL';report.cleanupFailure=diagnostic(error);}
    try{verify();verifyBaseline();report.sourceAfter=pins.source;report.buildAfter=pins.build;report.scriptAfter=scriptHashes();const facts=captureFacts(data);assertRetained(sourceFacts,facts);assertNativeRetained(nativeBefore,nativeState(data,query));report.ledgerAfter=facts.summary;
      if(finalBeforeClose){assertFinalSnapshot(finalBeforeClose,{newRuns:newRuns(),ledger:facts.summary,native:nativeState(data,query)});report.exactFinalAfterCloseVerified=true;}else report.exactFinalAfterCloseVerified=false;
      report.integrityVerified=true;
      const remaining=ownedProcesses(profile);report.remainingOwnedProcesses=remaining.length;need(remaining.length===0&&closed&&child?.exitCode===0,'OWNED_PROCESS_ALIVE');need(!fatal,'RENDERER_ERROR');report.childClosed=true;
    }catch(error){report.success=false;report.status='FAIL';report.integrityFailure=diagnostic(error);}
    persist();if(!report.success)process.exitCode=1;console.log(JSON.stringify({code:report.status,output,checks:report.checks.length,launches:report.launches,nativeWire:report.provider?.nativeWire??null,productAcceptance:false}));
  }
}
try{await main();}catch(error){const failure=diagnostic(error);if(report){report.success=false;report.status='FAIL';report.failure=failure;persist();}console.log(JSON.stringify({code:'X01_PREPARATION_OR_LAUNCH_FAILED',diagnostic:failure,output:output??null}));process.exitCode=1;}
