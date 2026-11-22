import type { TeachingFileCatalogEntry } from '../../shared/contracts';
import { XIAOZHI_ERRORS } from '../../shared/xiaozhi-projection';
import type { WorkbenchApprovalRow, WorkbenchTaskRow } from '../../shared/xiaozhi-workbench';
import { workbenchText, type WorkbenchRead } from './workbench-state';

const taskOrder = { interrupted: 0, review_required: 1, paused: 2, active: 3, completed: 4, ended: 5 };
const knownErrors = new Set<string>(Object.values(XIAOZHI_ERRORS));

export async function readWorkbenchHome(read: WorkbenchRead, tasks: WorkbenchTaskRow[], approvals: WorkbenchApprovalRow[],
  recentArtifacts?: () => Promise<TeachingFileCatalogEntry[]>) {
  const pending = approvals.filter(item => item.state === 'pending' && item.canDecide)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0];
  const task = tasks.filter(item => item.isLatestForSession && (item.continuationCandidate || item.state === 'active')
    && item.taskId !== pending?.taskId && !(pending?.taskId === null && item.sessionId === pending.sessionId))
    .sort((a, b) => taskOrder[a.state] - taskOrder[b.state] || b.updatedAt.localeCompare(a.updatedAt))[0];

  let interruptedReason: string | undefined;
  if (task?.state === 'interrupted' && read.tables.has('ai_agent_runs')) {
    const [run] = await read.sql.all('SELECT error_message FROM ai_agent_runs WHERE id=? AND session_id=? AND status=?',
      [task.lastRunId, task.sessionId, 'failed']);
    const message = run?.error_message;
    if (typeof message === 'string' && knownErrors.has(message)) interruptedReason = message;
  }

  let artifactsUnavailable = false;
  let artifacts: {id: string; title: string; updatedAt: string}[] = [];
  try {
    if (!recentArtifacts) throw Error('unavailable');
    const rows = await recentArtifacts();
    artifacts = rows.filter(row => read.sessions.has(row.sessionId) && row.status === 'exported'
      && (!row.officeVersion || row.officeVersion.currentArtifactId === row.id))
      .slice(0, 2).map(row => ({id: row.id, title: workbenchText(row.title), updatedAt: row.updatedAt}));
  } catch { artifactsUnavailable = true; }

  return {schemaVersion: 1 as const, kind: 'home' as const, asOf: read.now,
    pending: pending ? {sessionTitle: pending.sessionTitle, purpose: pending.purpose} : null,
    task: task ? {taskId: task.taskId, sessionId: task.sessionId, sessionTitle: task.sessionTitle, state: task.state,
      blockedReasons: task.blockedReasons, interruptedReason} : null,
    artifacts, partial: read.failures.length > 0 || artifactsUnavailable};
}
