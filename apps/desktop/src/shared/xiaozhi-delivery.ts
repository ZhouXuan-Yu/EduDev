import type {XiaozhiChangeSummary} from './xiaozhi-changes';
import type {OfficeArtifactSummary,OfficeArtifactError} from './xiaozhi-office-artifacts';

export const DELIVERY_SCHEMA='xiaozhi.delivery.v1' as const;
export type DeliveryState='preparing'|'pending'|'approving'|'approved'|'executing'|'saved'|'partial'|'failed'|'rejected'|'interrupted'|'conflict';
export type DeliveryFile={fileId:string;kind:'text'|'office';path:string;draftId:string|null;carried:boolean;error?:string;
 change?:XiaozhiChangeSummary;artifact?:OfficeArtifactSummary;currentVersion?:{artifactId:string;path:string;version:number}};
export type DeliverySummary={schemaVersion:typeof DELIVERY_SCHEMA;id:string;runId:string;callId:string;revision:number;state:DeliveryState;
 taskVersion:string;files:DeliveryFile[];fingerprint:string;parentId?:string;continuedBy?:string};
export type DeliveryDecision={schemaVersion:typeof DELIVERY_SCHEMA;sessionId:string;bundleId:string;revision:number;fingerprint:string;action:'approve'|'reject'};
export type DeliveryResult={ok:true;value:DeliverySummary}|{ok:false;error:OfficeArtifactError};
export const deliveryId=(v:unknown):v is string=>typeof v==='string'&&/^xidelivery_[a-f0-9]{64}$/.test(v);
export function validDeliveryDecision(v:unknown):v is DeliveryDecision{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;const x=v as Record<string,unknown>;
 return Object.keys(x).length===6&&Object.keys(x).every(k=>['schemaVersion','sessionId','bundleId','revision','fingerprint','action'].includes(k))
  &&x.schemaVersion===DELIVERY_SCHEMA&&typeof x.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(x.sessionId)&&deliveryId(x.bundleId)
  &&Number.isSafeInteger(x.revision)&&Number(x.revision)>=0&&typeof x.fingerprint==='string'&&/^[a-f0-9]{64}$/.test(x.fingerprint)&&['approve','reject'].includes(String(x.action));
}
