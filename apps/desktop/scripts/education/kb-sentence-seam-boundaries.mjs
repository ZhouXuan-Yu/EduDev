import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {
 continuationPrefix,continuationSentencePrefix,hasSentenceContinuationLead,sentenceLiteralAgrees,validPageContinuation,
 PAGE_CONTINUATION_SENTENCE,continuationCropGroups,CONTINUATION_FIGURE_CROPS,
} from '../../src/shared/material-ai-continuation.ts';
import {pageBlockTexts} from '../../src/shared/material-ai-page-fragments.ts';
import {refinePageLineBlocks} from '../../src/shared/material-ai-line-blocks.ts';
import {pageFragmentsAgree,readPageFragments} from '../../src/main/assets/material-ai-page-fragments.ts';
import {planAiPageQuestion} from '../../src/main/assets/material-ai-page-publish.ts';
import {PDF_PAGE_ENGINE,MATERIAL_PREVIEW_SCHEMA} from '../../src/shared/material-page-preview.ts';
import {PAGE_BLOCKS_ENGINE,PAGE_BLOCKS_SCHEMA} from '../../src/shared/material-page-blocks.ts';

let checks=0;
function check(name,callback){callback();checks++;console.log('PASS '+name);}
check('Modified values, signs, explicit indices and abbreviated names never substitute for the source',()=>{
 assert(sentenceLiteralAgrees('由 R1 = 5Ω 可知','由 R₁ = 5Ω 可知'));
 for(const value of ['由 R₂ = 5Ω 可知','由 R₁ = -5Ω 可知','由 R₁ = 50Ω 可知','由 R₁ = 5kΩ 可知'])assert(!sentenceLiteralAgrees('由 R1 = 5Ω 可知',value));
 assert(!sentenceLiteralAgrees('由 R₁ = 5Ω 可知','由 R1 = 5Ω 可知'));
 assert(!sentenceLiteralAgrees('额定 A12','额定 A1₂'));
});
const block=(id,kind,box)=>({id,kind,box,score:.98,needsReview:true});
const layout=(blocks,texts)=>({
 blocks:{schemaVersion:PAGE_BLOCKS_SCHEMA,ok:true,engine:PAGE_BLOCKS_ENGINE,rasterSha256:'2'.repeat(64),width:1200,height:1800,blocks},
 blockTexts:blocks.map((b,i)=>({blockId:b.id,text:texts[i]})),
});
const left=layout([block('block-1','text',[.15,.85,.65,.9]),block('block-2','image',[.67,.85,.85,.94]),block('block-3','number',[.48,.93,.53,.95])],['8. 如图所示，稳压电源接到电','A','2 / 4']);
const tail='路，测得电源电压为12V。\n（1）求通过电阻的电流。\n（2）计算两端的电压。';
const right=layout([block('block-1','text',[.15,.1,.8,.22]),block('block-2','text',[.15,.24,.85,.32]),block('block-3','number',[.48,.93,.54,.95])],[tail,'9. 下一道完全独立的题。','3/4']);
const currentRaw='2 / 4\n'+left.blockTexts.map(h=>h.text).slice(0,2).join('\n');
const nextRaw='3 / 4\n'+tail+'\n9. 下一道完全独立的题。';
const plan=(a=left,previous=currentRaw,b=right,next=nextRaw)=>continuationSentencePrefix(a,previous,b,next,2,4);
check('Two authenticated page labels, source body and separate near-edge diagram prove one sentence seam',()=>{
 assert(hasSentenceContinuationLead(nextRaw,3,4));
 const result=plan();
 assert.equal(result.number,'8');
 assert.equal(result.nextNumber,'9');
 assert.deepEqual(result.preceding.blockIds,['block-1','block-2']);
 assert.deepEqual(result.blockIds,['block-1']);
});
check('Unmatched counters, closed previous sentence, hidden condition and next question collision stay held',()=>{
 assert(!plan(left,currentRaw.replace('2 / 4','1 / 4')));
 assert(!plan(left,currentRaw,right,nextRaw.replace('3 / 4','3 / 9')));
 assert(!plan(left,currentRaw+'\n电压的上限为另一条件'));
 assert(!plan(left,currentRaw+'\nU = 6V'));
 const closed=structuredClone(left);closed.blockTexts[0].text+='。';
 assert(!plan(closed,currentRaw.replace('接到电','接到电。')));
 const wrongMargin=structuredClone(right);wrongMargin.blocks.blocks[2].kind='text';
 assert(!plan(left,currentRaw,wrongMargin));
 const crossing=structuredClone(right);crossing.blocks.blocks[1].box[1]=.2;
 assert(!plan(left,currentRaw,crossing));
 assert(!plan(left,currentRaw,right,nextRaw.replace('12V','21V')));
 assert(!plan(left,currentRaw,right,nextRaw.replace('（2）','（3）')));
});

