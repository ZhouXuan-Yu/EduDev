/** Pedagogical links extend the existing classroom document; activities and time stay there. */
export const TEACHING_LESSON_SCHEMA='xiaozhi.teaching-lesson.v1' as const;
export const lessonPhaseLabels={introduction:'导入',activity:'探究与讲授',practice:'练习',assessment:'评价',closure:'总结'} as const;
export type LessonCheck={objectiveIndices:number[];prompt:string;expectedEvidence:string;criterion:string};
export type LessonPhase={sceneId:string;kind:keyof typeof lessonPhaseLabels;objectiveIndices:number[];teacherPrompt:string;checks:LessonCheck[]};
export type LessonMapping={objectiveIndex:number;curriculumIndex:number;quote:string;explanation:string};
export type TeachingLesson={schemaVersion:typeof TEACHING_LESSON_SCHEMA;subject:string;grade:string;preparation:string[];goalCriteria:string[];phases:LessonPhase[];mappings:LessonMapping[];missingSources:string[]};
type Document={objectives:string[];totalMinutes:number;scenes:{sceneId:string;durationMinutes:number}[];lesson?:TeachingLesson};
const record=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v)&&Object.values(Object.getOwnPropertyDescriptors(v)).every(d=>'value'in d);
const keys=(v:Record<string,unknown>,names:string[])=>Reflect.ownKeys(v).length===names.length&&Object.keys(v).every(k=>names.includes(k));
const text=(v:unknown,max=1500):v is string=>typeof v==='string'&&!!v.trim()&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
const strings=(v:unknown,max:number)=>Array.isArray(v)&&v.length<=max&&v.every(s=>text(s));
export function validTeachingLesson(v:unknown,document:Document):v is TeachingLesson{
 if(!record(v)||!keys(v,['schemaVersion','subject','grade','preparation','goalCriteria','phases','mappings','missingSources'])||v.schemaVersion!==TEACHING_LESSON_SCHEMA||!text(v.subject,160)||!text(v.grade,160)||!strings(v.preparation,12)||!Array.isArray(v.goalCriteria)||v.goalCriteria.length!==document.objectives.length||!v.goalCriteria.every(c=>text(c,500))||!strings(v.missingSources,8)||!Array.isArray(v.phases)||v.phases.length!==document.scenes.length||!Array.isArray(v.mappings)||v.mappings.length>24)return false;
 const indices=(value:unknown):value is number[]=>Array.isArray(value)&&value.length>0&&value.length<=document.objectives.length&&new Set(value).size===value.length&&value.every(i=>Number.isSafeInteger(i)&&i>=0&&i<document.objectives.length);
 for(const phase of v.phases){
  if(!record(phase)||!keys(phase,['sceneId','kind','objectiveIndices','teacherPrompt','checks'])||!document.scenes.some(s=>s.sceneId===phase.sceneId)||!Object.hasOwn(lessonPhaseLabels,String(phase.kind))||!indices(phase.objectiveIndices)||!text(phase.teacherPrompt)||!Array.isArray(phase.checks)||phase.checks.length>3)return false;
  const phaseIndices=phase.objectiveIndices;
  for(const check of phase.checks)if(!record(check)||!keys(check,['objectiveIndices','prompt','expectedEvidence','criterion'])||!indices(check.objectiveIndices)||check.objectiveIndices.some(i=>!phaseIndices.includes(i))||!text(check.prompt)||!text(check.expectedEvidence)||!text(check.criterion,500))return false;
 }
 const phases=v.phases as LessonPhase[];
 if(new Set(phases.map(p=>p.sceneId)).size!==phases.length||!['introduction','activity','practice','assessment'].every(k=>phases.some(p=>p.kind===k)))return false;
 for(let i=0;i<document.objectives.length;i++)if(!phases.some(p=>['activity','practice'].includes(p.kind)&&p.objectiveIndices.includes(i))||!phases.some(p=>p.checks.some(c=>c.objectiveIndices.includes(i))))return false;
 return v.mappings.every(m=>record(m)&&keys(m,['objectiveIndex','curriculumIndex','quote','explanation'])&&Number.isSafeInteger(m.objectiveIndex)&&Number(m.objectiveIndex)>=0&&Number(m.objectiveIndex)<document.objectives.length&&Number.isSafeInteger(m.curriculumIndex)&&Number(m.curriculumIndex)>=0&&Number(m.curriculumIndex)<3&&text(m.quote,1500)&&text(m.explanation,1500))&&new Set(v.mappings.map(m=>`${m.objectiveIndex}/${m.curriculumIndex}`)).size===v.mappings.length;
}
/** Saving a time conflict is allowed; confirming it is not. Semantic quality still needs review. */
export function teachingLessonIssues(document:Document):string[]{
 if(!document.lesson)return [];
 const issues:string[]=[],total=document.scenes.reduce((n,s)=>n+s.durationMinutes,0);
 if(total!==document.totalMinutes)issues.push(`环节合计${total}分钟，目标${document.totalMinutes}分钟；请调整环节或明确修改总时长。`);
 document.objectives.forEach((goal,i)=>{if(/^(?:理解|了解|掌握|熟悉|知道|认识|培养|提高)[^，,；;。]{0,100}$/.test(goal.trim())&&!/(?:说出|列出|写出|找出|指出|解释|比较|判断|计算|完成|举例|记录|设计|标出|描述|辨认|朗读|复述|用.*说明)/.test(goal))issues.push(`目标${i+1}需改成可观察的行动，并保留对应评价。`);});
 return issues;
}
export const lessonArrayIndices={type:'array',minItems:1,maxItems:8,uniqueItems:true,items:{type:'integer',minimum:0,maximum:7}};
const string={type:'string',minLength:1,maxLength:1500},stringsSchema=(maxItems:number)=>({type:'array',maxItems,items:string});
export const teachingLessonToolSchema={type:'object',additionalProperties:false,required:['schemaVersion','subject','grade','preparation','goalCriteria','phases','mappings','missingSources'],properties:{
 schemaVersion:{type:'string',const:TEACHING_LESSON_SCHEMA},subject:{...string,maxLength:160},grade:{...string,maxLength:160},preparation:stringsSchema(12),goalCriteria:{...stringsSchema(8),minItems:1,items:{...string,maxLength:500}},missingSources:stringsSchema(8),
 phases:{type:'array',minItems:4,maxItems:12,items:{type:'object',additionalProperties:false,required:['sceneId','kind','objectiveIndices','teacherPrompt','checks'],properties:{sceneId:{type:'string',pattern:'^[A-Za-z0-9_-]{1,64}$'},kind:{type:'string',enum:Object.keys(lessonPhaseLabels)},objectiveIndices:lessonArrayIndices,teacherPrompt:string,checks:{type:'array',maxItems:3,items:{type:'object',additionalProperties:false,required:['objectiveIndices','prompt','expectedEvidence','criterion'],properties:{objectiveIndices:lessonArrayIndices,prompt:string,expectedEvidence:string,criterion:{...string,maxLength:500}}}}}}},
 mappings:{type:'array',maxItems:24,items:{type:'object',additionalProperties:false,required:['objectiveIndex','curriculumIndex','quote','explanation'],properties:{objectiveIndex:{type:'integer',minimum:0,maximum:7},curriculumIndex:{type:'integer',minimum:0,maximum:2},quote:string,explanation:string}}}
}};
