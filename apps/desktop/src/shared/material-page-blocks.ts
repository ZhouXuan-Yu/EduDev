/** Local, unreviewed layout elements. Geometry is never a question/answer approval. */
export const PAGE_BLOCKS_SCHEMA='xiaozhi.local-page-blocks.v1' as const;
export const PAGE_BLOCKS_ENGINE='rapid-layout-1.2.1-pp-doclayoutv3-250dbad1.v1' as const;
export const PAGE_LINE_BLOCKS_ENGINE='rapid-layout-1.2.1-pp-doclayoutv3-250dbad1.v1+ocr-line-regions.v1' as const;
export const PAGE_BLOCK_KINDS=['abstract','algorithm','aside_text','chart','content','display_formula','doc_title','figure_title','footer','footer_image','footnote','formula_number','header','header_image','image','inline_formula','number','paragraph_title','reference','reference_content','seal','table','text','vertical_text','vision_footnote'] as const;
export type PageBlock={id:string;kind:typeof PAGE_BLOCK_KINDS[number];score:number;box:[number,number,number,number];needsReview:true;lineRegion?:{parent:string;box:[number,number,number,number];marginX:[number,number]}};
export type PageBlocks={schemaVersion:typeof PAGE_BLOCKS_SCHEMA;ok:true;engine:typeof PAGE_BLOCKS_ENGINE|typeof PAGE_LINE_BLOCKS_ENGINE;rasterSha256:string;width:number;height:number;blocks:PageBlock[]};
export type PageBlocksReceipt=PageBlocks|{schemaVersion:typeof PAGE_BLOCKS_SCHEMA;ok:false;error:'invalid_input'|'too_large'|'configuration'|'parse_failed'};
const plain=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value'in d;});
const array=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>!!d&&d.enumerable&&'value'in d);
export function validPageBlocks(v:unknown):v is PageBlocksReceipt{
 if(plain(v,['schemaVersion','ok','error']))return v.schemaVersion===PAGE_BLOCKS_SCHEMA&&v.ok===false&&typeof v.error==='string'&&['invalid_input','too_large','configuration','parse_failed'].includes(v.error);
 if(!plain(v,['schemaVersion','ok','engine','rasterSha256','width','height','blocks'])||v.schemaVersion!==PAGE_BLOCKS_SCHEMA||v.ok!==true||![PAGE_BLOCKS_ENGINE,PAGE_LINE_BLOCKS_ENGINE].includes(v.engine as typeof PAGE_BLOCKS_ENGINE)||typeof v.rasterSha256!=='string'||!/^[a-f0-9]{64}$/.test(v.rasterSha256)||![v.width,v.height].every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=1&&n<=2401)||!array(v.blocks,256))return false;
 if(!v.blocks.every((b,i)=>(plain(b,['id','kind','score','box','needsReview'])||v.engine===PAGE_LINE_BLOCKS_ENGINE&&plain(b,['id','kind','score','box','needsReview','lineRegion']))&&b.id===`block-${i+1}`&&PAGE_BLOCK_KINDS.includes(b.kind as PageBlock['kind'])&&b.needsReview===true&&typeof b.score==='number'&&Number.isFinite(b.score)&&b.score>=.3&&b.score<=1&&array(b.box,4)&&b.box.length===4&&b.box.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1)&&Number(b.box[2])-Number(b.box[0])>=1/Number(v.width)&&Number(b.box[3])-Number(b.box[1])>=1/Number(v.height)))return false;
 if(v.engine===PAGE_BLOCKS_ENGINE)return true;
 const families=new Map<string,PageBlock[]>();
 for(const block of v.blocks as PageBlock[]){
  if(!Object.hasOwn(block,'lineRegion'))continue;
  const r=block.lineRegion;
  if(!plain(r,['parent','box','marginX'])||block.kind!=='text'||typeof r.parent!=='string'||!/^block-[1-9]\d{0,2}$/.test(r.parent)||Number(r.parent.slice(6))>256||!array(r.box,4)||!r.box.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1)||!array(r.marginX,2)||!r.marginX.every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=12&&n<=192)||r.box[0]!==block.box[0]||r.box[2]!==block.box[2]||Number(r.box[1])>block.box[1]||Number(r.box[3])<block.box[3])return false;
  const members=families.get(r.parent)||[];members.push(block);families.set(r.parent,members);
 }
 return families.size>0&&[...families.values()].every(members=>{
  const rows=[...members].sort((a,b)=>a.box[1]-b.box[1]),parent=rows[0].lineRegion!;
  return rows.length>=2&&rows.length<=8&&rows[0].box[1]===parent.box[1]&&rows.at(-1)!.box[3]===parent.box[3]&&rows.every((b,i)=>JSON.stringify(b.lineRegion)===JSON.stringify(parent)&&(!i||rows[i-1].box[3]===b.box[1]));
 });
}
export function pageBlocksMatch(v:unknown,raster:{rasterSha256:string;width:number;height:number}):v is PageBlocks{
 return validPageBlocks(v)&&v.ok&&v.rasterSha256===raster.rasterSha256&&v.width===raster.width&&v.height===raster.height;
}
