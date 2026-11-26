import {useLayoutEffect, type RefObject} from 'react';

/** App panels follow the actual header, including wrapped narrow-window actions. */
export function useHeaderExtent(header:RefObject<HTMLElement|null>,workspace:RefObject<HTMLElement|null>) {
  useLayoutEffect(()=>{
    const element=header.current,surface=workspace.current;
    if(!element||!surface)return;
    const update=()=>surface.style.setProperty('--edu-header-height',`${element.getBoundingClientRect().height}px`);
    update();
    const observer=new ResizeObserver(update);
    observer.observe(element);
    return()=>observer.disconnect();
  },[header,workspace]);
}
