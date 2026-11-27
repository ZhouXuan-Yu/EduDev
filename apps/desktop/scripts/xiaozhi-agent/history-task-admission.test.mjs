import '../office-agent/register-source.mjs';
import {randomUUID} from 'node:crypto';
import {test} from 'node:test';
import assert from 'node:assert/strict';
const {validXiaozhiStart}=await import('../../src/shared/xiaozhi-start.ts');

const request=()=>({sessionId:'aisession_'+randomUUID(),commandId:'xicmd_'+randomUUID(),prompt:'继续制作讲义。'});
test('REQ-27 accepts opaque pending history in the real admission contract',()=>{
  const input={...request(),historyIntents:[randomUUID()]};
  assert.equal(validXiaozhiStart(input),true);
});
test('REQ-30 rejects duplicate, malformed and over-limit pending history',()=>{
  const key=randomUUID();
  for(const historyIntents of [[key,key],['forged'],Array.from({length:13},()=>randomUUID()),[]]){
    assert.equal(validXiaozhiStart({...request(),historyIntents}),false);
  }
  assert.equal(validXiaozhiStart(request()),true);
});


import {DatabaseSync} from 'node:sqlite';
const {historyMemorySchema}=await import('../../src/main/xiaozhi-agent/history/schema.ts');
const {createHistoryState,historyHash}=await import('../../src/main/xiaozhi-agent/history/state.ts');
const {createPiMemoryScopeState}=await import('../../src/main/xiaozhi-agent/memory-scope-state.ts');
const {combinedMemorySelections,createTaskHistoryUse,requestDeclinesHistory}=await import('../../src/main/xiaozhi-agent/memory-use/history-binding.ts');
const {createPiMemoryScope}=await import('../../src/main/xiaozhi-agent/memory-scope.ts');
const {createPiMemoryTools}=await import('../../src/main/xiaozhi-agent/memory-tools.ts');

const {invalidateTaskHistoryForSession}=await import('../../src/main/xiaozhi-agent/history/invalidate-task-history.ts');

async function fixture(t){
  const db=new DatabaseSync(':memory:');
  t.after(()=>db.close());
  db.exec('CREATE TABLE ai_conversation_folders(id TEXT PRIMARY KEY,archived_at TEXT);'+
    'CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,folder_id TEXT,student_id TEXT,archived_at TEXT);'+
    'CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT);');
  const sql={
    run:async(query,args=[])=>db.prepare(query).run(...args),
    all:async(query,args=[])=>db.prepare(query).all(...args),
    change:async(query,args=[])=>db.prepare(query).run(...args).changes,
    transaction:async work=>{
      db.exec('BEGIN');
      try{const value=await work(sql);db.exec('COMMIT');return value;}
      catch(error){db.exec('ROLLBACK');throw error;}
    },
  };
  db.exec(historyMemorySchema);
  const target=request().sessionId, source=request().sessionId;
  const a='aifolder_'+randomUUID(), b='aifolder_'+randomUUID();
  for(const id of [a,b])await sql.run('INSERT INTO ai_conversation_folders(id) VALUES(?)',[id]);
  for(const id of [target,source])await sql.run('INSERT INTO ai_conversation_sessions(id) VALUES(?)',[id]);
  const state=createPiMemoryScopeState(sql);
  await state.migrateMemoryScope();
  const sortKey=()=>historyHash(randomUUID());
  const access=createHistoryState(sql),ref={kind:'history_request',sessionId:source,recordId:'message_1',sourceVersion:sortKey()};
  const sourceGrant=await access.change(ref,0,'allow');
  const pin={layer:'history',source:'history',id:sourceGrant.sourceId,version:1,sourceVersion:ref.sourceVersion};
  const text='春秋🌱'.repeat(611)+'只有末尾有这个验证标记';
  const original={text,fingerprint:historyHash(text),label:'教师原话',title:'合成教研记录'};
  const history={
    candidate:(sessionId,version,ticket)=>sessionId===target&&version===0&&ticket==='signed-ticket'?pin:undefined,
    selected:async value=>{
      const row=await access.get(value.id);
      if(!row?.allowed||row.generation!==value.version||row.ref.sourceVersion!==value.sourceVersion)throw Error('source_changed');
      return original;
    }
  };
  history.selectedFor=(_id,pin)=>history.selected(pin);
  const binding=createTaskHistoryUse(sql,history);
  const grants=()=>sql.all("SELECT value_json FROM app_settings WHERE key GLOB 'xiaozhi.memory-use.task.v1:*'");
  const owner={sessionId:target,runId:'run_'+randomUUID(),generation:1};
  const task={id:'xitask_'+sortKey(),sessionId:target,state:'active',requirementsVersion:1,binding:owner};
  return {sql,access,state,ref,pin,text,original,history,binding,task,owner,target,source,a,b,grants,sortKey};
}

