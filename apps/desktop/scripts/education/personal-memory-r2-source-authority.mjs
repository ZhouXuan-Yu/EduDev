import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';
import { DatabaseSync } from 'node:sqlite';

const { historyMemorySchema }=await import('../../src/main/xiaozhi-agent/history/schema.ts');
const { createHistoryState, historyId }=await import('../../src/main/xiaozhi-agent/history/state.ts');
const { readHistorySource }=await import('../../src/main/xiaozhi-agent/history/source.ts');
const { createPiControlState }=await import('../../src/main/xiaozhi-agent/control-state.ts');
const { teacherRequestSourceVersion }=await import('../../src/main/xiaozhi-agent/request-sources.ts');
const { createPersonalMemorySourceAuthority, personalMemoryExtractSchema }=await import('../../src/main/education/personal-memory/source-authority.ts');
const { createPersonalMemoryCandidateState, personalMemoryCandidateSchema }=await import('../../src/main/education/personal-memory/candidate-state.ts');
const { preparePersonalMemoryExtraction, bindPersonalMemoryProposals }=await import('../../src/main/education/personal-memory/candidate-admission.ts');

const db=new DatabaseSync(':memory:');
db.exec(`PRAGMA foreign_keys=ON;
  CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,title TEXT,student_id TEXT,archived_at TEXT);
  CREATE TABLE ai_conversation_messages(id TEXT PRIMARY KEY,session_id TEXT,role TEXT,content TEXT,metadata_json TEXT,created_at TEXT);`);
db.exec(historyMemorySchema);
db.exec(personalMemoryCandidateSchema);
db.exec(personalMemoryExtractSchema);
db.exec('CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)');
const sql={
  run:async(q,v=[])=>db.prepare(q).run(...v),
  all:async(q,v=[])=>db.prepare(q).all(...v),
  change:async(q,v=[])=>Number(db.prepare(q).run(...v).changes),
  transaction:async fn=>{
    db.exec('BEGIN IMMEDIATE');
    try{const value=await fn(sql);db.exec('COMMIT');return value;}
    catch(error){db.exec('ROLLBACK');throw error;}
  },
};
const history=createHistoryState(sql);
const controls=createPiControlState(sql);
await controls.migrateControls();
const authority=createPersonalMemorySourceAuthority(sql,async text=>text.replace(/synthetic@example\.test/g,'[邮箱]'));
const state=createPersonalMemoryCandidateState(sql,authority.witnessCurrent);
const policy=await state.setEnabled(true,0);
const session='aisession_'+randomUUID();
const run='run_'+randomUUID();
const scope={scope:{kind:'course',id:'science-4'},term:'unknown'};
db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,?,?,?)').run(session,'合成教学对话',null,null);
function message(id,text,role='user',sessionId=session){
  db.prepare('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?,?)')
    .run(id,sessionId,role,text,JSON.stringify({piVersion:'xiaozhi.pi.education.v1',agentRunId:run}),'2026-11-25');
  return {kind:'history_request',sessionId,recordId:id,sourceVersion:teacherRequestSourceVersion(id,run,text)};
}
function draft(source){
  const manifest=preparePersonalMemoryExtraction([source],policy);
  const data={kind:'teaching_context',source_id:source.id,source_version:source.generation,scope_id:source.scope.id,
    valid_term:source.term,supporting_quote:source.sanitizedText,value:source.sanitizedText,supersedes:null};
  return bindPersonalMemoryProposals([data],manifest,[source],policy).candidates[0];
}

const indexed=message('indexed','索引许可测试。');
await history.change(indexed,0,'allow');
assert.deepEqual(await authority.snapshot([historyId(indexed)],policy),[]);
console.log('PASS index and discovery permission do not confer candidate extraction');

const text='我教四年级科学。联系邮箱 synthetic@example.test。';
const ref=message('teachersource',text);
const allowed=await authority.change(ref,0,scope);
assert.equal(allowed.allowed,true);
const r1=await history.get(historyId(ref));
assert.equal(r1.allowed,false);
assert.deepEqual((await history.permitted()).map(row=>row.sourceId),[historyId(indexed)]);
assert.equal((await sql.all('SELECT COUNT(*) AS total FROM memory_index_jobs')).at(0).total,1);
assert.deepEqual((await authority.snapshot([historyId(ref)],policy)).map(row=>row.sanitizedText),['我教四年级科学。联系邮箱 [邮箱]。']);
console.log('PASS extraction-only consent uses the canonical R1 identity without indexing or disclosing the raw email');

