import {createHash,randomUUID} from 'node:crypto';
import type {Sql} from './session-state';
import type {PrivateAttachment} from './attachment-state';
import {publicAttachment} from './attachment-state';
import type {XiaozhiAttachmentSelection} from '../../shared/xiaozhi-attachments';
import {validXiaozhiStart} from '../../shared/xiaozhi-start';

type Input={sessionId:string;commandId:string;prompt:string;hash:string;model:string;attachments:PrivateAttachment[];selections:XiaozhiAttachmentSelection[]};
const stamp=()=>new Date().toISOString();
const privateSelection=(selection:XiaozhiAttachmentSelection,row:PrivateAttachment)=>({id:selection.id,revision:selection.revision,version:row.version,sha256:row.contentSha256});
export function attachmentStartHash(sessionId:string,prompt:string,selections:XiaozhiAttachmentSelection[],rows:PrivateAttachment[]){
 const attachments=selections.map(s=>{const row=rows.find(v=>v.id===s.id);if(!row)throw new Error('attachment_changed');return privateSelection(s,row);});
 return createHash('sha256').update(JSON.stringify({sessionId,prompt,attachments})).digest('hex');
}

/** Like the existing office artifact publication trigger: one statement owns every visible fact. */
export function createAttachmentSendState(sql:Sql){
 const get=async(commandId:string)=>{
  const row=(await sql.all('SELECT * FROM xiaozhi_pi_attachment_sends WHERE command_id=?',[commandId]))[0];
  if(row&&row.schema_version!==1)throw new Error('configuration');return row;
 };
 return {get,
  async migrate(){
   await sql.run(`CREATE TABLE IF NOT EXISTS xiaozhi_pi_attachment_sends (
    command_id TEXT PRIMARY KEY REFERENCES xiaozhi_pi_commands(command_id),schema_version INTEGER NOT NULL CHECK(schema_version=1),
    conversation_id TEXT NOT NULL REFERENCES ai_conversation_sessions(id),request_hash TEXT NOT NULL,
    run_id TEXT NOT NULL UNIQUE REFERENCES ai_agent_runs(id),message_id TEXT NOT NULL UNIQUE REFERENCES ai_conversation_messages(id),
    prompt TEXT NOT NULL,model TEXT NOT NULL,selection_json TEXT NOT NULL CHECK(json_valid(selection_json) AND json_type(selection_json)='array' AND json_array_length(selection_json) BETWEEN 1 AND 8),
    created_at TEXT NOT NULL)`);
   await sql.run(`CREATE TRIGGER IF NOT EXISTS xiaozhi_pi_attachment_send_publish AFTER INSERT ON xiaozhi_pi_attachment_sends BEGIN
    SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM ai_conversation_sessions WHERE id=NEW.conversation_id AND archived_at IS NULL)
      THEN RAISE(ABORT,'attachment_permission_denied') END;
    SELECT CASE WHEN NOT EXISTS(SELECT 1 FROM xiaozhi_pi_commands WHERE command_id=NEW.command_id AND schema_version=1
      AND conversation_id=NEW.conversation_id AND request_hash=NEW.request_hash AND status='starting' AND run_id='')
      THEN RAISE(ABORT,'attachment_command_conflict') END;
    SELECT CASE WHEN (SELECT COUNT(*) FROM xiaozhi_pi_attachments WHERE conversation_id=NEW.conversation_id AND state='draft')<>json_array_length(NEW.selection_json)
      OR (SELECT COUNT(*) FROM xiaozhi_pi_attachments a JOIN json_each(NEW.selection_json) s ON a.id=json_extract(s.value,'$.id')
       AND a.revision=json_extract(s.value,'$.revision') AND a.file_version=json_extract(s.value,'$.version') AND a.content_sha256=json_extract(s.value,'$.sha256')
       WHERE a.conversation_id=NEW.conversation_id AND a.schema_version=1 AND a.delivery='local_only' AND a.state='draft')<>json_array_length(NEW.selection_json)
      THEN RAISE(ABORT,'attachment_changed') END;
    INSERT INTO ai_agent_runs(id,session_id,prompt,route,sub_intent,status,model,created_at,updated_at)
      VALUES(NEW.run_id,NEW.conversation_id,NEW.prompt,'knowledge_retrieval','pi_education','running',NEW.model,NEW.created_at,NEW.created_at);
    INSERT INTO ai_conversation_messages(id,session_id,role,content,metadata_json,created_at)
      VALUES(NEW.message_id,NEW.conversation_id,'user',NEW.prompt,json_object('agentRunId',NEW.run_id,'piVersion','xiaozhi.pi.education.v1','attachmentSendVersion',1),NEW.created_at);
    UPDATE xiaozhi_pi_attachments SET state='submitted',revision=revision+1,run_id=NEW.run_id,message_id=NEW.message_id,updated_at=NEW.created_at
      WHERE conversation_id=NEW.conversation_id AND id IN(SELECT json_extract(value,'$.id') FROM json_each(NEW.selection_json));
    UPDATE xiaozhi_pi_commands SET status='running',run_id=NEW.run_id,updated_at=NEW.created_at WHERE command_id=NEW.command_id;
    UPDATE ai_conversation_sessions SET title=CASE WHEN title='新对话' THEN substr(NEW.prompt,1,40) ELSE title END,
      last_prompt=substr(NEW.prompt,1,240),message_count=(SELECT COUNT(*) FROM ai_conversation_messages WHERE session_id=NEW.conversation_id),updated_at=NEW.created_at WHERE id=NEW.conversation_id;
   END`);
  },
  async admit(input:Input){
   if(!validXiaozhiStart({sessionId:input.sessionId,commandId:input.commandId,prompt:input.prompt,attachments:input.selections})
    ||!input.prompt.trim()||!Array.isArray(input.attachments)||typeof input.model!=='string'||!/^[-.A-Za-z0-9_]{1,120}$/.test(input.model)
    ||input.hash!==attachmentStartHash(input.sessionId,input.prompt,input.selections,input.attachments))throw new Error('invalid_input');
   let row=await get(input.commandId);
   if(row){if(row.conversation_id!==input.sessionId||row.request_hash!==input.hash)throw new Error('command_conflict');}
   else{
    if(!sql.change)throw new Error('configuration');
    const selections=input.selections.map(s=>privateSelection(s,input.attachments.find(v=>v.id===s.id)!));
    try{
     await sql.change(`INSERT INTO xiaozhi_pi_attachment_sends(command_id,schema_version,conversation_id,request_hash,run_id,message_id,prompt,model,selection_json,created_at)
      VALUES(?,1,?,?,?,?,?,?,?,?)`,[input.commandId,input.sessionId,input.hash,`run_${randomUUID()}`,`aimsg_${randomUUID()}`,input.prompt,input.model,JSON.stringify(selections),stamp()]);
    }catch(error){
     const message=error instanceof Error?error.message:'';
     if(message.includes('attachment_changed'))throw new Error('attachment_changed');
     if(message.includes('attachment_permission_denied'))throw new Error('permission_denied');
     if(message.includes('attachment_command_conflict'))throw new Error('command_conflict');
     throw new Error('configuration');
    }
    row=await get(input.commandId);
   }
   if(!row)throw new Error('configuration');
   const attached=await sql.all('SELECT id,revision,state,run_id,message_id FROM xiaozhi_pi_attachments WHERE conversation_id=? AND run_id=? AND message_id=?',[input.sessionId,String(row.run_id),String(row.message_id)]);
   if(attached.length!==input.selections.length||input.selections.some(s=>!attached.some(v=>v.id===s.id&&v.revision===s.revision+1&&v.state==='submitted')))throw new Error('configuration');
   return {runId:String(row.run_id),messageId:String(row.message_id),attachments:input.selections.map(s=>publicAttachment({...input.attachments.find(v=>v.id===s.id)!,state:'submitted',revision:s.revision+1,runId:String(row.run_id),messageId:String(row.message_id),updatedAt:String(row.created_at)}))};
  },
 };
}
