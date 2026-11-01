import type { OfficeProjectedItem } from '../../../shared/office-agent';
import { AgentPublicTool } from './AgentPublicTool';

/** Compatibility entry reuses the same public tool card and focus/state scope. */
export function AgentTraceTool({ item, sessionId }: { item: OfficeProjectedItem; sessionId: string }) {
  return <AgentPublicTool item={item} sessionId={sessionId} />;
}
