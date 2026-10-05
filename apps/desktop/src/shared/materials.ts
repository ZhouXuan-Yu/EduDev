import type {ResourceChunk,TeacherResource} from './contracts';

export const MATERIALS_SCHEMA='xiaozhi.materials.v1' as const;
export const MATERIAL_PAGE_SIZE=50;
export type MaterialQuery={schemaVersion:typeof MATERIALS_SCHEMA;query:string;offset:number};
export type MaterialBodyQuery={schemaVersion:typeof MATERIALS_SCHEMA;resourceId:string;offset:number};
export type MaterialPage={schemaVersion:typeof MATERIALS_SCHEMA;resources:TeacherResource[];total:number;offset:number;hasMore:boolean};
export type MaterialBody={schemaVersion:typeof MATERIALS_SCHEMA;resource:TeacherResource;chunks:ResourceChunk[];total:number;offset:number;hasMore:boolean};
export type MaterialRetry={schemaVersion:typeof MATERIALS_SCHEMA;resource:TeacherResource};
export type MaterialJob={schemaVersion:typeof MATERIALS_SCHEMA;active:boolean};
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
export const materialId=(v:unknown):v is string=>typeof v==='string'&&/^resource_[a-f0-9-]{36}$/i.test(v);
const offset=(v:unknown)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=0&&v<=10000000;
export function validMaterialQuery(v:unknown):v is MaterialQuery{return object(v)&&Object.keys(v).length===3&&v.schemaVersion===MATERIALS_SCHEMA&&typeof v.query==='string'&&v.query.length<=128&&!/[\x00-\x1f]/.test(v.query)&&offset(v.offset);}
export function validMaterialBodyQuery(v:unknown):v is MaterialBodyQuery{return object(v)&&Object.keys(v).length===3&&v.schemaVersion===MATERIALS_SCHEMA&&materialId(v.resourceId)&&offset(v.offset);}
export const materialTerms=(query:string)=>query.normalize('NFKC').toLowerCase().trim().split(/\s+/).filter(Boolean);
export function materialFailureText(engine:string):string {
 const code=engine.split(':').at(-1);
 const messages:Record<string,string>={needs_ocr:'这份文件需要文字识别，目前未收录正文。',unsupported:'暂不支持读取这种格式，请转换为 PDF、DOCX、PPTX、XLSX、TXT 或 Markdown。',too_large:'文件或正文过大，请拆分后添加。',empty:'文件中没有可收录的文字。',text_unreadable:'文字编码无法可靠读取，请检查原文件。',cancelled:'已停止收录，文件仍保存在本机。',timeout:'读取超时，可以重新收录。',unavailable:'本地读取暂不可用，请重试。',busy:'其他文件正在读取，请稍后重试。',source_changed:'本地文件已变化，请重新添加以保存新的版本。',missing:'本地文件不存在或不可读取。',parse_failed:'未能读取正文，请检查文件后重试。',partial_existing:'已有部分内容，未覆盖原有记录。'};
 return messages[code||'']||'文件保存在本机，正文尚未收录。';
}
