import type { ReactNode } from 'react';
import { ChatMessage } from '../../heroui-pro/components/chat-message';
import { OfficeMarkdown } from './OfficeMarkdown';

/** Same native message/content anatomy as the final answer, without timeline indentation. */
export function AgentTraceText({
  text,
  streaming,
  testId,
  id,
  status,
  reasoning = false,
  children,
}: {
  text: string;
  streaming: boolean;
  testId: 'model-reasoning' | 'reply-process-summary';
  id: string;
  status?: string;
  reasoning?: boolean;
  children?: ReactNode;
}) {
  return (
    <ChatMessage.Assistant
      data-testid={testId}
      data-reasoning-id={reasoning ? id : undefined}
      data-item-id={reasoning ? undefined : id}
      data-status={status}
    >
      <ChatMessage.Body>
        <ChatMessage.Content>
          <OfficeMarkdown isStreaming={streaming}>{text}</OfficeMarkdown>
          {children}
        </ChatMessage.Content>
      </ChatMessage.Body>
    </ChatMessage.Assistant>
  );
}
