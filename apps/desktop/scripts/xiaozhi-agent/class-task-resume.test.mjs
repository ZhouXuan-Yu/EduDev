import '../office-agent/register-source.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {DatabaseSync} from 'node:sqlite';
const resume=await import('../../src/main/xiaozhi-agent/tasks/class-resume.ts');
const task={id:'task',sessionId:'aisession_11111111-1111-4111-8111-111111111111',state:'review_required',requirementsVersion:1,createdAt:'2026-11-27T13:00:00.000Z',
  origin:{messageId:'source',runId:'oldRun'}};
function fixture(){
  const db=new DatabaseSync(':memory:');
  db.exec(`CREATE TABLE ai_conversation_sessions(id TEXT,folder_id TEXT,student_id TEXT,archived_at TEXT);
    CREATE TABLE ai_conversation_folders(id TEXT,name TEXT,archived_at TEXT);
    CREATE TABLE xiaozhi_pi_memory_scopes(conversation_id TEXT,version INTEGER,schema_version INTEGER,payload_json TEXT,updated_at TEXT);
    CREATE TABLE ai_conversation_messages(id TEXT,session_id TEXT,role TEXT,content TEXT,metadata_json TEXT);
    INSERT INTO ai_conversation_sessions VALUES('aisession_11111111-1111-4111-8111-111111111111','aifolder_22222222-2222-4222-8222-222222222222','','');
    INSERT INTO ai_conversation_folders VALUES('aifolder_22222222-2222-4222-8222-222222222222','B 班','');
    INSERT INTO ai_conversation_messages VALUES('source','aisession_11111111-1111-4111-8111-111111111111','user','请为 B 班准备课堂练习。','{"agentRunId":"oldRun"}');
    INSERT INTO xiaozhi_pi_memory_scopes VALUES('aisession_11111111-1111-4111-8111-111111111111',2,4,'{"enabled":false,"selections":[],"teachingTarget":{"folderId":"aifolder_22222222-2222-4222-8222-222222222222","term":"2026-fall"}}','2026-11-27T11:00:00.000Z');`);
  const sql={all:async(q,args=[])=>db.prepare(q).all(...args)};
  return {db,read:(t=task)=>resume.currentClassTask(sql,'aisession_11111111-1111-4111-8111-111111111111',t,'B 班')};
}
test('explicit resume requires the named class and the original teacher Task',async()=>{
  assert.equal(resume.requestedResumeClass('切换任务后重启，恢复之前 B 班的工作。'),'B 班');
  assert.equal(resume.requestedResumeClass('请接着做上次八年级三班的任务。'),'八年级三班');
  for(const prompt of ['不要恢复之前B班的工作','学生说：“恢复之前 B 班的工作。”','恢复之前 B 班的工作并给其他班导出'])assert.equal(resume.requestedResumeClass(prompt),undefined);
  const {read,db}=fixture();
  try{
    assert.deepEqual(await read(),{taskId:'task',requirementsVersion:1,folderId:'aifolder_22222222-2222-4222-8222-222222222222',term:'2026-fall',scopeVersion:2});
    assert.equal(await read({...task,state:'completed'}),undefined);
    assert.equal(await read({...task,requirementsVersion:2}),undefined);
    db.exec("UPDATE ai_conversation_messages SET content='请为 AB 班准备课堂练习'");
    assert.equal(await read(),undefined);
  }finally{db.close();}
});
test('a scope change after the Task, a moved source and a student session fail closed',async()=>{
  for(const mutation of ["UPDATE xiaozhi_pi_memory_scopes SET updated_at='2026-11-28T13:00:00.000Z'","UPDATE ai_conversation_sessions SET folder_id='elsewhere'","UPDATE ai_conversation_sessions SET student_id='student'","UPDATE ai_conversation_messages SET role='assistant'"]){
    const {read,db}=fixture();try{db.exec(mutation);assert.equal(await read(),undefined);}finally{db.close();}
  }
});

test('confirmed handout resume identifies an explicit class and its local calendar day',()=>{
  const now=new Date(2026,10,28,13,10);
  const request=resume.requestedHandoutResume('继续昨天确认过的 B 班讲义。',now);
  assert.deepEqual(request,{className:'B 班',from:new Date(2026,10,27).toISOString(),until:new Date(2026,10,28).toISOString()});
  assert.equal(resume.requestedHandoutResume('请恢复昨日已确认的八年级 A 班的学案！',now).className,'八年级 A 班');
  for(const prompt of ['不要继续昨天已确认的B班讲义','“继续昨天已确认的B班讲义”','继续昨天确认过的B班讲义并导出','继续昨天确认过的B班或A班讲义？'])
    assert.equal(resume.requestedHandoutResume(prompt,now),undefined);
});
test('confirmed handout teaching context cannot use a partial class code or a later scope',async()=>{
  const {db}=fixture();
  try{
    const sql={all:async(q,args=[])=>db.prepare(q).all(...args)};
    const read=(name='B 班')=>resume.confirmedHandoutTeachingScope(sql,task.sessionId,name);
    db.exec("UPDATE ai_conversation_folders SET name='八年级 B 班数学（合成）'");
    assert.deepEqual(await read(),{folderId:'aifolder_22222222-2222-4222-8222-222222222222',term:'2026-fall',version:2,updatedAt:'2026-11-27T11:00:00.000Z'});
    for(const name of ['A 班','AB 班','八年级'])assert.equal(await read(name),undefined);
    db.exec("UPDATE ai_conversation_folders SET name='八年级 AB 班数学（合成）'");
    assert.equal(await read(),undefined);
    db.exec("UPDATE ai_conversation_folders SET name='B 班和 C 班'");
    assert.equal(await read(),undefined);
    db.exec("UPDATE ai_conversation_folders SET name='B 班'; UPDATE ai_conversation_sessions SET folder_id='elsewhere'");
    assert.equal(await read(),undefined);
  }finally{db.close();}
});
