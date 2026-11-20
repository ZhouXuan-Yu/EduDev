import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import assert from 'node:assert/strict';
import {pathToFileURL} from 'node:url';
import {channel} from 'node:diagnostics_channel';
import {build} from 'esbuild';
const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-startup-prewarm-check-'));
const report={success:false,root,checks:[],scope:'Metadata and startup job behavior only; no application Session, tool execution, network or user store.'};
const entry=path.join(root,'source.mjs');
const desktop=path.resolve(import.meta.dirname,'../..');
const url=file=>JSON.stringify(path.join(desktop,'src/main/xiaozhi-agent',file).replaceAll(String.fromCharCode(92),'/'));
fs.writeFileSync(entry,`export {createStartupPrewarm} from ${url('startup-prewarm.ts')};
export {coreToolStartupDefinitions} from ${url('core-tool-startup-definitions.ts')};
export {taskEnvelope,taskEnvelopeParameters} from ${url('tasks/tool-envelope.ts')};`);
const check=async(name,action)=>{await action();report.checks.push({name,pass:true});};
const tick=()=>new Promise(resolve=>setImmediate(resolve));
const deferred=()=>{let resolve;const promise=new Promise(done=>{resolve=done;});return{promise,resolve};};
try{
 await build({entryPoints:[entry],outfile:path.join(root,'module.mjs'),bundle:true,platform:'node',format:'esm',logLevel:'silent'});
 const {createStartupPrewarm,coreToolStartupDefinitions,taskEnvelope,taskEnvelopeParameters}=await import(pathToFileURL(path.join(root,'module.mjs')).href);
 const diagnostics=channel('omni-edu.xiaozhi.lifecycle.v1'),rows=[],subscriber=row=>rows.push(row);
 diagnostics.subscribe(subscriber);
 try{
  await check('Idle foreground join never schedules startup; repeated scheduling runs preparation once',async()=>{
   let calls=0;const service=createStartupPrewarm(async()=>{calls++;return 7;});
   await service.wait();assert.equal(calls,0);assert.equal(service.snapshot().status,'idle');
   service.schedule();service.schedule();assert.equal(service.snapshot().status,'scheduled');await service.wait();
   assert.equal(calls,1);assert.deepEqual(service.snapshot(),{status:'ready',registrationCount:7});
   service.schedule();await service.wait();assert.equal(calls,1);await service.close();
   const event=rows.find(row=>row.operation==='startup_registry_prewarm');
   assert.equal(event.registrationCount,7);assert.equal(event.outcome,'success');assert.equal(event.runId,undefined);
   assert(event.durationMs>=0&&event.endedEpochMs>=event.startedEpochMs);
  });
  await check('Closing scheduled preparation prevents invocation and later rescheduling',async()=>{
   let calls=0;const service=createStartupPrewarm(async()=>{calls++;return 1;});service.schedule();await service.close();
   service.schedule();await tick();assert.equal(calls,0);assert.equal(service.snapshot().status,'closed');
  });
  await check('Closing active preparation aborts immediately and drains actual late settlement',async()=>{
   const work=deferred();let signal,closed=false;
   const service=createStartupPrewarm(async current=>{signal=current;await work.promise;current.throwIfAborted();return 1;});
   service.schedule();await tick();assert.equal(service.snapshot().status,'running');
   const closing=service.close().then(()=>{closed=true;});await tick();assert.equal(signal.aborted,true);assert.equal(closed,false);
   work.resolve();await closing;assert.equal(closed,true);assert.equal(service.snapshot().status,'closed');
  });
  await check('Failed optional preparation leaves foreground join usable and records no error payload',async()=>{
   const secret='private fixture error payload';const service=createStartupPrewarm(async()=>{throw Error(secret);});
   service.schedule();await service.wait();assert.equal(service.snapshot().status,'failed');
   assert(!JSON.stringify(rows).includes(secret));await service.close();
  });
 }finally{diagnostics.unsubscribe(subscriber);}
 await check('Startup metadata uses the exact task-envelope schema helper without execution callbacks',async()=>{
  const definitions=coreToolStartupDefinitions();assert(definitions.length>=40);
  assert(definitions.every(def=>Object.keys(def).sort().join(',')==='name,parameters'));
  assert.equal(new Set(definitions.map(def=>def.name)).size,definitions.length);
  const schema={type:'object',properties:{path:{type:'string'}},required:['path']};let calls=0;
  const original={name:'office_create_text',parameters:schema,execute:async(_id,args)=>{calls++;return args;}};
  const wrapped=taskEnvelope(original);
  assert.deepEqual(wrapped.parameters,taskEnvelopeParameters(original.name,schema));
  assert.equal(calls,0);assert.deepEqual(await wrapped.execute('fixture',{path:'sample.html',taskStepId:'one'}),{path:'sample.html'});
  assert.equal(calls,1);assert.equal(taskEnvelopeParameters('ask_teacher',schema),schema);
  assert.equal(taskEnvelopeParameters('office_list_files',schema),schema);
  report.staticCandidateCount=definitions.length;
 });
 report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}
finally{fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
