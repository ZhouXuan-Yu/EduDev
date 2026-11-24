import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {_electron as electron} from 'playwright';
import {fingerprint} from './acceptance/evidence.mjs';
import {zeroNetworkBootstrap} from './acceptance/zero-network-bootstrap.mjs';
import {assertIsolatedPiMain} from './acceptance/build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'..');
const baseline=process.argv.includes('--baseline');
const runtime=baseline?path.join(desktop,'test-results/ui-r1-baseline-source/apps/desktop'):desktop;
const main=path.join(runtime,'out/main/index.js');
const output=fs.mkdtempSync(path.resolve(desktop,'../../acceptance/ui-ux-r1-20261124/evidence/response-'+(baseline?'before-':'after-')));
const owned=path.join(desktop,'test-results',path.basename(output));
const profile=path.join(owned,'profile'),data=path.join(owned,'data');
for(const d of [profile,data])fs.mkdirSync(d,{recursive:true});
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(runtime,'../..')};
for(const k of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/.test(k)||k.startsWith('OMNI_EDU_E2E_')||['NODE_OPTIONS','ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL'].includes(k))delete env[k];
const bootstrap=zeroNetworkBootstrap({main,profile,output,counter:'__responseNetwork'});
const report={success:false,baseline,runtime,source:baseline?'700143faca7051baca892b50cf5081ff297ec9bb':execFileSync('git',['rev-parse','HEAD'],{cwd:desktop,encoding:'utf8'}).trim(),sourceFingerprint:fingerprint(path.join(runtime,'src')).sha256,build:fingerprint(path.join(runtime,'out')).sha256,
  method:'Actual production Electron. Capture-phase pointerup/input to first animation frame after observable DOM feedback; trusted Playwright pointer/keyboard, not physical input. Same clean empty application data in each independent profile. No provider timing, network or mock outputs.',samples:[],errors:[]};
let app,page;
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
async function sample(kind,target,event,action,condition){
  await target.evaluate((el,{event,condition})=>{
    window.__responseSample=null;
    el.addEventListener(event,()=>{
      const start=performance.now();
      const ready=()=>condition==='tab'?document.querySelector('[data-testid="pi-settings-workspace"]')?.getAttribute('data-tab')===el.getAttribute('data-testid').replace('pi-settings-tab-',''):condition==='expanded'?el.getAttribute('aria-expanded')==='true':Boolean(document.querySelector('[data-testid="pi-settings-search-results"]'))&&el.value.length>0;
      const observer=new MutationObserver(check);
      function check(){if(ready()){observer.disconnect();requestAnimationFrame(()=>window.__responseSample={ms:performance.now()-start,event,condition});}}
      observer.observe(document.body,{attributes:true,childList:true,subtree:true,characterData:true});check();
    },{capture:true,once:true});
  },{event,condition});
  await action();await page.waitForFunction(()=>window.__responseSample!==null,{},{timeout:3000});
  report.samples.push({kind,...await page.evaluate(()=>window.__responseSample)});save();
}
try{
  app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile],env,cwd:runtime,timeout:60000});
  page=await app.firstWindow();page.setDefaultTimeout(15000);page.on('pageerror',e=>report.errors.push(String(e)));
  await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
  report.identity=await assertIsolatedPiMain(app,main,profile);
  report.display=await app.evaluate(({screen})=>screen.getAllDisplays().map(d=>({bounds:d.bounds,scaleFactor:d.scaleFactor})));
  await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];w.setContentSize(1366,768);w.focus();});
  await page.locator('[data-testid="edu-navigation"]:visible').getByTestId('nav-settings').click();
  await page.getByTestId('pi-settings-key').waitFor();
  for(let i=0;i<10;i++){
    const id=i%2?'models':'interface',target=page.getByTestId('pi-settings-tab-'+id);
    await sample('category',target,'pointerup',()=>target.click(),'tab');
  }
  const toggle=page.getByTestId('pi-settings-advanced-toggle');
  for(let i=0;i<10;i++){
    if(await toggle.getAttribute('aria-expanded')==='true')await toggle.click();
    await sample('disclosure',toggle,'pointerup',()=>toggle.click(),'expanded');
  }
  const search=page.getByTestId('pi-settings-search');
  for(let i=0;i<10;i++){
    await search.fill('');await search.focus();
    await sample('controlled-search-feedback',search,'input',()=>page.keyboard.insertText(i%2?'备份':'模型'),'input');
  }
  report.viewport=await page.evaluate(()=>({width:innerWidth,height:innerHeight,dpr:devicePixelRatio}));
  report.summary=Object.fromEntries(['category','disclosure','controlled-search-feedback'].map(kind=>{const values=report.samples.filter(s=>s.kind===kind).map(s=>s.ms);return[kind,{count:values.length,under200:values.filter(ms=>ms<=200).length,max:Math.max(...values)}];}));
  for(const s of Object.values(report.summary)){assert.equal(s.count,10);assert(s.under200>=9);assert(s.max<=500);}
  assert.deepEqual(report.errors,[]);report.success=true;
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;}
finally{await app?.close();save();console.log(JSON.stringify({success:report.success,output,summary:report.summary,failure:report.failure}));}
