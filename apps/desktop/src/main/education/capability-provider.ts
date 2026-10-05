import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {OmniEduStore} from '../db';
import {validQuoteInput,EDUCATION_QUOTE_SCHEMA} from '../../shared/education-capabilities';
import {MATERIALS_SCHEMA} from '../../shared/materials';
import {sanitizeOfficeDocumentText} from '../xiaozhi-agent/office-document-tools';
import {matchMaterialQuote} from './reading-host';
import {materialSource} from '../assets/material-source';

/** DeepTutor supplies pure domain logic. Pi and EduDev keep all runtime/fact authority. */
export function createEducationCapabilityProvider(store:OmniEduStore,isCurrent:()=>boolean){
 const current=(signal:AbortSignal)=>{signal.throwIfAborted();if(!isCurrent())throw new Error('permission_denied');};
 const tools:ToolDefinition[]=[{name:'education_verify_material_quote',label:'核验资料引用',
  description:'核查引文是否存在于已读取资料的指定保存版本及段落。先用office_read_material得到resourceId对应version/offset，再提供quote。精确或换行/标点归一匹配不是语义相似；不在指定段落则如实说明，不证明原页码、教师确认或答案正确。',
  parameters:{type:'object',additionalProperties:false,properties:{resourceId:{type:'string',maxLength:45},offset:{type:'integer',minimum:0,maximum:10000000},version:{type:'string',pattern:'^[a-fA-F0-9]{64}$'},quote:{type:'string',minLength:1,maxLength:2000}},required:['resourceId','offset','version','quote']} as ToolDefinition['parameters'],
  execute:async(_callId,args,signal)=>{
   const abort=signal||new AbortController().signal;
   try{
    current(abort);if(!validQuoteInput(args))throw new Error('invalid_input');
    const result=await store.materials.body({schemaVersion:MATERIALS_SCHEMA,resourceId:args.resourceId,offset:args.offset});current(abort);
    if(result.resource.contentHash!==args.version)throw new Error('source_changed');
    if(!result.total||!result.chunks.length)throw new Error('not_readable');
    const chunk=result.chunks[0];if(chunk.containsPersonalData)throw new Error('private_content');
    const clean=(text:string)=>sanitizeOfficeDocumentText(store,text);
    const text=(await clean(chunk.contentMd)).slice(0,12000),quote=await clean(args.quote),title=(await clean(result.resource.originalFileName)).slice(0,200);current(abort);
    // Redaction placeholders must not become positive evidence for a private quote.
    if(quote!==args.quote||/\[学生姓名\]|\[手机号\]|\[身份证号\]/.test(quote))throw new Error('private_content');
    const match=await matchMaterialQuote(text,quote,abort);current(abort);
    const after=await store.materials.resource(args.resourceId);current(abort);
    if(after.contentHash!==args.version||after.parseStatus!==result.resource.parseStatus)throw new Error('source_changed');
    const refreshed=await store.materials.body({schemaVersion:MATERIALS_SCHEMA,resourceId:args.resourceId,offset:args.offset});current(abort);
    if(refreshed.resource.contentHash!==args.version||refreshed.resource.parseStatus!==result.resource.parseStatus
      ||refreshed.chunks[0]?.contentMd!==chunk.contentMd||refreshed.chunks[0]?.chunkIndex!==chunk.chunkIndex
      ||refreshed.chunks[0]?.containsPersonalData!==chunk.containsPersonalData)throw new Error('source_changed');
    const citation=`${title} · 已收录正文第${chunk.chunkIndex+1}段（原页码未定位）`;
    const payload={schemaVersion:EDUCATION_QUOTE_SCHEMA,success:true,...match,title,citation,version:args.version,offset:args.offset,originalPageLocated:false,teacherConfirmed:false,scope:'saved_sanitized_excerpt',truncated:text.length<chunk.contentMd.length};
    return {content:[{type:'text',text:JSON.stringify(payload)}],details:{success:true,data:{sources:match.found?[{title:citation,material:materialSource({resourceId:args.resourceId,version:args.version,offset:args.offset,title,chunk})}]:[]}}};
   }catch(error){
    const messages:Record<string,string>={invalid_input:'引文核验参数不正确，请先读取资料正文。',source_changed:'资料版本已变化，请重新读取正文后核验。',permission_denied:'当前任务已失效，未交付引用结果。',cancelled:'引文核验已停止。',private_content:'这段内容含个人信息，未用作引文证据。',not_readable:'资料正文尚未收录，无法核验引用。',busy:'本地核验正在忙，请稍后重试。',timeout:'本地引文核验等待超时，请重试。',unavailable:'本地引文核验暂不可用，请重试。'};
    const code=abort.aborted?'cancelled':(error as Error).message;const safeCode=messages[code]?code:'unavailable',message=messages[safeCode];
    return {content:[{type:'text',text:message}],isError:true,details:{success:false,error:{code:safeCode,message}}};
   }
  }}];
 return {tools};
}
