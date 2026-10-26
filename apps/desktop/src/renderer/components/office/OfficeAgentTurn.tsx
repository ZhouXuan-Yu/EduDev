import { memo } from 'react';
import type { OfficeConversationProps } from './OfficeConversation';
import type { OfficeProjectedTurn } from '../../../shared/office-agent';
import { ChatMessage } from '../../heroui-pro/components/chat-message';
import { AgentProcess } from './AgentProcess';
import { splitAgentTrace } from './agent-trace';
import { OfficeMarkdown } from './OfficeMarkdown';
import { OfficeImageViews } from './OfficeImageViews';
import { OfficeAgentAnswer } from './OfficeAgentAnswer';

type Props = Pick<
  OfficeConversationProps,
  'renderPlan' | 'renderAttachments' | 'renderViewedImages' | 'replyActions'
> & { turn: OfficeProjectedTurn; sessionId: string };
export const OfficeAgentTurn = memo(function OfficeAgentTurn({
  turn,
  sessionId,
  renderPlan,
  renderAttachments,
  renderViewedImages,
  replyActions,
}: Props) {
  const { users, body } = splitAgentTrace(turn);
  const receipts = turn.items.flatMap((item) => (item.imageDelivery ? [item.imageDelivery] : []));
  return (
    <>
      {users.map((item) => (
        <ChatMessage.User key={item.id} data-item-id={item.id}>
          {renderAttachments?.(item)}
          <ChatMessage.Bubble>
            <OfficeMarkdown>{item.text || ''}</OfficeMarkdown>
          </ChatMessage.Bubble>
        </ChatMessage.User>
      ))}
      <AgentProcess turn={turn} sessionId={sessionId} renderPlan={renderPlan} />
      {receipts.length > 0 && (
        <OfficeImageViews receipts={receipts} renderImages={renderViewedImages} />
      )}
      {body.map((item) => (
        <OfficeAgentAnswer
          key={item.id}
          item={item}
          turn={turn}
          sessionId={sessionId}
          replyActions={replyActions}
        />
      ))}
    </>
  );
});
