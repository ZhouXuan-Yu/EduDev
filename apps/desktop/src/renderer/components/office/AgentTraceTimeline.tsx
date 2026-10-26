import { ListTodo } from 'lucide-react';
import type { OfficeProjectedTurn } from '../../../shared/office-agent';
import type { OfficeConversationProps } from './OfficeConversation';
import { AgentTraceText } from './AgentTraceText';
import { AgentTraceTool } from './AgentTraceTool';
import { AgentTraceNotice } from './AgentTraceNotice';
import { OfficeMarkdown } from './OfficeMarkdown';
import { agentTraceTimeline } from './agent-trace-timeline';
import { AgentReasoningDetails } from './AgentReasoningDetails';

export function AgentTraceTimeline({
  turn,
  sessionId,
  renderPlan,
}: Pick<OfficeConversationProps, 'renderPlan'> & { turn: OfficeProjectedTurn; sessionId: string }) {
  return (
    <div className="edu-process-list" data-testid="agent-trace-timeline">
      {!agentTraceTimeline(turn).some((entry) => entry.kind === 'item') &&
        turn.status === 'running' && (
          <p className="edu-process-wait" role="status" data-testid="reply-waiting">
            {turn.modelReasoning?.length ? '正在思考…' : '正在处理…'}
          </p>
        )}
      {agentTraceTimeline(turn)
        .filter((entry) => entry.kind === 'item')
        .map((entry) => {
          const { item } = entry;
          if (item.kind === 'tool')
            return <AgentTraceTool key={entry.id} item={item} sessionId={sessionId} />;
          if (item.kind === 'plan')
            return (
              <div key={entry.id}>
                {renderPlan?.(item) || (
                  <div data-testid="pi-task-plan">
                    <ListTodo size={15} />
                    任务计划<OfficeMarkdown>{item.text || ''}</OfficeMarkdown>
                  </div>
                )}
              </div>
            );
          if (['compaction', 'memory_isolation', 'skill_isolation'].includes(item.kind))
            return <AgentTraceNotice key={entry.id} item={item} />;
          return (
            <AgentTraceText
              key={entry.id}
              text={item.text || ''}
              streaming={turn.status === 'running' && item.status === 'inProgress'}
              testId="reply-process-summary"
              id={item.id}
              status={item.status}
            />
          );
        })}
      <AgentReasoningDetails turn={turn} />
    </div>
  );
}
