import {createEffectReadback,type BoundEffect} from './effect-readback';
import {createDeliveryState,deliveryHash,type DeliveryRef} from '../delivery-state';
type FileOptions=Parameters<typeof createEffectReadback>[0];

/** Each child is independently rebound to its original ledger call and current authorized disk. */
export function createDeliveryReadback(options:FileOptions&{state:ReturnType<typeof createDeliveryState>}){
 async function child(ref:DeliveryRef):Promise<BoundEffect>{
  const row=ref.draftId?(ref.kind==='text'?await options.changes.get(ref.draftId):await options.artifacts.get(ref.draftId)):null;
  if(!row||row.sessionId!==options.sessionId||row.runId!==ref.runId||row.callId!==ref.callId||row.path!==ref.path)throw Error('evidence_missing');
  const tool=ref.kind==='text'?'office_create_text':'office_create_document';
  const payload={success:true,file:await options.fileLabel(tool,row.path),outcome:ref.kind==='text'?'applied':'saved',
   ...('operation'in row?{operation:row.operation}:{format:row.format,artifactId:row.artifactId})};
  return createEffectReadback({...options,runId:ref.runId})(ref.callId,tool,payload);
 }
 async function bind(callId:string,payload:Record<string,unknown>):Promise<BoundEffect>{
  const row=typeof payload.bundleId==='string'?await options.state.get(payload.bundleId):null;
  if(!row||row.sessionId!==options.sessionId||row.runId!==options.runId||row.callId!==callId||row.state!=='saved'||!row.approval||payload.outcome!=='saved'||!Array.isArray(payload.files)||payload.files.length!==row.files.length)throw Error('evidence_missing');
  const children:BoundEffect[]=[];
  for(let i=0;i<row.files.length;i++){
   const f=row.files[i],value=payload.files[i] as Record<string,unknown>;
   if(value.fileId!==f.fileId||value.file!==await options.fileLabel(f.kind==='text'?'office_create_text':'office_create_document',f.path)||value.carried!==f.carried)throw Error('evidence_missing');
   children.push(await child(f));
  }
  const version=deliveryHash([row,children.map(c=>c.version)]),digest=deliveryHash([version,children.map(c=>c.digest)]);
  return Object.freeze({version,digest,read:async()=>{
   const current=await options.state.get(row.id);if(deliveryHash(current)!==deliveryHash(row)||!options.current())throw Error('evidence_missing');
   for(let i=0;i<children.length;i++){const actual=await children[i].read();if(actual.version!==children[i].version||actual.digest!==children[i].digest)throw Error('evidence_missing');}
   return{version,digest};
  }});
 }
 return{child,bind};
}
