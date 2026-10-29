import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {OFFICE_ARTIFACT_SCHEMA,type OfficeArtifactDecision,type OfficeArtifactError,type OfficeArtifactReview,type OfficeArtifactReviewInput,type OfficeArtifactReviseInput,type OfficeArtifactResult,type OfficeArtifactSummary} from '../../shared/xiaozhi-office-artifacts';
import type {XiaozhiAgentEventPayload} from '../../shared/xiaozhi-agent';
import {createOfficeArtifactState,officeSummary} from './office-artifact-state';
import {createOfficeArtifactService} from './office-artifact-service';
type Wait=(action:()=>Promise<boolean>)=>Promise<boolean>;
const object=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
const session=(v:unknown):v is string=>typeof v==='string'&&/^aisession_[a-f0-9-]{36}$/i.test(v);
const id=(v:unknown):v is string=>typeof v==='string'&&/^xioffice_[a-f0-9-]{36}$/i.test(v);
const error=(raw:unknown):OfficeArtifactError=>{const value=raw instanceof Error?raw.message:'';return ['file_writes_disabled','invalid_input','permission_denied','conflict','busy'].includes(value)?value as OfficeArtifactError:'configuration';};
function input(value:unknown,keys:string[]):value is OfficeArtifactReviewInput{
 return object(value)&&Object.keys(value).every(key=>keys.includes(key))&&value.schemaVersion===OFFICE_ARTIFACT_SCHEMA&&session(value.sessionId)&&id(value.draftId);
}
/** The existing one-Pi-call teacher wait pattern; content never enters public events/results. */
export function createOfficeArtifactCoordinator(options:{state:ReturnType<typeof createOfficeArtifactState>;service:ReturnType<typeof createOfficeArtifactService>;
 isCurrent:(sessionId:string,runId:string)=>boolean;sanitize:(text:string)=>Promise<string>;emit:(sessionId:string,runId:string,event:XiaozhiAgentEventPayload)=>void;
 proposalError?:(sessionId:string,runId:string,raw:unknown)=>string|undefined|Promise<string|undefined>}){
 const waits=new Map<string,{sessionId:string;runId:string;finish:(approved:boolean)=>void}>();
 const publish=async(sessionId:string,draftId:string)=>{
  const row=await options.state.get(draftId);if(!row||row.sessionId!==sessionId)throw new Error('permission_denied');
  const summary=officeSummary(row);options.emit(sessionId,row.runId,{kind:'office_artifact',artifact:summary});return summary;
 };
 const currentWait=(value:OfficeArtifactReviewInput)=>{const waiting=waits.get(value.draftId);if(!waiting||waiting.sessionId!==value.sessionId||!options.isCurrent(waiting.sessionId,waiting.runId))throw new Error('permission_denied');return waiting;};
 async function cancel(runId:string){
  await options.state.invalidateRun(runId);
  for(const [draftId,waiting] of waits)if(waiting.runId===runId){try{await publish(waiting.sessionId,draftId);}finally{waiting.finish(false);}}
 }
 async function receipt(row:OfficeArtifactSummary){
  const saved=row.state==='saved';
  return {content:[{type:'text' as const,text:JSON.stringify({success:saved,file:await options.sanitize(row.path),format:row.format,outcome:row.state,
   ...(saved?{artifactId:row.artifactId}:{}),sourceCount:row.sourceCount,message:saved?'教师已确认，真实办公文件已保存并核验。最终正文为教师本地确认版本，未回传模型；只报告文件路径、格式和保存状态，不复述未重新实读的正文、标题或表格值。':row.state==='rejected'?'教师拒绝，本次没有写入。':row.state==='conflict'?'拟内容、来源或目标已变化，本次没有覆盖。':row.state==='uncertain'?'保存中断，效果尚未确认；需要教师只读核验，不可重新执行本次写入。':'本次未确认完成，请查看实际状态。'})}],details:{success:saved},isError:!saved};
 }
 async function runOffice(sessionId:string,runId:string,wait:Wait,callId:string,raw:unknown,signal?:AbortSignal){
     let proposal:OfficeArtifactSummary|undefined;
     try{
      const violation=await options.proposalError?.(sessionId,runId,raw);
      if(violation)return {content:[{type:'text' as const,text:violation}],details:{success:false},isError:true};
      proposal=await options.service.propose(sessionId,runId,callId,raw,signal);
      if(proposal.state!=='pending')return receipt(proposal);
      const pending=proposal;
      const approved=await wait(()=>new Promise<boolean>(resolve=>{
       let finished=false;
       const finish=(value:boolean)=>{if(finished)return;finished=true;waits.delete(pending.id);signal?.removeEventListener('abort',abort);resolve(value);};
       const abort=()=>{void cancel(runId).catch(()=>undefined).finally(()=>finish(false));};
       waits.set(pending.id,{sessionId,runId,finish});signal?.addEventListener('abort',abort,{once:true});
       if(signal?.aborted||!options.isCurrent(sessionId,runId))abort();else void publish(sessionId,pending.id).catch(()=>abort());
      }));
      signal?.throwIfAborted();
      if(approved){const saved=await options.service.apply(sessionId,pending.id,signal);await publish(sessionId,pending.id);return receipt(saved);}
      return receipt(await publish(sessionId,pending.id));
     }catch(rawError){
      await cancel(runId).catch(()=>undefined);if(proposal)await publish(sessionId,proposal.id).catch(()=>undefined);
      if(signal?.aborted||(rawError instanceof Error&&['cancelled','budget_exhausted'].includes(rawError.message)))throw new Error(rawError instanceof Error&&rawError.message==='budget_exhausted'?'budget_exhausted':'cancelled');
      const code=error(rawError);
      const message=code==='file_writes_disabled'?'小智自动文件生成已暂停，已有文件与记录仍可读取；恢复生成需取消启动停写设置并重启。':rawError instanceof Error&&rawError.message==='too_large'?'本页内容过密或草稿超过UTF8字节上限，尚未保存，也不会自动加页或截断。请减少投影文字/表格行数，把讲解移入speakerNotes后重新提出。':code==='conflict'?'拟内容、来源或目标已变化，本次没有覆盖。'
       :!proposal&&code==='invalid_input'?'文档结构、表格行列或来源格式不正确，尚未进入教师审阅，也没有生成文件。请按工具格式修正草稿。'
       :!proposal?'文档草稿未成功提交教师审阅，也没有生成文件。请检查当前授权、目标目录与拟内容，不可声称教师已拒绝。'
       :'本次办公文件未确认保存；请检查授权、拟内容与实际状态，不可宣称交付。';
      return {content:[{type:'text' as const,text:JSON.stringify({success:false,error:code,message})}],details:{success:false},isError:true};
     }

 }
 return {
  cancel,runOffice,service:options.service,proposalError:options.proposalError,
  async review(value:OfficeArtifactReviewInput):Promise<OfficeArtifactResult<OfficeArtifactReview>>{
   if(!input(value,['schemaVersion','sessionId','draftId']))return {ok:false,error:'invalid_input'};
   try{return {ok:true,value:await options.service.review(value.sessionId,value.draftId)};}catch(raw){return {ok:false,error:error(raw)};}
  },
  async revise(value:OfficeArtifactReviseInput):Promise<OfficeArtifactResult<OfficeArtifactSummary>>{
   if(!input(value,['schemaVersion','sessionId','draftId','revision','draft'])||!Number.isSafeInteger(value.revision)||value.revision<0)return {ok:false,error:'invalid_input'};
   try{const waiting=currentWait(value);await options.service.revise(value.sessionId,value.draftId,value.revision,value.draft);const row=await publish(value.sessionId,value.draftId);if(row.state!=='pending')waiting.finish(false);return {ok:true,value:row};}catch(raw){return {ok:false,error:error(raw)};}
  },
  async decide(value:OfficeArtifactDecision):Promise<OfficeArtifactResult<OfficeArtifactSummary>>{
   if(!input(value,['schemaVersion','sessionId','draftId','revision','action','imagesReviewed'])||!Number.isSafeInteger(value.revision)||value.revision<0||!['approve','reject','verify'].includes(value.action))return {ok:false,error:'invalid_input'};
   try{
    const waiting=value.action==='verify'?undefined:currentWait(value);await options.service.decide(value);const row=await publish(value.sessionId,value.draftId);
    waiting?.finish(row.state==='approved'&&options.isCurrent(waiting.sessionId,waiting.runId));return {ok:true,value:row};
   }catch(raw){return {ok:false,error:error(raw)};}
  },
  tools(sessionId:string,runId:string,wait:Wait):ToolDefinition[]{
   const text=(maxLength:number)=>({type:'string',minLength:1,maxLength});
   // Pi converts each anyOf branch in order. A type union preserves an already
   // matching number/string (including numeric text) through its native validator.
   const cell={type:['string','number'],maxLength:120};
   return [{name:'office_create_document',label:'生成办公文档',description:'在已授权工作目录提出真实DOCX/PDF/XLSX/PPTX拟产物。相对目标路径须使用对应扩展、父目录已存在且目标不存在。普通DOCX/PDF/XLSX或旧式PPT可用xiaozhi.office-draft.v1。制作指定页数或含讲解备注的PPT必须用xiaozhi.presentation-draft.v1：每个section恰为一页（含封面），pageId为唯一稳定小写标识，heading/paragraphs/有限表格为学生投影内容，speakerNotes非空数组，kind=script放教师讲解，kind=answer放检查题参考答案，text最多4000字。每页都须讲解备注，不把答案写进学生投影页。新schema仅用于pptx，不自动加封面/拆页，过密请精简投影并移入备注；不支持任意图片、公式对象或资源。sources仅列本次工具实读的文件路径和version（最多16）；无资料源用空数组，不猜版本。完整拟内容只本地教师审阅；教师可修改、拒绝或确认，确认后实际生成保存。拒绝/冲突/停止后不要重复本次写入。更新已有正式产物用parentArtifactId和新目标路径，保留旧版。',
    parameters:{type:'object',additionalProperties:false,required:['path','format','draft','sources'],properties:{path:text(500),format:{type:'string',enum:['docx','pdf','xlsx','pptx']},parentArtifactId:text(64),sources:{type:'array',maxItems:16,items:{type:'object',additionalProperties:false,required:['path','version'],properties:{path:text(500),version:{type:'string',pattern:'^[a-f0-9]{64}$'}}}},draft:{type:'object',additionalProperties:false,required:['schemaVersion','title','sections'],properties:{schemaVersion:{type:'string',enum:['xiaozhi.office-draft.v1','xiaozhi.presentation-draft.v1']},title:text(120),sections:{type:'array',minItems:1,maxItems:20,items:{type:'object',additionalProperties:false,required:['heading','paragraphs'],properties:{pageId:{type:'string',pattern:'^[a-z][a-z0-9_-]{0,63}$'},speakerNotes:{type:'array',minItems:1,maxItems:16,items:{type:'object',additionalProperties:false,required:['kind','text'],properties:{kind:{type:'string',enum:['script','answer']},text:text(4000)}}},heading:text(120),paragraphs:{type:'array',maxItems:20,items:text(1000)},table:{type:'object',additionalProperties:false,required:['columns','rows'],properties:{columns:{type:'array',minItems:1,maxItems:8,items:text(120)},rows:{type:'array',minItems:1,maxItems:200,items:{type:'array',minItems:1,maxItems:8,items:cell}}}}}}}}}}} as ToolDefinition['parameters'],
    execute:async(callId,raw,signal)=>{
     if(!raw||typeof raw!=='object'||!('draft' in raw)||!['xiaozhi.office-draft.v1','xiaozhi.presentation-draft.v1'].includes(String((raw as {draft?:{schemaVersion?:unknown}}).draft?.schemaVersion)))return {content:[{type:'text',text:'文档格式不正确，未提出保存。'}],details:{success:false},isError:true};
     return runOffice(sessionId,runId,wait,callId,raw,signal);
    }
   }];
  }
 };
}
