import {memo,useEffect,useState} from 'react';
import type {OfficeModelReasoning,OfficeProjectedTurn} from '../../../shared/office-agent';
import {ChainOfThought} from '../../heroui-pro/components/chain-of-thought';
import {formatProcessDuration} from './office-process';
import {OfficeMarkdown} from './OfficeMarkdown';
import {reasoningPreview} from './reasoning-preview';

/** DSH interaction policy on untouched HeroUI: one disclosure per real block. */
const ReasoningRow=memo(function ReasoningRow({block,running,runId}:{block:OfficeModelReasoning;running:boolean;runId:string}){
  const [expanded,setExpanded]=useState(false);
  const [now,setNow]=useState(Date.now);
  useEffect(()=>{if(!running)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[running]);
  const duration=formatProcessDuration(running?Math.max(block.durationMs,now-block.startedAt):block.durationMs);
  const state=block.status==='interrupted'?'思考已停止':block.status==='failed'?'思考未完成':running?'思考中':'已思考';
  const preview=expanded?'':reasoningPreview(block.text,running);
  return <ChainOfThought isExpanded={expanded} onExpandedChange={setExpanded} isStreaming={running}
    className="office-agent-trace" data-testid="agent-trace" data-run-id={runId} data-reasoning-id={block.id} data-thinking={running?'streaming':block.status}>
    <ChainOfThought.Trigger data-testid="agent-trace-toggle" aria-label={`${state} ${duration}${preview?`，${preview}`:''}，${expanded?'收起':'展开'}推理内容`}>
      <span className="office-reasoning-heading"><span>{state} <span data-testid="model-thinking-duration">{duration}</span></span>
        {preview&&<span className="office-reasoning-preview" data-testid="reasoning-preview"> · {preview}</span>}
      </span>
    </ChainOfThought.Trigger>
    <ChainOfThought.Content data-testid="agent-trace-content">
      {expanded&&<ChainOfThought.Steps><ChainOfThought.Step>
        <div data-testid="model-reasoning" data-reasoning-id={block.id} data-status={block.status}>
          <OfficeMarkdown animated={false} isStreaming={running}>{block.text}</OfficeMarkdown>
          {block.truncated&&<p>推理内容较长，当前仅展示已保留的部分。</p>}
          {['interrupted','failed'].includes(block.status)&&<p>此段思考未完成。</p>}
        </div>
      </ChainOfThought.Step></ChainOfThought.Steps>}
    </ChainOfThought.Content>
  </ChainOfThought>;
});

export function OfficeAgentTrace({turn}:{turn:OfficeProjectedTurn}){
  return <>{turn.modelReasoning?.filter(block=>block.text.trim()).map(block=><ReasoningRow key={block.id} block={block} runId={turn.id}
    running={turn.status==='running'&&block.status==='streaming'}/>)}</>;
}
