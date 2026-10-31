import { Button } from '@heroui/react';
import type { ReactNode, Ref, UIEventHandler } from 'react';
import { Fragment, useCallback, useLayoutEffect, useRef, useState } from 'react';
import { FileCheck2, ListTodo, Minimize2 } from 'lucide-react';
import type { OfficeProjectedItem, OfficeProjectedTurn, OfficeProjection } from '../../../shared/office-agent';
import { ChatConversation } from '../../heroui-pro/components/chat-conversation';
import { ChatMessage } from '../../heroui-pro/components/chat-message';
import { ChatTool } from '../../heroui-pro/components/chat-tool';
import { OfficeMarkdown } from './OfficeMarkdown';
import { ChainOfThought } from '../../heroui-pro/components/chain-of-thought';
import './office-conversation.css';
import { OfficeToolProcess } from './OfficeToolProcess';
import { groupOfficeProcess, formatProcessDuration } from './office-process';
import {OfficeImageViews} from './OfficeImageViews';
import type {PublicImageDelivery} from '../../../shared/xiaozhi-public-images';
import {OfficeReplySources} from './OfficeReplySources';
import {OfficeAgentTurn} from './OfficeAgentTurn';
import {useNativeHeroUITheme} from './useNativeHeroUITheme';
import {OfficeVerificationNotice} from './OfficeVerificationNotice';
import {OfficeRecoveryNotice} from './OfficeRecoveryNotice';
import {OfficeToolExpansionScope} from './OfficeToolExpansion';
import {OfficeTextSelection} from './OfficeTextSelection';
import { interactionLayout, OfficeInteractionCards, type OfficeInteraction } from './OfficeInteractions';
import { WorkbenchHome } from '../product/WorkbenchHome';

export interface OfficeConversationProps {
  agentTrace?: boolean;
  projection: OfficeProjection;
  onLoadEarlier?: () => void | Promise<void>;
  onRetry?: (turnId: string) => void;
  retryLabel?: string;
  onContinue?: (turnId:string)=>void;
  onSuggest?: (text:string)=>void;
  replyActions?: (turn:OfficeProjectedTurn,item:OfficeProjectedItem)=>ReactNode;
  renderPlan?: (item: OfficeProjectedItem) => ReactNode;
  renderAttachments?: (item: OfficeProjectedItem) => ReactNode;
  renderViewedImages?: (images:PublicImageDelivery[])=>ReactNode;
  readingRef?: Ref<HTMLDivElement>;
  onReadingScroll?: UIEventHandler<HTMLDivElement>;
  renderApprovals?: (turnId: string) => ReactNode;
  interactions?: readonly OfficeInteraction[];
}

function TurnNotice({ turn, onRetry, retryLabel, onContinue }: { turn: OfficeProjectedTurn; onRetry?: (turnId: string) => void; retryLabel?: string;onContinue?:(id:string)=>void }) {
  if (turn.status === 'completed' || turn.status === 'running') return null;
  const label = turn.status === 'failed' ? '小智未完成本轮' : turn.status === 'interrupted'
    ? '本轮已中断' : turn.status === 'waiting_approval' ? '等待你的确认' : '等待你的补充';
  return (
    <div className="office-turn-notice" data-state={turn.status} role={turn.status === 'failed' ? 'alert' : 'status'}>
      <FileCheck2 size={16} aria-hidden="true" />
      <div><strong>{label}</strong>{turn.error && <p>{turn.error}</p>}</div>
      {turn.status === 'failed' && onRetry && <Button size="sm" variant="outline" data-testid="office-turn-retry" onPress={() => onRetry(turn.id)}>{retryLabel||'重试'}</Button>}
      {turn.status === 'interrupted' && onContinue && <Button size="sm" variant="outline" data-testid="office-turn-continue" onPress={()=>onContinue(turn.id)}>准备继续</Button>}
    </div>
  );
}

