import type { OfficeModelReasoning, OfficeProjectedItem, OfficeProjectedTurn } from '../../../shared/office-agent';
import { splitAgentTrace } from './agent-trace';
export type TraceEntry =
  | { kind: 'item'; id: string; item: OfficeProjectedItem }
  | { kind: 'reasoning'; id: string; block: OfficeModelReasoning };

/** Preserve the captured order of sanitized provider reasoning, commentary and tool receipts. */
export function agentTraceTimeline(turn: OfficeProjectedTurn): TraceEntry[] {
  const items = splitAgentTrace(turn).process.filter(
    (item) => item.text?.trim() || item.kind !== 'message',
  );
  const reasoning = (turn.modelReasoning || []).filter((block) => block.text.trim());
  const entries: TraceEntry[] = [
    ...reasoning.map((block) => ({ kind: 'reasoning' as const, id: block.id, block })),
    ...items.map((item) => ({ kind: 'item' as const, id: item.id, item })),
  ];
  const value = (entry: TraceEntry) => entry.kind === 'reasoning' ? entry.block : entry.item;
  const ordered = entries.every((entry) => value(entry).traceOrder !== undefined);
  const sequenced = entries.every((entry) => value(entry).traceSequence !== undefined);
  const order = (entry: TraceEntry) => {
    if (ordered) return value(entry).traceOrder!;
    if (sequenced) return value(entry).traceSequence!;
    // Older records have no captured ordering. Retain their original item order.
    return entry.kind === 'reasoning'
      ? reasoning.indexOf(entry.block) - reasoning.length
      : turn.items.indexOf(entry.item);
  };
  return entries.sort((a, b) => order(a) - order(b));
}
