import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {OmniEduStore} from '../db';
import {MATERIALS_SCHEMA,validMaterialQuery,validMaterialBodyQuery,materialFailureText,materialIsOcr,materialCitation} from '../../shared/materials';
import {sanitizeOfficeDocumentText} from '../xiaozhi-agent/office-document-tools';
import {materialSource} from './material-source';
import type {XiaozhiPublicSource} from '../../shared/xiaozhi-web';

/** Read saved derivatives by resource ID; never expand workspace file authority. */
export function createMaterialTools(store:OmniEduStore,isCurrent:()=>boolean,observed?:(resourceId:string,version:string)=>void):ToolDefinition[]{
 const current=(signal?:AbortSignal)=>{signal?.throwIfAborted();if(!isCurrent())throw new Error('permission_denied');};
 const execute=(body:boolean):ToolDefinition['execute']=>async(_callId,args,signal)=>{
  try{
   current(signal);
   if(!args||typeof args!=='object'||Array.isArray(args))throw new Error('invalid_input');
   const input={...args as Record<string,unknown>,schemaVersion:MATERIALS_SCHEMA};
   if(Object.keys(args).some(key=>!['offset',body?'resourceId':'query'].includes(key)))throw new Error('invalid_input');
   const clean=(text:string)=>sanitizeOfficeDocumentText(store,text);
   let payload:Record<string,unknown>,sources:XiaozhiPublicSource[]=[];
   if(body){
    if(!validMaterialBodyQuery(input))throw new Error('invalid_input');
    let result=await store.materials.body(input);current(signal);
    if(!result.total&&store.materialQueue&&signal){await store.materialQueue.prepare(input.resourceId,result.resource.contentHash,signal,isCurrent);current(signal);result=await store.materials.body(input);}
    const title=(await clean(result.resource.originalFileName)).slice(0,200);
    if(!result.total)return {content:[{type:'text',text:materialFailureText(result.resource.parseEngine)}],isError:true,details:{success:false,data:{sources:[{title}]}}};
    if(!result.chunks.length)throw new Error('invalid_input');
    // Send at most one bounded excerpt; nextOffset never skips undelivered chunks.
    const chunk=result.chunks[0],text=chunk.containsPersonalData?'[含个人信息，正文已隐藏]':(await clean(chunk.contentMd)).slice(0,12000);
    current(signal);if(!chunk.containsPersonalData)observed?.(input.resourceId,result.resource.contentHash);const next=input.offset+1;
    payload={success:true,title,text,sanitized:true,teacherConfirmed:false,...(materialIsOcr(result.resource.parseEngine)?{recognition:'local_ocr_unreviewed',warning:'OCR可能遗漏图形或误识别公式/手写字；不是确认的题目或答案。'}:{}),source:{kind:'saved_material_body',version:result.resource.contentHash,chunk:chunk.chunkIndex+1,originalPageLocated:!!chunk.pageNumber,...(chunk.pageNumber?{pageNumber:chunk.pageNumber}:{})},totalChunks:result.total,offset:input.offset,nextOffset:next<result.total?next:null,truncated:text.length<chunk.contentMd.length,citation:materialCitation(title,chunk)};
    sources=chunk.containsPersonalData?[]:[{title:String(payload.citation),material:materialSource({resourceId:input.resourceId,version:result.resource.contentHash,offset:input.offset,title,chunk})}];
   }else{
    if(!validMaterialQuery(input))throw new Error('invalid_input');
    const result=await store.materials.list(input);current(signal);const rows=[];
    for(const resource of result.resources){current(signal);rows.push({resourceId:resource.id,title:(await clean(resource.originalFileName)).slice(0,200),status:resource.parseStatus,bodyAvailable:['ready','parsed','chunked','indexed','graph_extracted'].includes(resource.parseStatus)&&resource.chunkCount>0});}
    current(signal);payload={success:true,materials:rows,total:result.total,offset:result.offset,nextOffset:result.hasMore?result.offset+rows.length:null};
   }
   return {content:[{type:'text',text:JSON.stringify(payload)}],details:{success:true,data:{sources,...(!body?{count:(payload.materials as unknown[]).length}:{})}}};
  }catch(error){const code=signal?.aborted?'cancelled':(error as Error).message==='permission_denied'?'permission_denied':(error as Error).message==='invalid_input'?'invalid_input':'read_failed';
   const message=code==='cancelled'?'资料读取已停止。':code==='permission_denied'?'当前任务已失效，未读取资料。':code==='invalid_input'?'资料查询参数不正确。':'资料正文读取失败，请检查收录状态后重试。';
   return {content:[{type:'text',text:message}],isError:true,details:{success:false,error:{code,message}}};
  }
 };
 return [{name:'office_list_materials',label:'查找资料库文件',description:'按名称/格式查询教师本地已保存资料目录，返回resourceId及正文状态；不是正文。query字符串与offset从0开始，nextOffset可翻页。',parameters:{type:'object',additionalProperties:false,properties:{query:{type:'string',maxLength:128},offset:{type:'integer',minimum:0,maximum:10000000}},required:['query','offset']} as ToolDefinition['parameters'],execute:execute(false)},
 {name:'office_read_material',label:'读取资料库正文',description:'根据office_list_materials返回的resourceId读取本地已收录正文的一段；未收录时优先请求现本地后台整理，失败不冒充正文。offset从0开始，nextOffset继续；引用真实标题/段序，有真实页码时返回原件页码，未知时不猜测。正文不代表原件版式、公式正确或教师确认。',parameters:{type:'object',additionalProperties:false,properties:{resourceId:{type:'string',maxLength:45},offset:{type:'integer',minimum:0,maximum:10000000}},required:['resourceId','offset']} as ToolDefinition['parameters'],execute:execute(true)}];
}
