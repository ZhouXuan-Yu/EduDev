import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'../..');
const [fixture,output]=process.argv.slice(2);
assert(path.isAbsolute(fixture)&&path.isAbsolute(output));
const root=fs.mkdtempSync(path.join(fs.realpathSync(output),'r1-queue-ui-'));
const main=testMain(desktop),mainDirectory=path.dirname(main);
const sourceFiles=fs.readdirSync(mainDirectory).filter(name=>name.endsWith('.js'));
const ownerFile=sourceFiles.map(name=>path.join(mainDirectory,name))
  .find(file=>fs.readFileSync(file,'utf8').includes('function reserveHostStage('));
assert(ownerFile);
const exportName=fs.readFileSync(ownerFile,'utf8').match(/\breserveHostStage as (\w+)/u)?.[1];
assert(exportName);
const profile=path.join(root,'profile'),data=path.join(root,'data');
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
  OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_XIAOZHI_PI:'1'};
for(const key of ['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS','DEEPSEEK_API_KEY'])delete env[key];
const report={success:false,root,checks:[],mainSha:sha(main),sourceSha:sha(fixture),paidCalls:0};
function sha(file){return createHash('sha256').update(fs.readFileSync(file)).digest('hex');}
const app=await _electron.launch({args:[main,'--user-data-dir='+profile],cwd:root,env,timeout:60000});
try{
  await assertIsolatedPiMain(app,main,profile);
  const page=await app.firstWindow();
  await page.locator('[data-testid="nav-knowledge"]:visible').click();
  await app.evaluate(async(_electron,args)=>{
    const req=process.getBuiltinModule('node:module').createRequire(args.ownerFile);
    const reserve=req(args.ownerFile)[args.exportName];
    const lease=await reserve('acceptance-barrier','owned-slots','foreground',{processes:7},30000);
    if(!lease.start())throw Error('acceptance barrier did not start');
    globalThis.releaseHostResourceBarrier=()=>lease.settle();
  },{ownerFile,exportName});
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},fixture);
  await page.getByTestId('materials-import').click();
  await page.waitForFunction(async()=>{
    const queue=await window.omniEdu.getMaterialQueue();
    return queue.tasks.some(task=>task.resourceState==='waiting_resources');
  },null,{timeout:30000});
  const queueToggle=page.getByTestId('materials-queue-toggle');
  if(await queueToggle.getAttribute('aria-expanded')!=='true')await queueToggle.click();
  await page.getByTestId('materials-queue').getByText('等待本机资源',{exact:true}).waitFor();
  await page.screenshot({path:path.join(root,'waiting-resources.png')});
  report.checks.push('Visible material list exposes the actual queued resource state');
  await page.getByTestId('materials-stop').click();
  await page.getByTestId('materials-queue').getByText('已停止',{exact:true}).waitFor();
  await app.evaluate(()=>globalThis.releaseHostResourceBarrier());
  const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
  try{
    assert.equal(db.prepare("SELECT COUNT(*) n FROM ai_tasks WHERE task_type='resource_parse' AND status='cancelled'").get().n,1);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM material_pdf_pages').get().n,0);
    assert.equal(db.prepare('SELECT content_hash FROM teacher_resources').get().content_hash,report.sourceSha);
  }finally{db.close();}
  report.checks.push('Cancelling real queued work leaves the original intact and starts no page');

  await app.evaluate(()=>{
    const cp=process.getBuiltinModule('node:child_process'),original=cp.spawn;
    const modules=process.getBuiltinModule('node:module');
    cp.spawn=function(...args){
      const child=original.apply(this,args);
      if(!String(args[0]).endsWith('omni-edu-ocr.exe'))return child;
      // This is a real process. Delay only its first termination request so the
      // renderer has to distinguish cancellation from actual child closure.
      cp.spawn=original;
      modules.syncBuiltinESMExports();
      const kill=child.kill.bind(child);
      const timer=setTimeout(()=>kill(),20000);
      const trace={pid:child.pid,closed:false,killRequested:false};
      globalThis.heldOcrTrace=trace;
      globalThis.releaseHeldOcr=()=>{if(!trace.closed)kill();};
      child.kill=()=>{trace.killRequested=true;return true;};
      child.once('close',()=>{clearTimeout(timer);trace.closed=true;});
      return child;
    };
    modules.syncBuiltinESMExports();
  });
  await page.evaluate(async()=>{
    const queue=await window.omniEdu.getMaterialQueue();
    const task=queue.tasks.find(item=>item.status==='cancelled');
    if(!task)throw Error('Missing cancelled source task');
    await window.omniEdu.controlMaterialTask({schemaVersion:queue.schemaVersion,resourceId:task.resourceId,version:task.version,action:'retry'});
  });
  const until=async check=>{
    for(let i=0;i<250;i++){if(await check())return;await new Promise(resolve=>setTimeout(resolve,100));}
    throw Error('Real OCR lifecycle did not reach the expected state');
  };
  await until(()=>app.evaluate(()=>!!globalThis.heldOcrTrace?.pid));
  await page.getByTestId('materials-stop').click();
  await page.getByTestId('materials-queue').getByText('正在停止',{exact:true}).waitFor();
  const before=await app.evaluate(()=>globalThis.heldOcrTrace);
  assert.equal(before.killRequested,true);
  assert.equal(before.closed,false);
  await page.screenshot({path:path.join(root,'stopping.png')});
  await app.evaluate(()=>globalThis.releaseHeldOcr());
  await until(()=>app.evaluate(()=>globalThis.heldOcrTrace.closed));
  await page.getByTestId('materials-queue').getByText('已停止',{exact:true}).waitFor();
  report.ocr={before,after:await app.evaluate(()=>globalThis.heldOcrTrace)};
  report.checks.push('Visible stop-request state precedes confirmed close of the real OCR child');
  report.success=true;
}catch(error){
  report.error=String(error.stack??error);
  process.exitCode=1;
}finally{
  await app.evaluate(()=>globalThis.releaseHostResourceBarrier?.()).catch(()=>{});
  await app.evaluate(()=>globalThis.releaseHeldOcr?.()).catch(()=>{});
  await app.close();
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify(report));
}
