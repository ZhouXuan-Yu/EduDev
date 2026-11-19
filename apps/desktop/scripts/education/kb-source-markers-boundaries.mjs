import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {DatabaseSync,backup} from 'node:sqlite';
import os from 'node:os';
import {sourceMarkerText,SOURCE_LAYOUT_MARKERS} from '../../src/shared/material-ai-source-markers.ts';
import {sourceLayoutSignatureFor} from '../../src/shared/material-ai-source-layout.ts';
import {validAiPagePrompt} from '../../src/shared/material-ai-page.ts';
import {MaterialChoiceRechecks} from '../../src/main/assets/material-ai-choice-rechecks.ts';
import {validateAiPageSource} from '../../src/main/assets/material-ai-page-source.ts';
import {independentLiteralContext} from '../../src/shared/material-ai-literal.ts';
import {validQuestionDocument} from '../../src/shared/question-document.ts';
import {readAiPageReceipt} from '../../src/main/assets/material-ai-page-evidence.ts';
import {readPageCrops,pageCropAgrees} from '../../src/main/assets/material-ai-page-crops.ts';
import {restoredResponseQuestions} from '../../src/main/assets/material-ai-page-content.ts';
const root=process.argv[2];assert(root);
const report=JSON.parse(fs.readFileSync(path.join(root,'ai-structure-live-final.json')));
const checks=[];async function check(name,fn){await fn();checks.push(name);console.log('PASS '+name);}
const db=new DatabaseSync(path.join(root,'data/app.db'),{readOnly:true});
const host={root:()=>path.join(root,'data'),all:async(sql,values=[])=>db.prepare(sql).all(...values)};
try {
 const proof=await readAiPageReceipt(host,report.batchId,1),raw=db.prepare('SELECT first_json FROM material_ai_units WHERE batch_id=? AND ordinal=1').get(report.batchId);
 const crops=await readPageCrops(host,report.batchId,1,proof.unit.pageSource,proof.first,raw.first_json,proof.imageSha,new AbortController().signal,undefined,proof.unit.pagePrompt);
 const prompt={...proof.unit.pagePrompt,sourceMarkerPolicy:'source-layout-markers.v1'};
 const candidates=restoredResponseQuestions(proof.final,proof.unit.pageSource,prompt,crops);
 for(const q of proof.final.questions)assert(pageCropAgrees(proof.review,proof.final,q.number,crops,candidates.find(c=>c.number===q.number).fields.stem,prompt),'Saved complete source question '+q.number+' must survive printed marker width differences');
 checks.push('Saved real complete source questions survive marker width differences');console.log('PASS '+checks.at(-1));
 await check('The frozen new policy validates its source prerequisites and preserves the old mismatch',()=>{
  assert(validAiPagePrompt(prompt));
  for(const override of [{sourceMarkerPolicy:'unknown'},{sourceLayoutPolicy:undefined},{structureContext:undefined},{sourceContentPolicy:undefined}])assert(!validAiPagePrompt({...prompt,...override}));
  const oldCandidates=restoredResponseQuestions(proof.final,proof.unit.pageSource,proof.unit.pagePrompt,crops);
  for(const q of proof.final.questions)assert(!pageCropAgrees(proof.review,proof.final,q.number,crops,oldCandidates.find(c=>c.number===q.number).fields.stem,proof.unit.pagePrompt));
 });
 await check('New quality preparation freezes marker policy while standard and disabled preparation retain old behavior',async()=>{
  const {MaterialAiRepository}=await import('../../src/main/assets/material-ai-repository.ts');
  const repository=new MaterialAiRepository({...host,writer:async()=>{},materials:()=>({})});repository.books.role=async()=>undefined;
  const {sourceLayoutPolicy:_,sourceMarkerPolicy:__,choiceAnswerPolicy:___,literalChoiceAnswerPolicy:____,...base}=proof.unit.pagePrompt;
  const unit={...proof.unit,pagePrompt:base};repository.rawInputs=async()=>[structuredClone(unit)];const before=JSON.stringify(unit),old=process.env.OMNI_EDU_AI_SOURCE_LAYOUT;
  try{delete process.env.OMNI_EDU_AI_SOURCE_LAYOUT;
   const quality=(await repository.inputs({...proof.config,processingMode:'quality'}))[0];assert.equal(quality.pagePrompt.sourceMarkerPolicy,SOURCE_LAYOUT_MARKERS);assert(validAiPagePrompt(quality.pagePrompt));
   assert.equal((await repository.inputs({...proof.config,processingMode:'standard'}))[0].pagePrompt.sourceMarkerPolicy,undefined);
   process.env.OMNI_EDU_AI_SOURCE_LAYOUT='0';assert.equal((await repository.inputs({...proof.config,processingMode:'quality'}))[0].pagePrompt.sourceMarkerPolicy,undefined);assert.equal(JSON.stringify(unit),before);
  }finally{if(old===undefined)delete process.env.OMNI_EDU_AI_SOURCE_LAYOUT;else process.env.OMNI_EDU_AI_SOURCE_LAYOUT=old;}
 });
 await check('Only source-owned labels change in a comparison copy; the original bytes survive',()=>{
  const q=proof.final.questions[0],before=JSON.stringify(proof),copy=sourceMarkerText(q.stem,prompt,'1');
  assert(copy.includes('A.'));assert(!copy.includes('A．'));assert.equal(JSON.stringify(proof),before);
  assert.equal(sourceMarkerText('1．',prompt,'1',true),'1.');assert.equal(sourceMarkerText('1．2',prompt,'1',true),'1．2');
 });
 await check('Decimals, exponents, units, minus signs, negation and unowned mathematical periods remain distinct',()=>{
  const q=proof.final.questions[0],sig=s=>sourceLayoutSignatureFor(s,prompt,'1');
  for(const [a,b] of [['1.2','1．2'],['A.2','A．2'],['x²','x2'],['-2','2'],['m s','ms'],['1 0','10'],['α β','αβ'],['不正确','正确'],['A. B','A． B'],['F 1','F1']])assert.notEqual(sig(q.stem+'\n'+a),sig(q.stem+'\n'+b),a);
 });
 await check('Reordered, repeated or incomplete option groups and unrelated text never gain equivalence',()=>{
  const q=proof.final.questions[0].stem;
  for(const broken of [q.replace('A．两米','A．三米'),q.replace('A．','X．'),q.replace('A．两米','B．两米').replace('B．四米','A．四米'),q+'\nA．两米',q.replace('D．十米','')])assert.equal(sourceMarkerText(broken,prompt,'1'),broken);
 });
 await check('Number layout equivalence works for unrelated mixed-language exams and horizontal option groups',()=>{
  const model=structuredClone(prompt);
  const base=model.structureContext.paragraphs.find(p=>p.role==='question');
  const makeParagraph=(index,role,kind,label,text)=>({...base,id:'p1-paragraph-'+index,role,marker:{kind,label},rawText:text,text});
  for(const {number,stem,options} of [
   {number:'12',stem:'比较速度 v₁ 与 v₂，已知 v₁ = −2.5 m/s。',options:['v₁ > v₂','v₁ ≤ v₂']},
   {number:'105',stem:'Select the valid statement about orbit α.',options:['a = 0','a ≠ 0','1.5 m','1.5 m/s','α₁','α₂']}
  ]){
   const labels=options.map((_,i)=>String.fromCharCode(65+i));
   model.structureContext.paragraphs=[
    makeParagraph(1,'question','parent',number,number+'. '+stem),
    ...options.map((body,i)=>makeParagraph(i+2,'option','option',labels[i],labels[i]+'. '+body))
   ];
   const page=mark=>number+mark+' '+stem+'\n'+options.map((body,i)=>labels[i]+mark+' '+body).join('   ');
   const signature=text=>sourceLayoutSignatureFor(text,model,number);
   assert.equal(signature(page('.')),signature(page('．')));
   for(const change of [s=>s.replace(options[0],options[1]),s=>s.replace('1.5','1．5').replace('2.5','2．5'),s=>s.replace(options[0],options[0]+'条件变化')])assert.notEqual(signature(page('.')),signature(change(page('．'))));
  }
 });
 await check('Number-only section labels and prose references cannot grant arithmetic punctuation equivalence',()=>{
  const model=structuredClone(prompt);
  model.structureContext.paragraphs=model.structureContext.paragraphs.map(p=>p.role==='question'?{...p,role:'heading'}:p);
  const text='1．2 m 表示测量结果，参看选项 A．两米';
  assert.equal(sourceMarkerText(text,model,'1'),text);
 });
 await check('Independent visual reading cannot receive the new marker policy or its structure hints',()=>{
  const payload={pageContext:prompt,firstDraft:{questions:proof.first.questions,fragments:proof.first.fragments},cropReview:{questions:[]}};
  const blind=independentLiteralContext(payload,true);assert(!Object.hasOwn(blind.pageContext,'structureContext'));assert(!Object.hasOwn(blind.pageContext,'sourceMarkerPolicy'));
 });
 await check('Absent, unresolved, ambiguous and low-confidence structure cannot authorize marker folding',()=>{
  const q=proof.final.questions[0].stem;
  for(const alter of [c=>{c.unresolved=['unknown'];},c=>{c.paragraphs.push(structuredClone(c.paragraphs[1]));},c=>{c.paragraphs[1].confidence=0.5;},c=>{c.paragraphs[2].rawText='A. 无关内容';},c=>{c.paragraphs[2].issues=['uncertain_ocr'];}]){
   const changed=structuredClone(prompt);alter(changed.structureContext);assert.equal(sourceMarkerText(q,changed,'1'),q);
  }
  assert.equal(sourceMarkerText(q,{...prompt,structureContext:undefined},'1'),q);
 });

} finally {db.close();}

