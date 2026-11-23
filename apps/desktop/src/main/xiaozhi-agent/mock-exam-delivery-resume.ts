import {isDeepStrictEqual} from 'node:util';
import {MOCK_EXAM_OFFICE_SCHEMA,type MockExamOfficeSource} from '../../shared/mock-exam-export';
import {deliveryId} from '../../shared/xiaozhi-delivery';
import {createDeliveryState,type DeliveryRow} from './delivery-state';
import {createOfficeArtifactState,type PrivateOfficeArtifact} from './office-artifact-state';
import type {Sql} from './session-state';

type MockExamDraft=Extract<PrivateOfficeArtifact['draft'],{mockExamSource:MockExamOfficeSource}>;
type MockExamChild=PrivateOfficeArtifact&{draft:MockExamDraft};
export const isResumableDelivery=(row:Pick<DeliveryRow,'state'>)=>['partial','interrupted','failed','conflict'].includes(row.state);

export async function mockExamDelivery(row:DeliveryRow,artifacts:Pick<ReturnType<typeof createOfficeArtifactState>,'get'>){
  const children=await Promise.all(row.files.map(ref=>ref.kind==='office'&&ref.draftId?artifacts.get(ref.draftId):null));
  const bound=(value:PrivateOfficeArtifact|null):value is MockExamChild=>value?.draft.schemaVersion===MOCK_EXAM_OFFICE_SCHEMA;
  if(!children.some(bound))return null;
  if(row.lesson||children.length!==2||!children.every(bound)||children[0].format===children[1].format)throw Error('conflict');
  const source=children[0].draft.mockExamSource;
  for(const [index,file] of children.entries()){
    const ref=row.files[index];
    if(file.sessionId!==row.sessionId||file.runId!==ref.runId||file.callId!==ref.callId||file.path!==ref.path||
      !isDeepStrictEqual(file.draft.mockExamSource,source)||ref.fileId!=='catalog_'+file.format)throw Error('conflict');
  }
  return {source,children};
}

/** Prior bundle calls may remain in the task ledger. Only the confirmed
 * continuation chain can account for them; file readback still runs at dispatch. */
export async function mockExamResumeCalls(work:Sql,sessionId:string,taskVersion:string,bundleId:string){
  const deliveries=createDeliveryState(work),artifacts=createOfficeArtifactState(work);
  const calls=new Set<string>();let id:string|undefined=bundleId,source:MockExamOfficeSource|undefined;
  while(id){
    if(!deliveryId(id)||calls.size>=64)throw Error('task_resume_invalid');
    const row=await deliveries.get(id);
    if(!row||row.sessionId!==sessionId||row.taskVersion!==taskVersion||!isResumableDelivery(row))throw Error('task_resume_invalid');
    const binding=await mockExamDelivery(row,artifacts);
    if(!binding||source&&!isDeepStrictEqual(binding.source,source))throw Error('task_resume_invalid');
    source=binding.source;
    const call=JSON.stringify([row.runId,row.callId]);
    if(calls.has(call))throw Error('task_resume_invalid');
    calls.add(call);id=row.parentId;
  }
  return calls;
}
