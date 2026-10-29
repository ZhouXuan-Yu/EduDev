import PptxGenJS from 'pptxgenjs';
import type {PresentationDraft} from '../../shared/xiaozhi-office-draft';
import {presentationPageLayout} from './presentation-layout';

/** One reviewed section is exactly one editable slide. Notes never enter visible shapes. */
export async function generatePresentation(draft:PresentationDraft){
  const layouts=draft.sections.map(presentationPageLayout),deck=new PptxGenJS();
  deck.layout='LAYOUT_WIDE';deck.author='小智';deck.title=draft.title;deck.subject=draft.schemaVersion;
  deck.theme={headFontFace:'Microsoft YaHei',bodyFontFace:'Microsoft YaHei'};
  for(const [index,section]of draft.sections.entries()){
    const page=deck.addSlide(),layout=layouts[index],dark=index===0||index===draft.sections.length-1;
    const ink=dark?'FFFFFF':'163E36',panel=dark?'10535C':'FFFFFF';
    page.background={color:dark?'0B3C49':'F2F6F3'};
    page.addText(layout.heading,{objectName:'xiaozhi-page:'+section.pageId,x:0.65,y:0.6,w:12,h:layout.headingHeight,fontSize:32,bold:true,color:ink,margin:0,valign:'top',lineSpacingMultiple:1.3});
    for(const [paragraph,item]of layout.paragraphs.entries()){
      page.addShape(deck.ShapeType.rect,{objectName:`${section.pageId}-card-${paragraph}`,x:0.65,y:item.y-0.04,w:12,h:item.height+0.08,fill:{color:panel},line:{color:panel}});
      page.addText(item.text,{objectName:`${section.pageId}-text-${paragraph}`,x:0.88,y:item.y,w:11.5,h:item.height,fontSize:layout.fontSize,color:ink,margin:0,valign:'top',lineSpacingMultiple:1.35});
    }
    if(layout.table){const table=layout.table;
      page.addTable(table.rows.map(row=>row.map(text=>({text}))),{objectName:section.pageId+'-table',x:0.65,y:table.y,w:12,h:table.height,rowH:table.rowHeights,fontFace:'Microsoft YaHei',fontSize:16,color:ink,fill:{color:panel},
        border:{color:dark?'44808A':'CEDCD4',pt:1},margin:0.07,valign:'top',autoPage:false,bold:false});
    }
    page.addText(`${index+1} / ${draft.sections.length}`,{objectName:section.pageId+'-page-number',x:11.7,y:7.02,w:0.9,h:0.23,fontSize:11,color:dark?'BED9DA':'587366',align:'right',margin:0});
    page.addNotes(section.speakerNotes.map(note=>`${note.kind==='answer'?'参考答案':'讲解备注'}：${note.text}`).join('\n\n'));
  }
  return Buffer.from(await deck.write({outputType:'nodebuffer',compression:true}) as Buffer);
}
