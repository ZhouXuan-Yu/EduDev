import {useEffect,useRef,useState,type FormEvent} from 'react';
import {ArrowLeft,ArrowRight,Globe,MousePointer2,RotateCw,Square} from 'lucide-react';
import type {XiaozhiBrowserStatus} from '../../../shared/xiaozhi-agent';
import type {BrowserControlCommand} from '../../../shared/xiaozhi-browser';

export type BrowserTab = NonNullable<XiaozhiBrowserStatus['tabs']>[number];
export type RunBrowserCommand = (command:BrowserControlCommand,value?:string)=>Promise<boolean>;

export const browserTabLabel=(tab:BrowserTab)=>tab.title||tab.url||'新标签页';
export function BrowserAddress({tab,run,starter=false}:{tab?:BrowserTab;run:RunBrowserCommand;starter?:boolean}){
  const field=useRef<HTMLInputElement>(null);
  const [value,setValue]=useState(tab?.url||'');
  useEffect(()=>{
    if(!field.current?.matches(':focus'))setValue(tab?.url||'');
  },[tab?.tabId,tab?.url]);
  async function submit(event:FormEvent<HTMLFormElement>){
    event.preventDefault();
    const input=value.trim();
    if(!input)return;
    if(!tab&&!(await run('new-tab')))return;
    if(await run('navigate',input))field.current?.blur();
  }
  return <form className={starter?'browser-start-address':'browser-address'} onSubmit={event=>void submit(event)}>
    {!starter&&<>
      <button type="button" aria-label="后退" title="后退" disabled={!tab?.canBack} onClick={()=>void run('back')}><ArrowLeft size={16}/></button>
      <button type="button" aria-label="前进" title="前进" disabled={!tab?.canForward} onClick={()=>void run('forward')}><ArrowRight size={16}/></button>
      <button type="button" aria-label={tab?.state==='loading'?'停止加载':'刷新'} title={tab?.state==='loading'?'停止加载':'刷新'} disabled={!tab||tab.state==='blank'} onClick={()=>void run(tab?.state==='loading'?'stop':'reload')}>{tab?.state==='loading'?<Square size={15}/>:<RotateCw size={16}/>}</button>
    </>}
    <label><Globe size={15} aria-hidden="true"/><input ref={field} aria-label="网页地址" data-testid="browser-address" type="text" spellCheck={false} autoComplete="off" value={value} placeholder="搜索或输入网址" onChange={event=>setValue(event.target.value)} onFocus={event=>event.currentTarget.select()} onKeyDown={event=>{if(event.key==='Enter'&&(event.nativeEvent.isComposing||event.nativeEvent.keyCode===229)){event.preventDefault();return;}if(event.key==='Escape'){setValue(tab?.url||'');event.currentTarget.blur();}}}/></label>
  </form>;
}

const activityLabel={
  opening:'小智正在打开网页',
  reading:'小智正在读取网页',
  'awaiting-confirmation':'等待老师确认',
  acting:'小智正在操作',
  verifying:'小智正在核对结果',
};

export function BrowserControlBanner({status,run,busy=false}:{
  status:XiaozhiBrowserStatus;run:RunBrowserCommand;busy?:boolean;
}){
  const manual=status.owner==='teacher';
  const text=manual?'老师操作中':status.activity?activityLabel[status.activity]:'小智操作中';
  return <div className="browser-control-banner" data-owner={status.owner} data-activity={status.activity||'idle'}>
    <span className="browser-control-status" role="status"><MousePointer2 size={14} aria-hidden="true"/>{text}</span>
    <button type="button" className="browser-control-switch" disabled={busy} data-testid="pi-browser-owner"
      onClick={()=>void run(manual?'agent':'teacher')}>{manual?'交还小智':'获得控制权'}</button>
  </div>;
}
