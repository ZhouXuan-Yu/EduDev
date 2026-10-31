export interface ChatPresentation {
  version: 1;
  phase: 'process' | 'answer';
  processElapsedMs?: number;
  /** First recorded public text/tool event, never request preparation or private reasoning. */
  processStartedAt?: number;
  processEndedAt?: number;
  handoff?: 'explicit' | 'legacy';
  toolAfterAnswer?: boolean;
}
export function readChatPresentation(value: unknown): ChatPresentation | undefined {
  if (!value || typeof value !== 'object') return;
  const data = value as ChatPresentation;
  if (data.version !== 1 || !['process', 'answer'].includes(data.phase)) return;
  return {
    version: 1,
    phase: data.phase,
    ...(Number.isFinite(data.processStartedAt) && data.processStartedAt! > 0 ? { processStartedAt: data.processStartedAt } : {}),
    ...(Number.isFinite(data.processEndedAt) && data.processEndedAt! > 0 ? { processEndedAt: data.processEndedAt } : {}),
    ...(data.handoff === 'explicit' || data.handoff === 'legacy' ? { handoff: data.handoff } : {}),
    ...(data.toolAfterAnswer === true ? { toolAfterAnswer: true } : {}),
    ...(typeof data.processElapsedMs === 'number' &&
    Number.isFinite(data.processElapsedMs) &&
    data.processElapsedMs >= 0
      ? { processElapsedMs: data.processElapsedMs }
      : {}),
  };
}
