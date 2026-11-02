import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
const {basketFixture}=await import('./paper-basket-fixture.mjs');
const {PaperBasketV2Repository}=await import('../../src/main/education/paper-basket-v2-repository.ts');
const {PAPER_BASKET_V2_SCHEMA}=await import('../../src/shared/paper-basket-v2.ts');
const {PAPER_BASKET_SCHEMA}=await import('../../src/shared/paper-basket.ts');
const {validPaperInstanceContent,sourcePaperInstanceContent}=await import('../../src/shared/paper-instance.ts');
const {basketSnapshotCurrent}=await import('../../src/renderer/components/paper-ui/paper-basket-ui.ts');
const {compilePaperOffice,assertPaperOffice}=await import('../../src/main/education/paper-export.ts');
const {validQuestionDocument}=await import('../../src/shared/question-document.ts');
const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');
const {nativeTestPng}=await import('./native-test-png.mjs');
const phase=process.env.U4_B_ASTRA_PHASE||'after';
const output=fs.mkdtempSync(path.join(tmpdir(),'omni-paper-instance-astra-'+phase+'-'));
const report={phase,success:false,checks:[],output,boundary:'Real owned SQLite and production source/compiler/UI guard functions; no Electron/build/model; no product acceptance'};
const sourceFiles=['src/main/education/paper-repository.ts','src/shared/paper-instance.ts','src/shared/paper-basket-v2.ts','src/main/education/paper-instance-export.ts'];
report.sourceHashes=Object.fromEntries(sourceFiles.map(file=>[file,createHash('sha256').update(fs.readFileSync(new URL('../../'+file,import.meta.url))).digest('hex')]));
async function check(name,action){try{const facts=await action();report.checks.push({name,pass:true,...(facts?{facts}:{})});console.log('PASS '+name);}catch(error){report.checks.push({name,pass:false,error:String(error.stack||error)});console.error('FAIL '+name+' '+error.message);}}
const blueprint={title:'Astra三项回归',subject:'数学',grade:'初二',durationMinutes:40,totalPoints:10,mode:'source_only',sections:[{id:'a',label:'解答题',questionType:'解答题',count:1,points:10}]};
async function owned(name){const f=await basketFixture(path.join(output,name));const v2=new PaperBasketV2Repository({...f.host,saveSnapshot:(...a)=>f.papers.createBasketSnapshotInTransaction(...a),readSnapshot:(...a)=>f.papers.reviewInTransaction(...a)},f.papers);const schema={schemaVersion:PAPER_BASKET_V2_SCHEMA,sessionId:f.sid};const ref=b=>({...schema,basketId:b.id});const mutate=(b,operation)=>v2.mutate({...ref(b),requestId:randomUUID(),expectedRevision:b.revision,operation});const review=b=>mutate(b,{type:'reviewEntry',entryId:b.entries[0].entryId,expectedInstanceRevision:b.entries[0].instance.instanceRevision,expectedContentDigest:b.entries[0].instance.contentDigest,action:'confirm'});const snapshot=b=>v2.createSnapshot({...ref(b),requestId:randomUUID(),expectedRevision:b.revision});const confirm=p=>f.papers.decide({schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:f.sid,id:p.id,revision:1,action:'confirm'},()=>true);async function filled(q){let b=await v2.create({...schema,requestId:randomUUID(),blueprint});b=await mutate(b,{type:'add',questionId:q.id,sectionId:'a',expectedSourceVersion:questionVersion(q)});return review(b);}return {...f,v2,schema,ref,mutate,review,snapshot,confirm,filled};}
await check('P2-1: persisted v2 binding reaches real preview guard, review/decide/latest/cold reads; stale basket stays blocked',async()=>{
 const f=await owned('binding');try{const q=f.question('绑定');let b=await f.filled(q);const p=await f.snapshot(b);
 const row=f.db.prepare('SELECT payload_json FROM ai_confirmation_items WHERE id=?').get(p.id),stored=JSON.parse(row.payload_json).input.basket;
 assert.deepEqual(p.basket,stored,'snapshot v2 view must expose the persisted basket binding');assert.equal(basketSnapshotCurrent(b,p),true,'real preview guard must allow current exact snapshot');
 const read=await f.papers.review(f.sid,p.id);assert.deepEqual(read.basket,stored);const confirmed=await f.confirm(read);assert.equal(basketSnapshotCurrent(b,confirmed),true);assert.deepEqual((await f.papers.latest(f.sid)).basket,stored);
 const cold=f.repositories();assert.deepEqual((await cold.papers.review(f.sid,p.id)).basket,stored);
 b=await f.mutate(b,{type:'editEntry',entryId:b.entries[0].entryId,expectedInstanceRevision:b.entries[0].instance.instanceRevision,content:{...sourcePaperInstanceContent(),answer:{mode:'edited',blocks:[{type:'text',text:'改后答案'}]}}});
 const stale=await f.papers.review(f.sid,p.id);assert.deepEqual(stale.basket,stored);assert.equal(stale.sourceCurrent,false);assert.equal(basketSnapshotCurrent(b,stale),false);await assert.rejects(f.papers.withConfirmedSource(f.sid,p.id,confirmed.digest,()=>{throw Error('must_not_install');}),/conflict/);
 return {basketId:stored.basketId,basketRevision:stored.basketRevision,entryIds:stored.entryIds,confirmedId:p.id};}finally{f.close();}
});
await check('P2-2: chained math prose passes every editable role/container while HTML, resources and TeX directives remain rejected',async()=>{
 const positives=['x<y','a<b','\\frac{x}{y}<b','x<y 且 y>0','a<b 且 b>c','0<x<1 且 x>0','x < y 且 y > 0','a<b，且b>0','x<y and y>0','f(x)<y 且 z+1>0'];
 for(const value of positives)for(const role of ['question','answer','analysis']){const c={...sourcePaperInstanceContent(),[role]:{mode:'edited',blocks:[{type:'text',text:value}]}};assert(validPaperInstanceContent(c),role+' math prose rejected: '+value);}
 assert(validPaperInstanceContent({...sourcePaperInstanceContent(),question:{mode:'edited',blocks:[{type:'formula',latex:'\\frac{x}{y}<b 且 b>0'},{type:'options',items:[{label:'A',text:'x<y 且 y>0'}]},{type:'subquestions',items:[{label:'1',text:'a<b 且 b>0'}]},{type:'table',rows:[['条件','范围'],['x<y 且 y>0','0<x<1']]}]}}));
 const denied=['<img src="x">','<img src=x/>','<script>alert(1)</script>','<div class="x">正文</div>','<a href="x">link</a>','<custom-element enabled>','<div 标题="中文">正文</div>','<img 标签="中文">','x<y onclick="alert(1)">0','<y 且 y>','<!--comment-->','<!DOCTYPE html>','https://example.test','file:///c:/x','data:image/png;base64,aaa','javascript:alert(1)','C:\\secret.txt','\\\\server\\share'];
 for(const value of denied)assert(!validPaperInstanceContent({...sourcePaperInstanceContent(),question:{mode:'edited',blocks:[{type:'text',text:value}]}}),'unsafe markup/resource accepted: '+value);
 for(const latex of ['\\input{x}','\\include{x}','\\includegraphics{x}','\\href{x}{y}','\\url{x}','\\htmlClass{x}{y}'])assert(!validPaperInstanceContent({...sourcePaperInstanceContent(),question:{mode:'edited',blocks:[{type:'formula',latex}]}}),'unsafe formula accepted: '+latex);
 return {positiveStrings:positives.length,roles:3,deniedStrings:denied.length};
});
await check('P2-3: source-mode teacher/AI math supplementation survives old role screenshots; provenance and student isolation match old compiler',async()=>{
 const f=await owned('role-origin');try{const png=nativeTestPng(),sha=createHash('sha256').update(png).digest('hex'),cases=[];
 for(const origin of ['teacher','ai_generated','source']){
  const q=f.question('origin-'+origin,{answer:'$\\frac{7}{9}$ 补答哨兵',analysis:'$\\sqrt{25}$ 补解哨兵'});
  const image=role=>({id:'source_'+role+'_0',kind:'image',anchors:[{page:1,box:[0,0,1,1]}],assetId:'asset_'+randomUUID(),sha256:sha,mime:'image/png',width:png.readUInt32BE(16),height:png.readUInt32BE(20)}),images=['question','answer','analysis'].map(image);
  const evidence=role=>({origin,text:q[role],anchors:origin==='source'?[images[role==='answer'?1:2].anchors[0]]:[],...(origin==='ai_generated'?{generator:{provider:'controlled',model:'no-call',runId:'controlled-origin'}}:{})});
  q.document={schemaVersion:'xiaozhi.question-document.v2',source:{resourceId:'resource_'+randomUUID(),resourceVersion:'c'.repeat(64),parserVersion:'teacher-transcription.v2+fixture',ocrVersion:''},blocks:images,answer:evidence('answer'),analysis:evidence('analysis'),context:{schemaVersion:'xiaozhi.question-projection.v1',projection:Object.fromEntries(['statement','formulas','tables','figures','choices','subquestions'].map(k=>[k,k==='statement'?{state:'provided',text:q.stem}:{state:'not_applicable',text:''}])),sourceBlockIds:[images[0].id]}};
  assert(validQuestionDocument(q.document));f.put(q);const b=await f.filled(q),p=await f.confirm(await f.snapshot(b));
  const v2=compilePaperOffice(p,'teacher'),student=compilePaperOffice(p,'student');const legacy={...p,selection:{...p.selection,items:p.selection.items.map(({instance,...item})=>item)}};const old=compilePaperOffice(legacy,'teacher');
  const prose=d=>d.sections.flatMap(s=>s.paragraphs).join('\n'),actual=prose(v2),previous=prose(old);assert.equal(prose(student).includes('补答哨兵'),false);assert.equal(prose(student).includes('补解哨兵'),false);
  const labels={teacher:'教师补充',ai_generated:'AI补充（待核验）',source:'原资料'};const actualFigs=v2.sections.flatMap(s=>s.figures||[]);assert.deepEqual(actualFigs.map(v=>[v.blockId,v.role,v.version]),old.sections.flatMap(s=>s.figures||[]).map(v=>[v.blockId,v.role,v.version]));
  if(origin!=='source'){assert(actual.includes(q.answer),'teacher/AI answer lost behind old screenshot: '+origin);assert(actual.includes(q.analysis),'teacher/AI analysis lost behind old screenshot: '+origin);}
  else {assert.equal(actual.includes(q.answer),false);assert.equal(actual.includes(q.analysis),false);}
  for(const role of ['参考答案','解析']){assert(previous.includes(role+'来源：'+labels[origin]));assert(actual.includes(role+'来源：'+labels[origin]),'missing actual role provenance: '+role+'/'+origin);}
  assertPaperOffice(p,v2);const tampered=structuredClone(v2);tampered.sections[2].paragraphs.push('伪改');assert.throws(()=>assertPaperOffice(p,tampered),/conflict/);
  cases.push({origin,figures:actualFigs.length,answerText:actual.includes(q.answer),analysisText:actual.includes(q.analysis)});
 }
 return {cases};}finally{f.close();}
});
report.success=report.checks.every(c=>c.pass);report.passed=report.checks.filter(c=>c.pass).length;report.failed=report.checks.length-report.passed;fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2)+'\n');console.log(JSON.stringify({success:report.success,passed:report.passed,failed:report.failed,output}));if(!report.success)process.exitCode=1;
