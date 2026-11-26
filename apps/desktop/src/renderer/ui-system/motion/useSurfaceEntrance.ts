import {useLayoutEffect, useRef, type RefObject} from 'react';

/** Only an app-owned surface enters. Never replay on token/row updates or remount content. */
export function useSurfaceEntrance(ref:RefObject<HTMLElement|null>, identity:string, enabled=true) {
  const previous = useRef<Animation|null>(null);
  const continuation=useRef<{element:HTMLElement;opacity:string}|null>(null);
  useLayoutEffect(()=>{
    const element=ref.current;
    if(!enabled||!element||typeof element.animate!=='function')return;
    const preference=matchMedia('(prefers-reduced-motion: reduce)');
    if(preference.matches)return;
    const style=getComputedStyle(element);
    const from=continuation.current?.element===element?continuation.current.opacity:'.88';
    continuation.current=null;
    previous.current?.cancel();
    const duration=Number.parseFloat(style.getPropertyValue('--edu-motion-fast')) || 120;
    const animation=element.animate([{opacity:from},{opacity:1}],{duration,easing:'cubic-bezier(.2,.8,.2,1)'});
    previous.current=animation;
    const reduce=()=>{if(preference.matches)animation.finish();};
    preference.addEventListener('change',reduce);
    return()=>{preference.removeEventListener('change',reduce);if(animation.playState==='running')continuation.current={element,opacity:getComputedStyle(element).opacity};animation.cancel();previous.current=null;};
  },[identity,enabled,ref]);
}
