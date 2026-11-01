import {QUESTION_BOOK_ARCHIVE_SCHEMA,validQuestionBookEvidence,type QuestionBookEvidence} from './question-book-answer';
import {validMaterialSource,type MaterialSource} from './materials';
import {validNativeQuestionDocument,nativeQuestionComplete,nativeQuestionConflicts,type NativeQuestionDocument} from './native-question';
import {QUESTION_WEB_ARCHIVE_SCHEMA,validQuestionWebEvidence,type QuestionWebEvidence} from './question-web-answer';
import {validMaterialPageSource,type MaterialPageSource} from './material-ai-page';
export const QUESTION_ARCHIVE_SCHEMA='xiaozhi.question-archive.v1' as const;
export const QUESTION_AI_ARCHIVE_SCHEMA='xiaozhi.question-archive.v2' as const;
export const QUESTION_NATIVE_ARCHIVE_SCHEMA='xiaozhi.question-archive.v3' as const;
export const QUESTION_PAGE_ARCHIVE_SCHEMA='xiaozhi.question-archive.v5' as const;
export type AiArchiveReceipt={batchId:string;ordinal:number;provider:'qwen'|'deepseek';model:string;firstSha:string;finalSha:string;imageSha:string;policy:'text-complete.v1'|'image-text-complete.v1'|'native-complete.v1'|'page-image-complete.v1'|'page-crop-complete.v1'};
export type QuestionArchive={schemaVersion:typeof QUESTION_ARCHIVE_SCHEMA|typeof QUESTION_AI_ARCHIVE_SCHEMA|typeof QUESTION_NATIVE_ARCHIVE_SCHEMA|typeof QUESTION_WEB_ARCHIVE_SCHEMA|typeof QUESTION_PAGE_ARCHIVE_SCHEMA|typeof QUESTION_BOOK_ARCHIVE_SCHEMA;extractor:'numbered-text.v1'|'ai-two-pass.v1'|'ai-native-two-pass.v1'|'web-answer-enriched.v1'|'ai-page-two-pass.v1'|'book-answer-enriched.v1';state:'rule_extracted'|'ai_final'|'ai_needs_review'|'teacher_edited'|'web_enriched'|'book_enriched';number:string;sources:MaterialSource[];issues:string[];sourceRisks:string[];sourceChecked:boolean;answerOrigin:'source'|'teacher'|'missing'|'ai_generated'|'web_extracted'|'book_extracted'|'unattributed';analysisOrigin:'source'|'teacher'|'missing'|'ai_generated'|'web_extracted'|'book_extracted'|'unattributed';ai?:AiArchiveReceipt;native?:NativeQuestionDocument;web?:QuestionWebEvidence;pageSource?:MaterialPageSource;book?:QuestionBookEvidence};
export const archiveIssueLabels:Record<string,string>={missing_answer:'缺少答案',missing_analysis:'缺少解析',missing_subject:'学科待分类',missing_grade:'年级待分类',missing_knowledge:'知识点待分类',missing_type:'题型待分类',missing_difficulty:'难度待分类',visual_unchecked:'图表或OCR内容待核对',ambiguous_number:'题号重复或结构不明',cross_chunk:'题面跨正文块，需核对衔接',long_question:'题目过长，需拆分整理'};
const obj=(v:unknown):v is Record<string,unknown>=>!!v&&typeof v==='object'&&!Array.isArray(v);
Object.assign(archiveIssueLabels,{uncertain_ocr:'OCR与原图存在疑点',cross_page:'题目跨页，等待完整配对',requires_image:'题面图表尚未完整归档',incomplete_question:'题面信息不完整',answer_conflict:'答案存在冲突',ai_mismatch:'两次AI整理不一致',ai_review:'AI未能完成整理'});
export function validQuestionArchive(v:unknown):v is QuestionArchive{
 if(!obj(v))return false;
 const bookArchive=v.schemaVersion===QUESTION_BOOK_ARCHIVE_SCHEMA,book=bookArchive||v.book!==undefined;
 const native=v.schemaVersion===QUESTION_NATIVE_ARCHIVE_SCHEMA,web=v.schemaVersion===QUESTION_WEB_ARCHIVE_SCHEMA,pageArchive=v.schemaVersion===QUESTION_PAGE_ARCHIVE_SCHEMA||bookArchive,page=pageArchive||web&&v.pageSource!==undefined,ai=native||pageArchive||v.schemaVersion===QUESTION_AI_ARCHIVE_SCHEMA||web&&v.ai!==undefined;
 const origins=book?(web?['source','teacher','missing','ai_generated','web_extracted','book_extracted','unattributed']:['source','teacher','missing','ai_generated','book_extracted']):web?['source','teacher','missing','ai_generated','web_extracted','unattributed']:ai?['source','teacher','missing','ai_generated']:['source','teacher','missing'];
 if(Object.keys(v).length!==(10+(native?1:0)+(ai?1:0)+(web?1:0)+(page?1:0)+(book?1:0))||v.schemaVersion!==(bookArchive?QUESTION_BOOK_ARCHIVE_SCHEMA:web?QUESTION_WEB_ARCHIVE_SCHEMA:native?QUESTION_NATIVE_ARCHIVE_SCHEMA:pageArchive?QUESTION_PAGE_ARCHIVE_SCHEMA:ai?QUESTION_AI_ARCHIVE_SCHEMA:QUESTION_ARCHIVE_SCHEMA)||v.extractor!==(bookArchive?'book-answer-enriched.v1':web?'web-answer-enriched.v1':native?'ai-native-two-pass.v1':pageArchive?'ai-page-two-pass.v1':ai?'ai-two-pass.v1':'numbered-text.v1')
  ||!(bookArchive?['book_enriched','teacher_edited']:web?['web_enriched','teacher_edited']:ai?['ai_final','ai_needs_review','teacher_edited']:['rule_extracted','teacher_edited']).includes(String(v.state)))return false;
 if(book){
  if((!bookArchive&&!web)||!page||!validQuestionBookEvidence(v.book)||v.state==='book_enriched'&&!Object.keys(v.book.roles).length)return false;
  for(const role of ['answer','analysis'] as const)if(!!v.book.roles[role]!== (v[`${role}Origin`]==='book_extracted'))return false;
 }else if(v.answerOrigin==='book_extracted'||v.analysisOrigin==='book_extracted')return false;
 if(web){
  if(!validQuestionWebEvidence(v.web)||(v.web.base==='ai')!==ai||v.web.base==='manual'&&(!Array.isArray(v.sources)||v.sources.length!==0)||v.state==='web_enriched'&&!Object.keys(v.web.roles).length)return false;
  for(const role of ['answer','analysis'] as const){const proof=v.web.roles[role];if(proof&&v[`${role}Origin`]!==(proof.kind==='web_extracted'?'web_extracted':'ai_generated')||!proof&&(v[`${role}Origin`]==='web_extracted'||!ai&&v[`${role}Origin`]==='ai_generated'))return false;}
 }
 if(page&&(!ai||!validMaterialPageSource(v.pageSource)||!Array.isArray(v.sources)||!v.sources.every(s=>validMaterialSource(s)&&s.resourceId===(v.pageSource as MaterialPageSource).resourceId&&s.version===(v.pageSource as MaterialPageSource).version)))return false;
 if(ai){const r=v.ai;if(!obj(r)||Object.keys(r).sort().join(',')!=='batchId,finalSha,firstSha,imageSha,model,ordinal,policy,provider'||typeof r.batchId!=='string'||!/^aibatch_[a-f0-9-]{36}$/.test(r.batchId)||!Number.isSafeInteger(r.ordinal)||Number(r.ordinal)<1||!['qwen','deepseek'].includes(String(r.provider))||typeof r.model!=='string'||r.model.length>128||!(native?['native-complete.v1']:page?['page-image-complete.v1','page-crop-complete.v1']:['text-complete.v1','image-text-complete.v1']).includes(String(r.policy))||['image-text-complete.v1','page-image-complete.v1','page-crop-complete.v1'].includes(String(r.policy))&&(typeof r.imageSha!=='string'||!/^[a-f0-9]{64}$/.test(r.imageSha))||![r.firstSha,r.finalSha].every(s=>typeof s==='string'&&/^[a-f0-9]{64}$/.test(s))||typeof r.imageSha!=='string'||r.imageSha!==''&&!/^[a-f0-9]{64}$/.test(r.imageSha))return false;}
 if(native){const document=v.native;if(!validNativeQuestionDocument(document)||v.answerOrigin!==document.roles.answer.origin||v.analysisOrigin!==document.roles.analysis.origin||!Array.isArray(v.sources)||!v.sources.every(s=>validMaterialSource(s)&&s.resourceId===document.source.resourceId&&s.version===document.source.resourceVersion))return false;}
 return typeof v.number==='string'&&/^\d{1,5}$/.test(v.number)&&Array.isArray(v.sources)&&v.sources.length>=(page||web&&validQuestionWebEvidence(v.web)&&v.web.base==='manual'?0:1)&&v.sources.length<=64&&v.sources.every(validMaterialSource)
  &&Array.isArray(v.issues)&&v.issues.length<=16&&v.issues.every(i=>typeof i==='string'&&Object.hasOwn(archiveIssueLabels,i))&&Array.isArray(v.sourceRisks)&&v.sourceRisks.length<=4
  &&v.sourceRisks.every(i=>['visual_unchecked','cross_chunk','ambiguous_number','long_question'].includes(String(i)))&&typeof v.sourceChecked==='boolean'&&origins.includes(String(v.answerOrigin))&&origins.includes(String(v.analysisOrigin));
}
export function readQuestionArchive(value:unknown):QuestionArchive|undefined{if(value===undefined||value===null||value==='')return undefined;let v:unknown;try{v=typeof value==='string'?JSON.parse(value):value;}catch{throw new Error('question_archive_invalid');}if(!validQuestionArchive(v))throw new Error('question_archive_invalid');return v;}
export type ArchiveFields={stem:string;answer:string;analysis:string;subject:string;grade:string;knowledgePoint:string;questionType:string;difficulty:'easy'|'medium'|'hard'};
/** Extraction and answer enrichment alone are not evidence that an imported stem was checked. */
export function archiveNeedsVerification(a:QuestionArchive){return !a.ai&&a.sources.length>0&&(a.state==='rule_extracted'||!a.sourceChecked);}
export function archiveEligible(q:ArchiveFields&{archive?:QuestionArchive}){return !q.archive||(validQuestionArchive(q.archive)&&!archiveNeedsVerification(q.archive)&&(!q.archive.native||nativeQuestionComplete(q.archive.native)&&!nativeQuestionConflicts(q,q.archive.native).length)&&!q.archive.issues.length&&!archiveMissing(q).length&&(!q.archive.ai||['ai_final','teacher_edited','web_enriched','book_enriched'].includes(q.archive.state))&&(q.archive.sourceChecked||!q.archive.sourceRisks.length)&&!q.archive.sourceRisks.some(code=>['long_question','visual_unchecked'].includes(code)));}
export function archiveMissing(q:ArchiveFields){return [['answer','missing_answer'],['analysis','missing_analysis'],['subject','missing_subject'],['grade','missing_grade'],['knowledgePoint','missing_knowledge'],['questionType','missing_type']].filter(([key])=>!q[key as keyof ArchiveFields].trim()).map(([,code])=>code);}
/** A routine save is not evidence that an AI completeness concern was resolved. */
export function archiveIssuesAfterEdit(archive:QuestionArchive,before:ArchiveFields,after:ArchiveFields,checked:boolean){
 const source=archive.sourceRisks.filter(code=>['long_question','visual_unchecked'].includes(code)||!checked||after.stem===before.stem&&['cross_chunk','ambiguous_number'].includes(code));
 const ai=archive.ai?archive.issues.filter(code=>{
  if(code.startsWith('missing_'))return false;
  if(archive.ai?.policy==='page-crop-complete.v1'&&code==='cross_page')return true;
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
export type ArchiveStatus={pending:number;failed:number;documents:number;questions:number;needsAttention:number;associated?:number;associating?:boolean;failures:{title:string;code:string}[]};
