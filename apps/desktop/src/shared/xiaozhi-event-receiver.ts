import type { XiaozhiAgentEvent } from './xiaozhi-agent';
import { eventDisposition, type XiaozhiEventCursor, type XiaozhiEventsInput, type XiaozhiEventsPage } from './xiaozhi-events';

export type XiaozhiEventSynchronization = 'ready' | 'catching_up' | 'unavailable';

/** Public replay only. An unresolved gap survives a failed request; a completed
 * promise is not proof that the view is current. No effect/approval API here. */
export function createEventReceiver(options: {
  list: (input: XiaozhiEventsInput) => Promise<XiaozhiEventsPage>;
  apply: (event: XiaozhiAgentEvent) => void; unavailable: () => void; gapFailure: () => void;
  syncChanged?: (state: XiaozhiEventSynchronization) => void;
}) {
  const cursors = new Map<string, XiaozhiEventCursor>();
  const gaps = new Map<string, { generation: number; desired: number }>();
  const failures = new Set<string>();
  const pulls = new Map<string, { desired: number; generation: number }>();
  let epoch = 0, persistenceFailed = false, synchronization: XiaozhiEventSynchronization = 'ready';
  function publish() {
    const next = persistenceFailed || failures.size ? 'unavailable' : gaps.size ? 'catching_up' : 'ready';
    if (next !== synchronization) { synchronization = next; options.syncChanged?.(next); }
  }
  function settle(runId: string) {
    const gap = gaps.get(runId), cursor = cursors.get(runId);
    if (gap && cursor?.generation === gap.generation && cursor.sequence >= gap.desired) gaps.delete(runId);
    publish();
  }
  function rememberGap(runId: string, generation: number, desired: number) {
    const previous = gaps.get(runId);
    gaps.set(runId, { generation, desired: Math.max(previous?.generation === generation ? previous.desired : 0, desired) });
    publish();
  }
  function apply(event: XiaozhiAgentEvent) {
    const old = cursors.get(event.runId);
    if (eventDisposition(old, event) !== 'apply') return false;
    cursors.set(event.runId, { runId: event.runId, generation: event.generation!, sequence: event.sequence, revision: event.revision || old?.revision || 0 });
    options.apply(event); settle(event.runId); return true;
  }
  function pull(sessionId: string, runId: string, generation: number, desired: number, probe = false) {
    const running = pulls.get(runId);
    if (running) { if (running.generation === generation) running.desired = Math.max(running.desired, desired); return; }
    const request = { desired, generation }, stamp = epoch; pulls.set(runId, request);
    void (async () => {
      for (let pages = 0; pages < 1024; pages++) {
        const after = cursors.get(runId)?.sequence || 0;
        if (!probe && after >= request.desired) { failures.delete(runId); settle(runId); return; }
        probe = false;
        const page = await options.list({ sessionId, runId, generation, after, limit: 128 });
        if (stamp !== epoch) return;
        if (page.schemaVersion !== 1 || page.cursor.runId !== runId || page.cursor.generation !== generation
          || !Number.isSafeInteger(page.cursor.sequence) || page.cursor.sequence < after || page.events.length > 128) throw Error('event_page_invalid');
        request.desired = Math.max(request.desired, page.cursor.sequence);
        if ((cursors.get(runId)?.sequence || 0) < request.desired) rememberGap(runId, generation, request.desired);
        for (const event of page.events) {
          if (event.sessionId !== sessionId || event.runId !== runId || event.generation !== generation) throw Error('event_page_invalid');
          if (eventDisposition(cursors.get(runId), event) === 'duplicate') continue;
          if (!apply(event)) throw Error('event_page_gap');
        }
        if ((cursors.get(runId)?.sequence || 0) >= request.desired) { failures.delete(runId); settle(runId); return; }
        if ((cursors.get(runId)?.sequence || 0) <= after) throw Error('event_page_empty');
      }
      throw Error('event_page_bounds');
    })().catch(() => {
      if (stamp === epoch) { failures.add(runId); publish(); options.gapFailure(); }
    }).finally(() => { if (pulls.get(runId) === request) pulls.delete(runId); });
  }
  return {
    /** Only the caller's authoritative snapshot may seed a cursor. An older or
     * foreign-generation cursor cannot acknowledge a newer observed gap. */
    seed(values: XiaozhiEventCursor[], persistenceRestored=false) {
      for (const value of values) {
        if (!Number.isSafeInteger(value.sequence) || value.sequence < 0 || !Number.isSafeInteger(value.generation) || value.generation < 1) continue;
        const old = cursors.get(value.runId);
        if (!old || old.generation === value.generation && value.sequence >= old.sequence) {
          cursors.set(value.runId, { ...value }); failures.delete(value.runId); settle(value.runId);
        }
      }
      if(persistenceRestored){persistenceFailed=false;publish();}
    },
    reset() { epoch++; cursors.clear(); gaps.clear(); failures.clear(); pulls.clear(); persistenceFailed = false; publish(); },
    cursors: () => [...cursors.values()].map(value => ({ ...value })),
    synchronization: () => synchronization,
    /** Routine healthy probes do not block input. A discovered missing tail is
     * treated exactly like an explicitly observed gap, including more pages. */
    poll(sessionId: string, runId?: string) {
      for (const value of cursors.values()) {
        if (runId && value.runId !== runId) continue;
        pull(sessionId, value.runId, value.generation, gaps.get(value.runId)?.desired || value.sequence, true);
      }
    },
    accept(event: XiaozhiAgentEvent) {
      if (event.durability === 'unavailable') { persistenceFailed = true; publish(); options.unavailable(); return; }
      const state = eventDisposition(cursors.get(event.runId), event);
      if (state === 'apply') { apply(event); return; }
      if (state !== 'gap') return;
      rememberGap(event.runId, event.generation!, event.sequence);
      pull(event.sessionId, event.runId, event.generation!, event.sequence);
    },
  };
}
