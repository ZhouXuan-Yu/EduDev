/** One real formal Pi turn, controlled provider transport, native DevTools CSSOM.
 * No paid model or fabricated production event. The original tool runs normally.
 */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {createDevtoolsCascadeCollector} from './acceptance/ui-final-devtools-cascade.mjs';
import {observesState,inspectCssomElement} from './acceptance/ui-final-cssom.mjs';
import {installStreamingCssProvider,readStreamingCssProvider} from './acceptance/streaming-css-provider.mjs';

const desktop=fileURLToPath(new URL('..',import.meta.url)),args=process.argv.slice(2);
assert.equal(args.length,2);assert(args.includes('--run-ui'));const pin=args.find(a=>a.startsWith('--pins='));assert(pin);
const owned=fs.realpathSync(path.join(desktop,'test-results'));
function own(file){const real=fs.realpathSync(path.resolve(desktop,file)),rel=path.relative(owned,real);assert(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel));return real;}
const pinsFile=own(pin.slice(7)),pins=JSON.parse(fs.readFileSync(pinsFile)),build=own(pins.buildRoot),main=path.join(build,'main/index.js');
const source=()=>fingerprint(path.join(desktop,'src')).sha256;
const verify=()=>{assert.equal(source(),pins.source);assert.equal(fingerprint(build).sha256,pins.build);};verify();
const output=fs.mkdtempSync(path.join(owned,'ui-final-streaming-cascade-')),data=path.join(output,'data'),profile=path.join(output,'profile');
const report={success:false,output,pins,checks:[],samples:[],errors:[],launches:0,budget:{totalMs:180000,tasks:1,controlledProviderRequests:2,externalRequests:0,paidModels:0},
  scope:'Formal main/preload/renderer/Pi/SQLite and one genuine read-only attachment tool; controlled two-response provider, not natural model quality.',
  seams:['A synthetic provider key exists in this owned process only. Electron net.fetch returns owned SSE and never forwards.',
    'One response remains open for native CSS capture, bounded to 120 seconds; no replacement runtime events or injected styles/pseudo states.',
    'Fresh owned data/profile only. No source grants, model configuration writes, approval, file output, teacher or student records.']};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const check=name=>{report.checks.push({name,pass:true});save();};let app,page,collector,hardTimer,child,sessionId;
