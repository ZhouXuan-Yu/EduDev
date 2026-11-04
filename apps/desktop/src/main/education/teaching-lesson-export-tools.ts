import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {TEACHING_LESSON_EXPORT_TOOLS,type TeachingLessonExportInput} from '../../shared/teaching-lesson-export';
import {officeRelativePath,type OfficeArtifactProposal} from '../../shared/xiaozhi-office-artifacts';
import type {createClassroomPlanState} from './classroom-plan-state';
import {compileTeachingLessonOffice} from './teaching-lesson-office';

export type TeachingLessonExportFile=OfficeArtifactProposal&{kind:'office';fileId:string};
export function createTeachingLessonExportTools(options:{sessionId:string;state:ReturnType<typeof createClassroomPlanState>;current:()=>boolean;sanitize:(text:string)=>Promise<string>;publish:(files:TeachingLessonExportFile[],args:Parameters<ToolDefinition['execute']>)=>ReturnType<ToolDefinition['execute']>}):ToolDefinition[]{
 const check=(signal?:AbortSignal)=>{signal?.throwIfAborted();if(!options.current())throw Error('cancelled');};
 const failure=(error:unknown,signal?:AbortSignal)=>{
  if(signal?.aborted||!options.current())throw Error('cancelled');
  const code=error instanceof Error?error.message:'invalid_input';
  return {content:[{type:'text' as const,text:JSON.stringify({success:false,error:code,message:['conflict','source_changed','not_confirmed'].includes(code)?'教案未确认或版本/依据已变化，请读取并确认当前教案后重新导出。':'教案读取或导出未完成，请核对本会话教案及新文件路径。'})}],details:{success:false},isError:true};
 };
 const id={type:'string',pattern:'^classplan_[a-f0-9-]{36}$'},version={type:'string',pattern:'^[a-f0-9]{64}$'};
 return[{
  name:TEACHING_LESSON_EXPORT_TOOLS[0],label:'读取已确认教案',
  description:'读取本会话当前已确认的结构化教案。只传精确planId/version或title/revision两项；名称重复、草稿或旧版本不能猜测。返回导出所需固定引用和摘要；完整目标、活动、教师提示、检查题和依据由宿主从SQLite读取，不需要模型重抄。',
  parameters:{type:'object',additionalProperties:false,properties:{planId:id,version,title:{type:'string',minLength:1,maxLength:160},revision:{type:'integer',minimum:1}}} as ToolDefinition['parameters'],
  execute:async(_callId,raw,signal)=>{try{
   check(signal);const input=raw as {planId?:string;version?:string;title?:string;revision?:number};
   if(!input||Object.keys(input).length!==2)throw Error('invalid_input');
   const byId=Object.keys(input).every(k=>['planId','version'].includes(k))&&typeof input.planId==='string'&&typeof input.version==='string';
   const byTitle=Object.keys(input).every(k=>['title','revision'].includes(k))&&typeof input.title==='string'&&typeof input.revision==='number';
   if(!byId&&!byTitle)throw Error('invalid_input');
   const item=byId?await options.state.readConfirmedLesson(options.sessionId,input.planId!,input.version!):await options.state.readConfirmedLessonByTitle(options.sessionId,input.title!,input.revision!);check(signal);
   const title=await options.sanitize(item.document.title);check(signal);
   return{content:[{type:'text',text:JSON.stringify({success:true,planId:item.id,version:item.version,revision:item.revision,status:item.status,title,totalMinutes:item.document.totalMinutes,objectiveCount:item.document.objectives.length,phaseCount:item.document.scenes.length,checkCount:item.document.lesson!.phases.reduce((n,p)=>n+p.checks.length,0),exportFormats:['docx','pdf'],exportRequiresTeacherApproval:true})}],details:{success:true}};
  }catch(error){return failure(error,signal);}}
 },{
  name:TEACHING_LESSON_EXPORT_TOOLS[1],label:'导出可编辑教案',
  description:'将已确认结构化教案按固定planId/version确定性导出原生可编辑Word或同源A4 PDF，包含完整目标/标准/活动/检查/预期证据/教师提示/依据资格。outputs传1至2个不重复format(docx/pdf)和新相对path，两份走原整包一次确认，单份走原Office确认。两份的任务计划用saved_bundle target=current，单份用saved_office target=path。草稿、旧版本或依据变化不保存；无目录选择时沿原会话输出目录。不要用旧课页图片导出或模型重抄代替教案。',
  parameters:{type:'object',additionalProperties:false,required:['planId','version','outputs'],properties:{planId:id,version,outputs:{type:'array',minItems:1,maxItems:2,items:{type:'object',additionalProperties:false,required:['format','path'],properties:{format:{type:'string',enum:['docx','pdf']},path:{type:'string',minLength:1,maxLength:500}}}}}} as ToolDefinition['parameters'],
  execute:async(...args)=>{try{
   check(args[2]);const input=args[1] as TeachingLessonExportInput;
   if(!input||Object.keys(input).sort().join(',')!=='outputs,planId,version'||!Array.isArray(input.outputs)||!input.outputs.length||input.outputs.length>2)throw Error('invalid_input');
   const formats=new Set<string>(),paths=new Set<string>();
   for(const output of input.outputs){if(!output||Object.keys(output).sort().join(',')!=='format,path'||!['docx','pdf'].includes(output.format)||!officeRelativePath(output.path)||!output.path.toLowerCase().endsWith('.'+output.format)||formats.has(output.format)||paths.has(output.path.toLowerCase()))throw Error('invalid_input');formats.add(output.format);paths.add(output.path.toLowerCase());}
   const item=await options.state.readConfirmedLesson(options.sessionId,input.planId,input.version);check(args[2]);
   const draft=compileTeachingLessonOffice(item),files:TeachingLessonExportFile[]=input.outputs.map(output=>({kind:'office',fileId:'lesson_'+output.format,...output,draft:structuredClone(draft),sources:[]}));
   return await options.publish(files,args);
  }catch(error){return failure(error,args[2]);}}
 }];
}
