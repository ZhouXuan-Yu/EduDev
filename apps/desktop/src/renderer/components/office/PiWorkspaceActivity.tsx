import { Spinner } from '@heroui/react';
import { CircleHelp } from 'lucide-react';
import type { XiaozhiWorkspaceSnapshot } from '../../../shared/xiaozhi-agent';
import { workspaceStatus } from './workspace-status';
import { useEffect, useState } from 'react';
import { formatProcessDuration } from './office-process';

/** Visible even with the inspector closed; only public committed state is read. */
export function PiWorkspaceActivity({ snapshot, compactBusy = false }: {
  snapshot?: XiaozhiWorkspaceSnapshot; compactBusy?: boolean;
}) {
  const status = workspaceStatus(snapshot, compactBusy);
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{if(!snapshot?.running)return;setNow(Date.now());const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[snapshot?.running]);
  if (!['loading', 'recovering', 'running', 'approval', 'input', 'compacting'].includes(status.state)) return null;
  const waiting = status.state === 'approval' || status.state === 'input';
  const tool = status.state === 'running'
    ? snapshot?.projection.turns.at(-1)?.items.filter(item => item.kind === 'tool' && item.status === 'inProgress').at(-1)
    : undefined;
  const activity=snapshot?.projection.turns.at(-1)?.activity;
  const elapsed=activity?Math.max(0,now-activity.since):0;
  const label = status.state === 'running'
    ? tool?.label ? `正在执行：${tool.label}` : activity?.stage==='preparing' ? '正在准备请求与核对本地资料范围' : activity?.stage==='responding' ? '正在生成回复' : '正在等待模型回复'
    : status.label;
  return <div className="pi-workspace-activity" data-testid="pi-workspace-activity" data-state={status.state}
    role="status" aria-live="polite" aria-atomic="true">
    {waiting ? <CircleHelp size={15} aria-hidden="true"/> : <Spinner size="sm" aria-hidden="true"/>}
    <span title={label}>{label}{activity&&<span aria-hidden="true"> · {formatProcessDuration(elapsed)}</span>}</span>
    {status.state==='running'&&!tool&&activity?.stage==='waiting_model'&&elapsed>=20000&&<span className="pi-wait-help">模型暂未返回文字，可继续等待或停止后调整任务。</span>}
  </div>;
}
