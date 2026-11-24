import {Button} from '@heroui/react';
import type {WorkbenchTaskRow} from '../../../../shared/xiaozhi-workbench';
import {DisclosureCard} from '../../ui/DisclosureCard';
import {TaskArtifactRelations} from './TaskArtifactRelations';
import type {WorkbenchRestoreMode} from './PiRecoveryOverview';
import styles from '../../../ui-system/xiaozhi-workbench.module.css';

const states: Record<WorkbenchTaskRow['state'], string> = {
  active:'执行中', review_required:'待你核对', paused:'需要重新核对', interrupted:'本轮未完成', completed:'你已确认', ended:'已结束',
};
const nextSteps: Record<WorkbenchTaskRow['state'], string> = {
  active:'任务仍在执行，可回到对话查看进展。', review_required:'核对已有结果，再确认或提出修改。',
  paused:'先核对已保存的内容，再继续未完成事项。', interrupted:'回到原对话查看中断位置和可继续事项。',
  completed:'任务已由你确认，可展开关联成果查看文件。', ended:'任务已结束，原对话和已有成果仍可查看。',
};
const reasons: Record<string, string> = {
  not_latest:'历史任务，请查看原会话', goal_controls:'由原目标面板继续', active:'本轮仍在执行', completed:'已确认完成', ended:'任务已结束',
  pending_approval:'有待处理审批', unknown_effect:'有操作结果待核验，不会自动重放', no_remaining_steps:'没有可直接恢复的剩余步骤', needs_new_candidate:'需要继续生成并重新核对成果',
};

export function TaskOverviewCard({row, expanded, disabled, partial, onOpen, onRestore}: {
  row: WorkbenchTaskRow; expanded?: boolean; disabled: boolean; partial: boolean;
  onOpen: (sessionId: string) => void;
  onRestore?: (row: WorkbenchTaskRow, mode: WorkbenchRestoreMode) => Promise<void>;
}) {
  return <article className={styles.card} data-testid="pi-task-overview-row" data-task-id={row.taskId} data-session-id={row.sessionId}>
    <div className={styles.taskHeading}>
      <h3 className={styles.taskTitle}>{row.sessionTitle||'未命名会话'}</h3>
      <span className={styles.taskState} data-state={row.state}>{states[row.state]}</span>
    </div>
    {expanded&&row.goalExcerpt&&<p className={styles.taskExcerpt} data-testid="pi-task-overview-goal">{row.goalExcerpt}</p>}
    <p className={styles.taskNext}>{nextSteps[row.state]}</p>
    <div className={styles.actions}>
      <Button size="sm" variant={onRestore&&(row.resumeCandidate||row.continuationCandidate)?'ghost':'secondary'} isDisabled={disabled} onPress={()=>onOpen(row.sessionId)} data-testid="pi-task-open-session">{row.state==='completed'||row.state==='ended'?'查看原对话':'回到对话继续'}</Button>
      {onRestore&&row.resumeCandidate&&<Button size="sm" variant="secondary" isDisabled={disabled||partial} onPress={()=>void onRestore(row,'remaining')} data-testid="pi-task-overview-resume">继续剩余步骤</Button>}
      {onRestore&&row.continuationCandidate&&<Button size="sm" variant={row.resumeCandidate?'ghost':'secondary'} isDisabled={disabled||partial} onPress={()=>void onRestore(row,'continue')} data-testid="pi-task-overview-continue">继续核对本任务</Button>}
    </div>
    <DisclosureCard title="任务详情与要求" headingLevel={4}>
      <div className={styles.taskDetails}>
        <p>{row.sessionTitle||'未命名会话'}</p>
        <p className={styles.meta}>完整原要求及后续补充可在原对话中查看。</p>
        {row.goalExcerpt&&<p>{row.goalExcerpt}</p>}
        <p className={styles.meta}>更新于 {new Date(row.updatedAt).toLocaleString()} · 待审批 {row.pendingApprovalCount??'未核对'} · 待核验操作 {row.unknownEffectCount??'未核对'}</p>
        {expanded&&!!row.steps?.total&&<p data-testid="pi-task-overview-steps" className={styles.meta}>已核验 {row.steps.verified}/{row.steps.total} 步</p>}
        {row.blockedReasons.map(reason=><p key={reason} className={styles.meta}>{reasons[reason]||reason}</p>)}
        {row.continuationCandidate&&<p className={styles.meta}>继续检查任务已保存的来源和成果。</p>}
        <Button size="sm" variant="ghost" isDisabled={disabled} onPress={()=>onOpen(row.sessionId)}>查看完整原对话</Button>
      </div>
    </DisclosureCard>
    <TaskArtifactRelations query={{schemaVersion:1,kind:'task_artifacts',sessionId:row.sessionId,taskId:row.taskId}}/>
  </article>;
}
