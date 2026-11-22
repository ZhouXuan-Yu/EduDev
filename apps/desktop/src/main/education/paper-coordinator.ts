import {paperFulfillment} from '../../shared/paper-fulfillment';
import {createHash} from 'node:crypto';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {OmniEduStore} from '../db';
import {createStudentContextSanitizer} from '../students/context-sanitizer';
import {admitPaperProposal,type PaperProposalBinding} from './paper-admission';
import {paperAgentReadProperties,paperAgentResultJson,parsePaperAgentTarget} from './paper-agent-read';
import {PAPER_SCHEMA,PAPER_GENERATED_SCHEMA,PAPER_TOOLS,PAPER_ERRORS,validPaperCreate,validPaperReview,validPaperCancel,validPaperBlueprint,validPaperGenerationQuery,type PaperCreateInput,type PaperReviewInput,type PaperCancelInput,type PaperDecision,type PaperSummary,type PaperView,type PaperResult,type PaperError,type PaperGenerationContext,type PaperGenerationQuery} from '../../shared/paper-blueprint';
type Options={store:OmniEduStore;isCurrent:(sessionId:string,runId:string)=>boolean;canWrite:(sessionId:string,runId:string)=>boolean;emit:(sessionId:string,runId:string,value:PaperSummary)=>void;afterWrite?:()=>Promise<void>;taskRuns?:(sessionId:string,runId:string)=>Promise<readonly string[]>};
const failure=(e:unknown):PaperError=>Object.prototype.hasOwnProperty.call(PAPER_ERRORS,(e as Error)?.message)?(e as Error).message as PaperError:'unavailable';
const requestId=(session:string,run:string,call:string)=>{const h=createHash('sha256').update(JSON.stringify([session,run,call])).digest('hex');return`${h.slice(0,8)}-${h.slice(8,12)}-${h.slice(12,16)}-${h.slice(16,20)}-${h.slice(20,32)}`;};
export function createPaperCoordinator(options:Options){
 const jobs=new Map<string,{sessionId:string;runId:string;cancelled:boolean;input:string;promise:Promise<PaperResult<PaperView>>}>(),waits=new Map<string,{runId:string;finish:()=>void}>();let closing=false;
 const key=(input:Pick<PaperCancelInput,'sessionId'|'requestId'>)=>input.sessionId+':'+input.requestId;
 const publish=async(sessionId:string,id:string)=>{const row=(await options.store.papers.list(sessionId)).find(r=>r.id===id);if(!row)throw new Error('permission_denied');options.emit(sessionId,row.runId,row);return row;};
 // Keep host-issued identifiers outside redaction. Only validated IDs and digests
 // are attached here. All teacher-originated text goes through the sanitizer.
 const receipt=async(sessionId:string,value:Record<string,unknown>,isError=false,lease?:()=>boolean,reference?:{paperId:string;digest:string;supersededBy?:string})=>{
  const clean=await createStudentContextSanitizer(options.store),text=await paperAgentResultJson({...value,...reference},clean);
  if(lease&&!lease())throw new Error('cancelled');
  return{content:[{type:'text' as const,text}],details:{success:!isError},isError};
 };
 const create=async(input:PaperCreateInput,runId='',callId='',lease:()=>boolean=()=>true):Promise<PaperResult<PaperView>>=>{
  if(!validPaperCreate(input))return{ok:false,error:'invalid_input'};const id=key(input),existing=jobs.get(id);if(existing)return existing.runId===runId&&existing.input===JSON.stringify(input)?existing.promise:{ok:false,error:'conflict'};
  const job={sessionId:input.sessionId,runId,cancelled:false,input:JSON.stringify(input),promise:Promise.resolve({ok:false,error:'unavailable'} as PaperResult<PaperView>)};
  job.promise=(async()=>{try{const current=()=>!closing&&!job.cancelled&&lease()&&options.canWrite(input.sessionId,runId);const value=await options.store.papers.create(input,runId,callId,current,options.afterWrite);await publish(input.sessionId,value.id);if(input.replace){await publish(input.sessionId,input.replace.id);waits.get(input.replace.id)?.finish();}return{ok:true as const,value};}catch(e){return{ok:false as const,error:failure(e)};}finally{jobs.delete(id);}})();jobs.set(id,job);return job.promise;
 };
 return{
  create,
  waiting:(sessionId:string,runId:string)=>!closing&&Array.from(waits.values()).some(w=>w.runId===runId)&&options.isCurrent(sessionId,runId)&&options.canWrite(sessionId,runId),
  async changed(sessionId:string,ids:string[]){for(const id of ids){try{await publish(sessionId,id);}finally{waits.get(id)?.finish();}}},
  admitProposal:(binding:PaperProposalBinding,raw:unknown,signal?:AbortSignal)=>admitPaperProposal({sql:options.store.xiaozhiState.sql,current:()=>!closing&&options.isCurrent(binding.sessionId,binding.runId)&&options.canWrite(binding.sessionId,binding.runId)},binding,raw,signal),
  async generationContexts(input:PaperGenerationQuery):Promise<PaperResult<PaperGenerationContext[]>>{if(!validPaperGenerationQuery(input))return{ok:false,error:'invalid_input'};try{return{ok:true,value:await options.store.papers.generationContexts(input)};}catch(e){return{ok:false,error:failure(e)};}},
  async list():Promise<PaperResult<PaperSummary[]>>{try{return{ok:true,value:await options.store.papers.list()};}catch(e){return{ok:false,error:failure(e)};}},
  async review(input:PaperReviewInput):Promise<PaperResult<PaperView>>{if(!validPaperReview(input))return{ok:false,error:'invalid_input'};try{return{ok:true,value:await options.store.papers.review(input.sessionId,input.id)};}catch(e){return{ok:false,error:failure(e)};}},
  async decide(input:PaperDecision,lease:()=>boolean=()=>true):Promise<PaperResult<PaperView>>{
   if(!validPaperReview(input,true))return{ok:false,error:'invalid_input'};try{const row=(await options.store.papers.list(input.sessionId)).find(r=>r.id===input.id);if(!row)throw new Error('permission_denied');const value=await options.store.papers.decide(input,()=>!closing&&lease()&&options.canWrite(input.sessionId,row.runId),options.afterWrite);await publish(input.sessionId,input.id);waits.get(input.id)?.finish();return{ok:true,value};}catch(e){return{ok:false,error:failure(e)};}
  },
  async cancelInput(input:PaperCancelInput):Promise<PaperResult<null>>{if(!validPaperCancel(input))return{ok:false,error:'invalid_input'};try{await options.store.papers.list(input.sessionId);const job=jobs.get(key(input));if(job)job.cancelled=true;return{ok:true,value:null};}catch(e){return{ok:false,error:failure(e)};}},
  cancel(runId:string){for(const job of jobs.values())if(job.runId===runId)job.cancelled=true;for(const wait of waits.values())if(wait.runId===runId)wait.finish();},
  close(){closing=true;for(const job of jobs.values())job.cancelled=true;for(const wait of waits.values())wait.finish();},
  tools(sessionId:string,runId:string):ToolDefinition[]{return[
   {name:PAPER_TOOLS[0],label:'按蓝图组卷并请教师核对',description:'从本机题库和当前任务教师已确认的生成题按蓝图确定性组卷。mode可source_only纯题库、hybrid混合、ai_original原创；hybrid每个section须generatedCount=生成题数（0到count），另外两模式禁止此字段。原创只用当前任务已确认的AI原创，混合可用当前任务已确认的原创/变式，自动核验审批来源和当前版本；没有本次已确认生成题就如实缺额。title/subject/grade/durationMinutes/totalPoints/mode/sections必填；section包含id/label/questionType/count/points，可选difficulty/knowledgePoint；总分须精确相符，最多100题。无额外模型生成或偷补缺题。工具等待教师确认或拒绝；只保存已核验来源及当前题版本的整卷快照，不改学生事实，不导出文件，不证明答案正确。教师确认后调用education_read_paper复读。拒绝或取消不自动重放。',
    parameters:{type:'object',additionalProperties:false,required:['title','subject','grade','durationMinutes','totalPoints','mode','sections'],properties:{title:{type:'string',minLength:1,maxLength:160},subject:{type:'string',minLength:1,maxLength:128},grade:{type:'string',minLength:1,maxLength:128},durationMinutes:{type:'integer',minimum:1,maximum:1440},totalPoints:{type:'integer',minimum:1,maximum:10000},mode:{type:'string',enum:['source_only','hybrid','ai_original']},sections:{type:'array',minItems:1,maxItems:20,items:{type:'object',additionalProperties:false,required:['id','label','questionType','count','points'],properties:{id:{type:'string',pattern:'^[a-zA-Z0-9_-]{1,40}$'},label:{type:'string',minLength:1,maxLength:80},questionType:{type:'string',minLength:1,maxLength:128},count:{type:'integer',minimum:1,maximum:100},points:{type:'integer',minimum:1,maximum:1000},generatedCount:{type:'integer',minimum:0,maximum:100},difficulty:{type:'string',enum:['easy','medium','hard']},knowledgePoint:{type:'string',minLength:1,maxLength:128}}}}}},
    async execute(callId,raw,signal){const abort=signal||new AbortController().signal,current=()=>!abort.aborted&&options.isCurrent(sessionId,runId);try{
     if(!validPaperBlueprint(raw))throw new Error('invalid_input');abort.throwIfAborted();if(!current())throw new Error('cancelled');
     const input:PaperCreateInput={schemaVersion:raw.mode==='source_only'?PAPER_SCHEMA:PAPER_GENERATED_SCHEMA,sessionId,requestId:requestId(sessionId,runId,callId),blueprint:raw,...(raw.mode!=='source_only'?{generationScope:'approved_session' as const}:{})};
     const result=await create(input,runId,callId,current);if(!result.ok)throw new Error(result.error);const pending=result.value;
     if(!pending.complete)return receipt(sessionId,{success:false,code:'shortage',shortages:pending.selection.shortages,count:pending.count,fulfillment:paperFulfillment(pending.blueprint,pending.selection),message:'当前来源配额不足，未确认正式试卷；请调整蓝图或先补齐并审核指定题组，不得静默更换来源配额。'},true,current);
     if(pending.state==='pending')await new Promise<void>(resolve=>{let done=false;const finish=()=>{if(done)return;done=true;waits.delete(pending.id);abort.removeEventListener('abort',finish);resolve();};waits.set(pending.id,{runId,finish});abort.addEventListener('abort',finish,{once:true});if(!current())finish();else void publish(sessionId,pending.id).catch(finish);});
     abort.throwIfAborted();if(!current())throw new Error('cancelled');
     const original=await publish(sessionId,pending.id);
     const read=await options.store.papers.readForAgent(sessionId,runId,[],{paperId:pending.id});
     const paper=read.kind==='found'?read.paper:undefined;
     if(!paper&&original.state==='confirmed')throw Error('unavailable');
     return receipt(sessionId,{success:!!paper,state:paper?.state||original.state,count:paper?.count??original.count,totalPoints:paper?.totalPoints??original.totalPoints,
      fulfillment:paperFulfillment(paper?.blueprint||pending.blueprint,paper?.selection||pending.selection),
      ...(paper&&paper.id!==pending.id?{modifiedFrom:pending.id}:{}),answerVerified:false,
      message:paper?'教师已确认保存整卷。请用回执的 paperId 读取对应试卷，再报告结果。':'教师未确认正式试卷，请勿自动重提。'},
      !paper,current,paper?{paperId:paper.id,digest:paper.digest!}:undefined);
    }catch(e){if(abort.aborted)throw new Error('cancelled');const code=failure(e);return receipt(sessionId,{success:false,code,message:PAPER_ERRORS[code]},true);}}},
   {name:PAPER_TOOLS[1],label:'读取已确认试卷',
    description:'读取本会话的已确认试卷。传组卷回执 paperId 跟随该卷的编辑后继；同时传 paperId 和摘要 digest 精确读取指定历史快照。也可仅传教师明确给出的完整 title。无参数时优先当前任务，同会话有多份无法唯一定位时请教师指定。结果是保存的蓝图和选题摘要，来源变化会标记。',
    parameters:{type:'object',additionalProperties:false,properties:paperAgentReadProperties},
    async execute(_callId,raw,signal){
     const current=()=>!signal?.aborted&&options.isCurrent(sessionId,runId);
     try{
      const target=parsePaperAgentTarget(raw);if(!current())throw Error('cancelled');
      const taskRuns=target?[]:await options.taskRuns?.(sessionId,runId)??[];
      if(!current())throw Error('cancelled');
      const result=await options.store.papers.readForAgent(sessionId,runId,taskRuns,target);
      if(!current())throw Error('cancelled');
      if(result.kind==='ambiguous')return receipt(sessionId,{success:false,code:'ambiguous_paper',found:false,
       choices:result.choices,message:'找到多份已确认试卷。请按教师指定的卷名或已知 paperId 再读取。'},true,current);
      if(result.kind==='digest_mismatch')return receipt(sessionId,{success:false,code:'paper_digest_mismatch',found:false,
       message:'摘要与这份试卷的快照不一致。请核对所选试卷版本。'},true,current);
      if(result.kind!=='found')return receipt(sessionId,{success:true,found:false,state:result.kind,
       message:result.kind==='missing'?'没有找到所请求的正式试卷。':'所请求的卷尚未确认。'},false,current);
      const view=result.paper;
      return receipt(sessionId,{success:true,found:true,title:view.title,blueprint:view.blueprint,count:view.count,totalPoints:view.totalPoints,
       fulfillment:paperFulfillment(view.blueprint,view.selection),sourceCurrent:view.sourceCurrent,answerVerified:false,
       message:view.sourceCurrent?'这是已确认的整卷快照。参考答案仍需核对。':'这是已确认的历史快照。题目、原件或编辑范围已变化，请核对来源。'},
       false,current,{paperId:view.id,digest:view.digest!,...(view.supersededBy?{supersededBy:view.supersededBy}:{})});
     }catch(e){
      if(!current())throw Error('cancelled');
      const code=failure(e);return receipt(sessionId,{success:false,code,message:PAPER_ERRORS[code]},true,current);
     }
    }}
  ];}
 };
}
