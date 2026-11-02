import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
import {equation,pressure,gravity,q,r} from './question-science-fixtures.mjs';
const {QuestionReviewRepository}=await import('../../src/main/education/question-review-repository.ts');
const {createQuestionMathPlans,assessQuestionMath,validQuestionMathPlans,retainsQuestionMathPlan}=await import('../../src/main/education/question-math.ts');
const {validQuestionQuality,QUESTION_MATH_QUALITY_SCHEMA,QUESTION_SCIENCE_QUALITY_SCHEMA}=await import('../../src/shared/question-quality.ts');
const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');
const {QUESTION_CONTEXT_SCHEMA}=await import('../../src/shared/question-context.ts');
const {QUESTION_REVIEW_SCHEMA}=await import('../../src/shared/question-review.ts');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-variation-review-')),file=path.join(output,'review.db'),checks=[];let db=new DatabaseSync(file),current=true;
const report={ok:false,output,checks,boundary:'Actual source worker + original repository/SQLite. Synthetic questions only, no model requests. Does not replace formal UI or natural teaching review.'};
const check=async(name,fn)=>{await fn();checks.push({name,pass:true});console.log('PASS '+name);};
const sessionId='aisession_'+randomUUID();
db.exec(`CREATE TABLE students(id TEXT PRIMARY KEY,status TEXT);CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,student_id TEXT,archived_at TEXT);CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,student_id TEXT);CREATE TABLE questions(id TEXT PRIMARY KEY,body TEXT);CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,student_id TEXT,action_type TEXT,status TEXT,title TEXT,payload_json TEXT,result_json TEXT DEFAULT '{}',created_at TEXT,updated_at TEXT,confirmed_at TEXT,rejected_at TEXT);`);
db.prepare("INSERT INTO ai_conversation_sessions VALUES (?,'',NULL)").run(sessionId);
const sql={all:async(s,p=[])=>db.prepare(s).all(...p),run:async(s,p=[])=>{db.prepare(s).run(...p);},read:async id=>{const v=db.prepare('SELECT body FROM questions WHERE id=?').get(id);return v?JSON.parse(v.body):undefined;},create:async input=>{const v={...input,id:'question_'+randomUUID(),tags:input.tags||[],createdAt:'2026-11-03',updatedAt:'2026-11-03'};db.prepare('INSERT INTO questions VALUES (?,?)').run(v.id,JSON.stringify(v));return v;}};
// This isolated repository fixture checks its SQLite version; the formal Pi
// journey separately exercises the full production projection validator.
sql.validate=async question=>assert.deepEqual(await sql.read(question.id),question);
const repo=new QuestionReviewRepository({...sql,transaction:async fn=>{db.exec('BEGIN IMMEDIATE');try{const v=await fn(sql);db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}});
const run=()=>{const id='airun_'+randomUUID();db.prepare("INSERT INTO ai_agent_runs VALUES (?,?,'')").run(id,sessionId);return id;};
const row=id=>db.prepare('SELECT * FROM ai_confirmation_items WHERE id=?').get(id),count=()=>db.prepare('SELECT count(*) n FROM questions').get().n;
const propose=(f,id=run(),repairReference)=>repo.propose(sessionId,id,randomUUID(),f.draft,[],()=>current,[f.input],{generationKind:'ai_original',repairReference});
const inspect=(p,f)=>repo.review(sessionId,p.id,f.draft);
const decision=(p,f,v)=>({schemaVersion:QUESTION_REVIEW_SCHEMA,sessionId,id:p.id,action:'confirm',draft:f.draft,qualityConfirmation:{revisionHash:v.quality.revisionHash,reviewed:true}});
const {parseVariationEquation}=await import('../../src/shared/variation-equation.ts');
const {assessVariationEquations}=await import('../../src/main/education/variation-equation.ts');
const {QUESTION_VARIATION_QUALITY_SCHEMA}=await import('../../src/shared/question-quality.ts');
const draft=(correct=true)=>({title:'同知识点三道变式',reason:'改变常数并独立求解',subject:'数学',grade:'七年级',knowledgePoint:'一元一次方程',items:[6,7,8].map(c=>({questionType:'short_answer',stem:`解方程3(x−2)=2x+${c}。`,answer:`x=${correct?c+6:11}`,analysis:`移项并合并，x=${correct?c+6:11}，再代回原式。`,options:null,difficulty:'medium'}))});
let parent,ref,goodId,goodQuality;
try{
 await check('Literal grammar retains full equation and rejects extra conditions, tasks, huge or ambiguous expressions',async()=>{
  for(const stem of ['解方程3(x−2)=2x+6。','3(x-2)=2x+6','解方程(x²−1)/(x−1)=2。','解方程√(x+2)=x。'])assert.equal(parseVariationEquation({stem,answer:'x=12',questionType:'short_answer'}).state,'ready',stem);
  for(const stem of ['解方程3(x-2)=2x+6，x>20。','先解x+1=2，再求2x。','解方程x=1; x=2','解方程x=999999999999999999999999','x+1=2，已知x为正整数'])assert.equal(parseVariationEquation({stem,answer:'x=1',questionType:'short_answer'}).state,'not_applicable',stem);
  assert.equal(parseVariationEquation({stem:'x+1=2',answer:'答案见解析',questionType:'short_answer'}).state,'answer_unreadable');
 });
 parent=await sql.create({...draft().items[0],stem:'解方程3(x−2)=2x+5。',answer:'x=11',subject:'数学',grade:'七年级',knowledgePoint:'一元一次方程',sourceKind:'local_bank',sourceTitle:'合成父题'});ref={schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:parent.id,version:questionVersion(parent)};
 const proposeV=(d,id=run(),repairReference,checks)=>repo.propose(sessionId,id,randomUUID(),d,[ref],()=>current,checks,{generationKind:'variation',repairReference});
 await check('Three altered constants are independently solved without submitted math plans; copied parent answer blocks all three',async()=>{
  const id=run(),bad=await proposeV(draft(false),id),view=await repo.review(sessionId,bad.id,draft(false));assert.equal(view.quality.schemaVersion,QUESTION_VARIATION_QUALITY_SCHEMA);assert.deepEqual(view.quality.items.map(q=>q.equation.state),['mismatch','mismatch','mismatch']);assert.deepEqual(view.quality.items.map(q=>q.equation.result.solutions),[['12'],['13'],['14']]);assert(view.quality.items.every(q=>q.math.state==='not_run'));assert(validQuestionQuality(view.quality,3));const before=count();await assert.rejects(repo.decide(decision(bad,{draft:draft(false)},view),()=>current),/quality_blocked/);assert.equal(count(),before);
  const feedback=await repo.repairFeedback(sessionId,id);assert.equal(feedback.issues[2].equation.result.solutions[0],'14');assert.equal(feedback.issues[2].equation.sourceText,undefined);
  const fixed=await proposeV(draft(),id,feedback.reference),next=await repo.review(sessionId,fixed.id,draft());assert.deepEqual(next.quality.items.map(q=>q.equation.state),['matched','matched','matched']);assert.equal(next.variation.assignment,'single_parent');assert.equal(next.variation.parents[0].question.version,ref.version);assert.equal(next.variation.parents[0].answer,'x=11');await repo.decide(decision(fixed,{draft:draft()},next),()=>current);assert.equal(count(),before+3);assert.equal((await repo.parentsForStudent('',JSON.parse(row(fixed.id).result_json).saved[1].questionId))[0].questionId,parent.id);goodId=fixed.id;goodQuality=next.quality;report.result={failedId:bad.id,fixedId:fixed.id,quality:next.quality,variation:next.variation};
 });
 await check('An unrelated correct model check cannot hide a copied wrong answer',async()=>{
  const checks=draft().items.map(()=>({kind:'expression',left:{op:'number',numerator:'1',denominator:'1'},right:{op:'number',numerator:'1',denominator:'1'}}));const p=await proposeV(draft(false),run(),undefined,checks),view=await repo.review(sessionId,p.id,draft(false));assert(view.quality.items.every(q=>q.math.state==='matched'&&q.equation.state==='mismatch'));assert.equal(view.quality.state,'blocked');
 });
 await check('Teacher changed constants and answers are recomputed; unreadable answers are explicit and cannot save',async()=>{
  const d=draft(),p=await proposeV(d),initial=await repo.review(sessionId,p.id,d),edited=structuredClone(d);edited.items[0].stem='解方程3(x−2)=2x+9。';let next=await repo.review(sessionId,p.id,edited);assert.equal(next.quality.items[0].equation.state,'mismatch');assert.deepEqual(next.quality.items[0].equation.result.solutions,['15']);await assert.rejects(repo.decide(decision(p,{draft:edited},initial),()=>current),/quality_blocked/);edited.items[0].answer='x=15';next=await repo.review(sessionId,p.id,edited);assert.equal(next.quality.items[0].equation.state,'matched');edited.items[0].answer='请看解析';next=await repo.review(sessionId,p.id,edited);assert(next.quality.items[0].issues.includes('variation_answer_unreadable'));
 });
 await check('Exact duplicate parent and batch remain blocked; multiple sources are a set rather than fabricated one-to-one lineage',async()=>{
  const d=draft();d.items[1]=structuredClone(d.items[0]);d.items[2]={...d.items[2],stem:parent.stem,answer:parent.answer};const p=await proposeV(d),v=await repo.review(sessionId,p.id,d);assert(v.quality.items[0].issues.includes('duplicate_batch'));assert(v.quality.items[2].issues.includes('duplicate_parent'));const p2=await sql.create({...parent,id:undefined,stem:'解方程2x=6。',answer:'x=3'});const other={...ref,questionId:p2.id,version:questionVersion(p2)};const group=await repo.propose(sessionId,run(),randomUUID(),draft(),[ref,other],()=>current,undefined,{generationKind:'variation'});assert.equal((await repo.review(sessionId,group.id)).variation.assignment,'source_set');
 });
 await check('Cancellation writes no quality version; changed parent revokes current review and save',async()=>{
  const d=draft(),p=await proposeV(d),controller=new AbortController();controller.abort();await assert.rejects(repo.review(sessionId,p.id,d,controller.signal),/abort/i);assert.equal(row(p.id).result_json,'{}');const v=await repo.review(sessionId,p.id,d);db.prepare('UPDATE questions SET body=? WHERE id=?').run(JSON.stringify({...parent,answer:'校正答案'}),parent.id);assert.equal((await repo.review(sessionId,p.id)).sourceCurrent,false);await assert.rejects(repo.decide(decision(p,{draft:d},v),()=>current),/source_changed/);db.prepare('UPDATE questions SET body=? WHERE id=?').run(JSON.stringify(parent),parent.id);
 });
 await check('Old v2 record stays readable and call-idempotent, without silently applying new checks',async()=>{
  const d=draft(),id=run(),call=randomUUID(),p=await repo.propose(sessionId,id,call,d,[ref],()=>current);const old=JSON.parse(row(p.id).payload_json);old.qualityPolicy=QUESTION_MATH_QUALITY_SCHEMA;db.prepare('UPDATE ai_confirmation_items SET payload_json=? WHERE id=?').run(JSON.stringify(old),p.id);assert.equal((await repo.propose(sessionId,id,call,d,[ref],()=>current)).id,p.id);const v=await repo.review(sessionId,p.id,d);assert.equal(v.quality.schemaVersion,QUESTION_MATH_QUALITY_SCHEMA);assert.equal(v.quality.items[0].equation,undefined);
 });
 await check('Cold SQLite restores exact new independent receipts and saved lineage without re-running worker or mutating records',async()=>{
  const before=db.prepare('SELECT * FROM ai_confirmation_items ORDER BY id').all();db.close();db=new DatabaseSync(file);const v=await repo.review(sessionId,goodId);assert.deepEqual(v.quality,goodQuality);assert.equal(v.variation.parents[0].question.version,ref.version);assert.deepEqual(db.prepare('SELECT * FROM ai_confirmation_items ORDER BY id').all(),before);assert(!validQuestionQuality({...v.quality,schemaVersion:QUESTION_SCIENCE_QUALITY_SCHEMA},3));
 });
 await check('Exact checked versions reuse sealed format/solver receipts without starting any Python worker',async()=>{
  const p=await proposeV(draft()),v=await repo.review(sessionId,p.id,draft()),before=row(p.id).result_json,previous=process.env.OMNI_EDU_PYTHON;process.env.OMNI_EDU_PYTHON='Z:\\missing-variation-python.exe';try{assert.deepEqual((await repo.review(sessionId,p.id,draft())).quality,v.quality);assert.deepEqual((await repo.review(sessionId,p.id)).quality,v.quality);assert.equal(row(p.id).result_json,before);}finally{previous===undefined?delete process.env.OMNI_EDU_PYTHON:process.env.OMNI_EDU_PYTHON=previous;}
 });
 report.ok=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,output,checks:checks.length,error:report.error}));}
