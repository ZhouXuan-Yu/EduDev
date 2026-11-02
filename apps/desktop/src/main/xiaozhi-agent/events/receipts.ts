import type {Sql} from '../session-state';
import type {JournalOwner} from './journal';
import type {NativeRunBinding,NativeToolEntry} from './native-tail';
import type {XiaozhiAgentEvent} from '../../../shared/xiaozhi-agent';
import type {XiaozhiRecovery,XiaozhiRecoveryReceipt} from '../../../shared/xiaozhi-recovery';
import {toolManifest} from '../tools/manifest';

export type ReceiptCapture={callId:string;tool:string;digest:string;failed:boolean};
export type ReceiptReadback={readNative?:(binding:NativeRunBinding)=>Promise<NativeToolEntry[]>;readEffect?:(owner:JournalOwner,callId:string,tool:string,entry?:NativeToolEntry)=>Promise<'matched'|'uncertain'|'not_checked'>};
const hex=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const identity=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_:.-]{1,128}$/.test(v);
const time=()=>new Date().toISOString();
function mayHaveEffect(tool:string){try{return toolManifest(tool).effect!=='safe_read';}catch{return true;}}
async function bounded<T>(work:()=>Promise<T>){let timer:ReturnType<typeof setTimeout>|undefined;try{return await Promise.race([Promise.resolve().then(work),new Promise<undefined>(resolve=>{timer=setTimeout(()=>resolve(undefined),10000);})]);}catch{return undefined;}finally{if(timer)clearTimeout(timer);}}
/** Call identity and native association are private. Public recovery contains no result body. */
export function createToolReceipts(options:ReceiptReadback={}){
 async function rows(work:Sql,runId:string){const values=await work.all('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? ORDER BY start_sequence,call_id',[runId]);if(values.length>1024)throw Error('event_journal_bounds');return values;}
 return{
  async migrate(sql:Sql){
   await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_native_run_bindings(run_id TEXT PRIMARY KEY,generation INTEGER NOT NULL,binding_json TEXT NOT NULL,FOREIGN KEY(run_id) REFERENCES xiaozhi_event_runs(run_id))`);
   await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_tool_receipts(run_id TEXT NOT NULL,call_id TEXT NOT NULL,generation INTEGER NOT NULL,tool TEXT NOT NULL,start_sequence INTEGER NOT NULL,phase TEXT NOT NULL,admitted INTEGER,result_digest TEXT,success INTEGER,native_entry_id TEXT,native_digest TEXT,native_state TEXT NOT NULL DEFAULT 'missing',effect_state TEXT NOT NULL DEFAULT 'not_checked',updated_at TEXT NOT NULL,PRIMARY KEY(run_id,call_id),FOREIGN KEY(run_id) REFERENCES xiaozhi_event_runs(run_id))`);
   if(!(await sql.all('PRAGMA table_info(xiaozhi_tool_receipts)')).some(row=>row.name==='admitted'))await sql.run('ALTER TABLE xiaozhi_tool_receipts ADD COLUMN admitted INTEGER');
  },
  async bind(work:Sql,owner:JournalOwner,binding:NativeRunBinding){
   if(binding.runId!==owner.runId||binding.sessionId!==owner.sessionId||binding.generation!==owner.generation||!identity(binding.markerId)||!hex(binding.anchor)||typeof binding.file!=='string'||binding.file.length>1024||!Number.isSafeInteger(binding.offset)||binding.offset<0)throw Error('invalid_input');
   const encoded=JSON.stringify(binding),old=(await work.all('SELECT binding_json FROM xiaozhi_native_run_bindings WHERE run_id=?',[owner.runId]))[0];
   if(old){if(old.binding_json!==encoded)throw Error('native_binding_conflict');return;}
   await work.run('INSERT INTO xiaozhi_native_run_bindings(run_id,generation,binding_json) VALUES(?,?,?)',[owner.runId,owner.generation,encoded]);
  },
  async apply(work:Sql,owner:JournalOwner,event:XiaozhiAgentEvent,capture?:ReceiptCapture){
   if(event.kind==='tool_attempt'){
    const a=event.attempt,row=(await work.all('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?',[owner.runId,a.callId]))[0];
    if(!row||row.tool!==a.tool||Number(row.generation)!==owner.generation||row.phase==='settled')throw Error('tool_receipt_conflict');
    if(a.effect==='unknown'){
     if(row.admitted!==1)throw Error('tool_receipt_conflict');
     await work.run("UPDATE xiaozhi_tool_receipts SET effect_state='uncertain',updated_at=? WHERE run_id=? AND call_id=?",[time(),owner.runId,a.callId]);
    }
    return;
   }
   if(event.kind!=='tool_start'&&event.kind!=='tool_end')return;
   if(!identity(event.callId)||!identity(event.tool))throw Error('invalid_input');
   const row=(await work.all('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?',[owner.runId,event.callId]))[0];
   if(event.kind==='tool_start'){
    if(row)throw Error('tool_receipt_conflict');if((await rows(work,owner.runId)).length>=1024)throw Error('event_journal_bounds');
    await work.run("INSERT INTO xiaozhi_tool_receipts(run_id,call_id,generation,tool,start_sequence,phase,admitted,updated_at) VALUES(?,?,?,?,?,'planned',0,?)",[owner.runId,event.callId,owner.generation,event.tool,event.sequence,time()]);return;
   }
   if(!row||row.tool!==event.tool||Number(row.generation)!==owner.generation||row.phase==='settled')throw Error('tool_receipt_conflict');
   if(event.success&&row.admitted!==1)throw Error('tool_receipt_conflict');
   if(capture&&(capture.callId!==event.callId||capture.tool!==event.tool||!hex(capture.digest)||typeof capture.failed!=='boolean'||capture.failed===event.success))throw Error('invalid_input');
   await work.run("UPDATE xiaozhi_tool_receipts SET phase='settled',result_digest=?,success=?,updated_at=? WHERE run_id=? AND call_id=?",[capture?.digest||null,event.success?1:0,time(),owner.runId,event.callId]);
  },
  async admit(work:Sql,owner:JournalOwner,callId:string,tool:string){
   const row=(await work.all('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?',[owner.runId,callId]))[0];
   if(!row||row.phase!=='planned'||row.tool!==tool||Number(row.generation)!==owner.generation)throw Error('tool_receipt_conflict');
   await work.run("UPDATE xiaozhi_tool_receipts SET phase='admitted',admitted=1,updated_at=? WHERE run_id=? AND call_id=?",[time(),owner.runId,callId]);
  },
  async reconcile(work:Sql,owner:JournalOwner):Promise<XiaozhiRecovery>{
   const values=await rows(work,owner.runId),bindingRow=(await work.all('SELECT binding_json FROM xiaozhi_native_run_bindings WHERE run_id=? AND generation=?',[owner.runId,owner.generation]))[0];
   let native:NativeToolEntry[]|undefined;
   if(bindingRow&&options.readNative)native=await bounded(()=>options.readNative!(JSON.parse(String(bindingRow.binding_json))));
   const summaries:XiaozhiRecoveryReceipt[]=[];
   for(const row of values){
    if(Number(row.generation)!==owner.generation)throw Error('event_owner_stale');
    const callId=String(row.call_id),tool=String(row.tool),entry=native?.find(r=>r.callId===callId);
    let nativeState:XiaozhiRecoveryReceipt['native']='missing',effect:XiaozhiRecoveryReceipt['effect']=row.effect_state==='uncertain'?'uncertain':'not_checked';
    if(entry){nativeState=entry.tool!==tool||row.admitted===0&&!entry.failed||row.result_digest&&row.result_digest!==entry.digest||row.success!==null&&Boolean(row.success)!==!entry.failed||row.native_entry_id&&row.native_entry_id!==entry.id||row.native_digest&&row.native_digest!==entry.digest?'conflict':row.result_digest?'matched':'recorded';}
    // Effect truth comes from existing teacher-confirmed ledgers and disk, not a native "success" string.
    if(row.admitted!==0&&options.readEffect){const checked=await bounded(()=>options.readEffect!(owner,callId,tool,['matched','recorded'].includes(nativeState)?entry:undefined))||'uncertain';if(checked!=='not_checked'||effect!=='uncertain')effect=checked;}
    // Cancellation can prevent the final attempt event from being committed.
    // A failed transcript is not proof that an admitted write/upload had no effect.
    if(row.admitted!==0&&effect==='not_checked'&&mayHaveEffect(tool)&&(entry?.failed||row.success===0))effect='uncertain';
    const disposition:XiaozhiRecoveryReceipt['disposition']=nativeState==='conflict'?'needs_check':row.admitted===0?'not_delivered':effect==='matched'?'recorded':effect==='uncertain'?'needs_check':entry&&entry.failed?'failed':['matched','recorded'].includes(nativeState)?'recorded':'needs_check';
    await work.run('UPDATE xiaozhi_tool_receipts SET native_entry_id=?,native_digest=?,native_state=?,effect_state=?,updated_at=? WHERE run_id=? AND call_id=?',[row.native_entry_id?String(row.native_entry_id):((nativeState==='matched'||nativeState==='recorded')?entry!.id:null),row.native_digest?String(row.native_digest):((nativeState==='matched'||nativeState==='recorded')?entry!.digest:null),nativeState,effect,time(),owner.runId,callId]);
    summaries.push({id:`receipt_${owner.runId}_${callId}`,runId:owner.runId,callId,tool,disposition,native:nativeState,effect});
   }
   return{schemaVersion:1,runId:owner.runId,receipts:summaries,automaticReplay:false};
  },
 };
}
