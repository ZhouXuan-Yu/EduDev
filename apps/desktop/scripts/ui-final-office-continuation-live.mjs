/** Parent-run, zero-model continuation of AkJuza's saved six-file scenario.
 * Archive the entire original first; retain its absolute data/profile/workspace.
 * Never rewrite old reports, rows, grants, manifests, or generated Office files.
 * The existing refusal helper temporarily changes ONE owned source and restores bytes.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {captureRuntimeDiagnostics} from './acceptance/runtime-diagnostics.mjs';
import {until} from './acceptance/paper-export-intent-evidence.mjs';
import {openBasket,readPaper} from './acceptance/paper-export-intent-ui.mjs';
import {assertCurrentC2Snapshot} from './acceptance/paper-template-office-evidence.mjs';
import {assertCurrentC2SourceRefusalUi,assertC2OfficePins,c2OfficeContractHash,c2OfficeDeliveryManifest} from './acceptance/paper-template-office-ui.mjs';
import {assertSixExportMatrix,readSavedExportFacts,assertExportInvariants} from './acceptance/paper-instance-export-readback.mjs';

const desktop=path.resolve(fileURLToPath(new URL('..',import.meta.url))),argv=process.argv.slice(2);
assert.equal(argv.length,4,'Use (--run-ui | --preflight) --pins=<original pins> --from=<AkJuza> --layout=<ggYrze report.json>');
assert(argv.filter(a=>['--run-ui','--preflight'].includes(a)).length===1&&argv.every(a=>['--run-ui','--preflight'].includes(a)||/^--(?:pins|from|layout)=.+/.test(a)));
assert.equal(new Set(argv.map(a=>a.split('=')[0])).size,argv.length,'Duplicate argument');
const value=name=>argv.find(a=>a.startsWith('--'+name+'=')).slice(name.length+3);
const owned=fs.realpathSync(path.join(desktop,'test-results'));
const own=file=>{const p=fs.realpathSync(path.resolve(desktop,file));assert(p.startsWith(owned+path.sep),'Owned evidence only');return p;};
const hashFile=file=>sha256(fs.readFileSync(file));
const json=file=>JSON.parse(fs.readFileSync(file,'utf8'));
const original=own(value('from')),pinsFile=own(value('pins')),layoutFile=own(value('layout'));
assert.equal(original,own('test-results/ui-final-c2-office-live-AkJuza'));
assert.equal(layoutFile,own('test-results/ui-final-c2-layout-readback-ggYrze/report.json'));
const originalPins=json(pinsFile),build=own(originalPins.buildRoot),main=path.join(build,'main/index.js');
assert.equal(build,own('test-results/ui-final-resumed-build-6x14MH/out'));
// Historical pins identify the already-produced artifacts; current QA may differ.
for(const key of ['build','source','contract'])assert.match(originalPins[key]??'',/^[a-f0-9]{64}$/);
assert.equal(fingerprint(build).sha256,originalPins.build,'Frozen production build changed');
assert.equal(fingerprint(path.join(desktop,'src')).sha256,originalPins.source,'Frozen production source changed');
const data=own(path.join(original,'data')),profile=own(path.join(original,'profile')),workspace=own(path.join(original,'workspace'));
const dbPath=path.join(data,'app.db'),oldReport=json(path.join(original,'report.json'));
const oldExports=json(path.join(original,'pi-office-six.json')),fixture=json(path.join(original,'current-c2-office-fixture.json'));
assert.equal(oldReport.success,false,'Preserve the historical failed full run');
assert.equal(oldExports.success,false,'Do not relabel the old six-export report');
assert.match(oldExports.error,/Actual numbered body text not located/,'Only the known layout-reader failure may be continued');
assert(!oldReport.sourceRefusal,'Source refusal must be the unfinished step');
for(const key of ['source','build','contract'])assert.equal(oldReport.pins[key],originalPins[key]);
const baselineOriginal=own(fixture.baselineProof.original);
assert.equal(baselineOriginal,own('test-results/ui-goal-paper-export-intent-mOHpzM'));
assert.notEqual(baselineOriginal,original);
assert.equal(fingerprint(baselineOriginal).sha256,fixture.baselineProof.originalBefore,'Original D1 baseline must remain unchanged');
assert.equal(path.resolve(fixture.dbPath),dbPath);
for(const key of ['sessionId','basketId','paperId'])assert.equal(fixture[key],oldExports[key]);
assertSixExportMatrix(oldExports.deliveries);
assert.equal(oldExports.admissions.length,6);
assert(oldExports.admissions.every(a=>a.admitted&&a.enterPresses===1));
assert.equal(new Set(oldExports.deliveries.map(f=>f.runId)).size,6);
for(const f of oldExports.deliveries){
  assert(oldExports.admissions.some(a=>a.runId===f.runId));
  assert.equal(f.approval.via,'original-ui-click');
  for(const shot of [f.approval.pendingScreenshot,f.savedScreenshot])assert(own(shot).startsWith(original+path.sep));
}
const manifestFile=path.join(original,'six-file-readback/manifest.json'),manifest=json(manifestFile);
const readbackFile=path.join(original,'six-file-readback/readback.json'),readback=json(readbackFile);
const layout=json(layoutFile),provenanceFile=path.join(path.dirname(layoutFile),'provenance.json'),provenance=json(provenanceFile);
assert.equal(readback.success,true);assert.deepEqual(readback.failures,[]);
assert.equal(readback.manifestSha256,hashFile(manifestFile));
assertSixExportMatrix(manifest.files);assertSixExportMatrix(readback.files);
assert.equal(manifest.paper.id,fixture.paperId);assert.equal(manifest.paper.digest,fixture.paper.digest);
assert.equal(fs.realpathSync(manifest.workspace),workspace);
assert.deepEqual(json(path.join(original,'c2-layout-manifest.json')),manifest);
assert.equal(layout.success,true);assert.equal(layout.files.length,6);
assert.equal(own(provenance.originalFailedRun),original);assert.equal(provenance.originalReportPreserved,true);
assert.equal(provenance.modelCalls,0);assert.equal(provenance.filesRegenerated,0);
assert.equal(provenance.sourceManifestSha256,hashFile(path.join(original,'c2-layout-manifest.json')));
assert.equal(provenance.readerSha256,hashFile(path.join(desktop,'scripts/acceptance/paper-template-office-layout.py')));
assert.deepEqual(layout.files.map(f=>path.resolve(f.path)).sort(),manifest.files.map(f=>path.resolve(f.path)).sort());
const factInput={dbPath,sessionId:fixture.sessionId,workspace,paper:fixture.paper,files:oldExports.deliveries,evidenceProtocol:'c2-v7'};
const savedFacts=()=>readSavedExportFacts(factInput);
const verifiedFiles=savedFacts();
for(const f of verifiedFiles){
  const recorded=manifest.files.find(x=>x.kind===f.kind&&x.format===f.format),read=readback.files.find(x=>x.kind===f.kind&&x.format===f.format);
  assert(recorded&&read?.success);for(const key of ['path','draftId','artifactId','sha256'])assert.equal(f[key],recorded[key]);
  assert.equal(read.path,f.path);assert.equal(read.sha256,f.sha256);
  assert.equal(oldExports.deliveries.find(x=>x.draftId===f.draftId).artifactId,f.artifactId);
}
assertExportInvariants(manifest.invariants.before);

// Freeze the current QA separately from the unchanged production contract/build.
function qaManifest(){
  const delivery=c2OfficeDeliveryManifest(),files=new Set();
  function add(file){
    const absolute=fs.realpathSync(file);assert(absolute.startsWith(desktop+path.sep));if(files.has(absolute))return;files.add(absolute);
    if(!absolute.endsWith('.mjs'))return;
    const source=fs.readFileSync(absolute,'utf8');
    for(const m of source.matchAll(/(?:from\s*|import\s*\(\s*)['"](\.[^'"]+)['"]/g)){
      const child=path.resolve(path.dirname(absolute),m[1]);if(fs.existsSync(child)&&fs.statSync(child).isFile())add(child);
    }
  }
  add(fileURLToPath(import.meta.url));for(const f of delivery.files)add(path.join(desktop,f.file));
  add(path.join(desktop,'scripts/acceptance/paper-instance-export-readback.py'));
  const hashes=[...files].sort().map(file=>({file:path.relative(desktop,file).replaceAll('\\','/'),sha256:hashFile(file)}));
  return {officeContract:delivery.qaBundleSha256,continuationContract:sha256(JSON.stringify(hashes)),files:hashes};
}
const qa=qaManifest(),originalBefore=fingerprint(original);
const historicalHashes=[...(oldExports.scriptHashes??[]),...(oldExports.sourceHashes??[])];
const changedQa=[...new Map(historicalHashes.filter(f=>hashFile(f.path)!==f.sha256).map(f=>[path.resolve(f.path),
  {file:path.relative(desktop,f.path).replaceAll('\\','/'),before:f.sha256,after:hashFile(f.path)}])).values()];
assert(changedQa.every(f=>f.file==='scripts/acceptance/paper-template-office-layout.py'),'Only the authorized QA layout-reader change may differ from the saved export evidence');
const pins={...originalPins,contract:c2OfficeContractHash(),officeContract:qa.officeContract,continuationContract:qa.continuationContract,
  originalPins:{path:pinsFile,sha256:hashFile(pinsFile),identity:originalPins},qaFiles:qa.files,
  contractTransition:{before:originalPins.contract,after:c2OfficeContractHash(),changed:originalPins.contract!==c2OfficeContractHash(),
    classification:'QA-only-reader; frozen production source/build unchanged',changedQa},
  scope:'Zero-model continuation QA; original failed reports remain unchanged'};
assertC2OfficePins(pins);
if(argv.includes('--preflight')){
  const before=ledger();assert.deepEqual(ledger(),before);assert.equal(fingerprint(original).sha256,originalBefore.sha256);
  assert.equal(fingerprint(baselineOriginal).sha256,fixture.baselineProof.originalBefore);
  console.log(JSON.stringify({success:true,scope:'Read-only preflight only; UI NOT_RUN',electronLaunches:0,filesWritten:0,
    verifiedSavedFiles:verifiedFiles.length,readbackFiles:readback.files.length,geometryFiles:layout.files.length,baselineUnchanged:true,
    build:pins.build,source:pins.source,contract:pins.contract,officeContract:pins.officeContract,contractTransition:pins.contractTransition,ledger:before}));
  process.exit(0);
}
const output=fs.mkdtempSync(path.join(owned,'ui-final-office-continuation-')),archive=path.join(output,'original-archive');
const report={success:false,scope:'AkJuza saved-six-files plus remaining original-UI source refusal only',productAcceptance:false,
  output,original,archive,pins,originalBefore:originalBefore.sha256,checks:[],errors:[],launches:[],networkAttempts:[],
  budget:{electronLaunches:1,modelSubmissions:0,composerSends:0,officeGenerations:0,sourceRefusalAttempts:1,automaticRetries:0},
  modelCalls:null,legacyFullRunSuccess:false,limits:['Reuses hash-bound original UI approvals and six-file readback; no fresh model or Office generation.',
    'Reuses ggYrze geometry evidence for the exact six hashes; not four-layout or full product acceptance.',
    'Original data/profile may change through startup/UI; owned TXT bytes are restored by the existing refusal helper, file timestamps may change.']};
const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const check=name=>{report.checks.push({name,pass:true});persist();console.log('PASS '+name);};
const evidence=[pinsFile,layoutFile,provenanceFile,...originalBefore.files.filter(f=>!['data','profile','workspace','c2-office-inputs'].includes(f.file.split('/')[0])).map(f=>path.join(original,f.file))]
  .map(file=>({file,sha256:hashFile(file)}));
const contentRoots=['workspace','c2-office-inputs','data/teacher_resources'].map(name=>({path:path.join(original,name),sha256:fingerprint(path.join(original,name)).sha256}));
const outputIdentity=()=>verifiedFiles.map(f=>{const s=fs.statSync(f.path,{bigint:true});return {path:f.path,sha256:hashFile(f.path),identity:[s.dev,s.ino,s.size,s.mtimeNs,s.ctimeNs].map(String)};});
const filesBefore=outputIdentity();
// Only counts and digests leave the process; no prompts, usage payloads or private receipts are printed.
function ledger(){
  const db=new DatabaseSync(dbPath,{readOnly:true});
  try{db.exec('PRAGMA query_only=ON; BEGIN');const result={};
    for(const table of ['ai_agent_runs','ai_agent_run_requests','xiaozhi_pi_commands','xiaozhi_pi_usage','xiaozhi_tool_receipts',
      'xiaozhi_pi_office_drafts','document_artifacts','document_artifact_paper_sources','question_bank_items','ai_confirmation_items','paper_template_versions','paper_template_receipts']){
      const rows=db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all();result[table]={count:rows.length,sha256:sha256(JSON.stringify(rows))};
    }
    const baskets=db.prepare('SELECT id,revision,data_json FROM paper_baskets ORDER BY id').all().map(row=>{const data=JSON.parse(row.data_json);delete data.uiState;return {id:row.id,revision:row.revision,data};});
    result.paperBasketDomain={count:baskets.length,sha256:sha256(JSON.stringify(baskets))};return result;
  }finally{db.close();}
}
const ledgerBefore=ledger();report.ledgerBefore=ledgerBefore;
let app,page,archiveVerified=false,detachDiagnostics;
function verify(){
  assertC2OfficePins(pins);assert.deepEqual(qaManifest(),qa,'QA changed during continuation');
  assert.equal(fingerprint(baselineOriginal).sha256,fixture.baselineProof.originalBefore,'Original D1 baseline changed');
  if(archiveVerified)assert.equal(fingerprint(archive).sha256,originalBefore.sha256,'Archived historical scenario changed');
  for(const f of evidence)assert.equal(hashFile(f.file),f.sha256,'Old evidence changed: '+f.file);
  for(const f of contentRoots)assert.equal(fingerprint(f.path).sha256,f.sha256,'Owned file bytes changed: '+f.path);
  assert.deepEqual(outputIdentity(),filesBefore,'Existing Office output replaced or modified');
  assert.deepEqual(savedFacts(),verifiedFiles);assert.deepEqual(ledger(),ledgerBefore,'No new model, command, fact or domain mutation permitted');
}
try{
  fs.writeFileSync(path.join(output,'continuation-pins.json'),JSON.stringify(pins,null,2),{flag:'wx'});persist();
  fs.cpSync(original,archive,{recursive:true,force:false,errorOnExist:true});
  assert.equal(fingerprint(archive).sha256,originalBefore.sha256);assert.equal(fingerprint(original).sha256,originalBefore.sha256,'Original changed while archiving');archiveVerified=true;
  report.evidence=evidence;report.archiveManifest=originalBefore;verify();
  check('Full original scenario archived and hash-verified; original failed reports retained');
  fs.writeFileSync(path.join(output,'verified-six-facts.json'),JSON.stringify({success:true,scope:'Current saved/lineage/bytes verification plus reused readback',files:verifiedFiles,
    readback:{path:readbackFile,sha256:hashFile(readbackFile)},geometry:{path:layoutFile,sha256:hashFile(layoutFile)},oldReportSuccess:false},null,2),{flag:'wx'});
  check('Six original saved files, exact lineage and hash-bound content/geometry readbacks verified');
  const env={...process.env};for(const k of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(k)||k.startsWith('OMNI_EDU_')||['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(k))delete env[k];
  Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'1'});
  app=await electron.launch({args:[main,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:60000});
  // Keep shutdown stderr subscribed; Playwright's app dispatcher is gone after close.
  const runtimeProcess=app.process();
  detachDiagnostics=captureRuntimeDiagnostics({process:()=>runtimeProcess},report,persist);report.launches.push(await assertIsolatedPiMain(app,main,profile));
  // Renderer network block is defense in depth; exact persistent ledgers also cover main-process model calls.
  await app.evaluate(({session})=>{globalThis.__officeContinuationNetwork=[];session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>{globalThis.__officeContinuationNetwork.push({blocked:true});cb({cancel:true});});});
  page=await app.firstWindow();page.setDefaultTimeout(15000);
  page.on('pageerror',e=>{report.errors.push({kind:'pageerror',sha256:sha256(String(e.message))});persist();});
  page.on('console',e=>{if(e.type()==='error'){report.errors.push({kind:'console.error',sha256:sha256(e.text())});persist();}});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
  assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
  await until(async()=>!(await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),fixture.sessionId)).running,'Original owner idle; no model replay');
  const basket=await openBasket(page,fixture.sessionId,fixture.basketId),paper=await readPaper(page,fixture.sessionId,fixture.paperId);
  assertCurrentC2Snapshot(paper,basket);assert.equal(paper.digest,fixture.paper.digest);assert.deepEqual(paper.c2,fixture.paper.c2);assert.deepEqual(paper.templateSources,fixture.paper.templateSources);
  verify();await page.screenshot({path:path.join(output,'before-continuation.png')});
  check('Frozen build opens original absolute data/profile; current C2 paper and basket verified via read-only public APIs');
  // A new narrowly scoped gate, NOT {...oldExports, success:true} or an overwritten historical report.
  const continuationExports={success:true,scope:'Verified existing six saved facts for source-refusal continuation',deliveries:verifiedFiles};
  report.sourceRefusal=await assertCurrentC2SourceRefusalUi({page,app,data,output,fixture,exportReport:continuationExports,pins});
  assert(report.sourceRefusal.success);assert.equal(report.sourceRefusal.modelSubmissions,0);
  assert.equal((await readPaper(page,fixture.sessionId,fixture.paperId)).sourceCurrent,true,'Restored source bytes must be current again');
  report.networkAttempts=await app.evaluate(()=>globalThis.__officeContinuationNetwork);
  assert.deepEqual(report.networkAttempts,[]);assert.deepEqual(report.errors,[]);assert.deepEqual(report.runtimeDiagnostics??[],[]);
  verify();check('Remaining original-UI source refusal passes; source bytes restored, six outputs and zero-model ledgers unchanged');report.success=true;
}catch(error){
  report.error={name:error.name,message:String(error.message).replace(/sk-[A-Za-z0-9_-]+/g,'[redacted]').slice(0,1600)};
  if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
}finally{
  if(app){try{report.networkAttempts=await app.evaluate(()=>globalThis.__officeContinuationNetwork??[]);}catch{/* Preserve earlier evidence. */}
    try{await app.close();}catch(e){report.success=false;report.closeError=String(e.message).slice(0,500);}detachDiagnostics?.();}
  try{assert(archiveVerified);verify();report.ledgerAfter=ledger();report.modelCalls=0;assert.deepEqual(report.errors,[]);assert.deepEqual(report.runtimeDiagnostics??[],[]);assert.deepEqual(report.networkAttempts,[]);report.integrityVerified=true;}
  catch(e){report.success=false;report.integrityError=String(e.message).slice(0,1600);}
  persist();console.log(JSON.stringify({success:report.success,output,pins:path.join(output,'continuation-pins.json'),checks:report.checks.length,modelCalls:report.modelCalls,integrityVerified:report.integrityVerified===true}));
}
if(!report.success)process.exitCode=1;
