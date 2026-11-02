import PptxGenJS from 'pptxgenjs';
/** Same bytes for both real native engines and original Pi/file-panel paths. */
export async function layoutFixture({partial=false}={}){
 const ppt=new PptxGenJS();ppt.layout='LAYOUT_WIDE';
 const text=(slide,value,extra={})=>slide.addText(value,{x:1,y:1,w:10,h:1,fontFace:'Arial',fontSize:24,margin:0,...extra});
 const cover=(slide,extra={})=>slide.addShape(ppt.ShapeType.rect,{x:.8,y:.8,w:11,h:1.5,line:{transparency:100},fill:{color:'FFFFFF'},...extra});
 text(ppt.addSlide(),'普通中文 F=ρgV PAGE_1');
 let s=ppt.addSlide();text(s,'Covered explanation PAGE_2');cover(s);
 s=ppt.addSlide();text(s,'Visible through transparent cover PAGE_3');cover(s,{fill:{color:'FFFFFF',transparency:100}});
 s=ppt.addSlide();cover(s);text(s,'Visible above background PAGE_4');
 text(ppt.addSlide(),'Missing character '+String.fromCodePoint(0x10fffd)+' PAGE_5');
 s=ppt.addSlide();text(s,'Partial cover remains unchecked PAGE_6');cover(s,{w:1});
 text(ppt.addSlide(),'Rotated text PAGE_7',{vert:'vert270',rotate:15});
 if(partial){
  s=ppt.addSlide();text(s,'LEFT                                  RIGHT PAGE_8');cover(s,{x:3,w:.5});
  s=ppt.addSlide();text(s,'局部遮挡不能漏掉，后半句仍然可见 PAGE_9');cover(s,{x:1,y:.8,w:.8,h:1.5});
 }
 for(const slide of ppt._slides)slide.addNotes('Synthetic visual checking fixture; no teacher material.');
 return ppt.write({outputType:'nodebuffer'});
}
