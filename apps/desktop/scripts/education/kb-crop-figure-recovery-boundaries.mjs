import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {validCropReview,validCropReviewImages} from '../../src/main/assets/material-ai-crop-review.ts';
import {pageFragmentGroups} from '../../src/shared/material-ai-page-fragments.ts';
import {validAiAction} from '../../src/shared/material-ai.ts';

export async function runCropFigureRecoveryChecks({check,cropReviewFixture,MaterialAiRepository}){
 const keys=['OMNI_EDU_AI_OWNED_CROP_MARGINS','OMNI_EDU_AI_CROP_BODY_TEXT','OMNI_EDU_AI_BLIND_ANSWERS'];
 async function enabled(fn){const old=keys.map(k=>process.env[k]);keys.forEach(k=>process.env[k]='1');try{await fn();}finally{keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});}}
 const action=id=>({schemaVersion:'xiaozhi.material-ai.v1',batchId:id,action:'retry_source',acceptDuplicateCharge:true});
 await check('Adjacent original body and diagram use the identical frozen grouping in renderer, OCR review, provider and cold source reader',()=>enabled(async()=>{
  const f=await cropReviewFixture(),blocks=f.repo.runtime.blocks;try{
   f.repo.runtime.blocks=async(...args)=>{const p=await blocks(...args);for(const [id,kind,box]of [['block-1','text',[.1,.1,.55,.2]],['block-2','image',[.553,.1,.85,.2]],['block-3','figure_title',[.57,.205,.85,.23]]])Object.assign(p.blocks.blocks.find(b=>b.id===id),{kind,box});return p;};
   await f.repo.create(f.input);await f.repo.drain();assert.equal(f.state.calls,2,'Missing figure policy incorrectly failed after the first paid response');
   const input=f.inputs[1],p=input.pagePrompt,first=input.previous,fragment=first.fragments.find(f=>f.number==='1');
   const old=pageFragmentGroups(p.blocks,fragment.blockIds,true,p.cropGeometryPolicy),current=pageFragmentGroups(p.blocks,fragment.blockIds,true,p.cropGeometryPolicy,p.figureCropPolicy);assert(current.length>old.length);assert.equal(input.cropReview.questions[0].crops.length,current.length);assert(validCropReview(input.cropReview,first,p,input.cropReview.pageImageSha256));
   const before=f.db.prepare('SELECT input_json,first_json,final_json FROM material_ai_units').all();await new MaterialAiRepository(f.host).validate(await f.question());assert.deepEqual(f.db.prepare('SELECT input_json,first_json,final_json FROM material_ai_units').all(),before);
   for(const change of [r=>r.questions[0].crops.pop(),r=>r.questions[0].crops[0].box[0]+=.001,r=>r.questions[0].crops[0].blockIds=['block-5']]){const bad=structuredClone(input.cropReview);change(bad);assert(!validCropReview(bad,first,p,input.cropReview.pageImageSha256));}
   const alteredSha=structuredClone(input.cropReview);alteredSha.questions[0].crops[0].sha256='0'.repeat(64);assert(!validCropReviewImages(input.images,alteredSha));
  }finally{await f.dispose();}
 }));
 await check('Explicit failed-source retry retains the paid first response, original budget and source/crop guards',()=>enabled(async()=>{
  const f=await cropReviewFixture(),crop=f.repo.runtime.crop;try{
   f.repo.runtime.crop=async()=>{throw Error('source_changed');};const id=await f.repo.create(f.input);await f.repo.drain();const row=f.db.prepare('SELECT * FROM material_ai_units').get(),raw=row.first_json,config=f.db.prepare('SELECT config_json,calls FROM material_ai_batches').get();assert.equal(row.status,'failed');assert.equal(row.error,'source_changed');assert.equal(config.calls,1);assert(raw);
   assert(!validAiAction({...action(id),acceptDuplicateCharge:undefined}));await assert.rejects(()=>f.repo.action({...action(id),acceptDuplicateCharge:undefined}),/invalid_input/);
   await f.repo.action(action(id));assert.equal(f.db.prepare('SELECT first_json FROM material_ai_units').get().first_json,raw);assert.equal(f.db.prepare('SELECT config_json FROM material_ai_batches').get().config_json,config.config_json);
   f.repo.runtime.crop=crop;await f.repo.drain();assert.equal(f.state.calls,2);assert.equal(f.db.prepare('SELECT first_json FROM material_ai_units').get().first_json,raw);assert.equal(createHash('sha256').update(JSON.stringify(f.inputs[1].previous)).digest('hex'),createHash('sha256').update(raw).digest('hex'));await new MaterialAiRepository(f.host).validate(await f.question());
  }finally{await f.dispose();}
 }));
 await check('Still-invalid local source is refused again before another cloud dispatch',()=>enabled(async()=>{
  const f=await cropReviewFixture();try{f.repo.runtime.crop=async()=>{throw Error('source_changed');};const id=await f.repo.create(f.input);await f.repo.drain();const before=f.db.prepare('SELECT first_json FROM material_ai_units').get().first_json;await f.repo.action(action(id));await f.repo.drain();assert.equal(f.state.calls,1);assert.equal(f.db.prepare('SELECT status FROM material_ai_units').get().status,'failed');assert.equal(f.db.prepare('SELECT first_json FROM material_ai_units').get().first_json,before);}finally{await f.dispose();}
 }));
 await check('Retry updates the active folder projection atomically while paused or scope-changed grants remain unchanged',()=>enabled(async()=>{
  for(const [status,error,expected]of [['attention','','running'],['paused','','failed'],['attention','scope_changed','failed']]){
   const f=await cropReviewFixture();try{f.repo.runtime.crop=async()=>{throw Error('source_changed');};const id=await f.repo.create(f.input);await f.repo.drain();
    f.db.exec('CREATE TABLE material_folder_ai(batch_id TEXT PRIMARY KEY,status TEXT,error TEXT);CREATE TABLE material_folder_ai_units(batch_id TEXT,ai_batch_id TEXT,state TEXT,error TEXT)');f.db.prepare('INSERT INTO material_folder_ai VALUES(?,?,?)').run('folder-projection',status,error);f.db.prepare("INSERT INTO material_folder_ai_units VALUES(?,?,'failed','source_changed')").run('folder-projection',id);
    const first=f.db.prepare('SELECT first_json FROM material_ai_units').get().first_json;await f.repo.action(action(id));assert.equal(f.db.prepare('SELECT state FROM material_folder_ai_units').get().state,expected);const grant=f.db.prepare('SELECT status,error FROM material_folder_ai').get();assert.equal(grant.status,expected==='running'?'running':status);assert.equal(grant.error,error);assert.equal(f.db.prepare('SELECT first_json FROM material_ai_units').get().first_json,first);assert.equal(f.state.calls,1);
   }finally{await f.dispose();}
  }
 }));
 await check('Source retry cannot replay outcome-unknown, unrelated failure or exhausted budget',()=>enabled(async()=>{
  const f=await cropReviewFixture();try{f.repo.runtime.crop=async()=>{throw Error('source_changed');};const id=await f.repo.create(f.input);await f.repo.drain();for(const [status,error]of [['outcome_unknown','outcome_unknown'],['failed','invalid_response']]){f.db.prepare('UPDATE material_ai_units SET status=?,error=?').run(status,error);await assert.rejects(()=>f.repo.action(action(id)),/invalid_input/);assert.equal(f.db.prepare('SELECT status FROM material_ai_units').get().status,status);}f.db.prepare("UPDATE material_ai_units SET status='failed',error='source_changed'").run();const c=JSON.parse(f.db.prepare('SELECT config_json FROM material_ai_batches').get().config_json);f.db.prepare('UPDATE material_ai_batches SET calls=?').run(c.maxCalls);await assert.rejects(()=>f.repo.action(action(id)),/budget_exhausted/);assert.equal(f.state.calls,1);assert.equal(f.db.prepare('SELECT status FROM material_ai_units').get().status,'failed');}finally{await f.dispose();}
 }));
}
