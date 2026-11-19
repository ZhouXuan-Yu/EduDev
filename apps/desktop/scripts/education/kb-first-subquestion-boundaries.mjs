import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {continuationFirstSubquestionPrefix,continuationPrefix,PAGE_CONTINUATION_FIRST,validPageContinuation} from '../../src/shared/material-ai-continuation.ts';
import {PDF_LAYOUT_ENGINE} from '../../src/shared/material-layout.ts';
import {pageBlockTexts} from '../../src/shared/material-ai-page-fragments.ts';
import {refinePageLineBlocks} from '../../src/shared/material-ai-line-blocks.ts';
import {PAGE_BLOCKS_ENGINE,PAGE_BLOCKS_SCHEMA} from '../../src/shared/material-page-blocks.ts';
import {PDF_PAGE_ENGINE} from '../../src/shared/material-page-preview.ts';
import {readPageFragments,pageFragmentsAgree} from '../../src/main/assets/material-ai-page-fragments.ts';
import {planAiPageQuestion} from '../../src/main/assets/material-ai-page-publish.ts';

const head='4. 重力为5.88N的木块恰好完全浸没在水中。求：';
const choices='（1）木块受到的浮力。\n（2）木块的体积。';
const followingParent='5. 计算另一个物体的运动速度。';
const following=choices+'\n'+followingParent;
const blocks={ok:true,schemaVersion:PAGE_BLOCKS_SCHEMA,engine:PAGE_BLOCKS_ENGINE,rasterSha256:'1'.repeat(64),width:1100,height:2000,
 blocks:[{id:'block-1',kind:'text',score:.9,box:[.1,.1,.9,.3],needsReview:true},
  {id:'block-2',kind:'image',score:.9,box:[.3,.34,.6,.5],needsReview:true},
  {id:'block-3',kind:'text',score:.9,box:[.1,.6,.91,.8],needsReview:true}]};
const hints=blocks.blocks.map((b,i)=>({blockId:b.id,text:[choices,'',followingParent][i]}));
const before=[{blockId:'block-1',text:head}];
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
const plan=(current=head,prior=before,raw=following,layout=blocks,near=hints)=>continuationFirstSubquestionPrefix(current,prior,raw,layout,near);

