import type { XiaozhiAgentEvent } from './xiaozhi-agent';

export type XiaozhiEventCursor = { runId: string; generation: number; sequence: number; revision: number };
export type XiaozhiEventsInput = { sessionId: string; runId: string; generation: number; after: number; limit?: number };
export type XiaozhiEventsPage = { schemaVersion: 1; cursor: XiaozhiEventCursor; events: XiaozhiAgentEvent[]; hasMore: boolean };
const identity = (value: unknown) => typeof value === 'string' && /^[A-Za-z0-9_-]{1,160}$/.test(value);
const natural = (value: unknown) => Number.isSafeInteger(value) && Number(value) >= 0;
export function validEventsInput(value: unknown): value is XiaozhiEventsInput {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return false;
  const row = value as Record<string, unknown>;
  return Object.keys(row).every(key => ['sessionId','runId','generation','after','limit'].includes(key))
    && typeof row.sessionId === 'string' && /^aisession_[a-f0-9-]{36}$/i.test(row.sessionId)
    && identity(row.runId) && natural(row.generation) && Number(row.generation) > 0 && natural(row.after)
    && (row.limit === undefined || natural(row.limit) && Number(row.limit) >= 1 && Number(row.limit) <= 128);
}

/** Renderer cursor rule: only a contiguous committed event may advance the cursor. */
export function eventDisposition(cursor: XiaozhiEventCursor | undefined, event: XiaozhiAgentEvent): 'apply' | 'duplicate' | 'gap' | 'stale' {
  if (event.durability !== 'committed' || !natural(event.generation) || !natural(event.sequence) || event.sequence < 1) return 'stale';
  if (cursor && (cursor.runId !== event.runId || cursor.generation !== event.generation)) return 'stale';
  const after = cursor?.sequence || 0;
  return event.sequence <= after ? 'duplicate' : event.sequence === after + 1 ? 'apply' : 'gap';
}
