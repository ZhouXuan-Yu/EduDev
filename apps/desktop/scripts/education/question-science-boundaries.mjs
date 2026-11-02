import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
import {equation,pressure,gravity,q,r} from './question-science-fixtures.mjs';
const {QuestionReviewRepository}=await import('../../src/main/education/question-review-repository.ts');
const {createQuestionMathPlans,assessQuestionMath,validQuestionMathPlans,retainsQuestionMathPlan}=await import('../../src/main/education/question-math.ts');
const {validQuestionQuality,QUESTION_MATH_QUALITY_SCHEMA,QUESTION_SCIENCE_QUALITY_SCHEMA}=await import('../../src/shared/question-quality.ts');
const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');
const {QUESTION_CONTEXT_SCHEMA}=await import('../../src/shared/question-context.ts');
const {QUESTION_REVIEW_SCHEMA}=await import('../../src/shared/question-review.ts');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-science-review-')),file=path.join(output,'review.db'),checks=[];let db=new DatabaseSync(file),current=true;
const report={ok:false,output,checks,boundary:'Actual source worker + original repository/SQLite. Synthetic questions only, no model requests. Does not replace formal UI or natural teaching review.'};
const check=async(name,fn)=>{await fn();checks.push({name,pass:true});console.log('PASS '+name);};
const sessionId='aisession_'+randomUUID();
db.exec(`CREATE TABLE students(id TEXT PRIMARY KEY,status TEXT);CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,student_id TEXT,archived_at TEXT);CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,student_id TEXT);CREATE TABLE questions(id TEXT PRIMARY KEY,body TEXT);CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,student_id TEXT,action_type TEXT,status TEXT,title TEXT,payload_json TEXT,result_json TEXT DEFAULT '{}',created_at TEXT,updated_at TEXT,confirmed_at TEXT,rejected_at TEXT);`);
db.prepare("INSERT INTO ai_conversation_sessions VALUES (?,'',NULL)").run(sessionId);
const sql={all:async(s,p=[])=>db.prepare(s).all(...p),run:async(s,p=[])=>{db.prepare(s).run(...p);},read:async id=>{const v=db.prepare('SELECT body FROM questions WHERE id=?').get(id);return v?JSON.parse(v.body):undefined;},create:async input=>{const v={...input,id:'question_'+randomUUID(),tags:input.tags||[],createdAt:'2026-11-03',updatedAt:'2026-11-03'};db.prepare('INSERT INTO questions VALUES (?,?)').run(v.id,JSON.stringify(v));return v;}};
const repo=new QuestionReviewRepository({...sql,transaction:async fn=>{db.exec('BEGIN IMMEDIATE');try{const v=await fn(sql);db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}});
const run=()=>{const id='airun_'+randomUUID();db.prepare("INSERT INTO ai_agent_runs VALUES (?,?,'')").run(id,sessionId);return id;};
const row=id=>db.prepare('SELECT * FROM ai_confirmation_items WHERE id=?').get(id),count=()=>db.prepare('SELECT count(*) n FROM questions').get().n;
const propose=(f,id=run(),repairReference)=>repo.propose(sessionId,id,randomUUID(),f.draft,[],()=>current,[f.input],{generationKind:'ai_original',repairReference});
const inspect=(p,f)=>repo.review(sessionId,p.id,f.draft);
const decision=(p,f,v)=>({schemaVersion:QUESTION_REVIEW_SCHEMA,sessionId,id:p.id,action:'confirm',draft:f.draft,qualityConfirmation:{revisionHash:v.quality.revisionHash,reviewed:true}});
try{
 await check('New plans require exact question/answer quotations and claimed quantity, old plan validator stays closed',async()=>{
  const f=pressure(true),plans=createQuestionMathPlans(f.draft,[f.input]);assert(!validQuestionMathPlans(plans,f.draft));assert(validQuestionMathPlans(plans,f.draft,true));
  for(const patch of [{sourceText:'未给的电压220V'},{answerText:'未提交的结果'},{expected:null},{verified:true}])assert.throws(()=>createQuestionMathPlans(f.draft,[{...f.input,...patch}]),/invalid_input/);
 });
 await check('Original equation rejects extraneous root, original repair carries restrictions and saves only after teacher decision',async()=>{
  const id=run(),bad=equation(-1),good=equation(2),p=await propose(bad,id),v=await inspect(p,bad);assert.equal(v.quality.schemaVersion,QUESTION_SCIENCE_QUALITY_SCHEMA);assert.equal(v.quality.state,'blocked');assert.equal(v.quality.items[0].math.science.result.candidates[0].satisfies,false);assert(v.quality.items[0].math.science.result.restrictions.length);const before=count();await assert.rejects(repo.decide(decision(p,bad,v),()=>current),/quality_blocked/);
  const feedback=await repo.repairFeedback(sessionId,id);assert.equal(feedback.issues[0].math.state,'mismatch');const fixed=await propose(good,id,feedback.reference),next=await inspect(fixed,good);assert.equal(next.quality.items[0].math.state,'matched');assert.equal(count(),before);await repo.decide(decision(fixed,good,next),()=>current);assert.equal(count(),before+1);assert.equal(row(p.id).status,'pending');assert.equal((await repo.review(sessionId,fixed.id)).repairPrevious.quality.state,'blocked');report.equation={failed:p.id,fixed:fixed.id,quality:next.quality};
 });
 await check('Wrong square-area conversion is blocked, repaired actual5000Pa and exact scale are retained',async()=>{
  const id=run(),bad=pressure(),good=pressure(true),p=await propose(bad,id),v=await inspect(p,bad);assert.equal(v.quality.items[0].math.state,'mismatch');assert.equal(v.quality.items[0].math.science.result.actual.exact,'5000');const feedback=await repo.repairFeedback(sessionId,id),fixed=await propose(good,id,feedback.reference),next=await inspect(fixed,good);assert.equal(next.quality.items[0].math.state,'matched');assert.equal(next.quality.items[0].math.science.result.actual.unit,'Pa');assert.equal(next.quality.answerVerification,'not_run');assert.equal(next.quality.items[0].math.conditionsVerified,false);assert(validQuestionQuality(next.quality,1));assert(!validQuestionQuality({...next.quality,schemaVersion:QUESTION_MATH_QUALITY_SCHEMA},1));report.pressure={failed:p.id,fixed:fixed.id,quality:next.quality};
 });
 await check('Dimensional conflict is a blocking mismatch; repair cannot change target unit, kind or equation domain',async()=>{
  const f=gravity();f.input.expression=q(r(6,10),'kg');const p=await propose(f),v=await inspect(p,f);assert.equal(v.quality.items[0].math.state,'mismatch');assert.equal(v.quality.items[0].math.science.result.state,'dimension_mismatch');await assert.rejects(repo.decide(decision(p,f,v),()=>current),/quality_blocked/);
  const plan=createQuestionMathPlans(f.draft,[f.input])[0];assert(!retainsQuestionMathPlan(plan,{...plan,input:{...plan.input,targetUnit:'kg'}}));assert(!retainsQuestionMathPlan(plan,createQuestionMathPlans(equation(2).draft,[equation(2).input])[0]));const e=createQuestionMathPlans(equation(2).draft,[equation(2).input])[0];assert(!retainsQuestionMathPlan(e,{...e,input:{...e.input,domain:'positive'}}));
 });
 await check('Teacher stem, answer and analysis edits invalidate old solver; a fresh changed-g plan recomputes5.88N',async()=>{
  const f=gravity(),plans=createQuestionMathPlans(f.draft,[f.input]),first=await assessQuestionMath(f.draft,plans,new AbortController().signal);assert.equal(first[0].science.result.actual.exact,'6');
  for(const key of ['stem','answer','analysis']){const edited=structuredClone(f.draft);edited.items[0][key]+='（教师修改）';assert.equal((await assessQuestionMath(edited,plans,new AbortController().signal))[0].state,'basis_changed');}
  const changed=gravity(true),result=await assessQuestionMath(changed.draft,createQuestionMathPlans(changed.draft,[changed.input]),new AbortController().signal);assert.equal(result[0].science.result.actual.exact,'147/25');
 });
 await check('Source revision changes invalidate pending science review and prevent saving the old result',async()=>{
  const f=pressure(true),parent=await sql.create({...f.draft.items[0],subject:'物理',grade:'八年级',knowledgePoint:'压强',sourceKind:'local_bank',sourceTitle:'合成题源'}),ref={schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:parent.id,version:questionVersion(parent)},id=run();
  const d=structuredClone(f.draft);d.items[0].stem+='请列式说明。';const p=await repo.propose(sessionId,id,randomUUID(),d,[ref],()=>current,[f.input]),v=await repo.review(sessionId,p.id,d);const old=count();db.prepare('UPDATE questions SET body=? WHERE id=?').run(JSON.stringify({...parent,answer:'来源已校正'}),parent.id);assert.equal((await repo.review(sessionId,p.id)).sourceCurrent,false);await assert.rejects(repo.decide(decision(p,{draft:d},v),()=>current),/source_changed/);assert.equal(count(),old);
 });
 await check('Cancellation writes no science history; cold read restores exact saved and pending results without worker replay',async()=>{
  const f=pressure(true),p=await propose(f),controller=new AbortController();controller.abort();await assert.rejects(repo.review(sessionId,p.id,f.draft,controller.signal),/abort/i);assert.equal(row(p.id).result_json,'{}');current=false;await assert.rejects(repo.review(sessionId,p.id,f.draft,undefined,()=>current),/cancelled/);current=true;
  const before=db.prepare('SELECT * FROM ai_confirmation_items ORDER BY id').all();db.close();db=new DatabaseSync(file);assert.equal((await repo.review(sessionId,report.equation.fixed)).quality.items[0].math.science.kind,'equation');assert.deepEqual((await repo.review(sessionId,report.pressure.fixed)).quality,report.pressure.quality);assert.deepEqual(db.prepare('SELECT * FROM ai_confirmation_items ORDER BY id').all(),before);
 });
 report.ok=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,output,checks:checks.length,error:report.error}));}
