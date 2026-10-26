import '../office-agent/register-source.mjs';import fs from'node:fs';import path from'node:path';import assert from'node:assert/strict';import{randomUUID}from'node:crypto';import{DatabaseSync}from'node:sqlite';
const{createEventJournal}=await import('../../src/main/xiaozhi-agent/events/journal.ts');
const output=fs.mkdtempSync(path.resolve('test-results/xiaozhi-agent/pi-tool-attempt-journal-')),checks=[],report={success:false,checks,scope:'Actual SQLite attempt transactions and cold journal recovery; native/effect callbacks controlled, not provider/UI'};
const db=new DatabaseSync(path.join(output,'app.db'));db.exec('PRAGMA foreign_keys=ON;CREATE TABLE ai_conversation_sessions(id TEXT PRIMARY KEY);CREATE TABLE ai_agent_runs(id TEXT PRIMARY KEY)');
const sql={run:async(q,p=[])=>db.prepare(q).run(...p),all:async(q,p=[])=>db.prepare(q).all(...p),transaction:async fn=>{db.exec('BEGIN IMMEDIATE');try{const v=await fn(sql);db.exec('COMMIT');return v;}catch(e){db.exec('ROLLBACK');throw e;}}};
const sessionId='aisession_'+randomUUID();db.prepare('INSERT INTO ai_conversation_sessions VALUES(?)').run(sessionId);let native=[],effect='not_checked';let journal=createEventJournal(sql,{readNative:async()=>native,readEffect:async()=>effect});
const event=(owner,sequence,payload)=>({...owner,sequence,revision:sequence,schemaVersion:1,durability:'committed',...payload});
const call='call_owned',tool='office_browser',a=(state='started',patch={})=>({schemaVersion:1,callId:call,tool,attempt:1,maxAttempts:1,state,effect:'none',...patch});
const add=async()=>{const id='run_'+randomUUID();db.prepare('INSERT INTO ai_agent_runs VALUES(?)').run(id);return journal.begin(sessionId,id,{id,status:'running',items:[]});};
async function check(name,fn){await fn();checks.push({name,pass:true});console.log('PASS '+name);}
try{
 await journal.migrate();
 let owner=await add();await journal.append(owner,0,[event(owner,1,{kind:'tool_start',tool,callId:call})]);await journal.admitTool(owner,call,tool);
 await check('Attempt binds the existing receipt, sequence, projection and outbox in the real transaction',async()=>{await journal.append(owner,1,[event(owner,2,{kind:'tool_attempt',attempt:a()})]);const s=(await journal.snapshots(sessionId)).find(s=>s.cursor.runId===owner.runId);assert.equal(s.turn.items[0].toolAttempt.state,'started');assert.equal(s.cursor.sequence,2);assert.equal(db.prepare('SELECT count(*) n FROM xiaozhi_event_outbox WHERE run_id=?').get(owner.runId).n,2);});
 await check('Foreign call, tool, private body and already-settled receipt attempts roll back',async()=>{for(const attempt of[a('failed',{callId:'other',code:'timeout'}),a('failed',{tool:'office_edit_text',code:'timeout'}),{...a(),privateBody:'secret'}])await assert.rejects(journal.append(owner,2,[event(owner,3,{kind:'tool_attempt',attempt})]));assert.equal(db.prepare('SELECT sequence FROM xiaozhi_event_runs WHERE run_id=?').get(owner.runId).sequence,2);});
 await journal.bindNative(owner,{...owner,file:'owned.jsonl',offset:0,anchor:'a'.repeat(64),markerId:'marker_owned'});
 await journal.append(owner,2,[event(owner,3,{kind:'tool_attempt',attempt:a('failed',{code:'timeout',effect:'unknown'})})]);
 await journal.append(owner,3,[event(owner,4,{kind:'tool_end',tool,callId:call,success:false})],undefined,[{callId:call,tool,digest:'b'.repeat(64),failed:true}]);native=[{id:'native_owned',callId:call,tool,digest:'b'.repeat(64),failed:true}];
 await check('A native failure cannot erase an unknown external effect in recovery',async()=>{const r=await journal.reconcile(owner);assert.equal(r.receipts[0].native,'matched');assert.equal(r.receipts[0].effect,'uncertain');assert.equal(r.receipts[0].disposition,'needs_check');assert.equal(r.automaticReplay,false);await assert.rejects(journal.append(owner,4,[event(owner,5,{kind:'tool_attempt',attempt:a()})]),/receipt_conflict/);});
 await check('A new cold journal restores the persisted unknown effect and never invents success',async()=>{journal=createEventJournal(sql,{readNative:async()=>native,readEffect:async()=>effect});await journal.recover();const s=(await journal.snapshots(sessionId)).find(s=>s.cursor.runId===owner.runId);assert.equal(s.turn.status,'interrupted');assert.equal(s.turn.recovery.receipts[0].disposition,'needs_check');assert.equal(s.turn.items[0].toolAttempt.effect,'unknown');});
 owner=await add();native=[];await journal.append(owner,0,[event(owner,1,{kind:'tool_start',tool,callId:call})]);
 await check('Never-delivered blocked operation cannot claim unknown effect or become admitted',async()=>{await assert.rejects(journal.append(owner,1,[event(owner,2,{kind:'tool_attempt',attempt:a('failed',{code:'timeout',effect:'unknown'})})]),/receipt_conflict/);await journal.append(owner,1,[event(owner,2,{kind:'tool_attempt',attempt:a('failed',{code:'resource_busy'})})]);await journal.recover();const s=(await journal.snapshots(sessionId)).find(s=>s.cursor.runId===owner.runId);assert.equal(s.turn.recovery.receipts[0].disposition,'not_delivered');});
 owner=await add();await journal.append(owner,0,[event(owner,1,{kind:'tool_start',tool,callId:call})]);await journal.admitTool(owner,call,tool);
 await check('Real SQLite attempt-event write refusal rolls back uncertain flag with event/projection/outbox',async()=>{db.exec("CREATE TRIGGER owned_attempt_failure BEFORE INSERT ON xiaozhi_event_journal WHEN json_extract(NEW.event_json,'$.kind')='tool_attempt' BEGIN SELECT RAISE(ABORT,'owned attempt failure');END");await assert.rejects(journal.append(owner,1,[event(owner,2,{kind:'tool_attempt',attempt:a('failed',{code:'timeout',effect:'unknown'})})]),/attempt failure/);assert.equal(db.prepare('SELECT effect_state FROM xiaozhi_tool_receipts WHERE run_id=?').get(owner.runId).effect_state,'not_checked');assert.equal(db.prepare('SELECT sequence FROM xiaozhi_event_runs WHERE run_id=?').get(owner.runId).sequence,1);db.exec('DROP TRIGGER owned_attempt_failure');});
 await journal.recover();
 await check('Cancelled admitted write without a final attempt event remains uncertain, while matched independent effect can resolve it',async()=>{
  owner=await add();const write='office_edit_text';effect='not_checked';native=[{id:'native_cancelled',callId:call,tool:write,digest:'c'.repeat(64),failed:true}];
  await journal.bindNative(owner,{...owner,file:'owned.jsonl',offset:0,anchor:'a'.repeat(64),markerId:'marker_cancelled'});
  await journal.append(owner,0,[event(owner,1,{kind:'tool_start',tool:write,callId:call})]);await journal.admitTool(owner,call,write);
  await journal.append(owner,1,[event(owner,2,{kind:'tool_end',tool:write,callId:call,success:false})],undefined,[{callId:call,tool:write,digest:'c'.repeat(64),failed:true}]);
  let receipt=(await journal.reconcile(owner)).receipts[0];assert.equal(receipt.effect,'uncertain');assert.equal(receipt.disposition,'needs_check');assert.equal(receipt.native,'matched');
  effect='matched';receipt=(await journal.reconcile(owner)).receipts[0];assert.equal(receipt.effect,'matched');assert.equal(receipt.disposition,'recorded');assert.equal(receipt.tool,write);await journal.recover();
 });
 await check('A cancelled pure read without a final attempt stays failed, with no invented external effect or replay',async()=>{
  owner=await add();const read='office_web_fetch';effect='not_checked';native=[{id:'native_read_failed',callId:call,tool:read,digest:'d'.repeat(64),failed:true}];
  await journal.bindNative(owner,{...owner,file:'owned.jsonl',offset:0,anchor:'a'.repeat(64),markerId:'marker_read'});
  await journal.append(owner,0,[event(owner,1,{kind:'tool_start',tool:read,callId:call})]);await journal.admitTool(owner,call,read);
  await journal.append(owner,1,[event(owner,2,{kind:'tool_end',tool:read,callId:call,success:false})],undefined,[{callId:call,tool:read,digest:'d'.repeat(64),failed:true}]);await journal.recover();
  const restored=(await journal.snapshots(sessionId)).find(s=>s.cursor.runId===owner.runId);assert.equal(restored.turn.status,'interrupted');assert.equal(restored.turn.recovery.receipts[0].effect,'not_checked');assert.equal(restored.turn.recovery.receipts[0].disposition,'failed');assert.equal(restored.turn.recovery.automaticReplay,false);
 });
 await check('Queued read persists before admission and cold recovery marks it not delivered without replay',async()=>{
  owner=await add();const read='office_read_text';native=[];effect='not_checked';
  await journal.append(owner,0,[event(owner,1,{kind:'tool_start',tool:read,callId:call})]);
  await journal.append(owner,1,[event(owner,2,{kind:'tool_attempt',attempt:a('queued',{tool:read})})]);
  assert.equal(db.prepare('SELECT admitted FROM xiaozhi_tool_receipts WHERE run_id=?').get(owner.runId).admitted,0);
  journal=createEventJournal(sql,{readNative:async()=>native,readEffect:async()=>effect});await journal.recover();
  const restored=(await journal.snapshots(sessionId)).find(s=>s.cursor.runId===owner.runId);assert.equal(restored.turn.status,'interrupted');assert.equal(restored.turn.items[0].toolAttempt.state,'queued');assert.equal(restored.turn.recovery.receipts[0].disposition,'not_delivered');assert.equal(restored.turn.recovery.automaticReplay,false);
 });
 report.success=true;
}catch(error){report.error=error.stack;process.exitCode=1;}finally{db.close();fs.writeFileSync(path.join(output,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({success:report.success,checks:checks.length,output,error:report.error}));}
