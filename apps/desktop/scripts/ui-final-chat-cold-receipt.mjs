/** Current-build readback of an existing successful natural Pi run. Zero HTTP. */
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {fileURLToPath} from 'node:url';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint, sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {continuationBootstrap, continuationGuardRead} from './acceptance/paper-adaptation-continuation.mjs';

const desktop=fileURLToPath(new URL('../',import.meta.url));
const get=name=>{const values=process.argv.filter(v=>v.startsWith('--'+name+'='));assert.equal(values.length,1);return values[0].slice(name.length+3);};
const owned=fs.realpathSync(path.join(desktop,'test-results'));
function own(value){const file=fs.realpathSync(path.resolve(desktop,value)),relative=path.relative(owned,file);assert(relative&&!path.isAbsolute(relative)&&relative!=='..'&&!relative.startsWith('..'+path.sep));return file;}
const original=own(get('from')),pinsFile=own(get('pins'));
const pins=JSON.parse(fs.readFileSync(pinsFile)),build=own(pins.buildRoot);
const old=JSON.parse(fs.readFileSync(path.join(original,'report.json')));
assert.equal(old.success,true);
const runs=old.runs.filter(r=>r.name==='attachment');assert.equal(runs.length,1);
const run=runs[0],answer=JSON.parse(fs.readFileSync(path.join(original,'attachment-answer.json')));
assert.equal(run.runId,answer.runId);assert.equal(run.sessionId,answer.sessionId);
assert.equal(run.presentation.handoff,'explicit');assert.equal(run.manualReopen.status,'passed');
const sourceBefore=fingerprint(original).sha256;
const output=fs.mkdtempSync(path.join(owned,'ui-final-chat-cold-receipt-'));
for(const name of ['data','profile'])fs.cpSync(path.join(original,name),path.join(output,name),{recursive:true,errorOnExist:true,force:false});
const data=path.join(output,'data'),profile=path.join(output,'profile');
const report={success:false,output,pins,original,originalSha256:sourceBefore,checks:[],screens:[],errors:[],modelCalls:0,
  scope:'Existing natural Pi run on current formal build; cold identity, clock, glyphs and public details. Streaming proof remains the original live report.'};
