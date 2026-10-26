import {createHash} from 'node:crypto';
import type {Sql} from '../session-state';
import type {JournalOwner} from '../events/journal';
import {readNativeToolEntries,type NativeRunBinding} from '../events/native-tail';
import {withoutPlanBasisReference} from '../plan-native';

const hash=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
const text=(v:unknown):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=4000&&!v.includes('\0');
/** User input delivery, not independent evidence that a teaching result is correct.
 * Answers require control + committed public event + admitted receipt + native body.
 * Returned digests contain no question, answer, user path, ID or timestamp. */
export async function readTeacherAnswerDigests(options:{sql:Sql;owner:JournalOwner;nativeRoot:string;current:()=>boolean}):Promise<string[]>{
 const{sql,owner}=options;
 async function authority(){
  if(!options.current())throw Error('cancelled');
  const row=(await sql.all('SELECT o.run_id,o.generation,r.status FROM xiaozhi_event_owners o JOIN xiaozhi_event_runs r ON r.run_id=o.run_id WHERE o.session_id=?',[owner.sessionId]))[0];
  if(!row||row.run_id!==owner.runId||row.generation!==owner.generation||row.status!=='running')throw Error('event_owner_stale');
 }
 await authority();
 const rows=await sql.all("SELECT * FROM xiaozhi_pi_controls WHERE conversation_id=? AND run_id=? AND kind='question' AND state='answered' ORDER BY created_at,rowid LIMIT 33",[owner.sessionId,owner.runId]);
 if(rows.length>32)throw Error('teacher_input_capacity');if(!rows.length){await authority();return[];}
 const bindingRow=(await sql.all('SELECT binding_json FROM xiaozhi_native_run_bindings WHERE run_id=? AND generation=?',[owner.runId,owner.generation]))[0];
 if(!bindingRow)throw Error('evidence_missing');
 const binding=JSON.parse(String(bindingRow.binding_json)) as NativeRunBinding;
 if(binding.runId!==owner.runId||binding.sessionId!==owner.sessionId||binding.generation!==owner.generation)throw Error('event_owner_stale');
 const native=await readNativeToolEntries(binding,options.nativeRoot),digests=new Set<string>();
 for(const row of rows){
  const raw=String(row.payload_json),item=JSON.parse(raw);
  if(row.schema_version!==1||item.id!==row.id||item.sessionId!==owner.sessionId||item.runId!==owner.runId||item.kind!=='question'||item.state!=='answered'||item.canResume||!text(item.answer)||typeof item.callId!=='string')continue;
  const receipt=(await sql.all('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?',[owner.runId,item.callId]))[0],entries=native.filter(n=>n.callId===item.callId&&n.tool==='ask_teacher'&&!n.failed);
  if(!receipt||receipt.generation!==owner.generation||receipt.tool!=='ask_teacher'||receipt.phase!=='settled'||receipt.admitted!==1||receipt.success!==1||entries.length!==1||receipt.result_digest!==entries[0].digest)continue;
  const content=withoutPlanBasisReference(entries[0].message.content as unknown[],item.callId,'ask_teacher');
  if(content.length!==1||(content[0] as {type?:unknown}).type!=='text')continue;
  let answer;try{answer=JSON.parse((content[0] as {text:string}).text);}catch{continue;}
  if(!answer||Object.keys(answer).sort().join(',')!=='answer,success'||answer.success!==true||answer.answer!==item.answer)continue;
  const events=await sql.all("SELECT event_json,event_hash FROM xiaozhi_event_journal WHERE run_id=? AND generation=? AND json_extract(event_json,'$.kind')='control' AND json_extract(event_json,'$.control.id')=? AND json_extract(event_json,'$.control.state')='answered' LIMIT 2",[owner.runId,owner.generation,item.id]);
  if(events.length!==1||createHash('sha256').update(String(events[0].event_json)).digest('hex')!==events[0].event_hash)continue;
  const event=JSON.parse(String(events[0].event_json)),control=event.control;
  if(event.sessionId!==owner.sessionId||event.runId!==owner.runId||event.generation!==owner.generation||event.durability!=='committed'||control.runId!==owner.runId||control.callId!==item.callId||control.kind!=='question'||control.answer!==item.answer||control.text!==item.text||JSON.stringify(control.options)!==JSON.stringify(item.options))continue;
  // A new model question/ID cannot turn the identical teacher answer into fresh input.
  digests.add(hash(['teacher-answer.v1',item.answer.trim()]));
  const after=(await sql.all('SELECT payload_json,state FROM xiaozhi_pi_controls WHERE id=?',[item.id]))[0];
  if(after?.state!=='answered'||after.payload_json!==raw)throw Error('teacher_input_changed');
 }
 const afterRows=await sql.all("SELECT * FROM xiaozhi_pi_controls WHERE conversation_id=? AND run_id=? AND kind='question' AND state='answered' ORDER BY created_at,rowid LIMIT 33",[owner.sessionId,owner.runId]);
 if(JSON.stringify(rows)!==JSON.stringify(afterRows))throw Error('teacher_input_changed');
 await authority();return[...digests].sort();
}
