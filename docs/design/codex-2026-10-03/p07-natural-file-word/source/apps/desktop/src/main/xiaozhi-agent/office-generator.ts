import {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,HeadingLevel,WidthType,AlignmentType} from 'docx';
import ExcelJS from 'exceljs';import PptxGenJS from 'pptxgenjs';
import {wrapTextWithAnsi} from '@earendil-works/pi-tui/dist/utils.js';
import {validOfficeDraft,officeOutputFormat,OFFICE_OUTPUT_MAX_BYTES,type OfficeDraft,type OfficeOutputFormat} from '../../shared/xiaozhi-office-draft';
const check=(signal?:AbortSignal)=>{if(signal?.aborted)throw new Error('cancelled');};
/** Pi chooses Unicode/grapheme wrap boundaries; retain spaces that terminal wrapping trims. */
function officeLines(text:string,width:number):string[]{
 return text.split('\n').flatMap(source=>{
  const wrapped=wrapTextWithAnsi(source,Math.max(2,Math.floor(width)));let offset=0;
  return wrapped.map((line,index)=>{
   if(index===wrapped.length-1)return source.slice(offset);
   const start=source.indexOf(line,offset);if(start<0)throw new Error('generation_failed');
   const end=start+line.length;const original=source.slice(offset,end);offset=end;return original;
  });
 });
}
async function docx(draft:OfficeDraft){
 const children:(Paragraph|Table)[]=[new Paragraph({heading:HeadingLevel.TITLE,alignment:AlignmentType.CENTER,children:[new TextRun(draft.title)]})];
 for(const section of draft.sections){
  children.push(new Paragraph({heading:HeadingLevel.HEADING_1,children:[new TextRun(section.heading)]}));
  for(const value of section.paragraphs)children.push(new Paragraph({children:value.split('\n').flatMap((text,index)=>index?[new TextRun({break:1}),new TextRun(text)]:[new TextRun(text)])}));
  if(section.table)children.push(new Table({width:{size:100,type:WidthType.PERCENTAGE},rows:[section.table.columns,...section.table.rows].map((row,index)=>new TableRow({tableHeader:index===0,children:row.map(value=>new TableCell({children:[new Paragraph({text:String(value)})]}))}))}));
 }
 return Packer.toBuffer(new Document({creator:'小智',title:draft.title,styles:{default:{document:{run:{font:'SimSun',size:22},paragraph:{spacing:{after:120}}}}},
  sections:[{properties:{page:{size:{width:11906,height:16838},margin:{top:1134,bottom:1134,left:1134,right:1134}}},children}]}));
}
async function xlsx(draft:OfficeDraft){
 const workbook=new ExcelJS.Workbook();workbook.creator='小智';workbook.title=draft.title;
 for(const [index,section]of draft.sections.entries()){
  const columns=section.table?.columns.length||1;const totalWidth=columns>=6?110:80;
  const sheet=workbook.addWorksheet(`${index+1}-${section.heading.replace(/[\[\]*?:/\\]/g,'-').slice(0,24)}`,{pageSetup:{paperSize:9,orientation:columns>=6?'landscape':'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0,margins:{left:0.3,right:0.3,top:0.4,bottom:0.4,header:0.15,footer:0.15}}});
  sheet.properties.defaultRowHeight=22;
  const fullRow=(value:string,size:number)=>{const row=sheet.addRow([value]);if(columns>1)sheet.mergeCells(row.number,1,row.number,columns);row.font={name:'Microsoft YaHei',size};return row;};
  fullRow(draft.title,16);fullRow(section.heading,13);
  for(const value of section.paragraphs)fullRow(value,11);
  if(section.table){sheet.addRow([]);const header=sheet.addRow(section.table.columns);header.font={bold:true};for(const row of section.table.rows)sheet.addRow(row);}
  sheet.columns.forEach(column=>{column.width=totalWidth/columns;});sheet.eachRow(row=>{
   const full=row.number<=2||row.number<=section.paragraphs.length+2;
   const layout=(fontSize:number)=>{let lines=1;row.eachCell(cell=>{cell.alignment={vertical:'top',wrapText:true};cell.font={...cell.font,name:'Microsoft YaHei',size:fontSize};
     lines=Math.max(lines,officeLines(String(cell.value??''),(full?totalWidth:totalWidth/columns)*8/fontSize).length);
     if(section.table&&row.number>section.paragraphs.length+3)cell.border={top:{style:'thin',color:{argb:'FFB0B0B0'}},bottom:{style:'thin',color:{argb:'FFB0B0B0'}},left:{style:'thin',color:{argb:'FFB0B0B0'}},right:{style:'thin',color:{argb:'FFB0B0B0'}}};
    });return Math.max(22,lines*fontSize*1.4+8);
   };
   let height=layout(row.number===1?16:row.number===2?13:11);
   // Excel's documented row-height limit is 409pt. A dense full-width paragraph
   // gets a readable 9pt style; never clamp a height and silently crop content.
   if(height>409&&full&&row.number>2)height=layout(9);
   if(height>409)throw new Error('too_large');row.height=height;
  });
  sheet.getRow(1).font={bold:true,size:16};sheet.getRow(2).font={bold:true,size:13};sheet.pageSetup.printArea=`A1:${sheet.getRow(1).getCell(columns).address.replace(/\d+$/,'')}${sheet.rowCount}`;
 }
 return Buffer.from(await workbook.xlsx.writeBuffer());
}
async function pptx(draft:OfficeDraft){
 const presentation=new PptxGenJS();presentation.layout='LAYOUT_WIDE';presentation.author='小智';presentation.title=draft.title;presentation.subject='教学办公文档';
 presentation.theme={headFontFace:'Microsoft YaHei',bodyFontFace:'Microsoft YaHei'};
 const heading=(slide:Pick<PptxGenJS.PresSlide,'addText'>,text:string)=>{const lines=officeLines(text,12*72/24*1.8);const h=lines.length*24/72*1.35+0.1;
  slide.addText(lines.join('\n'),{x:0.7,y:0.3,w:12,h,fontSize:24,bold:true,margin:0,valign:'top',breakLine:false});return 0.5+h;
 };
 const title=(text:string)=>{const slide=presentation.addSlide();const y=heading(slide,text);return {slide,y};};
 title(draft.title);
 for(const section of draft.sections){
  for(const paragraph of section.paragraphs){const {slide,y}=title(section.heading);slide.addTable([[{text:officeLines(paragraph,12*72/14*1.8).join('\n')}]],{x:0.7,y,w:12,fontFace:'Microsoft YaHei',fontSize:14,margin:0.04,border:{type:'none'},valign:'top',autoPage:true,autoPageSlideStartY:y,autoPageLineWeight:0.4,verbose:false});for(const next of slide.newAutoPagedSlides)heading(next,section.heading);}
  if(section.table){const {slide,y}=title(section.heading);const colWidth=12/section.table.columns.length;
   slide.addTable([section.table.columns,...section.table.rows.map(row=>row.map(String))].map(row=>row.map(text=>({text:officeLines(text,(colWidth-0.2)*72/12*1.8).join('\n')}))),{x:0.7,y,w:12,colW:colWidth,fontFace:'Microsoft YaHei',fontSize:12,border:{color:'B0B0B0',pt:1},margin:0.07,valign:'top',
   autoPage:true,autoPageRepeatHeader:true,autoPageSlideStartY:y,autoPageLineWeight:0.4,verbose:false});for(const next of slide.newAutoPagedSlides)heading(next,section.heading);
  }
 }
 return Buffer.from(await presentation.write({outputType:'nodebuffer',compression:true}) as Buffer);
}
/** No file-authority/tool API. The host receives bytes for a later reviewed, versioned commit. */
export async function generateOfficeDocument(format:OfficeOutputFormat,draft:OfficeDraft,options:{dataRoot:string;signal?:AbortSignal;deadlineMs?:number}):Promise<Buffer>{
 if(!officeOutputFormat(format)||!validOfficeDraft(draft))throw new Error('invalid_input');check(options.signal);
 // Snapshot the strict data before an async library can observe caller mutations.
 const input=JSON.parse(JSON.stringify(draft)) as OfficeDraft;
 try{
  const bytes=format==='pdf'?await (await import('./office-pdf-renderer')).renderOfficePdf(input,options):format==='docx'?await docx(input):format==='xlsx'?await xlsx(input):await pptx(input);
  check(options.signal);if(!bytes.length||bytes.length>OFFICE_OUTPUT_MAX_BYTES)throw new Error('too_large');return bytes;
 }catch(error){const code=error instanceof Error?error.message:'';throw Object.assign(new Error(['cancelled','timeout','too_large','configuration','cleanup_failed'].includes(code)?code:'generation_failed'),{cause:error});}
}
