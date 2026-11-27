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
const {combinedMemorySelections,createTaskHistoryUse,historyOmissionScope,historyUseRequest}=await import('../../src/main/xiaozhi-agent/memory-use/history-binding.ts');
const {createPiMemoryScope}=await import('../../src/main/xiaozhi-agent/memory-scope.ts');
const {createPiMemoryTools}=await import('../../src/main/xiaozhi-agent/memory-tools.ts');

const {invalidateTeachingHistoryForSession}=await import('../../src/main/xiaozhi-agent/history/invalidate-teaching-history.ts');

async function fixture(t){
  const db=new DatabaseSync(':memory:');
  t.after(()=>db.close());
  db.exec('CREATE TABLE ai_conversation_folders(id TEXT PRIMARY KEY,archived_at TEXT);'+
    'CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,folder_id TEXT,student_id TEXT,archived_at TEXT,title TEXT);'+
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
    await invalidateTeachingHistoryForSession(work,target);
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
  assert.equal(historyOmissionScope('这次不要参考历史记忆，只根据当前要求。'),'turn');
  assert.equal(historyOmissionScope('请给出相关记录，并说明历史来源。'),undefined);
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

test('Changing a source teaching scope retires its former R1 grant and leaves unrelated grants intact',async t=>{
  const f=await fixture(t);
  const sourcePin={...f.pin,fingerprint:f.original.fingerprint};
  const unrelated={...f.ref,sessionId:f.target,recordId:'message_2',sourceVersion:f.sortKey()};
  const survivor=await f.access.change(unrelated,0,'allow');
  const {token}=await f.binding.stage(f.target,0,'signed-ticket');
  const staged=await f.binding.prepare(f.target,[token]);
  await f.sql.transaction(work=>f.binding.attachTask(work,f.task,f.owner,staged));
  const oldJobs=await f.sql.all("SELECT state FROM memory_index_jobs WHERE source_id=? AND action='upsert'",[sourcePin.id]);
  assert.equal(oldJobs[0].state,'pending');

  await f.sql.transaction(async work=>{
    await work.run('UPDATE ai_conversation_sessions SET folder_id=? WHERE id=?',[f.a,f.source]);
    await invalidateTeachingHistoryForSession(work,f.source);
  });
  const changed=await f.access.get(sourcePin.id);
  assert.equal(changed.allowed,false);
  assert.equal(changed.status,'disabled');
  assert.equal(changed.generation,sourcePin.version+1);
  assert.equal((await f.access.get(survivor.sourceId)).allowed,true);
  assert.equal((await f.sql.all("SELECT state FROM memory_index_jobs WHERE source_id=? AND action='upsert'",[sourcePin.id]))[0].state,'cancelled');
  assert.equal(await f.binding.forRun(f.task,f.owner),undefined);
  await assert.rejects(f.binding.prepare(f.target,[token]),/memory_scope_changed/);
  const restored=await f.access.change(f.ref,changed.revision,'restore');
  assert.equal(restored.allowed,true);
  assert.equal(restored.generation,changed.generation+1);
  assert.equal(await f.binding.forRun(f.task,f.owner),undefined);
});

test('A published planning contract upgrades append-only and rejects foreign schema identities',async()=>{
  const {createHash}=await import('node:crypto');
  const {ensureNativeTaskContract}=await import('../../src/main/xiaozhi-agent/plan-native.ts');
  const {TASK_PLAN_PARAMETERS:current}=await import('../../src/shared/xiaozhi-task-plan.ts');
  const {capabilityRequirements}=current.properties,{items}=capabilityRequirements;
  const {dependsOn:unused,...published}=items.properties;
  const previous={...current,properties:{...current.properties,capabilityRequirements:{...capabilityRequirements,items:{...items,properties:published}}}};
  const hash=schema=>createHash('sha256').update(JSON.stringify(schema)).digest('hex');
  const base=hash('host control identity');
  const original={type:'custom',customType:'xiaozhi.education.task-plan.v3',
    data:{schemaVersion:3,base,envelopeVersion:1,schemaHash:hash(previous)}};
  const entries=[structuredClone(original)];
  const manager={getEntries:()=>entries,appendCustomEntry:(customType,data)=>entries.push({type:'custom',customType,data})};
  const tools=[{name:'update_task_plan',parameters:current}];
  ensureNativeTaskContract(manager,base,tools);
  assert.deepEqual(entries[0],original);
  assert.equal(entries[1].data.previousSchemaHash,hash(previous));
  assert.equal(entries[1].data.schemaHash,hash(current));
  ensureNativeTaskContract(manager,base,tools);
  assert.equal(entries.length,2);
  assert.throws(()=>ensureNativeTaskContract(manager,hash('different authority'),tools),/configuration/);
  entries[0].data.schemaHash=hash('unrecognized tool schema');
  assert.throws(()=>ensureNativeTaskContract(manager,base,tools),/configuration/);
});

test('An explicit Task history exclusion survives a new Run and does not edit Session permission',async t=>{
  const f=await fixture(t);
  const pin={...f.pin,fingerprint:f.original.fingerprint};
  assert.equal(await f.state.saveMemoryScope(f.target,0,{enabled:true,selections:[pin]}),true);
  const saved=await f.state.memoryScope(f.target);
  const scope=createPiMemoryScope({xiaozhiState:f.state,getAiConversationSession:async()=>({session:{}})},{history:f.history});
  const initial=await scope.authority(f.target);
  assert.equal(initial.history,true);
  assert.equal(historyOmissionScope('本任务不用历史，仅按现有正文。'),'task');
  assert.equal(historyOmissionScope('只改第三题。请这次别引用之前的历史记录。'),'turn');
  assert.equal(historyOmissionScope('请分析“本任务不用历史”的语义。'),undefined);
  await f.sql.transaction(work=>f.binding.excludeForTask(work,f.task,f.owner));
  const owner={...f.owner,runId:'run_'+randomUUID(),generation:2};
  const resumed={...f.task,binding:owner};
  const runtime=createTaskHistoryUse(f.sql,f.history);
  const history=()=>runtime.forRun(resumed,owner);
  const without=await scope.authority(f.target,{omitHistory:false,loadHistory:history});
  assert.equal(without.history,false);
  assert.notEqual(without.fingerprint,initial.fingerprint);
  assert.deepEqual(await f.state.memoryScope(f.target),saved);
  assert.equal((await f.access.get(pin.id)).allowed,true);
  const other={...resumed,id:'xitask_'+f.sortKey()};
  assert.equal((await scope.authority(f.target,{omitHistory:false,loadHistory:()=>runtime.forRun(other,owner)})).history,true);
});

test('An exact historical title grants Task use only with one existing explicit Session selection',async t=>{
  const f=await fixture(t),title='源会话手工标题';
  assert.deepEqual(historyUseRequest('请引用历史《源会话手工标题》。'),{kind:'named',title,query:title});
  assert.equal(historyUseRequest('请参考历史《源会话手工标题》和《另一份》。').kind,'confirm');
  assert.equal(historyUseRequest('照上次那份继续。').kind,'confirm');
  assert.equal(historyUseRequest('请改第三题，参考当前讲义版本。'),undefined);

  await f.sql.run('UPDATE ai_conversation_sessions SET title=? WHERE id=?',[title,f.source]);
  assert.equal(typeof f.binding.prepareNamed,'function');
  assert.equal(await f.binding.prepareNamed(f.target,title),undefined);
  const pin={...f.pin,fingerprint:f.original.fingerprint};
  assert(await f.state.saveMemoryScope(f.target,0,{enabled:true,selections:[pin]}));
  assert.equal(await f.binding.prepareNamed(f.target,'手工标题'),undefined);
  const exact=await f.binding.prepareNamed(f.target,title);
  assert.deepEqual(exact.selections,[pin]);
  const sameTitle={...f.ref,recordId:'second_source'};
  await f.access.change(sameTitle,0,'allow');
  assert.equal(await f.binding.prepareNamed(f.target,title),undefined);
  await assert.rejects(f.sql.transaction(work=>f.binding.attachTask(work,f.task,f.owner,exact)),/memory_scope_changed/);
  assert.equal((await f.grants()).length,0);
});
