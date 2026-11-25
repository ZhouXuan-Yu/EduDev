import {useRef,useState} from 'react';
import {Button,Dropdown,Label,Modal} from '@heroui/react';
import {ChevronDown} from 'lucide-react';
import {PiConfigHistory} from './PiConfigHistory';
import type {XiaozhiSettingsView} from '../../../shared/xiaozhi-settings';
import {THINKING_CHOICES,THINKING_LABELS,supportedThinking,type ThinkingChoice} from '../../../shared/xiaozhi-thinking';

export function PiThinkingPicker({view,scope,disabled=false,visible=true,onChange,sessionId,onHistoryChange}:{
  view?:XiaozhiSettingsView;scope:'global'|'session';disabled?:boolean;visible?:boolean;
  onChange:(choice:ThinkingChoice|null)=>void;sessionId?:string;onHistoryChange?:()=>void;
}){
  const [open,setOpen]=useState(false),[history,setHistory]=useState(false);
  const trigger=useRef<HTMLButtonElement>(null);
  function closeHistory(){setHistory(false);requestAnimationFrame(()=>trigger.current?.focus());}
  if(!view?.thinking)return null;
  const locked=disabled||(view.ordinaryLocked??view.locked);
  const settings=view.thinking,selected=scope==='global'?settings.global:settings.session;
  const model=scope==='global'?view.defaultModel:view.sessionModel?.model;
  const available=supportedThinking(view.models.find(item=>item.id===model));
  const choice=selected?.choice??null, inherited=settings.global.choice||'auto';
  const last=scope==='session'?settings.lastRun:undefined;
  const label=choice===null?`跟随默认 · ${THINKING_LABELS[inherited]}`:THINKING_LABELS[choice];
  const note=available.length===1?'模型思考能力尚未确认，请在设置中刷新官方目录；当前仅可自动。'
    :!available.includes(choice??inherited)?'已保存档位不适用于当前模型，本轮将明确使用自动。'
    :'只改变下一轮配置；高强度通常更慢，并可能消耗更多额度。';
  const detail=last?`最近一轮配置：${last.model} · ${last.effort||'服务默认'} · 输出上限 ${last.maxOutputTokens}${last.reason?' · 已回落自动':''}`:'会话覆盖优先于全局默认。自动会参考未完成任务，问候关闭、日常问答优先低、复杂任务优先高。';
  return <div data-testid={`pi-thinking-${scope}`} title={`${note} ${detail}`}>
    <Dropdown isOpen={visible&&open} onOpenChange={setOpen}>
      <Button ref={trigger} variant="ghost" size="sm" data-testid={`pi-thinking-${scope}-trigger`} aria-label={scope==='global'?'默认思考强度':'思考强度'}
        isDisabled={locked||!selected}>
        <span>{scope==='global'?'默认思考：':'思考：'}{label}{!available.includes(choice??inherited)?'（将自动）':''}</span><ChevronDown size={13}/>
      </Button>
      <Dropdown.Popover className="pi-office-menu default" placement="top end"><Dropdown.Menu aria-label="思考强度选项" selectionMode="single" selectedKeys={[choice??'inherit']} onAction={key=>{
        if(locked)return;
        if(key==='config-history'&&sessionId){setOpen(false);setHistory(true);}
        else if(key==='inherit'&&scope==='session'){setOpen(false);onChange(null);}
        else if(available.includes(key as ThinkingChoice)){setOpen(false);onChange(key as ThinkingChoice);}
      }}>
        {scope==='session'&&<Dropdown.Item id="inherit" textValue="跟随全局默认"><Label>跟随全局默认 · {THINKING_LABELS[inherited]}</Label><Dropdown.ItemIndicator/></Dropdown.Item>}
        {THINKING_CHOICES.map(item=><Dropdown.Item key={item} id={item} data-testid={`pi-thinking-option-${item}`} textValue={THINKING_LABELS[item]} isDisabled={!available.includes(item)}><Label>{THINKING_LABELS[item]}{item==='auto'?'':` · ${item==='off'?'disabled / none':item}`}{!available.includes(item)?'（当前模型未提供）':''}</Label><Dropdown.ItemIndicator/></Dropdown.Item>)}
        {sessionId&&<Dropdown.Item id="config-history" textValue="最近思考配置修改" data-testid="pi-thinking-session-history"><Label>最近思考配置修改</Label></Dropdown.Item>}
      </Dropdown.Menu><p style={{maxWidth:320,whiteSpace:'normal'}} data-testid="pi-thinking-effective">{note} {detail}</p></Dropdown.Popover>
    </Dropdown>
    {visible&&history&&sessionId&&<Modal.Backdrop isOpen onOpenChange={value=>{if(!value)closeHistory();}}>
      <Modal.Container size="lg" scroll="inside"><Modal.Dialog className="pi-themed-surface" data-testid="pi-thinking-history-dialog">
        <Modal.Header><Modal.Heading>最近思考配置修改</Modal.Heading></Modal.Header>
        <Modal.Body><PiConfigHistory field="session_thinking" sessionId={sessionId} open version={selected?.version} disabled={locked} onUndone={onHistoryChange}/></Modal.Body>
        <Modal.Footer><Button variant="ghost" onPress={closeHistory}>关闭</Button></Modal.Footer>
      </Modal.Dialog></Modal.Container>
    </Modal.Backdrop>}
    {scope==='global'&&<p>{note} 默认适用于没有会话覆盖的对话，不切换模型。</p>}
  </div>;
}
