import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync} from 'node:sqlite';
import {createHash} from 'node:crypto';
import {PDF_LAYOUT_ENGINE} from '../../src/shared/material-layout.ts';
import {continuationChoicePrefix,continuationPrefix,hasUnfinishedContinuationChoice,continuationChoicesAgree} from '../../src/shared/material-ai-continuation.ts';
import {pageBlockTexts} from '../../src/shared/material-ai-page-fragments.ts';
import {refinePageLineBlocks} from '../../src/shared/material-ai-line-blocks.ts';
import {PAGE_BLOCKS_ENGINE,PAGE_BLOCKS_SCHEMA} from '../../src/shared/material-page-blocks.ts';

const parent='7. 由图判断物体接下来会发生什么（\n）。',top=parent+'\n第 1 页共 2 页';
const choices='A. 保持静止\nB. 沿斜面向上运动\nC. 沿斜面向下运动\nD. 沿水平面匀速运动',next=choices+'\n8. 计算另一问的速度。';
const groups={ok:true,schemaVersion:PAGE_BLOCKS_SCHEMA,engine:PAGE_BLOCKS_ENGINE,rasterSha256:'1'.repeat(64),width:1100,height:2000,
 blocks:[{id:'block-1',kind:'text',score:.9,box:[.1,.1,.9,.4],needsReview:true},{id:'block-2',kind:'text',score:.9,box:[.1,.6,.91,.8],needsReview:true}]};
