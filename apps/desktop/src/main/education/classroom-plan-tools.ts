import {createHash} from 'node:crypto';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import type {SceneOutline} from '@openmaic/generation';
import {CLASSROOM_PLAN_SCHEMA,type ClassroomPlanStart,type ClassroomPlanDocument,type ClassroomPlanBinding,type ClassroomPlanScene} from '../../shared/classroom-plan';
import type {ClassroomContext} from '../../shared/classroom-context';
import {validClassroomScene,classroomErrors} from '../../shared/classroom';
import type {createClassroomPlanState} from './classroom-plan-state';
import {physicsAnswerInstructions} from '../xiaozhi-agent/physics-answer-quality';
import {teachingLessonToolSchema,teachingLessonIssues} from '../../shared/teaching-lesson';

const empty={type:'object',additionalProperties:false,properties:{}} as const;
const sceneId={type:'string',pattern:'^[A-Za-z0-9_-]{1,64}$'};
const string=(maxLength:number)=>({type:'string',minLength:1,maxLength});
const outlineSchema={type:'object',additionalProperties:false,required:['schemaVersion','title','objectives','totalMinutes','scenes'],properties:{schemaVersion:{const:CLASSROOM_PLAN_SCHEMA,type:'string'},title:string(160),objectives:{type:'array',minItems:1,maxItems:8,items:string(500)},totalMinutes:{type:'integer',minimum:2,maximum:240},scenes:{type:'array',minItems:2,maxItems:12,items:{type:'object',additionalProperties:false,required:['sceneId','type','title','activity','durationMinutes'],properties:{sceneId,type:{type:'string',enum:['slide','quiz']},title:string(160),activity:string(3000),durationMinutes:{type:'integer',minimum:1,maximum:120}}}}}};
const result=(data:object)=>({content:[{type:'text' as const,text:JSON.stringify({success:true,...data})}],details:{success:true}});
const toolErrors:Record<string,string>={...classroomErrors,sensitive_content:'已确认大纲包含需要脱敏的信息，不能交付模型。请教师修改大纲，保存并重新确认当前版本后再生成。'};
function fail(error:unknown){const raw=error instanceof Error?error.message:'unavailable',code=toolErrors[raw]?raw:'invalid_input';return{content:[{type:'text' as const,text:JSON.stringify({success:false,error:code,message:toolErrors[code]})}],details:{success:false},isError:true};}
function exact(input:unknown,keys:string[]):input is Record<string,unknown>{return !!input&&typeof input==='object'&&!Array.isArray(input)&&Object.keys(input).length===keys.length&&Object.keys(input).every(k=>keys.includes(k));}
function outline(scene:ClassroomPlanScene,index:number,document:ClassroomPlanDocument):SceneOutline{
 return{id:scene.sceneId,type:scene.type,title:scene.title,description:`${scene.activity}\n教学目标：${document.objectives.join('；')}。本页安排${scene.durationMinutes}分钟。`,keyPoints:document.objectives,order:index,...(scene.type==='quiz'?{quizConfig:{questionCount:1,difficulty:'medium',questionTypes:['single']}}:{})};
}
/** Same Pi owns every model call. OpenMAIC only supplies prompts and normalizes Pi JSON. */
export function createClassroomPlanTools(options:{sessionId:string;runId:string;state:ReturnType<typeof createClassroomPlanState>;current:()=>boolean;sanitize:(text:string)=>Promise<string>;context:()=>ClassroomContext;binding?:ClassroomPlanStart}):ToolDefinition[]{
 const check=(signal?:AbortSignal)=>{if(signal?.aborted||!options.current())throw Error('cancelled');};
 const binding=():ClassroomPlanBinding=>{if(options.binding?.mode!=='generate')throw Error('not_confirmed');return options.binding;};
 const read=(signal?:AbortSignal)=>options.state.readForRun(options.sessionId,options.runId,binding(),()=>options.current()&&!signal?.aborted);
 // Teacher edits remain the approved version. Never silently substitute sanitized text.
 const deliverApproved=async(data:object,signal?:AbortSignal)=>{
  check(signal);
  const item=await read(signal);
  check(signal);
  const original=JSON.stringify({approvedDocument:item.document,delivery:data});
  const sanitized=await options.sanitize(original);
  check(signal);
  await read(signal);
  check(signal);
  if(sanitized!==original)throw Error('sensitive_content');
  return result(data);
 };
 return[
  {name:'education_propose_classroom_outline',label:'整理教学设计',description:options.binding?.mode==='outline'&&options.binding.lesson?'保存完整可编辑教案，仍用原课堂版本账本，不需要通用update_task_plan。lesson必填，版本xiaozhi.teaching-lesson.v1。顶层objectives写可观察行动，scenes保存4–12个环节（sceneId稳定、type用slide/quiz、activity为具体任务、durationMinutes为分钟）；lesson.phases逐环节关联sceneId、kind（introduction/activity/practice/assessment/closure）、objectiveIndices（从0开始）、teacherPrompt及checks（实际检查题、expectedEvidence、criterion、objectiveIndices）。每个目标均有探究或练习和具体检查；goalCriteria逐目标对应。先实读教师选定的各依据锚点；mappings用curriculumIndex按教师选定顺序，从实际原文quote到objectiveIndex并解释关系。未选依据或未映射目标在missingSources明确待对照，不编标准编号，不宣称正式课标对齐；合成和参考资料不能成为正式标准。缺资料可交待对照通用教案。总时长与各环节应一致，有冲突只保存待调整草稿。只保存草稿后停止，提示教师到互动课堂核对。':'先office_list_materials、office_read_material实读已保存正文，再只提交课堂大纲。来源由宿主绑定，不接受模型提供来源。schemaVersion=xiaozhi.classroom-plan.v1；2–12页，slide与quiz均需有；稳定sceneId，总分钟数等于各页时长之和。此工具只在教师从课堂制作入口开启的大纲模式可用，由课堂版本账本准入；直接调用，不为它建立通用update_task_plan步骤。仅保存草稿，随后停止页生成，提示教师到教学工作台→互动课堂编辑并明确确认；模型不能批准。AI还原页/学生证据未绑定，不支持本片。',parameters:(options.binding?.mode==='outline'&&options.binding.lesson?{...outlineSchema,required:[...outlineSchema.required,'lesson'],properties:{...outlineSchema.properties,lesson:teachingLessonToolSchema}}:outlineSchema) as ToolDefinition['parameters'],execute:async(callId,raw,signal)=>{
   try{check(signal);if(options.binding?.mode!=='outline')throw Error('not_confirmed');const document=raw as ClassroomPlanDocument,intent=options.binding.lesson;if(intent?(!document.lesson||document.lesson.subject!==intent.subject||document.lesson.grade!==intent.grade):document.lesson!==undefined)throw Error('invalid_input');const json=JSON.stringify(document);if(json.length>48000||await options.sanitize(json)!==json)throw Error('invalid_input');const item=await options.state.propose(options.sessionId,options.runId,callId,document,options.context(),()=>options.current()&&!signal?.aborted);return result({id:item.id,version:item.version,status:item.status,title:item.document.title,pages:item.document.scenes.length,totalMinutes:item.document.totalMinutes,...(item.document.lesson?{issues:teachingLessonIssues(item.document),alignment:'draft_mapping_requires_teacher_review',adopted:item.context.adopted,missingSources:item.document.lesson.missingSources}:{}),teacherConfirmed:false,location:'教学工作台 → 互动课堂 → 教学设计'});}catch(error){return fail(error);}
  }},
  {name:'education_read_classroom_plan',label:'读取已确认课堂大纲',description:'教师在页面明确点击生成/继续后，读取宿主绑定的大纲、来源及缺页。不能选其他id或自行启动。只补missingSceneIds，已保存页不得重复生成。读到来源版本不是引文已核验；必要时沿原资料读取及education_verify_material_quote核验。',parameters:empty as ToolDefinition['parameters'],execute:async(_id,raw,signal)=>{
   try{check(signal);if(!exact(raw,[]))throw Error('invalid_input');const item=await read(signal);return await deliverApproved({id:item.id,version:item.version,document:item.document,status:item.status,sources:item.context.materials,completedSceneIds:item.checkpoints.map(c=>c.sceneId),missingSceneIds:item.document.scenes.filter(s=>!item.checkpoints.some(c=>c.sceneId===s.sceneId)).map(s=>s.sceneId),instructions:'逐缺页prepare_planned_scene，再save_classroom_scene；全部成功后finish_classroom_plan。不要生成额外页，不改大纲。'},signal);}catch(error){return fail(error);}
  }},
  {name:'education_prepare_planned_scene',label:'准备已确认课页',description:'对宿主绑定大纲的指定sceneId获取OpenMAIC原生system/user提示。本Pi按提示生成contentJson，交education_save_classroom_scene保存；不得新开Agent/模型循环。仅slide原生文字/形状/线/公式和quiz选择题，无外部资源或脚本。',parameters:{type:'object',additionalProperties:false,required:['sceneId'],properties:{sceneId}} as ToolDefinition['parameters'],execute:async(_id,raw,signal)=>{
   try{check(signal);if(!exact(raw,['sceneId'])||typeof raw.sceneId!=='string')throw Error('invalid_input');const item=await read(signal),index=item.document.scenes.findIndex(s=>s.sceneId===raw.sceneId);if(index<0)throw Error('invalid_input');if(item.checkpoints.some(c=>c.sceneId===raw.sceneId))return await deliverApproved({alreadySaved:true,sceneId:raw.sceneId,instructions:'此页已保存，继续下一缺页。'},signal);
    const {generateSceneContent}=await import('@openmaic/generation');let prompt:{system:string;user:string}|undefined;const captured=Symbol('Pi prompt');try{await generateSceneContent(outline(item.document.scenes[index],index,item.document),async(system,user)=>{prompt={system,user};throw captured;},{targetLanguage:'zh-CN',languageDirective:'中文。仅文字/形状/线/公式和选择题，不使用外部资源、链接、脚本。'});}catch(error){if(error!==captured)throw error;}
    check(signal);if(!prompt)throw Error('invalid_input');
    // The approved lesson, rather than a generic resume title, determines subject
    // context. This stays in the existing Pi tool response for every missing page.
    const subjectInstructions=physicsAnswerInstructions(JSON.stringify(item.document));
    const pagePrompt={...prompt,system:subjectInstructions?`${prompt.system}\n\n${subjectInstructions}`:prompt.system};
    if(JSON.stringify(pagePrompt).length>48000)throw Error('invalid_input');return await deliverApproved({sceneId:raw.sceneId,...pagePrompt,instructions:'生成原生contentJson，保留必要条件、题目、字母答案和解析，然后调用education_save_classroom_scene。'},signal);
   }catch(error){return fail(error);}
  }},
  {name:'education_save_classroom_scene',label:'保存课堂课页检查点',description:'将指定已确认sceneId的contentJson交原OpenMAIC归一化/组装和离线DSL校验，成功一页即持久保存。失败只修本页，停止保留成功页。不能修改大纲或覆盖成功页，来源变化/旧run/旧版本将拒绝。',parameters:{type:'object',additionalProperties:false,required:['sceneId','contentJson'],properties:{sceneId,contentJson:string(80000)}} as ToolDefinition['parameters'],execute:async(_id,raw,signal)=>{
   try{check(signal);if(!exact(raw,['sceneId','contentJson'])||typeof raw.sceneId!=='string'||typeof raw.contentJson!=='string'||raw.contentJson.length>80000||await options.sanitize(raw.contentJson)!==raw.contentJson)throw Error('invalid_input');const item=await read(signal),index=item.document.scenes.findIndex(s=>s.sceneId===raw.sceneId);if(index<0)throw Error('invalid_input');
    const inputDigest=createHash('sha256').update(raw.contentJson).digest('hex'),old=item.checkpoints.find(c=>c.sceneId===raw.sceneId);if(old){if(old.inputDigest!==inputDigest)throw Error('conflict');return result({sceneId:old.sceneId,saved:true,alreadySaved:true,completed:item.checkpoints.length,total:item.document.scenes.length});}
    const {generateSceneContent,buildCompleteScene}=await import('@openmaic/generation'),spec=outline(item.document.scenes[index],index,item.document);const content=await generateSceneContent(spec,async()=>{check(signal);return raw.contentJson as string;},{targetLanguage:'zh-CN'});check(signal);if(!content)throw Error('invalid_input');const scene=buildCompleteScene(spec,content,[],options.sessionId,{sceneId:raw.sceneId});if(!validClassroomScene(scene))throw Error('invalid_input');
    const saved=await options.state.checkpoint(options.sessionId,options.runId,binding(),raw.sceneId,scene,()=>options.current()&&!signal?.aborted,inputDigest);return result({sceneId:raw.sceneId,saved:true,completed:saved.checkpoints.length,total:saved.document.scenes.length});
   }catch(error){return fail(error);}
  }},
  {name:'education_finish_classroom_plan',label:'提交完整课堂待教师核对',description:'所有必需页已保存后，宿主从同一版本检查点确定性组装为原pending课堂。不会确认课堂、写入文件或记录成绩。教师仍须在原预演核对并最终确认；文件导出另行批准。',parameters:empty as ToolDefinition['parameters'],execute:async(_id,raw,signal)=>{
   try{check(signal);if(!exact(raw,[]))throw Error('invalid_input');const item=await options.state.complete(options.sessionId,options.runId,binding(),()=>options.current()&&!signal?.aborted);return result({classroomId:item.classroomId,status:'pending',pages:item.checkpoints.length,teacherConfirmed:false,answerVerified:false,location:'教学工作台 → 互动课堂'});}catch(error){return fail(error);}
  }}
 ];
}
