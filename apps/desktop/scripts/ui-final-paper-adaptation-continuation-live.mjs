/** Parent-only one cold launch; reads rk1538's ALREADY accepted result. Never sends,
 * accepts, repairs, confirms, regenerates or overwrites historical evidence. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {fingerprint} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {enterPaper,choose,disclosureTrigger} from './acceptance/paper-basket-ui-driver.mjs';
import {entryCard,entryAnchors,visibleUnique} from './acceptance/paper-basket-ui-locators.mjs';
import {readInstanceBasket,waitInstanceUi} from './acceptance/paper-instance-ui-driver.mjs';
import {digest,ownedExact,pinned,readContinuationFacts,readAdaptationObservation,continuationBootstrap,continuationGuardRead,continuationDiagnostic,waitContinuationBootstrap,readContinuationBootstrapFile,closeContinuationRuntime,prepareContinuationIsolation,continuationImmutableInventory} from './acceptance/paper-adaptation-continuation.mjs';

const desktop=path.resolve(fileURLToPath(new URL('..',import.meta.url))),argv=process.argv.slice(2);
const hashFile=file=>digest(fs.readFileSync(file)),json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const safeError=(e,phase=report?.phase??'PREFLIGHT')=>continuationDiagnostic(e,phase);
let output,report,app,page,archiveVerified=false,fatal=false,closed=false,timer,uiDeadlineAt,runtimeProcess,terminationRequested=false;
if(argv.length===1&&argv[0]==='--prepare-startup-isolation'){
  console.log(JSON.stringify(prepareContinuationIsolation(desktop)));
}else{
try{
  assert.equal(argv.length,3,'Use (--preflight | --run-ui) --from=<rk1538> --pins=<owned pins.json>');
  assert(argv.filter(a=>['--preflight','--run-ui'].includes(a)).length===1&&argv.every(a=>['--preflight','--run-ui'].includes(a)||/^--(?:from|pins)=.+/.test(a)));
  assert.equal(new Set(argv.map(a=>a.split('=')[0])).size,3,'Duplicate argument');
  const value=name=>argv.find(a=>a.startsWith('--'+name+'=')).slice(name.length+3);
  const owned=fs.realpathSync(path.join(desktop,'test-results')),own=file=>ownedExact(path.resolve(desktop,file),owned);
  const original=own(value('from')),pinsFile=own(value('pins')),pins=json(pinsFile);
  assert.equal(original,own('test-results/ui-final-paper-adaptation-live-rk1538'),'Only rk1538 is authorized');
  const originalReportFile=path.join(original,'report.json'),originalReport=json(originalReportFile);
  const generationPins={source:originalReport.pins.source,build:originalReport.pins.build};
  for(const key of ['source','build'])assert.match(generationPins[key]??'',/^[a-f0-9]{64}$/);
  assert(pinsFile.endsWith('.json'));for(const key of ['source','build'])assert.match(pins[key]??'',/^[a-f0-9]{64}$/);
  const build=own(pins.buildRoot),main=own(path.join(build,'main/index.js'));
  const proof=json(path.join(original,'c2-office-baseline.json')),baseline=own(proof.original);
  assert.equal(baseline,own('test-results/ui-goal-paper-export-intent-mOHpzM'));
  const data=own(path.join(original,'data')),profile=own(path.join(original,'profile'));
  assert.equal(path.resolve(proof.data),data);assert.equal(path.resolve(proof.profile),profile);assert.equal(path.resolve(proof.output),original);
  // Old external requests/receipts stay bound to their OLD generation pins.
  // New runtime source/build pins are independent, never evidence of regeneration.
  const input={original,baseline,pins:generationPins},before=readContinuationFacts(input),originalBefore=fingerprint(original);
  // Pin just this dependency closure, not concurrent unrelated QA files.
  const qa=()=>{
    const found=new Set();function add(file){const p=fs.realpathSync(file);assert(p.startsWith(desktop+path.sep));if(found.has(p))return;found.add(p);
      if(p.endsWith('.mjs'))for(const m of fs.readFileSync(p,'utf8').matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g))add(path.resolve(path.dirname(p),m[1]));}
    add(fileURLToPath(import.meta.url));add(path.join(desktop,'scripts/acceptance/paper-adaptation-live-ui.mjs'));
    const files=[...found].sort().map(file=>({file:path.relative(desktop,file).replaceAll('\\','/'),sha256:hashFile(file)}));return {sha256:digest(files),files};
  };
  const qaBefore=qa(),pinsHash=hashFile(pinsFile);
  const immutableFiles=originalBefore.files.filter(f=>!['data','profile'].includes(f.file.split('/')[0]));
  const immutable={sha256:digest(immutableFiles),files:immutableFiles};
  assert.deepEqual(continuationImmutableInventory(original),immutable,'Initial immutable evidence inventory');
  const verifyPins=()=>{assert.equal(hashFile(pinsFile),pinsHash);assert.equal(fingerprint(build).sha256,pins.build);assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);assert.deepEqual(qa(),qaBefore);assert.equal(fingerprint(baseline).sha256,proof.originalBefore);};
  const verifySaved=()=>{const current=readContinuationFacts(input);assert.deepEqual(current.ledger,before.ledger,'No ledger row may change, including accept receipts');assert.deepEqual(current.native,before.native,'No native session replay');assert.deepEqual(current.evidence,before.evidence);return current;};
  verifyPins();verifySaved();assert.equal(fingerprint(original).sha256,originalBefore.sha256,'Read-only preflight changed original');
  if(argv.includes('--preflight')){
    console.log(JSON.stringify({success:true,code:'READ_ONLY_PREFLIGHT_PASS',ui:'NOT_RUN',filesWritten:0,electronLaunches:0,modelCalls:0,firstFailure:before.evidence.firstFailure,
      generationPins,launchPins:{source:pins.source,build:pins.build,buildRoot:build},source:pins.source,build:pins.build,pinsHash,qa:qaBefore.sha256,originalFullHash:originalBefore.sha256,confirmed:before.evidence.candidateStatus,accepted:before.evidence.intentStatus,
      runStatus:before.evidence.runStatus,acceptReceipts:1,oldRowsUnchanged:20,ledger:before.ledger,native:before.native}));
  }else{
    output=fs.mkdtempSync(path.join(owned,'ui-final-paper-adaptation-continuation-'));const archive=path.join(output,'original-archive');
    report={schemaVersion:'xiaozhi.qa.paper-adaptation-continuation.v1',success:false,scope:'rk1538 remaining cold/read-only UI readback',productAcceptance:false,originalFullRunSuccess:false,
      original,output,archive,phase:'ARCHIVE',phaseHistory:[],generationProvenance:{pins:generationPins,originalReport:originalReportFile,originalReportHash:hashFile(originalReportFile),scope:'Already generated and externally approved under these OLD pins; never attributed to the launch build'},launchPins:{file:pinsFile,sha256:pinsHash,source:pins.source,build:pins.build,buildRoot:build},pins:{file:pinsFile,sha256:pinsHash,source:pins.source,build:pins.build,buildRoot:build,historical:pins,qa:qaBefore},
      firstFailure:before.evidence.firstFailure,provenance:before.evidence,budget:{launches:1,modelCalls:0,accepts:0,confirms:0,businessWrites:0,retries:0},launches:0,checks:[],errors:[],diagnostics:[],ledgerBefore:before.ledger,nativeBefore:before.native,
      limits:['Old paid-run report remains FAIL and immutable.','Reuses explicit old external teacher edit and approval; no new quality approval.','Startup may change owned profile/cache bytes; full before archive retained.','Only this continuation is graded, not fresh generation or all A27 paths.']};
    const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    const phase=name=>{report.phase=name;report.phaseHistory.push({phase:name,at:Date.now()});persist();};
    const check=code=>{report.checks.push({code,pass:true});persist();console.log(JSON.stringify({code}));};
    const error=(code,value)=>{fatal=true;if(report.errors.length<32)report.errors.push({code,hash:digest(String(value))});persist();};
    const terminateOwned=()=>{if(terminationRequested||!runtimeProcess)return;const proc=runtimeProcess;if(proc.exitCode!==null||proc.signalCode!==null)return;const pid=proc.pid;assert(Number.isInteger(pid)&&pid>0&&pid!==process.pid);terminationRequested=true;report.ownedTermination={code:'OWNED_LAUNCH_TREE_TERMINATION_REQUESTED',pid};persist();
      if(process.platform==='win32'){const child=spawn('taskkill.exe',['/PID',String(pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});child.on('error',e=>error('OWNED_TERMINATION_ERROR',e));child.unref();}else proc.kill('SIGKILL');};
    const verify=()=>{verifyPins();assert(archiveVerified);assert.equal(fingerprint(archive).sha256,originalBefore.sha256,'Historical archive changed');assert.deepEqual(continuationImmutableInventory(original),immutable,'Historical evidence changed or added');return verifySaved();};
    const guard=async()=>{const state=await app.evaluate(continuationGuardRead);report.guard=state;assert.equal(state.networkAttempts,0,'ZERO network attempts');assert.equal(state.modelAttempts,0,'ZERO model attempts');assert.equal(state.rendererErrors,0,'Early renderer error latched');assert(!fatal,'Runtime error latched');verifySaved();};
    const click=async locator=>{await guard();await (await visibleUnique(locator,'Unique public read/navigation control')).click({timeout:12000});};
    const wait=async(predicate,code)=>{const deadline=Date.now()+30000;while(Date.now()<deadline){await guard();if(await predicate())return;await new Promise(r=>setTimeout(r,200));}throw Error('CONTINUATION_DEADLINE_'+code);};
    const expand=async(root,title)=>{const trigger=await visibleUnique(disclosureTrigger(root,title),'Official disclosure');if(await trigger.getAttribute('aria-expanded')!=='true')await click(trigger);};
    try{
      persist();fs.cpSync(original,archive,{recursive:true,force:false,errorOnExist:true});
      assert.equal(fingerprint(archive).sha256,originalBefore.sha256);assert.equal(fingerprint(original).sha256,originalBefore.sha256,'Original changed during archive');archiveVerified=true;
      fs.writeFileSync(path.join(output,'archive-manifest.json'),JSON.stringify(originalBefore,null,2),{flag:'wx'});report.archiveHash=originalBefore.sha256;verify();check('FULL_ORIGINAL_ARCHIVED_BEFORE_LAUNCH');
      phase('BOOTSTRAP_WRITE');const bootstrap=path.join(output,'owned-bootstrap.cjs'),bootstrapStateFile=path.join(output,'bootstrap-state.json');report.bootstrapStateFile=bootstrapStateFile;
      fs.writeFileSync(bootstrap,continuationBootstrap({main,profile,diagnosticFile:bootstrapStateFile}),{flag:'wx'});report.bootstrapHash=hashFile(bootstrap);
      const env={...process.env};for(const k of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(k)||k.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(k))delete env[k];
      Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'});
      const {_electron:electron}=await import('playwright');assert.equal(report.launches,0);report.launches=1;persist();
      phase('LAUNCH');app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:output,env,timeout:60000});
      uiDeadlineAt=Date.now()+180000;runtimeProcess=app.process();timer=setTimeout(()=>{error('GLOBAL_UI_DEADLINE','180s');if(!closed)terminateOwned();},180000);
      phase('LAUNCH_RETURNED');
      for(const stream of [runtimeProcess.stdout,runtimeProcess.stderr])stream?.on('data',chunk=>{if(report.diagnostics.length<32)report.diagnostics.push({code:'RUNTIME_OUTPUT',hash:digest(chunk)});if(/uncaught|unhandledrejection|unhandled rejection/i.test(String(chunk)))error('RUNTIME_FATAL',chunk);});
      report.bootstrapObservationSource='OWNED_TERMINAL_FILE_AND_PUBLIC_FIRST_WINDOW';
      await waitContinuationBootstrap(app,{timeout:30000,observeWindow:true,readState:()=>readContinuationBootstrapFile(bootstrapStateFile,runtimeProcess),onObservation:state=>{report.bootstrapObservation=state;persist();},onWindow:window=>{
        page=window;page.setDefaultTimeout(12000);
        page.on('pageerror',e=>error('PAGE_ERROR',e));page.on('console',e=>{if(e.type()==='error')error('CONSOLE_ERROR',e.text());});
      }});
      phase('MAIN_IDENTITY');
      report.main=await assertIsolatedPiMain(app,main,profile);
      phase('STORAGE_PATH');
      assert.equal(await app.evaluate(({session})=>session.defaultSession.storagePath),profile,'Owned defaultSession partition');
      phase('WINDOW_READY');
      phase('GUARD_POLICY');report.guard=await app.evaluate(continuationGuardRead,true);assert.equal(report.guard.networkAttempts,0);
      phase('WINDOW_READY');
      await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:45000});assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
      phase('COLD_TERMINAL');let terminal;
      await wait(async()=>{terminal=await page.evaluate(async id=>{const s=await window.omniEdu.getXiaozhiSnapshot(id);return {running:s.running,turns:s.projection.turns.map(t=>({id:t.id,status:t.status}))};},before.first.sessionId);return !terminal.running&&terminal.turns.some(t=>t.id===before.first.runId&&t.status==='completed');},'COLD_COMPLETED_TURN');
      report.terminal=terminal;check('SAME_PATH_COLD_RUN_SUCCEEDED_AND_TURN_COMPLETED');
      phase('BASKET_READBACK');await enterPaper(page);await page.getByTestId('paper-basket-owner-search').fill(before.first.sessionId);
      await choose(page,page.getByTestId('paper-basket-owner'),before.first.sessionId);
      await choose(page,page.getByTestId('paper-basket-saved'),before.first.basketId);
      // Do not click a stage button: it writes a preference receipt. Require the saved organize stage.
      await waitInstanceUi(page,before.first.sessionId,before.first.basketId,{stage:'organize',revision:before.basket.revision});
      const basket=await readInstanceBasket(page,before.first.sessionId,before.first.basketId);
      assert.equal(basket.revision,before.basket.revision);assert.deepEqual(basket.entries.map(pinned),before.basket.entries.map(pinned));
      for(const entry of [before.target,before.unchosen]){
        const {heading,body}=await entryAnchors(page,entry.entryId);assert((await body.innerText()).includes(entry.question.stem),'Visible exact saved question');
        const index=basket.entries.findIndex(e=>e.entryId===entry.entryId),section=basket.blueprint.sections.find(s=>s.id===entry.sectionId),points=basket.c2?.entryPoints[entry.entryId]??section.points;
        assert.equal(await heading.innerText(),`第 ${index+1} 题 · ${section.label} · ${points} 分`);
      }
      await page.screenshot({path:path.join(output,'cold-basket.png'),animations:'disabled'});check('EXACT_TWO_ENTRIES_POSITIONS_POINTS_AND_UNCHOSEN_READBACK');
      phase('ACCEPTED_REVIEW');await click(entryCard(page,before.target.entryId).getByTestId('paper-basket-adapt'));
      const panel=page.getByTestId('paper-entry-adaptation');await expand(panel,'指定此题改编');
      await wait(async()=>await panel.getByTestId('paper-adaptation-read').isEnabled(),'READ_READY');await click(panel.getByTestId('paper-adaptation-read'));
      let view;await wait(async()=>{view=await readAdaptationObservation(page,before.reference,()=>{report.busyReadObservations=(report.busyReadObservations||0)+1;});return !!view;},'EXACT_INTENT_READ');
      assert.equal(view.intentId,before.first.intentId);assert.equal(view.status,'accepted');assert.deepEqual(view.receipt,before.record.receipt);assert.deepEqual(view.input,before.record.input);assert.equal(view.current,false);
      assert.equal(view.candidates.length,1);const candidate=view.candidates[0];assert.equal(candidate.id,before.evidence.candidateId);assert.equal(candidate.runId,before.first.runId);assert.equal(candidate.state,'confirmed');assert.equal(candidate.effectDigest,before.effect.digest);assert.deepEqual(candidate.draft,before.effect.draft);
      const chosen=await visibleUnique(panel.getByTestId('paper-adaptation-candidate').and(page.locator(`[data-candidate-id="${candidate.id}"]`)),'Exact old confirmed candidate');
      await wait(async()=>await chosen.getByTestId('paper-adaptation-accept').isDisabled(),'ACCEPT_DISABLED');
      const status=panel.getByRole('status').filter({hasText:`已回接题篮修订 ${view.receipt.basketRevision}；题目 ${view.receipt.questionId}。`});await visibleUnique(status,'Original saved receipt visible');
      const review=await visibleUnique(chosen.getByTestId('pi-question-review').and(page.locator(`[data-review-id="${candidate.id}"][data-state="confirmed"]`)),'Original confirmed review');
      const trigger=await visibleUnique(review.locator(':scope > [data-slot="disclosure-heading"] > [data-slot="chat-tool-trigger"]'),'Original review trigger');
      if(await trigger.getAttribute('aria-expanded')!=='true')await click(trigger);
      const analysis=review.getByTestId('question-review-analysis');await visibleUnique(analysis,'Saved native analysis');assert.equal(await analysis.inputValue(),before.effect.draft.items[0].analysis);assert.equal(await analysis.isDisabled(),true);
      const readReview=await page.evaluate(i=>window.omniEdu.reviewXiaozhiQuestions(i),{schemaVersion:'xiaozhi.education.question-review.v1',sessionId:before.first.sessionId,id:candidate.id});
      assert.equal(readReview.ok,true);assert.equal(readReview.value.state,'confirmed');assert.deepEqual(readReview.value.draft,before.effect.draft);assert.deepEqual(readReview.value.quality,before.effect.quality);
      await page.screenshot({path:path.join(output,'cold-accepted-review.png'),animations:'disabled'});await guard();verify();
      check('OLD_APPROVAL_EDITED_DRAFT_QUALITY_AND_SINGLE_RECEIPT_VISIBLE_NO_REACCEPT');
      await new Promise(r=>setTimeout(r,1000));await guard();check('ZERO_REPLAY_LEDGER_AND_NATIVE_SESSION_FINGERPRINTS');report.success=true;
    }catch(e){report.error=safeError(e);if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
    finally{
      if(app){const cleanup=await closeContinuationRuntime({observeGuard:guard,close:()=>app.close(),forceClose:terminateOwned,deadlineAt:uiDeadlineAt,cap:5000,onPhase:phase});closed=cleanup.closed;
        if(cleanup.guardError){report.success=false;report.guardError=cleanup.guardError;}if(cleanup.closeError){report.success=false;report.closeError=cleanup.closeError;}if(cleanup.forceCloseError){report.success=false;report.forceCloseError=cleanup.forceCloseError;}}
      clearTimeout(timer);
      try{phase('FINAL_SAVED_INTEGRITY');const after=verify();report.ledgerAfter=after.ledger;report.nativeAfter=after.native;report.originalAfterHash=fingerprint(original).sha256;
        phase('FINAL_GUARD_INTEGRITY');assert.equal(report.errors.length,0);assert(!fatal);assert(!report.guardError,'Final guard observation unavailable');assert(closed,'Owned application close not verified');assert.equal(report.guard?.policyProbe,'FORMAL_FRAME_AND_ZERO_HTTP_VERIFIED');assert.equal(report.guard.networkAttempts,0);assert.equal(report.guard.modelAttempts,0);assert.equal(report.guard.rendererErrors,0);report.integrityVerified=true;report.modelCalls=0;report.acceptCalls=0;report.status=report.success?'PASS_CONTINUATION':'FAIL';}
      catch(e){report.success=false;report.status='FAIL';report.integrityError=safeError(e);}persist();
      console.log(JSON.stringify({success:report.success,code:report.status,output,launches:report.launches,modelCalls:report.modelCalls??null,originalFullRunSuccess:false,integrityVerified:report.integrityVerified===true}));if(!report.success)process.exitCode=1;
    }
  }
}catch(e){console.log(JSON.stringify(safeError(e)));process.exitCode=1;}
}
