import {AppNativeSelect} from '../ui/AppNativeSelect';
import {useState} from 'react';
import {Button, TextArea} from '@heroui/react';
import {ArrowDown, ArrowUp, CornerDownRight, GripVertical, Pencil, Trash2} from 'lucide-react';
import type {XiaozhiControl,XiaozhiQueueMutationInput} from '../../../shared/xiaozhi-agent';
import {useOfficeControlState} from './OfficeComposerState';
import {useOfficeSynchronization} from './OfficeSynchronization';
import {followUpLabel} from './composer-follow-up';

export const inComposerQueue=(item:XiaozhiControl)=>item.kind==='instruction'&&(item.state==='queued'||item.state==='dispatching');
type Mutation = (input:XiaozhiQueueMutationInput)=>Promise<void>;
type ItemAction = Omit<Extract<XiaozhiQueueMutationInput,{action:'edit'}>,'sessionId'|'controlId'|'revision'>
  | {action:'move';beforeId:string|null} | {action:'withdraw'};

export function PiComposerQueue({controls,sessionId,onMutation}:{controls:readonly XiaozhiControl[];sessionId:string;onMutation:Mutation}){
  const [dragged,setDragged]=useState<string>();
  const items=controls.filter(inComposerQueue).sort((a,b)=>Number(b.mode==='steer')-Number(a.mode==='steer')||(a.queueOrder??0)-(b.queueOrder??0));
  if(!items.length)return null;
  return <section className="edu-composer-queue" aria-label="待发送消息" data-testid="pi-composer-queue">
    <header><strong>待发送消息</strong><span aria-live="polite">{items.length} 条</span></header>
    <ol>{items.map(item=>{
      const group=items.filter(other=>other.mode===item.mode&&other.state==='queued');
      const index=group.indexOf(item);
      const source=group.find(other=>other.id===dragged);
      return <QueueItem key={item.id} item={item} sessionId={sessionId} mutate={onMutation}
        previous={index>0?group[index-1].id:undefined}
        next={index>=0&&index<group.length-1?group[index+2]?.id??null:undefined}
        draggable={index>=0&&group.length>1} onDrag={setDragged}
        dropSource={source&&source!==item&&item.state==='queued'?source:undefined}
        onDrop={()=>setDragged(undefined)}/>;
    })}</ol>
  </section>;
}

function QueueItem({item,sessionId,mutate,previous,next,draggable,onDrag,dropSource,onDrop}:{
  item:XiaozhiControl;sessionId:string;mutate:Mutation;previous?:string;next?:string|null;draggable:boolean;
  onDrag:(id?:string)=>void;dropSource?:XiaozhiControl;onDrop:()=>void;
}){
  const mode=item.mode??'followUp';
  const {draft,update,lock}=useOfficeControlState(item.id,{text:item.text,mode,revision:item.revision??0});
  const sync=useOfficeSynchronization();
  const editable=item.state==='queued';
  const blocked=!editable||draft.busy||sync.blocked;
  async function act(action:ItemAction,source=item,revision=source.revision??0){
    if(blocked||lock.current||sync.isBlocked())return;
    lock.current=true;update({busy:true,error:''});
    try{
      await mutate({sessionId,controlId:source.id,revision,...action});
      if(action.action==='edit')update({editing:false});
    }catch{update({error:'消息状态已变化或操作未送达，请核对队列后重试。'});}
    finally{lock.current=false;update({busy:false});}
  }
  return <li data-testid="pi-queued-instruction" data-control-id={item.id} data-state={item.state} data-revision={item.revision??0}
    onDragOver={event=>{if(dropSource&&!blocked){event.preventDefault();event.dataTransfer.dropEffect='move';}}}
    onDrop={event=>{if(!dropSource||blocked)return;event.preventDefault();onDrop();void act({action:'move',beforeId:item.id},dropSource);}}>
    <div className="edu-queue-row">
      {editable&&<span className="edu-queue-grip" aria-hidden="true" draggable={draggable&&!blocked&&!draft.editing}
        onDragStart={event=>{event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('application/x-edudev-queue',item.id);onDrag(item.id);}}
        onDragEnd={()=>onDrag()}><GripVertical size={15}/></span>}
      <span className="edu-queue-text" title={item.text}>{item.text}</span>
      <small className="edu-queue-timing">{editable?followUpLabel(mode):'正在送达'}</small>
      {editable&&!draft.editing&&<div className="edu-queue-row-actions" aria-label="待发送消息操作">
        {mode==='followUp'&&<Button size="sm" variant="ghost" isIconOnly aria-label="现在补充到本轮" data-testid="pi-instruction-steer" isDisabled={blocked}
          onPress={()=>void act({action:'edit',text:item.text,mode:'steer'})}><CornerDownRight size={15}/></Button>}
        {previous!==undefined&&<Button size="sm" variant="ghost" isIconOnly aria-label="上移" data-testid="pi-instruction-up" isDisabled={blocked}
          onPress={()=>void act({action:'move',beforeId:previous})}><ArrowUp size={15}/></Button>}
        {next!==undefined&&<Button size="sm" variant="ghost" isIconOnly aria-label="下移" data-testid="pi-instruction-down" isDisabled={blocked}
          onPress={()=>void act({action:'move',beforeId:next})}><ArrowDown size={15}/></Button>}
        <Button size="sm" variant="ghost" isIconOnly aria-label="编辑待发送消息" data-testid="pi-instruction-edit" isDisabled={blocked}
          onPress={()=>update({editing:true,text:item.text,mode,revision:item.revision??0,error:''})}><Pencil size={15}/></Button>
        <Button size="sm" variant="ghost" isIconOnly aria-label="删除待发送消息" data-testid="pi-instruction-withdraw" isDisabled={blocked}
          onPress={()=>void act({action:'withdraw'})}><Trash2 size={15}/></Button>
      </div>}
    </div>
    {editable&&draft.editing&&<div className="edu-queue-editor">
      <TextArea autoFocus aria-label="编辑待发送消息" data-testid="pi-instruction-text" value={draft.text} maxLength={8192} disabled={blocked}
        onChange={event=>update({text:event.target.value})}/>
      <div className="pi-queue-actions">
        <AppNativeSelect indicatorOnly aria-label="发送时机" data-testid="pi-instruction-mode" value={draft.mode} disabled={blocked} onChange={event=>update({mode:event.target.value==='steer'?'steer':'followUp'})}>
          <option value="followUp">本轮结束后发送</option><option value="steer">补充到本轮</option>
        </AppNativeSelect>
        <Button size="sm" data-testid="pi-instruction-save" isDisabled={blocked||!draft.text.trim()}
          onPress={()=>void act({action:'edit',text:draft.text.trim(),mode:draft.mode},item,draft.revision)}>保存</Button>
        <Button size="sm" variant="ghost" isDisabled={draft.busy} onPress={()=>update({editing:false,error:''})}>取消</Button>
      </div>
    </div>}
    {draft.error&&<p role="alert" className="office-send-error">{draft.error}</p>}
  </li>;
}
