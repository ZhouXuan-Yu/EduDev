/** X02 actual UI preparation. Parent alone runs --run-ui with current frozen pins.
 * Only original editor UI mutates business state. Deliberate ACK loss is AFTER commit.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {_electron as electron} from 'playwright';
import {fingerprint} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {ownedExact,continuationBootstrap,continuationGuardRead,waitContinuationBootstrap,
  readContinuationBootstrapFile,closeContinuationRuntime} from './acceptance/paper-adaptation-continuation.mjs';
import {contract,need,hash,tree,facts,readDb,logical,cloneBaseline,noSourceProcess,
  installMetadataRecoveryTransport,assertReceipt,selfTest} from './ui-final-material-metadata-recovery-helper.mjs';

const desktop=path.resolve(fileURLToPath(new URL('..',import.meta.url))),args=process.argv.slice(2);
if(args.length===1&&args[0]==='--self-test'){
  try{console.log(JSON.stringify(await selfTest()));}catch(error){console.error(JSON.stringify({code:'X02_SELF_TEST_FAIL',hash:hash(String(error.stack??error))}));process.exitCode=1;}
}else await run();

async function run(){
  let output,report,app,page,child,hardTimer,sourceInventory,sourceLogical,baseline,committedFacts,
    beforeView,afterView,finalStatic,finalSource,lastSeam,timedOut=false,terminationRequested=false;
  const started=Date.now(),deadlineAt=started+contract.totalMs;
  const owned=fs.realpathSync(path.join(desktop,'test-results')),own=p=>ownedExact(path.resolve(desktop,p),owned);
  const persist=()=>{if(output&&report)fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));};
  const remaining=(cap=8000)=>{need(!timedOut&&Date.now()<deadlineAt-contract.cleanupMs,'GLOBAL_DEADLINE');return Math.min(cap,deadlineAt-contract.cleanupMs-Date.now());};
  const diagnosticCodes=new Set(['GLOBAL_DEADLINE','ARGS_INVALID','PINS_JSON_REQUIRED','PINS_INVALID',
    'BUILD_PIN_MISMATCH','SOURCE_PIN_MISMATCH','PINS_CHANGED','BUILD_REDIRECT','SOURCE_EVIDENCE_CHANGED',
    'SOURCE_LOGICAL_CHANGED','SOURCE_CHANGED','SNAPSHOT_LOGICAL_MISMATCH',
    'SOURCE_PROCESS_ACTIVE_OR_UNKNOWN','SNAPSHOT_DEADLINE','ZERO_HTTP_MODEL_RENDERER_INVARIANT',
    'TRANSPORT_FATAL','SAVE_BUDGET_EXCEEDED','WAIT_DEADLINE','OWNED_CLOSE_FAILED','FINAL_GUARD_FAILED',
    'BOOTSTRAP_CHILD_EXITED','BOOTSTRAP_STATE_REDIRECTED','BOOTSTRAP_STATE_INVALID','BOOTSTRAP_FAILED',
    'BOOTSTRAP_READY_DEADLINE','SAVE_SCOPE_REJECTED','REPEATED_SAVE_FORBIDDEN','FORMAL_SAVE_FAILED',
    'FORMAL_RECEIPT_INVALID','LATE_READ_HOLD_DEADLINE','WINDOWS_PROCESS_PROOF_REQUIRED']);
  const diagnostic=error=>{
    const message=String(error?.message??''),stack=String(error?.stack??error);
    return {code:diagnosticCodes.has(message)?message:error?.code==='ERR_ASSERTION'?'QA_ASSERTION':
      error?.name==='TimeoutError'?'QA_TIMEOUT':'QA_UNKNOWN',phase:report?.phase??'ARGUMENTS',hash:hash(stack),
      qaFrames:[...stack.matchAll(/(ui-final-material-metadata-recovery-(?:live|helper)\.mjs):(\d+):(\d+)/g)]
        .slice(0,8).map(m=>({file:'scripts/'+m[1],line:+m[2],column:+m[3]}))};
  };
  function terminate(){
    if(terminationRequested||!child||child.exitCode!==null||child.signalCode!==null)return;
    need(Number.isInteger(child.pid)&&child.pid>0&&child.pid!==process.pid,'OWNED_PID_INVALID');
    terminationRequested=true;report.ownedTermination={pid:child.pid,code:'OWNED_TREE_TERMINATION'};persist();
    if(process.platform==='win32'){
      const task=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});
      task.on('error',e=>{report.errors.push(diagnostic(e));});task.unref();
    }else child.kill('SIGKILL');
  }
  async function confirmExit(cap=1500){
    if(!child)return true;
    if(child.exitCode===null&&child.signalCode===null){
      await new Promise(resolve=>{
        const done=()=>{clearTimeout(timer);child.removeListener('exit',done);resolve();};
        const timer=setTimeout(done,Math.max(1,Math.min(cap,deadlineAt-Date.now())));
        child.once('exit',done);if(child.exitCode!==null||child.signalCode!==null)done();
      });
    }
    const exited=child.exitCode!==null||child.signalCode!==null;
    report.ownedProcessExit={pid:child.pid,exited,exitCode:child.exitCode,signal:child.signalCode};
    return exited;
  }
  try{
    need(args.length===2&&args.includes('--run-ui')&&args.filter(a=>a.startsWith('--pins=')).length===1,'ARGS_INVALID');
    const pinsFile=own(args.find(a=>a.startsWith('--pins=')).slice(7));need(path.extname(pinsFile)==='.json','PINS_JSON_REQUIRED');
    const pins=JSON.parse(fs.readFileSync(pinsFile,'utf8')),pinsHash=hash(fs.readFileSync(pinsFile));
    for(const key of ['source','build'])need(/^[a-f0-9]{64}$/.test(pins[key]??''),'PINS_INVALID');
    const build=own(pins.buildRoot),main=own(path.join(build,'main/index.js'));
    const source=own(path.join(owned,contract.source)),sourceReportFile=own(path.join(source,'report.json'));
    const old=JSON.parse(fs.readFileSync(sourceReportFile,'utf8'));
    need(old.success===true&&old.status==='PASS'&&old.suite==='A11-material-catalog-actual-bounded-subset'&&
      old.checks.length===12&&old.checks.every(c=>c.status==='PASS'),'SOURCE_ACCEPTANCE_REQUIRED');
    need(old.fixtures.length===3&&old.fixtures.every(f=>f.name.startsWith('QA-catalog-')&&f.name.endsWith('.txt')),'GENUINE_FIXTURE_REQUIRED');
    const specs=old.fixtures.map(f=>({id:f.id,name:f.name,sha256:f.sha256,file:own(path.join(source,'fixtures',f.name))}));
    need(new Set(specs.map(f=>f.id)).size===3,'FIXTURE_ID_INVALID');
    const alpha=specs.find(f=>f.name==='QA-catalog-alpha.txt'),beta=specs.find(f=>f.name==='QA-catalog-beta.txt');
    need(alpha&&beta,'TWO_FIXTURES_REQUIRED');
    for(const spec of specs){need(hash(fs.readFileSync(spec.file))===spec.sha256,'ORIGINAL_FIXTURE_CHANGED');}
    const dependencies=new Set();
    function dependency(file){
      const real=fs.realpathSync(file);need(real.startsWith(desktop+path.sep),'QA_DEPENDENCY_OUTSIDE_DESKTOP');
      if(dependencies.has(real))return;dependencies.add(real);
      for(const m of fs.readFileSync(real,'utf8').matchAll(/from\s*['"]([^'"]+)['"]/g)){
        if(m[1].startsWith('.'))dependency(path.resolve(path.dirname(real),m[1]));
      }
    }
    dependency(fileURLToPath(import.meta.url));
    const qaHashes=()=>[...dependencies].sort().map(file=>({file:path.relative(desktop,file),sha256:hash(fs.readFileSync(file))})),qaBefore=qaHashes();
    const verify=()=>{
      need(hash(fs.readFileSync(pinsFile))===pinsHash,'PINS_CHANGED');need(own(pins.buildRoot)===build,'BUILD_REDIRECT');
      need(fingerprint(build).sha256===pins.build,'BUILD_PIN_MISMATCH');
      need(fingerprint(path.join(desktop,'src')).sha256===pins.source,'SOURCE_PIN_MISMATCH');
      assert.deepEqual(qaHashes(),qaBefore,'QA dependency bytes changed');
      if(sourceInventory)need(tree(source).sha256===sourceInventory.sha256,'SOURCE_EVIDENCE_CHANGED');
    };
    finalSource=()=>{
      verify();
      if(sourceLogical)need(readDb(path.join(source,'data/app.db'),logical).sha256===sourceLogical.sha256,'SOURCE_LOGICAL_CHANGED');
      if(sourceInventory)need(tree(source).sha256===sourceInventory.sha256,'SOURCE_EVIDENCE_CHANGED');
      if(report)report.sourceAndPinsFinalIntegrity=true;
    };
    // No launch or fixture copy occurs when strict current pins do not match.
    verify();output=fs.mkdtempSync(path.join(owned,'ui-final-material-metadata-recovery-live-'));
    const data=path.join(output,'data'),profile=path.join(output,'profile');
    report={suite:'X02-material-metadata-committed-ack-loss',status:'RUNNING',success:false,output,data,profile,
      phase:'COLD_SNAPSHOT',startedAt:new Date(started).toISOString(),pins:{file:pinsFile,sha256:pinsHash,...pins},
      originalGeneration:{report:sourceReportFile,sha256:hash(fs.readFileSync(sourceReportFile)),pins:old.pins},
      contract,qaBefore,checks:contract.checks.map(code=>({code,status:'NOT_RUN'})),errors:[],launches:0,guards:[],ledgers:[],
      seams:['Original main-window-guarded catalog-save handler delegates once, then throws X02_ACK_LOST_AFTER_REAL_COMMIT only after genuine success.',
        'One original catalog-metadata read is held after real read/authority checks and released unchanged after UI selects the other object.',
        'No synthetic success, SQL business writes, direct write IPC, modified runtime events, acceptance/retry/model calls or native picker seams.'],
      notRun:contract.notRun};persist();
    hardTimer=setTimeout(()=>{timedOut=true;report.timeout=true;persist();terminate();},Math.max(1,deadlineAt-Date.now()));
    const mark=(code,detail)=>{const check=report.checks.find(c=>c.code===code);check.status='PASS';if(detail)check.evidence=detail;persist();};
    const phase=code=>{remaining();report.phase=code;(report.timeline??=[]).push({code,at:Date.now()});persist();};
    phase('GENUINE_TXT_COLD_CLONE');
    sourceInventory=tree(source);
    const snapshot=await cloneBaseline(source,output,deadlineAt-contract.cleanupMs);
    need(snapshot.sourceInventory.sha256===sourceInventory.sha256,'SOURCE_EVIDENCE_CHANGED');
    sourceInventory=snapshot.sourceInventory;sourceLogical=snapshot.sourceLogical;baseline=snapshot.sourceFacts;
    need(baseline.resources.length===3,'SOURCE_RESOURCE_COUNT');
    for(const spec of specs){
      const row=baseline.resources.find(r=>r.id===spec.id);need(row&&row.content_hash===spec.sha256&&row.original_file_name===spec.name,'SOURCE_ROW_MISMATCH');
      need(row.parse_engine&&['ready','parsed','chunked','indexed','graph_extracted'].includes(row.parse_status),'REAL_PARSER_REQUIRED');
      const originalPath=own(row.local_path);need(originalPath.startsWith(path.join(source,'data')+path.sep),'SOURCE_FILE_OUTSIDE_OWNED_FIXTURE');
      need(hash(fs.readFileSync(originalPath))===spec.sha256,'SOURCE_BYTES_CHANGED');
    }
    // Protect all immutable resource/image/source/session file bytes copied into owned data.
    const dataFilesBefore=tree(data).files.filter(f=>!/(?:^|[\\/])app\.db(?:-(?:wal|shm|journal))?$/.test(f.file));
    report.snapshot={...snapshot,sourceFacts:undefined};report.fixtures=specs;
    report.ledgers.push({label:'cloned-before-launch',ledger:baseline.ledger,native:baseline.native,sourceTables:baseline.sourceTables});mark('GENUINE_TXT_COLD_CLONE');
    const targetBefore=baseline.metadata.find(r=>r.resource_id===alpha.id);need(targetBefore,'SOURCE_METADATA_REQUIRED');
    const desired={directory:'QA X02 回执核实目录',tags:['QA X02 回执核实','QA X02 草稿守恒']};
    report.mutation={resourceId:alpha.id,sourceVersion:alpha.sha256,baseRevision:targetBefore.revision,metadata:desired};
    const options={resourceId:alpha.id,sourceVersion:alpha.sha256,revision:targetBefore.revision,
      schema:contract.schema,metadata:desired,deadlineAt:deadlineAt-contract.cleanupMs};
    const stateFile=path.join(output,'bootstrap-state.json'),bootstrapFile=path.join(output,'owned-bootstrap.cjs');
    const baseBootstrap=continuationBootstrap({main,profile,diagnosticFile:stateFile});
    // Register transport wrapper before formal handler registration; unchanged bootstrap still
    // binds profile and installs the early zero-HTTP guard before importing production main.
    fs.writeFileSync(bootstrapFile,'('+installMetadataRecoveryTransport.toString()+')(require("electron"),'+JSON.stringify(options)+');\n'+baseBootstrap,{flag:'wx'});
    report.bootstrapSha256=hash(fs.readFileSync(bootstrapFile));
    const env={...process.env};
    for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||
      ['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
    Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',
      OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'1'});
    const seamState=()=>app.evaluate(()=>JSON.parse(JSON.stringify(globalThis.__qaMaterialMetadataRecovery.state)));
    async function audit(){
      remaining();const value=await app.evaluate(continuationGuardRead);report.guards=[value];
      need(value.networkAttempts===0&&value.modelAttempts===0&&value.rendererErrors===0&&report.errors.length===0,'ZERO_HTTP_MODEL_RENDERER_INVARIANT');
      const observed=await seamState();need(!observed.fatal,'TRANSPORT_FATAL');need(observed.saveCalls<=1,'SAVE_BUDGET_EXCEEDED');
    }
    async function wait(predicate,cap=8000){
      const end=Date.now()+remaining(cap);
      while(Date.now()<end){await audit();if(await predicate())return;await new Promise(r=>setTimeout(r,80));}
      throw Error('WAIT_DEADLINE');
    }
    const tid=id=>page.getByTestId(id);
    async function unique(locator,enabled=true){
      await locator.waitFor({state:'visible',timeout:remaining()});need(await locator.count()===1,'CONTROL_NOT_UNIQUE');
      if(enabled)await wait(()=>locator.isEnabled());return locator;
    }
    async function click(locator){await audit();await(await unique(locator)).click({timeout:remaining()});}
    async function select(spec){
      await click(page.locator(`[data-testid="material-${spec.id}"] button`));
      await wait(async()=>await tid('material-catalog-editor').getAttribute('data-resource-id')===spec.id&&await tid('material-catalog-directory').isEnabled());
    }
    const query=spec=>({schemaVersion:contract.schema,resourceId:spec.id,sourceVersion:spec.sha256});
    const get=spec=>page.evaluate(q=>window.omniEdu.getMaterialCatalogMetadata(q),query(spec));
    const snapshotAudit=label=>{
      const current=facts(data);assert.deepEqual(current.ledger,baseline.ledger,'17 key ledgers must remain unchanged');
      assert.deepEqual(current.sourceTables,baseline.sourceTables,'Source/body/image/question/paper rows must remain unchanged');
      assert.deepEqual(current.native,baseline.native,'No native replay');assert.deepEqual(current.resources,baseline.resources);
      assert.deepEqual(current.metadata.filter(r=>r.resource_id!==alpha.id),baseline.metadata.filter(r=>r.resource_id!==alpha.id));
      assert.deepEqual(current.tags.filter(r=>r.resource_id!==alpha.id),baseline.tags.filter(r=>r.resource_id!==alpha.id));
      report.ledgers.push({label,ledger:current.ledger,native:current.native,sourceTables:current.sourceTables});return current;
    };
    finalStatic=()=>{
      const current=snapshotAudit('closed-integrity-on-every-exit');
      if(committedFacts)assert.deepEqual(current,committedFacts,'No mutation after committed observation');
      else if(lastSeam?.committed===1){
        assertReceipt(beforeView,lastSeam.result,lastSeam,alpha.id,desired);
        const row=current.metadata.find(r=>r.resource_id===alpha.id);
        need(row?.revision===beforeView.revision+1&&row.operation_id===lastSeam.request.operationId&&
          row.base_revision===beforeView.revision&&row.source_version===alpha.sha256&&
          row.patch_digest===lastSeam.result.receipt.patchDigest&&row.directory===desired.directory,'PERSISTED_ORIGINAL_RECEIPT_MISMATCH');
        assert.deepEqual(current.tags.filter(r=>r.resource_id===alpha.id).map(r=>r.label),desired.tags);
      }else assert.deepEqual(current,baseline,'No genuine commit: metadata must retain baseline');
      assert.deepEqual(tree(data).files.filter(f=>!/(?:^|[\\/])app\.db(?:-(?:wal|shm|journal))?$/.test(f.file)),dataFilesBefore);
      noSourceProcess(output);noSourceProcess(source);verify();
      need(readDb(path.join(source,'data/app.db'),logical).sha256===sourceLogical.sha256,'SOURCE_LOGICAL_CHANGED');
      need(tree(source).sha256===sourceInventory.sha256,'SOURCE_EVIDENCE_CHANGED');
      report.readOnlyFinalIntegrity=true;
    };
    phase('FORMAL_WINDOW_IDENTITY_EARLY_ZERO_HTTP');verify();report.launches=1;persist();
    app=await electron.launch({args:[bootstrapFile,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:output,env,timeout:remaining(30000)});
    child=app.process();report.pid=child.pid;
    for(const stream of [child.stdout,child.stderr])stream?.on('data',chunk=>{
      (report.runtimeOutput??=[]);if(report.runtimeOutput.length<32)report.runtimeOutput.push({code:'RUNTIME_OUTPUT',hash:hash(chunk)});
      if(/uncaught|unhandledrejection|unhandled rejection/i.test(String(chunk)))report.errors.push({code:'MAIN_RUNTIME_FATAL',hash:hash(chunk)});
    });
    await waitContinuationBootstrap(app,{timeout:remaining(20000),readState:()=>readContinuationBootstrapFile(stateFile,child),
      observeWindow:true,onWindow:value=>{
        page=value;page.setDefaultTimeout(8000);
        page.on('pageerror',e=>report.errors.push({code:'PAGE_ERROR',hash:hash(String(e))}));
        page.on('console',m=>{if(m.type()==='error')report.errors.push({code:'CONSOLE_ERROR',hash:hash(m.text())});});
        page.on('dialog',d=>{report.errors.push({code:'UNEXPECTED_DIALOG',hash:hash(d.message())});void d.dismiss();});
      },onObservation:value=>{report.bootstrap=value;}});
    report.identity=await assertIsolatedPiMain(app,main,profile);
    need(await app.evaluate(({session})=>session.defaultSession.storagePath)===profile,'PROFILE_BINDING_MISMATCH');
    await tid('xiaozhi-pi-workspace').waitFor({timeout:remaining(15000)});
    need(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot()))===data,'DATA_ROOT_MISMATCH');
    const policy=await app.evaluate(continuationGuardRead,true);need(policy.policyProbe==='FORMAL_FRAME_AND_ZERO_HTTP_VERIFIED','FORMAL_POLICY_NOT_VERIFIED');
    assert.deepEqual((await seamState()).registrations,{save:1,read:1});await audit();mark('FORMAL_WINDOW_IDENTITY_EARLY_ZERO_HTTP');
    await click(page.locator('[data-testid="edu-navigation"]:visible [data-testid="nav-knowledge"]:visible'));
    await tid('materials-workspace').waitFor({state:'visible',timeout:remaining()});
    await wait(async()=>/^3 份资料/.test(await tid('materials-count').innerText()));
    await select(alpha);beforeView=await get(alpha);need(beforeView.revision===targetBefore.revision,'BASE_REVISION_CHANGED');
    phase('COMMITTED_ACK_LOSS_UNKNOWN_DRAFT');
    await(await unique(tid('material-catalog-directory'))).fill(desired.directory,{timeout:remaining()});
    await(await unique(tid('material-catalog-tags'))).fill(desired.tags.join(', '),{timeout:remaining()});
    await click(tid('material-catalog-save'));
    await wait(async()=>await tid('material-catalog-editor').getAttribute('data-unknown')==='true');
    need((await tid('material-catalog-message').innerText()).includes('提交结果待核实'),'UNKNOWN_MESSAGE_MISSING');
    need(await tid('material-catalog-directory').inputValue()===desired.directory,'UNKNOWN_DIRECTORY_DRAFT_LOST');
    assert.deepEqual((await tid('material-catalog-tags').inputValue()).split(',').map(v=>v.trim()),desired.tags);
    need(!await tid('material-catalog-save').isEnabled()&&!await tid('material-catalog-directory').isEnabled()&&
      !await tid('material-catalog-tags').isEnabled(),'UNKNOWN_WRITES_NOT_BLOCKED');
    need(!await page.locator(`[data-testid="material-${beta.id}"] button`).isEnabled(),'UNKNOWN_OBJECT_SWITCH_NOT_BLOCKED');
    const committed=await seamState();afterView=await get(alpha);assertReceipt(beforeView,afterView,committed,alpha.id,desired);
    committedFacts=snapshotAudit('unknown-after-genuine-commit');report.commit=committed;
    await page.screenshot({path:path.join(output,'unknown-preserved-draft.png'),timeout:remaining()});mark('COMMITTED_ACK_LOSS_UNKNOWN_DRAFT');
    phase('ORIGINAL_OPERATION_READ_ONLY_RECONCILIATION');
    await click(tid('material-catalog-reconcile'));
    await wait(async()=>await tid('material-catalog-editor').getAttribute('data-unknown')==='false'&&await tid('material-catalog-directory').isEnabled());
    // onSaved increments the parent revision: the original load effect clears this transient hint.
    // Assert the settled original editor/receipt, rather than requiring that hint to survive reload.
    report.reconcileHintObserved=await tid('material-catalog-message').evaluateAll(elements=>
      elements.some(e=>e.textContent?.includes('已核实目录与标签保存在本机')));
    need(await tid('material-catalog-directory').inputValue()===desired.directory&&!await tid('material-catalog-save').isEnabled(),'RECONCILED_STATE_INVALID');
    assertReceipt(beforeView,await get(alpha),await seamState(),alpha.id,desired);
    await wait(async()=>await tid('material-catalog-editor').getAttribute('data-unknown')==='false'&&await tid('material-catalog-directory').isEnabled());
    need(await tid('material-catalog-directory').inputValue()===desired.directory&&await tid('material-catalog-reconcile').count()===0&&
      !await tid('material-catalog-save').isEnabled(),'RECONCILED_STATE_INVALID');
    assert.deepEqual((await tid('material-catalog-tags').inputValue()).split(',').map(v=>v.trim()),desired.tags);
    assert.deepEqual(snapshotAudit('after-ui-read-only-reconcile'),committedFacts,'Reconciliation may not mutate any observed row');
    await page.screenshot({path:path.join(output,'original-operation-reconciled.png'),timeout:remaining()});mark('ORIGINAL_OPERATION_READ_ONLY_RECONCILIATION');
    phase('LATE_REAL_READ_CANNOT_OVERWRITE_OTHER_OBJECT');
    await select(beta);const betaView=await get(beta);
    // Arm only after all preceding real reads settled; then original object selection issues the held get.
    await app.evaluate(()=>globalThis.__qaMaterialMetadataRecovery.armRead());
    await click(page.locator(`[data-testid="material-${alpha.id}"] button`));
    await wait(async()=>(await seamState()).readHeld===1);
    need(await tid('material-catalog-editor').getAttribute('data-resource-id')===alpha.id,'HELD_TARGET_MISMATCH');
    need(!await tid('material-catalog-directory').isEnabled(),'HELD_READ_NOT_LOADING');
    await select(beta);
    await app.evaluate(()=>globalThis.__qaMaterialMetadataRecovery.releaseRead());
    await wait(async()=>(await seamState()).readDelivered===1);
    // Observe the original UI across delivery/render turns; never replace a renderer API or its result.
    for(let i=0;i<5;i++){
      await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
      need(await tid('material-catalog-editor').getAttribute('data-resource-id')===beta.id,'LATE_READ_CHANGED_OBJECT');
      need(await tid('material-catalog-directory').inputValue()===betaView.metadata.directory,'LATE_READ_CHANGED_DIRECTORY');
      assert.deepEqual((await tid('material-catalog-tags').inputValue()).split(',').map(v=>v.trim()).filter(Boolean),betaView.metadata.tags);
      need(await tid('material-catalog-editor').getAttribute('data-unknown')==='false'&&!await tid('material-catalog-save').isEnabled(),'LATE_READ_CHANGED_EDITOR');
      await new Promise(r=>setTimeout(r,100));await audit();
    }
    assert.deepEqual(await get(beta),betaView);assert.deepEqual(snapshotAudit('after-late-read'),committedFacts);
    report.lateRead=await seamState();await page.screenshot({path:path.join(output,'late-read-other-object-intact.png'),timeout:remaining()});
    mark('LATE_REAL_READ_CANNOT_OVERWRITE_OTHER_OBJECT');
    phase('FINAL_RECEIPT_REVISION_SOURCE_LEDGER');
    assertReceipt(beforeView,await get(alpha),await seamState(),alpha.id,desired);
    const sql=snapshotAudit('before-close'),row=sql.metadata.find(r=>r.resource_id===alpha.id);
    need(row.revision===beforeView.revision+1&&row.operation_id===report.commit.request.operationId&&row.base_revision===beforeView.revision&&
      row.source_version===alpha.sha256&&row.patch_digest===afterView.receipt.patchDigest,'PERSISTED_ORIGINAL_RECEIPT_MISMATCH');
    assert.deepEqual(sql.tags.filter(r=>r.resource_id===alpha.id).map(r=>r.label),desired.tags);
    verify();await audit();report.beforeView=beforeView;report.afterView=afterView;
    report.seamFinal=await seamState();
    report.cleanup=await closeContinuationRuntime({observeGuard:async()=>{await audit();return report.guards[0];},
      close:()=>app.close(),forceClose:terminate,deadlineAt,cap:4000});
    need(report.cleanup.closed&&!report.cleanup.guardError&&!report.cleanup.closeError,'OWNED_CLOSE_FAILED');
    app=undefined; // Retain the owned child handle until explicit exit proof in finally.
    assert.deepEqual(snapshotAudit('closed-final'),committedFacts);
    assert.deepEqual(tree(data).files.filter(f=>!/(?:^|[\\/])app\.db(?:-(?:wal|shm|journal))?$/.test(f.file)),dataFilesBefore,'Resource/image/source/native file bytes changed');
    noSourceProcess(source);need(tree(source).sha256===sourceInventory.sha256,'SOURCE_EVIDENCE_CHANGED');
    need(readDb(path.join(source,'data/app.db'),logical).sha256===sourceLogical.sha256,'SOURCE_LOGICAL_CHANGED');
    verify();need(Date.now()<deadlineAt,'GLOBAL_DEADLINE');report.integrity=true;mark('FINAL_RECEIPT_REVISION_SOURCE_LEDGER');report.success=true;
  }catch(error){
    if(!report)report={suite:'X02-material-metadata-committed-ack-loss',phase:'PREFLIGHT',checks:[],errors:[],launches:0,success:false};
    report.failure=diagnostic(error);report.success=false;
    const check=report.checks.find(c=>c.code===report.phase);if(check&&check.status!=='PASS')check.status='FAIL';
    if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png'),timeout:Math.max(1,Math.min(2000,deadlineAt-Date.now()))}).catch(()=>{});
  }finally{
    if(app){
      try{report.cleanup=await closeContinuationRuntime({observeGuard:async()=>{
        // The shared close helper bounds this observation as well as close itself.
        // A stalled main must not hang cleanup before the bounded close is reached.
        lastSeam=await app.evaluate(()=>JSON.parse(JSON.stringify(globalThis.__qaMaterialMetadataRecovery?.state??null)));
        report.seamOnExit=lastSeam;
        const value=await app.evaluate(continuationGuardRead);report.guards=[value];
        need(value.networkAttempts===0&&value.modelAttempts===0&&value.rendererErrors===0,'FINAL_GUARD_FAILED');return value;
      },close:()=>app.close(),forceClose:terminate,deadlineAt,cap:4000});
      if(!report.cleanup.closed||report.cleanup.guardError||report.cleanup.closeError)report.success=false;
      }catch(error){report.closeFailure=diagnostic(error);report.success=false;terminate();}
    }
    let processClosed=await confirmExit();
    if(!processClosed){report.success=false;terminate();processClosed=await confirmExit();}
    if(report.ownedProcessExit&&(report.ownedProcessExit.exitCode!==0||report.ownedProcessExit.signal))report.success=false;
    if(finalStatic&&processClosed){try{finalStatic();}catch(error){report.integrityFailure=diagnostic(error);report.integrity=false;report.success=false;}}
    else if(finalStatic){report.finalIntegrityNotRun='OWNED_CHILD_EXIT_UNVERIFIED';report.integrity=false;report.success=false;}
    if(finalSource){try{finalSource();}catch(error){report.sourceIntegrityFailure=diagnostic(error);report.integrity=false;report.success=false;}}
    if(Date.now()>=deadlineAt){report.deadlineExceeded=true;report.success=false;}
    // Late close/renderer diagnostics cannot turn into PASS, even after all UI actions succeeded.
    report.success=report.success===true&&report.errors.length===0&&report.integrity===true&&
      report.readOnlyFinalIntegrity===true&&report.sourceAndPinsFinalIntegrity===true&&
      processClosed&&report.cleanup?.closed===true&&!report.cleanup.guardError&&!report.cleanup.closeError&&
      report.checks.length===contract.checks.length&&report.checks.every(c=>c.status==='PASS');
    clearTimeout(hardTimer);report.elapsedMs=Date.now()-started;report.status=report.success?'PASS':'FAIL';
    if(!report.success)process.exitCode=1;persist();
    console.log(JSON.stringify({code:report.success?'X02_ACTUAL_PASS':'X02_ACTUAL_FAIL',output,launches:report.launches,
      success:report.success,integrity:report.integrity===true,failure:report.failure,elapsedMs:report.elapsedMs}));
  }
}
