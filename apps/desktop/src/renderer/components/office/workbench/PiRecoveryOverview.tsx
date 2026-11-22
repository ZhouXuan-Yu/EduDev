import {useRef, useState} from 'react';
import {Button} from '@heroui/react';
import {TASK_SCHEMA, validTaskView} from '../../../../shared/xiaozhi-task';
import type {WorkbenchTaskRow, WorkbenchQuery} from '../../../../shared/xiaozhi-workbench';
import {useWorkbenchSummary} from './useWorkbenchSummary';
import {PiApprovalInbox} from './PiApprovalInbox';
import styles from '../../../ui-system/xiaozhi-workbench.module.css';

export type WorkbenchRestoreMode = 'remaining' | 'continue';
type Api = NonNullable<Window['omniEdu']>;
/** Runs in the workspace parent: selecting a session remounts its Composer subtree. */
export async function restoreWorkbenchTask(row: WorkbenchTaskRow, mode: WorkbenchRestoreMode, input: {
  api: Pick<Api, 'getXiaozhiTask' | 'resumeXiaozhiTask' | 'startXiaozhi'>;
  selectSession: (sessionId: string) => Promise<boolean>; isCurrent: () => boolean; commandId: string;
}) {
  if (!(await input.selectSession(row.sessionId)) || !input.isCurrent()) throw Error('selection_changed');
  const result = await input.api.getXiaozhiTask({sessionId: row.sessionId});
  if (!input.isCurrent()) throw Error('selection_changed');
  if (!result.ok) throw Error(result.error);
  const task = result.value.task;
  if (!validTaskView(task) || task.sessionId !== row.sessionId || task.id !== row.taskId || task.revision !== row.revision
    || task.requirementsVersion !== row.requirementsVersion || task.goal || task.binding || !row.isLatestForSession
    || ['active', 'completed', 'ended'].includes(task.state)) throw Error('changed');
  if (mode === 'remaining') {
    if (!row.resumeCandidate || !result.value.canResume) throw Error('not_ready');
    return input.api.resumeXiaozhiTask({schema: TASK_SCHEMA, sessionId: task.sessionId, taskId: task.id,
      revision: task.revision, requirementsVersion: task.requirementsVersion, commandId: input.commandId});
  }
  if (!row.continuationCandidate) throw Error('not_ready');
  return input.api.startXiaozhi({sessionId: task.sessionId, commandId: input.commandId,
    prompt: '继续核对同一任务。先读取已有来源和保存成果，核对尚未完成的要求；不要自动重放结果未知的操作。',
    continueTask: {taskId: task.id, requirementsVersion: task.requirementsVersion}});
}

