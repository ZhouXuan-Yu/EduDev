import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import {DatabaseSync,backup} from 'node:sqlite';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
const {PRINTED_CHOICE_ANSWER,printedChoiceAnswerComparison}=await import('../../src/shared/material-ai-choice-answer.ts');
const {blindAnswerIssues}=await import('../../src/shared/material-ai-answer-review.ts');
const {validAiAction,MATERIAL_AI_SCHEMA}=await import('../../src/shared/material-ai.ts');
const {validAiPagePrompt}=await import('../../src/shared/material-ai-page.ts');
const {MaterialChoiceRechecks,CHOICE_RECHECK_TABLE}=await import('../../src/main/assets/material-ai-choice-rechecks.ts');
const {readAiPageReceipt}=await import('../../src/main/assets/material-ai-page-evidence.ts');
const {validateAiPageSource}=await import('../../src/main/assets/material-ai-page-source.ts');
const {readPageCrops}=await import('../../src/main/assets/material-ai-page-crops.ts');

const checks=[];
async function check(name,action){await action();checks.push(name);console.log('PASS '+name);}
const prompt={policy:'page-fragments.v3',choiceAnswerPolicy:PRINTED_CHOICE_ANSWER};
const stem='阴极射线是（ ）\n（A）光子流 （B）电子流 （C）质子流 （D）中子流';
const question=(answer,extra={})=>({number:'1',stem,answer,answerOrigin:'ai_generated',analysis:'依据阴极射线实验。',analysisOrigin:'ai_generated',questionType:'单选题',requiresImage:false,issues:[],projection:{choices:{state:'provided',text:stem}},...extra});
const compare=(a,b,p=prompt)=>printedChoiceAnswerComparison(a,b,p);
await check('Exact original option suffix and letter agree without modifying either draft',()=>{
 const a=question('B'),b=question('B（电子流）'),before=JSON.stringify([a,b]);assert.equal(compare(a,b),'same');assert.equal(compare(b,a),'same');assert.equal(JSON.stringify([a,b]),before);
});
await check('Legacy absence and unknown versions preserve strict answer comparison',()=>{
 for(const p of [undefined,{policy:'page-fragments.v3'},{...prompt,choiceAnswerPolicy:'future'}])assert.equal(printedChoiceAnswerComparison(question('B'),question('B（电子流）'),p),undefined);
});
await check('Incorrect suffix, different letter, unknown label, repeated and malformed answers conflict',()=>{
 for(const answer of ['B（质子流）','C','E','BB','B（电子流)','B（电子流）猜测','B或C','B（可能是电子流）','B（电子流）C'])assert.equal(compare(question('B'),question(answer)),'conflict',answer);
});
await check('Multi-select compares selected sets while single-choice rejects two selections',()=>{
 assert.equal(compare(question('BD',{questionType:'多选题'}),question('D（中子流）、B（电子流）',{questionType:'多选题'})),'same');
 assert.equal(compare(question('BD'),question('DB')),'conflict');
});
await check('Question identity, source roles and type bind equivalence',()=>{
 for(const extra of [{number:'2'},{answerOrigin:'source'},{answerOrigin:'missing'},{questionType:'判断题'}])assert.equal(compare(question('B'),question('B（电子流）',extra)),undefined);
});
await check('Changed negation, units and exponent text cannot be normalized away',()=>{
 for(const changed of [stem.replace('是','不是'),stem.replace('光子流','光子流 m/s'),stem.replace('光子流','光子流²')])assert.equal(compare(question('B'),question('B（电子流）',{stem:changed})),undefined);
});
await check('Duplicate, missing, reordered and repeated option groups remain unsupported',()=>{
 for(const body of ['A.甲 C.丙 D.丁','A.甲 B.甲 C.丙 D.丁','A.甲 B.乙 A.丙 B.丁','B.乙 A.甲','A.甲 B.乙\n（1）子题'])assert.equal(compare(question('B',{stem:body,projection:{choices:{state:'provided',text:body}}}),question('B（乙）',{stem:body,projection:{choices:{state:'provided',text:body}}})),undefined);
});
await check('Projection mismatch and missing choices cannot establish agreement',()=>{
 for(const choices of [{state:'missing',text:''},{state:'provided',text:'A.甲 B.乙'}])assert.equal(compare(question('B'),question('B（电子流）',{projection:{choices}})),undefined);
});
await check('Versioned answer action accepts only the existing typed IPC contract',()=>{
 const action={schemaVersion:MATERIAL_AI_SCHEMA,batchId:'aibatch_12345678-1234-1234-1234-123456789abc',action:'recheck_answers'};assert(validAiAction(action));assert(!validAiAction({...action,acceptDuplicateCharge:true}));
});

