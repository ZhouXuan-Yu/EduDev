import {randomUUID} from 'node:crypto';
import path from 'node:path';
import type {Sql} from './session-state';
import {validAttachmentSession,validAttachmentPath} from '../../shared/xiaozhi-attachments';
import {buildSessionFileSourceKey,sessionFileOwnerKey} from './vendor/hana/lib/session-files/attachment-identity';

export type AttachmentImport={id:string;sessionId:string;sourceKey:string;originalPath:string;originalVersion:string;originalSha256:string;relativePath:string;
 size:number;mime:string;state:'staging'|'ready'|'interrupted';createdAt:string;updatedAt:string};
export type AttachmentImportCandidate=Omit<AttachmentImport,'id'|'state'|'createdAt'|'updatedAt'>;
const hex=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
const validSourceKey=(v:unknown):v is string=>typeof v==='string'&&/^xiaozhi-inbound:[a-f0-9]{64}$/.test(v);
const sourceKey=buildSessionFileSourceKey as unknown as (namespace:string,parts:string[])=>string;
export const attachmentImportIdentity=(v:Pick<AttachmentImportCandidate,'sessionId'|'originalPath'|'originalVersion'|'originalSha256'>)=>sourceKey('xiaozhi-inbound',[
 sessionFileOwnerKey({sessionId:v.sessionId}),process.platform==='win32'?v.originalPath.toLowerCase():v.originalPath,v.originalVersion,v.originalSha256]);
function validate(v:AttachmentImportCandidate){
 if(!validAttachmentSession(v.sessionId)||!validSourceKey(v.sourceKey)||!hex(v.originalVersion)||!hex(v.originalSha256)
  ||typeof v.originalPath!=='string'||!path.isAbsolute(v.originalPath)||v.originalPath.length>2048||/[\x00-\x1f]/.test(v.originalPath)
  ||!validAttachmentPath(v.relativePath)||!Number.isSafeInteger(v.size)||v.size<0||v.size>50*1048576
  ||typeof v.mime!=='string'||!/^[-+.a-z0-9]+\/[-+.a-z0-9]+$/.test(v.mime)||v.sourceKey!==attachmentImportIdentity(v))throw new Error('configuration');
}
function parse(row:Record<string,unknown>):AttachmentImport{
 if(row.schema_version!==1)throw new Error('configuration');
 const item:AttachmentImport={id:String(row.id),sessionId:String(row.conversation_id),sourceKey:String(row.source_key),originalPath:String(row.original_path),
  originalVersion:String(row.original_version),originalSha256:String(row.original_sha256),relativePath:String(row.relative_path),size:Number(row.size),mime:String(row.mime),
  state:String(row.state) as AttachmentImport['state'],createdAt:String(row.created_at),updatedAt:String(row.updated_at)};
 validate(item);if(!/^xiimport_[a-f0-9-]{36}$/i.test(item.id)||!['staging','ready','interrupted'].includes(item.state)
  ||![item.createdAt,item.updatedAt].every(t=>t.length<40&&Number.isFinite(Date.parse(t))))throw new Error('configuration');return item;
}
/** Private source grants and local copy intent; original paths never leave main. */
export function createAttachmentImportState(sql:Sql){
 const change=async(q:string,values:(string|number)[])=>{if(!sql.change)throw new Error('configuration');return sql.change(q,values);};
 const list=async(sessionId:string)=>{if(!validAttachmentSession(sessionId))throw new Error('invalid_input');return (await sql.all('SELECT * FROM xiaozhi_pi_attachment_imports WHERE conversation_id=? ORDER BY created_at,id',[sessionId])).map(parse);};
 return {list,
  async migrate(){
   await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_attachment_imports (
    id TEXT PRIMARY KEY,conversation_id TEXT NOT NULL REFERENCES ai_conversation_sessions(id),schema_version INTEGER NOT NULL CHECK(schema_version=1),
    source_key TEXT NOT NULL,original_path TEXT NOT NULL,original_version TEXT NOT NULL,original_sha256 TEXT NOT NULL,relative_path TEXT NOT NULL,
    size INTEGER NOT NULL CHECK(size>=0 AND size<=52428800),mime TEXT NOT NULL,
    state TEXT NOT NULL CHECK(state IN ('staging','ready','interrupted')),created_at TEXT NOT NULL,updated_at TEXT NOT NULL)`);
   await sql.run("CREATE UNIQUE INDEX IF NOT EXISTS xiaozhi_pi_attachment_import_source ON xiaozhi_pi_attachment_imports(conversation_id,source_key) WHERE state IN ('staging','ready')");
   await sql.run('CREATE UNIQUE INDEX IF NOT EXISTS xiaozhi_pi_attachment_import_path ON xiaozhi_pi_attachment_imports(conversation_id,relative_path)');
  },
  async current(sessionId:string,sourceKey:string){if(!validAttachmentSession(sessionId)||!validSourceKey(sourceKey))throw new Error('invalid_input');const row=(await sql.all("SELECT * FROM xiaozhi_pi_attachment_imports WHERE conversation_id=? AND source_key=? AND state IN ('staging','ready')",[sessionId,sourceKey]))[0];return row?parse(row):null;},
  async prepare(v:AttachmentImportCandidate){
   validate(v);const id=`xiimport_${randomUUID()}`,now=new Date().toISOString();
   await change(`INSERT OR IGNORE INTO xiaozhi_pi_attachment_imports(id,conversation_id,schema_version,source_key,original_path,original_version,original_sha256,relative_path,size,mime,state,created_at,updated_at)
    VALUES(?,?,1,?,?,?,?,?,?,?,'staging',?,?)`,[id,v.sessionId,v.sourceKey,v.originalPath,v.originalVersion,v.originalSha256,v.relativePath,v.size,v.mime,now,now]);
   const row=(await sql.all("SELECT * FROM xiaozhi_pi_attachment_imports WHERE conversation_id=? AND source_key=? AND state IN ('staging','ready')",[v.sessionId,v.sourceKey]))[0];
   if(!row)throw new Error('configuration');const item=parse(row);return {item,owned:item.id===id};
  },
  async finish(id:string,sessionId:string,state:'ready'|'interrupted'){
   if(!/^xiimport_[a-f0-9-]{36}$/i.test(id)||!validAttachmentSession(sessionId)||!['ready','interrupted'].includes(state))throw new Error('invalid_input');
   const changed=await change("UPDATE xiaozhi_pi_attachment_imports SET state=?,updated_at=? WHERE id=? AND conversation_id=? AND state='staging'",[state,new Date().toISOString(),id,sessionId]);
   if(changed===0)throw new Error('changed');const item=(await list(sessionId)).find(v=>v.id===id);if(item?.state!==state)throw new Error('configuration');return item;
  },
  async recover(){await change("UPDATE xiaozhi_pi_attachment_imports SET state='interrupted',updated_at=? WHERE state='staging'",[new Date().toISOString()]);},
 };
}
