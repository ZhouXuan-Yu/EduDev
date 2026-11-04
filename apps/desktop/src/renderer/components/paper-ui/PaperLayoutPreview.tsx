import {useEffect,useId,useRef,useState,type ReactNode} from 'react';
import {Button} from '@heroui/react';
import {paperLayoutGeometry,type PaperLayout} from '../../../shared/paper-layout';

/** Continuous browser preview only: geometry is shared, pagination is not simulated. */
export function PaperLayoutPreview({layout,children}:{layout?:PaperLayout;children:ReactNode}) {
  const viewport=useRef<HTMLDivElement>(null),id=useId();
  const [edges,setEdges]=useState({left:false,right:false});
  useEffect(()=>{
    const element=viewport.current;if(!element)return;
    const update=()=>{
      const next={left:element.scrollLeft>1,right:element.scrollLeft+element.clientWidth<element.scrollWidth-1};
      setEdges(previous=>previous.left===next.left&&previous.right===next.right?previous:next);
    };
    const observer=new ResizeObserver(update);observer.observe(element);
    if(element.firstElementChild)observer.observe(element.firstElementChild);
    element.addEventListener('scroll',update,{passive:true});update();
    return()=>{observer.disconnect();element.removeEventListener('scroll',update);};
  },[layout]);
  const scroll=(direction:number)=>{const element=viewport.current;if(element)element.scrollBy({left:direction*Math.max(160,element.clientWidth*0.75),behavior:'instant'});};
  if(!layout)return <>{children}</>;
  const g=paperLayoutGeometry(layout);
  return <section className="edu-paper-layout-preview" data-testid="paper-layout-preview">
    <p data-testid="paper-layout-preview-description">A4 {layout.orientation==='portrait'?'纵向':'横向'} · {layout.columns} 栏 · 页边距上/右/下/左 {g.margins.top.mm}/{g.margins.right.mm}/{g.margins.bottom.mm}/{g.margins.left.mm} 毫米 · 栏距 {g.columnGap.mm} 毫米。</p>
    <p role="note">连续浏览器布局预览，仅供核对纸张、边距和栏宽；不表示 Word/PDF 的实际分页。实际分页以导出文件核对为准。</p>
    <div className="edu-paper-preview-scroll-tools">
      <p id={`${id}-hint`}>纸张保持固定尺寸。超出可视范围时可左右查看；聚焦预览后用左右方向键滚动，Home/End 到两端。</p>
      <div className="edu-paper-preview-scroll-actions">
        <Button variant="secondary" aria-controls={`${id}-viewport`} isDisabled={!edges.left} onPress={()=>scroll(-1)}>向左查看</Button>
        <Button variant="secondary" aria-controls={`${id}-viewport`} isDisabled={!edges.right} onPress={()=>scroll(1)}>向右查看</Button>
      </div>
    </div>
    <div ref={viewport} id={`${id}-viewport`} className="edu-paper-preview-viewport" data-testid="paper-layout-preview-viewport"
      tabIndex={0} role="region" aria-label="试卷纸张预览，可左右滚动" aria-describedby={`${id}-hint`}
      onKeyDown={event=>{
        if(event.target!==event.currentTarget||event.altKey||event.ctrlKey||event.metaKey)return;
        const element=viewport.current;if(!element)return;
        if(event.key==='ArrowLeft'||event.key==='ArrowRight'){event.preventDefault();element.scrollBy({left:event.key==='ArrowLeft'?-80:80,behavior:'instant'});}
        else if(event.key==='Home'||event.key==='End'){event.preventDefault();element.scrollTo({left:event.key==='Home'?0:element.scrollWidth,behavior:'instant'});}
      }}>
      <div data-testid="paper-layout-preview-sheet" style={{width:g.pageWidth.px,minHeight:g.pageHeight.px,boxSizing:'border-box',
        padding:`${g.margins.top.px}px ${g.margins.right.px}px ${g.margins.bottom.px}px ${g.margins.left.px}px`,
        outline:'1px solid currentColor',fontSize:`${g.fontPt}pt`}}>
        <div data-testid="paper-layout-preview-columns" style={{columnCount:layout.columns,columnGap:g.columnGap.px,columnFill:'balance',overflowWrap:'anywhere'}}>{children}</div>
      </div>
    </div>
  </section>;
}
