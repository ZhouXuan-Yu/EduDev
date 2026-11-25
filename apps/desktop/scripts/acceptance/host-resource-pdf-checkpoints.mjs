import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {_electron} from 'playwright';
import {assertIsolatedPiMain,testMain} from './build-root.mjs';

const desktop=path.resolve(import.meta.dirname,'../..');
const [fixture,evidence]=process.argv.slice(2);
assert(path.isAbsolute(fixture)&&path.isAbsolute(evidence));
const root=fs.mkdtempSync(path.join(fs.realpathSync(evidence),'r1-pdf-checkpoint-'));
const main=testMain(desktop),profile=path.join(root,'profile'),data=path.join(root,'data');
const ownerFile=fs.readdirSync(path.dirname(main)).filter(name=>name.endsWith('.js')).map(name=>path.join(path.dirname(main),name))
  .find(file=>fs.readFileSync(file,'utf8').includes('function reserveHostStage('));
const reserveExport=fs.readFileSync(ownerFile,'utf8').match(/\breserveHostStage as (\w+)/u)?.[1];
assert(reserveExport);
const sha=file=>createHash('sha256').update(fs.readFileSync(file)).digest('hex');
const source=sha(fixture),dbFile=path.join(data,'app.db');
const report={success:false,root,mainSha:sha(main),source,checks:[],faults:{},paidCalls:0};
const env={...process.env,OMNI_EDU_DATA_ROOT:data,OMNI_EDU_REPO_ROOT:path.resolve(desktop,'../..'),
  OMNI_EDU_SKIP_DOTENV:'1',OMNI_EDU_E2E_DIALOG_MODE:'1',OMNI_EDU_XIAOZHI_PI:'1'};
for(const key of ['ELECTRON_RUN_AS_NODE','ELECTRON_RENDERER_URL','NODE_OPTIONS','DEEPSEEK_API_KEY'])delete env[key];

