import type {
  OfficeModelReasoning,
  OfficeProjectedItem,
  OfficeProjectedTurn,
} from '../../../shared/office-agent';
import { splitAgentTrace } from './agent-trace';
export type TraceEntry =
  | { kind: 'reasoning'; id: string; block: OfficeModelReasoning }
  | { kind: 'item'; id: string; item: OfficeProjectedItem };

/** New captures have a monotonic SDK order. History retains only the order it recorded. */
export function agentTraceTimeline(turn: OfficeProjectedTurn): TraceEntry[] {
  const items = splitAgentTrace(turn).process.filter(
    (item) => item.text?.trim() || item.kind !== 'message',
  );
  const entries: TraceEntry[] = [
    ...items.map((item) => ({ kind: 'item' as const, id: item.id, item })),
    ...(turn.modelReasoning || [])
      .filter((block) => block.text.trim())
      .map((block) => ({ kind: 'reasoning' as const, id: block.id, block })),
  ];
  const historicalReasoningOrder = (block: OfficeModelReasoning) => {
    const segment = block.id.split(':')[1],
      id = `${turn.id}:segment:${segment}`;
    const text = turn.items.find((item) => item.id === id);
    if (text?.traceSequence !== undefined) return text.traceSequence - 0.5;
    const index = turn.items.findIndex((item) => item.id === id);
    if (index >= 0) return index - 0.5;
    return block.traceSequence ?? Number(segment) * 100;
  };
  const ordered = entries.every(
    (entry) => (entry.kind === 'reasoning' ? entry.block : entry.item).traceOrder !== undefined,
  );
  const hasSequences = items.every((item) => item.traceSequence !== undefined);
  const order = (entry: TraceEntry) => {
    const value = entry.kind === 'reasoning' ? entry.block : entry.item;
    if (ordered) return value.traceOrder!;
    if (entry.kind === 'reasoning') return historicalReasoningOrder(entry.block);
    return hasSequences ? entry.item.traceSequence! : turn.items.indexOf(entry.item);
  };
  return entries.sort((a, b) => order(a) - order(b));
}
