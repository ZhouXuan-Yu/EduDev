import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {_electron as electron} from 'playwright';
import {testMain,assertIsolatedPiMain} from '../acceptance/build-root.mjs';import {fingerprint} from '../acceptance/evidence.mjs';import {settleWorkspaceTransitions} from './capture-workspace-metrics.mjs';
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-theme-transition-')),profile=path.join(output,'profile');
const report={success:false,checks:[],views:[],errors:[],boundary:'Actual isolated Electron, native visible window and nativeTheme transitions, no forced animation completion. No model, event-state or daily-profile claim.'};let app,page;
const check=name=>{report.checks.push({name,pass:true});console.log('PASS '+name);};
function luminance(rgb){const c=rgb.match(/[\d.]+/g).slice(0,3).map(Number).map(x=>{x/=255;return x<=.04045?x/12.92:((x+.055)/1.055)**2.4;});return c[0]*.2126+c[1]*.7152+c[2]*.0722;}
try{
 const env={...process.env,OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_DATA_ROOT:path.join(output,'data'),OMNI_EDU_REPO_ROOT:path.resolve('../..')};delete env.ELECTRON_RUN_AS_NODE;delete env.NODE_OPTIONS;
 app=await electron.launch({args:[testMain(process.cwd()),`--user-data-dir=${profile}`],env,timeout:60000});report.launch=await assertIsolatedPiMain(app,testMain(process.cwd()),profile);page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error)));await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
 await app.evaluate(({BrowserWindow})=>{const win=BrowserWindow.getAllWindows()[0];win.show();win.focus();});await page.bringToFront();await page.emulateMedia({colorScheme:null});assert(await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible()));
 for(const [width,height]of[[1366,768],[1920,1080]]){
  await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(...size),[width,height]);
  for(const theme of['light','dark','light']){
   report.lastTheme=await app.evaluate(({nativeTheme},theme)=>{nativeTheme.themeSource=theme;return {requested:theme,source:nativeTheme.themeSource,dark:nativeTheme.shouldUseDarkColors};},theme);report.beforeWait=await page.evaluate(()=>({dark:matchMedia('(prefers-color-scheme: dark)').matches,light:matchMedia('(prefers-color-scheme: light)').matches}));await page.waitForFunction(dark=>matchMedia('(prefers-color-scheme: dark)').matches===dark,theme==='dark');
   const transitions=await settleWorkspaceTransitions(page);const sample=await page.getByTestId('office-prompt-input').evaluate(input=>{
    const shell=input.closest('[data-slot="prompt-input-shell"]'),composer=input.closest('.office-composer-container'),work=input.closest('.xiaozhi-pi-workspace');
    const style=el=>({background:getComputedStyle(el).backgroundColor,color:getComputedStyle(el).color,paper:getComputedStyle(el).getPropertyValue('--pi-paper').trim(),officePaper:getComputedStyle(el).getPropertyValue('--office-paper').trim()});
    return {shell:style(shell),composer:style(composer),work:style(work),visibility:document.visibilityState};
   });const foreground=luminance(sample.shell.color),background=luminance(sample.shell.background),contrast=(Math.max(foreground,background)+.05)/(Math.min(foreground,background)+.05);
   report.views.push({width,height,theme,transitions,sample,luminance:background,contrast});await page.screenshot({path:path.join(output,`${width}-${theme}-${report.views.length}.png`)});
  }
 }
 fs.writeFileSync(path.join(output,'observations.json'),JSON.stringify(report.views,null,2));
 assert(report.views.every(v=>v.theme==='dark'?v.luminance<.12:v.luminance>.7),'Composer surface must actually follow the settled native theme');check('Actual composer background follows light→dark→light at both window sizes');
 assert(report.views.every(v=>v.contrast>=4.5),'Composer text contrast');check('Settled actual composer text contrast is at least 4.5:1');assert(report.views.every(v=>!v.transitions.advancedHiddenSnapshot&&v.sample.visibility==='visible'));check('Visible real transitions settle without force-finishing animations');
 assert.deepEqual(report.errors,[]);report.build=fingerprint(path.dirname(path.dirname(testMain(process.cwd())))).sha256;report.success=true;
}catch(error){report.error=String(error.stack||error);process.exitCode=1;}
finally{await app?.close().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));}
