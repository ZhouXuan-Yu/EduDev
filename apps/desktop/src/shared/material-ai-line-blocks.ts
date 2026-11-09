import {pageBlockTexts,validBlockTexts,type FragmentPageSource} from './material-ai-page-fragments';
import {PAGE_BLOCKS_ENGINE,PAGE_LINE_BLOCKS_ENGINE,validPageBlocks,type PageBlock} from './material-page-blocks';
import type {PageBox} from './material-page-preview';

/** Derive only new frozen inputs; historical prompts and layout cache stay intact. */
export function refinePageLineBlocks(source:FragmentPageSource):FragmentPageSource{
 const page=source.blocks,lines=source.lines;
 if(!validPageBlocks(page)||!page.ok||!validBlockTexts(source.blockTexts,page))throw Error('source_changed');
 if(page.engine!==PAGE_BLOCKS_ENGINE||!Array.isArray(lines)||!lines.length||lines.length>2000)return source;
 const rects:PageBox[]=[];
 for(const line of lines){
  const q=line?.normalizedQuad;
  if(typeof line?.text!=='string'||!Array.isArray(q)||q.length!==4||!q.every(p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&n>=0&&n<=1)))return source;
  const box:PageBox=[Math.min(...q.map(p=>p[0])),Math.min(...q.map(p=>p[1])),Math.max(...q.map(p=>p[0])),Math.max(...q.map(p=>p[1]))];
  if(box[2]<=box[0]||box[3]<=box[1])return source;rects.push(box);
 }
 const area=(b:PageBox)=>(b[2]-b[0])*(b[3]-b[1]);
 const overlap=(a:PageBox,b:PageBox)=>Math.max(0,Math.min(a[2],b[2])-Math.max(a[0],b[0]))*Math.max(0,Math.min(a[3],b[3])-Math.max(a[1],b[1]));
 const blocks:PageBlock[]=[];let changed=false;
 for(const block of page.blocks){
  const [x,y,right,bottom]=block.box,pad=12/page.width;
  // Preserve the entire original core. Overlapping/ambiguous blocks stay intact;
  // only partial, disjoint lateral obstructions need line regions.
  const foreign=page.blocks.filter(b=>b!==block),barriers=foreign.filter(b=>{
   const [a,t,c,d]=b.box;return Math.min(bottom,d)>Math.max(y,t)&&(c<=x&&x-c<pad||a>=right&&a-right<pad);
  });
  if(block.kind!=='text'||!barriers.length||foreign.some(b=>overlap(block.box,b.box)>1e-12)){blocks.push(block);continue;}
  const owned=rects.filter(b=>overlap(b,block.box)/area(b)>=.6).sort((a,b)=>a[1]-b[1]||a[0]-b[0]);
  const rows:{top:number;bottom:number}[]=[];
  for(const b of owned){const last=rows.at(-1);if(last&&b[1]-last.bottom<4/page.height)last.bottom=Math.max(last.bottom,b[3]);else rows.push({top:b[1],bottom:b[3]});}
  const signature=(row:{top:number;bottom:number})=>barriers.filter(b=>Math.min(row.bottom,b.box[3])>Math.max(row.top,b.box[1])).map(b=>b.id).join(',');
  const cuts:number[]=[];
  for(let i=1;i<rows.length;i++)if(signature(rows[i-1])!==signature(rows[i])){
   const cut=(rows[i-1].bottom+rows[i].top)/2;
   if(cut>y+1/page.height&&cut<bottom-1/page.height)cuts.push(cut);
  }
  if(!cuts.length||cuts.length>=8){blocks.push(block);continue;}
  // Flow below a lateral figure may contain an answer blank missed by OCR.
  // Reclaim that obstacle's horizontal extent as well as one line-height,
  // bounded in pixels; the existing foreign-block barriers still clip it.
  const heights=rows.map(r=>(r.bottom-r.top)*page.height).sort((a,b)=>a-b),lineHeight=heights[Math.floor(heights.length/2)];
  const margin=(left:boolean)=>Math.max(12,Math.min(192,Math.ceil(Math.max(lineHeight,...barriers.filter(b=>left?b.box[2]<=x:b.box[0]>=right).map(b=>left?(x-b.box[0])*page.width+12:(b.box[2]-right)*page.width+12)))));
  changed=true;const ends=[y,...cuts,bottom],marginX:[number,number]=[margin(true),margin(false)];
  for(let i=1;i<ends.length;i++)blocks.push({...block,box:[x,ends[i-1],right,ends[i]],lineRegion:{parent:block.id,box:[...block.box],marginX}});
 }
 if(!changed||blocks.length>256)return source;
 const derived={...page,engine:PAGE_LINE_BLOCKS_ENGINE,blocks:blocks.map((b,i)=>({...b,id:'block-'+(i+1)}))};
 if(!validPageBlocks(derived))return source;
 return{...source,blocks:derived,blockTexts:pageBlockTexts(derived,{...page,lines})};
}
