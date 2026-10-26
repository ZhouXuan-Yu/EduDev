import type {ClassroomContext} from './classroom-context';
import type {Scene} from '@openmaic/dsl';
import {validateScene} from '@openmaic/dsl';

export const CLASSROOM_SCHEMA='xiaozhi.education.classroom.v1' as const;
export const CLASSROOM_ACTION='pi_classroom_candidate';
export const CLASSROOM_TOOLS=['education_prepare_classroom_scene','education_stage_classroom'] as const;
export type ClassroomDocument={schemaVersion:typeof CLASSROOM_SCHEMA;title:string;scenes:Scene[];origin:'ai_generated';answerVerified:false};
export type ClassroomItem={id:string;sessionId:string;studentId:string;runId:string;revision:number;status:'pending'|'confirmed'|'rejected';updatedAt:string;document:ClassroomDocument;version:string;context?:ClassroomContext};
export type ClassroomDecision={id:string;version:string;decision:'confirm'|'reject';document?:ClassroomDocument};
export type ClassroomResult<T>={ok:true;data:T}|{ok:false;error:string};
export const classroomErrors:Record<string,string>={source_changed:'课堂参考资料已变化或含私密内容，请重新读取资料并制作课堂。',invalid_input:'课堂内容不完整或超出支持范围，请调整后重试。',permission_denied:'课堂或来源对话已失效。',conflict:'课堂已被其他操作更新，请刷新后再保存。',cancelled:'已停止课堂整理，未保存新内容。',unavailable:'课堂暂时无法读取，请重试。',unsafe_content:'课堂包含不能使用的外部资源或脚本，请让小智重新整理。'};
const text=(v:unknown,max:number)=>typeof v==='string'&&v.trim().length>0&&v.length<=max;
/** Upstream structural contract + bounded, offline-only rendering subset. No correctness claim. */
export function validClassroom(v:unknown):v is ClassroomDocument{
 try{
  const d=v as ClassroomDocument;if(!d||d.schemaVersion!==CLASSROOM_SCHEMA||d.origin!=='ai_generated'||d.answerVerified!==false||!text(d.title,160)||!Array.isArray(d.scenes)||d.scenes.length<2||d.scenes.length>12)return false;
  const json=JSON.stringify(d);if(json.length>250000||/https?:|file:|javascript:|data:|url\s*\(|<\s*(?:script|iframe|object|embed|img|video|audio|link|style)|\bon\w+\s*=/i.test(json))return false;
  const ids=new Set<string>();let slides=0,quizzes=0;
  for(const s of d.scenes){
   if(!validateScene(s).valid||!text(s.id,80)||ids.has(s.id)||!text(s.title,160)||(s.actions?.length??0)>0||s.multiAgent||s.whiteboards?.length)return false;ids.add(s.id);
   if(s.type==='slide'){
    slides++;const c=s.content.canvas;if(!Number.isFinite(c.viewportSize)||c.viewportSize<100||c.viewportSize>2000||!Number.isFinite(c.viewportRatio)||c.viewportRatio<.2||c.viewportRatio>2||!Array.isArray(c.elements)||!c.elements.length||c.elements.length>60)return false;
    for(const e of c.elements){if(!['text','shape','line','latex'].includes(e.type)||!text(e.id,80)||![e.left,e.top,e.width].every(n=>Number.isFinite(n)&&Math.abs(n)<=4000))return false;
     if(e.type!=='line'&&(!Number.isFinite(e.height)||e.height<1||e.height>4000))return false;
     if(e.type==='text'&&(!text(e.content,18000)||typeof e.defaultFontName!=='string'||e.defaultFontName.length>128))return false;
     if(e.type==='shape'&&(!text(e.path,12000)||!/^[MmLlHhVvCcSsQqTtAaZz\d\s.,+\-eE]+$/.test(e.path)))return false;
     if(e.type==='latex'&&(!text(e.latex,2000)||!text(e.html,24000)))return false;
    }
   }else if(s.type==='quiz'){
    quizzes++;if(!s.content.questions.length||s.content.questions.length>12)return false;
    for(const q of s.content.questions){if(q.type!=='single'&&q.type!=='multiple'||!text(q.id,80)||!text(q.question,3000)||!text(q.analysis,5000)||!q.options||q.options.length<2||q.options.length>8||!q.answer?.length)return false;
     const values=new Set(q.options.map(o=>o.value));if(values.size!==q.options.length||q.options.some(o=>!/^[A-Z]$/.test(o.value)||!text(o.label,2000))||q.answer.some(a=>!values.has(a))||q.type==='single'&&q.answer.length!==1)return false;
    }
   }else return false;
  }return slides>0&&quizzes>0;
 }catch{return false;}
}
