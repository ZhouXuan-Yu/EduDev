/** Zero-paid D1 follow-up ONLY. Reuse a byte-copy of successful actual1 data/profile.
 * No new session, question, basket, snapshot, grant or normal export. One Enter.
 * Default/--check is pure/offline. No app, profile copy, private env read or model.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {ledger} from './acceptance/paper-basket-ui-driver.mjs';
import {readSavedExportFacts} from './acceptance/paper-instance-export-readback.mjs';
import {visibleUnique} from './acceptance/paper-basket-ui-locators.mjs';
import {assertCompetitionRefused,assertIntentIdentity,competitionSpec,deliveryFacts,jsonEqual,observeDraft,publicDraft,readPort,until} from './acceptance/paper-export-intent-evidence.mjs';
import {captureUi,readPaper,seededDraft,showComposer} from './acceptance/paper-export-intent-ui.mjs';
import {protocolValidator} from './ui-goal-paper-export-intent.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const defaultFrom='test-results/ui-goal-paper-export-intent-mOHpzM';
export const command='node scripts/ui-goal-paper-export-intent-rejection-readback.mjs --run-ui --verify-existing --expect-build=<new-frozen-full-out-sha256> --from='+defaultFrom;
export const budget=Object.freeze({enterPresses:1,retries:0,newModelCalls:0,newRuns:0,newCommands:0,newMessages:0,newFiles:0,newAuthorizations:0});
export function parseArgs(argv) {
  assert(argv.every(arg=>['--check','--run-ui','--verify-existing'].includes(arg)||arg.startsWith('--expect-build=')||arg.startsWith('--from=')),'Unknown rejection-readback argument; --live is deliberately unsupported');
  assert.equal(new Set(argv.map(arg=>arg.split('=')[0])).size,argv.length,'Duplicate argument');
  const run=argv.includes('--run-ui')||argv.includes('--verify-existing');
  assert(!run||argv.includes('--run-ui')&&argv.includes('--verify-existing'),'Require --run-ui --verify-existing');
  assert(!(run&&argv.includes('--check')),'Choose offline check or actual rejection verification');
  const expectedBuild=argv.find(arg=>arg.startsWith('--expect-build='))?.slice(15);
  if(run)assert.match(expectedBuild||'',/^[a-f0-9]{64}$/i,'Pin the NEW parent frozen full-out fingerprint');
  return {run,expectedBuild:expectedBuild?.toLowerCase(),from:argv.find(arg=>arg.startsWith('--from='))?.slice(7)??defaultFrom};
}
const protectedTables=['question_bank_items','paper_baskets','paper_basket_operations','ai_confirmation_items','ai_conversation_messages',
  'xiaozhi_pi_commands','xiaozhi_pi_workspaces','xiaozhi_pi_paper_outputs','xiaozhi_pi_office_drafts','document_artifacts','document_artifact_paper_sources','document_artifact_sources'];
export function persistedFacts(read) {
  return Object.fromEntries(protectedTables.map(table=>{
    const rows=read('SELECT * FROM '+table+' ORDER BY rowid');return [table,{count:rows.length,sha256:sha256(JSON.stringify(rows))}];
  }));
}
export function assertUnchanged(before,after) {jsonEqual(after,before,'Rejection-only verification changed an existing protected fact');}
export async function checkOffline() {
  const checks=[];assert.equal(parseArgs([]).run,false);checks.push('default offline with fixed actual1 source');
  for(const argv of [['--run-ui'],['--verify-existing'],['--run-ui','--verify-existing'],['--live'],['--check','--check'],['--check','--run-ui','--verify-existing']])assert.throws(()=>parseArgs(argv));
  assert(parseArgs(['--run-ui','--verify-existing','--expect-build='+'a'.repeat(64)]).run);checks.push('explicit one-Enter verification and strict new build pin');
  const before=Object.fromEntries(protectedTables.map(table=>[table,{count:0,sha256:'pure-QA-fixture'}]));assertUnchanged(before,structuredClone(before));
  for(const table of protectedTables)assert.throws(()=>assertUnchanged(before,{...before,[table]:{count:1,sha256:'changed'}}));checks.push('each protected command/message/grant/source/domain table rejects changes');
  await assert.rejects(until(async()=>false,'offline false',20),/D1 timeout/);
  await assert.rejects(until(async()=>Promise.resolve({ready:true}),'offline nonboolean',20),/must resolve to a boolean/);checks.push('strict awaited boolean readiness');
  const {refusalCode,refusalNotice}=await protocolValidator();assert.equal(refusalCode,'paper_export_source_changed');
  assert(/组卷/.test(refusalNotice)&&/核对|确认/.test(refusalNotice));checks.push('new typed source-change notice directs teacher to paper review');
  assert.equal(budget.enterPresses,1);assert.equal(budget.newModelCalls,0);assert.equal(budget.newFiles,0);assert.equal(budget.retries,0);checks.push('no normal-export replay and no paid-case budget');
  return {success:true,execution:false,modelCalls:0,persistence:false,checks,refusalCode,refusalNotice};
}
function selectExisting(from) {
  const owned=fs.realpathSync(path.join(desktop,'test-results')),original=fs.realpathSync(path.resolve(desktop,from)),relative=path.relative(owned,original);
  assert(relative&&!relative.startsWith('..'+path.sep)&&relative!=='..'&&!path.isAbsolute(relative),'Only an OWN actual1 result is accepted');
  const report=JSON.parse(fs.readFileSync(path.join(original,'report.json'),'utf8'));
  assert(report.success===true&&report.scenario==='U4-D1-actual-bound-export-and-superseded-refusal');
  assert(report.checks.length===8&&report.checks.every(item=>item.pass===true),'Require the preserved completed actual1 8/8, never a partial attempt');
  assert(report.normal&&report.race&&report.paperB&&report.saved&&report.competitionSeedBefore&&report.approval?.via==='original-ui-click');
  assert(report.refusal?.admitted===false&&report.refusal?.draftRetained===true);assert.equal(report.saved.format,'docx');
  assert.equal(fs.realpathSync(report.output),original);
  const sourceData=fs.realpathSync(path.join(original,'data')),sourceProfile=fs.realpathSync(path.join(original,'profile'));
  assert.equal(path.dirname(sourceData),original);assert.equal(path.dirname(sourceProfile),original);
  for(const launch of report.launches)assert.equal(fs.realpathSync(launch.paths.userData),sourceProfile);
  const normalFile=fs.realpathSync(report.saved.path),normalRelative=path.relative(original,normalFile);
  assert(normalRelative&&!normalRelative.startsWith('..'+path.sep)&&!path.isAbsolute(normalRelative),'Existing normal file must remain under actual1 OWN root');
  assert.equal(sha256(fs.readFileSync(normalFile)),report.saved.sha256);return {original,sourceData,sourceProfile,sourceReport:report};
}
export async function main(argv=process.argv.slice(2)) {
  const options=parseArgs(argv),offline=await checkOffline();
  if(!options.run){console.log(JSON.stringify({preparedOnly:true,command,budget,offline,scope:'Existing actual1 A/B and draft only; no new normal Pi export or authorization'}));return offline;}
  const {validate,refusalCode,refusalNotice}=await protocolValidator();
  const mainPath=testMain(desktop),buildRoot=path.dirname(path.dirname(mainPath)),build=fingerprint(buildRoot);
  assert.equal(build.sha256,options.expectedBuild,'Refuse an unpinned build before copying or launching');
  const {original,sourceData,sourceProfile,sourceReport}=selectExisting(options.from),source=fingerprint(original),dataBefore=fingerprint(sourceData),profileBefore=fingerprint(sourceProfile);
  assert.notEqual(build.sha256,sourceReport.buildBefore,'Rejection verification requires the NEW frozen build, never the actual1 build');
  const output=fs.mkdtempSync(path.join(desktop,'test-results/ui-goal-paper-export-intent-rejection-')),data=path.join(output,'data'),profile=path.join(output,'profile');
  fs.cpSync(sourceData,data,{recursive:true,errorOnExist:true,force:false});fs.cpSync(sourceProfile,profile,{recursive:true,errorOnExist:true,force:false});
  assert.equal(fingerprint(data).sha256,dataBefore.sha256);assert.equal(fingerprint(profile).sha256,profileBefore.sha256);
  const dbPath=path.join(data,'app.db'),read=readPort(dbPath),before=persistedFacts(read),beforeModel=ledger(data),beforeDeliveries=deliveryFacts(read);
  const {race,normal,saved,paperB,competitionSeedBefore}=sourceReport;
  const raceFiles=()=>fs.readdirSync(path.join(original,'competition-workspace'));assert.deepEqual(raceFiles(),[]);
  const priorNormal=()=>{
    const files=readSavedExportFacts({dbPath,sessionId:normal.sessionId,workspace:path.dirname(saved.path),paper:{id:normal.paperId,digest:normal.digest},files:[saved]});
    assert.equal(files.length,1);jsonEqual(files[0],saved,'Original normal bytes or SQLite source changed');return files[0];
  };
  priorNormal();
  const qaPaths=['scripts/ui-goal-paper-export-intent-rejection-readback.mjs','scripts/ui-goal-paper-export-intent.mjs','scripts/acceptance/paper-export-intent-evidence.mjs','scripts/acceptance/paper-export-intent-ui.mjs','scripts/acceptance/paper-instance-export-readback.mjs'];
  const hashes=()=>Object.fromEntries(qaPaths.map(file=>[file,sha256(fs.readFileSync(path.join(desktop,file)))]));
  const productionBefore=fingerprint(path.join(desktop,'src')).sha256;
  const report={success:false,productAcceptance:false,scenario:'U4-D1-zero-paid-existing-rejection-readback',original,output,buildRoot,buildBefore:build.sha256,
    sourceBefore:source.sha256,dataCopySha256:dataBefore.sha256,profileCopySha256:profileBefore.sha256,productionBefore,qaBefore:hashes(),budget,offline,checks:[],screens:[],errors:[],launches:[],enterPresses:0,
    priorQaFreeze:sourceReport.hashesBefore,existing:{race,normal,paperB,saved,competitionSeedBefore},before,beforeModel,
    boundary:'The copied grants still name actual1 OWN directories; they are read-only verification targets. No chooser, new grant, DB auth rewrite, new paper or normal Pi call occurs. Original actual1 whole-tree fingerprint must remain identical.',
    uncovered:['No new successful Office export, five additional formats, stop or prepared-install race is claimed.','Existing DOCX bytes and SQLite source are rechecked read-only; original actual1 XML report remains unchanged.']};
  const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  const check=name=>{report.checks.push({name,pass:true});persist();console.log('PASS '+name);};
  const redact=value=>{let text=String(value);const key=process.env.DEEPSEEK_API_KEY;if(key)text=text.split(key).join('[redacted]');return text.replace(/sk-[\w-]+/g,'[redacted]').slice(0,1600);};
  const commandRows=()=>read('SELECT command_id,run_id,status FROM xiaozhi_pi_commands WHERE conversation_id=?',[race.sessionId]);
  let app,page,phase='launch';
  const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),race.sessionId);
  async function launch() {
    const {_electron:electron}=await import('playwright'),env={...process.env};
    for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_')||['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
    Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'1'});
    assert.equal(fingerprint(buildRoot).sha256,build.sha256);
    app=await electron.launch({args:[mainPath,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:60000});
    report.launches.push(await assertIsolatedPiMain(app,mainPath,profile));page=await app.firstWindow();page.setDefaultTimeout(30000);
    page.on('pageerror',error=>report.errors.push({phase,kind:'pageerror',message:redact(error.message)}));
    page.on('console',message=>{if(message.type()==='error')report.errors.push({phase,kind:'console.error',message:redact(message.text())});});
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
  }
  async function close(){if(app){const current=app;app=undefined;await current.close();}}
  const ctx=()=>({app,page,output,report});
  const unchanged=()=>{assertUnchanged(before,persistedFacts(read));jsonEqual(ledger(data),beforeModel);priorNormal();assert.deepEqual(raceFiles(),[]);};
  async function restored() {
    const composer=await showComposer(page,race.sessionId),paperA=await readPaper(page,race.sessionId,race.paperId),currentB=await readPaper(page,race.sessionId,paperB.id);
    assert.equal(paperA.digest,race.digest);assert.equal(currentB.digest,paperB.digest);assert.equal(paperA.exportCurrent,false);assert.equal(currentB.exportCurrent,true);
    const draft=await seededDraft(page,race.sessionId,paperA,competitionSpec,validate);assertIntentIdentity(draft.paperExportIntent,paperA,competitionSpec,validate);
    jsonEqual(publicDraft(draft),competitionSeedBefore,'Must restore the EXISTING actual1 A request, never synthesize or relabel it');
    assert.deepEqual(commandRows(),[]);unchanged();return {composer,paperA,currentB,draft};
  }
  console.log(JSON.stringify({phase:'predeclared-zero-paid-rejection-only',output,budget}));persist();
  try {
    check('Byte-identical independent data/profile copies retain actual1 IDs and original normal DOCX bytes/SQLite lineage; no domain/auth rewrite');
    await launch();phase='restore-existing-bound-A';let state=await restored();report.restored=publicDraft(state.draft);
    const firstRecord=state.draft.storedRecords;
    await captureUi(ctx(),'existing-A-cold-restored-before-send',state.composer);
    check('New build cold-opens the actual1 profile: exact old A text/binding, superseded A and current B, unchanged model/command/message/grant/source facts');
    const notice=page.getByText(refusalNotice,{exact:true}).and(page.locator(':visible'));assert.equal(await notice.count(),0,'New notice must be produced by this one actual Enter');
    const input=state.composer.getByTestId('office-prompt-input'),send=state.composer.getByRole('button',{name:'发送消息',exact:true});
    await until(async()=>!await input.isDisabled()&&!await send.isDisabled()&&!(await snapshot()).running,'Existing rejection request send ready');assert.equal(await input.inputValue(),state.draft.text);
    phase='ONE-existing-request-Enter';report.enterPresses=1;persist();await input.press('Enter');
    await until(async()=>{
      const current=await snapshot();assert.deepEqual(current.officeArtifacts??[],[]);assert.deepEqual(commandRows(),[],'This verification must not dispatch a run');
      const draft=await observeDraft(page,race.sessionId);
      return await notice.count()===1&&await notice.isVisible()&&!current.running&&!draft.pending&&draft.text===state.draft.text;
    },'New typed bound-source rejection with original request retained');
    await visibleUnique(state.composer.getByRole('alert').filter({hasText:'消息未确认发送'}),'Actual rejected-send UI');
    const afterDraft=await seededDraft(page,race.sessionId,state.paperA,competitionSpec,validate);jsonEqual(afterDraft.storedRecords,firstRecord,'Full saved draft changed');
    report.refusal={code:refusalCode,...assertCompetitionRefused({snapshot:await snapshot(),paperA:await readPaper(page,race.sessionId,race.paperId),paperB:await readPaper(page,race.sessionId,paperB.id),
      beforeFacts:beforeDeliveries,afterFacts:deliveryFacts(read),files:raceFiles(),beforeModel,afterModel:ledger(data),commands:commandRows(),seedBefore:competitionSeedBefore,seedAfter:publicDraft(afterDraft),notice:await notice.innerText(),expectedNotice:refusalNotice})};
    unchanged();await captureUi(ctx(),'new-source-changed-refusal-retains-A',state.composer);
    check('Exactly one real Enter yields paper_export_source_changed and clear return-to-paper-review guidance; original full draft retained, zero new paid/model/run/command/message/file/grant/source facts');
    phase='cold-after-rejection';await close();await launch();state=await restored();jsonEqual(state.draft.storedRecords,firstRecord);
    await captureUi(ctx(),'cold-after-new-refusal-original-A',state.composer);assert.equal(report.enterPresses,1);assert.deepEqual(report.errors,[]);
    check('Second cold start retains the same existing A draft/binding without another Enter or dispatch; old normal file and every protected fact remain unchanged');report.success=true;
  } catch(error) {
    report.error={phase,name:error.name,message:redact(error.message)};if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});
  } finally {
    try{await close();}catch(error){report.success=false;report.closeError=redact(error.message);}
    try {
      assert.deepEqual(report.errors,[]);unchanged();report.after=persistedFacts(read);report.modelAfter=ledger(data);report.normalReadback=priorNormal();
      report.sourceAfter=fingerprint(original).sha256;assert.equal(report.sourceAfter,source.sha256,'Original actual1 data/profile/reports/files changed');
      report.buildAfter=fingerprint(buildRoot).sha256;assert.equal(report.buildAfter,build.sha256);
      report.productionAfter=fingerprint(path.join(desktop,'src')).sha256;assert.equal(report.productionAfter,productionBefore);
      report.qaAfter=hashes();jsonEqual(report.qaAfter,report.qaBefore);
    }catch(error){report.success=false;report.integrityError=redact(error.message);}
    persist();console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,enterPresses:report.enterPresses,newModelCalls:report.success?0:null,budget,productAcceptance:false}));
  }
  if(!report.success)process.exitCode=1;return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
