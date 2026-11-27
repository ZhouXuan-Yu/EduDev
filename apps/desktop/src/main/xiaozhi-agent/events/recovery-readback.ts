import type {JournalOwner} from './journal';
import type {createPiPersistentState} from '../persistent-state';
import type {createTextChangeState} from '../text-change-state';
import type {createOfficeArtifactState} from '../office-artifact-state';
import {createEffectReadback} from '../verification/effect-readback';
import path from 'node:path';
import {conversationOutputLocation} from '../conversation-output-path';
import {authorizedWorkspace} from '../workspace-authority';
import {presentationUnchangedReceipt} from '../../../shared/xiaozhi-presentation-edit';
import type {NativeToolEntry} from './native-tail';
import type {Sql} from '../session-state';
import {createExecutionEffectReader} from '../effects/readback';
import {createAcquisitionPrepareEffectReader} from '../capabilities/acquisition/prepare-receipts';
import {readTeachingHandoutEffect} from '../../education/teaching-handout-state';
import {readHandoutEditEffect} from '../../education/teaching-handout-edit-state';
import {PROPOSE_HANDOUT_EDIT} from '../../../shared/teaching-handout-edit';
import {BUILD_MOCK_EXAM_CATALOG} from '../../../shared/mock-exam-compilation';
import {readMockExamEffect} from '../../education/mock-exam-state';
import {readMockExamEditEffect} from '../../education/mock-exam-edit-state';
import {PROPOSE_MOCK_EXAM_EDIT} from '../../../shared/mock-exam-edit';
import {TEACHING_HANDOUT_TOOL} from '../../../shared/teaching-handout';
import {isDeepStrictEqual} from 'node:util';
import {EXPORT_MOCK_EXAM,MOCK_EXAM_OFFICE_SCHEMA} from '../../../shared/mock-exam-export';
import {EXPORT_TEACHING_HANDOUT} from '../../../shared/teaching-handout-export';
import {isPaperOfficeDraft,isTeachingHandoutOfficeDraft} from '../../../shared/xiaozhi-office-draft';
import {PAPER_EXPORT_TOOL} from '../../../shared/paper-export';
import {createDeliveryState,deliveryHash} from '../delivery-state';
import {mockExamDelivery} from '../mock-exam-delivery-resume';
import {createDeliveryReadback} from '../verification/delivery-readback';

