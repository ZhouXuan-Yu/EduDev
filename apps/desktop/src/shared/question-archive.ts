import {validMaterialSource,type MaterialSource} from './materials';
export const QUESTION_ARCHIVE_SCHEMA='xiaozhi.question-archive.v1' as const;
export const QUESTION_AI_ARCHIVE_SCHEMA='xiaozhi.question-archive.v2' as const;
export type AiArchiveReceipt={batchId:string;ordinal:number;provider:'qwen';model:string;firstSha:string;finalSha:string;imageSha:string;policy:'text-complete.v1'};
export type QuestionArchive={schemaVersion:typeof QUESTION_ARCHIVE_SCHEMA|typeof QUESTION_AI_ARCHIVE_SCHEMA;extractor:'numbered-text.v1'|'ai-two-pass.v1';state:'rule_extracted'|'ai_final'|'ai_needs_review'|'teacher_edited';number:string;sources:MaterialSource[];issues:string[];sourceRisks:string[];sourceChecked:boolean;answerOrigin:'source'|'teacher'|'missing'|'ai_generated';analysisOrigin:'source'|'teacher'|'missing'|'ai_generated';ai?:AiArchiveReceipt};
export const archiveIssueLabels:Record<string,string>={missing_answer:'缺少答案',missing_analysis:'缺少解析',missing_subject:'学科待分类',missing_grade:'年级待分类',missing_knowledge:'知识点待分类',missing_type:'题型待分类',missing_difficulty:'难度待分类',visual_unchecked:'图表或OCR内容待核对',ambiguous_number:'题号重复或结构不明',cross_chunk:'题面跨正文块，需核对衔接',long_question:'题目过长，需拆分整理'};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
Object.assign(archiveIssueLabels,{uncertain_ocr:'OCR与原图存在疑点',cross_page:'题目跨页，等待完整配对',requires_image:'题面图表尚未完整归档',incomplete_question:'题面信息不完整',answer_conflict:'答案存在冲突',ai_mismatch:'两次AI整理不一致',ai_review:'AI未能完成整理'});
export function validQuestionArchive(v:unknown):v is QuestionArchive{
 if(!obj(v))return false;
 const ai=v.schemaVersion===QUESTION_AI_ARCHIVE_SCHEMA;
 const origins=ai?['source','teacher','missing','ai_generated']:['source','teacher','missing'];
 if(Object.keys(v).length!==(ai?11:10)||v.schemaVersion!==(ai?QUESTION_AI_ARCHIVE_SCHEMA:QUESTION_ARCHIVE_SCHEMA)||v.extractor!==(ai?'ai-two-pass.v1':'numbered-text.v1')
  ||!(ai?['ai_final','ai_needs_review','teacher_edited']:['rule_extracted','teacher_edited']).includes(String(v.state)))return false;
 if(ai){const r=v.ai;if(!obj(r)||Object.keys(r).sort().join(',')!=='batchId,finalSha,firstSha,imageSha,model,ordinal,policy,provider'||typeof r.batchId!=='string'||!/^aibatch_[a-f0-9-]{36}$/.test(r.batchId)||!Number.isSafeInteger(r.ordinal)||Number(r.ordinal)<1||r.provider!=='qwen'||typeof r.model!=='string'||r.model.length>128||r.policy!=='text-complete.v1'||![r.firstSha,r.finalSha].every(s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s))||typeof r.imageSha!=='string'||r.imageSha!==''&&!/^[a-f0-9]{64}$/.test(r.imageSha))return false;}
 return typeof v.number==='string'&&/^\d{1,5}$/.test(v.number)&&Array.isArray(v.sources)&&v.sources.length>0&&v.sources.length<=64&&v.sources.every(validMaterialSource)
  &&Array.isArray(v.issues)&&v.issues.length<=16&&v.issues.every(i=>typeof i==='string'&&Object.hasOwn(archiveIssueLabels,i))&&Array.isArray(v.sourceRisks)&&v.sourceRisks.length<=4
  &&v.sourceRisks.every(i=>['visual_unchecked','cross_chunk','ambiguous_number','long_question'].includes(String(i)))&&typeof v.sourceChecked==='boolean'&&origins.includes(String(v.answerOrigin))&&origins.includes(String(v.analysisOrigin));
}
export function readQuestionArchive(value:unknown):QuestionArchive|undefined{if(value===undefined||value===null||value==='')return undefined;let v:unknown;try{v=typeof value==='string'?JSON.parse(value):value;}catch{throw new Error('question_archive_invalid');}if(!validQuestionArchive(v))throw new Error('question_archive_invalid');return v;}
export type ArchiveFields={stem:string;answer:string;analysis:string;subject:string;grade:string;knowledgePoint:string;questionType:string;difficulty:'easy'|'medium'|'hard'};
export function archiveEligible(q:ArchiveFields&{archive?:QuestionArchive}){return !q.archive||(!q.archive.issues.length&&!archiveMissing(q).length&&(q.archive.schemaVersion!==QUESTION_AI_ARCHIVE_SCHEMA||['ai_final','teacher_edited'].includes(q.archive.state))&&(q.archive.sourceChecked||!q.archive.sourceRisks.length)&&!q.archive.sourceRisks.some(code=>['long_question','visual_unchecked'].includes(code)));}
export function archiveMissing(q:ArchiveFields){return [['answer','missing_answer'],['analysis','missing_analysis'],['subject','missing_subject'],['grade','missing_grade'],['knowledgePoint','missing_knowledge'],['questionType','missing_type']].filter(([key])=>!q[key as keyof ArchiveFields].trim()).map(([,code])=>code);}
/** A routine save is not evidence that an AI completeness concern was resolved. */
export function archiveIssuesAfterEdit(archive:QuestionArchive,before:ArchiveFields,after:ArchiveFields,checked:boolean){
 const source=archive.sourceRisks.filter(code=>['long_question','visual_unchecked'].includes(code)||!checked||after.stem===before.stem&&['cross_chunk','ambiguous_number'].includes(code));
 const ai=archive.ai?archive.issues.filter(code=>{
  if(code.startsWith('missing_'))return false;
  if(['long_question','visual_unchecked','requires_image'].includes(code))return true;
  if(!checked)return true;
  if(['cross_page','incomplete_question','uncertain_ocr','cross_chunk','ambiguous_number'].includes(code))return after.stem===before.stem;
  if(code==='answer_conflict')return after.answer===before.answer&&after.analysis===before.analysis;
  return after.stem===before.stem&&after.answer===before.answer&&after.analysis===before.analysis;
 }):[];
 return [...new Set([...source,...ai,...archiveMissing(after)])];
}
export type ArchiveEdit={questionId:string;version:string;fields:ArchiveFields;sourceChecked:boolean};
export function validArchiveEdit(v:unknown):v is ArchiveEdit{return obj(v)&&Object.keys(v).length===4&&typeof v.questionId==='string'&&/^question_[a-f0-9-]{36}$/i.test(v.questionId)&&typeof v.version==='string'&&/^[a-f0-9]{64}$/.test(v.version)&&typeof v.sourceChecked==='boolean'&&obj(v.fields)&&Object.keys(v.fields).length===8&&['stem','answer','analysis','subject','grade','knowledgePoint','questionType'].every(k=>typeof (v.fields as Record<string,unknown>)[k]==='string'&&String((v.fields as Record<string,unknown>)[k]).length<=(['stem','answer','analysis'].includes(k)?12000:128))&&!!String(v.fields.stem).trim()&&['easy','medium','hard'].includes(String(v.fields.difficulty));}
export type ArchiveStatus={pending:number;failed:number;documents:number;questions:number;needsAttention:number;failures:{title:string;code:string}[]};
