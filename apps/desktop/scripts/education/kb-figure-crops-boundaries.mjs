import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {createHash,randomUUID} from 'node:crypto';
import {performance} from 'node:perf_hooks';
import {MATERIAL_FIGURE_CROPS,MATERIAL_OWNED_CROP_GEOMETRY,isDiagramGroup,ownedPageFragmentGroups} from '../../src/shared/material-ai-owned-crops.ts';
import {PAGE_BLOCKS_SCHEMA,PAGE_BLOCKS_ENGINE} from '../../src/shared/material-page-blocks.ts';
import {validAiPagePrompt} from '../../src/shared/material-ai-page.ts';
import {LOCAL_OCR_ENGINE} from '../../src/shared/xiaozhi-ocr.ts';
import {pageCropStorage,pageFragmentsDocument,preparePageFragments,readPageFragments} from '../../src/main/assets/material-ai-page-fragments.ts';
import {compileRichPaperOffice} from '../../src/main/education/paper-rich-export.ts';
import {resolvePaperOfficeImages} from '../../src/main/education/paper-office-images.ts';
import {QuestionAssets} from '../../src/main/assets/question-assets.ts';

const sha=v=>createHash('sha256').update(v).digest('hex');
const block=(i,box,kind='text')=>({id:'block-'+i,box,kind,score:.99,needsReview:true});
const page=blocks=>({schemaVersion:PAGE_BLOCKS_SCHEMA,ok:true,engine:PAGE_BLOCKS_ENGINE,rasterSha256:sha('controlled raster'),width:1696,height:2400,blocks});
const prompt=blocks=>({policy:'page-fragments.v3',ocrStatus:'complete',totalPages:1,resourceTitle:'local.pdf',blocks,blockTexts:blocks.blocks.map(b=>({blockId:b.id,text:''})),cropGeometryPolicy:MATERIAL_OWNED_CROP_GEOMETRY,figureCropPolicy:MATERIAL_FIGURE_CROPS});
const layout=page([block(1,[.1,.05,.8,.08]),block(2,[.1,.081,.8,.1],'image'),...Array.from({length:7},(_,i)=>block(i+3,[.1,.2+i*.1,.8,.22+i*.1]))]);
const ids=layout.blocks.map(b=>b.id),intersects=(a,b)=>Math.min(a[2],b[2])-Math.max(a[0],b[0])>1e-6&&Math.min(a[3],b[3])-Math.max(a[1],b[1])>1e-6;
const intact=(p,chosen,groups)=>{assert(groups.length<=8);assert.deepEqual(groups.flatMap(g=>g.blockIds),chosen);for(const g of groups)for(const b of p.blocks){if(g.blockIds.includes(b.id))assert(g.box[0]<=b.box[0]&&g.box[1]<=b.box[1]&&g.box[2]>=b.box[2]&&g.box[3]>=b.box[3]);else assert(!intersects(g.box,b.box));}};
let passed=0;const check=async(name,fn)=>{await fn();passed++;console.log('PASS '+name);};
await check('New policy preserves an independent diagram when the eight-image budget requires text coalescing',()=>{
 const old=ownedPageFragmentGroups(layout,ids),next=ownedPageFragmentGroups(layout,ids,8,true);
 assert(old.some(g=>g.blockIds.includes('block-2')&&g.blockIds.length>1));
 assert.deepEqual(next.find(g=>g.blockIds.includes('block-2')).blockIds,['block-2']);intact(layout,ids,next);assert.equal(next.length,8);
});
await check('Overlapping figure captions stay intact; inseparable body text stays an honest source crop',()=>{
 for(const kind of ['figure_title','text']){const p=page([block(1,[.1,.1,.5,.5],'image'),block(2,[.2,.48,.3,.55],kind)]),g=ownedPageFragmentGroups(p,['block-1','block-2'],8,true);assert.equal(g.length,1);intact(p,['block-1','block-2'],g);assert.equal(isDiagramGroup(p,g[0].blockIds),kind==='figure_title');}
});
await check('Foreign overlapping questions cannot enter a diagram crop',()=>{
 const p=page([block(1,[.1,.1,.5,.5],'image'),block(2,[.3,.3,.7,.7])]);assert.throws(()=>ownedPageFragmentGroups(p,['block-1'],8,true),/source_incomplete/);
});
await check('Policy is versioned, requires owned geometry, and preserves old prompts',()=>{
 const next=prompt(layout),{figureCropPolicy,...old}=next;assert(validAiPagePrompt(next));assert(validAiPagePrompt(old));
 for(const value of [{...next,figureCropPolicy:'future'},{...next,cropGeometryPolicy:undefined},{...next,policy:'page-fragments.v2'},{...next,teacherApproved:true}])assert(!validAiPagePrompt(value));
 assert(validAiPagePrompt({...next,sourceCropPolicy:'complete-text.v1',cropReviewPolicy:'local-crop-review.v3'}));
});
await check('Original asset journal round-trips diagram identity, keeps old inputs unchanged and rejects forged image metadata',async()=>{
 const root=fs.mkdtempSync(path.join(os.tmpdir(),'kb-figure-assets-')),bytes=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
 const p=page(layout.blocks.slice(0,3)),input=prompt(p),source={schemaVersion:'xiaozhi.material-page-source.v1',resourceId:'resource_'+randomUUID(),version:sha('file'),page:1,generation:randomUUID(),receiptSha:sha('receipt')};
 const first={schemaVersion:'xiaozhi.material-ai-page-fragments.v1',questions:[{number:'1',requiresImage:true}],fragments:[{number:'1',blockIds:p.blocks.map(b=>b.id),complete:true}]},raw=JSON.stringify(first),batch='aibatch_'+randomUUID();
 let rows=[],renders=0;const host={root:()=>root,all:async()=>rows};
 const render=async(s,box,signal)=>{signal.throwIfAborted();renders++;return {schemaVersion:'xiaozhi.material-page-preview.v1',ok:true,requestId:randomUUID(),resourceId:s.resourceId,version:s.version,engine:'pdfium-5.14.0-page.v1',assetId:'asset_'+randomUUID(),page:s.page,total:1,box,width:1,height:1,sha256:sha(bytes),dataUrl:'data:image/png;base64,'+bytes.toString('base64')};};
 const inspect=async()=>({schemaVersion:'xiaozhi.material-ai-crop-quality.v1',engine:LOCAL_OCR_ENGINE,text:'controlled local OCR',clearEdges:[true,true,true,true]});
 const crops=await preparePageFragments(host,batch,1,source,first,raw,sha('page'),render,inspect,new AbortController().signal,input),stored=pageCropStorage(crops[0]);
 rows=[{number:'1',first_sha:sha(raw),page_image_sha:sha('page'),source_json:JSON.stringify(source),image_json:stored.image,quality_json:stored.quality}];
 const cold=await readPageFragments(host,batch,1,source,first,raw,sha('page'),new AbortController().signal,undefined,input);
 assert.deepEqual(cold[0].fragments.map(f=>f.kind),[undefined,'diagram',undefined]);assert.equal(renders,3);
 const question={id:'question_'+randomUUID(),stem:'如图所示，标准大气压下水的沸点是多少摄氏度？',answer:'100℃',analysis:'标准大气压下水的沸点为100℃。',answerOrigin:'teacher',analysisOrigin:'teacher',projection:Object.fromEntries(['statement','figures','formulas','tables','choices','subquestions'].map(k=>[k,{state:['statement','figures'].includes(k)?'provided':'not_applicable',text:k==='statement'?'如图所示，标准大气压下水的沸点是多少摄氏度？':k==='figures'?'烧杯示意图':''}]))};
 question.document=pageFragmentsDocument(question,cold[0],batch,'controlled');
 const paper={id:'xipaper_'+randomUUID(),digest:sha('paper'),title:'图文题测试',totalPoints:10,blueprint:{grade:'八年级',subject:'物理',durationMinutes:10,sections:[{id:'one',label:'实验题'}]},selection:{items:[{question,sectionId:'one',number:1,points:10,source:{version:sha('question')}}]}};
 const student=compileRichPaperOffice(paper,'student'),teacher=compileRichPaperOffice(paper,'teacher');
 assert(!JSON.stringify(student).includes(question.answer));assert(JSON.stringify(teacher).includes(question.answer));
 const figures=student.sections.flatMap(s=>s.figures||[]);assert.equal(figures.length,3);assert.deepEqual(figures.map(f=>f.assetId),cold[0].fragments.map(f=>f.image.assetId));
 const assets=new QuestionAssets(()=>root),office=await resolvePaperOfficeImages(student,{officeImages:async()=>Promise.all(cold[0].fragments.map(async(f,i)=>({blockId:'source_question_'+i,role:'question',...f.image,bytes:await assets.read(f.image,true,new AbortController().signal)})))});
 assert.equal(office.size,3);for(const data of office.values())assert.equal(sha(data),sha(bytes));
 const {figureCropPolicy,...old}=input;
 await assert.rejects(readPageFragments(host,batch,1,source,first,raw,sha('page'),new AbortController().signal,undefined,old),/source_changed/);
 const newRows=rows;rows=[];
 const oldCrops=await preparePageFragments(host,batch,1,source,first,raw,sha('page'),render,inspect,new AbortController().signal,old),oldStored=pageCropStorage(oldCrops[0]);
 rows=[{...newRows[0],image_json:oldStored.image,quality_json:oldStored.quality}];
 const legacy=await readPageFragments(host,batch,1,source,first,raw,sha('page'),new AbortController().signal,undefined,old);assert(legacy[0].fragments.every(f=>!f.kind));assert.equal(renders,5);rows=newRows;
 const cancelled=new AbortController();cancelled.abort();await assert.rejects(readPageFragments(host,batch,1,source,first,raw,sha('page'),cancelled.signal,undefined,input));
 const forged=JSON.parse(rows[0].image_json);forged.fragments[0].kind='diagram';rows[0].image_json=JSON.stringify(forged);await assert.rejects(readPageFragments(host,batch,1,source,first,raw,sha('page'),new AbortController().signal,undefined,input),/source_changed/);
 console.log(JSON.stringify({retainedAssetRoot:root,renders,cloudCalls:0}));
});
const timings={old:[],figures:[]};
await check('Maximum 32-of-256 layouts retain every source block under the existing bounded budget',()=>{
 const p=page(Array.from({length:256},(_,i)=>{const x=(i%16)/16,y=Math.floor(i/16)/16;return block(i+1,[x+.01,y+.01,x+.04,y+.04],i%5===0?'image':'text');})),selected=p.blocks.slice(0,32).map(b=>b.id);
 for(let i=0;i<20;i++)for(const figures of [false,true]){const start=performance.now(),g=ownedPageFragmentGroups(p,selected,8,figures);timings[figures?'figures':'old'].push(performance.now()-start);intact(p,selected,g);}
});
console.log(JSON.stringify({success:true,passed,timingsMs:Object.fromEntries(Object.entries(timings).map(([k,v])=>[k,{max:Math.max(...v),median:v.toSorted((a,b)=>a-b)[Math.floor(v.length/2)]}])),scope:'Deterministic geometry and controlled PNG/asset-journal readback; not natural OCR/figure accuracy or large-library latency.'}));
