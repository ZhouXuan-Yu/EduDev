import {Document,Packer,Paragraph,TextRun,ImageRun,Math as WordMath,MathRun,MathFraction,Table,TableRow,TableCell,LevelFormat} from 'docx';
import JSZip from 'jszip';
export const wordFixtureImage=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7WQAAAAASUVORK5CYII=','base64');
export async function wordFixture(){
 const picture=()=>new ImageRun({type:'png',data:wordFixtureImage,transformation:{width:24,height:24},altText:{title:'合成原图',description:'一像素图片用于来源字节核对',name:'fixture'}});
 const doc=new Document({numbering:{config:[{reference:'questions',levels:[{level:0,format:LevelFormat.DECIMAL,text:'第%1题',start:1}]}]},sections:[{children:[
  new Paragraph('学科：数学\n年级：初二\n知识点：分数运算\n题型：解答题\n难度：基础'),
  new Paragraph({numbering:{reference:'questions',level:0},children:[new TextRun('计算下面的分数，并对照示意图。')]}),
  new Paragraph({children:[new WordMath({children:[new MathFraction({numerator:[new MathRun('1')],denominator:[new MathRun('3')]})]})]}),
  new Paragraph({children:[picture()]}),new Paragraph('【答案】三分之一'),new Paragraph('【解析】分子为1，分母为3。'),
  new Paragraph({numbering:{reference:'questions',level:0},children:[new TextRun('阅读表格，找出相同的数值。')]}),
  new Table({rows:Array.from({length:15},(_,i)=>new TableRow({children:[new TableCell({children:[new Paragraph('原表第'+(i+1)+'行')]}),new TableCell({children:[new Paragraph({children:i===0?[picture()]:[new TextRun(String(i+1))]})]})]}))}),
 ]}]});
 return Packer.toBuffer(doc);
}
export async function mutateWord(bytes,mutate){const zip=await JSZip.loadAsync(bytes);await mutate(zip);return zip.generateAsync({type:'nodebuffer',compression:'DEFLATE'});}
