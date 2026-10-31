import {Document,Packer,Paragraph,TextRun,Table,TableRow,TableCell,PageBreak,Math,MathRun} from 'docx';

export async function wordPageFixture(){
 const paragraph=text=>new Paragraph({children:[new TextRun({text,font:'Microsoft YaHei'})]});
 const rows=[['项目','金额'],['课堂教具','240']].map(row=>new TableRow({children:row.map(text=>new TableCell({children:[paragraph(text)]}))}));
 return Packer.toBuffer(new Document({sections:[{properties:{page:{size:{width:11906,height:16838}}},children:[
  paragraph('A4实际页面检查：这是一段用于核对真实Word排版的长标题'),paragraph('第一页标记 PAGE_ONE'),new Table({rows}),
  new Paragraph({children:[new PageBreak()]}),paragraph('第二页标记 PAGE_TWO'),paragraph('浸入高度：6cm'),
  new Paragraph({children:[new Math({children:[new MathRun('F = ρgV')]})]}),new Paragraph({children:[new PageBreak()]}),paragraph('第三页标记 PAGE_THREE'),
 ]}]}));
}
