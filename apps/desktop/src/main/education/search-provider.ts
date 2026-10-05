import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {OmniEduStore} from '../db';
import {EDUCATION_SEARCH_SCHEMA,validMaterialSearchInput} from '../../shared/education-capabilities';
import {materialSource} from '../assets/material-source';
import {createOfficeDocumentSanitizer} from '../xiaozhi-agent/office-document-tools';
import {searchMaterialUnits} from './reading-host';

/** All matching/ranking is the pinned DeepTutor search; host owns scope and privacy. */
export function createEducationSearchTools(store:OmniEduStore,isCurrent:()=>boolean):ToolDefinition[]{
 return [{name:'education_search_materials',label:'查找资料正文',description:'检索资料库全部已收录的非私密正文，不受目录/正文分页限制。query为必要短关键词；可用实际resourceId限定一份资料。返回exact/normalised/terms、最多12条脱敏片段及真实version/offset。terms仅为线索，先office_read_material继续读再核验引用。覆盖计数不含未收录或私密正文；truncated表示还有更多命中，超限搜索失败不表示无结果。',
  parameters:{type:'object',additionalProperties:false,properties:{query:{type:'string',minLength:1,maxLength:128},resourceId:{type:'string',maxLength:45}},required:['query']} as ToolDefinition['parameters'],
  execute:async(_callId,args,signal)=>{
   const abort=signal||new AbortController().signal,current=()=>{abort.throwIfAborted();if(!isCurrent())throw new Error('permission_denied');};
   try{
    current();if(!validMaterialSearchInput(args))throw new Error('invalid_input');
    const clean=await createOfficeDocumentSanitizer(store);current();
    const query=await clean(args.query);current();
    if(query!==args.query||/\[学生姓名\]|\[手机号\]|\[身份证号\]/.test(query))throw new Error('private_content');
    const before=await store.materials.readingSnapshot(args.resourceId);current();
    const units=before.units.filter(unit=>!unit.chunk.containsPersonalData),texts:string[]=[];
    for(const unit of units){current();texts.push(await clean(unit.chunk.contentMd));}
    current();const result=await searchMaterialUnits(texts,query,abort);current();
    const hits=[];
    for(const hit of result.hits){const unit=units[hit.locator],title=(await clean(unit.title)).slice(0,200);current();
     hits.push({title,snippet:hit.snippet,match:hit.match,resourceId:unit.resourceId,version:unit.version,offset:unit.offset,source:materialSource(unit),citation:`${title} · 已收录正文第${unit.chunk.chunkIndex+1}段（原页码未定位）`});
    }
    const after=await store.materials.readingSnapshot(args.resourceId);current();if(after.fingerprint!==before.fingerprint)throw new Error('source_changed');
    const payload={schemaVersion:EDUCATION_SEARCH_SCHEMA,success:true,mode:result.mode,hits,truncated:result.truncated,
     coverage:{scope:args.resourceId?'material':'library',complete:true,resources:new Set(before.units.map(u=>u.resourceId)).size,totalChunks:before.units.length,searchedChunks:units.length,excludedPrivateChunks:before.units.length-units.length},originalPageLocated:false,teacherConfirmed:false};
    return {content:[{type:'text',text:JSON.stringify(payload)}],details:{success:true,data:{sources:hits.map(hit=>({title:hit.citation,material:hit.source}))}}};
   }catch(error){
    const messages:Record<string,string>={invalid_input:'正文查找条件不正确，请换个关键词。',source_changed:'资料内容已变化，请重新查找。',permission_denied:'当前任务已失效，未交付查找结果。',cancelled:'正文查找已停止。',private_content:'含个人信息的查找条件未发送，请改用教学关键词。',too_large:'本次未完成搜索：资料正文过多，请先选择一份资料再查找。',material_not_found:'这份资料不存在，请重新选择。',busy:'本地查找正在忙，请稍后重试。',timeout:'本地正文查找超时，请重试。',unavailable:'本地正文查找暂不可用，请重试。'};
    const code=abort.aborted?'cancelled':(error as Error).message,safe=messages[code]?code:'unavailable',message=messages[safe];
    return {content:[{type:'text',text:message}],isError:true,details:{success:false,error:{code:safe,message}}};
   }
  }}];
}