const before=[{blockId:'block-4',text:parent}],hints=[{blockId:'block-1',text:choices},{blockId:'block-2',text:'8. 计算另一问的速度。'}];
const {sourceCropKinds}=await import('../../src/shared/material-ai-owned-crops.ts');
let checks=0;
function check(name,fn){fn();checks++;console.log('PASS '+name);}
const plan=(current=top,blockHints=before,following=next,expected=hints,geometry=groups)=>continuationChoicePrefix(current,blockHints,following,geometry,expected);
check('Following page begins with an ordered choice list under the preceding open stem',()=>{
 assert(hasUnfinishedContinuationChoice(top));
 assert.equal(continuationPrefix(top,before,next,groups,hints),undefined);
 const value=plan();
 assert.equal(value.number,'7');
 assert.equal(value.nextNumber,'8');
 assert.equal(value.text,choices);
 assert.deepEqual(value.blockIds,['block-1']);
 assert(value.box[3]<groups.blocks[1].box[1]);
});
check('Inline choices and parenthesized labels are recognized, with unchanged source units',()=>{
 const horizontal=choices.replaceAll('\n','　').replace(/[A-D]\./g,label=>'（'+label[0]+'）');
 assert.equal(plan(top,before,horizontal+'\n'+hints[1].text).text,horizontal);
 for(const tail of [choices,horizontal])assert(continuationChoicesAgree(tail,'前页题干（ ）。\n'+choices));
});
check('Written answer, completed choices, missing stem cue and wrong predecessor stay held',()=>{
 for(const head of [top.replace('（\n）','（B）'),top.replace('（\n）',''),top.replace('7.','6.'),parent+'\nA. 已印选项']){
  assert.equal(plan(head),undefined,head);
 }
 assert.equal(plan(top,[{...before[0],text:parent.replace('物体','苹果')}]),undefined);
});
check('Duplicated, empty, missing, reordered and cross-question options cannot borrow a neighbouring block',()=>{
 for(const tail of [choices.replace('B. 沿斜面向上运动',''),choices.replace('C. 沿斜面向下运动','A. 沿斜面向下运动'),choices.replace(/保持静止/,''),
  '图3标注\n'+choices,choices+'\n10. 其他题',choices.replace('沿水平面','沿竖直面')]){
  assert.equal(plan(top,before,tail+'\n8. 后一题'),undefined,tail);
 }
 const crossing=structuredClone(groups);
 crossing.blocks[0].box[3]=.68;
 assert.equal(plan(top,before,next,hints,crossing),undefined);
 const oneBlock={...groups,blocks:groups.blocks.slice(0,1)};
 assert.equal(plan(top,before,next,[{blockId:'block-1',text:choices+'\n8. 后一题'}],oneBlock),undefined);
});
check('Matching Chinese prose can only anchor a crop; changed numbers, formula or unit fail the publication comparison',()=>{
 const raw='A. 根据 R=U/I 由电流和电压可以求出导体的电阻。\nB. 电阻的单位为 Ω。';
 const layout=raw.replace('U/I ','字');
 const value=plan(top,before,raw+'\n8. 另一道题。',[{blockId:'block-1',text:layout},hints[1]]);
 assert.equal(value.text,raw);
 for(const change of [layout,raw.replace('Ω','kΩ'),raw.replace('U/I','I/U'),raw+'\n外来文字',raw.replace('B.','D.')])assert(!continuationChoicesAgree(raw,'问句\n'+change));
 assert(continuationChoicesAgree(raw,'问句\n'+raw));
});
check('Literal crop roles resolve same block IDs using their own page and reject mixed or stale scopes',()=>{
 const following={...groups,blocks:[{...groups.blocks[0],kind:'image'},{...groups.blocks[1],kind:'table'}]};
 assert.deepEqual(sourceCropKinds(groups,[['block-1'],['next:block-1'],['next:block-2']],following),['body','figure','table']);
 for(const invalid of [[['next:block-1']], [['block-1','next:block-1'],following], [['next-block-1'],following], [['next:block-99'],following]]){
  const [ids,scope]=invalid;
  assert.throws(()=>sourceCropKinds(groups,[ids],scope),/source_changed/);
 }
});
if(process.argv[2]){
 const data=fs.realpathSync(process.argv[2]);
 const hash=value=>createHash('sha256').update(value).digest('hex');
 const key=values=>hash(JSON.stringify(values));
 assert.equal(path.basename(path.dirname(data)),'flow-1gb-20261111');
 const db=new DatabaseSync(path.join(data,'app.db'),{readOnly:true});
 try{
  check('Real local PDFium, RapidOCR and PP-DocLayout receipts bind the complete option group and exclude the ambiguous annotated page',()=>{
   const cases=[['aibatch_beeb42f0-318b-4fd2-a7e5-bd009f640e4c',true],['aibatch_fd6cd220-4134-4015-b5d7-1702b08e3a77',false]];
   for(const [batch,pass] of cases){
    const unit=JSON.parse(db.prepare('SELECT input_json FROM material_ai_units WHERE batch_id=? AND ordinal=1').get(batch).input_json);
    const page=unit.pageSource,reading=JSON.parse(db.prepare('SELECT result_json FROM material_pdf_pages WHERE generation=? AND page=?').get(page.generation,page.page+1).result_json);
    const layoutKey=key([page.resourceId,page.version,PDF_LAYOUT_ENGINE,page.page+1]);
    const layout=JSON.parse(fs.readFileSync(path.join(data,'cache/material-layout/v1',layoutKey+'.json'),'utf8')).receipt;
    assert(layout.page===page.page+1&&hash(Buffer.from(layout.png,'base64'))===layout.rasterSha256);
    const blocksKey=key([page.resourceId,page.version,page.page+1,layout.rasterSha256,PAGE_BLOCKS_ENGINE]);
    const blocks=JSON.parse(fs.readFileSync(path.join(data,'cache/material-page-blocks/v1',blocksKey+'.json'),'utf8'));
    const original=refinePageLineBlocks({blocks,blockTexts:pageBlockTexts(blocks,layout),lines:layout.lines});
    const times=[],legacy=[];let result;
    for(let i=0;i<100;i++){
     let start=performance.now();
     const old=continuationPrefix(unit.text,unit.pagePrompt.blockTexts,reading.text,original.blocks,original.blockTexts);
     assert.equal(old,undefined);
     legacy.push(performance.now()-start);
     start=performance.now();
     result=continuationChoicePrefix(unit.text,unit.pagePrompt.blockTexts,reading.text,original.blocks,original.blockTexts);
     times.push(performance.now()-start);
    }
    assert.equal(!!result,pass);
    if(pass){
     assert.equal(result.number,'5');
     assert.equal(result.nextNumber,'6');
     assert.deepEqual(result.blockIds,['block-1']);
     assert(continuationChoicesAgree(result.text,result.text));
     assert.equal(result.text,reading.text.slice(0,reading.text.indexOf('\n6.')).trim());
     assert.equal(result.text.includes('下一题'),false);
    }
    console.log(JSON.stringify({page:page.page,next:page.page+1,selection:!!result,legacyP95Ms:Number(legacy.sort((a,b)=>a-b)[94].toFixed(3)),newP95Ms:Number(times.sort((a,b)=>a-b)[94].toFixed(3))}));
   }
  });
 }finally{db.close();}
}
console.log(JSON.stringify({success:true,checks}));
