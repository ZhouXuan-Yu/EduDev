import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@heroui/react';
import { ArrowLeft, ArrowRight, PanelLeft } from 'lucide-react';
import type { DesktopChromeState, DesktopCommand, DesktopMenu } from '../../../shared/desktop-chrome';
import './desktop-frame.css';

type Target={view:string;sessionId?:string;draft?:string};
type Handler=(command:DesktopCommand)=>boolean;
type Navigation={target:Target;canBack:boolean;canForward:boolean;navigate:(target:Target)=>void;consumeDraft:(sessionId:string)=>void;reject:(sessionId:string)=>void;register:(handler:Handler,priority:number)=>()=>void;flush:()=>void};
const empty:Navigation={target:{view:'ai'},canBack:false,canForward:false,navigate:()=>{},consumeDraft:()=>{},reject:()=>{},register:()=>()=>{},flush:()=>{}};
const NavigationContext=createContext<Navigation>(empty);
export const useDesktopNavigation=()=>useContext(NavigationContext);
export function useDesktopCommands(handler:Handler,priority=0) {
  const {register}=useDesktopNavigation(),latest=useRef(handler);latest.current=handler;
  useEffect(()=>register(command=>latest.current(command),priority),[register,priority]);
}
/** Adapter only: IDs/views in memory; no file contents, task replay or authorization. */
export function DesktopFrame({children}:{children:ReactNode}) {
  const [chrome,setChrome]=useState<DesktopChromeState>();
  const [notice,setNotice]=useState('');
  const [history,setHistory]=useState({entries:[{view:'ai'}] as Target[],index:0});
  const handlers=useRef(new Map<symbol,{handler:Handler;priority:number}>()),pending=useRef<DesktopCommand[]>([]);
  const deliver=useCallback((command:DesktopCommand)=>{
    for(const {handler} of [...handlers.current.values()].sort((a,b)=>b.priority-a.priority))if(handler(command))return true;
    return false;
  },[]);
  const flush=useCallback(()=>{pending.current=pending.current.filter(command=>!deliver(command));},[deliver]);
  const register=useCallback((handler:Handler,priority:number)=>{const id=Symbol();handlers.current.set(id,{handler,priority});return ()=>{handlers.current.delete(id);};},[]);
  const navigate=useCallback((target:Target)=>setHistory(old=>{
    const current=old.entries[old.index];if(current.view===target.view&&current.sessionId===target.sessionId)return old;
    const entries=[...old.entries.slice(0,old.index+1),target].slice(-80);return {entries,index:entries.length-1};
  }),[]);
  const reject=useCallback((sessionId:string)=>setHistory(old=>{
    const keep=(target:Target)=>target.sessionId!==sessionId;
    const entries=old.entries.filter(keep),before=old.entries.slice(0,old.index+1).filter(keep).length;
    return {entries:entries.length?entries:[{view:'ai'}],index:Math.max(0,before-1)};
  }),[]);
  const consumeDraft=useCallback((sessionId:string)=>setHistory(old=>({...old,entries:old.entries.map(entry=>{if(entry.sessionId!==sessionId||entry.draft===undefined)return entry;const {draft:_draft,...target}=entry;return target;})})),[]);
  const command=useCallback((value:DesktopCommand)=>{
    if(value==='back'||value==='forward'){setHistory(old=>({...old,index:Math.max(0,Math.min(old.entries.length-1,old.index+(value==='back'?-1:1)))}));return;}
    if(!deliver(value)&&pending.current.length<8)pending.current.push(value);
  },[deliver]);
  useEffect(()=>{
    let live=true;void window.omniEdu?.getDesktopChrome?.().then(value=>{if(live)setChrome(value);}).catch(()=>{if(live)setNotice('窗口菜单暂时不可用，请重试。');});
    const offState=window.omniEdu?.onDesktopChrome?.(setChrome),offCommand=window.omniEdu?.onDesktopCommand?.(command);
    return ()=>{live=false;offState?.();offCommand?.();};
  },[command]);
  async function menu(group:DesktopMenu,target:Element) {
    const box=target.getBoundingClientRect();
    try{const result=await window.omniEdu?.openDesktopMenu(group,box.left,box.bottom);if(!result?.ok)throw new Error();setNotice('');}
    catch{setNotice('无法打开窗口菜单，请重试。');}
  }
  const navigation={target:history.entries[history.index],canBack:history.index>0,canForward:history.index<history.entries.length-1,navigate,consumeDraft,reject,register,flush};
  return <NavigationContext.Provider value={navigation}>
    {chrome?.enabled?<div className="desktop-native-frame" data-testid="desktop-native-frame">
      <header className="desktop-titlebar" data-testid="desktop-titlebar" style={{height:chrome.height}}>
        <div className="desktop-titlebar-safe" data-testid="desktop-titlebar-safe">
          <Button variant="ghost" isIconOnly aria-label="后退" isDisabled={!navigation.canBack} onPress={()=>command('back')} data-testid="desktop-back"><ArrowLeft size={17}/></Button>
          <Button variant="ghost" isIconOnly aria-label="前进" isDisabled={!navigation.canForward} onPress={()=>command('forward')} data-testid="desktop-forward"><ArrowRight size={17}/></Button>
          <Button variant="ghost" isIconOnly aria-label="显示或隐藏会话侧栏" onPress={()=>command('sidebar')} data-testid="desktop-sidebar"><PanelLeft size={17}/></Button>
          {(['file','edit','view','help'] as const).map((group,index)=><Button key={group} variant="ghost" aria-haspopup="menu" data-testid={`desktop-menu-${group}`} onPress={event=>void menu(group,event.target)}>{['文件','编辑','视图','帮助'][index]}</Button>)}
        </div>
      </header>
      {notice&&<div className="desktop-frame-notice" role="status">{notice}</div>}
      <div className="desktop-content">{children}</div>
    </div>:children}
  </NavigationContext.Provider>;
}
