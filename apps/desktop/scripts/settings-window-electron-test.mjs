import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {build} from 'esbuild';
import {_electron as electron} from 'playwright';
import {createHash} from 'node:crypto';

const desktop=path.resolve(import.meta.dirname,'..'),repo=path.resolve(desktop,'../..');
const output=fs.mkdtempSync(path.join(repo,'acceptance/uiux-v31-settings-20261126/controller-electron-'));
const profile=path.join(desktop,'test-results',path.basename(output),'profile');fs.mkdirSync(profile,{recursive:true});
const mainHtml=path.join(output,'main.html'),settingsHtml=path.join(output,'settings.html');
const csp="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src 'none'; object-src 'none'; base-uri 'none'";
fs.writeFileSync(mainHtml,`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>W2-A lifecycle fixture · not product UI</title><label>Main draft<input id="draft" aria-label="Main draft"></label><button id="open">Open settings</button><p id="status"></p><script src="main.js"></script>`);
fs.writeFileSync(path.join(output,'main.js'),`document.getElementById('open').onclick=()=>window.testWindows.open().then(()=>document.getElementById('status').textContent='opened',()=>document.getElementById('status').textContent='failed');window.testWindows.onDim(value=>document.body.dataset.dimmed=String(value));`);
fs.writeFileSync(settingsHtml,`<!doctype html><meta charset="utf-8"><meta http-equiv="Content-Security-Policy" content="${csp}"><title>W2-A settings fixture · not product UI</title><h1>Window lifecycle fixture</h1><label>Settings draft<input aria-label="Settings draft"></label>`);
const mainPreload=path.join(output,'main-preload.cjs'),settingsPreload=path.join(output,'settings-preload.cjs');
fs.writeFileSync(mainPreload,`const {contextBridge,ipcRenderer}=require('electron');contextBridge.exposeInMainWorld('testWindows',{open:()=>ipcRenderer.invoke('test:settings-open'),onDim:callback=>ipcRenderer.on('test:dim',(_event,value)=>callback(value))});`);
fs.writeFileSync(settingsPreload,`'use strict'; // Intentionally no domain API in lifecycle fixture.\n`);
const entry=path.join(output,'entry.mjs'),main=path.join(output,'main.cjs');
fs.writeFileSync(entry,`
import {app,BrowserWindow,ipcMain,screen} from 'electron';
import {SettingsWindowController} from ${JSON.stringify(path.join(desktop,'src/main/settings-window/controller.ts'))};
(async()=>{
app.setPath('userData',${JSON.stringify(profile)});await app.whenReady();
const mainWindow=new BrowserWindow({width:1000,height:700,show:true,webPreferences:{sandbox:true,nodeIntegration:false,contextIsolation:true,preload:${JSON.stringify(mainPreload)}}});
globalThis.__lifecycle={main:mainWindow,failNext:false,dim:[],controller:null};
const controller=new SettingsWindowController({create:options=>new BrowserWindow(options),preload:${JSON.stringify(settingsPreload)},trustedUrl:${JSON.stringify(pathToFileURL(settingsHtml).href)},main:()=>mainWindow,
 workArea:()=>screen.getDisplayMatching(mainWindow.getBounds()).workArea,
 onDim:dimmed=>{__lifecycle.dim.push(dimmed);if(!mainWindow.isDestroyed())mainWindow.webContents.send('test:dim',dimmed);},
 load:async window=>{if(__lifecycle.failNext){__lifecycle.failNext=false;throw Error('injected_load_failure');}await window.loadFile(${JSON.stringify(settingsHtml)});}});
__lifecycle.controller=controller;
ipcMain.handle('test:settings-open',event=>{if(event.sender!==mainWindow.webContents||event.senderFrame!==mainWindow.webContents.mainFrame)throw Error('permission_denied');return controller.open().then(window=>window.id);});
app.on('before-quit',()=>controller.dispose());await mainWindow.loadFile(${JSON.stringify(mainHtml)});
})().catch(error=>{console.error(error);app.exit(1);});
`);
await build({entryPoints:[entry],outfile:main,bundle:true,platform:'node',format:'cjs',external:['electron'],target:'node24',logLevel:'silent'});
const env={...process.env};for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL'].includes(key)||key.startsWith('OMNI_EDU_E2E_'))delete env[key];
const report={success:false,checks:[],errors:[],output,profile,controllerSha256:createHash('sha256').update(fs.readFileSync(path.join(desktop,'src/main/settings-window/controller.ts'))).digest('hex'),boundary:'Actual Electron exercising the production lifecycle module with isolated HTML fixtures. No domain API/configuration/Pi integration or formal V3 AC PASS claim.'};
let app;
const check=name=>{report.checks.push({name,pass:true});};
try{
 app=await electron.launch({args:[main,'--user-data-dir='+profile],env,cwd:desktop});const page=await app.firstWindow();page.setDefaultTimeout(10000);
 page.on('pageerror',error=>report.errors.push(String(error)));await page.getByRole('button',{name:'Open settings'}).waitFor();await page.getByLabel('Main draft').fill('preserved-main-draft');
 const opening=app.waitForEvent('window');await page.getByRole('button',{name:'Open settings'}).click();let settings=await opening;await settings.getByLabel('Settings draft').waitFor();await settings.getByLabel('Settings draft').fill('preserved-settings-draft');
 report.windows=await app.evaluate(({BrowserWindow,screen})=>({windows:BrowserWindow.getAllWindows().map(w=>({id:w.id,parent:w.getParentWindow()?.id??null,modal:w.isModal(),alwaysOnTop:w.isAlwaysOnTop(),bounds:w.getBounds(),sandbox:w.webContents.getLastWebPreferences().sandbox})),displays:screen.getAllDisplays().map(d=>({id:d.id,workArea:d.workArea,scaleFactor:d.scaleFactor,displayFrequency:d.displayFrequency}))}));
 assert.equal(report.windows.windows.length,2);assert(report.windows.windows.every(w=>w.parent===null&&!w.modal&&!w.alwaysOnTop&&w.sandbox));check('actual top-level nonmodal sandboxed windows');
 const id=await app.evaluate(()=>__lifecycle.controller.window.id);await page.getByRole('button',{name:'Open settings'}).click();assert.equal(await app.evaluate(()=>__lifecycle.controller.window.id),id);assert.equal(await settings.getByLabel('Settings draft').inputValue(),'preserved-settings-draft');check('repeated visible-entry open preserves same renderer and draft');
 assert(await app.evaluate(()=>{const c=__lifecycle.controller,w=c.window;return c.trusted({sender:w.webContents,senderFrame:w.webContents.mainFrame})&&!c.trusted({sender:__lifecycle.main.webContents,senderFrame:__lifecycle.main.webContents.mainFrame});}));
 assert.deepEqual(await settings.evaluate(()=>({node:typeof require,api:typeof window.omniEdu})),{node:'undefined',api:'undefined'});check('real frame identity and isolated fixture preload');
 await app.evaluate(()=>__lifecycle.main.focus());await page.waitForFunction(()=>document.body.dataset.dimmed==='false');await page.getByLabel('Main draft').fill('main-remains-editable');check('main stays editable and focus removes dimming');
 await app.evaluate(()=>__lifecycle.controller.window.close());await settings.waitForEvent('close');assert.equal(await page.getByLabel('Main draft').inputValue(),'main-remains-editable');check('closing settings preserves main renderer draft');
 await app.evaluate(()=>{__lifecycle.failNext=true;});await page.getByRole('button',{name:'Open settings'}).click();await page.waitForFunction(()=>document.getElementById('status').textContent==='failed');assert.equal(await app.evaluate(()=>__lifecycle.controller.window),undefined);check('actual create/load failure releases reference');
 const retry=app.waitForEvent('window');await page.getByRole('button',{name:'Open settings'}).click();settings=await retry;await settings.getByLabel('Settings draft').waitFor();assert.notEqual(await app.evaluate(()=>__lifecycle.controller.window.id),id);check('visible-entry retry creates a fresh real window');
 await settings.screenshot({path:path.join(output,'settings-fixture.png')});await page.screenshot({path:path.join(output,'main-fixture.png')});
 const closeOnNavigation=settings.waitForEvent('close');await app.evaluate(async()=>{try{await __lifecycle.controller.window.webContents.loadURL('data:text/html,untrusted');}catch{}});await closeOnNavigation;assert.equal(await app.evaluate(()=>__lifecycle.controller.window),undefined);check('actual programmatic navigation invalidates privileged document');
 assert.deepEqual(report.errors,[]);report.success=true;
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;}finally{await app?.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,failure:report.failure}));}
