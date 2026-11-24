import {Fragment, useRef, useState} from 'react';
import {Button} from '@heroui/react';
import {TASK_SCHEMA, validTaskView} from '../../../../shared/xiaozhi-task';
import {workbenchTaskGroup, type WorkbenchTaskRow, type WorkbenchQuery} from '../../../../shared/xiaozhi-workbench';
import {useWorkbenchSummary} from './useWorkbenchSummary';
import {PiApprovalInbox} from './PiApprovalInbox';
import {TaskOverviewCard} from './TaskOverviewCard';
import {AppSelect} from '../../ui/AppSelect';
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

const filters = {overview:'工作概览', unfinished:'未完成', active:'执行中', resumable:'可恢复', blocked:'需处理', completed:'已确认', ended:'已结束', all:'全部'} as const;
const groupLabels = {active:'进行中', attention:'待处理', completed:'最近完成'};
type Filter = Extract<WorkbenchQuery, {kind:'tasks'}>['filter'];
type TaskScope={sessionId:string;taskId:string};
export function PiRecoveryOverview({activeSessionId, onOpenSession, onRestore, onApprovalChanged, restoring = false, notice = '', initialTab = 'tasks', page = false, initialFilter = 'unfinished', taskScope}: {
  activeSessionId: string; onOpenSession: (id: string) => Promise<boolean>; onRestore?: (row: WorkbenchTaskRow, mode: WorkbenchRestoreMode) => Promise<void>;
  onApprovalChanged?: (sessionId: string) => Promise<void>; restoring?: boolean; notice?: string; initialTab?: 'tasks'|'approvals'; page?: boolean; initialFilter?: Filter; taskScope?:TaskScope;
}) {
  const [tab, setTab] = useState(initialTab);
  return <section className={styles.root} data-testid="pi-workbench">
    {!taskScope&&<nav className={styles.actions} aria-label="恢复与待办分类"><Button size="sm" variant={tab==='tasks'?'secondary':'ghost'} onPress={()=>setTab('tasks')} data-testid="pi-workbench-tasks">任务总览</Button><Button size="sm" variant={tab==='approvals'?'secondary':'ghost'} onPress={()=>setTab('approvals')} data-testid="pi-workbench-approvals">审批收件箱</Button></nav>}
    {notice && <p role="status" data-testid="pi-workbench-action-notice">{notice}</p>}
    {restoring && <p role="status">正在切换并核对所选任务…</p>}
    {tab==='tasks'?<TaskRows activeSessionId={activeSessionId} onOpenSession={onOpenSession} onRestore={onRestore} restoring={restoring} page={page} initialFilter={initialFilter} taskScope={taskScope}/>:<PiApprovalInbox activeSessionId={activeSessionId} onOpenSession={onOpenSession} onChanged={onApprovalChanged}/>}
  </section>;
}
function TaskRows({activeSessionId, onOpenSession, onRestore, restoring, page: expanded, initialFilter, taskScope}: Pick<Parameters<typeof PiRecoveryOverview>[0], 'activeSessionId'|'onOpenSession'|'onRestore'|'restoring'|'page'|'initialFilter'|'taskScope'>) {
  const [filter, setFilter] = useState<Filter>(initialFilter || 'unfinished'), [currentOnly, setCurrentOnly] = useState(false), [cursors, setCursors] = useState<string[]>([]);
  const [notice, setNotice] = useState(''), lock = useRef(false), [opening, setOpening] = useState(false);
  const state = useWorkbenchSummary(taskScope?{schemaVersion:1,kind:'tasks',filter:'all',...taskScope}:
    {schemaVersion:1, kind:'tasks', filter, ...(currentOnly?{sessionId:activeSessionId}:{}), limit:20, ...(cursors.length?{cursor:cursors.at(-1)}:{})});
  const page = state.value?.kind==='tasks'?state.value:undefined;
  const items=page?.items ?? [];
  const visible=filter==='overview' ? (Object.keys(groupLabels) as (keyof typeof groupLabels)[])
    .flatMap(group=>items.filter(row=>workbenchTaskGroup(row.state)===group)) : items;
  async function open(id: string) {if(lock.current)return; lock.current=true; setOpening(true); try {if(!await onOpenSession(id))setNotice('会话选择已变化，请重新选择。');}catch{setNotice('会话未打开，请重试。');}finally{lock.current=false;setOpening(false);}}
  return <>
    {!expanded&&<><h2>跨会话任务</h2><p className={styles.meta}>先核对已保存记录，再显式继续同一任务。不会自动重放未知操作。</p></>}
    {!taskScope&&<div className={styles.actions}>
      <div className={styles.taskFilter}><AppSelect label="任务范围" testId="pi-task-filter" value={filter} options={Object.entries(filters).map(([id,label])=>({id,label}))} onChange={value=>{if(value in filters){setFilter(value as Filter);setCursors([]);}}}/></div>
      <div className={styles.taskFilter}><AppSelect label="会话范围" testId="pi-task-session-filter" value={currentOnly?'current':'all'} options={[{id:'all',label:'全部会话'},{id:'current',label:'当前会话',disabled:!activeSessionId}]} onChange={value=>{setCurrentOnly(value==='current');setCursors([]);}}/></div>
      <Button size="sm" variant="ghost" onPress={()=>{setCursors([]);state.reload();}} data-testid="pi-task-overview-refresh">刷新记录</Button></div>}
    {state.loading&&<p role="status">正在读取任务索引…</p>}{state.error&&<div role="alert">{state.error}<Button size="sm" variant="ghost" onPress={state.reload}>重试读取</Button></div>}{notice&&<p role="alert">{notice}</p>}
    {page&&<>{!taskScope&&<p data-testid="pi-task-counts" className={styles.meta}>任务总数 {page.total??'未完整核对'} · 当前筛选 {page.matched??'未完整核对'} · 已确认 {page.counts?.completed??'未完整核对'} · 已结束 {page.counts?.ended??'未完整核对'}</p>}
      {page.partial&&<p role="status" className={styles.notice} data-testid="pi-task-partial">部分任务正在核对或暂不可读。显示的任务可能尚未更新。{!items.length&&' 当前没有可显示的记录。'}请点击“刷新记录”重试。</p>}
      {!page.partial&&!page.items.length&&<div data-testid="pi-task-overview-empty"><p>{page.total===0?'还没有任务。可以从「问小智」提出教学需求。':'当前筛选没有任务，可切换到「全部」查看。'}</p>{page.total!==0&&<Button size="sm" variant="ghost" onPress={()=>{setFilter('all');setCurrentOnly(false);setCursors([]);}}>清除筛选</Button>}</div>}
      {visible.map((row,index)=><Fragment key={`${row.sessionId}:${row.taskId}`}>
        {filter==='overview'&&(!index||workbenchTaskGroup(row.state)!==workbenchTaskGroup(visible[index-1].state))
          &&<h3 data-testid="pi-task-overview-group">{groupLabels[workbenchTaskGroup(row.state)]}</h3>}
        <TaskOverviewCard row={row} expanded={expanded} disabled={Boolean(opening||restoring)} partial={page.partial} onOpen={id=>void open(id)} onRestore={onRestore}/></Fragment>)}
      {!taskScope&&<div className={styles.actions}><Button size="sm" variant="ghost" isDisabled={!cursors.length} onPress={()=>setCursors(value=>value.slice(0,-1))} data-testid="pi-task-page-prev">上一页</Button><Button size="sm" variant="ghost" isDisabled={!page.nextCursor} onPress={()=>setCursors(value=>[...value,page.nextCursor!])} data-testid="pi-task-page-next">下一页</Button></div>}</>}
  </>;
}
