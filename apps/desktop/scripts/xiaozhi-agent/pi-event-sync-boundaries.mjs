import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';
const {createEventReceiver}=await import('../../src/shared/xiaozhi-event-receiver.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-event-sync-')),report={success:false,checks:[],boundary:'Actual shared event receiver with controlled delayed/malformed public transport; no Pi/provider or UI acceptance'};
const sessionId='aisession_00000000-0000-4000-8000-000000000001',cursor=(sequence,runId='run_a')=>({runId,generation:1,sequence,revision:sequence});
const event=(sequence,runId='run_a')=>({sessionId,...cursor(sequence,runId),schemaVersion:1,durability:'committed',kind:'text_delta',delta:String(sequence)});
const page=(events,sequence=events.at(-1)?.sequence||0,runId='run_a')=>({schemaVersion:1,cursor:cursor(sequence,runId),events,hasMore:false});
const tick=()=>new Promise(resolve=>setTimeout(resolve,0));
const check=async(name,fn)=>{await fn();report.checks.push({name,pass:true});console.log('PASS '+name);};
try{
 await check('Known gap reports catching_up synchronously, before the held transport resolves',async()=>{
  const states=[],applied=[];let resolve;const r=createEventReceiver({list:()=>new Promise(done=>resolve=done),apply:e=>applied.push(e.sequence),unavailable:()=>assert.fail(),gapFailure:()=>assert.fail(),syncChanged:s=>states.push(s)});
  r.seed([cursor(1)]);r.accept(event(3));assert.equal(states.at(-1),'catching_up');assert.deepEqual(applied,[]);resolve(page([event(2),event(3)]));await tick();assert.equal(states.at(-1),'ready');assert.deepEqual(applied,[2,3]);
 });
 await check('Failed repair remains unavailable; an older snapshot cannot release a known gap',async()=>{
  const states=[];let failures=0;const r=createEventReceiver({list:async()=>{throw Error('owned offline');},apply:()=>{},unavailable:()=>{},gapFailure:()=>failures++,syncChanged:s=>states.push(s)});
  r.seed([cursor(1)]);r.accept(event(4));await tick();assert.equal(failures,1);assert.equal(states.at(-1),'unavailable');r.seed([cursor(2)]);assert.notEqual(states.at(-1),'ready');r.seed([cursor(4)]);assert.equal(states.at(-1),'ready');
 });
 await check('Reset isolates late pull success and failure from the new session',async()=>{
  const states=[];let reject;const r=createEventReceiver({list:()=>new Promise((_resolve,fail)=>reject=fail),apply:()=>assert.fail(),unavailable:()=>{},gapFailure:()=>assert.fail(),syncChanged:s=>states.push(s)});
  r.accept(event(3));r.reset();const count=states.length;reject(Error('late'));await tick();assert.equal(states.length,count);assert.equal(states.at(-1),'ready');
 });
 await check('Healthy empty polls do not flash a blocked state',async()=>{
  const states=[];const r=createEventReceiver({list:async()=>page([],1),apply:()=>assert.fail(),unavailable:()=>{},gapFailure:()=>assert.fail(),syncChanged:s=>states.push(s)});r.seed([cursor(1)]);const count=states.length;r.poll(sessionId);await tick();assert.equal(states.length,count);
 });
 await check('Malformed poll retains unavailable until an authoritative valid cursor is seeded',async()=>{
  const states=[];let failed=0;const r=createEventReceiver({list:async()=>page([event(3)],3),apply:()=>assert.fail(),unavailable:()=>{},gapFailure:()=>failed++,syncChanged:s=>states.push(s)});r.seed([cursor(1)]);r.poll(sessionId);await tick();assert.equal(failed,1);assert.equal(states.at(-1),'unavailable');r.seed([{...cursor(3),generation:2}]);assert.equal(states.at(-1),'unavailable');r.seed([cursor(3)]);assert.equal(states.at(-1),'ready');
 });
 await check('Persistence-unavailable cannot be cleared by ordinary seeding',async()=>{
  const states=[];const r=createEventReceiver({list:()=>assert.fail(),apply:()=>assert.fail(),unavailable:()=>{},gapFailure:()=>{},syncChanged:s=>states.push(s)});r.accept({...event(1),durability:'unavailable'});assert.equal(states.at(-1),'unavailable');r.seed([cursor(1)]);assert.equal(states.at(-1),'unavailable');r.reset();assert.equal(states.at(-1),'ready');
 });
 await check('A newly observed higher target extends the held repair and cannot release at the old target',async()=>{
  const states=[],applied=[],requests=[];let resolve;const r=createEventReceiver({list:i=>{requests.push(i.after);return new Promise(done=>resolve=done);},apply:e=>applied.push(e.sequence),unavailable:()=>assert.fail(),gapFailure:()=>assert.fail(),syncChanged:s=>states.push(s)});r.seed([cursor(1)]);r.accept(event(3));r.accept(event(5));resolve(page([event(2),event(3)],3));await tick();assert.equal(states.at(-1),'catching_up');assert.deepEqual(requests,[1,3]);resolve(page([event(4),event(5)]));await tick();assert.equal(states.at(-1),'ready');assert.deepEqual(applied,[2,3,4,5]);
 });
 await check('Tail polling discovers multiple missing pages and waits for the advertised durable head',async()=>{
  const states=[],applied=[];let calls=0;const r=createEventReceiver({list:async()=>++calls===1?{...page([event(2)],4),hasMore:true}:page([event(3),event(4)]),apply:e=>applied.push(e.sequence),unavailable:()=>assert.fail(),gapFailure:()=>assert.fail(),syncChanged:s=>states.push(s)});r.seed([cursor(1)]);r.poll(sessionId);await tick();assert.equal(calls,2);assert.deepEqual(applied,[2,3,4]);assert.deepEqual(states,['catching_up','ready']);
 });
 await check('An empty page below the durable head cannot declare synchronization complete',async()=>{
  const states=[];let failed=0;const r=createEventReceiver({list:async()=>page([],4),apply:()=>assert.fail(),unavailable:()=>{},gapFailure:()=>failed++,syncChanged:s=>states.push(s)});r.seed([cursor(1)]);r.poll(sessionId);await tick();assert.equal(failed,1);assert.equal(states.at(-1),'unavailable');r.seed([cursor(2)]);assert.notEqual(states.at(-1),'ready');r.seed([cursor(4)]);assert.equal(states.at(-1),'ready');
 });
 await check('Duplicate and foreign generation notifications cannot release an observed gap',async()=>{
  const states=[];let resolve;const r=createEventReceiver({list:()=>new Promise(done=>resolve=done),apply:()=>{},unavailable:()=>{},gapFailure:()=>assert.fail(),syncChanged:s=>states.push(s)});r.seed([cursor(1)]);r.accept(event(3));r.accept(event(1));r.accept({...event(3),generation:2});assert.equal(states.at(-1),'catching_up');r.reset();resolve(page([event(2),event(3)]));await tick();assert.equal(states.at(-1),'ready');assert.deepEqual(r.cursors(),[]);
 });
 report.success=true;
}catch(error){report.error=String(error.stack||error);process.exitCode=1;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.error}));}
