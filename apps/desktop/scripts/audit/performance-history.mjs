import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {DatabaseSync} from 'node:sqlite';
import {_electron as electron} from 'playwright';
import {fingerprint} from '../acceptance/evidence.mjs';
import {assertIsolatedPiMain} from '../acceptance/build-root.mjs';
import {statistics,compareReports,serializableConditions} from './performance-contract.mjs';

const desktop=path.resolve(import.meta.dirname,'../..');
const root=path.join(desktop,'test-results');fs.mkdirSync(root,{recursive:true});
const output=fs.mkdtempSync(path.join(root,'audit-performance-'));
const data=path.join(output,'data'),profile=path.join(output,'profile'),main=path.join(desktop,'out/main/index.js');
const baselineArg=process.argv.find(value=>value.startsWith('--baseline='));
const probeEnabled=!process.argv.includes('--without-probes');
const mainBuild=fingerprint(path.join(desktop,'out')).sha256;
const hash=value=>createHash('sha256').update(value).digest('hex');
const packageVersions=Object.fromEntries(Object.keys({...JSON.parse(fs.readFileSync(path.join(desktop,'package.json'))).dependencies,...JSON.parse(fs.readFileSync(path.join(desktop,'package.json'))).devDependencies}).sort().map(name=>{try{return [name,JSON.parse(fs.readFileSync(path.join(desktop,'node_modules',name,'package.json'))).version];}catch{return [name,'unavailable'];}}));
const probeSources=['scripts/audit/performance-history.mjs','scripts/audit/performance-contract.mjs','scripts/acceptance/evidence.mjs','scripts/acceptance/build-root.mjs'].map(file=>({file,sha256:hash(fs.readFileSync(path.join(desktop,file)))}));
const signature={os:os.release(),arch:os.arch(),cpu:os.cpus()[0]?.model,cores:os.cpus().length,node:process.version,electron:JSON.parse(fs.readFileSync(path.join(desktop,'node_modules/electron/package.json'))).version};
const report={schema:'xiaozhi.audit-performance.v1',ok:false,machine:{...signature,signature:createHash('sha256').update(JSON.stringify(signature)).digest('hex'),totalMemory:os.totalmem()},
  source:execFileSync('git',['rev-parse','HEAD'],{cwd:desktop,encoding:'utf8'}).trim(),build:mainBuild,probeSources,scriptSha256:hash(JSON.stringify(probeSources)),
  conditions:{lockSha256:hash(fs.readFileSync(path.join(desktop,'package-lock.json'))),packageVersions,powerPlan:process.platform==='win32'?execFileSync('powercfg',['/getactivescheme'],{encoding:'utf8',windowsHide:true}).trim():'not-Windows',instrumentation:3,probeEnabled},
  workload:{schema:1,rounds:[10,100,1000],viewports:[[1366,768],[1920,1080]],repetitions:5,historyPageLimit:40,synthetic:true,modelRequests:0,visible:true},scenarios:[],errors:[],launches:[],
  limits:['Persisted synthetic Pi history and actual typed IPC/UI; no model execution','Initial history page only; full loaded-turn streaming/Skill/GPU/provider budgets remain separate matrix items','React DevTools root commits are counters, not component Profiler render-duration evidence','SQL counts include probe overhead and shared prototype calls; do not compare with uninstrumented runs','openMs is warm navigation plus two rAF; inputMs is Playwright fill plus frame, not native event latency; snapshotMs is an additional typed read','Five sequential warm samples: p95 is the maximum, budgets are candidate 25%/10ms limits awaiting hardware calibration; diagnostic trace is separate']};
