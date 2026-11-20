import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync,backup} from 'node:sqlite';
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
const {sourceLayoutSignature,sourceLayoutQuestion,SOURCE_LAYOUT_TEXT}=await import('../../src/shared/material-ai-source-layout.ts');
const {printedChoiceAnswerComparison}=await import('../../src/shared/material-ai-choice-answer.ts');
const {validAiPagePrompt}=await import('../../src/shared/material-ai-page.ts');
const {MaterialChoiceRechecks,NEXT_PARENT_RECHECK_TABLE}=await import('../../src/main/assets/material-ai-choice-rechecks.ts');
const {readAiPageReceipt}=await import('../../src/main/assets/material-ai-page-evidence.ts');
const {readPageCrops}=await import('../../src/main/assets/material-ai-page-crops.ts');
const {validateAiPageSource}=await import('../../src/main/assets/material-ai-page-source.ts');
const checks=[];
async function check(name,action){await action();checks.push(name);console.log('PASS '+name);}
await check('Chinese line wrapping and adjacent variable typesetting have a stable signature',()=>{
 for(const [a,b] of [['重力加速度大\n小','重力加速度大小'],['振\n子','振子'],['力 F₁、F₂ 大小','力F₁、F₂大小'],['倾角为 α 的斜面','倾角为α的斜面']])assert.equal(sourceLayoutSignature(a),sourceLayoutSignature(b));
});
await check('Latin, numerical, Greek and unit token gaps survive the new signature',()=>{
 for(const [a,b]of [['1 0','10'],['m s','ms'],['F 1','F1'],['α β','αβ'],['1 e3','1e3'],['x ²','x²'],['-2','2'],['x²','x2'],['不正确','正确']])assert.notEqual(sourceLayoutSignature(a),sourceLayoutSignature(b),a);
});
await check('Comparison copies preserve original text and literal figure and table spacing',()=>{
 const q={stem:'振\n子',projection:Object.fromEntries(['statement','formulas','choices','subquestions','tables','figures'].map(role=>[role,{state:'provided',text:role==='statement'?'振\n子':'甲 乙'}]))};
 const before=JSON.stringify(q),legacy=sourceLayoutQuestion(q,{policy:'page-fragments.v3'}),copy=sourceLayoutQuestion(q,{policy:'page-fragments.v3',sourceLayoutPolicy:SOURCE_LAYOUT_TEXT});assert.equal(legacy,q);assert.equal(copy.stem,'振子');assert.equal(copy.projection.figures.text,'甲 乙');assert.equal(copy.projection.tables.text,'甲 乙');assert.equal(JSON.stringify(q),before);
});
const root=process.argv[2];assert(root,'Pass the authorized test root');
// This historical fixture measures the dedicated crop/layout strategy. The
// independently tested next-page strategy can also recover a question here.
process.env.OMNI_EDU_AI_NEXT_PARENT_BOUNDARY='0';
const temporary=await fs.mkdtemp(path.join(os.tmpdir(),'kb-source-layout-'));
const original=new DatabaseSync(process.argv[3]||path.join(root,'data/app.db'),{readOnly:true});await backup(original,path.join(temporary,'copy.db'));original.close();
const db=new DatabaseSync(path.join(temporary,'copy.db'));
db.exec(NEXT_PARENT_RECHECK_TABLE);
const host={root:()=>path.join(root,'data'),all:async(sql,values=[])=>db.prepare(sql).all(...values),run:async(sql,values=[])=>{db.prepare(sql).run(...values);}};
host.proof=async(batch,ordinal)=>{const proof=await readAiPageReceipt(host,batch,ordinal);await validateAiPageSource(host,proof.unit.pageSource);return proof;};
const batch='aibatch_9d9e3e37-8cb6-4ab3-a87f-d72e02d813d3',repo=new MaterialChoiceRechecks(host);
async function transaction(action){db.exec('BEGIN IMMEDIATE');try{await action();}finally{db.exec('ROLLBACK');}}
try{
 await check('Frozen source layout policy validates prerequisites and rejects unknown versions',async()=>{
  const p=(await host.proof(batch,1)).unit.pagePrompt,updated={...p,choiceAnswerPolicy:'printed-choice-answer.v1',sourceLayoutPolicy:SOURCE_LAYOUT_TEXT};assert(validAiPagePrompt(updated));
  for(const extra of [{sourceLayoutPolicy:'future'},{sourceReadingPolicy:undefined},{sourceContentPolicy:undefined},{choiceAnswerPolicy:undefined}])assert(!validAiPagePrompt({...updated,...extra}));assert(!p.sourceLayoutPolicy);
 });
 await check('Question variables B/C preceding actual A-D options cannot masquerade as option markers',async()=>{
  const p=await host.proof(batch,1),prompt={...p.unit.pagePrompt,choiceAnswerPolicy:'printed-choice-answer.v1',sourceLayoutPolicy:SOURCE_LAYOUT_TEXT};
  for(const n of ['3','5','7'])assert.equal(printedChoiceAnswerComparison(p.first.questions.find(q=>q.number===n),p.final.questions.find(q=>q.number===n),prompt),'same',n);
 });
 await check('Saved natural receipts restore three illustrated source documents and retain genuine uncertainty',()=>transaction(async()=>{
  const before=db.prepare('SELECT * FROM question_bank_items ORDER BY id').all(),paid=db.prepare('SELECT * FROM material_ai_units ORDER BY batch_id,ordinal').all();
  const audits=db.prepare('SELECT * FROM material_ai_choice_rechecks ORDER BY question_id').all();assert.equal(audits.length,3);assert.equal(await repo.apply(batch,'layout'),3);assert.equal(await repo.apply(batch,'layout'),0);
  const after=db.prepare('SELECT * FROM question_bank_items ORDER BY id').all();let changed=0;
  for(let i=0;i<before.length;i++){const {archive_json:a,document_json:d,...x}=before[i],{archive_json:b,document_json:e,...y}=after[i];assert.deepEqual(x,y);if(a!==b){changed++;assert.equal(d,'');const doc=JSON.parse(e);assert.equal(doc.blocks.filter(block=>block.kind==='image').length,2);const archive=JSON.parse(b);if(archive.number==='7')assert.deepEqual(archive.issues,['incomplete_question']);else assert.equal(archive.state,'ai_final');}}
  assert.equal(changed,3);assert.deepEqual(db.prepare('SELECT * FROM material_ai_units ORDER BY batch_id,ordinal').all(),paid);assert.deepEqual(db.prepare('SELECT * FROM material_ai_choice_rechecks WHERE policy<>? ORDER BY question_id').all(SOURCE_LAYOUT_TEXT),audits);
 }));
 await check('Cold reader rederives new source plans and preserves all earlier choice audits',()=>transaction(async()=>{
  await repo.apply(batch,'layout');const proof=await host.proof(batch,1),raw=db.prepare('SELECT first_json FROM material_ai_units WHERE batch_id=? AND ordinal=1').get(batch),crops=await readPageCrops(host,batch,1,proof.unit.pageSource,proof.first,raw.first_json,proof.imageSha,new AbortController().signal,undefined,proof.unit.pagePrompt);
  for(const row of db.prepare('SELECT * FROM material_ai_choice_rechecks').all()){const q={id:row.question_id,archive:JSON.parse(row.after_archive_json)};const p=await new MaterialChoiceRechecks(host).promptFor(q,proof,crops,'unknown');assert.equal(p.sourceLayoutPolicy,row.policy===SOURCE_LAYOUT_TEXT?SOURCE_LAYOUT_TEXT:undefined);}
  const held=db.prepare("SELECT * FROM material_ai_choice_rechecks WHERE number='7' AND policy=?").get(SOURCE_LAYOUT_TEXT);const heldQuestion={id:held.question_id,archive:JSON.parse(held.after_archive_json)};
  assert.equal((await repo.promptFor(heldQuestion,proof,crops,'separate')).sourceLayoutPolicy,SOURCE_LAYOUT_TEXT);assert.equal(heldQuestion.archive.state,'ai_needs_review');
  const audit=db.prepare('SELECT * FROM material_ai_choice_rechecks WHERE policy=? LIMIT 1').get(SOURCE_LAYOUT_TEXT),q={id:audit.question_id,archive:JSON.parse(audit.after_archive_json)};db.prepare("UPDATE material_ai_choice_rechecks SET proof_sha='changed' WHERE question_id=?").run(q.id);await assert.rejects(()=>repo.promptFor(q,proof,crops,'unknown'),/source_changed/);
 }));
 await check('Teacher edits and bookmarks protect illustrated source drafts',()=>transaction(async()=>{
  const rows=db.prepare("SELECT q.id,m.number FROM question_bank_items q JOIN material_ai_members m ON m.question_id=q.id WHERE m.batch_id=? AND m.number IN ('3','5')").all(batch);
  db.prepare("UPDATE question_bank_items SET updated_at='teacher-edit' WHERE id=?").run(rows[0].id);db.prepare("INSERT INTO question_notebook_bookmarks(question_id,bookmarked,created_at,updated_at) VALUES(?,1,'test','test')").run(rows[1].id);assert.equal(await repo.apply(batch,'layout'),1);
 }));
 await check('Partial source document write failure rolls back both documents and audits',async()=>{
  const before=db.prepare('SELECT id,archive_json,document_json FROM question_bank_items ORDER BY id').all();let writes=0;
  const failing=new MaterialChoiceRechecks({...host,run:async(sql,values)=>{if(sql.startsWith('UPDATE question_bank_items')&&++writes===2)throw Error('disk_full');await host.run(sql,values);}});
  db.exec('BEGIN IMMEDIATE');try{await assert.rejects(()=>failing.apply(batch,'layout'),/disk_full/);}finally{db.exec('ROLLBACK');}assert.equal(writes,2);assert.deepEqual(db.prepare('SELECT id,archive_json,document_json FROM question_bank_items ORDER BY id').all(),before);assert.equal(db.prepare('SELECT COUNT(*) n FROM material_ai_choice_rechecks').get().n,3);
 });
 await check('Disabling new actions retains authenticated layout history',()=>transaction(async()=>{
  await repo.apply(batch,'layout');const old=process.env.OMNI_EDU_AI_SOURCE_LAYOUT;try{process.env.OMNI_EDU_AI_SOURCE_LAYOUT='0';await assert.rejects(()=>repo.apply(batch,'layout'),/unsupported/);assert.equal((await repo.view(batch)).layoutApplied,3);}finally{if(old===undefined)delete process.env.OMNI_EDU_AI_SOURCE_LAYOUT;else process.env.OMNI_EDU_AI_SOURCE_LAYOUT=old;}
 }));
}finally{db.close();await fs.rm(temporary,{recursive:true,force:true});}
console.log(JSON.stringify({success:true,count:checks.length,checks,scope:'Literal whitespace guards and saved real receipts in a rollback-only database copy; no provider requests'}));
