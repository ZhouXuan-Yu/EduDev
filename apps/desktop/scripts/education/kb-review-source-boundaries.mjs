import assert from 'node:assert/strict';
import {reviewPageCrop} from '../../src/main/assets/material-ai-review-source.ts';
import {OriginalQuestionRepository} from '../../src/main/education/original-question-repository.ts';
import {QuestionAssets} from '../../src/main/assets/question-assets.ts';
import {questionVersion} from '../../src/main/education/question-context-provider.ts';
import {archiveEligible} from '../../src/shared/question-archive.ts';

export async function runReviewSourceChecks({check,cropReviewFixture,MaterialAiRepository}){
 await check('Held source pixels are readable in the teacher gallery without a complete document, provider call or Pi/Office authority',async()=>{
  const f=await cropReviewFixture('figure_mismatch');try{
   await f.repo.create(f.input);await f.repo.drain();const q=await f.question(),before=JSON.stringify(f.db.prepare('SELECT * FROM question_bank_items').all()),paid=JSON.stringify(f.db.prepare('SELECT input_json,first_json,final_json FROM material_ai_units').all());
   assert.equal(q.archive.ai.policy,'page-image-complete.v1');assert.equal(q.archive.state,'ai_needs_review');assert(!q.document);assert(!archiveEligible(q));
   const cold=new MaterialAiRepository(f.host);let reads=0;
   const repo=new OriginalQuestionRepository({...f.host,read:()=>f.question(),automatic:(q,s)=>cold.automaticSource(q,s),reviewImages:(q,s)=>{reads++;return cold.reviewSourceImages(q,s);}},f.host.materials,new QuestionAssets(f.host.root),()=>{throw Error('No render during review');});
   const images=await repo.questionImages(q.id,questionVersion(q));assert.equal(images.length,3);assert(images.every(i=>i.dataUrl.startsWith('data:image/png;base64,')));assert.equal(reads,1);
   await assert.rejects(repo.context(q.id,questionVersion(q)),/document_context_unavailable/);await assert.rejects(repo.officeImages(q.id,questionVersion(q)),/document_context_unavailable/);assert.equal(reads,1);assert.equal(await cold.automaticSource(q,new AbortController().signal),undefined);
   assert.equal(JSON.stringify(f.db.prepare('SELECT * FROM question_bank_items').all()),before);assert.equal(JSON.stringify(f.db.prepare('SELECT input_json,first_json,final_json FROM material_ai_units').all()),paid);assert.equal(f.state.calls,2);
   await assert.rejects(repo.questionImages(q.id,'0'.repeat(64)),/source_changed/);assert.equal(reads,1);
   f.db.prepare("UPDATE material_ai_page_units SET first_sha=?").run('0'.repeat(64));await assert.rejects(repo.questionImages(q.id,questionVersion(q)),/source_changed/);assert.equal(f.state.calls,2);
  }finally{await f.dispose();}
 });
 await check('Review ownership rejects changed or incomplete selections, missing numbers and failed crops without testing away OCR doubts',()=>{
  const pass={schemaVersion:'xiaozhi.material-ai-page-fragments.v1',outcome:'questions',questions:[{number:'2'}],fragments:[{number:'2',complete:true,blockIds:['block-1','block-2']}]};
  const crop={number:'2',fragments:[{blockId:'block-1'},{blockId:'block-2'}]},before=JSON.stringify([pass,crop]);assert.equal(reviewPageCrop('2',pass,undefined,pass,[crop]),crop);
  for(const change of [p=>p.fragments[0].blockIds.reverse(),p=>p.fragments[0].complete=false,p=>p.questions[0].number='3',p=>p.schemaVersion='xiaozhi.material-ai-page-response.v1']){const bad=structuredClone(pass);change(bad);assert.equal(reviewPageCrop('2',pass,undefined,bad,[crop]),undefined);assert.equal(reviewPageCrop('2',pass,bad,pass,[crop]),undefined);}
  assert.equal(reviewPageCrop('1',pass,undefined,pass,[crop]),undefined);assert.equal(reviewPageCrop('2',pass,undefined,pass,[{...crop,failure:{error:'ocr_failed'}}]),undefined);assert.equal(reviewPageCrop('2',pass,undefined,pass,[{...crop,fragments:crop.fragments.slice(1)}]),undefined);assert.equal(JSON.stringify([pass,crop]),before);
 });
 await check('Review-source stop switch cannot enable formal source access or rewrite old review receipts',async()=>{
  const f=await cropReviewFixture('figure_mismatch'),old=process.env.OMNI_EDU_AI_REVIEW_SOURCE_IMAGES;try{await f.repo.create(f.input);await f.repo.drain();const q=await f.question();process.env.OMNI_EDU_AI_REVIEW_SOURCE_IMAGES='0';assert.equal(await f.repo.reviewSourceImages(q,new AbortController().signal),undefined);assert.equal(await f.repo.automaticSource(q,new AbortController().signal),undefined);assert.equal(f.state.calls,2);}finally{if(old===undefined)delete process.env.OMNI_EDU_AI_REVIEW_SOURCE_IMAGES;else process.env.OMNI_EDU_AI_REVIEW_SOURCE_IMAGES=old;await f.dispose();}
 });
}
