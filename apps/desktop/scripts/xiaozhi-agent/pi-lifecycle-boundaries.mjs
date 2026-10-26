import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {setTimeout as sleep} from 'node:timers/promises';
const {waitForLifecycle}=await import('../../src/main/xiaozhi-agent/lifecycle-wait.ts');
const {createPiXiaozhiSession}=await import('../../src/main/xiaozhi-agent/pi-session.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-lifecycle-')),checks=[],report={success:false,checks,scope:'Real Pi session/SDK and current lifecycle await adapter; deliberately hung callbacks, no model/provider/UI/daily claim.'};
let agent;
const check=async(name,fn)=>{await fn();checks.push({name,pass:true});console.log('PASS '+name);};
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return {promise,resolve};};
const until=async(fn)=>{for(let n=0;n<100;n++){if(fn())return;await sleep(5);}throw Error('condition timeout');};
function config(){const root=fs.mkdtempSync(path.join(output,'case-'));const workspace=path.join(root,'workspace'),stateRoot=path.join(root,'state');fs.mkdirSync(workspace);fs.mkdirSync(stateRoot);return {workspace,stateRoot,apiKey:'synthetic-no-network',model:'deepseek-chat',lifecycleTimeoutMs:200};}
function model(a){let calls=0;a.session.agent.streamFunction=()=>{calls++;throw Error('Unexpected model dispatch');};return ()=>calls;}
try{
 await check('Hung await cancellation settles promptly, late owned value disposed once and no continuation dispatch',async()=>{
  const d=deferred(),c=new AbortController();let late=0,dispatch=0;const result=waitForLifecycle('owned',()=>d.promise,{signal:c.signal,timeoutMs:500,late:()=>late++}).then(()=>dispatch++);await sleep(5);c.abort();await assert.rejects(result,/cancelled/);d.resolve({owned:true});await sleep(10);assert.equal(late,1);assert.equal(dispatch,0);
 });
 await check('Fixed await timeout is not success and late completion is drained',async()=>{const d=deferred();await assert.rejects(waitForLifecycle('owned',()=>d.promise,{timeoutMs:20}),/lifecycle_timeout/);d.resolve('late');await sleep(10);});
 await check('Already cancelled setup does not invoke authority or create a usable session',async()=>{const c=new AbortController();c.abort();let calls=0;await assert.rejects(createPiXiaozhiSession({...config(),lifecycleSignal:c.signal,modelHistory:{authorize:async()=>{calls++;},beforeLoad:async()=>{},align:async()=>{}}}),/cancelled/);assert.equal(calls,0);});
 await check('Real Pi protected-context stop returns cancelled and late old facts cannot reach model or native messages',async()=>{
  let entered=false;const d=deferred();agent=await createPiXiaozhiSession({...config(),protectedContext:async()=>{entered=true;return d.promise;}});const calls=model(agent),task=agent.prompt('合成停止准备');await until(()=>entered);await agent.abort();const result=await task;assert(!result.ok&&result.error==='cancelled');assert.equal(calls(),0);d.resolve('OLD-CONTEXT');await sleep(10);assert.equal(calls(),0);assert(!JSON.stringify(agent.session.messages).includes('OLD-CONTEXT'));await agent.dispose();agent=undefined;
 });
 await check('Real Pi protected context timeout seals critical gate before model invocation',async()=>{
  const d=deferred();let failures=0;agent=await createPiXiaozhiSession({...config(),protectedContext:()=>d.promise,onCriticalToolFailure:()=>failures++});const calls=model(agent),result=await agent.prompt('合成权限挂起');assert(!result.ok);assert.equal(result.error,'event_persistence');assert.equal(failures,1);assert.equal(calls(),0);d.resolve('LATE');await sleep(10);assert.equal(calls(),0);await agent.dispose();agent=undefined;
 });
 report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}finally{await agent?.dispose().catch(()=>{});fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,output,error:report.error}));}
