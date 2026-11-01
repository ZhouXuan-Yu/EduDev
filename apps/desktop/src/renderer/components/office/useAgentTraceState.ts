import { useLayoutEffect, useState } from 'react';
import type { OfficeProjectedTurn } from '../../../shared/office-agent';

export function useAgentTraceState(turn: OfficeProjectedTurn) {
  const terminal = ['completed', 'interrupted', 'failed'].includes(turn.status);
  const answering = turn.presentation
    ? turn.presentation.phase === 'answer'
    : turn.items.some((item) => item.phase === 'final_answer');
  const closed = answering;
  const [expanded, setExpanded] = useState(!closed);
  // Fold only when crossing into a closed phase, not again on normal completion.
  // A real tool after final returns to process; its next handoff folds once again.
  useLayoutEffect(() => {
    setExpanded(!closed);
  }, [closed, turn.id]);
  return {
    expanded,
    setExpanded,
    terminal,
    answering,
    streaming: !terminal && !closed && turn.status === 'running',
  };
}
