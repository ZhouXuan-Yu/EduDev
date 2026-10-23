import { useEffect, useState } from 'react';
import { OfficeConversation, type OfficeConversationProps } from './OfficeConversation';
import { useOfficeComposerState } from './OfficeComposerState';
import { PiTaskPlan } from './PiTaskPlan';
import type { XiaozhiControl } from '../../../shared/xiaozhi-agent';
import { useOfficeReadingPosition } from './OfficeReadingPosition';
import {OfficeReplyActions} from './OfficeReplyActions';

/** Preparing a retry changes an unsent draft; it never starts/replays a run. */
export function PiConversationSurface({controls=[],running,visible=true,...props}:OfficeConversationProps&{controls?:XiaozhiControl[];running:boolean;visible?:boolean}) {
  const {draft,setDraft}=useOfficeComposerState();
  const [retryHint,setRetryHint]=useState('');
  const latestRun=props.projection.turns.at(-1)?.id;
  const reading=useOfficeReadingPosition(props.projection.threadId,visible);
  useEffect(()=>setRetryHint(''),[latestRun]);
  function prepare(turnId:string){
    const turn=props.projection.turns.find(turn=>turn.id===turnId);
    if(running||turn?.status!=='failed')return;
    if(draft.trim()){setRetryHint('输入框中已有未发送内容，已为你保留。请先保存或清空，再重新整理任务。');return;}
    const prompt=turn.items.find(item=>item.kind==='message'&&item.role==='user')?.text;
    if(!prompt?.trim()){setRetryHint('未找到这一轮的原任务，请在输入框重新描述需要继续的事项。');return;}
    setDraft(prompt);setRetryHint('原任务已放回输入框。请检查已完成的操作，调整后再发送；小智不会自动重新执行。');
  }
  function prepareText(text:string){
    if(draft.trim()){setRetryHint('输入框已有未发送内容，已保留；请先发送或清空草稿。');return;}
    setDraft(text);setRetryHint('内容已放入输入框，确认或调整后发送。');
    requestAnimationFrame(()=>document.querySelector<HTMLTextAreaElement>('[data-testid="office-prompt-input"]')?.focus());
  }
  function continueTurn(turnId:string){
    const turn=props.projection.turns.find(item=>item.id===turnId);if(running||turn?.status!=='interrupted')return;
    const text=turn.items.filter(item=>item.role==='assistant').at(-1)?.text||'';
    prepareText(`请接续本会话刚才中断的文字内容${text?`，从「${text.slice(-180)}」之后继续`:''}。先核对已完成的操作，不重复写入或重放旧审批；新的写入仍要等我确认。`);
  }
  return <>{retryHint&&<p className="pi-retry-hint" role="status" data-testid="pi-retry-hint">{retryHint}</p>}
    <OfficeConversation {...props} readingRef={reading.ref} onReadingScroll={reading.onScroll} retryLabel="重新整理任务" onRetry={running?undefined:prepare} onContinue={running?undefined:continueTurn} onSuggest={prepareText} replyActions={(turn,item)=>running?null:<OfficeReplyActions turn={turn} item={item} sessionId={props.projection.threadId}/>} renderPlan={item=>{
      const plan=controls.find(control=>control.id===item.id&&control.kind==='plan');return plan?<PiTaskPlan plan={plan}/>:undefined;
    }}/></>;
}
