import {useSyncExternalStore} from 'react';

export type ComposerFollowUp = 'steer' | 'followUp';
const key='edudev.composer.follow-up.v1';
const changed='edudev:follow-up-changed';
function read():ComposerFollowUp{
  try{return localStorage.getItem(key)==='steer'?'steer':'followUp';}
  catch{return 'followUp';}
}
function subscribe(update:()=>void){
  window.addEventListener(changed,update);
  window.addEventListener('storage',update);
  return ()=>{window.removeEventListener(changed,update);window.removeEventListener('storage',update);};
}
export function useComposerFollowUp(){
  return useSyncExternalStore(subscribe,read,()=> 'followUp' as ComposerFollowUp);
}
export function saveComposerFollowUp(value:ComposerFollowUp){
  try{localStorage.setItem(key,value);}
  catch{return false;}
  window.dispatchEvent(new Event(changed));
  return true;
}
export const followUpLabel=(mode:ComposerFollowUp)=>mode==='steer'?'补充到本轮':'本轮结束后发送';
export const alternateFollowUp=(mode:ComposerFollowUp):ComposerFollowUp=>mode==='steer'?'followUp':'steer';
