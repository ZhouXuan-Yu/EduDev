-- Frozen original application trigger from 20aa86656cdb5a0f85e0e11fa21863b50233fcb1; migration fixture, never a production migration.
CREATE TRIGGER IF NOT EXISTS xiaozhi_pi_attachment_send_publish AFTER INSERT ON xiaozhi_pi_attachment_sends BEGIN
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
   END
