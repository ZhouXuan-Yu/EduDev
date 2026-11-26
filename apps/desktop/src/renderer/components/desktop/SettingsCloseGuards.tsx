import {createContext,useCallback,useContext,useEffect,useLayoutEffect,useRef,useState,type ReactNode} from 'react';
const Context=createContext({blocked:false,register:(_key:symbol,_message:string|undefined)=>()=>{}});

/** Combines existing draft owners; closing or changing category cannot discard
 * one editor merely because a different editor has finished saving. */
export function SettingsCloseGuards({children}:{children:ReactNode}){
  const guards=useRef(new Map<symbol,string>());
  const [blocked,setBlocked]=useState(false);
  const register=useCallback((key:symbol,message:string|undefined)=>{
    if(message)guards.current.set(key,message);else guards.current.delete(key);
    setBlocked(guards.current.size>0);
    return()=>{guards.current.delete(key);setBlocked(guards.current.size>0);};
  },[]);
  useEffect(()=>{void window.settingsWindow?.setBlocked(blocked);},[blocked]);
  return <Context.Provider value={{blocked,register}}>{children}</Context.Provider>;
}
export const useSettingsWindowBlocked=()=>useContext(Context).blocked;
export function useSettingsWindowGuard(blocked:boolean,message:string){
  const {register}=useContext(Context),key=useRef(Symbol());
  useLayoutEffect(()=>register(key.current,blocked?message:undefined),[blocked,message,register]);
}
