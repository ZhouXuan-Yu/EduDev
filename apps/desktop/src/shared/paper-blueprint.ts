import type {QuestionBankItem} from './contracts';
import type {QuestionContextSource} from './question-context';
import {plainStudentInput} from './student-context';
export const PAPER_SCHEMA='xiaozhi.paper-blueprint.v1' as const;
export const PAPER_GENERATED_SCHEMA='xiaozhi.paper-blueprint.v2' as const;
export type PaperMode='source_only'|'hybrid'|'ai_original';
export type PaperGeneration={groupId:string;effectDigest:string;generationKind:'ai_original'|'variation'};
export type PaperGenerationContext={sessionId:string;title:string;subject:string;grade:string;originalCount:number;variationCount:number};
export type PaperGenerationQuery={schemaVersion:typeof PAPER_SCHEMA;subject:string;grade:string};
export const PAPER_TOOLS=['education_propose_paper','education_read_paper'] as const;
export type PaperSection={id:string;label:string;questionType:string;count:number;points:number;difficulty?:'easy'|'medium'|'hard';knowledgePoint?:string;generatedCount?:number};
export type PaperBlueprint={title:string;subject:string;grade:string;durationMinutes:number;totalPoints:number;mode:PaperMode;sections:PaperSection[]};
export type PaperItem={sectionId:string;number:number;points:number;question:QuestionBankItem;source:QuestionContextSource;generation?:PaperGeneration};
export type PaperSelection={items:PaperItem[];shortages:{sectionId:string;label:string;required:number;selected:number;missing:number;sourceKind?:'original'|'generated'}[];scanned:number;scanComplete:boolean;excluded:Record<'unsupported'|'missing_answer'|'source_unavailable',number>;duplicateRecords:number};
export type PaperSummary={id:string;sessionId:string;runId:string;callId:string;requestId:string;revision:number;title:string;state:'pending'|'confirmed'|'rejected';count:number;totalPoints:number;complete:boolean};
export type PaperView=PaperSummary&{blueprint:PaperBlueprint;selection:PaperSelection;sourceCurrent:boolean;exportCurrent?:boolean;answerVerified:false;digest?:string};
export type PaperCreateInput={schemaVersion:typeof PAPER_SCHEMA|typeof PAPER_GENERATED_SCHEMA;sessionId:string;requestId:string;blueprint:PaperBlueprint;generationScope?:'approved_session';replace?:{id:string;revision:number}};
export type PaperReviewInput={schemaVersion:typeof PAPER_SCHEMA;sessionId:string;id:string};
export type PaperDecision=PaperReviewInput&{revision:number;action:'confirm'|'reject'};
export type PaperCancelInput={schemaVersion:typeof PAPER_SCHEMA;sessionId:string;requestId:string};
export type PaperError='invalid_input'|'permission_denied'|'source_changed'|'conflict'|'shortage'|'unavailable'|'cancelled';
export type PaperResult<T>={ok:true;value:T}|{ok:false;error:PaperError};
export const PAPER_ERRORS:Record<PaperError,string>={invalid_input:'请检查蓝图：题型、题数、每题分数与总分必须一致。',permission_denied:'当前对话或学生已不可用，请重新打开组卷。',source_changed:'试卷引用的题目或原件已变化，请重新生成并核对。',conflict:'这份草稿已经处理或修改，请刷新后重试。',shortage:'题库不足以满足蓝图，请调整要求或先补齐题库。',unavailable:'试卷读取或保存未完成，请重试。',cancelled:'已停止组卷，未保存新的试卷。'};
const text=(v:unknown,max=128)=>typeof v==='string'&&v.trim().length>0&&v.length<=max&&!/[\x00-\x1f]/.test(v);
const integer=(v:unknown,min:number,max:number)=>typeof v==='number'&&Number.isSafeInteger(v)&&v>=min&&v<=max;
const uuid='[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}';
export const validPaperSession=(v:unknown):v is string=>typeof v==='string'&&new RegExp('^aisession_'+uuid+'$','i').test(v);
const id=(v:unknown)=>typeof v==='string'&&new RegExp('^xipaper_'+uuid+'$','i').test(v);
const request=(v:unknown)=>typeof v==='string'&&new RegExp('^'+uuid+'$','i').test(v);
export function validPaperBlueprint(v:unknown):v is PaperBlueprint{
 if(!plainStudentInput(v,['title','subject','grade','durationMinutes','totalPoints','mode','sections'])||!text(v.title,160)||!text(v.subject)||!text(v.grade)||!['source_only','hybrid','ai_original'].includes(String(v.mode))||!integer(v.durationMinutes,1,1440)||!integer(v.totalPoints,1,10000)||!Array.isArray(v.sections)||Object.getPrototypeOf(v.sections)!==Array.prototype||v.sections.length<1||v.sections.length>20||Reflect.ownKeys(v.sections).length!==v.sections.length+1||!Array.from({length:v.sections.length},(_,i)=>i).every(i=>Object.prototype.hasOwnProperty.call(v.sections,i)&&'value' in Object.getOwnPropertyDescriptor(v.sections,String(i))!))return false;
 if(!v.sections.every(s=>plainStudentInput(s,['id','label','questionType','count','points','difficulty','knowledgePoint','generatedCount'])&&typeof s.id==='string'&&/^[a-zA-Z0-9_-]{1,40}$/.test(s.id)&&text(s.label,80)&&text(s.questionType)&&integer(s.count,1,100)&&integer(s.points,1,1000)&&(s.difficulty===undefined||['easy','medium','hard'].includes(String(s.difficulty)))&&(s.knowledgePoint===undefined||text(s.knowledgePoint))&&(v.mode==='hybrid'?integer(s.generatedCount,0,s.count as number):s.generatedCount===undefined)))return false;
 const sections=v.sections as PaperSection[];return new Set(sections.map(s=>s.id)).size===sections.length&&sections.reduce((n,s)=>n+s.count,0)<=100&&sections.reduce((n,s)=>n+s.count*s.points,0)===v.totalPoints;
}
export function validPaperCreate(v:unknown):v is PaperCreateInput{return plainStudentInput(v,['schemaVersion','sessionId','requestId','blueprint','replace','generationScope'])&&validPaperBlueprint(v.blueprint)&&(v.blueprint.mode==='source_only'?v.schemaVersion===PAPER_SCHEMA&&v.generationScope===undefined:v.schemaVersion===PAPER_GENERATED_SCHEMA&&v.generationScope==='approved_session')&&validPaperSession(v.sessionId)&&request(v.requestId)&&(v.replace===undefined||plainStudentInput(v.replace,['id','revision'])&&id(v.replace.id)&&integer(v.replace.revision,1,1000000));}
export function validPaperReview(v:unknown,decision=false):v is PaperDecision{return plainStudentInput(v,decision?['schemaVersion','sessionId','id','revision','action']:['schemaVersion','sessionId','id'])&&v.schemaVersion===PAPER_SCHEMA&&validPaperSession(v.sessionId)&&id(v.id)&&(!decision||integer(v.revision,1,1000000)&&['confirm','reject'].includes(String(v.action)));}
export function validPaperCancel(v:unknown):v is PaperCancelInput{return plainStudentInput(v,['schemaVersion','sessionId','requestId'])&&v.schemaVersion===PAPER_SCHEMA&&validPaperSession(v.sessionId)&&request(v.requestId);}
export const defaultPaperBlueprint=():PaperBlueprint=>({title:'数学练习卷',subject:'数学',grade:'初二',durationMinutes:90,totalPoints:100,mode:'source_only',sections:[{id:'choice',label:'选择题',questionType:'选择题',count:10,points:3},{id:'fill',label:'填空题',questionType:'填空题',count:6,points:5},{id:'solve',label:'解答题',questionType:'解答题',count:4,points:10}]});

export const generatedPaperCount=(b:PaperBlueprint,s:PaperSection)=>b.mode==='ai_original'?s.count:b.mode==='hybrid'?s.generatedCount!:0;
export const validPaperGenerationQuery=(v:unknown):v is PaperGenerationQuery=>plainStudentInput(v,['schemaVersion','subject','grade'])&&v.schemaVersion===PAPER_SCHEMA&&text(v.subject)&&text(v.grade);
