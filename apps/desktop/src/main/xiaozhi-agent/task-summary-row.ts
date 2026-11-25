import type {WorkbenchTaskRow} from '../../shared/xiaozhi-workbench';

export function taskSummaryRowBlocked(task:WorkbenchTaskRow) {
  return Number(!['completed','ended'].includes(task.state) &&
    (task.state==='paused' || task.state==='interrupted' || task.pendingApprovalCount!==0 || task.unknownEffectCount!==0 ||
      task.blockedReasons.some(reason=>['not_latest','goal_controls','needs_new_candidate'].includes(reason))));
}
