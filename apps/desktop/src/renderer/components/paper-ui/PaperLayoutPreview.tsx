import type {ReactNode} from 'react';
import {paperLayoutGeometry,type PaperLayout} from '../../../shared/paper-layout';

/** Continuous browser preview only: geometry is shared, pagination is not simulated. */
export function PaperLayoutPreview({layout,children}:{layout?:PaperLayout;children:ReactNode}) {
  if(!layout)return <>{children}</>;
  const g=paperLayoutGeometry(layout);
  return <section data-testid="paper-layout-preview">
    <p data-testid="paper-layout-preview-description">A4 {layout.orientation==='portrait'?'纵向':'横向'} · {layout.columns} 栏 · 页边距上/右/下/左 {g.margins.top.mm}/{g.margins.right.mm}/{g.margins.bottom.mm}/{g.margins.left.mm} 毫米 · 栏距 {g.columnGap.mm} 毫米。</p>
    <p role="note">连续浏览器布局预览，仅供核对纸张、边距和栏宽；不表示 Word/PDF 的实际分页。实际分页以导出文件核对为准。</p>
    <div style={{overflowX:'auto',maxWidth:'100%'}}>
      <div data-testid="paper-layout-preview-sheet" style={{width:g.pageWidth.px,minHeight:g.pageHeight.px,boxSizing:'border-box',
        padding:`${g.margins.top.px}px ${g.margins.right.px}px ${g.margins.bottom.px}px ${g.margins.left.px}px`,
        outline:'1px solid currentColor',fontSize:`${g.fontPt}pt`}}>
        <div data-testid="paper-layout-preview-columns" style={{columnCount:layout.columns,columnGap:g.columnGap.px,columnFill:'balance',overflowWrap:'anywhere'}}>{children}</div>
      </div>
    </div>
  </section>;
}
