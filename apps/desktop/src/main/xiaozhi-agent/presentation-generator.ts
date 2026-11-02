import PptxGenJS from 'pptxgenjs';
import {isMathOfficeSchema,type PresentationDraft} from '../../shared/xiaozhi-office-draft';
import {presentationPageLayout} from './presentation-layout';
import {preparePresentationMath} from './presentation-math';

/** One reviewed section is exactly one editable slide. Notes never enter visible shapes. */
export async function generatePresentation(draft:PresentationDraft,options?:{dataRoot:string;signal?:AbortSignal}){
  const math=isMathOfficeSchema(draft.schemaVersion);if(math&&!options)throw Error('configuration');
  const plan=math?await preparePresentationMath(draft,options!):undefined;
  const layouts=draft.sections.map((section,index)=>presentationPageLayout(section,plan?.[index])),deck=new PptxGenJS();
  deck.layout='LAYOUT_WIDE';deck.author='小智';deck.title=draft.title;deck.subject=draft.schemaVersion;
  deck.theme={headFontFace:'Microsoft YaHei',bodyFontFace:'Microsoft YaHei'};
  for(const [index,section]of draft.sections.entries()){
    options?.signal?.throwIfAborted();
    const page=deck.addSlide(),layout=layouts[index],dark=index===0||index===draft.sections.length-1;
    const ink=dark?'FFFFFF':'163E36',bodyInk=math?'163E36':ink,panel=math?'FFFFFF':dark?'10535C':'FFFFFF';
    page.background={color:dark?'0B3C49':'F2F6F3'};
    page.addText(layout.heading,{objectName:'xiaozhi-page:'+section.pageId,x:0.65,y:0.6,w:12,h:layout.headingHeight,fontSize:32,bold:true,color:ink,margin:0,valign:'top',lineSpacingMultiple:1.3});
    for(const [paragraph,item]of layout.paragraphs.entries()){
      page.addShape(deck.ShapeType.rect,{objectName:`${section.pageId}-card-${paragraph}`,x:0.65,y:item.y-0.04,w:12,h:item.height+0.08,fill:{color:panel},line:{color:panel}});
      if('image'in item&&item.image)page.addImage({objectName:`${section.pageId}-formula-${paragraph}`,altText:item.text,data:'image/png;base64,'+item.image.bytes.toString('base64'),x:0.88,y:item.y,w:item.image.width,h:item.image.height});
      else page.addText(item.text,{objectName:`${section.pageId}-text-${paragraph}`,x:0.88,y:item.y,w:11.5,h:item.height,fontSize:layout.fontSize,color:bodyInk,margin:0,valign:'top',lineSpacingMultiple:1.35});
    }
    if(layout.table){const table=layout.table;
      page.addTable(table.rows.map(row=>row.map(text=>({text}))),{objectName:section.pageId+'-table',x:0.65,y:table.y,w:12,h:table.height,rowH:table.rowHeights,fontFace:'Microsoft YaHei',fontSize:16,color:bodyInk,fill:{color:panel},
        border:{color:dark?'44808A':'CEDCD4',pt:1},margin:0.07,valign:'top',autoPage:false,bold:false});
      for(const cell of table.mathCells||[]){const width=12/table.rows[0].length,x=0.65+cell.column*width+0.1;let y=table.y+table.rowHeights.slice(0,cell.row).reduce((s,h)=>s+h,0)+0.08;
        for(const [part,item]of cell.blocks.entries()){
          const name=`${section.pageId}-cell-${cell.row}-${cell.column}-${part}`;
          if('image'in item&&item.image)page.addImage({objectName:name,altText:item.text,data:'image/png;base64,'+item.image.bytes.toString('base64'),x,y,w:item.image.width,h:item.image.height});
          else page.addText(item.text,{objectName:name,x,y,w:width-0.22,h:item.height,fontSize:16,color:bodyInk,margin:0,valign:'top',lineSpacingMultiple:1.35});y+=item.height;
        }
      }
    }
    page.addText(`${index+1} / ${draft.sections.length}`,{objectName:section.pageId+'-page-number',x:11.7,y:7.02,w:0.9,h:0.23,fontSize:11,color:dark?'BED9DA':'587366',align:'right',margin:0});
    page.addNotes(section.speakerNotes.map(note=>`${note.kind==='answer'?'参考答案':'讲解备注'}：${note.text}`).join('\n\n'));
  }
  return Buffer.from(await deck.write({outputType:'nodebuffer',compression:true}) as Buffer);
}