test('Task rollback, Run ownership, restart, resume and confirmed scope removal',async t=>{
  const f=await fixture(t);
  const {sql,binding,task,owner,target,grants}=f;
  const {token}=await binding.stage(target,0,'signed-ticket');
  assert.equal((await grants()).length,0);
  await assert.rejects(binding.prepare(f.source,[token]),/memory_scope_changed/);
  const proof=await binding.prepare(target,[token]);
  await assert.rejects(sql.transaction(async work=>{
    await binding.attachTask(work,task,owner,proof);
    throw Error('failed checkpoint');
  }),/failed checkpoint/);
  assert.equal((await grants()).length,0);
  await sql.transaction(work=>binding.attachTask(work,task,owner,proof));
  binding.consume([token]);
  await assert.rejects(binding.prepare(target,[token]),/memory_scope_changed/);
  const restarted=createTaskHistoryUse(sql,f.history);
  const resumed={...owner,runId:'run_'+randomUUID(),generation:2};
  assert.equal(await restarted.forRun(task,resumed),undefined);
  assert.equal(await restarted.forRun({...task,state:'paused'},owner),undefined);
  assert.equal(await restarted.forTask({...task,state:'ended'}),undefined);
  assert.equal(await restarted.forTask({...task,state:'completed'}),undefined);
  assert.equal((await restarted.forTask({...task,state:'review_required'})).selections[0].id,f.pin.id);
  const next={...task,binding:resumed,requirementsVersion:2};
  assert.equal((await restarted.forRun(next,resumed)).selections[0].id,f.pin.id);
  assert.equal(await restarted.remove(next,{sessionId:target,taskId:task.id,revision:2,sourceId:f.pin.id}),false);
  assert.equal(await restarted.remove(next,{sessionId:target,taskId:task.id,revision:1,sourceId:f.pin.id}),true);
  assert.equal(await restarted.forRun(next,resumed),undefined);
  assert.equal((await f.access.get(f.pin.id)).allowed,true);
  assert.equal((await f.state.memoryScope(target)).version,0);
});

test('Task and Turn fail closed after revocation, restoration and classroom departure',async t=>{
  const f=await fixture(t),{sql,binding,task,owner,target,ref,access,a,b}=f;
  const {token}=await binding.stage(target,0,'signed-ticket');
  const proof=await binding.prepare(target,[token]);
  const turn=await binding.turn(owner.runId,target,proof);
  await sql.transaction(work=>binding.attachTask(work,task,owner,proof));
  assert.equal((await binding.eligibleTurn(turn,target)).selections.length,1);
  await sql.run('UPDATE ai_conversation_sessions SET folder_id=? WHERE id=?',[b,f.source]);
  assert.equal(await binding.forRun(task,owner),undefined);
  await assert.rejects(binding.stage(target,0,'signed-ticket'),/permission_denied/);
  await sql.run('UPDATE ai_conversation_sessions SET folder_id=NULL WHERE id=?',[f.source]);
  for(const folder of [a,null])await sql.transaction(async work=>{
    await work.run('UPDATE ai_conversation_sessions SET folder_id=? WHERE id=?',[folder,target]);
    await invalidateTaskHistoryForSession(work,target);
  });
  assert.equal(await binding.forRun(task,owner),undefined);
  await access.change(ref,1,'forget');
  await assert.rejects(binding.prepare(target,[token]),/memory_scope_changed/);
  await assert.rejects(sql.transaction(work=>binding.attachTask(work,task,owner,proof)),/memory_scope_changed/);
  assert.equal(await binding.eligibleTurn(turn,target),undefined);
  await access.change(ref,2,'restore');
  assert.equal(await binding.eligibleTurn(turn,target),undefined);
  assert.equal(await binding.forRun(task,owner),undefined);
});

