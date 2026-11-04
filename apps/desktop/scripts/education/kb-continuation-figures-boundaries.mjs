import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import {performance} from 'node:perf_hooks';
import {fixture} from './kb-cross-page-boundaries.mjs';
import {MaterialAiRepository} from '../../src/main/assets/material-ai-repository.ts';
import {archiveEligible} from '../../src/shared/question-archive.ts';
import {CONTINUATION_FIGURE_CROPS,continuationCropGroups,continuationPrefix,validPageContinuation} from '../../src/shared/material-ai-continuation.ts';
import {validAiPagePrompt} from '../../src/shared/material-ai-page.ts';
import {readPageFragments,pageFragmentsAgree} from '../../src/main/assets/material-ai-page-fragments.ts';
import {editablePageFigures} from '../../src/main/assets/material-ai-page-presentation.ts';
import {LOCAL_OCR_ENGINE} from '../../src/shared/xiaozhi-ocr.ts';
import {compileRichPaperOffice} from '../../src/main/education/paper-rich-export.ts';

const prefix='(2)继续观察图甲和图乙，请判断物体的运动状态并说明理由。',tail=prefix+'\n图甲\n图乙';
const block=(n,box,kind='text')=>({id:'block-'+n,box,kind,score:.99,needsReview:true});
async function figureFixture({textProof=true,unlabeled=false}={}){
 const f=await fixture({prefixText:unlabeled?prefix:tail});f.db.prepare("UPDATE material_folder_ai SET processing_mode='quality'").run();
 const originalBlocks=f.repo.runtime.blocks;
 f.repo.runtime.blocks=async s=>{
  const p=await originalBlocks(s);if(s.page===1)return p;
  p.blocks.blocks=[block(1,[.1,.1,.8,.2]),block(2,[.1,.26,.4,.42],'image'),block(3,[.5,.26,.8,.42],'image'),block(4,[.1,.6,.8,.7])];
  p.lines=[];p.blockTexts=[prefix,unlabeled?'':'图甲',unlabeled?'':'图乙','2. 下一道题的完整题干。'].map((text,i)=>({blockId:'block-'+(i+1),text}));return p;
 };
 let rendered;const crop=f.repo.runtime.crop;
 f.repo.runtime.crop=async(s,box,signal)=>{rendered={s,box};const v=await crop(s,box,signal);return {...v,assetId:v.assetId.replace(/^asset_./,'asset_'+s.page)};};
 f.repo.runtime.inspectCrop=async()=>{
  f.inspections++;const p=await f.repo.runtime.blocks(rendered.s),box=rendered.box;
  const ids=p.blocks.blocks.filter(b=>b.box[0]>=box[0]&&b.box[1]>=box[1]&&b.box[2]<=box[2]&&b.box[3]<=box[3]).map(b=>b.id);
  return {schemaVersion:'xiaozhi.material-ai-crop-quality.v1',engine:LOCAL_OCR_ENGINE,text:unlabeled&&rendered.s.page===2&&ids.every(id=>['block-2','block-3'].includes(id))?'_':p.blockTexts.filter(h=>ids.includes(h.blockId)).map(h=>h.text.replace(/^1\. /,'')).join('\n'),clearEdges:[true,true,true,true]};
 };
 if(textProof){
  f.host.inspectContinuationText=async extra=>({schemaVersion:'continuation-text.v1',lines:extra.text.split('\n').map((text,i)=>({text,box:[.01,.02+i*.25,.99,.2+i*.25]})),gaps:[]});
 }
 f.cold=async()=>{
  const u=f.db.prepare('SELECT * FROM material_ai_units').get(),unit=JSON.parse(u.input_json);
  const crops=await readPageFragments(f.host,f.batch,1,unit.pageSource,JSON.parse(u.first_json),u.first_json,u.image_sha,new AbortController().signal,undefined,unit.pagePrompt);
  return {u,unit,prompt:unit.pagePrompt,crops};
 };
 return f;
}
let passed=0;const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
await check('New default executor archives both next-page diagrams; frozen text proof covers all ordered next-page OCR',async()=>{
 const f=await figureFixture();try{
  await f.create();await f.finish();const q=await f.question();assert(archiveEligible(q),JSON.stringify(q));
  const {u,prompt,crops}=await f.cold();assert.equal(prompt.continuationCropPolicy,CONTINUATION_FIGURE_CROPS);assert(validAiPagePrompt(prompt));assert.equal(prompt.continuation.schemaVersion,'page-continuation.v2');
  assert.equal(crops[0].fragments.length,4);assert.deepEqual(crops[0].fragments.filter(c=>c.kind==='diagram').map(c=>c.blockIds),[['next:block-2'],['next:block-3']]);
  assert.deepEqual(editablePageFigures(crops[0],prompt,JSON.parse(u.final_json).questions[0]),['source_question_2','source_question_3']);
  assert.deepEqual(q.document.context.illustrations,{schemaVersion:'xiaozhi.question-illustrations.v1',complete:true,blockIds:['source_question_2','source_question_3']});
  assert(q.document.blocks.filter(b=>b.kind==='image').slice(1).every(b=>b.anchors[0].page===2));
  assert.equal(f.state.calls,3);await new MaterialAiRepository(f.host).validate(q);assert.equal(f.state.calls,3);
  const snapshot={id:'xipaper_'+crypto.randomUUID(),digest:'a'.repeat(64),title:'跨页题',totalPoints:10,blueprint:{grade:'九年级',subject:'物理',durationMinutes:10,sections:[{id:'one',label:'实验题'}]},selection:{items:[{question:q,sectionId:'one',number:1,points:10,source:{version:'b'.repeat(64)}}]}};
  const student=compileRichPaperOffice(snapshot,'student'),teacher=compileRichPaperOffice(snapshot,'teacher');
  assert.equal(student.sections.flatMap(s=>s.figures||[]).length,4);assert(!JSON.stringify(student).includes(q.answer));assert(JSON.stringify(teacher).includes(q.answer));
  const before=f.db.prepare('SELECT input_json,first_json,final_json FROM material_ai_units').get();await f.repo.recoverStartup();await f.cold();assert.deepEqual(f.db.prepare('SELECT input_json,first_json,final_json FROM material_ai_units').get(),before);assert.equal(f.state.calls,3);
 }finally{await f.dispose();}
});
await check('Missing or reordered independent next-page OCR cannot pass the complete continuation proof',async()=>{
 const f=await figureFixture();try{await f.create();await f.finish();const {u,prompt,crops}=await f.cold(),response=JSON.parse(u.final_json),first=JSON.parse(f.db.prepare('SELECT review_json FROM material_ai_page_verifications').get().review_json),stem=response.questions[0].stem;
  assert(pageFragmentsAgree(first,response,'1',crops,stem,prompt));
  for(const change of [c=>{c.fragments[1].quality.text=prefix.replace('运动状态','状态');},c=>{[c.fragments[2].quality,c.fragments[3].quality]=[c.fragments[3].quality,c.fragments[2].quality];},c=>{c.fragments[2].quality.text='';},c=>{c.fragments[2].quality.text='_';},c=>{c.fragments[3].quality.text+='\n下一题文字';}]){const bad=structuredClone(crops);change(bad[0]);assert(!pageFragmentsAgree(first,response,'1',bad,stem,prompt));}
 }finally{await f.dispose();}
});
await check('Wrong next-page boxes, page/version identities, missing groups and foreign IDs fail cold authentication',async()=>{
 const f=await figureFixture();try{await f.create();await f.finish();const row=f.db.prepare('SELECT * FROM material_ai_page_crops').get();
  for(const change of [v=>{v.fragments[1].image.box[0]=0;},v=>{v.fragments[1].image.page=1;},v=>{v.fragments[1].image.version='f'.repeat(64);},v=>{v.fragments.pop();},v=>{v.fragments[2].blockIds=['next:block-4'];},v=>{[v.fragments[2],v.fragments[3]]=[v.fragments[3],v.fragments[2]];}]){
   const v=JSON.parse(row.image_json);change(v);f.db.prepare('UPDATE material_ai_page_crops SET image_json=?').run(JSON.stringify(v));await assert.rejects(f.cold(),/source_changed/);
  }
  f.db.prepare('UPDATE material_ai_page_crops SET image_json=?').run(row.image_json);
  const {prompt}=await f.cold(),file=path.join(f.root,'question-assets/v1',prompt.continuation.image.assetId+'.png'),bytes=await fs.readFile(file);await fs.writeFile(file,Buffer.from('corrupt prefix'));await assert.rejects(f.cold(),/unavailable/);await fs.writeFile(file,bytes);await f.cold();
 }finally{await f.dispose();}
});
await check('Optional policy is exact, cannot apply without frozen continuation, and does not reinterpret old receipts',async()=>{
 const f=await figureFixture();try{await f.create();await f.finish();const {prompt,crops,u}=await f.cold(),{continuationCropPolicy,...old}=prompt;
  assert(validAiPagePrompt(old));assert.equal(continuationCropGroups(old,['block-1'],'1').length,2);assert.equal(editablePageFigures(crops[0],old,JSON.parse(u.final_json).questions[0]),undefined);
  for(const patch of [{continuationCropPolicy:'future'},{continuation:undefined},{figureCropPolicy:undefined},{cropGeometryPolicy:undefined},{policy:'page-fragments.v2'}])assert(!validAiPagePrompt({...prompt,...patch}));
  assert.equal(continuationCropGroups(old,['block-1'],'1').at(-1).box,prompt.continuation.image.box);
 }finally{await f.dispose();}
});
await check('A legacy whole-prefix task remains readable, opaque and byte-bound with no extra model calls',async()=>{
 const f=await figureFixture({textProof:false});try{
  await f.create();const row=f.db.prepare('SELECT input_json FROM material_ai_units').get(),input=JSON.parse(row.input_json);delete input.pagePrompt.continuationCropPolicy;f.db.prepare('UPDATE material_ai_units SET input_json=?').run(JSON.stringify(input));
  await f.finish();const q=await f.question();assert(archiveEligible(q));const {crops,prompt}=await f.cold();assert.equal(crops[0].fragments.length,2);assert.equal(crops[0].fragments[1].image.sha256,prompt.continuation.image.sha256);assert.equal(q.document.context.illustrations.complete,false);assert.equal(f.state.calls,3);await new MaterialAiRepository(f.host).validate(q);
 }finally{await f.dispose();}
});
const timings=[];
await check('Unlabeled diagram stroke artifacts do not become body text; digits, units, minus signs and actual labels are never discarded',async()=>{
 const f=await figureFixture({unlabeled:true});try{await f.create();await f.finish();const q=await f.question();assert(archiveEligible(q),JSON.stringify(q));const {u,prompt,crops}=await f.cold(),first=JSON.parse(f.db.prepare('SELECT review_json FROM material_ai_page_verifications').get().review_json),final=JSON.parse(u.final_json);
  assert.equal(crops[0].fragments[2].quality.text,'_');
  for(const text of ['2','I','I=2A','100℃','-','图甲','下一题正文','_'.repeat(65)]){const bad=structuredClone(crops);bad[0].fragments[2].quality.text=text;assert(!pageFragmentsAgree(first,final,'1',bad,q.stem,prompt),text);}
  const legacy=structuredClone(prompt);delete legacy.continuationCropPolicy;assert(!pageFragmentsAgree(first,final,'1',crops,q.stem,legacy));assert.equal(f.state.calls,3);
 }finally{await f.dispose();}
});
await check('A failed next-page local OCR recovers through the original recheck journal without replacing paid receipts',async()=>{
 const f=await figureFixture();try{const inspect=f.repo.runtime.inspectCrop;let once=true;f.repo.runtime.inspectCrop=async(...args)=>{if(once&&f.inspections===2){once=false;throw Error('ocr_failed');}return inspect(...args);};
  await f.create();await f.finish();assert(!archiveEligible(await f.question()));const original=f.db.prepare('SELECT input_json,first_json,final_json FROM material_ai_units').get(),base=f.db.prepare('SELECT * FROM material_ai_page_crops').get();
  assert.equal(JSON.parse(base.image_json).blockId,'next:block-2');await f.repo.action({schemaVersion:'xiaozhi.material-ai.v1',batchId:f.batch,action:'recheck_local'});await f.finish();assert(archiveEligible(await f.question()));await f.cold();
  assert.equal(f.state.calls,3);assert.deepEqual(f.db.prepare('SELECT input_json,first_json,final_json FROM material_ai_units').get(),original);assert.deepEqual(f.db.prepare('SELECT * FROM material_ai_page_crops').get(),base);await new MaterialAiRepository(f.host).validate(await f.question());
 }finally{await f.dispose();}
});
await check('Two pages compete for eight slots without losing any block or swallowing the following question',async()=>{
 const f=await figureFixture();try{await f.create();const {pagePrompt:p}=JSON.parse(f.db.prepare('SELECT input_json FROM material_ai_units').get().input_json);
  p.blocks.blocks=Array.from({length:8},(_,i)=>block(i+1,[.1,.04+i*.1,.8,.08+i*.1],i===2?'image':'text'));
  const ids=p.blocks.blocks.map(b=>b.id),nextIds=p.continuation.blockIds.map(id=>'next:'+id);
  for(let i=0;i<20;i++){const start=performance.now(),g=continuationCropGroups(p,ids,'1');timings.push(performance.now()-start);assert.equal(g.length,8);assert.deepEqual(g.flatMap(g=>g.blockIds),[...ids,...nextIds]);assert.deepEqual(g.filter(g=>g.source&&g.blockIds.some(id=>['next:block-2','next:block-3'].includes(id))).map(g=>g.blockIds),[['next:block-2'],['next:block-3']]);assert(g.filter(g=>g.source).every(g=>g.box[3]<.6));}
  const overlap=structuredClone(p);overlap.continuation.blocks.blocks[3].box=[.2,.3,.7,.5];assert.throws(()=>continuationCropGroups(overlap,ids,'1'),/source_incomplete/);
  const mixed=structuredClone(p);mixed.continuation.blocks.blocks[1].box=[.1,.18,.4,.42];const groups=continuationCropGroups(mixed,ids,'1');assert(groups.some(g=>g.blockIds.includes('next:block-1')&&g.blockIds.includes('next:block-2')));
 }finally{await f.dispose();}
});
const maximumTimings={legacy:[],subcrops:[]};
await check('Maximum 32-owned-of-256 layouts on both pages preserve all 64 IDs within eight crops',async()=>{
 const f=await figureFixture();try{await f.create();const {pagePrompt:p}=JSON.parse(f.db.prepare('SELECT input_json FROM material_ai_units').get().input_json);
  const grid=()=>Array.from({length:256},(_,i)=>{const x=(i%16)/16,y=Math.floor(i/16)/16;return block(i+1,[x+.01,y+.01,x+.04,y+.04],i%5===0?'image':'text');});
  p.blocks.blocks=grid();p.continuation.blocks.blocks=grid();p.continuation.blockIds=p.continuation.blocks.blocks.slice(0,32).map(b=>b.id);p.continuation.image.box=[0,0,1,.12];
  const selected=p.blocks.blocks.slice(0,32).map(b=>b.id),{continuationCropPolicy,...old}=p;
  for(let i=0;i<12;i++)for(const [name,input]of [['legacy',old],['subcrops',p]]){const start=performance.now(),g=continuationCropGroups(input,selected,'1');maximumTimings[name].push(performance.now()-start);assert(g.length<=8);assert.deepEqual(g.flatMap(g=>g.blockIds),[...selected,...p.continuation.blockIds.map(id=>'next:'+id)]);}
 }finally{await f.dispose();}
});
const stats=v=>({median:v.toSorted((a,b)=>a-b)[Math.floor(v.length/2)],max:Math.max(...v)});
console.log(JSON.stringify({success:true,passed,timingsMs:stats(timings),maximumLayoutTimingsMs:Object.fromEntries(Object.entries(maximumTimings).map(([k,v])=>[k,stats(v)])),scope:'Real production executor/SQLite/cold source and Office projection with controlled layout, PNG and OCR; prior legacy suites also run. No provider request or natural corpus accuracy claim.'}));
