import '../office-agent/register-source.mjs';
import fs from 'node:fs';import path from 'node:path';import assert from 'node:assert/strict';import {randomUUID,createHash} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
const {QuestionReviewRepository}=await import('../../src/main/education/question-review-repository.ts');
const {questionVersion}=await import('../../src/main/education/question-context-provider.ts');
const {QUESTION_CONTEXT_SCHEMA}=await import('../../src/shared/question-context.ts');
const {QUESTION_REVIEW_SCHEMA}=await import('../../src/shared/question-review.ts');
const {createEducationReadback}=await import('../../src/main/xiaozhi-agent/verification/education-readback.ts');
const {createRunResultReadback}=await import('../../src/main/xiaozhi-agent/verification/result-readback.ts');
const {legacyVerification,validTaskVerification}=await import('../../src/shared/xiaozhi-verification.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-education-readback-')),checks=[],opened=[];
const report={success:false,checks,boundary:'Actual SQLite and existing domain teacher review/decision; no provider, daily UI or whole teaching correctness claim'};
const sid='aisession_'+randomUUID(),rid='airun_'+randomUUID(),callId=randomUUID(),base={...legacyVerification(rid),operations:{succeeded:1,failed:0}};
const parent={id:'question_'+randomUUID(),subject:'数学',grade:'初二',knowledgePoint:'勾股',questionType:'short_answer',difficulty:'medium',stem:'直角边为3和4，求斜边。',answer:'5',analysis:'勾股定理',sourceTitle:'教师原题',sourceKind:'local_bank',tags:[],createdAt:'2026-10-01',updatedAt:'2026-10-01'};
const draft={title:'勾股变式',reason:'复用教师原题',subject:'数学',grade:'初二',knowledgePoint:'勾股',items:[{questionType:'short_answer',stem:'直角边为5和12，求斜边。',answer:'13',analysis:'5²+12²=169，取正数13。',options:null,difficulty:'medium'}]};
const edited={...draft,title:'教师最终题',items:[{...draft.items[0],answer:'13厘米',analysis:'教师最终解析：斜边为13厘米。',difficulty:'easy'}]};
const file=path.join(output,'approved.db');
function open(file){const db=new DatabaseSync(file);opened.push(db);let current=true,invalid=false,writes=0;
 const sql={all:async(q,p=[])=>db.prepare(q).all(...p),run:async(q,p=[])=>{writes++;db.prepare(q).run(...p);},read:async id=>{const r=db.prepare('SELECT body FROM questions WHERE id=?').get(id);return r?JSON.parse(r.body):undefined;},validate:async()=>{if(invalid)throw Error('source_changed');},create:async input=>{writes++;const q={...input,id:'question_'+randomUUID(),tags:input.tags||[],createdAt:'2026-10-14',updatedAt:'2026-10-14'};db.prepare('INSERT INTO questions VALUES (?,?)').run(q.id,JSON.stringify(q));return q;}};
 const repo=new QuestionReviewRepository({...sql,transaction:async action=>{db.exec('BEGIN IMMEDIATE');try{const v=await action(sql);db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}});
 const bind=createEducationReadback({sessionId:sid,runId:rid,current:()=>current,questions:repo});
 return{db,file,sql,repo,bind,writes:()=>writes,setCurrent:v=>current=v,setInvalid:v=>invalid=v};
}
let rowId,savedId;
const payload={success:true,state:'confirmed',count:1,generationKind:'variation',title:'教师最终题'};
const content=[{type:'text',text:JSON.stringify(payload)}],native=async()=>[{toolCallId:callId,toolName:'education_propose_questions',content}];
// Select an explicit new path rather than depending on directory iteration order.
function clone(){const target=path.join(output,'fixture-'+randomUUID()+'.db');fs.copyFileSync(file,target);return open(target);}
const reader=e=>createRunResultReadback({runId:rid,bindEffect:e.bind,readLocal:async()=>[],verifyImage:async()=>false});
async function captured(e){const bound=await e.bind(callId,'education_propose_questions',payload),r=createRunResultReadback({runId:rid,bindEffect:async()=>bound,readLocal:async()=>[],verifyImage:async()=>false});r.capture(callId,'education_propose_questions',{content},false);return r;}
const check=async(name,fn)=>{await fn();checks.push({name,pass:true});console.log('PASS '+name);};
const update=(e,id,patch)=>{const q=JSON.parse(e.db.prepare('SELECT body FROM questions WHERE id=?').get(id).body);e.db.prepare('UPDATE questions SET body=? WHERE id=?').run(JSON.stringify({...q,...patch}),id);};
const receipt=(e,patch)=>{const row=e.db.prepare('SELECT * FROM ai_confirmation_items WHERE id=?').get(rowId);e.db.prepare('UPDATE ai_confirmation_items SET result_json=? WHERE id=?').run(JSON.stringify({...JSON.parse(row.result_json),...patch}),rowId);};
try{
 const seed=open(file);seed.db.exec(`CREATE TABLE students(id TEXT PRIMARY KEY,status TEXT);CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,student_id TEXT,archived_at TEXT);CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,student_id TEXT);CREATE TABLE questions(id TEXT PRIMARY KEY,body TEXT);CREATE TABLE ai_confirmation_items(id TEXT PRIMARY KEY,run_id TEXT,session_id TEXT,student_id TEXT,action_type TEXT,status TEXT,title TEXT,payload_json TEXT,result_json TEXT DEFAULT '{}',created_at TEXT,updated_at TEXT,confirmed_at TEXT,rejected_at TEXT);`);
 seed.db.prepare("INSERT INTO ai_conversation_sessions VALUES(?,'',NULL)").run(sid);seed.db.prepare("INSERT INTO ai_agent_runs VALUES(?,?,'')").run(rid,sid);seed.db.prepare('INSERT INTO questions VALUES(?,?)').run(parent.id,JSON.stringify(parent));
 const proposed=await seed.repo.propose(sid,rid,callId,draft,[{schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:parent.id,version:questionVersion(parent)}],()=>true);rowId=proposed.id;
 await check('Pending teacher proposal cannot satisfy a forged confirmed native receipt',async()=>{await assert.rejects(seed.bind(callId,'education_propose_questions',payload));});
 const reviewed=await seed.repo.review(sid,rowId,edited);await seed.repo.decide({schemaVersion:QUESTION_REVIEW_SCHEMA,sessionId:sid,id:rowId,action:'confirm',draft:edited,qualityConfirmation:{revisionHash:reviewed.quality.revisionHash,reviewed:true}},()=>true);
 savedId=JSON.parse(seed.db.prepare('SELECT result_json FROM ai_confirmation_items WHERE id=?').get(rowId).result_json).saved[0].questionId;seed.db.close();opened.splice(opened.indexOf(seed.db),1);
 await check('Teacher final edited version binds exact call, current fact and persisted quality without writes or Worker replay',async()=>{const e=clone(),before=e.writes(),r=await captured(e),v=await r.finish(base,native);assert(validTaskVerification(v,rid));assert.equal(v.checks.find(c=>c.id==='saved_questions:'+callId).state,'passed');assert.equal(v.state,'needs_human');assert.equal(v.checks.find(c=>c.id==='answer:human').state,'needs_human');assert.equal(e.writes(),before);assert.equal((await e.sql.read(savedId)).answer,'13厘米');assert(!JSON.stringify(v).includes('教师最终解析'));});
 const mutations=[
  ['Saved answer changed',e=>update(e,savedId,{answer:'wrong'})],['Saved analysis changed',e=>update(e,savedId,{analysis:'wrong'})],['Saved question deleted',e=>e.db.prepare('DELETE FROM questions WHERE id=?').run(savedId)],
  ['Parent version changed',e=>update(e,parent.id,{answer:'changed'})],['Parent deleted',e=>e.db.prepare('DELETE FROM questions WHERE id=?').run(parent.id)],
  ['Session archived',e=>e.db.prepare('UPDATE ai_conversation_sessions SET archived_at=?').run('2026-10-14')],['Session deleted',e=>e.db.exec('DELETE FROM ai_conversation_sessions')],['Run deleted',e=>e.db.exec('DELETE FROM ai_agent_runs')],['Run moved to another session',e=>e.db.prepare('UPDATE ai_agent_runs SET session_id=?').run('foreign')],['Student binding changed',e=>{e.db.prepare("INSERT INTO students VALUES('foreign','active')").run();e.db.prepare("UPDATE ai_conversation_sessions SET student_id='foreign'").run();}],
  ['Approval rejected',e=>e.db.prepare("UPDATE ai_confirmation_items SET status='rejected'").run()],['Approval reverted pending',e=>e.db.prepare("UPDATE ai_confirmation_items SET status='pending'").run()],['Confirmation timestamp absent',e=>e.db.prepare('UPDATE ai_confirmation_items SET confirmed_at=NULL').run()],['Confirmation moved to other run',e=>e.db.prepare("UPDATE ai_confirmation_items SET run_id='foreign'").run()],
  ['Teacher quality review withdrawn',e=>receipt(e,{teacherReviewed:false})],['Quality evidence missing',e=>receipt(e,{quality:undefined})],['Approval digest corrupt',e=>receipt(e,{digest:'0'.repeat(64)})],['Saved references corrupt',e=>receipt(e,{saved:[]})],['Source authority validator rejects',e=>e.setInvalid(true)],['Active owner stopped',e=>e.setCurrent(false)],
 ];
 for(const[name,mutate]of mutations)await check(name+' never upgrades to passed',async()=>{const e=clone(),r=await captured(e);mutate(e);const v=await r.finish(base,native);assert.equal(v.state,'partial');assert.equal(v.checks.find(c=>c.id==='saved_questions:'+callId).state,'unknown');});
 await check('Foreign call and count/generation/tool receipt cannot bind another approval',async()=>{const e=clone();await assert.rejects(e.bind('foreign','education_propose_questions',payload));for(const patch of[{count:2},{generationKind:'ai_original'},{state:'rejected'}])await assert.rejects(e.bind(callId,'education_propose_questions',{...payload,...patch}));await assert.rejects(e.bind(callId,'office_create_text',payload));});
 await check('Duplicate database call receipt is ambiguous and cannot pass',async()=>{const e=clone();e.db.prepare('INSERT INTO ai_confirmation_items SELECT ?,run_id,session_id,student_id,action_type,status,title,payload_json,result_json,created_at,updated_at,confirmed_at,rejected_at FROM ai_confirmation_items WHERE id=?').run('xiquestion_'+randomUUID(),rowId);await assert.rejects(e.bind(callId,'education_propose_questions',payload));});
 await check('Different native call cannot satisfy a valid database proof',async()=>{const e=clone(),r=await captured(e),v=await r.finish(base,async()=>[{toolCallId:'foreign',toolName:'education_propose_questions',content}]);assert.equal(v.state,'partial');});
 await check('Missing database adapter remains unknown even with success native result',async()=>{const r=createRunResultReadback({runId:rid,readLocal:async()=>[],verifyImage:async()=>false});r.capture(callId,'education_propose_questions',{content},false);assert.equal((await r.finish(base,native)).state,'partial');});
 await check('Failed native operation cannot be upgraded by confirmed database fact',async()=>{const e=clone(),r=reader(e);r.capture(callId,'education_propose_questions',{content},true);const failed={...base,state:'partial',operations:{succeeded:0,failed:1}};assert.equal((await r.finish(failed,native)).state,'partial');});
 await check('Internally recomputed receipt cannot hide a saved fact which differs from the teacher final draft',async()=>{
  const e=clone(),hash=v=>createHash('sha256').update(JSON.stringify(v)).digest('hex');update(e,savedId,{answer:'wrong'});
  const row=e.db.prepare('SELECT * FROM ai_confirmation_items WHERE id=?').get(rowId),p=JSON.parse(row.payload_json),effect=JSON.parse(row.result_json),q=await e.sql.read(savedId);effect.saved[0].version=questionVersion(q);
  effect.digest=hash({id:row.id,sessionId:row.session_id,studentId:p.studentId,proposalSha256:hash(p),parents:p.sources.map(q=>({schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:q.id,version:questionVersion(q)})),draft:effect.draft,saved:effect.saved,quality:effect.quality,teacherReviewed:effect.teacherReviewed,qualityHistory:effect.qualityHistory});
  e.db.prepare('UPDATE ai_confirmation_items SET result_json=? WHERE id=?').run(JSON.stringify(effect),rowId);await assert.rejects(e.bind(callId,'education_propose_questions',payload),/source_changed/);
 });
 await check('Cold database readback is identical and read-only',async()=>{const e=clone(),first=await e.repo.verificationSnapshot(sid,rid,callId);e.db.close();opened.splice(opened.indexOf(e.db),1);const fresh=open(e.file);assert.deepEqual(await fresh.repo.verificationSnapshot(sid,rid,callId),first);assert.equal(fresh.writes(),0);});
 report.success=true;
}catch(error){report.error=String(error);console.error(error);process.exitCode=1;}finally{for(const db of opened)try{db.close();}catch{}fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(output);}
