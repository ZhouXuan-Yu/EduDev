import {checkedPageCropImage} from '../../src/main/assets/material-ai-page-crops.ts';
import {IMAGE_PAGE_ENGINE,PDF_PAGE_ENGINE} from '../../src/shared/material-page-preview.ts';
import {randomUUID} from 'node:crypto';
import assert from 'node:assert/strict';
import {sourceTextSignature} from '../../src/shared/material-ai-source-reading.ts';
import {SOURCE_CONTENT_ROLES,SOURCE_CONTENT_RESPONSE,contentPartRoles,sourceContentPrompt} from '../../src/shared/material-ai-source-content.ts';
import {validSourceParts,publicationPrefix,sourcePartRanges} from '../../src/shared/question-source-content.ts';
import {validQuestionDocument} from '../../src/shared/question-document.ts';
import {validAiPagePrompt,parseAiPageResponse} from '../../src/shared/material-ai-page.ts';
import {pageFragmentGroups} from '../../src/shared/material-ai-page-fragments.ts';
import {archiveEligible} from '../../src/shared/question-archive.ts';
import {completeMaterialAi} from '../../src/main/assets/material-ai-provider.ts';
import {RetrievalRepository} from '../../src/main/retrieval/repository.ts';
export async function runSourceContentChecks({check,cropReviewFixture,MaterialAiRepository}){
 await check('Image crop receipt is engine-bound and page-one-only; PDF authority cannot be borrowed',()=>{
  const source={schemaVersion:'xiaozhi.material-image-source.v1',resourceId:'resource_'+randomUUID(),version:'a'.repeat(64),page:1},box=[0,0,1,1],image={schemaVersion:'xiaozhi.material-page-preview.v1',ok:true,requestId:randomUUID(),resourceId:source.resourceId,version:source.version,engine:IMAGE_PAGE_ENGINE,assetId:'asset_'+randomUUID(),page:1,total:1,box,width:100,height:100,sha256:'b'.repeat(64)};
  assert.equal(checkedPageCropImage(image,source,box),image);
  for(const changed of [{engine:PDF_PAGE_ENGINE},{total:2},{page:2},{version:'c'.repeat(64)}])assert.throws(()=>checkedPageCropImage({...image,...changed},source,box),/source_changed/);
  assert.throws(()=>checkedPageCropImage(image,{...source,schemaVersion:'xiaozhi.material-page-source.v1'},box),/source_changed/);
 });
 const keys=['OMNI_EDU_AI_SOURCE_READING','OMNI_EDU_AI_SOURCE_CONTENT_ROLES','OMNI_EDU_AI_CORRECTION_REVIEW','OMNI_EDU_AI_BLIND_ANSWERS','OMNI_EDU_AI_CROP_BODY_TEXT','OMNI_EDU_AI_CHOICE_CONCORDANCE','OMNI_EDU_AI_OWNED_CROP_MARGINS'];
 const enabled=async fn=>{const old=keys.map(k=>process.env[k]);keys.forEach(k=>process.env[k]='1');try{return await fn();}finally{keys.forEach((k,i)=>{if(old[i]===undefined)delete process.env[k];else process.env[k]=old[i];});}};
 const body='如图所示物体移动，计算七加八的结果。',second='计算九加九的结果。',citation='「2025某省中考，★☆☆」';
 async function fixture(change=()=>{}){
  const f=await cropReviewFixture(),complete=f.repo.runtime.complete;let index=0;f.raw=[];f.ocr=[];
  f.repo.runtime.inspectCrop=async()=>({schemaVersion:'xiaozhi.material-ai-crop-quality.v1',engine:'rapidocr-3.9.2-ort-1.30.0-ppocrv6-small.v1',text:f.ocr[index++],clearEdges:[true,true,true,true]});
  f.repo.runtime.complete=async input=>{
   const r=JSON.parse(await complete(input));r.schemaVersion=SOURCE_CONTENT_RESPONSE;r.questions[0].stem=body;r.questions[0].projection.statement.text=body;r.questions[0].projection.figures.text='图中标有七与八\n图1';
   r.questions[1].stem=second;r.questions[1].projection.statement.text=second;
   r.pageText='第1题 '+citation+body+'\n图中标有七与八\n图1\n第2题 '+second+'\n印刷页脚：本书资料来源与版权说明。';
   if(!input.previous)f.ocr=r.fragments.flatMap(row=>pageFragmentGroups(input.pagePrompt.blocks,row.blockIds,true,input.pagePrompt.cropGeometryPolicy,input.pagePrompt.figureCropPolicy).map(g=>g.blockIds.includes('block-1')?'1. '+citation+body:g.blockIds.includes('block-5')?second:g.blockIds.map(id=>id==='block-2'?'图中标有七与八':'图1').join('\n')));
   if(input.previous&&!input.verification)for(const q of r.questions)for(const role of ['answer','analysis']){q[role]='';q[role+'Origin']='missing';}
   r.readings=input.cropReview?input.cropReview.questions.map(row=>({number:row.number,crops:row.crops.map(c=>({sha256:c.sha256,ocrSha256:c.ocrSha256,text:c.text,assessment:'exact',issues:[],parts:c.blockIds.includes('block-1')?[{role:'marker',text:'1. '},{role:'publication',text:citation},{role:'body',text:body}]:[{role:c.blockIds.includes('block-5')?'body':'figure',text:c.text}]}))})):[];
   change(r,input,f);const raw=JSON.stringify(r);f.raw.push(raw);return raw;
  };
  f.input.maxCalls=3;f.run=async()=>{f.batch=await f.repo.create(f.input);await f.repo.drain();await f.repo.drain();};return f;
 }
 await check('Lossless source partitions preserve whitespace and UTF16 ranges, and reject deletion, unknown roles and body conditions disguised as publication',()=>{
  const text='😀 题面\n原文',parts=[{role:'body',text:'😀 '},{role:'body',text:'题面\n原文'}];assert(validSourceParts(parts,text));assert.deepEqual(sourcePartRanges({text,parts}).map(p=>[p.start,p.end]),[[0,3],[3,text.length]]);assert(!validSourceParts(parts,text+'漏字'));assert(!validSourceParts([{role:'footer',text}],text));assert(!publicationPrefix('「水温20℃且不是匀速」'));assert(!publicationPrefix('「2025某省中考，20℃」'));assert(!publicationPrefix('核心素养'+citation));assert(contentPartRoles([{role:'publication',text:citation},{role:'body',text:body}],citation+body,'1',true,false));assert(!contentPartRoles([{role:'body',text:body},{role:'publication',text:citation}],body+citation,'1',true,false));assert(!contentPartRoles([{role:'publication',text:citation},{role:'figure',text:'20℃'}],citation+'20℃','1',true,true));
 });
 await check('Actual executor archives owned body and figure separately from publication and page furniture; cold source document retains both raw readings',()=>enabled(async()=>{
  const f=await fixture();try{await f.run();assert.equal(f.state.calls,3);const p=f.inputs[0].pagePrompt;assert.equal(p.sourceContentPolicy,SOURCE_CONTENT_ROLES);assert(validAiPagePrompt(p));assert(!validAiPagePrompt({...p,sourceContentPolicy:'future'}));assert.equal(sourceContentPrompt(p,false),p);const q=await f.question();assert(archiveEligible(q),JSON.stringify(q.archive));assert.equal(q.stem,body);assert(validQuestionDocument(q.document));assert.equal(q.document.context.sourceContent.crops[0].readings[0].text,'1. '+citation+body);assert.equal(q.document.context.sourceContent.crops[0].readings[1].parts[1].text,citation);assert(!q.document.context.projection.statement.text.includes('页脚'));const original=f.db.prepare('SELECT input_json,first_json,final_json FROM material_ai_units').get();await new MaterialAiRepository(f.host).validate(q);assert.deepEqual(f.db.prepare('SELECT input_json,first_json,final_json FROM material_ai_units').get(),original);assert.equal(original.final_json,f.raw[2]);}finally{await f.dispose();}
 }));
 await check('Publication disagreement retains both texts and a teacher-visible review status without changing authenticated body or math',()=>enabled(async()=>{
  const f=await fixture((r,i)=>{if(i.verification){const c=r.readings[0].crops[0];c.parts[1].text='「2025某省中考，★★☆」';c.text=c.parts.map(p=>p.text).join('');c.assessment='corrected';r.pageText=r.pageText.replace(citation,c.parts[1].text);}});try{await f.run();const q=await f.question();assert(archiveEligible(q),JSON.stringify(q.archive));assert.notEqual(q.document.context.sourceContent.crops[0].readings[0].text,q.document.context.sourceContent.crops[0].readings[1].text);const view=await f.repo.page({schemaVersion:'xiaozhi.material-ai-page.v1',batchId:f.batch,ordinal:1});assert.equal(view.sourceReadings[0].crops[0].publicationStatus,'needs_review');assert(!view.sourceReadings[0].crops[0].agrees);await new MaterialAiRepository(f.host).validate(q);}finally{await f.dispose();}
 }));
 await check('Source-role provider uses v2 for all phases and preserves the independent source-only transport',()=>enabled(async()=>{
  const f=await fixture(),old=globalThis.fetch;try{await f.run();let n=0;const requests=[];globalThis.fetch=async(_u,o)=>{requests.push(JSON.parse(o.body));return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:f.raw[++n]}}]}));};for(const i of [1,2])await completeMaterialAi({...f.inputs[i],apiKey:'controlled-key'},new AbortController().signal);assert(requests.every(r=>r.messages[0].content.includes(SOURCE_CONTENT_RESPONSE)));const source=JSON.parse(requests[0].messages[1].content[0].text);assert(!source.firstDraft.questions[0].stem);assert(!source.firstDraft.questions[0].answer);assert(!('readings'in source.firstDraft));assert(requests[0].messages[0].content.includes('绝对不解题'));}finally{globalThis.fetch=old;await f.dispose();}
 }));
 for(const mode of ['delete','body_mismatch','inline_metadata','diagram_metadata','missing_publication'])await check('Source roles refuse '+mode+' without granting source or indexing authority',()=>enabled(async()=>{
  const f=await fixture((r,i)=>{if(i.verification){const c=r.readings[0].crops[0];if(mode==='delete')c.parts[2].text=body.replace('七','');if(mode==='body_mismatch'){c.parts[2].text=body.replace('七','九');c.text=c.parts.map(p=>p.text).join('');c.assessment='corrected';}if(mode==='inline_metadata'){c.parts=[{role:'marker',text:'1. '},{role:'body',text:citation},{role:'publication',text:body}];}if(mode==='diagram_metadata')r.readings[0].crops[1].parts[0].role='publication';if(mode==='missing_publication'){c.parts[1].role='body';r.questions[0].stem=citation+body;r.questions[0].projection.statement.text=r.questions[0].stem;}}});try{await f.run();const q=await f.question();if(mode==='delete'){assert(!q);assert.equal(f.db.prepare('SELECT error FROM material_ai_units').get().error,'invalid_response');}else{assert(!archiveEligible(q));assert(!q.document);await new MaterialAiRepository(f.host).validate(q);}}finally{await f.dispose();}
 }));
 await check('Retrieval reuses strict v2 authentication and rejects tampering with the retained publication source document',()=>enabled(async()=>{
  const f=await fixture();try{await f.run();const q=await f.question();f.db.exec('CREATE TABLE retrieval_current(kind TEXT,object_id TEXT,seq INTEGER);CREATE TABLE retrieval_source_revisions(resource_id TEXT,revision INTEGER);');const cold=new MaterialAiRepository(f.host),retrieval=new RetrievalRepository({...f.host,question:()=>q,fullText:()=>({}),keyword:async()=>[],validatePageQuestion:async saved=>cold.validate(saved)});assert(!(await retrieval.fact('question',q.id)).fact.deleted);q.document.context.sourceContent.crops[0].readings[0].parts[1].text='「2024另一省期末」';assert((await retrieval.fact('question',q.id)).fact.deleted);}finally{await f.dispose();}
 }));
 await check('An OCR-empty owned diagram keeps its image and figure role; empty text never certifies a text-only replacement',()=>enabled(async()=>{
  for(const hide of [false,true]){const f=await fixture((r,i,f)=>{if(!i.previous)f.ocr[1]='';else for(const row of r.readings)for(const c of row.crops)if(!c.text)c.parts=[];if(hide&&i.previous){r.questions[0].requiresImage=false;r.questions[0].projection.figures={state:'not_applicable',text:''};}});try{await f.run();const q=await f.question();assert.equal(archiveEligible(q),!hide,JSON.stringify(q.archive));if(!hide){assert(q.document.context.sourceContent.crops.some(c=>c.readings.every(r=>r.text===''&&r.parts.length===0)));assert(q.document.blocks.filter(b=>b.kind==='image').length>=2);await new MaterialAiRepository(f.host).validate(q);}else assert(!q.document);}finally{await f.dispose();}}
 }));
 await check('Disabling new source-content tasks retains frozen v2 cold readers and original receipts',()=>enabled(async()=>{
  const f=await fixture();try{await f.run();const q=await f.question(),before=f.db.prepare('SELECT * FROM material_ai_units').all();process.env.OMNI_EDU_AI_SOURCE_CONTENT_ROLES='0';await new MaterialAiRepository(f.host).validate(q);assert.deepEqual(f.db.prepare('SELECT * FROM material_ai_units').all(),before);assert.equal(f.state.calls,3);}finally{await f.dispose();}
 }));
}
