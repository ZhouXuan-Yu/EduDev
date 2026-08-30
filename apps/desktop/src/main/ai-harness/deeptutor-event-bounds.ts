const DEFAULT_EVENT_DETAIL_LIMIT = 8_000;
const FINAL_RESULT_DETAIL_LIMIT = 64_000;

function boundedText(value: unknown, limit: number) {
  const text = String(value ?? '');
  return text.length <= limit ? text : `${text.slice(0, limit)}...[truncated]`;
}

/**
 * Agent trace details stay small, but the final structured reply must not be
 * clipped at the trace-summary limit. A clipped JSON object is guaranteed to
 * fail the local xiazhi.reply.v2 parser even when the provider returned valid
 * JSON. The final result remains bounded to protect IPC and SQLite storage.
 */
export function boundDeepTutorEventDetail(phase: string, detail: unknown) {
  return boundedText(
    detail,
    phase === 'result' ? FINAL_RESULT_DETAIL_LIMIT : DEFAULT_EVENT_DETAIL_LIMIT,
  );
}

export const deepTutorEventDetailLimits = {
  default: DEFAULT_EVENT_DETAIL_LIMIT,
  finalResult: FINAL_RESULT_DETAIL_LIMIT,
} as const;