const temporary=fs.mkdtempSync(path.join(os.tmpdir(),'kb-source-markers-'));
const original=new DatabaseSync(path.join(root,'data/app.db'),{readOnly:true});await backup(original,path.join(temporary,'copy.db'));original.close();
const copy=new DatabaseSync(path.join(temporary,'copy.db'));
const local={root:()=>path.join(root,'data'),all:async(sql,values=[])=>copy.prepare(sql).all(...values),run:async(sql,values=[])=>{copy.prepare(sql).run(...values);}};
local.proof=async(batch,ordinal)=>{const p=await readAiPageReceipt(local,batch,ordinal);await validateAiPageSource(local,p.unit.pageSource);return p;};
const repo=new MaterialChoiceRechecks(local),batch=report.batchId;
// Reconstruct the pre-action fixture only in this disposable database copy.
// Original paid bytes and the real application's audits are never modified.
const existing=copy.prepare('SELECT * FROM material_ai_choice_rechecks WHERE batch_id=? AND policy=?').all(batch,SOURCE_LAYOUT_MARKERS);
if(existing.length){
 const p=await local.proof(batch,1),raw=copy.prepare('SELECT first_json FROM material_ai_units WHERE batch_id=? AND ordinal=1').get(batch),crops=await readPageCrops(local,batch,1,p.unit.pageSource,p.first,raw.first_json,p.imageSha,new AbortController().signal,undefined,p.unit.pagePrompt);
 for(const row of existing){await repo.promptFor({id:row.question_id,archive:JSON.parse(row.after_archive_json)},p,crops,'separate');const before=JSON.parse(row.before_json);copy.prepare('UPDATE question_bank_items SET archive_json=?,document_json=? WHERE id=?').run(before.archive_json,before.document_json,row.question_id);copy.prepare('DELETE FROM material_ai_choice_rechecks WHERE question_id=?').run(row.question_id);}
}

