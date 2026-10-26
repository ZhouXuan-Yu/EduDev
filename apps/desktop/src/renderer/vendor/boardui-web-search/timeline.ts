import { useEffect, useRef, useState } from 'react';
import type { WebSearchStep } from './types';

export interface RevealRow {
  step: number;
  kind: 'step' | 'sources';
}

export function makeRevealRows(steps: readonly WebSearchStep[]): RevealRow[] {
  return steps.flatMap((step, index): RevealRow[] =>
    step.sources?.length && !step.heading
      ? [
          { step: index, kind: 'step' },
          { step: index, kind: 'sources' },
        ]
      : [{ step: index, kind: 'step' }],
  );
}

export function getWebSearchRowCount(steps: readonly WebSearchStep[]): number {
  return makeRevealRows(steps).length;
}

export function revealDelay(
  count: number,
  rows: readonly RevealRow[],
  steps: readonly WebSearchStep[],
  startDelay: number,
  stepInterval: number,
): number {
  if (count === 0) return startDelay;
  const row = rows[count - 1];
  if (!row) return stepInterval;
  const step = steps[row.step];
  if (row.kind === 'step' && step.sources?.length && !step.heading) return 900;
  return step.dwell ?? stepInterval;
}

/** Automatic runs include a final dwell; controlled runs complete on the last row. */
export function useRevealTicker({
  total,
  run,
  revealed,
  delayFor,
  onComplete,
}: {
  total: number;
  run: boolean;
  revealed?: number;
  delayFor: (count: number) => number;
  onComplete?: () => void;
}) {
  const controlled = revealed !== undefined;
  const [tick, setTick] = useState(0);
  const requestedCount = controlled ? revealed : tick;
  const count = Math.max(
    0,
    Math.min(total, Math.floor(Number.isNaN(requestedCount) ? 0 : requestedCount)),
  );
  const completed = useRef(false);

  useEffect(() => {
    if (controlled || !run || count >= total) return;
    const timer = window.setTimeout(() => setTick(count + 1), Math.max(0, delayFor(count)));
    return () => window.clearTimeout(timer);
  }, [controlled, run, count, total, delayFor]);

  useEffect(() => {
    if (total === 0 || count < total) {
      completed.current = false;
      return;
    }
    if (!completed.current) {
      completed.current = true;
      onComplete?.();
    }
  }, [count, total, onComplete]);

  return count;
}
