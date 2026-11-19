import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
import {
 PAGE_CONTINUATION_CAPTION,CONTINUATION_FIGURE_CROPS,continuationCaptionPrefix,continuationCropGroups,
 continuationSentencePrefix,hasCaptionContinuationLead,validPageContinuation,
} from '../../src/shared/material-ai-continuation.ts';
import {PAGE_BLOCKS_ENGINE,PAGE_BLOCKS_SCHEMA} from '../../src/shared/material-page-blocks.ts';
import {MATERIAL_PREVIEW_SCHEMA,PDF_PAGE_ENGINE} from '../../src/shared/material-page-preview.ts';
import {pageBlockTexts} from '../../src/shared/material-ai-page-fragments.ts';
import {refinePageLineBlocks} from '../../src/shared/material-ai-line-blocks.ts';
import {pageFragmentsAgree,readPageFragments} from '../../src/main/assets/material-ai-page-fragments.ts';
import {planAiPageQuestion} from '../../src/main/assets/material-ai-page-publish.ts';

let checks=0;
function check(name,run){run();checks++;console.log('PASS '+name);}
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const layout=rows=>({
 blocks:{schemaVersion:PAGE_BLOCKS_SCHEMA,ok:true,engine:PAGE_BLOCKS_ENGINE,rasterSha256:'2'.repeat(64),width:1200,height:1800,
  blocks:rows.map(([kind,box],i)=>({id:'block-'+(i+1),kind,box,score:.98,needsReview:true}))},
 blockTexts:rows.map(([, ,text],i)=>({blockId:'block-'+(i+1),text})),
});
const preceding=layout([
 ['text',[.14,.69,.82,.77],'17. 根据图 29 写出两项条件。'],
 ['text',[.14,.84,.82,.90],'18. 如图 31 所示，山脚处的同学正在观'],
 ['number',[.45,.941,.55,.956],'第 3 页共 12 页'],
]);
const following=layout([
 ['image',[.32,.12,.63,.26],'A\nB'],
 ['figure_title',[.34,.27,.61,.30],'图 29：示意图'],
 ['text',[.14,.34,.84,.41],'察无人机，已知飞行高度为 20m，求视线仰角是多少？'],
 ['chart',[.34,.43,.65,.52],'C\nD'],
 ['figure_title',[.37,.53,.62,.555],'图 31：观测示意图'],
 ['text',[.14,.65,.85,.74],'19. 写出观测结果。'],
]);
const raw=page=>page.blockTexts.map(h=>h.text).join('\n');
const plan=(a=preceding,b=following,left=raw(a),right=raw(b))=>continuationCaptionPrefix(a,left,b,right,3);
check('Different consecutive questions can own different adjacent-page figures',()=>{
 assert(hasCaptionContinuationLead(raw(following)));
 const result=plan();
 assert.deepEqual([result.number,result.nextNumber],['18','19']);
 assert.deepEqual(result.preceding.blockIds,['block-2']);
 assert.deepEqual(result.blockIds,['block-3','block-4','block-5']);
 assert(result.box[1]>following.blocks.blocks[1].box[3]&&result.box[3]<following.blocks.blocks[5].box[1]);
 assert(!result.text.includes('图 29')&&!result.text.includes('写出观测结果'));
});
check('Unproven ownership, duplicate references and repeated question numbers are rejected',()=>{
 for(const [i,change] of [[0,s=>s.replace('图 29','图 30')],[0,s=>s+' 如图 31。'],[1,s=>s.replace('图 31','图 29')],[1,s=>s.replace('18.','17.')]]){
  const a=structuredClone(preceding);a.blockTexts[i].text=change(a.blockTexts[i].text);
  assert.equal(plan(a),undefined);
 }
 assert.equal(plan(preceding,following,raw(preceding).replace('图 31','图 32')),undefined);
});
check('Unseen content, changed quantities, incompatible columns and conflicting figure geometry are held',()=>{
 assert.equal(plan(preceding,following,raw(preceding)+'\n另一个物理量为5m'),undefined);
 assert.equal(plan(preceding,following,raw(preceding).replace('第 3 页','第 4 页')),undefined);
 assert.equal(plan(preceding,following,raw(preceding),raw(following).replace('20m','28m')),undefined);
 const wrong=structuredClone(following);wrong.blocks.blocks[2].box[0]=.28;
 assert.equal(plan(preceding,wrong),undefined);
 const mixed=structuredClone(following);mixed.blocks.blocks[1].box[3]=.36;
 assert.equal(plan(preceding,mixed),undefined);
 const closed=structuredClone(preceding);closed.blockTexts[1].text+='。';
 assert.equal(plan(closed),undefined);
});
check('Frozen receipts and crop planning reject any substituted or excluded block',()=>{
 const {box,...result}=plan(),resourceId='resource_'+crypto.randomUUID(),version='3'.repeat(64);
 const source={schemaVersion:'xiaozhi.material-page-source.v1',resourceId,version,generation:crypto.randomUUID(),page:4,receiptSha:'1'.repeat(64)};
 const image={schemaVersion:MATERIAL_PREVIEW_SCHEMA,ok:true,requestId:crypto.randomUUID(),resourceId,version,engine:PDF_PAGE_ENGINE,assetId:'asset_'+crypto.randomUUID(),page:4,total:13,box,width:300,height:300,sha256:'4'.repeat(64)};
 const frozen={...result,...following,schemaVersion:PAGE_CONTINUATION_CAPTION,source,image,scope:{kind:'selected_pages'}};
 assert(validPageContinuation(frozen));
 const prompt={policy:'page-fragments.v3',...preceding,continuation:frozen,continuationCropPolicy:CONTINUATION_FIGURE_CROPS};
 assert.deepEqual(continuationCropGroups(prompt,['block-2'],'18').flatMap(g=>g.blockIds),['block-2','next:block-3','next:block-4','next:block-5']);
 assert.throws(()=>continuationCropGroups(prompt,['block-1','block-2'],'18'),/source_incomplete/u);
 assert(!validPageContinuation({...frozen,blockIds:['block-2',...frozen.blockIds]}));
 assert(!validPageContinuation({...frozen,nextNumber:'20'}));
 assert(!validPageContinuation({...frozen,preceding:{...frozen.preceding,text:frozen.preceding.text.replace('31','29')}}));
});
if(process.argv[2]){
 const root=fs.realpathSync(process.argv[2]),db=new DatabaseSync(path.join(root,'data/app.db'),{readOnly:true});
 try{
  check('Actual PDFium, RapidOCR and PP-DocLayout distinguish Figure 10, question 5 and Figure 11',()=>{
   const resource=db.prepare('SELECT * FROM teacher_resources WHERE id=?').get('resource_5b62fdae-5140-4e46-8516-4fa73d92664a');
   assert.equal(sha(fs.readFileSync(resource.local_path)),resource.content_hash);
   const job=db.prepare('SELECT generation,total FROM material_pdf_jobs WHERE resource_id=?').get(resource.id);
   const read=page=>{
    const raw=JSON.parse(db.prepare('SELECT result_json FROM material_pdf_pages WHERE generation=? AND page=?').get(job.generation,page).result_json);
    const {layout:ocr,pageBlocks:{receipt:blocks}}=JSON.parse(fs.readFileSync(path.join(root,'page-'+page+'.json'),'utf8'));
    assert.equal(ocr.inputSha256,resource.content_hash);
    assert.equal(sha(Buffer.from(ocr.png,'base64')),blocks.rasterSha256);
    return {raw,...refinePageLineBlocks({blocks,blockTexts:pageBlockTexts(blocks,ocr),lines:ocr.lines})};
   };
   const a=read(5),b=read(6),reach=()=>continuationCaptionPrefix(a,a.raw.text,b,b.raw.text,5);
   assert.equal(continuationSentencePrefix(a,a.raw.text,b,b.raw.text,5,job.total),undefined);
   const result=reach();
   assert.deepEqual([result.number,result.nextNumber],['5','6']);
   assert.deepEqual(result.blockIds,['block-3','block-4','block-5']);
   assert(result.preceding.text.endsWith('竖直')&&result.text.startsWith('放置')&&result.text.includes('图 11:'));
   assert(result.box[1]>b.blocks.blocks[1].box[3]&&result.box[3]<b.blocks.blocks[5].box[1]);
   const nextRaw=JSON.parse(db.prepare('SELECT result_json FROM material_pdf_pages WHERE generation=? AND page=7').get(job.generation).result_json).text;
   assert(!hasCaptionContinuationLead(nextRaw));
   const time=run=>{
    const readings=Array.from({length:100},()=>{const start=performance.now();run();return performance.now()-start;});
    return Number(readings.sort((x,y)=>x-y)[94].toFixed(4));
   };
   console.log(JSON.stringify({previewP95Ms:time(()=>hasCaptionContinuationLead(b.raw.text)),plannerP95Ms:time(reach)}));
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
  check('Same original chart, title and merged stem qualify, with layout OCR preserved independently',()=>{
   assert.equal(prompt.continuation.schemaVersion,PAGE_CONTINUATION_CAPTION);
   assert(prompt.continuation.text.includes('4+P'));
   const result=planAiPageQuestion({batchId,ordinal:1,source:unit.pageSource,sources:unit.sources,firstRaw:row.first_json,
    finalRaw:row.final_json,first,final,review,imageSha:row.image_sha,title:'Source proof',model:'deepseek-flash',
    originalQuestions:[],pagePrompt:prompt,crops,following:'unknown'},question);
   assert.equal(result.archive.state,'ai_final');
   assert.equal(result.archive.sourceChecked,false);
   const diagram=result.document.context.illustrations.blockIds.map(id=>result.document.blocks.find(b=>b.id===id));
   assert(diagram.some(b=>b.anchors[0].page===6));
   assert(result.document.context.sourceContent.crops.some(c=>c.readings.every(r=>r.parts.some(p=>p.role==='figure'&&p.text.includes('\n4\nP\n')))));
  });
  check('Even two identical false readings cannot change a figure number, tick or stem condition',()=>{
   const alter=(original,change)=>{
    const response=structuredClone(original),q=response.questions[0];
    q.stem=change(q.stem);
    for(const field of Object.values(q.projection))field.text=change(field.text);
    for(const crop of response.readings[0].crops){
     crop.text=change(crop.text);
     for(const part of crop.parts)part.text=change(part.text);
    }
    return response;
   };
   for(const change of [s=>s.replace('图 11:','图 10:'),s=>s.replace('\n4\nP','\n8\nP'),s=>s.replace('\n4\nP','\n4+P'),
    s=>s.replace('\n3\n2\n1','\n32\n1'),s=>s.replaceAll('(3m,1m)','(3m,2m)'),s=>s.replace('\nO\n','\nQ\n')]){
    const left=alter(review,change),right=alter(final,change);
    assert(!pageFragmentsAgree(left,right,question.number,crops,right.questions[0].stem,prompt));
   }
  });
  check('A fabricated figure explanation never passes alongside correct literal readings',()=>{
   const [left,right]=[review,final].map(original=>{
    const response=structuredClone(original);
    response.questions[0].projection.figures.text+='\n图 99 的纵轴最大刻度为 90。';
    return response;
   });
   assert(!pageFragmentsAgree(left,right,question.number,crops,question.stem,prompt));
  });
  check('A zero elsewhere in the figure is not treated as the named horizontal origin',()=>{
   const candidate=structuredClone(crops);
   const crop=candidate.find(c=>c.number===question.number);
   const index=crop.fragments.findIndex(f=>f.blockIds.includes('next:block-4'));
   const quality=crop.fragments[index].quality;
   const moveLabel=(text,label)=>text.replace('\n'+label+'\n','\n').replace('y/m\n','y/m\n'+label+'\n');
   quality.text=moveLabel(quality.text,'0');
   const ocrSha256=sha(quality.text);
   const [left,right]=[review,final].map(original=>{
    const response=structuredClone(original),figure=response.questions[0].projection.figures;
    figure.text=moveLabel(figure.text,'O');
    const reading=response.readings[0].crops[index];
    reading.ocrSha256=ocrSha256;
    reading.text=moveLabel(reading.text,'O');
    reading.parts[0].text=reading.text;
    return response;
   });
   assert(!pageFragmentsAgree(left,right,question.number,candidate,question.stem,prompt));
  });
 }finally{db.close();}
}
console.log(JSON.stringify({success:true,checks}));
