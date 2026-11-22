import {useState} from 'react';
import {ArrowUpRight, Clock3, FileText, ListTodo} from 'lucide-react';
import type {WorkbenchHomeSummary} from '../../../shared/xiaozhi-workbench';
import {useWorkbenchSummary} from './workbench/useWorkbenchSummary';

export type HomeActivityActions = {
  firstUse: boolean;
  onOpenApprovals: () => void;
  onOpenTask: (sessionId: string) => Promise<boolean>;
  onOpenArtifact: (artifactId: string) => void;
  onOpenKnowledge: () => void;
};

const taskLabels = {active: '执行中', review_required: '待核对', paused: '已暂停', interrupted: '本轮未完成', completed: '已完成', ended: '已结束'};

function taskReason(task: NonNullable<WorkbenchHomeSummary['task']>) {
  if (task.blockedReasons.includes('pending_approval')) return '有待处理审批';
  if (task.blockedReasons.includes('unknown_effect')) return '有操作结果待核对';
  if (task.state === 'interrupted') return task.interruptedReason || '打开原对话查看中断原因和续做选项';
  return undefined;
}

export function PiHomeActivity(actions: HomeActivityActions) {
  const {value, loading, error, reload} = useWorkbenchSummary({schemaVersion: 1, kind: 'home'});
  const [opening, setOpening] = useState(false), [notice, setNotice] = useState('');
  const info = value?.kind === 'home' ? value : undefined;
  const pending = info?.pending, task = info?.task, artifacts = info?.artifacts || [];
  const reason = task && taskReason(task);

  async function openTask(sessionId: string) {
    setOpening(true);setNotice('');
    try {
      if (!await actions.onOpenTask(sessionId)) setNotice('未打开原对话，请刷新事项后重试。');
    } catch { setNotice('未打开原对话，请刷新事项后重试。'); }
    finally { setOpening(false); }
  }

  if (!loading && !error && !info?.partial && !pending && !task && !artifacts.length) {
    return actions.firstUse ? <button type="button" className="wb-start-example wb-home-import" data-testid="pi-home-import"
      onClick={actions.onOpenKnowledge}>从资料库导入教学资料 <ArrowUpRight size={15} aria-hidden="true"/></button> : null;
  }

  return <section className="wb-home-activity" aria-label="最近教学工作" data-testid="pi-home-activity">
    {loading && <p className="wb-start-hint" role="status">正在读取本地事项…</p>}
    {(error || info?.partial || notice) && <p className="wb-start-hint" role="status">{notice || (error ? '本地事项暂未读取。' : '部分本地事项暂未读取。')}
      <button type="button" className="wb-start-shortcut" onClick={()=>{setNotice('');reload();}}>重试</button></p>}
    {pending && <button type="button" className="wb-home-row" data-testid="pi-home-approval" onClick={actions.onOpenApprovals}>
      <ListTodo size={17} aria-hidden="true"/><span className="wb-home-row-text"><strong>{pending.sessionTitle || '待处理审批'}</strong><small>{pending.purpose}</small></span>
      <span className="wb-home-row-action">查看审批 <ArrowUpRight size={14} aria-hidden="true"/></span>
    </button>}
    {task && <button type="button" className="wb-home-row" data-testid="pi-home-task" data-task-id={task.taskId}
      disabled={opening} onClick={()=>void openTask(task.sessionId)}>
      <Clock3 size={17} aria-hidden="true"/><span className="wb-home-row-text"><strong>{task.sessionTitle || '教学任务'} <small>· {taskLabels[task.state]}</small></strong>
        {reason && <small>{reason}</small>}</span>
      <span className="wb-home-row-action">打开原对话 <ArrowUpRight size={14} aria-hidden="true"/></span>
    </button>}
    {artifacts.length > 0 && <div className="wb-home-recent">
      <p>最近成果</p>
      {artifacts.map(artifact => <button key={artifact.id} type="button" className="wb-home-row" data-testid="pi-home-artifact"
        data-artifact-id={artifact.id} onClick={()=>actions.onOpenArtifact(artifact.id)}>
        <FileText size={16} aria-hidden="true"/><span className="wb-home-row-text"><strong>{artifact.title}</strong></span>
        <ArrowUpRight size={14} aria-hidden="true"/>
      </button>)}
    </div>}
  </section>;
}
