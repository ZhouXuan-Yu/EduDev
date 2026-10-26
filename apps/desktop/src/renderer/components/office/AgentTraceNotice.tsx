import { FileCheck2, Minimize2 } from 'lucide-react';
import type { OfficeProjectedItem } from '../../../shared/office-agent';
import { ChatTool } from '../../heroui-pro/components/chat-tool';

export function AgentTraceNotice({ item }: { item: OfficeProjectedItem }) {
  return (
    <ChatTool
      className="office-compaction"
      state={
        item.status === 'failed'
          ? 'output-error'
          : item.status === 'inProgress'
            ? 'input-available'
            : 'output-available'
      }
      defaultExpanded={item.status === 'failed'}
      data-state={item.status || 'completed'}
      data-item-id={item.id}
      data-testid={
        item.kind === 'compaction'
          ? 'pi-compaction-card'
          : item.kind === 'skill_isolation'
            ? 'pi-skill-isolation'
            : 'pi-memory-isolation'
      }
    >
      <ChatTool.Trigger>
        {item.kind === 'compaction' ? <Minimize2 size={15} /> : <FileCheck2 size={15} />}{' '}
        {item.label || '正在整理上下文'}
      </ChatTool.Trigger>
      <ChatTool.Content>
        <p>{item.text}</p>
      </ChatTool.Content>
    </ChatTool>
  );
}
