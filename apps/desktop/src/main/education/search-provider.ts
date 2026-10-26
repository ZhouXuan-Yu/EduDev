import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {OmniEduStore} from '../db';
import {EDUCATION_SEARCH_SCHEMA,validMaterialSearchInput} from '../../shared/education-capabilities';
import {materialSource} from '../assets/material-source';
import {materialCitation} from '../../shared/materials';
import {createOfficeDocumentSanitizer} from '../xiaozhi-agent/office-document-tools';
import {searchMaterialUnits} from './reading-host';

/** Local hybrid retrieval; pinned DeepTutor matching remains the lexical fallback. */
export function createEducationSearchTools(store:OmniEduStore,isCurrent:()=>boolean):ToolDefinition[]{
 return [{name:'education_search_materials',label:'查找资料正文',description:'检索资料库已收录的非私密正文，优先使用本地全文索引取有限候选后核验，不受资料目录分页限制。query为必要短关键词；可用实际resourceId限定一份资料。返回exact/normalised/terms、最多12条脱敏片段及真实version/offset。terms仅为线索，先office_read_material继续读再核验引用。coverage.complete=false、pendingChunks或truncated时，结果不完整，不能说全库无结果或库存不足。覆盖计数不含未解析或私密正文；检索不是数学正确性或教师确认。',
  parameters:{type:'object',additionalProperties:false,properties:{query:{type:'string',minLength:1,maxLength:128},resourceId:{type:'string',maxLength:45}},required:['query']} as ToolDefinition['parameters'],
  execute:async(_callId,args,signal)=>{
   const abort=signal||new AbortController().signal,current=()=>{abort.throwIfAborted();if(!isCurrent())throw new Error('permission_denied');};
   try{
    current();if(!validMaterialSearchInput(args))throw new Error('invalid_input');
    const clean=await createOfficeDocumentSanitizer(store);current();
    const query=await clean(args.query);current();
    if(query!==args.query||/\[学生姓名\]|\[手机号\]|\[身份证号\]/.test(query))throw new Error('private_content');
    const hybrid=store.retrieval?await store.retrieval.materials(query,args.resourceId,200,0,12):undefined;
    const indexed=hybrid||(store.materialSearch?.available?await store.materialSearch.candidates(query,args.resourceId):undefined);
    const before=indexed?{units:indexed.units,fingerprint:''}:await store.materials.readingSnapshot(args.resourceId);current();
    const units=before.units.filter(unit=>!unit.chunk.containsPersonalData),texts:string[]=[];
    for(const unit of units){current();texts.push(await clean(unit.chunk.contentMd));}
    current();const result=hybrid?.semantic.available?{hits:units.map((unit,locator)=>{const hit=hybrid.hits[locator],from=texts[locator]===unit.chunk.contentMd&&hit.method!=='keyword'?Math.max(0,hit.start-80):0;return{locator,snippet:texts[locator].slice(from,from+500),match:hit.method};}),mode:'hybrid',truncated:hybrid.hasMore||hybrid.semantic.exhausted}:texts.length?await searchMaterialUnits(texts,query,abort):{hits:[],mode:null,truncated:false};current();
    const hits=[];
    for(const hit of result.hits){const unit=units[hit.locator],title=(await clean(unit.title)).slice(0,200);current();
     hits.push({title,snippet:hit.snippet,match:hit.match,resourceId:unit.resourceId,version:unit.version,offset:unit.offset,source:materialSource(unit),originalPageLocated:!!unit.chunk.pageNumber,...(unit.chunk.pageNumber?{pageNumber:unit.chunk.pageNumber}:{}),citation:materialCitation(title,unit.chunk)});
    }
    if(indexed){for(const hit of hits){await store.materials.source(hit.source);current();}}
    else {const after=await store.materials.readingSnapshot(args.resourceId);current();if(after.fingerprint!==before.fingerprint)throw new Error('source_changed');}
    const payload={schemaVersion:EDUCATION_SEARCH_SCHEMA,success:true,mode:result.mode,hits,truncated:result.truncated||indexed?.hasMore===true,
     coverage:{scope:args.resourceId?'material':'library',complete:indexed?!indexed.hasMore&&indexed.index.pending===0&&indexed.coverage.unparsedResources===0&&(!hybrid||hybrid.semantic.complete&&!hybrid.semantic.exhausted):true,resources:indexed?.coverage.resources??new Set(before.units.map(u=>u.resourceId)).size,totalChunks:indexed?.coverage.totalChunks??before.units.length,searchedChunks:units.length,excludedPrivateChunks:indexed?.coverage.excludedPrivateChunks??before.units.length-units.length,...(indexed?{method:hybrid?.semantic.available?'local_bge_rrf_v1':'sqlite_ngram_fts_v1',pendingChunks:indexed.index.pending,unparsedResources:indexed.coverage.unparsedResources,candidateLimit:200}:{}),...(hybrid?{semantic:hybrid.semantic}:{})},originalPageLocated:hits.length>0&&hits.every(hit=>hit.originalPageLocated),teacherConfirmed:false};
    return {content:[{type:'text',text:JSON.stringify(payload)}],details:{success:true,data:{count:hits.length,sources:hits.map(hit=>({title:hit.citation,material:hit.source}))}}};
   }catch(error){
    const messages:Record<string,string>={invalid_input:'正文查找条件不正确，请换个关键词。',source_changed:'资料内容已变化，请重新查找。',permission_denied:'当前任务已失效，未交付查找结果。',cancelled:'正文查找已停止。',private_content:'含个人信息的查找条件未发送，请改用教学关键词。',too_large:'本次未完成搜索：资料正文过多，请先选择一份资料再查找。',material_not_found:'这份资料不存在，请重新选择。',busy:'本地查找正在忙，请稍后重试。',timeout:'本地正文查找超时，请重试。',unavailable:'本地正文查找暂不可用，请重试。'};
    const code=abort.aborted?'cancelled':(error as Error).message,safe=messages[code]?code:'unavailable',message=messages[safe];
    return {content:[{type:'text',text:message}],isError:true,details:{success:false,error:{code:safe,message}}};
   }
  }}];
}
