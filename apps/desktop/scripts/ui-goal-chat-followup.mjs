/** Existing practice run evidence only. --check never launches Electron.
 * Parent serially runs --run. No submit/resume/stop/approval/model replay.
 * Original FAIL and live handoff/focus unverified remain immutable.
 */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {_electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {installChatPublicProbe} from './acceptance/chat-live-public-probe.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const baseline=path.join(desktop,'test-results/ui-goal-20261101/chat-live-practice/run-2zcEMX');
const reportPath=path.join(baseline,'report.json'),originalBytes=fs.readFileSync(reportPath);
const original=JSON.parse(originalBytes),owned=original.runs?.find(r=>r.name==='attachment');
const data=path.join(baseline,'data'),profile=path.join(baseline,'profile');
assert.equal(original.success,false);assert.equal(original.scenario,'practice');
assert.equal(path.resolve(original.output),baseline);
assert.equal(owned?.sessionId,'aisession_e221f564-6def-4029-ab22-634de30068f0');
assert.equal(owned?.runId,'run_ee1dcc94-a9a0-4dfc-a768-ad78dbbd6207');
for(const dir of [baseline,data,profile])assert(fs.statSync(dir).isDirectory()&&!fs.lstatSync(dir).isSymbolicLink(),'Existing owned directory required');
assert.equal(path.resolve(original.runtime.paths.userData),profile);
assert.equal(path.resolve(original.runtime.paths.sessionData),profile);
const mainFile=testMain(desktop),buildRoot=path.dirname(path.dirname(mainFile));
const currentBuild=fingerprint(buildRoot);
if(process.argv.includes('--check'))console.log(JSON.stringify({prepared:true,launchesElectron:false,modelCalls:false,
 baseline,data,profile,sessionId:owned.sessionId,runId:owned.runId,originalSuccess:false,originalCleanupStatus:original.ownedRunStop?.status,
 mainFile,sameBuild:currentBuild.sha256===original.buildSha256,expectedBuildSha256:original.buildSha256,currentBuildSha256:currentBuild.sha256,
 focusHandoffVerified:false,command:'node scripts/ui-goal-chat-followup.mjs --run'},null,2));
else if(process.argv.includes('--run'))await main();
else console.log('Prepared only. Parent uses --check first, then explicitly runs --run serially.');

// Construct an allowlisted DTO inside the renderer; never return SDK messages,
// transcripts, hidden reasoning, raw events, tool args or SQL rows.
async function readPublic(page){
 return page.evaluate(async({sessionId,runId})=>{
  const snapshot=await window.omniEdu.getXiaozhiSnapshot(sessionId);
  if(snapshot.projection.threadId!==sessionId)throw Error('Owned session mismatch');
  const turn=snapshot.projection.turns.find(t=>t.id===runId);
  if(!turn)throw Error('Owned run missing; do not substitute latest answer');
  return {sessionId,runId,running:snapshot.running,sourceSequence:snapshot.projection.sourceSequence,
   turnIds:snapshot.projection.turns.map(t=>t.id),status:turn.status,
   model:snapshot.projection.model,
   presentation:turn.presentation?{phase:turn.presentation.phase,handoff:turn.presentation.handoff,toolAfterAnswer:turn.presentation.toolAfterAnswer}:undefined,
   modelRequests:(turn.modelRequests||[]).map(r=>({request:r.request,attempt:r.attempt,state:r.state})),
   answer:turn.items.filter(i=>i.kind==='message'&&i.role==='assistant'&&['final_answer','partial_answer'].includes(i.phase))
    .map(i=>({id:i.id,phase:i.phase,text:i.text||''})),
   tools:turn.items.filter(i=>i.kind==='tool').map(i=>({id:i.id,name:i.toolName,status:i.status,label:i.label,
    summary:i.resultSummary?{text:i.resultSummary.text,query:i.resultSummary.query,scope:i.resultSummary.scope}:undefined})),
  };
 },owned);
}

async function main(){
 assert.equal(currentBuild.sha256,original.buildSha256,'Original frozen build required; no rebuild or substitute runtime');
 const output=fs.mkdtempSync(path.join(baseline,'followup-'));
 const report={success:false,overallSuccess:false,originalSuccess:false,focusHandoffVerified:false,humanAccepted:false,
  supplementaryEvidenceComplete:false,publicPracticeBodyComplete:false,output,sessionId:owned.sessionId,runId:owned.runId,
  originalReportSha256:sha256(originalBytes),buildSha256:currentBuild.sha256,originalFailureKind:'Live tool focus target detached during final handoff',
  checks:[],screens:[],consoleErrors:[],network:[],starts:0,
  scope:'Same owned data/profile/session/run; UI disclosure clicks and public reads only. No prompt, approval, resume, stop, submit, model or tool replay. Original focus failure remains unverified.'};
 const save=(name,value)=>fs.writeFileSync(path.join(output,name),JSON.stringify(value,null,2)+'\n');
 const check=name=>{report.checks.push({name,pass:true});console.log('EVIDENCE '+name);};
 let app,page;const started=Date.now();let timer;
 const section=()=>page.locator(`.office-turn[data-turn-id="${owned.runId}"]:visible`);
 async function safety(){
  assert.equal(await page.locator('[data-testid="agent-raw-reasoning"],[data-testid="model-reasoning"]').count(),0,'Private reasoning surface present; no capture');
 }
 async function shots(label){
  await safety();
  for(const [width,height] of [[1366,768],[1920,1080]]){
   await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
   await page.waitForFunction(([w,h])=>innerWidth===w&&innerHeight===h,[width,height]);
   const file=`${label}-${width}.png`;
   await section().screenshot({path:path.join(output,file),animations:'disabled',timeout:15000});
   report.screens.push({file,width,height,scope:'Owned public practice turn only'});
  }
 }
 async function launch(){
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'};
  for(const key of Object.keys(env))if(/(?:API_KEY|ACCESS_TOKEN|AUTH_TOKEN)$/.test(key)||['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
  app=await _electron.launch({args:[mainFile,`--user-data-dir=${profile}`,'--proxy-server=http://127.0.0.1:9','--proxy-bypass-list=<-loopback>'],cwd:desktop,env,timeout:60000});report.starts++;
  // Defense in depth: deny host fetch/HTTP and Chromium network. File renderer,
  // typed snapshot IPC and disclosure interactions remain available.
  await app.evaluate(({net,session})=>{
   globalThis.__followupBlocked=[];
   const blocked=()=>{globalThis.__followupBlocked.push({kind:'host-network'});return Promise.reject(Error('Read-only follow-up blocks network'));};
   globalThis.fetch=blocked;net.fetch=blocked;
   net.request=()=>{globalThis.__followupBlocked.push({kind:'electron-net-request'});throw Error('Read-only follow-up blocks network');};
   for(const name of ['http','https']){const module=process.getBuiltinModule(name);for(const method of ['request','get'])module[method]=()=>{globalThis.__followupBlocked.push({kind:'node-network'});throw Error('Read-only follow-up blocks network');};}
   session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*','ws://*/*','wss://*/*']},(_details,callback)=>{globalThis.__followupBlocked.push({kind:'renderer-network'});callback({cancel:true});});
  });
  page=await app.firstWindow();page.setDefaultTimeout(20000);
  page.on('pageerror',()=>report.consoleErrors.push({kind:'pageerror'}));
  page.on('console',message=>{if(message.type()==='error')report.consoleErrors.push({kind:'console.error'});});
  await page.evaluate(installChatPublicProbe);
  report.runtime=await assertIsolatedPiMain(app,mainFile,profile);
  const actualData=await app.evaluate(()=>process.env.OMNI_EDU_DATA_ROOT);assert.equal(path.resolve(actualData),data);
  await page.getByTestId('xiaozhi-pi-workspace').waitFor();
  const composer=page.locator('.office-composer-container:visible');
  if(await composer.getAttribute('data-session-id')!==owned.sessionId){
   const entry=page.locator('[data-testid="edu-navigation"]:visible').getByTestId(`workbench-session-${owned.sessionId}`);
   assert.equal(await entry.count(),1,'Original session history entry required');await entry.click();
  }
  await page.waitForFunction(id=>document.querySelector('.office-composer-container[data-session-id="'+id+'"]'),owned.sessionId);
  await section().waitFor();await safety();
 }
 async function close(){
  if(!app)return;report.network.push(...await app.evaluate(()=>globalThis.__followupBlocked||[]));await app.close();app=undefined;
 }
 async function noReplay(){
  const events=await page.evaluate(id=>(window.__uiChatEvents||[]).filter(e=>e.sessionId===id)
   .map(e=>({kind:e.kind,runId:e.runId,sequence:e.sequence})),owned.sessionId);
  report.observedEvents=events;
  assert(!events.some(e=>['model_request','assistant_start','tool_start'].includes(e.kind)),'Cold read attempted model/tool replay');
 }
 try{
  timer=setTimeout(()=>void app?.close().catch(()=>{}),180000);
  await launch();const before=await readPublic(page);save('cold-public-run.json',before);
  assert(['completed','failed','interrupted'].includes(before.status)&&!before.running,'Run is nonterminal; do not resume or grade complete');
  const finals=before.answer.filter(a=>a.phase==='final_answer'&&a.text.trim());
  report.publicPracticeBodyComplete=before.status==='completed'&&finals.length>0&&!before.answer.some(a=>a.phase==='partial_answer'&&a.text.trim());
  save('practice-public-body.json',{sessionId:owned.sessionId,runId:owned.runId,status:before.status,
   complete:report.publicPracticeBodyComplete,answer:before.answer});
  const toggle=section().getByTestId('agent-trace-toggle');
  assert.equal(await toggle.getAttribute('aria-expanded'),'false','Cold-restored process must initially be collapsed');
  await shots('cold-collapsed');check('Exact owned terminal run cold-read; completed process initially collapsed');
  const body=await section().getByTestId('agent-reply-body').allTextContents();
  save('practice-visible-body.json',{sessionId:owned.sessionId,runId:owned.runId,body});
  assert(body.join('').trim(),'Public rendered practice body missing');
  await toggle.click();assert.equal(await toggle.getAttribute('aria-expanded'),'true');
  const rows=section().getByTestId('office-tool-step');assert.equal(await rows.count(),before.tools.length);
  const details=[];
  for(const row of await rows.all()){
   const trigger=row.locator('button[data-testid="agent-tool-trigger"]');assert.equal(await trigger.count(),1);
   if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
   const text=await row.getByTestId('office-tool-evidence').innerText();assert(text.trim(),'Public tool detail empty');
   assert(!/实际用时|本次排队|本次执行|执行用时|调用用时|\b\d+(?:\.\d+)?\s*ms\b/.test(text),'Per-tool duration displayed');
   assert.equal(await row.locator('[data-testid="pi-tool-timing"],.office-step-duration').count(),0);
   details.push({text});
  }
  save('public-tool-details.json',{sessionId:owned.sessionId,runId:owned.runId,details});
  await shots('cold-tool-details');check('Existing public practice body and real tool details captured without invocation times');
  await noReplay();assert.deepEqual(await readPublic(page),before,'Read-only disclosure clicks changed run projection');
  report.firstColdEvents=report.observedEvents;
  await close();await launch();const restored=await readPublic(page);
  assert.deepEqual(restored,before,'Second cold read changed answer/model attempts/source sequence/turn set');
  assert.equal(await section().getByTestId('agent-trace-toggle').getAttribute('aria-expanded'),'false');
  await page.waitForTimeout(500);await noReplay();assert.deepEqual(await readPublic(page),before);
  await shots('second-cold-collapsed');check('Second cold launch preserves public answer, sequence, attempts and collapsed state without replay');
  assert(report.publicPracticeBodyComplete,'Terminal run is interrupted/failed/partial; do not claim complete practice body');
  report.supplementaryEvidenceComplete=true;
 }catch(error){report.followupFailure=error?.code==='ERR_ASSERTION'?String(error.message).split('\n')[0].slice(0,300):'Read-only UI follow-up failed; original focus failure remains unverified';}
 finally{
  clearTimeout(timer);try{await close();}catch{report.closeFailure=true;report.supplementaryEvidenceComplete=false;}
  report.originalReportUnchanged=sha256(fs.readFileSync(reportPath))===report.originalReportSha256;
  report.buildUnchanged=fingerprint(buildRoot).sha256===report.buildSha256;
  if(!report.originalReportUnchanged||!report.buildUnchanged)report.supplementaryEvidenceComplete=false;
  report.elapsedMs=Date.now()-started;save('followup-report.json',report);process.exitCode=1;
  console.log(JSON.stringify({overallSuccess:false,focusHandoffVerified:false,supplementaryEvidenceComplete:report.supplementaryEvidenceComplete,publicPracticeBodyComplete:report.publicPracticeBodyComplete,output,failure:report.followupFailure}));
 }
}
