import { useEffect, useState } from 'react';
import { OfficeConversation, type OfficeConversationProps } from './OfficeConversation';
import { useOfficeComposerState } from './OfficeComposerState';
import { PiTaskPlan } from './PiTaskPlan';
import type { XiaozhiControl } from '../../../shared/xiaozhi-agent';

/** Preparing a retry changes an unsent draft; it never starts/replays a run. */
export function PiConversationSurface({controls=[],running,...props}:OfficeConversationProps&{controls?:XiaozhiControl[];running:boolean}) {
  const {draft,setDraft}=useOfficeComposerState();
  const [retryHint,setRetryHint]=useState('');
  const latestRun=props.projection.turns.at(-1)?.id;
  useEffect(()=>setRetryHint(''),[latestRun]);
  function prepare(turnId:string){
    const turn=props.projection.turns.find(turn=>turn.id===turnId);
    if(running||turn?.status!=='failed')return;
    if(draft.trim()){setRetryHint('输入框中已有未发送内容，已为你保留。请先保存或清空，再重新整理任务。');return;}
    const prompt=turn.items.find(item=>item.kind==='message'&&item.role==='user')?.text;
    if(!prompt?.trim()){setRetryHint('未找到这一轮的原任务，请在输入框重新描述需要继续的事项。');return;}
    setDraft(prompt);setRetryHint('原任务已放回输入框。请检查已完成的操作，调整后再发送；小智不会自动重新执行。');
  }
  return <>{retryHint&&<p className="pi-retry-hint" role="status" data-testid="pi-retry-hint">{retryHint}</p>}
    <OfficeConversation {...props} retryLabel="重新整理任务" onRetry={running?undefined:prepare} renderPlan={item=>{
      const plan=controls.find(control=>control.id===item.id&&control.kind==='plan');return plan?<PiTaskPlan plan={plan}/>:undefined;
    }}/></>;
}
