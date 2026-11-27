import '../office-agent/register-source.mjs'
import assert from 'node:assert/strict'
import {DatabaseSync} from 'node:sqlite'
import {randomUUID,createHash} from 'node:crypto'
const {historyMemorySchema}=await import('../../src/main/xiaozhi-agent/history/schema.ts')
const {createHistoryState,historyId}=await import('../../src/main/xiaozhi-agent/history/state.ts')
const {createHistoryMemory}=await import('../../src/main/xiaozhi-agent/history/memory.ts')
const {teacherRequestSources}=await import('../../src/main/xiaozhi-agent/request-sources.ts')
const {createPiMemoryScopeState}=await import('../../src/main/xiaozhi-agent/memory-scope-state.ts')
const {validMemoryScopeInput}=await import('../../src/main/xiaozhi-agent/memory-selection.ts')

const db=new DatabaseSync(':memory:')
db.exec('PRAGMA foreign_keys=ON; CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT,updated_at TEXT); CREATE TABLE ai_conversation_folders(id TEXT PRIMARY KEY,archived_at TEXT); CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,folder_id TEXT,student_id TEXT,archived_at TEXT,title TEXT); CREATE TABLE ai_conversation_messages(id TEXT PRIMARY KEY,session_id TEXT,role TEXT,content TEXT,metadata_json TEXT,created_at TEXT);')
const old='aisession_'+randomUUID(), target='aisession_'+randomUUID()
const hash=text=>createHash('sha256').update(text).digest('hex')
db.prepare('INSERT INTO ai_conversation_sessions(id) VALUES (?),(?)').run(old,target)
db.prepare("UPDATE ai_conversation_sessions SET student_id='' WHERE id=?").run(old)
db.exec(historyMemorySchema)
const work={
  all:async (query,params=[])=>db.prepare(query).all(...params),
  run:async (query,params=[])=>db.prepare(query).run(...params),
  change:async (query,params=[])=>Number(db.prepare(query).run(...params).changes),
}
const sql={...work,transaction:async callback=>{
  db.exec('BEGIN IMMEDIATE')
  try{const result=await callback(work);db.exec('COMMIT');return result}
  catch(error){db.exec('ROLLBACK');throw error}
}}
const checks=[]
const check=async(name,fn)=>{await fn();checks.push(name)}
const memory=createHistoryState(sql)
const scope=createPiMemoryScopeState(sql)
const ref={kind:'history_request',sessionId:old,recordId:'record-local-1',sourceVersion:hash('source')}
try{
  await scope.migrateMemoryScope()
  const legacy={layer:'L2',source:'chat',id:'memory_entry_'+randomUUID(),version:1,fingerprint:hash('legacy')}
  function persistRequests(messages) {
    for (const message of messages) db.prepare('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?,?)')
      .run(message.id,old,message.role,message.content,JSON.stringify(message.metadata),'2026-11-25T10:00:00Z');
  }
  await check('v1 scope byte shape is stable',async()=>{
    assert(await scope.saveMemoryScope(target,0,{enabled:true,selections:[legacy]}))
    assert.deepEqual(await scope.memoryScope(target),{version:1,enabled:true,selections:[legacy]})
    assert.equal((await sql.all('SELECT schema_version FROM xiaozhi_pi_memory_scopes'))[0].schema_version,1)
  })
  const grant=await memory.change(ref,0,'allow')
  const select={layer:'history',source:'history',id:grant.sourceId,version:grant.generation,sourceVersion:ref.sourceVersion}
  await check('explicit indexing does not add a scope selection',async()=>{
    assert.equal((await scope.memoryScope(target)).selections.length,1)
    assert.equal((await memory.permitted()).length,1)
    assert.equal((await sql.all("SELECT COUNT(*) n FROM memory_index_jobs WHERE action='upsert'"))[0].n,1)
  })
  await check('v2 round-trip, cap and stale revision',async()=>{
    const payload={enabled:true,selections:[legacy,{...select,fingerprint:hash('selected')}]}
    assert(await scope.saveMemoryScope(target,1,payload))
    assert.equal(await scope.saveMemoryScope(target,1,payload),false)
    assert.equal((await sql.all('SELECT schema_version FROM xiaozhi_pi_memory_scopes'))[0].schema_version,2)
    assert.deepEqual((await scope.memoryScope(target)).selections,payload.selections)
    assert(!validMemoryScopeInput({sessionId:target,version:2,enabled:true,selections:Array.from({length:13},(_,i)=>({...select,id:hash(String(i))}))}))
  })
  await check('forget fences source and emits cleanup for an in-flight write',async()=>{
    await sql.run("UPDATE memory_index_jobs SET state='running' WHERE source_id=?",[grant.sourceId])
    const tombstone=await memory.change(ref,1,'forget')
    assert.equal(tombstone.status,'forgotten')
    assert.equal(tombstone.generation,grant.generation+1)
    assert.equal((await createHistoryState(sql).permitted()).length,0)
    assert.equal(await createHistoryState(sql).cleanup(grant.sourceId),'pending')
    await assert.rejects(memory.change(ref,0,'allow'),/command_conflict/)
    await assert.rejects(memory.change(ref,2,'allow'),/permission_denied/)
  })
  await check('identity follows record, not body hash',async()=>{
    assert.equal(historyId({...ref,sourceVersion:hash('changed')}),grant.sourceId)
    assert.notEqual(historyId({...ref,recordId:'other'}),grant.sourceId)
  })
  await check('the final discovery response excludes a permission revoked during candidate assembly',async()=>{
    const messages=['algebra exercise worksheet','exercise'].map((content,i)=>({id:'race-record-'+i,role:'user',content,
      metadata:{piVersion:'xiaozhi.pi.education.v1',agentRunId:'run_'+i}}));
    persistRequests(messages);
    const refs=teacherRequestSources(messages,[]).map(source=>({kind:'history_request',sessionId:old,
      recordId:source.sourceId,sourceVersion:source.sourceVersion}));
    const first=await memory.change(refs[0],0,'allow');
    const second=await memory.change(refs[1],0,'allow');
    let revocation=false,secondReads=0;
    const watched={...sql,all:async(query,args=[])=>{
      const secondLookup=query==='SELECT * FROM memory_source_access WHERE source_id=?'&&args[0]===second.sourceId;
      const publicationLookup=query.includes('a.source_id IN (')&&query.includes('FROM memory_source_access a');
      if(!revocation&&(publicationLookup||(secondLookup&&++secondReads===2))){
        await memory.change(refs[0],first.revision,'forget');
        revocation=true;
      }
      return sql.all(query,args);
    }};
    const served=createHistoryMemory({xiaozhiState:{sql:watched,memoryScope:scope.memoryScope},
      getAiConversationSession:async id=>({session:{title:id===old?'来源会话':'当前任务'},messages:id===old?messages:[]}),
      sanitizeProblemText:async text=>({sanitizedText:text})});
    const found=await served.discover(target,'algebra exercise worksheet');
    assert(revocation,'Expected to hit the publication boundary.');
    assert.deepEqual(found.candidates.map(candidate=>candidate.sourceId),[second.sourceId]);
    const folder='aifolder_'+randomUUID();
    await sql.run('INSERT INTO ai_conversation_folders(id) VALUES(?)',[folder]);
    await sql.run('UPDATE ai_conversation_sessions SET folder_id=? WHERE id=?',[folder,old]);
    assert.deepEqual((await served.discover(target,'exercise')).candidates,[]);
    await assert.rejects(served.selectedFor(target,{layer:'history',source:'history',id:second.sourceId,version:second.generation,sourceVersion:second.ref.sourceVersion}),/permission_denied/);
    await sql.run('UPDATE ai_conversation_sessions SET folder_id=NULL WHERE id=?',[old]);
    // Reclassification of either session during assembly must still exclude the title.
    for(const id of [old,target]){
      await sql.run('UPDATE ai_conversation_sessions SET student_id=? WHERE id=?',['test-student',id]);
      if(id===target)await assert.rejects(served.discover(target,'exercise'),/permission_denied/);
      else assert.deepEqual((await served.discover(target,'exercise')).candidates,[]);
      await sql.run('UPDATE ai_conversation_sessions SET student_id=NULL WHERE id=?',[id]);
      await sql.run('UPDATE ai_conversation_sessions SET archived_at=? WHERE id=?',['2026-11-25',id]);
      if(id===target)await assert.rejects(served.discover(target,'exercise'),/permission_denied/);
      else assert.deepEqual((await served.discover(target,'exercise')).candidates,[]);
      await sql.run('UPDATE ai_conversation_sessions SET archived_at=NULL WHERE id=?',[id]);
    }
  })
  await check('authorized preview discards source text when access changes before publication',async()=>{
    const messages=[{id:'preview-request',role:'user',content:'用于核验的讲义原话',
      metadata:{piVersion:'xiaozhi.pi.education.v1',agentRunId:'preview-run'}}];
    persistRequests(messages);
    const [source]=teacherRequestSources(messages,[]);
    const ref={kind:'history_request',sessionId:old,recordId:source.sourceId,sourceVersion:source.sourceVersion};
    const grant=await memory.change(ref,0,'allow');
    let revoked=false;
    const watched={...sql,all:async(query,args=[])=>{
      if(!revoked && query.includes('AS pending') && args[0]===grant.sourceId){
        revoked=true;
        await memory.change(ref,grant.revision,'revoke');
      }
      return sql.all(query,args);
    }};
    const served=createHistoryMemory({xiaozhiState:{sql:watched},getAiConversationSession:async()=>({session:{title:'测试'},messages}),
      sanitizeProblemText:async text=>({sanitizedText:text})});
    await assert.rejects(served.preview(ref,0,true),/permission_denied|source_changed/);
    assert(revoked);
  })

  await check('preview and selected read withhold changed source bytes even when the grant row is unchanged',async()=>{
    const message={id:'revised-during-read',role:'user',content:'教师已保存的历史原话。',
      metadata:{piVersion:'xiaozhi.pi.education.v1',agentRunId:'run_'+randomUUID()}};
    persistRequests([message]);
    const [source]=teacherRequestSources([message],[]);
    const ref={kind:'history_request',sessionId:old,recordId:source.sourceId,sourceVersion:source.sourceVersion};
    const saved=await memory.change(ref,0,'allow');
    const pin={layer:'history',source:'history',id:saved.sourceId,version:saved.generation,sourceVersion:ref.sourceVersion};
    let revise=false;
    const served=createHistoryMemory({xiaozhiState:{sql},sanitizeProblemText:async text=>{
      if(revise)await sql.run('UPDATE ai_conversation_messages SET content=? WHERE id=?',['合成的新版本。',message.id]);
      return {sanitizedText:text};
    }});
    assert.equal((await served.selected(pin)).text,message.content);
    revise=true;
    for(const read of [()=>served.selected(pin),()=>served.preview(ref,0,true),()=>served.preview(ref,0,false)]){
      await sql.run('UPDATE ai_conversation_messages SET content=? WHERE id=?',[message.content,message.id]);
      await assert.rejects(read,/source_changed/);
    }
    assert.equal((await memory.get(saved.sourceId)).generation,saved.generation);
  })

  await check('source teaching term applies independently of its message recording time',async()=>{
    const folder='aifolder_'+randomUUID();
    const autumn='aisession_'+randomUUID(),spring='aisession_'+randomUUID();
    await sql.run('INSERT INTO ai_conversation_folders(id) VALUES(?)',[folder]);
    for(const id of [spring,autumn])await sql.run('INSERT INTO ai_conversation_sessions(id,folder_id) VALUES(?,?)',[id,folder]);
    assert(await scope.saveMemoryScope(spring,0,{enabled:false,selections:[]},{folderId:folder,term:'2026-spring'}));
    assert(await scope.saveMemoryScope(autumn,0,{enabled:false,selections:[]},{folderId:folder,term:'2026-fall'}));
    const messages=['spring rotation rule','autumn rotation rule'].map((content,i)=>({id:'term-message-'+i,role:'user',content,
      metadata:{piVersion:'xiaozhi.pi.education.v1',agentRunId:'term-run-'+i}}));
    const served=createHistoryMemory({xiaozhiState:{sql},sanitizeProblemText:async text=>({sanitizedText:text})});
    const pins=[];
    for(const [i,sessionId] of [spring,autumn].entries()){
      const message=messages[i];
      await sql.run('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?,?)',
        [message.id,sessionId,message.role,message.content,JSON.stringify(message.metadata),'2026-11-25T10:00:00Z']);
      const [source]=teacherRequestSources([message],[]);
      const ref={kind:'history_request',sessionId,recordId:source.sourceId,sourceVersion:source.sourceVersion};
      const granted=await served.change(ref,0,'allow');
      pins.push({layer:'history',source:'history',id:granted.sourceId,version:granted.generation,sourceVersion:ref.sourceVersion});
    }
    const springRead=await served.selectedFor(spring,pins[0]);
    assert.deepEqual(springRead.temporal,{teachingTerm:'2026-spring',recordedAt:'2026-11-25T10:00:00Z'});
    await assert.rejects(served.selectedFor(autumn,pins[0]),/permission_denied/);
    assert.equal((await served.selectedFor(autumn,pins[1])).temporal.teachingTerm,'2026-fall');
    for(const [i,sessionId] of [spring,autumn].entries()){
      const results=await served.discover(sessionId,'rotation rule');
      assert.deepEqual(results.candidates.map(candidate=>candidate.sourceId),[pins[i].id]);
    }
  })

  await check('unknown scope schema rejected',async()=>{
    await sql.run('UPDATE xiaozhi_pi_memory_scopes SET schema_version=17')
    await assert.rejects(scope.memoryScope(target),/configuration/)
  })
  console.log(JSON.stringify({checks,passed:checks.length}))
}finally{db.close()}
