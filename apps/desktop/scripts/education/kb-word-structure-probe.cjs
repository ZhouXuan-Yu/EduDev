const fs=require('fs'),path=require('path'),crypto=require('crypto');
const {Document,Packer,Paragraph,TextRun,ImageRun,Math:WordMath,MathRun,MathFraction,Table,TableRow,TableCell}=require('docx');
const api=require('@firecrawl/anydoc');
(async()=>{
 if(require('@firecrawl/anydoc/package.json').version!=='0.1.2')throw Error('Pinned anydoc version required');
 const dir=path.resolve('test-results/goal/kb-word-source-probe');fs.mkdirSync(dir,{recursive:true});
 const image=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+a7WQAAAAASUVORK5CYII=','base64');
 const document=new Document({sections:[{children:[
  new Paragraph('学科：数学；第1题：阅读公式与示意图，求数值。'),
  new Paragraph({children:[new TextRun('公式：'),new WordMath({children:[new MathFraction({numerator:[new MathRun('1')],denominator:[new MathRun('3')]})]})]}),
  new Paragraph({children:[new ImageRun({type:'png',data:image,transformation:{width:24,height:24},altText:{title:'合成示意图',description:'仅验证图片字节保留，不验证题图识别',name:'fixture'}})]}),
  new Table({rows:[new TableRow({children:[new TableCell({children:[new Paragraph('答案')]}),new TableCell({children:[new Paragraph('三分之一')]})]})]}),
 ]}]});
 const bytes=await Packer.toBuffer(document);fs.writeFileSync(path.join(dir,'含公式与图片.docx'),bytes);
 const ast=await api.toDocument(bytes,'docx'),markdown=await api.toMarkdownBytes(bytes,'docx');
 const assets=ast.assets.map(a=>({id:a.id,mediaType:a.mediaType,originPart:a.originPart,bytes:a.data.length,sha256:crypto.createHash('sha256').update(a.data).digest('hex')}));
 const report={scope:'Synthetic DOCX structure probe with actual pinned anydoc 0.1.2; 1px image is a presence fixture, not geometry or teacher quality',sha256:crypto.createHash('sha256').update(bytes).digest('hex'),bytes:bytes.length,markdown,blocks:ast.blocks,assets,originalImageSha256:crypto.createHash('sha256').update(image).digest('hex')};
 fs.writeFileSync(path.join(dir,'report.json'),JSON.stringify(report,null,2));console.log(JSON.stringify(report));
})().catch(e=>{console.error(e);process.exitCode=1;});
