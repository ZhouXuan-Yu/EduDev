import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import {createHash,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {pageFragmentsDocument} from '../../src/main/assets/material-ai-page-fragments.ts';
import {attachPageIllustrations,pageQuestionIllustrations,withoutDerivedIllustrations} from '../../src/main/assets/material-ai-page-presentation.ts';
import {QUESTION_ILLUSTRATIONS_SCHEMA,validQuestionDocument} from '../../src/shared/question-document.ts';
import {instanceDeliveryBlock,instanceDigest,instanceSourceImage} from '../../src/main/education/paper-instance.ts';
import {compileInstancePaperOffice} from '../../src/main/education/paper-instance-export.ts';
import {generateOfficeDocument} from '../../src/main/xiaozhi-agent/office-generator.ts';
import {nativeTestPng} from './native-test-png.mjs';
const sha=v=>createHash('sha256').update(v).digest('hex'),version=sha('version'),png=nativeTestPng();
const output=fs.mkdtempSync(path.join(os.tmpdir(),'omni-instance-illustrations-'));
const original={stem:'如图回答水的沸点。',answer:'100℃',analysis:'标准气压下沸点为100℃。',answerOrigin:'teacher',analysisOrigin:'teacher',projection:Object.fromEntries(['statement','figures','formulas','tables','choices','subquestions'].map(k=>[k,{state:['statement','figures'].includes(k)?'provided':'not_applicable',text:k==='statement'?'如图回答水的沸点。':k==='figures'?'烧杯图':''}]))};
const images=[0,1,2].map(i=>({resourceId:'resource_'+randomUUID(),version,assetId:'asset_'+randomUUID(),sha256:sha(png),mime:'image/png',width:png.readUInt32BE(16),height:png.readUInt32BE(20),page:1,box:[.1,.1+i*.2,.4,.25+i*.2],engine:'controlled'}));
const prompt={blocks:{blocks:[{id:'body',kind:'text'},{id:'figure1',kind:'image'},{id:'figure2',kind:'chart'}]}};
const crop={number:'1',image:images[0],fragments:images.map((image,i)=>({blockId:prompt.blocks.blocks[i].id,blockIds:[prompt.blocks.blocks[i].id],image,quality:{engine:'controlled'},...(i?{kind:'diagram'}:{})}))};
const legacy=pageFragmentsDocument(original,crop,'controlled','controlled'),document=structuredClone(legacy);
attachPageIllustrations(document,crop,prompt,original);
const q={id:'question_'+randomUUID(),subject:'物理',grade:'初二',questionType:'解答题',stem:original.stem,answer:original.answer,analysis:original.analysis,document};
const image=id=>({type:'sourceImage',role:'question',blockId:id,sourceVersion:version});
const binding={questionId:q.id,sourceVersion:version};
function instance(blocks){const content={question:{mode:'edited',blocks},answer:{mode:'source'},analysis:{mode:'source'}};const contentDigest=instanceDigest(binding,content);return{schemaVersion:'xiaozhi.paper-instance.v1',entryId:'xientry_'+randomUUID(),instanceRevision:2,sourceBinding:binding,content,contentDigest,review:{action:'confirm',instanceRevision:2,contentDigest,sourceBinding:binding}};}
const blocks=[{type:'text',text:'本卷独立改题：比较两幅示意图。'},image('source_question_2'),{type:'text',text:'两图之间的条件。'},image('source_question_1'),{type:'text',text:'请列式说明。'}];
const paper=i=>({id:'xipaper_'+randomUUID(),digest:sha('paper'),title:'独立题图编译',totalPoints:10,blueprint:{grade:'初二',subject:'物理',durationMinutes:10,sections:[{id:'one',label:'实验题'}]},selection:{items:[{question:q,instance:i,sectionId:'one',number:1,points:10,source:{questionId:q.id,version}}]}});
const report={success:false,output,checks:[],scope:'Source contracts and actual DOCX generator with synthetic authenticated layout; no Electron, cloud, formal teacher or Office/WPS visual acceptance'};
async function check(name,fn){await fn();report.checks.push(name);console.log('PASS '+name);}
try{
 await check('New metadata derives only independent frozen diagrams while old root document remains byte-identical',()=>{
  assert(validQuestionDocument(document));assert(!legacy.context.illustrations);assert.deepEqual(withoutDerivedIllustrations(document),legacy);
  assert.deepEqual(document.context.illustrations,{schemaVersion:QUESTION_ILLUSTRATIONS_SCHEMA,complete:true,blockIds:['source_question_1','source_question_2']});
 });
 await check('Strict metadata rejects unknown keys/versions, foreign or duplicate references and empty complete figure sets',()=>{
  for(const patch of [{extra:true},{schemaVersion:'unknown'},{complete:1},{blockIds:['foreign']},{blockIds:['source_question_1','source_question_1']},{blockIds:[]}]){const d=structuredClone(document);Object.assign(d.context.illustrations,patch);assert(!validQuestionDocument(d));}
  const d=structuredClone(document);d.context.projection.figures={state:'not_applicable',text:''};assert(!validQuestionDocument(d));
 });
 await check('Edited instance can reorder every independent diagram; parent content and blocks are unchanged',()=>{
  const before=JSON.stringify(q),i=instance(blocks);assert.equal(instanceDeliveryBlock(q,i),undefined);assert.equal(instanceSourceImage(q,i,'question',blocks[1]).assetId,images[2].assetId);assert.equal(JSON.stringify(q),before);
 });
 await check('Body, answer, foreign parent, stale version, duplicate or omitted required diagrams stay blocked',()=>{
  for(const refs of [[image('source_question_0'),image('source_question_1')],[image('source_answer_0'),image('source_question_1')],[{...image('source_question_2'),role:'answer'},image('source_question_1')],[{...image('source_question_2'),sourceVersion:sha('stale')},image('source_question_1')],[image('source_question_1'),image('source_question_1')],[image('source_question_1')],[]])assert.equal(instanceDeliveryBlock(q,instance([{type:'text',text:'本卷题'},...refs])),'image_dependency');
  const i=instance(blocks);i.sourceBinding={...binding,questionId:'question_'+randomUUID()};assert.equal(instanceDeliveryBlock(q,i),'image_dependency');
 });
 await check('Mixed continuation raster remains an incomplete proof and cannot silently lose figures',()=>{
  const c=structuredClone(crop);c.fragments[0].blockIds=['next:1'];const d=structuredClone(legacy);attachPageIllustrations(d,c,prompt,original);assert.equal(d.context.illustrations.complete,false);assert.equal(instanceDeliveryBlock({...q,document:d},instance(blocks)),'image_dependency');
  const mixed=structuredClone(crop);delete mixed.fragments[2].kind;assert.equal(pageQuestionIllustrations(mixed,prompt,original).complete,false);
 });
 await check('Legacy unclassified images remain readable but cannot be reused as independent edited images',()=>{
  assert(validQuestionDocument(legacy));assert.equal(instanceDeliveryBlock({...q,document:legacy},instance(blocks)),'image_dependency');
 });
 await check('Actual student and teacher DOCX retain diagram order/hash and isolate source answers',async()=>{
  for(const audience of ['student','teacher']){
   const draft=compileInstancePaperOffice(paper(instance(blocks)),audience),figures=draft.sections.flatMap(s=>s.figures||[]);assert.deepEqual(figures.filter(f=>f.role==='question').map(f=>f.blockId),['source_question_2','source_question_1']);
   const bytes=await generateOfficeDocument('docx',draft,{dataRoot:output,images:new Map(images.map(i=>[i.assetId,png]))});const file=path.join(output,audience+'.docx');fs.writeFileSync(file,bytes);
   const inspected=JSON.parse(execFileSync('python',['-c',"import sys,zipfile,json,hashlib;z=zipfile.ZipFile(sys.argv[1]);print(json.dumps({'xml':z.read('word/document.xml').decode(),'media':[hashlib.sha256(z.read(n)).hexdigest() for n in z.namelist() if n.startswith('word/media/') and not n.endswith('/')]},ensure_ascii=False))",file],{encoding:'utf8',windowsHide:true}));
   const xml=inspected.xml;assert(xml.includes('本卷独立改题'));assert(xml.indexOf('source_question_2')<xml.indexOf('两图之间'));assert(xml.indexOf('两图之间')<xml.indexOf('source_question_1'));assert.equal(xml.includes(original.answer),audience==='teacher');assert.equal(xml.includes(original.analysis),audience==='teacher');assert(inspected.media.length>=1);assert(inspected.media.every(hash=>hash===sha(png)));
  }
 });
 report.success=true;
}catch(error){report.error=String(error.stack||error);console.error(report.error);process.exitCode=1;}
finally{fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,passed:report.checks.length,output}));}
