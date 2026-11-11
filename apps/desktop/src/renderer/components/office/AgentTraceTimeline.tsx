import { ListTodo } from 'lucide-react';
import type { OfficeProjectedTurn } from '../../../shared/office-agent';
import type { OfficeConversationProps } from './OfficeConversation';
import { AgentTraceText } from './AgentTraceText';
import { AgentPublicTool } from './AgentPublicTool';
import { AgentTraceNotice } from './AgentTraceNotice';
import { OfficeMarkdown } from './OfficeMarkdown';
import { agentTraceTimeline } from './agent-trace-timeline';

export function AgentTraceTimeline({
  turn,
  sessionId,
  renderPlan,
}: Pick<OfficeConversationProps, 'renderPlan'> & { turn: OfficeProjectedTurn; sessionId: string }) {
  const entries = agentTraceTimeline(turn);
  return (
    <div className="edu-process-list" data-testid="agent-trace-timeline">
      {!entries.length &&
        turn.status === 'running' && (
          <p className="edu-process-wait" role="status" data-testid="reply-waiting">
            正在处理…
          </p>
        )}
      {entries.map((entry) => {
          if (entry.kind === 'reasoning') {
            const { block } = entry;
            return (
              <AgentTraceText
                key={entry.id}
                testId="model-reasoning"
                id={block.id}
                status={block.status}
                reasoning
                text={block.text}
                streaming={turn.status === 'running' && block.status === 'streaming'}
              >
                {block.truncated && <p>推理内容较长，当前显示已保留的部分。</p>}
                {['interrupted', 'failed'].includes(block.status) && <p>此段思考未完成。</p>}
              </AgentTraceText>
            );
          }
          const { item } = entry;
          if (item.kind === 'tool')
            return <AgentPublicTool key={entry.id} item={item} sessionId={sessionId} />;
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
    </div>
  );
}
