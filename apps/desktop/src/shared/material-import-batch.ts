export const MATERIAL_IMPORT_SCHEMA='xiaozhi.material-import-batch.v1' as const;
export type MaterialBatchState='queued'|'running'|'paused'|'completed'|'partial'|'failed';
export type MaterialBatch={id:string;name:string;status:MaterialBatchState;phase:'discover'|'archive';createdAt:string;updatedAt:string;error:string;scanned:number;archived:number;imported:number;reused:number;failed:number;skipped:number;bytes:number;archivedBytes:number;readable:number;partialReadable?:number;waiting:number;parseFailed:number};
export type MaterialBatchQuery={schemaVersion:typeof MATERIAL_IMPORT_SCHEMA;offset:number};
export type MaterialBatchPage={schemaVersion:typeof MATERIAL_IMPORT_SCHEMA;batches:MaterialBatch[];total:number;offset:number;hasMore:boolean};
export type MaterialBatchAction={schemaVersion:typeof MATERIAL_IMPORT_SCHEMA;batchId:string;action:'pause'|'resume'|'retry'};
export type MaterialBatchCreated={schemaVersion:typeof MATERIAL_IMPORT_SCHEMA;canceled:boolean;batchId?:string};
export type MaterialBatchFilesQuery={schemaVersion:typeof MATERIAL_IMPORT_SCHEMA;batchId:string;offset:number};
export type MaterialBatchFile={relativePath:string;status:'pending'|'saved'|'failed'|'skipped';resourceId:string;bytes:number;error:string};
export type MaterialBatchFiles={schemaVersion:typeof MATERIAL_IMPORT_SCHEMA;files:MaterialBatchFile[];total:number;offset:number;hasMore:boolean};
const plain=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>'value'in d);
const offset=(n:unknown)=>Number.isSafeInteger(n)&&Number(n)>=0&&Number(n)<=10000000;
export const materialBatchId=(v:unknown):v is string=>typeof v==='string'&&/^batch_[a-f0-9-]{36}$/i.test(v);
export function validBatchQuery(v:unknown):v is MaterialBatchQuery{return plain(v)&&Object.keys(v).length===2&&v.schemaVersion===MATERIAL_IMPORT_SCHEMA&&offset(v.offset);}
export function validBatchAction(v:unknown):v is MaterialBatchAction{return plain(v)&&Object.keys(v).length===3&&v.schemaVersion===MATERIAL_IMPORT_SCHEMA&&materialBatchId(v.batchId)&&['pause','resume','retry'].includes(String(v.action));}
export function validBatchFiles(v:unknown):v is MaterialBatchFilesQuery{return plain(v)&&Object.keys(v).length===3&&v.schemaVersion===MATERIAL_IMPORT_SCHEMA&&materialBatchId(v.batchId)&&offset(v.offset);}
