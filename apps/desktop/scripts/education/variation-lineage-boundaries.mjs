import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import {randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
import {equation,pressure,gravity,q,r} from './question-science-fixtures.mjs';
const {QuestionReviewRepository}=await import('../../src/main/education/question-review-repository.ts');
const {createQuestionMathPlans,assessQuestionMath,validQuestionMathPlans,retainsQuestionMathPlan}=await import('../../src/main/education/question-math.ts');
const {validQuestionQuality,QUESTION_MATH_QUALITY_SCHEMA,QUESTION_SCIENCE_QUALITY_SCHEMA}=await import('../../src/shared/question-quality.ts');
const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');
const {QUESTION_CONTEXT_SCHEMA}=await import('../../src/shared/question-context.ts');
const {QUESTION_REVIEW_SCHEMA}=await import('../../src/shared/question-review.ts');
const output=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-lineage-selection-')),file=path.join(output,'review.db'),checks=[];let db=new DatabaseSync(file),current=true;
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

const {createVariationLineage,validVariationLineage,VARIATION_LINEAGE_SCHEMA}=await import('../../src/shared/variation-lineage.ts');
const {questionSelectionIdentity,questionSelectionDuplicates,QUESTION_SELECTION_IDENTITY_POLICY}=await import('../../src/shared/question-selection-identity.ts');
const {questionContentIdentity}=await import('../../src/shared/question-identity.ts');
const {validQuestionDocument}=await import('../../src/shared/question-document.ts');
const {selectPaper}=await import('../../src/main/education/paper-selection.ts');
const {PaperRepository}=await import('../../src/main/education/paper-repository.ts');
const {PAPER_SCHEMA}=await import('../../src/shared/paper-blueprint.ts');
const {createQuestionReviewCoordinator}=await import('../../src/main/education/question-review-coordinator.ts');
const {basketFixture}=await import('./paper-basket-fixture.mjs');
const {PAPER_BASKET_SCHEMA}=await import('../../src/shared/paper-basket.ts');
const draft=(correct=true)=>({title:'逐题来源变式',reason:'分别改变实际父题条件',subject:'数学',grade:'七年级',knowledgePoint:'一元一次方程',items:[6,7,8].map(c=>({questionType:'short_answer',stem:`解方程3(x−2)=2x+${c}。`,answer:`x=${correct?c+6:11}`,analysis:`移项合并，x=${correct?c+6:11}。`,options:null,difficulty:'medium'}))});
const ref=q=>({schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:q.id,version:questionVersion(q)}),mapping=[[0],[1],[0,1]];
let parents,refs,savedId;
const make=async(d,id=run(),repairReference,itemParents=mapping,call=randomUUID())=>repo.propose(sessionId,id,call,d,refs,()=>current,undefined,{generationKind:'variation',repairReference,itemParents});
function scanQuestion(label='scan',change={}){
 const anchor={page:1,box:[0,0,1,1]},projection={statement:{state:'provided',text:'解方程2x=6。'},formulas:{state:'provided',text:'2x=6'},tables:{state:'not_applicable',text:''},figures:{state:'not_applicable',text:''},choices:{state:'not_applicable',text:''},subquestions:{state:'not_applicable',text:''}};
 const q={id:'question_'+randomUUID(),subject:'数学',grade:'七年级',knowledgePoint:'扫描去重',questionType:'short_answer',difficulty:'medium',stem:projection.statement.text,answer:'x=3',analysis:'两边同时除以2，x=3。',sourceKind:'teacher_resource',sourceTitle:label,tags:[],createdAt:'2026-11-03',updatedAt:'2026-11-03'};
 q.document={schemaVersion:'xiaozhi.question-document.v2',source:{resourceId:'resource_'+randomUUID(),resourceVersion:'a'.repeat(64),parserVersion:'fixture.v1',ocrVersion:''},blocks:[{kind:'image',id:'image',anchors:[anchor],assetId:'asset_'+randomUUID(),sha256:(label==='scan'?'b':'c').repeat(64),mime:'image/png',width:400,height:300}],answer:{origin:'teacher',text:q.answer,anchors:[]},analysis:{origin:'teacher',text:q.analysis,anchors:[]},context:{schemaVersion:'xiaozhi.question-projection.v1',projection,sourceBlockIds:['image']}};
 Object.assign(q,change);assert(validQuestionDocument(q.document));return q;
}
try{
 await check('Versioned per-item lineage validates each nonempty bounded source subset and rejects missing, duplicate and out-of-range parents',async()=>{
  assert.deepEqual(createVariationLineage(3,2,mapping).itemParents,mapping);assert.deepEqual(createVariationLineage(2,1).itemParents,[[0],[0]]);assert.equal(createVariationLineage(2,2),undefined);
  for(const itemParents of [[],[[0]],[[0],[0],[2]],[[0],[0],[]],[[0],[1],[0,0]],[[0],[1],['0']]])assert(!validVariationLineage({schemaVersion:VARIATION_LINEAGE_SCHEMA,itemParents},3,2));
  parents=await Promise.all([sql.create({...draft().items[0],subject:'数学',grade:'七年级',knowledgePoint:'一元一次方程',stem:'解方程3(x−2)=2x+5。',answer:'x=11',sourceKind:'local_bank',sourceTitle:'父题甲'}),sql.create({...draft().items[0],subject:'数学',grade:'七年级',knowledgePoint:'一元一次方程',stem:'解方程2x=6。',answer:'x=3',sourceKind:'local_bank',sourceTitle:'父题乙'})]);refs=parents.map(ref);
 });
 await check('Two actual read parents bind separately and jointly; a repair cannot swap item ancestry, but keeps same-run automatic repair and one decision',async()=>{
  const id=run(),bad=await make(draft(false),id),v=await repo.review(sessionId,bad.id,draft(false)),feedback=await repo.repairFeedback(sessionId,id);assert.equal(v.variation.assignment,'per_item');assert.deepEqual(v.variation.itemParents,mapping);assert.deepEqual(feedback.itemParentIndexes,mapping);
  await assert.rejects(make(draft(),id,feedback.reference,[[1],[0],[0,1]]),/source_changed/);const fixed=await make(draft(),id,feedback.reference),good=await repo.review(sessionId,fixed.id,draft());await repo.decide(decision(fixed,{draft:draft()},good),()=>current);const saved=JSON.parse(row(fixed.id).result_json).saved;
  for(let i=0;i<3;i++)assert.deepEqual(await repo.parentsForStudent('',saved[i].questionId),mapping[i].map(index=>refs[index]));assert.equal((await repo.propose(sessionId,id,JSON.parse(row(fixed.id).payload_json).callId,draft(),refs,()=>current,undefined,{generationKind:'variation',repairReference:feedback.reference,itemParents:mapping})).id,fixed.id);savedId=fixed.id;report.lineage={id:fixed.id,parents:refs,itemParents:mapping,saved};
 });
 await check('Lineage is covered by original immutable quality/effect hashes; changing only a valid mapping invalidates the receipt',async()=>{
  const before=row(savedId).payload_json,p=JSON.parse(before);p.variationLineage.itemParents[0]=[1];db.prepare('UPDATE ai_confirmation_items SET payload_json=? WHERE id=?').run(JSON.stringify(p),savedId);await assert.rejects(repo.review(sessionId,savedId),/unavailable/);db.prepare('UPDATE ai_confirmation_items SET payload_json=? WHERE id=?').run(before,savedId);
 });
 await check('Old unassigned candidate and old call replay keep their source-set semantics without silent assignment',async()=>{
  const id=run(),call=randomUUID(),p=await repo.propose(sessionId,id,call,draft(),refs,()=>current),v=await repo.review(sessionId,p.id);assert.equal(v.variation.assignment,'source_set');assert.equal(v.variation.itemParents,undefined);assert.equal((await repo.propose(sessionId,id,call,draft(),refs,()=>current)).id,p.id);
  const single=await repo.propose(sessionId,run(),randomUUID(),draft(),[refs[0]],()=>current),prior=JSON.parse(row(single.id).payload_json);delete prior.variationLineage;db.prepare('UPDATE ai_confirmation_items SET payload_json=? WHERE id=?').run(JSON.stringify(prior),single.id);assert.equal((await repo.propose(sessionId,row(single.id).run_id,prior.callId,draft(),[refs[0]],()=>current)).id,single.id);assert.equal(row(single.id).payload_json,JSON.stringify(prior));
 });
 await check('Original Pi tool requires actual per-item aliases for multiple parents, rejects foreign aliases/duplicates and forbids mapping for original/explanation',async()=>{
  const aliases=new Map([['题目1',refs[0]],['题目2',refs[1]]]),tool=createQuestionReviewCoordinator({store:{},isCurrent:()=>true,canDecide:()=>true,emit:()=>{}}).tools(sessionId,run(),aliases)[0];
  for(const patch of [{},{itemSourceReferences:[['题目1'],['题目3'],['题目1']]},{itemSourceReferences:[['题目1'],['题目2'],['题目1','题目1']]},{generationKind:'ai_original',sourceReferences:[],itemSourceReferences:[['题目1'],['题目1'],['题目1']]}]){const value=await tool.execute(randomUUID(),{...draft(),sourceReferences:['题目1','题目2'],...patch},new AbortController().signal);assert.equal(JSON.parse(value.content[0].text).code,'invalid_input');}
 });
 await check('Complete teacher transcriptions deduplicate different scan bytes; all six projected roles remain significant, AI/partial sources never inherit teacher equivalence',async()=>{
  const a=scanQuestion(),b=scanQuestion('second');assert.notEqual(questionContentIdentity(a).key,questionContentIdentity(b).key);assert.equal(questionSelectionIdentity(a).key,questionSelectionIdentity(b).key);assert.equal(questionSelectionDuplicates([a,b])[1].duplicateOf,0);
  for(const field of ['statement','formulas','tables','figures','choices','subquestions']){const c=structuredClone(b);c.document.context.projection[field]={state:'provided',text:field==='statement'?'解方程2x=8。':'独立条件'+field};if(field==='statement')c.stem=c.document.context.projection.statement.text;assert.notEqual(questionSelectionIdentity(a).key,questionSelectionIdentity(c).key,field);}
  const ai=structuredClone(b);ai.archive={ai:{policy:'page-crop-complete.v1'}};assert.notEqual(questionSelectionIdentity(a).key,questionSelectionIdentity(ai).key);const partial=structuredClone(a);partial.document.context.projection.figures={state:'missing',text:''};assert.equal(questionSelectionIdentity(partial).status,'unsupported');
 });
 await check('Original matching counts duplicate scans once, reports real shortage, retains all source facts and stores the explicit new policy',async()=>{
  const scans=[scanQuestion(),scanQuestion('second'),scanQuestion('changed')];scans[2].document.context.projection.statement.text=scans[2].stem='解方程2x=8。';const before=JSON.stringify(scans);const host={page:async(_b,after)=>after?[]:scans.map((q,i)=>({id:String(i),question:q})),read:async id=>scans.find(q=>q.id===id),validate:async()=>{}};
  const blueprint={title:'扫描去重卷',subject:'数学',grade:'七年级',durationMinutes:20,totalPoints:15,mode:'source_only',sections:[{id:'a',label:'方程',questionType:'short_answer',count:3,points:5}]};const selected=await selectPaper(host,blueprint,()=>true);assert.equal(selected.items.length,2);assert.equal(selected.duplicateRecords,1);assert.equal(selected.shortages[0].missing,1);assert.equal(selected.duplicatePolicy,QUESTION_SELECTION_IDENTITY_POLICY);assert.equal(JSON.stringify(scans),before);report.scanSelection=selected;
 });
 await check('Existing manual basket rejects a second confirmed scan in candidate and add paths without deleting either source',async()=>{
  const f=await basketFixture(path.join(output,'basket'));try{const a=scanQuestion(),b=scanQuestion('second');for(const q of [a,b]){q.grade='初二';q.questionType='解答题';f.question('seed',{...q});}const schema={schemaVersion:PAPER_BASKET_SCHEMA,sessionId:f.sid},blueprint={title:'扫描手选卷',subject:'数学',grade:'初二',durationMinutes:20,totalPoints:10,mode:'source_only',sections:[{id:'a',label:'方程',questionType:'解答题',count:2,points:5}]};let basket=await f.baskets.create({...schema,requestId:randomUUID(),blueprint});const ref={...schema,basketId:basket.id};basket=await f.baskets.mutate({...ref,expectedRevision:basket.revision,requestId:randomUUID(),operation:{type:'add',questionId:a.id,sectionId:'a',expectedSourceVersion:questionVersion(a)}});const candidate=await f.baskets.candidate({...ref,questionId:b.id});assert.equal(candidate.eligibility.reason,'duplicate');await assert.rejects(f.baskets.mutate({...ref,expectedRevision:basket.revision,requestId:randomUUID(),operation:{type:'add',questionId:b.id,sectionId:'a',expectedSourceVersion:questionVersion(b)}}),/conflict/);assert.equal(f.db.prepare('SELECT count(*) n FROM questions').get().n,2);}finally{f.close();}
 });
 await check('Cold lineage restores exact parent subsets, quality history and all source versions with no writes or worker replay',async()=>{const before=db.prepare('SELECT * FROM ai_confirmation_items ORDER BY id').all();db.close();db=new DatabaseSync(file);const v=await repo.review(sessionId,savedId);assert.deepEqual(v.variation.itemParents,mapping);for(const [i,s] of JSON.parse(row(savedId).result_json).saved.entries())assert.deepEqual(await repo.parentsForStudent('',s.questionId),mapping[i].map(index=>refs[index]));assert.deepEqual(db.prepare('SELECT * FROM ai_confirmation_items ORDER BY id').all(),before);});
 report.ok=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,output,checks:checks.length,error:report.error}));}
