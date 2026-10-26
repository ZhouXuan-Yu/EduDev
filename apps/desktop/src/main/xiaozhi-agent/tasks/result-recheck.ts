import {createHash} from 'node:crypto';
import type {OmniEduStore} from '../../db';
import type {TaskView,TaskCandidate} from '../../../shared/xiaozhi-task';
import {legacyVerification,validTaskVerification} from '../../../shared/xiaozhi-verification';
import {readNativeToolEntries,type NativeRunBinding} from '../events/native-tail';
import {createRunResultReadback} from '../verification/result-readback';
import {createEffectReadback} from '../verification/effect-readback';
import {createEducationReadback} from '../verification/education-readback';
import {createPracticeReadback} from '../verification/practice-readback';
import {createHanaOfficeTools} from '../../office-agent/hana-tool-adapter';
import {fileVersion,type WorkspaceLease} from '../workspace-files';
import {createAttachmentReadTools} from '../attachment-read-tools';
import {createAttachmentImportService} from '../attachment-import-service';
import {sanitizeOfficeDocumentText} from '../office-document-tools';
import {createStudentContextSanitizer} from '../../students/context-sanitizer';
import {waitForLifecycle} from '../lifecycle-wait';
import {createTaskState} from './task-state';

const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
/** Reconstruct only actual tool receipts from their immutable native owner.
 * No model, browser navigation, network fetch, approval or effect replay. */