let app,page,resourceId;
const until=async(name,read,ms=60000)=>{
  for(const deadline=Date.now()+ms;Date.now()<deadline;){
    const value=await read();if(value)return value;
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  throw Error('Timed out waiting for '+name);
};
function snapshot(){
  const db=new DatabaseSync(dbFile,{readOnly:true});
  try{
    const resource=db.prepare('SELECT id,content_hash FROM teacher_resources WHERE original_file_name=?').get(path.basename(fixture));
    if(!resource)return {};
    resourceId=resource.id;
    const task=db.prepare("SELECT id,status,payload_json FROM ai_tasks WHERE task_type='resource_parse' AND json_extract(payload_json,'$.resourceId')=?").get(resource.id);
    const job=db.prepare('SELECT generation,version,worker,total,state,owner_pid FROM material_pdf_jobs WHERE resource_id=?').get(resource.id);
    const pages=job?db.prepare('SELECT page,status,attempts,result_json FROM material_pdf_pages WHERE generation=? ORDER BY page').all(job.generation).map(({result_json,...row})=>({
      ...row,hasText:result_json?Boolean(JSON.parse(result_json).text?.trim()):false,
      digest:result_json?createHash('sha256').update(result_json).digest('hex'):null,
    })):[];
    return {source:resource.content_hash,task:task&&{id:task.id,status:task.status,attempt:JSON.parse(task.payload_json).attempt},job,pages};
  }finally{db.close();}
}
async function launch(){
  app=await _electron.launch({args:[main,'--user-data-dir='+profile],cwd:root,env,timeout:60000});
  await assertIsolatedPiMain(app,main,profile);
  page=await app.firstWindow();
  await page.locator('[data-testid="nav-knowledge"]:visible').click();
}
async function capture(mode,pageNumber){
  await app.evaluate((_electron,args)=>{
    const cp=process.getBuiltinModule('node:child_process'),modules=process.getBuiltinModule('node:module'),spawn=cp.spawn;
    const trace={mode:args.mode,started:false,error:false,killRequested:false,closed:false};
    globalThis.pdfTrace=trace;
    cp.spawn=function(...parameters){
      if(!String(parameters[0]).endsWith('omni-edu-ocr.exe'))return spawn.apply(this,parameters);
      cp.spawn=spawn;modules.syncBuiltinESMExports();
      if(args.mode==='spawn-throw'){trace.error=true;throw Error('Controlled startup failure');}
      const child=spawn.apply(this,parameters),kill=child.kill.bind(child),write=child.stdin.write.bind(child.stdin);
      trace.pid=child.pid;
      child.once('spawn',()=>{trace.started=true;});
      child.once('error',()=>{trace.error=true;});
      const fallback=setTimeout(()=>kill(),args.mode==='error-held'?50000:120000);
      child.once('close',(code,signal)=>{clearTimeout(fallback);trace.closed=true;trace.code=code;trace.signal=signal;});
      globalThis.releasePdfChild=()=>kill();
      if(args.mode==='error-held')child.kill=()=>{trace.killRequested=true;return true;};
      child.stdin.write=(raw,...rest)=>{
        let value;try{value=JSON.parse(raw.toString());}catch{return write(raw,...rest);}
        if(value.operation){trace.operation=value.operation;if(value.operation==='parse')trace.skipPages=value.skipPages;}
        if(value.ack===true&&value.page===args.pageNumber){
          trace.afterPage=value.page;
          if(args.mode==='error-held'){queueMicrotask(()=>child.emit('error',Error('Controlled running process error')));return true;}
          if(args.mode==='terminate'){queueMicrotask(()=>kill());return true;}
        }
        return write(raw,...rest);
      };
      return child;
    };
    modules.syncBuiltinESMExports();
  },{mode,pageNumber});
}
async function trace(){
  for(let attempt=0;;attempt++){
    try{return JSON.parse(await app.evaluate(()=>JSON.stringify(globalThis.pdfTrace)));}
    catch(error){
      if(attempt===2||!String(error).includes('Resulting promise was garbage collected'))throw error;
      await new Promise(resolve=>setTimeout(resolve,100));
    }
  }
}
const retry=()=>page.evaluate(async id=>{
  const queue=await window.omniEdu.getMaterialQueue(id);
  const task=queue.tasks.find(item=>item.resourceId===id);
  if(!task)throw Error('Missing original task');
  await window.omniEdu.controlMaterialTask({schemaVersion:queue.schemaVersion,resourceId:id,version:task.version,action:'retry'});
},resourceId);
const settledFailure=()=>{const s=snapshot();return s.task?.status==='failed'&&s.job?.owner_pid===0&&s;};

try{
  await launch();await capture('spawn-throw');
  await app.evaluate(({dialog},file)=>{dialog.showOpenDialog=async()=>({canceled:false,filePaths:[file]});},fixture);
  await page.getByTestId('materials-import').click();
  const failed=await until('startup failure',settledFailure);
  report.faults.startup={trace:await trace(),snapshot:failed};
  assert.equal(report.faults.startup.trace.error,true);
  assert.equal(report.faults.startup.trace.started,false);
  assert.deepEqual(failed.pages,[]);
  assert.equal(failed.source,source);
  report.checks.push('A synchronous worker spawn failure produces no PID or page and clears the owner');

  await capture('error-held',1);await retry();
  const held=await until('error while the worker is alive',async()=>{const t=await trace();return t.killRequested&&t;});
  assert(held.started&&held.error&&!held.closed&&held.pid>0);
  const heldSnapshot=snapshot();assert.equal(heldSnapshot.task.status,'running');
  assert.equal(heldSnapshot.pages[0].status,'complete');
  const probe=await app.evaluate(async(_electron,args)=>{
    const reserve=process.getBuiltinModule('node:module').createRequire(args.ownerFile)(args.ownerFile)[args.reserveExport];
    try{const lease=await reserve('checkpoint-probe','physical-capacity','foreground',{processes:8},200);lease.settle();return 'admitted';}
    catch(error){return error.message;}
  },{ownerFile,reserveExport});
  assert.equal(probe,'timeout');
  await app.evaluate(()=>globalThis.releasePdfChild());
  const afterError=await until('worker close and failure',settledFailure);
  report.faults.runtimeError={before:held,after:await trace(),beforeClose:heldSnapshot,afterClose:afterError,probe};
  assert(report.faults.runtimeError.after.closed);
  assert.deepEqual(afterError.pages[0],heldSnapshot.pages[0]);
  report.checks.push('A real running worker error holds physical capacity until its actual close and preserves the committed first page');

  await capture('terminate',2);await retry();
  const interrupted=await until('second page and actual termination',settledFailure);
  const stopped=await trace();
  report.faults.termination={trace:stopped,snapshot:interrupted};
  assert(stopped.closed&&stopped.afterPage===2);
  assert.deepEqual(stopped.skipPages,[1]);
  assert.deepEqual(interrupted.pages.map(p=>p.page),[1,2]);
  assert(interrupted.pages.every(p=>p.status==='complete'&&p.attempts===1&&p.hasText));
  report.checks.push('A terminated native worker skips the first checkpoint, then preserves its newly committed second page');

  await app.close();app=undefined;await launch();
  await capture('observe');await retry();
  const completed=await until('six pages after restart',()=>{const s=snapshot();return s.job?.state==='complete'&&s.job.owner_pid===0&&s;},90000);
  report.resume={snapshot:completed,trace:await trace()};
  assert.deepEqual(report.resume.trace.skipPages,[1,2]);
  assert.equal(completed.task.id,failed.task.id);
  assert.equal(completed.job.generation,interrupted.job.generation);
  assert.equal(completed.job.worker,interrupted.job.worker);
  assert.equal(completed.job.version,source);
  assert.deepEqual(completed.pages.map(p=>p.page),[1,2,3,4,5,6]);
  assert.deepEqual(completed.pages.slice(0,2),interrupted.pages);
  assert(completed.pages.every(p=>p.status==='complete'&&p.attempts===1&&p.hasText));
  report.checks.push('A cold retry uses the same task and matching source plus worker generation, completing six unique pages');

  await app.close();app=undefined;
  // Change an isolated old checkpoint, leaving its source file and page receipts intact.
  const db=new DatabaseSync(dbFile);
  try{
    assert.equal(db.prepare("UPDATE material_pdf_jobs SET worker=?,state='complete' WHERE resource_id=?").run('0'.repeat(64),resourceId).changes,1);
    assert.equal(db.prepare("UPDATE material_structure_jobs SET status='interrupted' WHERE resource_id=?").run(resourceId).changes,1);
  }finally{db.close();}
  await launch();await capture('observe');await retry();
  const replacement=await until('fresh native request for incompatible checkpoint',async()=>{
    const t=await trace(),s=snapshot();
    if(t.operation&&t.operation!=='parse'&&s.job?.generation===completed.job.generation)
      throw Error('Structure processing began with an incompatible PDF worker checkpoint');
    if(s.task?.attempt>completed.task.attempt&&s.task.status==='succeeded'&&s.job?.generation===completed.job.generation)
      throw Error('An old worker generation was accepted by the structure fast path');
    return t.skipPages&&{trace:t,snapshot:s};
  },25000);
  report.replacement=replacement;
  assert.deepEqual(replacement.trace.skipPages,[]);
  assert.notEqual(replacement.snapshot.job.generation,completed.job.generation);
  assert.equal(replacement.snapshot.job.worker,completed.job.worker);
  assert.equal(replacement.snapshot.job.version,source);
  const rebuilt=await until('all pages from the fresh generation',()=>{
    const s=snapshot();return s.job?.generation===replacement.snapshot.job.generation&&s.job.state==='complete'&&s.job.owner_pid===0&&s;
  },90000);
  report.rebuilt=rebuilt;
  assert.deepEqual(rebuilt.pages.map(p=>p.page),[1,2,3,4,5,6]);
  assert(rebuilt.pages.every(p=>p.status==='complete'&&p.attempts===1&&p.hasText));
  report.checks.push('A mismatched worker generation is replaced before any old checkpoint can be reused');
  report.success=true;
}catch(error){
  report.error=String(error.stack??error);process.exitCode=1;
  if(fs.existsSync(dbFile))report.final=snapshot();
  if(app)report.finalTrace=await trace().catch(()=>undefined);
}finally{
  if(app){
    await app.evaluate(()=>globalThis.releasePdfChild?.()).catch(()=>{});
    await app.close();
  }
  fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2),{flag:'wx'});
  console.log(JSON.stringify({success:report.success,root,checks:report.checks,mainSha:report.mainSha,error:report.error,paidCalls:0}));
}
