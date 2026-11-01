import type {ClassroomContext} from '../../shared/classroom-context';
import {createHash} from 'node:crypto';
import type {ToolDefinition} from '@earendil-works/pi-coding-agent';
import {CLASSROOM_SCHEMA,validClassroom,type ClassroomDocument} from '../../shared/classroom';
import type {createClassroomState} from './classroom-state';
import type {SceneOutline} from '@openmaic/generation';
type Prepared={outline:SceneOutline};
/** Pi supplies the model callback; upstream supplies prompts, normalization and scene assembly. */
export function createClassroomTools(options:{sessionId:string;runId:string;state:ReturnType<typeof createClassroomState>;current:()=>boolean;sanitize:(text:string)=>Promise<string>;context?:()=>ClassroomContext;outlineOnly?:boolean}):ToolDefinition[]{
 const prepared=new Map<string,Prepared>();
 let sequence=0;
 const check=(signal?:AbortSignal)=>{signal?.throwIfAborted();if(!options.current())throw new Error('cancelled');if(options.outlineOnly)throw new Error('not_confirmed');};
 const result=(data:unknown)=>({content:[{type:'text' as const,text:JSON.stringify({success:true,...data as object})}],details:{success:true}});
 const fail=(e:unknown)=>({content:[{type:'text' as const,text:JSON.stringify({success:false,error:(e as Error).message==='cancelled'?'cancelled':(e as Error).message==='invalid_reference'?'invalid_reference':(e as Error).message==='source_changed'?'source_changed':'invalid_input',message:(e as Error).message==='source_changed'?'已读取的资料段落已变化或被标为私密，未保存课堂。请重新读取当前段落后重试。':(e as Error).message==='invalid_reference'?'reference必须逐字使用准备工具返回的课页编号，不是页标题。请保留已有内容，按下面编号重交。':'课堂尚未保存。仅支持原生文字/形状/线/公式幻灯片与带答案、解析的选择题；禁止外部URL、图片或脚本。',preparedScenes:[...prepared].map(([reference,p])=>({reference,title:p.outline.title,type:p.outline.type}))})}],details:{success:false},isError:true});
 return[
  {name:'education_prepare_classroom_scene',label:'准备互动课堂内容',description:'根据资料制作时先office_list_materials/office_read_material实读指定段落；仅聊天中的转述不能登记为资料来源。制作互动课时逐页调用，获取OpenMAIC原生幻灯片/互动题提示。按返回的system/user生成内容JSON，再用education_stage_classroom一次提交所有页。slide支持文字、形状图示、线和公式；不允许图片/网络/脚本。quiz只用single/multiple选择题，必须给analysis与选项字母答案。自动对照不证明教学正确；教师在教学内容核对确认。',parameters:{type:'object',additionalProperties:false,properties:{type:{type:'string',enum:['slide','quiz']},title:{type:'string',maxLength:160},description:{type:'string',maxLength:3000}},required:['type','title','description']}as ToolDefinition['parameters'],execute:async(_id,input,signal)=>{
   try{check(signal);const a=input as {type:'slide'|'quiz';title:string;description:string};if(!a||!['slide','quiz'].includes(a.type)||typeof a.title!=='string'||!a.title.trim()||a.title.length>160||typeof a.description!=='string'||!a.description.trim()||a.description.length>3000||sequence>=12)throw new Error('invalid_input');
    // Pi can execute parallel tool calls: reserve identity before the first await.
    const ordinal=sequence++,reference=`课页${ordinal+1}`;
    const {generateSceneContent}=await import('@openmaic/generation');const outline:SceneOutline={id:reference,type:a.type,title:await options.sanitize(a.title),description:await options.sanitize(a.description),keyPoints:[],order:ordinal,...(a.type==='quiz'?{quizConfig:{questionCount:2,difficulty:'medium',questionTypes:['single']}}:{})};
    let prompt:{system:string;user:string}|undefined;const captured=Symbol('Pi callback');try{await generateSceneContent(outline,async(system,user)=>{prompt={system,user};throw captured;},{targetLanguage:'zh-CN',languageDirective:'使用中文。仅文字/形状/线/公式，无外部资源。'});}catch(e){if(e!==captured)throw e;}
    if(!prompt||JSON.stringify(prompt).length>48000)throw new Error('invalid_input');check(signal);prepared.set(reference,{outline});return result({reference,...prompt,instructions:'遵循此原生提示生成contentJson。只用text/shape/line/latex或选择题，无链接/原件。完成至少一页讲解和一页互动题，再提交stage工具。'});
   }catch(e){return fail(e);}
  }},
  {name:'education_stage_classroom',label:'整理互动课供教师核对',description:'将同轮已准备课页的模型生成JSON交给OpenMAIC归一化/组装，保存待教师核对课堂。至少一页slide与一页quiz。不写成绩/事实，不能称教师已确认或答案已验证。完成后提示教师打开教学内容的互动课堂预览。',parameters:{type:'object',additionalProperties:false,properties:{title:{type:'string',maxLength:160},scenes:{type:'array',minItems:2,maxItems:12,items:{type:'object',additionalProperties:false,properties:{reference:{type:'string'},contentJson:{type:'string',maxLength:80000}},required:['reference','contentJson']}}},required:['title','scenes']}as ToolDefinition['parameters'],execute:async(callId,input,signal)=>{
   try{check(signal);const a=input as {title:string;scenes:{reference:string;contentJson:string}[]};if(!a||typeof a.title!=='string'||!a.title.trim()||a.title.length>160||!Array.isArray(a.scenes)||a.scenes.length<2||a.scenes.length>12)throw new Error('invalid_input');if(new Set(a.scenes.map(s=>s.reference)).size!==a.scenes.length)throw new Error('invalid_reference');
    const {generateSceneContent,buildCompleteScene}=await import('@openmaic/generation'),scenes:ClassroomDocument['scenes']=[];
    for(const [index,s]of a.scenes.entries()){
     check(signal);const p=prepared.get(s.reference);if(!p)throw new Error('invalid_reference');if(typeof s.contentJson!=='string'||s.contentJson.length>80000||await options.sanitize(s.contentJson)!==s.contentJson)throw new Error('invalid_input');
     const content=await generateSceneContent(p.outline,async()=>{check(signal);return s.contentJson;},{targetLanguage:'zh-CN'});check(signal);if(!content)throw new Error('invalid_input');const scene=buildCompleteScene({...p.outline,order:index},content,[],options.sessionId,{sceneId:s.reference});if(!scene||scene.type!=='slide'&&scene.type!=='quiz')throw new Error('invalid_input');scenes.push(scene);
    }
    const document:ClassroomDocument={schemaVersion:CLASSROOM_SCHEMA,title:await options.sanitize(a.title),scenes,origin:'ai_generated',answerVerified:false};if(!validClassroom(document))throw new Error('invalid_input');check(signal);
    const item=await options.state.stage(options.sessionId,options.runId,callId,document,()=>options.current()&&!signal?.aborted,createHash('sha256').update(JSON.stringify(a)).digest('hex'),options.context?.());check(signal);return result({id:item.id,status:item.status,pages:item.document.scenes.length,title:item.document.title,teacherConfirmed:item.status==='confirmed',answerVerified:false,location:'教学内容 → 互动课堂'});
   }catch(e){return fail(e);}
  }}
 ];
}
