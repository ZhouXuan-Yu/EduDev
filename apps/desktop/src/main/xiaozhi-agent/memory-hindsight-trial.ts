import { createHash } from 'node:crypto';

const trialModes = new Set(['B', 'C']);

/** Acceptance-only: rank previously approved, redacted rows using the loopback fixture harness. */
export async function rankHindsightTrialRows<T extends { text: string }>(
  selected: T[],
  signal?: AbortSignal,
): Promise<T[]> {
  const mode = process.env.OMNI_EDU_MEMORY_HINDSIGHT_TRIAL;
  if (!mode || !trialModes.has(mode) || process.env.OMNI_EDU_E2E_DIALOG_MODE !== '1'
    || !process.env.OMNI_EDU_DATA_ROOT || !selected.length) return selected;

  const rows = new Map(selected.map(row => [createHash('sha256').update(row.text).digest('hex'), row]));
  try {
    const deadline = AbortSignal.timeout(1500);
    const response = await fetch('http://127.0.0.1:18889/trial-rank', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ mode, authorizedHashes: [...rows.keys()] }),
      signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
      redirect: 'error',
    });
    if (!response.ok || !response.headers.get('content-type')?.startsWith('application/json')) return selected;
    const responseText = await response.text();
    if (responseText.length > 1600) return selected;
    const ranks: unknown = JSON.parse(responseText);
    if (!Array.isArray(ranks) || ranks.length > rows.size
      || ranks.some(hash => typeof hash !== 'string' || !rows.has(hash))
      || new Set(ranks).size !== ranks.length) return selected;
    const received = new Set(ranks);
    const ordered = [...ranks, ...[...rows.keys()].filter(hash => !received.has(hash))];
    if (rows.size !== selected.length) return selected;
    return ordered.map(hash => rows.get(hash)!);
  } catch {
    signal?.throwIfAborted();
    return selected;
  }
}
