/** Local source preview only. A preview receipt is neither a saved question nor approval. */
export const MATERIAL_PREVIEW_SCHEMA='xiaozhi.material-page-preview.v1' as const;
export const PDF_PAGE_SCHEMA='xiaozhi.local-pdf-page.v1' as const;
export const PDF_PAGE_ENGINE='pdfium-5.14.0-page.v1' as const;
export type PageBox=[number,number,number,number];
export type MaterialPreviewQuery={schemaVersion:typeof MATERIAL_PREVIEW_SCHEMA;requestId:string;resourceId:string;version:string;page:number;box:PageBox};
export type MaterialPreviewCancel={schemaVersion:typeof MATERIAL_PREVIEW_SCHEMA;requestId:string};
export type PdfPageReceipt={schemaVersion:typeof PDF_PAGE_SCHEMA;ok:true;engine:typeof PDF_PAGE_ENGINE;inputSha256:string;page:number;total:number;box:PageBox;pageWidth:number;pageHeight:number;width:number;height:number;png:string;sha256:string}
 |{schemaVersion:typeof PDF_PAGE_SCHEMA;ok:false;error:'invalid_input'|'too_large'|'configuration'|'empty'|'parse_failed'};
export type MaterialPreviewError='invalid_input'|'permission_denied'|'source_changed'|'missing'|'unsupported'|'too_large'|'configuration'|'empty'|'parse_failed'|'busy'|'timeout'|'cancelled'|'unavailable';
export type MaterialPreviewResult={schemaVersion:typeof MATERIAL_PREVIEW_SCHEMA;ok:true;requestId:string;resourceId:string;version:string;engine:typeof PDF_PAGE_ENGINE;assetId:string;page:number;total:number;box:PageBox;width:number;height:number;sha256:string;dataUrl:string}
 |{schemaVersion:typeof MATERIAL_PREVIEW_SCHEMA;ok:false;error:MaterialPreviewError};
const uuid=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v);
export const pageSha=(v:unknown):v is string=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
function plain(v:unknown):v is Record<string,unknown>{return !!v&&typeof v==='object'&&!Array.isArray(v)&&Object.getPrototypeOf(v)===Object.prototype&&Reflect.ownKeys(v).every(k=>typeof k==='string'&&Object.getOwnPropertyDescriptor(v,k)?.enumerable&&'value' in Object.getOwnPropertyDescriptor(v,k)!);}
export function validPageBox(v:unknown):v is PageBox{return Array.isArray(v)&&Object.getPrototypeOf(v)===Array.prototype&&Reflect.ownKeys(v).length===5&&[0,1,2,3].every(i=>{const d=Object.getOwnPropertyDescriptor(v,String(i));return !!d&&'value' in d&&typeof d.value==='number'&&Number.isFinite(d.value)&&d.value>=0&&d.value<=1;})&&v.length===4&&v[0]<v[2]&&v[1]<v[3];}
export function validMaterialPreviewQuery(v:unknown):v is MaterialPreviewQuery{return plain(v)&&Object.keys(v).length===6&&v.schemaVersion===MATERIAL_PREVIEW_SCHEMA&&uuid(v.requestId)&&typeof v.resourceId==='string'&&/^resource_[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i.test(v.resourceId)&&pageSha(v.version)&&typeof v.page==='number'&&Number.isInteger(v.page)&&v.page>=1&&v.page<=50&&validPageBox(v.box);}
export function validMaterialPreviewCancel(v:unknown):v is MaterialPreviewCancel{return plain(v)&&Object.keys(v).length===2&&v.schemaVersion===MATERIAL_PREVIEW_SCHEMA&&uuid(v.requestId);}
const dimension=(v:unknown)=>typeof v==='number'&&Number.isInteger(v)&&v>=1&&v<=2401;
export function validPdfPageReceipt(v:unknown):v is PdfPageReceipt{
 if(!plain(v)||v.schemaVersion!==PDF_PAGE_SCHEMA)return false;
 if(v.ok===false)return Object.keys(v).length===3&&typeof v.error==='string'&&['invalid_input','too_large','configuration','empty','parse_failed'].includes(v.error);
 return v.ok===true&&Object.keys(v).length===13&&v.engine===PDF_PAGE_ENGINE&&pageSha(v.inputSha256)&&pageSha(v.sha256)&&typeof v.page==='number'&&typeof v.total==='number'&&Number.isInteger(v.page)&&Number.isInteger(v.total)&&v.page>=1&&v.page<=v.total&&v.total<=50&&validPageBox(v.box)&&[v.pageWidth,v.pageHeight,v.width,v.height].every(dimension)&&typeof v.png==='string'&&v.png.length<=5592408&&v.png.length>0&&v.png.length%4===0&&/^[A-Za-z0-9+/]+={0,2}$/.test(v.png);
}
export function materialPreviewErrorText(error:MaterialPreviewError){const text:Record<MaterialPreviewError,string>={invalid_input:'所选页码或范围无效。',permission_denied:'无法打开这份原件。',source_changed:'原件已变化，请重新添加资料后查看。',missing:'原件不存在或不可读取，请检查本地文件。',unsupported:'目前支持查看 PDF 原页。',too_large:'原件或页面过大，请拆分后添加。',configuration:'本地预览组件不完整，请修复后重试。',empty:'这份文件没有页面。',parse_failed:'无法打开原页，请检查文件是否损坏或需要密码。',busy:'本机正在处理其他文件，请稍后重试。',timeout:'原页读取超时，请重试。',cancelled:'已停止读取原页。',unavailable:'本地预览暂不可用，请重试。'};return text[error];}
