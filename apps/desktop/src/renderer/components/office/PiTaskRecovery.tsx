import type {TaskView} from '../../../shared/xiaozhi-task';
import type {TaskRecoveryInspection} from '../../../shared/xiaozhi-task-recovery';
import {DisclosureCard} from '../ui/DisclosureCard';

const nativeLabels = {
  available: '原生会话记录可读取。',
  unbound: '原生会话尚未绑定。',
  missing: '原生会话记录缺失。',
  changed: '原生会话记录与当前绑定不一致。',
  invalid: '原生会话记录格式损坏或尚未写入完整。',
  unavailable: '原生会话记录暂时无法读取。',
};
const effectLabels: Record<string, string> = {
  intent: '执行意图待核对', executing: '执行中的结果待核对', unknown: '结果未知', failed: '执行失败',
};
const approvalLabels: Record<string, string> = {
  pending: '待审批', approved: '已批准', executing: '审批操作执行中', executed: '审批操作已执行',
  rejected: '已拒绝', invalidated: '审批已失效', uncertain: '审批结果未确认', failed: '审批操作失败',
};

function stateCounts(rows: {state: string}[]) {
  const counts = new Map<string, number>();
  for (const row of rows) counts.set(row.state, (counts.get(row.state) || 0) + 1);
  return [...counts];
}

/** Diagnostic facts only. Existing main-derived Task actions retain execution authority. */
export function PiTaskRecovery({task, recovery, canResume}: {task: TaskView; recovery?: TaskRecoveryInspection; canResume: boolean}) {
  if (!recovery) return null;
  const matches = recovery.schemaVersion === 1 && recovery.sessionId === task.sessionId && recovery.taskId === task.id
    && recovery.taskRevision === task.revision && recovery.requirementsVersion === task.requirementsVersion
    && recovery.automaticReplay === false;
  if (!matches) return <p role="status" className="pi-task-review-status" data-testid="pi-task-recovery-stale">恢复检查记录已变化，请重新读取后核对。</p>;
  const damaged = ['missing', 'changed', 'invalid', 'unavailable'].includes(recovery.native.state);
  const waitingApproval = recovery.approvals.some(approval => ['pending', 'rejected'].includes(approval.state));
  const needsAttention = damaged || recovery.unknownEffects.length > 0 || waitingApproval;
  return <DisclosureCard className="pi-task-steps" bodyClassName="pi-task-review-body" data-testid="pi-task-recovery"
    defaultExpanded={needsAttention} title={<>恢复记录{damaged ? ' · 会话记录需要核对' : recovery.unknownEffects.length ? ' · 操作结果待核对' : waitingApproval ? ' · 查看审批状态' : ''}</>}>
    {damaged ? <div role="status" data-testid="pi-task-recovery-rebuild">
      <p>{nativeLabels[recovery.native.state]}</p>
      <p>{recovery.canRebuildSession
        ? canResume ? '选择“继续剩余步骤”时将重建会话上下文，并沿用此任务。'
          : '重建会话上下文仍需通过当前任务的继续条件，请重新读取后核对。'
        : '当前任务的重建条件尚未满足，请重新读取后核对。'}</p>
    </div> : <p className="pi-task-review-status">{nativeLabels[recovery.native.state]}</p>}
    {recovery.unknownEffects.length > 0 && <div data-testid="pi-task-recovery-effects">
      <p>已有操作的结果需要核对。</p>
      <ul>{stateCounts(recovery.unknownEffects).map(([state, count]) => <li key={state}>{effectLabels[state] || state} · {count} 项</li>)}</ul>
    </div>}
    {recovery.approvals.length > 0 && <div data-testid="pi-task-recovery-approvals">
      <p>本任务审批记录</p>
      <ul>{stateCounts(recovery.approvals).map(([state, count]) => <li key={state}>{approvalLabels[state] || state} · {count} 项</li>)}</ul>
      <p className="pi-task-review-status">请沿原审批入口处理待办，继续操作时会重新核对当前权限。</p>
    </div>}
    <p className="pi-task-review-status" data-testid="pi-task-recovery-checkpoint">{recovery.checkpointId ? `检查点 · ${recovery.checkpointId}` : '暂无检查点记录'}</p>
    <p className="pi-task-review-status">自动重放已关闭，继续操作需由你发起。</p>
  </DisclosureCard>;
}