if(process.argv[2]){
 const root=fs.realpathSync(process.argv[2]);
 const db=new DatabaseSync(path.join(root,'data/app.db'),{readOnly:true});
 const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
 try {
  check('Actual PDFium, RapidOCR and PP-DocLayout recover page 4 question 25 and keep page 5 question 26 outside the crop',()=>{
   const resource=db.prepare('SELECT * FROM teacher_resources WHERE id=?').get('resource_ad80ba69-e4b7-4051-a6e7-11d4da0350f0');
   assert.equal(sha(fs.readFileSync(resource.local_path)),resource.content_hash);
   const job=db.prepare('SELECT generation,total FROM material_pdf_jobs WHERE resource_id=?').get(resource.id);
   const read=page=>{
    const raw=JSON.parse(db.prepare('SELECT result_json FROM material_pdf_pages WHERE generation=? AND page=?').get(job.generation,page).result_json);
    const {layout:ocr,pageBlocks:{receipt:blocks}}=JSON.parse(fs.readFileSync(path.join(root,'page-'+page+'.json'),'utf8'));
    assert.equal(ocr.inputSha256,resource.content_hash);
    assert.equal(sha(Buffer.from(ocr.png,'base64')),blocks.rasterSha256);
    return {raw,...refinePageLineBlocks({blocks,blockTexts:pageBlockTexts(blocks,ocr),lines:ocr.lines})};
   };
   const a=read(4),b=read(5);
   const execute=()=>continuationSentencePrefix(a,a.raw.text,b,b.raw.text,4,job.total);
   const baseline=()=>continuationPrefix(a.raw.text,a.blockTexts,b.raw.text,b.blocks,b.blockTexts);
   assert.equal(baseline(),undefined);
   const result=execute();
   assert.deepEqual([result.number,result.nextNumber],['25','26']);
   assert.deepEqual(result.preceding.blockIds,['block-23','block-24']);
   assert.deepEqual(result.blockIds,['block-1','block-2','block-3']);
   assert(result.preceding.text.endsWith('电压')&&result.text.startsWith('表'));
   assert(result.box[3]<b.blocks.blocks[3].box[1]);
   const source={schemaVersion:'xiaozhi.material-page-source.v1',resourceId:resource.id,version:resource.content_hash,page:5,generation:job.generation,receiptSha:'1'.repeat(64)};
   const image={schemaVersion:MATERIAL_PREVIEW_SCHEMA,ok:true,requestId:crypto.randomUUID(),resourceId:resource.id,version:resource.content_hash,engine:PDF_PAGE_ENGINE,assetId:'asset_'+crypto.randomUUID(),page:5,total:job.total,box:result.box,width:300,height:300,sha256:'2'.repeat(64)};
   const {box:_,...ownership}=result;
   const frozen={...ownership,schemaVersion:PAGE_CONTINUATION_SENTENCE,source,image,blocks:b.blocks,blockTexts:b.blockTexts,scope:{kind:'selected_pages'}};
   assert(validPageContinuation(frozen));
   const prompt={policy:'page-fragments.v3',...a,continuation:frozen,continuationCropPolicy:CONTINUATION_FIGURE_CROPS};
   assert.deepEqual(continuationCropGroups(prompt,result.preceding.blockIds,'25').map(crop=>crop.blockIds),[
    ['block-23'],['block-24'],result.blockIds.map(id=>'next:'+id),
   ]);
   assert.throws(()=>continuationCropGroups(prompt,['block-23'],'25'),/source_incomplete/u);
   const p95=run=>{
    const timings=[];
    for(let i=0;i<100;i++){const start=performance.now();run();timings.push(performance.now()-start);}
    return Number(timings.sort((a,b)=>a-b)[94].toFixed(4));
   };
   console.log(JSON.stringify({naturalPages:[4,5],baselineP95Ms:p95(baseline),plannerP95Ms:p95(execute)}));
  });
 }finally{db.close();}
}
if(process.argv[3]){
 const directory=fs.realpathSync(process.argv[3]),root=path.join(directory,'data');
 const {batchId}=JSON.parse(fs.readFileSync(path.join(directory,'summary.json'),'utf8'));
 const db=new DatabaseSync(path.join(root,'app.db'),{readOnly:true});
 const host={root:()=>root,all:async(sql,params=[])=>db.prepare(sql).all(...params)};
 try{
  const row=db.prepare('SELECT * FROM material_ai_units WHERE batch_id=? AND ordinal=1').get(batchId);
  const unit=JSON.parse(row.input_json),prompt=unit.pagePrompt,first=JSON.parse(row.first_json),final=JSON.parse(row.final_json);
  const review=JSON.parse(db.prepare('SELECT review_json FROM material_ai_page_verifications WHERE batch_id=? AND ordinal=1').get(batchId).review_json);
  const crops=await readPageFragments(host,batchId,1,unit.pageSource,first,row.first_json,row.image_sha,new AbortController().signal,undefined,prompt);
  const question=final.questions[0];
  check('Two saved literal readings produce a continuous canonical stem without editing either page source',()=>{
   assert.equal(prompt.continuation.schemaVersion,PAGE_CONTINUATION_SENTENCE);
   assert(question.stem.includes('电压表和电流表')&&question.stem.includes('R₁')&&question.stem.includes('R₃′'));
   assert(pageFragmentsAgree(review,final,question.number,crops,question.stem,prompt));
   const planned=planAiPageQuestion({batchId,ordinal:1,source:unit.pageSource,sources:unit.sources,firstRaw:row.first_json,
    finalRaw:row.final_json,first,final,review,imageSha:row.image_sha,title:'Source proof',model:'deepseek-flash',
    originalQuestions:[],pagePrompt:prompt,crops,following:'unknown'},question);
   assert.equal(planned.archive.state,'ai_final');
   assert.equal(planned.document.blocks.find(b=>b.id==='source_question_1').anchors[0].page,4);
  });
  check('Consistent but changed readings still fail on a lost subscript, a changed voltage or invented bridging prose',()=>{
   const alter=(response,change)=>{
    const q=response.questions[0];q.stem=change(q.stem);
    for(const field of Object.values(q.projection))field.text=change(field.text);
    for(const crop of response.readings[0].crops){
     crop.text=change(crop.text);
     if(crop.parts.some(part=>part.text!==change(part.text))){
      for(const part of crop.parts)part.text=change(part.text);
      crop.assessment='corrected';
     }
    }
    return response;
   };
   for(const change of [text=>text.replaceAll('R₁','R1'),text=>text.replace('12V','21V'),text=>text.replace('表和电流表','未知条件下表和电流表')]){
    const a=alter(structuredClone(review),change),b=alter(structuredClone(final),change);
    assert(!pageFragmentsAgree(a,b,question.number,crops,b.questions[0].stem,prompt));
   }
  });
 }finally{db.close();}
}
console.log(JSON.stringify({success:true,checks}));
