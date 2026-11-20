import type {WorkbenchApprovalRow, WorkbenchTaskRow} from '../../shared/xiaozhi-workbench';
import {taskHasRemainingSteps, type TaskView} from '../../shared/xiaozhi-task';
import {createTaskState} from './tasks/task-state';
import {createEffectState} from './effects/state';
import {workbenchFailure, workbenchRows, type WorkbenchRead} from './workbench-state';

export async function readWorkbenchTasks(read: WorkbenchRead, approvals: WorkbenchApprovalRow[]): Promise<WorkbenchTaskRow[]> {
  const tasks = createTaskState(read.sql, {sanitize: async text => text});
  const effects = createEffectState(read.sql);
  const latest = new Map<string, TaskView | null>();
  const items: WorkbenchTaskRow[] = [];
  for await (const row of workbenchRows(read, 'app_settings', 'tasks', "key GLOB 'xiaozhi.task.v1:xitask_*' AND length(key)=?", ['xiaozhi.task.v1:xitask_'.length + 64])) {
    const id = String(row.key).slice('xiaozhi.task.v1:'.length);
    try {
      const record = await tasks.summaryRecordFromRow(id, row);
      const task = record.view, session = read.sessions.get(task.sessionId);
      if (!session) continue;
      if (!latest.has(task.sessionId)) latest.set(task.sessionId, await record.latest());
      const isLatestForSession = latest.get(task.sessionId)?.id === task.id;
      const taskApprovals = approvals.filter(item => item.sessionId === session.id && (item.taskId === task.id
        || item.kind === 'legacy_copy' && record.runIds.includes(item.runId)));
      let unknownEffectCount: number | null = null;
      if (read.tables.has('xiaozhi_effects_v1')) {
        try {
          const saved = await effects.forTask(session.id, task.id);
          if (saved.some(item => item.owner.sessionId !== session.id || item.owner.taskId !== task.id)) throw Error('effect_corrupt');
          unknownEffectCount = saved.filter(item => ['intent', 'executing', 'unknown'].includes(item.state)).length;
        } catch {workbenchFailure(read, 'tasks', 'corrupt');}
      } else workbenchFailure(read, 'tasks', 'not_initialized', null);
      const pendingApprovalCount = read.failures.some(item => item.source === 'approvals') ? null
        : taskApprovals.filter(item => item.state === 'pending').length;
      const continuationCandidate = isLatestForSession && !task.goal && ['paused', 'interrupted', 'review_required'].includes(task.state);
      const resumeCandidate = continuationCandidate && taskHasRemainingSteps(task);
      const blockedReasons = [
        ...(!isLatestForSession ? ['not_latest'] : []), ...(task.goal ? ['goal_controls'] : []),
        ...(['active', 'completed', 'ended'].includes(task.state) ? [task.state] : []),
        ...(pendingApprovalCount ? ['pending_approval'] : []), ...(unknownEffectCount ? ['unknown_effect'] : []),
        ...(continuationCandidate && !resumeCandidate ? ['no_remaining_steps', 'needs_new_candidate'] : []),
      ];
      items.push({sessionId: session.id, sessionTitle: session.title, taskId: task.id, revision: task.revision,
        requirementsVersion: task.requirementsVersion, state: task.state, updatedAt: task.updatedAt,
        lastRunId: task.lastRunId || task.origin.runId, isLatestForSession, resumeCandidate, continuationCandidate,
        blockedReasons, pendingApprovalCount, unknownEffectCount, planningLevel: task.planning?.level || null, nativeInspection: 'not_checked'});
    } catch {workbenchFailure(read, 'tasks', 'corrupt');}
  }
  return items;
}
