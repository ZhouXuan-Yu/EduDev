import type {Sql} from './session-state';
import type {PrivateAttachment} from './attachment-state';
import {LOCAL_OCR_SCHEMA,LOCAL_OCR_ENGINE,type AttachmentOcrReview,type AttachmentOcrStatus,type LocalOcrReceipt} from '../../shared/xiaozhi-ocr';

type PrivateOcr=AttachmentOcrReview&{sessionId:string;version:string;contentSha256:string};
function parse(row:Record<string,unknown>):PrivateOcr{
 const result:PrivateOcr={schemaVersion:LOCAL_OCR_SCHEMA,attachmentId:String(row.attachment_id),sessionId:String(row.conversation_id),version:String(row.file_version),contentSha256:String(row.content_sha256),
  revision:Number(row.revision),status:String(row.status) as AttachmentOcrStatus,engine:LOCAL_OCR_ENGINE,original:String(row.original_text),corrected:String(row.corrected_text),lines:Number(row.lines),updatedAt:String(row.updated_at)};
 if(row.schema_version!==1||row.engine!==LOCAL_OCR_ENGINE||!['processing','review','approved','rejected','interrupted'].includes(result.status)
  ||!Number.isSafeInteger(result.revision)||result.revision<0||result.original.length>128000||result.corrected.length>128000
  ||!Number.isSafeInteger(result.lines)||result.lines<0||result.lines>2000||!/^[a-f0-9]{64}$/.test(result.version)||!/^[a-f0-9]{64}$/.test(result.contentSha256))throw new Error('configuration');
 return result;
}
export function publicOcr({schemaVersion,attachmentId,revision,status,engine,original,corrected,lines,updatedAt}:PrivateOcr):AttachmentOcrReview{
 return {schemaVersion,attachmentId,revision,status,engine,original,corrected,lines,updatedAt};
}
export function createAttachmentOcrState(sql:Sql){
 const get=async(row:PrivateAttachment)=>{
  const raw=(await sql.all('SELECT * FROM xiaozhi_pi_attachment_ocr WHERE conversation_id=? AND attachment_id=?',[row.sessionId,row.id]))[0];
  if(!raw)return null;const value=parse(raw);if(value.version!==row.version||value.contentSha256!==row.contentSha256)throw new Error('changed');return value;
 };
 const change=async(query:string,args:(string|number)[])=>{if(!sql.change)throw new Error('configuration');return sql.change(query,args);};
 const sourceGuard=`EXISTS(SELECT 1 FROM xiaozhi_pi_attachments a JOIN ai_conversation_sessions s ON s.id=a.conversation_id WHERE a.id=xiaozhi_pi_attachment_ocr.attachment_id AND a.conversation_id=xiaozhi_pi_attachment_ocr.conversation_id AND a.file_version=xiaozhi_pi_attachment_ocr.file_version AND a.content_sha256=xiaozhi_pi_attachment_ocr.content_sha256 AND a.state IN ('draft','submitted') AND s.archived_at IS NULL)`;
 return {get,
  async migrate(){await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_attachment_ocr(
   attachment_id TEXT PRIMARY KEY REFERENCES xiaozhi_pi_attachments(id),conversation_id TEXT NOT NULL REFERENCES ai_conversation_sessions(id),schema_version INTEGER NOT NULL CHECK(schema_version=1),
   file_version TEXT NOT NULL,content_sha256 TEXT NOT NULL,engine TEXT NOT NULL,status TEXT NOT NULL CHECK(status IN ('processing','review','approved','rejected','interrupted')),
   revision INTEGER NOT NULL CHECK(revision>=0),original_text TEXT NOT NULL,corrected_text TEXT NOT NULL,lines INTEGER NOT NULL CHECK(lines>=0 AND lines<=2000),updated_at TEXT NOT NULL)`);},
  async recover(){await sql.run("UPDATE xiaozhi_pi_attachment_ocr SET status='interrupted',revision=revision+1,updated_at=? WHERE status='processing'",[new Date().toISOString()]);},
  async begin(row:PrivateAttachment){
   if(row.format!=='image'||!['draft','submitted'].includes(row.state))throw new Error('unsupported');
   const existing=await get(row);if(existing?.status==='processing')throw new Error('busy');if(existing&&['review','approved'].includes(existing.status))return existing;
   const now=new Date().toISOString();
   await change(`INSERT INTO xiaozhi_pi_attachment_ocr(attachment_id,conversation_id,schema_version,file_version,content_sha256,engine,status,revision,original_text,corrected_text,lines,updated_at)
    SELECT a.id,a.conversation_id,1,a.file_version,a.content_sha256,?,'processing',0,'','',0,? FROM xiaozhi_pi_attachments a JOIN ai_conversation_sessions s ON s.id=a.conversation_id WHERE a.id=? AND a.conversation_id=? AND a.revision=? AND a.state IN ('draft','submitted') AND s.archived_at IS NULL
    ON CONFLICT(attachment_id) DO UPDATE SET status='processing',revision=revision+1,updated_at=excluded.updated_at WHERE status IN ('rejected','interrupted') AND file_version=excluded.file_version AND content_sha256=excluded.content_sha256`,[LOCAL_OCR_ENGINE,now,row.id,row.sessionId,row.revision]);
   const current=await get(row);if(!current||current.status!=='processing')throw new Error('changed');return current;
  },
  async finish(row:PrivateAttachment,revision:number,result:Extract<LocalOcrReceipt,{ok:true}>){
   const count=await change(`UPDATE xiaozhi_pi_attachment_ocr SET status='review',revision=revision+1,original_text=?,corrected_text=?,lines=?,updated_at=? WHERE attachment_id=? AND conversation_id=? AND revision=? AND status='processing' AND ${sourceGuard}`,
    [result.text,result.text,result.lines,new Date().toISOString(),row.id,row.sessionId,revision]);
   if(!count)throw new Error('changed');return (await get(row))!;
  },
  async interrupt(row:PrivateAttachment,revision:number){await change("UPDATE xiaozhi_pi_attachment_ocr SET status='interrupted',revision=revision+1,updated_at=? WHERE attachment_id=? AND conversation_id=? AND revision=? AND status='processing'",[new Date().toISOString(),row.id,row.sessionId,revision]);},
  async decide(row:PrivateAttachment,revision:number,decision:'approve'|'reject',text:string){
   // Approved image text is immutable after submission. A new correction requires a new attachment version.
   const count=await change(`UPDATE xiaozhi_pi_attachment_ocr SET status=?,corrected_text=?,revision=revision+1,updated_at=? WHERE attachment_id=? AND conversation_id=? AND revision=? AND (status='review' OR (status='approved' AND EXISTS(SELECT 1 FROM xiaozhi_pi_attachments a WHERE a.id=attachment_id AND a.state='draft'))) AND ${sourceGuard}`,
    [decision==='approve'?'approved':'rejected',decision==='approve'?text:'',new Date().toISOString(),row.id,row.sessionId,revision]);
   if(!count)throw new Error('changed');return (await get(row))!;
  },
 };
}
