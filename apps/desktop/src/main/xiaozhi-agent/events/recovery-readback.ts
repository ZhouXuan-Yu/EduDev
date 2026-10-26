import type {JournalOwner} from './journal';
import type {createPiPersistentState} from '../persistent-state';
import type {createTextChangeState} from '../text-change-state';
import type {createOfficeArtifactState} from '../office-artifact-state';
import {createEffectReadback} from '../verification/effect-readback';

/** Reuse independent teacher-confirmed ledger/disk readback. No grants are revived. */
export function createRecoveryEffectReader(state:{persistent:ReturnType<typeof createPiPersistentState>;changes:ReturnType<typeof createTextChangeState>;artifacts:ReturnType<typeof createOfficeArtifactState>}){
 return async(owner:JournalOwner,callId:string,tool:string):Promise<'matched'|'uncertain'|'not_checked'>=>{
  if(!['office_create_text','office_create_science_figure','office_edit_text','office_create_document'].includes(tool))return'not_checked';
  try{
   const workspace=await state.persistent.workspace(owner.sessionId);if(!workspace)return'uncertain';
   let payload:Record<string,unknown>,label:string;
   if(tool==='office_create_document'){
    const row=await state.artifacts.call(owner.sessionId,owner.runId,callId);if(!row||row.state!=='saved')return'uncertain';label=row.path;payload={success:true,outcome:'saved',format:row.format,artifactId:row.artifactId,file:label};
   }else{
    const row=await state.changes.call(owner.sessionId,owner.runId,callId);if(!row||row.state!=='applied')return'uncertain';label=row.path;payload={success:true,outcome:'applied',operation:row.operation,file:label};
   }
   const reader=createEffectReadback({sessionId:owner.sessionId,runId:owner.runId,current:()=>true,workspace:async()=>{const current=await state.persistent.workspace(owner.sessionId);if(!current||current.path!==workspace.path)throw Error('evidence_missing');return current.path;},fileLabel:async()=>label,changes:state.changes,artifacts:state.artifacts});
   const bound=await reader(callId,tool,payload),read=await bound.read();return read.version===bound.version&&read.digest===bound.digest?'matched':'uncertain';
  }catch{return'uncertain';}
 };
}
