import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {_electron as electron} from 'playwright';
import {fingerprint} from './acceptance/evidence.mjs';
import {tmpdir} from 'node:os';
import {contextSecurity,navigationSecurity,permissionPersistence,frameSurface} from './settings-window-cases/context-security.mjs';

const desktop=path.resolve(import.meta.dirname,'..'),repo=path.resolve(desktop,'../..');
const followup=process.argv.includes('--security-followup');
const external=process.env.OMNI_EDU_SETTINGS_ACCEPTANCE_ROOT;
if(external){const relative=path.relative(tmpdir(),path.resolve(external));assert(/^edudev-v31-[A-Za-z0-9_-]+$/.test(relative),'External root must be an owned task directory directly in OS temp');}
const output=external?fs.mkdtempSync(path.join(external,'product-')):fs.mkdtempSync(path.join(repo,'acceptance/uiux-v31-settings-20261126/product-'));
const owned=external?path.join(output,'runtime'):path.join(desktop,'test-results',path.basename(output)),profile=path.join(owned,'profile'),data=path.join(owned,'data');
for(const root of [profile,data])fs.mkdirSync(root,{recursive:true});
const entry=path.join(output,'entry.cjs'),mainFile=path.join(desktop,'out/main/index.js');
const probePreload=path.join(output,'hostile-preload.cjs'),probeHtml=path.join(output,'hostile.html');
// Acceptance-only adversarial window, absent from all production entry points.
fs.writeFileSync(probePreload,`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('probe',{call:(channel,input)=>ipcRenderer.invoke(channel,input)});`);
fs.writeFileSync(probeHtml,'<!doctype html><title>Untrusted settings IPC probe</title><p>Acceptance-only sender</p>');
fs.writeFileSync(entry,`const e=require('electron');
globalThis.__settingsBlockedNetwork=0;
const originalFetch=globalThis.fetch;globalThis.fetch=function(...args){const url=typeof args[0]==='string'?args[0]:args[0]?.url||String(args[0]);if(/^https?:/i.test(url)){__settingsBlockedNetwork++;return Promise.reject(Error('acceptance_network_disabled'));}return originalFetch.apply(this,args);};
e.app.whenReady().then(async()=>{e.session.defaultSession.webRequest.onBeforeRequest({urls:['http://*/*','https://*/*']},(_request,callback)=>{__settingsBlockedNetwork++;callback({cancel:true});});await import(require('node:url').pathToFileURL(${JSON.stringify(mainFile)}).href);}).catch(error=>{console.error(error);e.app.exit(1);});`);
const env={...process.env};
for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(key)||key.startsWith('OMNI_EDU_'))delete env[key];
Object.assign(env,{OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:repo,OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'1',OMNI_EDU_E2E_MANAGED_TOOLS_NO_BUILTIN:'1'});
const report={success:false,checks:[],errors:[],sourceRoot:repo,entry:mainFile,profile,data,build:fingerprint(path.join(desktop,'out')),buildSha256:createHash('sha256').update(fs.readFileSync(mainFile)).digest('hex'),boundary:'Actual production main/settings bundles and original services with a fresh owned database. Network/provider quality and other V3 pages are not accepted by this run.'};
let app,main,settings;
async function check(name,action){report.current=name;await action();report.checks.push({name,status:'PASS'});console.log('PASS '+name);}
try{
 app=await electron.launch({args:[entry,'--user-data-dir='+profile],env,cwd:desktop,timeout:60000});
 app.process().stderr.on('data',chunk=>fs.appendFileSync(path.join(output,'stderr.log'),chunk));
 main=await app.firstWindow({timeout:60000});
 const observe=page=>page.on('pageerror',error=>report.errors.push(String(error)));
 observe(main);
 await main.getByTestId('office-prompt-input').waitFor({timeout:60000});
 await check('production main keeps composer draft while opening real settings from navigation',async()=>{
  await main.getByTestId('office-prompt-input').fill('设置窗口验收：这段草稿必须保留');
  const opened=app.waitForEvent('window');await main.getByTestId('nav-settings').click();settings=await opened;observe(settings);
  await settings.getByTestId('pi-settings-workspace').waitFor({timeout:30000});
  assert.equal(await main.getByTestId('office-prompt-input').inputValue(),'设置窗口验收：这段草稿必须保留');
  assert((await settings.url()).endsWith('/settings.html'));
 });
 await check('settings is a top-level nonmodal sandboxed singleton with its own minimal preload',async()=>{
  const shape=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().map(window=>({id:window.id,parent:window.getParentWindow()?.id??null,modal:window.isModal(),top:window.isAlwaysOnTop(),bounds:window.getBounds(),url:window.webContents.getURL(),preferences:window.webContents.getLastWebPreferences()})));
  const child=shape.find(row=>row.url.endsWith('/settings.html'));assert(child);assert.equal(child.parent,null);assert.equal(child.modal,false);assert.equal(child.top,false);assert.equal(child.preferences.sandbox,true);assert.equal(child.preferences.contextIsolation,true);assert.equal(child.preferences.nodeIntegration,false);
  const exposed=await settings.evaluate(()=>({methods:Object.keys(window.omniEdu),host:!!window.settingsHost,node:typeof window.require}));
  report.apiSurface=exposed.methods;report.windows=shape.map(({preferences,...facts})=>({...facts,sandbox:preferences.sandbox,contextIsolation:preferences.contextIsolation,nodeIntegration:preferences.nodeIntegration,preload:preferences.preload}));
  assert.equal(exposed.host,false);assert.equal(exposed.node,'undefined');assert(!exposed.methods.some(name=>/terminal|exec|startXiaozhi|stopXiaozhi|readFile|writeFile/i.test(name)));
  await main.getByTestId('nav-settings').click();assert.equal((await app.windows()).length,2);
 });
 await check('real settings reads the verified main session instead of a local preference',async()=>{
  await settings.getByTestId('settings-window-scope').filter({hasText:'当前对话'}).waitFor({timeout:15000});
  const valid=await settings.evaluate(async()=>({scope:window.settingsWindow.getScope(),root:await window.omniEdu.getDataRoot()}));assert(valid.scope?.sessionId);assert.equal(path.resolve(valid.root),data);
  await settings.evaluate(()=>localStorage.setItem('xiaozhi.current-session.v1','forged-local-preference'));
  assert.equal((await settings.evaluate(()=>window.settingsWindow.getScope())).sessionId,valid.scope.sessionId);
 });
 if(followup)await contextSecurity({main,settings,check,report});
 await check('unsaved teacher memory blocks native close and preserves the editor on repeated open',async()=>{
  await settings.getByTestId('pi-settings-tab-teacher-memory').click();
  await settings.getByTestId('teacher-memory-textbook').fill('隔离验收教材草稿');
  await settings.getByTestId('settings-window-close').waitFor();
  await settings.waitForFunction(()=>document.querySelector('[data-testid="settings-window-close"]')?.hasAttribute('disabled'));
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().endsWith('/settings.html')).close());
  await settings.getByTestId('pi-settings-state').filter({hasText:'请先保存或放弃'}).waitFor();
  assert.equal((await app.windows()).length,2);assert.equal(await settings.getByTestId('teacher-memory-textbook').inputValue(),'隔离验收教材草稿');
  await main.getByTestId('nav-settings').click();assert.equal(await settings.getByTestId('teacher-memory-textbook').inputValue(),'隔离验收教材草稿');
  await settings.getByRole('button',{name:'放弃修改并重新读取',exact:true}).click();
  await settings.waitForFunction(()=>!document.querySelector('[data-testid="settings-window-close"]')?.hasAttribute('disabled'));
  await settings.getByTestId('pi-settings-state').filter({hasText:'请先保存或放弃未保存'}).waitFor({state:'detached'});
 });
 await check('existing navigation preference synchronizes between both real windows',async()=>{
  await settings.getByTestId('pi-settings-tab-interface').click();
  const before=await main.locator('.wb-navigation').getAttribute('data-collapsed');
  await settings.getByTestId('pi-preference-sidebar').click();
  await main.waitForFunction(previous=>document.querySelector('.wb-navigation')?.getAttribute('data-collapsed')!==previous,before);
  await settings.getByTestId('pi-preference-sidebar').click();
  await main.waitForFunction(previous=>document.querySelector('.wb-navigation')?.getAttribute('data-collapsed')===previous,before);
 });
 await check('actual IPC rejects an untrusted window even with a copied legitimate scope',async()=>{
  const scope=await settings.evaluate(()=>window.settingsWindow.getScope());
  const opened=app.waitForEvent('window');
  await app.evaluate(async({BrowserWindow},{preload,html})=>{const probe=new BrowserWindow({show:false,webPreferences:{preload,sandbox:true,contextIsolation:true,nodeIntegration:false}});await probe.loadFile(html);},{preload:probePreload,html:probeHtml});
  const probe=await opened;
  const denied=await probe.evaluate(async scope=>{
   const channels=['settings-window:api:app:getDataRoot','app:getDataRoot','settings-window:open','settings-window:select','settings-window:bootstrap',
    'settings-window:api:xiaozhi:settings-get','settings-window:api:xiaozhi:permission-view','settings-window:api:app:exportDataRoot',
    'settings-window:api:xiaozhi:skill-governance','settings-window:api:xiaozhi:mcp-catalog','settings-window:api:xiaozhi:diagnostic-preview',
    'xiaozhi:settings-get','xiaozhi:permission-view','app:exportDataRoot','xiaozhi:skill-governance','xiaozhi:mcp-catalog','xiaozhi:diagnostic-preview'];
   const answers=[];for(const channel of channels){try{await window.probe.call(channel,{schemaVersion:'settings.request.v1',scope,args:[]});answers.push('allowed');}catch(error){answers.push(String(error).includes('permission_denied')?'denied':'other');}}return answers;
  },scope);
  assert.equal(denied.length,17);assert(denied.every(result=>result==='denied'));report.untrustedEndpointDenials=denied.length;
  await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows().find(window=>window.webContents.getURL().endsWith('/hostile.html')).destroy());
 });
 await check('all ten existing categories are reachable including three memory modules',async()=>{
  for(const tab of ['models','interface','teacher-memory','permissions','backup']){
   await settings.getByTestId('pi-settings-tab-'+tab).click();await settings.locator('[data-testid="pi-settings-workspace"][data-tab="'+tab+'"]').waitFor();
   if(tab==='teacher-memory')for(const id of ['pi-history-memory-settings','pi-settings-l2-memory','pi-teacher-memory'])await settings.getByTestId(id).waitFor();
   await settings.screenshot({path:path.join(output,'settings-'+tab+'.png')});
  }
  await settings.getByTestId('pi-settings-tab-archives').click();
  await settings.getByTestId('pi-settings-advanced-toggle').click();
  for(const tab of ['capabilities','skills','tools','diagnostics']){await settings.getByTestId('pi-settings-tab-'+tab).click();await settings.locator('[data-testid="pi-settings-workspace"][data-tab="'+tab+'"]').waitFor();await settings.screenshot({path:path.join(output,'settings-'+tab+'.png')});}
 });
 if(followup){await frameSurface({settings,check,report});await navigationSecurity({app,main,getSettings:()=>settings,setSettings:page=>{settings=page;observe(page);},check,report});}
 await check('main remains editable; closing settings leaves Pi window and composer intact',async()=>{
  await main.bringToFront();await main.getByTestId('office-prompt-input').fill('设置关闭后仍然保留的草稿');
  await main.getByTestId('settings-main-dim').waitFor({state:'detached',timeout:3000});
  const closed=settings.waitForEvent('close');await settings.getByTestId('settings-window-close').click();await closed;
  assert.equal((await app.windows()).length,1);assert.equal(await main.getByTestId('office-prompt-input').inputValue(),'设置关闭后仍然保留的草稿');
 });
 report.displays=await app.evaluate(({screen})=>screen.getAllDisplays().map(display=>({bounds:display.bounds,workArea:display.workArea,scaleFactor:display.scaleFactor})));
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(error){report.failure=String(error);console.error(error);if(main)await main.screenshot({path:path.join(output,'main-failure.png')}).catch(()=>{});if(settings&&!settings.isClosed())await settings.screenshot({path:path.join(output,'settings-failure.png')}).catch(()=>{});}
finally{
 if(app){report.blockedNetwork=await app.evaluate(()=>globalThis.__settingsBlockedNetwork).catch(()=>null);await app.close().catch(()=>{});}
 if(followup)try{permissionPersistence(report);}catch(error){report.success=false;report.failure='Permission SQLite readback: '+String(error);}
 report.buildUnchanged=fingerprint(path.join(desktop,'out')).sha256===report.build.sha256;
 if(!report.buildUnchanged){report.success=false;report.failure='Build changed during acceptance';}
 fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,success:report.success,passed:report.checks.length,failure:report.failure}));if(!report.success)process.exitCode=1;
}