const question={sessionId:session,id:'question1',runId:run,kind:'question',state:'answered',
  text:'这个班之前为什么更换课本？教师回答：这里是助理提问中的字样',answer:'我这学期教四年级。'};
await controls.putControl(question);
const combined=`问题：${question.text}\n教师回答：${question.answer}`;
const answer={kind:'history_control',sessionId:session,recordId:question.id,sourceVersion:teacherRequestSourceVersion(question.id,run,combined)};
assert.equal((await readHistorySource(sql,answer)).text,combined);
await authority.change(answer,0,scope);
assert.deepEqual((await authority.snapshot([historyId(answer)],policy)).map(row=>row.sanitizedText),[question.answer]);
console.log('PASS the R1 preview stays intact and candidate extraction receives only the actual teacher answer');

const assistant=message('notteacher','模型推断不要发出。','assistant');
const unknown=message('unknownrole','旧角色不能当教师。','legacy');
await assert.rejects(authority.change(assistant,0,scope),/source_unavailable/);
await assert.rejects(authority.change(unknown,0,scope),/source_unavailable/);
const sensitive=message('credentials','Authorization: Bearer synthetic-only-test');
await assert.rejects(authority.change(sensitive,0,scope),/permission_denied/);
db.prepare('UPDATE ai_conversation_sessions SET student_id=? WHERE id=?').run('synthetic-student',session);
assert.deepEqual(await authority.snapshot([historyId(ref),historyId(answer)],policy),[]);
db.prepare('UPDATE ai_conversation_sessions SET student_id=NULL WHERE id=?').run(session);
console.log('PASS invalid actor, student-bound conversation and credential text are blocked');

const admitted=draft((await authority.snapshot([historyId(ref)],policy))[0]);
assert.deepEqual((await state.savePending([admitted],policy)).saved,[admitted.key]);
await assert.rejects(authority.change(ref,0,null),/revision_conflict/);
await authority.change(ref,allowed.revision,null);
assert.equal((await state.list(10))[0].state,'stale');
assert.deepEqual((await state.savePending([admitted],policy)).stale,[admitted.key]);
console.log('PASS consent withdrawal atomically invalidates pending drafts and fences a late worker');

await authority.change(ref,2,scope);
const beforeEdit=draft((await authority.snapshot([historyId(ref)],policy))[0]);
db.prepare('UPDATE ai_conversation_messages SET content=? WHERE id=?').run('我教五年级科学。',ref.recordId);
assert.deepEqual(await authority.snapshot([historyId(ref)],policy),[]);
assert.deepEqual((await state.savePending([beforeEdit],policy)).stale,[beforeEdit.key]);
const newer={...ref,sourceVersion:teacherRequestSourceVersion(ref.recordId,run,'我教五年级科学。')};
await authority.change(newer,3,scope);
assert.equal((await authority.snapshot([historyId(ref)],policy))[0].sanitizedText,'我教五年级科学。');
assert.equal((await history.get(historyId(ref))).allowed,false);
console.log('PASS edit invalidates the prior version and explicit consent can cover the changed version');

const newerDraft=draft((await authority.snapshot([historyId(ref)],policy))[0]);
assert.deepEqual((await state.savePending([newerDraft],policy)).saved,[newerDraft.key]);
await history.change(ref,1,'forget');
assert.deepEqual(await authority.snapshot([historyId(ref)],policy),[]);
assert.equal((await state.list(10)).find(row=>row.draft.key===newerDraft.key).state,'stale');
assert.deepEqual((await state.savePending([newerDraft],policy)).stale,[newerDraft.key]);
await assert.rejects(authority.change(newer,5,scope),/permission_denied/);
console.log('PASS R1 forgetting invalidates R2 extraction without crossing into index or scope grants');
db.close();
console.log(JSON.stringify({passed:7}));
