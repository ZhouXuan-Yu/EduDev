import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Button } from '@heroui/react';
import { ArrowLeft, ArrowRight, PanelLeft } from 'lucide-react';
import type { DesktopChromeState, DesktopCommand, DesktopMenu } from '../../../shared/desktop-chrome';
import '../../ui-system/chrome.css';
import {samePaperReturn, type PaperReturnReference} from '../paper-ui/paper-material-handoff';
import {validPaperExportIntent,samePaperExportIntent,copyPaperExportIntent,type PaperExportIntent} from '../../../shared/paper-export';
import {readComposerDraft} from '../office/composer-drafts';

type Target={view:string;sessionId?:string;draft?:string;paperExportIntent?:PaperExportIntent;paperReturn?:PaperReturnReference;paper?:{mode:'basket'|'automatic';basketId?:string;stage?:'select'|'organize'|'preview'}};
const sameTarget = (a: Target, b: Target) => a.view === b.view && a.sessionId === b.sessionId &&
  samePaperReturn(a.paperReturn, b.paperReturn) &&
  (a.view !== 'paper' || (a.paper?.mode === b.paper?.mode &&
    a.paper?.basketId === b.paper?.basketId && a.paper?.stage === b.paper?.stage));
type Handler=(command:DesktopCommand)=>boolean;
type NavigationGuard=()=>string|undefined;
type NavigationOptions={replace?:boolean;ifCurrent?:Target;ifIntent?:number};
type DraftSeed={text:string;paperExportIntent?:PaperExportIntent};
type Navigation={target:Target;intent:number;isCurrent:(intent:number)=>boolean;canBack:boolean;canForward:boolean;navigate:(target:Target,options?:NavigationOptions)=>boolean;consumeDraft:(sessionId:string,seed?:DraftSeed)=>void;reject:(sessionId:string)=>void;register:(handler:Handler,priority:number)=>()=>void;registerGuard:(guard:NavigationGuard)=>()=>void;flush:()=>void};
const empty:Navigation={target:{view:'ai'},intent:0,isCurrent:()=>true,canBack:false,canForward:false,navigate:()=>true,consumeDraft:()=>{},reject:()=>{},register:()=>()=>{},registerGuard:()=>()=>{},flush:()=>{}};
const NavigationContext=createContext<Navigation>(empty);
export const useDesktopNavigation=()=>useContext(NavigationContext);
/** Shared by draft owners. Blocking consumes native commands instead of replaying them later. */
export function useDesktopNavigationGuard(dirty:boolean,message:string) {
  const {registerGuard}=useDesktopNavigation(),latest=useRef({dirty,message});latest.current={dirty,message};
  useLayoutEffect(()=>registerGuard(()=>latest.current.dirty?latest.current.message:undefined),[registerGuard]);
}
export function useDesktopCommands(handler:Handler,priority=0) {
  const {register}=useDesktopNavigation(),latest=useRef(handler);latest.current=handler;
  useEffect(()=>register(command=>latest.current(command),priority),[register,priority]);
}
/** Adapter only: IDs/views in memory; no file contents, task replay or authorization. */
export function DesktopFrame({children}:{children:ReactNode}) {
  const [chrome,setChrome]=useState<DesktopChromeState>();
  const [notice,setNotice]=useState('');
  const [history,setHistory]=useState({entries:[{view:'ai'}] as Target[],index:0});
  const historyRef=useRef(history);historyRef.current=history;
  // History entries can be revisited by identity. This lifetime counter cannot rewind with them.
  const intent=useRef(0);
  const isCurrent=useCallback((value:number)=>intent.current===value,[]);
  const commit=useCallback((next:typeof history)=>{
    intent.current++;
    historyRef.current=next;
    setHistory(next);
  },[]);
  const guards=useRef(new Map<symbol,NavigationGuard>());
  const registerGuard=useCallback((guard:NavigationGuard)=>{const id=Symbol();guards.current.set(id,guard);return()=>{guards.current.delete(id);};},[]);
  const allowNavigation=useCallback(()=>{
    for(const guard of guards.current.values()){const reason=guard();if(reason){setNotice(reason);return false;}}
    setNotice('');return true;
  },[]);
  const handlers=useRef(new Map<symbol,{handler:Handler;priority:number}>()),pending=useRef<DesktopCommand[]>([]);
  const deliver=useCallback((command:DesktopCommand)=>{
    // Native IPC has no DOM event to cancel; guard before any handler mutates page/session state.
    if(['settings','new-chat','sidebar','files'].includes(command)&&!allowNavigation())return true;
    for(const {handler} of [...handlers.current.values()].sort((a,b)=>b.priority-a.priority))if(handler(command))return true;
    return false;
  },[allowNavigation]);
  const flush=useCallback(()=>{pending.current=pending.current.filter(command=>!deliver(command));},[deliver]);
  const register=useCallback((handler:Handler,priority:number)=>{const id=Symbol();handlers.current.set(id,{handler,priority});return ()=>{handlers.current.delete(id);};},[]);
  const navigate=useCallback((target:Target,options?:NavigationOptions)=>{
    const old=historyRef.current,active=old.entries[old.index];
    if(options?.ifCurrent && active !== options.ifCurrent)return false;
    if(options?.ifIntent!==undefined&&!isCurrent(options.ifIntent))return false;
    if(target.paperExportIntent!==undefined){
      if(target.view!=='ai'||!target.sessionId||!target.draft||!validPaperExportIntent(target.paperExportIntent))return false;
      target={...target,paperExportIntent:copyPaperExportIntent(target.paperExportIntent)};
      const saved=readComposerDraft(target.sessionId);
      if(saved.text||saved.skill||saved.paperExportIntent||saved.paperExportInvalid||saved.pendingPaperExport){
        setNotice('此会话已有未发送草稿或导出请求，请先处理；原输入未被覆盖。');return false;
      }
    }
    if(target.draft!==undefined&&old.entries.some(entry=>entry.sessionId===target.sessionId&&entry.draft!==undefined
      &&(target.paperExportIntent||entry.paperExportIntent)
      &&(entry.draft!==target.draft||!samePaperExportIntent(entry.paperExportIntent,target.paperExportIntent)))){
      setNotice('此会话还有待载入的请求，请先处理或取消；未替换原请求。');return false;
    }
    if((!sameTarget(active,target)||target.draft!==undefined)&&!allowNavigation())return false;
    let next=old;
    if(options?.replace){const entries=[...old.entries];entries[old.index]=target;next={...old,entries};}
    else if(sameTarget(active,target)){
      if(target.draft===undefined)return true;
      // Same-session actions may prepare a new request without another history entry.
      const entries=[...old.entries];entries[old.index]={...active,draft:target.draft,paperExportIntent:target.paperExportIntent};next={...old,entries};
    }else{
      const entries=[...old.entries.slice(0,old.index+1),target].slice(-80);next={entries,index:entries.length-1};
    }
    // Accepted intent is visible before React's batched commit, so a late read cannot win that gap.
    commit(next);return true;
  },[allowNavigation,commit,isCurrent]);
  const reject=useCallback((sessionId:string)=>{
    const old=historyRef.current;
    const keep=(target:Target)=>target.sessionId!==sessionId;
    const entries=old.entries.filter(keep),before=old.entries.slice(0,old.index+1).filter(keep).length;
    if(entries.length!==old.entries.length)commit({entries:entries.length?entries:[{view:'ai'}],index:Math.max(0,before-1)});
  },[commit]);
  const consumeDraft=useCallback((sessionId:string,seed?:DraftSeed)=>{
    const old=historyRef.current;
    const matches=(entry:Target)=>entry.sessionId===sessionId&&entry.draft!==undefined&&
      (seed?entry.draft===seed.text&&samePaperExportIntent(entry.paperExportIntent,seed.paperExportIntent):!entry.paperExportIntent);
    if(!old.entries.some(matches))return;
    commit({...old,entries:old.entries.map(entry=>{if(!matches(entry))return entry;const {draft:_draft,paperExportIntent:_intent,...target}=entry;return target;})});
  },[commit]);
  const command=useCallback((value:DesktopCommand)=>{
    if(value==='back'||value==='forward'){
      const old=historyRef.current,index=Math.max(0,Math.min(old.entries.length-1,old.index+(value==='back'?-1:1)));
      if(index!==old.index&&allowNavigation())commit({...old,index});return;
    }
    if(!deliver(value)&&pending.current.length<8)pending.current.push(value);
  },[deliver,allowNavigation,commit]);
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
  const navigation={target:history.entries[history.index],intent:intent.current,isCurrent,canBack:history.index>0,canForward:history.index<history.entries.length-1,navigate,consumeDraft,reject,register,registerGuard,flush};
  return <NavigationContext.Provider value={navigation}>
    {chrome?.enabled?<div className="edu-desktop-frame desktop-native-frame" data-testid="desktop-native-frame" style={{'--edu-chrome-height':`${Math.max(44,chrome.height)}px`} as React.CSSProperties}>
      <header className="edu-chrome-bar" data-heroui-native="" data-theme="light" data-testid="desktop-titlebar" style={{height:Math.max(44,chrome.height)}}>
        <div className="edu-chrome-controls" data-testid="desktop-titlebar-safe">
          <Button variant="ghost" isIconOnly aria-label="后退" isDisabled={!navigation.canBack} onPress={()=>command('back')} data-testid="desktop-back"><ArrowLeft size={17}/></Button>
          <Button variant="ghost" isIconOnly aria-label="前进" isDisabled={!navigation.canForward} onPress={()=>command('forward')} data-testid="desktop-forward"><ArrowRight size={17}/></Button>
          <Button variant="ghost" isIconOnly aria-label="显示或隐藏会话侧栏" onPress={()=>command('sidebar')} data-testid="desktop-sidebar"><PanelLeft size={17}/></Button>
          {(['file','edit','view','help'] as const).map((group,index)=><Button key={group} className="edu-chrome-menu-group" variant="ghost" aria-haspopup="menu" data-testid={`desktop-menu-${group}`} onPress={event=>void menu(group,event.target)}>{['文件','编辑','视图','帮助'][index]}</Button>)}
          <Button className="edu-chrome-menu-app" variant="ghost" aria-label="应用菜单" aria-haspopup="menu" data-testid="desktop-menu-app" onPress={event=>void menu('app',event.target)}>菜单</Button>
        </div>
        <div className="edu-chrome-drag" data-testid="desktop-titlebar-drag" aria-hidden="true" />
      </header>
      {notice&&<div className="edu-desktop-notice" role="status" data-testid="desktop-navigation-notice">{notice}</div>}
      <div className="edu-desktop-content desktop-content">{children}</div>
    </div>:<>{notice&&<div className="edu-desktop-notice" role="status" data-testid="desktop-navigation-notice">{notice}</div>}{children}</>}
  </NavigationContext.Provider>;
}
