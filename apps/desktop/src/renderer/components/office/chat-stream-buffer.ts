import type { XiaozhiAgentEvent } from '../../../shared/xiaozhi-agent';

/** ~30Hz render commits. Every lifecycle/tool/approval boundary flushes synchronously. */
export function createChatStreamBuffer(commit: (events: XiaozhiAgentEvent[]) => void) {
  let pending: XiaozhiAgentEvent[] = [],
    timer: ReturnType<typeof setTimeout> | undefined;
  function flush() {
    if (timer !== undefined) clearTimeout(timer);
    timer = undefined;
    if (!pending.length) return;
    const events = pending;
    pending = [];
    commit(events);
  }
  return {
    push(event: XiaozhiAgentEvent) {
      pending.push(event);
      if (!['text_delta', 'model_reasoning'].includes(event.kind) || pending.length >= 256) flush();
      else timer ??= setTimeout(flush, 33);
    },
    flush,
    dispose() {
      if (timer !== undefined) clearTimeout(timer);
      timer = undefined;
      pending = [];
    },
  };
}