const flush=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const check=name=>{report.checks.push({name,pass:true});flush();};
function verify(){assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);assert.equal(fingerprint(build).sha256,pins.build);assert.equal(fingerprint(original).sha256,sourceBefore);}
function ledger(){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{
  return Object.fromEntries(['ai_agent_runs','ai_agent_run_requests','ai_agent_events','xiaozhi_event_journal','xiaozhi_pi_usage','xiaozhi_pi_commands','xiaozhi_tool_receipts','ai_confirmation_items'].map(table=>{
    const query=db.prepare('SELECT * FROM '+table+' ORDER BY rowid');query.setReadBigInts(true);
    return [table,sha256(JSON.stringify(query.all(),(_k,v)=>typeof v==='bigint'?{integer:String(v)}:v))];
  }));
}finally{db.close();}}
let app,page,baseline,nativeBefore;
try{
  verify();baseline=ledger();nativeBefore=fingerprint(path.join(data,'xiaozhi-pi')).sha256;
  const main=path.join(build,'main/index.js'),boot=path.join(output,'bootstrap.cjs');
  fs.writeFileSync(boot,continuationBootstrap({main,profile}));
  const env={...process.env};for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
  Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1'});
  app=await electron.launch({args:[boot,'--force-device-scale-factor=1'],cwd:output,env,timeout:30000});
  page=await app.firstWindow();page.setDefaultTimeout(12000);
  page.on('pageerror',e=>report.errors.push({kind:'pageerror',hash:sha256(String(e))}));
  page.on('console',m=>{if(m.type()==='error')report.errors.push({kind:'console',hash:sha256(m.text())});});
  await page.getByTestId('office-prompt-input').waitFor({timeout:30000});
  report.main=await assertIsolatedPiMain(app,main,profile);
  const composer=page.locator('.office-composer-container:visible');
  if(await composer.getAttribute('data-session-id')!==run.sessionId){
    const target=page.locator('[data-testid="edu-navigation"] .wb-conversations').getByTestId('workbench-session-'+run.sessionId);
    assert.equal(await target.count(),1);await target.click();
    await page.waitForFunction(id=>document.querySelector('.office-composer-container')?.getAttribute('data-session-id')===id,run.sessionId);
  }
  const dto=await page.evaluate(async({sessionId,runId})=>{
    const s=await window.omniEdu.getXiaozhiSnapshot(sessionId),t=s.projection.turns.find(t=>t.id===runId);
    return {running:s.running,sequence:s.projection.sourceSequence,status:t.status,presentation:t.presentation,
      tools:t.items.filter(i=>i.kind==='tool').map(i=>({id:i.id,name:i.toolName,status:i.status})),
      answer:t.items.filter(i=>i.role==='assistant'&&['final_answer','partial_answer'].includes(i.phase)).map(i=>({id:i.id,phase:i.phase,text:i.text||''}))};
  },{sessionId:run.sessionId,runId:run.runId});
  assert.equal(dto.running,false);assert.equal(dto.status,'completed');assert.deepEqual(dto.presentation,run.presentation);
  assert.deepEqual(dto.answer,answer.answer);assert.deepEqual(dto.tools,run.tools.map(t=>({id:t.id,name:t.name,status:t.status})));
  report.receipt={sessionId:run.sessionId,runId:run.runId,bodySha256:sha256(JSON.stringify(dto.answer)),presentation:dto.presentation,tools:dto.tools};
  check('Exact existing run, public body, real tools and timing restored without dispatch');
  const turn=page.locator('.office-turn[data-turn-id="'+run.runId+'"]');assert.equal(await turn.count(),1);
  const toggle=turn.getByTestId('agent-trace-toggle');await toggle.waitFor();
  assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  assert.equal(await toggle.getByTestId('model-thinking-duration').count(),1);
  const clock=await toggle.getByTestId('model-thinking-duration').textContent();
  assert.equal(clock,Math.floor(run.presentation.processElapsedMs/1000)+' 秒');
  assert.equal(await turn.getByTestId('office-turn-duration').count(),0);
  assert.equal(await turn.locator('details,summary,[data-testid="model-reasoning"],[data-testid="agent-raw-reasoning"]').count(),0);
  for(const [width,height] of [[1366,768],[1920,1080]]){
    await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
    await page.waitForFunction(w=>innerWidth===w,width);
    await toggle.scrollIntoViewIfNeeded();assert(await toggle.isVisible());
    const collapsed='collapsed-'+width+'.png';await page.screenshot({path:path.join(output,collapsed)});report.screens.push(collapsed);
    await toggle.focus();await toggle.press('Enter');assert.equal(await toggle.getAttribute('aria-expanded'),'true');
    assert.equal(await turn.getByTestId('agent-tool-trigger').count(),dto.tools.length);
    for(const tool of dto.tools){
      const exact=turn.locator('[data-testid="office-tool-step"][data-item-id="'+tool.id+'"]');assert.equal(await exact.count(),1);
      const glyph=exact.getByTestId('agent-tool-glyph');assert.equal(await glyph.count(),1);
      assert.equal(await glyph.getAttribute('data-tool-kind'),/list_attachments/.test(tool.name)?'directory':'file-read');
      const trigger=exact.getByTestId('agent-tool-trigger');assert.equal(await trigger.count(),1);
      if(await trigger.getAttribute('aria-expanded')!=='true')await trigger.click();
      const evidence=exact.getByTestId('office-tool-evidence');assert((await evidence.innerText()).trim());
      assert(!/调用用时|执行用时|实际用时|\b\d+(?:\.\d+)?\s*ms\b/.test(await evidence.innerText()));
      assert.equal(await exact.locator('.office-step-duration,[data-testid="pi-tool-timing"]').count(),0);
    }
    await toggle.scrollIntoViewIfNeeded();const expanded='expanded-'+width+'.png';await page.screenshot({path:path.join(output,expanded)});report.screens.push(expanded);
    await toggle.focus();await toggle.press('Space');assert.equal(await toggle.getAttribute('aria-expanded'),'false');
    assert.equal(await toggle.getByTestId('model-thinking-duration').textContent(),clock);
    assert(await turn.getByTestId('agent-reply-body').count());
  }
  check('Top clock stays frozen, Enter and Space disclosure, per-call glyph/details, no native triangles or tool durations in both sizes');
  report.guard=await app.evaluate(continuationGuardRead,true);
  for(const name of ['networkAttempts','modelAttempts','rendererErrors'])assert.equal(report.guard[name],0);
  assert.deepEqual(report.errors,[]);assert.deepEqual(ledger(),baseline);
  assert.equal(fingerprint(path.join(data,'xiaozhi-pi')).sha256,nativeBefore);
  check('Zero HTTP/model and unchanged eight ledgers, user approvals and exact native history');
  report.success=true;
}catch(error){report.failure=String(error.stack);}
finally{
  await app?.close();
  try{verify();if(baseline)assert.deepEqual(ledger(),baseline);if(nativeBefore)assert.equal(fingerprint(path.join(data,'xiaozhi-pi')).sha256,nativeBefore);report.integrityVerified=true;}
  catch(error){report.integrityError=String(error.stack);report.success=false;}
  flush();console.log(JSON.stringify({output,success:report.success,checks:report.checks.length,failure:report.failure}));
}
if(!report.success)process.exitCode=1;