/** Reuse independent teacher-confirmed ledger/disk readback. No grants are revived. */
export function createRecoveryEffectReader(state:{liveNavigation?:(sessionId:string,runId:string,callId:string)=>boolean;persistent:ReturnType<typeof createPiPersistentState>;changes:ReturnType<typeof createTextChangeState>;artifacts:ReturnType<typeof createOfficeArtifactState>;dataRoot?:()=>string;sql?:Sql}){
 const acquisitionReader=state.sql?createAcquisitionPrepareEffectReader(state.sql):undefined;
 const executionReader=state.sql?createExecutionEffectReader(state.sql):undefined;
 return async(owner:JournalOwner,callId:string,tool:string,entry?:NativeToolEntry):Promise<'matched'|'uncertain'|'not_checked'>=>{
  if(tool==='office_browser')return state.liveNavigation?.(owner.sessionId,owner.runId,callId)?'matched':'uncertain';
  if(tool===TEACHING_HANDOUT_TOOL)return state.sql?readTeachingHandoutEffect(state.sql,owner,callId):'uncertain';
  if(tool===PROPOSE_HANDOUT_EDIT)return state.sql?readHandoutEditEffect(state.sql,owner,callId):'uncertain';
  if(tool===BUILD_MOCK_EXAM_CATALOG)return state.sql?readMockExamEffect(state.sql,owner,callId):'uncertain';
  if(tool===PROPOSE_MOCK_EXAM_EDIT)return state.sql?readMockExamEditEffect(state.sql,owner,callId):'uncertain';
  if(acquisitionReader){const checked=await acquisitionReader(owner,callId,tool);if(checked!=='not_checked')return checked;}
  if(executionReader){const checked=await executionReader(owner,callId,tool);if(checked!=='not_checked')return checked;}
  if(!['office_create_text','office_create_science_figure','office_edit_text','office_create_document','office_deliver_files',PAPER_EXPORT_TOOL,EXPORT_TEACHING_HANDOUT,EXPORT_MOCK_EXAM].includes(tool))return'not_checked';
  try{
   const continuation=tool==='office_deliver_files';
   const restoredBundle=continuation&&state.sql?await createDeliveryState(state.sql).get('xidelivery_'+deliveryHash([owner.sessionId,owner.runId,callId])):null;
   if(continuation&&(!restoredBundle?.parentId||!await mockExamDelivery(restoredBundle,state.artifacts)))return'not_checked';
   const workspace=async()=>{
    const grant=tool==='office_create_document'||tool===PAPER_EXPORT_TOOL?await state.persistent.paperOutput(owner.sessionId):null;
    const legacy=grant?null:await state.persistent.workspace(owner.sessionId);
    // Resolve the existing output location without creating directories/grants.
    const root=grant?.path||legacy?.path||(state.dataRoot?path.join(conversationOutputLocation(state.dataRoot()).path,owner.sessionId):undefined);
    if(!root)throw Error('evidence_missing');
    return state.dataRoot?authorizedWorkspace(root,state.dataRoot()):root;
   };
   const expectedWorkspace=await workspace();
   if(tool===EXPORT_TEACHING_HANDOUT||tool===EXPORT_MOCK_EXAM||tool==='office_deliver_files'){
    const mockExam=continuation||tool===EXPORT_MOCK_EXAM;
    const files={sessionId:owner.sessionId,runId:owner.runId,current:()=>true,workspace:async()=>{
     const current=await workspace();if(current!==expectedWorkspace)throw Error('evidence_missing');return current;
    },fileLabel:async(_tool:string,label:string)=>label,changes:state.changes,artifacts:state.artifacts};
    const row=continuation?null:await state.artifacts.call(owner.sessionId,owner.runId,callId);
    if(row){
     if(row.state!=='saved'||(mockExam?row.draft.schemaVersion!==MOCK_EXAM_OFFICE_SCHEMA:!isTeachingHandoutOfficeDraft(row.draft)))return'uncertain';
     const binding=await createEffectReadback(files)(callId,'office_create_document',
      {success:true,outcome:'saved',format:row.format,artifactId:row.artifactId,file:row.path});
     const read=await binding.read();
     return read.version===binding.version&&read.digest===binding.digest?'matched':'uncertain';
    }
    if(!state.sql)return continuation?'not_checked':'uncertain';
    const deliveries=createDeliveryState(state.sql);
    const bundle=restoredBundle??await deliveries.get('xidelivery_'+deliveryHash([owner.sessionId,owner.runId,callId]));
    if(!bundle||bundle.files.length!==2||bundle.files.some(file=>file.kind!=='office'||!continuation&&file.carried||!file.draftId))return'uncertain';
    const saved=await Promise.all(bundle.files.map(file=>state.artifacts.get(file.draftId!)));
    if(mockExam){
     const sources=saved.flatMap(item=>item?.draft.schemaVersion===MOCK_EXAM_OFFICE_SCHEMA?[item.draft.mockExamSource]:[]);
     if(sources.length!==2||!isDeepStrictEqual(sources[0],sources[1])||saved[0]?.format===saved[1]?.format)return'uncertain';
    }else{
     const drafts=saved.flatMap(item=>item&&isTeachingHandoutOfficeDraft(item.draft)?[item.draft.handoutSource]:[]);
     if(drafts.length!==2||drafts[0].bookId!==drafts[1].bookId||drafts[0].versionId!==drafts[1].versionId||
       drafts[0].digest!==drafts[1].digest||drafts[0].audience===drafts[1].audience)return'uncertain';
    }
    const binding=await createDeliveryReadback({...files,state:deliveries}).bind(callId,{bundleId:bundle.id,outcome:'saved',
     files:bundle.files.map(file=>({fileId:file.fileId,file:file.path,carried:file.carried}))});
    const read=await binding.read();
    return read.version===binding.version&&read.digest===binding.digest?'matched':'uncertain';
   }
   let payload:Record<string,unknown>,label:string;
   if(tool==='office_create_document'||tool===PAPER_EXPORT_TOOL){
    const row=await state.artifacts.call(owner.sessionId,owner.runId,callId);
    if(tool===PAPER_EXPORT_TOOL){
     if(!state.sql||!row||row.state!=='saved'||!row.artifactId||!isPaperOfficeDraft(row.draft))return'uncertain';
     const {paperId,digest,audience}=row.draft.paperSource;
     const [lineage]=await state.sql.all('SELECT draft_id,paper_id,paper_digest,audience FROM document_artifact_paper_sources WHERE artifact_id=?',[row.artifactId]);
     if(!lineage||lineage.draft_id!==row.id||lineage.paper_id!==paperId||lineage.paper_digest!==digest||lineage.audience!==audience)return'uncertain';
    }
    if(!row){
     const unchanged=entry&&entry.callId===callId&&entry.tool===tool&&!entry.failed?presentationUnchangedReceipt(entry.message.content):undefined;
     if(!unchanged)return'uncertain';
     const parent=await state.artifacts.byArtifact(owner.sessionId,unchanged.artifactId);if(!parent)return'uncertain';label=parent.path;payload={...unchanged,file:label};
    }else{if(row.state!=='saved')return'uncertain';label=row.path;payload={success:true,outcome:'saved',format:row.format,artifactId:row.artifactId,file:label};}
   }else{
    const row=await state.changes.call(owner.sessionId,owner.runId,callId);if(!row||row.state!=='applied')return'uncertain';label=row.path;payload={success:true,outcome:'applied',operation:row.operation,file:label};
   }
   const reader=createEffectReadback({sessionId:owner.sessionId,runId:owner.runId,current:()=>true,workspace:async()=>{const current=await workspace();if(current!==expectedWorkspace)throw Error('evidence_missing');return current;},fileLabel:async()=>label,changes:state.changes,artifacts:state.artifacts});
   const bound=await reader(callId,tool===PAPER_EXPORT_TOOL?'office_create_document':tool,payload),read=await bound.read();return read.version===bound.version&&read.digest===bound.digest?'matched':'uncertain';
  }catch{return'uncertain';}
 };
}
