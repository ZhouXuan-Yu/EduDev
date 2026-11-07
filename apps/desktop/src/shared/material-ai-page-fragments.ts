import type {AiPagePrompt} from './material-ai-page';
import {choiceLayoutSignature} from './material-ai-choice';
import {validPageBlocks,type PageBlocks} from './material-page-blocks';
import type {PageBox} from './material-page-preview';
import type {PdfLayout} from './material-layout';
import type {MaterialLine} from './material-layout';
import {aiTextSignature,questionNumberPrefix,type AiImageQuestion} from './material-ai-image';
import {MATERIAL_OWNED_CROP_GEOMETRY,MATERIAL_FIGURE_CROPS,ownedPageFragmentGroups} from './material-ai-owned-crops';
export {MATERIAL_OWNED_CROP_GEOMETRY} from './material-ai-owned-crops';

export const MATERIAL_CROP_CORRECTION_POLICY='local-crop-review.v3' as const;
export const MATERIAL_CROP_REVIEW_POLICY='local-crop-review.v1' as const;
export const MATERIAL_CROP_REVIEW_IMAGES_POLICY='local-crop-review.v2' as const;
export const MATERIAL_PAGE_FRAGMENTS_PROMPT='page-fragments.v1' as const;
export const MATERIAL_PAGE_FRAGMENT_TEXT_PROMPT='page-fragments.v2' as const;
export const MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT='page-fragments.v3' as const;
/** Frozen per new task; absence preserves the historical image-only crop journal. */
export const MATERIAL_TEXT_SOURCE_CROPS='complete-text.v1' as const;
export const MATERIAL_CROP_BODY_TEXT='body-concordance.v1' as const;
export const pageFragmentTextPolicy=(v:unknown):v is typeof MATERIAL_PAGE_FRAGMENT_TEXT_PROMPT|typeof MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT=>v===MATERIAL_PAGE_FRAGMENT_TEXT_PROMPT||v===MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT;
export const pageFragmentsPolicy=(v:unknown):v is typeof MATERIAL_PAGE_FRAGMENTS_PROMPT|typeof MATERIAL_PAGE_FRAGMENT_TEXT_PROMPT|typeof MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT=>v===MATERIAL_PAGE_FRAGMENTS_PROMPT||pageFragmentTextPolicy(v);
export const MATERIAL_PAGE_FRAGMENTS_RESPONSE='xiaozhi.material-ai-page-fragments.v1' as const;
export type BlockTextHint={blockId:string;text:string};
export type FragmentPageSource={blocks:PageBlocks;blockTexts:BlockTextHint[];lines?:MaterialLine[]};
export type AiQuestionFragments={number:string;blockIds:string[];complete:boolean};
/** Comparison-only adapter. The final stem must already match the independently parsed source. */
export function comparableFragmentQuestion(a:AiImageQuestion,b:AiImageQuestion|undefined,sourceStem:string,policy:unknown,prompt?:AiPagePrompt):AiImageQuestion{
 const signature=(s:string)=>choiceLayoutSignature(s,prompt);
 if(policy!==MATERIAL_PAGE_FRAGMENT_SOURCE_PROMPT||!b||a.number!==b.number||signature(b.stem)!==signature(sourceStem)||a.stem===b.stem)return a;
 const marker=questionNumberPrefix(a.stem,a.number);
 if(!marker||signature(a.stem.slice(marker[0].length))!==signature(b.stem))return a;
 const projection={...a.projection};for(const key of ['statement','choices','subquestions','tables','formulas','figures'] as const){const left=a.projection[key],right=b.projection[key];if(left.state==='provided'&&right.state==='provided'&&left.text===a.stem&&right.text===b.stem)projection[key]={...left,text:b.stem};}
 return{...a,stem:b.stem,projection};
}
const plain=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&[Object.prototype,null].includes(Object.getPrototypeOf(v))&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value'in d;});
const array=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>!!d&&d.enumerable&&'value'in d);
export function validBlockTexts(v:unknown,page:PageBlocks):v is BlockTextHint[]{return array(v,256)&&v.length===page.blocks.length&&v.every((r,i)=>plain(r,['blockId','text'])&&r.blockId===page.blocks[i].id&&typeof r.text==='string'&&r.text===r.text.trim()&&r.text.length<=2048&&!/[\x00]/.test(r.text))&&new TextEncoder().encode(JSON.stringify(v)).length<=48*1024;}
/** OCR hints come only from the authenticated same raster; they are not corrected source text. */
export function pageBlockTexts(page:PageBlocks,layout:Pick<PdfLayout,'rasterSha256'|'width'|'height'|'lines'>):BlockTextHint[]{
 if(!validPageBlocks(page)||!page.ok||page.rasterSha256!==layout.rasterSha256||page.width!==layout.width||page.height!==layout.height)throw Error('source_changed');
 let budget=12000;
 const result=page.blocks.map(block=>{const [a,b,c,d]=block.box,lines=layout.lines.filter(line=>{const points=line.normalizedQuad,x=Math.min(...points.map(p=>p[0])),y=Math.min(...points.map(p=>p[1])),right=Math.max(...points.map(p=>p[0])),bottom=Math.max(...points.map(p=>p[1])),area=(right-x)*(bottom-y);return area>0&&Math.max(0,Math.min(c,right)-Math.max(a,x))*Math.max(0,Math.min(d,bottom)-Math.max(b,y))/area>=.6;});
  const text=lines.map(l=>l.text).join('\n').replaceAll('\0','').slice(0,Math.min(2048,budget)).trim();budget-=text.length;return{blockId:block.id,text};});
 if(!validBlockTexts(result,page))throw Error('unit_too_large');return result;
}
export function validQuestionFragments(value:unknown,numbers:readonly string[]):value is AiQuestionFragments[]{
 if(!array(value,20)||value.length!==numbers.length||new Set(numbers).size!==numbers.length)return false;
 const seen=new Set<string>(),owned=new Set<string>();
 return value.every(v=>{
  if(!plain(v,['number','blockIds','complete'])||typeof v.number!=='string'||!/^\d{1,5}$/.test(v.number)||!numbers.includes(v.number)||seen.has(v.number)||typeof v.complete!=='boolean'||!array(v.blockIds,32)||v.complete&&!v.blockIds.length)return false;
  seen.add(v.number);let previous=0;
  for(const id of v.blockIds){if(typeof id!=='string'||!/^block-[1-9]\d{0,2}$/.test(id)||Number(id.slice(6))>256||Number(id.slice(6))<=previous||owned.has(id))return false;previous=Number(id.slice(6));owned.add(id);}return true;
 });
}
/** Padding is bounded by the closest disjoint detected block; no invented union rectangle. */
export function fragmentBox(page:PageBlocks,id:string):PageBox{
 const block=page.blocks.find(b=>b.id===id);if(!block)throw Error('invalid_response');
 const [x,y,right,bottom]=block.box,padX=12/page.width,padY=12/page.height;
 let left=Math.max(0,x-padX),top=Math.max(0,y-padY),endX=Math.min(1,right+padX),endY=Math.min(1,bottom+padY);
 for(const other of page.blocks){if(other===block)continue;const [a,b,c,d]=other.box;
  if(Math.min(right,c)>Math.max(x,a)){if(d<=y)top=Math.max(top,Math.min(y,d+1/page.height));if(b>=bottom)endY=Math.min(endY,Math.max(bottom,b-1/page.height));}
  if(Math.min(bottom,d)>Math.max(y,b)){if(c<=x)left=Math.max(left,Math.min(x,c+1/page.width));if(a>=right)endX=Math.min(endX,Math.max(right,a-1/page.width));}
 }return[left,top,endX,endY];
}
/** Coalesce only consecutive owned blocks, never enclosing pixels of another detected block. */
export function pageFragmentGroups(page:PageBlocks,ids:string[],coalesce:boolean,geometry?:typeof MATERIAL_OWNED_CROP_GEOMETRY,figurePolicy?:typeof MATERIAL_FIGURE_CROPS){
 if(geometry===MATERIAL_OWNED_CROP_GEOMETRY)return ownedPageFragmentGroups(page,ids,8,figurePolicy===MATERIAL_FIGURE_CROPS);
 const groups=ids.map(id=>({blockIds:[id],box:fragmentBox(page,id)}));if(!coalesce){if(groups.length>8)throw Error('source_incomplete');return groups;}
 const area=(b:PageBox)=>(b[2]-b[0])*(b[3]-b[1]);
 while(groups.length>8){let best=-1,cost=Infinity,box:PageBox|undefined;
  for(let i=0;i<groups.length-1;i++){const a=groups[i],b=groups[i+1],union:PageBox=[Math.min(a.box[0],b.box[0]),Math.min(a.box[1],b.box[1]),Math.max(a.box[2],b.box[2]),Math.max(a.box[3],b.box[3])],owned=new Set([...a.blockIds,...b.blockIds]);
   if(page.blocks.some(block=>!owned.has(block.id)&&Math.min(union[2],block.box[2])-Math.max(union[0],block.box[0])>1e-6&&Math.min(union[3],block.box[3])-Math.max(union[1],block.box[1])>1e-6))continue;
   const extra=area(union)-area(a.box)-area(b.box);if(extra<cost){best=i;cost=extra;box=union;}
  }if(best<0||!box)throw Error('source_incomplete');groups.splice(best,2,{blockIds:[...groups[best].blockIds,...groups[best+1].blockIds],box});
 }return groups;
}
export function fragmentsMatchPage(value:AiQuestionFragments[],page:PageBlocks){
 if(!validPageBlocks(page)||!page.ok||!validQuestionFragments(value,value.map(r=>r.number)))return false;
 const selected=value.flatMap(r=>r.blockIds.map(id=>({number:r.number,block:page.blocks.find(b=>b.id===id)})));
 if(selected.some(v=>!v.block||['header','footer','header_image','footer_image'].includes(v.block.kind)))return false;
 for(let i=0;i<selected.length;i++)for(let k=0;k<i;k++){const a=selected[i],b=selected[k];if(a.number===b.number)continue;const x=a.block!.box,y=b.block!.box;if(Math.min(x[2],y[2])-Math.max(x[0],y[0])>1e-6&&Math.min(x[3],y[3])-Math.max(x[1],y[1])>1e-6)return false;}return true;
}
