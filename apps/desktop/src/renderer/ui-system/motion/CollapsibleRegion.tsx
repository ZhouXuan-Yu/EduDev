import {useLayoutEffect,useRef,type ReactNode} from 'react';
import styles from './collapsible-region.module.css';

/** Retain forms and async state while making collapsed descendants non-interactive. */
export function CollapsibleRegion({id,expanded,className,children}:{id:string;expanded:boolean;className?:string;children:ReactNode}) {
  const root=useRef<HTMLDivElement>(null);
  useLayoutEffect(()=>{
    if(expanded||!root.current?.contains(document.activeElement))return;
    const trigger=[...document.querySelectorAll<HTMLButtonElement>('[aria-controls]')].find(el=>el.getAttribute('aria-controls')===id);
    trigger?.focus({preventScroll:true});
  },[expanded,id]);
  return <div ref={root} id={id} className={[styles.region,className].filter(Boolean).join(' ')} data-expanded={expanded} inert={!expanded} aria-hidden={!expanded}>
    <div className={styles.content}>{children}</div>
  </div>;
}
