import type {OfficeProjectedTurn,OfficePublicStage} from '../../../shared/office-agent';
import type {OfficeProcessPart} from './office-process';

/** Only committed phase/tool boundaries classify prose. Never guess from model wording. */
export function splitAgentTrace(turn:OfficeProjectedTurn){
  const current=turn.items.at(-1);
  const lastText=turn.items.filter(item=>item.kind==='message'&&item.role==='assistant').at(-1);
  const partial=['failed','interrupted'].includes(turn.status);
  const isBody=(item:typeof current)=>!!item&&item.kind==='message'&&item.role==='assistant'&&(
    item.phase==='final_answer'||item.phase==='partial_answer'||partial&&item===lastText||turn.status==='running'&&item===current
  );
  return {
    users:turn.items.filter(item=>item.kind==='message'&&item.role==='user'),
    body:turn.items.filter(isBody),
    process:turn.items.filter(item=>!(item.kind==='message'&&item.role==='user')&&!isBody(item)),
  };
}

export function traceStage(turn:OfficeProjectedTurn){
  if(turn.status==='waiting_approval')return '等待你确认';
  if(turn.status==='waiting_input')return '等待你补充';
  if([...turn.items].reverse().find(item=>item.kind==='compaction')?.status==='inProgress')return '正在整理上下文';
  const tool=[...turn.items].reverse().find(item=>item.kind==='tool'&&item.status==='inProgress');
  if(tool)return `正在${tool.label||'执行授权操作'}`;
  return turn.activity?.stage==='preparing'?'正在准备请求与核对资料范围':turn.activity?.stage==='responding'?'正在生成回复':'正在等待模型回复';
}

export type AgentTracePart=OfficeProcessPart|{kind:'stage';stage:OfficePublicStage};
/** Preserve host event order; a real stage breaks a group of adjacent tool calls. */
export function agentTraceParts(turn:OfficeProjectedTurn):AgentTracePart[]{
  const entries=[
    ...splitAgentTrace(turn).process.map(item=>({kind:'item' as const,item,sequence:item.traceSequence})),
    ...(turn.publicStages||[]).map(stage=>({kind:'stage' as const,stage,sequence:stage.sequence})),
  ].sort((a,b)=>(a.sequence??Infinity)-(b.sequence??Infinity));
  const parts:AgentTracePart[]=[];
  for(const entry of entries){
    if(entry.kind==='stage'){parts.push(entry);continue;}
    if(entry.item.kind!=='tool'){parts.push(entry);continue;}
    const last=parts.at(-1);
    if(last?.kind==='tools')last.items.push(entry.item);
    else parts.push({kind:'tools',items:[entry.item]});
  }
  return parts;
}
