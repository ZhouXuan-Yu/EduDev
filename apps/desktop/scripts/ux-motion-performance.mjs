import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from 'playwright';
import {zeroNetworkBootstrap} from './acceptance/zero-network-bootstrap.mjs';
import {testMain} from './acceptance/build-root.mjs';
import {fingerprint} from './acceptance/evidence.mjs';
const desktop=path.resolve(import.meta.dirname,'..'),repo=path.resolve(desktop,'../..');
const main=testMain(desktop);
const proof=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
if(fingerprint(path.join(desktop,'src')).sha256!==proof.source||fingerprint(path.dirname(path.dirname(main))).sha256!==proof.build)throw new Error('Accepted source/build changed');
const output=fs.mkdtempSync(path.join(repo,'docs/audit/ux-motion-20261126/performance-'));
const bootstrap=zeroNetworkBootstrap({output,main,profile:proof.profile,counter:'__performanceHttp'});
const env={...process.env,OMNI_EDU_DATA_ROOT:proof.data,OMNI_EDU_REPO_ROOT:repo,OMNI_EDU_SKIP_DOTENV:'1'};
for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_E2E_')||['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS'].includes(key))delete env[key];
let app;
const report={success:false,source:proof.source,build:proof.build,samples:[],boundary:'Follow-up per-route attribution on the identical accepted build and fictional profile. Original measurements remain retained; this does not supersede them.'};
try{
 app=await electron.launch({args:[bootstrap,'--user-data-dir='+proof.profile],cwd:desktop,env});const page=await app.firstWindow();await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
 await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];globalThis.__focusEvents=[];w.on('blur',()=>globalThis.__focusEvents.push({event:'blur',time:Date.now()}));w.on('focus',()=>globalThis.__focusEvents.push({event:'focus',time:Date.now()}));w.setContentSize(1366,768);w.show();w.focus();});
 await page.waitForTimeout(400);
 for(let cycle=0;cycle<3;cycle++)for(const id of ['knowledge','teaching','student-workbench','ai-workspace']){
  await page.evaluate(()=>{cancelAnimationFrame(globalThis.__frameId);globalThis.__frames=[];globalThis.__long=[];globalThis.__frameStop=false;globalThis.__previous=0;
   globalThis.__frameId=requestAnimationFrame(function tick(t){if(__previous)__frames.push(t-__previous);__previous=t;if(!__frameStop)globalThis.__frameId=requestAnimationFrame(tick);});
   globalThis.__obs=new PerformanceObserver(list=>__long.push(...list.getEntries().map(e=>({duration:e.duration,startTime:e.startTime,route:[...document.querySelectorAll('.edu-shell')].find(el=>el.getClientRects().length)?.getAttribute('data-view')}))));__obs.observe({type:'longtask'});});
  await page.locator('[data-testid=edu-navigation]:visible').getByTestId('nav-'+id).click();await page.waitForTimeout(300);
  const sample=await page.evaluate(()=>{__frameStop=true;cancelAnimationFrame(__frameId);__obs.disconnect();const f=__frames.sort((a,b)=>a-b);return{visibility:document.visibilityState,count:f.length,p95:f[Math.floor((f.length-1)*.95)],max:f.at(-1),longTasks:__long};});report.samples.push({cycle,id,...sample});
 }
 report.focusEvents=await app.evaluate(()=>globalThis.__focusEvents);
 report.success=true;
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;}
finally{if(app)await app.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,...report}));}