const root=process.argv[2];
if(root){
 const directory=await fs.mkdtemp(path.join(os.tmpdir(),'kb-choice-answer-'));
 const original=new DatabaseSync(process.argv[3]||path.join(root,'data/app.db'),{readOnly:true});
 await backup(original,path.join(directory,'copy.db'));original.close();
 const db=new DatabaseSync(path.join(directory,'copy.db'));
 const host={all:async(sql,values=[])=>db.prepare(sql).all(...values),run:async(sql,values=[])=>{db.prepare(sql).run(...values);},root:()=>path.join(root,'data')};
 host.proof=async(batch,ordinal)=>{const proof=await readAiPageReceipt(host,batch,ordinal);await validateAiPageSource(host,proof.unit.pageSource);return proof;};
 const repo=new MaterialChoiceRechecks(host);
 const batch=db.prepare("SELECT m.batch_id FROM material_ai_members m JOIN question_bank_items q ON q.id=m.question_id WHERE q.id=?").get('question_691d88d6-d7a8-4330-a96f-b8ba88e5467f')?.batch_id;
 assert(batch,'Use the saved natural Word-page batch');db.exec(CHOICE_RECHECK_TABLE);
 // Each check rolls back its independent copy, including any successful classifications.
 async function isolated(action){db.exec('BEGIN IMMEDIATE');try{await action();}finally{db.exec('ROLLBACK');}}
 try{
  await check('Real frozen prompt accepts the new policy and rejects missing prerequisites',async()=>{
   const proof=await host.proof(batch,1),p={...proof.unit.pagePrompt,choiceAnswerPolicy:PRINTED_CHOICE_ANSWER};assert(validAiPagePrompt(p));assert(!validAiPagePrompt({...p,choiceAnswerPolicy:'future'}));assert(!validAiPagePrompt({...p,choiceReviewPolicy:undefined}));assert(!validAiPagePrompt({...p,answerReviewPolicy:undefined}));
   const a=proof.first.questions[0],b=proof.final.questions[0];assert.deepEqual(blindAnswerIssues(a,b,p),[]);assert.deepEqual(blindAnswerIssues(a,b,proof.unit.pagePrompt),['answer_conflict']);assert(a.answer!==b.answer);
  });
  await check('New quality preparation enables the independent policy while legacy and disabled preparation preserve old inputs',async()=>{
   const {MaterialAiRepository}=await import('../../src/main/assets/material-ai-repository.ts');
   const proof=await host.proof(batch,1),repository=new MaterialAiRepository({...host,writer:async()=>{},materials:()=>({})});
   repository.books.role=async()=>undefined;repository.rawInputs=async()=>[structuredClone(proof.unit)];
   const saved=JSON.stringify(proof.unit),old=process.env.OMNI_EDU_AI_PRINTED_CHOICE_ANSWERS;
   try{delete process.env.OMNI_EDU_AI_PRINTED_CHOICE_ANSWERS;assert.equal((await repository.inputs({...proof.config,processingMode:'quality'}))[0].pagePrompt.choiceAnswerPolicy,PRINTED_CHOICE_ANSWER);
    assert.equal((await repository.inputs({...proof.config,processingMode:'standard'}))[0].pagePrompt.choiceAnswerPolicy,undefined);
    process.env.OMNI_EDU_AI_PRINTED_CHOICE_ANSWERS='0';assert.equal((await repository.inputs({...proof.config,processingMode:'quality'}))[0].pagePrompt.choiceAnswerPolicy,undefined);assert.equal(JSON.stringify(proof.unit),saved);
   }finally{if(old===undefined)delete process.env.OMNI_EDU_AI_PRINTED_CHOICE_ANSWERS;else process.env.OMNI_EDU_AI_PRINTED_CHOICE_ANSWERS=old;}
  });
  await check('Production provider request includes the versioned choice formatting',async()=>{
   const {completeMaterialAi}=await import('../../src/main/assets/material-ai-provider.ts');const proof=await host.proof(batch,1),ordinary=globalThis.fetch;let request;
   globalThis.fetch=async(_url,options)=>{request=JSON.parse(options.body);return new Response(JSON.stringify({choices:[{finish_reason:'stop',message:{content:'{}'}}]}));};
   try{await assert.rejects(()=>completeMaterialAi({model:'deepseek-flash',apiKey:'controlled-test-key',text:proof.unit.text,page:true,imageCoverage:true,pagePrompt:{...proof.unit.pagePrompt,choiceAnswerPolicy:PRINTED_CHOICE_ANSWER},image:{mime:'image/png',data:Buffer.from('controlled-test-image').toString('base64')}},new AbortController().signal));assert(request.messages[0].content.includes('[普通选择题答案 '+PRINTED_CHOICE_ANSWER+']'));assert.equal(JSON.parse(request.messages[1].content[0].text).pageContext.choiceAnswerPolicy,PRINTED_CHOICE_ANSWER);
   }finally{globalThis.fetch=ordinary;}
  });
  await check('Saved real drafts classify only the three complete crops and repeat idempotently',()=>isolated(async()=>{
   const before=db.prepare('SELECT * FROM question_bank_items ORDER BY id').all(),paid=db.prepare('SELECT * FROM material_ai_units ORDER BY batch_id,ordinal').all();
   assert.equal(await repo.apply(batch),3);assert.equal(await repo.apply(batch),0);assert.deepEqual(await repo.view(batch),{candidates:0,applied:3,layoutCandidates:3,layoutApplied:0});
   const after=db.prepare('SELECT * FROM question_bank_items ORDER BY id').all();let changed=0;
   for(let i=0;i<before.length;i++){const {archive_json:a,...x}=before[i],{archive_json:b,...y}=after[i];assert.deepEqual(x,y);if(a!==b){changed++;assert.equal(JSON.parse(a).state,'ai_needs_review');assert.equal(JSON.parse(b).state,'ai_final');}}
   assert.equal(changed,3);assert.deepEqual(db.prepare('SELECT * FROM material_ai_units ORDER BY batch_id,ordinal').all(),paid);
  }));
  for(const protection of ['edit','bookmark','category','usage'])await check('Teacher '+protection+' protects existing records',()=>isolated(async()=>{
   const id='question_691d88d6-d7a8-4330-a96f-b8ba88e5467f';
   if(protection==='edit')db.prepare("UPDATE question_bank_items SET updated_at='teacher-edit' WHERE id=?").run(id);
   else if(protection==='bookmark')db.prepare("INSERT OR REPLACE INTO question_notebook_bookmarks(question_id,bookmarked,created_at,updated_at) VALUES(?,1,'test','test')").run(id);
   else if(protection==='category'){db.prepare("INSERT INTO question_notebook_categories(id,name,created_at,updated_at) VALUES('choice-test','Choice test','test','test')").run();const category={id:'choice-test'};db.prepare('INSERT INTO question_notebook_category_links(question_id,category_id,created_at) VALUES(?,?,?)').run(id,category.id,'test');}
   else db.prepare("INSERT INTO question_bank_usage(id,question_id,created_at) VALUES('test',?,'test')").run(id);
   assert.equal(await repo.apply(batch),2);assert(!db.prepare('SELECT 1 FROM material_ai_choice_rechecks WHERE question_id=?').get(id));
  }));
  await check('Audited source cold-read rederives the comparison and rejects changed audit facts',()=>isolated(async()=>{
   await repo.apply(batch);const row=db.prepare('SELECT * FROM material_ai_choice_rechecks LIMIT 1').get();
   const q={id:row.question_id,archive:JSON.parse(row.after_archive_json)},proof=await host.proof(batch,1),unit=db.prepare('SELECT first_json FROM material_ai_units WHERE batch_id=? AND ordinal=1').get(batch);
   const crops=await readPageCrops(host,batch,1,proof.unit.pageSource,proof.first,unit.first_json,proof.imageSha,new AbortController().signal,undefined,proof.unit.pagePrompt);
   assert.equal((await new MaterialChoiceRechecks(host).promptFor(q,proof,crops,'unknown')).choiceAnswerPolicy,PRINTED_CHOICE_ANSWER);
   for(const column of ['policy','proof_sha','before_json','after_archive_json']){const value=row[column];db.prepare('UPDATE material_ai_choice_rechecks SET '+column+'=? WHERE question_id=?').run('tampered',row.question_id);await assert.rejects(()=>repo.promptFor(q,proof,crops,'unknown'),/source_changed/);db.prepare('UPDATE material_ai_choice_rechecks SET '+column+'=? WHERE question_id=?').run(value,row.question_id);}
  }));
  await check('Writer rollback restores both question states and audits after a partial write failure',async()=>{
   const before=db.prepare('SELECT id,archive_json FROM question_bank_items ORDER BY id').all();let writes=0;
   const failing=new MaterialChoiceRechecks({...host,run:async(sql,values)=>{if(sql.startsWith('UPDATE question_bank_items')&&++writes===2)throw Error('disk_full');await host.run(sql,values);}});
   db.exec('BEGIN IMMEDIATE');try{await assert.rejects(()=>failing.apply(batch),/disk_full/);}finally{db.exec('ROLLBACK');}
   assert.equal(writes,2);assert.equal(db.prepare('SELECT COUNT(*) n FROM material_ai_choice_rechecks').get().n,0);assert.deepEqual(db.prepare('SELECT id,archive_json FROM question_bank_items ORDER BY id').all(),before);
  });
  await check('Source proof failure leaves all candidate archives untouched',()=>isolated(async()=>{
   const before=db.prepare('SELECT id,archive_json FROM question_bank_items ORDER BY id').all(),bad=new MaterialChoiceRechecks({...host,proof:async()=>{throw Error('source_changed');}});await assert.rejects(()=>bad.apply(batch),/source_changed/);assert.deepEqual(db.prepare('SELECT id,archive_json FROM question_bank_items ORDER BY id').all(),before);
  }));
 }finally{db.close();await fs.rm(directory,{recursive:true,force:true});}
}
console.log(JSON.stringify({success:true,count:checks.length,checks,scope:root?'Literal grammar and saved natural receipts in a rollback-only database copy':'Literal grammar only'}));
