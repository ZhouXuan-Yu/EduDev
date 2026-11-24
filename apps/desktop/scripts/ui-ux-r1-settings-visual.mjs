import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {_electron as electron} from 'playwright';
import {measureTextContrast} from './xiaozhi-agent/capture-workspace-metrics.mjs';import {fingerprint} from './acceptance/evidence.mjs';import {zeroNetworkBootstrap} from './acceptance/zero-network-bootstrap.mjs';import {assertIsolatedPiMain} from './acceptance/build-root.mjs';
const desktop=path.resolve(import.meta.dirname,'..'),repo=path.resolve(desktop,'../..'),output=fs.mkdtempSync(path.join(repo,'acceptance/ui-ux-r1-20261124/evidence/settings-visual-'));
const owned=path.join(desktop,'test-results',path.basename(output)),profile=path.join(owned,'profile'),data=path.join(owned,'data');for(const d of [profile,data])fs.mkdirSync(d,{recursive:true});
const main=path.join(desktop,'out/main/index.js'),bootstrap=zeroNetworkBootstrap({main,profile,output,counter:'__visualNetwork'}),report={success:false,build:fingerprint(path.join(desktop,'out')).sha256,checks:[],contrast:[],focus:[],errors:[]};let app,page;
try{
 const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:repo};for(const k of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/.test(k)||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(k))delete env[k];
 app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile],cwd:desktop,env,timeout:60000});page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(String(e)));
 await page.getByTestId('office-prompt-input').waitFor();report.identity=await assertIsolatedPiMain(app,main,profile);await page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-settings').click();await page.getByTestId('pi-settings-key').waitFor();
 for(const [width,height]of [[1366,768],[1920,1080],[800,768]]){
  await app.evaluate(({BrowserWindow},s)=>BrowserWindow.getAllWindows()[0].setContentSize(...s),[width,height]);
  for(const [id,pseudo]of [['pi-settings-search','::placeholder'],['pi-settings-key','::placeholder'],['pi-settings-default-model',null],['pi-settings-save',null],['pi-settings-tab-models',null]]){
   const field=page.getByTestId(id);await field.scrollIntoViewIfNeeded();const contrast=await measureTextContrast(field,pseudo);const disabled=await field.isDisabled();report.contrast.push({id,width,disabled,exception:disabled?'Inactive controls are exempt under WCAG 1.4.3; preserve official disabled appearance':undefined,...contrast});if(!disabled)assert(contrast.ratio>=4.5,id+' contrast '+contrast.ratio);
  }
  const nav=page.getByTestId('pi-settings-tab-interface');await nav.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab');
  assert(await nav.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')),'Real keyboard focus returns to the category');
  const style=await nav.evaluate(el=>{const c=getComputedStyle(el),r=el.getBoundingClientRect();return{outlineStyle:c.outlineStyle,outlineWidth:c.outlineWidth,width:r.width,height:r.height};});assert.notEqual(style.outlineStyle,'none');assert(style.width>=24&&style.height>=24);report.focus.push({width,...style});
  await page.screenshot({path:path.join(output,'models-keyboard-'+width+'.png')});
 }
 report.checks.push('All enabled fields/navigation labels retain 4.5:1 contrast at all three sizes; genuine disabled controls are recorded separately','Actual keyboard navigation has visible focus and 24px targets');assert.deepEqual(report.errors,[]);report.success=true;
}catch(e){report.failure=String(e.stack||e);process.exitCode=1;await page?.screenshot({path:path.join(output,'failure.png')}).catch(()=>{});}
finally{await app?.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,output,failure:report.failure}));}
