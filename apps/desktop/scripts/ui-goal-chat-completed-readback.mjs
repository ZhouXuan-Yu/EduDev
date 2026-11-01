/** Owned completed-run screenshots only. Never sends, resumes or approves a task. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {installChatPublicProbe} from './acceptance/chat-live-public-probe.mjs';
import {settleWorkspaceTransitions} from './xiaozhi-agent/capture-workspace-metrics.mjs';

const desktop=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const owned=fs.realpathSync(path.join(desktop,'test-results'));
const from=process.argv.find(arg=>arg.startsWith('--from='))?.slice(7);
assert(from,'Provide --from=<existing successful owned run>');
const original=fs.realpathSync(path.resolve(desktop,from));
assert(original.startsWith(owned+path.sep),'Source must be owned test-results');
const sourceBytes=fs.readFileSync(path.join(original,'report.json')),sourceReport=JSON.parse(sourceBytes);
assert.equal(sourceReport.success,true);
const run=sourceReport.runs.find(item=>item.name==='attachment');assert(run?.runId && run.sessionId);
assert.equal(run.manualReopen?.status,'passed','Readback references the original proof; never regenerates it');
const expected=JSON.parse(fs.readFileSync(path.join(original,'attachment-answer.json')));
assert.equal(expected.runId,run.runId);assert.equal(expected.sessionId,run.sessionId);
const main=testMain(desktop),buildRoot=path.dirname(path.dirname(main));
assert.equal(buildRoot,fs.realpathSync(path.join(desktop,'out')),'Use the same formal out only');
const build=fingerprint(buildRoot);assert.equal(build.sha256,sourceReport.buildSha256);
if(process.argv.includes('--check')){console.log(JSON.stringify({preparedOnly:true,original,sessionId:run.sessionId,runId:run.runId,buildSha256:build.sha256,modelCalls:0}));process.exit(0);}
const sourceFingerprint=fingerprint(original);
const base=path.join(owned,'ui-goal-20261101/chat-completed-readback');fs.mkdirSync(base,{recursive:true});
const output=fs.mkdtempSync(path.join(base,'run-')),data=path.join(output,'data'),profile=path.join(output,'profile');
for(const name of ['data','profile'])fs.cpSync(path.join(original,name),path.join(output,name),{recursive:true,errorOnExist:true,force:false});
assert.equal(fingerprint(data).sha256,fingerprint(path.join(original,'data')).sha256);
assert.equal(fingerprint(profile).sha256,fingerprint(path.join(original,'profile')).sha256);
const sql=(q,args=[])=>{const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return db.prepare(q).all(...args);}finally{db.close();}};
const tables=['ai_agent_runs','ai_agent_run_requests','ai_agent_events','xiaozhi_event_journal','xiaozhi_pi_attachment_imports','xiaozhi_pi_attachments','xiaozhi_pi_attachment_sends'];
const ledger=()=>Object.fromEntries(tables.map(table=>{const rows=sql(`SELECT * FROM ${table} ORDER BY rowid`);return[table,{rows:rows.length,sha256:sha256(JSON.stringify(rows))}];}));
const before=ledger();
const nativeRelative=sql('SELECT session_file FROM xiaozhi_pi_session_bindings WHERE conversation_id=?',[run.sessionId])[0].session_file;
const nativeFile=path.resolve(data,'xiaozhi-pi',nativeRelative);assert(nativeFile.startsWith(data+path.sep));
const nativeHash=sha256(fs.readFileSync(nativeFile));
const report={success:false,scope:'completed-only cloned readback; original live manual-reopen proof is referenced, not rerun',original,output,
  sourceReportSha256:sha256(sourceBytes),sourceFixtureBefore:sourceFingerprint.sha256,buildBefore:build.sha256,
  scriptSha256:sha256(fs.readFileSync(fileURLToPath(import.meta.url))),nativeHistoryBefore:nativeHash,
  sessionId:run.sessionId,runId:run.runId,sourceManualReopen:run.manualReopen,checks:[],screens:[],errors:[],networkAttempts:[],before,
  networkObservation:'Main fetch and renderer route interception begin after firstWindow; startup before that boundary is not observed. Unchanged durable ledgers independently prove zero added model runs/requests.',
  receiptPolicy:'Byte-for-byte clone inside owned test-results; no external authorization relocation or receipt rewriting.'};
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
let app,page;
const publicState=()=>page.evaluate(async({sessionId,runId})=>{
  const s=await window.omniEdu.getXiaozhiSnapshot(sessionId),t=s.projection.turns.find(item=>item.id===runId);
  return{running:s.running,sequence:s.projection.sourceSequence,turnCount:s.projection.turns.length,
    turn:t?{id:t.id,status:t.status,presentation:t.presentation,modelRequestCount:t.modelRequests.length,
      answer:t.items.filter(item=>item.role==='assistant'&&['final_answer','partial_answer'].includes(item.phase)).map(item=>({id:item.id,phase:item.phase,text:item.text||''}))}:null};
},{sessionId:run.sessionId,runId:run.runId});
async function settle(){const window=await app.browserWindow(page);let visible;try{visible=await window.evaluate(w=>w.isVisible());}finally{await window.dispose();}return settleWorkspaceTransitions(page,{hiddenSnapshot:!visible});}
try{
  check('Exact data/profile clone; original report and fixture untouched');
  const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'',DEEPSEEK_MODEL:''};
  delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;delete env.ELECTRON_RENDERER_URL;
  app=await electron.launch({args:[main,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});
  page=await app.firstWindow();page.on('pageerror',()=>report.errors.push('pageerror'));page.on('console',message=>{if(message.type()==='error')report.errors.push('console.error');});
  // Post-firstWindow observation only; early startup is covered by durable ledger equality.
  // Never read or export authorization headers or credentials.
  await app.evaluate(()=>{globalThis.__readbackNetwork=[];const originalFetch=globalThis.fetch;globalThis.fetch=async function(input){const url=typeof input==='string'?input:input?.url||String(input);if(/^https?:/.test(url)){globalThis.__readbackNetwork.push({kind:'blocked-http'});throw Error('Completed readback forbids network');}return originalFetch.apply(this,arguments);};});
  await page.route('**/*',async route=>{if(/^https?:/.test(route.request().url())){report.networkAttempts.push({kind:'blocked-renderer-http'});await route.abort();}else await route.continue();});
  report.runtime=await assertIsolatedPiMain(app,main,profile);
  await page.getByTestId('xiaozhi-pi-workspace').waitFor({state:'visible',timeout:60000});
  assert.equal(path.resolve(await page.evaluate(()=>window.omniEdu.getDataRoot())),data);
  await page.evaluate(installChatPublicProbe);
  const nav=page.locator('[data-testid="edu-navigation"]:visible');
  if(await nav.getAttribute('data-collapsed')==='true')await nav.getByTestId('workbench-sidebar-toggle').click();
  await nav.getByTestId(`workbench-session-${run.sessionId}`).filter({visible:true}).first().click();
  const turn=page.locator(`.office-turn[data-turn-id="${run.runId}"]:visible`),trigger=turn.getByTestId('agent-trace-toggle');
  await trigger.waitFor({timeout:30000});await settle();
  const baseline=await publicState();assert.equal(baseline.running,false);assert.equal(baseline.turn.status,'completed');
  assert.deepEqual(baseline.turn.answer,expected.answer);assert.deepEqual(baseline.turn.presentation,run.presentation);
  report.readback={bodySha256:sha256(JSON.stringify(baseline.turn.answer)),presentation:baseline.turn.presentation,sourceSequence:baseline.sequence,turnCount:baseline.turnCount};
  const timeText=await trigger.getByTestId('model-thinking-duration').innerText();report.readback.timeText=timeText;
  check('Exact completed run/body/time restored; no original streaming proof replayed');
  for(const [width,height]of [[1366,768],[1920,1080]])for(const expanded of [false,true]){
    const window=await app.browserWindow(page);try{await window.evaluate((w,size)=>w.setContentSize(...size),[width,height]);}finally{await window.dispose();}
    await page.waitForFunction(size=>innerWidth===size[0]&&innerHeight===size[1],[width,height]);
    if(await trigger.getAttribute('aria-expanded')!==String(expanded)){await trigger.focus();await trigger.press('Enter');}
    await settle();assert.equal(await trigger.getAttribute('aria-expanded'),String(expanded));
    const tools=expanded?await turn.getByTestId('office-tool-step').all():[];
    if(expanded)assert.equal(tools.length,expected.tools.length,'Every original tool must be inspected');
    for(const row of tools){
      const button=row.locator('button[data-testid="agent-tool-trigger"]');
      if(await button.getAttribute('aria-expanded')!=='true')await button.click();
      const text=await row.getByTestId('office-tool-evidence').innerText();assert(text.trim());
      assert(!/实际用时|本次排队|本次执行|执行用时|调用用时|\b\d+(?:\.\d+)?\s*ms\b/.test(text));
      assert(!/实际用时|本次排队|本次执行|执行用时|调用用时/.test(await row.innerText()));
      assert.equal(await row.locator('[data-testid="pi-tool-timing"],.office-step-duration').count(),0);
      await button.click();
    }
    await settle();
    // Set the viewport FIRST; then anchor the actual trigger, overriding bottom autoscroll.
    // The official conversation cancels sticky-follow on a real upward wheel.
    const conversation=page.getByTestId('office-conversation');
    const scrollBox=await conversation.boundingBox();assert(scrollBox);
    await page.mouse.move(scrollBox.x+scrollBox.width/2,scrollBox.y+scrollBox.height/2);
    await page.mouse.wheel(0,-100000);
    await page.waitForFunction(()=>document.querySelector('[data-testid="office-conversation"]').scrollTop<=1);
    await trigger.evaluate(node=>node.scrollIntoView({block:'start',behavior:'instant'}));
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
    const body=turn.getByTestId('agent-reply-body').first();
    const firstBody=body.locator('p,h1,h2,h3,li').first();
    assert(await firstBody.count(),'Actual first answer element is required');
    const bounds=await page.evaluate(({runId})=>{const root=document.querySelector(`.office-turn[data-turn-id="${runId}"]`);const rect=node=>{const r=node.getBoundingClientRect();return{x:r.x,y:r.y,width:r.width,height:r.height,right:r.right,bottom:r.bottom};};return{trigger:rect(root.querySelector('[data-testid="agent-trace-toggle"]')),firstBody:rect(root.querySelector('[data-testid="agent-reply-body"] p,[data-testid="agent-reply-body"] h1,[data-testid="agent-reply-body"] h2,[data-testid="agent-reply-body"] h3,[data-testid="agent-reply-body"] li'))};},{runId:run.runId});
    report.lastBounds={width,height,expanded,bounds};
    for(const [name,r]of Object.entries(bounds))assert(r.width>0&&r.height>0&&r.x>=0&&r.right<=width+1&&r.y>=0&&r.y<height&&r.bottom<=height+1,`${name} must be visible with the process header: ${JSON.stringify(r)}`);
    assert.equal(await trigger.getByTestId('model-thinking-duration').innerText(),timeText);
    assert.deepEqual(await publicState(),baseline);
    assert.equal(await page.getByTestId('office-conversation').locator('details,summary').count(),0);
    assert.equal(await page.locator('[data-testid="agent-raw-reasoning"],[data-testid="model-reasoning"]').count(),0);
    const file=`completed-${expanded?'open':'collapsed'}-${width}.png`;await page.screenshot({path:path.join(output,file)});
    report.screens.push({file,width,height,expanded,bounds,timeText,toolsInspected:tools.length,anchor:'real upward wheel cancels sticky-follow; process trigger at start; first answer element verified after viewport resize'});
    check(`${width}: completed ${expanded?'open':'collapsed'} header and first body visible; same body/time/run`);
  }
  await new Promise(resolve=>setTimeout(resolve,500));
  report.events=await page.evaluate(()=>window.__uiChatEvents||[]);
  assert(!report.events.some(e=>['assistant_start','model_request','tool_start'].includes(e.kind)),'No model/tool replay');
  report.networkAttempts.push(...await app.evaluate(()=>globalThis.__readbackNetwork));assert.deepEqual(report.networkAttempts,[]);
  assert.deepEqual(await publicState(),baseline);assert.deepEqual(ledger(),before);assert.equal(sha256(fs.readFileSync(nativeFile)),nativeHash);
  assert.deepEqual(report.errors,[]);check('Zero new runs/model requests/events, unchanged native history/receipt rows, clean console');
  report.success=true;
}catch(error){report.failure=String(error.message).slice(0,1200);process.exitCode=1;if(page)await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{
  if(app){try{await app.close();}catch{report.success=false;process.exitCode=1;}}
  report.buildAfter=fingerprint(buildRoot).sha256;report.sourceFixtureAfter=fingerprint(original).sha256;report.after=ledger();
  report.nativeHistoryAfter=sha256(fs.readFileSync(nativeFile));
  if(JSON.stringify(report.after)!==JSON.stringify(before)||report.nativeHistoryAfter!==nativeHash){report.success=false;report.failure='History or receipt rows changed during shutdown';process.exitCode=1;}
  if(report.buildAfter!==build.sha256||report.sourceFixtureAfter!==sourceFingerprint.sha256){report.success=false;report.failure='Build or original fixture changed';process.exitCode=1;}
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,output,checks:report.checks.length,failure:report.failure}));
}
