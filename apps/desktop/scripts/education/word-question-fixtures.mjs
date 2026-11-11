import {Document,Packer,Paragraph,TextRun,ImageRun,Math as WordMath,MathRun,MathFraction,Table,TableRow,TableCell} from 'docx';
import {deflateSync} from 'node:zlib';
function chunk(name,data){const kind=Buffer.from(name),body=Buffer.concat([kind,data]);let crc=0xffffffff;for(const b of body){crc^=b;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}const header=Buffer.alloc(4),tail=Buffer.alloc(4);header.writeUInt32BE(data.length);tail.writeUInt32BE((crc^0xffffffff)>>>0);return Buffer.concat([header,body,tail]);}
const ihdr=Buffer.alloc(13);ihdr.writeUInt32BE(8,0);ihdr.writeUInt32BE(8,4);ihdr[8]=8;ihdr[9]=6;
function pictureBytes(red){const rgba=Buffer.concat(Array.from({length:8},()=>Buffer.concat([Buffer.from([0]),Buffer.from(Array.from({length:8},()=>[red,128,208,255]).flat())])));return Buffer.concat([Buffer.from([137,80,78,71,13,10,26,10]),chunk('IHDR',ihdr),chunk('IDAT',deflateSync(rgba)),chunk('IEND',Buffer.alloc(0))]);}
export const nativePictures=Array.from({length:6},(_,i)=>pictureBytes(16+i*32));
export const nativePicture=nativePictures[0];
export async function bookletWordFixture(){
 const cell=text=>new TableCell({children:[new Paragraph(text)]});
 return Packer.toBuffer(new Document({sections:[{children:[
  new Paragraph('某地区2026学年第一学期高三年级质量调研考试'),
  new Paragraph('物理试卷'),
  new Paragraph('试卷满分100分，考试时间60分钟。'),
  new Paragraph('本考试分设试卷和答题纸。试卷包括三大部分，第一部分为单项选择题，第二部分为填空题，第三部分为综合题。'),
  new Paragraph('一、单项选择题（共40分，1至8题每小题3分，9至12题每小题4分。每小题只有一个正确选项）'),
  new Paragraph('1．下列物理量中属于矢量的是（    ）\n（A）温度 （B）重力势能 （C）电流强度 （D）电场强度'),
  new Paragraph('2．下列单位属于国际单位制中基本单位的是（    ）\n（A）牛顿 （B）开尔文 （C）焦耳 （D）特斯拉'),
  new Paragraph('参考答案'),
  new Table({rows:[new TableRow({children:['题号','1','2'].map(cell)}),new TableRow({children:['答案','D','B'].map(cell)})]})
 ]}]}));
}
export async function nativeWordFixture(){
 const picture=()=>new ImageRun({type:'png',data:nativePicture,transformation:{width:40,height:40},altText:{title:'独立来源图片',description:'这是本机生成的8像素合成图片',name:'native'}});
 return Packer.toBuffer(new Document({sections:[{children:[new Paragraph('学科：数学\n年级：初二'),
  new Paragraph({children:[new TextRun('1. 计算 '),new WordMath({children:[new MathFraction({numerator:[new MathRun('1')],denominator:[new MathRun('3')]})]}),new TextRun(' 的值。\n【答案】'),picture(),new TextRun('三分之一【解析】分子为1，分母为3。')]}),
  new Paragraph('2. 阅读下面表格，选择正确行。'),new Table({rows:Array.from({length:15},(_,i)=>new TableRow({children:[new TableCell({children:[new Paragraph('第'+(i+1)+'行数据')]}),new TableCell({children:[new Paragraph({children:i===0?[picture()]:[new TextRun(String(i+1))]})]})]}))}),new Paragraph('【答案】第1行'),new Paragraph('【解析】对照原表逐行核对。'),
  ...Array.from({length:5},(_,i)=>new Paragraph(`${i+3}. 计算${i}+1。\n【答案】${i+1}\n【解析】加一。`)),
  new Paragraph({children:[new TextRun('第8题 查看六张答案来源图片。'),...nativePictures.flatMap((data,i)=>[new TextRun('【答案】来源图'+(i+1)),new ImageRun({type:'png',data,transformation:{width:40,height:40},altText:{title:'来源图'+(i+1),description:'来源图'+(i+1),name:'part-'+i}})]),new TextRun('【解析】六张图的颜色不同，保留各自来源。')]})
 ]}]}));
}
