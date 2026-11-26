import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from 'playwright';
import {testMain, assertIsolatedPiMain} from './acceptance/build-root.mjs';
import {zeroNetworkBootstrap} from './acceptance/zero-network-bootstrap.mjs';
import {fingerprint} from './acceptance/evidence.mjs';

const desktop=path.resolve(import.meta.dirname,'..');
const output=fs.mkdtempSync(path.resolve(desktop,'../../acceptance/ux-followup-20261126/performance-'));
const main=testMain(desktop);
const proofArg=process.argv.find(arg=>arg.startsWith('--build-proof='));
const proof=proofArg?JSON.parse(fs.readFileSync(proofArg.slice('--build-proof='.length),'utf8')):undefined;
const report={success:false,main,source:proof?.source??fingerprint(path.join(desktop,'src')).sha256,
  sourceAtMeasurement:fingerprint(path.join(desktop,'src')).sha256,
  build:fingerprint(path.resolve(main,'../..')).sha256, samples:[],
  boundary:'Fresh isolated production Electron for each cold navigation. Diagnostic control disables only the app main-surface entrance, not HeroUI animation. No provider or OCR inference.'};
if(proof)assert.equal(report.build,proof.build,'Historical build must match its recorded proof');
const env={...process.env,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_SKIP_DOTENV:'1'};
for(const key of Object.keys(env))if(/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL/i.test(key)||key.startsWith('OMNI_EDU_E2E_')||['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS'].includes(key))delete env[key];
let app;
try {
  const controls=process.argv.includes('--deep-trace')?['standard']:process.argv.includes('--standard-only')?['standard','standard','standard']:['standard','without-entrance','standard','without-entrance'];
  for(const control of controls) {
    const root=path.join(output,String(report.samples.length)),profile=path.join(root,'profile');
    fs.mkdirSync(profile,{recursive:true});
    const bootstrap=zeroNetworkBootstrap({output:root,main,profile,counter:'__followupHttp'});
    app=await electron.launch({args:[bootstrap,'--user-data-dir='+profile],cwd:desktop,env:{...env,OMNI_EDU_DATA_ROOT:path.join(root,'data')},timeout:60000});
    const page=await app.firstWindow();
    await page.getByTestId('office-prompt-input').waitFor({timeout:60000});
    const identity=await assertIsolatedPiMain(app,main,profile);
    await app.evaluate(({BrowserWindow})=>{const w=BrowserWindow.getAllWindows()[0];globalThis.__traceFocus=[];w.on('focus',()=>__traceFocus.push({event:'focus',time:Date.now()}));w.on('blur',()=>__traceFocus.push({event:'blur',time:Date.now()}));w.setContentSize(1366,768);w.show();w.focus();});
    if(control==='without-entrance')await page.evaluate(()=>{
      const original=Element.prototype.animate;globalThis.__entranceSuppressed=0;
      Element.prototype.animate=function(...args){
        if(this.classList.contains('edu-workspace')&&Array.isArray(args[0])&&args[0].every(frame=>Object.keys(frame).every(key=>key==='opacity'))){__entranceSuppressed++;return original.call(this,[{opacity:1},{opacity:1}],{duration:0});}
        return original.apply(this,args);
      };
    });
    await page.waitForTimeout(600);
    const cdp=await page.context().newCDPSession(page);
    await cdp.send('Tracing.start',{categories:'devtools.timeline,blink.user_timing'+(process.argv.includes('--deep-trace')?',toplevel,cc,gpu,renderer.scheduler,disabled-by-default-devtools.timeline.frame':''),transferMode:'ReturnAsStream'});
    await page.evaluate(()=>{
      globalThis.__followupFrames=[];globalThis.__followupTasks=[];globalThis.__followupPrev=0;
      globalThis.__followupRaf=requestAnimationFrame(function tick(t){if(__followupPrev)__followupFrames.push(t-__followupPrev);__followupPrev=t;globalThis.__followupRaf=requestAnimationFrame(tick);});
      globalThis.__followupObserver=new PerformanceObserver(list=>__followupTasks.push(...list.getEntries().map(e=>({start:e.startTime,duration:e.duration}))));
      __followupObserver.observe({type:'longtask'});
    });
    await page.locator('[data-testid=edu-navigation]:visible').getByTestId('nav-knowledge').click();
    await page.getByTestId('materials-search').waitFor();
    await page.waitForTimeout(600);
    const sample=await page.evaluate(()=>{
      cancelAnimationFrame(__followupRaf);__followupObserver.disconnect();
      const raw=__followupFrames,sorted=[...raw].sort((a,b)=>a-b);
      return {raw,p95:sorted[Math.floor((sorted.length-1)*.95)],max:sorted.at(-1),tasks:__followupTasks,
        viewport:{width:innerWidth,height:innerHeight,dpr:devicePixelRatio},focused:document.hasFocus(),visibility:document.visibilityState,
        entranceSuppressed:globalThis.__entranceSuppressed||0,visibleNodes:document.querySelectorAll('*').length};
    });
    sample.focusEvents=await app.evaluate(()=>__traceFocus);
    if(control==='without-entrance')assert.equal(sample.entranceSuppressed,1,'The diagnostic must actually suppress the observed app entrance');
    const finished=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));
    await cdp.send('Tracing.end');const {stream}=await finished;
    let trace='';for(;;){const chunk=await cdp.send('IO.read',{handle:stream});trace+=chunk.data;if(chunk.eof)break;}
    await cdp.send('IO.close',{handle:stream});
    fs.writeFileSync(path.join(root,'trace.json'),trace);
    const events=JSON.parse(trace).traceEvents;
    sample.slowest=events.filter(e=>e.ph==='X'&&e.dur).sort((a,b)=>b.dur-a.dur).slice(0,18).map(e=>({name:e.name,duration:e.dur/1000,pid:e.pid,tid:e.tid,args:e.args}));
    report.samples.push({control,identity,...sample});
    fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
    await app.close();app=undefined;
  }
  assert(report.samples.every(s=>s.focused&&s.visibility==='visible'));
  report.success=true;
}catch(error){report.failure=String(error.stack||error);process.exitCode=1;}
finally{if(app)await app.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({output,success:report.success,samples:report.samples.map(({control,p95,max,tasks,slowest})=>({control,p95,max,tasks,slowest:slowest.slice(0,5)})),failure:report.failure}));}
