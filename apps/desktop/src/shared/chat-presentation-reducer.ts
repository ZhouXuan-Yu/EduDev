import type { OfficeProjectedTurn } from './office-agent';
import type { XiaozhiAgentEvent } from './xiaozhi-agent';

/** Presentation metadata only. Host status remains the authority for execution/approvals. */
export function applyChatPresentation(turn: OfficeProjectedTurn, event: XiaozhiAgentEvent) {
  const recordedAt = typeof event.capturedAt === 'number' && Number.isFinite(event.capturedAt) && event.capturedAt > 0
    ? event.capturedAt : undefined;
  const close = (at: number | undefined, handoff?: 'explicit' | 'legacy') => {
    const previous = turn.presentation;
    const validEnd = typeof at === 'number' && Number.isFinite(at) && at > 0 ? at : undefined;
    turn.presentation = {
      version: 1, ...previous, phase: 'answer',
      ...(handoff ? { handoff: previous?.handoff || handoff } : {}),
      ...(previous?.processEndedAt === undefined && validEnd !== undefined ? {
        processEndedAt: validEnd,
        ...(previous?.processStartedAt !== undefined && validEnd >= previous.processStartedAt
          ? { processElapsedMs: validEnd - previous.processStartedAt } : {}),
      } : {}),
    };
  };
  if (event.kind === 'assistant_phase') {
    const item = turn.items.find((item) => item.id === `${turn.id}:segment:${event.segment}`);
    if (!item) return turn;
    item.phase = event.phase;
    item.phaseSource = 'explicit';
    item.status = 'inProgress';
    if (event.phase === 'final_answer') close(event.since, 'explicit');
    else turn.presentation = { version: 1, ...turn.presentation, phase: 'process' };
  } else if (event.kind === 'assistant_start') {
    // A new segment alone is not execution and cannot undo a committed final boundary.
    turn.presentation ||= { version: 1, phase: 'process' };
  } else if (event.kind === 'tool_start' || event.kind === 'text_delta') {
    const previous = turn.presentation;
    const segment = turn.items.at(-1);
    const publicActivity = event.kind === 'tool_start' || (event.delta.trim()
      && segment?.kind === 'message' && segment.role === 'assistant'
      && segment.phaseSource === 'explicit' && segment.phase === 'commentary');
    if (publicActivity) turn.presentation = {
      version: 1, ...previous, phase: 'process',
      ...(previous?.processStartedAt === undefined && recordedAt !== undefined
        ? { processStartedAt: recordedAt } : {}),
      ...(event.kind === 'tool_start' && previous?.phase === 'answer' ? { toolAfterAnswer: true } : {}),
    };
  } else if (event.kind === 'assistant_end') {
    const item = turn.items.find((item) => item.id === `${turn.id}:segment:${event.segment}`);
    if (item) item.status = 'completed';
    // Untagged providers only support end-of-message handoff, never guessed first-token handoff.
    if (event.final && !(item?.phaseSource === 'explicit' && item.phase === 'commentary')) close(event.since, 'legacy');
  } else if (event.kind === 'status' && ['completed', 'failed', 'interrupted'].includes(event.status)) {
    // Failure/stop freezes the visible clock without promoting commentary to an answer.
    const previous = turn.presentation;
    const endedAt = typeof event.finishedAt === 'number' && Number.isFinite(event.finishedAt) && event.finishedAt > 0
      ? event.finishedAt : recordedAt;
    if (previous?.processEndedAt === undefined && previous?.processStartedAt !== undefined && endedAt !== undefined && endedAt >= previous.processStartedAt)
      turn.presentation = { ...previous, processEndedAt: endedAt, processElapsedMs: endedAt - previous.processStartedAt };
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
