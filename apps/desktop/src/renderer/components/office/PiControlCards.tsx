import { Button, TextArea } from '@heroui/react';
import { CircleHelp, CornerDownRight } from 'lucide-react';
import { ChatTool } from '../../heroui-pro/components/chat-tool';
import type { XiaozhiControl, XiaozhiQueueMutationInput } from '../../../shared/xiaozhi-agent';
import { useOfficeControlState } from './OfficeComposerState';
import './pi-control-surfaces.css';

export function PiControlCards({ items,onAnswer,sessionId,onMutation }: {items:XiaozhiControl[];onAnswer:(id:string,answer:string)=>Promise<void>;sessionId:string;onMutation:(input:XiaozhiQueueMutationInput)=>Promise<void>}) {
  return <>{items.filter(item=>item.kind !== 'plan').map(item=>item.kind === 'question' ? <Question key={item.id} item={item} onAnswer={onAnswer}/> :
    <Instruction key={item.id} item={item} sessionId={sessionId} onMutation={onMutation}/>)}</>;
}
function Instruction({item,sessionId,onMutation}:{item:XiaozhiControl;sessionId:string;onMutation:(input:XiaozhiQueueMutationInput)=>Promise<void>}) {
  const {draft,update,lock}=useOfficeControlState(item.id,{text:item.text,mode:item.mode||'steer',revision:item.revision??0});
  const {editing,text,mode,busy,error}=draft;
  const editable=item.state === 'queued';
  async function mutate(action:'edit'|'withdraw') {
    if (!editable || lock.current || (action === 'edit' && !text.trim())) return;
    lock.current=true;update({busy:true,error:''});
    try { await onMutation({sessionId,controlId:item.id,revision:action === 'edit' ? draft.revision : item.revision ?? 0,
      ...(action === 'edit' ? {action,text:text.trim(),mode} : {action})}); update({editing:false}); }
    catch {update({error:'修改未生效。指令可能已开始处理或版本已变化，请查看最新状态后重试。'});}
    finally{lock.current=false;update({busy:false});}
  }
  const status=item.state === 'queued' ? '排队中' : item.state === 'dispatching' ? '正在交付，已锁定' : item.state === 'applied' ? '已送达' : item.state === 'withdrawn' ? '已撤回' : '已中断，未自动重发';
  return <div className="pi-queued-instruction" data-testid="pi-queued-instruction" data-control-id={item.id} data-state={item.state} data-revision={item.revision ?? 0}>
    <ChatTool key={`${item.id}:${editable}`} className="pi-instruction-card" defaultExpanded={editable || item.state === 'dispatching' || item.state === 'interrupted'} state={editable?'requires-action':item.state === 'dispatching'?'input-available':item.state === 'interrupted'?'output-error':'output-available'}>
      <ChatTool.Trigger><ChatTool.StatusIcon/><strong>{item.mode === 'steer' ? '补充本轮' : '接着处理'} · {status}</strong></ChatTool.Trigger>
      <ChatTool.Content><p>{item.text}</p>
        {editable && <>{editing ? <>
          <label className="pi-question-answer">修改待处理指令<TextArea aria-label="修改待处理指令" data-testid="pi-instruction-text" maxLength={8192} value={text} disabled={busy} onChange={event=>update({text:event.target.value})}/></label>
          <label>处理方式 <select aria-label="指令处理方式" data-testid="pi-instruction-mode" disabled={busy} value={mode} onChange={event=>update({mode:event.target.value as typeof mode})}><option value="steer">补充本轮</option><option value="followUp">接着处理</option></select></label>
          <div className="pi-queue-actions"><Button size="sm" data-testid="pi-instruction-save" isDisabled={busy || !text.trim()} onPress={()=>void mutate('edit')}>保存修改</Button><Button size="sm" variant="ghost" isDisabled={busy} onPress={()=>update({editing:false,error:''})}>取消编辑</Button></div>
        </> : <div className="pi-queue-actions"><Button size="sm" variant="ghost" data-testid="pi-instruction-edit" isDisabled={busy} onPress={()=>update({revision:item.revision??0,text:item.text,mode:item.mode||'steer',editing:true,error:''})}>编辑</Button><Button size="sm" variant="ghost" data-testid="pi-instruction-withdraw" isDisabled={busy} onPress={()=>void mutate('withdraw')}>撤回</Button></div>}</>}
        {error && <p role="alert">{error}</p>}
      </ChatTool.Content>
    </ChatTool>
  </div>;
}
function Question({item,onAnswer}:{item:XiaozhiControl;onAnswer:(id:string,answer:string)=>Promise<void>}) {
  const {draft,update,lock}=useOfficeControlState(item.id,{answer:item.answer||''});const {answer,busy,error}=draft;
  const editable=item.state === 'pending' || (item.state === 'interrupted' && item.canResume);
  async function submit(value:string) {
    if (!editable || lock.current || !value.trim()) return;
    lock.current=true;update({busy:true,error:''});
    try {await onAnswer(item.id,value.trim());}catch{update({error:'回答未提交，请重试。'});}finally{lock.current=false;update({busy:false});}
  }
  return <ChatTool key={`${item.id}:${editable}`} className="pi-question-card" defaultExpanded={editable} state={editable?'requires-action':item.state === 'answered'?'output-available':'output-error'} data-testid="pi-teacher-question" data-control-id={item.id} data-state={item.state}>
    <ChatTool.Trigger><CircleHelp size={16} aria-hidden="true"/><span>{item.state === 'pending' ? '问题' : item.state === 'answered' ? '已回答' : item.canResume ? '上次提问已中断' : '提问已停止'}</span></ChatTool.Trigger>
    <ChatTool.Content><p className="pi-question-text">{item.text}</p>{editable ? <>
      {item.canResume && <p className="pi-history-note">回答后开始新一轮，旧审批不会继续执行。</p>}
      <div className="pi-question-options" role="group" aria-label="建议回答">{item.options?.map((option,index)=><Button key={index} variant="ghost" className="pi-question-option" isDisabled={busy} aria-pressed={answer===option} data-testid={`pi-question-option-${index}`} onPress={()=>update({answer:option,error:''})}><span className="pi-option-number">{index+1}</span><span>{option}</span></Button>)}</div>
      <label className="pi-question-answer"><span className="pi-question-free-label">或自行填写回答</span><TextArea rows={1} aria-label="回答小智的问题" placeholder="或自行填写回答" data-testid="pi-question-answer" value={answer} maxLength={4000} disabled={busy} onChange={event=>update({answer:event.target.value,error:''})}/></label>
      <div className="pi-question-footer"><span><CornerDownRight size={14} aria-hidden="true"/>选择后发送回答</span><Button size="sm" data-testid="pi-question-submit" isDisabled={busy || !answer.trim()} onPress={()=>void submit(answer)}>{busy?'正在提交…':'发送回答'}</Button></div>
    </> : item.answer && <p>你的回答：{item.answer}</p>}{error && <p role="alert">回答未提交，请重试。</p>}</ChatTool.Content>
  </ChatTool>;
}
