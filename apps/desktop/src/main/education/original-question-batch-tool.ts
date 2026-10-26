import {createHash} from 'node:crypto';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {ORIGINAL_BATCH_TOOL,ORIGINAL_BATCH_MAX,originalBatchCandidates,originalBatchRequest,type OriginalBatchBinding} from '../../shared/original-question-batch';
import {QUESTION_REVIEW_ERRORS,type QuestionReviewSummary} from '../../shared/question-review';
import type {OriginalMultiQuestionRepository} from './original-multi-repository';

export const originalBatchDigest=(v:unknown)=>createHash('sha256').update(JSON.stringify(v)).digest('hex');
export const originalBatchItemCallId=(rootCallId:string,index:number)=>`original_batch_${originalBatchDigest(rootCallId)}_${index}`;
type Options={repo:OriginalMultiQuestionRepository;sessionId:string;runId:string;observed:Map<string,string>;single:ToolDefinition;current:()=>boolean;emit:(row:QuestionReviewSummary)=>void;wait:(row:QuestionReviewSummary,signal:AbortSignal)=>Promise<void>};
/** Deterministic staging of original candidates in the existing ledger, then one Pi wait. */
export function originalQuestionBatchTool(options:Options):ToolDefinition{
 const {repo,sessionId,runId,observed,single}=options;
 const singleSchema=single.parameters as unknown as {required:string[];properties:Record<string,unknown>};
 return {name:ORIGINAL_BATCH_TOOL,label:'整理整卷原题并请教师集中核对',description:'同一已实读资料有多道原题时优先使用，一批1–12题。整卷用action=stage连续暂存每批，不等教师；全部提出后action=review且仅传resourceId集中等待。缺省沿单批等待。stage成功仅表示暂存，不表示入库。先整理全部候选再等待教师逐题核对，不能将每个小问随意拆成独立原题；跨页用各题regions。沿单题规则：完整条件/图表/选项/小问候选可用transcription，未知留空，不猜图，不接收答案或解析，不标为已核对。每题单独确认/拒绝；部分失败保留已暂存题，停止/拒绝不自动重提。工具只保存候选；不声称自动识别全部原图或答案正确。',parameters:{type:'object',additionalProperties:false,required:['resourceId'],properties:{resourceId:{type:'string'},action:{type:'string',enum:['stage','review'],description:'整卷先逐批stage，全部提出后review且不传questions；省略沿单批等待。'},questions:{type:'array',minItems:1,maxItems:ORIGINAL_BATCH_MAX,items:{type:'object',additionalProperties:false,required:singleSchema.required.filter(k=>k!=='resourceId'),properties:Object.fromEntries(Object.entries(singleSchema.properties).filter(([k])=>k!=='resourceId'))}}}} as ToolDefinition['parameters'],execute:async(callId,raw,signal)=>{
  const abort=signal??new AbortController().signal,current=()=>!abort.aborted&&options.current();const staged:QuestionReviewSummary[]=[];let requested=0;
  try{
   abort.throwIfAborted();if(!current())throw new Error('cancelled');
   // Validate descriptors before reading resourceId; validation never grants an unobserved version.
   const request=originalBatchRequest(raw);if(!callId||callId.length>128)throw new Error('invalid_input');
   if(request.action==='review'){
    const rows=await repo.batchRows(sessionId,runId,request.resourceId);if(!rows.length)throw new Error('invalid_input');requested=rows.length;staged.push(...rows);
    await Promise.all(rows.filter(r=>r.state==='pending').map(row=>options.wait(row,abort)));
    abort.throwIfAborted();if(!current())throw new Error('cancelled');
    const final=await repo.batchRows(sessionId,runId,request.resourceId);if(final.length!==rows.length||final.some(r=>r.state==='pending'))throw new Error('conflict');
    const confirmed=final.filter(r=>r.state==='confirmed').length,rejected=final.length-confirmed;
    return{content:[{type:'text',text:JSON.stringify({success:true,total:final.length,confirmed,rejected,message:'本轮该资料已提出候选的教师审核已结束。只有确认题入库，不证明全部原卷已识别或答案正确。'})}],details:{success:true,total:final.length,confirmed,rejected}};
   }
   const version=observed.get(request.resourceId);if(!version)throw new Error('invalid_input');
   const candidates=originalBatchCandidates({resourceId:request.resourceId,questions:(raw as {questions:unknown}).questions},version);requested=candidates.questions.length;const digest=originalBatchDigest({...candidates,version});
   // Preflight every saved item so an altered replay cannot stage a new tail before conflict.
   await repo.assertBatch(sessionId,runId,callId,digest);
   for(const [index,item]of candidates.questions.entries()){
    abort.throwIfAborted();if(!current())throw new Error('cancelled');
    const batch:OriginalBatchBinding={rootCallId:callId,digest,index,total:candidates.questions.length};
    const row=await repo.propose(sessionId,runId,originalBatchItemCallId(callId,index),item.draft,candidates.resourceId,version,item.regions,abort,current,item.transcription,batch);staged.push(row);options.emit(row);
   }
   if(request.action==='stage'){
    const all=await repo.batchRows(sessionId,runId,candidates.resourceId);abort.throwIfAborted();if(!current())throw new Error('cancelled');
    return{content:[{type:'text',text:JSON.stringify({success:true,state:'staged',staged:staged.length,totalStaged:all.length,pending:all.filter(r=>r.state==='pending').length,batchId:staged[0].originalBatch!.id,message:'候选已暂存，尚未代表入库。继续stage剩余原题，不重复已有题；全部提出后以同resourceId和action=review集中等待教师。'})}],details:{success:true,state:'staged',staged:staged.length,totalStaged:all.length}};
   }
   await Promise.all(staged.filter(r=>r.state==='pending').map(row=>options.wait(row,abort)));
   abort.throwIfAborted();if(!current())throw new Error('cancelled');const rows=await repo.list(sessionId),final=staged.map(r=>rows.find(x=>x.id===r.id)!);if(final.some(r=>!r||r.state==='pending'))throw new Error('unavailable');
   const confirmed=final.filter(r=>r.state==='confirmed').length,rejected=final.length-confirmed;return{content:[{type:'text',text:JSON.stringify({success:true,total:final.length,confirmed,rejected,message:'教师逐题核对已结束，只有实际确认的原题已保存。答案可能未知，不证明数学正确。拒绝题不自动重提，不复述教师私有修改。'})}],details:{success:true,total:final.length,confirmed,rejected}};
  }catch(error){
   if(abort.aborted||!options.current())throw new Error('cancelled');const name=(error as Error)?.message,code=Object.prototype.hasOwnProperty.call(QUESTION_REVIEW_ERRORS,name)?name as keyof typeof QUESTION_REVIEW_ERRORS:'unavailable';
   return{content:[{type:'text',text:JSON.stringify({success:false,code,staged:staged.length,total:requested,message:`${QUESTION_REVIEW_ERRORS[code]} 已暂存${staged.length}道候选，可继续在本地审核；未暂存部分没有保存，不要自动重提。`})}],details:{success:false,error:{code},staged:staged.length,total:requested},isError:true};
  }
 }};
}
