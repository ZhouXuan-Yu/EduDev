import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {CLASSROOM_EXPORT_TOOL,CLASSROOM_READ_TOOL,type ClassroomDocumentPurpose} from '../../shared/classroom-export';
import {compileClassroomOffice} from './classroom-office';
import type {createClassroomState} from './classroom-state';
import type {OfficeArtifactProposal} from '../../shared/xiaozhi-office-artifacts';
type Wait=(action:()=>Promise<boolean>)=>Promise<boolean>;
type RunOffice=(sessionId:string,runId:string,wait:Wait,callId:string,raw:OfficeArtifactProposal,signal?:AbortSignal)=>ReturnType<ToolDefinition['execute']>;
export function createClassroomExportTools(options:{sessionId:string;runId:string;state:ReturnType<typeof createClassroomState>;wait:Wait;runOffice:RunOffice;current:()=>boolean}):ToolDefinition[]{
 const current=(signal?:AbortSignal)=>{signal?.throwIfAborted();if(!options.current())throw Error('cancelled');};
 const failure=(error:unknown,signal?:AbortSignal)=>{
  if(signal?.aborted||(error as Error).message==='cancelled')throw error;
  const code=(error as Error).message;
  return {content:[{type:'text' as const,text:JSON.stringify({success:false,error:code,message:code==='conflict'?'课堂版本已变化、名称重复或未确认，请回互动课堂确认后重试。':code==='permission_denied'?'课堂不属于本会话或授权已失效。':'课堂读取或导出未完成，请检查当前版本和授权目录。'})}],details:{success:false},isError:true};
 };
 const id={type:'string',pattern:'^classroom_[a-f0-9-]{36}$'},version={type:'string',pattern:'^[a-f0-9]{64}$'};
 return [{
  name:CLASSROOM_READ_TOOL,label:'读取已确认课堂',
  description:'核对本会话当前已确认课堂。教师页面确认/修订后可能产生新id/version，历史待核对说明不是当前状态。优先按当前请求title/revision实读，只传这两项；已有精确id/version时只传这两项。不能混传，名称重复时失败不猜。不能用education_read_paper替代。仅返回来源摘要；导出工具读取完整本地课页，无需模型重抄。',
  parameters:{type:'object',additionalProperties:false,properties:{classroomId:id,version,title:{type:'string',minLength:1,maxLength:160},revision:{type:'integer',minimum:1}}} as ToolDefinition['parameters'],
  execute:async(_callId,raw,signal)=>{
   try{
    current(signal);const input=raw as {classroomId?:string;version?:string;title?:string;revision?:number};
    if(!input||Object.keys(input).length!==2)throw Error('invalid_input');
    const byId=Object.keys(input).every(k=>['classroomId','version'].includes(k))&&typeof input.classroomId==='string'&&typeof input.version==='string';
    const byTitle=Object.keys(input).every(k=>['title','revision'].includes(k))&&typeof input.title==='string'&&typeof input.revision==='number';
    if(!byId&&!byTitle)throw Error('invalid_input');
    const item=byId?await options.state.readConfirmed(options.sessionId,input.classroomId!,input.version!):await options.state.readConfirmedByTitle(options.sessionId,input.title!,input.revision!);current(signal);
    return {content:[{type:'text',text:JSON.stringify({success:true,status:item.status,classroomId:item.id,version:item.version,revision:item.revision,title:item.document.title,pageCount:item.document.scenes.length,pages:item.document.scenes.map(s=>({type:s.type,title:s.title,...(s.type==='quiz'?{questionCount:s.content.questions.length}:{})})),answerVerified:false,exportRequiresTeacherApproval:true})}],details:{success:true}};
   }catch(error){return failure(error,signal);}
  }
 },{
  name:CLASSROOM_EXPORT_TOOL,label:'导出已确认课堂',
  description:'先education_read_classroom核对教师指定已确认课堂，不能以历史草稿判断当前状态。从本会话已确认id/version读取完整课页与随堂题，不接受模型重抄内容。确定性导出供教师预览确认。format默认pptx，includeAnswers选择参考答案。format=docx/pdf时必须传purpose：handout学生讲义且includeAnswers=false，teacher_notes教师备课稿且includeAnswers=true。Word/PDF完整课页为不可编辑本地图片，随堂题为文字；备课稿只含已有解析，不是逐字讲稿，不能额外编造。提供授权目录内不存在的新path。冲突/拒绝/停止后不得重放；不能用office_create_document代替。',
  parameters:{type:'object',additionalProperties:false,required:['classroomId','version','path','includeAnswers'],properties:{classroomId:id,version,path:{type:'string',minLength:1,maxLength:500},includeAnswers:{type:'boolean'},format:{type:'string',enum:['pptx','docx','pdf']},purpose:{type:'string',enum:['handout','teacher_notes']}}} as ToolDefinition['parameters'],
  execute:async(callId,raw,signal)=>{
   try{
    current(signal);const input=raw as {classroomId:string;version:string;path:string;includeAnswers:boolean;format?:'pptx'|'docx'|'pdf';purpose?:ClassroomDocumentPurpose};
    if(!input||Object.keys(input).some(k=>!['classroomId','version','path','includeAnswers','format','purpose'].includes(k))||typeof input.classroomId!=='string'||typeof input.version!=='string'||typeof input.path!=='string'||typeof input.includeAnswers!=='boolean')throw Error('invalid_input');
    const format=input.format??'pptx';if(!['pptx','docx','pdf'].includes(format)||(format==='pptx'?input.purpose!==undefined:!['handout','teacher_notes'].includes(input.purpose??'')))throw Error('invalid_input');
    const item=await options.state.readConfirmed(options.sessionId,input.classroomId,input.version);current(signal);
    return await options.runOffice(options.sessionId,options.runId,options.wait,callId,{path:input.path,format,draft:compileClassroomOffice(item,input.includeAnswers,input.purpose),sources:[]},signal);
   }catch(error){return failure(error,signal);}
  }
 }];
}
