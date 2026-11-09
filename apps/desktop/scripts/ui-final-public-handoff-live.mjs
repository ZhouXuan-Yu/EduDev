/** Formal Pi explicit text protocol. Controlled transport, actual tool/events/storage. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {installStreamingCssProvider,readStreamingCssProvider} from './acceptance/streaming-css-provider.mjs';

const desktop=fileURLToPath(new URL('..',import.meta.url)),args=process.argv.slice(2);
assert.equal(args.length,2);assert(args.includes('--run-ui'));const pin=args.find(a=>a.startsWith('--pins='));assert(pin);
const owned=fs.realpathSync(path.join(desktop,'test-results'));
function own(value){const file=fs.realpathSync(path.resolve(desktop,value)),rel=path.relative(owned,file);assert(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel));return file;}
const pins=JSON.parse(fs.readFileSync(own(pin.slice(7)))),build=own(pins.buildRoot),main=path.join(build,'main/index.js');
const verify=()=>{assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);assert.equal(fingerprint(build).sha256,pins.build);};verify();
const output=fs.mkdtempSync(path.join(owned,'ui-final-public-handoff-')),data=path.join(output,'data'),profile=path.join(output,'profile');
const report={success:false,output,pins,checks:[],screens:[],errors:[],launches:0,scope:'Formal Pi and one actual attachment-list tool with controlled two-response SSE; not natural model adherence/quality.',
  boundaries:['Fresh owned synthetic attachment/data/profile only; no daily teacher data.','No injected production events, styles, clock or pseudo state. Mouse/keyboard selection and native UI.','180 seconds, at most two launches, one submitted task, two controlled responses; zero retries/external/paid requests.']};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const check=name=>{report.checks.push({name,pass:true});save();console.log('PASS '+name);};
const deadline=Date.now()+180000,delay=ms=>new Promise(r=>setTimeout(r,ms));let app,page,child,sessionId,phase='bootstrap';
function kill(){if(child&&child.exitCode===null&&child.signalCode===null)spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true}).unref();}
const hardTimer=setTimeout(()=>{report.timeout=true;save();kill();},Math.max(1,deadline-Date.now()));
async function until(fn,label,max=15000){const end=Math.min(deadline-10000,Date.now()+max);while(Date.now()<end){if(await fn())return;await delay(60);}throw Error('HANDOFF_TIMEOUT_'+label);}
const snapshot=()=>page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessionId);
async function unique(locator){await locator.waitFor();assert.equal(await locator.count(),1);return locator;}
async function capture(name){await page.mouse.move(5,5);const file=name+'.png';await page.screenshot({path:path.join(output,file)});report.screens.push({file,sha256:sha256(fs.readFileSync(path.join(output,file)))});save();}
const bootstrap=path.join(output,'bootstrap.cjs');
fs.writeFileSync(bootstrap,`const e=require('electron');e.app.setPath('userData',${JSON.stringify(profile)});e.app.setPath('sessionData',${JSON.stringify(profile)});
globalThis.__handoffBrowserAttempts=0;e.app.whenReady().then(async()=>{
e.session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_d,cb)=>{globalThis.__handoffBrowserAttempts++;cb({cancel:true});});
(${installStreamingCssProvider.toString()})(e,{presentation:'explicit'});
await import(require('node:url').pathToFileURL(${JSON.stringify(main)}).href);
}).catch(error=>{require('node:fs').writeFileSync(${JSON.stringify(path.join(output,'bootstrap-error.json'))},JSON.stringify({code:error.code,hash:require('node:crypto').createHash('sha256').update(String(error.stack)).digest('hex')}));e.app.exit(1);});`);
const env={...process.env};for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'1',DEEPSEEK_API_KEY:'synthetic-handoff-owned-only',DEEPSEEK_MODEL:'deepseek-flash'});
async function launch(){verify();app=await electron.launch({args:[bootstrap,'--force-device-scale-factor=1'],cwd:output,env,timeout:30000});child=app.process();report.launches++;
 page=await app.firstWindow({timeout:25000});page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push({kind:'page',hash:sha256(String(e))}));page.on('console',m=>{if(m.type()==='error')report.errors.push({kind:'console',hash:sha256(m.text())});});
 await page.getByTestId('xiaozhi-pi-workspace').waitFor();await assertIsolatedPiMain(app,main,profile);await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows();if(w.length!==1)throw Error('ONE_WINDOW_REQUIRED');w[0].setContentSize(1366,768);});await until(()=>page.evaluate(()=>innerWidth===1366&&innerHeight===768),'VIEWPORT');
}
function ledger(){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return Object.fromEntries(['ai_agent_runs','ai_agent_run_requests','xiaozhi_pi_commands','xiaozhi_pi_usage','xiaozhi_tool_receipts'].map(table=>[table,sha256(JSON.stringify(db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()))]));}finally{db.close();}}
try{
 save();await launch();const input=await unique(page.getByTestId('office-prompt-input'));await until(async()=>!await input.isDisabled(),'READY');
 sessionId=await page.locator('.office-composer-container:visible').getAttribute('data-session-id');report.sessionId=sessionId;
 const attachment=path.join(output,'公开交接核验.txt');fs.writeFileSync(attachment,'公开合成教学资料，仅供附件列表核验，不含任何个人资料。');report.attachmentSha256=sha256(fs.readFileSync(attachment));
 const attach=await unique(page.locator('.office-composer-container:visible button[aria-label="添加本地附件"]'));
 const [chooser]=await Promise.all([page.waitForEvent('filechooser',{timeout:15000}),attach.click()]);await chooser.setFiles(attachment);
 await unique(page.locator('.office-composer-container:visible button[aria-label="预览附件 公开交接核验.txt"]'));await until(async()=>!await attach.isDisabled(),'ATTACHMENT');
 phase='public-process';await input.fill('本地公开交接验收：先说明范围，核对本轮附件清单，再给出有明确限制的正文。');await input.press('Enter');
 await until(()=>app.evaluate(readStreamingCssProvider).then(s=>s.requests.length===2&&s.holding),'TOOL_RECEIPT',25000);
 const before=await snapshot(),turn=before.projection.turns.at(-1);report.runId=turn.id;assert.equal(before.running,true);
 const tools=turn.items.filter(i=>i.kind==='tool');assert.equal(tools.length,1);assert.equal(tools[0].toolName,'office_list_attachments');assert.equal(tools[0].status,'completed');
 const trace=await unique(page.getByTestId('agent-trace'));assert.equal(await trace.getAttribute('data-mode'),'live-prose');assert.equal(await trace.getAttribute('data-run-id'),turn.id);
 const step=await unique(trace.getByTestId('office-tool-step'));assert.equal(await step.getByTestId('agent-tool-glyph').getAttribute('data-tool-kind'),'directory');
 await step.getByTestId('agent-tool-trigger').click();const publicDetails=await trace.innerText();assert(publicDetails.includes('先检查本轮附件范围'));assert(!publicDetails.includes('<xiaozhi_'));await capture('running');
 check('Actual public commentary and native completed tool appear before a final boundary');
 phase='partial-prefix';await app.evaluate(()=>globalThis.__streamingCssProvider.beginPrefix());
 await page.evaluate(()=>new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r))));
 const partial=await snapshot();assert.equal(partial.running,true);assert.equal(partial.projection.turns.at(-1).presentation.phase,'process');assert.equal(await page.getByTestId('agent-reply-body').count(),0);assert(!(await trace.innerText()).includes('<xiaozhi_'));
 check('Incomplete native text prefix stays buffered without a false handoff or visible control text');
 phase='explicit-handoff';await step.getByTestId('agent-tool-trigger').focus();await app.evaluate(()=>globalThis.__streamingCssProvider.beginAnswer());
 const toggle=await unique(page.getByTestId('agent-trace-toggle'));await until(()=>toggle.getAttribute('aria-expanded').then(v=>v==='false'),'COLLAPSE');
 const body=await unique(page.getByTestId('agent-reply-body'));await until(()=>body.innerText().then(t=>t.includes('附件清单已经核对')),'FIRST_BODY');
 const handoff=await snapshot(),presentation=handoff.projection.turns.at(-1).presentation;report.handoff=presentation;
 assert.equal(handoff.running,true);assert.equal(presentation.handoff,'explicit');assert.equal(presentation.phase,'answer');assert(presentation.processElapsedMs>=0);assert.equal(presentation.processEndedAt-presentation.processStartedAt,presentation.processElapsedMs);
 const expectedClock=Math.floor(presentation.processElapsedMs/1000)+' 秒';assert.equal(await toggle.getByTestId('model-thinking-duration').textContent(),expectedClock);
 assert.equal(await page.getByTestId('office-turn-duration').count(),0);await until(()=>toggle.evaluate(el=>document.activeElement===el),'TOOL_FOCUS_RETURN');await capture('first-body-still-streaming');
 check('Explicit first body arrives while Pi is running; process collapses and exact top clock freezes');
 phase='manual-reopen';await toggle.press('Enter');assert.equal(await toggle.getAttribute('aria-expanded'),'true');await capture('manual-reopen');
 phase='mouse-selection';const paragraph=await unique(body.locator('p'));await paragraph.scrollIntoViewIfNeeded();const box=await paragraph.boundingBox();assert(box&&box.width>180);
 await page.mouse.move(box.x+3,box.y+10);await page.mouse.down();await page.mouse.move(box.x+150,box.y+10,{steps:12});await page.mouse.up();
 const selection=await page.evaluate(()=>getSelection()?.toString());assert(selection&&selection.length>=3,'Actual mouse selection must exist');
 const scroller=await unique(page.getByTestId('office-conversation')),scrollTop=await scroller.evaluate(el=>el.scrollTop);
 await app.evaluate(()=>globalThis.__streamingCssProvider.release());await until(()=>snapshot().then(s=>!s.running&&s.projection.turns.at(-1)?.status==='completed'),'TERMINAL',25000);
 assert.equal(await page.evaluate(()=>getSelection()?.toString()),selection,'Final append/completion preserves active text selection');
 assert.equal(await scroller.evaluate(el=>el.scrollTop),scrollTop,'No forced follow while selecting');
 assert.equal(await toggle.getAttribute('aria-expanded'),'true');assert.equal(await toggle.getByTestId('model-thinking-duration').textContent(),expectedClock);
 check('Keyboard reopen survives completion; real mouse selection and frozen process clock remain');
 await input.click();await until(()=>body.innerText().then(t=>t.includes('后续需要读取正文')),'BUFFER_FLUSH');assert(!(await body.innerText()).includes('<xiaozhi_'));assert.equal(await trace.locator('details,summary').count(),0);
 const completed=await snapshot();assert.deepEqual(completed.projection.turns.at(-1).presentation,presentation);report.provider=await app.evaluate(readStreamingCssProvider);assert.equal(report.provider.requests.length,2);assert.equal(report.provider.externalAttempts,0);assert.deepEqual(report.provider.errors,[]);assert.equal(await app.evaluate(()=>globalThis.__handoffBrowserAttempts),0);
 await capture('completed-manually-open');check('Selected-text buffer releases original complete answer without marker leakage or extra requests');
 phase='cold-recovery';await app.close();app=undefined;const beforeCold=ledger();await launch();
 await until(()=>snapshot().then(s=>s.projection.turns.some(t=>t.id===turn.id)),'COLD_RUN');const cold=await snapshot();assert.equal(cold.running,false);const recovered=cold.projection.turns.filter(t=>t.id===turn.id);assert.equal(recovered.length,1);assert.deepEqual(recovered[0].presentation,presentation);
 const restored=await unique(page.getByTestId('agent-trace-toggle'));assert.equal(await restored.getAttribute('aria-expanded'),'false');assert.equal(await restored.getByTestId('model-thinking-duration').textContent(),expectedClock);
 assert.equal((await app.evaluate(readStreamingCssProvider)).requests.length,0);assert.equal(await app.evaluate(()=>globalThis.__handoffBrowserAttempts),0);await capture('cold-restored');
 await app.close();app=undefined;assert.deepEqual(ledger(),beforeCold);assert.deepEqual(report.errors,[]);check('Cold formal launch restores exact run and clock with unchanged ledgers and zero model replay');
 report.success=true;
}catch(error){report.failure={phase,message:String(error.message).slice(0,1500),stackHash:sha256(String(error.stack))};if(page&&!page.isClosed())await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});process.exitCode=1;}
finally{clearTimeout(hardTimer);try{await app?.close();}catch{kill();report.success=false;process.exitCode=1;}try{verify();report.integrityVerified=true;}catch{report.integrityVerified=false;report.success=false;process.exitCode=1;}save();console.log(JSON.stringify({output,success:report.success,checks:report.checks.length,failure:report.failure}));}
