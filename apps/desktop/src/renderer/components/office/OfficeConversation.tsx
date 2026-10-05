import { Button } from '@heroui/react';
import type { ReactNode, Ref, UIEventHandler } from 'react';
import { Fragment } from 'react';
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

export interface OfficeConversationProps {
  projection: OfficeProjection;
  onLoadEarlier?: () => void;
  onRetry?: (turnId: string) => void;
  retryLabel?: string;
  renderPlan?: (item: OfficeProjectedItem) => ReactNode;
  renderAttachments?: (item: OfficeProjectedItem) => ReactNode;
  renderViewedImages?: (images:PublicImageDelivery[])=>ReactNode;
  readingRef?: Ref<HTMLDivElement>;
  onReadingScroll?: UIEventHandler<HTMLDivElement>;
  renderApprovals?: (turnId: string) => ReactNode;
}

function TurnNotice({ turn, onRetry, retryLabel }: { turn: OfficeProjectedTurn; onRetry?: (turnId: string) => void; retryLabel?: string }) {
  if (turn.status === 'completed' || turn.status === 'running') return null;
  const label = turn.status === 'failed' ? '小智未完成本轮' : turn.status === 'interrupted'
    ? '本轮已中断' : turn.status === 'waiting_approval' ? '等待你的确认' : '等待你的补充';
  return (
    <div className="office-turn-notice" data-state={turn.status} role={turn.status === 'failed' ? 'alert' : 'status'}>
      <FileCheck2 size={16} aria-hidden="true" />
      <div><strong>{label}</strong>{turn.error && <p>{turn.error}</p>}</div>
      {turn.status === 'failed' && onRetry && <Button size="sm" variant="outline" data-testid="office-turn-retry" onPress={() => onRetry(turn.id)}>{retryLabel||'重试'}</Button>}
    </div>
  );
}

export function OfficeConversation({ projection, onLoadEarlier, onRetry, retryLabel, renderPlan, renderApprovals, renderAttachments, renderViewedImages, readingRef, onReadingScroll }: OfficeConversationProps) {
  return (
    <ChatConversation key={projection.threadId} ref={readingRef} onScroll={onReadingScroll} initial="instant" resize="instant" tabIndex={0} className="office-conversation" aria-label="小智对话" data-testid="office-conversation">
      <ChatConversation.Content className="office-conversation-content">
        {projection.needsHydration && <p className="office-history-notice" role="status">正在同步对话记录…</p>}
        {projection.hasMoreHistory && <Button variant="ghost" size="sm" isDisabled={!onLoadEarlier} onPress={onLoadEarlier}>加载较早的消息</Button>}
        {projection.turns.length === 0 && !projection.needsHydration && <div className="office-conversation-empty">有什么可以帮你？</div>}
        {projection.turns.map(turn => {
          const parts = groupOfficeProcess(turn.items), firstProcess = parts.findIndex(part => part.kind === 'tools' || part.item.role !== 'user');
          const receipts=turn.items.flatMap(item=>item.imageDelivery?[item.imageDelivery]:[]);
          const lastReceipt=[...turn.items].reverse().find(item=>item.imageDelivery?.state==='received');
          const duration = turn.elapsedMs !== undefined && ['completed', 'failed', 'interrupted'].includes(turn.status)
            ? <p className="office-turn-duration" data-testid="office-turn-duration">已处理 {formatProcessDuration(turn.elapsedMs)}</p> : null;
          return (
          <section key={turn.id} className="office-turn" data-turn-id={turn.id} data-state={turn.status}>
            {parts.map((part, partIndex) => <Fragment key={part.kind === 'tools' ? part.items[0].id : part.item.id}>
              {partIndex === firstProcess && duration}
              {(() => {
              if (part.kind === 'tools') return <><OfficeToolProcess key={part.items[0].id} items={part.items} sessionId={projection.threadId} />
                {lastReceipt&&part.items.some(item=>item.id===lastReceipt.id)&&<OfficeImageViews receipts={receipts} renderImages={renderViewedImages}/>}</>;
              const item = part.item;
              if (item.kind === 'memory_isolation' || item.kind === 'skill_isolation') return <ChatTool key={item.id} className="office-compaction" state="output-available" data-item-id={item.id} data-testid={item.kind === 'skill_isolation' ? 'pi-skill-isolation' : 'pi-memory-isolation'}><ChatTool.Trigger><FileCheck2 size={15} aria-hidden="true" />{item.label}</ChatTool.Trigger><ChatTool.Content><p>{item.text}</p></ChatTool.Content></ChatTool>;
              if (item.kind === 'compaction') return <ChatTool key={`${item.id}:${item.status === 'failed'}`} className="office-compaction" state={item.status === 'failed' ? 'output-error' : item.status === 'inProgress' ? 'input-available' : 'output-available'} defaultExpanded={item.status === 'failed'} data-item-id={item.id} data-testid="pi-compaction-card" data-state={item.status || 'completed'}><ChatTool.Trigger><Minimize2 size={15} aria-hidden="true" />{item.label || '压缩上下文'}<span className="office-step-state">{item.status === 'inProgress' ? '进行中' : item.status === 'failed' ? '未完成' : '已完成'}</span></ChatTool.Trigger><ChatTool.Content><p>{item.text || '上下文已压缩。'}</p></ChatTool.Content></ChatTool>;
              if (item.kind === 'plan') return renderPlan?.(item) ?? <ChainOfThought key={item.id} defaultExpanded className="office-plan" data-item-id={item.id} data-testid="pi-task-plan"><ChainOfThought.Trigger><ListTodo size={16} aria-hidden="true" />任务计划</ChainOfThought.Trigger><ChainOfThought.Content><ChainOfThought.Steps>{(item.text || '').split('\n\n').filter(Boolean).map((step,index)=><ChainOfThought.Step key={index}>{step}</ChainOfThought.Step>)}</ChainOfThought.Steps></ChainOfThought.Content></ChainOfThought>;
              const isStreaming = turn.status === 'running' && item === turn.items.at(-1) && item.role === 'assistant';
              const body = <OfficeMarkdown animated={false} isStreaming={isStreaming}>{item.text ?? ''}</OfficeMarkdown>;
              return item.role === 'user'
                ? <ChatMessage.User key={item.id} data-item-id={item.id}>{renderAttachments?.(item)}<ChatMessage.Bubble>{body}</ChatMessage.Bubble></ChatMessage.User>
                : <ChatMessage.Assistant key={item.id} data-item-id={item.id} data-phase={item.phase}><ChatMessage.Content>{body}{item.truncated && <p className="office-history-notice">这段内容较长，当前显示部分内容。</p>}</ChatMessage.Content></ChatMessage.Assistant>;
              })()}
            </Fragment>)}
            {firstProcess < 0 && duration}
            {renderApprovals?.(turn.id)}
            <TurnNotice turn={turn} onRetry={onRetry} retryLabel={retryLabel} />
          </section>
        );})}
        <ChatConversation.ScrollAnchor />
      </ChatConversation.Content>
      <ChatConversation.ScrollButton aria-label="回到最新消息" />
    </ChatConversation>
  );
}
