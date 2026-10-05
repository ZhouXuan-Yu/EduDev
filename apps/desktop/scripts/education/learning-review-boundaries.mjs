import {practiceResultBoundaries} from './practice-result-boundaries.mjs';
import {resolveTrainingPlan,trainingSourcesMatch} from '../../src/main/education/training-plan.ts';
import {validTrainingPlan,TRAINING_PLAN_SCHEMA} from '../../src/shared/training-plan.ts';
import {STUDENT_TRAINING_SCHEMA,validStudentTrainingInput,validStudentTrainingSource,validStudentTrainingResult} from '../../src/shared/student-training.ts';
import {registerStudentTrainingIpc} from '../../src/main/education/student-training-api.ts';
import fs from 'node:fs';
import assert from 'node:assert/strict';import {DatabaseSync} from 'node:sqlite';import path from 'node:path';import {randomUUID} from 'node:crypto';
import {LearningReviewRepository} from '../../src/main/education/learning-review-repository.ts';
import {StudentContextRepository} from '../../src/main/students/context-repository.ts';
import {collectLearningEvidence} from '../../src/main/education/learning-evidence.ts';
import {createLearningReviewCoordinator} from '../../src/main/education/learning-review-coordinator.ts';
import {registerLearningReviewIpc} from '../../src/main/education/learning-review-api.ts';
import {validLearningDraft,validLearningReview,validLearningHistory,LEARNING_HISTORY_PAGE_SIZE,LEARNING_REVIEW_SCHEMA} from '../../src/shared/learning-review.ts';
import {learningSourcePreview} from '../../src/shared/learning-source-preview.ts';
export async function learningReviewBoundaries(check,output){
 const db=new DatabaseSync(path.join(output,'learning-review.db')),studentId='student_'+randomUUID(),sessionId='aisession_'+randomUUID(),runId='airun_'+randomUUID(),recordId='record_'+randomUUID();let cut=false,current=true;
 db.exec(`CREATE TABLE students(id TEXT PRIMARY KEY,status TEXT,display_name TEXT);CREATE TABLE learning_records(id TEXT PRIMARY KEY,student_id TEXT,record_type TEXT,subject TEXT,title TEXT,content TEXT,summary TEXT,tags TEXT,occurred_at TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,student_id TEXT,archived_at TEXT);CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,student_id TEXT);CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,student_id TEXT,action_type TEXT,status TEXT,title TEXT,payload_json TEXT,result_json TEXT DEFAULT '{}',created_at TEXT,updated_at TEXT,confirmed_at TEXT,rejected_at TEXT);`);
 db.prepare('INSERT INTO students VALUES(?,?,?)').run(studentId,'active','合成学生');db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,?,NULL)').run(sessionId,studentId);db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?)').run(runId,sessionId,studentId);
 const original=JSON.stringify({knowledgePoint:'等价变形',knowledgeType:'concept',isCorrect:true,type:'mastery_assessment',teacherConfirmed:true});
 db.prepare('INSERT INTO learning_records VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(recordId,studentId,'practice','数学','概念练习',original,'','[]','2026-09-30T08:00:00Z','2026-09-30T08:00:00Z','2026-09-30T08:00:00Z');
 const sql={all:async(q,p=[])=>db.prepare(q).all(...p),run:async(q,p=[])=>{db.prepare(q).run(...p);}};
 const repo=new StudentContextRepository({...sql,mapStudent:r=>({id:r.id,status:r.status,recordCount:r.record_count}),mapRecord:r=>({id:r.id,subject:r.subject,title:r.title,content:r.content,occurredAt:r.occurred_at,tags:JSON.parse(r.tags)})});sql.snapshot=repo.learningSnapshot.bind(repo);
 const reviews=new LearningReviewRepository({...sql,transaction:async work=>{db.exec('BEGIN IMMEDIATE');try{const result=await work(sql);if(cut)throw new Error('injected_cut');db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}});
 const draft={kind:'assessment',reason:'核对原学习证据',correction:{result:'incorrect',errorType:'application',feedback:'需要补充解释'}};
 const facts=async()=>({...await repo.learningSnapshot(studentId),reviewVersion:(await reviews.state(studentId)).version});
 const propose=async(d=draft)=>reviews.propose(sessionId,runId,randomUUID(),await facts(),d,d.kind==='assessment'?recordId:undefined);
 const input=(id,action='confirm',d=draft)=>({schemaVersion:LEARNING_REVIEW_SCHEMA,sessionId,id,action,...(action==='confirm'?{draft:d}:{})});
 try{
 await check('Saved evidence preview uses teacher language, preserves answer text and hides unverified technical flags',async()=>{const text=learningSourcePreview(JSON.stringify({knowledgePoint:'等价变形',knowledgeType:'concept',isCorrect:false,teacherConfirmed:true,userAnswer:'A',expectedAnswer:'B'}));assert(text.includes('知识点：等价变形'));assert(text.includes('学生作答：A'));assert(text.includes('参考答案：B'));assert(text.includes('原记录结果：错误'));assert(!/teacherConfirmed|isCorrect|knowledgeType/.test(text));assert.equal(learningSourcePreview('原始文字'), '原始文字');});
 await check('Learning review strict boundaries reject accessors, forged student scope, wrong enum and coerced retention',async()=>{
  assert(validLearningDraft(draft));assert(validLearningDraft({kind:'strategy',reason:'增加复习',desiredRetention:.95}));
  for(const v of[{...draft,studentId},{...draft,correction:{...draft.correction,result:{toString:()=> 'correct'}}},{kind:'strategy',reason:'增',desiredRetention:'0.9'},{kind:'strategy',reason:'增',desiredRetention:Infinity}])assert(!validLearningDraft(v));
  let invoked=false;const accessor={get kind(){invoked=true;return 'assessment';}};assert(!validLearningDraft(accessor));assert(!invoked);assert(!validLearningReview({...input('xilearning_'+randomUUID()),studentId},true));
 });
 await check('Pending suggestion is not a fact; teacher review reads actual saved source',async()=>{const p=await propose();assert.equal(p.state,'pending');assert.equal((await reviews.state(studentId)).assessments.length,0);const v=await reviews.review(sessionId,p.id);assert.equal(v.source.content,original);assert.equal(v.previousVersion,0);});
 let saved;
 await check('Teacher edited correction commits annotation and confirmation atomically without changing or duplicating practice',async()=>{saved=await propose();const edited={...draft,correction:{result:'correct',errorType:'none',feedback:'教师核对后解释正确'}};const r=await reviews.decide(input(saved.id,'confirm',edited));assert.equal(r.version,1);const state=await reviews.state(studentId),evidence=collectLearningEvidence(await repo.learningSnapshot(studentId),Date.now()/1000,state.assessments);assert.equal(evidence.points[0].outcomes.length,1);assert.equal(evidence.points[0].outcomes[0].teacherConfirmed,true);assert.equal(evidence.coverage.qualitativeWithoutConfirmation,0);assert.equal(db.prepare('SELECT content FROM learning_records').get().content,original);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM learning_records').get().n,1);assert.equal((await reviews.decide(input(saved.id,'confirm',edited))).version,1);await assert.rejects(reviews.decide(input(saved.id)),/conflict/);});
 await check('Rejected candidate produces no learning or strategy effect',async()=>{const before=await reviews.state(studentId),p=await propose();await reviews.decide(input(p.id,'reject'));assert.deepEqual(await reviews.state(studentId),before);assert.equal((await reviews.review(sessionId,p.id)).state,'rejected');});
 await check('Source mutation invalidates pending and previously trusted corrections; original flags do not grant provenance',async()=>{const p=await propose();db.prepare('UPDATE learning_records SET updated_at=? WHERE id=?').run('2026-10-01T00:00:00Z',recordId);await assert.rejects(reviews.decide(input(p.id)),/source_changed/);await assert.rejects(reviews.review(sessionId,p.id),/source_changed/);const state=await reviews.state(studentId),e=collectLearningEvidence(await repo.learningSnapshot(studentId),Date.now()/1000,state.assessments);assert.equal(e.points[0].outcomes[0].teacherConfirmed,false);});
 await check('Strategy target versions append and replay; changing retention does not add practice or destroy prior versions',async()=>{const a={kind:'strategy',reason:'安排更密集复习',desiredRetention:.95},b={kind:'strategy',reason:'恢复原复习节奏',desiredRetention:.9};for(const d of[a,b]){const p=await propose(d);await reviews.decide(input(p.id,'confirm',d));}const state=await reviews.state(studentId);assert.equal(state.version,3);assert.equal(state.desiredRetention,.9);assert.deepEqual(state.strategies.map(e=>e.draft.desiredRetention),[.95,.9]);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM learning_records').get().n,1);});
 await check('Concurrent-version candidates refuse stale acceptance, including analysis-to-proposal race',async()=>{const a=await propose(),b=await propose(),old=await facts();await reviews.decide(input(a.id));await assert.rejects(reviews.decide(input(b.id)),/conflict/);await assert.rejects(reviews.propose(sessionId,runId,randomUUID(),old,draft,recordId),/conflict/);});
 await check('Cancellation or transaction cut rolls back approval and annotation together',async()=>{const p=await propose(),before=await reviews.state(studentId);await assert.rejects(reviews.decide(input(p.id),()=>false),/cancelled/);cut=true;await assert.rejects(reviews.decide(input(p.id)),/injected_cut/);cut=false;assert.equal((await reviews.review(sessionId,p.id)).state,'pending');assert.deepEqual(await reviews.state(studentId),before);});
 await check('Foreign session, archived student and corrupted confirmation effect refuse authority',async()=>{await assert.rejects(reviews.review('aisession_'+randomUUID(),saved.id),/permission_denied/);db.prepare('UPDATE students SET status=? WHERE id=?').run('archived',studentId);await assert.rejects(reviews.list(sessionId),/permission_denied/);db.prepare('UPDATE students SET status=? WHERE id=?').run('active',studentId);const raw=db.prepare('SELECT result_json FROM ai_confirmation_items WHERE id=?').get(saved.id).result_json;db.prepare('UPDATE ai_confirmation_items SET result_json=? WHERE id=?').run('{}',saved.id);await assert.rejects(reviews.state(studentId));db.prepare('UPDATE ai_confirmation_items SET result_json=? WHERE id=?').run(raw,saved.id);});
 await check('One Pi tool waits for teacher reject and cannot propose without actual evidence read; cold explicit confirm remains available',async()=>{
  let observed;const events=[],coordinator=createLearningReviewCoordinator({store:{learningReviews:reviews},isCurrent:()=>current,canDecide:()=>current,emit:(_s,_r,v)=>events.push(v)}),tool=coordinator.tools(sessionId,runId,()=>observed)[0];
  const raw={...draft,sourceReference:'学习证据1'};assert.equal((await tool.execute('noread',raw,new AbortController().signal)).details.error.code,'source_changed');observed=await facts();const pending=tool.execute('actualwait',raw,new AbortController().signal);for(let i=0;i<30&&!events.length;i++)await new Promise(r=>setTimeout(r,10));assert.equal(events.at(-1).state,'pending');assert((await coordinator.decide(input(events.at(-1).id,'reject'))).ok);assert.equal(JSON.parse((await pending).content[0].text).state,'rejected');
 });
 await check('Model receipt distinguishes actual heuristic proposal from teacher final correction and requires a fresh read',async()=>{
  db.prepare('UPDATE learning_records SET content=?,updated_at=? WHERE id=?').run(JSON.stringify({knowledgePoint:'等价变形',knowledgeType:'concept',isCorrect:false,type:'mastery_assessment',userAnswer:'A',expectedAnswer:'B',questionType:'choice'}),'2026-10-02T00:00:00Z',recordId);
  const observed=await facts(),events=[],coordinator=createLearningReviewCoordinator({store:{learningReviews:reviews},isCurrent:()=>true,canDecide:()=>true,emit:(_s,_r,v)=>events.push(v)}),tool=coordinator.tools(sessionId,runId,()=>observed)[0];
  const initial={kind:'assessment',sourceReference:'学习证据1',reason:'模型初始建议',correction:{result:'correct',errorType:'none',feedback:'模型初始认为正确'}};
  const waiting=tool.execute('heuristic-receipt',initial,new AbortController().signal);for(let i=0;i<300&&!events.length;i++)await new Promise(r=>setTimeout(r,10));assert.equal(events.at(-1)?.state,'pending');
  const view=await reviews.review(sessionId,events.at(-1).id);assert.equal(view.draft.correction.result,'incorrect');assert.equal(view.heuristic.isCorrect,false);
  const final={...draft,correction:{result:'partial',errorType:'application',feedback:'教师最终正文不直接返回模型'}};assert((await coordinator.decide(input(events.at(-1).id,'confirm',final))).ok);
  const text=(await waiting).content[0].text,receipt=JSON.parse(text);assert.deepEqual(receipt.submittedProposal,{kind:'assessment',localHeuristicApplied:true,result:'incorrect',errorType:view.draft.correction.errorType});assert.equal(receipt.state,'confirmed');assert(text.includes('重新调用education_analyse_learning'));assert(!text.includes(final.correction.feedback));assert.equal((await reviews.review(sessionId,events.at(-1).id)).draft.correction.result,'partial');
 });
 await check('Invalid model plan never opens teacher approval and receives schema repair guidance for rest-day source instead of asking a teacher to debug parameters',async()=>{
  const observed=await facts(),events=[],before=await reviews.list(sessionId),coordinator=createLearningReviewCoordinator({store:{learningReviews:reviews},isCurrent:()=>true,canDecide:()=>true,emit:(_s,_r,v)=>events.push(v)}),tool=coordinator.tools(sessionId,runId,()=>observed)[0];
  const plan={title:'休息日参数检查',startDate:'2026-10-06',days:Array.from({length:14},(_,i)=>({day:i+1,pointReference:'知识点1',activity:i===12?'rest':'review',count:i===12?0:2,difficulty:'warmup',notes:'核对概念前提'}))};
  const response=await tool.execute('invalid-rest-source',{kind:'strategy',reason:'按真实结果调整',desiredRetention:.9,plan},new AbortController().signal),value=JSON.parse(response.content[0].text);assert.equal(value.code,'invalid_input');assert.equal(value.submittedForTeacherReview,false);assert(value.retryHint.includes('pointReference=null'));assert(value.retryHint.includes('自行修正'));assert.deepEqual(events,[]);assert.deepEqual(await reviews.list(sessionId),before);
 });
 // Exercise the actual host ownership checks before opening a real ledger transaction.
 const {createXiaozhiProductionHost}=await import('../../src/main/xiaozhi-agent/production-host.ts');
 const {createXiaozhiSessionState}=await import('../../src/main/xiaozhi-agent/session-state.ts');
 const hostState=createXiaozhiSessionState({...sql,change:async(q,p=[])=>Number(db.prepare(q).run(...p).changes)});await hostState.init();
 const deferred=()=>{let resolve;const promise=new Promise(r=>{resolve=r;});return{promise,resolve};};
 let commandGate,listGate;const originalCommand=hostState.command;
 hostState.command=async id=>{if(commandGate){commandGate.entered.resolve();await commandGate.release.promise;}return originalCommand(id);};
 const hostStore={xiaozhiState:hostState,learningReviews:{list:async id=>{if(listGate){const gate=listGate;listGate=undefined;gate.entered.resolve();await gate.release.promise;}return reviews.list(id);},decide:reviews.decide.bind(reviews),review:reviews.review.bind(reviews),history:reviews.history.bind(reviews)},getAiConversationSession:async()=>({session:{archivedAt:'owned-startup-refusal'}})};
 const host=createXiaozhiProductionHost({store:hostStore,dataRoot:path.join(output,'learning-host'),emit:()=>assert.fail('Refused startup must not emit a model event')});
 const start=()=>host.start({sessionId,commandId:'xicmd_'+randomUUID(),prompt:'隔离本地启动门禁'});
 try{
  await host.skillCatalog();
  await check('Production host blocks a pending learning decision during command startup by conversation identity',async()=>{
   const p=await propose();commandGate={entered:deferred(),release:deferred()};const pending=start();await commandGate.entered.promise;
   try{assert.deepEqual(await host.decideLearning(input(p.id,'reject')),{ok:false,error:'cancelled'});assert.equal((await reviews.review(sessionId,p.id)).state,'pending');}
   finally{commandGate.release.resolve();await pending;commandGate=undefined;}
  });
  await check('Stop invalidates an already admitted idle decision, but a fresh explicit teacher action remains available',async()=>{
   const p=await propose(),gate={entered:deferred(),release:deferred()};listGate=gate;const pending=host.decideLearning(input(p.id,'reject'));await gate.entered.promise;
   await host.stop(sessionId);gate.release.resolve();assert.deepEqual(await pending,{ok:false,error:'cancelled'});assert.equal((await reviews.review(sessionId,p.id)).state,'pending');
   assert((await host.decideLearning(input(p.id,'reject'))).ok);assert.equal((await reviews.review(sessionId,p.id)).state,'rejected');
  });
  await check('An idle decision never regains authority after a new startup returns to idle; another conversation stop does not revoke it',async()=>{
   const p=await propose(),gate={entered:deferred(),release:deferred()};listGate=gate;const pending=host.decideLearning(input(p.id,'reject'));await gate.entered.promise;
   assert(!(await start()).ok);gate.release.resolve();assert.deepEqual(await pending,{ok:false,error:'cancelled'});assert.equal((await reviews.review(sessionId,p.id)).state,'pending');
   const other={entered:deferred(),release:deferred()};listGate=other;const fresh=host.decideLearning(input(p.id,'reject'));await other.entered.promise;await host.stop('aisession_'+randomUUID());other.release.resolve();assert((await fresh).ok);
  });
 }finally{commandGate?.release.resolve();listGate?.release.resolve();await host.close();}
 await check('Cancellation during final asynchronous read rolls back both reject and confirm before commit',async()=>{
  for(const action of ['reject','confirm']){
   const p=await propose();let valid=true,written=false;
   const finalSql={...sql,run:async(q,params)=>{await sql.run(q,params);written=true;},all:async(q,params)=>{const rows=await sql.all(q,params);if(written&&q.startsWith('SELECT s.student_id'))valid=false;return rows;}};
   const boundaryRepo=new LearningReviewRepository({...sql,transaction:async work=>{db.exec('BEGIN IMMEDIATE');try{const result=await work(finalSql);db.exec('COMMIT');return result;}catch(e){db.exec('ROLLBACK');throw e;}}});
   await assert.rejects(boundaryRepo.decide(input(p.id,action),()=>valid),/cancelled/);assert.equal((await reviews.review(sessionId,p.id)).state,'pending');
  }
 });
 const historyInput={schemaVersion:LEARNING_REVIEW_SCHEMA,sessionId};
 await check('History strictly validates fixed conversation and numeric version cursor without invoking accessors',async()=>{
  assert(validLearningHistory(historyInput));assert(validLearningHistory({...historyInput,beforeVersion:2}));
  for(const value of[{...historyInput,studentId},{...historyInput,beforeVersion:'2'},{...historyInput,beforeVersion:0},{...historyInput,beforeVersion:Infinity},{...historyInput,beforeVersion:1.5},Object.assign(Object.create({}),historyInput)])assert(!validLearningHistory(value));
  let invoked=false;assert(!validLearningHistory({...historyInput,get beforeVersion(){invoked=true;return 2;}}));assert(!invoked);
 });
 const otherSession='aisession_'+randomUUID();db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,?,NULL)').run(otherSession,studentId);
 await check('Cross-conversation teacher history is confirmed-only and exposes exact edits without granting cross-session decisions',async()=>{
  const history=await reviews.history({...historyInput,sessionId:otherSession});assert.equal(history.total,5);assert.equal(history.latestVersion,5);assert(history.items.every(i=>!i.sameConversation));
  const first=history.items.find(i=>i.version===1);assert.equal(first.draft.correction.result,'correct');assert.equal(first.proposal.correction.result,'incorrect');assert.equal(first.sourceStatus,'changed');assert.equal(first.source.reference.sessionId,otherSession);
  await assert.rejects(reviews.decide({...input(saved.id),sessionId:otherSession}),/permission_denied/);
 });
 await check('Version pagination reaches all confirmed effects and preserves scope-aware before/after policy',async()=>{
  for(const retention of[.8,.82,.84]){const d={kind:'strategy',reason:'分页核验',desiredRetention:retention},p=await propose(d);await reviews.decide(input(p.id,'confirm',d));}
  const first=await reviews.history(historyInput);assert.equal(first.items.length,LEARNING_HISTORY_PAGE_SIZE);assert.equal(first.total,8);assert.equal(first.items[0].previousRetention,.82);assert.equal(first.items[0].previous.version,7);
  const next=await reviews.history({...historyInput,beforeVersion:first.nextBeforeVersion});assert.equal(next.nextBeforeVersion,null);assert.deepEqual([...first.items,...next.items].map(i=>i.version),[8,7,6,5,4,3,2,1]);
 });
 await check('Archived origin is readable from active same-student conversation; different student and archived current binding refuse',async()=>{
  db.prepare('UPDATE ai_conversation_sessions SET archived_at=? WHERE id=?').run('2026-10-05',sessionId);assert.equal((await reviews.history({...historyInput,sessionId:otherSession})).total,8);await assert.rejects(reviews.history(historyInput),/permission_denied/);db.prepare('UPDATE ai_conversation_sessions SET archived_at=NULL WHERE id=?').run(sessionId);
  const foreignStudent='student_'+randomUUID(),foreignSession='aisession_'+randomUUID();db.prepare('INSERT INTO students VALUES(?,?,?)').run(foreignStudent,'active','其他合成学生');db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,?,NULL)').run(foreignSession,foreignStudent);assert.equal((await reviews.history({...historyInput,sessionId:foreignSession})).total,0);
  db.prepare('UPDATE students SET status=? WHERE id=?').run('archived',studentId);await assert.rejects(reviews.history(historyInput),/permission_denied/);db.prepare('UPDATE students SET status=? WHERE id=?').run('active',studentId);
 });
 await check('Missing original source retains historical correction without a fabricated link or current assessment authority',async()=>{
  const originalRow=db.prepare('SELECT * FROM learning_records WHERE id=?').get(recordId);db.prepare('DELETE FROM learning_records WHERE id=?').run(recordId);
  const history=await reviews.history(historyInput),item=history.items.find(i=>i.draft.kind==='assessment');assert.equal(item.sourceStatus,'missing');assert.equal(item.source,undefined);assert.equal(item.draft.correction.result,'partial');
  db.prepare('INSERT INTO learning_records VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(...Object.values(originalRow));
 });
 await check('History uses the same confirmed-effect digest and refuses corrupted versions',async()=>{
  const raw=db.prepare('SELECT result_json FROM ai_confirmation_items WHERE id=?').get(saved.id).result_json,effect=JSON.parse(raw);effect.draft.correction.feedback='伪造校正';db.prepare('UPDATE ai_confirmation_items SET result_json=? WHERE id=?').run(JSON.stringify(effect),saved.id);await assert.rejects(reviews.history(historyInput),/unavailable/);db.prepare('UPDATE ai_confirmation_items SET result_json=? WHERE id=?').run(raw,saved.id);
  const coordinator=createLearningReviewCoordinator({store:{learningReviews:reviews},isCurrent:()=>true,canDecide:()=>true,emit:()=>{}});assert.deepEqual(await coordinator.history({...historyInput,studentId}),{ok:false,error:'invalid_input'});assert((await coordinator.history(historyInput)).ok);
 });
 await check('Learning IPC inherits main-frame authorization for review, decision and cross-session history',async()=>{const handlers=new Map(),host={reviewLearning:async()=>({ok:true}),decideLearning:async()=>({ok:true}),learningHistory:async()=>({ok:true})};registerLearningReviewIpc({ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},allowed:e=>e.main===true,host});assert.equal(handlers.size,3);for(const handle of handlers.values()){assert.deepEqual(await handle({main:false},{}),{ok:false,error:'permission_denied'});assert((await handle({main:true},{})).ok);}});

 const planRaw={title:'两周训练建议',startDate:'2026-10-06',days:Array.from({length:14},(_,i)=>({day:i+1,pointReference:'知识点1',activity:i%3===0?'review':'practice',count:4,difficulty:'warmup',notes:'先核对适用前提，再解释方法'}))};
 let planDraft;
 await check('Training nested v1 validates complete calendar, real dates and immutable knowledge references without executing accessors',async()=>{
  const f=await facts(),plan=resolveTrainingPlan(planRaw,f);planDraft={kind:'strategy',desiredRetention:.9,reason:'依据当前记录制定两周训练',plan};assert(validLearningDraft(planDraft));assert(trainingSourcesMatch(plan,f));
  for(const bad of [{...plan,startDate:'2026-02-30'},{...plan,schemaVersion:'future'},{...plan,days:plan.days.slice(1)},{...plan,days:plan.days.map((d,i)=>i?d:{...d,day:2})},{...plan,days:plan.days.map((d,i)=>i?d:{...d,count:1.5})},{...plan,days:plan.days.map((d,i)=>i?d:{...d,pointId:'kp_'+'f'.repeat(64)})}])assert(!validTrainingPlan(bad));
  let invoked=false;const days=[...plan.days];Object.defineProperty(days,'0',{get(){invoked=true;return plan.days[0];}});assert(!validTrainingPlan({...plan,days}));assert(!invoked);const sparse=new Array(14);assert(!validTrainingPlan({...plan,days:sparse}));
  assert.throws(()=>resolveTrainingPlan({...planRaw,days:planRaw.days.map(d=>({...d,pointReference:'知识点999'}))},f),/invalid_input/);assert.throws(()=>resolveTrainingPlan(planRaw,{...f,records:[]}),/no_evidence/);
 });
 await check('Teacher revises fourteen-day plan in the same atomic strategy ledger with original practice unchanged',async()=>{
  const before=await reviews.state(studentId),p=await propose(planDraft),edited={...planDraft,plan:{...planDraft.plan,title:'教师确认的训练计划',days:planDraft.plan.days.map((d,i)=>i?d:{...d,count:7,difficulty:'standard',notes:'教师修改：重点核对等式前提'})}};
  const confirmed=await reviews.decide(input(p.id,'confirm',edited));assert.equal(confirmed.version,before.version+1);const after=await reviews.state(studentId);assert.deepEqual(after.trainingPlan.draft,edited);assert.equal(after.trainingPlan.planFingerprint,(await facts()).fingerprint);assert.equal(db.prepare('SELECT COUNT(*) AS n FROM learning_records').get().n,1);assert.equal((await reviews.review(sessionId,p.id)).draft.plan.days[0].count,7);assert.equal((await reviews.decide(input(p.id,'confirm',edited))).version,confirmed.version);
 });
 await check('Training source directory cannot be forged or removed at approval; ordinary strategy remains backward compatible',async()=>{
  const p=await propose(planDraft),forged={...planDraft,plan:{...planDraft.plan,topics:planDraft.plan.topics.map(t=>({...t,name:'虚构知识点'}))}};
  await assert.rejects(reviews.decide(input(p.id,'confirm',forged)),/source_changed/);const {plan,...without}=planDraft;await assert.rejects(reviews.decide(input(p.id,'confirm',without)),/invalid_input/);await assert.rejects(propose(forged),/source_changed/);assert(validLearningDraft(without));await reviews.decide(input(p.id,'reject'));assert.equal((await reviews.state(studentId)).trainingPlan.draft.plan.title,'教师确认的训练计划');
 });
 await check('Training draft cancellation, transactional cut and stale strategy never commit a future plan',async()=>{
  const before=await reviews.state(studentId),p=await propose(planDraft);await assert.rejects(reviews.decide(input(p.id,'confirm',planDraft),()=>false),/cancelled/);cut=true;await assert.rejects(reviews.decide(input(p.id,'confirm',planDraft)),/injected_cut/);cut=false;assert.deepEqual(await reviews.state(studentId),before);assert.equal((await reviews.review(sessionId,p.id)).state,'pending');
  const a=await propose({kind:'strategy',desiredRetention:.91,reason:'教师修改节奏'});await reviews.decide(input(a.id,'confirm',{kind:'strategy',desiredRetention:.91,reason:'教师修改节奏'}));await assert.rejects(reviews.decide(input(p.id,'confirm',planDraft)),/conflict/);
 });
 await check('Historical training plan is versioned, source changes are marked and no fabricated new practice is created',async()=>{
  const old=await facts(),p=await propose(planDraft);db.prepare('UPDATE learning_records SET updated_at=? WHERE id=?').run('2026-10-03T00:00:00Z',recordId);await assert.rejects(reviews.decide(input(p.id,'confirm',planDraft)),/source_changed/);assert.notEqual((await facts()).fingerprint,old.fingerprint);const history=await reviews.history({schemaVersion:LEARNING_REVIEW_SCHEMA,sessionId});const plan=history.items.find(e=>e.draft.kind==='strategy'&&e.draft.plan);assert(plan);assert.equal(plan.sourceStatus,'changed');assert.equal(db.prepare('SELECT COUNT(*) AS n FROM learning_records').get().n,1);
 });
 let trainingView,resultRequest;
 await check('Traditional training input rejects forged scope, invalid dates, future outcomes and accessors without invoking them',async()=>{
  assert(validStudentTrainingInput({schemaVersion:STUDENT_TRAINING_SCHEMA,studentId}));assert(!validStudentTrainingInput({schemaVersion:STUDENT_TRAINING_SCHEMA,studentId,sql:'SELECT *'}));
  const good={schemaVersion:STUDENT_TRAINING_SCHEMA,studentId,requestId:randomUUID(),planId:'xilearning_'+randomUUID(),planVersion:1,day:1,result:'partial',occurredAt:'2026-10-01T08:00:00.000Z',notes:'实际课堂表现'};assert(validStudentTrainingResult(good));
  for(const bad of[{...good,knowledgePoint:'fake'},{...good,day:'1'},{...good,result:'passed'},{...good,requestId:'invalid'},{...good,allowHistorical:'true'},{...good,occurredAt:'2026-02-30T00:00:00.000Z'},{...good,occurredAt:'2099-01-01T00:00:00.000Z'}])assert(!validStudentTrainingResult(bad));
  let invoked=false;assert(!validStudentTrainingResult({...good,get notes(){invoked=true;return 'fake';}}));assert(!invoked);
 });
 await check('Traditional plan reads the same confirmed ledger and opens versioned evidence even when original conversation is archived',async()=>{
  const currentDraft={...planDraft,plan:resolveTrainingPlan(planRaw,await facts())},p=await propose(currentDraft);await reviews.decide(input(p.id,'confirm',currentDraft));
  db.prepare('UPDATE ai_conversation_sessions SET archived_at=? WHERE id=?').run('2026-10-05',sessionId);
  trainingView=await reviews.trainingView({schemaVersion:STUDENT_TRAINING_SCHEMA,studentId});assert.equal(trainingView.plan.id,p.id);assert(trainingView.plan.sourceCurrent&&trainingView.plan.strategyCurrent);assert.equal(trainingView.totalResults,0);
  assert(validStudentTrainingSource(trainingView.plan.sources[0].reference));const opened=await reviews.trainingSource(trainingView.plan.sources[0].reference);assert.equal(opened.record.id,recordId);
  await assert.rejects(reviews.trainingSource({...trainingView.plan.sources[0].reference,version:'0'.repeat(64)}),/source_changed/);
  db.prepare('UPDATE ai_conversation_sessions SET archived_at=NULL WHERE id=?').run(sessionId);
 });
 await check('Actual teacher result uses existing record writer transaction; rollback leaves no result or simulated practice',async()=>{
  const originalBefore=db.prepare('SELECT content FROM learning_records WHERE id=?').get(recordId).content;
  sql.createRecord=async(raw,id)=>{const time=new Date().toISOString();db.prepare('INSERT INTO learning_records VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(id,raw.studentId,raw.recordType,raw.subject,raw.title,raw.content,'',JSON.stringify(raw.tags),raw.occurredAt,time,time);};
  resultRequest={schemaVersion:STUDENT_TRAINING_SCHEMA,studentId,requestId:randomUUID(),planId:trainingView.plan.id,planVersion:trainingView.plan.version,day:1,result:'partial',occurredAt:'2026-10-01T08:00:00.000Z',notes:'实际解释仍缺前提'};
  cut=true;await assert.rejects(reviews.recordTrainingResult(resultRequest),/injected_cut/);cut=false;assert.equal(db.prepare('SELECT COUNT(*) n FROM learning_records').get().n,1);
  const saved=await reviews.recordTrainingResult(resultRequest);assert.equal(saved.duplicate,false);assert.equal(saved.recordId,'record_'+resultRequest.requestId);assert.equal(db.prepare('SELECT COUNT(*) n FROM learning_records').get().n,2);
  assert.equal(db.prepare('SELECT content FROM learning_records WHERE id=?').get(recordId).content,originalBefore);
  const actual=JSON.parse(db.prepare('SELECT content FROM learning_records WHERE id=?').get(saved.recordId).content);assert.equal(actual.knowledgePoint,trainingView.plan.plan.topics[0].name);assert.equal(actual.planVersion,resultRequest.planVersion);assert(!Object.hasOwn(actual,'teacherConfirmed'));
 });
 await check('Result retries are idempotent, changed requests conflict and only explicit outcomes enter original learning evidence',async()=>{
  assert.equal((await reviews.recordTrainingResult(resultRequest)).duplicate,true);await assert.rejects(reviews.recordTrainingResult({...resultRequest,result:'correct'}),/conflict/);assert.equal(db.prepare('SELECT COUNT(*) n FROM learning_records').get().n,2);
  const f=await facts(),e=collectLearningEvidence(f,Date.now()/1000,(await reviews.state(studentId)).assessments);assert.equal(e.coverage.explicit,2);assert.equal(e.points[0].outcomes.length,2);const newEvent=e.points[0].outcomes.find(o=>o.timestamp===Date.parse(resultRequest.occurredAt)/1000);assert(newEvent.qualitative&&!newEvent.teacherConfirmed);
  const current=await reviews.trainingView({schemaVersion:STUDENT_TRAINING_SCHEMA,studentId});assert(!current.plan.sourceCurrent);assert.equal(current.totalResults,1);assert.equal(current.results[0].result,'partial');
 });
 await check('Historical training requires teacher acknowledgment; superseded plan, other student and archived student refuse writes',async()=>{
  const again={...resultRequest,requestId:randomUUID(),day:2};await assert.rejects(reviews.recordTrainingResult(again),/source_changed/);
  await reviews.recordTrainingResult({...again,allowHistorical:true});assert.equal(db.prepare('SELECT COUNT(*) n FROM learning_records').get().n,3);
  const other='student_'+randomUUID();db.prepare('INSERT INTO students VALUES(?,?,?)').run(other,'active','其他学生');assert.deepEqual(await reviews.trainingView({schemaVersion:STUDENT_TRAINING_SCHEMA,studentId:other}),{results:[],totalResults:0});await assert.rejects(reviews.recordTrainingResult({...again,studentId:other,requestId:randomUUID(),allowHistorical:true}),/conflict/);
  const next={...planDraft,plan:resolveTrainingPlan(planRaw,await facts())},p=await propose(next);await reviews.decide(input(p.id,'confirm',next));await assert.rejects(reviews.recordTrainingResult({...again,requestId:randomUUID(),allowHistorical:true}),/conflict/);
  db.prepare('UPDATE students SET status=? WHERE id=?').run('archived',studentId);await assert.rejects(reviews.trainingView({schemaVersion:STUDENT_TRAINING_SCHEMA,studentId}),/permission_denied/);await assert.rejects(reviews.recordTrainingResult(resultRequest),/permission_denied/);db.prepare('UPDATE students SET status=? WHERE id=?').run('active',studentId);
 });
 await practiceResultBoundaries(check,{db,sql,reviews,studentId,sessionId,runId,facts,propose,input,planDraft,planRaw,resolveTrainingPlan,setCut:value=>{cut=value;}});
 await check('Traditional training IPC rejects subframes and invalid input before touching facts',async()=>{
  const handlers=new Map();let called=0;registerStudentTrainingIpc({ipcMain:{handle:(name,fn)=>handlers.set(name,fn)},allowed:e=>e.main===true,repository:{trainingView:async()=>{called++;return{};},trainingSource:async()=>{called++;return{};},recordTrainingResult:async()=>{called++;return{};}}});assert.equal(handlers.size,3);
  for(const handle of handlers.values()){assert.deepEqual(await handle({main:false},resultRequest),{ok:false,error:'permission_denied'});assert.deepEqual(await handle({main:true},{sql:'fake'}),{ok:false,error:'invalid_input'});}assert.equal(called,0);assert((await handlers.get('students:training')({main:true},{schemaVersion:STUDENT_TRAINING_SCHEMA,studentId})).ok);assert.equal(called,1);
 });
 }finally{db.close();}
}

/** Exercise the production factory with Pi's real native SessionManager, no network. */
export async function learningReviewNativeBoundaries(check,output,options,prime){
 const {createPiXiaozhiSession}=await import('../../src/main/xiaozhi-agent/pi-session.ts');
 const {SessionManager,parseSessionEntries}=await import('@earendil-works/pi-coding-agent');
 const root=path.join(output,'learning-review-native');fs.mkdirSync(root);
 const studentId='student_'+randomUUID(),other='student_'+randomUUID();let agent;
 const tool=name=>({name,label:name,description:'Owned boundary only',parameters:{type:'object',properties:{}},execute:async()=>({content:[{type:'text',text:'not executed'}]})});
 const studentContext={studentId,tools:[tool('education_read_student_context')]},studentLearning={studentId,tools:[tool('education_analyse_learning')]},studentLearningReview={studentId,tools:[tool('education_propose_learning_change')]};
 const base={...options,stateRoot:root,studentContext,studentLearning};let file,args,prefix;
 try{
 await check('Readonly learning history gains review once without rewriting original identities, messages or prompts',async()=>{
  agent=await createPiXiaozhiSession(base);await prime(agent);file=agent.session.sessionManager.getSessionFile();prefix=fs.readFileSync(file);await agent.dispose();agent=undefined;
  args={...base,sessionFile:file,studentLearningReview};agent=await createPiXiaozhiSession(args);
  assert(fs.readFileSync(file).subarray(0,prefix.length).equals(prefix));assert.equal(agent.session.getActiveToolNames().filter(x=>x==='education_propose_learning_change').length,1);
  await agent.dispose();agent=undefined;const first=fs.readFileSync(file);agent=await createPiXiaozhiSession(args);await agent.dispose();agent=undefined;
  assert(fs.readFileSync(file).equals(first));assert.equal(parseSessionEntries(first.toString()).filter(x=>x.type==='custom'&&x.customType==='xiaozhi.education.learning-review.v1').length,1);
 });
 await check('Wrong student, tools, dependency or removed review rejects before any identity or model-history write',async()=>{
  const before=fs.readFileSync(file);let modelWrites=0;
  for(const patch of[{studentLearningReview:undefined},{studentLearningReview:{...studentLearningReview,studentId:other}},
   {studentLearningReview:{studentId,tools:[tool('read_anything')]}},{studentLearningReview:{studentId,tools:[...studentLearningReview.tools,tool('education_propose_learning_change')]}},
   {studentLearning:undefined},{studentContext:undefined},{studentLearningReview:{...studentLearningReview,studentId:null}}]){
   await assert.rejects(createPiXiaozhiSession({...args,...patch,modelHistory:{authorize:async()=>{modelWrites++;throw Error('must not run');}}}),/^Error: configuration$/);
   assert(fs.readFileSync(file).equals(before));
  }assert.equal(modelWrites,0);
 });
 const clone=(name,mutate)=>{const entries=parseSessionEntries(fs.readFileSync(file,'utf8'));mutate(entries);const target=path.join(root,'sessions',name+'.jsonl');fs.writeFileSync(target,entries.map(e=>JSON.stringify(e)).join('\n')+'\n');return target;};
 const refuses=async target=>{const before=fs.readFileSync(target);await assert.rejects(createPiXiaozhiSession({...args,sessionFile:target}),/^Error: configuration$/);assert(fs.readFileSync(target).equals(before));};
 await check('Unknown review identity on an abandoned branch refuses even when native v2 would rewrite during open',async()=>{
  const target=clone('unknown-old-branch',entries=>{entries[0].version=2;entries.splice(1,0,{type:'custom',id:'deadbeef',parentId:null,timestamp:new Date().toISOString(),customType:'xiaozhi.education.learning-review.v2',data:{version:2}});});
  const preview=SessionManager.inMemory(options.workspace,undefined,parseSessionEntries(fs.readFileSync(target,'utf8')));
  assert(!preview.getBranch().some(x=>x.type==='custom'&&x.customType==='xiaozhi.education.learning-review.v2'));
  await refuses(target);
 });
 await check('Unknown payload and conflicting duplicate review identity refuse without native history mutation',async()=>{
  for(const [name,mutate]of [['changed-data',entries=>{entries.find(e=>e.customType==='xiaozhi.education.learning-review.v1').data.version=2;}],
   ['extra-data',entries=>{entries.find(e=>e.customType==='xiaozhi.education.learning-review.v1').data.autoConfirm=true;}],
   ['conflicting-copy',entries=>{const saved=entries.find(e=>e.customType==='xiaozhi.education.learning-review.v1');entries.push({...saved,id:'cafebabe',parentId:saved.id,data:{...saved.data,studentId:other}});} ]])await refuses(clone(name,mutate));
 });
 await check('Valid old native history migrates through Pi after scope admission and preserves original conversation content',async()=>{
  const target=clone('valid-native-v2',entries=>{entries[0].version=2;}),before=parseSessionEntries(fs.readFileSync(target,'utf8'));
  agent=await createPiXiaozhiSession({...args,sessionFile:target});assert.equal(agent.session.sessionManager.getHeader().version,3);await agent.dispose();agent=undefined;
  const after=parseSessionEntries(fs.readFileSync(target,'utf8'));assert.equal(after[0].version,3);assert.deepEqual(after.filter(e=>e.type==='message'),before.filter(e=>e.type==='message'));
  assert.equal(after.filter(e=>e.customType==='xiaozhi.education.learning-review.v1').length,1);
 });
 await check('Empty, missing-header and future native session files refuse instead of being initialized or migrated',async()=>{
  for(const [name,text]of [['empty',''],['no-header','{}\n'],['bad-line','not json\n']]){const target=path.join(root,'sessions',name+'.jsonl');fs.writeFileSync(target,text);await refuses(target);}
  await refuses(clone('future-native',entries=>{entries[0].version=999;}));
 });
 await check('Ordinary chat retains empty educational binding and never inherits another student during restore',async()=>{
  const emptyRoot=path.join(output,'learning-review-unbound');fs.mkdirSync(emptyRoot);const empty={...options,stateRoot:emptyRoot,studentContext:{...studentContext,studentId:''},studentLearning:{...studentLearning,studentId:''},studentLearningReview:{...studentLearningReview,studentId:''}};
  agent=await createPiXiaozhiSession(empty);await prime(agent);const unboundFile=agent.session.sessionManager.getSessionFile();await agent.dispose();agent=undefined;const before=fs.readFileSync(unboundFile);
  assert(parseSessionEntries(before.toString()).filter(e=>e.type==='custom'&&/education.(student-context|student-learning|learning-review)./.test(e.customType)).every(e=>e.data.studentId===''));
  await assert.rejects(createPiXiaozhiSession({...args,stateRoot:emptyRoot,sessionFile:unboundFile}),/configuration/);assert(fs.readFileSync(unboundFile).equals(before));
  agent=await createPiXiaozhiSession({...empty,sessionFile:unboundFile});await agent.dispose();agent=undefined;assert(fs.readFileSync(unboundFile).equals(before));
 });
 }finally{await agent?.dispose();}
}
