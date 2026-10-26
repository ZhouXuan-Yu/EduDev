import type { OfficeProjectedTurn } from '../../../shared/office-agent';
import { AgentProcess } from './AgentProcess';
/** Compatibility for isolated reasoning consumers; the production turn uses the aggregate. */
export function OfficeAgentTrace({ turn }: { turn: OfficeProjectedTurn }) {
  if (!turn.modelReasoning?.some((block) => block.text.trim())) return null;
  return <AgentProcess turn={turn} sessionId="" />;
}
