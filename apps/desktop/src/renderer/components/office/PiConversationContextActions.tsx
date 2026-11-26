import type {ReactNode} from 'react';

/** Application layout only; the context action keeps the native HeroUI boundary. */
export function PiConversationContextActions({children}:{children:ReactNode}) {
  return <div className="edu-conversation-context" data-testid="pi-conversation-context-actions"
    data-heroui-native="" data-theme="light">{children}</div>;
}
