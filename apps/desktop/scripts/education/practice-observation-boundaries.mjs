import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import {registerHooks} from 'node:module';
import {createAssistantMessageEventStream} from '@earendil-works/pi-ai';

registerHooks({
  resolve(specifier,context,next){
    if(specifier==='electron')return{url:'data:text/javascript,export const utilityProcess={};export const app=new Proxy({},{get(){throw Error("Electron app unavailable in source-only boundary lane");}});',shortCircuit:true};
    return next(specifier,context);
  },
  load(url,context,next){
    if(url.endsWith('/xiaozhi-agent/ocr-runtime-manifest.json'))return{format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8')+';',shortCircuit:true};
    return next(url,context);
  },
});

const {practiceReviewBoundaries}=await import('./practice-review-boundaries.mjs');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-practice-observation-boundaries-'));
const workspace=path.join(output,'workspace'),stateRoot=path.join(output,'state');
fs.mkdirSync(workspace);
fs.mkdirSync(stateRoot);
const report={success:false,checks:[],errors:[],output,scope:'Focused source-only practice review boundaries including teacher observation normalization; no model request, user profile, database migration or external write.'};
const check=async(name,run)=>{await run();report.checks.push({name,pass:true});console.log('PASS '+name);};
let agent;
async function prime(){
  agent.session.agent.streamFn=model=>{
    const stream=createAssistantMessageEventStream();
    stream.push({type:'done',reason:'stop',message:{role:'assistant',api:model.api,provider:model.provider,model:model.id,content:[{type:'text',text:'合成基线'}],stopReason:'stop',timestamp:Date.now(),usage:{input:0,output:0,cacheRead:0,cacheWrite:0,totalTokens:0,cost:{input:0,output:0,cacheRead:0,cacheWrite:0,total:0}}}});
    stream.end();
    return stream;
  };
  assert((await agent.prompt('合成原生基线')).ok);
}

globalThis.fetch=async()=>{throw new Error('Network disabled in focused practice boundary');};
try{
  await practiceReviewBoundaries(check,output,{stateRoot,workspace,apiKey:'synthetic-boundary-not-a-key',model:'deepseek-chat',approveCopy:async()=>false},async native=>{
    agent=native;
    try{await prime();}
    finally{agent=undefined;}
  });
  report.success=true;
}catch(error){
  report.errors.push(String(error.stack||error));
  process.exitCode=1;
}finally{
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));
  console.log(JSON.stringify({success:report.success,checks:report.checks.length,output,error:report.errors.at(-1)||''}));
}
