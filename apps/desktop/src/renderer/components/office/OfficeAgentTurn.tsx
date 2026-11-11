import { memo,useMemo } from 'react';
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
  // Process disclosure needs body boundaries/order, not every growing answer string.
  // Preserve all process/source facts; a phase/terminal change still updates immediately.
  const processView={...turn,items:turn.items.map(item=>body.includes(item)?{...item,text:''}:item)};
  const processSignature=JSON.stringify(processView);
  const processTurn=useMemo(()=>processView,[processSignature]);
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
      <MemoAgentProcess turn={processTurn} sessionId={sessionId} renderPlan={renderPlan} />
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

const MemoAgentProcess=memo(AgentProcess);
