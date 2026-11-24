import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {_electron as electron} from 'playwright';
import {measureTextContrast,settleWorkspaceTransitions} from './xiaozhi-agent/capture-workspace-metrics.mjs';import {fingerprint} from './acceptance/evidence.mjs';import {zeroNetworkBootstrap} from './acceptance/zero-network-bootstrap.mjs';import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
const desktop=path.resolve(import.meta.dirname,'..'),repo=path.resolve(desktop,'../..'),output=fs.mkdtempSync(path.join(repo,'acceptance/ui-ux-r1-20261124/evidence/settings-visual-'));
const owned=path.join(desktop,'test-results',path.basename(output));const configured=process.argv[2]?fs.realpathSync(process.argv[2]):undefined;if(configured)assert(configured.startsWith(path.join(desktop,'test-results')+path.sep));const profile=path.join(configured||owned,'profile'),data=path.join(configured||owned,'data');for(const d of [profile,data])fs.mkdirSync(d,{recursive:true});
const main=path.join(desktop,'out/main/index.js'),bootstrap=zeroNetworkBootstrap({main,profile,output,counter:'__visualNetwork'}),report={success:false,build:fingerprint(path.join(desktop,'out')).sha256,checks:[],contrast:[],focus:[],errors:[]};let app,page;
try{
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:repo};for(const k of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/.test(k)||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(k))delete env[k];
 if(process.argv.includes('--hidden'))env.OMNI_EDU_E2E_DIALOG_MODE='1';
 app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(String(e)));
 await page.getByTestId('office-prompt-input').waitFor();report.visible=await app.evaluate(({BrowserWindow})=>BrowserWindow.getAllWindows()[0].isVisible());report.identity=await assertIsolatedPiMain(app,main,profile);await page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-settings').click();await page.getByTestId('pi-settings-key').waitFor();
 if(process.argv.includes('--probe')){
  report.transitions=[];
  for(let i=0;i<3;i++){
   await page.getByTestId('pi-settings-tab-interface').click();await page.getByTestId('pi-settings-tab-models').click();
   await page.waitForFunction(()=>!document.querySelector('[data-testid="pi-settings-key"]').disabled);
   const button=page.getByTestId('pi-settings-save');const before=await measureTextContrast(button);
   const state=await button.evaluate(el=>{const c=getComputedStyle(el);return{className:el.className,disabled:el.disabled,bg:c.getPropertyValue('--button-bg'),color:c.backgroundColor,animations:el.getAnimations().map(a=>({time:a.currentTime,end:a.effect?.getComputedTiming().endTime,state:a.playState,transition:a.transitionProperty}))};});
   const settled=await settleWorkspaceTransitions(page,{hiddenSnapshot:!report.visible});const after=await measureTextContrast(button);report.transitions.push({before,state,settled,after});
  }
 }
 for(const [width,height]of [[1366,768],[1920,1080],[800,768]]){
  await app.evaluate(({BrowserWindow},s)=>BrowserWindow.getAllWindows()[0].setContentSize(...s),[width,height]);
  for(const [id,pseudo]of [['pi-settings-search','::placeholder'],['pi-settings-key','::placeholder'],['pi-settings-default-model',null],['pi-settings-save',null],['pi-settings-tab-models',null]]){
   const field=page.getByTestId(id);await field.scrollIntoViewIfNeeded();const contrast=await measureTextContrast(field,pseudo);const disabled=await field.isDisabled();const styles=await field.evaluate(el=>{const c=getComputedStyle(el);return{className:el.className,ariaDisabled:el.getAttribute('aria-disabled'),hovered:el.matches(':hover'),buttonBg:c.getPropertyValue('--button-bg'),buttonHover:c.getPropertyValue('--button-bg-hover'),eduAccent:c.getPropertyValue('--edu-accent'),animations:el.getAnimations().map(a=>({currentTime:a.currentTime,playState:a.playState,end:a.effect?.getComputedTiming().endTime,transition:a.transitionProperty}))};});report.contrast.push({id,width,disabled,styles,exception:disabled?'Inactive controls are exempt under WCAG 1.4.3; preserve official disabled appearance':undefined,...contrast});if(!disabled)assert(contrast.ratio>=4.5,id+' contrast '+contrast.ratio);
  }
  const nav=page.getByTestId('pi-settings-tab-interface');await nav.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
  assert(await nav.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')),'Real keyboard focus returns to the category');
  const style=await nav.evaluate(el=>{const c=getComputedStyle(el),r=el.getBoundingClientRect();return{outlineStyle:c.outlineStyle,outlineWidth:c.outlineWidth,width:r.width,height:r.height};});assert.notEqual(style.outlineStyle,'none');assert(style.width>=24&&style.height>=24);report.focus.push({width,...style});
  await page.screenshot({path:path.join(output,'models-keyboard-'+width+'.png')});
 }
 report.checks.push('All enabled fields/navigation labels retain 4.5:1 contrast at all three sizes; genuine disabled controls are recorded separately','Actual keyboard navigation has visible focus and 24px targets');assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.failure=String(e.stack||e);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,output,failure:report.failure}));}
