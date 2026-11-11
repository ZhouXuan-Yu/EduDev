import { useToolExpansion } from './OfficeToolExpansion';
import { CircleCheck, CircleAlert, LoaderCircle, Clock3 } from 'lucide-react';
import { ChatTool, type ToolPartState } from '../../heroui-pro/components/chat-tool';
import type { OfficeProjectedItem } from '../../../shared/office-agent';
import { OfficeToolEvidence } from './OfficeToolProcess';
import { AgentToolGlyph } from './AgentToolGlyph';
import { agentToolTarget } from './agent-tool-target';
import { formatProcessDuration } from './office-process';
/** Own compact operation row, separate from the official trace example. */
export function AgentPublicTool({
  item,
  sessionId,
}: {
  item: OfficeProjectedItem;
  sessionId: string;
}) {
  const { expanded: open, onExpandedChange: setOpen, triggerProps, regionProps } = useToolExpansion('step:' + item.id, false);
  const state: ToolPartState = item.status === 'completed' ? 'output-available'
    : item.status === 'failed' || item.status === 'declined' ? 'output-error'
    : item.status === 'inProgress' ? 'input-available' : 'requires-action';
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
    <div
      {...regionProps}
      data-testid="office-tool-step"
      data-item-id={item.id}
      data-tool-name={item.toolName}
      data-operation-state={item.status}
    >
      <ChatTool state={state} isExpanded={open} onExpandedChange={setOpen}>
        <ChatTool.Trigger
          {...triggerProps}
          data-testid="agent-tool-trigger"
        >
          <AgentToolGlyph item={item} />
          <span className="edu-operation-label">{item.label || '授权工具'}</span>
          {target && <span className="edu-operation-target" data-testid="agent-tool-target">{target}</span>}
          {Boolean(item.toolAttempt?.teacherWaitMs) && (
            <span data-testid="tool-teacher-wait">
              等待确认 {formatProcessDuration(item.toolAttempt!.teacherWaitMs!)}
            </span>
          )}
          <Status
            size={14}
            aria-label={label}
            className={item.status === 'inProgress' ? 'edu-operation-running' : undefined}
          />
          <span className="edu-operation-status">{label}</span>
        </ChatTool.Trigger>
        <ChatTool.Content>
        <div
          className="edu-process-tool-evidence edu-domain"
          data-edu-domain=""
          data-testid="office-tool-evidence"
        >
          <OfficeToolEvidence item={item} sessionId={sessionId} />
        </div>
        </ChatTool.Content>
      </ChatTool>
    </div>
  );
}
