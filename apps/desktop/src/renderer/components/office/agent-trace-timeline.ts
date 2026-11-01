import type { OfficeProjectedItem, OfficeProjectedTurn } from '../../../shared/office-agent';
import { splitAgentTrace } from './agent-trace';
export type TraceEntry = { kind: 'item'; id: string; item: OfficeProjectedItem };

/** Public commentary and host tool receipts only; provider reasoning is not a UI source. */
export function agentTraceTimeline(turn: OfficeProjectedTurn): TraceEntry[] {
  const items = splitAgentTrace(turn).process.filter(
    (item) => item.text?.trim() || item.kind !== 'message',
  );
  const ordered = items.every((item) => item.traceOrder !== undefined);
  const sequenced = items.every((item) => item.traceSequence !== undefined);
  const order = (item: OfficeProjectedItem) => ordered ? item.traceOrder!
    : sequenced ? item.traceSequence! : turn.items.indexOf(item);
  return items.map((item) => ({ kind: 'item' as const, id: item.id, item }))
    .sort((a, b) => order(a.item) - order(b.item));
}
