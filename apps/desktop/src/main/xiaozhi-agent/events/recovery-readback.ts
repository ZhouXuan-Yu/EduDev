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

/** Reuse independent teacher-confirmed ledger/disk readback. No grants are revived. */
export function createRecoveryEffectReader(state:{persistent:ReturnType<typeof createPiPersistentState>;changes:ReturnType<typeof createTextChangeState>;artifacts:ReturnType<typeof createOfficeArtifactState>;dataRoot?:()=>string}){
 return async(owner:JournalOwner,callId:string,tool:string,entry?:NativeToolEntry):Promise<'matched'|'uncertain'|'not_checked'>=>{
  if(!['office_create_text','office_create_science_figure','office_edit_text','office_create_document'].includes(tool))return'not_checked';
  try{
   const workspace=async()=>{
    const grant=tool==='office_create_document'?await state.persistent.paperOutput(owner.sessionId):null;
    const legacy=grant?null:await state.persistent.workspace(owner.sessionId);
    // Resolve the existing output location without creating directories/grants.
    const root=grant?.path||legacy?.path||(state.dataRoot?path.join(conversationOutputLocation(state.dataRoot()).path,owner.sessionId):undefined);
    if(!root)throw Error('evidence_missing');
    return state.dataRoot?authorizedWorkspace(root,state.dataRoot()):root;
   };
   const expectedWorkspace=await workspace();
   let payload:Record<string,unknown>,label:string;
   if(tool==='office_create_document'){
    const row=await state.artifacts.call(owner.sessionId,owner.runId,callId);
    if(!row){
     const unchanged=entry&&entry.callId===callId&&entry.tool===tool&&!entry.failed?presentationUnchangedReceipt(entry.message.content):undefined;
     if(!unchanged)return'uncertain';
     const parent=await state.artifacts.byArtifact(owner.sessionId,unchanged.artifactId);if(!parent)return'uncertain';label=parent.path;payload={...unchanged,file:label};
    }else{if(row.state!=='saved')return'uncertain';label=row.path;payload={success:true,outcome:'saved',format:row.format,artifactId:row.artifactId,file:label};}
   }else{
    const row=await state.changes.call(owner.sessionId,owner.runId,callId);if(!row||row.state!=='applied')return'uncertain';label=row.path;payload={success:true,outcome:'applied',operation:row.operation,file:label};
   }
   const reader=createEffectReadback({sessionId:owner.sessionId,runId:owner.runId,current:()=>true,workspace:async()=>{const current=await workspace();if(current!==expectedWorkspace)throw Error('evidence_missing');return current;},fileLabel:async()=>label,changes:state.changes,artifacts:state.artifacts});
   const bound=await reader(callId,tool,payload),read=await bound.read();return read.version===bound.version&&read.digest===bound.digest?'matched':'uncertain';
  }catch{return'uncertain';}
 };
}
