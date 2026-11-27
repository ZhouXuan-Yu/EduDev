import '../office-agent/register-source.mjs';
import {test} from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const {createPiMemoryScopeState} = await import('../../src/main/xiaozhi-agent/memory-scope-state.ts');
const {historyMemorySchema}=await import('../../src/main/xiaozhi-agent/history/schema.ts');

test('a confirmed class and term persist, old clients preserve them, and moving away and back requires confirmation', async () => {
  const db = new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE ai_conversation_folders(id TEXT PRIMARY KEY, name TEXT, archived_at TEXT);
      CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY, folder_id TEXT, student_id TEXT, archived_at TEXT);
      CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)`);
    db.exec(historyMemorySchema);
    const sql = {run:async (q,args=[])=>db.prepare(q).run(...args),
      all:async (q,args=[])=>db.prepare(q).all(...args),change:async (q,args=[])=>db.prepare(q).run(...args).changes,
      transaction:async work=>{
        db.exec('BEGIN');
        try{const value=await work(sql);db.exec('COMMIT');return value;}
        catch(error){db.exec('ROLLBACK');throw error;}
      }};
    const state = createPiMemoryScopeState(sql);
    await state.migrateMemoryScope();
    const folder = 'aifolder_'+randomUUID(), other = 'aifolder_'+randomUUID(), session = 'aisession_'+randomUUID();
    for (const id of [folder,other]) db.prepare('INSERT INTO ai_conversation_folders VALUES(?,?,NULL)').run(id,'初二物理');
    db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,?,NULL,NULL)').run(session,folder);
    const empty = {enabled:false,selections:[]};
    const target = {folderId:folder,term:'2026-fall'};
    assert.equal(await state.saveMemoryScope(session,0,empty,{...target,folderId:other}),false);
    assert.deepEqual(await state.memoryScope(session),{version:0,...empty});
    assert.equal(await state.saveMemoryScope(session,0,empty,target),true);
    assert.deepEqual((await createPiMemoryScopeState(sql).memoryScope(session)).teachingTarget,target);
    assert.equal(await state.saveMemoryScope(session,1,{enabled:true,selections:[]}),true);
    assert.deepEqual((await state.memoryScope(session)).teachingTarget,target);
    assert.equal(await state.saveMemoryScope(session,1,empty,null),false);
    for (const id of [other,folder]) db.prepare('UPDATE ai_conversation_sessions SET folder_id=? WHERE id=?').run(id,session);
    assert.deepEqual(await state.memoryScope(session),{version:3,...empty});
    assert.equal(await state.saveMemoryScope(session,2,empty,target),false);
    assert.equal(await state.saveMemoryScope(session,3,empty,target),true);
    db.prepare('UPDATE ai_conversation_sessions SET archived_at=? WHERE id=?').run('2026-11-26',session);
    assert.equal((await state.memoryScope(session)).teachingTarget,undefined);
    assert.equal(db.prepare('SELECT schema_version FROM xiaozhi_pi_memory_scopes').get().schema_version,3);
    assert.equal(await state.saveMemoryScope(session,5,empty,target),false);
    db.prepare('UPDATE ai_conversation_sessions SET archived_at=NULL WHERE id=?').run(session);
    assert.equal(await state.saveMemoryScope(session,5,empty,target),true);
    const {reconcileRestoredMemory}=await import('../../src/main/backup/memory-restore.ts');
    const result=await reconcileRestoredMemory(sql,new Set(['xiaozhi_pi_memory_scopes']),null);
    assert.equal(result.withheldScopes,1);
    assert.deepEqual(await state.memoryScope(session),{version:7,...empty});
  } finally { db.close(); }
});

test('only the owning Pi run can attest a reference received, with no body stored or duplicate rows',async()=>{
  const db=new DatabaseSync(':memory:');
  try {
    db.exec(`CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY);
      CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,sub_intent TEXT,created_at TEXT);
      CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)`);
    const session='aisession_'+randomUUID(),other='aisession_'+randomUUID(),run='run_'+randomUUID();
    db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?,?)').run(run,session,'pi_education','2026-11-26');
    const sql={run:async(q,args=[])=>db.prepare(q).run(...args),all:async(q,args=[])=>db.prepare(q).all(...args)};
    const state=createPiMemoryScopeState(sql);
    await state.migrateMemoryScope();
    const item={id:'a'.repeat(64),version:3,fingerprint:'b'.repeat(64),reason:'teaching_scope',estimatedTokens:112};
    await state.recordReferenceDelivery(other,run,4,[item]);
    assert.deepEqual(await state.latestReferenceDeliveries(other),[]);
    await state.recordReferenceDelivery(session,run,4,[item]);
    await state.recordReferenceDelivery(session,run,4,[item]);
    assert.deepEqual(await state.latestReferenceDeliveries(session),[{...item,runId:run,scopeVersion:4}]);
    await assert.rejects(state.recordReferenceDelivery(session,run,4,[{...item,text:'PRIVATE'}]),/invalid_input/);
    db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?,?)').run('run_'+randomUUID(),session,'pi_education','2026-11-27');
    assert.deepEqual(await state.latestReferenceDeliveries(session),[]);
  } finally {db.close();}
});

test('the source readback is a persistent run-bound observation independent of provider delivery',async()=>{
  const db=new DatabaseSync(':memory:');
  try{
    db.exec(`CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY);
      CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,sub_intent TEXT,created_at TEXT);
      CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)`);
    const session='aisession_'+randomUUID(),other='aisession_'+randomUUID(),run='run_'+randomUUID(),nextRun='run_'+randomUUID();
    for(const id of [run,nextRun])db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?,?)').run(id,session,'pi_education','2026-11-27');
    const sql={run:async(q,args=[])=>db.prepare(q).run(...args),all:async(q,args=[])=>db.prepare(q).all(...args)};
    const state=createPiMemoryScopeState(sql);
    await state.migrateMemoryScope();
    const item={id:'c'.repeat(64),version:2,fingerprint:'d'.repeat(64),reason:'task',estimatedTokens:70};
    await state.recordReferenceReadback(other,run,0,[item]);
    assert.deepEqual(await state.referenceReadbacksForRun(session,run),[]);
    await state.recordReferenceReadback(session,run,0,[item]);
    await state.recordReferenceReadback(session,run,0,[item]);
    assert.deepEqual(await createPiMemoryScopeState(sql).referenceReadbacksForRun(session,run),[{...item,scopeVersion:0}]);
    assert.deepEqual(await state.referenceReadbacksForRun(other,run),[]);
    assert.deepEqual(await state.referenceReadbacksForRun(session,nextRun),[]);
    assert.deepEqual(await state.referenceDeliveriesForRun(session,run),[]);
    await state.recordReferenceDelivery(session,run,0,[item]);
    assert.deepEqual(await state.referenceDeliveriesForRun(session,run),[{...item,runId:run,scopeVersion:0}]);
    assert.deepEqual(await state.referenceDeliveriesForRun(session,nextRun),[]);
    await assert.rejects(state.recordReferenceReadback(session,run,0,[{...item,text:'PRIVATE'}]),/invalid_input/);
    assert.equal(db.prepare('SELECT count(*) AS n FROM app_settings').get().n,1);
  }finally{db.close();}
});

test('a migrated database without the optional delivery table can observe and persist run receipts',async()=>{
  const db=new DatabaseSync(':memory:');
  try{
    db.exec(`CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY,session_id TEXT,sub_intent TEXT,created_at TEXT);
      CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT)`);
    const session='aisession_'+randomUUID(),other='aisession_'+randomUUID(),run='run_'+randomUUID(),next='run_'+randomUUID();
    db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?,?)').run(run,session,'pi_education','2026-11-26');
    const sql={run:async(q,args=[])=>db.prepare(q).run(...args),all:async(q,args=[])=>db.prepare(q).all(...args)};
    const state=createPiMemoryScopeState(sql);
    const item={id:'e'.repeat(64),version:3,fingerprint:'f'.repeat(64),reason:'teaching_scope',estimatedTokens:112};
    assert.deepEqual(await state.latestReferenceDeliveries(session),[]);
    await state.recordReferenceDelivery(other,run,4,[item]);
    assert.deepEqual(await state.referenceDeliveriesForRun(session,run),[]);
    await state.recordReferenceDelivery(session,run,4,[item]);
    await state.recordReferenceDelivery(session,run,4,[item]);
    assert.deepEqual(await createPiMemoryScopeState(sql).referenceDeliveriesForRun(session,run),[{...item,scopeVersion:4,runId:run}]);
    assert.deepEqual(await state.latestReferenceDeliveries(session),[{...item,scopeVersion:4,runId:run}]);
    db.prepare('INSERT INTO ai_agent_runs VALUES(?,?,?,?)').run(next,session,'pi_education','2026-11-27');
    assert.deepEqual(await state.latestReferenceDeliveries(session),[]);
    assert.equal(db.prepare("SELECT COUNT(*) AS n FROM sqlite_schema WHERE name='xiaozhi_memory_reference_deliveries'").get().n,0);
  }finally{db.close();}
});

test('only the outgoing current user content can confirm inclusion',async()=>{
  const {carriesReferenceProjection}=await import('../../src/main/xiaozhi-agent/memory-use/receipts.ts');
  const marker='引用 '+randomUUID();
  assert(carriesReferenceProjection({messages:[{role:'user',content:[{type:'text',text:'本轮'+marker}]}]},marker));
  assert(!carriesReferenceProjection({messages:[{role:'user',content:marker},{role:'user',content:'另一个问题'}]},marker));
  assert(!carriesReferenceProjection({messages:[{role:'assistant',content:marker}]},marker));
});
