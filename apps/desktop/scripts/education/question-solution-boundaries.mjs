import {linear,radical,zeroLost,unsupported} from './question-solution-fixtures.mjs';
import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
import {equation,pressure,gravity,q,r} from './question-science-fixtures.mjs';
const {QuestionReviewRepository}=await import('../../src/main/education/question-review-repository.ts');
const {createQuestionMathPlans,assessQuestionMath,validQuestionMathPlans,retainsQuestionMathPlan}=await import('../../src/main/education/question-math.ts');
const {validQuestionQuality,QUESTION_MATH_QUALITY_SCHEMA,QUESTION_SCIENCE_QUALITY_SCHEMA,QUESTION_SOLUTION_QUALITY_SCHEMA}=await import('../../src/shared/question-quality.ts');
const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');
const {QUESTION_CONTEXT_SCHEMA}=await import('../../src/shared/question-context.ts');
const {QUESTION_REVIEW_SCHEMA}=await import('../../src/shared/question-review.ts');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-solution-review-')),file=path.join(output,'review.db'),checks=[];let db=new DatabaseSync(file),current=true;
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

try{
 await check('Solution plans require ordered exact stem/answer/analysis quotes and a new closed policy',async()=>{
  const f=linear(),plan=createQuestionMathPlans(f.draft,[f.input]);assert(!validQuestionMathPlans(plan,f.draft,true));assert(validQuestionMathPlans(plan,f.draft,true,true));
  for(const patch of [{sourceText:'未提供的另一个原式'},{answerText:'x=99'},{stepTexts:['不在解析内','x=11']},{stepTexts:[...f.input.stepTexts].reverse()},{stepTexts:['x=11','x=11']},{stepTexts:['x=11']},{verified:true}])assert.throws(()=>createQuestionMathPlans(f.draft,[{...f.input,...patch}]),/invalid_input/);
 });
 await check('Wrong middle transformation remains blocked despite final11; full linked repair saves only after one teacher confirmation',async()=>{
  const id=run(),bad=linear(false),good=linear(),p=await propose(bad,id),v=await inspect(p,bad);assert.equal(v.quality.schemaVersion,QUESTION_SOLUTION_QUALITY_SCHEMA);assert.equal(v.quality.state,'blocked');const proof=v.quality.items[0].math.science.result;assert.equal(proof.firstMismatch,1);assert.equal(proof.answerState,'matched');assert.deepEqual(proof.steps[0].removed,['11']);assert.deepEqual(proof.steps[0].added,['7']);assert(!validQuestionQuality({...v.quality,schemaVersion:QUESTION_SCIENCE_QUALITY_SCHEMA},1));const before=count();await assert.rejects(repo.decide(decision(p,bad,v),()=>current),/quality_blocked/);
  const feedback=await repo.repairFeedback(sessionId,id),fixed=await propose(good,id,feedback.reference),next=await inspect(fixed,good);assert.equal(next.quality.items[0].math.state,'matched');assert.equal(next.quality.items[0].math.science.kind,'solution');assert.equal(count(),before);const missing=decision(fixed,good,next);delete missing.qualityConfirmation;await assert.rejects(repo.decide(missing,()=>current));await repo.decide(decision(fixed,good,next),()=>current);assert.equal(count(),before+1);assert.equal(row(p.id).status,'pending');assert.equal((await repo.review(sessionId,fixed.id)).repairPrevious.quality.state,'blocked');report.chain={failed:p.id,fixed:fixed.id,quality:next.quality};
 });
 await check('Squaring must be explicit expansion followed by original filter; real extraneous candidate retained in history',async()=>{
  const id=run(),bad=radical(false),good=radical(),p=await propose(bad,id),v=await inspect(p,bad);assert.equal(v.quality.items[0].math.state,'mismatch');const feedback=await repo.repairFeedback(sessionId,id),fixed=await propose(good,id,feedback.reference),next=await inspect(fixed,good),proof=next.quality.items[0].math.science.result;assert.equal(proof.state,'matched');assert.deepEqual(proof.steps[0].added,['-1']);assert.deepEqual(proof.steps[1].removed,['-1']);assert(proof.original.restrictions.length);report.radical={failed:p.id,fixed:fixed.id,quality:next.quality};
 });
 await check('Dividing byx loses zero and blocks candidate even when all original roots are claimed',async()=>{
  const f=zeroLost(),p=await propose(f),v=await inspect(p,f);assert.equal(v.quality.state,'blocked');assert.deepEqual(v.quality.items[0].math.science.result.steps[0].removed,['0']);await assert.rejects(repo.decide(decision(p,f,v),()=>current),/quality_blocked/);
 });
 await check('Repair cannot shrink chain, drop math plan, change domain or swap check kind',async()=>{
  const f=linear(false),parent=createQuestionMathPlans(f.draft,[f.input])[0],child=createQuestionMathPlans(linear().draft,[linear().input])[0];
  assert(!retainsQuestionMathPlan(parent,null));assert(!retainsQuestionMathPlan(parent,{...child,input:{...child.input,domain:'positive'}}));assert(!retainsQuestionMathPlan(parent,{...child,input:{...child.input,steps:[child.input.steps.at(-1)],stepTexts:[child.input.stepTexts.at(-1)]}}));assert(!retainsQuestionMathPlan(parent,createQuestionMathPlans(equation(2).draft,[equation(2).input])[0]));
  const id=run(),p=await propose(f,id);await inspect(p,f);const feedback=await repo.repairFeedback(sessionId,id),shrunk=linear();shrunk.input.steps=shrunk.input.steps.slice(-1);shrunk.input.stepTexts=shrunk.input.stepTexts.slice(-1);await assert.rejects(propose(shrunk,id,feedback.reference),/invalid_input/);
 });
 await check('Teacher edits to analysis, stem or answer invalidate proof without reusing its science receipt',async()=>{
  const f=linear(),p=await propose(f),initial=await inspect(p,f);for(const key of ['stem','answer','analysis']){const edited=structuredClone(f.draft);edited.items[0][key]+='（教师修改）';const result=await repo.review(sessionId,p.id,edited);assert.equal(result.quality.items[0].math.state,'basis_changed');assert.equal(result.quality.items[0].math.science,undefined);}assert.deepEqual((await repo.review(sessionId,p.id,f.draft)).quality,initial.quality);
 });
 await check('Fresh changed condition computes root15 and retains its own analysis binding',async()=>{
  const f=linear(true,true),p=await propose(f),v=await inspect(p,f);assert.equal(v.quality.items[0].math.state,'matched');assert.deepEqual(v.quality.items[0].math.science.result.original.solutions,['15']);report.changed={id:p.id,quality:v.quality};
 });
 await check('Unsupported middle remains unverified and cannot become a matched science result',async()=>{
  const f=unsupported(),p=await propose(f),v=await inspect(p,f);assert.equal(v.quality.items[0].math.state,'unsupported');assert.equal(v.quality.items[0].math.science.result.steps[0].state,'unsupported');assert.equal(v.quality.items[0].math.conditionsVerified,false);
 });
 await check('Old v3 policy and receipt remain closed, unchanged and readable beside new v4 records',async()=>{
  const f=equation(2),p=await propose(f),v=await inspect(p,f);assert.equal(v.quality.schemaVersion,QUESTION_SCIENCE_QUALITY_SCHEMA);assert(validQuestionQuality(v.quality,1));const before=row(p.id);assert.deepEqual((await repo.review(sessionId,p.id)).quality,v.quality);assert.deepEqual(row(p.id),before);report.legacy={id:p.id,quality:v.quality};
 });
 await check('Cancellation adds no quality history; cold repository reads exact old and new native-independent SQLite snapshots',async()=>{
  const f=linear(),p=await propose(f),controller=new AbortController();controller.abort();await assert.rejects(repo.review(sessionId,p.id,f.draft,controller.signal),/abort/i);assert.equal(row(p.id).result_json,'{}');current=false;await assert.rejects(repo.review(sessionId,p.id,f.draft,undefined,()=>current),/cancelled/);current=true;
  const before=db.prepare('SELECT * FROM ai_confirmation_items ORDER BY id').all();db.close();db=new DatabaseSync(file);for(const id of [report.chain.fixed,report.radical.fixed,report.changed.id,report.legacy.id])await repo.review(sessionId,id);assert.deepEqual(db.prepare('SELECT * FROM ai_confirmation_items ORDER BY id').all(),before);
 });
 report.ok=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,output,checks:checks.length,error:report.error}));}