const stateLabels: Record<string, string> = {active:'执行中', review_required:'待你核对', paused:'需要重新核对', interrupted:'本轮未完成', completed:'你已确认', ended:'已结束'};
const reasons: Record<string, string> = {not_latest:'历史任务，请查看原会话', goal_controls:'由原目标面板继续', active:'本轮仍在执行', completed:'已确认完成', ended:'任务已结束', pending_approval:'有待处理审批', unknown_effect:'有操作结果待核验，不会自动重放', no_remaining_steps:'没有可直接恢复的剩余步骤', needs_new_candidate:'需要继续生成并重新核对成果'};
const filters = {unfinished:'未完成', resumable:'可恢复', blocked:'需处理', completed:'已确认', ended:'已结束', all:'全部'} as const;
type Filter = Extract<WorkbenchQuery, {kind:'tasks'}>['filter'];
export function PiRecoveryOverview({activeSessionId, onOpenSession, onRestore, onApprovalChanged, restoring = false, notice = '', initialTab = 'tasks'}: {
  activeSessionId: string; onOpenSession: (id: string) => Promise<boolean>; onRestore: (row: WorkbenchTaskRow, mode: WorkbenchRestoreMode) => Promise<void>;
  onApprovalChanged: (sessionId: string) => Promise<void>; restoring?: boolean; notice?: string; initialTab?: 'tasks'|'approvals';
}) {
  const [tab, setTab] = useState(initialTab);
  return <section className={styles.root} data-testid="pi-workbench">
    <nav className={styles.actions} aria-label="恢复与待办分类"><Button size="sm" variant={tab==='tasks'?'secondary':'ghost'} onPress={()=>setTab('tasks')} data-testid="pi-workbench-tasks">任务总览</Button><Button size="sm" variant={tab==='approvals'?'secondary':'ghost'} onPress={()=>setTab('approvals')} data-testid="pi-workbench-approvals">审批收件箱</Button></nav>
    {notice && <p role="status" data-testid="pi-workbench-action-notice">{notice}</p>}
    {restoring && <p role="status">正在切换并核对所选任务…</p>}
    {tab==='tasks'?<TaskRows activeSessionId={activeSessionId} onOpenSession={onOpenSession} onRestore={onRestore} restoring={restoring}/>:<PiApprovalInbox activeSessionId={activeSessionId} onOpenSession={onOpenSession} onChanged={onApprovalChanged}/>}
  </section>;
}
function TaskRows({activeSessionId, onOpenSession, onRestore, restoring}: Pick<Parameters<typeof PiRecoveryOverview>[0], 'activeSessionId'|'onOpenSession'|'onRestore'|'restoring'>) {
  const [filter, setFilter] = useState<Filter>('unfinished'), [currentOnly, setCurrentOnly] = useState(false), [cursors, setCursors] = useState<string[]>([]);
  const [notice, setNotice] = useState(''), lock = useRef(false), [opening, setOpening] = useState(false);
  const state = useWorkbenchSummary({schemaVersion:1, kind:'tasks', filter, ...(currentOnly?{sessionId:activeSessionId}:{}), limit:20, ...(cursors.length?{cursor:cursors.at(-1)}:{})});
  const page = state.value?.kind==='tasks'?state.value:undefined;
  async function open(id: string) {if(lock.current)return; lock.current=true; setOpening(true); try {if(!await onOpenSession(id))setNotice('会话选择已变化，请重新选择。');}catch{setNotice('会话未打开，请重试。');}finally{lock.current=false;setOpening(false);}}
  return <>
    <h2>跨会话任务</h2><p className={styles.meta}>先核对已保存记录，再显式继续同一任务。不会自动重放未知操作。</p>
    <div className={styles.actions}><label className={styles.field}>任务范围<select data-testid="pi-task-filter" value={filter} onChange={event=>{setFilter(event.target.value as Filter);setCursors([]);}}>{Object.entries(filters).map(([id,label])=><option key={id} value={id}>{label}</option>)}</select></label><label className={styles.field}>会话范围<select data-testid="pi-task-session-filter" value={currentOnly?'current':'all'} onChange={event=>{setCurrentOnly(event.target.value==='current');setCursors([]);}}><option value="all">全部会话</option><option value="current" disabled={!activeSessionId}>当前会话</option></select></label><Button size="sm" variant="ghost" onPress={()=>{setCursors([]);state.reload();}} data-testid="pi-task-overview-refresh">刷新记录</Button></div>
    {state.loading&&<p role="status">正在读取任务索引…</p>}{state.error&&<p role="alert">{state.error}</p>}{notice&&<p role="alert">{notice}</p>}
    {page&&<><p data-testid="pi-task-counts" className={styles.meta}>任务总数 {page.total??'未完整核对'} · 当前筛选 {page.matched??'未完整核对'} · 已确认 {page.counts?.completed??'未完整核对'} · 已结束 {page.counts?.ended??'未完整核对'}</p>
      {page.partial&&<p role="status" className={styles.notice} data-testid="pi-task-partial">部分来源未读取，数量不代表完整记录。不可读 {page.unavailableCount}；{page.sourceFailures.map(item=>`${item.source}: ${item.code}`).join('；')}。{!page.items.length&&' 当前筛选没有可显示的记录，请点击“刷新记录”重试。'}</p>}
      {!page.partial&&!page.items.length&&<p data-testid="pi-task-overview-empty">当前筛选没有任务。</p>}
      {page.items.map(row=><article className={styles.card} key={`${row.sessionId}:${row.taskId}`} data-testid="pi-task-overview-row" data-task-id={row.taskId}><h3>{row.sessionTitle||'未命名会话'}</h3><p>{stateLabels[row.state]}</p><p className={styles.meta}>{new Date(row.updatedAt).toLocaleString()} · 待审批 {row.pendingApprovalCount??'未核对'} · 待核验操作 {row.unknownEffectCount??'未核对'}</p>{row.blockedReasons.map(reason=><p key={reason} className={styles.meta}>{reasons[reason]||reason}</p>)}{row.continuationCandidate&&<p className={styles.meta}>继续检查任务已保存的来源和成果。</p>}<div className={styles.actions}><Button size="sm" variant="ghost" isDisabled={opening||restoring} onPress={()=>void open(row.sessionId)} data-testid="pi-task-open-session">查看会话</Button>{row.resumeCandidate&&<Button size="sm" variant="secondary" isDisabled={restoring||opening} onPress={()=>void onRestore(row,'remaining')} data-testid="pi-task-overview-resume">继续剩余步骤</Button>}{row.continuationCandidate&&<Button size="sm" variant="secondary" isDisabled={restoring||opening} onPress={()=>void onRestore(row,'continue')} data-testid="pi-task-overview-continue">继续核对本任务</Button>}</div></article>)}
      <div className={styles.actions}><Button size="sm" variant="ghost" isDisabled={!cursors.length} onPress={()=>setCursors(value=>value.slice(0,-1))} data-testid="pi-task-page-prev">上一页</Button><Button size="sm" variant="ghost" isDisabled={!page.nextCursor} onPress={()=>setCursors(value=>[...value,page.nextCursor!])} data-testid="pi-task-page-next">下一页</Button></div></>}
  </>;
}
