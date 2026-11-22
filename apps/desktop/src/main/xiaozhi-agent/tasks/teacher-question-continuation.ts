import {createHash} from 'node:crypto';
import type {XiaozhiAgentEvent} from '../../../shared/xiaozhi-agent';
import {validTaskView} from '../../../shared/xiaozhi-task';
import type {TaskContinuation} from '../../../shared/xiaozhi-start';
import type {Sql} from '../session-state';

/** Read the task identity and requirements seen by the original question run. */
export async function teacherQuestionContinuation(sql:Sql,sessionId:string,runId:string):Promise<TaskContinuation|null> {
    const [row]=await sql.all(`SELECT e.event_json,e.event_hash FROM xiaozhi_event_journal e
      JOIN xiaozhi_event_runs r ON e.run_id=r.run_id AND e.generation=r.generation
      WHERE r.session_id=? AND r.run_id=? AND json_extract(e.event_json,'$.kind')='task'
      ORDER BY e.sequence DESC LIMIT 1`,[sessionId,runId]);
    if(!row||typeof row.event_json!=='string'||createHash('sha256').update(row.event_json).digest('hex')!==row.event_hash)return null;
    const event=JSON.parse(row.event_json) as XiaozhiAgentEvent;
    if(event.kind!=='task'||event.durability!=='committed'||event.sessionId!==sessionId||event.runId!==runId||!validTaskView(event.task))return null;
    const task=event.task;
    if(task.goal||task.sessionId!==sessionId||(task.lastRunId??task.origin.runId)!==runId)return null;
    return {taskId:task.id,requirementsVersion:task.requirementsVersion};
}
