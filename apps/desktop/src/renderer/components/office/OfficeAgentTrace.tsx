import {useEffect,useRef,useState,type ReactNode} from 'react';
import type {OfficeProjectedTurn} from '../../../shared/office-agent';
import {ChainOfThought} from '../../heroui-pro/components/chain-of-thought';
import {formatProcessDuration} from './office-process';
import {traceStage} from './agent-trace';
import {OfficeMarkdown} from './OfficeMarkdown';

/** Original Pro composition, using actual provider reasoning independently of execution records. */
export function OfficeAgentTrace({turn,children}:{turn:OfficeProjectedTurn;children:ReactNode}){
  const [expanded,setExpanded]=useState(turn.status!=='completed');
  const prior=useRef(turn.status);
  const [now,setNow]=useState(Date.now);
  const terminal=['completed','failed','interrupted'].includes(turn.status);
  useEffect(()=>{
    if(prior.current!==turn.status){
      if(turn.status==='completed')setExpanded(false);
      else if(['failed','interrupted','waiting_input','waiting_approval'].includes(turn.status))setExpanded(true);
      prior.current=turn.status;
    }
  },[turn.status]);
  useEffect(()=>{if(terminal)return;const timer=setInterval(()=>setNow(Date.now()),1000);return()=>clearInterval(timer);},[terminal]);
  const elapsed=terminal?(turn.traceElapsedMs??turn.elapsedMs):turn.startedAt?Math.max(turn.elapsedMs||0,now-turn.startedAt):turn.elapsedMs;
  const duration=elapsed===undefined?'耗时未记录':formatProcessDuration(Math.max(0,elapsed));
  const state=turn.status==='completed'?'已结束':turn.status==='failed'?'未完成':turn.status==='interrupted'?'已停止':turn.status==='waiting_input'?'等待补充':turn.status==='waiting_approval'?'等待确认':'进行中';
  const failed=turn.items.some(item=>item.kind==='tool'&&['failed','declined'].includes(item.status||''));
  const blocks=turn.modelReasoning||[];
  const thinking=turn.status==='running'&&blocks.some(b=>b.status==='streaming');
  const thinkingMs=blocks.reduce((sum,b)=>sum+(b.status==='streaming'&&!terminal?Math.max(b.durationMs,now-b.startedAt):b.durationMs),0);
  const thinkingDuration=blocks.length?formatProcessDuration(Math.max(0,thinkingMs)):undefined;
  return <ChainOfThought isExpanded={expanded} onExpandedChange={setExpanded} isStreaming={thinking} className="office-agent-trace" data-testid="agent-trace" data-run-id={turn.id} data-state={turn.status}>
    <ChainOfThought.Trigger data-testid="agent-trace-toggle" aria-label={`模型思考，${state}，${thinkingDuration?'思考'+thinkingDuration+'，':''}执行${duration}`}>
      <span>模型思考 · <span className="office-trace-state">{state}{failed?' · 含未完成操作':''}</span>{thinkingDuration&&<> · <span data-testid="model-thinking-duration">思考 {thinkingDuration}</span></>} · <span data-testid="office-turn-duration" className="office-trace-duration">执行 {duration}</span></span>
    </ChainOfThought.Trigger>
    <ChainOfThought.Content data-testid="agent-trace-content">
      {expanded&&<><ChainOfThought.Steps>
        {blocks.map((block,index)=><ChainOfThought.Step key={block.id} label={blocks.length>1?`模型思考 · 第 ${index+1} 段`:undefined}>
          <div data-testid="model-reasoning" data-reasoning-id={block.id} data-status={block.status}>
            <OfficeMarkdown animated={false} isStreaming={block.status==='streaming'&&!terminal}>{block.text}</OfficeMarkdown>
            {block.truncated&&<p>推理内容较长，当前仅展示已保留的部分。</p>}
            {['interrupted','failed'].includes(block.status)&&<p>此段思考未完成。</p>}
          </div>
        </ChainOfThought.Step>)}
        {!blocks.length&&<ChainOfThought.Step><span data-testid="model-reasoning-empty">{terminal?'本次模型未返回推理内容。':'等待模型返回推理内容。'}</span></ChainOfThought.Step>}
        {children&&<ChainOfThought.Step label="执行记录与工具结果"><ChainOfThought.Steps>{children}</ChainOfThought.Steps></ChainOfThought.Step>}
        {!terminal&&(!turn.publicStages?.length||turn.status!=='running')&&<ChainOfThought.Step label={traceStage(turn)}><span>{turn.status==='running'?'等待真实公开阶段或操作记录。':'请在下方卡片处理，小智会等待你的决定。'}</span></ChainOfThought.Step>}
      </ChainOfThought.Steps></>}
    </ChainOfThought.Content>
  </ChainOfThought>;
}
