import { useLayoutEffect, useState } from 'react';
import type { OfficeProjectedTurn } from '../../../shared/office-agent';

export function useAgentTraceState(turn: OfficeProjectedTurn) {
  const terminal = ['completed', 'interrupted', 'failed'].includes(turn.status);
  const answering = turn.presentation
    ? turn.presentation.phase === 'answer'
    : turn.items.some((item) => item.phase === 'final_answer');
  const closed = terminal || answering;
  const [expanded, setExpanded] = useState(!closed);
  // Handoff and terminal each fold once. Manual reopening is otherwise respected.
  useLayoutEffect(() => {
    setExpanded(!closed);
  }, [closed, terminal]);
  return {
    expanded,
    setExpanded,
    terminal,
    answering,
    streaming: !closed && turn.status === 'running',
  };
}
