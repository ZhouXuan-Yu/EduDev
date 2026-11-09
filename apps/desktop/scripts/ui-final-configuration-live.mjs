/** Original configuration UI and services, isolated copy of an actual finished Pi run. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint,sha256} from './acceptance/evidence.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {productEntry} from './product-navigation.mjs';
import {startMcpFixture} from './xiaozhi-agent/fixtures/mcp-server.mjs';
import {installConfigurationProvider,readConfigurationProvider} from './acceptance/configuration-provider.mjs';
import {modelConfigurationJourney} from './acceptance/configuration-model-journey.mjs';
import {skillConfigurationJourney} from './acceptance/configuration-skill-journey.mjs';
import {mcpConfigurationJourney} from './acceptance/configuration-mcp-journey.mjs';

const desktop=fileURLToPath(new URL('..',import.meta.url)),args=process.argv.slice(2);assert.equal(args.length,2);assert(args.includes('--run-ui'));const arg=args.find(a=>a.startsWith('--pins='));assert(arg);
const owned=fs.realpathSync(path.join(desktop,'test-results'));
function own(value){const real=fs.realpathSync(path.resolve(desktop,value)),rel=path.relative(owned,real);assert(rel&&!rel.startsWith('..')&&!path.isAbsolute(rel));return real;}
const pins=JSON.parse(fs.readFileSync(own(arg.slice(7)))),build=own(pins.buildRoot),main=path.join(build,'main/index.js');
const verify=()=>{assert.equal(fingerprint(path.join(desktop,'src')).sha256,pins.source);assert.equal(fingerprint(build).sha256,pins.build);};verify();
const original=own('test-results/ui-final-public-handoff-dMY7kj'),sourceHash=fingerprint(original).sha256,sourceReport=JSON.parse(fs.readFileSync(path.join(original,'report.json')));assert.equal(sourceReport.success,true);
assert(!fs.existsSync(path.join(original,'data/app.db-wal'))||fs.statSync(path.join(original,'data/app.db-wal')).size===0,'Source SQLite must be cold');
const output=fs.mkdtempSync(path.join(owned,'ui-final-configuration-')),data=path.join(output,'data'),profile=path.join(output,'profile');
for(const dir of ['data','profile'])fs.cpSync(path.join(original,dir),path.join(output,dir),{recursive:true,force:false,errorOnExist:true});
const mcp=await startMcpFixture(),modelKey='owned-config-valid-'+randomUUID(),mcpSecret='owned-mcp-'+randomUUID();mcp.state.auth=mcpSecret;
const report={success:false,output,pins,sourceFixture:original,sourceFixtureSha256:sourceHash,checks:[],screens:[],errors:[],launches:0,providers:[],
 scope:'Formal Electron/preload/services/Windows safeStorage/SQLite/skill files; controlled model catalogue and actual loopback MCP HTTP only.',
 boundaries:['No chat submission or cloud requests; source fixture and daily data remain untouched.','File-picker return only is controlled; host package checks and writes are real. No native chooser-click claim.','No MCP tools/call, managed-tool preparation/download, production API response replacement or injected events.']};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
const check=name=>{report.checks.push({name,pass:true});save();console.log('PASS '+name);};
const deadline=Date.now()+180000,delay=ms=>new Promise(r=>setTimeout(r,ms));let app,page,child,phase='bootstrap',baseline;
function kill(){if(child&&child.exitCode===null&&child.signalCode===null)spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{stdio:'ignore',windowsHide:true}).unref();}
const hardTimer=setTimeout(()=>{report.timeout=true;save();kill();},Math.max(1,deadline-Date.now()));
async function until(fn,label,max=15000){const end=Math.min(deadline-10000,Date.now()+max);while(Date.now()<end){if(await fn())return;await delay(60);}throw Error('CONFIG_TIMEOUT_'+label);}
async function shot(name){await page.mouse.move(5,5);const file=name+'.png';await page.screenshot({path:path.join(output,file)});report.screens.push({file,sha256:sha256(fs.readFileSync(path.join(output,file)))});save();}
const bootstrap=path.join(output,'bootstrap.cjs');
fs.writeFileSync(bootstrap,`const e=require('electron'),fs=require('node:fs');const startup={pid:process.pid,startedAt:Date.now(),phases:[]};const mark=name=>{startup.phases.push({name,at:Date.now()});fs.writeFileSync(${JSON.stringify(path.join(output,'startup.json'))},JSON.stringify(startup));};mark('bootstrap-start');e.app.on('browser-window-created',()=>mark('window-created'));process.on('exit',()=>mark('process-exit'));e.app.setPath('userData',${JSON.stringify(profile)});e.app.setPath('sessionData',${JSON.stringify(profile)});
globalThis.__configurationBrowserAttempts=0;e.app.whenReady().then(async()=>{
mark('app-ready');
e.session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(d,cb)=>{const ok=d.url===${JSON.stringify(mcp.url)};if(!ok)globalThis.__configurationBrowserAttempts++;cb({cancel:!ok});});
(${installConfigurationProvider.toString()})(e);
mark('before-main-import');
await import(require('node:url').pathToFileURL(${JSON.stringify(main)}).href);
mark('after-main-import');
}).catch(error=>{require('node:fs').writeFileSync(${JSON.stringify(path.join(output,'bootstrap-error.json'))},JSON.stringify({code:error.code,hash:require('node:crypto').createHash('sha256').update(String(error.stack)).digest('hex')}));e.app.exit(1);});`);
const env={...process.env};for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(key))delete env[key];
Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'1',DEEPSEEK_API_KEY:'',DEEPSEEK_MODEL:''});
async function launch(){verify();app=await electron.launch({args:[bootstrap,'--force-device-scale-factor=1'],cwd:output,env,timeout:30000});child=app.process();report.launches++;
 page=await app.firstWindow({timeout:25000});page.setDefaultTimeout(12000);page.on('pageerror',e=>report.errors.push({kind:'page',hash:sha256(String(e))}));page.on('console',m=>{if(m.type()==='error')report.errors.push({kind:'console',hash:sha256(m.text())});});
 await page.getByTestId('xiaozhi-pi-workspace').waitFor();await assertIsolatedPiMain(app,main,profile);await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows();assertWindow(w);function assertWindow(rows){if(rows.length!==1)throw Error('ONE_WINDOW_REQUIRED');}w[0].setContentSize(1366,768);});
 await until(()=>page.evaluate(()=>innerWidth===1366&&innerHeight===768),'VIEWPORT');
}
function ledger(){const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});try{return Object.fromEntries(['ai_agent_runs','ai_agent_run_requests','xiaozhi_pi_commands','xiaozhi_pi_usage','xiaozhi_tool_receipts'].map(table=>[table,sha256(JSON.stringify(db.prepare('SELECT * FROM '+table+' ORDER BY rowid').all()))]));}finally{db.close();}}
const skillRoot=path.join(output,'teacher-package');fs.mkdirSync(path.join(skillRoot,'references'),{recursive:true});
const skillDocument='---\nname: configuration-review\ndescription: 教师核对配置中的公开课程安排时使用。\n---\n# 配置复核\n请先核对公开资料范围，再整理教师可核对的教学安排。\n';
fs.writeFileSync(path.join(skillRoot,'SKILL.md'),skillDocument);fs.writeFileSync(path.join(skillRoot,'references/course.md'),'公开合成课程说明，不包含任何学生事实。');const skillHash=fingerprint(skillRoot).sha256;
const ctx={output,sessionId:sourceReport.sessionId,modelKey,mcpSecret,mcp,skillRoot,skillDocument,current:()=>({app,page}),get:()=>({page,until,check,shot})};
ctx.tab=async id=>{const tab=page.getByTestId('pi-settings-tab-'+id);if(!await tab.isVisible())await page.getByTestId('pi-settings-advanced-toggle').click();await tab.click();await until(()=>page.getByTestId('pi-settings-workspace').getAttribute('data-tab').then(v=>v===id),'TAB_'+id);};
async function open(){const entry=productEntry(page,'settings');assert.equal(await entry.count(),1);await entry.click();await page.getByTestId('pi-settings-key').waitFor();await until(async()=>!await page.getByTestId('pi-settings-key').isDisabled(),'SETTINGS_READY');}
async function providerReceipt(){const p=await app.evaluate(readConfigurationProvider);assert.equal(p.externalAttempts,0);assert.equal(p.modelAttempts,0);assert.equal(await app.evaluate(()=>globalThis.__configurationBrowserAttempts),0);report.providers.push(p);}
try{
 save();await launch();baseline=ledger();report.safeStorageAvailable=await app.evaluate(({safeStorage})=>safeStorage.isEncryptionAvailable());assert.equal(report.safeStorageAvailable,true);
 await open();phase='model';await modelConfigurationJourney(ctx);phase='skill';await skillConfigurationJourney(ctx);phase='mcp';await mcpConfigurationJourney(ctx);await providerReceipt();
 phase='new-conversation';await page.getByTestId('nav-ai').filter({visible:true}).click();await page.getByTestId('xiaozhi-pi-workspace').waitFor();const newButton=page.locator('[data-testid="edu-navigation"]:visible').getByTestId('workbench-new-session');assert.equal(await newButton.count(),1);await newButton.click();
 const modal=page.getByTestId('workbench-new-dialog');await modal.waitFor();await modal.getByRole('button',{name:'创建对话',exact:true}).click();await modal.waitFor({state:'hidden'});
 await until(()=>page.locator('.office-composer-container:visible').getAttribute('data-session-id').then(id=>id&&id!==ctx.sessionId),'NEW_CONVERSATION');const newId=await page.locator('.office-composer-container:visible').getAttribute('data-session-id');
 const next=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),newId);assert.equal(next.projection.model,ctx.expectedModel.defaultModel);assert.equal(next.projection.turns.length,0);report.newSessionId=newId;check('New actual conversation selects saved default without moving the old bound run');
 phase='cold';await app.close();app=undefined;assert.deepEqual(ledger(),baseline);await launch();await open();const restored=await page.evaluate(()=>window.omniEdu.getXiaozhiSettings());assert(restored.ok);assert.equal(restored.value.version,ctx.expectedModel.version);assert.equal(restored.value.configured,true);assert.equal(restored.value.defaultModel,ctx.expectedModel.defaultModel);assert.equal(restored.value.thinking.global.choice,'auto');assert.equal(restored.value.web.enabled,false);
 const old=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),ctx.sessionId);assert.equal(old.projection.model,ctx.expectedModel.oldModel);assert.equal(old.running,false);assert.equal(old.projection.turns.at(-1).id,sourceReport.runId);check('Cold startup decrypts saved credential and preserves default, bound model and finished run');
 await ctx.tab('skills');const skills=await page.evaluate(()=>window.omniEdu.getXiaozhiSkills());assert(skills.ok);const item=skills.value.skills.find(s=>s.name==='configuration-review');assert.equal(item.version,2);assert.equal(item.enabled,false);assert.equal(item.archived,false);
 await page.getByTestId('pi-skill-preview-configuration-review').click();await until(()=>page.getByTestId('pi-skill-full-document').innerText().then(t=>t===ctx.savedSkillDocument),'COLD_SKILL');await shot('cold-skill-version');check('Cold skill catalogue restores exact disabled version and full saved text');
 await ctx.tab('tools');const tools=await page.evaluate(()=>window.omniEdu.getXiaozhiMcpCatalog());assert(tools.ok);assert.equal(tools.value.servers.length,1);assert.equal(tools.value.servers[0].id,ctx.serverId);assert.equal(tools.value.servers[0].status,'revoked');assert.equal(ctx.mcp.state.calls,0);await shot('cold-tools-revoked');await providerReceipt();
 await app.close();app=undefined;assert.deepEqual(ledger(),baseline);assert.equal(fingerprint(skillRoot).sha256,skillHash);assert.equal(fingerprint(original).sha256,sourceHash);for(const file of ['app.db','app.db-wal']){const p=path.join(data,file);if(fs.existsSync(p)){const b=fs.readFileSync(p);assert(!b.includes(Buffer.from(modelKey)));assert(!b.includes(Buffer.from(mcpSecret)));}}
 assert.deepEqual(report.errors,[]);report.loopback={requests:mcp.state.requests,toolCalls:mcp.state.calls};check('Revocation, encrypted storage and original Pi/source ledgers survive cold restart without new calls');report.success=true;
}catch(error){report.failure={phase,message:String(error.message).replaceAll(modelKey,'[synthetic-key]').replaceAll(mcpSecret,'[synthetic-secret]').slice(0,1800),stackHash:sha256(String(error.stack))};if(page&&!page.isClosed()){
 report.failureFeedback=await page.evaluate(()=>({notice:document.querySelector('[data-testid="pi-settings-feedback"]')?.textContent??null,verifyText:document.querySelector('[data-testid="pi-settings-verify"]')?.textContent??null,verifyDisabled:document.querySelector('[data-testid="pi-settings-verify"]')?.getAttribute('disabled')??null})).catch(()=>null);
 report.providerAtFailure=await app.evaluate(readConfigurationProvider).catch(()=>null);await page.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});
 }process.exitCode=1;}
finally{clearTimeout(hardTimer);try{await app?.close();}catch{kill();report.success=false;process.exitCode=1;}await mcp.close();try{verify();assert.equal(fingerprint(original).sha256,sourceHash);report.integrityVerified=true;}catch{report.integrityVerified=false;report.success=false;process.exitCode=1;}save();console.log(JSON.stringify({output,success:report.success,checks:report.checks.length,failure:report.failure}));}
