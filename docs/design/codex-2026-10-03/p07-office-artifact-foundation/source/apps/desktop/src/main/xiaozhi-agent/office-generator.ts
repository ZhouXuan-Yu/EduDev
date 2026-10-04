import {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,HeadingLevel,WidthType,AlignmentType} from 'docx';
import ExcelJS from 'exceljs';import PptxGenJS from 'pptxgenjs';
import {validOfficeDraft,officeOutputFormat,OFFICE_OUTPUT_MAX_BYTES,type OfficeDraft,type OfficeOutputFormat} from '../../shared/xiaozhi-office-draft';
const check=(signal?:AbortSignal)=>{if(signal?.aborted)throw new Error('cancelled');};
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
  const sheet=workbook.addWorksheet(`${index+1}-${section.heading.replace(/[\[\]*?:/\\]/g,'-').slice(0,24)}`,{pageSetup:{paperSize:9,orientation:'portrait',fitToPage:true,fitToWidth:1,fitToHeight:0}});
  const columns=section.table?.columns.length||1;sheet.addRow([draft.title]);sheet.addRow([section.heading]);
  for(const value of section.paragraphs){const row=sheet.addRow([value]);if(columns>1)sheet.mergeCells(row.number,1,row.number,columns);row.height=Math.min(300,Math.max(30,Math.ceil(value.length/45)*16));}
  if(section.table){sheet.addRow([]);const header=sheet.addRow(section.table.columns);header.font={bold:true};for(const row of section.table.rows)sheet.addRow(row);}
  sheet.columns.forEach(column=>{column.width=columns===1?80:24;});sheet.eachRow(row=>{row.eachCell(cell=>{cell.alignment={vertical:'top',wrapText:true};});});
  sheet.getRow(1).font={bold:true,size:16};sheet.getRow(2).font={bold:true,size:13};sheet.pageSetup.printArea=`A1:${sheet.getRow(1).getCell(columns).address.replace(/\d+$/,'')}${sheet.rowCount}`;
 }
 return Buffer.from(await workbook.xlsx.writeBuffer());
}
async function pptx(draft:OfficeDraft){
 const presentation=new PptxGenJS();presentation.layout='LAYOUT_WIDE';presentation.author='小智';presentation.title=draft.title;presentation.subject='教学办公文档';
 presentation.theme={headFontFace:'Microsoft YaHei',bodyFontFace:'Microsoft YaHei'};
 const title=(text:string)=>{const slide=presentation.addSlide();slide.addText(text,{x:0.7,y:0.3,w:12,h:0.7,fontSize:24,bold:true,breakLine:false});return slide;};
 title(draft.title);
 for(const section of draft.sections){
  for(const paragraph of section.paragraphs){const slide=title(section.heading);slide.addText(paragraph,{x:0.7,y:1.2,w:12,h:5.6,fontSize:14,margin:0,breakLine:false,paraSpaceAfter:8,fit:'shrink'});}
  if(section.table){const slide=title(section.heading);slide.addTable([section.table.columns,...section.table.rows.map(row=>row.map(String))].map(row=>row.map(text=>({text}))),{x:0.7,y:1.2,w:12,fontFace:'Microsoft YaHei',fontSize:12,border:{color:'B0B0B0',pt:1},margin:0.07,
   autoPage:true,autoPageRepeatHeader:true,autoPageSlideStartY:0.5,verbose:false});}
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