check('Explicit unfinished parent, numbered subquestions and adjacent parent recover the independent illustration',()=>{
 assert(!continuationPrefix(head,before,following,blocks,hints));
 const result=plan(head+'\n第 1 页共 3 页');
 assert.equal(result.number,'4');
 assert.equal(result.nextNumber,'5');
 assert.deepEqual(result.blockIds,['block-1','block-2']);
 assert.equal(result.text,choices);
 assert(result.box[3]<blocks.blocks[2].box[1]);
});
check('Different units, missing cue, completed preceding list and preceding OCR disagreement stay held',()=>{
 for(const change of [head.replace('5.88N','5.88kN'),head.replace('。求：','。'),head+'\n（1）正文未结束。',head.replace('4.','5.')])assert(!plan(change));
 const closed='4. 重力为5.88N的木块恰好完全浸没在水中。';
 assert(!plan(closed,[{...before[0],text:closed}]));
 const earlierSubquestion='4. 重力为5.88N的木块恰好完全浸没在水中。\n（1）记录测量结果。\n然后改变砝码。求：';
 assert(!plan(earlierSubquestion,[{...before[0],text:earlierSubquestion}]));
});
check('Skipped, repeated and missing subquestions, following-parent revision and overlapping geometry remain held',()=>{
 for(const change of [choices.replace('（2）','（3）'),choices.replace('（2）','（1）'),choices.split('\n')[0],'首行未知\n'+choices]){
  assert(!plan(head,before,change+'\n'+followingParent,blocks,[{...hints[0],text:change},...hints.slice(1)]));
 }
 assert(!plan(head,before,following.replace('5.','6.')));
 const overlapping=structuredClone(blocks);overlapping.blocks[2].box[1]=.44;
 assert(!plan(head,before,following,overlapping));
});
if(process.argv[2]){
 const data=fs.realpathSync(process.argv[2]),db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
 const hash=value=>createHash('sha256').update(value).digest('hex');
 const key=value=>hash(JSON.stringify(value));
 try{
  check('Real PDFium, RapidOCR and PP-DocLayout select the four original subquestions and exclude both the next parent and its drawing',()=>{
   const resource=db.prepare('SELECT id,content_hash,local_path FROM teacher_resources WHERE original_file_name=?').get('gh-physics-1-gh-physics-1-pyhsics_buoyantforce.pdf');
   assert.equal(hash(fs.readFileSync(resource.local_path)),resource.content_hash);
   const job=db.prepare('SELECT generation,total FROM material_pdf_jobs WHERE resource_id=? AND version=?').get(resource.id,resource.content_hash);
   const load=page=>{
    const raw=JSON.parse(db.prepare('SELECT result_json FROM material_pdf_pages WHERE generation=? AND page=?').get(job.generation,page).result_json);
    assert.equal(raw.status,'complete');
    const layout=JSON.parse(fs.readFileSync(path.join(data,'cache/material-layout/v1',key([resource.id,resource.content_hash,PDF_LAYOUT_ENGINE,page])+'.json'),'utf8')).receipt;
    assert.equal(hash(Buffer.from(layout.png,'base64')),layout.rasterSha256);
    const blocks=JSON.parse(fs.readFileSync(path.join(data,'cache/material-page-blocks/v1',key([resource.id,resource.content_hash,page,layout.rasterSha256,PAGE_BLOCKS_ENGINE])+'.json'),'utf8'));
    return {...refinePageLineBlocks({blocks,blockTexts:pageBlockTexts(blocks,layout),lines:layout.lines}),raw};
   };
   const current=load(1),next=load(2);
   const planner=fn=>()=>fn(current.raw.text,current.blockTexts,next.raw.text,next.blocks,next.blockTexts);
   const old=planner(continuationPrefix),candidate=planner(continuationFirstSubquestionPrefix);
   assert.equal(old(),undefined);
   const result=candidate();
   assert.deepEqual([result.number,result.nextNumber],['4','5']);
   assert.equal(result.text,next.raw.text.split(/\r?\n5\./u)[0].trim());
   assert.deepEqual(result.blockIds,['block-1','block-2','block-3','block-4','block-5']);
   assert(result.box[3]<=next.blocks.blocks[5].box[1]);
   const source={schemaVersion:'xiaozhi.material-page-source.v1',resourceId:resource.id,version:resource.content_hash,page:2,generation:job.generation,receiptSha:'1'.repeat(64)};
   const image={schemaVersion:'xiaozhi.material-page-preview.v1',ok:true,requestId:crypto.randomUUID(),resourceId:resource.id,version:resource.content_hash,engine:PDF_PAGE_ENGINE,assetId:'asset_'+crypto.randomUUID(),page:2,total:job.total,box:result.box,width:300,height:300,sha256:'2'.repeat(64)};
   const frozen={schemaVersion:PAGE_CONTINUATION_FIRST,number:result.number,nextNumber:result.nextNumber,source,image,blocks:next.blocks,blockTexts:next.blockTexts,blockIds:result.blockIds,text:result.text,scope:{kind:'selected_pages'}};
   assert(validPageContinuation(frozen));
   assert(!validPageContinuation({...frozen,schemaVersion:'page-continuation.v1'}));
   assert(!validPageContinuation({...frozen,blockIds:frozen.blockIds.slice(1)}));
   const timings=fn=>{
    const elapsed=[];
    for(let i=0;i<100;i++){const start=performance.now();fn();elapsed.push(performance.now()-start);}
    return Number(elapsed.sort((a,b)=>a-b)[94].toFixed(4));
   };
   console.log(JSON.stringify({pages:[1,2],priorAccepted:false,nowAccepted:true,priorP95Ms:timings(old),newP95Ms:timings(candidate)}));
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
  const unit=JSON.parse(row.input_json),first=JSON.parse(row.first_json),final=JSON.parse(row.final_json),prompt=unit.pagePrompt;
  const review=JSON.parse(db.prepare('SELECT review_json FROM material_ai_page_verifications WHERE batch_id=? AND ordinal=1').get(batchId).review_json);
  const crops=await readPageFragments(host,batchId,1,unit.pageSource,first,row.first_json,row.image_sha,new AbortController().signal,undefined,prompt);
  const question=final.questions[0],agrees=(a,b)=>pageFragmentsAgree(a,b,question.number,crops,question.stem,prompt);
  check('Saved natural two-pass readings correct crop errors and retain an authentic diagram',()=>{
   assert.equal(prompt.continuation.schemaVersion,PAGE_CONTINUATION_FIRST);
   assert(agrees(review,final));
   const planned=planAiPageQuestion({batchId,ordinal:1,source:unit.pageSource,sources:unit.sources,firstRaw:row.first_json,finalRaw:row.final_json,first,final,review,pagePrompt:prompt,crops,following:'unknown',imageSha:row.image_sha,model:'deepseek-flash',title:'Source proof',originalQuestions:[]},question);
   assert.equal(planned.archive.state,'ai_final');
   assert(planned.document.context.illustrations.blockIds.length>0);
  });
  check('Uncorroborated new unit, missing image label and competing original readings are refused',()=>{
   const change=(response,index,alter)=>{
    const reading=response.readings[0].crops[index];
    reading.text=reading.parts[0].text=alter(reading.text);reading.assessment='corrected';
   };
   for(const [index,alter,both] of [[1,text=>text+' 5kN',true],[5,()=> 'A',true],[3,text=>text+'5',false]]){
    const a=structuredClone(review),b=structuredClone(final);
    if(both)change(a,index,alter);
    change(b,index,alter);
    assert(!agrees(a,b));
   }
  });
 }finally{db.close();}
}
console.log(JSON.stringify({success:true,checks}));
