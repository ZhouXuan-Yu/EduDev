import {createHash} from 'node:crypto';
import type {Sql} from './session-state';
import {deliveryId,type DeliveryState} from '../../shared/xiaozhi-delivery';
export const deliveryHash=(value:unknown)=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export type DeliveryRef={fileId:string;kind:'text'|'office';path:string;callId:string;runId:string;draftId:string|null;carried:boolean;error?:string};
export type DeliveryRow={schemaVersion:1;id:string;sessionId:string;runId:string;callId:string;inputHash:string;revision:number;state:DeliveryState;taskVersion:string;files:DeliveryRef[];approval:string|null;parentId?:string};
const live:DeliveryState[]=['preparing','pending','approving','approved','executing'];
function parse(raw:Record<string,unknown>):DeliveryRow{
 const x=JSON.parse(String(raw.value_json)) as DeliveryRow;
 if(x.schemaVersion!==1||!deliveryId(x.id)||x.id!==raw.id||x.sessionId!==raw.session_id||x.runId!==raw.run_id||x.callId!==raw.call_id||!Number.isSafeInteger(x.revision)||x.revision<0
  ||!Array.isArray(x.files)||x.files.length<2||x.files.length>8||new Set(x.files.map(f=>f.fileId)).size!==x.files.length
  ||!['preparing','pending','approving','approved','executing','saved','partial','failed','rejected','interrupted','conflict'].includes(x.state)
  ||!x.files.every(f=>['text','office'].includes(f.kind)&&typeof f.path==='string'&&typeof f.callId==='string'&&typeof f.runId==='string'&&typeof f.carried==='boolean'
   &&(f.draftId===null||typeof f.draftId==='string'&&/^(xichange|xioffice)_[a-f0-9-]{36}$/i.test(f.draftId))))throw Error('configuration');
 return x;
}
/** Only grouping metadata. Original child ledgers own drafts, effects and file versions. */
export function createDeliveryState(sql:Sql){
 async function get(id:string){const row=(await sql.all('SELECT * FROM xiaozhi_delivery_bundles WHERE id=?',[id]))[0];return row?parse(row):null;}
 async function list(sessionId:string,runId?:string){return (await sql.all('SELECT * FROM xiaozhi_delivery_bundles WHERE session_id=?'+(runId===undefined?'':' AND run_id=?')+' ORDER BY created_at,'+(runId===undefined?'id':'rowid'),runId===undefined?[sessionId]:[sessionId,runId])).map(parse);}
 async function update(row:DeliveryRow,patch:Partial<Pick<DeliveryRow,'files'|'state'|'approval'>>){
  const next={...row,...patch,revision:row.revision+1};if(!sql.change)throw Error('configuration');
  if(await sql.change('UPDATE xiaozhi_delivery_bundles SET value_json=? WHERE id=? AND value_json=?',[JSON.stringify(next),row.id,JSON.stringify(row)])!==1)throw Error('conflict');return next;
 }
 return {get,list,update,
  async migrate(){await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_delivery_bundles(id TEXT PRIMARY KEY,session_id TEXT NOT NULL REFERENCES ai_conversation_sessions(id),run_id TEXT NOT NULL,call_id TEXT NOT NULL,value_json TEXT NOT NULL CHECK(json_valid(value_json)),created_at TEXT NOT NULL,UNIQUE(session_id,run_id,call_id))`);await sql.run('CREATE INDEX IF NOT EXISTS xiaozhi_delivery_session ON xiaozhi_delivery_bundles(session_id,created_at)');},
  async create(row:DeliveryRow){
   if(!sql.change)throw Error('configuration');
   await sql.change('INSERT OR IGNORE INTO xiaozhi_delivery_bundles(id,session_id,run_id,call_id,value_json,created_at) SELECT ?,?,?,?,?,? WHERE (SELECT count(*) FROM xiaozhi_delivery_bundles WHERE session_id=?)<64',[row.id,row.sessionId,row.runId,row.callId,JSON.stringify(row),new Date().toISOString(),row.sessionId]);
   const saved=await get(row.id);if(!saved||saved.inputHash!==row.inputHash)throw Error('conflict');return saved;
  },
  async owner(sessionId:string,draftId:string){if(typeof sessionId!=='string'||typeof draftId!=='string')return null;return (await list(sessionId)).find(row=>row.files.some(f=>f.draftId===draftId&&!f.carried))??null;},
  async recover(){
   for(const raw of await sql.all('SELECT * FROM xiaozhi_delivery_bundles')){const row=parse(raw);if(live.includes(row.state))await update(row,{state:'interrupted',approval:null});}
  }
 };
}
