import { DisclosureCard } from '../ui/DisclosureCard';
import { useState } from 'react';
import type { OfficeProjectedTurn } from '../../../shared/office-agent';
import { AgentTraceText } from './AgentTraceText';

/** Provider-returned reasoning is opt-in detail, never public progress or answer content. */
export function AgentReasoningDetails({ turn }: { turn: OfficeProjectedTurn }) {
  const [open, setOpen] = useState(false);
  const blocks = turn.modelReasoning?.filter((block) => block.text.trim()) || [];
  if (!blocks.length) return null;
  return (<DisclosureCard data-testid="agent-raw-reasoning"
      isExpanded={open}
      onExpandedChange={setOpen} title={<>推理详情</>}>

      {open && (
        <div className="edu-process-list">
          {blocks.map((block) => (
            <AgentTraceText
              key={block.id}
              testId="model-reasoning"
              id={block.id}
              status={block.status}
              reasoning
              text={block.text}
              streaming={turn.status === 'running' && block.status === 'streaming'}
            >
              {block.truncated && <p>推理内容较长，当前仅展示已保留的部分。</p>}
              {['interrupted', 'failed'].includes(block.status) && <p>此段推理未完成。</p>}
            </AgentTraceText>
          ))}
        </div>
      )}
    </DisclosureCard>
  );
}
