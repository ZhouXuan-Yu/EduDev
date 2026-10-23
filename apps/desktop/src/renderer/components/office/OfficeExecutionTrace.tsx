import {useState,type ReactNode} from 'react';
import type {OfficeProjectedTurn} from '../../../shared/office-agent';
import {ChainOfThought} from '../../heroui-pro/components/chain-of-thought';

/** Actual public actions only; reasoning and generic telemetry do not belong here. */
export function OfficeExecutionTrace({turn,children}:{turn:OfficeProjectedTurn;children:ReactNode}){
  const [expanded,setExpanded]=useState(false);
  const tools=turn.items.filter(item=>item.kind==='tool');
  const current=turn.items.find(item=>['tool','compaction'].includes(item.kind)&&item.status==='inProgress');
  return <ChainOfThought isExpanded={expanded} onExpandedChange={setExpanded} data-testid="execution-trace">
    <ChainOfThought.Trigger data-testid="execution-trace-toggle">{current?`正在${current.label||(current.kind==='compaction'?'整理上下文':'执行操作')}`:tools.length?`执行记录 · ${tools.length} 项操作`:'查看执行记录'}</ChainOfThought.Trigger>
    <ChainOfThought.Content>{expanded&&<ChainOfThought.Steps>{children}</ChainOfThought.Steps>}</ChainOfThought.Content>
  </ChainOfThought>;
}
