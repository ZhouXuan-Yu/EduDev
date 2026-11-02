import {wrapTextWithAnsi} from '@earendil-works/pi-tui/dist/utils.js';
import type {PresentationSection} from '../../shared/xiaozhi-office-draft';
import type {PresentationMath,PresentationBlock} from './presentation-math';

/** Native text boxes use conservative Unicode wraps; reject dense pages rather than crop/add pages. */
function lines(text:string,width:number){
  return text.split('\n').flatMap(source=>{
    let offset=0;const wrapped=wrapTextWithAnsi(source,Math.max(2,Math.floor(width)));
    const result=wrapped.map((line,index)=>{if(index===wrapped.length-1)return source.slice(offset);const start=source.indexOf(line,offset);if(start<0)throw Error('invalid_input');const end=start+line.length,value=source.slice(offset,end);offset=end;return value;});
    for(let i=1;i<result.length;i++)if(/^[，。！？；：、）》】」』,.!?;:]/u.test(result[i])){
      const before=Array.from(result[i-1]),separator=before.findLastIndex(c=>/[，,；;：:]/u.test(c));
      const count=separator>=0&&before.length-separator-1>0&&before.length-separator-1<=12?before.length-separator-1:Math.min(3,before.length-1);
      if(count>0){result[i]=before.slice(-count).join('')+result[i];result[i-1]=before.slice(0,-count).join('');}
    }
    return result;
  });
}
export function presentationPageLayout(section:PresentationSection,math?:PresentationMath){
  // Native Microsoft YaHei glyph bounds exceed the nominal32pt*1.3 line box.
  // Keep room for actual ascenders/descenders rather than relying on visible overflow.
  const heading=lines(section.heading,12*72/32*1.65),headingHeight=heading.length*32/72*1.3+0.12;
  if(heading.length>2)throw Error('too_large');
  const top=0.6+headingHeight+0.45,bottom=6.8;
  for(const fontSize of [24,22,20,18]){
    let y=top,fits=true;
    const block=(value:PresentationBlock,width:number,size:number)=>{
      if(value.image){const imageWidth=value.image.width*size/1152,imageHeight=value.image.height*size/1152;if(imageWidth>width)fits=false;return{text:value.text,height:imageHeight+0.16,image:{...value.image,width:imageWidth,height:imageHeight}};}
      const content=lines(value.text,width*72/size*1.65).join('\n');return{text:content,height:content.split('\n').length*size/72*1.35+0.16};
    };
    const paragraphs=(math?.paragraphs??section.paragraphs.map(text=>({text}))).map(value=>{const item={...block(value,11.5,fontSize),y};y+=item.height+0.18;return item;});
    let table:undefined|{rows:string[][];rowHeights:number[];y:number;height:number;mathCells?:{row:number;column:number;blocks:ReturnType<typeof block>[]}[]};
    if(section.table){
      const rows=[section.table.columns,...section.table.rows.map(row=>row.map(String))].map((row,ri)=>row.map((text,ci)=>math?.cells.has(`${ri}:${ci}`)?'':lines(text,(12/row.length-0.22)*72/16*1.65).join('\n')));
      const rowHeights=rows.map(row=>Math.max(...row.map(text=>text.split('\n').length))*16/72*1.4+0.16);
      table={rows,rowHeights,y,height:rowHeights.reduce((sum,h)=>sum+h,0)};y+=table.height;
      if(math?.cells.size){
        const before=table.height;
        table.mathCells=[...math.cells].map(([key,values])=>{const [row,column]=key.split(':').map(Number),blocks=values.map(value=>block(value,12/section.table!.columns.length-0.22,16));rows[row][column]='';rowHeights[row]=Math.max(rowHeights[row],blocks.reduce((h,b)=>h+b.height,0)+0.16);return{row,column,blocks};});
        table.height=rowHeights.reduce((sum,h)=>sum+h,0);y+=table.height-before;
      }
    }
    if(fits&&y<=bottom)return {heading:heading.join('\n'),headingHeight,paragraphs,fontSize,table};
  }
  throw Error('too_large');
}
