import {createHash,randomUUID} from 'node:crypto';
import {MISTAKE_FACTS_SCHEMA,validMistakeFactsInput,validMistakeFactsReceipt,type MistakeFactsInput,type MistakeFactsReceipt} from '../../shared/mistake-facts';
import {QUESTION_CONTEXT_SCHEMA} from '../../shared/question-context';
import type {QuestionBankItem,QuestionBankItemInput,LearningRecordInput} from '../../shared/contracts';
import {questionVersion} from '../education/question-context-provider';
import {MistakeOcrRepository,type MistakeOcrSql} from './mistake-ocr-repository';
import {MISTAKE_OCR_SCHEMA} from '../../shared/mistake-ocr';
export type MistakeFactsSql=MistakeOcrSql&{createQuestion:(input:QuestionBankItemInput)=>Promise<QuestionBankItem>;createRecord:(input:LearningRecordInput,id:string)=>Promise<unknown>};
type Host=MistakeFactsSql&{dataRoot:()=>string;transaction:<T>(action:(sql:MistakeFactsSql)=>Promise<T>)=>Promise<T>};
const hash=(v:unknown)=>createHash('sha256').update(typeof v==='string'?v:JSON.stringify(v)).digest('hex');
const content=(r:MistakeFactsReceipt)=>JSON.stringify({schemaVersion:MISTAKE_FACTS_SCHEMA,knowledgePoint:r.facts.knowledgePoint,knowledgeType:r.facts.knowledgeType,result:r.facts.result,actualAnswer:r.facts.actualAnswer,expectedAnswer:r.facts.expectedAnswer,errorCause:r.facts.errorCause,difficulty:r.facts.difficulty,question:r.question,sourceSha256:r.sourceSha256});
export class MistakeFactsRepository{
 private host:Host;private guard:MistakeOcrRepository;
 constructor(host:Host){this.host=host;this.guard=new MistakeOcrRepository({...host,transaction:action=>host.transaction(action)});}
 private async verify(sql:MistakeFactsSql,r:MistakeFactsReceipt,studentId:string){
  const {digest,...facts}=r;if(!validMistakeFactsReceipt(r)||hash(facts)!==digest)throw new Error('unavailable');
  const q=(await sql.all('SELECT * FROM question_bank_items WHERE id=?',[r.question.questionId]))[0],record=(await sql.all('SELECT * FROM learning_records WHERE id=? AND student_id=?',[r.recordId,studentId]))[0];
  if(!q||!record||record.record_type!=='mistake'||record.subject!==r.facts.subject||record.content!==content(r)||record.occurred_at!==r.facts.occurredAt||hash(String(record.content))!==r.recordSha256)throw new Error('source_changed');
  const question:QuestionBankItem={id:String(q.id),subject:String(q.subject),grade:String(q.grade),knowledgePoint:String(q.knowledge_point),questionType:String(q.question_type),difficulty:q.difficulty as QuestionBankItem['difficulty'],stem:String(q.stem),answer:String(q.answer),analysis:String(q.analysis),sourceTitle:String(q.source_title),sourceKind:q.source_kind as QuestionBankItem['sourceKind'],tags:JSON.parse(String(q.tags)),createdAt:String(q.created_at),updatedAt:String(q.updated_at)};
  if(questionVersion(question)!==r.question.version)throw new Error('source_changed');
 }
 async confirm(input:MistakeFactsInput,signal:AbortSignal){
  if(!validMistakeFactsInput(input))throw new Error('invalid_input');
  return this.host.transaction(async sql=>{
   const {row,analysis}=await this.guard.row(sql,input.source,false),source=await this.guard.capture(row,input.source,signal);
   if(analysis.ocrStatus!=='teacher_corrected'||!analysis.localOcr||analysis.localOcr.sourceSha256!==source.candidate.contentSha256||analysis.localOcr.sourceVersion!==source.candidate.version)throw new Error('source_changed');
   const existing=analysis.confirmedFacts;
   if(existing){await this.verify(sql,existing,input.source.studentId);if(existing.requestId!==input.source.requestId||existing.analysisVersion!==input.source.version||JSON.stringify(existing.facts)!==JSON.stringify(input.facts))throw new Error('conflict');if(existing.correctedSha256!==hash(analysis.teacherCorrectedText))throw new Error('source_changed');signal.throwIfAborted();return{analysis,duplicate:true};}
   if(analysis.version!==input.source.version)throw new Error('source_changed');signal.throwIfAborted();
   const f=input.facts,student=(await sql.all('SELECT grade FROM students WHERE id=?',[input.source.studentId]))[0];
   const q=await sql.createQuestion({subject:f.subject,grade:String(student.grade||''),knowledgePoint:f.knowledgePoint,questionType:'short_answer',difficulty:f.difficulty,stem:f.stem,answer:f.expectedAnswer,analysis:f.analysis,sourceKind:'teacher_resource',sourceTitle:f.title,tags:['教师核对','错题照片']});signal.throwIfAborted();
   const receipt:MistakeFactsReceipt={schemaVersion:MISTAKE_FACTS_SCHEMA,requestId:input.source.requestId,analysisVersion:input.source.version,sourceSha256:source.candidate.contentSha256,sourceVersion:source.candidate.version,correctedSha256:hash(analysis.teacherCorrectedText),facts:f,question:{schemaVersion:QUESTION_CONTEXT_SCHEMA,questionId:q.id,version:questionVersion(q)},recordId:'record_'+randomUUID(),recordSha256:'',confirmedAt:new Date().toISOString(),digest:''};
   receipt.recordSha256=hash(content(receipt));const {digest:_digest,...saved}=receipt;receipt.digest=hash(saved);
   await sql.createRecord({studentId:input.source.studentId,recordType:'mistake',subject:f.subject,title:f.title+' · 实际作答',content:content(receipt),tags:['教师核对','错题来源'],occurredAt:f.occurredAt},receipt.recordId);signal.throwIfAborted();
   await sql.run('UPDATE mistake_image_analyses SET confirmed_facts_json=?,updated_at=? WHERE id=?',[JSON.stringify(receipt),receipt.confirmedAt,input.source.analysisId]);
   await this.verify(sql,receipt,input.source.studentId);const final=await this.guard.capture(row,input.source,signal);if(final.candidate.version!==source.candidate.version)throw new Error('source_changed');signal.throwIfAborted();
   return{analysis:sql.map((await sql.all('SELECT * FROM mistake_image_analyses WHERE id=?',[input.source.analysisId]))[0]),duplicate:false};
  });
 }
 async forRecord(studentId:string,recordId:string,signal=new AbortController().signal){
  const rows=await this.host.all(`SELECT m.* FROM mistake_image_analyses m JOIN students s ON s.id=m.student_id WHERE m.student_id=? AND s.status='active' AND json_extract(NULLIF(m.confirmed_facts_json,''),'$.recordId')=?`,[studentId,recordId]);
  if(!rows.length)return undefined;const a=this.host.map(rows[0]),r=a.confirmedFacts;if(!r)throw new Error('unavailable');await this.verify(this.host,r,studentId);
  const input={schemaVersion:MISTAKE_OCR_SCHEMA,studentId,analysisId:a.id,version:a.version!,requestId:r.requestId},owned=await this.guard.row(this.host,input),source=await this.guard.capture(owned.row,input,signal);
  if(a.ocrStatus!=='teacher_corrected'||hash(a.teacherCorrectedText)!==r.correctedSha256||source.candidate.version!==r.sourceVersion)throw new Error('source_changed');return r;
 }
}
