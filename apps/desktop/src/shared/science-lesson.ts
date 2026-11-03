import {plainStudentInput} from './student-context';
import {validBuoyancyInput,buoyancyParameters,type BuoyancyInput} from './buoyancy';
import type {QuestionContextSource} from './question-context';

export const SCIENCE_LESSON_SCHEMA='xiaozhi.science-lesson.v1' as const;
export type LessonOrigin={kind:'question';reference:string;version:string}|{kind:'self_authored';stem:string;answer:string;analysis:string};
export type LessonFact={id:string;label:string;value:string;audience:'public'|'teacher'};
export type LessonActivity={title:string;minutes:number;goals:number[];student:string[];teacher:string[]};
export type LessonCheck={stem:string;answer:string;analysis:string;goals:number[]};
export type LessonSlide={title:string;paragraphs:string[];notes:string[]};
export type ScienceLesson={schemaVersion:typeof SCIENCE_LESSON_SCHEMA;title:string;audience:string;subject:string;knowledgePoint:string;minutes:number;origin:LessonOrigin;
 goals:string[];facts:LessonFact[];activities:LessonActivity[];checks:LessonCheck[];slides:LessonSlide[];demo:{kind:'buoyancy';model:BuoyancyInput}|{kind:'guided'}};
export type LessonSource={kind:LessonOrigin['kind'];stem:string;answer:string;analysis:string;title:string;question?:QuestionContextSource};
export const LESSON_ROLES={handout:'学生讲义',teacher:'教师解析',slides:'可编辑课件',demo:'离线探究',quiz:'随堂题'} as const;
export type LessonRole=keyof typeof LESSON_ROLES;
export type ScienceLessonSummary={schemaVersion:typeof SCIENCE_LESSON_SCHEMA;title:string;minutes:number;goals:string[];sourceTitle:string;sourceVersion?:string;
 revision:number;previousBundleId?:string;changed:LessonRole[];roles:{fileId:string;role:LessonRole}[];consistency:'compiled'|'edited';scope:string};
const exact=(v:unknown,fields:string[]):v is Record<string,unknown>=>plainStudentInput(v,fields)&&Object.keys(v).length===fields.length;
const text=(v:unknown,max=4000):v is string=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f\ud800-\udfff]/u.test(v);
const texts=(v:unknown,min=1,max=12)=>Array.isArray(v)&&v.length>=min&&v.length<=max&&Array.from(v).every(x=>text(x));
const indexes=(v:unknown,n:number)=>Array.isArray(v)&&v.length>0&&v.length<=n&&new Set(v).size===v.length&&Array.from(v).every(x=>Number.isSafeInteger(x)&&x>=1&&x<=n);
export function validScienceLesson(v:unknown):v is ScienceLesson{
 if(!exact(v,['schemaVersion','title','audience','subject','knowledgePoint','minutes','origin','goals','facts','activities','checks','slides','demo']))return false;
 const x=v as Record<string,unknown>,o=x.origin;
 if(x.schemaVersion!==SCIENCE_LESSON_SCHEMA||!text(x.title,60)||!text(x.audience,60)||!text(x.subject,40)||!text(x.knowledgePoint,100)
  ||!Number.isSafeInteger(x.minutes)||Number(x.minutes)<1||Number(x.minutes)>180||!texts(x.goals,1,8))return false;
 const n=(x.goals as string[]).length;
 if(!(exact(o,['kind','reference','version'])&&o.kind==='question'&&typeof o.reference==='string'&&/^题目[1-9][0-9]{0,2}$/.test(o.reference)&&typeof o.version==='string'&&/^[a-f0-9]{64}$/.test(o.version)
  ||exact(o,['kind','stem','answer','analysis'])&&o.kind==='self_authored'&&text(o.stem,12000)&&text(o.answer,6000)&&text(o.analysis,12000)))return false;
 if(!Array.isArray(x.facts)||x.facts.length>48||new Set(x.facts.map(f=>f?.id)).size!==x.facts.length||!Array.from(x.facts).every(f=>exact(f,['id','label','value','audience'])&&typeof f.id==='string'&&/^[a-z][a-z0-9_]{0,39}$/.test(f.id)&&text(f.label,80)&&text(f.value,1000)&&['public','teacher'].includes(String(f.audience))))return false;
 if(!Array.isArray(x.activities)||x.activities.length<1||x.activities.length>12||!Array.from(x.activities).every(a=>exact(a,['title','minutes','goals','student','teacher'])&&text(a.title,120)&&Number.isSafeInteger(a.minutes)&&Number(a.minutes)>0&&indexes(a.goals,n)&&texts(a.student)&&texts(a.teacher))||x.activities.reduce((s,a)=>s+a.minutes,0)!==x.minutes)return false;
 if(!Array.isArray(x.checks)||x.checks.length<1||x.checks.length>8||!Array.from(x.checks).every(c=>exact(c,['stem','answer','analysis','goals'])&&text(c.stem)&&text(c.answer)&&text(c.analysis)&&indexes(c.goals,n)))return false;
 if(!Array.isArray(x.slides)||x.slides.length<1||x.slides.length>30||!Array.from(x.slides).every(s=>exact(s,['title','paragraphs','notes'])&&text(s.title,120)&&texts(s.paragraphs,1,12)&&texts(s.notes,1,12)))return false;
 return exact(x.demo,['kind'])&&x.demo.kind==='guided'||exact(x.demo,['kind','model'])&&x.demo.kind==='buoyancy'&&validBuoyancyInput(x.demo.model);
}
const t={type:'string',minLength:1,maxLength:4000},arr=(items:unknown,minItems=1,maxItems=12)=>({type:'array',items,minItems,maxItems});
const obj=(properties:Record<string,unknown>)=>({type:'object',additionalProperties:false,properties,required:Object.keys(properties)});
export const scienceLessonParameters=obj({schemaVersion:{type:'string',const:SCIENCE_LESSON_SCHEMA},title:{...t,maxLength:60},audience:{...t,maxLength:60},subject:{...t,maxLength:40},knowledgePoint:{...t,maxLength:100},minutes:{type:'integer',minimum:1,maximum:180},
 origin:{anyOf:[obj({kind:{const:'question',type:'string'},reference:{type:'string',pattern:'^题目[1-9][0-9]{0,2}$'},version:{type:'string',pattern:'^[a-f0-9]{64}$'}}),obj({kind:{const:'self_authored',type:'string'},stem:{...t,maxLength:12000},answer:{...t,maxLength:6000},analysis:{...t,maxLength:12000}})]},
 goals:arr(t,1,8),facts:arr(obj({id:{type:'string',pattern:'^[a-z][a-z0-9_]{0,39}$'},label:{...t,maxLength:80},value:{...t,maxLength:1000},audience:{type:'string',enum:['public','teacher']}}),0,48),
 activities:arr(obj({title:{...t,maxLength:120},minutes:{type:'integer',minimum:1,maximum:180},goals:arr({type:'integer',minimum:1,maximum:8},1,8),student:arr(t),teacher:arr(t)})),
 checks:arr(obj({stem:t,answer:t,analysis:t,goals:arr({type:'integer',minimum:1,maximum:8},1,8)}),1,8),slides:arr(obj({title:{...t,maxLength:120},paragraphs:arr(t),notes:arr(t)}),1,30),
 demo:{anyOf:[obj({kind:{type:'string',const:'guided'}}),obj({kind:{type:'string',const:'buoyancy'},model:buoyancyParameters})]}});
