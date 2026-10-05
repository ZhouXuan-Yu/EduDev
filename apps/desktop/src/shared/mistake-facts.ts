import {plainStudentInput} from './student-context';
import {validMistakeOcrInput,type MistakeOcrInput} from './mistake-ocr';
import {LEARNING_TYPES,type LearningType} from './student-learning';
import {validQuestionContextSource,type QuestionContextSource} from './question-context';
import type {MistakeImageAnalysis} from './contracts';
export const MISTAKE_FACTS_SCHEMA='xiaozhi.education.mistake-facts.v1' as const;
/** A teacher-editable handoff; permissions and facts remain in the existing host tools. */
export function mistakePracticePrompt(sanitizedTitle:string){
 return `请先实际读取当前学生已保存的学习证据，查找并完整读取题名“${sanitizedTitle}”对应的真实题库来源。依据已保存的实际作答、教师错因、知识点、难度、掌握情况与历史，准备5道有来源、题干自足的简答变式题，针对该学生的错误逐步练习；不要把原题重复算作这5道题。请提交可编辑的题目核对卡，等待我逐题确认。题目确认后重新检索并完整读取教师最终保存的这5道题，组成5题练习，提交练习核对卡等待我确认；保留同一照片原题的来源。练习确认后实际核对最新学情，提出完整14天训练计划，结合错因、已有证据与难度安排练习、复习及检查，等待我编辑确认。整个过程不自动确认，不编造作答、成绩或已完成的训练；缺少证据如实说明。`;
}
export type MistakeFacts={title:string;subject:string;knowledgePoint:string;knowledgeType:LearningType;difficulty:'easy'|'medium'|'hard';stem:string;expectedAnswer:string;analysis:string;actualAnswer:string;result:'correct'|'incorrect'|'partial';errorCause:string;occurredAt:string};
export type MistakeFactsInput={schemaVersion:typeof MISTAKE_FACTS_SCHEMA;source:MistakeOcrInput;facts:MistakeFacts};
export type MistakeFactsReceipt={schemaVersion:typeof MISTAKE_FACTS_SCHEMA;requestId:string;analysisVersion:string;sourceSha256:string;sourceVersion:string;correctedSha256:string;facts:MistakeFacts;question:QuestionContextSource;recordId:string;recordSha256:string;confirmedAt:string;digest:string};
export const MISTAKE_FACTS_ERRORS={invalid_input:'请完整核对题目、实际作答、表现、错因、知识点和难度。',permission_denied:'学生或图片不可用，请重新选择。',source_changed:'图片、校正文字或已保存事实变化，请刷新后核对。',conflict:'这张图片已确认事实，请从已保存记录修订；没有重复保存。',cancelled:'已取消确认，没有保存新事实。',unavailable:'未完成事实确认，请重试。'} as const;
export type MistakeFactsResult={ok:true;analysis:MistakeImageAnalysis;duplicate:boolean}|{ok:false;error:keyof typeof MISTAKE_FACTS_ERRORS};
const fields=['title','subject','knowledgePoint','knowledgeType','difficulty','stem','expectedAnswer','analysis','actualAnswer','result','errorCause','occurredAt'];
const text=(v:unknown,max:number,empty=false)=>typeof v==='string'&&(empty||Boolean(v.trim()))&&v.length<=max&&!/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(v);
const hash=(v:unknown)=>typeof v==='string'&&/^[a-f0-9]{64}$/.test(v);
export function validMistakeFacts(v:unknown,now=Date.now()):v is MistakeFacts{
 if(!plainStudentInput(v,fields)||Object.keys(v).length!==fields.length||!text(v.title,160)||!text(v.subject,128)||!text(v.knowledgePoint,128)||typeof v.knowledgeType!=='string'||!LEARNING_TYPES.includes(v.knowledgeType as LearningType)||typeof v.difficulty!=='string'||!['easy','medium','hard'].includes(v.difficulty)||!text(v.stem,12000)||!text(v.expectedAnswer,8000)||!text(v.analysis,12000)||!text(v.actualAnswer,8000,true)||typeof v.result!=='string'||!['correct','incorrect','partial'].includes(v.result)||!text(v.errorCause,2000)||typeof v.occurredAt!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(v.occurredAt))return false;
 const date=Date.parse(v.occurredAt);return Number.isFinite(date)&&date>=0&&date<=now&&new Date(date).toISOString()===v.occurredAt;
}
export function validMistakeFactsInput(v:unknown):v is MistakeFactsInput{return plainStudentInput(v,['schemaVersion','source','facts'])&&Object.keys(v).length===3&&v.schemaVersion===MISTAKE_FACTS_SCHEMA&&validMistakeOcrInput(v.source)&&validMistakeFacts(v.facts);}
export function validMistakeFactsReceipt(v:unknown):v is MistakeFactsReceipt{
 const keys=['schemaVersion','requestId','analysisVersion','sourceSha256','sourceVersion','correctedSha256','facts','question','recordId','recordSha256','confirmedAt','digest'];
 return plainStudentInput(v,keys)&&Object.keys(v).length===keys.length&&v.schemaVersion===MISTAKE_FACTS_SCHEMA&&typeof v.requestId==='string'&&/^[a-f0-9-]{36}$/i.test(v.requestId)&&hash(v.analysisVersion)&&hash(v.sourceSha256)&&text(v.sourceVersion,200)&&hash(v.correctedSha256)&&validMistakeFacts(v.facts)&&validQuestionContextSource(v.question)&&typeof v.recordId==='string'&&/^record_[a-f0-9-]{36}$/i.test(v.recordId)&&hash(v.recordSha256)&&typeof v.confirmedAt==='string'&&Number.isFinite(Date.parse(v.confirmedAt))&&hash(v.digest);
}
