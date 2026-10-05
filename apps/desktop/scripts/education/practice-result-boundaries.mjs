import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {PracticeReviewRepository} from '../../src/main/education/practice-review-repository.ts';
import {questionVersion} from '../../src/main/education/question-context-provider.ts';
import {PRACTICE_REVIEW_SCHEMA} from '../../src/shared/practice-review.ts';
import {QUESTION_CONTEXT_SCHEMA} from '../../src/shared/question-context.ts';
import {PRACTICE_RESULT_SCHEMA,validPracticeResult,practiceOutcome} from '../../src/shared/practice-result.ts';
import {STUDENT_TRAINING_SCHEMA,validStudentTrainingResult} from '../../src/shared/student-training.ts';
import {collectLearningEvidence} from '../../src/main/education/learning-evidence.ts';

/** Extends the existing real SQLite learning fixture and its single transaction. */
export async function practiceResultBoundaries(check,{db,sql,reviews,studentId,sessionId,runId,facts,propose,input,planDraft,planRaw,resolveTrainingPlan,setCut}){
 db.exec('CREATE TABLE result_questions(id TEXT PRIMARY KEY,body TEXT);CREATE TABLE result_exercises(id TEXT PRIMARY KEY,body TEXT);');
 const questions=[1,2].map(n=>({id:'question_'+randomUUID(),subject:'数学',grade:'初二',knowledgePoint:'等价变形',questionType:'short_answer',difficulty:'medium',stem:`合成题${n}`,answer:'参考答案',analysis:'逐步解释',sourceTitle:'教师原题',sourceKind:'local_bank',tags:[],createdAt:'2026-10-01',updatedAt:'2026-10-01'}));
 for(const q of questions)db.prepare('INSERT INTO result_questions VALUES(?,?)').run(q.id,JSON.stringify(q));
 const ports={...sql,read:async id=>{const r=db.prepare('SELECT body FROM result_questions WHERE id=?').get(id);return r?JSON.parse(r.body):undefined;},lineage:async()=>[],exercises:async id=>db.prepare('SELECT body FROM result_exercises').all().map(r=>JSON.parse(r.body)).filter(e=>e.studentId===id),save:async(s,d)=>{const e={...d,id:'exercise_set_'+randomUUID(),studentId:s,createdAt:'2026-10-01',updatedAt:'2026-10-01'};db.prepare('INSERT INTO result_exercises VALUES(?,?)').run(e.id,JSON.stringify(e));return e;}};
 let transactions=0;const practice=new PracticeReviewRepository({...ports,transaction:async work=>{transactions++;db.exec('BEGIN IMMEDIATE');try{const v=await work(ports);db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}});
 const draft={title:'教师确认实际练习',reason:'巩固已记录知识点',subject:'数学',knowledgePoint:'等价变形',items:questions.map((q,index)=>({index,role:'original',teacherObservation:''}))};
 const candidate=await practice.propose(sessionId,runId,randomUUID(),draft,questions.map(q=>({schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:q.id,version:questionVersion(q)})),()=>true);
 await practice.decide({schemaVersion:PRACTICE_REVIEW_SCHEMA,sessionId,id:candidate.id,action:'confirm',draft},()=>true);
 const original=await practice.review(sessionId,candidate.id),exercise=original.exercise;
 sql.practiceSource=(id,eid)=>practice.sourceOn(ports,id,eid);
 const current={...planDraft,plan:resolveTrainingPlan(planRaw,await facts())},planned=await propose(current);await reviews.decide(input(planned.id,'confirm',current));
 const view=await reviews.trainingView({schemaVersion:STUDENT_TRAINING_SCHEMA,studentId});
 const practiceInput={schemaVersion:PRACTICE_RESULT_SCHEMA,exerciseId:exercise.id,version:original.exerciseVersion,answers:[{index:0,answer:'实际回答甲',result:'incorrect',feedback:'遗漏前提'},{index:1,answer:'实际回答乙',result:'correct',feedback:'步骤完整'}],score:{earned:6,max:10}};
 const request={schemaVersion:STUDENT_TRAINING_SCHEMA,studentId,requestId:randomUUID(),planId:view.plan.id,planVersion:view.plan.version,day:1,result:'partial',occurredAt:'2026-10-02T08:00:00.000Z',notes:'本次实际训练',practice:practiceInput};
 const count=()=>db.prepare('SELECT COUNT(*) n FROM learning_records').get().n;
 await check('Practice result contract refuses forged fields, scores, duplicate/missing indices and accessors without coercion',async()=>{
  assert(validPracticeResult(practiceInput));assert(validStudentTrainingResult(request));assert.equal(practiceOutcome(practiceInput.answers),'partial');
  for(const bad of[{...practiceInput,studentId},{...practiceInput,title:'forged'},{...practiceInput,score:{earned:11,max:10}},{...practiceInput,score:{earned:'6',max:10}},{...practiceInput,score:{earned:0,max:0}},{...practiceInput,answers:[practiceInput.answers[0],practiceInput.answers[0]]},{...practiceInput,answers:[{...practiceInput.answers[0],answer:undefined}]}])assert(!validPracticeResult(bad));
  let invoked=false;const accessed=[{...practiceInput.answers[0],get answer(){invoked=true;return'bad';}}];assert(!validPracticeResult({...practiceInput,answers:accessed}));const holes=new Array(2);holes[1]=practiceInput.answers[1];assert(!validPracticeResult({...practiceInput,answers:holes}));assert(!invoked);
 });
 await check('Same transaction refuses wrong practice version, point, subject, overall outcome and missing question without writes',async()=>{
  const before=count();for(const p of[{...practiceInput,version:'0'.repeat(64)},{...practiceInput,answers:[practiceInput.answers[0]]}])await assert.rejects(reviews.recordTrainingResult({...request,practice:p}),/source_changed|invalid_input/);
  await assert.rejects(reviews.recordTrainingResult({...request,result:'correct'}),/invalid_input/);
  const saved=db.prepare('SELECT body FROM result_exercises WHERE id=?').get(exercise.id).body;db.prepare('UPDATE result_exercises SET body=? WHERE id=?').run(JSON.stringify({...exercise,subject:'英语'}),exercise.id);await assert.rejects(reviews.recordTrainingResult(request),/source_changed/);db.prepare('UPDATE result_exercises SET body=? WHERE id=?').run(saved,exercise.id);
  await assert.rejects(practice.sourceOn(ports,'student_'+randomUUID(),exercise.id),/permission_denied/);assert.equal(count(),before);
  for(const changed of[{...draft,subject:'英语'},{...draft,knowledgePoint:'另一知识点'}]){const c=await practice.propose(sessionId,runId,randomUUID(),changed,questions.map(q=>({schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:q.id,version:questionVersion(q)})),()=>true);await practice.decide({schemaVersion:PRACTICE_REVIEW_SCHEMA,sessionId,id:c.id,action:'confirm',draft:changed},()=>true);const v=await practice.review(sessionId,c.id);await assert.rejects(reviews.recordTrainingResult({...request,practice:{...practiceInput,exerciseId:v.exercise.id,version:v.exerciseVersion}}),/invalid_input/);}
  assert.equal(count(),before);
 });
 await check('Result rollback and same-connection practice authority preserve original ledger/exercise and teacher facts',async()=>{
  const before=count(),ledger=db.prepare('SELECT * FROM ai_confirmation_items WHERE id=?').get(candidate.id),connectionCount=transactions;
  setCut(true);try{await assert.rejects(reviews.recordTrainingResult(request),/injected_cut/);}finally{setCut(false);}assert.equal(count(),before);
  const receipt=await reviews.recordTrainingResult(request);assert(!receipt.duplicate);assert.equal(count(),before+1);assert.equal(transactions,connectionCount);assert.deepEqual(db.prepare('SELECT * FROM ai_confirmation_items WHERE id=?').get(candidate.id),ledger);assert.deepEqual((await ports.exercises(studentId))[0],exercise);
 });
 await check('Saved answer/score reads exactly, altered retries conflict, cold view retains history and qualitative gate stays unverified',async()=>{
  assert((await reviews.recordTrainingResult(request)).duplicate);for(const p of[{...practiceInput,score:{earned:7,max:10}},{...practiceInput,answers:practiceInput.answers.map(a=>({...a,answer:'changed'}))}])await assert.rejects(reviews.recordTrainingResult({...request,practice:p}),/conflict/);
  const saved=(await reviews.trainingView({schemaVersion:STUDENT_TRAINING_SCHEMA,studentId})).results.find(r=>r.recordId==='record_'+request.requestId);assert.deepEqual(saved.practice,{...practiceInput,title:exercise.title});
  const id='record_'+request.requestId,body=db.prepare('SELECT content FROM learning_records WHERE id=?').get(id).content,altered=JSON.parse(body);altered.practice.answers[0].answer='forged';db.prepare('UPDATE learning_records SET content=? WHERE id=?').run(JSON.stringify(altered),id);await assert.rejects(reviews.recordTrainingResult(request),/conflict/);db.prepare('UPDATE learning_records SET content=? WHERE id=?').run(body,id);
  const e=collectLearningEvidence(await facts(),Date.now()/1000,(await reviews.state(studentId)).assessments),outcome=e.points[0].outcomes.find(o=>o.timestamp===Date.parse(request.occurredAt)/1000);assert(outcome.qualitative&&!outcome.teacherConfirmed);assert.equal(outcome.result,'partial');
 });
}
