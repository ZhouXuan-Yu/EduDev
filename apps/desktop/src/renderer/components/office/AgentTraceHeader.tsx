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
  const presentation = turn.presentation;
  const start = presentation?.processStartedAt ?? turn.modelReasoning?.[0]?.startedAt ?? turn.startedAt;
  // Legacy providers record message end, which can include the entire answer stream.
  const unknownAnswerStart = presentation?.handoff === 'legacy'
    || (turn.status === 'completed' && presentation?.handoff !== 'explicit');
  const elapsed = presentation?.toolAfterAnswer || unknownAnswerStart ? undefined
    : presentation?.processEndedAt !== undefined && start !== undefined
      ? presentation.processElapsedMs
      : timing && start !== undefined ? Math.max(0, now - start) : undefined;
  const title = turn.status === 'interrupted' ? '处理已停止'
    : turn.status === 'failed' ? '处理未完成'
    : turn.status === 'waiting_approval' ? '等待你确认'
    : turn.status === 'waiting_input' ? '等待你补充'
    : timing ? '正在处理' : '处理过程';
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
