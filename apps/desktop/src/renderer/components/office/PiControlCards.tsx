import {useState} from 'react';
import { Button, TextArea } from '@heroui/react';
import { CircleHelp, CornerDownRight } from 'lucide-react';
import { ChatTool } from '../../heroui-pro/components/chat-tool';
import type { XiaozhiControl } from '../../../shared/xiaozhi-agent';
import {XIAOZHI_ERRORS} from '../../../shared/xiaozhi-projection';
import { useOfficeComposerState, useOfficeControlState } from './OfficeComposerState';
import {inComposerQueue} from './PiComposerQueue';
import {followUpLabel} from './composer-follow-up';
import './pi-control-surfaces.css';

export function PiControlCards({items,onAnswer}:{items:XiaozhiControl[];onAnswer:(id:string,answer:string)=>Promise<void>}) {
  return <>{items.filter(item=>item.kind!=='plan'&&!inComposerQueue(item)).map(item=>
    item.kind==='question'?<PiTeacherQuestionCard key={item.id} item={item} onAnswer={onAnswer}/>:
    <InstructionHistory key={item.id} item={item}/>)}</>;
}

function InstructionHistory({item}:{item:XiaozhiControl}){
  const {inputRef,setDraft}=useOfficeComposerState();
  const [notice,setNotice]=useState('');
  const interrupted=item.state==='interrupted';
  function restore(){
    const draft=inputRef.current;
    if(draft.text||draft.paperExportIntent||draft.paperExportInvalid){setNotice('输入框已有草稿，请先处理当前草稿。');return;}
    setDraft(item.text);
    document.querySelector<HTMLTextAreaElement>('[data-testid="office-prompt-input"]')?.focus();
  }
  return <div className="pi-queued-instruction" data-testid="pi-queued-instruction" data-control-id={item.id} data-state={item.state} data-revision={item.revision??0}>
    <ChatTool className="pi-instruction-card" defaultExpanded={interrupted} state={interrupted?'output-error':'output-available'}>
      <ChatTool.Trigger><ChatTool.StatusIcon/><strong>{followUpLabel(item.mode??'followUp')} · {item.state==='applied'?'已送达':item.state==='withdrawn'?'已删除':'已中断'}</strong></ChatTool.Trigger>
      <ChatTool.Content><p>{item.text}</p>
        {interrupted&&<Button size="sm" variant="ghost" onPress={restore}>放回输入框</Button>}
        {notice&&<p role="status">{notice}</p>}
      </ChatTool.Content>
    </ChatTool>
  </div>;
}
export function PiTeacherQuestionCard({item,onAnswer,inComposer=false}:{item:XiaozhiControl;onAnswer:(id:string,answer:string)=>Promise<void>;inComposer?:boolean}) {
  const {draft,update,lock}=useOfficeControlState(item.id,{answer:item.answer||''});const {answer,busy,error}=draft;
  const editable=item.state === 'pending' || (item.state === 'interrupted' && item.canResume);
  async function submit(value:string) {
    if (!editable || lock.current || !value.trim()) return;
    lock.current=true;update({busy:true,error:''});
    try {await onAnswer(item.id,value.trim());}
    catch(error){
      const code=error instanceof Error?error.message:'';
      update({error:code==='task_context_changed'||code==='task_ended'?XIAOZHI_ERRORS[code]:'回答未提交，请重试。'});
    }finally{lock.current=false;update({busy:false});}
  }
  const identity={'data-testid':'pi-teacher-question','data-control-id':item.id,'data-state':item.state};
  const content=<><p className="pi-question-text">{item.text}</p>{editable ? <>
      {item.canResume && <p className="pi-history-note">回答后开始新一轮，旧审批不会继续执行。</p>}
      <div className="pi-question-options" role="group" aria-label="建议回答">{item.options?.map((option,index)=><Button key={index} variant="ghost" className="pi-question-option" isDisabled={busy} aria-pressed={answer===option} data-testid={`pi-question-option-${index}`} onPress={()=>update({answer:option,error:''})}><span className="pi-option-number">{index+1}</span><span>{option}</span></Button>)}</div>
      <label className="pi-question-answer"><span className="pi-question-free-label">或自行填写回答</span><TextArea rows={1} aria-label="回答小智的问题" placeholder="或自行填写回答" data-testid="pi-question-answer" value={answer} maxLength={4000} disabled={busy} onChange={event=>update({answer:event.target.value,error:''})}/></label>
      <div className="pi-question-footer">{!inComposer&&<span><CornerDownRight size={14} aria-hidden="true"/>选择后发送回答</span>}<Button size="sm" data-testid="pi-question-submit" isDisabled={busy || !answer.trim()} onPress={()=>void submit(answer)}>{busy?'正在提交…':'发送回答'}</Button></div>
    </> : item.answer && <p>你的回答：{item.answer}</p>}{error && <p role="alert">{error}</p>}</>;
  if(inComposer)return <div {...identity}>{content}</div>;
  return <ChatTool key={`${item.id}:${editable}`} className="pi-question-card" defaultExpanded={editable || item.state === 'answered'} state={editable?'requires-action':item.state === 'answered'?'output-available':'output-error'} {...identity}>
    <ChatTool.Trigger><CircleHelp size={16} aria-hidden="true"/><span>{item.state === 'pending' ? '问题' : item.state === 'answered' ? '已回答' : item.canResume ? '上次提问已中断' : '提问已停止'}</span></ChatTool.Trigger>
    <ChatTool.Content>{content}</ChatTool.Content>
  </ChatTool>;
}
