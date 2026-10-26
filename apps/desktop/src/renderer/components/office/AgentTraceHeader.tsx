import { useEffect, useState } from 'react';
import type { OfficeProjectedTurn } from '../../../shared/office-agent';
import { formatProcessDuration } from './office-process';

/** Process wall time includes tools/waiting; never label it pure model thinking time. */
export function AgentTraceHeader({
  turn,
  streaming,
}: {
  turn: OfficeProjectedTurn;
  streaming: boolean;
}) {
  const [now, setNow] = useState(Date.now);
  const timing = streaming || ['waiting_approval', 'waiting_input'].includes(turn.status);
  useEffect(() => {
    if (!timing) return;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [timing]);
  const elapsed =
    turn.presentation?.processElapsedMs ??
    (timing && turn.startedAt !== undefined ? Math.max(0, now - turn.startedAt) : undefined) ??
    turn.traceElapsedMs ??
    turn.elapsedMs ??
    (turn.startedAt === undefined ? undefined : Math.max(0, now - turn.startedAt));
  const title =
    turn.status === 'interrupted'
      ? '处理已停止'
      : turn.status === 'failed'
        ? '处理未完成'
        : turn.status === 'waiting_approval'
          ? '等待你确认'
          : turn.status === 'waiting_input'
            ? '等待你补充'
            : timing
              ? '已处理'
              : '用时';
  return (
    <>
      {title}
      {elapsed !== undefined && (
        <>
          {' '}
          <span data-testid="model-thinking-duration">{formatProcessDuration(elapsed)}</span>
        </>
      )}
    </>
  );
}
