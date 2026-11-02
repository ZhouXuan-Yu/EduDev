/** Targeted real SQLite regression for edited-choice delivery. Controlled owned
 * source adapters; no app/build/out/Git/model. Does not modify old tests/fixtures. */
import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {tmpdir} from 'node:os';
import {randomUUID,createHash} from 'node:crypto';
const {basketFixture}=await import('./paper-basket-fixture.mjs');
const {PaperBasketV2Repository}=await import('../../src/main/education/paper-basket-v2-repository.ts');
const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');
const {sourcePaperInstanceContent}=await import('../../src/shared/paper-instance.ts');
const {instanceDeliveryBlock,newPaperInstance}=await import('../../src/main/education/paper-instance.ts');
const {compilePaperOffice,assertPaperOffice}=await import('../../src/main/education/paper-export.ts');
const output=fs.mkdtempSync(path.join(tmpdir(),'omni-paper-instance-options-'));
const report={success:false,output,phase:process.env.U4_B_OPTIONS_PHASE??'after',scope:'owned-real-SQLite-production-host-compiler-options-guard',productAcceptance:false,checks:[]};
const sourceFiles=['src/shared/paper-basket-v2.ts','src/main/education/paper-instance.ts','src/main/education/paper-basket-v2-repository.ts','src/main/education/paper-export.ts','scripts/education/paper-instance-options-required.mjs'];
report.sourceHashes=Object.fromEntries(sourceFiles.map(f=>[f,createHash('sha256').update(fs.readFileSync(new URL('../../'+f,import.meta.url))).digest('hex')]));
const check=async(name,fn)=>{try {const facts=await fn();report.checks.push({name,pass:true,...(facts?{facts}:{})});console.log('PASS '+name);}catch(error){report.checks.push({name,pass:false,error:String(error.stack??error)});console.error('FAIL '+name+': '+error.message);}};
const source=()=>sourcePaperInstanceContent();
const textContent=()=>({...source(),question:{mode:'edited',blocks:[{type:'text',text:'仅修改本卷题干，保留为待补选项草稿'}]}});
const labelsContent=()=>({...textContent(),question:{mode:'edited',blocks:[{type:'text',text:'本卷有明确结构化选项'}, {type:'options',items:[{label:'甲',text:'当前选项第一项'},{label:'乙',text:'当前选项第二项'},{label:'戊',text:'当前选项第五项'}]}]}});
async function owned(name,type='选择题') {
  const f=await basketFixture(path.join(output,name));
  const v2=new PaperBasketV2Repository({...f.host,saveSnapshot:(...a)=>f.papers.createBasketSnapshotInTransaction(...a),readSnapshot:(...a)=>f.papers.reviewInTransaction(...a)},f.papers);
  const schema={schemaVersion:'xiaozhi.paper-basket.v2',sessionId:f.sid};
  const blueprint={title:'选项门禁 '+name,subject:'数学',grade:'初二',durationMinutes:20,totalPoints:10,mode:'source_only',sections:[{id:'a',label:type,questionType:type,count:1,points:10}]};
  const q=f.question(name,{questionType:type});
  const mutate=(b,operation)=>v2.mutate({...schema,basketId:b.id,expectedRevision:b.revision,requestId:randomUUID(),operation});
  let b=await v2.create({...schema,requestId:randomUUID(),blueprint});b=await mutate(b,{type:'add',questionId:q.id,sectionId:'a',expectedSourceVersion:questionVersion(q)});
  const edit=(basket,content)=>mutate(basket,{type:'editEntry',entryId:basket.entries[0].entryId,expectedInstanceRevision:basket.entries[0].instance.instanceRevision,content});
  const review=(basket,action='confirm')=>mutate(basket,{type:'reviewEntry',entryId:basket.entries[0].entryId,expectedInstanceRevision:basket.entries[0].instance.instanceRevision,expectedContentDigest:basket.entries[0].instance.contentDigest,action});
  const snapshot=basket=>v2.createSnapshot({...schema,basketId:basket.id,expectedRevision:basket.revision,requestId:randomUUID()});
  const confirm=p=>f.papers.decide({schemaVersion:'xiaozhi.paper-blueprint.v1',sessionId:f.sid,id:p.id,revision:p.revision,action:'confirm'},()=>true);
  return {...f,v2,schema,q,b,mutate,edit,review,snapshot,confirm};
}
await check('Plain edited choice is saved unchanged but options_required blocks confirmation/snapshot atomically and survives cold read',async()=>{
  const f=await owned('plain');try {
    const bank=f.db.prepare('SELECT * FROM questions ORDER BY id').all(),other=await f.v2.create({...f.schema,requestId:randomUUID(),blueprint:f.b.blueprint});
    const content=textContent(),b=await f.edit(f.b,content);assert.deepEqual(b.entries[0].instance.content,content);
    assert.equal(b.entries[0].deliveryBlock,'options_required');assert.equal(b.complete,false);assert.equal(b.entries[0].reviewCurrent,false);
    const facts=()=>['paper_baskets','paper_basket_operations','paper_instance_events','ai_confirmation_items'].map(t=>f.db.prepare('SELECT * FROM '+t+' ORDER BY rowid').all());
    const before=facts();await assert.rejects(f.review(b),/conflict/);assert.deepEqual(facts(),before);
    await assert.rejects(f.snapshot(b),/conflict/);assert.deepEqual(facts(),before);
    const cold=new PaperBasketV2Repository({...f.host,saveSnapshot:(...a)=>f.papers.createBasketSnapshotInTransaction(...a),readSnapshot:(...a)=>f.papers.reviewInTransaction(...a)},f.papers);
    const reread=await cold.read({...f.schema,basketId:b.id});assert.deepEqual(reread,b);
    assert.deepEqual(await f.v2.read({...f.schema,basketId:other.id}),other);assert.deepEqual(f.db.prepare('SELECT * FROM questions ORDER BY id').all(),bank);
    const rejected=await f.review(b,'reject');assert.equal(rejected.entries[0].instance.review.action,'reject');assert.equal(rejected.entries[0].deliveryBlock,'options_required');
    return {basketId:b.id,instanceRevision:b.entries[0].instance.instanceRevision,deliveryBlock:b.entries[0].deliveryBlock};
  }finally{f.close();}
});
await check('Explicit structured current options permit real review/snapshot/confirmation; all outputs use current labels without A-D fallback',async()=>{
  const f=await owned('labels');try {
    let b=await f.edit(f.b,labelsContent());assert.equal(b.entries[0].deliveryBlock,'needs_review');b=await f.review(b);assert(b.complete);
    const p=await f.confirm(await f.snapshot(b));assert.equal(p.state,'confirmed');assert.deepEqual(p.selection.items[0].instance.content,b.entries[0].instance.content);
    for(const audience of ['student','teacher']){const d=compilePaperOffice(p,audience);assertPaperOffice(p,d);const body=JSON.stringify(d.sections);assert(body.includes('甲. 当前选项第一项'));assert(body.includes('戊. 当前选项第五项'));}
    const sheet=compilePaperOffice(p,'student','answer_sheet');assertPaperOffice(p,sheet);const text=sheet.sections.flatMap(s=>s.paragraphs).join('\n');
    for(const label of ['甲','乙','戊'])assert(text.includes(label+' □'));assert(!text.includes('A □'));assert(!text.includes('B □'));
    return {paperId:p.id,labels:['甲','乙','戊']};
  }finally{f.close();}
});
await check('Detached pre-guard snapshot shape and raw compiler cannot produce an empty answer sheet or bypass paper-role checks',async()=>{
  const f=await owned('old-snapshot');try {
    const reviewed=await f.review(f.b),p=await f.confirm(await f.snapshot(reviewed)),item=p.selection.items[0];
    // A detached pre-guard shape only; no synthetic approval/DB fact is written.
    const old=newPaperInstance({...reviewed.entries[0]},item.instance.instanceRevision+1,textContent());
    old.review={...item.instance.review,instanceRevision:old.instanceRevision,contentDigest:old.contentDigest,sourceBinding:old.sourceBinding};
    const legacy=structuredClone(p);legacy.selection.items[0].instance=old;
    for(const [audience,template] of [['student','paper'],['teacher','paper'],['student','answer_sheet']])assert.throws(()=>compilePaperOffice(legacy,audience,template),/conflict/);
    const beforeSheet=compilePaperOffice(p,'student','answer_sheet');assert.throws(()=>assertPaperOffice(legacy,beforeSheet),/conflict/);
    assert.equal(instanceDeliveryBlock(item.question,old),'options_required');
  }finally{f.close();}
});
await check('One option, duplicate labels across blocks, and text pretending to be options remain drafts for choice/single/multiple types',async()=>{
  for(const type of ['选择题','单选题','多选题']) {
    const f=await owned(type,type);try {
      for(const blocks of [[{type:'options',items:[{label:'甲',text:'仅一项'}]}],[{type:'options',items:[{label:'甲',text:'第一组'}]},{type:'options',items:[{label:'甲',text:'第二组同名'}]}],[{type:'text',text:'A. 看似有选项\nB. 实际只是文本'}]]) {
        const b=await f.edit(f.b,{...source(),question:{mode:'edited',blocks}});assert.equal(b.entries[0].deliveryBlock,'options_required');await assert.rejects(f.review(b),/conflict/);f.b=b;
      }
    }finally{f.close();}
  }
});
await check('V1/source choice fallback and edited non-choice remain unchanged',async()=>{
  const f=await owned('source');try {
    let b=await f.review(f.b);const p=await f.confirm(await f.snapshot(b));const sourceSheet=compilePaperOffice(p,'student','answer_sheet');assert(JSON.stringify(sourceSheet).includes('A □'));
    const old=structuredClone(p);delete old.selection.items[0].instance;assert(JSON.stringify(compilePaperOffice(old,'student','answer_sheet')).includes('A □'));
  }finally{f.close();}
  const g=await owned('non-choice','解答题');try {let b=await g.edit(g.b,textContent());assert.equal(b.entries[0].deliveryBlock,'needs_review');b=await g.review(b);const p=await g.confirm(await g.snapshot(b));assertPaperOffice(p,compilePaperOffice(p,'student','answer_sheet'));}finally{g.close();}
});
report.success=report.checks.every(c=>c.pass);if(!report.success)process.exitCode=1;
fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,passed:report.checks.filter(c=>c.pass).length,failed:report.checks.filter(c=>!c.pass).length,output,productAcceptance:false}));
