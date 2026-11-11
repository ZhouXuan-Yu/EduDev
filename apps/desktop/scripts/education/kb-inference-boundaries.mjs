import assert from 'node:assert/strict';
import {completeMaterialAi} from '../../src/main/assets/material-ai-provider.ts';
import {validAiPagePrompt} from '../../src/shared/material-ai-page.ts';
import {MATERIAL_HIGH_INFERENCE,useHighMaterialInference} from '../../src/shared/material-ai-inference.ts';
import {materialInferenceLimits} from '../../src/main/assets/material-ai-reasoning.ts';

export async function runInferenceChecks({check,correctionFixture,MaterialAiRepository}){
 await check('New quality work defaults to deep reasoning; explicit stop and historical modes retain their selection',async()=>{
  assert.equal(useHighMaterialInference('quality',undefined),true);
  assert.equal(useHighMaterialInference('quality','1'),true);
  assert.equal(useHighMaterialInference('quality','0'),false);
  assert.equal(useHighMaterialInference('standard',undefined),false);
  assert.equal(useHighMaterialInference('standard','1'),false);
  assert.equal(useHighMaterialInference('legacy',undefined),false);
  assert.equal(useHighMaterialInference('legacy','1'),true);
 });
 const keys=['OMNI_EDU_AI_REASONING_HIGH','OMNI_EDU_AI_BLIND_ANSWERS','OMNI_EDU_AI_OWNED_CROP_MARGINS'];
 async function enabled(fn){const prior=keys.map(k=>process.env[k]);keys.forEach(k=>process.env[k]='1');try{await fn();}finally{keys.forEach((k,i)=>{if(prior[i]===undefined)delete process.env[k];else process.env[k]=prior[i];});}}
 async function fixture(){const f=await correctionFixture();try{await f.create();await f.repo.drain();await f.repo.drain();return f;}catch(e){await f.dispose();throw e;}}
 function transport(raw,requests,reasoning='',finish='stop'){
  return async(_,o)=>{requests.push(JSON.parse(o.body));return new Response(JSON.stringify({choices:[{finish_reason:finish,message:{reasoning_content:reasoning,content:raw}}]}));};
 }
 await check('Frozen high inference validates only with the original blind, owned, three-pass source contract',()=>enabled(async()=>{
  const f=await fixture();try{const p=f.inputs[0].pagePrompt;assert.equal(p.inferencePolicy,MATERIAL_HIGH_INFERENCE);assert(validAiPagePrompt(p));let getter=false;
   for(const bad of [{...p,inferencePolicy:'future'},{...p,inferencePolicy:undefined},{...p,answerReviewPolicy:undefined},{...p,cropReviewPolicy:'local-crop-review.v2'},{...p,cropGeometryPolicy:undefined},{...p,approved:true},{...p,get inferencePolicy(){getter=true;return MATERIAL_HIGH_INFERENCE;}}])assert(!validAiPagePrompt(bad));assert(!getter);const {inferencePolicy,...old}=p;assert(validAiPagePrompt(old));
  }finally{await f.dispose();}
 }));
 await check('All three actual quality requests reuse high thinking with bounded tokens, retain blind final and leave original inputs unchanged',()=>enabled(async()=>{
  const f=await fixture(),old=globalThis.fetch;try{const raw=f.db.prepare('SELECT final_json FROM material_ai_units').get().final_json,requests=[],inputs=JSON.stringify(f.inputs);globalThis.fetch=transport(raw,requests);
   for(const i of f.inputs)await completeMaterialAi(i,new AbortController().signal);
   assert.equal(requests.length,3);for(const r of requests){assert.equal(r.reasoning_effort,'high');assert.deepEqual(r.thinking,{type:'enabled'});assert.equal(r.max_tokens,32768);assert(!Object.hasOwn(r,'temperature'));assert.deepEqual(r.response_format,{type:'json_object'});}assert.equal(JSON.stringify(f.inputs),inputs);assert.equal(JSON.parse(requests[2].messages[1].content[0].text).firstDraft.questions[0].answer,'');assert.equal(f.state.calls,3);
  }finally{globalThis.fetch=old;await f.dispose();}
 }));
 await check('Historical frozen requests keep the exact non-thinking budget and narrower transport bounds',()=>enabled(async()=>{
  const f=await fixture(),old=globalThis.fetch;try{const i=f.inputs[0],{inferencePolicy,...legacy}=i.pagePrompt,requests=[],raw=f.db.prepare('SELECT first_json FROM material_ai_units').get().first_json;globalThis.fetch=transport(raw,requests);await completeMaterialAi({...i,pagePrompt:legacy},new AbortController().signal);assert.equal(requests[0].reasoning_effort,'none');assert.equal(requests[0].max_tokens,8192);assert.equal(requests[0].temperature,0);assert(!requests[0].thinking);assert.deepEqual(materialInferenceLimits(legacy),{timeoutMs:120000,responseBytes:262144});assert.deepEqual(materialInferenceLimits(i.pagePrompt),{timeoutMs:300000,responseBytes:1048576});
  }finally{globalThis.fetch=old;await f.dispose();}
 }));
 await check('Large reasoning envelope is bounded separately and never becomes question text or returned receipt',()=>enabled(async()=>{
  const f=await fixture(),old=globalThis.fetch;try{const i=f.inputs.at(-1),raw=f.db.prepare('SELECT final_json FROM material_ai_units').get().final_json,requests=[];globalThis.fetch=transport(raw,requests,'internal-only-marker'.repeat(18000));assert.equal(await completeMaterialAi(i,new AbortController().signal),raw);assert(!raw.includes('internal-only-marker'));const {inferencePolicy,...legacy}=i.pagePrompt;await assert.rejects(()=>completeMaterialAi({...i,pagePrompt:legacy},new AbortController().signal),/outcome_unknown/);assert.equal(requests.length,2);
  }finally{globalThis.fetch=old;await f.dispose();}
 }));
 await check('Oversized thinking transport and truncated final output fail once without accepting partial content or replay',()=>enabled(async()=>{
  const f=await fixture(),old=globalThis.fetch;try{const i=f.inputs.at(-1),raw=f.db.prepare('SELECT final_json FROM material_ai_units').get().final_json,requests=[];globalThis.fetch=transport(raw,requests,'x'.repeat(1048576));await assert.rejects(()=>completeMaterialAi(i,new AbortController().signal),/outcome_unknown/);assert.equal(requests.length,1);globalThis.fetch=transport(raw,requests,'', 'length');await assert.rejects(()=>completeMaterialAi(i,new AbortController().signal),/invalid_response/);assert.equal(requests.length,2);
  }finally{globalThis.fetch=old;await f.dispose();}
 }));
 await check('Inference cannot bypass original crop/source binding or a cancelled teacher request',()=>enabled(async()=>{
  const f=await fixture(),old=globalThis.fetch;try{const i=f.inputs.at(-1),requests=[],raw=f.db.prepare('SELECT final_json FROM material_ai_units').get().final_json;globalThis.fetch=transport(raw,requests);await assert.rejects(()=>completeMaterialAi({...i,cropReview:{...i.cropReview,firstDraftSha256:'0'.repeat(64)}},new AbortController().signal),/invalid_input/);const c=new AbortController();c.abort();await assert.rejects(()=>completeMaterialAi(i,c.signal));assert.equal(requests.length,0);
   const active=new AbortController();globalThis.fetch=async(_,o)=>{requests.push(JSON.parse(o.body));active.abort();return new Response(raw);};await assert.rejects(()=>completeMaterialAi(i,active.signal),/outcome_unknown/);assert.equal(requests.length,1);
  }finally{globalThis.fetch=old;await f.dispose();}
 }));
 await check('Historical unqualified legacy jobs keep their non-thinking budget',()=>enabled(async()=>{
  delete process.env.OMNI_EDU_AI_REASONING_HIGH;const f=await correctionFixture();try{await f.create();await f.repo.drain();await f.repo.drain();assert(f.inputs.every(i=>i.pagePrompt.inferencePolicy===undefined));assert(f.inputs.every(i=>i.pagePrompt.answerReviewPolicy==='blind-answer-review.v1'));}finally{await f.dispose();}
 }));
 await check('Stop-new-generation switch does not retarget saved paid inputs or resumed high inference',()=>enabled(async()=>{
  const f=await correctionFixture();try{await f.create();const input=f.db.prepare('SELECT input_json FROM material_ai_units').get().input_json;process.env.OMNI_EDU_AI_REASONING_HIGH='0';await f.repo.drain();await f.repo.drain();assert.equal(f.inputs[2].pagePrompt.inferencePolicy,MATERIAL_HIGH_INFERENCE);assert.equal(f.db.prepare('SELECT input_json FROM material_ai_units').get().input_json,input);await new MaterialAiRepository(f.host).validate(await f.question());const next=await correctionFixture();try{await next.create();await next.repo.drain();await next.repo.drain();assert.equal(next.inputs[0].pagePrompt.inferencePolicy,undefined);}finally{await next.dispose();}
  }finally{await f.dispose();}
 }));
}
