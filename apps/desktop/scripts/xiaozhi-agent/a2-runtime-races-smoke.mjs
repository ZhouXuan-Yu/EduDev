import '../office-agent/register-source.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import assert from 'node:assert/strict';
import {randomUUID, createHash} from 'node:crypto';
import {DatabaseSync} from 'node:sqlite';
const {createTaskState}=await import('../../src/main/xiaozhi-agent/tasks/task-state.ts');
const {serializeStateWrites}=await import('../../src/main/xiaozhi-agent/serialized-state-sql.ts');
const {createRunToolGovernance, registerSessionToolGovernance}=await import('../../src/main/xiaozhi-agent/capabilities/core-governance.ts');
const {persistCurrentToolContract}=await import('../../src/main/xiaozhi-agent/capabilities/queued-contract.ts');
const {coreToolStartupDefinitions}=await import('../../src/main/xiaozhi-agent/core-tool-startup-definitions.ts');
const {createEventPublisher}=await import('../../src/main/xiaozhi-agent/events/publisher.ts');
const {createToolReceipts}=await import('../../src/main/xiaozhi-agent/events/receipts.ts');
const {createManagedSkillRuntime}=await import('../../src/main/xiaozhi-agent/managed-skill-runtime.ts');

const parent=path.resolve(process.env.OMNI_EDU_TEST_OUTPUT || os.tmpdir());
const output=fs.mkdtempSync(path.join(parent,'xiaozhi-a2-runtime-races-'));
const file=path.join(output,'app.db'),db=new DatabaseSync(file);
db.exec(`PRAGMA journal_mode=WAL;
CREATE TABLE app_settings(key TEXT PRIMARY KEY,value_json TEXT NOT NULL,updated_at TEXT NOT NULL);
CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY,archived_at TEXT);
CREATE TABLE ai_conversation_messages(id TEXT PRIMARY KEY,session_id TEXT,role TEXT,content TEXT,metadata_json TEXT);
CREATE TABLE xiaozhi_pi_commands(command_id TEXT PRIMARY KEY,conversation_id TEXT,run_id TEXT,status TEXT);
CREATE TABLE xiaozhi_event_owners(session_id TEXT PRIMARY KEY,run_id TEXT,generation INTEGER);
CREATE TABLE xiaozhi_event_runs(run_id TEXT PRIMARY KEY,session_id TEXT,generation INTEGER,status TEXT,sequence INTEGER DEFAULT 0);`);
let readBarrier;
const sql={all:async(q,v=[])=>db.prepare(q).all(...v),run:async(q,v=[])=>db.prepare(q).run(...v),change:async(q,v=[])=>Number(db.prepare(q).run(...v).changes)};
sql.transaction=async action=>{db.exec('BEGIN IMMEDIATE');try{const result=await action(sql);db.exec('COMMIT');return result;}catch(error){db.exec('ROLLBACK');throw error;}};
sql.readTransaction=async action=>{
  const reader=new DatabaseSync(file,{readOnly:true});reader.exec('PRAGMA query_only=ON; BEGIN;');
  try {return await action({run:async()=>{throw Error('read_only_transaction');},all:async(q,v=[])=>{
    const rows=reader.prepare(q).all(...v);
    if(readBarrier&&q==='SELECT value_json FROM app_settings WHERE key=?'&&v[0]===readBarrier.key){const barrier=readBarrier;readBarrier=undefined;barrier.ready.resolve();await barrier.release.promise;}
    return rows;
  }});}finally{reader.exec('ROLLBACK');reader.close();}
};
const state=createTaskState(serializeStateWrites(sql),{sanitize:async text=>text});
const owner={sessionId:'aisession_'+randomUUID(),runId:'run_'+randomUUID(),generation:1};
const command='xicmd_'+randomUUID(),message='aimsg_'+randomUUID();
db.prepare('INSERT INTO ai_conversation_sessions VALUES(?,NULL)').run(owner.sessionId);
db.prepare('INSERT INTO xiaozhi_event_runs(run_id,session_id,generation,status) VALUES(?,?,?,?)').run(owner.runId,owner.sessionId,1,'running');
db.prepare('INSERT INTO xiaozhi_event_owners VALUES(?,?,?)').run(owner.sessionId,owner.runId,1);
db.prepare('INSERT INTO xiaozhi_pi_commands VALUES(?,?,?,?)').run(command,owner.sessionId,owner.runId,'running');
db.prepare('INSERT INTO ai_conversation_messages VALUES(?,?,?,?,?)').run(message,owner.sessionId,'user','合成教师备课要求',JSON.stringify({agentRunId:owner.runId,piVersion:'xiaozhi.pi.education.v1'}));
const report={success:false,output,checks:[],boundary:'Synthetic SQLite WAL snapshots and original TaskState, governance, publisher, receipt and Skill code. No production build, Host/model dispatch, real teacher data or product acceptance claim.'};
const check=async(name,action)=>{await action();report.checks.push({name,pass:true});console.log('PASS '+name);};
const planning={schemaVersion:1,level:1,reasons:['simple_task'],observedTools:['update_task_plan'],capabilityRequirements:[],preflight:{state:'ready',checks:Object.fromEntries(['capabilities','dependencies','permissions','risk','artifacts','recovery'].map(key=>[key,{state:'ready',references:[]}])),blockers:[]},requirementsVersion:1,planRevision:0,checkedAt:new Date().toISOString()};
try {
  let task=await state.create(owner,message,command);
  await check('Read authority survives a same-Run planning commit while the exact write CAS remains strict',async()=>{
    const barrier={key:'xiaozhi.task.v1:'+task.id,ready:Promise.withResolvers(),release:Promise.withResolvers()};readBarrier=barrier;
    const reading=state.validateCurrentOwner(owner,task.id,1);await barrier.ready.promise;
    const before=task;task=await state.recordPlanning(owner,task.id,task.revision,planning);barrier.release.resolve();await reading;
    assert.equal(task.revision,before.revision+1);
    await assert.rejects(state.validateCurrent(owner,task.id,before.revision),/task_revision_conflict/);
    await assert.rejects(state.recordPlanning(owner,task.id,before.revision,planning),/task_revision_conflict/);
    await state.validateCurrentOwner(owner,task.id,1);
  });
  await check('Stale requirements, changed teacher source, archived session and replaced Run remain refused',async()=>{
    await assert.rejects(state.validateCurrentOwner(owner,task.id,2),/task_source_changed/);
    const source=db.prepare('SELECT content FROM ai_conversation_messages WHERE id=?').get(message).content;
    db.prepare('UPDATE ai_conversation_messages SET content=? WHERE id=?').run('已改变的要求',message);
    await assert.rejects(state.validateCurrentOwner(owner,task.id,1),/task_source_changed/);
    db.prepare('UPDATE ai_conversation_messages SET content=? WHERE id=?').run(source,message);
    db.prepare('UPDATE ai_conversation_sessions SET archived_at=? WHERE id=?').run(new Date().toISOString(),owner.sessionId);
    await assert.rejects(state.validateCurrentOwner(owner,task.id,1),/task_owner_stale/);
    db.prepare('UPDATE ai_conversation_sessions SET archived_at=NULL WHERE id=?').run(owner.sessionId);
    db.prepare('UPDATE xiaozhi_event_owners SET run_id=? WHERE session_id=?').run('run_replaced',owner.sessionId);
    await assert.rejects(state.validateCurrentOwner(owner,task.id,1),/task_owner_stale/);
    db.prepare('UPDATE xiaozhi_event_owners SET run_id=? WHERE session_id=?').run(owner.runId,owner.sessionId);
  });
  let registrations=[];
  const registry={providerVersions:async records=>records.map(()=>null),register:async(definition,provider,binding)=>registrations.push({definition,provider,binding}),snapshot:async()=>({revision:1,definitions:registrations.map(x=>x.definition),providers:registrations.map(x=>x.provider),bindings:registrations.map(x=>x.binding)}),providerVersion:async id=>({...registrations.find(x=>x.provider.id===id),revoked:false})};
  const records=await registerSessionToolGovernance({definitions:coreToolStartupDefinitions().filter(x=>x.name==='update_task_plan'),registry,mcp:async()=>null});
  await check('Aborting or superseding a delayed preflight prevents contract persistence',async()=>{
    for(const mode of ['abort','supersede']){
      const ready=Promise.withResolvers(),release=Promise.withResolvers(),controller=new AbortController();let current=true,writes=0;
      const governance=createRunToolGovernance({owner:{...owner,taskId:task.id},records,registry,current:()=>current,task:async()=>({planRevision:0,requirementsVersion:1,stepId:null,target:null}),preflight:async()=>{ready.resolve();await release.promise;},snapshot:async()=>({snapshotId:'synthetic',registryRevision:1}),mcp:async()=>null,persist:async()=>{writes++;}});
      const pending=governance.before('delayed_'+mode,'update_task_plan',{},controller.signal);await ready.promise;
      if(mode==='abort')controller.abort();else current=false;release.resolve();await assert.rejects(pending);assert.equal(writes,0);
    }
  });
  const receipts=createToolReceipts();await receipts.migrate(sql);
  await receipts.apply(sql,owner,{kind:'tool_start',callId:'cancelled_contract',tool:'update_task_plan',sequence:1});
  await receipts.admit(sql,owner,'cancelled_contract','update_task_plan');
  await check('Queued cancellation skips the known late write without poisoning the actual publisher',async()=>{
    let stale=false,ownerReads=0;
    const journal={assertOwner:async()=>{ownerReads++;if(stale)throw Error('event_owner_stale');},notified:async()=>{}};let failures=0,writes=0;
    const publisher=createEventPublisher({journal,owner,committed:()=>{},emit:()=>{},failed:()=>{failures++;},beforeTerminalEmit:()=>{}});
    const ready=Promise.withResolvers(),release=Promise.withResolvers();const blocked=publisher.persist(async()=>{ready.resolve();await release.promise;});await ready.promise;
    const controller=new AbortController();const pending=persistCurrentToolContract({signal:controller.signal,current:()=>!stale,enqueue:(current,action)=>publisher.persistIfCurrent(current,action),write:async()=>{writes++;}});
    controller.abort();stale=true;await receipts.apply(sql,owner,{kind:'tool_end',callId:'cancelled_contract',tool:'update_task_plan',success:false});release.resolve();await blocked;
    await assert.rejects(pending,/cancelled/);assert.equal(writes,0);assert.equal(failures,0);assert.equal(publisher.failed,false);assert.equal(ownerReads,1);
    stale=false;await publisher.persist(async()=>{writes++;});assert.equal(writes,1);
  });
  await check('Unexpected contract write errors remain fatal to the publisher',async()=>{
    let failures=0;const publisher=createEventPublisher({journal:{assertOwner:async()=>{}},owner,committed:()=>{},emit:()=>{},failed:()=>{failures++;},beforeTerminalEmit:()=>{}});
    await assert.rejects(persistCurrentToolContract({current:()=>true,enqueue:(current,action)=>publisher.persistIfCurrent(current,action),write:async()=>{throw Error('actual_database_failure');}}),/actual_database_failure/);
    assert.equal(publisher.failed,true);assert.equal(failures,1);
  });
  await check('A settled failed receipt still rejects any late tool contract',async()=>{
    const contract={schemaVersion:1,providerHash:'a'.repeat(64),sourceHash:'b'.repeat(64),schemaHash:'c'.repeat(64),inputDigest:'d'.repeat(64),taskId:task.id,planRevision:0,grantRefs:[],authorityRefs:[]};
    await assert.rejects(receipts.contract(sql,owner,'cancelled_contract','update_task_plan',contract),/tool_receipt_conflict/);
    assert.equal(db.prepare('SELECT phase FROM xiaozhi_tool_receipts WHERE call_id=?').get('cancelled_contract').phase,'settled');
  });
  await check('Genuine cached Skill content changes still stop the original Skill guard',async()=>{
    const document='---\nname: guard-proof\ndescription: 合成守卫\n---\n# 合成守卫\n保留真实字节校验。\n',bytes=Buffer.from(document),digest=createHash('sha256').update(bytes).digest('hex');
    const item={name:'guard-proof',title:'合成守卫',description:'合成守卫',origin:'builtin',version:1,files:[{relative:'SKILL.md',size:bytes.length,sha256:digest}]};
    const runtime=await createManagedSkillRuntime(path.join(output,'agent'),'',{resources:async()=>({resources:[{item,bytes:new Map([['SKILL.md',bytes]])}]}),sanitize:async text=>text});
    await runtime.check();fs.appendFileSync(runtime.result.skills[0].filePath,'\nchanged\n');await assert.rejects(runtime.check(),/skill_source_changed/);
  });
  report.success=true;
} catch(error){report.error=error.stack;process.exitCode=1;console.error(error);}
finally{db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,passed:report.checks.length,output,error:report.error}));}
