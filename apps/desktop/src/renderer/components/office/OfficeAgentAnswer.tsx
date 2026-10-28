import type { OfficeProjectedItem, OfficeProjectedTurn } from '../../../shared/office-agent';
import type { OfficeConversationProps } from './OfficeConversation';
import { ChatMessage } from '../../heroui-pro/components/chat-message';
import { OfficeAnswerMarkdown } from './OfficeAnswerMarkdown';
import { OfficeReplySources } from './OfficeReplySources';

export function OfficeAgentAnswer({
  turn,
  item,
  sessionId,
  replyActions,
}: Pick<OfficeConversationProps, 'replyActions'> & {
  turn: OfficeProjectedTurn;
  item: OfficeProjectedItem;
  sessionId: string;
}) {
  const streaming = turn.status === 'running' && item.status === 'inProgress';
  const partial =
    item.phase === 'partial_answer' || ['failed', 'interrupted'].includes(turn.status);
  return (
    <ChatMessage.Assistant
      data-item-id={item.id}
      data-phase={partial ? 'partial_answer' : item.phase}
      data-testid="agent-reply-body"
    >
      <ChatMessage.Body>
        {partial && <p className="office-partial-label">部分回复 · 尚未完成</p>}
        <ChatMessage.Content>
          <OfficeAnswerMarkdown streaming={streaming} text={item.text || ''} turn={turn}/>
          {item.truncated && (
            <p className="office-history-notice">这段内容较长，当前显示部分内容。</p>
          )}
        </ChatMessage.Content>
        {!streaming && turn.status !== 'running' && replyActions && (
          <>
            <OfficeReplySources turn={turn} sessionId={sessionId} />
            {replyActions(turn, item)}
          </>
        )}
      </ChatMessage.Body>
    </ChatMessage.Assistant>
  );
}
