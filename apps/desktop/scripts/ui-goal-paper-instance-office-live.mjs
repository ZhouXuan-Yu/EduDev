/** Explicit paid live runner. No build. Copies completed BUI data, fresh profile,
 * real NEW session/baskets/edit/review/snapshot/confirmation/output grant, then
 * actual Pi composer -> Office card UI approval -> six independent readbacks.
 * Default/--check performs NO app, network, data copy or model operation.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {instanceDomainEvidence,assertInstanceDomainUnchanged} from './acceptance/paper-instance-ui-evidence.mjs';
import {ledger} from './acceptance/paper-basket-ui-driver.mjs';
import {prepareFreshOfficePaperUi} from './acceptance/paper-instance-office-fixture-ui.mjs';
import {assertLiveExportOptIn,runPaperInstanceExportJourney} from './acceptance/paper-instance-export-live.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
export const command='node scripts/ui-goal-paper-instance-office-live.mjs --run-ui --live --from=latest-bui';
export function selectCompletedBui(desktop,from='latest-bui') {
  const owned=fs.realpathSync(path.join(desktop,'test-results'));
  const read=directory=>{try {const report=JSON.parse(fs.readFileSync(path.join(directory,'report.json'),'utf8'));return {directory,report};}catch{return undefined;}};
  let selected;
  if(from==='latest-bui') {
    const candidates=fs.readdirSync(owned,{withFileTypes:true}).filter(e=>e.isDirectory() && /^ui-goal-paper-instance-(?!office-live-)/.test(e.name)).map(e=>read(path.join(owned,e.name))).filter(Boolean).filter(x=>x.report.success===true && x.report.scenario==='U4-B-real-instance-UI');
    candidates.sort((a,b)=>fs.statSync(path.join(b.directory,'report.json')).mtimeMs-fs.statSync(path.join(a.directory,'report.json')).mtimeMs);
    selected=candidates[0];assert(selected,'No completed successful BUI result yet; run the parent BUI QA against its newly frozen B build first');
  } else selected=read(fs.realpathSync(path.resolve(desktop,from)));
  assert(selected?.report.success===true && selected.report.scenario==='U4-B-real-instance-UI','Only a completed successful actual BUI fixture is accepted');
  const original=fs.realpathSync(selected.directory),relative=path.relative(owned,original);
  assert(relative && relative!=='..' && !relative.startsWith('..'+path.sep) && !path.isAbsolute(relative),'Source must be an owned test-results BUI result');
  assert(fs.statSync(path.join(original,'data','app.db')).isFile());
  const questionId=selected.report.references?.questionIds?.[0]??selected.report.questionIds?.[0];
  assert(/^question_[a-f0-9-]{36}$/i.test(questionId),'Completed BUI must identify its first real bank question');
  return {original,sourceData:path.join(original,'data'),questionId};
}
async function waitFor(predicate,timeout=30000) {
  const deadline=Date.now()+timeout;
  while(Date.now()<deadline){if(await predicate())return;await new Promise(resolve=>setTimeout(resolve,100));}
  throw Error('Fresh B Office UI condition timeout');
}
export async function main(argv=process.argv.slice(2)) {
  if(argv.includes('--check') || (!argv.includes('--run-ui') && !argv.includes('--live'))) {
    assert(!(argv.includes('--check') && (argv.includes('--run-ui') || argv.includes('--live'))),'Choose --check or explicit live execution');
    console.log(JSON.stringify({preparedOnly:true,execution:false,command,modelCalls:0,requires:'Successful completed BUI result and newly frozen B-capable build; parent DEEPSEEK_API_KEY; no stale owner/workspace reuse',scope:'Fresh real UI session, new baskets and current edited/reviewed/confirmed snapshot; new UI-granted OWN output; actual Pi and Office original UI approvals; six actual file readbacks'}));return;
  }
  assertLiveExportOptIn(argv);
  assert(argv.every(v=>['--run-ui','--live'].includes(v)||v.startsWith('--from=')),'Unknown CLI argument');
  const from=argv.find(v=>v.startsWith('--from='))?.slice(7)??'latest-bui';
  const {original,sourceData,questionId}=selectCompletedBui(desktop,from);
  const main=testMain(desktop),buildRoot=path.dirname(path.dirname(main)),build=fingerprint(buildRoot);
  const source=fingerprint(sourceData),owned=fs.realpathSync(path.join(desktop,'test-results'));
  const output=fs.mkdtempSync(path.join(owned,'ui-goal-paper-instance-office-live-'));
  const data=path.join(output,'data'),profile=path.join(output,'profile'),workspace=path.join(output,'teacher-workspace');
  fs.cpSync(sourceData,data,{recursive:true,errorOnExist:true,force:false});assert.equal(fingerprint(data).sha256,source.sha256);fs.mkdirSync(workspace);
  const dbPath=path.join(data,'app.db');
  const rows=(query,args=[])=>{const db=new DatabaseSync(dbPath,{readOnly:true});try{return db.prepare(query).all(...args);}finally{db.close();}};
  const oldBaskets=()=>Object.fromEntries(rows('SELECT * FROM paper_baskets ORDER BY id').map(row=>[row.id,sha256(JSON.stringify(row))]));
  const oldSessions=()=>rows('SELECT id FROM ai_conversation_sessions ORDER BY id').map(r=>r.id);
  const domainBefore=instanceDomainEvidence(data),basketBefore=oldBaskets(),sessionBefore=oldSessions(),modelBefore=ledger(data);
  const originalGrants=()=>Object.fromEntries(['xiaozhi_pi_workspaces','xiaozhi_pi_paper_outputs'].map(table=>[table,sha256(JSON.stringify(rows('SELECT * FROM '+table+' ORDER BY conversation_id').filter(r=>sessionBefore.includes(r.conversation_id))))]));
  const originalGrantsBefore=originalGrants();
  const scriptPaths=['ui-goal-paper-instance-office-live.mjs','acceptance/paper-instance-office-fixture-ui.mjs','acceptance/paper-instance-export-live.mjs','acceptance/paper-instance-export-readback.mjs','acceptance/paper-instance-export-readback.py','acceptance/paper-instance-ui-driver.mjs','acceptance/paper-instance-ui-wait.mjs','acceptance/paper-basket-ui-driver.mjs','education/paper-ui-admission.mjs','education/paper-instance-boundaries.mjs'];
  const scripts=()=>Object.fromEntries(scriptPaths.map(file=>[file,sha256(fs.readFileSync(path.join(desktop,'scripts',file)))]));
  const report={success:false,productAcceptance:false,scenario:'U4-B-real-Pi-six-Office-files',original,output,questionId,buildBefore:build.sha256,sourceBefore:source.sha256,scriptsBefore:scripts(),checks:[],errors:[],launches:[],domainBefore,basketBefore,modelBefore,originalGrantsBefore,
    boundaries:['Parent-authorized paid Pi work, explicit --run-ui --live only; no build or private env-file read.',
      'Copied successful BUI data plus fresh profile. Fresh UI session only; original session workspace paths/authorization never rewritten or used.',
      'Plain existing real bank question, teacher-edited text/structured options/subquestion/table/references. Answer correctness remains independently unverified.',
      'Independent XML/PDF and PDFium page evidence; manual Word/WPS rendering acceptance remains separate.']};
  const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
  const persist=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  const redact=value=>{let text=String(value);const secret=process.env.DEEPSEEK_API_KEY;if(secret)text=text.split(secret).join('[redacted]');return text.replace(/sk-[\w-]+/g,'[redacted]').slice(0,1800);};
  let app,page;
  try {
    const {_electron:electron}=await import('playwright');
    const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_VISIBLE:'1'};
    for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','OMNI_EDU_E2E_LEGACY_AI'])delete env[key];
    app=await electron.launch({args:[main,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:60000});
    report.launches.push(await assertIsolatedPiMain(app,main,profile));
    page=await app.firstWindow();page.setDefaultTimeout(30000);
    page.on('pageerror',error=>report.errors.push({kind:'pageerror',message:redact(error.message)}));
    page.on('console',message=>{if(message.type()==='error')report.errors.push({kind:'console.error',message:redact(message.text())});});
    await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:60000});
    assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
    const question=await page.evaluate(id=>window.omniEdu.getQuestionNotebookEntry(id),questionId);assert.equal(question?.id,questionId);
    const fixture=await prepareFreshOfficePaperUi({page,app,output,data,report,question,marker:path.basename(output).slice(-6),check,existingSessionIds:sessionBefore});
    assert(!sessionBefore.includes(fixture.sessionId),'Must capture a genuinely NEW persisted session');
    assert(oldSessions().includes(fixture.sessionId));
    assert.equal(rows('SELECT * FROM xiaozhi_pi_workspaces WHERE conversation_id=?',[fixture.sessionId]).length,0);
    assert.equal(rows('SELECT * FROM xiaozhi_pi_paper_outputs WHERE conversation_id=?',[fixture.sessionId]).length,0);
    assert.deepEqual(ledger(data),modelBefore,'All fixture UI setup must remain model-free');
    report.freshFixture=fixture;check('Fresh UI session and confirmed current snapshot have zero original workspace bindings and zero setup model calls');
    // Test-local native chooser routing, restricted to the actual output chooser
    // title. The actual visible UI action and host authorization still execute.
    await app.evaluate(({dialog},directory)=>{
      const original=dialog.showOpenDialog;globalThis.__paperInstanceOfficeChooser=[];
      dialog.showOpenDialog=async function(...args){
        const options=args.length>1?args[1]:args[0],title=typeof options?.title==='string'?options.title:'';
        if(title.includes('试卷保存文件夹')){dialog.showOpenDialog=original;globalThis.__paperInstanceOfficeChooser.push({title,directory});return {canceled:false,filePaths:[directory]};}
        return original.apply(dialog,args);
      };
    },workspace);
    await page.getByTestId('paper-output-choose').click();
    await waitFor(()=>rows('SELECT path FROM xiaozhi_pi_paper_outputs WHERE conversation_id=?',[fixture.sessionId]).some(r=>path.resolve(r.path)===workspace));
    const grants=rows('SELECT path FROM xiaozhi_pi_paper_outputs WHERE conversation_id=?',[fixture.sessionId]);assert.equal(grants.length,1);assert.equal(fs.realpathSync(grants[0].path),fs.realpathSync(workspace));
    report.nativeChooser=await app.evaluate(()=>globalThis.__paperInstanceOfficeChooser);assert.equal(report.nativeChooser.length,1);
    check('Actual first output-grant UI persists exactly this NEW owned teacher-workspace, without modifying copied original owners');
    report.exports=await runPaperInstanceExportJourney({page,dbPath,workspace,output,...fixture,argv,python:process.env.OMNI_EDU_FIXTURE_PYTHON??'C:/Users/ZhouXuan/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe',
      enterComposer:async()=>{await page.getByTestId('paper-export-student-docx').click();},
      sourceFiles:scriptPaths.map(file=>path.join(desktop,'scripts',file)),buildFiles:[main],onCheck:check});
    assert(report.exports.success && report.exports.deliveries.length===6);
    assertInstanceDomainUnchanged(domainBefore,instanceDomainEvidence(data));
    const basketsAfter=oldBaskets();for(const [id,hash]of Object.entries(basketBefore))assert.equal(basketsAfter[id],hash,'Original copied basket changed');
    const commands=rows('SELECT command_id,run_id,status FROM xiaozhi_pi_commands WHERE conversation_id=?',[fixture.sessionId]);
    assert.equal(commands.length,6);assert.equal(new Set(commands.map(c=>c.run_id)).size,6);
    report.modelAfter=ledger(data);report.liveCommands=commands;report.domainAfter=instanceDomainEvidence(data);
    check('All six admissions belong only to the fresh export session; full bank, pre-existing baskets and immutable historical paper rows stay unchanged');
    assert.deepEqual(report.errors,[]);report.success=true;
  } catch(error) {
    report.error={name:error.name,message:redact(error.message)};
    if(page && !page.isClosed())await page.screenshot({path:path.join(output,'failure.png'),animations:'disabled'}).catch(()=>{});
  } finally {
    if(app)await app.close().catch(()=>{report.success=false;report.closeFailed=true;});
    try {
      report.domainAfterClose=instanceDomainEvidence(data);assertInstanceDomainUnchanged(domainBefore,report.domainAfterClose);
      const afterClose=oldBaskets();for(const [id,hash]of Object.entries(basketBefore))assert.equal(afterClose[id],hash,'Original copied basket changed after close');
      report.modelAfterClose=ledger(data);
      report.originalGrantsAfterClose=originalGrants();assert.deepEqual(report.originalGrantsAfterClose,originalGrantsBefore,'Pre-existing owners workspace/output authorizations must stay unchanged');
    } catch(error) {report.success=false;report.afterCloseError=redact(error.message);}
    report.buildAfter=fingerprint(buildRoot).sha256;report.sourceAfter=fingerprint(sourceData).sha256;report.scriptsAfter=scripts();
    if(report.buildAfter!==build.sha256 || report.sourceAfter!==source.sha256 || JSON.stringify(report.scriptsAfter)!==JSON.stringify(report.scriptsBefore)){report.success=false;report.integrityFailed=true;}
    persist();console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,productAcceptance:false}));
  }
  if(!report.success)process.exitCode=1;
  return report;
}
if(process.argv[1] && path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();
