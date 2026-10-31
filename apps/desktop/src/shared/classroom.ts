import type {ClassroomContext} from './classroom-context';
import type {Scene} from '@openmaic/dsl';
import {validateScene} from '@openmaic/dsl';

export const CLASSROOM_SCHEMA='xiaozhi.education.classroom.v1' as const;
export const CLASSROOM_ACTION='pi_classroom_candidate';
export const CLASSROOM_TOOLS=['education_prepare_classroom_scene','education_stage_classroom'] as const;
export type ClassroomDocument={schemaVersion:typeof CLASSROOM_SCHEMA;title:string;scenes:Scene[];origin:'ai_generated';answerVerified:false};
export type ClassroomItem={id:string;sessionId:string;studentId:string;runId:string;revision:number;status:'pending'|'confirmed'|'rejected';updatedAt:string;document:ClassroomDocument;version:string;context?:ClassroomContext;plan?:import('./classroom-plan').ClassroomPlanSource};
export type ClassroomDecision={id:string;version:string;decision:'confirm'|'reject';document?:ClassroomDocument};
export type ClassroomResult<T>={ok:true;data:T}|{ok:false;error:string};
export const classroomErrors:Record<string,string>={source_required:'请先让小智实读已收录资料段落，再制作课堂大纲。',not_confirmed:'请先确认当前大纲版本，再生成课页。',incomplete:'尚有未完成课页，请继续缺页后再核对课堂。',source_changed:'课堂参考资料已变化或含私密内容，请重新读取资料并制作课堂。',invalid_input:'课堂内容不完整或超出支持范围，请调整后重试。',permission_denied:'课堂或来源对话已失效。',conflict:'课堂已被其他操作更新，请刷新后再保存。',cancelled:'已停止课堂整理，未保存新内容。',unavailable:'课堂暂时无法读取，请重试。',unsafe_content:'课堂包含不能使用的外部资源或脚本，请让小智重新整理。'};
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
/** Complete classrooms and individual checkpoints share the same offline subset. */
const unsafeClassroom=(value:unknown)=>/https?:|file:|javascript:|data:|url\s*\(|<\s*(?:script|iframe|object|embed|img|video|audio|link|style)|\bon\w+\s*=/i.test(JSON.stringify(value));
export function validClassroomScene(value:unknown):value is Scene{
 try{
  const s=value as Scene;
  if(!s||!validateScene(s).valid||!text(s.id,80)||!text(s.title,160)||(s.actions?.length??0)>0||s.multiAgent||s.whiteboards?.length||JSON.stringify(s).length>200000||unsafeClassroom(s))return false;
  if(s.type==='slide'){
   const c=s.content.canvas;
   if(!Number.isFinite(c.viewportSize)||c.viewportSize<100||c.viewportSize>2000||!Number.isFinite(c.viewportRatio)||c.viewportRatio<.2||c.viewportRatio>2||!Array.isArray(c.elements)||!c.elements.length||c.elements.length>60)return false;
   for(const e of c.elements){
    if(!['text','shape','line','latex'].includes(e.type)||!text(e.id,80)||![e.left,e.top,e.width].every(n=>Number.isFinite(n)&&Math.abs(n)<=4000))return false;
    if(e.type!=='line'&&(!Number.isFinite(e.height)||e.height<1||e.height>4000))return false;
    if(e.type==='text'&&(!text(e.content,18000)||typeof e.defaultFontName!=='string'||e.defaultFontName.length>128))return false;
    if(e.type==='shape'&&(!text(e.path,12000)||!/^[MmLlHhVvCcSsQqTtAaZz\d\s.,+\-eE]+$/.test(e.path)))return false;
    if(e.type==='latex'&&(!text(e.latex,2000)||!text(e.html,24000)))return false;
   }
   return true;
  }
  if(s.type!=='quiz'||!s.content.questions.length||s.content.questions.length>12)return false;
  for(const q of s.content.questions){
   if(q.type!=='single'&&q.type!=='multiple'||!text(q.id,80)||!text(q.question,3000)||!text(q.analysis,5000)||!q.options||q.options.length<2||q.options.length>8||!q.answer?.length)return false;
   const values=new Set(q.options.map(o=>o.value));
   if(values.size!==q.options.length||q.options.some(o=>!/^[A-Z]$/.test(o.value)||!text(o.label,2000))||q.answer.some(a=>!values.has(a))||q.type==='single'&&q.answer.length!==1)return false;
  }
  return true;
 }catch{return false;}
}
export function validClassroom(value:unknown):value is ClassroomDocument{
 try{
  const d=value as ClassroomDocument;
  return !!d&&d.schemaVersion===CLASSROOM_SCHEMA&&d.origin==='ai_generated'&&d.answerVerified===false&&text(d.title,160)&&Array.isArray(d.scenes)&&d.scenes.length>=2&&d.scenes.length<=12&&JSON.stringify(d).length<=250000&&!unsafeClassroom(d)&&d.scenes.every(validClassroomScene)&&new Set(d.scenes.map(s=>s.id)).size===d.scenes.length&&d.scenes.some(s=>s.type==='slide')&&d.scenes.some(s=>s.type==='quiz');
 }catch{return false;}
}
