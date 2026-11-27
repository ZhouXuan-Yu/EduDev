import {useLayoutEffect, type RefObject} from 'react';

/** App panels follow the actual header, including wrapped narrow-window actions. */
export function useHeaderExtent(header:RefObject<HTMLElement|null>,workspace:RefObject<HTMLElement|null>) {
  useLayoutEffect(()=>{
    const element=header.current,surface=workspace.current;
    if(!element||!surface)return;
    // Read the completed layout supplied by ResizeObserver instead of forcing
    // the entire new page to lay out synchronously during its React commit.
    let previousHeight:number|undefined;
    const observer=new ResizeObserver(entries=>{
      const entry=entries.find(item=>item.target===element);
      if(!entry)return;
      const height=entry.borderBoxSize[0]?.blockSize??element.getBoundingClientRect().height;
      if(height===previousHeight)return;
      previousHeight=height;
      surface.style.setProperty('--edu-header-height',`${height}px`);
    });
    observer.observe(element);
    return()=>observer.disconnect();
  },[header,workspace]);
}