test('Combined explicit scope deduplicates references and rejects thirteen without modifying the input',async t=>{
  const f=await fixture(t);
  const first={...f.pin,fingerprint:f.original.fingerprint};
  const pins=Array.from({length:14},()=>({...first,id:f.sortKey()}));
  const session=[first,...pins.slice(0,9)];
  assert.equal(combinedMemorySelections(session,[first,...pins.slice(8,11)]).length,12);
  assert.throws(()=>combinedMemorySelections(session,[first,...pins.slice(8,12)]),/memory_scope_changed/);
  assert.equal(session.length,10);
});

test('Long source reads require the active version and return all authoritative pages in order',async t=>{
  const f=await fixture(t);
  const {token}=await f.binding.stage(f.target,0,'signed-ticket');
  const proof=await f.binding.prepare(f.target,[token]);
  const turn=await f.binding.turn(f.owner.runId,f.target,proof);
  const load={loadHistory:()=>f.binding.eligibleTurn(turn,f.target),omitHistory:false};
  const scope=createPiMemoryScope({xiaozhiState:f.state,getAiConversationSession:async()=>({session:{}})},{history:f.history});
  const authority=(await scope.authority(f.target,load)).fingerprint;
  let delivered=0;
  const [tool]=createPiMemoryTools({readSelected:(hash,signal)=>scope.readSelected(f.target,hash,signal,undefined,load),
    readHistoryPage:(hash,page,signal)=>scope.readHistoryPage(f.target,hash,page,signal,load)},authority,()=>{delivered++;});
  const read=async history=>{
    const result=await tool.execute('call',{history});
    return JSON.parse(result.content[0].text).history;
  };
  const selected={sourceId:f.pin.id,sourceVersion:f.pin.sourceVersion};
  await assert.rejects(read({...selected,sourceVersion:f.sortKey(),offset:0}),/permission_denied/);
  await assert.rejects(read({...selected,offset:1.8}),/invalid_input/);
  let offset=0,text='';
  while(offset!==null){
    const page=await read({...selected,offset});
    assert.equal(page.offset,offset);
    assert(Array.from(page.text).length<=900);
    text+=page.text;
    offset=page.nextOffset;
  }
  assert.equal(text,f.text);
  assert.equal(delivered,3);
  await f.access.change(f.ref,1,'forget');
  await assert.rejects(read({...selected,offset:0}),/memory_scope_changed/);
  assert.equal(delivered,3);
});

test('Temporary history opt-out changes only current request authority',async t=>{
  const f=await fixture(t);
  assert.equal(requestDeclinesHistory('这次不要参考历史记忆，只根据当前要求。'),true);
  assert.equal(requestDeclinesHistory('请给出相关记录，并说明历史来源。'),false);
  const {token}=await f.binding.stage(f.target,0,'signed-ticket');
  const proof=await f.binding.prepare(f.target,[token]);
  const turn=await f.binding.turn(f.owner.runId,f.target,proof);
  const scope=createPiMemoryScope({xiaozhiState:f.state,getAiConversationSession:async()=>({session:{}})},{history:f.history});
  const policy={loadHistory:async()=>turn,omitHistory:false};
  const enabled=await scope.authority(f.target,policy),omitted=await scope.authority(f.target,{...policy,omitHistory:true});
  assert.equal(enabled.history,true);
  assert.equal(omitted.history,false);
  assert.notEqual(enabled.fingerprint,omitted.fingerprint);
  assert.equal((await scope.authority(f.target,policy)).fingerprint,enabled.fingerprint);
});

test('Restoring an older snapshot cannot reactivate a Task grant missing from live authority',async t=>{
  const f=await fixture(t);
  const {token}=await f.binding.stage(f.target,0,'signed-ticket');
  const proof=await f.binding.prepare(f.target,[token]);
  await f.sql.transaction(work=>f.binding.attachTask(work,f.task,f.owner,proof));
  const {reconcileRestoredMemory}=await import('../../src/main/backup/memory-restore.ts');
  await f.sql.transaction(work=>reconcileRestoredMemory(work,new Set(['app_settings']),null));
  assert.equal(await f.binding.forRun(f.task,f.owner),undefined);
  assert.equal((await f.access.get(f.pin.id)).allowed,true);
  assert.equal(JSON.parse((await f.grants())[0].value_json).invalidated,true);
});
