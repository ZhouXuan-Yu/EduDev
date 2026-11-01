/** Local, unreviewed layout elements. Geometry is never a question/answer approval. */
export const PAGE_BLOCKS_SCHEMA='xiaozhi.local-page-blocks.v1' as const;
export const PAGE_BLOCKS_ENGINE='rapid-layout-1.2.1-pp-doclayoutv3-250dbad1.v1' as const;
export const PAGE_BLOCK_KINDS=['abstract','algorithm','aside_text','chart','content','display_formula','doc_title','figure_title','footer','footer_image','footnote','formula_number','header','header_image','image','inline_formula','number','paragraph_title','reference','reference_content','seal','table','text','vertical_text','vision_footnote'] as const;
export type PageBlock={id:string;kind:typeof PAGE_BLOCK_KINDS[number];score:number;box:[number,number,number,number];needsReview:true};
export type PageBlocks={schemaVersion:typeof PAGE_BLOCKS_SCHEMA;ok:true;engine:typeof PAGE_BLOCKS_ENGINE;rasterSha256:string;width:number;height:number;blocks:PageBlock[]};
export type PageBlocksReceipt=PageBlocks|{schemaVersion:typeof PAGE_BLOCKS_SCHEMA;ok:false;error:'invalid_input'|'too_large'|'configuration'|'parse_failed'};
const plain=(v:unknown,keys:string[]):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).length===keys.length&&keys.every(k=>{const d=Object.getOwnPropertyDescriptor(v,k);return !!d&&d.enumerable&&'value'in d;});
const array=(v:unknown,max:number):v is unknown[]=>Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&v.length<=max&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>!!d&&d.enumerable&&'value'in d);
export function validPageBlocks(v:unknown):v is PageBlocksReceipt{
 if(plain(v,['schemaVersion','ok','error']))return v.schemaVersion===PAGE_BLOCKS_SCHEMA&&v.ok===false&&typeof v.error==='string'&&['invalid_input','too_large','configuration','parse_failed'].includes(v.error);
 if(!plain(v,['schemaVersion','ok','engine','rasterSha256','width','height','blocks'])||v.schemaVersion!==PAGE_BLOCKS_SCHEMA||v.ok!==true||v.engine!==PAGE_BLOCKS_ENGINE||typeof v.rasterSha256!=='string'||!/^[a-f0-9]{64}$/.test(v.rasterSha256)||![v.width,v.height].every(n=>typeof n==='number'&&Number.isSafeInteger(n)&&n>=1&&n<=2401)||!array(v.blocks,256))return false;
 return v.blocks.every((b,i)=>plain(b,['id','kind','score','box','needsReview'])&&b.id===`block-${i+1}`&&PAGE_BLOCK_KINDS.includes(b.kind as PageBlock['kind'])&&b.needsReview===true&&typeof b.score==='number'&&Number.isFinite(b.score)&&b.score>=.3&&b.score<=1&&array(b.box,4)&&b.box.length===4&&b.box.every(n=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=1)&&Number(b.box[2])-Number(b.box[0])>=1/Number(v.width)&&Number(b.box[3])-Number(b.box[1])>=1/Number(v.height));
}
export function pageBlocksMatch(v:unknown,raster:{rasterSha256:string;width:number;height:number}):v is PageBlocks{
 return validPageBlocks(v)&&v.ok&&v.rasterSha256===raster.rasterSha256&&v.width===raster.width&&v.height===raster.height;
}