const started=Date.now(),deadline=started+180000,delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,label,max=15000){const end=Math.min(deadline-12000,Date.now()+max);while(Date.now()<end){if(await fn())return;await delay(60);}throw Error('CSS_TIMEOUT_'+label);}
function kill(){if(child&&child.exitCode===null&&child.signalCode===null){assert(child.pid>0&&child.pid!==process.pid);spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true}).unref();}}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
const unique=async locator=>{await locator.waitFor();assert.equal(await locator.count(),1);return locator;};
async function size(width){await app.evaluate(({BrowserWindow},width)=>{
  const rows=BrowserWindow.getAllWindows().filter(w=>!w.webContents.getURL().startsWith('devtools:'));if(rows.length!==1)throw Error('CSS_ONE_PRODUCT_WINDOW');rows[0].setContentSize(width,768);
},width);await until(()=>page.evaluate(w=>innerWidth===w&&innerHeight===768,width),'VIEWPORT');}
async function sample(locator,name,state,width){
  await unique(locator);await locator.scrollIntoViewIfNeeded();await page.mouse.move(5,5);
  await page.getByTestId('office-prompt-input').focus();
  if(state==='hover'||state==='pressed')await locator.hover();
  if(state==='focus'){await locator.focus();await page.keyboard.press('Tab');await page.keyboard.press('Shift+Tab');}
  if(state==='pressed')await page.mouse.down();
  try{
    const transitions=[],settleEnd=Date.now()+3500;
    while(true){const v=await locator.evaluate(inspectCssomElement);if(!v.animations.length)break;
      if(transitions.length<4)transitions.push(v.animations);if(Date.now()>=settleEnd)break;
      await page.evaluate(()=>new Promise(r=>requestAnimationFrame(r)));}
    await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
    const value=await collector.capture(locator,state);assert(observesState(state,value.before.state)&&observesState(state,value.after.state));
    const unresolved=Object.values(value.properties).filter(p=>p.status==='unresolved');assert.equal(unresolved.length,0,'Native cascade must resolve, never guess');
    const id=name+'-'+width+'-'+state,raw=id+'.json',screenshot=id+'.png';fs.writeFileSync(path.join(output,raw),JSON.stringify(value.raw,null,2));
    await page.screenshot({path:path.join(output,screenshot)});
    report.samples.push({id,component:name,state,width,transitions,before:value.before,after:value.after,hazards:value.hazards,properties:value.properties,
      raw,screenshot,rawSha256:sha256(fs.readFileSync(path.join(output,raw))),screenshotSha256:sha256(fs.readFileSync(path.join(output,screenshot)))});save();
  }finally{await page.mouse.move(5,5);await page.mouse.up();}
}
try{
  save();const bootstrap=path.join(output,'bootstrap.cjs');
  fs.writeFileSync(bootstrap,`const e=require('electron'),fs=require('node:fs'),crypto=require('node:crypto');
e.app.setPath('userData',${JSON.stringify(profile)});e.app.setPath('sessionData',${JSON.stringify(profile)});
globalThis.__cssBrowserAttempts=0;e.app.whenReady().then(async()=>{
e.session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>{globalThis.__cssBrowserAttempts++;cb({cancel:true});});
(${installStreamingCssProvider.toString()})(e);
await import(require('node:url').pathToFileURL(${JSON.stringify(main)}).href);
}).catch(error=>{fs.writeFileSync(${JSON.stringify(path.join(output,'bootstrap-error.json'))},JSON.stringify({code:error.code,hash:crypto.createHash('sha256').update(String(error.stack)).digest('hex')}));e.app.exit(1);});`);
  const env={...process.env};for(const k of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(k)||k.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(k))delete env[k];
  Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',DEEPSEEK_API_KEY:'synthetic-cssom-owned-only',DEEPSEEK_MODEL:'deepseek-flash'});
  app=await electron.launch({args:[bootstrap,'--force-device-scale-factor=1'],cwd:output,env,timeout:30000});child=app.process();report.launches++;
  hardTimer=setTimeout(()=>{report.timeout=true;save();kill();},Math.max(1,deadline-Date.now()));
  page=await app.firstWindow({timeout:25000});page.setDefaultTimeout(12000);
  page.on('pageerror',e=>report.errors.push({kind:'pageerror',hash:sha256(String(e))}));page.on('console',m=>{if(m.type()==='error')report.errors.push({kind:'console',hash:sha256(m.text())});});
  await page.getByTestId('xiaozhi-pi-workspace').waitFor();report.main=await assertIsolatedPiMain(app,main,profile);await page.emulateMedia({colorScheme:'light'});await size(1366);
  const input=await unique(page.getByTestId('office-prompt-input'));await until(async()=>!await input.isDisabled(),'INPUT_READY');
  sessionId=await page.locator('.office-composer-container:visible').getAttribute('data-session-id');report.sessionId=sessionId;
  const chat=page.locator('.edu-chat:visible'),beforeWidth=(await page.locator('.edu-chat-main:visible').boundingBox()).width;
  assert.equal(await chat.getAttribute('data-context-open'),'false');
  const attachment=path.join(output,'CSSOM-public-fixture.txt');fs.writeFileSync(attachment,'公开合成验收资料：本文件用于核对本轮附件范围，不含学生或教师个人信息。\n');
  const attach=page.locator('.office-composer-container:visible').locator('button[aria-label="添加本地附件"]');assert.equal(await attach.count(),1);
  const [chooser]=await Promise.all([page.waitForEvent('filechooser',{timeout:15000}),attach.click()]);await chooser.setFiles(attachment);
  const preview=page.locator('.office-composer-container:visible').locator('button[aria-label="预览附件 CSSOM-public-fixture.txt"]');await preview.waitFor();assert.equal(await preview.count(),1);
  await until(async()=>!await attach.isDisabled(),'ACTUAL_ATTACHMENT_IMPORTED');report.attachmentSha256=sha256(fs.readFileSync(attachment));
  await input.fill('本地受控CSS验收：检查本轮附件列表，再说明目前能否基于附件继续。');await input.press('Enter');
  await until(()=>app.evaluate(readStreamingCssProvider).then(s=>s.requests.length===2&&s.holding),'ACTUAL_TOOL_AND_SECOND_RESPONSE',25000);
  const held=await snapshot(),turn=held.projection.turns.at(-1);report.runId=turn.id;
  assert.equal(held.running,true);assert.equal(turn.status,'running');const tools=turn.items.filter(i=>i.kind==='tool');
  assert.equal(tools.length,1);assert.equal(tools[0].toolName,'office_list_attachments');assert.equal(tools[0].status,'completed');
  report.publicTools=tools.map(t=>({id:t.id,name:t.toolName,status:t.status}));
  const trace=page.getByTestId('agent-trace');assert.equal(await trace.getAttribute('data-mode'),'live-prose');assert.equal(await trace.getAttribute('data-thinking'),'processing');
  assert.equal(await trace.getAttribute('data-run-id'),turn.id);assert.equal(await chat.getAttribute('data-context-open'),'false');assert.equal(await page.getByTestId('workspace-files-available').count(),0);
  assert.equal((await page.locator('.edu-chat-main:visible').boundingBox()).width,beforeWidth);check('Actual Pi tool event leaves the on-demand panel closed and conversation width unchanged');
  await input.focus();await snapshot();assert.equal(await input.evaluate(el=>document.activeElement===el),true);check('Read-only runtime refresh preserves the active composer focus');
  collector=await createDevtoolsCascadeCollector(app,page,{buildRoot:build,sourceRoot:path.join(desktop,'src/renderer')});
  for(const width of [1366,1920]){await size(width);const step=page.locator('[data-testid="office-tool-step"][data-tool-name="office_list_attachments"]');assert.equal(await step.getByTestId('agent-tool-glyph').getAttribute('data-tool-kind'),'directory');const trigger=step.getByTestId('agent-tool-trigger');
    for(const state of ['normal','hover','focus','pressed'])await sample(trigger,'HeroUI-ChatTool-live-Pi',state,width);
    const current=await snapshot();assert.equal(current.running,true);assert.equal(current.projection.turns.at(-1).id,turn.id);assert.equal(await trace.getAttribute('data-thinking'),'processing');}
  report.providerHeld=await app.evaluate(readStreamingCssProvider);check('Native SDK winners and token sources captured during actual running Pi in both viewports');
  await app.evaluate(()=>globalThis.__streamingCssProvider.release());await until(()=>snapshot().then(s=>!s.running&&s.projection.turns.at(-1)?.status==='completed'),'COMPLETED');
  const end=await snapshot();report.presentation=end.projection.turns.at(-1).presentation;
  const toggle=await unique(page.getByTestId('agent-trace-toggle'));assert.equal(await toggle.getAttribute('aria-expanded'),'false');
  for(const width of [1366,1920]){await size(width);for(const state of ['normal','hover','focus'])await sample(toggle,'HeroUI-ChainOfThought-completed',state,width);}
  check('Completion shows the original collapsed ChainOfThought with native cascade provenance');
  report.provider=await app.evaluate(readStreamingCssProvider);assert.equal(report.provider.requests.length,2);assert.equal(report.provider.externalAttempts,0);assert.deepEqual(report.provider.errors,[]);
  assert.equal(await app.evaluate(()=>globalThis.__cssBrowserAttempts),0);assert.deepEqual(report.errors,[]);
  report.devtoolsConsole=await collector.diagnostics();const known=new Set([`Request Autofill.enable failed. {"code":-32601,"message":"'Autofill.enable' wasn't found"}`,`Request Autofill.setAddresses failed. {"code":-32601,"message":"'Autofill.setAddresses' wasn't found"}`]);
  assert(report.devtoolsConsole.every(v=>v.scope==='devtools'&&v.source==='devtools://devtools/bundled/core/protocol_client/protocol_client.js'&&known.has(v.message)),'No unknown DevTools or product error');
  check('One accepted task and exactly two controlled responses; zero external or paid requests');report.success=true;
}catch(error){report.failure={message:String(error.message).slice(0,1000),hash:sha256(String(error.stack))};if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{
  clearTimeout(hardTimer);try{if(app)report.providerFinal=await app.evaluate(readStreamingCssProvider);}catch{}
  try{await collector?.close();await app?.close();}catch(error){report.success=false;report.errors.push({kind:'close',hash:sha256(String(error))});kill();}
  try{verify();const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{
    report.persistedRuns=db.prepare('SELECT id,status FROM ai_agent_runs ORDER BY rowid').all();assert(report.persistedRuns.length<=1);
    if(report.success){assert.equal(report.persistedRuns.length,1);assert.equal(report.persistedRuns[0].status,'succeeded');}
    report.persistedToolReceipts=db.prepare('SELECT count(*) AS count FROM xiaozhi_tool_receipts').get().count;
  }finally{db.close();}report.integrityVerified=true;}catch(error){report.success=false;report.integrityVerified=false;report.integrityError=sha256(String(error.stack));}
  report.elapsedMs=Date.now()-started;save();console.log(JSON.stringify({output,success:report.success,checks:report.checks.length,samples:report.samples.length,failure:report.failure}));
}
if(!report.success)process.exitCode=1;
