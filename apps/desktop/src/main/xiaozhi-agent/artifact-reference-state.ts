import type {Sql} from './session-state';
import {createAttachmentState, type AttachmentCandidate} from './attachment-state';
import {createAttachmentImportState, type AttachmentImportCandidate} from './attachment-import-state';

export function insertConversationSession(sql:Pick<Sql,'run'>, input:{id:string; title:string; folderId:string|null; studentId:string; timestamp:string}) {
  return sql.run(`INSERT INTO ai_conversation_sessions (
    id, folder_id, title, title_source, student_id, last_prompt, last_response_preview,
    message_count, created_at, updated_at
  ) VALUES (?, ?, ?, ?, ?, '', '', 0, ?, ?)`, [input.id,input.folderId,input.title,
    input.title==='新对话'?'automatic':'manual',input.studentId,input.timestamp,input.timestamp]);
}

export function createArtifactReferenceState(sql:Sql) {
  return {
    async publish(staged:{attachment:AttachmentCandidate; imported:AttachmentImportCandidate},signal:AbortSignal) {
      if(!sql.transaction || !staged.attachment.artifactOrigin) throw new Error('configuration');
      const sourceId=staged.attachment.artifactOrigin.sourceSessionId;
      const sessionId=staged.attachment.sessionId;
      await sql.transaction(async work=>{
        signal.throwIfAborted();
        const [source]=await work.all(`SELECT COALESCE(session.student_id,'') AS student_id
          FROM ai_conversation_sessions AS session WHERE session.id=? AND session.archived_at IS NULL
          AND (COALESCE(session.student_id,'')='' OR EXISTS (
            SELECT 1 FROM students WHERE students.id=session.student_id AND students.status='active'))`,[sourceId]);
        if(!source) throw new Error('permission_denied');
        await insertConversationSession(work,{id:sessionId,title:'新对话',folderId:null,studentId:String(source.student_id),timestamp:new Date().toISOString()});
        const imports=createAttachmentImportState(work);
        const {item,owned}=await imports.prepare(staged.imported);
        if(!owned) throw new Error('busy');
        await imports.finish(item.id,sessionId,'ready');
        await createAttachmentState(work).register(staged.attachment);
        signal.throwIfAborted();
      });
      return sessionId;
    },
  };
}
