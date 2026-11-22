export const TEACHING_HANDOUT_TOOL = 'education_create_teaching_handout';
export const TEACHING_HANDOUT_SCHEMA = 'xiaozhi.teaching-handout.v1';

export type HandoutCitation = {resourceId:string; offset:number; quote:string};
export type HandoutExercise = {prompt:string; difficulty:'基础'|'巩固'|'拓展'; answer:string; explanation:string};
export type HandoutChapter = {
  title:string; objectives:string[]; focus:string; difficulty:string; explanation:string;
  example:{prompt:string; steps:string[]; answer:string};
  exercises:HandoutExercise[]; citations:HandoutCitation[];
};
export type TeachingHandoutInput = {
  schemaVersion:typeof TEACHING_HANDOUT_SCHEMA; title:string; targetLevel:string;
  chapters:HandoutChapter[]; sourceGaps:string[];
};
export type TeachingHandoutSummary = {bookId:string; taskId:string; runId:string; title:string; chapterCount:number; sourceCount:number};

const text = (maxLength:number, minLength=1) => ({type:'string',minLength,maxLength});
const list = (items:object,minItems:number,maxItems:number) => ({type:'array',items,minItems,maxItems});
const object = (properties:Record<string,object>) => ({type:'object',properties,required:Object.keys(properties),additionalProperties:false});
const citation = object({resourceId:{type:'string',pattern:'^resource_[a-f0-9-]{36}$'},offset:{type:'integer',minimum:0,maximum:10000000},quote:text(240,4)});
const exercise = object({prompt:text(900),difficulty:{type:'string',enum:['基础','巩固','拓展']},answer:text(400),explanation:text(1000)});
const chapter = object({
  title:text(160),objectives:list(text(240),1,6),focus:text(480),difficulty:text(480),explanation:text(1800),
  example:object({prompt:text(900),steps:list(text(600),2,8),answer:text(400)}),
  exercises:list(exercise,2,8),citations:list(citation,0,4),
});
export const teachingHandoutParameters = object({
  schemaVersion:{type:'string',const:TEACHING_HANDOUT_SCHEMA},title:text(160),targetLevel:text(80),
  chapters:list(chapter,1,5),sourceGaps:list(text(300),0,8),
});
