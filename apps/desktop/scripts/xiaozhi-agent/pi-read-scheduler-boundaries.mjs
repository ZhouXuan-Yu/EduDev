import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {setTimeout as sleep} from 'node:timers/promises';
import {Agent} from '@earendil-works/pi-agent-core';
import {createAssistantMessageEventStream} from '@earendil-works/pi-ai';
const {createToolExecutionBoundary}=await import('../../src/main/xiaozhi-agent/tools/execution-bound.ts');
const {SessionExecutionRegistry}=await import('../../src/main/xiaozhi-agent/vendor/hana/lib/session-execution-registry.ts');
const {readSchedulerSnapshot}=await import('../../src/main/xiaozhi-agent/tools/read-scheduler.ts');
const {validToolAttempt}=await import('../../src/shared/xiaozhi-tool-attempt.ts');
const {applyXiaozhiEvent}=await import('../../src/shared/xiaozhi-projection.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-read-scheduler-'));
const report={success:false,checks:[],scope:'Production boundary and installed Pi Agent 1.0.2, controlled tools and injected SDK model events. No real provider, network, UI or daily acceptance claim.'};
const ok=()=>({content:[{type:'text',text:'owned read'}],details:{success:true}});
const def=(execute,name='office_read_text')=>({name,label:name,description:'Owned scheduler fixture',parameters:{type:'object',properties:{value:{type:'string'}},required:['value'],additionalProperties:false},execute});
async function until(fn,ms=3000){const end=performance.now()+ms;while(performance.now()<end){if(fn())return;await sleep(2);}throw Error('Scheduler observation timed out');}
let serial=0;
function runtime(extra={}){
 const sessionId='scheduler_'+(++serial),registry=new SessionExecutionRegistry(),attempts=[];let current=true,admitted=0;
 const boundary=createToolExecutionBoundary({sessionId,workspaceKey:'owned_read_workspace',registry,epoch:()=>sessionId,current:()=>current,waiting:()=>false,onWaiting:()=>()=>{},beforeDelivery:async()=>{admitted++;},attempt:async a=>{assert(validToolAttempt(a));attempts.push(a);},timeout:()=>2000,...extra});
 return{sessionId,registry,attempts,admitted:()=>admitted,stop:()=>{current=false;registry.abortBySession({sessionId});},execute:(d,id,signal)=>boundary.execute(d,id,{value:id},signal,undefined,{})};
}
function held(r,count,prefix='read'){
 const entered=[],ends=new Map();let active=0,peak=0;
 const tool=def(async(id)=>{entered.push(id);active++;peak=Math.max(peak,active);try{await new Promise(resolve=>ends.set(id,resolve));return ok();}finally{active--;}});
 const tasks=Array.from({length:count},(_,i)=>r.execute(tool,`${prefix}_${i}`));
 return{entered,ends,tasks,peak:()=>peak,finish:id=>ends.get(id)?.()};
}
async function check(name,fn){assert.deepEqual(readSchedulerSnapshot(),{active:0,queued:0,capacity:12});await fn();await until(()=>readSchedulerSnapshot().active===0&&readSchedulerSnapshot().queued===0);report.checks.push({name,pass:true});console.log('PASS '+name);}
try{
 await check('12 actual reads run; 13th/14th wait FIFO across sessions, queue time excludes execution time',async()=>{
  const r=runtime(),h=held(r,12);await until(()=>h.entered.length===12);
  const second=runtime(),j=held(second,2,'next');await until(()=>readSchedulerSnapshot().queued===2);assert.equal(j.entered.length,0);assert.equal(r.admitted(),12);assert.equal(second.admitted(),0);
  await sleep(30);h.finish('read_0');await until(()=>j.entered.length===1);assert.deepEqual(j.entered,['next_0']);assert.equal(readSchedulerSnapshot().active,12);
  h.finish('read_1');await until(()=>j.entered.length===2);assert.deepEqual(j.entered,['next_0','next_1']);h.ends.forEach(f=>f());j.ends.forEach(f=>f());
  const results=await Promise.all([...h.tasks,...j.tasks]);assert.equal(h.peak(),12);for(const a of results){assert.equal(a.details.execution.state,'succeeded');assert(validToolAttempt(a.details.execution));}
  assert(results[12].details.execution.queueWaitMs>=25);assert(results[12].details.execution.executionMs<results[12].details.execution.queueWaitMs);
  report.capacity={peak:h.peak(),fifo:j.entered,queuedRead:results[12].details.execution};
 });
 await check('Cancel queued read dispatches no work; stop removes queue and prevents later admission',async()=>{
  const r=runtime(),h=held(r,12);await until(()=>h.entered.length===12);const queued=runtime(),j=held(queued,1,'cancel');await until(()=>readSchedulerSnapshot().queued===1);
  queued.stop();const out=await j.tasks[0];assert.equal(out.details.execution.code,'cancelled');assert.equal(j.entered.length,0);assert.equal(queued.admitted(),0);assert.equal(queued.registry.activeCount(queued.sessionId),0);assert.equal(readSchedulerSnapshot().queued,0);
  h.ends.forEach(f=>f());await Promise.all(h.tasks);assert.equal(j.entered.length,0);
 });
 await check('Timeout of signal-ignoring reads retains all 12 slots until real promises settle',async()=>{
  const r=runtime({timeout:()=>150}),h=held(r,12);await until(()=>h.entered.length===12);const late=runtime(),j=held(late,1,'late');await until(()=>readSchedulerSnapshot().queued===1);
  const outs=await Promise.all(h.tasks);assert(outs.every(v=>v.details.execution.code==='timeout'));assert.equal(readSchedulerSnapshot().active,12);assert.equal(j.entered.length,0);assert.equal(r.registry.activeCount(r.sessionId),12);
  h.finish('read_0');await until(()=>j.entered.length===1);assert.equal(readSchedulerSnapshot().active,12);h.ends.forEach(f=>f());j.ends.forEach(f=>f());await Promise.all(j.tasks);await until(()=>r.registry.activeCount(r.sessionId)===0);
 });
 await check('Non-read writes bypass read queue while original same-workspace resource lock still refuses conflict',async()=>{
  const r=runtime(),h=held(r,12);await until(()=>h.entered.length===12);const writer=runtime();let count=0;
  const blocked=await writer.execute(def(async()=>{count++;return ok();},'office_create_text'),'blocked');assert.equal(blocked.details.execution.code,'resource_busy');assert.equal(count,0);assert(!writer.attempts.some(a=>a.state==='queued'));
  const unrelated=await writer.execute(def(async()=>{count++;return ok();},'update_plan'),'plan');assert.equal(unrelated.details.execution.state,'succeeded');assert.equal(count,1);assert.equal(readSchedulerSnapshot().active,12);
  h.ends.forEach(f=>f());await Promise.all(h.tasks);
 });
 await check('Invalid input, duplicate ID and conflicting arguments cannot create extra queued or actual reads',async()=>{
  const r=runtime();let count=0;const d=def(async()=>{count++;return ok();});
  const a=r.execute(d,'same'),b=r.execute(d,'same');assert.equal(await a,await b);assert.equal(count,1);assert.equal(r.attempts.filter(v=>v.state==='queued').length,1);
  const conflict=await r.execute(def(async()=>ok(),'office_file_stat'),'same');assert.equal(conflict.details.execution.code,'conflict');
  const invalid=await r.execute({...d,parameters:{type:'object',properties:{},additionalProperties:false}},'invalid');assert.equal(invalid.details.execution.code,'invalid_input');assert.equal(count,1);
 });
 await check('Queue journal failure fails closed, releases registry and never admits a tool',async()=>{
  const r=runtime({attempt:async()=>{throw Error('owned_queue_journal_failure');}});let count=0;
  await assert.rejects(r.execute(def(async()=>{count++;return ok();}),'journal'),/owned_queue_journal_failure/);assert.equal(count,0);assert.equal(r.admitted(),0);assert.equal(r.registry.activeCount(r.sessionId),0);
 });
 await check('Queue persistence error named resource_busy stays fatal and cannot masquerade as an ordinary tool conflict',async()=>{
  const r=runtime({attempt:async a=>{if(a.state==='queued')throw Error('resource_busy');}});let count=0;
  await assert.rejects(r.execute(def(async()=>{count++;return ok();}),'journal_conflict'),/resource_busy/);assert.equal(count,0);assert.equal(r.admitted(),0);assert.equal(r.registry.activeCount(r.sessionId),0);
 });
 await check('Queued/timing schema rejects fake executed queue/private fields; old records and projection remain compatible',async()=>{
  const a={schemaVersion:1,callId:'call_owned',tool:'office_read_text',attempt:1,maxAttempts:1,state:'queued',effect:'none'};assert(validToolAttempt(a));
  for(const bad of[{...a,executionMs:1},{...a,code:'timeout'},{...a,effect:'unknown'},{...a,queueWaitMs:NaN},{...a,queueWaitMs:-1},{...a,queueWaitMs:'3'},{...a,queueWaitMs:Infinity},{...a,private:'secret'}])assert(!validToolAttempt(bad));
  assert(validToolAttempt({...a,state:'succeeded'}));assert(validToolAttempt({...a,state:'succeeded',queueWaitMs:50,executionMs:5}));
  const turn={id:'run_owned',status:'running',items:[{id:a.callId,kind:'tool',status:'inProgress'}]},event={kind:'tool_attempt',attempt:a,runId:turn.id,sessionId:'s',sequence:1};
  const next=applyXiaozhiEvent(turn,event);assert.deepEqual(next.items[0].toolAttempt,a);assert.equal(next.items[0].status,'inProgress');
 });
 await check('Question/web mixed reads share the same ceiling and FIFO; a 429 retry releases its slot during backoff',async()=>{
  const r=runtime(),ends=new Map();let active=0,peak=0,retries=0;
  const tasks=Array.from({length:12},(_,i)=>r.execute(def(async id=>{
   if(id.startsWith('readretry_')){retries++;return ok();}
   active++;peak=Math.max(peak,active);try{await new Promise(resolve=>ends.set(id,resolve));return i===0?{...ok(),isError:true,details:{success:false,error:{code:'rate_limited'}}}:ok();}finally{active--;}
  },i%2?'education_search_questions':'office_web_fetch'),`mixed_${i}`));
  await until(()=>ends.size===12);let queuedEntered=false,finish;const next=runtime(),queued=next.execute(def(async()=>{queuedEntered=true;await new Promise(resolve=>finish=resolve);return ok();},'education_search_questions'),'question_next');await until(()=>readSchedulerSnapshot().queued===1);
  ends.get('mixed_0')();await until(()=>queuedEntered);assert.equal(retries,0);assert.equal(readSchedulerSnapshot().active,12);
  ends.forEach(f=>f());finish();const results=await Promise.all([...tasks,queued]);assert.equal(peak,12);assert.equal(retries,1);assert.equal(results[0].details.execution.attempt,2);assert(results.every(v=>v.details.execution.state==='succeeded'));
  assert.deepEqual(r.attempts.filter(a=>a.callId==='mixed_0').map(a=>a.state),['queued','started','retrying','queued','started','succeeded']);
 });
 await check('Installed Pi default parallel batch requests 13 reads, actual boundary peaks at 12 and native toolResult order stays intact',async()=>{
  const r=runtime(),ends=new Map(),events=[];let active=0,peak=0,calls=0;
  const underlying=def(async id=>{active++;peak=Math.max(peak,active);try{await new Promise(resolve=>ends.set(id,resolve));return ok();}finally{active--;}});
  const model={id:'owned',name:'owned',api:'openai-completions',provider:'owned',baseUrl:'https://example.invalid',reasoning:false,input:['text'],cost:{input:0,output:0,cacheRead:0,cacheWrite:0},contextWindow:32000,maxTokens:1024};
  const agent=new Agent({initialState:{systemPrompt:'Owned SDK scheduler test',model,tools:[{...underlying,execute:(id,args,signal,progress)=>r.execute(underlying,id,signal)}]},streamFn:()=>{
   const s=createAssistantMessageEventStream(),first=++calls===1,content=first?Array.from({length:13},(_,i)=>({type:'toolCall',id:`sdk_${i}`,name:underlying.name,arguments:{value:`sdk_${i}`}})):[{type:'text',text:'owned done'}];
   queueMicrotask(()=>{s.push({type:'done',reason:first?'toolUse':'stop',message:{role:'assistant',content,api:model.api,provider:model.provider,model:model.id,usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}},stopReason:first?'toolUse':'stop',timestamp:Date.now()}});s.end();});return s;
  }});agent.subscribe(e=>events.push(e.type));
  const task=agent.prompt('Execute owned scheduler fixtures');await until(()=>ends.size===12&&readSchedulerSnapshot().queued===1);assert.equal(peak,12);assert(!ends.has('sdk_12'));
  ends.get('sdk_0')();await until(()=>ends.has('sdk_12'));ends.forEach(f=>f());await task;
  const results=agent.state.messages.filter(m=>m.role==='toolResult');assert.equal(calls,2);assert.equal(peak,12);assert.deepEqual(results.map(m=>m.toolCallId),Array.from({length:13},(_,i)=>`sdk_${i}`));assert(results.every(m=>!m.isError));
  report.sdk={modelSource:'injected deterministic SDK events, no provider request',calls,peak,toolResults:results.map(m=>m.toolCallId),events};
 });
 report.success=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}finally{report.final=readSchedulerSnapshot();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));}
