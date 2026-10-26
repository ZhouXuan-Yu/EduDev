import {createContext,useContext,useRef,type ReactNode,type SyntheticEvent} from 'react';
import {Button} from '@heroui/react';

const ready={blocked:false,isBlocked:()=>false};
const SyncContext=createContext(ready);

/** Transient view safety only. Main permissions and revisions remain authoritative. */
export function OfficeSynchronization({blocked,isBlocked,children}:{blocked:boolean;isBlocked?:()=>boolean;children:ReactNode}){
 const current=useRef(blocked);current.current=blocked;
 return <SyncContext.Provider value={{blocked,isBlocked:isBlocked||(()=>current.current)}}>{children}</SyncContext.Provider>;
}
export const useOfficeSynchronization=()=>useContext(SyncContext);

/** Native fieldset covers forms/keyboard; capture also covers React Aria press
 * responders. Portaled content needs its own boundary in its actual DOM. */
export function OfficeMutationBoundary({children}:{children:ReactNode}){
 const sync=useOfficeSynchronization();
 function capture(event:SyntheticEvent<HTMLFieldSetElement>){
  if(!sync.isBlocked()||!event.currentTarget.contains(event.target as Node))return;
  if('key'in event&&!['Enter',' '].includes(String(event.key)))return;
  event.preventDefault();event.stopPropagation();
 }
 return <fieldset disabled={sync.blocked} data-sync-blocked={sync.blocked||undefined}
  style={{border:0,margin:0,padding:0,minWidth:0}} onClickCapture={capture}
  onPointerDownCapture={capture} onPointerUpCapture={capture} onKeyDownCapture={capture} onKeyUpCapture={capture} onSubmitCapture={capture}>
  {children}
 </fieldset>;
}

export function OfficeSynchronizationNotice({unavailable,refreshing,onRefresh}:{unavailable:boolean;refreshing:boolean;onRefresh:()=>void}){
 return <div className="pi-history-note" data-testid="pi-event-synchronization" data-state={unavailable?'unavailable':'catching_up'}>
  <p role="status">{unavailable?'过程记录暂时无法核对，确认和变更已暂停。请重新读取本地记录。':'正在同步过程记录，确认和变更暂时不可用。草稿会保留，仍可停止任务。'}</p>
  <Button size="sm" variant="ghost" isDisabled={refreshing} onPress={onRefresh} data-testid="pi-event-refresh">{refreshing?'正在读取…':'重新读取记录'}</Button>
 </div>;
}
