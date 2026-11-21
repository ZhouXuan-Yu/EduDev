import type {PermissionApproval} from '../../../shared/xiaozhi-permissions';
import type {TaskView} from '../../../shared/xiaozhi-task';
import {workspaceTaskResource} from './resources';

/** A same-Run refusal answers the only outstanding operation. Other tasks can still ask questions. */
export function singleCopyWasDeclined(task:TaskView|null,runId:string,approvals:PermissionApproval[]):boolean {
  if (!task || task.binding?.runId !== runId) return false;
  const operation = task.criteria.filter(item => item.kind !== 'human');
  if (operation.length !== 1 || operation[0].kind !== 'saved_text' || !operation[0].resource) return false;
  if (!task.steps.some(step => step.criterionIds.includes(operation[0].id))) return false;
  return approvals.some(item => {
    const {request} = item;
    if (item.state !== 'rejected' || item.scope !== 'operation' || request.action !== 'office_copy_file'
        || request.owner.sessionId !== task.sessionId || request.owner.taskId !== task.id || request.owner.runId !== runId
        || request.owner.generation !== task.binding?.generation || request.requirementsVersion !== task.requirementsVersion) return false;
    const targets = request.files.filter(file => file.kind === 'write_target');
    if (targets.length !== 1) return false;
    try { return workspaceTaskResource(targets[0].root,targets[0].path) === operation[0].resource; }
    catch { return false; }
  });
}
