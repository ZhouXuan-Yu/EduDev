import '../office-agent/register-source.mjs';
import {buoyancyReview} from './question-buoyancy-fixtures.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
const {QuestionReviewRepository}=await import('../../src/main/education/question-review-repository.ts');
const {createQuestionMathPlans,assessQuestionMath,validQuestionMathPlans,retainsQuestionMathPlan,questionMathCalculationMatches}=await import('../../src/main/education/question-math.ts');
const {validQuestionBuoyancyCheck,validQuestionBuoyancyProof}=await import('../../src/shared/question-buoyancy.ts');
const {validQuestionQuality,QUESTION_MATH_QUALITY_SCHEMA,QUESTION_SCIENCE_QUALITY_SCHEMA,QUESTION_SOLUTION_QUALITY_SCHEMA,QUESTION_BUOYANCY_QUALITY_SCHEMA}=await import('../../src/shared/question-quality.ts');
const {QUESTION_REVIEW_SCHEMA}=await import('../../src/shared/question-review.ts');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-buoyancy-review-')),file=path.join(output,'review.db'),checks=[];let db=new DatabaseSync(file),current=true;
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
 await check('Quantities and targets bind current stem/answer/analysis; only new policy accepts buoyancy plans',async()=>{
  const f=buoyancyReview(),plans=createQuestionMathPlans(f.draft,[f.input]);assert(validQuestionBuoyancyCheck(f.input));assert(validQuestionMathPlans(plans,f.draft,true,true,true));assert(!validQuestionMathPlans(plans,f.draft,true,true));
  for(const patch of [{sourceText:'未给的量'},{assumptionsText:'未声明的近似'},{model:{...f.input.model,gravity:{value:'9.8',unit:'N/kg'}}},{targets:[{...f.input.targets[0],unit:'m'}]},{targets:[{...f.input.targets[0],answerText:'浮力99N'}]},{verified:true}])assert.throws(()=>createQuestionMathPlans(f.draft,[{...f.input,...patch}]),/invalid_input/);
 });
 await check('Actual force/density model checks default, critical, overload, bottom, changedg and kN/cm targets',async()=>{
  report.models=[];for(const options of [{},{load:'4'},{load:'5'},{load:'5',bottom:true},{load:'4',g:'9.8'},{kilo:true}]){const f=buoyancyReview(options),receipt=(await assessQuestionMath(f.draft,createQuestionMathPlans(f.draft,[f.input]),new AbortController().signal))[0];assert.equal(receipt.state,'matched');assert.equal(receipt.engine,'exact-rational-cube-v1');assert.equal(receipt.conditionsVerified,false);assert(questionMathCalculationMatches(f.input,receipt));assert(validQuestionBuoyancyProof(receipt.buoyancy));assert(receipt.buoyancy.model.methods.agree);report.models.push({options,input:f.input,receipt});}
 });
 await check('Wrong5N answer blocks original review and save; actual6N remains in immutable quality',async()=>{
  const f=buoyancyReview({wrong:true}),p=await propose(f),v=await inspect(p,f),before=count();assert.equal(v.quality.schemaVersion,QUESTION_BUOYANCY_QUALITY_SCHEMA);assert.equal(v.quality.state,'blocked');assert.equal(v.quality.items[0].math.buoyancy.targets[0].actual,'6');assert(validQuestionQuality(v.quality,1));await assert.rejects(repo.decide(decision(p,f,v),()=>current),/quality_blocked/);assert.equal(count(),before);report.failed={id:p.id,quality:v.quality};
 });
 await check('Linked correction retains failed targets and saves only after existing teacher confirmation',async()=>{
  const id=run(),bad=buoyancyReview({wrong:true}),good=buoyancyReview(),p=await propose(bad,id);await inspect(p,bad);const feedback=await repo.repairFeedback(sessionId,id),fixed=await propose(good,id,feedback.reference),v=await inspect(fixed,good),before=count();assert.equal(v.quality.state,'manual_review');assert.equal(v.quality.items[0].math.state,'matched');const noConfirmation=decision(fixed,good,v);delete noConfirmation.qualityConfirmation;await assert.rejects(repo.decide(noConfirmation,()=>current));await repo.decide(decision(fixed,good,v),()=>current);assert.equal(count(),before+1);assert.equal(row(p.id).status,'pending');assert.equal((await repo.review(sessionId,fixed.id)).repairPrevious.quality.state,'blocked');report.repair={failed:p.id,fixed:fixed.id,quality:v.quality};
 });
 await check('g9.8 rejects old zero-force answer and recomputes exact0.08N with critical3.92N',async()=>{
  const f=buoyancyReview({load:'4',g:'9.8',wrong:true}),p=await propose(f),v=await inspect(p,f);assert.equal(v.quality.items[0].math.state,'mismatch');assert.equal(v.quality.items[0].math.buoyancy.targets[2].actual,'2/25');const good=buoyancyReview({load:'4',g:'9.8'}),receipt=(await assessQuestionMath(good.draft,createQuestionMathPlans(good.draft,[good.input]),new AbortController().signal))[0];assert.equal(receipt.state,'matched');assert.equal(receipt.buoyancy.model.values.criticalLoad.exact,'98/25');
 });
 await check('Missingg stays unsupported without inventing numeric verification',async()=>{
  const f=buoyancyReview({missingG:true}),p=await propose(f),v=await inspect(p,f);assert.equal(v.quality.items[0].math.state,'unsupported');assert.equal(v.quality.items[0].math.buoyancy.model.values,null);assert.equal(v.quality.answerVerification,'not_run');assert(validQuestionQuality(v.quality,1));
 });
 await check('Teacher changes to statement, answer or model declaration invalidate old proof and confirmation',async()=>{
  for(const key of ['stem','answer','analysis']){const f=buoyancyReview(),p=await propose(f),v=await inspect(p,f),edited=structuredClone(f.draft);edited.items[0][key]+=' 教师修改';const next=await repo.review(sessionId,p.id,edited);assert.equal(next.quality.items[0].math.state,'basis_changed');assert.equal(next.quality.items[0].math.buoyancy,undefined);assert(!next.quality.items[0].math.calculation.includes('模型实际'));assert(!next.quality.items[0].math.calculation.includes('受力法与等效平均密度法结果一致'));assert.notEqual(next.quality.revisionHash,v.quality.revisionHash);await assert.rejects(repo.decide(decision(p,{draft:edited},v),()=>current));}
 });
 await check('Repair cannot drop targets, change scene, null known quantities or remove declared conditions',async()=>{
  const f=buoyancyReview({wrong:true}),parent=createQuestionMathPlans(f.draft,[f.input])[0];assert(!retainsQuestionMathPlan(parent,null));for(const change of [{targets:f.input.targets.slice(0,1)},{model:{...f.input.model,placement:'bottom'}},{model:{...f.input.model,gravity:null}},{model:{...f.input.model,conditions:{...f.input.model.conditions,noOtherForces:null}}}])assert(!retainsQuestionMathPlan(parent,{...parent,input:{...f.input,...change}}));const id=run(),p=await propose(f,id);await inspect(p,f);const feedback=await repo.repairFeedback(sessionId,id),child=buoyancyReview();child.input.targets=child.input.targets.slice(0,1);await assert.rejects(propose(child,id,feedback.reference),/invalid_input/);
 });
 await check('Old policies reject new proof; forged state, actual value or interpretation claims cannot pass',async()=>{
  const f=buoyancyReview(),p=await propose(f),v=await inspect(p,f);for(const version of [QUESTION_MATH_QUALITY_SCHEMA,QUESTION_SCIENCE_QUALITY_SCHEMA,QUESTION_SOLUTION_QUALITY_SCHEMA])assert(!validQuestionQuality({...v.quality,schemaVersion:version},1));const good=v.quality.items[0].math.buoyancy;for(const forged of [{...good,state:'mismatch'},{...good,targets:[{...good.targets[0],actual:'5'},...good.targets.slice(1)]},{...good,model:{...good.model,conditionsVerified:true}}])assert(!validQuestionBuoyancyProof(forged));assert(!validQuestionQuality({...v.quality,items:[{...v.quality.items[0],math:{...v.quality.items[0].math,engine:'sympy-1.14.0'}}]},1));
 });
 await check('Cancellation and supersession retain original semantics; persisted proof survives SQLite reopen',async()=>{
  const f=buoyancyReview(),abort=new AbortController();abort.abort();await assert.rejects(assessQuestionMath(f.draft,createQuestionMathPlans(f.draft,[f.input]),abort.signal));const p=await propose(f),v=await inspect(p,f),snapshot=row(p.id);db.close();db=new DatabaseSync(file);assert.deepEqual(row(p.id),snapshot);assert.equal((await repo.review(sessionId,p.id)).quality.revisionHash,v.quality.revisionHash);current=false;await assert.rejects(repo.decide(decision(p,f,v),()=>current));current=true;
 });report.ok=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}finally{if(db.isOpen)db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:checks.length,output,error:report.error}));}
