import {randomUUID} from 'node:crypto';
import type {Sql} from './session-state';
import {buildSessionFileSourceKey,sessionFileOwnerKey} from './vendor/hana/lib/session-files/attachment-identity';
import {XIAOZHI_ATTACHMENTS_SCHEMA,MAX_XIAOZHI_ATTACHMENTS,validAttachmentId,validAttachmentSession,validAttachmentPath,validAttachmentSelection,
 type XiaozhiAttachment,type XiaozhiAttachmentSelection,type XiaozhiAttachmentFormat} from '../../shared/xiaozhi-attachments';

export type PrivateAttachment=XiaozhiAttachment&{sessionId:string;path:string;workspaceVersion:string;contentSha256:string;sourceKey:string};
export type AttachmentCandidate=Pick<PrivateAttachment,'sessionId'|'path'|'name'|'mime'|'size'|'format'|'version'|'workspaceVersion'|'contentSha256'|'sourceKey'>;
const originalSourceKey=buildSessionFileSourceKey as unknown as (namespace:string,parts:string[])=>string;
export const attachmentIdentity=(v:Pick<AttachmentCandidate,'sessionId'|'path'|'workspaceVersion'|'version'|'contentSha256'>)=>originalSourceKey('xiaozhi-attachment',[sessionFileOwnerKey({sessionId:v.sessionId}),v.workspaceVersion,v.path,v.version,v.contentSha256]);
const hex=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const formats=new Set<XiaozhiAttachmentFormat>(['text','markdown','office','image']);
const time=(v:unknown):v is string=>typeof v==='string'&&v.length<40&&Number.isFinite(Date.parse(v));
function validateCandidate(v:AttachmentCandidate){
 if(!validAttachmentSession(v.sessionId)||!validAttachmentPath(v.path)||typeof v.name!=='string'||v.name!==v.path.split('/').at(-1)
 ||typeof v.mime!=='string'||!/^[-+.a-z0-9]+\/[-+.a-z0-9]+$/.test(v.mime)||!Number.isSafeInteger(v.size)||v.size<0||v.size>50*1048576
 ||!formats.has(v.format)||!hex(v.version)||!hex(v.workspaceVersion)||!hex(v.contentSha256)||v.sourceKey!==attachmentIdentity(v))throw new Error('configuration');
}
function parse(row:Record<string,unknown>):PrivateAttachment{
 if(row.schema_version!==1||row.delivery!=='local_only')throw new Error('configuration');
 const value:PrivateAttachment={schemaVersion:XIAOZHI_ATTACHMENTS_SCHEMA,id:String(row.id),sessionId:String(row.conversation_id),path:String(row.relative_path),name:String(row.name),mime:String(row.mime),size:Number(row.size),format:String(row.format) as XiaozhiAttachmentFormat,
  version:String(row.file_version),workspaceVersion:String(row.workspace_version),contentSha256:String(row.content_sha256),sourceKey:String(row.source_key),state:String(row.state) as PrivateAttachment['state'],revision:Number(row.revision),createdAt:String(row.created_at),updatedAt:String(row.updated_at),
  ...(row.run_id!==null?{runId:String(row.run_id)}:{}),...(row.message_id!==null?{messageId:String(row.message_id)}:{})};
 validateCandidate(value);
 if(!validAttachmentId(value.id)||!['draft','submitted','removed'].includes(value.state)||!Number.isSafeInteger(value.revision)||value.revision<0||value.revision>=Number.MAX_SAFE_INTEGER||!time(value.createdAt)||!time(value.updatedAt)
 ||(value.state==='submitted' ? !validReference(value.runId)||!validReference(value.messageId) : row.run_id!==null||row.message_id!==null))throw new Error('configuration');
 return value;
}
const validReference=(v:unknown):v is string=>typeof v==='string'&&/^[A-Za-z0-9_-]{1,128}$/.test(v);
export function publicAttachment({schemaVersion,id,name,mime,size,format,version,state,revision,createdAt,updatedAt,runId,messageId}:PrivateAttachment):XiaozhiAttachment{
 return {schemaVersion,id,name,mime,size,format,version,state,revision,createdAt,updatedAt,...(runId?{runId}:{}),...(messageId?{messageId}:{})};
}
/** SQLite is the only attachment fact source. No file writes, native sidecar or model delivery. */
export function createAttachmentState(sql:Sql){
 const get=async(sessionId:string,id:string)=>{if(!validAttachmentSession(sessionId)||!validAttachmentId(id))throw new Error('invalid_input');const row=(await sql.all('SELECT * FROM xiaozhi_pi_attachments WHERE conversation_id=? AND id=?',[sessionId,id]))[0];return row?parse(row):null;};
 const list=async(sessionId:string)=>{if(!validAttachmentSession(sessionId))throw new Error('invalid_input');return (await sql.all('SELECT * FROM xiaozhi_pi_attachments WHERE conversation_id=? ORDER BY created_at,id',[sessionId])).map(parse);};
 const change=async(query:string,args:(string|number|null)[])=>{if(!sql.change)throw new Error('configuration');return sql.change(query,args);};
 return {get,list,
  async migrate(){
   await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_attachments (
    id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES ai_conversation_sessions(id),schema_version INTEGER NOT NULL CHECK(schema_version=1),
    relative_path TEXT NOT NULL,name TEXT NOT NULL,mime TEXT NOT NULL,size INTEGER NOT NULL CHECK(size>=0 AND size<=52428800),format TEXT NOT NULL,
    workspace_version TEXT NOT NULL,file_version TEXT NOT NULL,content_sha256 TEXT NOT NULL,source_key TEXT NOT NULL,
    delivery TEXT NOT NULL CHECK(delivery='local_only'),state TEXT NOT NULL CHECK(state IN ('draft','submitted','removed')),revision INTEGER NOT NULL CHECK(revision>=0),
    run_id TEXT,message_id TEXT,created_at TEXT NOT NULL,updated_at TEXT NOT NULL,
    CHECK((state='submitted' AND run_id IS NOT NULL AND message_id IS NOT NULL) OR (state<>'submitted' AND run_id IS NULL AND message_id IS NULL)))`);
   await sql.run("CREATE UNIQUE INDEX IF NOT EXISTS xiaozhi_pi_attachments_draft_source ON xiaozhi_pi_attachments(conversation_id,source_key) WHERE state='draft'");
   await sql.run('CREATE INDEX IF NOT EXISTS xiaozhi_pi_attachments_session ON xiaozhi_pi_attachments(conversation_id,state,created_at)');
  },
  async register(v:AttachmentCandidate){
   validateCandidate(v);const id=`xiat_${randomUUID()}`,now=new Date().toISOString();
   await change(`INSERT OR IGNORE INTO xiaozhi_pi_attachments(id,conversation_id,schema_version,relative_path,name,mime,size,format,workspace_version,file_version,content_sha256,source_key,delivery,state,revision,run_id,message_id,created_at,updated_at)
    SELECT ?,?,1,?,?,?,?,?,?,?,?,?,'local_only','draft',0,NULL,NULL,?,?
    WHERE (SELECT COUNT(*) FROM xiaozhi_pi_attachments WHERE conversation_id=? AND state='draft')<?`,
    [id,v.sessionId,v.path,v.name,v.mime,v.size,v.format,v.workspaceVersion,v.version,v.contentSha256,v.sourceKey,now,now,v.sessionId,MAX_XIAOZHI_ATTACHMENTS]);
   const row=(await sql.all("SELECT * FROM xiaozhi_pi_attachments WHERE conversation_id=? AND source_key=? AND state='draft'",[v.sessionId,v.sourceKey]))[0];
   if(!row)throw new Error('busy');const result=parse(row);
   for(const key of Object.keys(v) as (keyof AttachmentCandidate)[])if(result[key]!==v[key])throw new Error('changed');return result;
  },
  async remove(sessionId:string,selection:XiaozhiAttachmentSelection){
   if(!validAttachmentSession(sessionId)||!validAttachmentSelection(selection))throw new Error('invalid_input');
   const changed=await change("UPDATE xiaozhi_pi_attachments SET state='removed',revision=revision+1,updated_at=? WHERE conversation_id=? AND id=? AND state='draft' AND revision=?",[new Date().toISOString(),sessionId,selection.id,selection.revision]);
   if(changed!==1)throw new Error('changed');return (await get(sessionId,selection.id))!;
  },
  async bind(sessionId:string,selections:XiaozhiAttachmentSelection[],runId:string,messageId:string){
   if(!validAttachmentSession(sessionId)||!Array.isArray(selections)||!selections.length||selections.length>MAX_XIAOZHI_ATTACHMENTS||!selections.every(validAttachmentSelection)||new Set(selections.map(s=>s.id)).size!==selections.length||!validReference(runId)||!validReference(messageId))throw new Error('invalid_input');
   const selection=JSON.stringify(selections),now=new Date().toISOString();
   const changed=await change(`WITH selected AS (SELECT json_extract(value,'$.id') AS id,json_extract(value,'$.revision') AS revision FROM json_each(?)),
    matched AS MATERIALIZED (SELECT a.id FROM xiaozhi_pi_attachments a JOIN selected s ON a.id=s.id AND a.revision=s.revision WHERE a.conversation_id=? AND a.state='draft')
    UPDATE xiaozhi_pi_attachments SET state='submitted',run_id=?,message_id=?,revision=revision+1,updated_at=?
    WHERE conversation_id=? AND id IN (SELECT id FROM matched) AND (SELECT COUNT(*) FROM matched)=?`,[selection,sessionId,runId,messageId,now,sessionId,selections.length]);
   // Production Sql.change is a 0/1 mutation receipt; node:sqlite test adapters may return rows.
   // The materialized count guard makes the SQL all-or-none. Validate every resulting reference.
   if(changed===0)throw new Error('changed');const results=await Promise.all(selections.map(s=>get(sessionId,s.id)));
   if(results.some((row,index)=>!row||row.state!=='submitted'||row.runId!==runId||row.messageId!==messageId||row.revision!==selections[index].revision+1))throw new Error('configuration');
   return results as PrivateAttachment[];
  },
 };
}