export function createTaskResultRecheck(options:{store:OmniEduStore;dataRoot:string;nativeRoot:string;current:(id:string)=>boolean;workspace:(id:string)=>Promise<WorkspaceLease>}){
 const recheck=async(candidate:TaskCandidate|{runId:string},task:TaskView)=>waitForLifecycle('host_preparation',async signal=>{
  const {store}=options,id=task.sessionId,sql=store.xiaozhiState.sql,current=()=>options.current(id)&&!signal.aborted;
  const fence=()=>{signal.throwIfAborted();if(!current())throw Error('cancelled');};fence();
  const strict='messageId' in candidate;
  const detail=await store.getAiConversationSession(id),message=strict?detail.messages.find(m=>m.id===candidate.messageId&&m.role==='assistant'&&m.metadata.agentRunId===candidate.runId):undefined;
  const original=validTaskVerification(message?.metadata.verification,candidate.runId)?message!.metadata.verification!:undefined;
  if(detail.session.archivedAt||strict&&!original)throw Error('task_result_unverified');
  const selected=(await sql.all('SELECT student_id FROM ai_agent_runs WHERE id=? AND session_id=?',[candidate.runId,id]))[0];
  if(!selected||String(selected.student_id||'')!==String(detail.session.studentId||''))throw Error('task_source_changed');
  const base={...legacyVerification(candidate.runId),state:'needs_human' as const,reason:'human_review' as const,checkedAt:new Date().toISOString(),operations:original?.operations||{succeeded:0,failed:0},checks:original?.checks.filter(c=>c.id.startsWith('teacher:'))||[]};
  if(strict&&!original!.checks.some(c=>c.state==='passed'&&c.evidenceIds.length))return{...base,checkedAt:new Date().toISOString()};
  const bindingRow=(await sql.all('SELECT binding_json FROM xiaozhi_native_run_bindings WHERE run_id=?',[candidate.runId]))[0];if(!bindingRow)throw Error('task_result_unverified');
  const binding=JSON.parse(String(bindingRow.binding_json)) as NativeRunBinding;if(binding.sessionId!==id||binding.runId!==candidate.runId)throw Error('task_result_unverified');
  if(!strict){const runs=await createTaskState(sql,{sanitize:async()=>{throw Error('invalid_input');}}).admittedRuns(id,task.id);if(!runs.some(r=>r.runId===candidate.runId&&r.generation===binding.generation))throw Error('task_result_unverified');}
  const entries=await readNativeToolEntries(binding,options.nativeRoot);fence();
  const receipts=await sql.all('SELECT call_id,tool,phase,admitted,success,result_digest FROM xiaozhi_tool_receipts WHERE run_id=? AND generation=? LIMIT 257',[candidate.runId,binding.generation]);if(receipts.length>256)throw Error('task_result_unverified');
  if(!strict)base.operations={succeeded:receipts.filter(r=>r.phase==='settled'&&r.admitted===1&&r.success===1).length,failed:receipts.filter(r=>r.admitted===1&&(r.phase!=='settled'||r.success!==1)).length};
  const sanitize=await createStudentContextSanitizer(store),importer=createAttachmentImportService({dataRoot:options.dataRoot,state:store.xiaozhiState.attachments,imports:store.xiaozhiState.attachmentImports,isCurrent:current});
  const attachments=createAttachmentReadTools({sessionId:id,state:store.xiaozhiState.attachments,ocr:store.xiaozhiState.attachmentOcr,importer,isCurrent:current,authorize:async row=>{const value=await store.getAiConversationSession(id);return !value.session.archivedAt&&value.messages.some(m=>m.id===row.messageId&&m.role==='user'&&m.metadata.agentRunId===row.runId);},sanitize:text=>sanitizeOfficeDocumentText(store,text)});
  const files=createEffectReadback({sessionId:id,runId:candidate.runId,current,workspace:async()=>(await options.workspace(id)).path,fileLabel:async(tool,relative)=>tool==='office_create_document'?sanitizeOfficeDocumentText(store,relative):(await store.sanitizeProblemText(relative)).sanitizedText,fileText:sanitize,changes:store.xiaozhiState.changes,artifacts:store.xiaozhiState.officeArtifacts});
  const questions=createEducationReadback({sessionId:id,runId:candidate.runId,current,questions:store.questionReviews});
  const practice=createPracticeReadback({sessionId:id,runId:candidate.runId,current,practice:store.practiceReviews});
  const results=createRunResultReadback({runId:candidate.runId,bindEffect:(call,tool,payload)=>tool==='education_propose_questions'?questions(call,tool,payload)
    :tool==='education_propose_practice'?practice(call,tool,payload):files(call,tool,payload),readLocal:async(tool,payload)=>{
   fence();if(tool==='office_read_attachment'){
    const row=await store.xiaozhiState.attachments.get(id,payload.source.attachmentId);if(!row||row.version!==payload.source.version)throw Error('attachment_changed');
    const reader=attachments.find(t=>t.name===tool)!;const value=await reader.execute('task_review_readback',{id:row.id,revision:row.revision,startLine:payload.source.locator.start,lineCount:payload.source.locator.end-payload.source.locator.start+1},signal,undefined,undefined as never);if(value.isError)throw Error('evidence_missing');return value.content;
   }
   const lease=await options.workspace(id),tools=createHanaOfficeTools({workspace:lease.path,sessionId:id,runId:candidate.runId,networkAllowed:false,fileVersion}),result=await tools.execute('office_read_text','task_review_readback',{path:payload.data.source},signal);
   if(!result.success||result.data?.version!==payload.data.version)throw Error('evidence_missing');result.data!.text=await sanitize(result.data!.text as string);fence();return[{type:'text',text:JSON.stringify(result)}];
  },verifyImage:async receipt=>{
   fence();const ref=receipt.attachment;if(!ref)return false;const row=await store.xiaozhiState.attachments.get(id,ref.id),session=await store.getAiConversationSession(id);
   if(!row||row.state!=='submitted'||row.format!=='image'||row.revision!==ref.revision||row.version!==ref.version||session.session.archivedAt||!session.messages.some(m=>m.id===row.messageId&&m.role==='user'&&m.metadata.agentRunId===row.runId))return false;
   await importer.verify(id,{id:ref.id,revision:ref.revision},signal);fence();return true;
  }});
  for(const entry of entries){const receipt=receipts.find(r=>r.call_id===entry.callId&&r.tool===entry.tool&&r.phase==='settled'&&r.admitted===1&&Boolean(r.success)!==entry.failed&&r.result_digest===entry.digest);if(receipt)results.capture(entry.callId,entry.tool,{content:entry.message.content},entry.failed);}
  const images=await sql.all("SELECT event_json,event_hash FROM xiaozhi_event_journal WHERE run_id=? AND generation=? AND json_extract(event_json,'$.kind')='image_delivery' ORDER BY sequence",[candidate.runId,binding.generation]);
  for(const row of images){const raw=String(row.event_json);if(hash(raw)!==row.event_hash)throw Error('task_result_unverified');const event=JSON.parse(raw);results.image(event.image);}
  const proof=await results.finish(base,async()=>entries.map(e=>e.message));fence();return proof;
 },{timeoutMs:15000});
 return Object.assign((candidate:TaskCandidate,task:TaskView)=>recheck(candidate,task),{run:(runId:string,task:TaskView)=>recheck({runId},task)});
}
