import assert from 'node:assert/strict';
import {BLIND_ANSWER_REVIEW,blindAnswerPass,blindAnswerIssues,sourceReviewDraft} from '../../src/shared/material-ai-answer-review.ts';
import {validAiPagePrompt} from '../../src/shared/material-ai-page.ts';
import {completeMaterialAi} from '../../src/main/assets/material-ai-provider.ts';
import {archiveEligible} from '../../src/shared/question-archive.ts';

/** Reuses the durable page fixture; no duplicate database/executor model. */
export async function runBlindAnswerChecks({check,cropReviewFixture,correctionFixture,MaterialAiRepository}){
 const key='OMNI_EDU_AI_BLIND_ANSWERS',margin='OMNI_EDU_AI_OWNED_CROP_MARGINS';
 async function enabled(fn){const old=process.env[key],m=process.env[margin];process.env[key]='1';process.env[margin]='1';try{await fn();}finally{for(const [k,v]of [[key,old],[margin,m]])if(v===undefined)delete process.env[k];else process.env[k]=v;}}
 async function run(quality=false,mutate=()=>{}){
  const f=await(quality?correctionFixture():cropReviewFixture()),complete=f.repo.runtime.complete;
  f.repo.runtime.complete=async i=>{const r=JSON.parse(await complete(i));mutate(r,i);return JSON.stringify(r);};
  try{f.batch=quality?await f.create():await f.repo.create(f.input);await f.repo.drain();if(quality)await f.repo.drain();return f;}catch(e){await f.dispose();throw e;}
 }
 await check('Blind policy is frozen only with owned source geometry and authentic image review, including strict getters and unknown fields',()=>enabled(async()=>{
  const f=await run();try{const p=f.inputs[1].pagePrompt;assert.equal(p.answerReviewPolicy,BLIND_ANSWER_REVIEW);assert(validAiPagePrompt(p));let getter=false;
   for(const bad of [{...p,answerReviewPolicy:'future'},{...p,cropGeometryPolicy:undefined},{...p,cropReviewPolicy:'local-crop-review.v1'},{...p,policy:'page-fragments.v2'},{...p,approved:true},{...p,get answerReviewPolicy(){getter=true;return BLIND_ANSWER_REVIEW;}}])assert(!validAiPagePrompt(bad));assert(!getter);
   assert(!blindAnswerPass(p,false,false));assert(blindAnswerPass(p,true,false));const quality={...p,cropReviewPolicy:'local-crop-review.v3'};assert(!blindAnswerPass(quality,true,false));assert(blindAnswerPass(quality,true,true));
  }finally{await f.dispose();}
 }));
 await check('Reworded generated explanation preserves source-backed diagram and final archive through cold reader',()=>enabled(async()=>{
  for(const quality of [false,true]){const f=await run(quality,(r,i)=>{if(quality?i.verification:i.previous)r.questions[0].analysis='把七和八相加，和为十五。';});try{const q=await f.question();assert(archiveEligible(q),JSON.stringify(q.archive));assert(q.document.blocks.some(b=>b.kind==='image'));assert.equal(q.analysis,'把七和八相加，和为十五。');await new MaterialAiRepository(f.host).validate(q);assert.equal(f.state.calls,quality?3:2);}finally{await f.dispose();}}
 }));
 await check('Independently differing answer is quarantined without losing the source document, final response or paid drafts',()=>enabled(async()=>{
  for(const quality of [false,true]){const f=await run(quality,(r,i)=>{if(quality?i.verification:i.previous)r.questions[0].answer='16';});try{const q=await f.question();assert(!archiveEligible(q));assert(q.archive.issues.includes('answer_conflict'));assert(!q.archive.issues.includes('requires_image'));assert.equal(q.answer,'16');assert(q.document.blocks.some(b=>b.kind==='image'));const row=f.db.prepare('SELECT first_json,final_json FROM material_ai_units').get();assert.equal(JSON.parse(row.first_json).questions[0].answer,'15');assert.equal(JSON.parse(row.final_json).questions[0].answer,'16');await new MaterialAiRepository(f.host).validate(q);
   await assert.rejects(()=>f.repo.validate({...q,archive:{...q.archive,state:'ai_final',issues:[]}}),/source_changed/);
  }finally{await f.dispose();}}
 }));
 await check('Blind projection removes only generated roles and cannot modify the original paid response or printed answers',()=>enabled(async()=>{
  const f=await run();try{const previous=f.inputs[1].previous,saved=JSON.stringify(previous),projection=sourceReviewDraft(previous);assert.equal(projection.questions[0].answer,'');assert.equal(projection.questions[0].analysis,'');assert.equal(projection.questions[0].answerOrigin,'missing');assert.equal(JSON.stringify(previous),saved);
   const printed=structuredClone(previous);printed.questions[0].answerOrigin='source';printed.questions[0].analysisOrigin='source';assert.deepEqual(sourceReviewDraft(printed).questions[0],printed.questions[0]);assert.equal(sourceReviewDraft(printed).questions[1].answer,'');assert.deepEqual(blindAnswerIssues(undefined,previous.questions[0],f.inputs[1].pagePrompt),['ai_review']);assert.deepEqual(blindAnswerIssues(previous.questions[0],{...previous.questions[0],answer:''},f.inputs[1].pagePrompt),[]);
  }finally{await f.dispose();}
 }));
 await check('Actual provider transport hides both old AI drafts on final pass, retains correction evidence locally and authenticates before dispatch',()=>enabled(async()=>{
  const old=globalThis.fetch;try{for(const quality of [false,true]){const f=await run(quality);try{
   const requests=[],row=f.db.prepare('SELECT final_json FROM material_ai_units').get();globalThis.fetch=async(_,o)=>{requests.push(JSON.parse(o.body));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:row.final_json}}]}));};
   for(const input of f.inputs)await completeMaterialAi(input,new AbortController().signal);
   for(let n=0;n<f.inputs.length;n++){const p=JSON.parse(requests[n].messages[1].content[0].text),blind=quality?n===2:n===1;if(!n){assert(!p.firstDraft);continue;}assert.equal(p.firstDraft.questions[0].answer,blind?'':f.inputs[n].previous.questions[0].answer);assert.equal(p.firstDraft.questions[0].analysis,blind?'':f.inputs[n].previous.questions[0].analysis);if(blind){assert(!p.correctionVerification);assert(requests[n].messages[0].content.includes('[盲解复核'));}assert.deepEqual(p.cropReview,f.inputs[n].cropReview);}
   const i=f.inputs.at(-1),before=requests.length;await assert.rejects(()=>completeMaterialAi({...i,cropReview:{...i.cropReview,firstDraftSha256:'0'.repeat(64)}},new AbortController().signal),/invalid_input/);if(quality)await assert.rejects(()=>completeMaterialAi({...i,verification:{...i.verification,reviewDraftSha256:'0'.repeat(64)}},new AbortController().signal),/invalid_input/);assert.equal(requests.length,before);
  }finally{await f.dispose();}}}finally{globalThis.fetch=old;}
 }));
 await check('Generated-role separation cannot excuse a changed stem, diagram, source role or block ownership',()=>enabled(async()=>{
  for(const mode of ['stem','diagram','source','blocks']){const f=await run(false,(r,i)=>{if(!i.previous)return;const q=r.questions[0];if(mode==='stem'){q.stem+='条件改变。';q.projection.statement.text=q.stem;}if(mode==='diagram')q.projection.figures.text='图2';if(mode==='source'){q.answerOrigin='source';q.answer='16';}if(mode==='blocks')r.fragments[0].blockIds=['block-1'];});try{assert(!archiveEligible(await f.question()),mode);}finally{await f.dispose();}}
 }));
 await check('Printed answer and explanation survive the actual blind provider request without changing source authority',()=>enabled(async()=>{
  const f=await run(false,r=>{r.questions[0].answerOrigin='source';r.questions[0].analysisOrigin='source';}),old=globalThis.fetch;try{
   const requests=[],raw=f.db.prepare('SELECT final_json FROM material_ai_units').get().final_json;globalThis.fetch=async(_,o)=>{requests.push(JSON.parse(o.body));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:raw}}]}));};await completeMaterialAi(f.inputs[1],new AbortController().signal);
   const draft=JSON.parse(requests[0].messages[1].content[0].text).firstDraft;assert.deepEqual(draft.questions[0],f.inputs[1].previous.questions[0]);assert.equal(draft.questions[1].answer,'');assert.equal(draft.questions[1].analysis,'');
  }finally{globalThis.fetch=old;await f.dispose();}
 }));
 await check('New-generation stop switch leaves frozen blind units resumable and legacy batches unchanged',()=>enabled(async()=>{
  const f=await cropReviewFixture();try{f.batch=await f.repo.create(f.input);process.env[key]='0';await f.repo.drain();assert.equal(f.inputs[1].pagePrompt.answerReviewPolicy,BLIND_ANSWER_REVIEW);await new MaterialAiRepository(f.host).validate(await f.question());const next=await cropReviewFixture();try{await next.repo.create(next.input);await next.repo.drain();assert.equal(next.inputs[1].pagePrompt.answerReviewPolicy,undefined);assert(archiveEligible(await next.question()));}finally{await next.dispose();}}finally{await f.dispose();}
 }));
}
