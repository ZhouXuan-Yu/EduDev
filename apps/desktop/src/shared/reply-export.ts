import type {DocumentArtifactExportResult} from './contracts';
export interface ReplyExportInput { version: 1; sessionId: string; runId: string; itemId: string; requestId: string; contentHash: string; title: string }
export type ReplyExportResult = {ok:true;artifact:DocumentArtifactExportResult}|{ok:false;error:'invalid_input'|'permission_denied'|'changed'|'cancelled'|'failed'|'busy'};
export function validReplyExport(value:unknown):value is ReplyExportInput{
  if(!value||typeof value!=='object'||Array.isArray(value))return false;
  if(Object.values(Object.getOwnPropertyDescriptors(value)).some(d=>!('value' in d))||Reflect.ownKeys(value).some(k=>typeof k!=='string'))return false;
  const v=value as Record<string,unknown>;
  return Object.keys(v).length===7&&v.version===1&&typeof v.sessionId==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(v.sessionId)
    &&typeof v.runId==='string'&&/^run_[a-f0-9-]{36}$/i.test(v.runId)&&typeof v.itemId==='string'&&v.itemId.length<=256
    &&typeof v.requestId==='string'&&/^reply_[a-f0-9-]{36}$/i.test(v.requestId)&&typeof v.contentHash==='string'&&/^[a-f0-9]{64}$/.test(v.contentHash)
    &&typeof v.title==='string'&&v.title.trim().length>0&&v.title.length<=120&&!/[\x00-\x1f]/.test(v.title);
}
