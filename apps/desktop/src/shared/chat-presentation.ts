export interface ChatPresentation {
  version: 1;
  phase: 'process' | 'answer';
  processElapsedMs?: number;
}
export function readChatPresentation(value: unknown): ChatPresentation | undefined {
  if (!value || typeof value !== 'object') return;
  const data = value as ChatPresentation;
  if (data.version !== 1 || !['process', 'answer'].includes(data.phase)) return;
  return {
    version: 1,
    phase: data.phase,
    ...(typeof data.processElapsedMs === 'number' &&
    Number.isFinite(data.processElapsedMs) &&
    data.processElapsedMs >= 0
      ? { processElapsedMs: data.processElapsedMs }
      : {}),
  };
}