async function rollback(fn){copy.exec('BEGIN IMMEDIATE');try{await fn();}finally{copy.exec('ROLLBACK');}}
try {
 await check('The original local action restores four complete source documents with no paid-field or teacher-field changes',()=>rollback(async()=>{
  const rows=copy.prepare('SELECT * FROM question_bank_items ORDER BY id').all(),units=copy.prepare('SELECT * FROM material_ai_units ORDER BY batch_id,ordinal').all();
  assert.equal((await repo.view(batch)).layoutCandidates,4);assert.equal(await repo.apply(batch,'layout'),4);assert.equal(await repo.apply(batch,'layout'),0);assert.equal((await repo.view(batch)).layoutApplied,4);
  const after=copy.prepare('SELECT * FROM question_bank_items ORDER BY id').all();let changed=0;
  for(let i=0;i<rows.length;i++){
   const {archive_json:a,document_json:d,...left}=rows[i],{archive_json:b,document_json:e,...right}=after[i];assert.deepEqual(left,right);
   if(a===b){assert.equal(d,e);continue;}changed++;const ar=JSON.parse(b),doc=JSON.parse(e);assert.equal(d,'');assert(validQuestionDocument(doc));assert.equal(ar.state,'ai_needs_review');assert.equal(ar.sourceChecked,false);assert.deepEqual(ar.issues,['missing_grade']);assert.equal(doc.blocks.filter(b=>b.kind==='image').length,1);assert.equal(doc.context.sourceContent.crops[0].readings.length,2);assert(doc.context.sourceContent.crops[0].readings[1].text.includes('．'));
  }
  assert.equal(changed,4);assert.deepEqual(copy.prepare('SELECT * FROM material_ai_units ORDER BY batch_id,ordinal').all(),units);
 }));
 await check('Cold source authentication rederives versioned audits and rejects audit tampering',()=>rollback(async()=>{
  await repo.apply(batch,'layout');const p=await local.proof(batch,1),raw=copy.prepare('SELECT first_json FROM material_ai_units WHERE batch_id=? AND ordinal=1').get(batch),crops=await readPageCrops(local,batch,1,p.unit.pageSource,p.first,raw.first_json,p.imageSha,new AbortController().signal,undefined,p.unit.pagePrompt);
  const rows=copy.prepare('SELECT * FROM material_ai_choice_rechecks WHERE batch_id=?').all(batch);assert.equal(rows.length,4);
  for(const row of rows){assert.equal(row.policy,SOURCE_LAYOUT_MARKERS);const q={id:row.question_id,archive:JSON.parse(row.after_archive_json)};assert.equal((await repo.promptFor(q,p,crops,'separate')).sourceMarkerPolicy,SOURCE_LAYOUT_MARKERS);}
  const row=rows[0],q={id:row.question_id,archive:JSON.parse(row.after_archive_json)};copy.prepare("UPDATE material_ai_choice_rechecks SET proof_sha='changed' WHERE question_id=?").run(q.id);await assert.rejects(()=>repo.promptFor(q,p,crops,'separate'),/source_changed/);
 }));
 await check('Teacher edits and bookmarks protect held questions from local reinterpretation',()=>rollback(async()=>{
  const rows=copy.prepare('SELECT q.id FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id WHERE m.batch_id=? ORDER BY m.number').all(batch);
  copy.prepare("UPDATE question_bank_items SET updated_at='teacher-edit' WHERE id=?").run(rows[0].id);copy.prepare("INSERT INTO question_notebook_bookmarks(question_id,bookmarked,created_at,updated_at) VALUES(?,1,'test','test')").run(rows[1].id);assert.equal(await repo.apply(batch,'layout'),2);
 }));
 await check('Partial write failure rolls back both source documents and policy audits',async()=>{
  const before=copy.prepare('SELECT * FROM question_bank_items ORDER BY id').all();let writes=0;
  const failing=new MaterialChoiceRechecks({...local,run:async(sql,values)=>{if(sql.startsWith('UPDATE question_bank_items')&&++writes===2)throw Error('disk_full');await local.run(sql,values);}});
  await rollback(async()=>{await assert.rejects(()=>failing.apply(batch,'layout'),/disk_full/);});assert.equal(writes,2);assert.deepEqual(copy.prepare('SELECT * FROM question_bank_items ORDER BY id').all(),before);assert.equal(copy.prepare('SELECT COUNT(*) n FROM material_ai_choice_rechecks WHERE batch_id=?').get(batch).n,0);
 });
 await check('A malformed frozen input remains held without breaking the local review list or action',()=>rollback(async()=>{
  copy.prepare("UPDATE material_ai_units SET input_json='{' WHERE batch_id=? AND ordinal=1").run(batch);
  assert.equal((await repo.view(batch)).layoutCandidates,0);
  assert.equal(await repo.apply(batch,'layout'),0);
 }));
 await check('Mixed legacy and marker candidates share a single twenty-row work limit',()=>rollback(async()=>{
  const unit=copy.prepare('SELECT input_json FROM material_ai_units WHERE batch_id=? AND ordinal=1').get(batch);
  const legacy=JSON.parse(unit.input_json);
  delete legacy.pagePrompt.sourceLayoutPolicy;
  copy.prepare("INSERT INTO material_ai_units(batch_id,ordinal,status,input_json) VALUES(?,2,'review',?)").run(batch,JSON.stringify(legacy));
  const sample=copy.prepare('SELECT q.* FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id WHERE m.batch_id=? LIMIT 1').get(batch);
  const columns=Object.keys(sample);
  const insert=copy.prepare('INSERT INTO question_bank_items('+columns.join(',')+') VALUES('+columns.map(()=>'?').join(',')+')');
  for(let i=0;i<20;i++){
   const id='marker-boundary-'+i;
   insert.run(...columns.map(key=>key==='id'?id:sample[key]));
   copy.prepare('INSERT INTO material_ai_members VALUES(?,2,?,?)').run(batch,String(i+5),id);
  }
  assert.equal((await repo.view(batch)).layoutCandidates,24);
  const reads=[];
  const bounded=new MaterialChoiceRechecks({...local,all:async(sql,values)=>{
   const rows=await local.all(sql,values);
   if(sql.startsWith('SELECT q.*,m.ordinal'))reads.push(rows.length);
   return rows;
  },proof:async(id,ordinal)=>local.proof(id,ordinal===2?1:ordinal)});
  assert.equal(await bounded.apply(batch,'layout'),4);
  assert.deepEqual(reads,[20]);
 }));
 await check('A disabled new action retains authenticated saved marker audit history',()=>rollback(async()=>{
  await repo.apply(batch,'layout');const old=process.env.OMNI_EDU_AI_SOURCE_LAYOUT;try{process.env.OMNI_EDU_AI_SOURCE_LAYOUT='0';assert.equal((await repo.view(batch)).layoutCandidates,0);assert.equal((await repo.view(batch)).layoutApplied,4);await assert.rejects(()=>repo.apply(batch,'layout'),/unsupported/);}finally{if(old===undefined)delete process.env.OMNI_EDU_AI_SOURCE_LAYOUT;else process.env.OMNI_EDU_AI_SOURCE_LAYOUT=old;}
 }));
} finally {copy.close();const resolved=fs.realpathSync(temporary);assert.equal(path.dirname(resolved),fs.realpathSync(os.tmpdir()));assert(path.basename(resolved).startsWith('kb-source-markers-'));fs.rmSync(resolved,{recursive:true,force:true});}
console.log(JSON.stringify({success:true,count:checks.length,checks,modelCalls:0}));
