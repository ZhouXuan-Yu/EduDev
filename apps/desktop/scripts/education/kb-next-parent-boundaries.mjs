import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {DatabaseSync,backup} from 'node:sqlite';
import {readAiPageSource,readFollowingPageBoundary,followingPageStatus,validateAiPageSource} from '../../src/main/assets/material-ai-page-source.ts';
import {MaterialChoiceRechecks,NEXT_PARENT_RECHECK_TABLE} from '../../src/main/assets/material-ai-choice-rechecks.ts';
import {readAiPageReceipt} from '../../src/main/assets/material-ai-page-evidence.ts';

const file=process.argv[2],qa=new DatabaseSync(':memory:');
const resource='resource_00000000-0000-4000-8000-000000000010',version='1'.repeat(64),generation='00000000-0000-4000-8000-000000000011';
qa.exec(`CREATE TABLE teacher_resources(id,content_hash,original_file_name,parse_status);
CREATE TABLE material_pdf_jobs(resource_id,version,generation,state,total);
CREATE TABLE material_pdf_pages(generation,page,status,result_json,error);
CREATE TABLE resource_chunks(resource_id,page_number,contains_personal_data);`);
qa.prepare('INSERT INTO teacher_resources VALUES(?,?,?,?)').run(resource,version,'试卷.pdf','partial');
qa.prepare('INSERT INTO material_pdf_jobs VALUES(?,?,?,?,?)').run(resource,version,generation,'partial',2);
const basic={status:'complete',error:'',method:'native',text:'1 / 2\n第一页文字',nativeText:'1 / 2\n第一页文字',ocrText:'',width:500,height:700,imageArea:1,nativeBoxes:[]};
qa.prepare('INSERT INTO material_pdf_pages VALUES(?,?,?,?,?)').run(generation,1,'complete',JSON.stringify(basic),'');
qa.prepare('INSERT INTO material_pdf_pages VALUES(?,?,?,?,?)').run(generation,2,'complete',JSON.stringify(basic),'');
const host={all:async(sql,args=[])=>qa.prepare(sql).all(...args)};
const source=(await readAiPageSource(host,resource,version,1)).source;
const a='8．一物体在水平面上受到水平向右、大小为 8N 的恒力',b='8. 一物体在水平面上受到水平向右、大小为 8N的恒力';
function setPage(nativeText,ocrText,error='text_conflict',status='needs_review'){
 const raw={...basic,status,error,method:'ocr',text:ocrText,nativeText,ocrText};
 qa.prepare('UPDATE material_pdf_pages SET status=?,result_json=?,error=? WHERE page=2').run(status,JSON.stringify(raw),error);
}
let checks=0;
const check=async(name,fn)=>{await fn();checks++;console.log('PASS '+name);};
try{
 await check('Matching first parent gives bounded proof while next page remains needs_review',async()=>{
  for(const header of ['', '2 / 2\n','第 2 页共 2 页\n']){
   setPage(header+a+'\n一个存在争议的后段',b+'\n完全不同的后段');
   const result=await readFollowingPageBoundary(host,source,2,'7');
   assert.equal(result.status,'separate');
   assert.equal(result.nextParentSource.page,2);
   assert.equal((await validateAiPageSource(host,result.nextParentSource)).status,'needs_review');
   assert.equal(await followingPageStatus(host,source,2),'unknown');
  }
 });
 await check('A continuation, caption, wrong page counter or heading before a matching next parent stays unknown',async()=>{
  for(const prefix of ['(2)接上一题\n','图 2\n','读完前题材料再计算。\n','1 / 2\n','2 / 3\n','二、填空题\n']){
   setPage(prefix+a,b);
   assert.equal((await readFollowingPageBoundary(host,source,2,'7')).status,'unknown',prefix);
  }
 });
 await check('Nonconsecutive or disagreeing parent, quantity change and missing source stay held',async()=>{
  for(const [native,ocr,prior] of [[a,b,'6'],[a,b.replace('8.','9.'),'7'],[a,b.replace('8N','6N'),'7'],[a,'','7'],['8. 标签','8. 标签','7'],[a,b,'007']]){
   setPage(native,ocr);
   assert.equal((await readFollowingPageBoundary(host,source,2,prior)).status,'unknown');
  }
 });
 await check('A generic poor-scan error, wrong document generation and any private next page are excluded',async()=>{
  setPage(a,b,'ocr_unreliable');
  assert.equal(await followingPageStatus(host,source,2,'7'),'unknown');
  setPage(a,b);
  assert.equal(await followingPageStatus(host,{...source,generation:generation.replace('011','022')},2,'7'),'unknown');
  qa.prepare('INSERT INTO resource_chunks VALUES(?,?,1)').run(resource,2);
  assert.equal(await followingPageStatus(host,source,2,'7'),'unknown');
  qa.exec('DELETE FROM resource_chunks');
 });
 await check('A bare matching fraction requires a corroborated counter on the preceding source page',async()=>{
  setPage('2 / 2\n'+a,b);
  const prior={...basic,text:'没有页码的正文',nativeText:'没有页码的正文'};
  qa.prepare('UPDATE material_pdf_pages SET result_json=? WHERE page=1').run(JSON.stringify(prior));
  const newer=(await readAiPageSource(host,resource,version,1)).source;
  assert.equal(await followingPageStatus(host,newer,2,'7'),'unknown');
  qa.prepare('UPDATE material_pdf_pages SET result_json=? WHERE page=1').run(JSON.stringify(basic));
 });
 await check('Strong legacy continuation and final-page decisions are unchanged',async()=>{
  setPage('', '(2) 接着计算已知量。\n8. 下一题独立条件','', 'complete');
  assert.equal(await followingPageStatus(host,source,2,'7'),'continued');
  assert.equal(await followingPageStatus(host,{...source,page:2},2,'8'),'separate');
 });
}finally{qa.close();}
if(file){
 const data=fs.realpathSync(file);
 assert.equal(path.basename(path.dirname(data)),'flow-1gb-20261111');
 const original=new DatabaseSync(process.argv[3]??path.join(data,'app.db'),{readOnly:true});
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'edu-next-parent-'));
 const copy=path.join(temp,'app.db');
 await backup(original,copy);
 const db=new DatabaseSync(copy);
 const h={root:()=>data,all:async(sql,args=[])=>db.prepare(sql).all(...args),run:async(sql,args=[])=>db.prepare(sql).run(...args)};
 h.proof=async(id,ordinal)=>{
  const value=await readAiPageReceipt(h,id,ordinal);
  await validateAiPageSource(h,value.unit.pageSource);
  return value;
 };
 const read=(db,id)=>db.prepare('SELECT * FROM question_bank_items WHERE id=?').get(id);
 const action=new MaterialChoiceRechecks(h);
 const targets=[
  ['question_e36ad30a-2dd3-4ce3-b53d-7cbdd09652ac','2','aibatch_905bfe20-82d3-42c8-8cad-3c393f2e227e',['missing_grade','answer_conflict']],
  ['question_e57f8f6b-6d64-47c3-8a21-28572a258260','7','aibatch_9d9e3e37-8cb6-4ab3-a87f-d72e02d813d3',[]],
 ];
 try{
  await check('Both real false holds are repaired through the local writer; true continuation stays held',async()=>{
   db.exec(NEXT_PARENT_RECHECK_TABLE);
   const pdfFacts=JSON.stringify(db.prepare('SELECT * FROM material_pdf_pages ORDER BY generation,page').all());
   const originals=JSON.stringify(db.prepare('SELECT * FROM material_ai_units ORDER BY batch_id,ordinal').all());
   const earlier=JSON.stringify(db.prepare('SELECT * FROM material_ai_choice_rechecks ORDER BY question_id').all());
   for(const [id,number,batch,remaining] of targets){
    const {unit}=await h.proof(batch,1);
    const p95=samples=>Number(samples.sort((a,b)=>a-b)[Math.ceil(samples.length*.95)-1].toFixed(3));
    const previous=[],current=[];
    for(let i=0;i<100;i++){
     let start=performance.now();
     await followingPageStatus(h,unit.pageSource,unit.pagePrompt.totalPages);
     previous.push(performance.now()-start);
     start=performance.now();
     await readFollowingPageBoundary(h,unit.pageSource,unit.pagePrompt.totalPages,number);
     current.push(performance.now()-start);
    }
    const start=performance.now();
    assert.equal(await followingPageStatus(h,unit.pageSource,unit.pagePrompt.totalPages),'unknown');
    const boundary=await readFollowingPageBoundary(h,unit.pageSource,unit.pagePrompt.totalPages,number);
    assert.equal(boundary.status,'separate');
    assert((await action.view(batch)).layoutCandidates>0);
    const before=read(original,id);
    db.exec('BEGIN IMMEDIATE');
    try{
     assert.equal(await action.apply(batch,'layout'),1);
     assert.notEqual(read(db,id).archive_json,before.archive_json);
    }finally{db.exec('ROLLBACK');}
    assert.deepEqual(read(db,id),before);
    assert.equal(db.prepare('SELECT COUNT(*) n FROM material_ai_next_parent_rechecks WHERE question_id=?').get(id).n,0);
    db.exec('BEGIN IMMEDIATE');
    try{assert.equal(await action.apply(batch,'layout'),1);db.exec('COMMIT');}catch(error){db.exec('ROLLBACK');throw error;}
    const after=read(db,id);
    const {archive_json:afterArchive,...unchanged}=after,{archive_json:beforeArchive,...old}=before;
    assert.deepEqual(unchanged,old);
    const archive=JSON.parse(afterArchive);
    assert.deepEqual(archive.issues,remaining);
    assert.equal(archive.state,remaining.length?'ai_needs_review':'ai_final');
    assert.equal(archive.sourceChecked,false);
    const audit=db.prepare('SELECT * FROM material_ai_next_parent_rechecks WHERE question_id=?').get(id);
    assert.equal(audit.before_archive_json,beforeArchive);
    assert.equal(audit.after_archive_json,afterArchive);
    assert.deepEqual(JSON.parse(audit.next_source_json),boundary.nextParentSource);
    assert.equal(await action.apply(batch,'layout'),0);
    console.log(JSON.stringify({realPage:unit.pageSource.page,nextPage:boundary.nextParentSource.page,remaining,beforeP95Ms:p95(previous),afterP95Ms:p95(current),elapsedMs:Math.round(performance.now()-start)}));
   }
   const realContinuation='question_3165f612-6512-4042-9f41-63b034edb19c',batch='aibatch_4556ba3b-f8ac-4745-9b68-25195ac12c69';
   const {unit}=await h.proof(batch,1);
   assert.equal((await readFollowingPageBoundary(h,unit.pageSource,unit.pagePrompt.totalPages,'1')).status,'unknown');
   assert.equal(await action.apply(batch,'layout'),0);
   assert.deepEqual(read(db,realContinuation),read(original,realContinuation));
   assert.equal(JSON.stringify(db.prepare('SELECT * FROM material_pdf_pages ORDER BY generation,page').all()),pdfFacts);
   assert.equal(JSON.stringify(db.prepare('SELECT * FROM material_ai_units ORDER BY batch_id,ordinal').all()),originals);
   assert.equal(JSON.stringify(db.prepare('SELECT * FROM material_ai_choice_rechecks ORDER BY question_id').all()),earlier);
  });
 }finally{db.close();original.close();}
}
console.log(JSON.stringify({success:true,checks}));
