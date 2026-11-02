/** D1 actual Electron/Pi QA. Default/--check is offline: no app/model/data copy.
 * Explicit live budget: ONE successful teacher DOCX + ONE A->B competition.
 * No resend, no provider substitute, no SQL/typed API domain writes, no build.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {selectCompletedBui} from './ui-goal-paper-instance-office-live.mjs';
import {prepareFreshOfficePaperUi} from './acceptance/paper-instance-office-fixture-ui.mjs';
import {assertReviewedSnapshot,captureExportInvariants,assertExportInvariants,readSavedExportFacts,SIX_EXPORTS} from './acceptance/paper-instance-export-readback.mjs';
import {expectationsFromEditedSnapshot} from './acceptance/paper-instance-export-live.mjs';
import {instanceDomainEvidence,assertInstanceDomainUnchanged} from './acceptance/paper-instance-ui-evidence.mjs';
import {ledger} from './acceptance/paper-basket-ui-driver.mjs';
import {readInstanceBasket,waitInstanceUi} from './acceptance/paper-instance-ui-driver.mjs';
import {admitPaperEnter} from './education/paper-ui-admission.mjs';
import {visibleUnique} from './acceptance/paper-basket-ui-locators.mjs';
import {assertIntentIdentity,assertCompetitionRefused,assertOwnOutput,assertOutputCanceled,budget,competitionSpec,successSpec,deliveryFacts,jsonEqual,observeDraft,publicDraft,readOutputGrants,readPort,readSingleFile,terminal,until} from './acceptance/paper-export-intent-evidence.mjs';
import {captureUi,confirmCompetitionB,expectedName,openBasket,outputChoice,readPaper,seededDraft,selectOwnOutput,showComposer,showHistoricalA} from './acceptance/paper-export-intent-ui.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const command='node scripts/ui-goal-paper-export-intent.mjs --run-ui --live --expect-build=<frozen-full-out-sha256> --from=test-results/ui-goal-paper-instance-boqzvQ';
export function parseArgs(argv) {
  assert(argv.every(arg=>['--check','--run-ui','--live'].includes(arg)||arg.startsWith('--expect-build=')||arg.startsWith('--from=')),'Unknown D1 argument');
  assert.equal(new Set(argv.map(arg=>arg.split('=')[0])).size,argv.length,'Duplicate D1 argument');
  const live=argv.includes('--run-ui')||argv.includes('--live');
  assert(!live||argv.includes('--run-ui')&&argv.includes('--live'),'Actual work requires BOTH --run-ui --live');
  assert(!(live&&argv.includes('--check')),'Choose offline check or explicit live');
  const expectedBuild=argv.find(arg=>arg.startsWith('--expect-build='))?.slice(15);
  if(live)assert.match(expectedBuild||'',/^[a-f0-9]{64}$/i,'Pin the parent final full-out fingerprint');
  return {live,expectedBuild:expectedBuild?.toLowerCase(),from:argv.find(arg=>arg.startsWith('--from='))?.slice(7)??'test-results/ui-goal-paper-instance-boqzvQ'};
}
export async function checkOffline() {
  const {validate,schema}=await protocolValidator();
  const checks=[],paper={id:'xipaper_00000000-0000-4000-8000-000000000001',digest:'a'.repeat(64)};
  const intent={schemaVersion:schema,paperId:paper.id,digest:paper.digest,audience:'teacher',format:'docx',template:'paper'};
  // These records are pure assertion inputs, never persisted or sent to the app.
  assert.deepEqual(parseArgs([]),{live:false,expectedBuild:undefined,from:'test-results/ui-goal-paper-instance-boqzvQ'});checks.push('default offline');
  for(const args of [['--live'],['--run-ui'],['--run-ui','--live'],['--check','--live','--run-ui'],['--check','--check']])assert.throws(()=>parseArgs(args));
  assert(parseArgs(['--run-ui','--live','--expect-build='+'a'.repeat(64)]).live);checks.push('explicit opt-in and build pin');
  for(const spec of SIX_EXPORTS)assertIntentIdentity({...intent,audience:spec.audience,format:spec.format,template:spec.template},paper,spec,validate);
  checks.push('six spec identity assertions');
  for(const patch of [{paperId:'other'},{digest:'b'.repeat(64)},{audience:'student'},{format:'pdf'},{template:'answer_sheet'},{absolutePath:'D:/private'}])
    assert.throws(()=>assertIntentIdentity({...intent,...patch},paper,successSpec,validate));
  checks.push('wrong paper digest spec and extra payload rejected');
  await assert.rejects(until(async()=>false,'offline false',20),/D1 timeout/);
  await assert.rejects(until(async()=>({ready:true}),'offline nonboolean',20),/must resolve to a boolean/);checks.push('awaited strict boolean');
  assert.throws(()=>readPort('must-not-open.db')('UPDATE question_bank_items SET answer=?',['forbidden']),/SELECT-only/);checks.push('database port rejects writes before opening SQLite');
  const refusal={snapshot:{running:false,officeArtifacts:[],projection:{turns:[]}},paperA:{...paper,exportCurrent:false},paperB:{id:'other',digest:'b'.repeat(64),exportCurrent:true},
    beforeFacts:{n:1},afterFacts:{n:1},files:[],beforeModel:{n:0},afterModel:{n:0},commands:[],seedBefore:{textSha256:'qa',paperExportIntent:intent},seedAfter:{textSha256:'qa',paperExportIntent:intent},notice:'pure-QA conflict notice',expectedNotice:'pure-QA conflict notice'};
  assertCompetitionRefused(refusal);checks.push('superseded A refused without B fallback');
  assert.throws(()=>assertCompetitionRefused({...refusal,snapshot:{...refusal.snapshot,officeArtifacts:[{runId:'qa-run',state:'pending'}]}}));
  assert.throws(()=>assertCompetitionRefused({...refusal,files:['unexpected.docx']}));
  assert.throws(()=>assertCompetitionRefused({...refusal,afterFacts:{n:2}}));
  assert.throws(()=>assertCompetitionRefused({...refusal,notice:'authentication'}));
  assert.throws(()=>assertCompetitionRefused({...refusal,afterModel:{n:1}}));
  assert.throws(()=>assertCompetitionRefused({...refusal,seedAfter:{textSha256:'B'}}));
  assert.throws(()=>assertCompetitionRefused({...refusal,snapshot:{...refusal.snapshot,projection:{turns:[{status:'failed',errorCode:'authentication'}]}}}));checks.push('provider errors admitted runs lost binding and side effects cannot pass');
  assert.deepEqual(budget,{successSends:1,competitionSends:1,retries:0,actualFiles:1});checks.push('fixed attempt budget');
  const controls=[],nativeResults=[],original=async()=>{throw Error('Unrouted offline native chooser');},dialog={showOpenDialog:original};
  const button={count:async()=>1,waitFor:async()=>{},isVisible:async()=>true,isDisabled:async()=>false,
    click:async()=>{controls.push('paper-output-choose');nativeResults.push(await dialog.showOpenDialog({title:'选择试卷保存文件夹',properties:['openDirectory']}));}};
  const fakePage={defaultLabel:'小智生成文件',getByTestId:id=>{assert.equal(id,'paper-output-choose','A specification button is not a chooser');return button;}};
  const fakeApp={evaluate:async(fn,input)=>fn({dialog},input)};
  for(const canceled of [true,false]) {
    const calls=await outputChoice(fakeApp,fakePage,desktop,canceled);assert.equal(calls.length,1);assert.equal(calls[0].canceled,canceled);
    assert.equal(dialog.showOpenDialog,original);assert.equal(Object.hasOwn(globalThis,'__d1OutputChoice'),false);
  }
  assert.deepEqual(controls,['paper-output-choose','paper-output-choose']);assert.deepEqual(nativeResults,[{canceled:true,filePaths:[]},{canceled:false,filePaths:[desktop]}]);
  checks.push('explicit chooser control cancel/select even with a default display label; seam restored');
  const canceledState={owner:'owned-session',paper:{id:paper.id,digest:paper.digest},basket:{id:'owned-basket',revision:1},page:{basketId:'owned-basket',stage:'preview'},
    grants:{workspaces:[],paperOutputs:[]},drafts:[],commands:[],model:{calls:0},deliveries:{artifacts:[]},files:[]};
  assertOutputCanceled(canceledState,structuredClone(canceledState));
  for(const key of Object.keys(canceledState))assert.throws(()=>assertOutputCanceled(canceledState,{...canceledState,[key]:'changed'}));
  assertOwnOutput({workspaces:[],paperOutputs:[{path:desktop}]},desktop);
  assert.throws(()=>assertOwnOutput({workspaces:[],paperOutputs:[]},desktop));
  assert.throws(()=>assertOwnOutput({workspaces:[],paperOutputs:[{path:path.dirname(desktop)}]},desktop));
  checks.push('cancel preserves every side-effect/identity observation; display label and wrong persisted path do not authorize output');
  return {success:true,checks,execution:false,modelCalls:0,persistence:false,productionIntentSchema:schema};
}
export async function protocolValidator() {
  await import('./office-agent/register-source.mjs');
  const module=await import('../src/shared/paper-export.ts');
  const {XIAOZHI_ERRORS}=await import('../src/shared/xiaozhi-projection.ts');
  assert.equal(typeof module.validPaperExportIntent,'function','D1 shared validator is not ready');
  assert.equal(module.PAPER_EXPORT_INTENT_SCHEMA,'xiaozhi.paper-export-intent.v1');
  const refusalCode='paper_export_source_changed',refusalNotice=XIAOZHI_ERRORS[refusalCode];
  assert.equal(typeof refusalNotice,'string','New bound-source rejection protocol is not frozen yet');
  assert(/组卷/.test(refusalNotice)&&/核对|确认/.test(refusalNotice),'Bound-source rejection must direct the teacher back to paper review');
  assert.notEqual(refusalNotice,XIAOZHI_ERRORS.command_conflict,'Bound source invalidation must not reuse generic command conflict');
  return {validate:module.validPaperExportIntent,schema:module.PAPER_EXPORT_INTENT_SCHEMA,refusalCode,refusalNotice};
}
export async function main(argv=process.argv.slice(2)) {
  const options=parseArgs(argv),offline=await checkOffline();
  if(!options.live){console.log(JSON.stringify({preparedOnly:true,command,budget,offline,limitations:['Offline inputs prove QA assertions only, never production or desktop acceptance.','One teacher DOCX and one competition; the old six-file Office runner/gates remain unchanged.']}));return offline;}
  assert(Boolean(process.env.DEEPSEEK_API_KEY),'Parent process DEEPSEEK_API_KEY required; no private env file is read');
  const {validate,refusalNotice}=await protocolValidator();
  const mainPath=testMain(desktop),buildRoot=path.dirname(path.dirname(mainPath)),build=fingerprint(buildRoot);
  assert.equal(build.sha256,options.expectedBuild,'Refusing an unfrozen/mismatched build BEFORE data copy, app launch or model request');
  const {original,sourceData,questionId}=selectCompletedBui(desktop,options.from),source=fingerprint(sourceData);
  const owned=fs.realpathSync(path.join(desktop,'test-results')),output=fs.mkdtempSync(path.join(owned,'ui-goal-paper-export-intent-'));
  const data=path.join(output,'data'),profile=path.join(output,'profile'),dbPath=path.join(data,'app.db');
  fs.cpSync(sourceData,data,{recursive:true,errorOnExist:true,force:false});assert.equal(fingerprint(data).sha256,source.sha256);
  const read=readPort(dbPath),sessions=()=>read('SELECT id FROM ai_conversation_sessions ORDER BY id').map(row=>row.id);
  const originalSessions=sessions(),domainBefore=instanceDomainEvidence(data),modelBefore=ledger(data);
  const baskets=()=>Object.fromEntries(read('SELECT * FROM paper_baskets ORDER BY id').map(row=>[row.id,sha256(JSON.stringify(row))]));
  const basketBefore=baskets(),grants=()=>Object.fromEntries(['xiaozhi_pi_workspaces','xiaozhi_pi_paper_outputs'].map(table=>[table,sha256(JSON.stringify(read('SELECT * FROM '+table+' ORDER BY conversation_id').filter(row=>originalSessions.includes(row.conversation_id))))]));
  const grantsBefore=grants();
  const files=['scripts/ui-goal-paper-export-intent.mjs','scripts/acceptance/paper-export-intent-evidence.mjs','scripts/acceptance/paper-export-intent-ui.mjs',
    'scripts/acceptance/paper-instance-office-fixture-ui.mjs','scripts/acceptance/paper-instance-ui-driver.mjs','scripts/acceptance/paper-instance-ui-wait.mjs','scripts/acceptance/paper-instance-export-live.mjs','scripts/acceptance/paper-instance-export-readback.mjs','scripts/acceptance/paper-instance-export-readback.py',
    'scripts/education/paper-ui-admission.mjs','src/shared/paper-export.ts','src/shared/xiaozhi-agent.ts','src/shared/xiaozhi-start.ts',
    'src/renderer/components/PaperExportEntry.tsx','src/renderer/components/desktop/DesktopFrame.tsx','src/renderer/components/office/OfficeComposerState.tsx','src/renderer/components/office/OfficeComposer.tsx','src/renderer/components/office/composer-drafts.ts','src/renderer/components/office/PiEducationWorkspace.tsx',
    'src/main/xiaozhi-agent/production-host.ts','src/main/education/paper-export.ts','src/main/education/paper-export-intent.ts',
    'src/main/xiaozhi-agent/tasks/coordinator.ts','src/main/xiaozhi-agent/tasks/continuation.ts','src/main/xiaozhi-agent/tasks/paper-export-continuation.ts','src/renderer/components/office/paper-export-request.ts'];
  const hashes=()=>Object.fromEntries(files.map(file=>[file,sha256(fs.readFileSync(path.join(desktop,file)))]));
  const report={success:false,productAcceptance:false,scenario:'U4-D1-actual-bound-export-and-superseded-refusal',original,output,buildRoot,buildBefore:build.sha256,sourceBefore:source.sha256,hashesBefore:hashes(),
    contractSha256:sha256(fs.readFileSync(path.resolve(desktop,'../../docs/audit/ui-goal-20261101/U4_D1_CONTRACT.md'))),budget,offline,checks:[],screens:[],errors:[],launches:[],admissions:[],modelBefore,
    seam:'Only one actual output-directory chooser is routed to OWN workspace or cancel per invocation, then restored. No business/provider/approval mock.',
    uncovered:['Five other specs are checked offline here; their existing six-file actual runner and original assertions are retained, not rerun.','Steer/followUp/attachments, failed-send retry, late navigation and prepared-to-install races remain Sol focused tests.','This two-send run does not add a third paid stop case or change the bank to simulate source failure.','Natural mathematics/scans, ideal layout, Word/WPS and teacher quality remain unaccepted.']};
  const redact=value=>{let text=String(value);const key=process.env.DEEPSEEK_API_KEY;if(key)text=text.split(key).join('[redacted]');return text.replace(/sk-[\w-]+/g,'[redacted]').slice(0,1600);};
  const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  const check=name=>{report.checks.push({name,pass:true});persist();console.log('PASS '+name);};
  const snapshot=id=>page.evaluate(owner=>window.omniEdu.getXiaozhiSnapshot(owner),id);
  const commandRows=id=>read('SELECT command_id,run_id,status FROM xiaozhi_pi_commands WHERE conversation_id=?',[id]);
  let app,page,phase='launch';
  async function launch() {
    const {_electron:electron}=await import('playwright'),env={...process.env};
    for(const key of Object.keys(env))if(key.startsWith('OMNI_EDU_')||['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
    Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'1'});
    assert.equal(fingerprint(buildRoot).sha256,build.sha256,'Build changed before launch');
    app=await electron.launch({args:[mainPath,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:60000});
    report.launches.push(await assertIsolatedPiMain(app,mainPath,profile));page=await app.firstWindow();page.setDefaultTimeout(30000);
    page.on('pageerror',error=>report.errors.push({phase,kind:'pageerror',message:redact(error.message)}));
    page.on('console',message=>{if(message.type()==='error')report.errors.push({phase,kind:'console.error',message:redact(message.text())});});
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
    assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
  }
  async function close(){if(app){const current=app;app=undefined;await current.close();}}
  const ctx=()=>({page,app,data,output,report,check});
  const send=async(owner,label)=>admitPaperEnter({input:page.locator('.office-composer-container:visible').getByTestId('office-prompt-input'),send:page.locator('.office-composer-container:visible').getByRole('button',{name:'发送消息',exact:true}),
    snapshot:()=>snapshot(owner),commands:()=>commandRows(owner),until:(predicate,timeout)=>until(predicate,label,timeout),report,label});
  console.log(JSON.stringify({phase:'predeclared-live-budget',budget,output,retries:0}));persist();
  try {
    await launch();
    const question=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),questionId);assert.equal(question?.id,questionId);
    const marker=path.basename(output).slice(-6);
    phase='success-ui-fixture';
    const normal=await prepareFreshOfficePaperUi({...ctx(),question,marker:marker+'A',existingSessionIds:sessions(),check:name=>check('success: '+name)});
    report.normal=normal;jsonEqual(ledger(data),modelBefore,'UI fixture setup must not call the model');
    const paper=await readPaper(page,normal.sessionId,normal.paperId),basket=await readInstanceBasket(page,normal.sessionId,normal.basketId);assertReviewedSnapshot(paper,basket);
    const invariants=captureExportInvariants({dbPath,sessionId:normal.sessionId,basketId:normal.basketId,otherBasketId:normal.otherBasketId,paperId:normal.paperId});
    const workspace=path.join(output,'success-workspace');fs.mkdirSync(workspace);
    const facts=deliveryFacts(read),cancelModel=ledger(data);
    const cancelState=async()=>({owner:(await readPaper(page,normal.sessionId,normal.paperId)).sessionId,paper:await readPaper(page,normal.sessionId,normal.paperId),
      basket:await readInstanceBasket(page,normal.sessionId,normal.basketId),
      page:await page.getByTestId('paper-basket-workspace').evaluate(root=>({url:location.href,basketId:root.dataset.basketId,revision:root.dataset.basketRevision,stage:root.dataset.stage,exportVisible:!!root.querySelector('[data-testid="paper-export-entry"]')?.getClientRects().length})),
      grants:readOutputGrants(read,normal.sessionId),drafts:(await observeDraft(page,normal.sessionId)).storedRecords,commands:commandRows(normal.sessionId),model:ledger(data),deliveries:deliveryFacts(read),files:fs.readdirSync(workspace)});
    const beforeCancel=await cancelState();
    phase='cancel-output-chooser';
    report.cancelChooser=await outputChoice(app,page,workspace,true);
    await until(async()=>!await page.getByTestId('paper-output-choose').isDisabled(),'Canceled explicit chooser settled');
    await waitInstanceUi(page,normal.sessionId,normal.basketId,{stage:'preview',revision:basket.revision});
    await visibleUnique(page.getByTestId('paper-export-entry'),'Canceled chooser keeps A visible');
    assertOutputCanceled(beforeCancel,await cancelState());assertExportInvariants(invariants);
    assert.equal(read('SELECT * FROM xiaozhi_pi_paper_outputs WHERE conversation_id=?',[normal.sessionId]).length,0);
    jsonEqual(deliveryFacts(read),facts);jsonEqual(ledger(data),cancelModel);assert.deepEqual(fs.readdirSync(workspace),[]);assert.deepEqual(commandRows(normal.sessionId),[]);
    check('Canceled original output chooser keeps the confirmed A and creates no grant, send, file or delivery fact');
    phase='normal-explicit-output-selection';
    report.successChooser=await selectOwnOutput(app,page,read,normal.sessionId,workspace);
    assert.deepEqual((await observeDraft(page,normal.sessionId)).storedRecords,beforeCancel.drafts,'Directory selection must not seed or change a draft');
    phase='normal-bound-seed';await page.getByTestId('paper-export-teacher-docx').click();
    const seed=await seededDraft(page,normal.sessionId,paper,successSpec,validate);report.normalSeed=publicDraft(seed);
    const boundPaths=[...read('SELECT path FROM xiaozhi_pi_workspaces WHERE conversation_id=?',[normal.sessionId]),...read('SELECT path FROM xiaozhi_pi_paper_outputs WHERE conversation_id=?',[normal.sessionId])];
    assert(boundPaths.length);for(const row of boundPaths)assert.equal(fs.realpathSync(row.path),fs.realpathSync(workspace),'Never inherit an original workspace');
    await captureUi(ctx(),'normal-A-bound-seed',page.locator('.office-composer-container:visible'));
    phase='normal-pi-send';
    const runId=await send(normal.sessionId,'ONE normal A teacher DOCX');report.normalRunId=runId;persist();
    const messages=read("SELECT content,metadata_json FROM ai_conversation_messages WHERE session_id=? AND role='user'",[normal.sessionId]);
    const admitted=messages.filter(row=>JSON.parse(row.metadata_json).agentRunId===runId);assert.equal(admitted.length,1);
    assert.equal(admitted[0].content,seed.text.trim());jsonEqual(JSON.parse(admitted[0].metadata_json).paperExportIntent,seed.paperExportIntent,'Host admitted a different/lost intent');
    const name=expectedName(paper,successSpec),target=path.join(workspace,name);assert(!fs.existsSync(target));let draftRow;
    await until(async()=>{
      const state=await snapshot(normal.sessionId),rows=(state.officeArtifacts??[]).filter(row=>row.runId===runId&&row.state==='pending');
      assert(rows.length<=1,'Unexpected Office proposals; no approval');
      if(rows.length){draftRow=rows[0];assert.equal(draftRow.path,name);assert.equal(draftRow.format,'docx');return true;}
      assert(!terminal(state.projection.turns.find(turn=>turn.id===runId)),'Run ended before its exact A Office draft');return false;
    },'Exact A run pending Office draft',180000);
    const review=()=>page.evaluate(async input=>{const result=await window.omniEdu.reviewXiaozhiOffice(input);if(!result.ok)throw Error(result.error);return result.value;},{schemaVersion:'xiaozhi.office-artifact.v1',sessionId:normal.sessionId,draftId:draftRow.id});
    const actual=await review();jsonEqual(actual.draft.paperSource,{paperId:paper.id,digest:paper.digest,audience:'teacher'});
    assert.equal(draftRow.sourceCount,1);assert(actual.draft.sections.every(section=>!section.figures?.length),'This text fixture cannot silently acknowledge images');
    await import('./office-agent/register-source.mjs');const {assertPaperOffice}=await import('../src/main/education/paper-export.ts');assertPaperOffice(paper,actual.draft);
    assertExportInvariants(invariants);jsonEqual(deliveryFacts(read),facts,'No pre-approval formal writes');assert.deepEqual(fs.readdirSync(workspace),[],'No pre-approval file of any name');
    const card=page.locator(`[data-testid="pi-office-artifact"][data-office-id="${draftRow.id}"]`);await card.getByTestId('pi-office-review').waitFor();
    await captureUi(ctx(),'normal-A-pending',card);const approve=card.getByTestId('pi-office-approve');await until(async()=>!await approve.isDisabled(),'Original approval enabled');
    assert.equal((await review()).revision,actual.revision);await approve.click();report.approval={via:'original-ui-click',draftId:draftRow.id,runId,revision:actual.revision};persist();
    let saved;
    await until(async()=>{
      const state=await snapshot(normal.sessionId);saved=state.officeArtifacts?.find(row=>row.id===draftRow.id);
      assert(!saved||!['failed','conflict','uncertain','rejected','interrupted'].includes(saved.state),'Office approval did not save');
      return saved?.state==='saved'&&!state.running&&terminal(state.projection.turns.find(turn=>turn.id===runId));
    },'Actual approved A file and persisted terminal run',180000);
    const [file]=readSavedExportFacts({dbPath,sessionId:normal.sessionId,workspace,paper,files:[{...successSpec,path:target,draftId:draftRow.id}]});
    report.saved=file;report.readback=await readSingleFile({file,workspace,output:path.join(output,'single-file-readback'),expectations:expectationsFromEditedSnapshot(paper).teacher,
      python:process.env.OMNI_EDU_FIXTURE_PYTHON??'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe'});
    const afterFacts=deliveryFacts(read);assert.equal(afterFacts.artifacts.length,facts.artifacts.length+1);assert.equal(afterFacts.lineage.length,facts.lineage.length+1);
    jsonEqual(afterFacts.genericSources,facts.genericSources,'Generic source facts changed');
    for(const key of ['artifacts','lineage'])for(const prior of facts[key])assert(afterFacts[key].some(row=>sha256(JSON.stringify(row))===sha256(JSON.stringify(prior))),'Previous '+key+' fact changed');
    assert.deepEqual(fs.readdirSync(workspace),[name],'Only the one approved file may exist');assertExportInvariants(invariants);
    check('One real A teacher DOCX: exact Office source/deterministic content, original UI approval, saved bytes and SQLite lineage, independent XML/order readback');
    const afterNormalModel=ledger(data);
    phase='competition-ui-fixture';
    const race=await prepareFreshOfficePaperUi({...ctx(),question,marker:marker+'R',existingSessionIds:sessions(),check:name=>check('competition: '+name)});report.race=race;
    jsonEqual(ledger(data),afterNormalModel,'The second UI fixture setup must remain model-free');
    const raceA=await readPaper(page,race.sessionId,race.paperId),raceWorkspace=path.join(output,'competition-workspace');fs.mkdirSync(raceWorkspace);
    assertReviewedSnapshot(raceA,await readInstanceBasket(page,race.sessionId,race.basketId));
    const competitionModel=ledger(data);
    report.competitionChooser=await selectOwnOutput(app,page,read,race.sessionId,raceWorkspace);
    await page.getByTestId('paper-export-student-pdf').click();
    const originalSeed=await seededDraft(page,race.sessionId,raceA,competitionSpec,validate);report.competitionSeedBefore=publicDraft(originalSeed);
    const racePaths=[...read('SELECT path FROM xiaozhi_pi_workspaces WHERE conversation_id=?',[race.sessionId]),...read('SELECT path FROM xiaozhi_pi_paper_outputs WHERE conversation_id=?',[race.sessionId])];
    assert.equal(racePaths.length,1);assert.equal(fs.realpathSync(racePaths[0].path),fs.realpathSync(raceWorkspace));
    await captureUi(ctx(),'competition-A-seed-before-B',page.locator('.office-composer-container:visible'));
    phase='confirm-B-after-A-click';const {paper:paperB}=await confirmCompetitionB(ctx(),race,marker);report.paperB={id:paperB.id,digest:paperB.digest,basket:paperB.basket};
    const olderA=await showHistoricalA(page,race.sessionId,raceA.id);assert.equal(olderA.digest,raceA.digest);
    await captureUi(ctx(),'historical-A-explicitly-blocked',page.getByTestId('paper-export-older'));
    await showComposer(page,race.sessionId);const afterB=await seededDraft(page,race.sessionId,raceA,competitionSpec,validate);jsonEqual(publicDraft(afterB),publicDraft(originalSeed),'B must not overwrite or relabel the pending A request');
    jsonEqual(ledger(data),competitionModel,'B UI confirmation and seed preservation must be model-free');
    phase='cold-bound-A-request';await close();await launch();await showComposer(page,race.sessionId);
    const cold=await seededDraft(page,race.sessionId,raceA,competitionSpec,validate);jsonEqual(publicDraft(cold),publicDraft(originalSeed),'Cold restore must keep the A text/binding atomic');
    await openBasket(page,race.sessionId,race.otherBasketId);await showHistoricalA(page,race.sessionId,raceA.id);await showComposer(page,race.sessionId);
    jsonEqual(publicDraft(await seededDraft(page,race.sessionId,raceA,competitionSpec,validate)),publicDraft(originalSeed));
    jsonEqual(ledger(data),competitionModel,'Cold restart and page navigation must not replay any model/run');
    await captureUi(ctx(),'cold-original-A-binding',page.locator('.office-composer-container:visible'));
    check('A UI seed survives confirmation of B, explicit historical-A rejection, page navigation and cold restart with unchanged text/binding; no setup model calls');
    const raceBefore=captureExportInvariants({dbPath,sessionId:race.sessionId,basketId:race.basketId,otherBasketId:race.otherBasketId,paperId:race.paperId,historyPaperIds:[paperB.id]}),raceFacts=deliveryFacts(read),raceModel=ledger(data);
    phase='competition-ONE-send';
    const composer=page.locator('.office-composer-container:visible'),input=composer.getByTestId('office-prompt-input'),sendButton=composer.getByRole('button',{name:'发送消息',exact:true});
    await until(async()=>!await input.isDisabled()&&!await sendButton.isDisabled()&&!(await snapshot(race.sessionId)).running,'Race send ready');
    assert.equal(await input.inputValue(),originalSeed.text);assert.deepEqual(commandRows(race.sessionId),[]);
    report.admissions.push({label:'ONE superseded A send; expected pre-admission rejection',enterPresses:1,admitted:false});persist();await input.press('Enter');
    const errorNotice=page.getByText(refusalNotice,{exact:true}).and(page.locator(':visible'));
    await until(async()=>{
      const state=await snapshot(race.sessionId);assert.deepEqual(state.officeArtifacts??[],[],'Stale intent proposed an Office draft; never approve it');
      const current=await observeDraft(page,race.sessionId);
      return await errorNotice.count()===1&&await errorNotice.isVisible()&&!state.running&&!current.pending&&current.text===originalSeed.text;
    },'Actual pre-admission source/current conflict and retained input');
    await visibleUnique(composer.getByRole('alert').filter({hasText:'消息未确认发送'}),'Real failed-send UI preserves the request');
    report.refusal=assertCompetitionRefused({snapshot:await snapshot(race.sessionId),paperA:await readPaper(page,race.sessionId,raceA.id),paperB:await readPaper(page,race.sessionId,paperB.id),
      beforeFacts:raceFacts,afterFacts:deliveryFacts(read),files:fs.readdirSync(raceWorkspace),beforeModel:raceModel,afterModel:ledger(data),commands:commandRows(race.sessionId),
      seedBefore:publicDraft(originalSeed),seedAfter:publicDraft(await seededDraft(page,race.sessionId,raceA,competitionSpec,validate)),notice:await errorNotice.innerText(),expectedNotice:refusalNotice});
    assertExportInvariants(raceBefore);assert.equal(sha256(fs.readFileSync(target)),file.sha256,'Previous real A delivery changed');
    await captureUi(ctx(),'competition-refused-no-B-file',page.locator('.office-composer-container:visible'));
    assert.equal(commandRows(normal.sessionId).length,1);assert.equal(commandRows(race.sessionId).length,0);assert.equal(report.admissions.length,2);
    report.modelAfter=ledger(data);assert.deepEqual(report.errors,[]);report.success=true;
    check('ONE real stale-A start refusal: explicit host-conflict UI, retained text/binding, no run/model/A-or-B draft/file/artifact/source write; two Enter presses without retry; prior A bytes unchanged');
  } catch(error) {
    report.error={phase,name:error.name,message:redact(error.message)};
    if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});
  } finally {
    try{await close();}catch(error){report.success=false;report.closeError=redact(error.message);}
    try {
      report.domainAfter=instanceDomainEvidence(data);assertInstanceDomainUnchanged(domainBefore,report.domainAfter);
      const after=baskets();for(const [id,hash]of Object.entries(basketBefore))assert.equal(after[id],hash,'Pre-existing basket changed');
      jsonEqual(grants(),grantsBefore,'Original owner grants changed');report.modelAfterClose=ledger(data);
      report.buildAfter=fingerprint(buildRoot).sha256;report.sourceAfter=fingerprint(sourceData).sha256;report.hashesAfter=hashes();
      assert.equal(report.buildAfter,build.sha256);assert.equal(report.sourceAfter,source.sha256);jsonEqual(report.hashesAfter,report.hashesBefore,'QA/production source changed during the run');
    }catch(error){report.success=false;report.integrityError=redact(error.message);}
    persist();console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,budget,productAcceptance:false}));
  }
  if(!report.success)process.exitCode=1;return report;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
