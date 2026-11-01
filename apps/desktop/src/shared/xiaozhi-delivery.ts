import type {XiaozhiChangeSummary} from './xiaozhi-changes';
import type {OfficeArtifactSummary,OfficeArtifactError} from './xiaozhi-office-artifacts';

export const DELIVERY_SCHEMA='xiaozhi.delivery.v1' as const;
export type DeliveryState='preparing'|'pending'|'approving'|'approved'|'executing'|'saved'|'partial'|'failed'|'rejected'|'interrupted'|'conflict';
export type DeliveryFile={fileId:string;kind:'text'|'office';path:string;draftId:string|null;carried:boolean;error?:string;
 change?:XiaozhiChangeSummary;artifact?:OfficeArtifactSummary;currentVersion?:{artifactId:string;path:string;version:number}};
export type DeliverySummary={schemaVersion:typeof DELIVERY_SCHEMA;id:string;runId:string;callId:string;revision:number;state:DeliveryState;
 taskVersion:string;files:DeliveryFile[];fingerprint:string;parentId?:string;continuedBy?:string;continuation?:{id:string;state:DeliveryState}};
export type DeliveryDecision={schemaVersion:typeof DELIVERY_SCHEMA;sessionId:string;bundleId:string;revision:number;fingerprint:string;action:'approve'|'reject'};
export type DeliveryResult={ok:true;value:DeliverySummary}|{ok:false;error:OfficeArtifactError};
export const deliveryId=(v:unknown):v is string=>typeof v==='string'&&/^xidelivery_[a-f0-9]{64}$/.test(v);
export const DELIVERY_CATALOG_SCHEMA='xiaozhi.delivery-catalog.v1' as const;
export type DeliveryCatalogInput={schemaVersion:typeof DELIVERY_CATALOG_SCHEMA;action:'list';offset?:number}|{schemaVersion:typeof DELIVERY_CATALOG_SCHEMA;action:'get';sessionId:string;bundleId:string};
export type DeliveryCatalogEntry={id:string;sessionId:string;title:string;createdAt:string;state:DeliveryState;paths:string[]};
export type DeliveryCatalogResult={ok:true;kind:'list';items:DeliveryCatalogEntry[];total:number;nextOffset?:number}|{ok:true;kind:'get';delivery:DeliverySummary;running:boolean}|{ok:false;error:'invalid_input'|'permission_denied'|'not_found'|'unavailable'};
export function validDeliveryCatalog(v:unknown):v is DeliveryCatalogInput{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;const x=v as Record<string,unknown>;
 if(x.schemaVersion!==DELIVERY_CATALOG_SCHEMA)return false;
 if(x.action==='list')return Object.keys(x).every(k=>['schemaVersion','action','offset'].includes(k))&&(x.offset===undefined||Number.isSafeInteger(x.offset)&&Number(x.offset)>=0&&Number(x.offset)<=100000);
 return x.action==='get'&&Object.keys(x).length===4&&Object.keys(x).every(k=>['schemaVersion','action','sessionId','bundleId'].includes(k))&&typeof x.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(x.sessionId)&&deliveryId(x.bundleId);
}
export function validDeliveryDecision(v:unknown):v is DeliveryDecision{
 if(!v||typeof v!=='object'||Array.isArray(v))return false;const x=v as Record<string,unknown>;
 return Object.keys(x).length===6&&Object.keys(x).every(k=>['schemaVersion','sessionId','bundleId','revision','fingerprint','action'].includes(k))
  &&x.schemaVersion===DELIVERY_SCHEMA&&typeof x.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(x.sessionId)&&deliveryId(x.bundleId)
  &&Number.isSafeInteger(x.revision)&&Number(x.revision)>=0&&typeof x.fingerprint==='string'&&/^[a-f0-9]{64}$/.test(x.fingerprint)&&['approve','reject'].includes(String(x.action));
}
