import type { OfficeProjectedTurn } from './office-agent';
import type { XiaozhiAgentEvent } from './xiaozhi-agent';

/** Presentation metadata only. Host status remains the authority for execution/approvals. */
export function applyChatPresentation(turn: OfficeProjectedTurn, event: XiaozhiAgentEvent) {
  if (event.kind === 'assistant_phase') {
    const item = turn.items.find((item) => item.id === `${turn.id}:segment:${event.segment}`);
    if (item) {
      item.phase = event.phase;
      item.status = 'inProgress';
    }
    turn.presentation = {
      version: 1,
      phase: event.phase === 'final_answer' ? 'answer' : 'process',
      ...(event.phase === 'final_answer' && turn.startedAt !== undefined
        ? { processElapsedMs: Math.max(0, event.since - turn.startedAt) }
        : {}),
    };
  } else if (event.kind === 'assistant_start' || event.kind === 'tool_start') {
    turn.presentation = { version: 1, phase: 'process' };
  } else if (event.kind === 'assistant_end') {
    const item = turn.items.find((item) => item.id === `${turn.id}:segment:${event.segment}`);
    if (item) item.status = 'completed';
    if (event.final)
      turn.presentation = {
        version: 1,
        phase: 'answer',
        processElapsedMs:
          turn.presentation?.processElapsedMs ??
          (turn.startedAt === undefined || event.since === undefined
            ? undefined
            : Math.max(0, event.since - turn.startedAt)),
      };
  }
  if (event.kind === 'model_reasoning') {
    const block = turn.modelReasoning?.find((block) => block.id === event.block.id);
    if (block && block.traceSequence === undefined) block.traceSequence = event.sequence;
  }
  if (
    event.traceOrder !== undefined &&
    Number.isSafeInteger(event.traceOrder) &&
    event.traceOrder > 0
  ) {
    const item =
      event.kind === 'tool_start'
        ? turn.items.find((item) => item.id === event.callId)
        : event.kind === 'text_delta'
          ? turn.items.at(-1)
          : undefined;
    if (item && item.traceOrder === undefined) item.traceOrder = event.traceOrder;
    for (const value of turn.items)
      if (value.traceSequence === event.sequence && value.traceOrder === undefined)
        value.traceOrder = event.traceOrder;
  }
  return turn;
}