let app,page,empty;const sessions={};
const save=()=>fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
function env(){const value={...process.env,NODE_ENV:'development',OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_E2E_VISIBLE:'1'};for(const key of Object.keys(value))if(key.startsWith('OMNI_EDU_E2E_')&&!['OMNI_EDU_E2E_DIALOG_MODE','OMNI_EDU_E2E_VISIBLE'].includes(key))delete value[key];for(const key of ['ELECTRON_RUN_AS_NODE','NODE_OPTIONS','ELECTRON_RENDERER_URL','DEEPSEEK_API_KEY','DEEPSEEK_MODEL'])delete value[key];return value;}
async function ready(){await page.getByTestId('office-prompt-input').waitFor();await page.waitForFunction(()=>!document.querySelector('[data-testid=office-prompt-input]')?.disabled);}
async function launch(){
  const start=performance.now();app=await electron.launch({args:[main,'--user-data-dir='+profile,'--force-device-scale-factor=1'],cwd:desktop,env:env(),timeout:60000});
  report.launches.push({ms:performance.now()-start,...await assertIsolatedPiMain(app,main,profile)});
  page=await app.firstWindow();page.on('pageerror',error=>report.errors.push(String(error)));
  await app.evaluate(({BrowserWindow})=>{const window=BrowserWindow.getAllWindows()[0];window.show();window.focus();});
  await ready();
}
async function closeOwned(){
  if(!app)return;
  const owned=app,child=owned.process(),pid=child.pid;
  await owned.close();
  const deadline=Date.now()+10000;
  while(child.exitCode===null&&Date.now()<deadline)await new Promise(resolve=>setTimeout(resolve,50));
  assert.equal(child.exitCode,0,'Owned Electron must exit cleanly before external SQLite seed');app=undefined;
  (report.closedProcesses||=[]).push({pid,exitCode:child.exitCode});
}
async function probes(){
  await app.evaluate(async ({ipcMain},packagePath)=>{
    const perf=process.getBuiltinModule('perf_hooks'),module=process.getBuiltinModule('module');
    const sqlite=module.createRequire(packagePath)('sqlite3');
    const state=globalThis.auditProbe={ipc:{},sql:{},delay:perf.monitorEventLoopDelay({resolution:10})};state.delay.enable();
    for(const [channel,original] of [...ipcMain._invokeHandlers].filter(([channel])=>/^(xiaozhi:|aiConversations:)/.test(channel))) {
      ipcMain.removeHandler(channel);ipcMain.handle(channel,async(event,...args)=>{const start=performance.now();try{const result=await original(event,...args);const item=state.ipc[channel]||={calls:0,ms:[]};item.calls++;if(item.ms.length<10000)item.ms.push(performance.now()-start);return result;}catch(error){(state.ipc[channel]||={calls:0,ms:[]}).errors=((state.ipc[channel]?.errors)||0)+1;throw error;}});
    }
    for(const method of ['all','get','run','exec']){
      const original=sqlite.Database.prototype[method];
      sqlite.Database.prototype[method]=function(...args){state.sql[method]=(state.sql[method]||0)+1;return original.apply(this,args);};
    }
  },path.join(desktop,'package.json'));
  await page.addInitScript(()=>{
    const probe=globalThis.auditRenderer={commits:0,hookInjected:0,longTasks:[]};
    globalThis.__REACT_DEVTOOLS_GLOBAL_HOOK__={supportsFiber:true,inject:()=>{probe.hookInjected++;return 1;},onCommitFiberRoot:()=>{probe.commits++;},onCommitFiberUnmount:()=>{}};
    new PerformanceObserver(list=>{for(const item of list.getEntries())if(probe.longTasks.length<10000)probe.longTasks.push(item.duration);}).observe({type:'longtask',buffered:true});
  });
  await page.reload();await ready();
  assert(await page.evaluate(()=>globalThis.auditRenderer.hookInjected>0&&globalThis.auditRenderer.commits>0),'React commit instrumentation must actually attach');
}
function seed(){
  const db=new DatabaseSync(path.join(data,'app.db'));db.exec('BEGIN IMMEDIATE');
  try{
    const insertSession=db.prepare('INSERT INTO ai_conversation_sessions(id,title,folder_id,student_id,created_at,updated_at,archived_at,message_count,last_prompt,last_response_preview) VALUES(?,?,NULL,NULL,?,?,NULL,?,?,?)');
    const insertRun=db.prepare("INSERT INTO ai_agent_runs(id,parent_run_id,session_id,prompt,route,sub_intent,status,model,student_id,error_message,created_at,completed_at,updated_at) VALUES(?,'',?,?,'education','pi_education','completed','owned-fixture','','',?,?,?)");
    const insertMessage=db.prepare('INSERT INTO ai_conversation_messages(id,session_id,role,content,metadata_json,created_at) VALUES(?,?,?,?,?,?)');
    for(const count of report.workload.rounds){
      const id=sessions[count]='aisession_'+randomUUID(),base=Date.parse('2026-01-01');const time=index=>new Date(base+index*1000).toISOString();
      insertSession.run(id,'审计合成 '+count+'轮',time(0),time(count*2+1),count*2,'合成课堂问题','合成课堂答复');
      for(let index=1;index<=count;index++){
        const run='xirun_'+randomUUID(),text=`合成第${index}轮 / 总${count}轮：$x+2=5$。教师应核对来源；本记录只用于性能测量。\n\n${index===count?'末轮边界标记':'历史边界标记'}`;
        insertRun.run(run,id,'合成测量',time(index*2-1),time(index*2),time(index*2));
        insertMessage.run('aimsg_'+randomUUID(),id,'user','合成测量问题 '+index,JSON.stringify({agentRunId:run,piVersion:'xiaozhi.pi.education.v1'}),time(index*2-1));
        insertMessage.run('aimsg_'+randomUUID(),id,'assistant',text,JSON.stringify({agentRunId:run,piVersion:'xiaozhi.pi.education.v1',ok:true,status:'completed',publicItems:[{id:run+':assistant',kind:'message',role:'assistant',phase:'final_answer',text}]}),time(index*2));
      }
    }db.exec('COMMIT');
  }catch(error){db.exec('ROLLBACK');throw error;}finally{db.close();}
}
async function select(id){
  await page.bringToFront();assert.equal(await page.evaluate(()=>document.visibilityState),'visible','Do not benchmark throttled hidden animation frames');
  if(await page.getByTestId('pi-sidebar-toggle').getAttribute('aria-expanded')!=='true')await page.getByTestId('pi-sidebar-toggle').click();
  await page.getByTestId('ai-conversation-session-'+id).click();
  await page.waitForFunction(target=>document.querySelector('.office-composer-container')?.getAttribute('data-session-id')===target,id);
  await ready();await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))));
}
async function trace(cdp,name,action){
  await cdp.send('Tracing.start',{categories:'devtools.timeline,v8,blink.user_timing,disabled-by-default-devtools.timeline.frame',transferMode:'ReturnAsStream'});
  let value;try{value=await action();}finally{
    const complete=new Promise(resolve=>cdp.once('Tracing.tracingComplete',resolve));await cdp.send('Tracing.end');const {stream}=await complete;
    const target=path.join(output,name+'.trace.json'),fd=fs.openSync(target,'w');let bytes=0;
    try{for(;;){const chunk=await cdp.send('IO.read',{handle:stream,size:1048576});const data=Buffer.from(chunk.data,chunk.base64Encoded?'base64':'utf8');bytes+=data.length;assert(bytes<=128*1024*1024,'Bounded trace budget');fs.writeSync(fd,data);if(chunk.eof)break;}}finally{fs.closeSync(fd);await cdp.send('IO.close',{handle:stream});}
  }return value;
}
try{
  await launch();empty=await page.locator('.office-composer-container').getAttribute('data-session-id');await closeOwned();seed();
  await launch();if(probeEnabled)await probes();
  report.conditions.electron=serializableConditions(await app.evaluate(async({app,screen})=>{const info=await app.getGPUInfo('basic');return {gpuDevices:info.gpuDevice,driverVersion:info.auxAttributes?.driverVersion??null,displays:screen.getAllDisplays().map(({size,scaleFactor,rotation})=>({size,scaleFactor,rotation}))};}));
  for(const [width,height] of report.workload.viewports){
    await app.evaluate(({BrowserWindow},size)=>BrowserWindow.getAllWindows()[0].setContentSize(size.width,size.height),{width,height});
    await page.waitForFunction(size=>innerWidth===size.width&&innerHeight===size.height,{width,height});
    for(const count of report.workload.rounds){
      const scenario={key:count+'-'+width+'x'+height,samples:[]};report.scenarios.push(scenario);
      const cdp=await page.context().newCDPSession(page);if(probeEnabled)await cdp.send('Performance.enable');
      {
        for(let sample=0;sample<5;sample++){
          await select(empty);if(probeEnabled){await app.evaluate(()=>{globalThis.auditProbe.ipc={};globalThis.auditProbe.sql={};globalThis.auditProbe.delay.reset();});
          await page.evaluate(()=>{globalThis.auditRenderer.commits=0;globalThis.auditRenderer.longTasks=[];});}
          const start=performance.now();await select(sessions[count]);const openMs=performance.now()-start;
          const snapshotStart=performance.now();const view=await page.evaluate(id=>window.omniEdu.getXiaozhiSnapshot(id),sessions[count]);const snapshotMs=performance.now()-snapshotStart;
          assert.equal(view.projection.turns.length,Math.min(count,40));assert.equal(Boolean(view.projection.hasMoreHistory),count>40);
          await page.getByText('末轮边界标记',{exact:false}).last().waitFor();
          const input=page.getByTestId('office-prompt-input'),inputStart=performance.now();await input.fill('审计输入响应 '+sample);await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(resolve)));const inputMs=performance.now()-inputStart;await input.fill('');
          const renderer=await page.evaluate(()=>({...globalThis.auditRenderer,nodes:document.querySelectorAll('*').length,dpr:devicePixelRatio}));
          if(probeEnabled)assert(renderer.commits>0,'Measured navigation must produce observable commits');
          const mainMetrics=await app.evaluate(({app})=>({ipc:globalThis.auditProbe?.ipc??null,sql:globalThis.auditProbe?.sql??null,eventLoopP95Ms:globalThis.auditProbe?.delay.percentile(95)/1e6||null,memory:process.memoryUsage(),processes:app.getAppMetrics().map(item=>({type:item.type,memory:item.memory,cpu:item.cpu.percentCPUUsage}))}));
          scenario.samples.push({openMs,snapshotMs,inputMs,snapshotBytes:Buffer.byteLength(JSON.stringify(view)),turns:view.projection.turns.length,renderer,main:mainMetrics,chromium:probeEnabled?(await cdp.send('Performance.getMetrics')).metrics:null});save();
        }
      }
      // Trace is a diagnostic sixth replay; never mixed into the five timing samples.
      scenario.diagnosticTrace=await trace(cdp,scenario.key,async()=>{await select(empty);const start=performance.now();await select(sessions[count]);return {openMs:performance.now()-start,comparableToSamples:false};});
      for(const metric of ['openMs','snapshotMs','inputMs'])scenario[metric]=statistics(scenario.samples.map(item=>item[metric]));
      await cdp.detach();console.log(JSON.stringify({scenario:scenario.key,open:scenario.openMs,snapshot:scenario.snapshotMs,input:scenario.inputMs}));save();
    }
  }
  assert.deepEqual(report.errors,[]);assert.equal(fingerprint(path.join(desktop,'out')).sha256,mainBuild,'Build changed during samples');report.ok=true;
  if(baselineArg){report.comparison=compareReports(JSON.parse(fs.readFileSync(baselineArg.slice('--baseline='.length),'utf8')),report);assert(report.comparison.ok,'Quantitative performance regression');}
}catch(error){report.ok=false;report.error=String(error.stack||error);process.exitCode=1;}
finally{try{await closeOwned();}catch(error){report.ok=false;report.closeError=String(error);process.exitCode=1;}finally{save();console.log(JSON.stringify({ok:report.ok,report:path.join(output,'report.json'),error:report.error}));}}
