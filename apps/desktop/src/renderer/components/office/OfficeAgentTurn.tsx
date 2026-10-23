import {memo} from 'react';
import {FileCheck2,Minimize2,ListTodo} from 'lucide-react';
import type {OfficeConversationProps} from './OfficeConversation';
import type {OfficeProjectedTurn} from '../../../shared/office-agent';
import {ChatMessage} from '../../heroui-pro/components/chat-message';
import {ChatTool} from '../../heroui-pro/components/chat-tool';
import {ChainOfThought} from '../../heroui-pro/components/chain-of-thought';
import {OfficeAgentTrace} from './OfficeAgentTrace';
import {OfficeExecutionTrace} from './OfficeExecutionTrace';
import {formatProcessDuration} from './office-process';
import {splitAgentTrace,agentTraceParts} from './agent-trace';
import {OfficeToolProcess} from './OfficeToolProcess';
import {OfficeMarkdown} from './OfficeMarkdown';
import {OfficeImageViews} from './OfficeImageViews';
import {OfficeReplySources} from './OfficeReplySources';

type Props=Pick<OfficeConversationProps,'renderPlan'|'renderAttachments'|'renderViewedImages'|'replyActions'>&{turn:OfficeProjectedTurn;sessionId:string};
/** One run owns trace disclosure state; unrelated history never gets a ticking timer. */
export const OfficeAgentTurn=memo(function OfficeAgentTurn({turn,sessionId,renderPlan,renderAttachments,renderViewedImages,replyActions}:Props){
  const {users,body}=splitAgentTrace(turn);
  const parts=agentTraceParts(turn).filter(part=>part.kind!=='stage');
  const receipts=turn.items.flatMap(item=>item.imageDelivery?[item.imageDelivery]:[]);
  const trace=parts.length?<>{parts.map(part=>{
    if(part.kind==='tools')return <ChainOfThought.Step key={part.items[0].id}><OfficeToolProcess items={part.items} sessionId={sessionId}/></ChainOfThought.Step>;
    const item=part.item;
    if(item.kind==='plan')return <ChainOfThought.Step key={item.id}>{renderPlan?.(item)||<div data-testid="pi-task-plan"><ListTodo size={15}/>任务计划<OfficeMarkdown>{item.text||''}</OfficeMarkdown></div>}</ChainOfThought.Step>;
    if(item.kind==='compaction'||item.kind==='memory_isolation'||item.kind==='skill_isolation')return <ChainOfThought.Step key={item.id}><ChatTool className="office-compaction" state={item.status==='failed'?'output-error':item.status==='inProgress'?'input-available':'output-available'} defaultExpanded={item.status==='failed'} data-state={item.status||'completed'} data-item-id={item.id} data-testid={item.kind==='compaction'?'pi-compaction-card':item.kind==='skill_isolation'?'pi-skill-isolation':'pi-memory-isolation'}><ChatTool.Trigger>{item.kind==='compaction'?<Minimize2 size={15}/>:<FileCheck2 size={15}/>} {item.label||'整理上下文'}</ChatTool.Trigger><ChatTool.Content><p>{item.text}</p></ChatTool.Content></ChatTool></ChainOfThought.Step>;
    return <ChainOfThought.Step key={item.id} label="公开过程说明"><div data-testid="reply-process-summary" data-item-id={item.id}><OfficeMarkdown>{item.text||''}</OfficeMarkdown></div></ChainOfThought.Step>;
  })}</>:null;
  return <>
    {users.map(item=><ChatMessage.User key={item.id} data-item-id={item.id}>{renderAttachments?.(item)}<ChatMessage.Bubble><OfficeMarkdown>{item.text||''}</OfficeMarkdown></ChatMessage.Bubble></ChatMessage.User>)}
    <OfficeAgentTrace turn={turn}/>
    {trace&&<OfficeExecutionTrace turn={turn}>{trace}</OfficeExecutionTrace>}
    {turn.status==='running'&&!turn.modelReasoning?.some(b=>b.text.trim())&&!body.some(item=>item.text?.trim())&&!trace&&<p role="status" data-testid="reply-waiting">正在处理…</p>}
    {receipts.length>0&&<OfficeImageViews receipts={receipts} renderImages={renderViewedImages}/>}
    {body.map(item=>{
      const streaming=turn.status==='running'&&item===turn.items.at(-1);
      const partial=item.phase==='partial_answer'||['failed','interrupted'].includes(turn.status);
      const final=item.phase==='final_answer'||partial;
      return <ChatMessage.Assistant key={item.id} data-item-id={item.id} data-phase={partial?'partial_answer':item.phase} data-testid="agent-reply-body"><ChatMessage.Body>
        {partial&&<p className="office-partial-label">部分回复 · 尚未完成</p>}
        <ChatMessage.Content><OfficeMarkdown animated={false} isStreaming={streaming}>{item.text||''}</OfficeMarkdown>{item.truncated&&<p className="office-history-notice">这段内容较长，当前显示部分内容。</p>}</ChatMessage.Content>
        {final&&!streaming&&replyActions&&<><OfficeReplySources turn={turn} sessionId={sessionId}/>{replyActions(turn,item)}</>}
      </ChatMessage.Body></ChatMessage.Assistant>;
    })}
    {['completed','interrupted','failed'].includes(turn.status)&&(turn.traceElapsedMs??turn.elapsedMs)!==undefined&&<p data-testid="office-turn-duration">本轮用时 {formatProcessDuration(turn.traceElapsedMs??turn.elapsedMs??0)}</p>}
  </>;
});
