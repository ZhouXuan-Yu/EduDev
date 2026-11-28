import type {TaskView} from '../../../shared/xiaozhi-task';
import {createPiMemoryScopeState} from '../memory-scope-state';
import type {Sql} from '../session-state';

const classKey=(text:string)=>text.normalize('NFKC').replace(/\s+/gu,'').toLowerCase();

/** A request for one class's previous task, without an additional action or a quoted instruction. */
export function requestedResumeClass(prompt:string){
  const match=/^(?:(?:切换(?:了)?任务后|重启后|重新打开后)(?:重启)?[,，]\s*)?(?:请)?(?:恢复|继续|接着做)(?:之前|上次|原来|刚才)\s*([\p{L}\d()（） -]{1,30}班)的(?:工作|任务)[。!！\s]*$/u.exec(prompt.normalize('NFKC').trim());
  return match?.[1].trim();
}

export async function currentClassTask(sql:Sql,sessionId:string,task:TaskView|null,requested:string){
  if(!task||task.sessionId!==sessionId||task.goal||task.requirementsVersion!==1||
    !['paused','interrupted','review_required'].includes(task.state))return;
  const scope=await createPiMemoryScopeState(sql).memoryScope(sessionId);
  if(!scope.teachingTarget)return;
  const [row]=await sql.all(`SELECT f.name,m.content,scope.updated_at FROM ai_conversation_sessions s
    JOIN ai_conversation_folders f ON f.id=s.folder_id AND COALESCE(f.archived_at,'')=''
    JOIN xiaozhi_pi_memory_scopes scope ON scope.conversation_id=s.id AND scope.version=?
    JOIN ai_conversation_messages m ON m.session_id=s.id AND m.id=? AND m.role='user' AND json_valid(m.metadata_json)
    AND json_extract(m.metadata_json,'$.agentRunId')=?
    WHERE s.id=? AND s.folder_id=? AND COALESCE(s.student_id,'')='' AND COALESCE(s.archived_at,'')=''`,
    [scope.version,task.origin.messageId,task.origin.runId,sessionId,scope.teachingTarget.folderId]);
  if(!row||classKey(String(row.name))!==classKey(requested)||
    !(Date.parse(String(row.updated_at))<=Date.parse(task.createdAt)))return;
  const source=classKey(String(row.content)).replace(/^(?:请)?(?:帮我)?(?:给|为|替)?/u,'');
  const name=classKey(requested);
  if(!source.startsWith(name)||!/^(?:准备|制作|安排|生成|设计|编写|编制|出|讲|整理|布置|复习|练习|备课|[，,:：])/u.test(source.slice(name.length)))return;
  return {taskId:task.id,requirementsVersion:task.requirementsVersion,...scope.teachingTarget,scopeVersion:scope.version};
}
