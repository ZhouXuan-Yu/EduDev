import '../office-agent/register-source.mjs';
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {randomUUID} from 'node:crypto';import {DatabaseSync} from 'node:sqlite';
const {createEventJournal}=await import('../../src/main/xiaozhi-agent/events/journal.ts');
const {createEventPublisher}=await import('../../src/main/xiaozhi-agent/events/publisher.ts');
const {createEventReceiver}=await import('../../src/shared/xiaozhi-event-receiver.ts');
const {validEventsInput}=await import('../../src/shared/xiaozhi-events.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-event-journal-')),checks=[],report={success:false,checks,scope:'Real local SQLite transaction and public-event receiver boundaries; no model/provider/UI acceptance'};
const db=new DatabaseSync(path.join(output,'app.db'));db.exec('PRAGMA foreign_keys=ON; CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY);CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY);CREATE TABLE old_facts(id TEXT PRIMARY KEY,value TEXT);INSERT INTO old_facts VALUES(\'old\',\'teacher confirmed\');');
const sql={run:async(q,p=[])=>db.prepare(q).run(...p),all:async(q,p=[])=>db.prepare(q).all(...p),transaction:async fn=>{db.exec('BEGIN IMMEDIATE');try{const r=await fn(sql);db.exec('COMMIT');return r;}catch(e){db.exec('ROLLBACK');throw e;}}};
const journal=createEventJournal(sql),sessionId='aisession_'+randomUUID(),other='aisession_'+randomUUID();db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(sessionId);db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(other);
const turn=runId=>({id:runId,status:'running',items:[{id:'teacher_'+runId,kind:'message',role:'user',text:'Owned teacher instruction'}]});
const event=(owner,sequence,payload)=>({...payload,...owner,sequence,schemaVersion:1,durability:'committed',revision:sequence});
const add=async runId=>{db.prepare('INSERT INTO ai_agent_runs VALUES(?)').run(runId);return journal.begin(sessionId,runId,turn(runId));};
async function check(name,fn){await fn();checks.push({name,pass:true});console.log('PASS '+name);}
const wait=async fn=>{for(let i=0;i<500;i++){if(fn())return;await new Promise(r=>setTimeout(r,5));}throw Error('Boundary wait timeout');};
try{
 await check('Additive fresh/old migrations are idempotent and preserve teacher facts',async()=>{await journal.migrate();await journal.migrate();assert.equal(db.prepare('SELECT value FROM old_facts').get().value,'teacher confirmed');});
 let owner=await add('run_first'),start=event(owner,1,{kind:'status',status:'running'});
 await check('State event outbox commit atomically',async()=>{const saved=await journal.append(owner,0,[start]);assert.equal(saved.cursor.sequence,1);assert.equal(db.prepare('SELECT count(*) n FROM xiaozhi_event_journal').get().n,1);assert.equal(db.prepare('SELECT count(*) n FROM xiaozhi_event_outbox WHERE notified=0').get().n,1);assert.equal(db.prepare('SELECT sequence FROM xiaozhi_event_runs').get().sequence,1);});
 await check('Exact retry is idempotent and differing duplicate is rejected',async()=>{await journal.append(owner,0,[start]);await assert.rejects(journal.append(owner,0,[{...start,status:'failed'}]),/revision_conflict/);assert.equal(db.prepare('SELECT count(*) n FROM xiaozhi_event_journal').get().n,1);});
 await check('Gap cannot partially advance state',async()=>{await assert.rejects(journal.append(owner,1,[event(owner,3,{kind:'text_delta',delta:'lost'})]),/sequence_gap/);assert.equal(db.prepare('SELECT sequence FROM xiaozhi_event_runs').get().sequence,1);});
 await check('Injected outbox write failure rolls back event and projection',async()=>{db.exec("CREATE TRIGGER fail_outbox BEFORE INSERT ON xiaozhi_event_outbox BEGIN SELECT RAISE(ABORT,'injected outbox failure'); END");await assert.rejects(journal.append(owner,1,[event(owner,2,{kind:'text_delta',delta:'never committed'})]),/injected/);assert.equal(db.prepare('SELECT sequence FROM xiaozhi_event_runs').get().sequence,1);assert.equal(db.prepare('SELECT count(*) n FROM xiaozhi_event_journal').get().n,1);db.exec('DROP TRIGGER fail_outbox');});
 await check('Existing owner cannot be overwritten while active',async()=>{db.prepare('INSERT INTO ai_agent_runs VALUES(?)').run('run_busy');await assert.rejects(journal.begin(sessionId,'run_busy',turn('run_busy')),/busy/);});
 await check('Cross-session and oversized IPC cursors rejected',async()=>{await assert.rejects(journal.list({sessionId:other,runId:owner.runId,generation:owner.generation,after:0}),/permission_denied/);for(const patch of[{limit:129},{after:-1},{generation:0},{path:'secret'}])assert.equal(validEventsInput({sessionId,runId:owner.runId,generation:owner.generation,after:0,...patch}),false);});
 await check('Snapshot and bounded ordered catch-up expose only committed events',async()=>{await journal.append(owner,1,[event(owner,2,{kind:'text_delta',delta:'visible'})]);const page=await journal.list({sessionId,runId:owner.runId,generation:owner.generation,after:0,limit:1});assert.equal(page.hasMore,true);assert.deepEqual(page.events.map(e=>e.sequence),[1]);assert.equal((await journal.snapshots(sessionId))[0].cursor.sequence,2);await assert.rejects(journal.list({sessionId,runId:owner.runId,generation:owner.generation,after:3}),/cursor_ahead/);});
 await check('Cold recovery settles active process unknown without executing tools',async()=>{await journal.recover();await journal.recover();const saved=(await journal.snapshots(sessionId))[0];assert.equal(saved.turn.status,'interrupted');assert.equal(saved.turn.verification.state,'unknown');assert.equal(saved.cursor.sequence,3);assert.equal(db.prepare('SELECT count(*) n FROM xiaozhi_event_journal WHERE run_id=?').get(owner.runId).n,3);});
 await check('Late owner callback after recovery/new owner cannot write',async()=>{const next=await add('run_next');assert(next.generation>owner.generation);await assert.rejects(journal.append(owner,2,[event(owner,3,{kind:'status',status:'completed'})]),/owner_stale/);await assert.rejects(journal.assertOwner(owner),/owner_stale/);owner=next;});
 await check('Commit before notification; dropped UI notification remains pullable',async()=>{let notified=0;const pub=createEventPublisher({journal,owner,committed:()=>{},emit:()=>{notified++;assert.equal(db.prepare('SELECT sequence FROM xiaozhi_event_runs WHERE run_id=?').get(owner.runId).sequence,1);throw Error('renderer closed');},failed:()=>assert.fail('Notification failure cannot undo commit'),beforeTerminalEmit:()=>{}});pub.enqueue({kind:'status',status:'running'});await pub.barrier();assert.equal(notified,1);assert.equal(db.prepare('SELECT notified FROM xiaozhi_event_outbox WHERE run_id=?').get(owner.runId).notified,0);assert.equal((await journal.list({sessionId,runId:owner.runId,generation:owner.generation,after:0})).events.length,1);});
 await journal.recover();owner=await add('run_fail');
 await check('Rejected persistence barrier prevents next effect and emits no success',async()=>{let failure=0,emits=0,effects=0;const pub=createEventPublisher({journal,owner,committed:()=>{},emit:()=>emits++,failed:()=>failure++,beforeTerminalEmit:()=>{}});db.exec("CREATE TRIGGER fail_journal BEFORE INSERT ON xiaozhi_event_journal BEGIN SELECT RAISE(ABORT,'injected journal failure'); END");pub.enqueue({kind:'tool_start',callId:'call_owned',tool:'office_write_text'});try{await pub.barrier();effects++;}catch{}assert.equal(effects,0);assert.equal(emits,0);assert.equal(failure,1);assert(pub.failed);pub.enqueue({kind:'status',status:'completed'});await assert.rejects(pub.flush(),/injected/);assert.equal(db.prepare('SELECT sequence FROM xiaozhi_event_runs WHERE run_id=?').get(owner.runId).sequence,0);db.exec('DROP TRIGGER fail_journal');});
 await check('Missing transaction capability fails closed',async()=>{const no=createEventJournal({run:sql.run,all:sql.all});await assert.rejects(async()=>no.begin(sessionId,'new',turn('new')),/transaction_required/);});
 await journal.recover();owner=await add('run_receiver');const events=[event(owner,1,{kind:'status',status:'running'}),event(owner,2,{kind:'text_delta',delta:'one'}),event(owner,3,{kind:'text_delta',delta:'two'})];await journal.append(owner,0,events);
 await check('Receiver repairs gaps and duplicates without losing order',async()=>{const applied=[],receiver=createEventReceiver({list:i=>journal.list(i),apply:e=>applied.push(e.sequence),unavailable:()=>assert.fail(),gapFailure:()=>assert.fail()});receiver.accept(events[2]);receiver.accept(events[1]);await wait(()=>applied.length===3);receiver.accept(events[0]);receiver.accept({...events[2],generation:99});assert.deepEqual(applied,[1,2,3]);assert.equal(receiver.cursors()[0].sequence,3);});
 await check('Navigation epoch prevents stale pull from changing new session',async()=>{const applied=[];let resolve;const receiver=createEventReceiver({list:()=>new Promise(r=>resolve=r),apply:e=>applied.push(e.sequence),unavailable:()=>{},gapFailure:()=>assert.fail()});receiver.accept(events[2]);receiver.reset();resolve(await journal.list({sessionId,runId:owner.runId,generation:owner.generation,after:0}));await new Promise(r=>setTimeout(r,20));assert.deepEqual(applied,[]);});
 await check('Malformed replay page cannot advance cursor and asks for snapshot',async()=>{let failed=0;const receiver=createEventReceiver({list:async()=>({schemaVersion:1,cursor:{runId:owner.runId,generation:owner.generation,sequence:3,revision:1},events:[events[2]],hasMore:false}),apply:()=>assert.fail(),unavailable:()=>{},gapFailure:()=>failed++});receiver.accept(events[2]);await wait(()=>failed);assert.equal(receiver.cursors().length,0);});
 await check('Transient persistence failure does not advance a committed cursor',async()=>{let failed=0;const receiver=createEventReceiver({list:()=>assert.fail(),apply:()=>assert.fail(),unavailable:()=>failed++,gapFailure:()=>assert.fail()});receiver.seed([{runId:owner.runId,generation:owner.generation,sequence:3,revision:1}]);receiver.accept({...events[2],durability:'unavailable'});assert.equal(failed,1);assert.equal(receiver.cursors()[0].sequence,3);});
 await check('Tail polling recovers a lost terminal notification with no successor',async()=>{const terminal=event(owner,4,{kind:'status',status:'completed'});await journal.append(owner,1,[terminal]);const applied=[],receiver=createEventReceiver({list:i=>journal.list(i),apply:e=>applied.push(e.sequence),unavailable:()=>assert.fail(),gapFailure:()=>assert.fail()});receiver.seed([{runId:owner.runId,generation:owner.generation,sequence:3,revision:1}]);receiver.poll(sessionId);await wait(()=>applied.length);assert.deepEqual(applied,[4]);receiver.poll(sessionId);await new Promise(r=>setTimeout(r,20));assert.deepEqual(applied,[4]);});
 await check('Tail probes target the active run without scanning historical runs',async()=>{const calls=[],receiver=createEventReceiver({list:async i=>{calls.push(i.runId);return journal.list(i);},apply:()=>{},unavailable:()=>assert.fail(),gapFailure:()=>assert.fail()});receiver.seed([{runId:owner.runId,generation:owner.generation,sequence:4,revision:2},{runId:'run_first',generation:1,sequence:3,revision:3}]);receiver.poll(sessionId,owner.runId);await wait(()=>calls.length);assert.deepEqual(calls,[owner.runId]);});
 await check('Burst reasoning batches actual SQLite commits and flushes complete content before tool admission',async()=>{
  const owner=await add('run_reasoning_burst');let commits=0,turnSaved,failed;
  const publisher=createEventPublisher({journal:{...journal,append:async(...args)=>{commits++;return journal.append(...args);}},owner,
    committed:turn=>{turnSaved=turn;},emit:()=>{},failed:error=>{failed=error;},beforeTerminalEmit:()=>{}});
  for(let i=1;i<=300;i++)publisher.enqueue({kind:'model_reasoning',block:{id:'reasoning:1:0',source:'provider',text:'甲'.repeat(i),status:'streaming',startedAt:1,durationMs:i}});
  publisher.enqueue({kind:'model_reasoning',block:{id:'reasoning:1:0',source:'provider',text:'甲'.repeat(300),status:'completed',startedAt:1,durationMs:300}});
  await publisher.barrier();assert(!failed);assert(commits<=4,'reasoning burst must not create 301 serial transactions');
  assert.equal(turnSaved.modelReasoning[0].text,'甲'.repeat(300));
  publisher.enqueue({kind:'tool_start',tool:'office_list_files',callId:'burst-tool'});await publisher.barrier();
  await publisher.persist(owner=>journal.admitTool(owner,'burst-tool','office_list_files'));
  assert.equal(db.prepare('SELECT admitted FROM xiaozhi_tool_receipts WHERE run_id=?').get(owner.runId).admitted,1);
  assert.equal(db.prepare('SELECT count(*) n FROM xiaozhi_event_journal WHERE run_id=?').get(owner.runId).n,302);
 });
 await check('A failure inside a 128-row insert rolls back the whole batch, and exact retry preserves every event',async()=>{
  const runId='run_batch_atomic';db.prepare('INSERT INTO ai_agent_runs VALUES(?)').run(runId);
  const owned=await journal.begin(other,runId,turn(runId));
  const batch=Array.from({length:128},(_,i)=>event(owned,i+1,{kind:'text_delta',delta:'x'}));
  db.exec("CREATE TRIGGER fail_batch_middle BEFORE INSERT ON xiaozhi_event_journal WHEN NEW.run_id='run_batch_atomic' AND NEW.sequence=64 BEGIN SELECT RAISE(ABORT,'injected middle batch failure'); END");
  await assert.rejects(journal.append(owned,0,batch),/injected middle batch failure/);
  assert.equal(db.prepare('SELECT count(*) n FROM xiaozhi_event_journal WHERE run_id=?').get(runId).n,0);
  assert.equal(db.prepare('SELECT count(*) n FROM xiaozhi_event_outbox WHERE run_id=?').get(runId).n,0);
  assert.equal((await journal.snapshots(other))[0].cursor.sequence,0);
  db.exec('DROP TRIGGER fail_batch_middle');
  const saved=await journal.append(owned,0,batch);assert.equal(saved.cursor.sequence,128);
  assert.equal(saved.turn.items.at(-1).text,'x'.repeat(128));
  await journal.append(owned,0,batch);
  assert.equal(db.prepare('SELECT count(*) n FROM xiaozhi_event_journal WHERE run_id=?').get(runId).n,128);
  assert.equal(db.prepare('SELECT count(*) n FROM xiaozhi_event_outbox WHERE run_id=?').get(runId).n,128);
 });
 await check('Queued small batches coalesce without crossing a private-write fence or changing the frozen terminal',async()=>{
  const session='aisession_'+randomUUID(),runId='run_coalesced_fence';
  db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(session);db.prepare('INSERT INTO ai_agent_runs VALUES(?)').run(runId);
  const owned=await journal.begin(session,runId,turn(runId));let release,entered=false,commits=0;
  const held=new Promise(resolve=>release=resolve),emitted=[];
  const publisher=createEventPublisher({journal:{...journal,append:async(...args)=>{if(++commits===1){entered=true;await held;}return journal.append(...args);}},owner:owned,
   committed:()=>{},emit:e=>emitted.push(e.sequence),failed:e=>assert.fail(String(e)),beforeTerminalEmit:()=>{}});
  publisher.enqueue({kind:'status',status:'running'});await wait(()=>entered);
  for(let i=0;i<3;i++)publisher.enqueue({kind:'activity',stage:'responding',since:i+1});
  const privateWrite=publisher.persist(async()=>{assert.equal(db.prepare('SELECT sequence FROM xiaozhi_event_runs WHERE run_id=?').get(runId).sequence,4);return true;});
  publisher.enqueue({kind:'activity',stage:'responding',since:4});
  const terminal={...turn(runId),status:'completed'};
  publisher.enqueue({kind:'status',status:'completed'},terminal);terminal.items[0].text='later mutation';
  release();await privateWrite;await publisher.flush();assert.equal(commits,3);
  assert.deepEqual(emitted,[1,2,3,4,5,6]);const saved=(await journal.snapshots(session))[0];
  assert.equal(saved.turn.status,'completed');assert.equal(saved.turn.items[0].text,'Owned teacher instruction');
 });
 report.success=true;
}catch(error){report.error=String(error.stack);process.exitCode=1;}finally{db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,output,error:report.error}));}