export function OfficeConversation({ projection, agentTrace=false, onLoadEarlier, onRetry, retryLabel, onContinue, onSuggest, replyActions, renderPlan, renderApprovals, renderAttachments, renderViewedImages, readingRef, onReadingScroll, interactions = [] }: OfficeConversationProps) {
  const nativeTheme=useNativeHeroUITheme();
  const host = useRef<HTMLDivElement | null>(null);
  const [loadingEarlier,setLoadingEarlier]=useState(false);
  const [earlierError,setEarlierError]=useState('');
  const pendingEarlierAnchor=useRef<{id:string;top:number;turnCount:number}|undefined>(undefined);
  const setHost = useCallback((node: HTMLDivElement | null) => {
    host.current = node;
    if (typeof readingRef === 'function') readingRef(node);
    else if (readingRef) readingRef.current = node;
  }, [readingRef]);
  useLayoutEffect(()=>{
    const pending=pendingEarlierAnchor.current;
    if(!pending||projection.turns.length<=pending.turnCount)return;
    const scroll=host.current;
    const anchor=scroll?[...scroll.querySelectorAll<HTMLElement>('[data-turn-id]')].find(node=>node.dataset.turnId===pending.id):undefined;
    if(scroll&&anchor)scroll.scrollTop+=anchor.getBoundingClientRect().top-pending.top;
    pendingEarlierAnchor.current=undefined;
  },[projection.turns.length]);
  async function loadEarlier(){
    if(!onLoadEarlier||loadingEarlier)return;
    const scroll=host.current,anchorId=projection.turns[0]?.id;
    const before=anchorId&&scroll?[...scroll.querySelectorAll<HTMLElement>('[data-turn-id]')].find(node=>node.dataset.turnId===anchorId)?.getBoundingClientRect().top:undefined;
    pendingEarlierAnchor.current=anchorId&&before!==undefined?{id:anchorId,top:before,turnCount:projection.turns.length}:undefined;
    setLoadingEarlier(true);setEarlierError('');
    try{
      await onLoadEarlier();
      await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()));
    }catch{
      pendingEarlierAnchor.current=undefined;
      setEarlierError('没能加载较早的消息。当前记录仍然保留，请重试。');
    }finally{
      setLoadingEarlier(false);
    }
  }
  // An empty landing page is not a conversation: bottom anchoring clips its heading.
  // Mount the original streaming scroller only when there is history to follow.
  if (!projection.turns.length && !projection.needsHydration && !projection.hasMoreHistory) {
    return <div className="wb-home-scroll" tabIndex={0} aria-label="小智对话" data-testid="office-conversation"><WorkbenchHome onSuggest={onSuggest}/></div>;
  }
  return (
    <OfficeTextSelection threadId={projection.threadId} host={host}>
    <ChatConversation key={projection.threadId} ref={setHost} onScroll={onReadingScroll} initial="instant" resize="instant" tabIndex={0} className={`office-conversation${agentTrace?' default':''}`} aria-label="小智对话" data-testid="office-conversation" data-heroui-native={agentTrace?'':undefined} data-theme={agentTrace?nativeTheme:undefined}>
      <ChatConversation.Content className="office-conversation-content">
        {projection.needsHydration && <p className="office-history-notice" role="status">正在同步对话记录…</p>}
        {projection.hasMoreHistory && <Button variant="ghost" size="sm" isDisabled={!onLoadEarlier||loadingEarlier} aria-label="加载较早的消息" data-testid="office-load-earlier" onPress={()=>void loadEarlier()}>{loadingEarlier?'正在加载较早的消息…':'加载较早的消息'}</Button>}
        {earlierError&&<p className="office-history-notice" role="alert">{earlierError}</p>}
        {projection.turns.length === 0 && !projection.needsHydration && <WorkbenchHome onSuggest={onSuggest} />}
        {projection.turns.map(turn => {
          if(agentTrace)return <section key={turn.id} className="office-turn" data-turn-id={turn.id} data-state={turn.status}>
            <OfficeAgentTurn turn={turn} sessionId={projection.threadId} renderPlan={renderPlan} renderAttachments={renderAttachments} renderViewedImages={renderViewedImages} replyActions={replyActions}/>
            {renderApprovals?.(turn.id)}
            <TurnNotice turn={turn} onRetry={onRetry} retryLabel={retryLabel} onContinue={onContinue}/>
          </section>;
          const placement = interactionLayout(turn, interactions);
          const parts = groupOfficeProcess(turn.items, new Set(placement.anchored.keys())), firstProcess = parts.findIndex(part => part.kind === 'tools' || part.item.role !== 'user');
          const receipts=turn.items.flatMap(item=>item.imageDelivery?[item.imageDelivery]:[]);
          const lastReceipt=[...turn.items].reverse().find(item=>item.imageDelivery?.state==='received');
          const duration = turn.elapsedMs !== undefined && ['completed', 'failed', 'interrupted'].includes(turn.status)
            ? <p className="office-turn-duration" data-testid="office-turn-duration">已处理 {formatProcessDuration(turn.elapsedMs)}</p> : null;
          return (
          <OfficeToolExpansionScope key={JSON.stringify([projection.threadId,turn.id])}>
          <section className="office-turn" data-turn-id={turn.id} data-state={turn.status}>
            {parts.map((part, partIndex) => <Fragment key={part.kind === 'tools' ? part.items[0].id : part.item.id}>
              {partIndex === firstProcess && duration}
              {(() => {
              if (part.kind === 'tools') return <><OfficeToolProcess key={part.items[0].id} items={part.items} sessionId={projection.threadId} />
                {lastReceipt&&part.items.some(item=>item.id===lastReceipt.id)&&<OfficeImageViews receipts={receipts} renderImages={renderViewedImages}/>}
                {part.items.map(item => <OfficeInteractionCards key={item.id} items={placement.anchored.get(item.id) || []} anchored />)}</>;
              const item = part.item;
              if (item.kind === 'memory_isolation' || item.kind === 'skill_isolation') return <ChatTool key={item.id} className="office-compaction" state="output-available" data-item-id={item.id} data-testid={item.kind === 'skill_isolation' ? 'pi-skill-isolation' : 'pi-memory-isolation'}><ChatTool.Trigger><FileCheck2 size={15} aria-hidden="true" />{item.label}</ChatTool.Trigger><ChatTool.Content><p>{item.text}</p></ChatTool.Content></ChatTool>;
              if (item.kind === 'compaction') return <ChatTool key={`${item.id}:${item.status === 'failed'}`} className="office-compaction" state={item.status === 'failed' ? 'output-error' : item.status === 'inProgress' ? 'input-available' : 'output-available'} defaultExpanded={item.status === 'failed'} data-item-id={item.id} data-testid="pi-compaction-card" data-state={item.status || 'completed'}><ChatTool.Trigger><Minimize2 size={15} aria-hidden="true" />{item.label || '压缩上下文'}<span className="office-step-state">{item.status === 'inProgress' ? '进行中' : item.status === 'failed' ? '未完成' : '已完成'}</span></ChatTool.Trigger><ChatTool.Content><p>{item.text || '上下文已压缩。'}</p></ChatTool.Content></ChatTool>;
              if (item.kind === 'plan') return renderPlan?.(item) ?? <ChainOfThought key={item.id} defaultExpanded className="office-plan" data-item-id={item.id} data-testid="pi-task-plan"><ChainOfThought.Trigger><ListTodo size={16} aria-hidden="true" />任务计划</ChainOfThought.Trigger><ChainOfThought.Content><ChainOfThought.Steps>{(item.text || '').split('\n\n').filter(Boolean).map((step,index)=><ChainOfThought.Step key={index}>{step}</ChainOfThought.Step>)}</ChainOfThought.Steps></ChainOfThought.Content></ChainOfThought>;
              const isStreaming = turn.status === 'running' && item === turn.items.at(-1) && item.role === 'assistant';
              const body = <OfficeMarkdown animated={false} isStreaming={isStreaming}>{item.text ?? ''}</OfficeMarkdown>;
              const partial=item.phase==='partial_answer'||(['failed','interrupted'].includes(turn.status)&&item===turn.items.filter(v=>v.role==='assistant').at(-1));
              const final=item.phase==='final_answer'||partial;
              if(item.role==='assistant'&&!final&&!isStreaming&&turn.status!=='running')return <details className="office-commentary" data-testid="reply-process-summary"><summary>查看工作过程说明</summary>{body}</details>;
              return item.role === 'user'
                ? <ChatMessage.User key={item.id} data-item-id={item.id}>{renderAttachments?.(item)}<ChatMessage.Bubble>{body}</ChatMessage.Bubble></ChatMessage.User>
                : <ChatMessage.Assistant key={item.id} data-item-id={item.id} data-phase={partial?'partial_answer':item.phase}><ChatMessage.Body>{partial&&<p className="office-partial-label">部分回复 · 尚未完成</p>}<ChatMessage.Content>{body}{item.truncated && <p className="office-history-notice">这段内容较长，当前显示部分内容。</p>}</ChatMessage.Content>{final&&!isStreaming&&replyActions&&<><OfficeReplySources turn={turn} sessionId={projection.threadId}/>{replyActions(turn,item)}</>}</ChatMessage.Body></ChatMessage.Assistant>;
              })()}
            </Fragment>)}
            {firstProcess < 0 && duration}
            {renderApprovals?.(turn.id)}
            <OfficeInteractionCards items={placement.unanchored} anchored={false} />
            <TurnNotice turn={turn} onRetry={onRetry} retryLabel={retryLabel} onContinue={onContinue} />
            <OfficeVerificationNotice turn={turn}/>
            <OfficeRecoveryNotice turn={turn}/>
          </section>
          </OfficeToolExpansionScope>
        );})}
        <ChatConversation.ScrollAnchor />
      </ChatConversation.Content>
      <ChatConversation.ScrollButton aria-label="回到最新消息" />
    </ChatConversation>
    </OfficeTextSelection>
  );
}
