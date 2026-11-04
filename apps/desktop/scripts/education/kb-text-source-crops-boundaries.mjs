import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {validAiPagePrompt} from '../../src/shared/material-ai-page.ts';
import {MATERIAL_TEXT_SOURCE_CROPS,pageFragmentGroups} from '../../src/shared/material-ai-page-fragments.ts';
import {PAGE_BLOCKS_ENGINE,PAGE_BLOCKS_SCHEMA} from '../../src/shared/material-page-blocks.ts';
import {LOCAL_OCR_ENGINE} from '../../src/shared/xiaozhi-ocr.ts';
import {selectedPageFragments,pageFragmentsAgree,pageFragmentsDocument} from '../../src/main/assets/material-ai-page-fragments.ts';
import {validQuestionDocument} from '../../src/shared/question-document.ts';
const stem='在标准大气压下，水的沸点是多少摄氏度？';
const blocks={schemaVersion:PAGE_BLOCKS_SCHEMA,ok:true,engine:PAGE_BLOCKS_ENGINE,rasterSha256:'a'.repeat(64),width:1000,height:1000,blocks:[{id:'block-1',box:[.1,.2,.8,.3],kind:'text',score:.99,needsReview:true}]};
const old={policy:'page-fragments.v3',ocrStatus:'complete',totalPages:1,resourceTitle:'合成题',blocks,blockTexts:[{blockId:'block-1',text:stem}]},prompt={...old,sourceCropPolicy:MATERIAL_TEXT_SOURCE_CROPS};
const q={number:'1',stem,answer:'',analysis:'',subject:'物理',grade:'八年级',knowledgePoint:'沸点',questionType:'填空题',difficulty:'easy',answerOrigin:'missing',analysisOrigin:'missing',requiresImage:false,issues:[],projection:Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions'].map(k=>[k,{state:k==='statement'?'provided':'not_applicable',text:k==='statement'?stem:''}]))};
const first={schemaVersion:'xiaozhi.material-ai-page-fragments.v1',outcome:'questions',pageText:'1. '+stem,pageIssues:[],questions:[q],fragments:[{number:'1',blockIds:['block-1'],complete:true}]};
const box=pageFragmentGroups(blocks,['block-1'],true)[0].box,image={assetId:'asset_'+randomUUID(),sha256:'b'.repeat(64),resourceId:'resource_'+randomUUID(),version:'c'.repeat(64),page:1,total:1,box,engine:'owned-fixture.v1',width:724,height:124};
const quality={schemaVersion:'xiaozhi.material-ai-crop-quality.v1',engine:LOCAL_OCR_ENGINE,text:stem,clearEdges:[true,true,true,true]},crops=[{number:'1',image,quality,fragments:[{blockId:'block-1',blockIds:['block-1'],image,quality}]}];
let passed=0;const check=(name,fn)=>{fn();passed++;console.log('PASS '+name);};
check('New frozen policy is explicit; old receipts remain image-only and reject unknown versions or policies',()=>{
 assert(validAiPagePrompt(old));assert(validAiPagePrompt(prompt));assert.equal(selectedPageFragments(first,old).length,0);assert.equal(selectedPageFragments(first,prompt).length,1);
 for(const x of [{...prompt,sourceCropPolicy:'future'},{...prompt,extra:true},{...prompt,policy:'page-fragments.v2'}])assert(!validAiPagePrompt(x));
 let reads=0;const getter={...prompt};Object.defineProperty(getter,'sourceCropPolicy',{enumerable:true,get(){reads++;return MATERIAL_TEXT_SOURCE_CROPS;}});assert(!validAiPagePrompt(getter));assert.equal(reads,0);
});
check('Complete pure text with independent matching crop produces the existing source-backed v2 document',()=>{
 assert(pageFragmentsAgree(first,structuredClone(first),'1',crops,stem,prompt));assert(!pageFragmentsAgree(first,first,'1',crops,stem,old));
 const document=pageFragmentsDocument(q,crops[0],'aibatch_'+randomUUID(),'controlled');assert(validQuestionDocument(document));assert.equal(document.schemaVersion,'xiaozhi.question-document.v2');assert.equal(document.context.projection.figures.state,'not_applicable');assert.equal(document.blocks[0].sha256,image.sha256);
});
check('Missing source selection, OCR failure, clipped margins or changed block ownership never qualify',()=>{
 const changed=structuredClone(first);changed.fragments[0].complete=false;assert.equal(selectedPageFragments(changed,prompt).length,0);assert(!pageFragmentsAgree(first,changed,'1',crops,stem,prompt));assert(!pageFragmentsAgree(first,first,'1',[],stem,prompt));
 for(const edit of [f=>f.quality.text='别的题目',f=>f.quality.clearEdges[0]=false,f=>f.blockIds=['block-2'],f=>f.image.box=[0,0,1,1]]){const bad=structuredClone(crops);edit(bad[0].fragments[0]);assert(!pageFragmentsAgree(first,first,'1',bad,stem,prompt));}
});
check('Contradictory figure flags, missing semantic fields, different answers and omitted choices stay blocked',()=>{
 for(const change of [q=>q.requiresImage=true,q=>q.projection.figures={state:'provided',text:'必须看图'},q=>q.projection.choices={state:'provided',text:'未包含的选项'},q=>q.issues=['uncertain_ocr']]){const a=structuredClone(first);change(a.questions[0]);assert(!pageFragmentsAgree(a,a,'1',crops,stem,prompt));}
 const b=structuredClone(first);b.questions[0].answer='100℃';b.questions[0].answerOrigin='ai_generated';assert(!pageFragmentsAgree(first,b,'1',crops,stem,prompt));
});
check('Existing complete visual questions retain the exact original crop requirements without the new flag',()=>{
 const a=structuredClone(first);a.questions[0].requiresImage=true;a.questions[0].projection.figures={state:'provided',text:'原题图'};assert.equal(selectedPageFragments(a,old).length,1);assert(pageFragmentsAgree(a,a,'1',crops,stem,old));
 const b=structuredClone(a);b.questions[0].projection.figures={state:'not_applicable',text:''};assert(!pageFragmentsAgree(b,b,'1',crops,stem,prompt));
});
console.log(JSON.stringify({success:true,passed,scope:'Source crop and schema boundaries; no natural OCR/model correctness acceptance'}));
