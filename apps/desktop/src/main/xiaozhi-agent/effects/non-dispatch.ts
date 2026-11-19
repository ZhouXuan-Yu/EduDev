import {createHash} from 'node:crypto';
import type {Sql} from '../session-state';
import type {JournalOwner} from '../events/journal';
import type {TaskDocument} from '../tasks/task-state';
import {unwrapTaskArguments} from '../tasks/tool-envelope';
import {createEffectState} from './state';
import type {EffectRecord} from './types';
import {canonicalMcp} from '../mcp-schema';

export const nonDispatchFileTools:ReadonlySet<string>=new Set(['office_create_text','office_edit_text','office_create_science_figure','office_create_document','office_copy_file','office_deliver_files']);
const issuer='host-filesystem-not-dispatched.v1';
const hash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
const inputIdentity=(value:unknown)=>createHash('sha256').update(canonicalMcp(value)).digest('hex');
type Admission=TaskDocument['admissions'][number];
const inline=(work:Sql):Sql=>({...work,transaction:action=>action(work)});
function matches(record:EffectRecord,doc:TaskDocument,admission:Admission,row:Record<string,unknown>){
 return record.operation==='tool'&&record.owner.sessionId===doc.view.sessionId&&record.owner.taskId===doc.view.id
  &&record.owner.runId===admission.runId&&record.owner.generation===admission.generation&&record.callId===admission.callId&&record.tool===admission.tool
  &&record.receipt.runId===admission.runId&&record.receipt.callId===admission.callId&&record.target===admission.resource
  &&record.contract.taskId===doc.view.id&&record.contract.stepId===admission.stepId&&record.contract.planRevision===admission.planRevision&&record.contract.requirementsVersion===admission.requirementsVersion
  &&row.run_id===admission.runId&&row.call_id===admission.callId&&Number(row.generation)===admission.generation&&row.tool===admission.tool&&row.admitted===1
  &&!!row.contract_json&&hash(JSON.parse(String(row.contract_json)))===hash(record.contract);
}
const digest=(record:EffectRecord,admission:Admission,row:Record<string,unknown>)=>hash({issuer,owner:record.owner,effectId:record.id,callId:record.callId,tool:record.tool,
 contractDigest:hash(record.contract),admission,startSequence:row.start_sequence});

/** Called only after the main authorization promise rejected and the one-shot
 * dispatch gate closed. An old generic failed effect never constitutes this proof. */
export async function sealFileNonDispatch(work:Sql,owner:JournalOwner,callId:string,tool:string,input:unknown){
 if(!nonDispatchFileTools.has(tool))return;
 const effects=createEffectState(inline(work)),record=await effects.byCall(owner.runId,callId);
 if(!record||record.state!=='intent'||record.execution!==null)return;
 if(record.owner.sessionId!==owner.sessionId||record.owner.runId!==owner.runId||record.owner.generation!==owner.generation||record.contract.inputDigest!==inputIdentity(input))throw Error('tool_receipt_conflict');
 const saved=(await work.all('SELECT value_json FROM app_settings WHERE key=?',['xiaozhi.task.v1:'+record.owner.taskId]))[0];
 const doc=saved?JSON.parse(String(saved.value_json)) as TaskDocument:undefined;
 const admission=doc?.admissions.find(item=>item.runId===owner.runId&&item.generation===owner.generation&&item.callId===callId);
 const row=(await work.all('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?',[owner.runId,callId]))[0];
 if(!doc||!admission||!row||row.phase!=='admitted'||row.effect_state!=='not_checked'||!matches(record,doc,admission,row)||admission.inputDigest!==hash([tool,unwrapTaskArguments(input).input]))throw Error('tool_receipt_conflict');
 const proof=digest(record,admission,row);
 await effects.transition(record.id,record.revision,'failed',{kind:'run',owner:record.owner},{outcome:{digest:proof,references:[issuer],error:issuer},proofs:[{kind:'domain',reference:issuer,digest:proof}]});
}

/** Durable source readback, never model/renderer result details. Legacy/missing,
 * interrupted, executed, mismatched and corrupted rows remain conservative. */
export async function fileWasNotDispatched(work:Sql,doc:TaskDocument,admission:Admission){
 if(!nonDispatchFileTools.has(admission.tool))return false;
 try{
  const record=await createEffectState(inline(work)).byCall(admission.runId,admission.callId);
  if(!record||record.state!=='failed'||record.execution!==null||record.outcome?.error!==issuer||record.proofs.length!==1)return false;
  const row=(await work.all('SELECT * FROM xiaozhi_tool_receipts WHERE run_id=? AND call_id=?',[admission.runId,admission.callId]))[0];
  if(!row||row.phase!=='settled'||row.success!==0||typeof row.result_digest!=='string'||!row.result_digest||row.native_state==='conflict'||!matches(record,doc,admission,row))return false;
  const proof=digest(record,admission,row);
  return record.outcome.digest===proof&&JSON.stringify(record.outcome.references)===JSON.stringify([issuer])&&record.proofs[0].kind==='domain'&&record.proofs[0].reference===issuer&&record.proofs[0].digest===proof;
 }catch{return false;}
}

export async function receiptWasNotDispatched(work:Sql,owner:JournalOwner,callId:string,tool:string){
 if(!nonDispatchFileTools.has(tool))return false;
 try{
  const record=await createEffectState(inline(work)).byCall(owner.runId,callId);
  if(!record||record.owner.sessionId!==owner.sessionId||record.owner.generation!==owner.generation)return false;
  const saved=(await work.all('SELECT value_json FROM app_settings WHERE key=?',['xiaozhi.task.v1:'+record.owner.taskId]))[0];
  const doc=saved?JSON.parse(String(saved.value_json)) as TaskDocument:undefined;
  const admission=doc?.admissions.find(item=>item.runId===owner.runId&&item.generation===owner.generation&&item.callId===callId&&item.tool===tool);
  return !!doc&&!!admission&&await fileWasNotDispatched(work,doc,admission);
 }catch{return false;}
}
