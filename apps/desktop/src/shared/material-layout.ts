import {pageSha,type MaterialPreviewError} from './material-page-preview';
export const MATERIAL_LAYOUT_SCHEMA='xiaozhi.material-layout.v1' as const;
export const PDF_LAYOUT_SCHEMA='xiaozhi.local-pdf-layout.v1' as const;
export const PDF_LAYOUT_ENGINE='pdfium-5.14.0-rapidocr-3.9.2-layout.v1' as const;
export type Quad=[[number,number],[number,number],[number,number],[number,number]];
export type MaterialLine={id:string;kind:'text';needsReview:true;text:string;score:number;quad:Quad;normalizedQuad:Quad};
export type LayoutQuery={schemaVersion:typeof MATERIAL_LAYOUT_SCHEMA;requestId:string;resourceId:string;version:string;page:number;refresh:boolean};
export type LayoutCancel={schemaVersion:typeof MATERIAL_LAYOUT_SCHEMA;requestId:string};
export type PdfLayout={schemaVersion:typeof PDF_LAYOUT_SCHEMA;ok:true;engine:typeof PDF_LAYOUT_ENGINE;inputSha256:string;page:number;total:number;width:number;height:number;png:string;rasterSha256:string;lines:MaterialLine[]};
export type PdfLayoutReceipt=PdfLayout|{schemaVersion:typeof PDF_LAYOUT_SCHEMA;ok:false;error:'invalid_input'|'too_large'|'configuration'|'empty'|'parse_failed'};
export type LayoutError=MaterialPreviewError|'cache_invalid';
export type MaterialLayoutResult={schemaVersion:typeof MATERIAL_LAYOUT_SCHEMA;ok:true;requestId:string;resourceId:string;version:string;cached:boolean;layout:PdfLayout}|{schemaVersion:typeof MATERIAL_LAYOUT_SCHEMA;ok:false;error:LayoutError};
function plain(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.getOwnPropertyDescriptor(v,k)?.enumerable&&'value' in Object.getOwnPropertyDescriptor(v,k)!);}
function array(v:unknown,size?:number):v is unknown[]{return Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&(size===undefined||v.length===size)&&Reflect.ownKeys(v).length===v.length+1&&Array.from({length:v.length},(_,i)=>Object.getOwnPropertyDescriptor(v,String(i))).every(d=>!!d&&'value' in d);}
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
const integer=(v:unknown,max:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=1&&v<=max;
export function validLayoutQuery(v:unknown):v is LayoutQuery{return plain(v)&&Object.keys(v).length===6&&v.schemaVersion===MATERIAL_LAYOUT_SCHEMA&&uuid(v.requestId)&&typeof v.resourceId==='string'&&/^resource_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v.resourceId)&&pageSha(v.version)&&integer(v.page,50)&&typeof v.refresh==='boolean';}
export function validLayoutCancel(v:unknown):v is LayoutCancel{return plain(v)&&Object.keys(v).length===2&&v.schemaVersion===MATERIAL_LAYOUT_SCHEMA&&uuid(v.requestId);}
function quad(v:unknown,width:number,height:number):v is Quad{
 if(!array(v,4)||!v.every(p=>array(p,2)&&p.every((n,i)=>typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=[width,height][i])))return false;
 const points=v as Quad;
 const cross=points.map((p,i)=>{const q=points[(i+1)%4],r=points[(i+2)%4];return(q[0]-p[0])*(r[1]-q[1])-(q[1]-p[1])*(r[0]-q[0]);});
 return cross.every(n=>n>0)||cross.every(n=>n<0);
}
export function validPdfLayout(v:unknown):v is PdfLayoutReceipt{
 if(!plain(v)||v.schemaVersion!==PDF_LAYOUT_SCHEMA)return false;
 if(v.ok===false)return Object.keys(v).length===3&&typeof v.error==='string'&&['invalid_input','too_large','configuration','empty','parse_failed'].includes(v.error);
 if(v.ok!==true||Object.keys(v).length!==11||v.engine!==PDF_LAYOUT_ENGINE||!pageSha(v.inputSha256)||!pageSha(v.rasterSha256)||!integer(v.width,2401)||!integer(v.height,2401)||!integer(v.page,50)||!integer(v.total,50)||(v.page as number)>(v.total as number)||typeof v.png!=='string'||!v.png||v.png.length>5592408||v.png.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(v.png)||!array(v.lines)||v.lines.length>2000)return false;
 let chars=0;
 return v.lines.every((line,i)=>{if(!plain(line)||Object.keys(line).length!==7||line.id!==`line-${i+1}`||line.kind!=='text'||line.needsReview!==true||typeof line.text!=='string'||!line.text.trim()||line.text.length>128000||typeof line.score!=='number'||!Number.isFinite(line.score)||line.score<0||line.score>1||!quad(line.quad,v.width as number,v.height as number)||!quad(line.normalizedQuad,1,1))return false;
  chars+=line.text.length;if(chars>128000)return false;
  const raw=line.quad as Quad,normalized=line.normalizedQuad as Quad;
  return raw.every((p,j)=>p.every((n,k)=>Math.abs(n/[v.width as number,v.height as number][k]-normalized[j][k])<1e-9));
 });
}
