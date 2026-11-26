import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {_electron as electron} from 'playwright';

const [build, acceptance]=process.argv.slice(2);
assert(path.isAbsolute(build??'')&&path.isAbsolute(acceptance??''));
const main=fs.realpathSync(path.join(build,'main/index.js'));
const root=fs.mkdtempSync(path.join(fs.realpathSync(acceptance),'provider-pdf-lifecycle-'));
const data=path.join(root,'data');
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const report={root,main,mainHash:sha(main),rendererHash:sha(path.join(build,'renderer/index.html')),cycles:[],ok:false};
const source=(prefix,name)=>{
  const entries=fs.readdirSync(path.dirname(main)).filter(entry=>entry.startsWith(prefix)&&entry.endsWith('.js'));
  assert.equal(entries.length,1,'Find exactly one built module for '+name);
  const file=path.join(path.dirname(main),entries[0]);
  assert(fs.readFileSync(file,'utf8').includes('function '+name+'('));
  return file;
};
let app;
try{
  const budget=source('office-pdf-budget-','withOfficePdfBudget');
  const renderer=source('office-pdf-renderer-','withStaticOfficePage');
  const env=Object.fromEntries(Object.entries(process.env).filter(([key])=>
    !/KEY|TOKEN|SECRET|PASSWORD|CREDENTIAL|NODE_OPTIONS|ELECTRON_RUN_AS_NODE|ELECTRON_RENDERER_URL/iu.test(key)));
  Object.assign(env,{OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_XIAOZHI_PI:'1',OMNI_EDU_DATA_ROOT:data,
    OMNI_EDU_REPO_ROOT:path.resolve(import.meta.dirname,'../../../..')});
  app=await electron.launch({args:[main,'--user-data-dir='+path.join(root,'profile')],env,timeout:60_000});
  const page=await app.firstWindow();
  await page.getByTestId('office-prompt-input').waitFor();
  report.runtime=await app.evaluate(async ({app,BrowserWindow,webContents},{budget,renderer,data})=>{
    const load=process.getBuiltinModule('node:module').createRequire(renderer);
    const {withOfficePdfBudget}=load(budget),{withStaticOfficePage}=load(renderer);
    const fs=process.getBuiltinModule('node:fs'),path=process.getBuiltinModule('node:path');
    const resourceCounts=()=>({
      windows:BrowserWindow.getAllWindows().map(window=>window.id).sort(),
      contents:webContents.getAllWebContents().map(contents=>contents.id).sort(),
      windowListeners:app.listenerCount('web-contents-created'),
      temporary:fs.readdirSync(data).filter(name=>name.startsWith('office-render-')).sort(),
    });
    const probe=async()=>{
      try{return await withOfficePdfBudget(undefined,250,async()=> 'admitted');}
      catch(error){return error.message;}
    };
    const lifecycle=globalThis.providerPdfLifecycle={resourceCounts,probe,pending:null};
    lifecycle.start=()=>{
      const controller=new AbortController();
      const operation={controller,trace:{closed:false},unblock:null};
      lifecycle.pending=operation;
      operation.done=withOfficePdfBudget(controller.signal,12_000,remaining=>
        withStaticOfficePage('<!doctype html><p>Owned PDF lifecycle fixture</p>',{dataRoot:data,signal:controller.signal,deadlineMs:remaining},
          async ({Window,htmlPath})=>{
            const win=new Window({show:false,webPreferences:{javascript:false}});
            const contents=win.webContents;
            win.once('closed',()=>{operation.trace.closed=true;});
            await win.loadFile(htmlPath);
            Object.assign(operation.trace,{id:contents.id,pid:contents.getOSProcessId(),stage:path.dirname(htmlPath)});
            await contents.printToPDF({});
          })).then(()=> 'unexpected success',error=>error.message);
    };
    const holdRealPrint=(_,contents)=>{
      const native=contents.printToPDF.bind(contents),operation=lifecycle.pending;
      if(!operation)return;
      contents.printToPDF=async options=>{
        const bytes=await native(options);
        if(!contents.getURL().includes('/office-render-'))return bytes;
        await new Promise(resolve=>{
          operation.unblock=resolve;
          operation.trace.bytes=bytes.length;
        });
        return bytes;
      };
    };
    app.on('web-contents-created',holdRealPrint);
    lifecycle.unhook=()=>app.off('web-contents-created',holdRealPrint);
    return {platform:process.platform,electron:process.versions.electron,mainPid:process.pid,before:resourceCounts()};
  },{budget,renderer,data});
  assert.equal(report.runtime.platform,'win32');
  for(let ordinal=1;ordinal<=10;ordinal++){
    const cycle={ordinal};
    report.cycles.push(cycle);
    await app.evaluate(()=>globalThis.providerPdfLifecycle.start());
    for(let attempt=0;attempt<160;attempt++){
      cycle.created=await app.evaluate(()=>globalThis.providerPdfLifecycle.pending.trace);
      if(cycle.created.bytes)break;
      await new Promise(resolve=>setTimeout(resolve,50));
    }
    assert(cycle.created.bytes>1000&&cycle.created.pid>0&&cycle.created.id>0);
    assert(!cycle.created.closed&&fs.existsSync(cycle.created.stage));
    assert(!report.cycles.slice(0,-1).some(prior=>prior.created.id===cycle.created.id||prior.created.stage===cycle.created.stage));
    cycle.whileStopped=await app.evaluate(async()=>{
      const lifecycle=globalThis.providerPdfLifecycle;
      lifecycle.pending.controller.abort();
      return {probe:await lifecycle.probe(),trace:lifecycle.pending.trace};
    });
    assert.equal(cycle.whileStopped.probe,'timeout');
    assert.equal(cycle.whileStopped.trace.closed,false);
    assert(fs.existsSync(cycle.created.stage));
    if(ordinal===10){
      cycle.independent=await page.evaluate(async()=> (await window.omniEdu.createAiConversationSession({
        title:'并行教师操作',folderId:null
      })).session.id);
      assert.match(cycle.independent,/^aisession_/u);
      cycle.heldAfterOther=await app.evaluate(()=>globalThis.providerPdfLifecycle.probe());
      assert.equal(cycle.heldAfterOther,'timeout');
    }
    cycle.settlement=await app.evaluate(async()=>{
      const lifecycle=globalThis.providerPdfLifecycle;
      lifecycle.pending.unblock();
      const outcome=await lifecycle.pending.done;
      return {outcome,trace:lifecycle.pending.trace,probe:await lifecycle.probe(),resources:lifecycle.resourceCounts()};
    });
    assert.equal(cycle.settlement.outcome,'cancelled');
    assert(cycle.settlement.trace.closed);
    assert(!fs.existsSync(cycle.created.stage));
    assert.equal(cycle.settlement.probe,'admitted');
    assert.deepEqual(cycle.settlement.resources,report.runtime.before);
  }
  report.after=await app.evaluate(()=>{
    const lifecycle=globalThis.providerPdfLifecycle;
    lifecycle.unhook();
    return lifecycle.resourceCounts();
  });
  assert.equal(report.after.windowListeners,report.runtime.before.windowListeners-1);
  report.ok=true;
}catch(error){
  report.error=String(error.stack??error);
  process.exitCode=1;
}finally{
  if(app){
    await app.evaluate(()=>globalThis.providerPdfLifecycle?.pending?.unblock?.()).catch(()=>{});
    await app.close().catch(()=>{});
  }
  report.windowPids=report.cycles.map(cycle=>cycle.created?.pid).filter(Boolean);
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify({ok:report.ok,root,cycles:report.cycles.length,error:report.error?.split('\n')[0]}));
}
