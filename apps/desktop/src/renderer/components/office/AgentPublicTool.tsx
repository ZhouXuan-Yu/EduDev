import { useToolExpansion } from './OfficeToolExpansion';
import { CircleCheck, CircleAlert, LoaderCircle, Clock3, ChevronRight } from 'lucide-react';
import type { OfficeProjectedItem } from '../../../shared/office-agent';
import { OfficeToolEvidence } from './OfficeToolProcess';
import { AgentToolGlyph } from './AgentToolGlyph';
import { agentToolTarget } from './agent-tool-target';
/** Own compact operation row, separate from the official trace example. */
export function AgentPublicTool({
  item,
  sessionId,
}: {
  item: OfficeProjectedItem;
  sessionId: string;
}) {
  const { expanded: open, onExpandedChange: setOpen, triggerProps, regionProps } = useToolExpansion<HTMLElement>('step:' + item.id, false);
  const target = agentToolTarget(item);
  const label =
    item.status === 'completed'
      ? '已完成'
      : item.status === 'failed'
        ? '未完成'
        : item.status === 'declined'
          ? '已拒绝'
          : item.status === 'waiting_input'
            ? '等待补充'
            : item.status === 'waiting_approval'
              ? '等待确认'
              : item.status === 'inProgress'
                ? '正在执行'
                : '等待状态同步';
  const Status =
    item.status === 'completed'
      ? CircleCheck
      : item.status === 'failed'
        ? CircleAlert
        : item.status === 'inProgress'
          ? LoaderCircle
          : Clock3;
  return (
    <details
      {...regionProps}
      className="edu-process-tool"
      open={open}
      onToggle={(e) => setOpen(e.currentTarget.open)}
      data-testid="office-tool-step"
      data-item-id={item.id}
      data-tool-name={item.toolName}
      data-operation-state={item.status}
    >
      <summary
        {...triggerProps}
        className="edu-process-tool-label"
        data-testid="agent-tool-trigger"
        aria-expanded={open}
      >
        <AgentToolGlyph item={item} />
        <span className="edu-operation-label">{item.label || '授权工具'}</span>
        {target && <span className="edu-operation-target" data-testid="agent-tool-target">{target}</span>}
        <Status
          size={14}
          aria-label={label}
          className={item.status === 'inProgress' ? 'edu-operation-running' : undefined}
        />
        <span className="edu-operation-status">{label}</span>
        <ChevronRight className="edu-operation-chevron" size={14} aria-hidden="true" data-expanded={open} />
      </summary>
      <div
        className="edu-process-tool-evidence edu-domain"
        data-edu-domain=""
        data-testid="office-tool-evidence"
      >
        <OfficeToolEvidence item={item} sessionId={sessionId} />
      </div>
    </details>
  );
}
