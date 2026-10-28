import type { XiaozhiAgentEvent, XiaozhiWorkspaceSnapshot } from '../../../shared/xiaozhi-agent';
import type { OfficeProjection } from '../../../shared/office-agent';

/** Renderer-only text, never a synthetic committed event or replay cursor. */
export type PiTextView = { sessionId: string; runId: string; generation?: number; firstSequence: number; throughSequence: number; delta: string };
function prefixProof(previous: OfficeProjection | undefined, current: OfficeProjection) {
  if (!previous || previous.threadId !== current.threadId) return { valid: true, earlier: [] as OfficeProjection['turns'] };
  const prior = previous.turns.filter(turn => turn.id !== 'pending-send');
  if (!prior.length) return { valid: true, earlier: [] as OfficeProjection['turns'] };
  const positions = new Map(prior.map((turn, index) => [turn.id, index]));
  const returned = new Set(current.turns.map(turn => turn.id));
  const invalid = { valid: false, earlier: [] as OfficeProjection['turns'] };
  if (positions.size !== prior.length || returned.size !== current.turns.length) return invalid;
  const first = positions.get(current.turns[0]?.id);
  if (first === undefined || (!current.hasMoreHistory && first !== 0)) return invalid;
  // An overlap must cover a continuous suffix before new turns can follow.
  // Without an ordering anchor, keep the view and fail closed for explicit
  // recovery; a page is never evidence that missing loaded turns were deleted.
  for (let index = first; index < prior.length; index++) if (current.turns[index - first]?.id !== prior[index].id) return invalid;
  for (let index = prior.length - first; index < current.turns.length; index++) if (positions.has(current.turns[index].id)) return invalid;
  return { valid: true, earlier: prior.slice(0, first) };
}
/** Keep the already loaded older prefix when a fresh default page overlaps it.
 * React supplies previous after queued text updaters, never the render-time ref. */
