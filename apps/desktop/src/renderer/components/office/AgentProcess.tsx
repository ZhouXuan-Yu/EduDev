import { useRef } from 'react';
import type { OfficeProjectedTurn } from '../../../shared/office-agent';
import type { OfficeConversationProps } from './OfficeConversation';
import { ChainOfThought } from '../../heroui-pro/components/chain-of-thought';
import { AgentTraceHeader } from './AgentTraceHeader';
import { AgentTraceTimeline } from './AgentTraceTimeline';
import { useAgentTraceState } from './useAgentTraceState';
import { agentTraceTimeline } from './agent-trace-timeline';
import { OfficeToolExpansionScope } from './OfficeToolExpansion';

/** Accepted product choreography. This is intentionally not the official multi-block demo. */
export function AgentProcess({
  turn,
  sessionId,
  renderPlan,
}: Pick<OfficeConversationProps, 'renderPlan'> & { turn: OfficeProjectedTurn; sessionId: string }) {
  const state = useAgentTraceState(turn);
  const handoffTrigger = useRef<HTMLButtonElement>(null);
  const hasProcess = agentTraceTimeline(turn).length > 0;
  if (!hasProcess && turn.status !== 'running')
    return null;
  return (
    <OfficeToolExpansionScope key={turn.id} collapsed={!state.expanded} fallbackRef={handoffTrigger}><div className="edu-agent-process" data-testid="agent-trace-streaming">
      {!state.terminal && !state.answering ? (
        <div
          data-testid="agent-trace"
          data-run-id={turn.id}
          data-mode="live-prose"
          className="edu-process-list"
          data-thinking={state.streaming ? 'processing' : 'settled'}
        >
          <p className="edu-process-wait" data-testid="agent-trace-live-heading">
            <AgentTraceHeader turn={turn} streaming={state.streaming} />
          </p>
          {hasProcess ? (
            <AgentTraceTimeline turn={turn} sessionId={sessionId} renderPlan={renderPlan} />
          ) : (
            <p role="status" data-testid="reply-waiting">
              正在处理…
            </p>
          )}
        </div>
      ) : (
        <ChainOfThought
          isExpanded={state.expanded}
          onExpandedChange={state.setExpanded}
          isStreaming={state.streaming}
          data-testid="agent-trace"
          data-run-id={turn.id}
          data-mode="sealed-disclosure"
          data-thinking={state.streaming ? 'processing' : 'settled'}
        >
          <ChainOfThought.Trigger ref={handoffTrigger} data-testid="agent-trace-toggle">
            <AgentTraceHeader turn={turn} streaming={state.streaming} />
          </ChainOfThought.Trigger>
          <ChainOfThought.Content data-testid="agent-trace-content">
            {state.expanded && (
              <AgentTraceTimeline turn={turn} sessionId={sessionId} renderPlan={renderPlan} />
            )}
          </ChainOfThought.Content>
        </ChainOfThought>
      )}
    </div></OfficeToolExpansionScope>
  );
}
