import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import os from 'node:os';import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';import {registerHooks} from 'node:module';
registerHooks({resolve(s,c,n){if(s==='electron')return{url:'data:text/javascript,export const utilityProcess={};export const app={isPackaged:false};export class BrowserWindow{constructor(){throw Error("No PDF/window execution in source boundary test");}}export const session={},nativeImage={},shell={},dialog={},safeStorage={};',shortCircuit:true};return n(s,c);},load(url,c,n){if(url.endsWith('/xiaozhi-agent/ocr-runtime-manifest.json'))return{format:'module',source:'export default '+fs.readFileSync(new URL(url),'utf8')+';',shortCircuit:true};return n(url,c);}});
const {validLearningDiagnosis,diagnosisEvidence,diagnosisAnswers,LEARNING_DIAGNOSIS_SCHEMA}=await import('../../src/shared/learning-diagnosis.ts');
const {validLearningDraft,LEARNING_REVIEW_SCHEMA}=await import('../../src/shared/learning-review.ts');
const {StudentContextRepository}=await import('../../src/main/students/context-repository.ts');
const {LearningReviewRepository}=await import('../../src/main/education/learning-review-repository.ts');
const {collectLearningEvidence}=await import('../../src/main/education/learning-evidence.ts');
const {createLearningProvider}=await import('../../src/main/education/learning-provider.ts');
const {createLearningReviewCoordinator}=await import('../../src/main/education/learning-review-coordinator.ts');

