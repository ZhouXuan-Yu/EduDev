import assert from 'node:assert/strict';
import {createHash,randomUUID} from 'node:crypto';
import {editedPageCropDocument} from '../../src/main/assets/material-ai-page-crops.ts';
import {editablePageFigures,setPageTextPresentation} from '../../src/main/assets/material-ai-page-presentation.ts';
import {pageFragmentsDocument} from '../../src/main/assets/material-ai-page-fragments.ts';
import {validQuestionDocument,hasTeacherTextPresentation} from '../../src/shared/question-document.ts';
import {compileRichPaperOffice} from '../../src/main/education/paper-rich-export.ts';

const sha=s=>createHash('sha256').update(s).digest('hex');
const projection=Object.fromEntries(['statement','figures','formulas','tables','choices','subquestions'].map(k=>[k,{state:['statement','figures'].includes(k)?'provided':'not_applicable',text:k==='statement'?'如图求水温。':k==='figures'?'烧杯示意图':''}]));
const original={stem:projection.statement.text,answer:'100℃',analysis:'原解析',answerOrigin:'teacher',analysisOrigin:'teacher',projection};
const prompt={blocks:{blocks:[{id:'block-1',kind:'text'},{id:'block-2',kind:'image'},{id:'block-3',kind:'figure_title'}]}};
const images=[0,1].map(i=>({resourceId:'resource_'+randomUUID(),version:sha('source'),assetId:'asset_'+randomUUID(),sha256:sha('image'+i),mime:'image/png',width:100,height:100,page:1,box:[.1,.1+i*.3,.4,.3+i*.3],engine:'controlled'}));
const crop={number:'1',image:images[0],fragments:[{blockId:'block-1',blockIds:['block-1'],image:images[0]},{kind:'diagram',blockId:'block-2',blockIds:['block-2','block-3'],image:images[1]}]};
for(const f of crop.fragments)f.quality={engine:"controlled"};
const doc=pageFragmentsDocument(original,crop,'controlled','controlled');
const paper=q=>({id:'xipaper_'+randomUUID(),digest:sha('paper'),title:'补正题面',totalPoints:10,blueprint:{grade:'八年级',subject:'物理',durationMinutes:10,sections:[{id:'one',label:'实验题'}]},selection:{items:[{question:{id:'question_'+randomUUID(),...original,...q},sectionId:'one',number:1,points:10,source:{version:sha('current')}}]}});
const edit=(stem,checked,c=crop,p=prompt)=>{const d=editedPageCropDocument(doc,{...original,stem});setPageTextPresentation(d,original,c,p,checked);assert(validQuestionDocument(d));return d;};
let passed=0;function check(name,fn){fn();passed++;console.log('PASS '+name);}
check('Unchanged/restored source retains original images and legacy schema',()=>{
 const same=edit(original.stem,true);assert(!same.context.presentation);assert.deepEqual(same,doc);assert.equal(compileRichPaperOffice(paper({document:same}),'student').sections.flatMap(s=>s.figures||[]).length,2);
});
check('Unchecked correction is durable but cannot compile as a student paper',()=>{
 const d=edit('更正：求沸点。',false);assert.equal(d.context.presentation.mode,'needs_review');assert.throws(()=>compileRichPaperOffice(paper({stem:d.context.projection.statement.text,document:d}),'student'),/unsupported/);assert.deepEqual(d.blocks.filter(b=>b.kind==='image'),doc.blocks.filter(b=>b.kind==='image'));
});
check('Teacher checked correction binds only independent diagram and current text',()=>{
 const stem='更正：已知气压，求水的沸点。',d=edit(stem,true);assert(hasTeacherTextPresentation(d));assert.deepEqual(d.context.presentation.figureBlockIds,['source_question_1']);const student=compileRichPaperOffice(paper({stem,document:d}),'student');assert(JSON.stringify(student).includes(stem));assert(!JSON.stringify(student).includes(original.stem));assert(!JSON.stringify(student).includes(original.answer));assert.deepEqual(student.sections.flatMap(s=>s.figures||[]).map(f=>f.assetId),[images[1].assetId]);
 assert(JSON.stringify(compileRichPaperOffice(paper({stem,document:d}),'teacher')).includes(original.answer));
});
check('Mixed images, missing blocks and continuation rasters never become text presentation',()=>{
 const mixed=structuredClone(crop);delete mixed.fragments[1].kind;assert.equal(editablePageFigures(mixed,prompt,original),undefined);assert.equal(edit('更正',true,mixed).context.presentation.mode,'needs_review');
 for(const id of ['next:page','foreign']){const c=structuredClone(crop);c.fragments[1].blockIds=[id];assert.equal(editablePageFigures(c,prompt,original),undefined);}
 assert.equal(editablePageFigures({...crop,fragments:undefined},undefined,original),undefined);
});
check('Plain source requires no picture; figure source cannot silently omit its diagram',()=>{
 const plain=structuredClone(original);plain.projection.figures={state:'not_applicable',text:''};assert.deepEqual(editablePageFigures({...crop,fragments:undefined},undefined,plain),[]);
 assert.equal(editablePageFigures(crop,prompt,plain),undefined);
 const d=structuredClone(doc);d.context.projection.figures={state:'not_applicable',text:''};setPageTextPresentation(d,{...plain,stem:'原文字'}, {...crop,fragments:undefined},undefined,true);assert(hasTeacherTextPresentation(d));assert(validQuestionDocument(d));assert.equal(compileRichPaperOffice(paper({document:d}),'student').sections.flatMap(s=>s.figures||[]).length,0);
});
check('Unknown versions, foreign/duplicate/empty diagram IDs and review figures are rejected',()=>{
 const d=edit('更正',true);for(const patch of [{schemaVersion:'unknown'},{figureBlockIds:['foreign']},{figureBlockIds:['source_question_1','source_question_1']},{figureBlockIds:[]},{mode:'needs_review'}]){const bad=structuredClone(d);Object.assign(bad.context.presentation,patch);assert(!validQuestionDocument(bad));}
 const bad=structuredClone(d);bad.context.presentation.extra=true;assert(!validQuestionDocument(bad));
});
check('Current formulas and tables survive ordered Office sections with the diagram',()=>{
 const stem='更正题：求 $x^2$。\n\n| 量 | 数值 |\n| --- | --- |\n| 水温 | 80 |\n\n请列式计算。',d=edit(stem,true),office=compileRichPaperOffice(paper({stem,document:d}),'student');assert(office.sections.some(s=>s.table?.rows[0][1]==='80'));assert.equal(office.sections.flatMap(s=>s.figures||[]).length,1);assert(JSON.stringify(office).includes('$x^2$'));assert(JSON.stringify(office).indexOf('水温')<JSON.stringify(office).indexOf('请列式计算'));
});
console.log(JSON.stringify({success:true,passed,scope:'Strict source/display contracts and real Office compiler; synthetic layout only, not independent natural question accuracy or installed Office rendering.'}));
