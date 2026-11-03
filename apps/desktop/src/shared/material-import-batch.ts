export const MATERIAL_IMPORT_SCHEMA='xiaozhi.material-import-batch.v1' as const;
export type MaterialBatchState='queued'|'running'|'paused'|'completed'|'partial'|'failed';
export type MaterialBatch={id:string;name:string;status:MaterialBatchState;phase:'discover'|'archive';createdAt:string;updatedAt:string;error:string;scanned:number;archived:number;imported:number;reused:number;failed:number;skipped:number;bytes:number;archivedBytes:number;readable:number;partialReadable?:number;empty?:number;waiting:number;parseFailed:number};
export type MaterialBatchQuery={schemaVersion:typeof MATERIAL_IMPORT_SCHEMA;offset:number};
export type MaterialBatchPage={schemaVersion:typeof MATERIAL_IMPORT_SCHEMA;batches:MaterialBatch[];total:number;offset:number;hasMore:boolean};
export type MaterialBatchAction={schemaVersion:typeof MATERIAL_IMPORT_SCHEMA;batchId:string;action:'pause'|'resume'|'retry';relativePath?:string};
export type MaterialBatchCreated={schemaVersion:typeof MATERIAL_IMPORT_SCHEMA;canceled:boolean;batchId?:string};
export type MaterialBatchFileFilter='all'|'issues';
export type MaterialBatchContentState='waiting'|'readable'|'partial'|'empty'|'failed'|'unavailable';
export type MaterialBatchFilesQuery={schemaVersion:typeof MATERIAL_IMPORT_SCHEMA;batchId:string;offset:number;filter?:MaterialBatchFileFilter};
export type MaterialBatchFile={relativePath:string;status:'pending'|'saved'|'failed'|'skipped';resourceId:string;bytes:number;error:string;contentState?:MaterialBatchContentState;contentError?:string;retryable?:boolean};
export type MaterialBatchFiles={schemaVersion:typeof MATERIAL_IMPORT_SCHEMA;files:MaterialBatchFile[];total:number;offset:number;hasMore:boolean};
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>'value'in d);
const exact=(v:unknown,keys:string[],optional:string[]):v is Record<string,unknown>=>plain(v)&&keys.every(k=>Object.hasOwn(v,k))&&Object.keys(v).every(k=>keys.includes(k)||optional.includes(k));
const relativePath=(v:unknown):v is string=>typeof v==='string'&&v.length>0&&v.length<=4096&&!/[\x00-\x1f:]/.test(v)&&!v.startsWith('/')&&!v.startsWith('\\')&&v.split(/[\\/]/).every(p=>p!==''&&p!=='.'&&p!=='..');
const offset=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=10000000;
export const materialBatchId=(v:unknown):v is string=>typeof v==='string'&&/^batch_[a-f0-9-]{36}$/i.test(v);
export function validBatchQuery(v:unknown):v is MaterialBatchQuery{return plain(v)&&Object.keys(v).length===2&&v.schemaVersion===MATERIAL_IMPORT_SCHEMA&&offset(v.offset);}
export function validBatchAction(v:unknown):v is MaterialBatchAction{return exact(v,['schemaVersion','batchId','action'],['relativePath'])&&v.schemaVersion===MATERIAL_IMPORT_SCHEMA&&materialBatchId(v.batchId)&&['pause','resume','retry'].includes(String(v.action))&&(!Object.hasOwn(v,'relativePath')||v.action==='retry'&&relativePath(v.relativePath));}
export function validBatchFiles(v:unknown):v is MaterialBatchFilesQuery{return exact(v,['schemaVersion','batchId','offset'],['filter'])&&v.schemaVersion===MATERIAL_IMPORT_SCHEMA&&materialBatchId(v.batchId)&&offset(v.offset)&&(!Object.hasOwn(v,'filter')||v.filter==='all'||v.filter==='issues');}
