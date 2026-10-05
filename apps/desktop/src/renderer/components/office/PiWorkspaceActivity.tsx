import { Spinner } from '@heroui/react';
import { CircleHelp } from 'lucide-react';
import type { XiaozhiWorkspaceSnapshot } from '../../../shared/xiaozhi-agent';
import { workspaceStatus } from './workspace-status';

/** Visible even with the inspector closed; only public committed state is read. */
export function PiWorkspaceActivity({ snapshot, compactBusy = false }: {
  snapshot?: XiaozhiWorkspaceSnapshot; compactBusy?: boolean;
}) {
  const status = workspaceStatus(snapshot, compactBusy);
  if (!['loading', 'recovering', 'running', 'approval', 'input', 'compacting'].includes(status.state)) return null;
  const waiting = status.state === 'approval' || status.state === 'input';
  const tool = status.state === 'running'
    ? snapshot?.projection.turns.at(-1)?.items.filter(item => item.kind === 'tool' && item.status === 'inProgress').at(-1)
    : undefined;
  const label = status.state === 'running'
    ? tool?.label ? `正在执行：${tool.label}` : '正在处理你的请求'
    : status.label;
  return <div className="pi-workspace-activity" data-testid="pi-workspace-activity" data-state={status.state}
    role="status" aria-live="polite" aria-atomic="true">
    {waiting ? <CircleHelp size={15} aria-hidden="true"/> : <Spinner size="sm" aria-hidden="true"/>}
    <span title={label}>{label}</span>
  </div>;
}
