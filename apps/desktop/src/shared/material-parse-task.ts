import {materialId} from './materials';
export const MATERIAL_TASK_SCHEMA='xiaozhi.material-parse-task.v1' as const;
export type MaterialTaskStatus='pending'|'running'|'succeeded'|'failed'|'cancelled';
export type MaterialTaskAction={schemaVersion:typeof MATERIAL_TASK_SCHEMA;resourceId:string;version:string;action:'prioritize'|'cancel'|'retry'};
export type MaterialTaskView={resourceId:string;version:string;title:string;status:MaterialTaskStatus;priority:number;attempt:number;error:string};
export type MaterialQueueView={schemaVersion:typeof MATERIAL_TASK_SCHEMA;tasks:MaterialTaskView[];pending:number;running:number;invalid:number};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const materialVersion=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function validMaterialTaskAction(v:unknown):v is MaterialTaskAction{return object(v)&&Object.keys(v).length===4&&v.schemaVersion===MATERIAL_TASK_SCHEMA&&materialId(v.resourceId)&&materialVersion(v.version)&&['prioritize','cancel','retry'].includes(String(v.action));}
