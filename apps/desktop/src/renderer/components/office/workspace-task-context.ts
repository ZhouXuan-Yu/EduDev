import type {XiaozhiWorkspaceSnapshot} from '../../../shared/xiaozhi-agent';
import type {TaskView} from '../../../shared/xiaozhi-task';

/** A task journal event can be emitted by a read-only question's event owner. */
export function updateTaskRunIds(previous: XiaozhiWorkspaceSnapshot, task: TaskView) {
  const earlier=previous.task?.id===task.id?previous.taskRunIds??[]:[];
  return [...new Set([...earlier, task.origin.runId, task.binding?.runId, task.lastRunId]
    .filter((id):id is string=>Boolean(id)))];
}

export function workspaceTaskScope(snapshot?:XiaozhiWorkspaceSnapshot) {
  const turn=latestConversationTurn(snapshot);
  const task=snapshot?.task;
  const runIds=task?new Set(snapshot?.taskRunIds??[task.origin.runId,task.lastRunId,task.binding?.runId]):undefined;
  return task&&runIds&&(!turn||runIds.has(turn.id))?{task,runIds,turn}:undefined;
}

export function latestConversationTurn(snapshot?:XiaozhiWorkspaceSnapshot) {
  return snapshot?.projection.turns.findLast(item=>item.items.some(message=>message.kind==='message'&&message.role==='user'));
}
