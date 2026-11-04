/** Read a previously completed real tool run on the current build. Never resend. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {spawn} from 'node:child_process';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {continuationBootstrap,continuationGuardRead,closeContinuationRuntime} from './acceptance/paper-adaptation-continuation.mjs';
import {productEntry} from './product-navigation.mjs';
import {disclosureTrigger} from './acceptance/paper-basket-ui-driver.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const pinsArg=process.argv.find(x=>x.startsWith('--pins='))?.slice(7);
assert(pinsArg,'Current frozen --pins required');
const pins=JSON.parse(fs.readFileSync(path.resolve(desktop,pinsArg)));
assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);
assert.equal(fingerprint(pins.buildRoot).sha256,pins.build);
const original=path.join(desktop,'test-results/ui-goal-20261101/chat-live-practice/run-XHFk0q');
const old=JSON.parse(fs.readFileSync(path.join(original,'report.json'))),run=old.runs[0];
assert.equal(old.success,true);assert.equal(run.tools.length,2);assert.equal(run.presentation.processElapsedMs,26569);
const originalHash=fingerprint(original).sha256;
const output=fs.mkdtempSync(path.join(desktop,'test-results/ui-final-chat-verification-cold-'));
const data=path.join(output,'data'),profile=path.join(output,'profile');
for(const name of ['data','profile'])fs.cpSync(path.join(original,name),path.join(output,name),{recursive:true,errorOnExist:true,force:false});
const report={success:false,output,pins,oldReportHash:sha256(fs.readFileSync(path.join(original,'report.json'))),
  sessionId:run.sessionId,runId:run.runId,checks:[],screens:[],errors:[],launches:0,
  scope:'Existing actual tool run: current cold label, trace and public body; no new streaming/model-quality claim.'};
const flush=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');
function ledger(){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{
  const tables=['ai_agent_runs','xiaozhi_pi_commands','xiaozhi_pi_usage','xiaozhi_tool_receipts','ai_confirmation_items','xiaozhi_event_journal'];
  const values=Object.fromEntries(tables.map(t=>[t,sha256(JSON.stringify(db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all()))]));
  values.native=fingerprint(path.join(data,'xiaozhi-pi')).sha256;return values;
}finally{db.close();}}
const before=ledger();let app,page,child;
const limit=Date.now()+90000;
async function until(predicate,label){while(Date.now()<limit){if(await predicate())return;await new Promise(r=>setTimeout(r,100));}throw Error('Cold verification deadline: '+label);}
try{
  flush();const main=path.join(pins.buildRoot,'main/index.js'),bootstrap=path.join(output,'bootstrap.cjs');
  fs.writeFileSync(bootstrap,continuationBootstrap({main,profile,diagnosticFile:path.join(output,'bootstrap-state.json')}));
  const env={...process.env};for(const k of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(k)||k.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(k))delete env[k];
  Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1'});
  report.launches=1;app=await electron.launch({args:[bootstrap,'--force-device-scale-factor=1'],cwd:desktop,env,timeout:30000});child=app.process();
  page=await app.firstWindow({timeout:25000});page.setDefaultTimeout(12000);
  page.on('pageerror',e=>report.errors.push({code:'PAGE_ERROR',hash:sha256(e.stack||e.message)}));
  page.on('console',m=>{if(m.type()==='error')report.errors.push({code:'CONSOLE_ERROR',hash:sha256(m.text())});});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({timeout:25000});
  report.main=await assertIsolatedPiMain(app,main,profile);report.guardBefore=await app.evaluate(continuationGuardRead,true);
  assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
  await productEntry(page,'ask').click();
  const composer=page.locator('.office-composer-container:visible');
  if(await composer.getAttribute('data-session-id')!==run.sessionId){await page.locator('[data-testid="edu-navigation"]:visible').getByTestId('workbench-session-'+run.sessionId).click();}
  await until(async()=>await composer.getAttribute('data-session-id')===run.sessionId,'exact original session');
  const turn=page.locator('.office-turn[data-turn-id="'+run.runId+'"]:visible');await turn.waitFor();
  const receipt=turn.getByTestId('office-run-receipts-details');
  const receiptTrigger=disclosureTrigger(receipt,'部分结果待核验 · 本轮记录');
  await receiptTrigger.waitFor();await receiptTrigger.focus();await receiptTrigger.press('Enter');
  await until(async()=>await receiptTrigger.getAttribute('aria-expanded')==='true','visible receipt disclosure');
  const notice=turn.getByTestId('office-verification');
  await until(async()=>await notice.locator('strong').innerText()==='部分结果待核验','honest partial evidence label');
  const dto=await page.evaluate(async({sessionId,runId})=>{const s=await window.omniEdu.getXiaozhiSnapshot(sessionId),t=s.projection.turns.find(x=>x.id===runId);return {running:s.running,status:t.status,presentation:t.presentation,verification:t.verification,tools:t.items.filter(x=>x.kind==='tool').map(x=>({id:x.id,state:x.state})),answer:t.items.filter(x=>x.role==='assistant'&&['final_answer','partial_answer'].includes(x.phase)).map(x=>({id:x.id,phase:x.phase,text:x.text}))};},{sessionId:run.sessionId,runId:run.runId});
  assert.equal(dto.running,false);assert.equal(dto.status,'completed');assert.equal(dto.verification.state,'partial');assert.equal(dto.verification.reason,'evidence_missing');
  assert(!dto.verification.checks.some(c=>c.state==='failed'));assert.equal(dto.tools.length,2);
  assert.equal(dto.presentation.processElapsedMs,run.presentation.processElapsedMs);assert.equal(dto.presentation.phase,'answer');assert(dto.answer.some(a=>a.text.trim()));
  report.publicReadback={status:dto.status,phase:dto.presentation.phase,elapsedMs:dto.presentation.processElapsedMs,bodyHash:sha256(JSON.stringify(dto.answer)),toolIds:dto.tools.map(t=>t.id),verificationState:dto.verification.state,reason:dto.verification.reason};
  assert.equal(await turn.locator('details,summary,[data-testid="agent-raw-reasoning"],[data-testid="model-reasoning"]').count(),0);
  const toggle=turn.getByTestId('agent-trace-toggle');assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  await toggle.focus();await toggle.press('Enter');await until(async()=>await toggle.getAttribute('aria-expanded')==='true','keyboard public trace');
  assert.equal(await turn.getByTestId('agent-tool-trigger').count(),2);
  report.checks.push({id:'CURRENT_COLD_LABEL_AND_REAL_PUBLIC_TRACE',pass:true});
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await app.evaluate(({BrowserWindow},s)=>BrowserWindow.getAllWindows()[0].setContentSize(s.width,s.height),{width,height});
    await until(()=>page.evaluate(s=>innerWidth===s.width&&innerHeight===s.height,{width,height}),'viewport');
    await notice.scrollIntoViewIfNeeded();const file='label-'+width+'.png';await page.screenshot({path:path.join(output,file),animations:'disabled'});report.screens.push({file,sha256:sha256(fs.readFileSync(path.join(output,file)))});
  }
  report.guardAfter=await app.evaluate(continuationGuardRead,true);
  for(const name of ['networkAttempts','modelAttempts','rendererErrors'])assert.equal(report.guardAfter[name],0);assert.equal(report.errors.length,0);
  await app.close();app=undefined;await until(()=>child.exitCode!==null||child.signalCode!==null,'owned Electron exit');
  assert.deepEqual(ledger(),before);report.checks.push({id:'NO_MODEL_REPLAY_OR_LEDGER_MUTATION',pass:true});report.success=true;
}catch(e){report.failure={name:e.name,message:String(e.message).replace(/sk-[\w-]+/g,'[credential]').slice(0,900),hash:sha256(e.stack||String(e))};if(page&&!page.isClosed())try{await page.screenshot({path:path.join(output,'failure.png')});}catch{}}
finally{
  if(app){report.cleanup=await closeContinuationRuntime({observeGuard:()=>app.evaluate(continuationGuardRead,true),close:()=>app.close(),deadlineAt:Date.now()+10000,
    forceClose:()=>{if(child?.exitCode===null&&child?.signalCode===null){assert(Number.isInteger(child.pid)&&child.pid>0&&child.pid!==process.pid);if(process.platform==='win32'){const owned=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,stdio:'ignore'});owned.on('error',()=>{});}else child.kill('SIGKILL');}}});
    try{assert(report.cleanup.closed);for(const name of ['networkAttempts','modelAttempts','rendererErrors'])assert.equal(report.cleanup.guard?.[name],0);}
    catch(e){report.success=false;report.errors.push({code:'CLEANUP',hash:sha256(e.stack||String(e))});}}
  try{if(child){const exitDeadline=Date.now()+5000;while(child.exitCode===null&&child.signalCode===null&&Date.now()<exitDeadline)await new Promise(r=>setTimeout(r,50));assert(child.exitCode!==null||child.signalCode!==null,'Owned process did not exit');}
    assert.equal(fingerprint(original).sha256,originalHash);assert.deepEqual(ledger(),before);assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);assert.equal(fingerprint(pins.buildRoot).sha256,pins.build);report.integrityVerified=true;}
  catch(e){report.integrityVerified=false;report.success=false;report.errors.push({code:'INTEGRITY',hash:sha256(e.stack||String(e))});}flush();
  if(report.errors.length){report.success=false;flush();}
}
console.log(JSON.stringify({output,success:report.success,checks:report.checks.length,failure:report.failure}));if(!report.success)process.exitCode=1;
