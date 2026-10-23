import {memo} from 'react';
import {FileCheck2,Minimize2,ListTodo} from 'lucide-react';
import type {OfficeConversationProps} from './OfficeConversation';
import type {OfficeProjectedTurn} from '../../../shared/office-agent';
import {ChatMessage} from '../../heroui-pro/components/chat-message';
import {ChatTool} from '../../heroui-pro/components/chat-tool';
import {ChainOfThought} from '../../heroui-pro/components/chain-of-thought';
import {OfficeAgentTrace} from './OfficeAgentTrace';
import {splitAgentTrace,agentTraceParts} from './agent-trace';
import {OfficeToolProcess} from './OfficeToolProcess';
import {OfficeMarkdown} from './OfficeMarkdown';
import {OfficeImageViews} from './OfficeImageViews';
import {OfficeReplySources} from './OfficeReplySources';

type Props=Pick<OfficeConversationProps,'renderPlan'|'renderAttachments'|'renderViewedImages'|'replyActions'>&{turn:OfficeProjectedTurn;sessionId:string};
/** One run owns trace disclosure state; unrelated history never gets a ticking timer. */
export const OfficeAgentTurn=memo(function OfficeAgentTurn({turn,sessionId,renderPlan,renderAttachments,renderViewedImages,replyActions}:Props){
  const {users,body}=splitAgentTrace(turn);
  const parts=agentTraceParts(turn);
  const receipts=turn.items.flatMap(item=>item.imageDelivery?[item.imageDelivery]:[]);
  const trace=parts.length?<>{Boolean(turn.publicStagesOmitted)&&<p>仅显示最近64段阶段记录，较早{turn.publicStagesOmitted}段未在此展示。</p>}{parts.map(part=>{
    if(part.kind==='stage'){
      const stage=part.stage;
      const current=turn.status==='running'&&stage===turn.publicStages?.at(-1)&&!turn.items.some(item=>item.kind==='tool'&&item.status==='inProgress');
      const label={preparing:'准备请求与核对资料范围',waiting_model:'等待模型回复',responding:'接收并生成正文'}[stage.stage];
      const detail={preparing:'已开始处理本轮请求，核对允许使用的资料范围。',waiting_model:'请求已发出，等待模型返回内容。',responding:'已收到模型文字，正文在过程下方逐步输出。'}[stage.stage];
      return <ChainOfThought.Step key={`stage:${stage.sequence}:${stage.since}`} label={`${label} · ${new Date(stage.since).toLocaleTimeString('zh-CN',{hour12:false})}`}><div data-testid="agent-public-stage" data-stage={stage.stage} data-sequence={stage.sequence}>{current?'当前阶段 · ':''}{detail}{stage===turn.publicStages?.at(-1)&&['failed','interrupted'].includes(turn.status)?' 此阶段之后，本轮未完成。':''}</div></ChainOfThought.Step>;
    }
    if(part.kind==='tools')return <ChainOfThought.Step key={part.items[0].id}><OfficeToolProcess items={part.items} sessionId={sessionId}/></ChainOfThought.Step>;
    const item=part.item;
    if(item.kind==='plan')return <ChainOfThought.Step key={item.id}>{renderPlan?.(item)||<div data-testid="pi-task-plan"><ListTodo size={15}/>任务计划<OfficeMarkdown>{item.text||''}</OfficeMarkdown></div>}</ChainOfThought.Step>;
    if(item.kind==='compaction'||item.kind==='memory_isolation'||item.kind==='skill_isolation')return <ChainOfThought.Step key={item.id}><ChatTool className="office-compaction" state={item.status==='failed'?'output-error':item.status==='inProgress'?'input-available':'output-available'} defaultExpanded={item.status==='failed'} data-state={item.status||'completed'} data-item-id={item.id} data-testid={item.kind==='compaction'?'pi-compaction-card':item.kind==='skill_isolation'?'pi-skill-isolation':'pi-memory-isolation'}><ChatTool.Trigger>{item.kind==='compaction'?<Minimize2 size={15}/>:<FileCheck2 size={15}/>} {item.label||'整理上下文'}</ChatTool.Trigger><ChatTool.Content><p>{item.text}</p></ChatTool.Content></ChatTool></ChainOfThought.Step>;
    return <ChainOfThought.Step key={item.id} label="公开过程说明"><div data-testid="reply-process-summary" data-item-id={item.id}><OfficeMarkdown>{item.text||''}</OfficeMarkdown></div></ChainOfThought.Step>;
  })}</>:null;
  return <>
    {users.map(item=><ChatMessage.User key={item.id} data-item-id={item.id}>{renderAttachments?.(item)}<ChatMessage.Bubble><OfficeMarkdown>{item.text||''}</OfficeMarkdown></ChatMessage.Bubble></ChatMessage.User>)}
    <OfficeAgentTrace turn={turn}>{trace}</OfficeAgentTrace>
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
  </>;
});
