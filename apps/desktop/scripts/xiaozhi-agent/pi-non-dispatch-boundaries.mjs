import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';import os from 'node:os';import path from 'node:path';
import {createToolExecutionBoundary} from '../../src/main/xiaozhi-agent/tools/execution-bound.ts';
import {SessionExecutionRegistry} from '../../src/main/xiaozhi-agent/vendor/hana/lib/session-execution-registry.ts';

const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-non-dispatch-')),checks=[],report={success:false,output,checks};
let writes=0,proofs=0;const signal=new AbortController().signal;
const tool={name:'office_create_text',label:'Owned source',description:'Owned source',parameters:{type:'object',properties:{path:{type:'string'},content:{type:'string'}},required:['path','content'],additionalProperties:false},execute:async()=>{writes++;return{content:[{type:'text',text:'saved'}],details:{success:true}};}};
const options={sessionId:'owned',workspaceKey:output,registry:new SessionExecutionRegistry(),epoch:()=> 'run_owned',current:()=>true,waiting:()=>false,onWaiting:()=>()=>{},beforeDelivery:async()=>{},attempt:async()=>{},notDispatched:async()=>{proofs++;}};
const check=async(name,action)=>{await action();checks.push({name,pass:true});};
try{
 const result=await createToolExecutionBoundary({...options,executeAuthorized:async()=>{throw Error('permission_pending');}}).execute(tool,'pending_operation',{path:'lesson.txt',content:'owned teaching'},signal);
 assert(result.isError);assert.equal(writes,0);assert.equal(proofs,1,'A settled authorization refusal must mint one main-only never-dispatched proof');checks.push({name:'Exact pending authorization settles without entering the original filesystem tool',pass:true});
 await check('An invoked filesystem write followed by permission_denied never becomes no-dispatch proof',async()=>{
  proofs=0;const file=path.join(output,'actually-written.txt'),invoked={...tool,execute:async()=>{fs.writeFileSync(file,'ACTUAL_EFFECT');throw Error('permission_denied');}};
  const failed=await createToolExecutionBoundary({...options,executeAuthorized:(_call,_tool,_args,scoped,perform)=>perform(scoped)}).execute(invoked,'invoked_refusal',{path:'actually-written.txt',content:'ACTUAL_EFFECT'},signal);assert(failed.isError);assert.equal(failed.details.execution.effect,'unknown');assert.equal(proofs,0);assert.equal(fs.readFileSync(file,'utf8'),'ACTUAL_EFFECT');
 });
 await check('A late saved perform cannot cross the already sealed one-shot dispatch gate',async()=>{
  proofs=0;let late;const boundary=createToolExecutionBoundary({...options,executeAuthorized:async(_call,_tool,_args,_signal,perform)=>{late=perform;throw Error('permission_pending');}});await boundary.execute(tool,'late_perform',{path:'late.txt',content:'never'},signal);assert.equal(proofs,1);const before=writes;await assert.rejects(late(signal),/permission_denied/);assert.equal(writes,before);
 });
 await check('An interrupted authorization promise never mints terminal proof from the timeout winner',async()=>{
  proofs=0;let finish;const pending=new Promise(resolve=>finish=resolve),boundary=createToolExecutionBoundary({...options,timeout:()=>20,executeAuthorized:async()=>{await pending;throw Error('permission_pending');}});const result=await boundary.execute(tool,'slow_authorization',{path:'slow.txt',content:'never'},signal);assert(result.isError);assert.equal(proofs,0);finish();await new Promise(resolve=>setTimeout(resolve,30));assert.equal(proofs,0);
 });
 await check('Cancellation refuses late authorization dispatch and leaves the old effect conservative',async()=>{
  proofs=0;let finish,entered;const waiting=new Promise(resolve=>entered=resolve),pending=new Promise(resolve=>finish=resolve),controller=new AbortController(),before=writes;
  const boundary=createToolExecutionBoundary({...options,executeAuthorized:async(_call,_tool,_args,scoped,perform)=>{entered();await pending;return perform(scoped);}}),work=boundary.execute(tool,'cancel_authorization',{path:'cancel.txt',content:'never'},controller.signal);await waiting;controller.abort();assert((await work).isError);finish();await new Promise(resolve=>setTimeout(resolve,30));assert.equal(proofs,0);assert.equal(writes,before);
 });
 await check('Successful same-call reuse executes once and writes no non-dispatch proof',async()=>{
  proofs=0;const before=writes,boundary=createToolExecutionBoundary(options),input={path:'success.txt',content:'owned'};assert(!(await boundary.execute(tool,'successful_once',input,signal)).isError);assert(!(await boundary.execute(tool,'successful_once',input,signal)).isError);assert.equal(writes,before+1);assert.equal(proofs,0);
 });
 await check('Terminal authority refusal is outside the narrow filesystem proof policy',async()=>{
  proofs=0;await createToolExecutionBoundary({...options,executeAuthorized:async()=>{throw Error('permission_pending');}}).execute({...tool,name:'exec_command'},'terminal_refusal',{path:'none',content:'never'},signal);assert.equal(proofs,0);
 });
 await check('Proof persistence failure remains a critical failure and cannot dispatch the file tool',async()=>{
  let critical=0;const before=writes,result=await createToolExecutionBoundary({...options,criticalFailure:()=>critical++,notDispatched:async()=>{throw Error('event_persistence');},executeAuthorized:async()=>{throw Error('permission_pending');}}).execute(tool,'failed_proof',{path:'none',content:'never'},signal);assert(result.isError);assert.equal(writes,before);assert(critical>0);
 });
 report.success=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}
finally{fs.writeFileSync(path.join(output,'REPORT.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));}
