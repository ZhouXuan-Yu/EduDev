import type {PageBlocks} from './material-page-blocks';
import type {PageBox} from './material-page-preview';

export const MATERIAL_OWNED_CROP_GEOMETRY='owned-block-margins.v1' as const;
const intersects=(a:PageBox,b:PageBox)=>Math.min(a[2],b[2])-Math.max(a[0],b[0])>1e-6&&Math.min(a[3],b[3])-Math.max(a[1],b[1])>1e-6;
const area=(b:PageBox)=>(b[2]-b[0])*(b[3]-b[1]);
/** Partition the full ordered selection. Every group owns every detected block in its rectangle. */
export function ownedPageFragmentGroups(page:PageBlocks,ids:string[],maxGroups=8){
 if(!Number.isSafeInteger(maxGroups)||maxGroups<1||maxGroups>8||!ids.length||ids.length>32||new Set(ids).size!==ids.length)throw Error('source_incomplete');
 const selected=ids.map(id=>page.blocks.find(b=>b.id===id));if(selected.some(b=>!b))throw Error('source_changed');
 const own=new Set(ids),foreign=page.blocks.filter(b=>!own.has(b.id));
 const padded=selected.map(block=>{
  const [x,y,right,bottom]=block!.box;let left=Math.max(0,x-12/page.width),top=Math.max(0,y-12/page.height),endX=Math.min(1,right+12/page.width),endY=Math.min(1,bottom+12/page.height);
  for(const other of foreign){const [a,b,c,d]=other.box;
   if(Math.min(right,c)>Math.max(x,a)){if(d<=y)top=Math.max(top,Math.min(y,d+1/page.height));if(b>=bottom)endY=Math.min(endY,Math.max(bottom,b-1/page.height));}
   if(Math.min(bottom,d)>Math.max(y,b)){if(c<=x)left=Math.max(left,Math.min(x,c+1/page.width));if(a>=right)endX=Math.min(endX,Math.max(right,a-1/page.width));}
  }return[left,top,endX,endY] as PageBox;
 });
 const ranges=new Map<string,PageBox>();
 for(let start=0;start<ids.length;start++){
  let box=padded[start];const members=new Set<string>();
  for(let end=start;end<ids.length;end++){
   const b=padded[end];box=[Math.min(box[0],b[0]),Math.min(box[1],b[1]),Math.max(box[2],b[2]),Math.max(box[3],b[3])];members.add(ids[end]);
   if(!page.blocks.some(block=>!members.has(block.id)&&intersects(box,block.box)))ranges.set(start+':'+(end+1),box);
  }
 }
 type Plan={cost:number;groups:{blockIds:string[];box:PageBox}[]};
 const plans:Array<Array<Plan|undefined>>=Array.from({length:ids.length+1},()=>Array(9));plans[0][0]={cost:0,groups:[]};
 for(let end=1;end<=ids.length;end++)for(let count=1;count<=8;count++)for(let start=0;start<end;start++){
  const before=plans[start][count-1],box=ranges.get(start+':'+end);if(!before||!box)continue;
  const cost=before.cost+area(box);if(!plans[end][count]||cost<plans[end][count]!.cost)plans[end][count]={cost,groups:[...before.groups,{blockIds:ids.slice(start,end),box}]};
 }
 for(let count=maxGroups;count>=1;count--)if(plans[ids.length][count])return plans[ids.length][count]!.groups;
 throw Error('source_incomplete');
}