const root=fs.mkdtempSync(path.join(os.tmpdir(),'xiaozhi-practice-target-')),report={ok:false,root,checks:[],paidRequests:0},check=async(name,fn)=>{await fn();report.checks.push(name);console.log('PASS '+name);};
const db=new DatabaseSync(path.join(root,'state.db')),studentId='student_'+randomUUID(),sessionId='aisession_'+randomUUID(),runId='airun_'+randomUUID(),recordId='record_'+randomUUID();
db.exec(`CREATE TABLE students(id TEXT PRIMARY KEY,status TEXT,display_name TEXT);CREATE TABLE learning_records(id TEXT PRIMARY KEY,student_id TEXT,record_type TEXT,subject TEXT,title TEXT,content TEXT,summary TEXT,tags TEXT,occurred_at TEXT,created_at TEXT,updated_at TEXT);CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,student_id TEXT,archived_at TEXT);CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,student_id TEXT);CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,student_id TEXT,action_type TEXT,status TEXT,title,payload_json TEXT,result_json TEXT DEFAULT '{}',created_at TEXT,updated_at TEXT,confirmed_at TEXT,rejected_at TEXT);`);
db.prepare('INSERT INTO students VALUES(?,?,?)').run(studentId,'active','合成小甲');db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,?,NULL)').run(sessionId,studentId);db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?)').run(runId,sessionId,studentId);
const original=JSON.stringify({knowledgePoint:'等价变形',knowledgeType:'procedure',result:'incorrect',actualAnswer:'3(x+2)=15\n3x+2=15\n3x=13\nx=13/3',errorCause:'概念错误',expectedAnswer:'x=3'});
db.prepare('INSERT INTO learning_records VALUES(?,?,?,?,?,?,?,?,?,?,?)').run(recordId,studentId,'mistake','数学','括号练习',original,'','[]','2026-10-29T08:00:00Z','2026-10-29T08:00:00Z','2026-10-29T08:00:00Z');
const sql={all:async(q,p=[])=>db.prepare(q).all(...p),run:async(q,p=[])=>{db.prepare(q).run(...p);}};
const context=new StudentContextRepository({...sql,mapStudent:r=>({id:r.id,status:r.status,displayName:r.display_name,recordCount:r.record_count}),mapRecord:r=>({id:r.id,subject:r.subject,title:r.title,content:r.content,occurredAt:r.occurred_at,tags:JSON.parse(r.tags)})});sql.snapshot=context.learningSnapshot.bind(context);
const host={...sql,transaction:async f=>{db.exec('BEGIN IMMEDIATE');try{const value=await f(sql);db.exec('COMMIT');return value;}catch(e){db.exec('ROLLBACK');throw e;}}};let reviews=new LearningReviewRepository(host),observed;
const store={studentContext:context,learningReviews:reviews,listStudents:async()=>[{displayName:'合成小甲',realName:'合成小甲',school:'合成学校'}],sanitizeProblemText:async text=>({sanitizedText:text}),getAiConversationSession:async()=>({session:{studentId,archivedAt:null}})};
const diagnosis={schemaVersion:LEARNING_DIAGNOSIS_SCHEMA,category:'concept',evidence:[{answerNumber:1,fromLine:2,toLine:2}],interpretation:'可能未把括号内每项都乘以3，须请学生说明。',intervention:'先口述展开步骤，再做一道辨析练习。'};
const draft={kind:'assessment',reason:'定位当前真实作答',correction:{result:'incorrect',errorType:'application',feedback:'请解释第二步',diagnosis}};
const facts=async()=>({...await context.learningSnapshot(studentId),reviewVersion:(await reviews.state(studentId)).version}),propose=async(d=draft)=>reviews.propose(sessionId,runId,randomUUID(),await facts(),d,recordId),decision=(id,d=draft)=>({schemaVersion:LEARNING_REVIEW_SCHEMA,sessionId,id,action:'confirm',draft:d});
const read=async(includeAnswers=false)=>{const tool=createLearningProvider(store,sessionId,studentId,()=>true,f=>{observed=f;})[0],r=await tool.execute('read',{includeAnswers},new AbortController().signal);assert(!r.isError,JSON.stringify(r));return JSON.parse(r.content[0].text);};
const {PracticeReviewRepository}=await import('../../src/main/education/practice-review-repository.ts');
const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');
const {PRACTICE_REVIEW_SCHEMA,validPracticeDraft}=await import('../../src/shared/practice-review.ts');
const {PRACTICE_TARGET_SCHEMA,validPracticeTarget,practiceDocuments,studentPractice}=await import('../../src/shared/practice-target.ts');
const {QUESTION_CONTEXT_SCHEMA}=await import('../../src/shared/question-context.ts');
const {createPracticeReviewCoordinator}=await import('../../src/main/education/practice-review-coordinator.ts');
db.exec('CREATE TABLE target_questions(id TEXT PRIMARY KEY,body TEXT);CREATE TABLE target_exercises(id TEXT PRIMARY KEY,body TEXT);');
const questions=['解方程 3(x+2)=15','解方程 2(x-1)=4','解方程 (x+1)/(x-1)=2'].map((stem,i)=>({id:'question_'+randomUUID(),subject:'数学',grade:'八年级',knowledgePoint:'等价变形',questionType:'short_answer',difficulty:i<2?'easy':'hard',stem,answer:'x=3',analysis:'教师专用解析：按原式精确求解并保留分母限制。',sourceTitle:'合成原题',sourceKind:'local_bank',tags:[],createdAt:'2026-10-29',updatedAt:'2026-10-29'}));
for(const q of questions)db.prepare('INSERT INTO target_questions VALUES(?,?)').run(q.id,JSON.stringify(q));
const ports={...sql,learning:async id=>({facts:await context.learningSnapshot(id),state:await reviews.state(id)}),read:async id=>{const r=db.prepare('SELECT body FROM target_questions WHERE id=?').get(id);return r?JSON.parse(r.body):undefined;},lineage:async()=>[],exercises:async id=>db.prepare('SELECT body FROM target_exercises').all().map(r=>JSON.parse(r.body)).filter(e=>e.studentId===id),save:async(id,d)=>{const e={...d,id:'exercise_set_'+randomUUID(),studentId:id,createdAt:'2026-10-29',updatedAt:'2026-10-29'};db.prepare('INSERT INTO target_exercises VALUES(?,?)').run(e.id,JSON.stringify(e));return e;}};
const practiceHost={...ports,transaction:async work=>{db.exec('BEGIN IMMEDIATE');try{const r=await work(ports);db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
let practice=new PracticeReviewRepository(practiceHost);store.practiceReviews=practice;
const sources=()=>questions.map(q=>({schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:q.id,version:questionVersion(q)}));
const targeted={title:'同知识点三题',reason:'依据教师实际修正安排少量练习',subject:'数学',knowledgePoint:'等价变形',target:{schemaVersion:PRACTICE_TARGET_SCHEMA,basic:2,advanced:1},items:questions.map((q,index)=>({index,role:'original',teacherObservation:'逐行核对_教师专用'}))};
const targetSource=async()=>({recordId,version:(await context.learningSnapshot(studentId)).records[0].version,reviewVersion:(await reviews.state(studentId)).version});
const confirm=(id,d=targeted)=>({schemaVersion:PRACTICE_REVIEW_SCHEMA,sessionId,id,action:'confirm',draft:d});
const count=()=>db.prepare('SELECT COUNT(*) n FROM learning_records').get().n;
try{
 await check('Optional targeting schema is closed, bounded, dense and leaves old practice valid',async()=>{
  assert(validPracticeDraft(targeted));const {target,...old}=targeted;assert(validPracticeDraft(old));
  for(const t of[{...target,basic:-1},{...target,basic:8,advanced:1},{...target,basic:0,advanced:0},{...target,basic:'2'},{...target,source:'forged'},{...target,schemaVersion:'unknown'}])assert(!validPracticeTarget(t));
  const holes=new Array(3);holes[0]=targeted.items[0];assert(!validPracticeDraft({...targeted,items:holes}));
 });
 let pending;
 await check('Actual S02 solver checks three saved equation answers and binds original teacher diagnosis without an attempt',async()=>{
  const assessment=await propose();await reviews.decide(decision(assessment.id));
  pending=await practice.propose(sessionId,runId,randomUUID(),targeted,sources(),()=>true,await targetSource());
  const v=await practice.review(sessionId,pending.id);assert(v.targetCurrent);assert.equal(v.target.basis.diagnosis.category,'concept');assert.equal(v.target.basis.assessmentVersion,1);assert.equal(v.target.answers.length,3);assert(v.target.answers.every(a=>a.state==='matched'&&a.result.engine==='sympy-1.14.0'));assert.equal(count(),1);report.first=v;
 });
 await check('A new teacher reading/copy diagnosis invalidates only pending targeting and never creates a practice attempt',async()=>{
  const edited={...draft,correction:{...draft.correction,diagnosis:{...diagnosis,category:'reading',interpretation:'已核对口述，这是抄写漏项。',intervention:'先逐行核对抄写，再核对条件与最后答案。'}}};const a=await propose(edited);await reviews.decide(decision(a.id,edited));
  assert.equal((await practice.review(sessionId,pending.id)).targetCurrent,false);await assert.rejects(practice.decide(confirm(pending.id),()=>true),/source_changed/);assert.equal((await ports.exercises(studentId)).length,0);assert.equal(count(),1);
  await practice.decide({schemaVersion:PRACTICE_REVIEW_SCHEMA,sessionId,id:pending.id,action:'reject'},()=>true);
  await assert.rejects(practice.propose(sessionId,runId,randomUUID(),targeted,sources(),()=>true,{...await targetSource(),reviewVersion:1}),/source_changed/);
 });
 await check('Wrong count, point, difficulty, stale source and known wrong answer cannot stage a targeted exercise',async()=>{
  const before=db.prepare('SELECT COUNT(*) n FROM ai_confirmation_items').get().n;
  for(const d of[{...targeted,target:{...targeted.target,basic:1}},{...targeted,subject:'英语'},{...targeted,knowledgePoint:'几何'},{...targeted,target:{...targeted.target,basic:1,advanced:2}}])await assert.rejects(practice.propose(sessionId,runId,randomUUID(),d,sources(),()=>true,await targetSource()),/target_mismatch/);
  await assert.rejects(practice.propose(sessionId,runId,randomUUID(),targeted,sources(),()=>true,{...await targetSource(),version:'0'.repeat(64)}),/source_changed/);
  const q=questions[0],bad={...q,answer:'x=4'};db.prepare('UPDATE target_questions SET body=? WHERE id=?').run(JSON.stringify(bad),q.id);const refs=sources();refs[0].version=questionVersion(bad);await assert.rejects(practice.propose(sessionId,runId,randomUUID(),targeted,refs,()=>true,await targetSource()),/answer_mismatch/);db.prepare('UPDATE target_questions SET body=? WHERE id=?').run(JSON.stringify(q),q.id);
  assert.equal(db.prepare('SELECT COUNT(*) n FROM ai_confirmation_items').get().n,before);
 });
 let saved,finalDraft;
 await check('One original confirmation preserves target and reorder, is idempotent and has a clean deterministic student document',async()=>{
  const call=randomUUID(),source=await targetSource(),p=await practice.propose(sessionId,runId,call,targeted,sources(),()=>true,source);assert.equal((await practice.propose(sessionId,runId,call,targeted,sources(),()=>true,source)).id,p.id);
  const v=await practice.review(sessionId,p.id);assert.equal(v.target.basis.diagnosis.category,'reading');assert.match(v.target.basis.diagnosis.intervention,/逐行核对/);
  const {target,...removed}=targeted;await assert.rejects(practice.decide(confirm(p.id,removed),()=>true),/invalid_input/);await assert.rejects(practice.decide(confirm(p.id,{...targeted,items:targeted.items.slice(1)}),()=>true),/target_mismatch/);
  finalDraft={...targeted,items:[targeted.items[2],targeted.items[0],targeted.items[1]]};await practice.decide(confirm(p.id,finalDraft),()=>true);await practice.decide(confirm(p.id,finalDraft),()=>true);saved=await practice.review(sessionId,p.id);assert.equal((await ports.exercises(studentId)).length,1);assert.equal(count(),1);assert.deepEqual(saved.exercise.items.map(i=>i.stem),[questions[2].stem,questions[0].stem,questions[1].stem]);
  const docs=practiceDocuments(saved.exercise),student=studentPractice(saved.exercise);assert.equal(student.items.length,3);assert.deepEqual(Object.keys(student.items[0]),['stem']);for(const text of['答案：','解析：','教师专用','合成小甲',studentId])assert(!docs.student.content.includes(text));assert.match(docs.teacher.content,/答案：x=3/);assert.match(docs.teacher.content,/教师专用/);report.documents=docs;report.saved=saved;
 });
 await check('Cancel, student scope and cold original SQLite read retain exact saved version and parent references',async()=>{
  const c=new AbortController();c.abort();await assert.rejects(practice.propose(sessionId,runId,randomUUID(),targeted,sources(),()=>true,await targetSource(),c.signal));await assert.rejects(practice.propose(sessionId,runId,randomUUID(),targeted,sources(),()=>false,await targetSource()),/cancelled/);
  await assert.rejects(practice.source('student_'+randomUUID(),saved.exercise.id),/permission_denied/);practice=new PracticeReviewRepository(practiceHost);store.practiceReviews=practice;const cold=await practice.source(studentId,saved.exercise.id);assert.deepEqual(cold,saved);assert.equal(cold.questions.length,3);assert(cold.questions.every(q=>q.source.version===questionVersion(q.question)));assert.equal(count(),1);
 });
 await check('Original Pi tools require this run delivered evidence and return sanitized target plus separate student/teacher content',async()=>{
  const delivered=new Map([['学习证据1',await targetSource()]]),observedFacts=await facts(),map=new Map(sources().map((q,i)=>['题目'+(i+1),q]));
  const coordinator=createPracticeReviewCoordinator({store,isCurrent:()=>true,canDecide:()=>true,emit:()=>{}}),tools=coordinator.tools(sessionId,runId,studentId,map,()=>({facts:observedFacts,delivered}));
  const raw={...targeted,target:undefined,targeting:{reference:'学习证据2',version:delivered.get('学习证据1').version,basic:2,advanced:1},items:targeted.items.map((q,i)=>({reference:'题目'+(i+1),role:q.role,teacherObservation:q.teacherObservation}))};delete raw.target;
  const no=await tools[0].execute(randomUUID(),raw,new AbortController().signal);assert(no.isError);const readback=await tools[1].execute('read',{},new AbortController().signal);assert(!readback.isError);const value=JSON.parse(readback.content[0].text);assert.equal(value.target.diagnosis.category,'reading');assert.equal(value.target.answers.length,3);assert(!JSON.stringify(value).includes(studentId));assert(!value.documents.student.content.includes('教师专用'));assert.equal(count(),1);report.toolRead=value;
 });

 await check('Stored targeting refuses altered proof or unsupported-as-verified claims while unsupported text remains explicitly manual',async()=>{
  const {checkPracticeAnswers}=await import('../../src/main/education/practice-target.ts'),{validPracticeTargetReview}=await import('../../src/shared/practice-target.ts');
  const proof=report.saved.target;assert(validPracticeTargetReview(proof,questions));assert(!validPracticeTargetReview({...proof,answers:[proof.answers[0]]},questions));assert(!validPracticeTargetReview({...proof,answers:proof.answers.map(a=>({...a,answerText:'x=4'}))},questions));
  const unsupported={...questions[0],stem:'说明等价变形与抄写核对的关系。'};const result=await checkPracticeAnswers([unsupported],new AbortController().signal);assert.deepEqual(result,[{state:'not_applicable'}]);assert(validPracticeTargetReview({...proof,answers:result},[unsupported]));
  const row=db.prepare('SELECT payload_json FROM ai_confirmation_items WHERE id=?').get(saved.id),payload=JSON.parse(row.payload_json);payload.target.answers[0].answerText='x=4';db.prepare('UPDATE ai_confirmation_items SET payload_json=? WHERE id=?').run(JSON.stringify(payload),saved.id);await assert.rejects(practice.review(sessionId,saved.id),/unavailable/);db.prepare('UPDATE ai_confirmation_items SET payload_json=? WHERE id=?').run(row.payload_json,saved.id);
 });
 report.ok=true;
}catch(e){report.error=String(e.stack);process.exitCode=1;}finally{db.close();fs.writeFileSync(path.join(root,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({ok:report.ok,checks:report.checks.length,root,error:report.error}));}