export function mergePiViewSnapshot(previous: XiaozhiWorkspaceSnapshot | undefined, current: XiaozhiWorkspaceSnapshot, acceptedCursors: NonNullable<XiaozhiWorkspaceSnapshot['eventCursors']> = []): XiaozhiWorkspaceSnapshot {
  if (!previous || previous.projection.threadId !== current.projection.threadId) return current;
  const proof = prefixProof(previous.projection, current.projection);
  if (!proof.valid) return previous;
  if (!proof.earlier.length) return current;
  const cursors = new Map((current.eventCursors || []).map(cursor => [cursor.runId, cursor]));
  for (const turn of proof.earlier) {
    const known = acceptedCursors.find(cursor => cursor.runId === turn.id);
    const prior = previous.eventCursors?.find(cursor => cursor.runId === turn.id);
    const cursor = known && prior?.generation === known.generation && prior.sequence > known.sequence ? prior : known || prior;
    if (cursor) cursors.set(turn.id, cursor);
  }
  return { ...current, eventCursors: [...cursors.values()], legacyHistory: previous.legacyHistory || current.legacyHistory,
    projection: { ...current.projection, turns: [...proof.earlier, ...current.projection.turns], hasMoreHistory: previous.projection.hasMoreHistory } };
}
export function createPiTextViewBuffer(options: {
  text: (view: PiTextView) => void;
  immediate: (event: XiaozhiAgentEvent) => void;
  now?: () => number;
  schedule?: (callback: () => void, milliseconds: number) => () => void;
}) {
  const now = options.now || (() => performance.now());
  const schedule = options.schedule || ((callback, milliseconds) => { const timer = setTimeout(callback, milliseconds); return () => clearTimeout(timer); });
  let pending: PiTextView | undefined, count = 0, cancel: (() => void) | undefined, timerVersion = 0;
  let lastText: PiTextView | undefined, lastApplied: number | undefined;
  // Requirements since the last authoritative replacement, not a second event
  // receiver. Covered requirements retire at acknowledgement; scope clear also
  // drops them. Historical cursors seeded by pagination never enter this map.
  type Cutoff = { sessionId: string; runId: string; generation?: number; sequence: number; terminal?: boolean };
  const required = new Map<string, Cutoff>();
  function canReplace(snapshot: XiaozhiWorkspaceSnapshot, previous?: OfficeProjection) {
    const proof = prefixProof(previous, snapshot.projection);
    if (!proof.valid) return false;
    const returned = new Set(snapshot.projection.turns.map(turn => turn.id));
    for (const value of required.values()) {
      if (value.sessionId !== snapshot.projection.threadId) return false;
      const cursor = snapshot.eventCursors?.find(cursor => cursor.runId === value.runId);
      if (cursor) {
        if (cursor.generation !== value.generation || cursor.sequence < value.sequence) return false;
        continue;
      }
      // A default page may legitimately omit an older completed, already
      // displayed turn. Never retire a present-but-stale turn, a running turn,
      // an unknown order, or the newest pending run merely because it is absent.
      const prior = proof.earlier.find(turn => turn.id === value.runId);
      const terminal = value.terminal ?? Boolean(prior && ['completed', 'failed', 'interrupted'].includes(prior.status));
      if (!returned.has(value.runId) && terminal && prior) continue;
      return false;
    }
    return true;
  }
  const same = (a: PiTextView, b: PiTextView) => a.sessionId === b.sessionId && a.runId === b.runId && a.generation === b.generation;
  function cancelTimer() { timerVersion++; cancel?.(); cancel = undefined; }
  function flush() {
    cancelTimer();
    const value = pending; pending = undefined; count = 0;
    if (value) { lastApplied = now(); options.text(value); }
  }
  function arm() {
    if (cancel) return;
    const stamp = ++timerVersion;
    cancel = schedule(() => { if (stamp === timerVersion) flush(); }, Math.max(0, 32 - (now() - (lastApplied ?? now()))));
  }
  return {
    accept(event: XiaozhiAgentEvent) {
      const key = event.runId + ':' + event.generation;
      const cutoff: Cutoff = required.get(key) || { sessionId: event.sessionId, runId: event.runId, generation: event.generation, sequence: 0 };
      cutoff.sequence = Math.max(cutoff.sequence, event.sequence);
      if (event.kind === 'status') cutoff.terminal = event.status !== 'running';
      required.set(key, cutoff);
      if (event.kind !== 'text_delta') {
        flush(); lastText = undefined; lastApplied = undefined;
        options.immediate(event); return;
      }
      const next: PiTextView = { sessionId: event.sessionId, runId: event.runId, generation: event.generation, firstSequence: event.sequence, throughSequence: event.sequence, delta: event.delta };
      const adjacent = lastText && same(lastText, next) && lastText.throughSequence + 1 === next.firstSequence;
      if (!adjacent) { flush(); lastApplied = undefined; }
      lastText = next;
      // Never retain or truncate a single oversized notification.
      if (next.delta.length > 65536) { flush(); lastApplied = now(); options.text(next); return; }
      if (pending && pending.delta.length + next.delta.length > 65536) flush();
      if (!pending && (lastApplied === undefined || now() - lastApplied >= 32)) {
        lastApplied = now(); options.text(next); return;
      }
      pending = pending ? { ...pending, throughSequence: next.throughSequence, delta: pending.delta + next.delta } : next;
      count++;
      if (count >= 128 || pending.delta.length >= 65536) flush(); else arm();
    },
    flush,
    clear() { cancelTimer(); pending = undefined; count = 0; lastText = undefined; lastApplied = undefined; required.clear(); },
    /** A read barrier only; admission/gaps/generations still belong to receiver. */
    canReplace,
    acknowledge(snapshot: XiaozhiWorkspaceSnapshot, previous?: OfficeProjection) {
      if (!canReplace(snapshot, previous)) throw Error('snapshot_behind_view');
      required.clear();
    },
    pendingRuns() { return required.size; },
  };
}
