import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
const {createToolExecutionBoundary}=await import('../../src/main/xiaozhi-agent/tools/execution-bound.ts');
const {SessionExecutionRegistry}=await import('../../src/main/xiaozhi-agent/vendor/hana/lib/session-execution-registry.ts');
const {createEventPublisher}=await import('../../src/main/xiaozhi-agent/events/publisher.ts');
const {toolManifest}=await import('../../src/main/xiaozhi-agent/tools/manifest.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-preflight-'));
const checks=[],report={success:false,checks,scope:'Actual common tool boundary, native timer/signal, registry, publisher. Controlled callbacks; not provider/UI/daily acceptance.'};
const ok=()=>({content:[{type:'text',text:'owned'}],details:{success:true}});
const def=(name,execute)=>({name,label:name,description:'owned boundary',parameters:{type:'object',properties:{},additionalProperties:false},execute});
let serial=0;
function runtime(extra={}){
 const sessionId='preflight_'+(++serial),registry=new SessionExecutionRegistry(),attempts=[],failures=[];let epoch='run_owned',current=true,admitted=0;
 const boundary=createToolExecutionBoundary({sessionId,workspaceKey:'workspace:preflight_'+serial,registry,epoch:()=>epoch,current:e=>current&&epoch===e,waiting:()=>false,onWaiting:()=>()=>{},beforeDelivery:async()=>{admitted++;},attempt:async a=>attempts.push(a),criticalFailure:e=>{failures.push(e);current=false;registry.abortBySession({sessionId});},timeout:()=>40,...extra});
 return {sessionId,registry,boundary,attempts,failures,admitted:()=>admitted,change:()=>{epoch='run_next';},execute:(d,id='call_owned',signal)=>boundary.execute(d,id,{},signal,undefined,{owned:true})};
}
async function check(name,action){await action();checks.push({name,pass:true});console.log('PASS '+name);}
try{
 await check('Ignoring pre-admission await times out, closes critical gate, dispatches zero work and drains late preparation',async()=>{
  let done,signal,dispatch=0;const r=runtime({beforeDelivery:async(_call,_tool,s)=>{signal=s;await new Promise(resolve=>done=resolve);s.throwIfAborted();}});
  await assert.rejects(r.execute(def('office_web_fetch',async()=>{dispatch++;return ok();})),/timeout/);
  assert.equal(r.failures.length,1);assert(signal.aborted);assert.equal(dispatch,0);assert.equal(r.registry.activeCount(r.sessionId),1);
  done();await sleep(10);assert.equal(dispatch,0);assert.equal(r.registry.activeCount(r.sessionId),0);assert.deepEqual(r.attempts.map(a=>a.state),['queued']);
 });
 await check('User cancellation during admission ends promptly without claiming persistence failure or delivering late work',async()=>{
  let done,dispatch=0;const r=runtime({beforeDelivery:async()=>new Promise(resolve=>done=resolve)}),c=new AbortController();
  const task=r.execute(def('office_create_text',async()=>{dispatch++;return ok();}),'cancel_prepare',c.signal);await sleep(5);c.abort();
  const result=await task;assert.equal(result.details.execution.code,'cancelled');assert.equal(result.details.execution.effect,'none');assert.equal(r.failures.length,0);
  r.change();done();await sleep(10);assert.equal(dispatch,0);assert.equal(r.registry.activeCount(r.sessionId),0);
 });
 await check('Hung started-attempt persistence times out with no tool execution or automatic read retry',async()=>{
  let done,dispatch=0;const r=runtime({attempt:async a=>{if(a.state==='started')await new Promise(resolve=>done=resolve);}});
  await assert.rejects(r.execute(def('office_web_search',async()=>{dispatch++;return ok();})),/timeout/);assert.equal(r.admitted(),1);assert.equal(dispatch,0);assert.equal(r.failures.length,1);
  done();await sleep(10);assert.equal(dispatch,0);assert.equal(r.registry.activeCount(r.sessionId),0);
 });
 await check('Admission failure is fatal, cached for same call, and cannot become a successful model-facing tool',async()=>{
  let count=0,dispatch=0;const r=runtime({beforeDelivery:async()=>{count++;throw Error('owned_admission_failure');}}),d=def('office_edit_text',async()=>{dispatch++;return ok();});
  await assert.rejects(r.execute(d),/owned_admission_failure/);await assert.rejects(r.execute(d),/owned_admission_failure/);
  assert.equal(count,1);assert.equal(dispatch,0);assert.equal(r.failures.length,1);assert.equal(r.registry.activeCount(r.sessionId),0);
 });
 await check('Hung final-attempt persistence closes the gate without returning success or repeating a completed write',async()=>{
  let done,dispatch=0;const r=runtime({attempt:async a=>{if(a.state==='succeeded')await new Promise(resolve=>done=resolve);}});
  await assert.rejects(r.execute(def('office_edit_text',async()=>{dispatch++;return ok();})),/execution budget/);assert.equal(dispatch,1);assert.equal(r.failures.length,1);done();await sleep(10);assert.equal(dispatch,1);
 });
 await check('A blocked publisher fails closed; later DB completion emits no revived event and flush refuses immediately',async()=>{
  let done,failed=0,committed=0;const events=[],owner={sessionId:'owned_session',runId:'owned_run',generation:1};
  const publisher=createEventPublisher({owner,journal:{assertOwner:async()=>{},append:async()=>{await new Promise(resolve=>done=resolve);return{cursor:{revision:1,sequence:1},turn:{id:owner.runId,status:'running',items:[]}};},notified:async()=>{}},committed:()=>committed++,emit:e=>events.push(e),failed:()=>failed++,beforeTerminalEmit:()=>{}});
  publisher.enqueue({kind:'tool_start',callId:'owned_call',tool:'office_read_text'});await sleep(5);publisher.fail(Error('owned_gate_timeout'));
  await assert.rejects(publisher.flush(),/owned_gate_timeout/);await assert.rejects(publisher.barrier(),/owned_gate_timeout/);await assert.rejects(publisher.persist(async()=>{throw Error('Must not execute');}),/owned_gate_timeout/);
  done();await sleep(10);assert.equal(failed,1);assert.equal(committed,0);assert.equal(events.length,0);assert(publisher.failed);
 });
 await check('Queued admission does not execute after publisher failure during owner assertion',async()=>{
  let done,actions=0;const publisher=createEventPublisher({owner:{sessionId:'s',runId:'r',generation:1},journal:{assertOwner:async()=>new Promise(resolve=>done=resolve)},committed:()=>{},emit:()=>{},failed:()=>{},beforeTerminalEmit:()=>{}});
  const task=publisher.persist(async()=>actions++);await sleep(5);publisher.fail(Error('owned_shutdown'));done();await assert.rejects(task,/owned_shutdown/);assert.equal(actions,0);
 });
 await check('Both education exporters lock the actual shared output directory against each other and ordinary file writes',async()=>{
  for(const name of['education_export_paper','education_export_classroom'])assert.equal(toolManifest(name).resource,'output');
  const shared='workspace:owned_actual_output',a=runtime({outputWorkspaceKey:shared}),b=runtime({outputWorkspaceKey:shared}),c=runtime({workspaceKey:shared});let done,dispatch=0;
  const timeout=await a.execute(def('education_export_classroom',()=>new Promise(resolve=>done=resolve)));assert.equal(timeout.details.execution.effect,'unknown');
  assert.equal((await b.execute(def('education_export_paper',async()=>{dispatch++;return ok();}),'paper_blocked')).details.execution.code,'resource_busy');
  assert.equal((await c.execute(def('office_create_text',async()=>{dispatch++;return ok();}),'file_blocked')).details.execution.code,'resource_busy');assert.equal(dispatch,0);assert.equal(b.admitted(),0);assert.equal(c.admitted(),0);
  done(ok());await sleep(10);assert.equal((await b.execute(def('education_export_paper',async()=>{dispatch++;return ok();}),'paper_after')).details.execution.state,'succeeded');assert.equal(dispatch,1);
 });
 await check('Cancelled local image preparation does not falsely claim upload or forbid a newly authorized teacher request',async()=>{
  const r=runtime(),c=new AbortController();let done;const task=r.execute(def('office_view_public_image',()=>new Promise(resolve=>done=resolve)),'image_cancel',c.signal);await sleep(5);c.abort();const result=await task;
  assert.equal(toolManifest('office_view_public_image').effect,'local_cache');assert.equal(result.details.execution.effect,'none');assert(result.content[0].text.includes('重新发起本轮用途确认'));assert(!result.content[0].text.includes('操作可能已经产生效果'));done(ok());await sleep(10);
 });
 report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,output,error:report.error}));}
