import {useEffect,useRef,useState} from 'react';
import {Button} from '@heroui/react';
import type {XiaozhiBrowserStatus} from '../../../shared/xiaozhi-agent';

type Command='teacher'|'agent'|'float'|'remember'|'forget';
export function PiBrowserDock({id,initial,covered,onClose}:{id:string;initial:XiaozhiBrowserStatus;covered:boolean;onClose:()=>void}) {
  const [status,setStatus]=useState(initial);
  const [floating,setFloating]=useState(false);
  const [message,setMessage]=useState('');
  const [forget,setForget]=useState(false);
  const [working,setWorking]=useState(false);
  const slot=useRef<HTMLDivElement>(null);
  const active=status.tabs?.find(tab=>tab.active);
  const manual=status.owner==='teacher';
  async function command(action:Command){
    setWorking(true);
    try {
      const result=await window.omniEdu?.controlXiaozhiBrowser(id,action);
      if(!result?.ok){setMessage('操作未完成，请等待当前操作结束后再试。');return;}
      if(result.status)setStatus(result.status);
      setMessage(action==='forget'?'已清除此站保存在小智中的登录信息。':'');setForget(false);
      if(action==='float')setFloating(true);
    }catch{setMessage('浏览器连接已中断，请重新打开。');}finally{setWorking(false);}
  }
  useEffect(()=>{
    let live=true;
    async function refresh(){const result=await window.omniEdu?.controlXiaozhiBrowser(id,'status');if(live&&result?.status){const next=result.status;setStatus(previous=>JSON.stringify(previous)===JSON.stringify(next)?previous:next);}}
    const timer=window.setInterval(()=>void refresh().catch(()=>{}),1200);
    const remove=window.omniEdu?.onXiaozhiBrowserDock(target=>{if(target===id)setFloating(false);});
    return ()=>{live=false;clearInterval(timer);remove?.();};
  },[id]);
  useEffect(()=>{
    const element=slot.current;
    if(!element||floating)return;
    let frame=0,last='';
    const place=()=>{
      frame=0;
      const r=element.getBoundingClientRect();
      const box={x:Math.ceil(r.left),y:Math.ceil(r.top),width:Math.max(0,Math.floor(r.right)-Math.ceil(r.left)),height:Math.max(0,Math.floor(r.bottom)-Math.ceil(r.top))};
      const modal=document.querySelector('[aria-modal="true"],dialog[open],[role="menu"],[data-overlay-container] [data-open="true"]');
      const obstructed=covered||document.hidden||!!modal||box.width<32||box.height<32||r.left<0||r.top<0||
        r.right>window.innerWidth+1||r.bottom>window.innerHeight+1||
        document.elementFromPoint(r.left+r.width/2,r.top+r.height/2)!==element;
      const key=obstructed?'cover':JSON.stringify(box);
      if(last===key)return;last=key;
      void window.omniEdu?.controlXiaozhiBrowser(id,obstructed?'cover':'dock',obstructed?undefined:box).then(result=>{if(!result.ok)last='';});
    };
    const update=()=>{if(!frame)frame=requestAnimationFrame(place);};
    const size=new ResizeObserver(update);size.observe(element);
    const tree=new MutationObserver(update);tree.observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open','class','aria-modal','data-open','style']});
    window.addEventListener('resize',update);window.addEventListener('scroll',update,true);document.addEventListener('visibilitychange',update);place();
    return ()=>{cancelAnimationFrame(frame);tree.disconnect();size.disconnect();window.removeEventListener('resize',update);window.removeEventListener('scroll',update,true);document.removeEventListener('visibilitychange',update);void window.omniEdu?.controlXiaozhiBrowser(id,'cover');};
  },[id,floating,covered]);
  return <aside className="pi-browser-dock" aria-label="内置浏览器" data-testid="pi-browser-dock">
    <header><strong>浏览器</strong><span>{manual?'老师操作中':'小智操作中'}</span></header>
    <div className="pi-browser-actions">
      <Button size="sm" isDisabled={working} data-testid="pi-browser-owner" onPress={()=>void command(manual?'agent':'teacher')}>{manual?'交还小智':'我来操作'}</Button>
      <Button size="sm" variant="ghost" onPress={()=>floating?setFloating(false):void command('float')}>{floating?'放回对话':'独立窗口'}</Button>
      <Button size="sm" variant="ghost" onPress={onClose}>收起</Button>
    </div>
    {active&&<small>{active.url}</small>}
    {manual&&status.siteOrigin&&<>
      {!active&&<small>{status.siteOrigin}</small>}
      {!status.remembered&&active&&<Button size="sm" variant="ghost" isDisabled={working} onPress={()=>void command('remember')}>打开此站的本机登录</Button>}
      <Button size="sm" variant="ghost" isDisabled={working} onPress={()=>forget?void command('forget'):setForget(true)}>{forget?'确认清除此站登录':'清除此站登录'}</Button>
    </>}
    {message&&<p role="status">{message}</p>}
    {floating?<p>网页已在独立窗口打开。</p>:<div ref={slot} className="pi-browser-slot" data-testid="pi-browser-slot"/>}
  </aside>;
}
